import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import {
  Bot,
  BookOpenCheck,
  Building,
  Building2,
  ChevronRight,
  ClipboardList,
  Gauge,
  GraduationCap,
  School,
  TrendingUp,
  BriefcaseBusiness,
  KeyRound,
  KeySquare,
  LayoutDashboard,
  LockKeyhole,
  Library,
  LogOut,
  Plug,
  Receipt,
  ScrollText,
  Search,
  Shield,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Avatar, Wordmark } from "@parikshaa/brand/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Exam, Question } from "@parikshaa/core/browser";
import { ConsoleClient, ConsoleError, type WhoAmI } from "./api.ts";
import { AccountPanel, ApiKeysPanel, AuditPanel, StaffPanel, UsagePanel } from "./components/Admin.tsx";
import { BankPanel } from "./components/Bank.tsx";
import { Candidates } from "./components/Candidates.tsx";
import { ReportPanel, ResultsPanel } from "./components/Results.tsx";
import { IntegrationsPanel } from "./components/Integrations.tsx";
import { PrivacyPanel } from "./components/Privacy.tsx";
import { BillingPanel } from "./components/Billing.tsx";
import { LivePanel } from "./components/Live.tsx";
import { AttemptList, StartAttemptDialog } from "./components/AttemptList.tsx";
import { AttemptReview } from "./components/AttemptReview.tsx";
import { ExamEditor } from "./components/ExamEditor.tsx";
import { ExamList, type ExamFilter } from "./components/ExamList.tsx";
import { ExamHeader, ExamOverview, ExamSide, ExamTabs, NextStep, QuestionsTab, type ExamTab } from "./components/ExamPage.tsx";
import { Banner, PageFrame, SkeletonRows } from "./components/kit.tsx";
import { CommandPalette, useCommandKey, type PageLink } from "./components/CommandPalette.tsx";
import { TryTest } from "./components/Preview.tsx";
import { Home } from "./components/Home.tsx";
import { Gallery } from "./components/Gallery.tsx";
import { Dialog, ToastProvider, useToast } from "@parikshaa/brand/ui";
import { ThemeSwitch, useTheme, type Theme } from "./components/ThemeSwitch.tsx";
import { useConsoleLanguage } from "./language.ts";
import { OrgSignInPanel, TwoFactorPanel } from "./components/Security.tsx";
import { remembered, SignIn } from "./components/SignIn.tsx";

/** The practice site's admin is opened by few, so it loads when opened. */
/** The tour, taken once or twice by each account, likewise. */
const ConsoleTour = lazy(() => import("./components/Tour.tsx"));
const InsightsPanel = lazy(() => import("./components/Insights.tsx").then((m) => ({ default: m.InsightsPanel })));
const PaperReview = lazy(() => import("./components/PaperReview.tsx").then((m) => ({ default: m.PaperReview })));
const Arrangements = lazy(() => import("./components/Arrangements.tsx").then((m) => ({ default: m.Arrangements })));
const LibraryPanel = lazy(() => import("./components/Library.tsx").then((m) => ({ default: m.LibraryPanel })));
const OperatorPanel = lazy(() => import("./components/Operator.tsx").then((m) => ({ default: m.OperatorPanel })));
const ClassesPanel = lazy(() => import("./components/Classes.tsx").then((m) => ({ default: m.ClassesPanel })));
const AiInterviewsPanel = lazy(() => import("./components/AiInterviews.tsx").then((m) => ({ default: m.AiInterviewsPanel })));
const InterviewsPanel = lazy(() => import("./components/Interviews.tsx").then((m) => ({ default: m.InterviewsPanel })));
const PlacementPanel = lazy(() => import("./components/Placement.tsx").then((m) => ({ default: m.PlacementPanel })));
const JobTestDrawer = lazy(() => import("./components/JobTest.tsx").then((m) => ({ default: m.JobTestDrawer })));
const PracticePanel = lazy(() => import("./components/Practice.tsx").then((m) => ({ default: m.PracticePanel })));

type View =
  | { readonly name: "home" }
  | { readonly name: "gallery" }
  | { readonly name: "exams"; readonly filter?: ExamFilter }
  | { readonly name: "editor"; readonly examId: string | null }
  | { readonly name: "attempts"; readonly examId: string }
  | { readonly name: "questions"; readonly examId: string }
  | { readonly name: "review"; readonly examId: string; readonly attemptId: string }
  | { readonly name: "bank" }
  | { readonly name: "practice" }
  | { readonly name: "insights" }
  | { readonly name: "placement" }
  | { readonly name: "interviews" }
  | { readonly name: "ai-interviews" }
  | { readonly name: "classes" }
  | { readonly name: "candidates"; readonly examId: string }
  | { readonly name: "results"; readonly examId: string }
  | { readonly name: "live"; readonly examId: string }
  | { readonly name: "report"; readonly examId: string; readonly attemptId: string }
  | { readonly name: "staff" }
  | { readonly name: "keys" }
  | { readonly name: "usage" }
  | { readonly name: "audit" }
  | { readonly name: "integrations" }
  | { readonly name: "privacy" }
  | { readonly name: "billing" }
  | { readonly name: "signin" }
  | { readonly name: "companies" }
  | { readonly name: "library" }
  | { readonly name: "account" };

/**
 * The session token, kept for this tab only.
 *
 * sessionStorage rather than localStorage: it ends with the tab, so a shared
 * machine in an exam hall does not stay signed in. Storage can be unavailable
 * (private windows, blocked site data), in which case a reload signs out.
 */
