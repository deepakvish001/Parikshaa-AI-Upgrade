import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ParikshaaClient } from "./api.ts";
import { AnswerInput } from "./components/AnswerInput.tsx";
import { ProbePanel } from "./components/ProbePanel.tsx";
import { Receipt } from "./components/Receipt.tsx";
import { TokenGate } from "./components/TokenGate.tsx";

interface OpenProbe {
  readonly id: string;
  prompt: string;
  streaming: boolean;
}

export function App({ client: injected }: { client?: ParikshaaClient } = {}) {
  const [token, setToken] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("token"),
  );

  const client = useMemo(
    () => injected ?? (token === null ? null : new ParikshaaClient(token)),
    [injected, token],
  );

  if (client === null) return <TokenGate onToken={setToken} />;
  return <Attempt client={client} />;
}

function Attempt({ client }: { client: ParikshaaClient }) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});
  const [probe, setProbe] = useState<OpenProbe | null>(null);
  const probeRequested = useRef(false);

  const state = useQuery({ queryKey: ["state"], queryFn: () => client.state() });
  const ledger = useQuery({
    queryKey: ["ledger"],
    queryFn: () => client.ledger(),
    enabled: state.data !== undefined && state.data.state !== "in_progress",
  });

  /**
   * Ask whether a probe is due.
   *
   * Called after an answer is saved rather than on a timer: a probe is a
   * response to something the candidate just did, and polling would raise one
   * while they are mid-thought on another question.
   */
  const checkForProbe = useCallback(async () => {
    if (probeRequested.current) return;
    probeRequested.current = true;
    try {
      await client.streamProbe({
        onToken: (chunk) =>
          setProbe((current) =>
            current === null ? current : { ...current, prompt: current.prompt + chunk },
          ),
        onProbe: (raised) =>
          setProbe({ id: raised.id, prompt: raised.prompt, streaming: false }),
        onNone: () => setProbe(null),
        onError: () => setProbe(null),
      });
    } finally {
      probeRequested.current = false;
    }
  }, [client]);

  // Reopen a probe the candidate left unanswered, e.g. after a reload.
  useEffect(() => {
    const open = state.data?.openProbe;
    if (open != null && probe === null) {
      setProbe({ id: open.id, prompt: open.prompt, streaming: false });
    }
  }, [state.data?.openProbe, probe]);

  const saveAnswer = useMutation({
    mutationFn: ({ questionId, answer }: { questionId: string; answer: string }) =>
      client.saveAnswer(questionId, answer),
    onSuccess: async (_result, { questionId }) => {
      setSavedAt((prior) => ({ ...prior, [questionId]: Date.now() }));
      await queryClient.invalidateQueries({ queryKey: ["state"] });
      if (probe === null) {
        setProbe({ id: "", prompt: "", streaming: true });
        void checkForProbe();
      }
    },
  });

  const submit = useMutation({
    mutationFn: () => client.submit(),
    onSuccess: async () => {
      setProbe(null);
      await queryClient.invalidateQueries();
    },
  });

  if (state.isPending) return <main className="page"><p className="notice">Loading your exam…</p></main>;
  if (state.error !== null) {
    return (
      <main className="page">
        <p className="error">Could not load this attempt. The access code may have expired.</p>
      </main>
    );
  }

  const { exam, answers, state: attemptState } = state.data;
  const answered = new Map(answers.map((a) => [a.questionId, a.answer]));
  const open = attemptState === "in_progress";

  return (
    <main className="page">
      <header className="exam">
        <h1>{exam.title}</h1>
        <p className="sub">
          {open
            ? `${answered.size} of ${exam.questions.length} answered`
            : `Attempt ${attemptState.replace(/_/g, " ")}`}
        </p>
      </header>

      {probe !== null && open ? (
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

      {exam.questions.map((question, index) => {
        const value = drafts[question.id] ?? answered.get(question.id) ?? "";
        const dirty = value !== (answered.get(question.id) ?? "");
        return (
          <section className="card" key={question.id}>
            <div className="q-head">
              <h2>
                {index + 1}. {question.stem}
              </h2>
              <span className="marks">{question.maxScore} marks</span>
            </div>

            <AnswerInput
              question={question}
              value={value}
              disabled={!open}
              onChange={(next) => setDrafts((prior) => ({ ...prior, [question.id]: next }))}
            />

            {open ? (
              <div className="row">
                <button
                  type="button"
                  className="secondary"
                  disabled={!dirty || value.trim() === "" || saveAnswer.isPending}
                  onClick={() => saveAnswer.mutate({ questionId: question.id, answer: value })}
                >
                  Save answer
                </button>
                {savedAt[question.id] !== undefined && !dirty ? (
                  <span className="saved">Saved</span>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}

      {open ? (
        <div className="row">
          <button
            type="button"
            onClick={() => submit.mutate()}
            disabled={submit.isPending || answered.size === 0}
          >
            {submit.isPending ? "Submitting…" : "Submit attempt"}
          </button>
          <span className="notice">You cannot change your answers after this.</span>
        </div>
      ) : ledger.data !== undefined ? (
        <Receipt ledger={ledger.data} />
      ) : null}
    </main>
  );
}
