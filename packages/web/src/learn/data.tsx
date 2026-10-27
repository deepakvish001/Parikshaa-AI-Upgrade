import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { ErrorState, OfflineBanner, Skeleton, Empty, type SkeletonShape } from "@parikshaa/brand/kit";
import { ApiError } from "../api.ts";
import { loadToken, PracticeClient, saveToken, type CompanyTarget, type ContestSummary, type Home, type Learner, type Submission } from "../practice/client.ts";
import { useLearn } from "./context.tsx";
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
  /** Forget a session the server no longer knows. */
  readonly forget: () => void;
}

const DataContext = createContext<LearnData | null>(null);

/** A session in the address's fragment (`#session=…`, from Google sign-in): kept, then taken out of the address. */
export function arrivedSession(site: string): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const session = hash.get("session");
  if (session === null || session === "") return null;
  saveToken(site, session);
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  return session;
}

export function LearnDataProvider({ site, baseUrl = "/api", children }: { readonly site: string; readonly baseUrl?: string; readonly children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => arrivedSession(site) ?? loadToken(site));
  const client = useMemo(() => new PracticeClient(site, token, baseUrl), [site, token, baseUrl]);
  const forget = useCallback(() => {
    saveToken(site, null);
    setToken(null);
  }, [site]);
  const value = useMemo<LearnData>(() => ({ site, client, token, signedIn: token !== null, forget }), [site, client, token, forget]);
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

/**
 * Signed out: until Learn has its own sign-in (K2-2), the practice site's
 * sign-in, which keeps the same session; `?learn_v2=0` opens that site.
 */
export function SignedOut({ headingLevel = 2 }: { readonly headingLevel?: 2 | 3 }) {
  const { t, site } = useLearn();
  return (
    <Empty
      title={t(D.signedOutTitle)}
      body={t(D.signedOutBody)}
      headingLevel={headingLevel}
      action={
        <a className="ln-btn ln-btn-pri" href={`/practice/${site}/signin?learn_v2=0`}>
          {t(D.signIn)}
        </a>
      }
    />
  );
}
