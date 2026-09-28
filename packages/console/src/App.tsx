import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  ChevronRight,
  ClipboardList,
  Gauge,
  GraduationCap,
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
  type LucideIcon,
} from "lucide-react";
import { Avatar, Wordmark } from "@parikshaa/brand/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Exam } from "@parikshaa/core/browser";
import { ConsoleClient, ConsoleError } from "./api.ts";
import { AccountPanel, ApiKeysPanel, AuditPanel, StaffPanel, UsagePanel } from "./components/Admin.tsx";
import { BankPanel } from "./components/Bank.tsx";
import { Candidates } from "./components/Candidates.tsx";
import { ReportPanel, ResultsPanel } from "./components/Results.tsx";
import { IntegrationsPanel } from "./components/Integrations.tsx";
import { PrivacyPanel } from "./components/Privacy.tsx";
import { PracticePanel } from "./components/Practice.tsx";
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
import { ToastProvider, useToast } from "@parikshaa/brand/ui";
import { ThemeSwitch, useTheme, type Theme } from "./components/ThemeSwitch.tsx";
import { OrgSignInPanel, TwoFactorPanel } from "./components/Security.tsx";
import { SignIn } from "./components/SignIn.tsx";

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
  | { readonly name: "account" };

/**
 * The session token, kept for this tab only.
 *
 * sessionStorage rather than localStorage: it ends with the tab, so a shared
 * machine in an exam hall does not stay signed in. Storage can be unavailable
 * (private windows, blocked site data), in which case a reload signs out.
 */
const SESSION_KEY = "parikshaa.console.session";
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
 * provider (in the fragment, which no server logs), a provider's refusal, or a
 * password reset link. Each is taken once and cleared from the address bar.
 */
