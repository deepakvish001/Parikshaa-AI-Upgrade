import { useState } from "react";
import {
  CODE_LANGUAGES,
  functionTestProblems,
  signatureProblems,
  starterFor,
  VALUE_TYPES,
  type CodeChecker,
  type CodeQuestion,
  type CodeTest,
  type Signature,
  type ValueType,
} from "@parikshaa/core/browser";
import { Markdown } from "@parikshaa/brand/markdown";

const NAMES: Record<string, string> = {
  python: "Python 3",
  javascript: "JavaScript",
  c: "C",
  cpp: "C++17",
  java: "Java",
};

const TYPE_NAMES: Record<ValueType, string> = {
  int: "int",
  long: "long (64-bit)",
  double: "double",
  boolean: "boolean",
  string: "string",
  "int[]": "int[]",
  "long[]": "long[]",
  "double[]": "double[]",
  "boolean[]": "boolean[]",
  "string[]": "string[]",
  "int[][]": "int[][]",
  "string[][]": "string[][]",
};

const CHECKERS: { kind: CodeChecker["kind"]; label: string }[] = [
  { kind: "exact", label: "Exactly (ignoring line endings and trailing spaces)" },
  { kind: "tokens", label: "Word by word, however it is spaced" },
  { kind: "numbers", label: "Numbers within a tolerance" },
  { kind: "unordered", label: "Lines in any order" },
  { kind: "custom", label: "By a checker program (many right answers)" },
];

const CHECKER_EXAMPLE = [
  "import sys",
  "# Arguments: the test's input, its expected output, and the program's output.",
  "given, expected, output = (open(p).read() for p in sys.argv[1:4])",
  "if output.split() == expected.split():",
  "    sys.exit(0)  # right",
  'print("Explain what is wrong; the examiner sees this.")',
  "sys.exit(1)  # wrong",
].join("\n");

const DEFAULT_SIGNATURE: Signature = { name: "solve", params: [{ name: "nums", type: "int[]" }], returns: "int" };

/** Remove optional keys, which exactOptionalPropertyTypes will not let be set to undefined. */
function without<K extends keyof CodeQuestion>(question: CodeQuestion, ...keys: K[]): CodeQuestion {
  const copy: Record<string, unknown> = { ...question };
  for (const key of keys) delete copy[key as string];
  return copy as unknown as CodeQuestion;
}

/**
 * Writing a code question: a function to complete, as on LeetCode, or a whole
 * program that reads standard input; which languages a candidate may use;
 * starter code; the statement's sections; how output is judged; limits; and
 * the tests that score it.
 *
 * Visible tests are shown to candidates as worked examples. Hidden tests
 * decide the score and never leave the server; at least one is required,
 * because a candidate who has seen every test can simply print the answers.
 */
