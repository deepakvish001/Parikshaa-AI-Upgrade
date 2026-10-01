import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type TouchEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CandidateQuestion } from "@parikshaa/core/browser";
import { ApiError, ParikshaaClient, type Announcement, type CandidatePart, type CandidateState } from "./api.ts";
import { inline } from "@parikshaa/brand/markdown";
import { AnswerInput } from "./components/AnswerInput.tsx";
import { splitStem } from "./components/code-meta.ts";
import { ProbePanel } from "./components/ProbePanel.tsx";
import { Receipt } from "./components/Receipt.tsx";
import { ScorecardCheck } from "./components/ScorecardCheck.tsx";

/** Pages opened from a link with no account; loaded only when one is. */
const ShortlistPage = lazy(() => import("./components/PublicPages.tsx").then((m) => ({ default: m.ShortlistPage })));
const InterviewPage = lazy(() => import("./components/PublicPages.tsx").then((m) => ({ default: m.InterviewPage })));
const OfferPage = lazy(() => import("./components/PublicPages.tsx").then((m) => ({ default: m.OfferPage })));
const StatusPage = lazy(() => import("./components/PublicPages.tsx").then((m) => ({ default: m.StatusPage })));
const ApplyPage = lazy(() => import("./components/PublicPages.tsx").then((m) => ({ default: m.ApplyPage })));
import { InviteGate } from "./components/InviteGate.tsx";
import { TokenGate } from "./components/TokenGate.tsx";
import { IdentityCapture } from "./components/IdentityCapture.tsx";
import { useProctoring } from "./proctoring.ts";
import { clearLocalDrafts, loadLocalDrafts, purgeExpiredDrafts, saveLocalDraft } from "./drafts.ts";
import { LANGUAGE_NAMES, PreferencesProvider, usePreferences, type Language } from "./i18n.tsx";
import { TopBar } from "./components/Chrome.tsx";
import { ChevronLeft, ChevronRight, CircleCheck, Ellipsis, Eraser, Flag, Hand, Lock, Send, X } from "lucide-react";
import { briefingOfState, Instructions } from "./components/Instructions.tsx";
import { Finished, submittedAt } from "./components/Finished.tsx";
import { QuestionPaper, QuestionRail } from "./components/QuestionPaper.tsx";
import {
  Calculator,
  clearRoughWork,
  DisplayMenu,
  DisplayPanel,
  InstructionsPanel,
  PaperPanel,
  RoughWork,
  ShortcutsPanel,
  TimeWarnings,
  ToolStrip,
  useReadingPreferences,
  type SaveState,
  type Tool,
} from "./components/Tools.tsx";
import { loadReview, loadVisited, saveReview, saveVisited } from "./review.ts";
import { Countdown, ExamBar, kindLabel, SubmitDialog, Tally, TimeUpScreen, type PaperCounts } from "./components/Cbt.tsx";
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
  const query = props.client === undefined ? new URLSearchParams(window.location.search) : null;
  const scorecard = query?.get("scorecard") ?? null;
  const shortlist = query?.get("shortlist") ?? null;
  const apply = query?.get("apply") ?? null;
  const interview = query?.get("interview") ?? null;
  const offer = query?.get("offer") ?? null;
  const status = query?.get("status") ?? null;
  return (
    <PreferencesProvider>
      {scorecard !== null ? (
        <ScorecardCheck code={scorecard} />
      ) : shortlist !== null ? (
        <Suspense fallback={null}>
          <ShortlistPage code={shortlist} />
        </Suspense>
      ) : apply !== null ? (
        <Suspense fallback={null}>
          <ApplyPage code={apply} />
        </Suspense>
      ) : interview !== null ? (
        <Suspense fallback={null}>
          <InterviewPage code={interview} />
        </Suspense>
      ) : offer !== null ? (
        <Suspense fallback={null}>
          <OfferPage code={offer} />
        </Suspense>
      ) : status !== null ? (
        <Suspense fallback={null}>
          <StatusPage code={status} />
        </Suspense>
      ) : (
        <Screens {...props} />
      )}
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
  // A code typed in by hand that opened nothing: back to the box, saying so.
  const [refused, setRefused] = useState(false);
  const refuse = useCallback(() => {
    rememberToken(null);
    setToken(null);
    setRefused(true);
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
        failed={refused}
        onToken={(next) => {
          setRefused(false);
          if (isInviteCode(next)) {
            session.set(INVITE_KEY, next);
            setInvite(next);
          } else opened(next);
        }}
      />
    );
  }
  // A token that ran out, with the invitation still in hand: open it again.
  // Without one, the candidate is asked for a code once more.
  const onExpired = invite !== null ? expired : injected === undefined ? refuse : undefined;
  return <Attempt client={client} {...(onExpired === undefined ? {} : { onExpired })} />;
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
  // The candidate's reading size and theme, for as long as the attempt is open on this page.
  const reading = useReadingPreferences();
  // What a screen reader is told about the follow-up: that one is here, and that the reply went.
  const [probeNote, setProbeNote] = useState("");
  const [probeSent, setProbeSent] = useState(false);
  // The palette as a sheet on a phone, opened from the strip under the bar.
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Clear response, under "⋯" in a phone's footer.
  const [moreOpen, setMoreOpen] = useState(false);
  // "Swipe to move", said once on a touch screen, the first time a paper opens there.
  const [swipeHint, setSwipeHint] = useState(false);
  useEffect(() => {
    if (typeof matchMedia !== "function" || !matchMedia("(pointer: coarse)").matches) return;
    try {
      if (localStorage.getItem("parikshaa.swipeHint") !== null) return;
      localStorage.setItem("parikshaa.swipeHint", "1");
    } catch {
      return;
    }
    setSwipeHint(true);
    const hide = () => setSwipeHint(false);
    const id = setTimeout(hide, 6000);
    // Gone at the first touch too: it has been read, or it is in the way.
    window.addEventListener("pointerdown", hide, { once: true });
    return () => {
      clearTimeout(id);
      window.removeEventListener("pointerdown", hide);
    };
  }, []);
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

  /*
   * Back online: once everything that waited has gone, the save status says
   * how many answers were sent, for a few seconds. Nothing modal, ever.
   */
  const reconnecting = useRef<number | null>(null);
  const waitingOffline = useRef(0);
  const [sentBack, setSentBack] = useState<number | null>(null);
  // Counted while offline: the moment the connection returns, sending starts and "offline" becomes "saving".
  useEffect(() => {
    if (!online) waitingOffline.current = Object.values(status).filter((s) => s === "offline").length;
  }, [online, status]);
  useEffect(() => {
    if (!online || waitingOffline.current === 0) return;
    reconnecting.current = waitingOffline.current;
    waitingOffline.current = 0;
  }, [online]);
  useEffect(() => {
    if (reconnecting.current === null || Object.values(status).some((s) => s === "offline" || s === "saving")) return;
    setSentBack(reconnecting.current);
    reconnecting.current = null;
  }, [status]);
  useEffect(() => {
    if (sentBack === null) return;
    const id = setTimeout(() => setSentBack(null), 5000);
    return () => clearTimeout(id);
  }, [sentBack]);

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

  // Said once, when the follow-up is written out, rather than word by word as it streams.
  useEffect(() => {
    if (probe !== null && !probe.streaming && probe.prompt !== "") setProbeNote(`${t("probe.eyebrow")}: ${probe.prompt}`);
  }, [probe, t]);
  // "Reply sent" folds away after a few seconds.
  useEffect(() => {
    if (!probeSent) return;
    const id = setTimeout(() => setProbeSent(false), 6000);
    return () => clearTimeout(id);
  }, [probeSent]);

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
      if (attemptId !== null) {
        clearLocalDrafts(attemptId);
        clearRoughWork(attemptId);
      }
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

  /*
   * Reopened — after a reload, or on another device — the page goes back to
   * where the candidate was: the question with unsent work, or the one after
   * the last saved. Said once, then out of the way.
   */
  const resumed = useRef(false);
  const [welcome, setWelcome] = useState<number | null>(null);
  useEffect(() => {
    if (resumed.current || paperNow === null || state.data?.state !== "in_progress") return;
    resumed.current = true;
    const shownNow = paperNow.shown;
    const saved = new Set(state.data.answers.map((a) => a.questionId));
    const drafted = new Set((state.data.drafts ?? []).map((d) => d.questionId));
    if (saved.size === 0 && drafted.size === 0) return;
    const lastSaved = shownNow.reduce((at, q, i) => (saved.has(q.id) ? i : at), -1);
    const target = shownNow.find((q) => drafted.has(q.id) && !saved.has(q.id)) ?? shownNow[Math.min(lastSaved + 1, shownNow.length - 1)];
    if (target === undefined) return;
    setCurrent(target.id);
    setWelcome(state.data.exam.questions.indexOf(target) + 1);
  }, [paperNow, state.data]);
  useEffect(() => {
    if (welcome === null) return;
    const id = setTimeout(() => setWelcome(null), 8000);
    return () => clearTimeout(id);
  }, [welcome]);
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

  // The tools beside the paper, oldest first: several may be open, stacked, the newest on top.
  const [windows, setWindows] = useState<readonly Tool[]>([]);
  const toggleWindow = (tool: Tool) => setWindows((open) => (open.includes(tool) ? open.filter((w) => w !== tool) : [...open, tool]));
  /** Close a tool's window, and put focus back on the button that opened it (or Tools, on a phone). */
  const closeWindow = useCallback((tool: Tool) => {
    setWindows((open) => open.filter((w) => w !== tool));
    requestAnimationFrame(() => {
      const shown = (el: HTMLElement | null) => el !== null && (typeof el.checkVisibility === "function" ? el.checkVisibility() : el.offsetParent !== null);
      const button = document.querySelector<HTMLElement>(`.toolstrip-end [data-tool="${tool}"]`);
      const tools = document.querySelector<HTMLElement>(".tools-open");
      // The tool's own button where it is on screen; on a phone, Tools; failing both, the tool's.
      (shown(button) ? button : shown(tools) ? tools : button)?.focus();
    });
  }, []);
  // Where a touch on the question began, for a swipe to the next or previous one.
  const touch = useRef<{ x: number; y: number } | null>(null);

  /**
   * Keyboard shortcuts, as `?` lists them: A–D choose, S saves and moves on,
   * N and P move, M marks. Never while typing — a letter in an answer box is
   * that letter — and never with a modifier held.
   */
  const keys = useRef<{ choose: (n: number) => void; save: () => void; next: () => void; prev: () => void; mark: () => void } | null>(null);
  const latestWindows = useRef(windows);
  latestWindows.current = windows;
  useEffect(() => {
    if (!inProgress) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target !== null && (target.closest("input:not([type=radio]):not([type=checkbox]), textarea, select, [contenteditable=true], .cm-editor, .tool-window, [role=dialog]") !== null)) return;
      const key = e.key.toLowerCase();
      if (key === "?") setWindows((open) => (open.includes("shortcuts") ? open.filter((w) => w !== "shortcuts") : [...open, "shortcuts"]));
      else if (key === "escape") {
        // The newest window first, one at a time.
        const top = latestWindows.current[latestWindows.current.length - 1];
        if (top === undefined) return;
        closeWindow(top);
      }
      else if (keys.current === null) return;
      else if ("abcd".includes(key) && key.length === 1) keys.current.choose("abcd".indexOf(key));
      else if (key === "s") keys.current.save();
      else if (key === "n") keys.current.next();
      else if (key === "p") keys.current.prev();
      else if (key === "m") keys.current.mark();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inProgress, closeWindow]);

  /**
   * Time up: the page says so plainly, hands over what is waiting to be saved,
   * and submits — which, after the end, closes the attempt with only what was
   * saved in time. The screen stays until that is done and a few seconds
   * after, then the record opens in its place.
   */
  const [timeUpAt, setTimeUpAt] = useState<number | null>(null);
  const [timeUpReady, setTimeUpReady] = useState(false);
  useEffect(() => {
    if (!inProgress || expiresAt === 0) return;
    const id = setTimeout(
      () => {
        setTimeUpAt(expiresAt);
        setTimeUpReady(false);
        void (async () => {
          await flushPending().catch(() => undefined);
          // Submitting after the end closes the attempt with what was saved in time, and no more.
          try {
            await client.submit();
          } catch {
            // Closed already, or not reachable: the state read next says which.
          }
          await queryClient.invalidateQueries({ queryKey: ["state"] });
          setTimeUpReady(true);
        })();
      },
      Math.max(0, expiresAt - Date.now()),
    );
    return () => clearTimeout(id);
    // flushPending reads refs only; the timer is re-armed when the end moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProgress, expiresAt, queryClient]);

  const expired = state.error instanceof ApiError && state.error.status === 401;
  useEffect(() => {
    if (expired) onExpired?.();
  }, [expired, onExpired]);

  if (timeUpAt !== null) {
    return (
      <TimeUpScreen
        at={timeUpAt}
        ready={timeUpReady && state.data?.state !== "in_progress"}
        onContinue={() => setTimeUpAt(null)}
      />
    );
  }

  if (state.isPending) {
    return (
      <main className="page">
        <p className="notice">{t("exam.loading")}</p>
      </main>
    );
  }
  if (state.error !== null) {
    const outside = state.error instanceof ApiError && state.error.code === "outside_network";
    return (
      <main className="page">
        <p className="error">{outside ? `${t("invite.outside")} ${t("invite.outsideNote")}` : t("exam.loadFailed")}</p>
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
          {attemptState === "submitted" || attemptState === "graded" ? (
            <>
              <h1 className="visually-hidden">{exam.title}</h1>
              <Finished
                title={exam.title}
                graded={attemptState === "graded"}
                at={submittedAt(ledger.data)}
                total={exam.questions.length}
                answered={exam.questions.filter((q) => (answered.get(q.id) ?? "") !== "").length}
                marked={exam.questions.filter((q) => review.has(q.id)).length}
                feedback={client}
                result={client}
              />
            </>
          ) : (
            <header className="exam">
              <h1>{exam.title}</h1>
              <p className="sub">{t(`exam.state.${attemptState}`)}</p>
            </header>
          )}
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
          {ledger.data !== undefined ? (
            <Receipt
              ledger={ledger.data}
              myData={() => client.myData()}
              numberOf={(id) => {
                const at = exam.questions.findIndex((q) => q.id === id);
                return at < 0 ? null : at + 1;
              }}
            />
          ) : null}
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
    setMoreOpen(false);
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
  // Where every part stands, for the summary before submitting: from what was saved, marked and opened.
  const countsOf = (ids: readonly string[]): PaperCounts => {
    const qs = ids.map((id) => ({ answered: (answered.get(id) ?? "") !== "", marked: review.has(id), visited: visited.has(id) || id === currentId }));
    return {
      answered: qs.filter((q) => q.answered && !q.marked).length,
      answeredMarked: qs.filter((q) => q.answered && q.marked).length,
      marked: qs.filter((q) => !q.answered && q.marked).length,
      notAnswered: qs.filter((q) => !q.answered && !q.marked && q.visited).length,
      notVisited: qs.filter((q) => !q.answered && !q.marked && !q.visited).length,
    };
  };
  const groups = (parts ?? []).map((p) => ({ title: p.title, counts: countsOf(p.questionIds) }));
  // A coding question fills a wide screen, as a coding round's does; a laptop or phone keeps it in the card.
  const wide = typeof window !== "undefined" && window.innerWidth >= 1280;
  const canSubmit = !submit.isPending && (answered.size > 0 || Object.keys(drafts).length > 0);

  keys.current =
    original_ === null || partTimeUp
      ? null
      : {
          choose: (n) => {
            const inputs = document.getElementById(`q-${original_.id}`)?.querySelectorAll<HTMLInputElement>("input[type=radio], input[type=checkbox]") ?? [];
            inputs[n]?.click();
            inputs[n]?.focus();
          },
          save: () => original_.kind !== "code" && advanceFrom(original_.id),
          next: () => next !== null && goTo(next.id),
          prev: () => previous !== null && goTo(previous.id),
          mark: () => toggleReview(original_.id),
        };

  /**
   * On a touch screen, a sideways swipe across the question moves to the next
   * or the previous one, as paging a booklet does. Not from inside something
   * that scrolls or takes typing of its own: an answer box, the code
   * workspace, a table, a picture or a passage.
   */
  const swipe = {
    onTouchStart: (e: TouchEvent) => {
      const first = e.touches[0];
      const inside = (e.target as HTMLElement).closest("textarea, input, select, .workspace, table, .figure, .passage, .probe");
      touch.current = first !== undefined && e.touches.length === 1 && inside === null ? { x: first.clientX, y: first.clientY } : null;
    },
    onTouchEnd: (e: TouchEvent) => {
      const start = touch.current;
      touch.current = null;
      const end = e.changedTouches[0];
      if (start === null || end === undefined) return;
      const dx = end.clientX - start.x;
      const dy = end.clientY - start.y;
      if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
      if (dx < 0 && next !== null) goTo(next.id);
      else if (dx > 0 && previous !== null) goTo(previous.id);
    },
  };

  // One word for the whole paper: anything unsent on this device, anything on its way, or all of it safe.
  const statuses = Object.values(status);
  const paperSave: SaveState = statuses.includes("offline") || !online
    ? "offline"
    : saveAnswer.isPending || statuses.includes("saving")
      ? "saving"
      : sentBack !== null
        ? "back"
        : answered.size > 0 || statuses.length > 0
          ? "saved"
          : "idle";

  // A section with its own time shows that time in the pill, in place of the test's.
  const sectionClock = currentPart !== null && currentPart.endsAt != null && !partTimeUp ? { title: currentPart.title, endsAt: currentPart.endsAt, durationMs: currentPart.durationMs } : null;

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
      // One name for it, whichever of its labels the width shows.
      aria-label={submit.isPending ? undefined : t("exam.submit")}
    >
      <Send aria-hidden="true" />
      {submit.isPending ? (
        t("exam.submitting")
      ) : (
        <>
          <span className="label-long">{t("exam.submit")}</span>
          <span className="label-short">{t("exam.submitShort")}</span>
        </>
      )}
    </button>
  );

  let question: ReactElement | null = null;
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
            <span className="review-toggle-label">{marked ? t("exam.marked") : t("exam.markReview")}</span>
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
          startFull={wide && !lite}
          rail={<QuestionRail items={items} current={currentId} onGo={goTo} />}
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
          <button type="button" className="secondary foot-prev" onClick={() => previous !== null && goTo(previous.id)} disabled={previous === null}>
            <ChevronLeft aria-hidden="true" />
            <span className="foot-label">{t("exam.prev")}</span>
          </button>
          {isCode ? null : (
            <button
              type="button"
              className="ghost foot-clear"
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
          {isCode ? null : (
            <div className="foot-more">
              <button type="button" className="secondary" aria-label={t("exam.more")} title={t("exam.more")} aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>
                <Ellipsis aria-hidden="true" />
              </button>
              {moreOpen ? (
                <div className="foot-menu" role="menu" aria-label={t("exam.more")}>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={value === "" || (committed !== "" && !exam.allowRevision)}
                    onClick={() => {
                      setMoreOpen(false);
                      edit(q.id, "");
                      if (committed !== "" && exam.allowRevision) saveAnswer.mutate({ questionId: q.id, answer: "" });
                    }}
                  >
                    <Eraser aria-hidden="true" />
                    {t("exam.clear")}
                  </button>
                </div>
              ) : null}
            </div>
          )}
          <span className="saved" aria-live="polite">
            {saveState}
          </span>
          <span className="spacer" />
          {next === null ? null : (
            <button
              type="button"
              className="review-next"
              aria-label={t("exam.markNext")}
              onClick={() => {
                if (!review.has(q.id)) toggleReview(q.id);
                advanceFrom(q.id);
              }}
            >
              <Flag aria-hidden="true" />
              <span className="label-long">{t("exam.markNext")}</span>
              <span className="label-short">{t("exam.markShort")}</span>
            </button>
          )}
          {isCode ? (
            next === null ? null : (
              <button type="button" className="foot-next" onClick={() => goTo(next.id)}>
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
        display={<DisplayMenu offered={offered} reading={reading} />}
        clock={<Countdown expiresAt={state.data.expiresAt} section={sectionClock} />}
        status={
          cameraOn === true ? (
            <span className="camera-pill" role="status">
              {t("camera.on")}
            </span>
          ) : null
        }
        action={action}
      />
      <ToolStrip
        save={paperSave}
        sent={sentBack ?? 0}
        open={windows}
        onToggle={toggleWindow}
        calculator={exam.calculator ?? false}
        questions={shown.length > 0 ? { done: items.filter((i) => i.answered).length, total: items.length, onOpen: () => setPaletteOpen(true) } : undefined}
        display={<DisplayPanel offered={offered} reading={reading} />}
      />
      <TimeWarnings expiresAt={state.data.expiresAt} />
      {swipeHint ? (
        <p className="swipe-hint" role="status">
          <Hand aria-hidden="true" />
          {t("exam.swipeHint")}
        </p>
      ) : null}
      {windows.length > 0 ? (
        <div className="tool-windows">
          {windows.map((tool) =>
            tool === "calculator" ? (
              <Calculator key={tool} onClose={() => closeWindow(tool)} />
            ) : tool === "rough" ? (
              <RoughWork key={tool} attemptId={state.data.attemptId} onClose={() => closeWindow(tool)} />
            ) : tool === "shortcuts" ? (
              <ShortcutsPanel key={tool} onClose={() => closeWindow(tool)} />
            ) : tool === "paper" ? (
              <PaperPanel key={tool} onClose={() => closeWindow(tool)}>
                <QuestionPaper
                  current={currentId}
                  onGo={(id) => {
                    closeWindow("paper");
                    goTo(id);
                  }}
                  entries={shown.map((q, i) => {
                    const translation = language === "en" || original.has(q.id) ? undefined : q.translations?.[language];
                    const stem = translation?.stem ?? q.stem;
                    return {
                      ...items[i]!,
                      stem: q.kind === "code" ? splitStem(stem).title || t("code.problem") : stem,
                      lang: translation === undefined ? "en" : language,
                      maxScore: q.maxScore,
                      kind: kindLabel(q, t),
                    };
                  })}
                />
              </PaperPanel>
            ) : (
              <InstructionsPanel key={tool} onClose={() => closeWindow(tool)}>
                <Instructions brief={briefingOfState(state.data)} />
              </InstructionsPanel>
            ),
          )}
        </div>
      ) : null}
      <div className="cbt-body">
        <main className="cbt-main" {...swipe}>
          {cameraOn === false ? (
            <p className="offline" role="alert">
              {t("camera.offBanner")}
            </p>
          ) : null}
          {welcome !== null ? (
            <p className="welcome-back" role="status">
              <Hand aria-hidden="true" />
              <span>{t("exam.welcomeBack", { n: welcome })}</span>
              <button type="button" className="tool icon" aria-label={t("tools.close")} title={t("tools.close")} onClick={() => setWelcome(null)}>
                <X aria-hidden="true" />
              </button>
            </p>
          ) : null}
          <Announcements
            items={(announcements.data ?? []).filter((a) => !dismissed.has(a.id))}
            onDismiss={(id) => setDismissed(new Set([...dismissed, id]))}
          />
          <p className="visually-hidden" role="status">
            {probeNote}
          </p>
          {probe !== null ? (
            <ProbePanel
              prompt={probe.prompt}
              streaming={probe.streaming}
              onReply={async (reply) => {
                await client.replyToProbe(probe.id, reply);
                setProbe(null);
                setProbeSent(true);
                setProbeNote(t("probe.sent"));
                await queryClient.invalidateQueries({ queryKey: ["state"] });
              }}
            />
          ) : probeSent ? (
            <p className="probe-sent">
              <CircleCheck aria-hidden="true" />
              {t("probe.sent")}
            </p>
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

        {shown.length > 0 || parts !== null ? (
          <aside className="cbt-side">
            {shown.length > 0 ? (
              <Palette
                questions={items}
                current={currentId}
                onGo={goTo}
                open={paletteOpen}
                onOpenChange={setPaletteOpen}
                header={parts !== null ? <SectionTabs parts={parts} /> : undefined}
              />
            ) : parts !== null ? (
              <SectionTabs parts={parts} />
            ) : null}
          </aside>
        ) : null}
      </div>

      {leaving && currentPart !== null ? (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setLeaving(false)}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="leave-section" aria-describedby="leave-section-note">
            <h2 id="leave-section">{t("section.leaveTitle", { title: currentPart.title })}</h2>
            <Tally counts={counts} />
            <p className="dialog-warn" id="leave-section-note">
              <Lock aria-hidden="true" />
              {t("section.confirm", { title: currentPart.title })}
            </p>
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
          groups={groups}
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

/**
 * Where a sectioned test stands, above the palette: every part, done and
 * locked, now, or to come, each with its number of questions. The parts left
 * behind stay in sight, so the candidate sees the whole paper. The current
 * part's own time is in the pill in the bar.
 */
function SectionTabs({ parts }: { parts: readonly CandidatePart[] }) {
  const { t } = usePreferences();
  return (
    <nav className="section-tabs" aria-label={t("section.region")}>
      <ol>
        {parts.map((p) => (
          <li key={p.sectionId ?? "fixed"} className={`section-tab ${p.state}`} aria-current={p.state === "current" ? "step" : undefined}>
            {p.state === "done" ? <Lock aria-hidden="true" /> : null}
            <span className="section-tab-title">{p.title}</span>
            <span className="section-tab-count" aria-hidden="true">
              {p.questionIds.length}
            </span>
            <span className="visually-hidden">
              {" "}
              ({t("section.questions", { n: p.questionIds.length })}, {t(`section.${p.state}`)})
            </span>
          </li>
        ))}
      </ol>
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
