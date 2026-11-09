import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { ErrorState, OfflineBanner, Skeleton, Empty, type SkeletonShape } from "@parikshaa/brand/kit";
import { ApiError } from "../api.ts";
import {
  loadToken,
  PracticeClient,
  saveRef,
  saveToken,
  type CompanyCard,
  type CompanyTarget,
  type ContestSummary,
  type Home,
  type Learner,
  type Note,
  type NoteBook,
  type Lesson,
  type Plan,
  type PotdView,
  type Problem,
  type ProblemList,
  type ProblemSummary,
  type Revision,
  type SignInOptions,
  type Submission,
  type TrackSummary,
  type TrackView,
  type TutorHistory,
} from "../practice/client.ts";
import { ScreenLink, useLearn } from "./context.tsx";
import { screenById } from "./screens.ts";
import { D } from "./text.ts";

/**
 * Learn v2's data (tracker row 140, K2-0): the practice site's own API client
 * and session, shared by every Learn screen. Nothing here is a second client:
 *
 * - the session is the practice site's (`parikshaa.practice.<site>.session`,
 *   practice/client.ts), so a learner signed in there is signed in here, and
 *   the other way round; a session that comes back from Google sign-in in the
 *   address's fragment is kept the same way the practice site keeps it;
 * - requests go through `PracticeClient`, so the types are the ones the
 *   practice pages already hold against the API's schemas (docs/openapi.json);
 * - each endpoint has one react-query hook, keyed as the practice pages key
 *   theirs (`["practice", site, …]`) plus the session, so signing in or out
 *   never shows one learner's data to another;
 * - a request refused for its session (401) forgets the session, as the
 *   practice site does, and the screen shows the signed-out state;
 * - the five states of DESIGN-SYSTEM §9 come from the kit: a skeleton while
 *   loading, an error with "try again", a banner (or a wait) while offline.
 */

export interface LearnData {
  readonly site: string;
  readonly client: PracticeClient;
  /** The session's token, or null when signed out. */
  readonly token: string | null;
  readonly signedIn: boolean;
  /** What the address brought when Learn opened (taken out of the address already). */
  readonly arrived: Arrival;
  /** Keep a new session (from signing in or up), as the practice site keeps it. */
  readonly signIn: (token: string) => void;
  /** End the session on the server, then forget it here; this learner's data leaves the page. */
  readonly signOut: () => Promise<void>;
  /** Forget a session the server no longer knows. */
  readonly forget: () => void;
}

const DataContext = createContext<LearnData | null>(null);

/** What the address brought, once: each is kept or acted on, and taken out of the address (K2-2). */
export interface Arrival {
  /** A session from signing in with Google, in the fragment (which no server logs). */
  readonly session: string | null;
  /** An email confirmation link's token (`?verify=`), to follow once. */
  readonly verify: string | null;
  /** A Google sign-in that failed (`?signin_error=`). */
  readonly signinError: string | null;
  /** Where to go after Google sign-in: kept on this tab before leaving for Google, and checked again here. */
  readonly next: string | null;
}

const nextKey = (site: string) => `parikshaa.learn.next.${site}`;

/**
 * Where a "go back to" may send the learner: only a screen of this site, as
 * `<screen>`, `sheet/<track>`, or `problems/<slug>` / `lessons/<slug>` (the
 * old site's addresses, which Learn opens too). Anything else (another site, a scheme,
 * `//`, `..`, a query) is dropped, so no link can send a learner off the site.
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const match = /^([a-z][a-z0-9-]{0,30})(?:\/([a-z0-9][a-z0-9-]{0,120}))?$/.exec(raw);
  if (match === null) return null;
  const [, screen, slug] = match;
  if (slug !== undefined) return screen === "problems" || screen === "lessons" || screen === "sheet" ? raw : null;
  return screen === "onboarding" || screenById(screen!) !== undefined ? raw : null;
}

/** Before leaving for Google: where to come back to, on this tab only. */
export function keepNext(site: string, next: string | null): void {
  try {
    const safe = safeNext(next);
    if (safe === null) sessionStorage.removeItem(nextKey(site));
    else sessionStorage.setItem(nextKey(site), safe);
  } catch {
    // Without storage the learner lands on Aaj.
  }
}

function takeNext(site: string): string | null {
  try {
    const kept = sessionStorage.getItem(nextKey(site));
    sessionStorage.removeItem(nextKey(site));
    return safeNext(kept);
  } catch {
    return null;
  }
}

/**
 * Read the address once, as the practice site does: a session from Google
 * sign-in (kept as the practice site keeps it), a confirmation link, a failed
 * Google sign-in and an affiliate's coupon (`?ref=`, kept for checkout), all
 * taken out of the address so a reload or a shared link carries none of them.
 */