export function CodeFields({ question, onChange }: { question: CodeQuestion; onChange: (next: CodeQuestion) => void }) {
  const languages = question.languages ?? [question.language];
  const tests = question.tests ?? [];
  const signature = question.signature;
  const functionMode = signature !== undefined;
  const [starterLanguage, setStarterLanguage] = useState(question.language);
  const setTests = (next: readonly CodeTest[]) => onChange({ ...question, tests: next });
  const patchTest = (index: number, patch: Partial<CodeTest>) => setTests(tests.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  const setSignature = (next: Signature) => onChange({ ...question, signature: next });
  const id = question.id;

  const toggle = (language: string, on: boolean) => {
    const next = on ? [...languages, language] : languages.filter((l) => l !== language);
    if (next.length === 0) return;
    onChange({
      ...question,
      languages: CODE_LANGUAGES.filter((l) => next.includes(l)),
      language: next.includes(question.language) ? question.language : next[0]!,
    });
  };

  const setMode = (mode: "function" | "program") => {
    if (mode === "function") {
      // A function question's starters are written from its signature; its answers are compared as values.
      const base = without(question, "starter", "starters");
      onChange({
        ...(question.checker?.kind === "custom" ? base : without(base, "checker")),
        signature: signature ?? DEFAULT_SIGNATURE,
      });
    } else onChange(without(question, "signature"));
  };

  const setText = (key: "inputFormat" | "outputFormat" | "constraints", text: string) =>
    onChange(text === "" ? without(question, key) : { ...question, [key]: text });

  const setChecker = (kind: CodeChecker["kind"]) => {
    const checker: CodeChecker =
      kind === "numbers" ? { kind, tolerance: 1e-6 } : kind === "custom" ? { kind, source: CHECKER_EXAMPLE } : { kind };
    onChange(kind === "exact" ? without(question, "checker") : { ...question, checker });
  };

  const starterOf = (language: string) => question.starters?.[language] ?? question.starter ?? "";
  const setStarter = (language: string, text: string) => {
    const starters = { ...(question.starters ?? {}) };
    if (text === "") delete starters[language];
    else starters[language] = text;
    const next = without(question, "starter");
    onChange(Object.keys(starters).length === 0 ? without(next, "starters") : { ...next, starters });
  };

  const problems = functionMode ? signatureProblems(signature) : [];

  return (
    <>
      <fieldset className="field">
        <legend>The candidate writes</legend>
        <div className="row" style={{ marginTop: ".2rem" }}>
          <label className="inline">
            <input type="radio" name={`mode-${id}`} checked={functionMode} onChange={() => setMode("function")} style={{ width: "auto" }} /> A function,
            as on LeetCode
          </label>
          <label className="inline">
            <input type="radio" name={`mode-${id}`} checked={!functionMode} onChange={() => setMode("program")} style={{ width: "auto" }} /> A whole
            program that reads standard input
          </label>
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Languages the candidate may use</legend>
        <div className="row" style={{ marginTop: ".2rem" }}>
          {CODE_LANGUAGES.map((l) => (
            <label key={l} className="inline">
              <input type="checkbox" checked={languages.includes(l)} onChange={(e) => toggle(l, e.target.checked)} style={{ width: "auto" }} />{" "}
              {NAMES[l]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid">
        <div className="field">
          <label htmlFor={`lang-${id}`}>Opens in</label>
          <select id={`lang-${id}`} value={question.language} onChange={(e) => onChange({ ...question, language: e.target.value })}>
            {languages.map((l) => (
              <option key={l} value={l}>
                {NAMES[l] ?? l}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`time-${id}`}>Time per test (ms)</label>
          <input
            id={`time-${id}`}
            type="number"
            min={100}
            max={10000}
            value={question.limits?.timeMs ?? 2000}
            onChange={(e) => onChange({ ...question, limits: { ...question.limits, timeMs: Number(e.target.value) } })}
          />
        </div>
        <div className="field">
          <label htmlFor={`memory-${id}`}>Memory (MB)</label>
          <input
            id={`memory-${id}`}
            type="number"
            min={32}
            max={1024}
            value={question.limits?.memoryMb ?? 256}
            onChange={(e) => onChange({ ...question, limits: { ...question.limits, memoryMb: Number(e.target.value) } })}
          />
        </div>
      </div>

      {functionMode ? (
        <fieldset className="field signature" aria-label="The function">
          <legend>The function</legend>
          <div className="grid">
            <div className="field">
              <label htmlFor={`fn-${id}`}>Function name</label>
              <input id={`fn-${id}`} className="mono" value={signature.name} onChange={(e) => setSignature({ ...signature, name: e.target.value.trim() })} />
            </div>
            <div className="field">
              <label htmlFor={`returns-${id}`}>Returns</label>
              <select id={`returns-${id}`} value={signature.returns} onChange={(e) => setSignature({ ...signature, returns: e.target.value as ValueType })}>
                {VALUE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_NAMES[t]}
                  </option>
                ))}
              </select>
            </div>
            {signature.returns.endsWith("[]") ? (
              <div className="field">
                <label htmlFor={`order-${id}`}>A returned list may come</label>
                <select
                  id={`order-${id}`}
                  value={signature.anyOrder ?? "none"}
                  onChange={(e) => setSignature({ ...signature, anyOrder: e.target.value as "none" | "top" | "deep" })}
                >
                  <option value="none">Only in the expected order</option>
                  <option value="top">In any order</option>
                  <option value="deep">In any order, and each inner list too</option>
                </select>
              </div>
            ) : null}
            {signature.returns.startsWith("double") ? (
              <div className="field">
                <label htmlFor={`tolerance-${id}`}>Tolerance</label>
                <input
                  id={`tolerance-${id}`}
                  type="number"
                  step="any"
                  min={0}
                  max={1}
                  value={signature.tolerance ?? 1e-5}
                  onChange={(e) => setSignature({ ...signature, tolerance: Number(e.target.value) })}
                />
              </div>
            ) : null}
          </div>
          {signature.params.map((p, i) => (
            <div className="row param" key={i} role="group" aria-label={`Parameter ${i + 1}`}>
              <label className="inline" htmlFor={`pname-${id}-${i}`}>
                Parameter {i + 1}
              </label>
              <input
                id={`pname-${id}-${i}`}
                className="mono"
                style={{ width: "10rem" }}
                aria-label="Name"
                value={p.name}
                onChange={(e) => setSignature({ ...signature, params: signature.params.map((q, j) => (j === i ? { ...q, name: e.target.value.trim() } : q)) })}
              />
              <select
                aria-label="Type"
                value={p.type}
                onChange={(e) =>
                  setSignature({ ...signature, params: signature.params.map((q, j) => (j === i ? { ...q, type: e.target.value as ValueType } : q)) })
                }
                style={{ width: "10rem" }}
              >
                {VALUE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_NAMES[t]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="quiet"
                disabled={signature.params.length === 1}
                onClick={() => setSignature({ ...signature, params: signature.params.filter((_q, j) => j !== i) })}
              >
                Remove parameter
              </button>
            </div>
          ))}
          <div className="row">
            <button
              type="button"
              className="secondary"
              disabled={signature.params.length >= 8}
              onClick={() => setSignature({ ...signature, params: [...signature.params, { name: `arg${signature.params.length + 1}`, type: "int" }] })}
            >
              Add parameter
            </button>
          </div>
          {problems.length === 0 ? null : (
            <ul className="problems" aria-label="Problems with the function">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {problems.length > 0 ? null : (
            <details className="starter-preview">
              <summary>What candidates start from</summary>
              <div className="row" role="tablist" aria-label="Language">
                {languages.map((l) => (
                  <button key={l} type="button" role="tab" aria-selected={starterLanguage === l} className="chip" onClick={() => setStarterLanguage(l)}>
                    {NAMES[l]}
                  </button>
                ))}
              </div>
              <pre className="mono">{starterFor(signature, languages.includes(starterLanguage) ? starterLanguage : question.language)}</pre>
            </details>
          )}
        </fieldset>
      ) : (
        <div className="field">
          <label htmlFor={`starter-${id}`}>Starter code (optional)</label>
          {languages.length > 1 ? (
            <div className="row" role="tablist" aria-label="Starter code for">
              {languages.map((l) => (
                <button key={l} type="button" role="tab" aria-selected={starterLanguage === l} className="chip" onClick={() => setStarterLanguage(l)}>
                  {NAMES[l]}
                  {question.starters?.[l] !== undefined ? " ✓" : ""}
                </button>
              ))}
            </div>
          ) : null}
          <textarea
            id={`starter-${id}`}
            className="mono"
            spellCheck={false}
            value={starterOf(languages.includes(starterLanguage) ? starterLanguage : question.language)}
            onChange={(e) => setStarter(languages.includes(starterLanguage) ? starterLanguage : question.language, e.target.value)}
          />
        </div>
      )}

      <details className="field statement-fields">
        <summary>Input and output format, constraints (Markdown)</summary>
        <p className="notice">
          Statements are Markdown: <code>`code`</code>, <code>**bold**</code>, lists with <code>-</code>, and powers written <code>10^5</code>.
        </p>
        {(
          [
            ["inputFormat", "Input format"],
            ["outputFormat", "Output format"],
            ["constraints", "Constraints"],
          ] as const
        ).map(([key, label]) => (
          <div className="field" key={key}>
            <label htmlFor={`${key}-${id}`}>{label}</label>
            <textarea id={`${key}-${id}`} value={question[key] ?? ""} onChange={(e) => setText(key, e.target.value)} />
          </div>
        ))}
        <div className="md-preview" aria-label="Preview">
          <span className="eyebrow">Preview</span>
          <Markdown source={[question.stem, question.inputFormat, question.outputFormat, question.constraints].filter((s) => s !== undefined && s !== "").join("\n\n")} />
        </div>
      </details>

      <div className="field">
        <label htmlFor={`checker-${id}`}>{functionMode ? "Returned values are compared" : "Output is judged"}</label>
        <select
          id={`checker-${id}`}
          value={question.checker?.kind ?? "exact"}
          onChange={(e) => (functionMode ? onChange(e.target.value === "custom" ? { ...question, checker: { kind: "custom", source: CHECKER_EXAMPLE } } : without(question, "checker")) : setChecker(e.target.value as CodeChecker["kind"]))}
        >
          {functionMode ? (
            <>
              <option value="exact">As values: [1, 2] and [1,2] are the same</option>
              <option value="custom">By a checker program (many right answers)</option>
            </>
          ) : (
            CHECKERS.map((c) => (
              <option key={c.kind} value={c.kind}>
                {c.label}
              </option>
            ))
          )}
        </select>
        {question.checker?.kind === "numbers" ? (
          <div className="field">
            <label htmlFor={`ntol-${id}`}>Tolerance</label>
            <input
              id={`ntol-${id}`}
              type="number"
              step="any"
              min={0}
              max={1}
              value={question.checker.tolerance}
              onChange={(e) => onChange({ ...question, checker: { kind: "numbers", tolerance: Number(e.target.value) } })}
            />
          </div>
        ) : null}
        {question.checker?.kind === "custom" ? (
          <div className="field">
            <label htmlFor={`checker-src-${id}`}>Checker program (Python 3)</label>
            <textarea
              id={`checker-src-${id}`}
              className="mono"
              spellCheck={false}
              value={question.checker.source}
              onChange={(e) => onChange({ ...question, checker: { kind: "custom", source: e.target.value } })}
            />
            <p className="notice">
              Run as <code>checker.py input expected output</code>, in the sandbox: exit 0 accepts, exit 1 rejects, and what it prints is its reason.
              Candidates never see it.
            </p>
          </div>
        ) : null}
      </div>

      <div className="field">
        <label>
          {functionMode
            ? `Tests — the arguments, one JSON value per line (${signature.params.map((p) => p.name).join(", ")}), and the value it must return`
            : "Tests — standard input, and the standard output it must produce"}
        </label>
        {tests.map((test, index) => {
          const testProblems = functionMode && problems.length === 0 && (test.input !== "" || test.expected !== "") ? functionTestProblems(signature, test.input, test.expected) : [];
          return (
            <div className="test-case" key={test.id} aria-label={`Test ${index + 1}`} role="group">
              <div className="grid">
                <div className="field">
                  <label htmlFor={`in-${id}-${test.id}`}>{functionMode ? "Arguments" : "Input"}</label>
                  <textarea
                    id={`in-${id}-${test.id}`}
                    className="mono"
                    spellCheck={false}
                    placeholder={functionMode ? signature.params.map((p) => (p.type.endsWith("[]") ? "[1,2,3]" : p.type === "string" ? '"abc"' : "7")).join("\n") : undefined}
                    value={test.input}
                    onChange={(e) => patchTest(index, { input: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`out-${id}-${test.id}`}>{functionMode ? "Expected return value" : "Expected output"}</label>
                  <textarea
                    id={`out-${id}-${test.id}`}
                    className="mono"
                    spellCheck={false}
                    value={test.expected}
                    onChange={(e) => patchTest(index, { expected: e.target.value })}
                  />
                </div>
              </div>
              {testProblems.length === 0 ? null : (
                <ul className="problems" aria-label={`Problems with test ${index + 1}`}>
                  {testProblems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              {test.hidden ? null : (
                <div className="field">
                  <label htmlFor={`why-${id}-${test.id}`}>Explanation shown with this example (optional)</label>
                  <input
                    id={`why-${id}-${test.id}`}
                    value={test.explanation ?? ""}
                    onChange={(e) => {
                      const { explanation: _, ...rest } = test;
                      setTests(tests.map((t, i) => (i === index ? (e.target.value === "" ? rest : { ...rest, explanation: e.target.value }) : t)));
                    }}
                  />
                </div>
              )}
              <div className="row">
                <label className="inline">
                  <input type="checkbox" checked={test.hidden} onChange={(e) => patchTest(index, { hidden: e.target.checked })} style={{ width: "auto" }} /> Hidden
                  from candidates
                </label>
                <label className="inline" htmlFor={`weight-${id}-${test.id}`}>
                  Weight
                </label>
                <input
                  id={`weight-${id}-${test.id}`}
                  type="number"
                  min={1}
                  style={{ width: "5rem" }}
                  value={test.weight}
                  onChange={(e) => patchTest(index, { weight: Number(e.target.value) })}
                />
                <button type="button" className="quiet" onClick={() => setTests(tests.filter((_, i) => i !== index))}>
                  Remove test
                </button>
              </div>
            </div>
          );
        })}
        <div className="row">
          <button
            type="button"
            className="secondary"
            onClick={() =>
              setTests([
                ...tests,
                // The first test is an example; later ones are hidden, which is
                // what scores the answer.
                { id: `t${Date.now().toString(36)}${tests.length}`, input: "", expected: "", hidden: tests.length > 0, weight: 1 },
              ])
            }
          >
            Add test
          </button>
        </div>
        <p className="notice">Scored by the share of test weight passed. With no tests, a code answer is graded against its rubric instead.</p>
      </div>
    </>
  );
}
