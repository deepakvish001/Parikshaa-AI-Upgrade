import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Exam } from "@parikshaa/core/browser";
import { ConsoleClient, ConsoleError } from "./api.ts";
import { AccountPanel, ApiKeysPanel, AuditPanel, StaffPanel, UsagePanel } from "./components/Admin.tsx";
import { BankPanel } from "./components/Bank.tsx";
import { Candidates } from "./components/Candidates.tsx";
import { ReportPanel, ResultsPanel } from "./components/Results.tsx";
import { IntegrationsPanel } from "./components/Integrations.tsx";
import { LivePanel } from "./components/Live.tsx";
import { AttemptList } from "./components/AttemptList.tsx";
import { AttemptReview } from "./components/AttemptReview.tsx";
import { ExamEditor } from "./components/ExamEditor.tsx";
import { ExamList } from "./components/ExamList.tsx";

type View =
  | { readonly name: "exams" }
  | { readonly name: "editor"; readonly examId: string | null }
  | { readonly name: "attempts"; readonly examId: string }
  | { readonly name: "review"; readonly examId: string; readonly attemptId: string }
  | { readonly name: "bank" }
  | { readonly name: "candidates"; readonly examId: string }
  | { readonly name: "results"; readonly examId: string }
  | { readonly name: "live"; readonly examId: string }
  | { readonly name: "report"; readonly examId: string; readonly attemptId: string }
  | { readonly name: "staff" }
  | { readonly name: "keys" }
  | { readonly name: "usage" }
  | { readonly name: "audit" }
  | { readonly name: "integrations" }
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

export function App({ client: injected }: { client?: ConsoleClient } = {}) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => (injected === undefined ? stored.get() : null));
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

  if (client === null) return <SignIn onSignedIn={signIn} />;
  return <Console client={client} onSignedOut={signOut} />;
}

function SignIn({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const signIn = useMutation({
    mutationFn: () => ConsoleClient.signIn(email.trim(), password),
    onSuccess: ({ token }) => onSignedIn(token),
  });
  const refused =
    signIn.error instanceof ConsoleError
      ? signIn.error.status === 429
        ? "Too many attempts. Wait a few minutes and try again."
        : "That email and password were not accepted."
      : signIn.error === null
        ? null
        : "Could not reach the server.";

  return (
    <main className="gate">
      <h1>Parikshaa console</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          signIn.mutate();
        }}
      >
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {refused === null ? null : (
          <p className="error" role="alert">
            {refused}
          </p>
        )}
        <button type="submit" disabled={signIn.isPending || email.trim() === "" || password === ""}>
          {signIn.isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
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

  const tabs: readonly { readonly view: View; readonly label: string; readonly permission: string }[] = [
    { view: { name: "bank" }, label: "Question bank", permission: "exam:read_key" },
    { view: { name: "staff" }, label: "Staff", permission: "staff:manage" },
    { view: { name: "keys" }, label: "API keys", permission: "apikey:manage" },
    { view: { name: "usage" }, label: "Spend", permission: "usage:read" },
    { view: { name: "audit" }, label: "Audit log", permission: "audit:read" },
    { view: { name: "integrations" }, label: "Integrations", permission: "org:manage" },
  ];

  return (
    <main className="page">
      <nav className="bar account" aria-label="Account">
        <span className="notice">
          {me.data === undefined ? "" : `${me.data.name} · ${me.data.role} · ${me.data.organisation.name}`}
        </span>
        <span className="spacer" />
        <button type="button" className="crumb" onClick={() => setView({ name: "exams" })}>
          Exams
        </button>
        {tabs
          .filter((tab) => can(tab.permission))
          .map((tab) => (
            <button key={tab.label} type="button" className="crumb" onClick={() => setView(tab.view)}>
              {tab.label}
            </button>
          ))}
        {me.data?.kind === "user" ? (
          <button type="button" className="crumb" onClick={() => setView({ name: "account" })}>
            Password
          </button>
        ) : null}
        <button type="button" className="quiet" onClick={() => signOut.mutate()}>
          Sign out
        </button>
      </nav>

      <div className="bar crumbs">
        <h1>
          {view.name === "exams" ? (
            "Parikshaa console"
          ) : (
            <button type="button" className="crumb" onClick={() => setView({ name: "exams" })}>
              Exams
            </button>
          )}
        </h1>
        {(view.name === "attempts" ||
          view.name === "review" ||
          view.name === "candidates" ||
          view.name === "results" ||
          view.name === "live" ||
          view.name === "report") &&
        view.examId !== "" ? (
          <>
            <span className="notice">/</span>
            <button
              type="button"
              className="crumb"
              onClick={() => setView({ name: "attempts", examId: view.examId })}
            >
              {examTitle(view.examId)}
            </button>
            {view.name === "report" ? (
              <>
                <span className="notice">/</span>
                <button type="button" className="crumb" onClick={() => setView({ name: "results", examId: view.examId })}>
                  Results
                </button>
              </>
            ) : null}
          </>
        ) : null}
      </div>

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
      {view.name === "report" ? <ReportPanel client={client} attemptId={view.attemptId} /> : null}
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
      {view.name === "staff" && me.data !== undefined ? <StaffPanel client={client} selfId={me.data.id} /> : null}
      {view.name === "keys" ? <ApiKeysPanel client={client} /> : null}
      {view.name === "usage" ? <UsagePanel client={client} canSetCap={can("org:manage")} /> : null}
      {view.name === "audit" ? <AuditPanel client={client} /> : null}
      {view.name === "integrations" ? <IntegrationsPanel client={client} /> : null}
      {view.name === "account" ? <AccountPanel client={client} onSignedOut={onSignedOut} /> : null}
    </main>
  );
}
