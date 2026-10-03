import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleDashed, Flame, Lock, LogIn, MailWarning, MessageSquare, Search, ShieldCheck, Trophy } from "lucide-react";
import type { CandidateCodeQuestion } from "@parikshaa/core/browser";
import { Markdown } from "@parikshaa/brand/markdown";
import { Wordmark } from "@parikshaa/brand/react";
import { ApiError } from "../api.ts";
import { AnswerInput } from "../components/AnswerInput.tsx";
import { CodeAnswer } from "../components/CodeAnswer.tsx";
import { LANGUAGE_NAMES, memory } from "../components/code-meta.ts";
import { ProblemStatement } from "../components/ProblemStatement.tsx";
import { DisplayMenu, useReadingPreferences } from "../components/Tools.tsx";
import { PreferencesProvider, usePreferences, type MessageKey } from "../i18n.tsx";
import {
  asSubmitOutcome,
  loadToken,
  PracticeClient,
  saveRef,
  saveToken,
  type Contest,
  type ContestSummary,
  type Difficulty,
  type Learner,
  type Level,
  type Problem,
  type ProblemSummary,
  type Progress,
  type Standing,
  type Submission,
  type Verdict,
} from "./client.ts";
import { approachesOf } from "./editorial.ts";
import { DifficultyPill, Link, messageOf, SignInNeeded, useWhen, Who, type Context, type Nav } from "./parts.tsx";
import { navWord } from "./prep-nav.ts";

// The prep pages come in a chunk of their own, when one is first opened.
const prep = () => import("./PrepPages.tsx");
const HomePage = lazy(() => prep().then((m) => ({ default: m.HomePage })));
const TracksPage = lazy(() => prep().then((m) => ({ default: m.TracksPage })));
const TrackPage = lazy(() => prep().then((m) => ({ default: m.TrackPage })));
const LessonPage = lazy(() => prep().then((m) => ({ default: m.LessonPage })));
const PlanPage = lazy(() => prep().then((m) => ({ default: m.PlanPage })));
const RevisePage = lazy(() => prep().then((m) => ({ default: m.RevisePage })));
const ListsPage = lazy(() => prep().then((m) => ({ default: m.ListsPage })));
const NotesPage = lazy(() => prep().then((m) => ({ default: m.NotesPage })));
const PotdPage = lazy(() => prep().then((m) => ({ default: m.PotdPage })));
const CoinsPage = lazy(() => prep().then((m) => ({ default: m.CoinsPage })));
const SharedCodePage = lazy(() => prep().then((m) => ({ default: m.SharedCodePage })));
const MySharesPage = lazy(() => prep().then((m) => ({ default: m.MySharesPage })));
const NoteEditor = lazy(() => prep().then((m) => ({ default: m.NoteEditor })));
const SaveMenu = lazy(() => prep().then((m) => ({ default: m.SaveMenu })));
const ShareCode = lazy(() => prep().then((m) => ({ default: m.ShareCode })));
const RewardNote = lazy(() => prep().then((m) => ({ default: m.RewardNote })));
const plusPages = () => import("./PlusPages.tsx");
const PlusPage = lazy(() => plusPages().then((m) => ({ default: m.PlusPage })));
const SprintQuizPage = lazy(() => prep().then((m) => ({ default: m.SprintQuizPage })));
const SprintNotesPage = lazy(() => prep().then((m) => ({ default: m.SprintNotesPage })));
const PlacementPage = lazy(() => prep().then((m) => ({ default: m.PlacementPage })));
const NoteBookPage = lazy(() => prep().then((m) => ({ default: m.NoteBookPage })));
const classPages = () => import("./ClassPages.tsx");
const ClassesPage = lazy(() => classPages().then((m) => ({ default: m.ClassesPage })));
const ClassLabPage = lazy(() => classPages().then((m) => ({ default: m.ClassLabPage })));
const RemindersOffPage = lazy(() => prep().then((m) => ({ default: m.RemindersOffPage })));
const InvoicePage = lazy(() => plusPages().then((m) => ({ default: m.InvoicePage })));
const community = () => import("./CommunityPages.tsx");
const CompaniesPage = lazy(() => community().then((m) => ({ default: m.CompaniesPage })));
const CompanyPage = lazy(() => community().then((m) => ({ default: m.CompanyPage })));
const ExperiencesPage = lazy(() => community().then((m) => ({ default: m.ExperiencesPage })));
const StorePage = lazy(() => community().then((m) => ({ default: m.StorePage })));
const RatingPage = lazy(() => community().then((m) => ({ default: m.RatingPage })));
const ProfilePage = lazy(() => community().then((m) => ({ default: m.ProfilePage })));
const StoriesPage = lazy(() => community().then((m) => ({ default: m.StoriesPage })));
const TutorPanel = lazy(() => import("./Tutor.tsx").then((m) => ({ default: m.TutorPanel })));
import "./practice.css";

/**
 * A practice site (ROADMAP §15): an institution's problems at
 * `/practice/<site>`, solved by learners with accounts of their own — alone,
 * or in timed contests. Learning, not assessment: nothing here is proctored,
 * and nothing goes into anyone's exam record.
 */

// --- routes --------------------------------------------------------------------------

export type Route =
  | { readonly page: "problems" }
  | { readonly page: "problem"; readonly slug: string; readonly contest: string | undefined }
  | { readonly page: "contests" }
  | { readonly page: "contest"; readonly slug: string }
  | { readonly page: "leaderboard" }
  | { readonly page: "progress" }
  | { readonly page: "home" }
  | { readonly page: "tracks" }
  | { readonly page: "track"; readonly slug: string }
  | { readonly page: "lesson"; readonly slug: string }
  | { readonly page: "plan"; readonly track: string | undefined; readonly level?: Level | undefined }
  | { readonly page: "placement"; readonly track: string | undefined }
  | { readonly page: "revise" }
  | { readonly page: "lists" }
  | { readonly page: "notes" }
  | { readonly page: "notebook"; readonly track: string | undefined }
  | { readonly page: "potd" }
  | { readonly page: "coins" }
  | { readonly page: "plus" }
  | { readonly page: "invoice"; readonly number: string }
  | { readonly page: "reminders"; readonly token: string | undefined }
  | { readonly page: "classes" }
  | { readonly page: "class-lab"; readonly id: string }
  | { readonly page: "sprint"; readonly sprint: number; readonly view: "quiz" | "notes" }
  | { readonly page: "companies" }
  | { readonly page: "company"; readonly slug: string }
  | { readonly page: "experiences"; readonly company: string | undefined }
  | { readonly page: "store" }
  | { readonly page: "rating" }
  | { readonly page: "profile"; readonly username: string }
  | { readonly page: "stories" }
  | { readonly page: "share"; readonly id: string }
  | { readonly page: "shares" }
  | { readonly page: "signin"; readonly next: string | undefined }
  | { readonly page: "signup"; readonly next: string | undefined };

/** The site's address from a path, or null for a path that is not a practice site's. */
export function siteOf(pathname: string): string | null {
  const match = /^\/practice\/([a-z0-9][a-z0-9-]*)(?:\/|$)/.exec(pathname);
  return match === null ? null : match[1]!;
}

const LEVELS: readonly Level[] = ["beginner", "intermediate", "advanced"];

