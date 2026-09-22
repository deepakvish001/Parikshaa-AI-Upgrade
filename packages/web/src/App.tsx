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

  const { exam, answers, state: attemptState, expiresAt, voidReason } = state.data;
  const answered = new Map(answers.map((a) => [a.questionId, a.answer]));
  const open = attemptState === "in_progress";

  return (
    <main className="page">
      <header className="exam">
        <h1>{exam.title}</h1>
        <p className="sub">
          {open ? (
            <>
              {answered.size} of {exam.questions.length} answered
              <TimeLeft expiresAt={expiresAt} />
            </>
          ) : (
            `Attempt ${attemptState.replace(/_/g, " ")}`
          )}
        </p>
      </header>

      {attemptState === "void" ? (
        /*
         * SPEC §6.2: being set aside without being told why is the situation
         * this design objects to. The reason a person recorded is shown as they
         * wrote it, not summarized and not softened.
         */
        <section className="card" aria-label="This attempt was set aside">
          <h2 style={{ fontSize: "1rem", margin: "0 0 .4rem" }}>This attempt was set aside</h2>
          <p style={{ margin: 0 }}>{voidReason}</p>
          <p className="notice" style={{ marginTop: ".75rem" }}>
            Your record below is unchanged and still checks out. If you disagree with
            this, it is what you take to your institution.
          </p>
        </section>
      ) : null}

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

/**
 * Time left in the exam.
 *
 * This is the exam's own window, which a candidate is entitled to see. It is
 * not a timer on the micro-viva — SPEC §8 rules that out, and the probe panel
 * shows none.
 */
function TimeLeft({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, expiresAt - now);
  if (remaining === 0) return <> · time is up</>;

  const minutes = Math.floor(remaining / 60_000);
  const hours = Math.floor(minutes / 60);
  return (
    <> · {hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`} left</>
  );
}
