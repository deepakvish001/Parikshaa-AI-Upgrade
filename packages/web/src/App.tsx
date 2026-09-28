import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CandidateQuestion } from "@parikshaa/core/browser";
import { ApiError, ParikshaaClient, type Announcement, type CandidatePart, type CandidateState } from "./api.ts";
import { inline } from "@parikshaa/brand/markdown";
import { AnswerInput } from "./components/AnswerInput.tsx";
import { splitStem } from "./components/code-meta.ts";
import { ProbePanel } from "./components/ProbePanel.tsx";
import { Receipt } from "./components/Receipt.tsx";
import { InviteGate } from "./components/InviteGate.tsx";
import { TokenGate } from "./components/TokenGate.tsx";
import { IdentityCapture } from "./components/IdentityCapture.tsx";
import { useProctoring } from "./proctoring.ts";
import { clearLocalDrafts, loadLocalDrafts, purgeExpiredDrafts, saveLocalDraft } from "./drafts.ts";
import { LANGUAGE_NAMES, PreferencesProvider, usePreferences, type Language } from "./i18n.tsx";
import { TopBar } from "./components/Chrome.tsx";
import { ChevronLeft, ChevronRight, Eraser, Flag, Send } from "lucide-react";
import { loadReview, loadVisited, saveReview, saveVisited } from "./review.ts";
import { Countdown, ExamBar, kindLabel, SubmitDialog } from "./components/Cbt.tsx";
import { Figures, Palette, PassageCard } from "./components/Paper.tsx";

interface OpenProbe {
  readonly id: string;
  prompt: string;
  streaming: boolean;
}

/** How long typing must pause before the text is sent. */
export const AUTOSAVE_DELAY_MS = 1200;
/** How often an open page checks in while visible. */
export const HEARTBEAT_MS = 30_000;
/**
 * The same in low-bandwidth mode (ROADMAP §9): fewer, larger saves and fewer
 * check-ins. Nothing typed is at more risk — it is kept on the device as it
 * is typed either way.
 */
export const LITE_AUTOSAVE_DELAY_MS = 5_000;
export const LITE_HEARTBEAT_MS = 60_000;
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

export function App(props: { client?: ParikshaaClient } = {}) {
  return (
    <PreferencesProvider>
      <Screens {...props} />
    </PreferencesProvider>
  );
}

