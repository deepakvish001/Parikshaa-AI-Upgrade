import type { Question, QuestionKind, RubricCriterion } from "@parikshaa/core/browser";
import { CodeFields } from "./CodeFields.tsx";

/** Swap a question's kind, replacing the fields that do not carry across. */
export function changeKind(question: Question, kind: QuestionKind): Question {
  const base = { id: question.id, stem: question.stem, maxScore: question.maxScore, rubric: question.rubric };
  switch (kind) {
    case "mcq":
      return { ...base, kind, options: ["", ""], correctIndex: 0 };
    case "numeric":
      return { ...base, kind, expected: 0, tolerance: 0 };
    case "short":
      return { ...base, kind, expectedPoints: [] };
    case "code":
      return {
        ...base,
        kind,
        language: "python",
        languages: ["python", "cpp", "java"],
        tests: [
          { id: "t1", input: "", expected: "", hidden: false, weight: 1 },
          { id: "t2", input: "", expected: "", hidden: true, weight: 1 },
        ],
      };
  }
}

export const blankQuestion = (id: string): Question => ({
  id: id as Question["id"],
  kind: "mcq",
  stem: "",
  maxScore: 1,
  rubric: [],
  options: ["", ""],
  correctIndex: 0,
});

/**
 * The fields of one question, answer key included.
 *
 * Shared by the exam editor and the question bank, so a question is written
 * the same way wherever it is written.
 */
export function QuestionFields({ question, onChange }: { question: Question; onChange: (next: Question) => void }) {
  const setRubric = (rubric: readonly RubricCriterion[]) => onChange({ ...question, rubric } as Question);

  return (
    <>
      <div className="field">
        <label htmlFor={`stem-${question.id}`}>Question</label>
        <textarea
          id={`stem-${question.id}`}
          value={question.stem}
          onChange={(e) => onChange({ ...question, stem: e.target.value })}
        />
      </div>

      <div className="grid">
        <div className="field">
          <label htmlFor={`kind-${question.id}`}>Type</label>
          <select
            id={`kind-${question.id}`}
            value={question.kind}
            onChange={(e) => onChange(changeKind(question, e.target.value as QuestionKind))}
          >
            <option value="mcq">Multiple choice</option>
            <option value="numeric">Numeric</option>
            <option value="short">Short answer</option>
            <option value="code">Code</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor={`marks-${question.id}`}>Marks</label>
          <input
            id={`marks-${question.id}`}
            type="number"
            min={1}
            value={question.maxScore}
            onChange={(e) => onChange({ ...question, maxScore: Number(e.target.value) })}
          />
        </div>
      </div>

      {question.kind === "mcq" ? (
        <div className="field">
          <label>Options — select the correct one</label>
          {question.options.map((option, optionIndex) => (
            <div className="row" key={optionIndex} style={{ marginTop: ".35rem" }}>
              <input
                type="radio"
                name={`correct-${question.id}`}
                aria-label={`Option ${optionIndex + 1} is correct`}
                checked={question.correctIndex === optionIndex}
                onChange={() => onChange({ ...question, correctIndex: optionIndex })}
                style={{ width: "auto" }}
              />
              <input
                aria-label={`Option ${optionIndex + 1}`}
                value={option}
                onChange={(e) =>
                  onChange({
                    ...question,
                    options: question.options.map((o, i) => (i === optionIndex ? e.target.value : o)),
                  })
                }
              />
            </div>
          ))}
          <div className="row">
            <button
              type="button"
              className="secondary"
              onClick={() => onChange({ ...question, options: [...question.options, ""] })}
            >
              Add option
            </button>
          </div>
        </div>
      ) : null}

      {question.kind === "numeric" ? (
        <div className="grid">
          <div className="field">
            <label htmlFor={`exp-${question.id}`}>Expected value</label>
            <input
              id={`exp-${question.id}`}
              type="number"
              step="any"
              value={question.expected}
              onChange={(e) => onChange({ ...question, expected: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor={`tol-${question.id}`}>Tolerance (±)</label>
            <input
              id={`tol-${question.id}`}
              type="number"
              step="any"
              min={0}
              value={question.tolerance}
              onChange={(e) => onChange({ ...question, tolerance: Number(e.target.value) })}
            />
          </div>
        </div>
      ) : null}

      {question.kind === "code" ? <CodeFields question={question} onChange={onChange} /> : null}

      {question.kind === "short" || question.kind === "code" ? (
        <div className="field">
          <label>Rubric — what a grader must justify against</label>
          {question.rubric.map((criterion, criterionIndex) => (
            <div className="row" key={criterion.id} style={{ marginTop: ".35rem" }}>
              <input
                aria-label={`Criterion ${criterionIndex + 1}`}
                value={criterion.description}
                onChange={(e) =>
                  setRubric(
                    question.rubric.map((c, i) =>
                      i === criterionIndex ? { ...c, description: e.target.value } : c,
                    ),
                  )
                }
              />
              <input
                aria-label={`Criterion ${criterionIndex + 1} weight`}
                type="number"
                min={1}
                style={{ width: "5rem" }}
                value={criterion.weight}
                onChange={(e) =>
                  setRubric(
                    question.rubric.map((c, i) =>
                      i === criterionIndex ? { ...c, weight: Number(e.target.value) } : c,
                    ),
                  )
                }
              />
            </div>
          ))}
          <div className="row">
            <button
              type="button"
              className="secondary"
              onClick={() =>
                setRubric([
                  ...question.rubric,
                  { id: `c${question.rubric.length + 1}`, description: "", weight: 1 },
                ])
              }
            >
              Add criterion
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
