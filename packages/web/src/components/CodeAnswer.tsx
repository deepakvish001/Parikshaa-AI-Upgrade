import { Suspense, lazy, useState } from "react";
import type { CandidateCodeQuestion } from "@parikshaa/core/browser";
import type { RunOutcome } from "../api.ts";

/**
 * The editor is loaded only for an exam that has a code question. Most papers
 * have none, and a candidate on a slow connection should not download an
 * editor and four grammars to answer multiple choice. Until it arrives, a plain
 * text area does the same job.
 */
const CodeEditor = lazy(() => import("./CodeEditor.tsx").then((m) => ({ default: m.CodeEditor })));

interface Props {
  readonly question: CandidateCodeQuestion;
  /** The stored answer: `{language, source}` as JSON, or plain source from before languages could be chosen. */
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
  readonly onRun: (language: string, source: string, input?: string) => Promise<RunOutcome>;
}

const LANGUAGE_NAMES: Record<string, string> = {
  python: "Python 3",
  javascript: "JavaScript (Node)",
  c: "C (GCC)",
  cpp: "C++17 (GCC)",
  java: "Java",
};

const STATUS: Record<string, string> = {
  passed: "Matches",
  wrong_answer: "Different output",
  time_limit: "Took too long",
  runtime_error: "Stopped with an error",
  output_limit: "Printed too much",
  ran: "Ran",
};

export function readCodeAnswer(value: string, question: CandidateCodeQuestion): { language: string; source: string } {
  try {
    const parsed = JSON.parse(value) as { language?: unknown; source?: unknown };
    if (typeof parsed.language === "string" && typeof parsed.source === "string") {
      return { language: parsed.language, source: parsed.source };
    }
  } catch {
    // Plain source.
  }
  return { language: question.language, source: value === "" ? (question.starter ?? "") : value };
}

/**
 * Answering a code question: pick a language, write, run against the
 * examples or against input of your own, and see what happened.
 *
 * Running records nothing and scores nothing. What is committed is what is
 * scored — against tests this page never receives.
 */
export function CodeAnswer({ question, value, disabled, onChange, onRun }: Props) {
  const { language, source } = readCodeAnswer(value, question);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const write = (next: { language: string; source: string }) => onChange(JSON.stringify(next));
  const run = async (custom?: string) => {
    setRunning(true);
    setFailed(null);
    try {
      setOutcome(await onRun(language, source, custom));
    } catch (error) {
      setOutcome(null);
      setFailed(
        error instanceof Error && error.message.includes("503")
          ? "Code cannot be run just now. Your answer is still saved; try again in a moment."
          : "That run did not complete. Your answer is still saved.",
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="code-answer">
      {question.languages.length > 1 ? (
        <div className="field">
          <label htmlFor={`language-${question.id}`}>Language</label>
          <select
            id={`language-${question.id}`}
            value={language}
            disabled={disabled}
            onChange={(e) => write({ language: e.target.value, source })}
          >
            {question.languages.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_NAMES[l] ?? l}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="notice">{LANGUAGE_NAMES[language] ?? language}</p>
      )}

      <Suspense
        fallback={
          <textarea
            className="code"
            aria-label={question.stem}
            spellCheck={false}
            value={source}
            disabled={disabled}
            onChange={(e) => write({ language, source: e.target.value })}
          />
        }
      >
        <CodeEditor
          value={source}
          language={language}
          label={question.stem}
          disabled={disabled}
          onChange={(next) => write({ language, source: next })}
        />
      </Suspense>

      {question.samples.length === 0 ? null : (
        <details className="samples" open>
          <summary>Examples</summary>
          {question.samples.map((sample, i) => (
            <div className="sample" key={i}>
              <div>
                <span className="eyebrow">Input</span>
                <pre>{sample.input}</pre>
              </div>
              <div>
                <span className="eyebrow">Output</span>
                <pre>{sample.output}</pre>
              </div>
            </div>
          ))}
        </details>
      )}

      {disabled ? null : (
        <>
          <div className="row">
            {question.samples.length === 0 ? null : (
              <button type="button" className="secondary" disabled={running || source.trim() === ""} onClick={() => void run()}>
                {running ? "Running…" : "Run examples"}
              </button>
            )}
          </div>
          <div className="field">
            <label htmlFor={`input-${question.id}`}>Your own input</label>
            <textarea
              id={`input-${question.id}`}
              className="code"
              spellCheck={false}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>
          <div className="row">
            <button type="button" className="secondary" disabled={running || source.trim() === ""} onClick={() => void run(input)}>
              Run on my input
            </button>
            <span className="notice">Running is for you; only what you save is marked.</span>
          </div>
        </>
      )}

      {failed === null ? null : <p className="error">{failed}</p>}
      {outcome === null ? null : outcome.compiled === false ? (
        <section className="run-output" aria-label="Compiler output">
          <p className="eyebrow">Did not compile</p>
          <pre>{outcome.compileOutput}</pre>
        </section>
      ) : (
        <section className="run-output" aria-label="Run results">
          {outcome.results.map((r, i) => (
            <div className="run-result" key={i} data-status={r.status}>
              <p className="eyebrow">
                {r.expectedOutput === null ? "Your input" : `Example ${i + 1}`} · {STATUS[r.status] ?? r.status} · {r.timeMs} ms
              </p>
              <pre aria-label="Output">{r.stdout === "" ? "(no output)" : r.stdout}</pre>
              {r.expectedOutput !== null && r.status === "wrong_answer" ? (
                <>
                  <span className="eyebrow">Expected</span>
                  <pre>{r.expectedOutput}</pre>
                </>
              ) : null}
              {r.stderr === "" ? null : <pre className="stderr">{r.stderr}</pre>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