function Screens({ client: injected }: { client?: ParikshaaClient }) {
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
  const { t, language, lite } = usePreferences();
  const heartbeatMs = lite ? LITE_HEARTBEAT_MS : HEARTBEAT_MS;
  const autosaveMs = lite ? LITE_AUTOSAVE_DELAY_MS : AUTOSAVE_DELAY_MS;
  // Per question: the candidate asked to read the original rather than the translation.
  const [original, setOriginal] = useState<ReadonlySet<string>>(new Set());
  // Questions the candidate means to come back to: their own note, kept on this device.
  const [review, setReview] = useState<ReadonlySet<string>>(new Set());

  const state = useQuery({ queryKey: ["state"], queryFn: () => client.state() });
  const ledger = useQuery({
    queryKey: ["ledger"],
    queryFn: () => client.ledger(),
    enabled: state.data !== undefined && state.data.state !== "in_progress",
  });

  const attemptId = state.data?.attemptId ?? null;
  // Which questions the candidate has opened: the palette tells "not visited" from "not answered".
  const [visited, setVisited] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (attemptId === null) return;
    setReview(loadReview(attemptId));
    setVisited(loadVisited(attemptId));
  }, [attemptId]);
  const toggleReview = (questionId: string) => {
    const next = new Set(review);
    if (next.has(questionId)) next.delete(questionId);
    else next.add(questionId);
    setReview(next);
    if (attemptId !== null) saveReview(attemptId, next);
  };
  const expiresAt = state.data?.expiresAt ?? 0;
  const inProgress = state.data?.state === "in_progress";
  // Proctored (ROADMAP §14): photos and browser events once the identity step, if any, is done.
  const policy = state.data?.exam.proctoring ?? null;
  const identityDue = inProgress && policy?.identity === true && state.data?.identityCaptured === false;
  const { cameraOn } = useProctoring(client, policy, inProgress && !identityDue, lite);

  const announcements = useQuery({ queryKey: ["announcements"], queryFn: () => client.announcements(), enabled: inProgress });
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const announcementCount = useRef(0);
  announcementCount.current = announcements.data?.length ?? 0;

  // A submitted attempt can be reopened by an invigilator (a crash, a power
  // cut); look now and then, so the page opens again without a reload.
  useEffect(() => {
    if (state.data?.state !== "submitted") return;
    const id = setInterval(() => void queryClient.invalidateQueries({ queryKey: ["state"] }), heartbeatMs);
    return () => clearInterval(id);
  }, [state.data?.state, queryClient, heartbeatMs]);

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
      }, autosaveMs),
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
        if (now.announcements !== announcementCount.current) {
          await queryClient.invalidateQueries({ queryKey: ["announcements"] });
        }
      } catch {
        // Offline; the banner says so, and the next beat will try again.
      }
    };
    void beat();
    const id = setInterval(() => void beat(), heartbeatMs);
    return () => clearInterval(id);
  }, [client, queryClient, inProgress, heartbeatMs]);

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
      // Low bandwidth: one short request for the whole probe, no stream to hold open.
      if (lite) {
        const raised = await client.probeOnce();
        setProbe(raised === null ? null : { id: raised.id, prompt: raised.prompt, streaming: false });
        return;
      }
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
  }, [client, queryClient, lite]);

  // Reopen a probe the candidate left unanswered, e.g. after a reload.
  useEffect(() => {
    const open = state.data?.openProbe;
    if (open != null && probe === null) {
      setProbe({ id: open.id, prompt: open.prompt, streaming: false });
    }
  }, [state.data?.openProbe, probe]);

  /** Once an answer is committed: it is saved here too, the state is fetched again, and a follow-up may be due. */
  const afterCommit = async (questionId: string, answer: string) => {
    setSavedAt((prior) => ({ ...prior, [questionId]: Date.now() }));
    if (attemptId !== null) saveLocalDraft(attemptId, expiresAt, questionId, { answer, synced: true });
    setStatus((prior) => ({ ...prior, [questionId]: "synced" }));
    await queryClient.invalidateQueries({ queryKey: ["state"] });
    if (probe === null) {
      setProbe({ id: "", prompt: "", streaming: true });
      void checkForProbe();
    }
  };

  const saveAnswer = useMutation({
    mutationFn: ({ questionId, answer }: { questionId: string; answer: string }) =>
      client.saveAnswer(questionId, answer),
    onSuccess: async (_result, { questionId, answer }) => afterCommit(questionId, answer),
  });

  /** Submit a code answer: committed, then tested against every test, as the exam allows it to report. */
  const submitCode = async (questionId: string, language: string, source: string) => {
    const outcome = await client.submitCode(questionId, language, source);
    await afterCommit(questionId, JSON.stringify({ language, source }));
    return outcome;
  };

  /** Send anything still waiting on the debounce, so the server commits it. */
  const flushPending = async () => {
    for (const [questionId, timer] of timers.current) {
      clearTimeout(timer);
      timers.current.delete(questionId);
      await flush(questionId);
    }
  };

  const submit = useMutation({
    mutationFn: async () => {
      await flushPending();
      await client.submit();
    },
    onSuccess: async () => {
      setProbe(null);
      if (attemptId !== null) clearLocalDrafts(attemptId);
      await queryClient.invalidateQueries();
    },
  });

  // Sections with their own time (ROADMAP §3): leaving one locks it and starts the next one's clock.
  const [leaving, setLeaving] = useState(false);
  const advance = useMutation({
    mutationFn: async () => {
      await flushPending();
      await client.nextSection();
    },
    onSettled: async () => {
      setLeaving(false);
      await queryClient.invalidateQueries({ queryKey: ["state"] });
    },
  });
  const now = useNow(inProgress && (state.data?.parts ?? []).some((p) => p.endsAt !== null));

  // One question at a time, as a computer-based test shows it: the one open now,
  // by id, so that a section changing under it falls back to that section's first.
  const [current, setCurrent] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const focusStem = useRef(false);
  const paperNow = state.data === undefined ? null : paperOf(state.data, now);
  const currentId = paperNow === null ? null : (paperNow.shown.find((q) => q.id === current) ?? paperNow.shown[0])?.id ?? null;
  useEffect(() => {
    if (currentId === null || attemptId === null || !inProgress) return;
    setVisited((prior) => {
      if (prior.has(currentId)) return prior;
      const next = new Set(prior).add(currentId);
      saveVisited(attemptId, next);
      return next;
    });
    // Moving to a question takes focus to its heading, so a screen reader reads it from the top.
    if (focusStem.current) {
      focusStem.current = false;
      document.getElementById(`q-${currentId}-stem`)?.focus({ preventScroll: true });
      document.getElementById(`q-${currentId}`)?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    }
  }, [currentId, attemptId, inProgress]);

  const expired = state.error instanceof ApiError && state.error.status === 401;
  useEffect(() => {
    if (expired) onExpired?.();
  }, [expired, onExpired]);

  if (state.isPending) {
    return (
      <main className="page">
        <p className="notice">{t("exam.loading")}</p>
      </main>
    );
  }
  if (state.error !== null) {
    return (
      <main className="page">
        <p className="error">{t("exam.loadFailed")}</p>
      </main>
    );
  }

  const { exam, answers, state: attemptState, voidReason } = state.data;

  if (identityDue) {
    return (
      <>
        <TopBar title={exam.title} />
        <main className="page">
          <header className="exam">
            <h1>{exam.title}</h1>
          </header>
          <IdentityCapture
            onSubmit={async (selfie, id) => {
              await client.captureIdentity(selfie, id);
              await queryClient.invalidateQueries({ queryKey: ["state"] });
            }}
          />
        </main>
      </>
    );
  }
  const answered = new Map<string, string>(answers.map((a) => [a.questionId, a.answer]));
  const open = attemptState === "in_progress";
  // A sectioned test shows one part at a time. A part whose own time is up is
  // treated as over here at once; the server closes it on the next request.
  const { parts, currentPart, partTimeUp, nextPart, shown } = paperOf(state.data, now);
  // The languages this exam's questions can be read in, besides English.
  const offered = [...new Set(exam.questions.flatMap((q) => Object.keys(q.translations ?? {})))] as Language[];

  if (!open) {
    return (
      <>
        <TopBar title={exam.title} offered={offered} />
        <main className="page">
          <header className="exam">
            <h1>{exam.title}</h1>
            <p className="sub">{t(`exam.state.${attemptState}`)}</p>
          </header>
          {attemptState === "void" ? (
            /*
             * SPEC §6.2: being set aside without being told why is the situation
             * this design objects to. The reason a person recorded is shown as they
             * wrote it, not summarized and not softened.
             */
            <section className="card" aria-label={t("exam.voidTitle")}>
              <h2 style={{ fontSize: "1rem", margin: "0 0 .4rem" }}>{t("exam.voidTitle")}</h2>
              <p style={{ margin: 0 }}>{voidReason}</p>
              <p className="notice" style={{ marginTop: ".75rem" }}>
                {t("exam.voidNote")}
              </p>
            </section>
          ) : null}
          {ledger.data !== undefined ? <Receipt ledger={ledger.data} myData={() => client.myData()} /> : null}
        </main>
      </>
    );
  }

  const at = Math.max(0, shown.findIndex((q) => q.id === currentId));
  const original_ = shown[at] ?? null;
  const previous = shown[at - 1] ?? null;
  const next = shown[at + 1] ?? null;

  /**
   * Leaving a question commits it, when the exam allows answers to be revised.
   * Where it does not, committing is final, so it waits for the button.
   */
  const leave = (questionId: string) => {
    if (!exam.allowRevision || saveAnswer.isPending || partTimeUp) return;
    const value = drafts[questionId];
    if (value === undefined || value.trim() === "" || value === (answered.get(questionId) ?? "")) return;
    saveAnswer.mutate({ questionId, answer: value });
  };
  const goTo = (id: string) => {
    if (original_ !== null && id !== original_.id) leave(original_.id);
    focusStem.current = true;
    setCurrent(id);
  };
  /** Save & next: commits what is typed, whatever the exam's revision rule — the candidate pressed Save. */
  const commit = (questionId: string) => {
    const committed = answered.get(questionId) ?? "";
    const value = drafts[questionId] ?? committed;
    if (value !== committed && value.trim() !== "" && !saveAnswer.isPending) saveAnswer.mutate({ questionId, answer: value });
  };
  const advanceFrom = (questionId: string) => {
    commit(questionId);
    if (next !== null) {
      focusStem.current = true;
      setCurrent(next.id);
    }
  };

  const items = shown.map((q) => {
    const committed = answered.get(q.id) ?? "";
    const typed = drafts[q.id];
    return {
      id: q.id,
      number: exam.questions.indexOf(q) + 1,
      answered: committed !== "",
      draft: typed !== undefined && typed.trim() !== "" && typed !== committed,
      marked: review.has(q.id),
      visited: visited.has(q.id) || q.id === currentId,
    };
  });
  const counts = {
    answered: items.filter((q) => q.answered && !q.marked).length,
    answeredMarked: items.filter((q) => q.answered && q.marked).length,
    marked: items.filter((q) => !q.answered && q.marked).length,
    notAnswered: items.filter((q) => !q.answered && !q.marked && q.visited).length,
    notVisited: items.filter((q) => !q.answered && !q.marked && !q.visited).length,
  };
  const lastPart = parts === null || nextPart === null;
  const canSubmit = !submit.isPending && (answered.size > 0 || Object.keys(drafts).length > 0);

  const action = !lastPart ? (
    currentPart !== null && !partTimeUp ? (
      <button
        type="button"
        className="exambar-action"
        onClick={() => {
          // Leaving the question for the way out commits it, as moving to another question does.
          if (original_ !== null) leave(original_.id);
          setLeaving(true);
        }}
      >
        {t("section.next", { title: currentPart.title })}
      </button>
    ) : null
  ) : (
    <button
      type="button"
      className="exambar-action"
      onClick={() => {
        if (original_ !== null) leave(original_.id);
        setConfirming(true);
      }}
      disabled={!canSubmit}
    >
      <Send aria-hidden="true" />
      {submit.isPending ? t("exam.submitting") : t("exam.submit")}
    </button>
  );

  let question: JSX.Element | null = null;
  if (original_ !== null) {
    const index = exam.questions.indexOf(original_);
    // The question as this candidate reads it: in their language when it
    // has been translated, unless they asked for the original.
    const translation = language === "en" || original.has(original_.id) ? undefined : original_.translations?.[language];
    const q = translation === undefined ? original_ : localised(original_, translation);
    const shownIn: Language = translation === undefined ? "en" : language;
    const committed = answered.get(q.id) ?? "";
    const value = drafts[q.id] ?? committed;
    const dirty = value !== committed;
    const draftStatus = status[q.id];
    const marked = review.has(q.id);
    const isCode = q.kind === "code";
    // A passage is shown beside each question about it, with the run it covers.
    // Read defensively: a server from before pictures and passages sends neither.
    const passage = original_.passage ?? null;
    let from = index + 1;
    let to = index + 1;
    if (passage !== null) {
      let a = at;
      while (a > 0 && shown[a - 1]?.passage?.id === passage.id) a -= 1;
      let b = at;
      while (b < shown.length - 1 && shown[b + 1]?.passage?.id === passage.id) b += 1;
      from = exam.questions.indexOf(shown[a]!) + 1;
      to = exam.questions.indexOf(shown[b]!) + 1;
    }
    const saveLabel = next === null
      ? exam.allowRevision ? t("exam.saveAnswer") : t("exam.saveFinal")
      : exam.allowRevision ? t("exam.saveNext") : t("exam.saveFinalNext");
    const saveState = !dirty
      ? savedAt[q.id] !== undefined || committed !== ""
        ? t("exam.saved")
        : ""
      : draftStatus === "offline"
        ? t("exam.keptOffline")
        : draftStatus === "synced"
          ? t("exam.draftSaved")
          : draftStatus === "saving"
            ? t("exam.saving")
            : "";

    const card = (
      <section
        className={`card question qview${marked ? " marked" : ""}${isCode ? " is-code" : ""}`}
        id={`q-${q.id}`}
        aria-labelledby={`q-${q.id}-stem`}
      >
        <div className="q-meta">
          <span className="q-of">{t("exam.questionOf", { n: index + 1, total: exam.questions.length })}</span>
          <span className="kind-chip">{kindLabel(q, t)}</span>
          <span className="q-badges">
            <span className="marks">{q.maxScore === 1 ? t("exam.mark") : t("exam.marks", { n: q.maxScore })}</span>
            {(q.kind === "mcq" || q.kind === "numeric") && (q.negativeMarks ?? 0) > 0 ? (
              <span className="marks negative">{t("exam.negative", { n: q.negativeMarks })}</span>
            ) : null}
          </span>
          <button type="button" className={`quiet review-toggle${marked ? " on" : ""}`} aria-pressed={marked} onClick={() => toggleReview(q.id)}>
            <Flag aria-hidden="true" />
            {marked ? t("exam.marked") : t("exam.markReview")}
          </button>
        </div>
        <h2 className="q-stem" lang={shownIn} id={`q-${q.id}-stem`} tabIndex={-1}>
          <span className="q-num">{index + 1}.</span>{" "}
          {/* A code question's statement is Markdown: its first paragraph heads it, the rest is below. */}
          {isCode ? <span className="q-title">{inline(splitStem(q.stem).title || t("code.problem"))}</span> : q.stem}
        </h2>
        <Figures images={q.images ?? []} />
        {q.kind === "mcq" && q.multiple ? <p className="notice choose-all">{t("exam.chooseAll")}</p> : null}
        {language !== "en" && original_.translations?.[language] !== undefined ? (
          <button
            type="button"
            className="quiet"
            onClick={() => {
              const toggled = new Set(original);
              if (toggled.has(original_.id)) toggled.delete(original_.id);
              else toggled.add(original_.id);
              setOriginal(toggled);
            }}
          >
            {shownIn === "en" ? t("exam.showTranslated", { language: LANGUAGE_NAMES[language] }) : t("exam.showOriginal")}
          </button>
        ) : null}
        <AnswerInput
          key={q.id}
          question={q}
          value={value}
          disabled={partTimeUp}
          onChange={(text) => edit(q.id, text)}
          onRun={(lang, source, input) => client.runCode(q.id, lang, source, input)}
          onSubmit={(lang, source) => submitCode(q.id, lang, source)}
          submitLabel={exam.allowRevision ? t("code.submit") : t("code.submitFinal")}
          number={index + 1}
          completion={exam.codeCompletion ?? false}
        />
      </section>
    );

    question = (
      <>
        {passage !== null ? (
          <div className="qsplit">
            <PassageCard passage={passage} from={from} to={to} />
            {card}
          </div>
        ) : (
          card
        )}
        <div className="qfoot" role="group" aria-label={t("exam.questionOf", { n: index + 1, total: exam.questions.length })}>
          <button type="button" className="secondary" onClick={() => previous !== null && goTo(previous.id)} disabled={previous === null}>
            <ChevronLeft aria-hidden="true" />
            {t("exam.prev")}
          </button>
          {isCode ? null : (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                edit(q.id, "");
                if (committed !== "" && exam.allowRevision) saveAnswer.mutate({ questionId: q.id, answer: "" });
              }}
              disabled={value === "" || (committed !== "" && !exam.allowRevision)}
            >
              <Eraser aria-hidden="true" />
              {t("exam.clear")}
            </button>
          )}
          <span className="saved" aria-live="polite">
            {saveState}
          </span>
          <span className="spacer" />
          {next === null ? null : (
            <button
              type="button"
              className="review-next"
              onClick={() => {
                if (!review.has(q.id)) toggleReview(q.id);
                advanceFrom(q.id);
              }}
            >
              {t("exam.markNext")}
            </button>
          )}
          {isCode ? (
            next === null ? null : (
              <button type="button" onClick={() => goTo(next.id)}>
                {t("exam.next")}
                <ChevronRight aria-hidden="true" />
              </button>
            )
          ) : (
            <button
              type="button"
              className="save-next"
              onClick={() => advanceFrom(q.id)}
              disabled={saveAnswer.isPending || partTimeUp || (next === null && (!dirty || value.trim() === ""))}
            >
              {saveLabel}
              {next === null ? null : <ChevronRight aria-hidden="true" />}
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="cbt">
      <ExamBar
        title={exam.title}
        offered={offered}
        clock={<Countdown expiresAt={state.data.expiresAt} />}
        status={
          cameraOn === true ? (
            <span className="camera-pill" role="status">
              {t("camera.on")}
            </span>
          ) : null
        }
        action={action}
      />
      {parts !== null ? <SectionSteps parts={parts} now={now} /> : null}
      <div className="cbt-body">
        <main className="cbt-main">
          {cameraOn === false ? (
            <p className="offline" role="alert">
              {t("camera.offBanner")}
            </p>
          ) : null}
          {!online ? (
            <p className="offline" role="status">
              {t("exam.offline")}
            </p>
          ) : null}
          <Announcements
            items={(announcements.data ?? []).filter((a) => !dismissed.has(a.id))}
            onDismiss={(id) => setDismissed(new Set([...dismissed, id]))}
          />
          {probe !== null ? (
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

          {currentPart !== null && partTimeUp ? (
            <p className="card notice-card" role="status">
              {t("section.timeUp", { title: currentPart.title })}
            </p>
          ) : null}

          {parts !== null && (currentPart === null || partTimeUp) && nextPart !== null ? (
            <section className="card section-intro" aria-labelledby="section-intro-title">
              <p className="eyebrow">{t("section.introEyebrow")}</p>
              <h2 id="section-intro-title">{nextPart.title}</h2>
              <ul className="facts">
                <li>{t("section.questions", { n: nextPart.questionIds.length })}</li>
                <li>
                  {nextPart.durationMs === null
                    ? t("section.untimed")
                    : t("section.timed", { minutes: Math.round(nextPart.durationMs / 60_000) })}
                </li>
              </ul>
              <p className="notice">{t("section.lockNote")}</p>
              <button type="button" onClick={() => advance.mutate()} disabled={advance.isPending}>
                {advance.isPending ? t("section.starting") : t("section.start", { title: nextPart.title })}
              </button>
            </section>
          ) : null}

          {question}
        </main>

        {shown.length > 0 ? (
          <aside className="cbt-side">
            <Palette questions={items} current={currentId} onGo={goTo} />
          </aside>
        ) : null}
      </div>

      {leaving && currentPart !== null ? (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setLeaving(false)}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="leave-section">
            <h2 id="leave-section">{t("section.confirm", { title: currentPart.title })}</h2>
            <p className="notice">{t("section.lockNote")}</p>
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={() => setLeaving(false)} autoFocus>
                {t("section.stay")}
              </button>
              <button type="button" onClick={() => advance.mutate()} disabled={advance.isPending}>
                {t("section.confirmYes", { title: currentPart.title })}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirming ? (
        <SubmitDialog
          counts={counts}
          pending={submit.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() => submit.mutate(undefined, { onSettled: () => setConfirming(false) })}
        />
      ) : null}
    </div>
  );
}

/**
 * What of the paper is in front of the candidate now: every question, or the
 * current part's, or none while a section's time is up or the next waits to start.
 */
function paperOf(data: CandidateState, now: number) {
  const parts = data.parts ?? null;
  const currentPart = parts?.find((p) => p.state === "current") ?? null;
  const partTimeUp = currentPart?.endsAt != null && now >= currentPart.endsAt;
  const nextPart = parts?.find((p) => p.state === "upcoming") ?? null;
  const shown =
    parts === null
      ? data.exam.questions
      : currentPart === null || partTimeUp
        ? []
        : data.exam.questions.filter((q) => currentPart.questionIds.includes(q.id));
  return { parts, currentPart, partTimeUp, nextPart, shown };
}

/** The time now, ticking each second while `running`. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  return now;
}

const clockOf = (ms: number): string => {
  const seconds = Math.ceil(ms / 1000);
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, "0")}`;
};

/**
 * Where a sectioned test stands: each part, done, now or to come, and the
 * current part's own time, to the second: a section is short enough for
 * seconds to matter.
 */
function SectionSteps({ parts, now }: { parts: readonly CandidatePart[]; now: number }) {
  const { t } = usePreferences();
  const current = parts.find((p) => p.state === "current");
  const left = current?.endsAt == null ? null : Math.max(0, current.endsAt - now);
  return (
    <nav className="sections card" aria-label={t("section.region")}>
      <ol>
        {parts.map((p) => (
          <li key={p.sectionId ?? "fixed"} className={`step ${p.state}`} aria-current={p.state === "current" ? "step" : undefined}>
            <span className="step-title">{p.title}</span>
            <span className="step-state">{t(`section.${p.state}`)}</span>
          </li>
        ))}
      </ol>
      {left !== null && left > 0 ? (
        <p className={`section-clock${left < 60_000 ? " urgent" : ""}`} role="timer">
          {t("section.timeLeft", { time: clockOf(left) })}
        </p>
      ) : null}
    </nav>
  );
}

/**
 * What the invigilators have told the room, newest first. Announced to screen
 * readers as it arrives, and dismissed one by one; dismissing only hides it here.
 */
function Announcements({ items, onDismiss }: { items: readonly Announcement[]; onDismiss: (id: string) => void }) {
  const { t } = usePreferences();
  return (
    <section aria-label={t("announce.region")} aria-live="assertive">
      {[...items].reverse().map((a) => (
        <div className="card announcement" key={a.id}>
          <p className="eyebrow">
            {t("announce.from")} ·{" "}
            {new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", timeStyle: "short" }).format(new Date(a.at))}
          </p>
          <p style={{ margin: ".2rem 0 .5rem" }}>{a.message}</p>
          <button type="button" className="secondary" onClick={() => onDismiss(a.id)}>
            {t("announce.gotIt")}
          </button>
        </div>
      ))}
    </section>
  );
}

/** A question with a translation's stem and options in place of the original's. */
function localised(question: CandidateQuestion, translation: { readonly stem: string; readonly options?: readonly string[] }): CandidateQuestion {
  if (question.kind === "mcq" && translation.options !== undefined && translation.options.length === question.options.length) {
    return { ...question, stem: translation.stem, options: translation.options };
  }
  return { ...question, stem: translation.stem };
}
