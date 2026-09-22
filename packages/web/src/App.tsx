import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, ParikshaaClient } from "./api.ts";
import { AnswerInput } from "./components/AnswerInput.tsx";
import { ProbePanel } from "./components/ProbePanel.tsx";
import { Receipt } from "./components/Receipt.tsx";
import { InviteGate } from "./components/InviteGate.tsx";
import { TokenGate } from "./components/TokenGate.tsx";
import { clearLocalDrafts, loadLocalDrafts, purgeExpiredDrafts, saveLocalDraft } from "./drafts.ts";

interface OpenProbe {
  readonly id: string;
  prompt: string;
  streaming: boolean;
}

/** How long typing must pause before the text is sent. */
export const AUTOSAVE_DELAY_MS = 1200;
/** How often an open page checks in while visible. */
export const HEARTBEAT_MS = 30_000;
/** How often unsent drafts are retried while the connection is down. */
const RETRY_MS = 15_000;

/**
 * The attempt token, for this tab.
 *
 * sessionStorage survives a reload and a restored tab — the ordinary ways a
 * page gets lost mid-exam — but not the tab being closed, so a shared or
 * invigilated machine does not keep it for the next person. A token that came
 * in the URL is moved here and taken out of the address bar, where it would
 * otherwise sit in history and be shared by anyone who copies the link.
 */
const TOKEN_KEY = "parikshaa.attempt-token";
/**
 * An invitation link's code, kept the same way. It is the durable credential
 * for the window: when a token runs out, the page quietly opens the link again.
 */
const INVITE_KEY = "parikshaa.invite";

const session = {
  get: (key: string): string | null => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string | null): void => {
    try {
      if (value === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    } catch {
      // Held in memory only; a reload will ask again.
    }
  },
};