function arrival(): { sso: string | null; ssoError: string | null; reset: string | null } {
  if (typeof window === "undefined") return { sso: null, ssoError: null, reset: null };
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const found = { sso: hash.get("sso"), ssoError: query.get("sso_error"), reset: query.get("reset") };
  if (found.sso !== null || found.ssoError !== null || found.reset !== null) {
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

  const signIn = (next: string) => {
    stored.set(next);
    setToken(next);
  };
  const signOut = () => {
    stored.set(null);
    setToken(null);
    // Nothing the last account could see should flash up for the next one.
    queryClient.clear();
  };

  if (client === null) return <SignIn onSignedIn={signIn} resetToken={arrived.reset} ssoError={arrived.ssoError} />;
  return (
    <ToastProvider>
      <Console client={client} onSignedOut={signOut} theme={theme} onTheme={setTheme} />
    </ToastProvider>
  );
}

function Console({
  client,
  onSignedOut,
  theme,
  onTheme,
}: {
  client: ConsoleClient;
  onSignedOut: () => void;
  theme: Theme;
  onTheme: (next: Theme) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  // `?report=<attempt>` opens one candidate's report: the link webhooks and Greenhouse carry.
  const [view, setView] = useState<View>(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.has("gallery")) return { name: "gallery" };
    const report = query.get("report");
    if (report === null || report === "") return { name: "home" };
    window.history.replaceState(null, "", window.location.pathname);
    return { name: "report", examId: "", attemptId: report };
  });
  const me = useQuery({ queryKey: ["me"], queryFn: () => client.me() });
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
  const go = (next: View) => {
    setView(next);
    window.scrollTo?.({ top: 0 });
  };
  const navItem = (target: View, label: string, Icon: LucideIcon) => (
    <button
      key={label}
      type="button"
      className={`nav-item${section === target.name ? " active" : ""}`}
      aria-current={section === target.name ? "page" : undefined}
      onClick={() => go(target)}
    >
      <Icon aria-hidden="true" />
      {label}
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
              <span className="org-name">{me.data.organisation.name}</span>
            </div>
          )}
          <nav className="side-nav account" aria-label="Account">
            {navItem({ name: "home" }, "Home", LayoutDashboard)}
            <p className="nav-group">Assess</p>
            {navItem({ name: "exams" }, "Exams", ClipboardList)}
            {visible.filter((tab) => tab.group === "assess").map((tab) => navItem(tab.view, tab.label, tab.icon))}
            {visible.some((tab) => tab.group === "org") ? <p className="nav-group">Organisation</p> : null}
            {visible.filter((tab) => tab.group === "org").map((tab) => navItem(tab.view, tab.label, tab.icon))}
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
                  Sign out
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
          <button type="button" className="search-trigger" onClick={() => setSearching(true)} aria-keyshortcuts="Control+K">
            <Search aria-hidden="true" />
            <span>Search</span>
            <kbd>Ctrl K</kbd>
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
          <PageFrame title={pageTitle(view, examTitle)} note={PAGE_NOTE[view.name]}>
            {view.name === "home" ? (
              <Home
                dashboard={dashboard.data}
                exams={exams.data ?? []}
                name={me.data?.name}
                canWrite={can("exam:write")}
                onExam={(examId) => go({ name: "attempts", examId })}
                onExams={(filter) => go({ name: "exams", filter })}
                onGo={(target) => {
                  if (target === "search") return setSearching(true);
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
                onCancel={() => setView({ name: "exams" })}
                {...(can("exam:read_key") ? { loadBank: (filter) => client.listBank(filter) } : {})}
                {...(can("exam:write") ? { uploadImage: (file: File) => client.uploadImage(file) } : {})}
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

            {view.name === "results" ? (
              <ResultsPanel client={client} examId={view.examId} onReport={(attemptId) => setView({ name: "report", examId: view.examId, attemptId })} />
            ) : null}
            {view.name === "report" ? <ReportPanel client={client} attemptId={view.attemptId} canErase={can("org:manage")} organisation={me.data?.organisation.name} /> : null}
            {view.name === "live" ? <LivePanel client={client} examId={view.examId} canIntervene={can("attempt:extend")} /> : null}

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
                />
              )
            ) : null}

            {view.name === "bank" ? <BankPanel client={client} canWrite={can("exam:write")} /> : null}
            {view.name === "practice" ? (
              <PracticePanel client={client} can={{ manage: can("org:manage"), write: can("exam:write"), readLearners: can("attempt:read"), review: can("attempt:review") }} />
            ) : null}
            {view.name === "staff" && me.data !== undefined ? <StaffPanel client={client} selfId={me.data.id} /> : null}
            {view.name === "keys" ? <ApiKeysPanel client={client} /> : null}
            {view.name === "usage" ? <UsagePanel client={client} canSetCap={can("org:manage")} /> : null}
            {view.name === "audit" ? <AuditPanel client={client} /> : null}
            {view.name === "integrations" ? <IntegrationsPanel client={client} /> : null}
            {view.name === "privacy" ? <PrivacyPanel client={client} /> : null}
            {view.name === "billing" ? <BillingPanel client={client} /> : null}
            {view.name === "signin" && me.data !== undefined ? <OrgSignInPanel client={client} orgId={me.data.organisation.id} /> : null}
            {view.name === "account" ? (
              <>
                <AccountPanel client={client} onSignedOut={onSignedOut} />
                <TwoFactorPanel client={client} onSignedOut={onSignedOut} />
              </>
            ) : null}
          </PageFrame>
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
  staff: "staff",
  keys: "keys",
  usage: "usage",
  audit: "audit",
  integrations: "integrations",
  privacy: "privacy",
  billing: "billing",
  signin: "signin",
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
  staff: "Who can sign in to this console, and what each can do.",
  keys: "Keys for your own systems to call Parikshaa.",
  usage: "What the AI model has cost this month, and the cap on it.",
  audit: "Every action taken in this organisation, by whom and when.",
  integrations: "Webhooks and applicant-tracking systems that hear about results.",
  privacy: "The notice candidates agree to, how long their data is kept, and erasure.",
  billing: "Attempt credits, payments and GST invoices.",
  signin: "How your staff sign in: your institution's own provider, and two-step sign-in for owners.",
  account: "Your password and two-step sign-in.",
};
