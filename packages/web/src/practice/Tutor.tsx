import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lightbulb, MessageCircleQuestion, ScanSearch, Sparkles, Trash2 } from "lucide-react";
import { Markdown } from "@parikshaa/brand/markdown";
import { ApiError } from "../api.ts";
import { usePreferences } from "../i18n.tsx";
import type { PracticeClient, TutorAnswer } from "./client.ts";
import { usePrepText } from "./prep-text.ts";

/**
 * Sahayak, the tutor (ROADMAP §16), beside a problem or under a lesson: the
 * hint ladder a rung at a time, a review of the latest submission, and doubts.
 * Each answer costs credits, shown on its button before it is asked.
 */

const reply = (language: string): "en" | "hi" => (language === "hi" ? "hi" : "en");

function Failure({ error, onCredits }: { readonly error: unknown; readonly onCredits: () => void }) {
  const p = usePrepText();
  if (!(error instanceof ApiError)) return <p className="error">{p("common.failed")}</p>;
  const message = typeof error.detail["message"] === "string" ? error.detail["message"] : p("common.failed");
  return (
    <p className="error" role="alert">
      {message}{" "}
      {error.code === "no_credits" ? (
        <button type="button" className="link-button" onClick={onCredits}>
          {p("tutor.buyCredits")}
        </button>
      ) : null}
    </p>
  );
}

function Answer({ entry }: { readonly entry: TutorAnswer & { readonly question?: string } }) {
  const p = usePrepText();
  const label = entry.mode === "hint" ? p("tutor.hintLabel", { n: entry.hintLevel ?? 0 }) : entry.mode === "review" ? p("tutor.reviewLabel") : p("tutor.doubtLabel");
  return (
    <article className="tutor-answer">
      <h3>
        {entry.mode === "hint" ? <Lightbulb aria-hidden="true" /> : entry.mode === "review" ? <ScanSearch aria-hidden="true" /> : <MessageCircleQuestion aria-hidden="true" />} {label}
      </h3>
      {entry.question === undefined || entry.question === "" ? null : <blockquote>{entry.question}</blockquote>}
      <Markdown source={entry.answer} />
    </article>
  );
}