export function parseRoute(pathname: string, search: string): Route {
  const rest = pathname.replace(/^\/practice\/[^/]+/, "").replace(/\/+$/, "");
  const query = new URLSearchParams(search);
  const [, first, second, third] = rest.split("/").map(decodeURIComponent);
  const next = query.get("next") ?? undefined;
  switch (first) {
    case "problems":
      return second === undefined ? { page: "problems" } : { page: "problem", slug: second, contest: query.get("contest") ?? undefined };
    case "contests":
      return second === undefined ? { page: "contests" } : { page: "contest", slug: second };
    case "leaderboard":
      return { page: "leaderboard" };
    case "progress":
      return { page: "progress" };
    case "home":
      return { page: "home" };
    case "tracks":
      return second === undefined ? { page: "tracks" } : { page: "track", slug: second };
    case "lessons":
      return second === undefined ? { page: "tracks" } : { page: "lesson", slug: second };
    case "plan":
      return { page: "plan", track: query.get("track") ?? undefined, level: LEVELS.find((l) => l === query.get("level")) };
    case "placement":
      return { page: "placement", track: query.get("track") ?? undefined };
    case "revise":
      return { page: "revise" };
    case "lists":
      return { page: "lists" };
    case "notes":
      return second === "print" ? { page: "notebook", track: query.get("track") ?? undefined } : { page: "notes" };
    case "potd":
      return { page: "potd" };
    case "coins":
      return { page: "coins" };
    case "plus":
      return { page: "plus" };
    case "sprints":
      return /^\d+$/.test(second ?? "") && (third === "quiz" || third === "notes") ? { page: "sprint", sprint: Number(second), view: third } : { page: "plan", track: undefined };
    case "reminders":
      return { page: "reminders", token: query.get("off") ?? undefined };
    case "classes":
      return second === undefined ? { page: "classes" } : { page: "class-lab", id: second };
    case "invoices":
      return second === undefined ? { page: "plus" } : { page: "invoice", number: second };
    case "companies":
      return second === undefined ? { page: "companies" } : { page: "company", slug: second };
    case "experiences":
      return { page: "experiences", company: query.get("company") ?? undefined };
    case "store":
      return { page: "store" };
    case "rating":
      return { page: "rating" };
    case "stories":
      return { page: "stories" };
    case "shares":
      return second === undefined ? { page: "shares" } : { page: "share", id: second };
    case "u":
      return second === undefined ? { page: "rating" } : { page: "profile", username: second };
    case "signin":
      return { page: "signin", next };
    case "signup":
      return { page: "signup", next };
    default:
      return { page: "problems" };
  }
}

// --- the app -----------------------------------------------------------------------------

export function PracticeApp({ site, baseUrl = "/api" }: { readonly site: string; readonly baseUrl?: string }) {
  return (
    <PreferencesProvider>
      <Shell site={site} baseUrl={baseUrl} />
    </PreferencesProvider>
  );
}

/**
 * What the address brought, taken once and cleared: a session from signing in
 * with Google (in the fragment, which no server logs), a confirmation link,
 * or a failed Google sign-in.
 */
