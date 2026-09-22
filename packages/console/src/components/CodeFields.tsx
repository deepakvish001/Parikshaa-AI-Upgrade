import { CODE_LANGUAGES, type CodeQuestion, type CodeTest } from "@parikshaa/core/browser";

const NAMES: Record<string, string> = {
  python: "Python 3",
  javascript: "JavaScript",
  c: "C",
  cpp: "C++17",
  java: "Java",
};

/**
 * Writing a code question: which languages a candidate may use, starter code,
 * limits, and the tests that score it.
 *
 * Visible tests are shown to candidates as worked examples. Hidden tests
 * decide the score and never leave the server; at least one is required,
 * because a candidate who has seen every test can simply print the answers.
 */
export function CodeFields({ question, onChange }: { question: CodeQuestion; onChange: (next: CodeQuestion) => void }) {
  const languages = question.languages ?? [question.language];
  const tests = question.tests ?? [];
  const setTests = (next: readonly CodeTest[]) => onChange({ ...question, tests: next });
  const patchTest = (index: number, patch: Partial<CodeTest>) =>
    setTests(tests.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  const toggle = (language: string, on: boolean) => {
    const next = on ? [...languages, language] : languages.filter((l) => l !== language);
    if (next.length === 0) return;
    onChange({
      ...question,
      languages: CODE_LANGUAGES.filter((l) => next.includes(l)),
      language: next.includes(question.language) ? question.language : next[0]!,
    });
  };

  return (
    <>
      <fieldset className="field">
        <legend>Languages the candidate may use</legend>
        <div className="row" style={{ marginTop: ".2rem" }}>
          {CODE_LANGUAGES.map((l) => (
            <label key={l} className="inline">
              <input
                type="checkbox"
                checked={languages.includes(l)}
                onChange={(e) => toggle(l, e.target.checked)}
                style={{ width: "auto" }}
              />{" "}
              {NAMES[l]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid">
        <div className="field">
          <label htmlFor={`lang-${question.id}`}>Opens in</label>
          <select
            id={`lang-${question.id}`}
            value={question.language}
            onChange={(e) => onChange({ ...question, language: e.target.value })}
          >
            {languages.map((l) => (
              <option key={l} value={l}>
                {NAMES[l] ?? l}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`time-${question.id}`}>Time per test (ms)</label>
          <input
            id={`time-${question.id}`}
            type="number"
            min={100}
            max={10000}
            value={question.limits?.timeMs ?? 2000}
            onChange={(e) => onChange({ ...question, limits: { ...question.limits, timeMs: Number(e.target.value) } })}
          />
        </div>
        <div className="field">
          <label htmlFor={`memory-${question.id}`}>Memory (MB)</label>
          <input
            id={`memory-${question.id}`}
            type="number"
            min={32}
            max={1024}
            value={question.limits?.memoryMb ?? 256}
            onChange={(e) => onChange({ ...question, limits: { ...question.limits, memoryMb: Number(e.target.value) } })}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor={`starter-${question.id}`}>Starter code (optional)</label>
        <textarea
          id={`starter-${question.id}`}
          className="mono"
          spellCheck={false}
          value={question.starter ?? ""}
          onChange={(e) => {
            const { starter: _, ...rest } = question;
            onChange(e.target.value === "" ? rest : { ...rest, starter: e.target.value });
          }}
        />
      </div>

      <div className="field">
        <label>Tests — standard input, and the standard output it must produce</label>
        {tests.map((test, index) => (
          <div className="test-case" key={test.id} aria-label={`Test ${index + 1}`} role="group">
            <div className="grid">
              <div className="field">
                <label htmlFor={`in-${question.id}-${test.id}`}>Input</label>
                <textarea
                  id={`in-${question.id}-${test.id}`}
                  className="mono"
                  spellCheck={false}
                  value={test.input}
                  onChange={(e) => patchTest(index, { input: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor={`out-${question.id}-${test.id}`}>Expected output</label>
                <textarea
                  id={`out-${question.id}-${test.id}`}
                  className="mono"
                  spellCheck={false}
                  value={test.expected}
                  onChange={(e) => patchTest(index, { expected: e.target.value })}
                />
              </div>
            </div>
            <div className="row">
              <label className="inline">
                <input
                  type="checkbox"
                  checked={test.hidden}
                  onChange={(e) => patchTest(index, { hidden: e.target.checked })}
                  style={{ width: "auto" }}
                />{" "}
                Hidden from candidates
              </label>
              <label className="inline" htmlFor={`weight-${question.id}-${test.id}`}>
                Weight
              </label>
              <input
                id={`weight-${question.id}-${test.id}`}
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
        ))}
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
        <p className="notice">
          Scored by the share of test weight passed. With no tests, a code answer is graded against its rubric instead.
        </p>
      </div>
    </>
  );
}