export function arrival(site: string): Arrival {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const session = hash.get("session") || null;
  const verify = query.get("verify") || null;
  const signinError = query.get("signin_error") || null;
  const ref = query.get("ref");
  if (ref !== null && /^[A-Za-z0-9][A-Za-z0-9-]{2,29}$/.test(ref)) saveRef(site, ref.toUpperCase());
  if (session !== null || hash.has("session") || verify !== null || signinError !== null || ref !== null) {
    for (const name of ["verify", "signin_error", "ref"]) query.delete(name);
    const rest = query.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${rest === "" ? "" : `?${rest}`}`);
  }
  if (session !== null) saveToken(site, session);
  return { session, verify, signinError, next: session === null ? null : takeNext(site) };
}

export function LearnDataProvider({ site, baseUrl = "/api", children }: { readonly site: string; readonly baseUrl?: string; readonly children: ReactNode }) {
  const queryClient = useQueryClient();
  const [arrived] = useState(() => arrival(site));
  const [token, setToken] = useState<string | null>(() => arrived.session ?? loadToken(site));
  const client = useMemo(() => new PracticeClient(site, token, baseUrl), [site, token, baseUrl]);
  const forget = useCallback(() => {
    saveToken(site, null);
    setToken(null);
  }, [site]);
  const signIn = useCallback(
    (next: string) => {
      saveToken(site, next);
      setToken(next);
    },
    [site],
  );
  const signOut = useCallback(async () => {
    await client.signOut().catch(() => undefined);
    forget();
    queryClient.removeQueries({ queryKey: ["practice", site] });
  }, [client, forget, queryClient, site]);
  const value = useMemo<LearnData>(() => ({ site, client, token, signedIn: token !== null, arrived, signIn, signOut, forget }), [site, client, token, arrived, signIn, signOut, forget]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useLearnData(): LearnData {
  const data = useContext(DataContext);
  if (data === null) throw new Error("useLearnData outside LearnDataProvider");
  return data;
}

/** A query's key: the practice pages' own shape, so both apps name the same data the same way. */
export const learnKey = (site: string, ...parts: readonly unknown[]) => ["practice", site, ...parts] as const;

/**
 * One endpoint, read through the practice site's client. `session` (the
 * default) waits for a signed-in learner; an open endpoint reads either way.
 */
export function useLearnQuery<T>(parts: readonly unknown[], read: (client: PracticeClient) => Promise<T>, { session = true, enabled = true }: { readonly session?: boolean; readonly enabled?: boolean } = {}): UseQueryResult<T> {
  const { site, client, token, forget } = useLearnData();
  const query = useQuery({
    queryKey: learnKey(site, ...parts, token),
    queryFn: () => read(client),
    enabled: enabled && (!session || token !== null),
  });
  const ended = token !== null && query.error instanceof ApiError && query.error.status === 401;
  useEffect(() => {
    if (ended) forget();
  }, [ended, forget]);
  return query;
}

/** The signed-in learner; null data when the session has ended (and then it is forgotten). */
export function useMe(): UseQueryResult<Learner | null> {
  const { token, forget } = useLearnData();
  const me = useLearnQuery(["me"], (client) => client.me());
  const gone = token !== null && me.isSuccess && me.data === null;
  useEffect(() => {
    if (gone) forget();
  }, [gone, forget]);
  return me;
}

/** Aaj's day: the plan's tasks for today, streak, coins, revision due, the problem of the day. Opening it pays the day's check-in coin. */
export const useHome = (): UseQueryResult<Home> => useLearnQuery(["home"], (client) => client.home());

/** The companies the learner aims for, with how ready they are for each. */
export const useTargets = (): UseQueryResult<readonly CompanyTarget[]> => useLearnQuery(["targets"], (client) => client.targets());

/** The site's contests: upcoming, running and past. Open to anyone. */
export const useContests = (): UseQueryResult<readonly ContestSummary[]> => useLearnQuery(["contests"], (client) => client.contests(), { session: false });

/** A problem's submissions by this learner, newest first; nothing is read without a problem. */
export const useSubmissions = (slug: string | null): UseQueryResult<readonly Submission[]> =>
  useLearnQuery(["submissions", slug], (client) => client.submissions(slug ?? ""), { enabled: slug !== null });

/** How learners may sign in here (Google or not), and whether an address must be confirmed first. Open to anyone. */
export const useSignInOptions = (enabled = true): UseQueryResult<SignInOptions> => useLearnQuery(["sign-in-options"], (client) => client.signInOptions(), { session: false, enabled });

/** The learner's running plan; null when there is none. */
export const usePlan = (): UseQueryResult<Plan | null> => useLearnQuery(["plan"], (client) => client.plan());

/** The site's tracks, with the learner's progress in each. Open to anyone (no progress signed out). */
export const useTracks = (): UseQueryResult<readonly TrackSummary[]> => useLearnQuery(["tracks"], (client) => client.tracks(), { session: false });

/** One track, module by module, with the learner's standing on each item (K2-4); nothing is read without a track. Open to anyone. */
export const useTrack = (slug: string | null): UseQueryResult<TrackView> => useLearnQuery(["track", slug], (client) => client.track(slug ?? ""), { session: false, enabled: slug !== null });

/** A lesson: its Markdown, video link, quiz (without answers) and whether the learner has done it (K2-4). Open to anyone. */
export const useLesson = (slug: string): UseQueryResult<Lesson> => useLearnQuery(["lesson", slug], (client) => client.lesson(slug), { session: false });

/** The site's problems, each with the learner's standing (K2-4). The API gives them all at once. Open to anyone. */
export const useProblems = (): UseQueryResult<readonly ProblemSummary[]> => useLearnQuery(["problems"], (client) => client.problems(), { session: false });

/** One problem (K2-5): its statement, samples and starters, the editorial once it opens, and the learner's standing. Open to anyone. */
export const useProblem = (slug: string): UseQueryResult<Problem> => useLearnQuery(["problem", slug], (client) => client.problem(slug), { session: false });

/** What Sahayak has said to the learner about a problem, and the next hint with its cost (K2-5's hints); signed in only. */
export const useTutor = (slug: string, enabled = true): UseQueryResult<TutorHistory> => useLearnQuery(["prep", "tutor", slug], (client) => client.tutor(slug), { enabled });

/** The problem of the day and a month's calendar (`YYYY-MM`) up to today, with the learner's days off (K2-4). Open to anyone. */
export const usePotd = (month: string | null): UseQueryResult<PotdView> => useLearnQuery(["potd", month], (client) => client.potd(month ?? undefined), { session: false });

/** The site's companies, to aim for. */
export const useCompanies = (): UseQueryResult<readonly CompanyCard[]> => useLearnQuery(["companies"], (client) => client.companies());

/** Problems due for revision today, 15 at most, with what each grade would set (K2-3). */
export const useRevision = (): UseQueryResult<Revision> => useLearnQuery(["revise"], (client) => client.revision());

/** The learner's lists of problems, bookmarks first. */
export const useLists = (): UseQueryResult<readonly ProblemList[]> => useLearnQuery(["lists"], (client) => client.lists());

/** The learner's notes on problems, lessons and topics, newest first. */
export const useNotes = (): UseQueryResult<readonly Note[]> => useLearnQuery(["notes"], (client) => client.notes());

/** A track's notes, module by module, to print; nothing is read without a track. */
export const useNoteBook = (track: string | null): UseQueryResult<NoteBook> => useLearnQuery(["note-book", track], (client) => client.noteBook(track ?? ""), { enabled: track !== null });

/** Whether the browser says it is online, kept up to date. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/** A query that waits for the network: react-query pauses it while offline instead of failing. */
export const waitingForNetwork = (query: Pick<UseQueryResult, "isPending" | "fetchStatus">): boolean => query.isPending && query.fetchStatus === "paused";

/* ---------------- the states, from the kit ---------------- */

/** Loading: the page's shape and, in words, that it is on its way. */
export function Loading({ shape = "list", children }: { readonly shape?: SkeletonShape; readonly children?: ReactNode }) {
  const { t } = useLearn();
  return (
    <Skeleton label={t(D.loading)} shape={shape}>
      {children}
    </Skeleton>
  );
}

/** A failed read: what happened, that nothing is lost, try again, and a reference to quote. */
export function Failed({ error, onRetry, retrying = false, headingLevel = 2 }: { readonly error: unknown; readonly onRetry: () => void; readonly retrying?: boolean; readonly headingLevel?: 2 | 3 }) {
  const { t } = useLearn();
  const reference = error instanceof ApiError ? `${error.code} · ${error.status}` : "network";
  return (
    <ErrorState
      title={t(D.failedTitle)}
      body={t(D.failedBody)}
      retryLabel={t(D.retry)}
      onRetry={onRetry}
      retrying={retrying}
      reference={`${t(D.reference)}: ${reference}`}
      headingLevel={headingLevel}
    />
  );
}

/** Offline: a banner over what is already on the page, or a wait where nothing has loaded yet. */
export function Offline({ waiting = false }: { readonly waiting?: boolean }) {
  const { t } = useLearn();
  return <OfflineBanner title={t(D.offlineTitle)}>{waiting ? t(D.offlineWait) : t(D.offlineBody)}</OfflineBanner>;
}

/** The screen this page is, as a "go back to" for signing in: from the address, checked by `safeNext`. */
export function hereAsNext(site: string): string | null {
  const base = `/practice/${site}/`;
  const path = window.location.pathname;
  return path.startsWith(base) ? safeNext(path.slice(base.length).replace(/\/+$/, "")) : null;
}

/** Signed out: Learn's own sign-in (K2-2), which comes back to this screen; the session is the practice site's. */
export function SignedOut({ title, headingLevel = 2 }: { readonly title?: string; readonly headingLevel?: 2 | 3 }) {
  const { t, site } = useLearn();
  const next = hereAsNext(site);
  return (
    <Empty
      title={title ?? t(D.signedOutTitle)}
      body={t(D.signedOutBody)}
      headingLevel={headingLevel}
      action={
        <ScreenLink to={next === null || next === "aaj" ? "signin" : `signin?next=${encodeURIComponent(next)}`} className="ln-btn ln-btn-pri">
          {t(D.signIn)}
        </ScreenLink>
      }
    />
  );
}