function arrival(site: string): { session: string | null; verify: string | null; signinError: string | null } {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const found = { session: hash.get("session"), verify: query.get("verify"), signinError: query.get("signin_error") };
  // An affiliate's link: its coupon waits for checkout.
  const ref = query.get("ref");
  if (ref !== null && /^[A-Za-z0-9][A-Za-z0-9-]{2,29}$/.test(ref)) saveRef(site, ref.toUpperCase());
  if (found.session !== null || found.verify !== null || found.signinError !== null || ref !== null) {
    query.delete("verify");
    query.delete("signin_error");
    query.delete("ref");
    const rest = query.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${rest === "" ? "" : `?${rest}`}`);
  }
  if (found.session !== null) saveToken(site, found.session);
  return found;
}

function Shell({ site, baseUrl }: { readonly site: string; readonly baseUrl: string }) {
  const { t, language } = usePreferences();
  const p = (word: Parameters<typeof navWord>[1]) => navWord(language, word);
  const queryClient = useQueryClient();
  const [arrived] = useState(() => arrival(site));
  const reading = useReadingPreferences();
  const [token, setToken] = useState<string | null>(() => loadToken(site));
  const client = useMemo(() => new PracticeClient(site, token, baseUrl), [site, token, baseUrl]);
  // Answers kept while offline go when the network is back (and on opening).
  useEffect(() => {
    const send = () =>
      void client
        .submitQueued()
        .then((n) => (n > 0 ? queryClient.invalidateQueries({ queryKey: ["practice", site] }) : undefined))
        .catch(() => undefined);
    send();
    window.addEventListener("online", send);
    return () => window.removeEventListener("online", send);
  }, [client, queryClient, site]);
  const [location, setLocation] = useState(() => ({ path: window.location.pathname, search: window.location.search }));
  const route = parseRoute(location.path, location.search);

  const nav: Nav = useMemo(
    () => ({
      site,
      href: (path) => `/practice/${site}${path}`,
      go: (path) => {
        const url = `/practice/${site}${path}`;
        window.history.pushState(null, "", url);
        const [p, s] = url.split("?");
        setLocation({ path: p!, search: s === undefined ? "" : `?${s}` });
        window.scrollTo(0, 0);
      },
    }),
    [site],
  );
  useEffect(() => {
    const back = () => setLocation({ path: window.location.pathname, search: window.location.search });
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);

  const info = useQuery({ queryKey: ["practice", site, "site"], queryFn: () => client.site() });
  const me = useQuery({ queryKey: ["practice", site, "me", token], queryFn: () => client.me() });
  const learner = me.data ?? null;
  const options = useQuery({ queryKey: ["practice", site, "sign-in-options"], queryFn: () => client.signInOptions(), retry: false });

  // A confirmation link: follow it once, and say how it went.
  const [notice, setNotice] = useState<{ readonly tone: "ok" | "error"; readonly text: string } | null>(
    arrived.signinError === null ? null : { tone: "error", text: t("practice.googleFailed") },
  );
  useEffect(() => {
    if (arrived.verify === null) return;
    client
      .verify(arrived.verify)
      .then(() => {
        setNotice({ tone: "ok", text: t("practice.verified") });
        void queryClient.invalidateQueries({ queryKey: ["practice", site, "me"] });
      })
      .catch(() => setNotice({ tone: "error", text: t("practice.verifyFailed") }));
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const resend = useMutation({ mutationFn: () => client.resendVerification() });

  // A session that ended elsewhere is forgotten here too.
  useEffect(() => {
    if (token !== null && me.isSuccess && me.data === null) {
      saveToken(site, null);
      setToken(null);
    }
  }, [token, me.isSuccess, me.data, site]);

  const signedIn = useCallback(
    (next: string, then: string | undefined) => {
      saveToken(site, next);
      setToken(next);
      void queryClient.invalidateQueries({ queryKey: ["practice", site] });
      nav.go(then ?? "/home");
    },
    [site, queryClient, nav],
  );
  const signOut = async () => {
    await client.signOut().catch(() => undefined);
    saveToken(site, null);
    setToken(null);
    await queryClient.invalidateQueries({ queryKey: ["practice", site] });
    nav.go("/problems");
  };

  useEffect(() => {
    if (info.data !== undefined) document.title = `${info.data.title} · Parikshaa`;
  }, [info.data]);

  if (info.isPending) {
    return (
      <main className="page">
        <p className="notice">{t("practice.loading")}</p>
      </main>
    );
  }
  if (info.isError) {
    return (
      <div className="gate-screen">
        <main className="gate">
          <h1 className="gate-title">
            <Wordmark size={36} />
          </h1>
          <div className="card gate-card">
            <h2>{t("practice.noSite")}</h2>
            <p className="notice">{t("practice.noSiteHint")}</p>
          </div>
        </main>
      </div>
    );
  }

  const here = (path: string) => location.path === nav.href(path) || location.path.startsWith(`${nav.href(path)}/`);
  const context = { client, nav, learner, site };
  const wide = route.page === "problem";

  return (
    <div className={`practice${wide ? " wide" : ""}`}>
      <header className="topbar practice-bar">
        <div className="topbar-inner">
          <Link nav={nav} to="/problems" className="home">
            <Wordmark size={24} />
          </Link>
          <span className="divider" aria-hidden="true" />
          <span className="exam-name site-name" title={info.data.title}>
            {info.data.title}
          </span>
          <nav aria-label={t("practice.nav")} className="practice-nav">
            {learner === null ? null : (
              <Link nav={nav} to="/home" current={here("/home")}>
                {p("home")}
              </Link>
            )}
            <Link nav={nav} to="/tracks" current={here("/tracks") || here("/lessons")}>
              {p("tracks")}
            </Link>
            <Link nav={nav} to="/problems" current={here("/problems") || location.path === nav.href("")}>
              {t("practice.problems")}
            </Link>
            {learner === null ? null : (
              <>
                <Link nav={nav} to="/plan" current={here("/plan")}>
                  {p("plan")}
                </Link>
                <Link nav={nav} to="/revise" current={here("/revise")}>
                  {p("revise")}
                </Link>
              </>
            )}
            <Link nav={nav} to="/companies" current={here("/companies") || here("/experiences")}>
              {p("companies")}
            </Link>
            <Link nav={nav} to="/contests" current={here("/contests") || here("/rating")}>
              {t("practice.contests")}
            </Link>
            <Link nav={nav} to="/leaderboard" current={here("/leaderboard")}>
              {t("practice.leaderboard")}
            </Link>
          </nav>
          <span className="spacer" />
          {learner !== null ? (
            <Link nav={nav} to="/progress" className="me" current={here("/progress")}>
              <span className="avatar-dot" aria-hidden="true">
                {learner.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="me-name">{learner.name}</span>
            </Link>
          ) : route.page === "signin" || route.page === "signup" ? null : (
            <Link nav={nav} to="/signin" className="button quiet">
              <LogIn aria-hidden="true" /> {t("practice.signIn")}
            </Link>
          )}
          <DisplayMenu offered={[]} reading={reading} />
        </div>
      </header>
      <main className={wide ? "practice-main wide" : "practice-main"}>
        {notice === null ? null : (
          <p className={`practice-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
            {notice.text}
          </p>
        )}
        {learner === null || learner.emailVerified ? null : (
          <div className="practice-notice verify" role="status">
            <MailWarning aria-hidden="true" />
            <span className="grow">{t(options.data?.requireVerified === true ? "practice.verifyRequired" : "practice.verifyBanner", { email: learner.email })}</span>
            {resend.isSuccess ? (
              <span>{t("practice.resent")}</span>
            ) : (
              <button type="button" className="secondary" disabled={resend.isPending} onClick={() => resend.mutate()}>
                {t("practice.resend")}
              </button>
            )}
          </div>
        )}
        <Suspense fallback={<p className="notice">{t("practice.loading")}</p>}>
        {route.page === "problems" ? (
          <ProblemsPage {...context} welcome={info.data.welcome} />
        ) : route.page === "problem" ? (
          <ProblemPage {...context} slug={route.slug} contest={route.contest} />
        ) : route.page === "contests" ? (
          <ContestsPage {...context} />
        ) : route.page === "contest" ? (
          <ContestPage {...context} slug={route.slug} />
        ) : route.page === "leaderboard" ? (
          <LeaderboardPage {...context} />
        ) : route.page === "tracks" ? (
          <TracksPage {...context} />
        ) : route.page === "track" ? (
          <TrackPage {...context} slug={route.slug} />
        ) : route.page === "lesson" ? (
          <LessonPage {...context} slug={route.slug} />
        ) : route.page === "potd" ? (
          <PotdPage {...context} />
        ) : route.page === "classes" ? (
          <ClassesPage {...context} />
        ) : route.page === "class-lab" ? (
          <ClassLabPage {...context} classId={route.id} />
        ) : route.page === "reminders" ? (
          <RemindersOffPage {...context} token={route.token} />
        ) : route.page === "invoice" ? (
          <InvoicePage {...context} number={route.number} />
        ) : route.page === "plus" ? (
          <PlusPage {...context} />
        ) : route.page === "companies" ? (
          <CompaniesPage {...context} />
        ) : route.page === "company" ? (
          <CompanyPage {...context} slug={route.slug} />
        ) : route.page === "experiences" ? (
          <ExperiencesPage {...context} company={route.company} />
        ) : route.page === "store" ? (
          <StorePage {...context} />
        ) : route.page === "rating" ? (
          <RatingPage {...context} />
        ) : route.page === "stories" ? (
          <StoriesPage {...context} />
        ) : route.page === "share" ? (
          <SharedCodePage {...context} id={route.id} />
        ) : route.page === "profile" ? (
          <ProfilePage {...context} username={route.username} />
        ) : route.page === "home" || route.page === "plan" || route.page === "sprint" || route.page === "revise" || route.page === "lists" || route.page === "notes" || route.page === "notebook" || route.page === "placement" || route.page === "coins" || route.page === "shares" ? (
          learner === null ? (
            <SignInNeeded nav={nav} next={location.path.replace(nav.href(""), "") + location.search} />
          ) : route.page === "home" ? (
            <HomePage {...context} learner={learner} />
          ) : route.page === "plan" ? (
            <PlanPage {...context} learner={learner} track={route.track} level={route.level} />
          ) : route.page === "placement" ? (
            <PlacementPage {...context} learner={learner} track={route.track} />
          ) : route.page === "sprint" ? (
            route.view === "quiz" ? (
              <SprintQuizPage {...context} learner={learner} sprint={route.sprint} />
            ) : (
              <SprintNotesPage {...context} learner={learner} sprint={route.sprint} />
            )
          ) : route.page === "revise" ? (
            <RevisePage {...context} learner={learner} />
          ) : route.page === "lists" ? (
            <ListsPage {...context} learner={learner} />
          ) : route.page === "notes" ? (
            <NotesPage {...context} learner={learner} />
          ) : route.page === "notebook" ? (
            <NoteBookPage {...context} learner={learner} track={route.track} />
          ) : route.page === "shares" ? (
            <MySharesPage {...context} learner={learner} />
          ) : (
            <CoinsPage {...context} learner={learner} />
          )
        ) : route.page === "progress" ? (
          learner === null ? (
            <SignInNeeded nav={nav} next="/progress" />
          ) : (
            <ProgressPage {...context} learner={learner} onSignOut={() => void signOut()} onDeleted={() => void signOut()} />
          )
        ) : (
          <AccountForm {...context} mode={route.page} next={route.next} onSignedIn={signedIn} google={options.data?.google === true} />
        )}
        </Suspense>
      </main>
    </div>
  );
}

// --- small parts ----------------------------------------------------------------------------

function StandingIcon({ status }: { readonly status: Standing }) {
  const { t } = usePreferences();
  const label = status === "solved" ? t("practice.solved") : status === "attempted" ? t("practice.attempted") : t("practice.todo");
  return (
    <span role="img" aria-label={label} className="standing-wrap">
      {status === "solved" ? (
        <CircleCheck className="standing solved" aria-hidden="true" />
      ) : status === "attempted" ? (
        <CircleDashed className="standing attempted" aria-hidden="true" />
      ) : (
        <span className="standing none" />
      )}
    </span>
  );
}

const percent = (share: number | null) => (share === null ? "—" : `${(share * 100).toFixed(1)}%`);

