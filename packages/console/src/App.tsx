import { useEffect, useState } from "react";
import {
  Building2,
  ChevronRight,
  ClipboardList,
  Gauge,
  GraduationCap,
  KeyRound,
  KeySquare,
  LockKeyhole,
  Library,
  LogOut,
  Plug,
  Receipt,
  ScrollText,
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
import { AttemptList } from "./components/AttemptList.tsx";
import { AttemptReview } from "./components/AttemptReview.tsx";
import { ExamEditor } from "./components/ExamEditor.tsx";
import { ExamList } from "./components/ExamList.tsx";
import { OrgSignInPanel, TwoFactorPanel } from "./components/Security.tsx";
import { SignIn } from "./components/SignIn.tsx";

type View =
  | { readonly name: "exams" }
  | { readonly name: "editor"; readonly examId: string | null }
  | { readonly name: "attempts"; readonly examId: string }
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
  return <Console client={client} onSignedOut={signOut} />;
}

function Console({ client, onSignedOut }: { client: ConsoleClient; onSignedOut: () => void }) {
  const queryClient = useQueryClient();
  // `?report=<attempt>` opens one candidate's report: the link webhooks and Greenhouse carry.
  const [view, setView] = useState<View>(() => {
    const report = new URLSearchParams(window.location.search).get("report");
    if (report === null || report === "") return { name: "exams" };
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

  const saveExam = useMutation({
    mutationFn: (exam: Exam) => client.saveExam(exam),
    onSuccess: async () => {
      setProblems([]);
      await queryClient.invalidateQueries({ queryKey: ["exams"] });
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
      await queryClient.invalidateQueries({ queryKey: ["exams"] });
      setProblems([]);
      setView({ name: "editor", examId: id });
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
              <span>{visible.find((tab) => tab.view.name === section)?.label ?? (section === "account" ? "Account" : "")}</span>
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
        </header>

        <main className="content">
          <header className="page-head">
            <h1>{pageTitle(view, examTitle)}</h1>
            <p className="notice">{PAGE_NOTE[view.name]}</p>
          </header>

      {view.name === "exams" ? (
        exams.isPending ? (
          <p className="notice">Loading…</p>
        ) : exams.error !== null ? (
          <p className="error">Could not load exams.</p>
        ) : (
          <ExamList
            exams={exams.data}
            canWrite={can("exam:write")}
            onClone={(examId) => cloneExam.mutate(examId)}
            onOpen={(examId) => {
              setIssued(null);
              setView({ name: "attempts", examId });
            }}
            onEdit={(examId) => setView({ name: "editor", examId })}
            onNew={() => {
              setProblems([]);
              setView({ name: "editor", examId: null });
            }}
          />
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

      {view.name === "attempts" ? (
        <div className="row" style={{ marginTop: 0, marginBottom: ".85rem" }}>
          <button type="button" className="secondary" onClick={() => setView({ name: "candidates", examId: view.examId })}>
            Schedule and invite candidates
          </button>
          <button type="button" className="secondary" onClick={() => setView({ name: "live", examId: view.examId })}>
            Live sitting
          </button>
          {can("attempt:review") ? (
            <button type="button" className="secondary" onClick={() => setView({ name: "results", examId: view.examId })}>
              Results and exports
            </button>
          ) : null}
        </div>
      ) : null}

      {view.name === "candidates" ? (
        <Candidates client={client} examId={view.examId} canInvite={can("attempt:start")} />
      ) : null}

      {view.name === "results" ? (
        <ResultsPanel
          client={client}
          examId={view.examId}
          onReport={(attemptId) => setView({ name: "report", examId: view.examId, attemptId })}
        />
      ) : null}
      {view.name === "report" ? <ReportPanel client={client} attemptId={view.attemptId} canErase={can("org:manage")} /> : null}
      {view.name === "live" ? <LivePanel client={client} examId={view.examId} canIntervene={can("attempt:extend")} /> : null}

      {view.name === "attempts" && attempts.data !== undefined ? (
        <AttemptList
          attempts={attempts.data}
          issued={issued}
          starting={startAttempt.isPending}
          canStart={can("attempt:start")}
          canReview={can("attempt:review")}
          {...(can("attempt:extend")
            ? {
                onExtend: async (attemptId: string, minutes: number, reason: string) => {
                  await client.extendTime(attemptId, minutes, reason);
                  await queryClient.invalidateQueries({ queryKey: ["attempts"] });
                },
              }
            : {})}
          onStart={(candidateId) => startAttempt.mutate({ examId: view.examId, candidateId })}
          onReview={(attemptId) => setView({ name: "review", examId: view.examId, attemptId })}
        />
      ) : null}

      {view.name === "review" && review.data !== undefined ? (
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
        />
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
        </main>
      </div>
    </div>
  );
}

/** Which sidebar entry a view belongs under. */
const SECTION_OF: Record<View["name"], View["name"]> = {
  exams: "exams",
  editor: "exams",
  attempts: "exams",
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
    case "exams":
      return "Exams";
    case "editor":
      return view.examId === null ? "New exam" : "Edit exam";
    case "attempts":
      return examTitle(view.examId);
    case "review":
      return "Review an attempt";
    case "candidates":
      return "Schedule and invite";
    case "results":
      return "Results and exports";
    case "live":
      return "Live sitting";
    case "report":
      return "Candidate report";
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

/** One line under each page's title: what the page is for. */
const PAGE_NOTE: Record<View["name"], string> = {
  exams: "Every assessment your organisation runs. Open one to invite candidates, watch a sitting or read results.",
  editor: "Questions, sections drawn per candidate, timing, and what the camera does. A sat exam is frozen; copy it to change it.",
  attempts: "Everyone who has started this exam, whether they are here now, and what is left to grade.",
  review: "The grade, and beside it the evidence — kept apart, and decided by a person.",
  candidates: "The window the test is open, and who is invited to it.",
  results: "Scores, the spread, and what the follow-ups found. Download for your own records.",
  live: "Who is here, who has gone quiet, and anything that needs an invigilator.",
  report: "One candidate's answers, grades and record, ready to print.",
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