const SESSION_KEY = "parikshaa.console.session";
/** Set by signing up, for this tab only: the console opens with its tour, once. */
const TOUR_KEY = "parikshaa.console.tour";
const tourPending = {
  take: (): boolean => {
    try {
      const pending = sessionStorage.getItem(TOUR_KEY) === "1";
      sessionStorage.removeItem(TOUR_KEY);
      return pending;
    } catch {
      return false;
    }
  },
  set: (): void => {
    try {
      sessionStorage.setItem(TOUR_KEY, "1");
    } catch {
      // No tour on arriving; it is a button away on Home.
    }
  },
};
const stored = {
  get: (): string | null => {
    try {
      return sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string | null): void => {
    try {
      if (token === null) sessionStorage.removeItem(SESSION_KEY);
      else sessionStorage.setItem(SESSION_KEY, token);
    } catch {
      // Unavailable; the session lives in memory only.
    }
  },
};

/**
 * What the address bar brought: a session from the organisation's sign-in
 * provider (in the fragment, which no server logs), a provider's refusal, a
 * password reset link, or the link that confirms a new owner's address. Each is taken once and cleared from the address bar.
 */
function arrival(): { sso: string | null; ssoError: string | null; reset: string | null; verify: string | null } {
  if (typeof window === "undefined") return { sso: null, ssoError: null, reset: null, verify: null };
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const found = { sso: hash.get("sso"), ssoError: query.get("sso_error"), reset: query.get("reset"), verify: query.get("verify") };
  if (found.sso !== null || found.ssoError !== null || found.reset !== null || found.verify !== null) {
    window.history.replaceState(null, "", window.location.pathname);
  }
  return found;
}

export function App({ client: injected }: { client?: ConsoleClient } = {}) {
  const queryClient = useQueryClient();
  const [theme, setTheme] = useTheme();
  const [arrived] = useState(arrival);
  const [token, setToken] = useState<string | null>(() => {
    if (injected !== undefined) return null;
    if (arrived.sso !== null) {
      stored.set(arrived.sso);
      return arrived.sso;
    }
    return stored.get();
  });
  const client = injected ?? (token === null ? null : new ConsoleClient(token));
  // A new owner's confirmation link: opened once, signed in or not.
  const [verified, setVerified] = useState<"pending" | "done" | string | null>(arrived.verify === null ? null : "pending");
  useEffect(() => {
    if (arrived.verify === null) return;
    ConsoleClient.verifyEmail(arrived.verify).then(
      () => {
        setVerified("done");
        void queryClient.invalidateQueries({ queryKey: ["me"] });
      },
      (error: unknown) => setVerified(error instanceof ConsoleError && error.detail !== undefined ? error.detail : "This link could not be checked. Try again."),
    );
  }, [arrived.verify, queryClient]);

  const signIn = (next: string, fresh = false) => {
    stored.set(next);
    if (fresh) tourPending.set();
    setToken(next);
  };
  const signOut = () => {
    stored.set(null);
    setToken(null);
    // Nothing the last account could see should flash up for the next one.
    queryClient.clear();
  };

  if (client === null) return <SignIn onSignedIn={signIn} resetToken={arrived.reset} ssoError={arrived.ssoError} emailVerified={verified} />;
  return (
    <ToastProvider>
      <Console client={client} onSignedOut={signOut} theme={theme} onTheme={setTheme} arrivedBySso={arrived.sso !== null} emailVerified={verified} />
    </ToastProvider>
  );
}

function Console({
  client,
  onSignedOut,
  theme,
  onTheme,
  arrivedBySso = false,
  emailVerified = null,
}: {
  client: ConsoleClient;
  onSignedOut: () => void;
  theme: Theme;
  onTheme: (next: Theme) => void;
  /** This session came from the organisation's own sign-in provider. */
  arrivedBySso?: boolean;
  /** What opening a confirmation link on arrival came to: "done", a refusal's words, or still "pending". */
  emailVerified?: string | null;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [language, setLanguage, t] = useConsoleLanguage();
  useEffect(() => {
    if (emailVerified === null || emailVerified === "pending") return;
    if (emailVerified === "done") {
      toast("Your email address is confirmed. You can invite candidates and colleagues now.", "success");
    } else toast(emailVerified, "error");
  }, [emailVerified, toast]);
  // `?report=<attempt>` opens one candidate's report: the link webhooks and Greenhouse carry.
  const [view, setView] = useState<View>(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.has("gallery")) return { name: "gallery" };
    const report = query.get("report");
    if (report === null || report === "") return { name: "home" };
    window.history.replaceState(null, "", window.location.pathname);
    return { name: "report", examId: "", attemptId: report };
  });
  // Opened with a confirmation link, the account is read once the link is checked, not alongside it.
  const me = useQuery({ queryKey: ["me"], queryFn: () => client.me(), enabled: emailVerified !== "pending" });
  // Signed in through the organisation's provider: next time, offer it first, by name.
  const cameBySso = arrivedBySso;
  useEffect(() => {
    if (cameBySso && me.data !== undefined) remembered.setSsoOrg({ id: me.data.organisation.id, name: me.data.organisation.name });
  }, [cameBySso, me.data]);
  const can = (permission: string) => me.data?.permissions.includes(permission) ?? false;

  // A session that has ended — expired, revoked, the account disabled — shows
  // up as a 401 on whatever is asked next. Go back to signing in.
  const lastError = me.error;
  useEffect(() => {
    if (lastError instanceof ConsoleError && lastError.status === 401) onSignedOut();
  }, [lastError, onSignedOut]);

  const signOut = useMutation({
    mutationFn: () => client.signOut().catch(() => undefined),
    onSettled: onSignedOut,
  });
  const [issued, setIssued] = useState<{ candidateId: string; token: string } | null>(null);
  const [problems, setProblems] = useState<ConsoleError["problems"]>([]);

  const exams = useQuery({ queryKey: ["exams"], queryFn: () => client.listExams() });
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: () => client.dashboard(), enabled: view.name === "home" });

  const editing = useQuery({
    queryKey: ["exam", view.name === "editor" ? view.examId : null],
    queryFn: () => client.loadExam((view as { examId: string }).examId),
    enabled: view.name === "editor" && view.examId !== null,
  });

  const attempts = useQuery({
    queryKey: ["attempts", view.name === "attempts" || view.name === "review" ? view.examId : null],
    queryFn: () => client.listAttempts((view as { examId: string }).examId),
    enabled: view.name === "attempts" || view.name === "review",
    // Keeps "here / last seen" current while an invigilator watches the room.
    refetchInterval: view.name === "attempts" ? 30_000 : false,
  });

  const review = useQuery({
    queryKey: ["review", view.name === "review" ? view.attemptId : null],
    queryFn: () => client.review((view as { attemptId: string }).attemptId),
    enabled: view.name === "review",
  });
  // The answers beside the evidence: the scorecard's, for an account that may read it.
  const reviewAnswers = useQuery({
    queryKey: ["report", view.name === "review" ? view.attemptId : null],
    queryFn: () => client.report((view as { attemptId: string }).attemptId),
    enabled: view.name === "review" && can("attempt:review"),
    retry: false,
  });
  const reviewPlayback = useQuery({
    queryKey: ["playback", view.name === "review" ? view.attemptId : null],
    queryFn: () => client.playback((view as { attemptId: string }).attemptId),
    enabled: view.name === "review" && can("attempt:read"),
    retry: false,
  });

  const saveExam = useMutation({
    mutationFn: (exam: Exam) => client.saveExam(exam),
    onSuccess: async (_, exam) => {
      setProblems([]);
      toast(`Saved “${exam.title}”`, "success");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["exams"] }),
        // The exam page reads the paper and its results; both follow the edit.
        queryClient.invalidateQueries({ queryKey: ["exam"] }),
        queryClient.invalidateQueries({ queryKey: ["results"] }),
      ]);
      setEditorDirty(false);
      setView({ name: "exams" });
    },
    // The server validates independently of the client; if it disagrees, show
    // exactly what it objected to rather than a generic failure.
    onError: (error) =>
      setProblems(
        error instanceof ConsoleError && error.code === "exam_frozen"
          ? [{ path: "exam", message: "This exam has been sat, so it can no longer be changed. Make a copy from the exam list and edit that." }]
          : error instanceof ConsoleError
            ? error.problems
            : [],
      ),
  });

  const cloneExam = useMutation({
    mutationFn: (examId: string) => {
      const id = `${examId}-copy-${Date.now().toString(36)}`;
      return client.cloneExam(examId, id).then(() => id);
    },
    onSuccess: async (id) => {
      toast("Copy made. Change it, then save.", "success");
      await queryClient.invalidateQueries({ queryKey: ["exams"] });
      setProblems([]);
      setView({ name: "editor", examId: id });
    },
  });

  // The sample exam (see Home's welcome).
  const [touring, setTouring] = useState(tourPending.take);
  const loadSample = useMutation({
    mutationFn: () => client.loadSample(),
    onSuccess: async () => {
      toast("The sample exam is in: try it as a candidate, or open it to look around.", "success");
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["dashboard"] }), queryClient.invalidateQueries({ queryKey: ["exams"] })]);
    },
    onError: () => toast("The sample exam could not be loaded. Try again.", "error"),
  });
  const loadStarter = useMutation({
    mutationFn: () => client.loadStarter(),
    onSuccess: async ({ added }) => {
      toast(added > 0 ? `${added} starter questions are in the bank. Now choose a role.` : "The starter questions are already in the bank.", "success");
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast("The starter questions could not be added. Try again.", "error"),
  });
  const removeSample = useMutation({
    mutationFn: () => client.removeSample(),
    onSuccess: async () => {
      toast("The sample exam is put away.", "success");
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["dashboard"] }), queryClient.invalidateQueries({ queryKey: ["exams"] })]);
    },
    onError: () => toast("The sample exam could not be put away. Try again.", "error"),
  });

  const archiveExam = useMutation({
    mutationFn: ({ examId, archived }: { examId: string; archived: boolean }) => client.archiveExam(examId, archived),
    onSuccess: async (_, { examId, archived }) => {
      toast(archived ? `Archived “${examTitle(examId)}”` : `Brought back “${examTitle(examId)}”`, "success");
      await queryClient.invalidateQueries({ queryKey: ["exams"] });
    },
  });

  const startAttempt = useMutation({
    mutationFn: ({ examId, candidateId }: { examId: string; candidateId: string }) =>
      client.startAttempt(examId, candidateId).then((r) => ({ ...r, candidateId })),
    onSuccess: async (result) => {
      setIssued({ candidateId: result.candidateId, token: result.token });
      await queryClient.invalidateQueries({ queryKey: ["attempts"] });
    },
  });

  const grade = useMutation({
    mutationFn: (attemptId: string) => client.grade(attemptId),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });

  const voidAttempt = useMutation({
    mutationFn: ({ attemptId, reason }: { attemptId: string; reason: string }) =>
      client.voidAttempt(attemptId, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });

  const assess = useMutation({
    mutationFn: ({ attemptId, probeId }: { attemptId: string; probeId: string }) =>
      client.assess(attemptId, probeId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["review"] });
    },
  });

  const examTitle = (id: string) => exams.data?.find((e) => e.id === id)?.title ?? id;
  /** Sat by anyone, and so no longer editable: changed by copying. */
  const frozen = (id: string) => {
    const c = exams.data?.find((e) => e.id === id)?.attempts;
    return c !== undefined && c.inProgress + c.submitted + c.graded + c.void > 0;
  };

  // The exam page: its definition for the questions tab and the side panel,
  // and its results for who qualified.
  const pageExamId =
    (view.name === "attempts" || view.name === "questions" || view.name === "candidates" || view.name === "live" || view.name === "results") && view.examId !== ""
      ? view.examId
      : null;
  // The whole paper, for the questions tab, the side panel and Try test from any tab.
  const examDefinition = useQuery({
    queryKey: ["exam", pageExamId],
    queryFn: () => client.loadExam(pageExamId!),
    enabled: pageExamId !== null && (view.name === "attempts" || view.name === "questions" || can("exam:read_key")),
  });
  const examResults = useQuery({
    queryKey: ["results", pageExamId],
    queryFn: () => client.results(pageExamId!),
    enabled: pageExamId !== null && view.name === "attempts" && can("attempt:review"),
  });
  const [trying, setTrying] = useState(false);
  const [fromJob, setFromJob] = useState(false);
  const [startingDirect, setStartingDirect] = useState(false);
  const [searching, setSearching] = useState(false);
  useCommandKey(useCallback(() => setSearching(true), []));
  const actionFailure = [grade.error, assess.error, voidAttempt.error].find((e) => e !== null);

  const tabs: readonly {
    readonly view: View;
    readonly label: string;
    readonly permission: string;
    readonly group: "assess" | "org";
    readonly icon: LucideIcon;
  }[] = [
    { view: { name: "bank" }, label: "Question bank", permission: "exam:read_key", group: "assess", icon: Library },
    { view: { name: "library" }, label: "Parikshaa Library", permission: "exam:read_key", group: "assess", icon: BookOpenCheck },
    { view: { name: "insights" }, label: "Insights", permission: "attempt:review", group: "assess", icon: TrendingUp },
    { view: { name: "placement" }, label: "Placement", permission: "attempt:review", group: "assess", icon: BriefcaseBusiness },
    { view: { name: "interviews" }, label: "Interviews", permission: "attempt:review", group: "assess", icon: Video },
    { view: { name: "ai-interviews" }, label: "AI interviews", permission: "attempt:review", group: "assess", icon: Bot },
    { view: { name: "classes" }, label: "Classes", permission: "exam:read", group: "assess", icon: School },
    { view: { name: "practice" }, label: "Practice", permission: "exam:read_key", group: "assess", icon: GraduationCap },
    { view: { name: "staff" }, label: "Staff", permission: "staff:manage", group: "org", icon: Users },
    { view: { name: "keys" }, label: "API keys", permission: "apikey:manage", group: "org", icon: KeySquare },
    { view: { name: "usage" }, label: "Spend", permission: "usage:read", group: "org", icon: Gauge },
    { view: { name: "audit" }, label: "Audit log", permission: "audit:read", group: "org", icon: ScrollText },
    { view: { name: "integrations" }, label: "Integrations", permission: "org:manage", group: "org", icon: Plug },
    { view: { name: "privacy" }, label: "Privacy", permission: "org:manage", group: "org", icon: Shield },
    { view: { name: "billing" }, label: "Billing", permission: "org:manage", group: "org", icon: Receipt },
    { view: { name: "signin" }, label: "Sign-in", permission: "org:manage", group: "org", icon: LockKeyhole },
  ];

  const section = SECTION_OF[view.name];
  // An exam with unsaved changes asks before it is left.
  const [editorDirty, setEditorDirty] = useState(false);
  const [leaving, setLeaving] = useState<View | null>(null);
  const go = (next: View) => {
    if (view.name === "editor" && editorDirty) {
      setLeaving(next);
      return;
    }
    setView(next);
    window.scrollTo?.({ top: 0 });
  };
  const navItem = (target: View, label: string, Icon: LucideIcon) => (
    <button
      key={label}
      type="button"
      className={`nav-item${section === target.name ? " active" : ""}`}
      aria-current={section === target.name ? "page" : undefined}
      data-tour={target.name}
      onClick={() => go(target)}
    >
      <Icon aria-hidden="true" />
      {t(label)}
    </button>
  );
  const visible = tabs.filter((tab) => can(tab.permission));
  const onExam =
    (view.name === "attempts" ||
      view.name === "questions" ||
      view.name === "review" ||
      view.name === "candidates" ||
      view.name === "results" ||
      view.name === "live" ||
      view.name === "report") &&
    view.examId !== "";

  // An owner their organisation requires to use two-step sign-in, who has not
  // set it up, can do only that: the server refuses everything else anyway.
  if (me.data?.mustEnrol2fa === true) {
    return (
      <main className="content enrol">
        <header className="page-head">
          <Wordmark size={28} product="Console" />
          <h1>Set up two-step sign-in</h1>
          <p className="notice">{me.data.organisation.name} requires owners to use it before continuing.</p>
        </header>
        <TwoFactorPanel client={client} onSignedOut={onSignedOut} onEnrolled={() => void queryClient.invalidateQueries({ queryKey: ["me"] })} />
        <div className="row">
          <button type="button" className="secondary" onClick={() => signOut.mutate()}>
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-inner">
          <div className="sidebar-brand">
            <Wordmark size={30} product="Console" />
          </div>
          {me.data === undefined ? null : (
            <div className="org">
              <span className="org-badge" aria-hidden="true">
                <Building2 />
              </span>
              <span className="org-text">
                <span className="org-name">{me.data.organisation.name}</span>
                {me.data.organisation.publicId === undefined || me.data.organisation.publicId === "" ? null : (
                  <span className="org-id" title="Your Company ID: quote it when you write to Parikshaa">
                    {me.data.organisation.publicId}
                  </span>
                )}
              </span>
            </div>
          )}
          <nav className="side-nav account" aria-label="Account">
            {navItem({ name: "home" }, "Home", LayoutDashboard)}
            <p className="nav-group">{t("Assess")}</p>
            {navItem({ name: "exams" }, "Exams", ClipboardList)}
            {visible.filter((tab) => tab.group === "assess").map((tab) => navItem(tab.view, tab.label, tab.icon))}
            {visible.some((tab) => tab.group === "org") ? <p className="nav-group">{t("Organisation")}</p> : null}
            {visible.filter((tab) => tab.group === "org").map((tab) => navItem(tab.view, tab.label, tab.icon))}
            {me.data?.operator === true ? (
              <>
                <p className="nav-group">Parikshaa</p>
                {navItem({ name: "companies" }, "Companies", Building)}
              </>
            ) : null}
            <div className="sidebar-foot">
              {me.data === undefined ? null : (
                <div className="me">
                  <Avatar name={me.data.name} size={34} />
                  <span className="me-text">
                    <span className="me-name">{me.data.name}</span>
                    <span className="me-role">{me.data.role}</span>
                  </span>
                </div>
              )}
              <div className="me-actions">
                {me.data?.kind === "user" ? navItem({ name: "account" }, "Account", KeyRound) : null}
                <button type="button" className="nav-item" onClick={() => signOut.mutate()}>
                  <LogOut aria-hidden="true" />
                  {t("Sign out")}
                </button>
              </div>
            </div>
          </nav>
        </div>
      </aside>

      <div className="main">
        <header className="topbar crumbs">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            {view.name === "exams" ? (
              <span>Exams</span>
            ) : section === "exams" ? (
              <button type="button" className="crumb" onClick={() => go({ name: "exams" })}>
                Exams
              </button>
            ) : (
              <span>{visible.find((tab) => tab.view.name === section)?.label ?? OTHER_PAGES[section] ?? ""}</span>
            )}
            {onExam ? (
              <>
                <ChevronRight aria-hidden="true" />
                {view.name === "attempts" ? (
                  <span>{examTitle(view.examId)}</span>
                ) : (
                  <button type="button" className="crumb" onClick={() => go({ name: "attempts", examId: view.examId })}>
                    {examTitle(view.examId)}
                  </button>
                )}
                {view.name === "report" ? (
                  <>
                    <ChevronRight aria-hidden="true" />
                    <button type="button" className="crumb" onClick={() => go({ name: "results", examId: view.examId })}>
                      Results
                    </button>
                  </>
                ) : null}
              </>
            ) : null}
          </nav>
          <span className="spacer" />
          <button type="button" className="search-trigger" data-tour="search" onClick={() => setSearching(true)} aria-keyshortcuts="Control+K">
            <Search aria-hidden="true" />
            <span>{t("Search")}</span>
            <kbd>Ctrl K</kbd>
          </button>
          <button
            type="button"
            className="quiet language-switch"
            lang={language === "hi" ? "en" : "hi"}
            aria-label={language === "hi" ? "Show the console in English" : "कंसोल हिन्दी में दिखाएँ"}
            onClick={() => setLanguage(language === "hi" ? "en" : "hi")}
          >
            {language === "hi" ? "English" : "हिन्दी"}
          </button>
          <ThemeSwitch theme={theme} onChange={onTheme} />
        </header>
        {searching ? (
          <CommandPalette
            client={client}
            exams={exams.data ?? []}
            canSearchCandidates={can("attempt:read")}
            pages={[
              { label: "Home", go: () => go({ name: "home" }) },
              { label: "Exams", go: () => go({ name: "exams" }) },
              ...visible.map((tab): PageLink => ({ label: tab.label, go: () => go(tab.view) })),
              ...(me.data?.kind === "user" ? [{ label: "Account", go: () => go({ name: "account" }) }] : []),
              { label: "Design system", go: () => go({ name: "gallery" }) },
            ]}
            actions={[
              ...(can("exam:write")
                ? [
                    {
                      label: "New exam",
                      go: () => {
                        setProblems([]);
                        go({ name: "editor", examId: null });
                      },
                    },
                    {
                      label: "New test from a job",
                      go: () => {
                        go({ name: "exams" });
                        setFromJob(true);
                      },
                    },
                  ]
                : []),
              ...(can("attempt:start")
                ? [{ label: "Invite candidates", go: () => go(pageExamId === null ? { name: "exams" } : { name: "candidates", examId: pageExamId }) }]
                : []),
              ...(can("exam:read_key") ? [{ label: "Find a question in the bank", go: () => go({ name: "bank" }) }] : []),
            ]}
            onExam={(examId) => go({ name: "attempts", examId })}
            onCandidate={(hit) =>
              go(
                hit.attemptId !== null && can("attempt:review")
                  ? { name: "report", examId: hit.examId, attemptId: hit.attemptId }
                  : { name: "candidates", examId: hit.examId },
              )
            }
            onClose={() => setSearching(false)}
          />
        ) : null}

        <main className="content">
          {me.data?.emailVerified === false && me.data.email !== null && emailVerified !== "done" ? <ConfirmEmail client={client} email={me.data.email} /> : null}
          <PageFrame title={t(pageTitle(view, examTitle))} note={t(PAGE_NOTE[view.name])}>
            {view.name === "home" ? (
              <Home
                dashboard={dashboard.data}
                exams={exams.data ?? []}
                name={me.data?.name}
                canWrite={can("exam:write")}
                onExam={(examId) => go({ name: "attempts", examId })}
                onExams={(filter) => go({ name: "exams", filter })}
                onTour={() => setTouring(true)}
                canBuy={can("org:manage")}
                {...(can("attempt:grade") ? { onResults: (examId: string) => go({ name: "results", examId }) } : {})}
                {...(can("exam:write")
                  ? {
                      sample: {
                        onLoad: () => loadSample.mutate(),
                        onTry: (examId: string) => {
                          go({ name: "attempts", examId });
                          setTrying(true);
                        },
                        onOpen: (examId: string) => go({ name: "attempts", examId }),
                        onRemove: () => removeSample.mutate(),
                        busy: loadSample.isPending || removeSample.isPending,
                      },
                      starter: { onLoad: () => loadStarter.mutate(), busy: loadStarter.isPending },
                    }
                  : {})}
                onGo={(target) => {
                  if (target === "search") return setSearching(true);
                  if (target === "job-test") return setFromJob(true);
                  if (target === "new-exam") {
                    setProblems([]);
                    return go({ name: "editor", examId: null });
                  }
                  go({ name: target });
                }}
              />
            ) : null}
            {view.name === "gallery" ? <Gallery /> : null}

            {view.name === "exams" ? (
              exams.isPending ? (
                <section className="card">
                  <SkeletonRows columns={6} label="Loading exams…" />
                </section>
              ) : exams.error !== null ? (
                <Banner tone="danger" title="Could not load exams.">
                  Check the connection, then reload the page.
                </Banner>
              ) : (
                <ExamList
                  key={view.filter ?? "all"}
                  exams={exams.data}
                  initialFilter={view.filter ?? "all"}
                  canWrite={can("exam:write")}
                  onClone={(examId) => cloneExam.mutate(examId)}
                  {...(can("exam:read_key")
                    ? {
                        onTry: (examId: string) => {
                          go({ name: "attempts", examId });
                          setTrying(true);
                        },
                      }
                    : {})}
                  onArchive={(examId, archived) => archiveExam.mutate({ examId, archived })}
                  onOpen={(examId) => go({ name: "attempts", examId })}
                  onEdit={(examId) => {
                    setProblems([]);
                    go({ name: "editor", examId });
                  }}
                  onNew={() => {
                    setProblems([]);
                    go({ name: "editor", examId: null });
                  }}
                  onFromJob={() => setFromJob(true)}
                />
              )
            ) : null}

            {view.name === "editor" && view.examId !== null && editing.data === undefined ? (
              editing.error === null ? (
                <section className="card">
                  <SkeletonRows rows={6} columns={3} label="Loading the exam…" />
                </section>
              ) : (
                <Banner tone="danger" title="Could not load the exam." />
              )
            ) : null}
            {view.name === "editor" && (view.examId === null || editing.data !== undefined) ? (
              <ExamEditor
                {...(editing.data === undefined ? {} : { initial: editing.data })}
                saving={saveExam.isPending}
                serverProblems={problems}
                onSave={(exam) => saveExam.mutate(exam)}
                onCancel={() => go({ name: "exams" })}
                onDirtyChange={setEditorDirty}
                {...(can("exam:read_key") ? { loadBank: (filter) => client.listBank(filter) } : {})}
                {...(can("exam:write") ? { uploadImage: (file: File) => client.uploadImage(file) } : {})}
                {...(can("exam:write") ? { checkReference: (q: Question, language: string, source: string) => client.checkReference(q, language, source) } : {})}
              />
            ) : null}

            {pageExamId !== null ? (
              <>
                <ExamHeader
                  summary={exams.data?.find((e) => e.id === pageExamId)}
                  frozen={frozen(pageExamId)}
                  quiet={view.name === "results"}
                  actions={{
                    ...(can("exam:read_key") ? { onTry: () => setTrying(true) } : {}),
                    ...(can("attempt:start") && view.name !== "candidates" ? { onInvite: () => go({ name: "candidates", examId: pageExamId }) } : {}),
                    ...(can("attempt:start")
                      ? {
                          onStartDirect: () => {
                            setIssued(null);
                            startAttempt.reset();
                            setStartingDirect(true);
                          },
                        }
                      : {}),
                    ...(can("exam:write")
                      ? {
                          onEdit: () => {
                            setProblems([]);
                            go({ name: "editor", examId: pageExamId });
                          },
                          onCopy: () => cloneExam.mutate(pageExamId),
                          onArchive: (archived: boolean) => archiveExam.mutate({ examId: pageExamId, archived }),
                        }
                      : {}),
                  }}
                />
                <ExamTabs current={view.name as ExamTab} canReview={can("attempt:review")} onGo={(tab) => go({ name: tab, examId: pageExamId })} />
              </>
            ) : null}

            {view.name === "questions" ? (
              examDefinition.data === undefined ? (
                examDefinition.error === null ? (
                  <section className="card">
                    <SkeletonRows rows={5} columns={3} label="Loading the questions…" />
                  </section>
                ) : (
                  <Banner tone="danger" title="Could not load the exam." />
                )
              ) : (
                <QuestionsTab
                  exam={examDefinition.data}
                  frozen={frozen(view.examId)}
                  {...(can("exam:write")
                    ? { onEdit: () => (frozen(view.examId) ? cloneExam.mutate(view.examId) : setView({ name: "editor", examId: view.examId })) }
                    : {})}
                />
              )
            ) : null}
            {trying && examDefinition.data !== undefined ? <TryTest exam={examDefinition.data} onClose={() => setTrying(false)} /> : null}
            {touring && me.data !== undefined ? (
              <Suspense fallback={null}>
                <ConsoleTour can={can} onClose={() => setTouring(false)} />
              </Suspense>
            ) : null}
            {startingDirect && pageExamId !== null ? (
              <StartAttemptDialog
                starting={startAttempt.isPending}
                issued={issued}
                error={startAttempt.error === null ? null : startAttempt.error instanceof ConsoleError ? (startAttempt.error.detail ?? startAttempt.error.message) : startAttempt.error.message}
                onStart={(candidateId) => startAttempt.mutate({ examId: pageExamId, candidateId })}
                onClose={() => {
                  setStartingDirect(false);
                  setIssued(null);
                }}
              />
            ) : null}

            {view.name === "candidates" ? <Candidates client={client} examId={view.examId} canInvite={can("attempt:start")} /> : null}
            {view.name === "candidates" && can("attempt:extend") ? (
              <Suspense fallback={null}>
                <Arrangements client={client} examId={view.examId} />
              </Suspense>
            ) : null}

            {view.name === "results" ? (
              <ResultsPanel
                client={client}
                examId={view.examId}
                canGrade={can("attempt:grade")}
                canRelease={can("attempt:review")}
                onReport={(attemptId) => setView({ name: "report", examId: view.examId, attemptId })}
              />
            ) : null}
            {view.name === "report" ? <ReportPanel client={client} attemptId={view.attemptId} canErase={can("org:manage")} organisation={me.data?.organisation.name} /> : null}
            {view.name === "live" ? <LivePanel client={client} examId={view.examId} canIntervene={can("attempt:extend")} canConfigure={can("exam:write")} /> : null}

            {view.name === "attempts" ? (
              <ExamOverview
                side={
                  <ExamSide
                    summary={exams.data?.find((e) => e.id === view.examId)}
                    exam={examDefinition.data}
                    results={examResults.data}
                    {...(can("attempt:review") ? { onResults: () => go({ name: "results", examId: view.examId }) } : {})}
                  />
                }
              >
                <NextStep
                  summary={exams.data?.find((e) => e.id === view.examId)}
                  {...(can("attempt:start")
                    ? { onSchedule: () => go({ name: "candidates", examId: view.examId }), onInvite: () => go({ name: "candidates", examId: view.examId }) }
                    : {})}
                  {...(can("attempt:review") ? { onGrade: () => go({ name: "results", examId: view.examId }) } : {})}
                />
                <Suspense fallback={null}>
                  <PaperReview client={client} examId={view.examId} selfId={me.data?.id ?? null} canWrite={can("exam:write")} canReopen={can("org:manage")} />
                </Suspense>
                {attempts.data === undefined ? (
                  attempts.error === null ? (
                    <section className="card">
                      <SkeletonRows columns={4} label="Loading attempts…" />
                    </section>
                  ) : (
                    <Banner tone="danger" title="Could not load the attempts." />
                  )
                ) : (
                  <AttemptList
                    attempts={attempts.data}
                    canReview={can("attempt:review")}
                    {...(can("attempt:start") ? { onInvite: () => go({ name: "candidates", examId: view.examId }) } : {})}
                    {...(can("attempt:extend")
                      ? {
                          onExtend: async (attemptId: string, minutes: number, reason: string) => {
                            await client.extendTime(attemptId, minutes, reason);
                            await queryClient.invalidateQueries({ queryKey: ["attempts"] });
                            toast("Extra time given", "success");
                          },
                        }
                      : {})}
                    onReview={(attemptId) => setView({ name: "review", examId: view.examId, attemptId })}
                  />
                )}
              </ExamOverview>
            ) : null}

            {view.name === "review" ? (
              review.data === undefined ? (
                review.error === null ? (
                  <section className="card">
                    <SkeletonRows rows={5} columns={2} label="Loading the attempt…" />
                  </section>
                ) : (
                  <Banner tone="danger" title="Could not load the attempt." />
                )
              ) : (
                <AttemptReview
                  attemptId={view.attemptId}
                  review={review.data}
                  grading={grade.isPending}
                  assessing={assess.isPending ? assess.variables.probeId : null}
                  voiding={voidAttempt.isPending}
                  onGrade={() => grade.mutate(view.attemptId)}
                  onAssess={(probeId) => assess.mutate({ attemptId: view.attemptId, probeId })}
                  onVoid={(reason) => voidAttempt.mutate({ attemptId: view.attemptId, reason })}
                  can={{ grade: can("attempt:grade"), assess: can("attempt:assess"), void: can("attempt:void") }}
                  failure={actionFailure === undefined ? null : actionFailure.message}
                  answers={reviewAnswers.data}
                  playback={reviewPlayback.data}
                />
              )
            ) : null}

            {view.name === "bank" ? <BankPanel client={client} canWrite={can("exam:write")} /> : null}
            {view.name === "insights" ? (
              <Suspense fallback={<SkeletonRows rows={5} columns={3} label="Loading insights…" />}>
                <InsightsPanel client={client} />
              </Suspense>
            ) : null}
            {view.name === "placement" ? (
              <Suspense fallback={<SkeletonRows rows={5} columns={4} label="Loading placement…" />}>
                <PlacementPanel client={client} canInvite={can("attempt:start")} />
              </Suspense>
            ) : null}
            {view.name === "interviews" ? (
              <Suspense fallback={<SkeletonRows rows={5} columns={4} label="Loading interviews…" />}>
                <InterviewsPanel client={client} />
              </Suspense>
            ) : null}
            {view.name === "ai-interviews" ? (
              <Suspense fallback={<SkeletonRows rows={5} columns={4} label="Loading AI interviews…" />}>
                <AiInterviewsPanel client={client} canWrite={can("exam:write")} />
              </Suspense>
            ) : null}
            {view.name === "classes" ? (
              <Suspense fallback={<SkeletonRows rows={5} columns={4} label="Loading classes…" />}>
                <ClassesPanel client={client} canWrite={can("exam:write")} />
              </Suspense>
            ) : null}
            {view.name === "practice" ? (
              <Suspense fallback={<SkeletonRows rows={5} columns={3} label="Loading the practice site…" />}>
                <PracticePanel client={client} can={{ manage: can("org:manage"), write: can("exam:write"), readLearners: can("attempt:read"), review: can("attempt:review") }} />
              </Suspense>
            ) : null}
            {view.name === "staff" && me.data !== undefined ? <StaffPanel client={client} selfId={me.data.id} /> : null}
            {view.name === "keys" ? <ApiKeysPanel client={client} /> : null}
            {view.name === "usage" ? <UsagePanel client={client} canSetCap={can("org:manage")} /> : null}
            {view.name === "audit" ? <AuditPanel client={client} /> : null}
            {view.name === "integrations" ? <IntegrationsPanel client={client} /> : null}
            {view.name === "privacy" ? <PrivacyPanel client={client} /> : null}
            {view.name === "billing" ? <BillingPanel client={client} /> : null}
            {view.name === "library" ? (
              <Suspense fallback={<SkeletonRows rows={6} columns={5} label="Loading the library…" />}>
                <LibraryPanel client={client} canWrite={can("exam:write")} />
              </Suspense>
            ) : null}
            {view.name === "companies" && me.data?.operator === true ? (
              <Suspense fallback={<SkeletonRows rows={5} columns={6} label="Loading organisations…" />}>
                <OperatorPanel client={client} />
              </Suspense>
            ) : null}
            {view.name === "signin" && me.data !== undefined ? (
              <div className="settings-page-groups">
                <OrgSignInPanel client={client} orgId={me.data.organisation.id} />
              </div>
            ) : null}
            {view.name === "account" ? (
              <div className="settings-page-groups">
                <AccountPanel client={client} onSignedOut={onSignedOut} />
                <TwoFactorPanel client={client} onSignedOut={onSignedOut} />
              </div>
            ) : null}
          </PageFrame>
          {fromJob ? (
            <Suspense fallback={null}>
              <JobTestDrawer
                client={client}
                onClose={() => setFromJob(false)}
                onCreated={(examId) => {
                  setFromJob(false);
                  setProblems([]);
                  go({ name: "editor", examId });
                }}
              />
            </Suspense>
          ) : null}
          {leaving === null ? null : (
            <Dialog label="Leave without saving?" onClose={() => setLeaving(null)}>
              <h2 className="dialog-title">Leave without saving?</h2>
              <p className="notice">The changes to this exam have not been saved, and will be lost.</p>
              <div className="dialog-actions">
                <button type="button" className="quiet" onClick={() => setLeaving(null)}>
                  Keep editing
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    const next = leaving;
                    setLeaving(null);
                    setEditorDirty(false);
                    setView(next);
                    window.scrollTo?.({ top: 0 });
                  }}
                >
                  Leave without saving
                </button>
              </div>
            </Dialog>
          )}
        </main>
      </div>
    </div>
  );
}