/** Move a credential from the address bar into this tab's storage. */
function takeFromUrl(name: string, key: string): string | null {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(name);
  if (value === null) return session.get(key);
  session.set(key, value);
  params.delete(name);
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query === "" ? "" : `?${query}`}${window.location.hash}`);
  return value;
}

function rememberToken(token: string | null): void {
  session.set(TOKEN_KEY, token);
}

/** An invitation code (org.invitation.mac) rather than an attempt token, which is a JWT. */
const isInviteCode = (value: string) => !value.startsWith("eyJ") && value.split(".").length === 3;

export function App({ client: injected }: { client?: ParikshaaClient } = {}) {
  const [invite, setInvite] = useState<string | null>(() =>
    injected === undefined ? takeFromUrl("invite", INVITE_KEY) : null,
  );
  const [token, setToken] = useState<string | null>(() => (injected === undefined ? takeFromUrl("token", TOKEN_KEY) : null));

  const client = useMemo(
    () => injected ?? (token === null ? null : new ParikshaaClient(token)),
    [injected, token],
  );
  const opened = useCallback((next: string) => {
    rememberToken(next);
    setToken(next);
  }, []);
  const expired = useCallback(() => {
    rememberToken(null);
    setToken(null);
  }, []);

  if (client === null && invite !== null) {
    return (
      <InviteGate
        code={invite}
        onOpened={opened}
        onForget={() => {
          session.set(INVITE_KEY, null);
          setInvite(null);
        }}
      />
    );
  }
  if (client === null) {
    return (
      <TokenGate
        onToken={(next) => {
          if (isInviteCode(next)) {
            session.set(INVITE_KEY, next);
            setInvite(next);
          } else opened(next);
        }}
      />
    );
  }
  // A token that ran out, with the invitation still in hand: open it again.
  return <Attempt client={client} {...(invite === null ? {} : { onExpired: expired })} />;
}

/** Where a question's unsent text stands. */
type DraftStatus = "saving" | "synced" | "offline";

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

function Attempt({ client, onExpired }: { client: ParikshaaClient; onExpired?: () => void }) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, DraftStatus>>({});
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});
  const [probe, setProbe] = useState<OpenProbe | null>(null);
  const probeRequested = useRef(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const restored = useRef(false);
  const online = useOnline();

  const state = useQuery({ queryKey: ["state"], queryFn: () => client.state() });
  const ledger = useQuery({
    queryKey: ["ledger"],
    queryFn: () => client.ledger(),
    enabled: state.data !== undefined && state.data.state !== "in_progress",
  });

  const attemptId = state.data?.attemptId ?? null;
  const expiresAt = state.data?.expiresAt ?? 0;
  const inProgress = state.data?.state === "in_progress";

  // Kept in refs so timers and event handlers always see the latest values
  // without being torn down and re-armed on every keystroke.
  const latest = useRef({ drafts, status, attemptId, expiresAt, inProgress });
  latest.current = { drafts, status, attemptId, expiresAt, inProgress };

  /**
   * Restore unsent work once, when the attempt first loads.
   *
   * The server's drafts cover a dead laptop or a different device; this
   * device's unconfirmed drafts cover typing that happened while offline, and
   * win over the server's because the server has never seen them.
   */
  useEffect(() => {
    if (restored.current || state.data === undefined) return;
    restored.current = true;
    purgeExpiredDrafts();

    const id = state.data.attemptId;
    if (state.data.state !== "in_progress") {
      clearLocalDrafts(id);
      return;
    }
    const committed = new Map<string, string>(state.data.answers.map((a) => [a.questionId, a.answer]));
    const fromServer = Object.fromEntries((state.data.drafts ?? []).map((d) => [d.questionId, d.answer]));
    const unsent = Object.entries(loadLocalDrafts(id)).filter(([, d]) => !d.synced);

    const merged: Record<string, string> = { ...fromServer };
    const nextStatus: Record<string, DraftStatus> = {};
    for (const questionId of Object.keys(fromServer)) nextStatus[questionId] = "synced";
    for (const [questionId, d] of unsent) {
      merged[questionId] = d.answer;
      nextStatus[questionId] = "offline";
    }
    for (const [questionId, answer] of Object.entries(merged)) {
      if (answer === (committed.get(questionId) ?? "")) delete merged[questionId];
    }
    setDrafts(merged);
    setStatus(nextStatus);
  }, [state.data]);

  /** Send one question's text to the server, and record how that went. */
  const flush = useCallback(
    async (questionId: string) => {
      const { drafts: current, attemptId: id, expiresAt: deadline, inProgress: open } = latest.current;
      const text = current[questionId];
      if (text === undefined || id === null || !open) return;

      setStatus((prior) => ({ ...prior, [questionId]: "saving" }));
      try {
        await client.saveDraft(questionId, text);
        // Only confirm what was sent; the candidate may have typed on since.
        if (latest.current.drafts[questionId] === text) {
          saveLocalDraft(id, deadline, questionId, { answer: text, synced: true });
          setStatus((prior) => ({ ...prior, [questionId]: "synced" }));
        }
      } catch (error) {
        if (error instanceof ApiError) {
          // The server answered: the attempt closed, or time ran out. Show
          // what it now says rather than retrying something it refused.
          setStatus((prior) => ({ ...prior, [questionId]: "synced" }));
          await queryClient.invalidateQueries({ queryKey: ["state"] });
          return;
        }
        setStatus((prior) => ({ ...prior, [questionId]: "offline" }));
      }
    },
    [client, queryClient],
  );

  const flushUnsent = useCallback(() => {
    for (const [questionId, s] of Object.entries(latest.current.status)) {
      if (s === "offline") void flush(questionId);
    }
  }, [flush]);

  // Back online, and periodically while anything is waiting.
  useEffect(() => {
    window.addEventListener("online", flushUnsent);
    const retry = setInterval(flushUnsent, RETRY_MS);
    return () => {
      window.removeEventListener("online", flushUnsent);
      clearInterval(retry);
    };
  }, [flushUnsent]);

  const edit = (questionId: string, text: string) => {
    setDrafts((prior) => ({ ...prior, [questionId]: text }));
    if (attemptId !== null) saveLocalDraft(attemptId, expiresAt, questionId, { answer: text, synced: false });
    setStatus((prior) => ({ ...prior, [questionId]: "saving" }));

    const pending = timers.current.get(questionId);
    if (pending !== undefined) clearTimeout(pending);
    timers.current.set(
      questionId,
      setTimeout(() => {
        timers.current.delete(questionId);
        void flush(questionId);
      }, AUTOSAVE_DELAY_MS),
    );
  };

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
    };
  }, []);

  /**
   * Check in while the page is visible.
   *
   * Tells an invigilator the candidate is here, and is how the page learns of
   * extra time or of being set aside without a reload.
   */
  useEffect(() => {
    if (!inProgress) return;
    const beat = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const now = await client.heartbeat();
        const known = latest.current;
        if (now.expiresAt !== known.expiresAt || now.state !== "in_progress") {
          await queryClient.invalidateQueries({ queryKey: ["state"] });
        }
      } catch {
        // Offline; the banner says so, and the next beat will try again.
      }
    };
    void beat();
    const id = setInterval(() => void beat(), HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [client, queryClient, inProgress]);

  /**
   * Ask whether a probe is due.
   *
   * Called after an answer is committed rather than on a timer or on autosave:
   * a probe is a response to something the candidate just finished, and asking
   * one while they are mid-sentence would be an interruption.
   *
   * If the stream fails, the placeholder goes and the attempt is re-read: a
   * probe the server did record comes back through `openProbe`, and one it did
   * not is simply not asked.
   */
  const checkForProbe = useCallback(async () => {
    if (probeRequested.current) return;
    probeRequested.current = true;
    const recover = async () => {
      setProbe(null);
      await queryClient.invalidateQueries({ queryKey: ["state"] });
    };
    try {
      await client.streamProbe({
        onToken: (chunk) =>
          setProbe((current) =>
            current === null ? current : { ...current, prompt: current.prompt + chunk },
          ),
        onProbe: (raised) =>
          setProbe({ id: raised.id, prompt: raised.prompt, streaming: false }),
        onNone: () => setProbe(null),
        onError: () => void recover(),
      });
    } catch {
      await recover();
    } finally {
      probeRequested.current = false;
    }
  }, [client, queryClient]);

  // Reopen a probe the candidate left unanswered, e.g. after a reload.
  useEffect(() => {
    const open = state.data?.openProbe;
    if (open != null && probe === null) {
      setProbe({ id: open.id, prompt: open.prompt, streaming: false });
    }
  }, [state.data?.openProbe, probe]);

  const saveAnswer = useMutation({
    mutationFn: ({ questionId, answer }: { questionId: string; answer: string }) =>
      client.saveAnswer(questionId, answer),
    onSuccess: async (_result, { questionId, answer }) => {
      setSavedAt((prior) => ({ ...prior, [questionId]: Date.now() }));
      if (attemptId !== null) saveLocalDraft(attemptId, expiresAt, questionId, { answer, synced: true });
      setStatus((prior) => ({ ...prior, [questionId]: "synced" }));
      await queryClient.invalidateQueries({ queryKey: ["state"] });
      if (probe === null) {
        setProbe({ id: "", prompt: "", streaming: true });
        void checkForProbe();
      }
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      // Send anything still waiting on the debounce, so the server commits it.
      for (const [questionId, timer] of timers.current) {
        clearTimeout(timer);
        timers.current.delete(questionId);
        await flush(questionId);
      }
      await client.submit();
    },
    onSuccess: async () => {
      setProbe(null);
      if (attemptId !== null) clearLocalDrafts(attemptId);
      await queryClient.invalidateQueries();
    },
  });

  const expired = state.error instanceof ApiError && state.error.status === 401;
  useEffect(() => {
    if (expired) onExpired?.();
  }, [expired, onExpired]);

  if (state.isPending) return <main className="page"><p className="notice">Loading your exam…</p></main>;
  if (state.error !== null) {
    return (
      <main className="page">
        <p className="error">Could not load this attempt. The access code may have expired.</p>
      </main>
    );
  }

  const { exam, answers, state: attemptState, voidReason } = state.data;
  const answered = new Map<string, string>(answers.map((a) => [a.questionId, a.answer]));
  const open = attemptState === "in_progress";

  /**
   * Leaving a question commits it, when the exam allows answers to be revised.
   * Where it does not, committing is final, so it waits for the button.
   */
  const leave = (questionId: string) => {
    if (!open || !exam.allowRevision || saveAnswer.isPending) return;
    const value = drafts[questionId];
    if (value === undefined || value.trim() === "" || value === (answered.get(questionId) ?? "")) return;
    saveAnswer.mutate({ questionId, answer: value });
  };

  return (
    <main className="page">
      <header className="exam">
        <h1>{exam.title}</h1>
        <p className="sub">
          {open ? (
            <>
              {answered.size} of {exam.questions.length} answered
              <TimeLeft expiresAt={state.data.expiresAt} />
            </>
          ) : (
            `Attempt ${attemptState.replace(/_/g, " ")}`
          )}
        </p>
      </header>

      {open && !online ? (
        <p className="card offline" role="status">
          You are offline. Keep going — what you type is kept on this device and sent when the connection
          returns.
        </p>
      ) : null}

      {attemptState === "void" ? (
        /*
         * SPEC §6.2: being set aside without being told why is the situation
         * this design objects to. The reason a person recorded is shown as they
         * wrote it, not summarized and not softened.
         */
        <section className="card" aria-label="This attempt was set aside">
          <h2 style={{ fontSize: "1rem", margin: "0 0 .4rem" }}>This attempt was set aside</h2>
          <p style={{ margin: 0 }}>{voidReason}</p>
          <p className="notice" style={{ marginTop: ".75rem" }}>
            Your record below is unchanged and still checks out. If you disagree with
            this, it is what you take to your institution.
          </p>
        </section>
      ) : null}

      {probe !== null && open ? (
        <ProbePanel
          prompt={probe.prompt}
          streaming={probe.streaming}
          onReply={async (reply) => {
            await client.replyToProbe(probe.id, reply);
            setProbe(null);
            await queryClient.invalidateQueries({ queryKey: ["state"] });
          }}
        />
      ) : null}

      {exam.questions.map((question, index) => {
        const committed = answered.get(question.id) ?? "";
        const value = drafts[question.id] ?? committed;
        const dirty = value !== committed;
        const draftStatus = status[question.id];
        return (
          <section
            className="card"
            key={question.id}
            onBlur={(e) => {
              // Only when focus leaves the question, not when it moves within it.
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) leave(question.id);
            }}
          >
            <div className="q-head">
              <h2>
                {index + 1}. {question.stem}
              </h2>
              <span className="marks">{question.maxScore} marks</span>
            </div>

            <AnswerInput
              question={question}
              value={value}
              disabled={!open}
              onChange={(next) => edit(question.id, next)}
              onRun={(language, source, input) => client.runCode(question.id, language, source, input)}
            />

            {open ? (
              <div className="row">
                <button
                  type="button"
                  className="secondary"
                  disabled={!dirty || value.trim() === "" || saveAnswer.isPending}
                  onClick={() => saveAnswer.mutate({ questionId: question.id, answer: value })}
                >
                  {exam.allowRevision ? "Save answer" : "Save final answer"}
                </button>
                <span className="saved" aria-live="polite">
                  {!dirty
                    ? savedAt[question.id] !== undefined || committed !== ""
                      ? "Saved"
                      : ""
                    : draftStatus === "offline"
                      ? "Kept on this device — will send when you're back online"
                      : draftStatus === "synced"
                        ? "Draft saved"
                        : draftStatus === "saving"
                          ? "Saving…"
                          : ""}
                </span>
              </div>
            ) : null}
          </section>
        );
      })}

      {open ? (
        <div className="row">
          <button
            type="button"
            onClick={() => submit.mutate()}
            disabled={submit.isPending || (answered.size === 0 && Object.keys(drafts).length === 0)}
          >
            {submit.isPending ? "Submitting…" : "Submit attempt"}
          </button>
          <span className="notice">You cannot change your answers after this.</span>
        </div>
      ) : ledger.data !== undefined ? (
        <Receipt ledger={ledger.data} />
      ) : null}
    </main>
  );
}

/**
 * Time left in the exam.
 *
 * This is the exam's own window, which a candidate is entitled to see. It is
 * not a timer on the micro-viva — SPEC §8 rules that out, and the probe panel
 * shows none.
 */
function TimeLeft({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, expiresAt - now);
  if (remaining === 0) return <> · time is up</>;

  const minutes = Math.floor(remaining / 60_000);
  const hours = Math.floor(minutes / 60);
  return (
    <> · {hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`} left</>
  );
}