/** The tutor for a problem: its history, the next hint, a review, and a doubt. */
export function TutorPanel({
  client,
  site,
  slug,
  code,
  onCredits,
}: {
  readonly client: PracticeClient;
  readonly site: string;
  readonly slug: string;
  /** The learner's code as it stands, for a hint that can see it. */
  readonly code: { readonly language: string; readonly source: string } | null;
  readonly onCredits: () => void;
}) {
  const p = usePrepText();
  const { language } = usePreferences();
  const queryClient = useQueryClient();
  const key = ["practice", site, "prep", "tutor", slug];
  const history = useQuery({ queryKey: key, queryFn: () => client.tutor(slug) });
  const credits = useQuery({ queryKey: ["practice", site, "prep", "credits"], queryFn: () => client.credits() });
  const [question, setQuestion] = useState("");
  const done = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: ["practice", site, "prep", "credits"] });
  };
  const hint = useMutation({ mutationFn: () => client.hint(slug, reply(language), code ?? undefined), onSuccess: done });
  const review = useMutation({ mutationFn: () => client.review(slug, reply(language)), onSuccess: done });
  const doubt = useMutation({
    mutationFn: () => client.doubt({ problem: slug }, question.trim(), reply(language)),
    onSuccess: () => {
      setQuestion("");
      done();
    },
  });
  const forget = useMutation({ mutationFn: () => client.forgetTutor(slug), onSuccess: done });
  const busy = hint.isPending || review.isPending || doubt.isPending;
  const error = hint.error ?? review.error ?? doubt.error;

  if (history.isError && history.error instanceof ApiError && history.error.status === 503) return <p className="notice">{p("tutor.off")}</p>;
  const h = history.data;
  const next = h?.nextHint ?? null;

  return (
    <div className="tutor">
      <div className="tutor-head">
        <p className="notice">
          <Sparkles aria-hidden="true" /> {p("tutor.intro")}
        </p>
        {credits.data === undefined ? null : (
          <button type="button" className="link-button" onClick={onCredits}>
            {p("credits.balance", { n: credits.data.balance })}
          </button>
        )}
      </div>
      {(h?.entries ?? []).map((entry) => (
        <Answer key={entry.id} entry={entry} />
      ))}
      {busy ? (
        <p className="notice" role="status">
          {p("tutor.thinking")}
        </p>
      ) : null}
      {error === null ? null : <Failure error={error} onCredits={onCredits} />}
      <div className="tutor-actions">
        {h === undefined ? null : next === null ? (
          <p className="notice">{p("tutor.allHints")}</p>
        ) : next.available ? (
          <button type="button" className="secondary" disabled={busy} onClick={() => hint.mutate()}>
            <Lightbulb aria-hidden="true" /> {next.level === 4 ? p("tutor.solution", { credits: next.credits }) : next.credits === 0 ? p("tutor.hintFree", { n: next.level }) : p("tutor.hint", { n: next.level, credits: next.credits })}
          </button>
        ) : (
          <p className="notice">{p("tutor.solutionLocked", { n: h.failures })}</p>
        )}
        {h === undefined ? null : (
          <button type="button" className="secondary" disabled={busy} onClick={() => review.mutate()}>
            <ScanSearch aria-hidden="true" /> {p("tutor.review", { credits: h.costs.review })}
          </button>
        )}
      </div>
      <form
        className="tutor-ask"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (question.trim().length >= 3) doubt.mutate();
        }}
      >
        <label htmlFor={`doubt-${slug}`}>{p("tutor.ask")}</label>
        <textarea id={`doubt-${slug}`} rows={3} maxLength={2000} value={question} placeholder={p("tutor.askPlaceholder")} onChange={(e) => setQuestion(e.target.value)} />
        <button type="submit" disabled={busy || question.trim().length < 3}>
          {p("tutor.send", { credits: h?.costs.doubt ?? 15 })}
        </button>
      </form>
      {(h?.entries.length ?? 0) === 0 ? null : (
        <button type="button" className="quiet small" onClick={() => forget.mutate()} disabled={forget.isPending}>
          <Trash2 aria-hidden="true" /> {p("tutor.forget")}
        </button>
      )}
    </div>
  );
}

/** A doubt about a lesson. */
export function LessonDoubt({ client, lesson, onCredits }: { readonly client: PracticeClient; readonly lesson: string; readonly onCredits: () => void }) {
  const p = usePrepText();
  const { language } = usePreferences();
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<(TutorAnswer & { question: string })[]>([]);
  const ask = useMutation({
    mutationFn: (q: string) => client.doubt({ lesson }, q, reply(language)),
    onSuccess: (a, q) => {
      setAnswers([...answers, { ...a, question: q }]);
      setQuestion("");
    },
  });
  return (
    <section className="card tutor" aria-labelledby={`lesson-doubt-${lesson}`}>
      <h2 id={`lesson-doubt-${lesson}`}>
        <Sparkles aria-hidden="true" /> {p("tutor.tab")}: {p("tutor.ask")}
      </h2>
      {answers.map((a) => (
        <Answer key={a.id} entry={a} />
      ))}
      {ask.isPending ? <p className="notice">{p("tutor.thinking")}</p> : null}
      {ask.isError ? <Failure error={ask.error} onCredits={onCredits} /> : null}
      <form
        className="tutor-ask"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim().length >= 3) ask.mutate(question.trim());
        }}
      >
        <label htmlFor={`lesson-q-${lesson}`} className="visually-hidden">
          {p("tutor.ask")}
        </label>
        <textarea id={`lesson-q-${lesson}`} rows={2} maxLength={2000} value={question} placeholder={p("tutor.askPlaceholder")} onChange={(e) => setQuestion(e.target.value)} />
        <button type="submit" disabled={ask.isPending || question.trim().length < 3}>
          {p("tutor.send", { credits: 15 })}
        </button>
      </form>
    </section>
  );
}