/** Now, every second: for countdowns. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function span(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const hms = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return d > 0 ? `${d}d ${hms}` : hms;
}

// --- the problem set ---------------------------------------------------------------------------

type StatusFilter = "all" | "todo" | "attempted" | "solved";

function ProblemsPage({ client, nav, learner, site, welcome }: Context & { readonly welcome: string }) {
  const { t, language } = usePreferences();
  const problems = useQuery({ queryKey: ["practice", site, "problems", learner?.id ?? null], queryFn: () => client.problems() });
  const progress = useQuery({ queryKey: ["practice", site, "progress", learner?.id], queryFn: () => client.progress(), enabled: learner !== null });
  const [text, setText] = useState("");
  const [difficulty, setDifficulty] = useState<"all" | Difficulty>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [tag, setTag] = useState<string | null>(null);
  const [pattern, setPattern] = useState("");
  const [company, setCompany] = useState("");

  const all = problems.data ?? [];
  const patterns = [...new Set(all.flatMap((p) => p.patterns))].sort();
  const companies = [...new Map(all.flatMap((p) => p.companies).map((c) => [c.slug, c.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const tags = [...new Set(all.flatMap((p) => p.tags))].sort();
  const tagged = (name: string) => all.filter((p) => p.tags.includes(name)).length;
  const shown = all.filter(
    (p) =>
      (text.trim() === "" || p.title.toLowerCase().includes(text.trim().toLowerCase())) &&
      (difficulty === "all" || p.difficulty === difficulty) &&
      (status === "all" || (status === "todo" ? p.status === null : p.status === status)) &&
      (tag === null || p.tags.includes(tag)) &&
      (pattern === "" || p.patterns.includes(pattern)) &&
      (company === "" || p.companies.some((c) => c.slug === company)),
  );

  return (
    <div className="problems-page">
      <section className="practice-hero">
        <div>
          <h1>{t("practice.problems")}</h1>
          {welcome.trim() === "" ? <p className="notice">{t("practice.tagline")}</p> : <Markdown source={welcome} />}
        </div>
        {learner === null ? (
          <div className="hero-cta">
            <p className="notice">{t("practice.joinHint")}</p>
            <Link nav={nav} to="/signup" className="button">
              {t("practice.signUp")}
            </Link>
          </div>
        ) : progress.data === undefined ? null : (
          <SolvedSummary progress={progress.data} compact />
        )}
      </section>

      <div className="card problem-table">
        <div className="filters" role="search">
          <label className="search">
            <Search aria-hidden="true" />
            <span className="visually-hidden">{t("practice.search")}</span>
            <input type="search" placeholder={t("practice.search")} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <label>
            <span className="visually-hidden">{t("practice.difficulty")}</span>
            <select aria-label={t("practice.difficulty")} value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
              <option value="all">{t("practice.allDifficulties")}</option>
              {(["easy", "medium", "hard"] as const).map((d) => (
                <option key={d} value={d}>
                  {t(`practice.difficulty.${d}` as MessageKey)}
                </option>
              ))}
            </select>
          </label>
          {learner === null ? null : (
            <label>
              <span className="visually-hidden">{t("practice.status")}</span>
              <select aria-label={t("practice.status")} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
                <option value="all">{t("practice.allStatuses")}</option>
                <option value="todo">{t("practice.todo")}</option>
                <option value="attempted">{t("practice.attempted")}</option>
                <option value="solved">{t("practice.solved")}</option>
              </select>
            </label>
          )}
          {patterns.length === 0 ? null : (
            <label>
              <span className="visually-hidden">{navWord(language, "pattern")}</span>
              <select aria-label={navWord(language, "pattern")} value={pattern} onChange={(e) => setPattern(e.target.value)}>
                <option value="">{navWord(language, "allPatterns")}</option>
                {patterns.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {companies.length === 0 ? null : (
            <label>
              <span className="visually-hidden">{navWord(language, "company")}</span>
              <select aria-label={navWord(language, "company")} value={company} onChange={(e) => setCompany(e.target.value)}>
                <option value="">{navWord(language, "allCompanies")}</option>
                {companies.map(([slug, name]) => (
                  <option key={slug} value={slug}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {tags.length === 0 ? null : (
          <div className="tag-row" role="group" aria-label={t("practice.topics")}>
            {tags.map((name) => (
              <button key={name} type="button" className="chip" aria-pressed={tag === name} onClick={() => setTag(tag === name ? null : name)}>
                {name}{" "}
                <span className="count">{tagged(name)}</span>
              </button>
            ))}
          </div>
        )}
        {problems.isPending ? (
          <p className="notice">{t("practice.loading")}</p>
        ) : all.length === 0 ? (
          <p className="notice empty">{t("practice.noProblems")}</p>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col" className="status-col">
                    {t("practice.status")}
                  </th>
                  <th scope="col">{t("practice.title")}</th>
                  <th scope="col">{t("practice.difficulty")}</th>
                  <th scope="col" className="num">
                    {t("practice.acceptance")}
                  </th>
                  <th scope="col" className="num">
                    {t("practice.solvedBy")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p, i) => (
                  <ProblemRow key={p.slug} problem={p} index={all.indexOf(p) + 1} nav={nav} striped={i % 2 === 1} />
                ))}
              </tbody>
            </table>
            {shown.length === 0 ? <p className="notice empty">{t("practice.noMatch")}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function ProblemRow({ problem, index, nav, striped }: { readonly problem: ProblemSummary; readonly index: number; readonly nav: Nav; readonly striped: boolean }) {
  const { t } = usePreferences();
  return (
    <tr className={striped ? "striped" : undefined}>
      <td className="status-col">
        <StandingIcon status={problem.status} />
      </td>
      <td>
        <Link nav={nav} to={`/problems/${problem.slug}`} className="problem-link">
          {index}. {problem.title}
        </Link>
        {problem.tags.length === 0 ? null : <span className="tags">{problem.tags.join(" · ")}</span>}
      </td>
      <td>
        <DifficultyPill difficulty={problem.difficulty} />
      </td>
      <td className="num" data-label={t("practice.acceptance")}>
        {percent(problem.acceptance)}
      </td>
      <td className="num" data-label={t("practice.solvedBy")}>
        {problem.solvedBy}
      </td>
    </tr>
  );
}

// --- one problem ------------------------------------------------------------------------------

type Tab = "description" | "editorial" | "submissions" | "discussion" | "notes" | "tutor";

/** The learner's code as the workspace keeps it, for the tutor to read; null for anything else. */
function codeOf(value: string): { language: string; source: string } | null {
  try {
    const parsed = JSON.parse(value) as { language?: unknown; source?: unknown };
    return typeof parsed.language === "string" && typeof parsed.source === "string" ? { language: parsed.language, source: parsed.source } : null;
  } catch {
    return null;
  }
}

const draftKey = (site: string, slug: string) => `parikshaa.practice.${site}.draft.${slug}`;
function loadDraft(site: string, slug: string): string {
  try {
    return localStorage.getItem(draftKey(site, slug)) ?? "";
  } catch {
    return "";
  }
}
function saveDraft(site: string, slug: string, value: string): void {
  try {
    localStorage.setItem(draftKey(site, slug), value);
  } catch {
    // A private window: the draft lasts this page.
  }
}