/** Which sidebar entry a view belongs under. */
const SECTION_OF: Record<View["name"], View["name"]> = {
  home: "home",
  gallery: "gallery",
  exams: "exams",
  editor: "exams",
  attempts: "exams",
  questions: "exams",
  review: "exams",
  candidates: "exams",
  results: "exams",
  live: "exams",
  report: "exams",
  bank: "bank",
  practice: "practice",
  insights: "insights",
  placement: "placement",
  interviews: "interviews",
  "ai-interviews": "ai-interviews",
  classes: "classes",
  staff: "staff",
  keys: "keys",
  usage: "usage",
  audit: "audit",
  integrations: "integrations",
  privacy: "privacy",
  billing: "billing",
  signin: "signin",
  companies: "companies",
  library: "library",
  account: "account",
};

function pageTitle(view: View, examTitle: (id: string) => string): string {
  switch (view.name) {
    case "home":
      return "Home";
    case "gallery":
      return "Design system";
    case "exams":
      return "Exams";
    case "editor":
      return view.examId === null ? "New exam" : "Edit exam";
    case "attempts":
    case "questions":
      return examTitle(view.examId);
    case "review":
      return "Review an attempt";
    case "candidates":
    case "results":
    case "live":
      return view.examId === "" ? PAGE_FALLBACK[view.name] : examTitle(view.examId);
    case "report":
      return "Scorecard";
    case "bank":
      return "Question bank";
    case "practice":
      return "Practice";
    case "insights":
      return "Insights";
    case "placement":
      return "Placement";
    case "interviews":
      return "Interviews";
    case "ai-interviews":
      return "AI interviews";
    case "classes":
      return "Classes";
    case "staff":
      return "Staff";
    case "keys":
      return "API keys";
    case "usage":
      return "Spend";
    case "audit":
      return "Audit log";
    case "integrations":
      return "Integrations";
    case "privacy":
      return "Privacy";
    case "billing":
      return "Billing";
    case "companies":
      return "Companies";
    case "library":
      return "Parikshaa Library";
    case "signin":
      return "Sign-in";
    case "account":
      return "Account";
  }
}

