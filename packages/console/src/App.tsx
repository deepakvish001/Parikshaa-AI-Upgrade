import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Exam } from "@parikshaa/core/browser";
import { ConsoleClient, ConsoleError } from "./api.ts";
import { AttemptList } from "./components/AttemptList.tsx";
import { AttemptReview } from "./components/AttemptReview.tsx";
import { ExamEditor } from "./components/ExamEditor.tsx";
import { ExamList } from "./components/ExamList.tsx";

type View =
  | { readonly name: "exams" }
  | { readonly name: "editor"; readonly examId: string | null }
  | { readonly name: "attempts"; readonly examId: string }
  | { readonly name: "review"; readonly examId: string; readonly attemptId: string };

export function App({ client: injected }: { client?: ConsoleClient } = {}) {
  const [token, setToken] = useState<string | null>(null);
  const client = injected ?? (token === null ? null : new ConsoleClient(token));

  if (client === null) return <StaffGate onToken={setToken} />;
  return <Console client={client} />;
}

function StaffGate({ onToken }: { onToken: (token: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <main className="gate">
      <h1>Parikshaa console</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim() !== "") onToken(value.trim());
        }}
      >
        <div className="field">
          <label htmlFor="staff-token">Staff token</label>
          <input
            id="staff-token"
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <button type="submit" disabled={value.trim() === ""}>
          Sign in
        </button>
      </form>
    </main>
  );
}

function Console({ client }: { client: ConsoleClient }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>({ name: "exams" });
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
    onError: (error) => setProblems(error instanceof ConsoleError ? error.problems : []),
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

  const assess = useMutation({
    mutationFn: ({ attemptId, probeId }: { attemptId: string; probeId: string }) =>
      client.assess(attemptId, probeId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["review"] });
    },
  });

  const examTitle = (id: string) => exams.data?.find((e) => e.id === id)?.title ?? id;

  return (
    <main className="page">
      <div className="bar">
        <h1>
          {view.name === "exams" ? (
            "Parikshaa console"
          ) : (
            <button type="button" className="crumb" onClick={() => setView({ name: "exams" })}>
              Exams
            </button>
          )}
        </h1>
        {view.name === "attempts" || view.name === "review" ? (
          <>
            <span className="notice">/</span>
            <button
              type="button"
              className="crumb"
              onClick={() => setView({ name: "attempts", examId: view.examId })}
            >
              {examTitle(view.examId)}
            </button>
          </>
        ) : null}
      </div>

      {view.name === "exams" ? (
        exams.isPending ? (
          <p className="notice">Loading…</p>
        ) : exams.error !== null ? (
          <p className="error">Could not load exams. Check the staff token.</p>
        ) : (
          <ExamList
            exams={exams.data}
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
        />
      ) : null}

      {view.name === "attempts" && attempts.data !== undefined ? (
        <AttemptList
          attempts={attempts.data}
          issued={issued}
          starting={startAttempt.isPending}
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
          onGrade={() => grade.mutate(view.attemptId)}
          onAssess={(probeId) => assess.mutate({ attemptId: view.attemptId, probeId })}
        />
      ) : null}
    </main>
  );
}