function ProblemPage({ client, nav, learner, site, slug, contest }: Context & { readonly slug: string; readonly contest: string | undefined }) {
  const { t } = usePreferences();
  const queryClient = useQueryClient();
  const problem = useQuery({
    queryKey: ["practice", site, "problem", slug, contest ?? null, learner?.id ?? null],
    queryFn: () => client.problem(slug, contest),
    // Signing in or out asks again, for the learner's own status; the problem
    // stays on the page meanwhile instead of flashing "Loading…".
    placeholderData: (previous, query) => (query?.queryKey[3] === slug && query.queryKey[4] === (contest ?? null) ? previous : undefined),
  });
  const [value, setValue] = useState(() => loadDraft(site, slug));
  const [tab, setTab] = useState<Tab>("description");
  const [solvedNow, setSolvedNow] = useState(false);
  const [reward, setReward] = useState<Verdict["reward"]>(undefined);
  const { language } = usePreferences();
  const pt = () => navWord(language, "notes");
  const here = `/problems/${slug}${contest === undefined ? "" : `?contest=${encodeURIComponent(contest)}`}`;

  const change = (next: string) => {
    setValue(next);
    saveDraft(site, slug, next);
  };
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["practice", site] });
  const judged = (verdict: Verdict) => {
    if (verdict.firstSolve) setSolvedNow(true);
    setReward(verdict.reward);
    void refresh();
  };

  if (problem.isPending) return <p className="notice">{t("practice.loading")}</p>;
  if (problem.isError) {
    return (
      <div className="card">
        <p className="error">{problem.error instanceof ApiError && problem.error.code === "contest_not_started" ? t("practice.notStarted") : t("practice.noProblem")}</p>
        <Link nav={nav} to="/problems">
          {t("practice.backToProblems")}
        </Link>
      </div>
    );
  }
  const p = problem.data;
  const blocked =
    learner === null ? (
      <p className="notice blocked">
        <Lock aria-hidden="true" /> {t("practice.signInToSubmit")}{" "}
        <Link nav={nav} to={`/signin?next=${encodeURIComponent(here)}`}>
          {t("practice.signIn")}
        </Link>
      </p>
    ) : undefined;

  const tabs = (
    <div className="problem-tabs" role="tablist" aria-label={p.title}>
      {(learner === null ? (["description", "editorial", "submissions", "discussion"] as const) : (["description", "editorial", "submissions", "discussion", "notes", "tutor"] as const)).map((name) => (
        <button
          key={name}
          type="button"
          role="tab"
          id={`tab-${name}`}
          aria-selected={tab === name}
          aria-controls={`panel-${name}`}
          className={tab === name ? "on" : ""}
          onClick={() => setTab(name)}
        >
          {name === "tutor" ? navWord(language, "tutor") : name === "notes" ? pt() : t(`practice.tab.${name}` as MessageKey)}
        </button>
      ))}
    </div>
  );

  const panel = (
    <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="problem-panel">
      {tab === "description" ? (
        <>
          <div className="problem-head">
            <h1>{p.title}</h1>
            <div className="problem-meta">
              <DifficultyPill difficulty={p.difficulty} />
              {p.status === "solved" ? (
                <span className="pill ok">{t("practice.solved")}</span>
              ) : p.status === "attempted" ? (
                <span className="pill warn">{t("practice.attempted")}</span>
              ) : null}
              <span className="notice">
                {t("practice.acceptance")}: {percent(p.acceptance)} · {t("practice.solvedByN", { n: p.solvedBy })}
              </span>
            </div>
            {learner === null || p.contest !== null ? null : (
              <Suspense fallback={null}>
                <SaveMenu client={client} site={site} slug={slug} />
              </Suspense>
            )}
            {learner === null || p.contest !== null || p.question.kind !== "code" ? null : (
              <Suspense fallback={null}>
                <ShareCode client={client} nav={nav} slug={slug} code={codeOf(value)} />
              </Suspense>
            )}
            {p.tags.length === 0 ? null : (
              <div className="tag-row">
                {p.tags.map((name) => (
                  <span key={name} className="chip static">
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
          {p.question.kind === "code" ? <ProblemStatement question={p.question} number={1} withTitle={false} /> : <Markdown source={p.question.stem} />}
        </>
      ) : tab === "editorial" ? (
        <Editorial problem={p} />
      ) : tab === "submissions" ? (
        learner === null ? (
          <SignInNeeded nav={nav} next={here} />
        ) : (
          <Submissions client={client} site={site} slug={slug} contest={contest} onLoad={p.question.kind === "code" ? (s) => change(JSON.stringify({ language: s.language, source: s.answer })) : undefined} />
        )
      ) : tab === "tutor" && learner !== null ? (
        <Suspense fallback={null}>
          <TutorPanel client={client} site={site} slug={slug} code={codeOf(value)} onCredits={() => nav.go("/plus")} />
        </Suspense>
      ) : tab === "notes" && learner !== null ? (
        <Suspense fallback={null}>
          <NoteEditor client={client} site={site} kind="problem" refId={slug} />
        </Suspense>
      ) : (
        <Discussion client={client} nav={nav} learner={learner} site={site} slug={slug} here={here} />
      )}
    </div>
  );

  const aside = (
    <>
      {tabs}
      {panel}
    </>
  );

  return (
    <div className="problem-page">
      <div className="crumbs">
        {p.contest === null ? (
          <Link nav={nav} to="/problems">
            ← {t("practice.problems")}
          </Link>
        ) : (
          <ContestBanner nav={nav} contest={p.contest} />
        )}
      </div>
      {reward === undefined || reward.coins <= 0 ? null : (
        <Suspense fallback={null}>
          <RewardNote reward={reward} />
        </Suspense>
      )}
      {solvedNow ? (
        <p className="alert ok solved-banner" role="status">
          <Trophy aria-hidden="true" /> {p.contest === null ? t("practice.solvedNow") : t("practice.solvedInContest")}
        </p>
      ) : null}
      {p.question.kind === "code" ? (
        <CodeAnswer
          question={p.question as CandidateCodeQuestion}
          value={value}
          disabled={false}
          onChange={change}
          onRun={(language, source, input) => client.run(slug, language, source, input, contest)}
          onSubmit={async (language, source) => {
            const verdict = await client.submit(slug, source, language, contest);
            judged(verdict);
            return asSubmitOutcome(verdict);
          }}
          aside={aside}
          {...(blocked === undefined ? {} : { blocked })}
          completion
        />
      ) : (
        <div className="choice-layout">
          <div className="card">{aside}</div>
          <ChoiceAnswer client={client} slug={slug} contest={contest} problem={p} value={value} onChange={change} blocked={blocked} onJudged={judged} />
        </div>
      )}
    </div>
  );
}

function ContestBanner({ nav, contest }: { readonly nav: Nav; readonly contest: NonNullable<Problem["contest"]> }) {
  const { t } = usePreferences();
  const now = useNow(true);
  return (
    <p className="contest-banner">
      <Trophy aria-hidden="true" />
      <Link nav={nav} to={`/contests/${contest.slug}`}>
        {contest.title}
      </Link>
      <span className="notice"> · {t("practice.endsIn", { time: span(Date.parse(contest.endsAt) - now) })}</span>
    </p>
  );
}

function Editorial({ problem }: { readonly problem: Problem }) {
  const { t } = usePreferences();
  const copy = { label: t("practice.copy"), done: t("practice.copied") };
  const [shown, setShown] = useState(0);
  const split = useMemo(() => (problem.editorial === null ? null : approachesOf(problem.editorial)), [problem.editorial]);
  if (split !== null) {
    const approach = split.approaches[Math.min(shown, split.approaches.length - 1)]!;
    return (
      <div className="approaches">
        {split.intro === "" ? null : <Markdown source={split.intro} copy={copy} />}
        <div className="problem-tabs" role="tablist" aria-label={t("practice.tab.editorial")}>
          {split.approaches.map((a, i) => (
            <button key={a.title} type="button" role="tab" aria-selected={a === approach} className={a === approach ? "tab on" : "tab"} onClick={() => setShown(i)}>
              {a.title}
            </button>
          ))}
        </div>
        <div role="tabpanel" aria-label={approach.title}>
          <Markdown source={approach.body} copy={copy} />
        </div>
      </div>
    );
  }
  if (problem.editorial !== null) return <Markdown source={problem.editorial} copy={copy} />;
  if (!problem.editorialLocked) return <p className="notice">{t("practice.noEditorial")}</p>;
  return (
    <div className="locked">
      <Lock aria-hidden="true" />
      <p>{problem.contest !== null ? t("practice.editorialContest") : t("practice.editorialLocked")}</p>
    </div>
  );
}

function Submissions({
  client,
  site,
  slug,
  contest,
  onLoad,
}: {
  readonly client: PracticeClient;
  readonly site: string;
  readonly slug: string;
  readonly contest: string | undefined;
  readonly onLoad: ((s: Submission) => void) | undefined;
}) {
  const { t } = usePreferences();
  const when = useWhen();
  const list = useQuery({ queryKey: ["practice", site, "submissions", slug, contest ?? null], queryFn: () => client.submissions(slug, contest) });
  const [open, setOpen] = useState<string | null>(null);
  if (list.isPending) return <p className="notice">{t("practice.loading")}</p>;
  if ((list.data ?? []).length === 0) return <p className="notice">{t("practice.noSubmissions")}</p>;
  return (
    <ul className="submissions">
      {list.data!.map((s) => (
        <li key={s.id} data-status={s.status}>
          <button type="button" className="submission-row" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
            <span className={`verdict ${s.status === "passed" ? "ok" : "bad"}`}>{t(`code.status.${s.status}` as MessageKey)}</span>
            <span className="notice">
              {s.language === null ? null : `${LANGUAGE_NAMES[s.language] ?? s.language} · `}
              {s.total > 0 ? `${s.passed}/${s.total} · ` : null}
              {s.timeMs === null ? null : `${s.timeMs} ms · `}
              {memory(s.memoryKb) === null ? null : `${memory(s.memoryKb)} · `}
              {when(s.createdAt)}
            </span>
            {s.inContest ? <span className="pill brand">{t("practice.inContest")}</span> : null}
          </button>
          {open === s.id ? (
            <div className="submission-code">
              <pre>{s.answer}</pre>
              {onLoad === undefined ? null : (
                <button type="button" className="secondary" onClick={() => onLoad(s)}>
                  {t("practice.loadCode")}
                </button>
              )}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Discussion({ client, nav, learner, site, slug, here }: Context & { readonly slug: string; readonly here: string }) {
  const { t } = usePreferences();
  const when = useWhen();
  const queryClient = useQueryClient();
  const comments = useQuery({ queryKey: ["practice", site, "comments", slug], queryFn: () => client.comments(slug) });
  const [text, setText] = useState("");
  const post = useMutation({
    mutationFn: () => client.comment(slug, text),
    onSuccess: async () => {
      setText("");
      await queryClient.invalidateQueries({ queryKey: ["practice", site, "comments", slug] });
    },
  });
  return (
    <div className="discussion">
      <p className="notice">{t("practice.discussionHint")}</p>
      {learner === null ? (
        <SignInNeeded nav={nav} next={here} />
      ) : (
        <form
          className="comment-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim() !== "") post.mutate();
          }}
        >
          <label className="field">
            <span className="visually-hidden">{t("practice.yourComment")}</span>
            <textarea placeholder={t("practice.yourComment")} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} />
          </label>
          {post.isError ? <p className="error">{messageOf(post.error, t("practice.commentFailed"))}</p> : null}
          <button type="submit" disabled={text.trim() === "" || post.isPending}>
            <MessageSquare aria-hidden="true" /> {t("practice.post")}
          </button>
        </form>
      )}
      {(comments.data ?? []).length === 0 ? (
        <p className="notice">{t("practice.noComments")}</p>
      ) : (
        <ul className="comments">
          {comments.data!.map((c) => (
            <li key={c.id} className={c.fromStaff ? "staff" : undefined}>
              <p className="comment-by">
                <span className="avatar-dot small" aria-hidden="true">
                  {c.authorName.slice(0, 1).toUpperCase()}
                </span>
                <strong>
                  <Who nav={nav} name={c.authorName} title={c.title} username={c.username} />
                </strong>
                {c.fromStaff ? (
                  <span className="pill brand">
                    <ShieldCheck aria-hidden="true" /> {t("practice.staff")}
                  </span>
                ) : null}
                <span className="notice">{when(c.createdAt)}</span>
              </p>
              <Markdown source={c.body} copy={{ label: t("practice.copy"), done: t("practice.copied") }} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChoiceAnswer({
  client,
  slug,
  contest,
  problem,
  value,
  onChange,
  blocked,
  onJudged,
}: {
  readonly client: PracticeClient;
  readonly slug: string;
  readonly contest: string | undefined;
  readonly problem: Problem;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly blocked: ReactNode;
  readonly onJudged: (verdict: Verdict) => void;
}) {
  const { t } = usePreferences();
  const submit = useMutation({
    mutationFn: () => client.submit(slug, value, undefined, contest),
    onSuccess: onJudged,
  });
  return (
    <section className="card choice-answer" aria-label={t("practice.yourAnswer")}>
      <h2>{t("practice.yourAnswer")}</h2>
      <AnswerInput question={problem.question} value={value} disabled={false} onChange={onChange} />
      {blocked ?? (
        <div className="row">
          <button type="button" className="submit" disabled={value.trim() === "" || submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending ? t("code.submitting") : t("code.submit")}
          </button>
        </div>
      )}
      {submit.data === undefined ? null : (
        <p className={`verdict ${submit.data.status === "passed" ? "ok" : "bad"}`} role="status">
          {submit.data.status === "passed" ? t("practice.correct") : t("practice.incorrect")}
        </p>
      )}
      {submit.isError ? <p className="error">{messageOf(submit.error, t("code.runFailed"))}</p> : null}
    </section>
  );
}

// --- progress -----------------------------------------------------------------------------------

function SolvedSummary({ progress, compact = false }: { readonly progress: Progress; readonly compact?: boolean }) {
  const { t } = usePreferences();
  return (
    <div className={`solved-summary${compact ? " compact" : ""}`}>
      <div className="solved-total">
        <strong className="num">{progress.solved.total}</strong>
        <span className="notice">/ {progress.available.total}</span>
        <span className="eyebrow">{t("practice.solved")}</span>
      </div>
      <dl className="by-difficulty">
        {(["easy", "medium", "hard"] as const).map((d) => (
          <div key={d} className={d}>
            <dt>{t(`practice.difficulty.${d}` as MessageKey)}</dt>
            <dd>
              <span className="num">
                {progress.solved[d]}/{progress.available[d]}
              </span>
              <span className="meter" aria-hidden="true">
                <span style={{ width: `${progress.available[d] === 0 ? 0 : (100 * progress.solved[d]) / progress.available[d]}%` }} />
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="streak">
        <Flame aria-hidden="true" /> {t("practice.streakN", { n: progress.streak })}
      </p>
    </div>
  );
}

/** Today in India Standard Time, as the server counts days. */
const istDay = (ms: number) => new Date(ms + 5.5 * 3_600_000).toISOString().slice(0, 10);
/** A year, as a column per week. */
const WEEKS = 53;

/** A phone shows the last 16 weeks; anything wider, the year. */
function useWeeks(): number {
  const query = "(max-width: 40rem)";
  const [narrow, setNarrow] = useState(() => typeof matchMedia === "function" && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const list = matchMedia(query);
    const change = () => setNarrow(list.matches);
    list.addEventListener("change", change);
    return () => list.removeEventListener("change", change);
  }, []);
  return narrow ? 16 : WEEKS;
}

function Heatmap({ days }: { readonly days: Progress["days"] }) {
  const { t, language } = usePreferences();
  const weeks = useWeeks();
  const byDay = new Map(days.map((d) => [d.day, d]));
  const today = Date.parse(`${istDay(Date.now())}T00:00:00Z`);
  // Columns are weeks ending with this one; rows are Monday to Sunday.
  const weekday = (new Date(today).getUTCDay() + 6) % 7;
  const start = today - (weekday + (weeks - 1) * 7) * 86_400_000;
  const cells = Array.from({ length: weeks * 7 }, (_x, i) => {
    const at = start + i * 86_400_000;
    const day = new Date(at).toISOString().slice(0, 10);
    const d = byDay.get(day);
    return { day, future: at > today, submitted: d?.submitted ?? 0, accepted: d?.accepted ?? 0 };
  });
  const level = (n: number) => (n === 0 ? 0 : n < 2 ? 1 : n < 4 ? 2 : n < 7 ? 3 : 4);
  const dayName = new Intl.DateTimeFormat(language === "en" ? "en-IN" : language, { day: "numeric", month: "short", timeZone: "UTC" });
  const active = days.filter((d) => d.submitted > 0);
  // The squares are a picture; what they say is said in words beside them.
  const said = (d: { day: string; submitted: number; accepted: number }) => t("practice.dayTitle", { day: dayName.format(Date.parse(`${d.day}T00:00:00Z`)), n: d.submitted, accepted: d.accepted });
  return (
    <figure className="heatmap">
      <div className="heatmap-grid" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
        {cells.map((c) => (c.future ? <span key={c.day} className="cell future" /> : <span key={c.day} className={`cell l${level(c.submitted)}`} title={said(c)} />))}
      </div>
      <figcaption>
        <span>{t("practice.activitySummary", { n: active.reduce((sum, d) => sum + d.submitted, 0), days: active.length })}</span>
        <span className="heatmap-key" aria-hidden="true">
          {t("practice.less")}
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={`cell l${l}`} />
          ))}
          {t("practice.more")}
        </span>
      </figcaption>
      {active.length === 0 ? null : (
        <ul className="visually-hidden">
          {active.map((d) => (
            <li key={d.day}>{said(d)}</li>
          ))}
        </ul>
      )}
    </figure>
  );
}

function ProgressPage({
  client,
  nav,
  site,
  learner,
  onSignOut,
  onDeleted,
}: Context & { readonly learner: Learner; readonly onSignOut: () => void; readonly onDeleted: () => void }) {
  const { t } = usePreferences();
  const when = useWhen();
  const progress = useQuery({ queryKey: ["practice", site, "progress", learner.id], queryFn: () => client.progress() });
  const remove = useMutation({ mutationFn: () => client.deleteAccount(), onSuccess: onDeleted });
  if (progress.data === undefined) return <p className="notice">{t("practice.loading")}</p>;
  const p = progress.data;
  const days = (n: number) => (n === 1 ? t("practice.oneDay") : t("practice.days", { n }));
  return (
    <div className="progress-page">
      <header className="progress-head">
        <span className="avatar-dot big" aria-hidden="true">
          {learner.name.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h1>{learner.name}</h1>
          <p className="notice">{learner.email}</p>
        </div>
        <span className="spacer" />
        <button type="button" className="secondary" onClick={onSignOut}>
          {t("practice.signOut")}
        </button>
      </header>
      <div className="progress-grid">
        <section className="card">
          <h2>{t("practice.solvedProblems")}</h2>
          <SolvedSummary progress={p} />
        </section>
        <section className="card figures-card">
          <dl className="figures">
            <div>
              <dt>{t("practice.rank")}</dt>
              <dd>{p.rank === null ? "—" : `#${p.rank}`}</dd>
            </div>
            <div>
              <dt>{t("practice.currentStreak")}</dt>
              <dd>{days(p.streak)}</dd>
            </div>
            <div>
              <dt>{t("practice.longestStreak")}</dt>
              <dd>{days(p.longestStreak)}</dd>
            </div>
            <div>
              <dt>{t("practice.activeDays")}</dt>
              <dd>{p.activeDays}</dd>
            </div>
          </dl>
        </section>
      </div>
      <section className="card">
        <h2>{t("practice.activity")}</h2>
        <Heatmap days={p.days} />
      </section>
      <section className="card">
        <h2>{t("practice.recent")}</h2>
        {p.recent.length === 0 ? (
          <p className="notice">
            {t("practice.nothingSolved")}{" "}
            <Link nav={nav} to="/problems">
              {t("practice.startSolving")}
            </Link>
          </p>
        ) : (
          <ul className="recent">
            {p.recent.map((r) => (
              <li key={r.slug}>
                <CircleCheck aria-hidden="true" className="standing solved" />
                <Link nav={nav} to={`/problems/${r.slug}`}>
                  {r.title}
                </Link>
                <span className="notice">{when(r.at, false)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card danger-zone">
        <h2>{t("practice.deleteAccount")}</h2>
        <p className="notice">{t("practice.deleteHint")}</p>
        <button
          type="button"
          className="danger"
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm(t("practice.deleteConfirm"))) remove.mutate();
          }}
        >
          {t("practice.deleteAccount")}
        </button>
      </section>
    </div>
  );
}

// --- the leaderboard -------------------------------------------------------------------------------

function LeaderboardPage({ client, nav, learner, site }: Context) {
  const { t } = usePreferences();
  const leaders = useQuery({ queryKey: ["practice", site, "leaderboard", learner?.id ?? null], queryFn: () => client.leaderboard() });
  return (
    <div className="leaderboard-page">
      <h1>{t("practice.leaderboard")}</h1>
      <p className="notice">{t("practice.leaderboardHint")}</p>
      <div className="card">
        {(leaders.data ?? []).length === 0 ? (
          <p className="notice empty">{leaders.isPending ? t("practice.loading") : t("practice.noLeaders")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col" className="num">
                  {t("practice.rank")}
                </th>
                <th scope="col">{t("practice.name")}</th>
                <th scope="col" className="num">
                  {t("practice.solved")}
                </th>
              </tr>
            </thead>
            <tbody>
              {leaders.data!.map((l) => (
                <tr key={`${l.rank}-${l.name}`} className={l.you ? "you" : undefined}>
                  <td className="num">{l.rank <= 3 ? <span className="rank-chip">{l.rank}</span> : l.rank}</td>
                  <td>
                    <Who nav={nav} name={l.name} title={l.title} username={l.username} />
                    {l.you ? <span className="pill brand">{t("practice.you")}</span> : null}
                  </td>
                  <td className="num">{l.solved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// --- contests -----------------------------------------------------------------------------------------

function ContestsPage({ client, nav, site }: Context) {
  const { t, language } = usePreferences();
  const when = useWhen();
  const contests = useQuery({ queryKey: ["practice", site, "contests"], queryFn: () => client.contests() });
  const now = useNow((contests.data ?? []).some((c) => c.state !== "ended"));
  const groups: [ContestSummary["state"], MessageKey][] = [
    ["running", "practice.running"],
    ["upcoming", "practice.upcoming"],
    ["ended", "practice.past"],
  ];
  const all = contests.data ?? [];
  return (
    <div className="contests-page">
      <h1>{t("practice.contests")}</h1>
      <p className="notice">
        {t("practice.contestsHint")}{" "}
        <Link nav={nav} to="/rating">
          {navWord(language, "rating")}
        </Link>
      </p>
      {all.length === 0 ? <p className="card notice empty">{contests.isPending ? t("practice.loading") : t("practice.noContests")}</p> : null}
      {groups.map(([state, label]) => {
        const list = all.filter((c) => c.state === state);
        if (list.length === 0) return null;
        return (
          <section key={state} className="contest-group">
            <h2>{t(label)}</h2>
            <ul className="contest-cards">
              {list.map((c) => (
                <li key={c.slug} className={`card contest-card ${c.state}`}>
                  <div className="contest-card-head">
                    <Link nav={nav} to={`/contests/${c.slug}`} className="contest-title">
                      {c.title}
                    </Link>
                    <ContestState state={c.state} />
                  </div>
                  <p className="notice">
                    {when(c.startsAt)} · {t("practice.minutes", { n: Math.round((Date.parse(c.endsAt) - Date.parse(c.startsAt)) / 60_000) })} ·{" "}
                    {t("practice.problemsN", { n: c.problems })}
                  </p>
                  {c.state === "upcoming" ? (
                    <p className="contest-countdown">{t("practice.startsIn", { time: span(Date.parse(c.startsAt) - now) })}</p>
                  ) : c.state === "running" ? (
                    <p className="contest-countdown live">{t("practice.endsIn", { time: span(Date.parse(c.endsAt) - now) })}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Live, Upcoming or Ended: a dot only on what is happening now. */
function ContestState({ state }: { readonly state: ContestSummary["state"] }) {
  const { t } = usePreferences();
  return state === "running" ? (
    <span className="pill live">{t("practice.live")}</span>
  ) : state === "upcoming" ? (
    <span className="pill info">{t("practice.upcoming")}</span>
  ) : (
    <span className="pill">{t("practice.ended")}</span>
  );
}

function ContestPage({ client, nav, learner, site, slug }: Context & { readonly slug: string }) {
  const { t } = usePreferences();
  const when = useWhen();
  const queryClient = useQueryClient();
  const contest = useQuery({
    queryKey: ["practice", site, "contest", slug, learner?.id ?? null],
    queryFn: () => client.contest(slug),
    refetchInterval: (query) => ((query.state.data as Contest | undefined)?.state === "running" ? 30_000 : false),
  });
  const now = useNow(contest.data !== undefined && contest.data.state !== "ended");
  // The moment it starts or ends, fetch it again: the problems appear, or the board is final.
  const boundary = contest.data === undefined ? null : contest.data.state === "upcoming" ? Date.parse(contest.data.startsAt) : contest.data.state === "running" ? Date.parse(contest.data.endsAt) : null;
  useEffect(() => {
    if (boundary !== null && now >= boundary) void queryClient.invalidateQueries({ queryKey: ["practice", site, "contest", slug] });
  }, [boundary, now, queryClient, site, slug]);

  if (contest.isPending) return <p className="notice">{t("practice.loading")}</p>;
  if (contest.isError) return <p className="card error">{t("practice.noContest")}</p>;
  const c = contest.data;
  // The first to solve each problem: the least minutes among those who did.
  const firsts = c.problems.map((_p, i) => {
    const times = c.scoreboard.map((row) => row.problems[i]?.minutes).filter((m): m is number => m !== null && m !== undefined);
    return times.length === 0 ? null : Math.min(...times);
  });
  return (
    <div className="contest-page">
      <div className="crumbs">
        <Link nav={nav} to="/contests">
          ← {t("practice.contests")}
        </Link>
      </div>
      <header className="contest-head">
        <div>
          <h1>{c.title}</h1>
          <p className="notice">
            {when(c.startsAt)} – {when(c.endsAt)}
          </p>
        </div>
        <span className="spacer" />
        <div className="contest-when">
          <ContestState state={c.state} />
          {c.state === "upcoming" ? (
            <p className="contest-countdown big">{t("practice.startsIn", { time: span(Date.parse(c.startsAt) - now) })}</p>
          ) : c.state === "running" ? (
            <p className="contest-countdown big live">{t("practice.endsIn", { time: span(Date.parse(c.endsAt) - now) })}</p>
          ) : null}
        </div>
      </header>
      {c.description.trim() === "" ? null : (
        <div className="card">
          <Markdown source={c.description} />
        </div>
      )}
      <section className="card">
        <h2>{t("practice.problems")}</h2>
        {c.state === "upcoming" ? (
          <p className="notice">{t("practice.problemsAtStart")}</p>
        ) : (
          <table>
            <tbody>
              {c.problems.map((p) => (
                <tr key={p.slug}>
                  <td className="label-col">
                    <strong>{p.label}</strong>
                  </td>
                  <td>
                    <Link nav={nav} to={`/problems/${p.slug}${c.state === "running" ? `?contest=${encodeURIComponent(c.slug)}` : ""}`} className="problem-link">
                      {p.title}
                    </Link>
                  </td>
                  <td>
                    <DifficultyPill difficulty={p.difficulty} />
                  </td>
                  <td className="status-col">
                    <StandingIcon status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {c.state === "running" && learner === null ? <SignInNeeded nav={nav} next={`/contests/${c.slug}`} /> : null}
      </section>
      {c.state === "upcoming" ? null : (
        <section className="card scoreboard" aria-label={t("practice.scoreboard")}>
          <h2>{t("practice.scoreboard")}</h2>
          <p className="notice">{t("practice.scoreboardHint")}</p>
          {c.scoreboard.length === 0 ? (
            <p className="notice empty">{t("practice.noEntries")}</p>
          ) : (
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col" className="num sticky-rank">
                      {t("practice.rank")}
                    </th>
                    <th scope="col" className="sticky-name">
                      {t("practice.name")}
                    </th>
                    <th scope="col" className="num">
                      {t("practice.solved")}
                    </th>
                    <th scope="col" className="num">
                      {t("practice.penalty")}
                    </th>
                    {c.problems.map((p) => (
                      <th key={p.slug} scope="col" className="num">
                        {p.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.scoreboard.map((row) => (
                    <tr key={`${row.rank}-${row.name}`} className={row.you ? "you" : undefined}>
                      <td className="num sticky-rank">{row.rank}</td>
                      <td className="sticky-name">
                        <Who nav={nav} name={row.name} title={row.title} username={row.username} />
                        {row.you ? <span className="pill brand">{t("practice.you")}</span> : null}
                      </td>
                      <td className="num">{row.solved}</td>
                      <td className="num">{row.penalty}</td>
                      {row.problems.map((cell, i) => {
                        const first = cell.minutes !== null && cell.minutes === firsts[i];
                        return (
                          <td key={i} className={`num cell-${cell.minutes !== null ? (first ? "first" : "ok") : cell.wrong > 0 ? "bad" : "none"}`} title={first ? t("practice.firstSolve") : undefined}>
                            {cell.minutes !== null ? (
                              <>
                                <span aria-hidden="true">
                                  <strong>{cell.wrong === 0 ? "+" : `+${cell.wrong}`}</strong>
                                  <span className="minutes"> {cell.minutes}′</span>
                                </span>
                                <span className="visually-hidden">
                                  {first ? `${t("practice.firstSolve")}: ` : ""}
                                  {t("practice.cellSolved", { minutes: cell.minutes, wrong: cell.wrong })}
                                </span>
                              </>
                            ) : cell.wrong > 0 ? (
                              <>
                                <span aria-hidden="true">−{cell.wrong}</span>
                                <span className="visually-hidden">{t("practice.cellTried", { wrong: cell.wrong })}</span>
                              </>
                            ) : (
                              ""
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// --- accounts ---------------------------------------------------------------------------------------

function AccountForm({
  client,
  nav,
  mode,
  next,
  onSignedIn,
  google,
}: Context & {
  readonly mode: "signin" | "signup";
  readonly next: string | undefined;
  readonly onSignedIn: (token: string, next: string | undefined) => void;
  readonly google: boolean;
}) {
  const { t } = usePreferences();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const send = useMutation({
    mutationFn: () => (mode === "signup" ? client.signUp(name, email, password) : client.signIn(email, password)),
    onSuccess: (session) => onSignedIn(session.token, next),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    send.mutate();
  };
  const error =
    send.error instanceof ApiError
      ? send.error.code === "sign_in_failed"
        ? t("practice.signInFailed")
        : send.error.code === "email_taken"
          ? t("practice.emailTaken")
          : messageOf(send.error, t("practice.tryAgain"))
      : send.isError
        ? t("practice.tryAgain")
        : null;
  const other = mode === "signup" ? "/signin" : "/signup";
  return (
    <div className="account-page">
      <form className="card account-form" onSubmit={submit} aria-labelledby="account-title">
        <h1 id="account-title">{mode === "signup" ? t("practice.createAccount") : t("practice.welcomeBack")}</h1>
        <p className="notice">{mode === "signup" ? t("practice.signUpHint") : t("practice.signInHint")}</p>
        {google ? (
          <>
            <a className="button secondary google" href={client.googleUrl}>
              {t("practice.withGoogle")}
            </a>
            <p className="or" aria-hidden="true">
              <span>{t("practice.or")}</span>
            </p>
          </>
        ) : null}
        {mode === "signup" ? (
          <label className="field">
            <span>{t("practice.name")}</span>
            <input autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        ) : null}
        <label className="field">
          <span>{t("practice.email")}</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>{t("practice.password")}</span>
          <input
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={mode === "signup" ? 12 : 1}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "signup" ? <span className="notice hint">{t("practice.passwordHint")}</span> : null}
        </label>
        {error === null ? null : (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={send.isPending}>
          {mode === "signup" ? t("practice.signUp") : t("practice.signIn")}
        </button>
        <p className="notice switch">
          {mode === "signup" ? t("practice.haveAccount") : t("practice.newHere")}{" "}
          <Link nav={nav} to={next === undefined ? other : `${other}?next=${encodeURIComponent(next)}`}>
            {mode === "signup" ? t("practice.signIn") : t("practice.signUp")}
          </Link>
        </p>
      </form>
    </div>
  );
}
