import { useState } from "react";
import { FlaskConical, Wand2 } from "lucide-react";
import type { CodeQuestion } from "@parikshaa/core/browser";
import { ConsoleError, type ReferenceChecker, type ReferenceRun } from "../api.ts";

/**
 * An author's reference program (G4): run on every test of the question being
 * written, hidden ones too, to see a wrong test before a candidate meets it,
 * and to take the expected outputs from a program known to be right.
 */

const STATUS: Record<string, string> = {
  passed: "Matches",
  wrong_answer: "Differs",
  time_limit: "Too slow",
  memory_limit: "Too much memory",
  runtime_error: "Crashed",
  output_limit: "Too much output",
  checker_error: "Checker failed",
};
/** A test whose run failed has no output worth taking as the expected one. */
const RAN = new Set(["passed", "wrong_answer"]);

export function ReferenceRunner({ question, check, onChange }: { question: CodeQuestion; check: ReferenceChecker; onChange: (next: CodeQuestion) => void }) {
  const languages = question.languages ?? [question.language];
  const [language, setLanguage] = useState(question.language);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<ReferenceRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tests = question.tests ?? [];

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      setRun(await check(question, language, source));
    } catch (e) {
      setRun(null);
      setError(e instanceof ConsoleError && e.detail !== undefined ? e.detail : "The program could not be run just now.");
    } finally {
      setBusy(false);
    }
  };

  const usable = run?.compiled === true ? run.tests.filter((r) => RAN.has(r.status) && tests.some((t) => t.id === r.id)) : [];
  const fill = () => {
    if (run?.compiled !== true) return;
    const outputs = new Map(usable.map((r) => [r.id, r.output]));
    onChange({ ...question, tests: tests.map((t) => (outputs.has(t.id) ? { ...t, expected: outputs.get(t.id)! } : t)) });
  };

  return (
    <details className="reference-run">
      <summary>Reference program: check the tests, or fill in their expected outputs</summary>
      <p className="notice">A program you know is right, run on every test, hidden ones too. Nothing is saved, and candidates never see it.</p>
      <div className="row">
        <label htmlFor={`ref-lang-${question.id}`}>Language</label>
        <select id={`ref-lang-${question.id}`} value={language} onChange={(e) => setLanguage(e.target.value)}>
          {languages.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <label htmlFor={`ref-src-${question.id}`} className="visually-hidden">
        Reference program
      </label>
      <textarea id={`ref-src-${question.id}`} className="mono" spellCheck={false} rows={8} placeholder="The program, or for a function question the class with the function" value={source} onChange={(e) => setSource(e.target.value)} />
      <div className="row">
        <button type="button" className="secondary" disabled={busy || source.trim() === "" || tests.length === 0} onClick={() => void go()}>
          <FlaskConical aria-hidden="true" />
          {busy ? "Running…" : `Run on all ${tests.length} tests`}
        </button>
        {usable.length === 0 ? null : (
          <button type="button" className="secondary" onClick={fill}>
            <Wand2 aria-hidden="true" />
            Use its outputs as the expected ones ({usable.length})
          </button>
        )}
      </div>
      {tests.length === 0 ? <p className="notice">Add tests first: their inputs are what it runs on.</p> : null}
      {error === null ? null : (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {run === null ? null : run.compiled ? (
        <table className="reference-results">
          <caption className="visually-hidden">What the reference program did on each test</caption>
          <thead>
            <tr>
              <th scope="col">Test</th>
              <th scope="col">Result</th>
              <th scope="col">Its output</th>
              <th scope="col">Time</th>
            </tr>
          </thead>
          <tbody>
            {run.tests.map((r) => {
              const index = tests.findIndex((t) => t.id === r.id);
              return (
                <tr key={r.id} data-status={r.status}>
                  <td>
                    {index + 1}
                    {tests[index]?.hidden === true ? " (hidden)" : ""}
                  </td>
                  <td>{STATUS[r.status] ?? r.status}</td>
                  <td>
                    <pre className="mono">{r.output === "" ? r.stderr : r.output}</pre>
                  </td>
                  <td className="mono">{r.timeMs} ms</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <>
          <p className="error">It did not compile:</p>
          <pre className="mono">{run.compileOutput}</pre>
        </>
      )}
    </details>
  );
}