const PAGE_FALLBACK = { candidates: "Schedule and invite", results: "Results and exports", live: "Live sitting" } as const;

/** One line under each page's title: what the page is for. */
/** Breadcrumb labels for the pages not in the sidebar's permission-gated list. */
const OTHER_PAGES: Partial<Record<View["name"], string>> = { home: "Home", gallery: "Design system", account: "Account" };

const PAGE_NOTE: Record<View["name"], string> = {
  home: "What is sitting now and next, what has just happened, and what is left to set up.",
  gallery: "Parikshaa's design system: colour, type, and every shared component, live.",
  exams: "Every assessment your organisation runs. Open one to invite candidates, watch a sitting or read results.",
  editor: "Questions, sections drawn per candidate, timing, and what the camera does. A sat exam is frozen; copy it to change it.",
  attempts: "Everyone who has started this exam, whether they are here now, and what is left to grade.",
  questions: "The paper as candidates will see it. Preview any question, or try the whole test; nothing is recorded.",
  review: "The grade, and beside it the evidence — kept apart, and decided by a person.",
  candidates: "The window the test is open, and who is invited to it.",
  results: "Scores, the spread, and what the follow-ups found. Download for your own records.",
  live: "Who is here, who has gone quiet, and anything that needs an invigilator.",
  report: "One candidate's result, sections, standing and answers, with the follow-ups apart. Ready to print or save as a PDF.",
  bank: "Questions filed by topic and difficulty, to draw exams from. Import from a spreadsheet or a Word paper.",
  practice: "A practice site for your learners: problems from the bank, contests, and their progress. Nothing there is an exam.",
  insights: "Candidates across every test, lined up by roll number, and the questions worth a second look.",
  placement: "Your students, entered once, and every company's drive: who is eligible, the test, each round and the offers.",
  interviews: "Interviews with a video call and a shared code editor: watch the candidate type, keep notes, score it.",
  "ai-interviews": "A first round by chat, held by the AI for a role: read the transcript and its evidence, and decide.",
  classes: "A cohort of your students, the course they work through, their tests and contests, and attendance: each student on a line.",
  staff: "Who can sign in to this console, and what each can do.",
  keys: "Keys for your own systems to call Parikshaa.",
  usage: "What the AI model has cost this month, and the cap on it.",
  audit: "Every action taken in this organisation, by whom and when.",
  integrations: "Webhooks and applicant-tracking systems that hear about results.",
  privacy: "The notice candidates agree to, how long their data is kept, and erasure.",
  billing: "Attempt credits, payments and GST invoices.",
  library: "Questions written by Parikshaa — CS fundamentals, programming, DSA coding and SQL — to copy into your bank.",
  companies: "Every company and college on Parikshaa by its Company ID: open one with its owner, pause it, give credits.",
  signin: "How your staff sign in: your institution's own provider, and two-step sign-in for owners.",
  account: "Your password and two-step sign-in.",
};

/**
 * Until a new owner opens the link sent to their address: what waits for it,
 * and the link again on asking.
 */
function ConfirmEmail({ client, email }: { client: ConsoleClient; email: string }) {
  const resend = useMutation({ mutationFn: () => client.resendVerification() });
  return (
    <div className="confirm-email">
      <Banner
        tone="warning"
        title="Confirm your email address"
        action={
          resend.isSuccess ? (
            <span className="notice" role="status">
              Sent. Check your inbox and spam folder.
            </span>
          ) : (
            <button type="button" className="secondary" disabled={resend.isPending} onClick={() => resend.mutate()}>
              {resend.isPending ? "Sending…" : "Send the link again"}
            </button>
          )
        }
      >
        We sent a link to {email}. Until you open it you can write and try exams, but not invite candidates, add colleagues or issue API keys.
        {resend.error === null ? null : (
          <span className="error">
            {" "}
            {resend.error instanceof ConsoleError && resend.error.status === 429 ? "It was sent a moment ago; wait a minute before asking again." : "It could not be sent. Try again."}
          </span>
        )}
      </Banner>
    </div>
  );
}
