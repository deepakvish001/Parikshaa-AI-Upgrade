import { useState } from "react";
import { validateExam, type Exam, type ExamProblem, type Question, type QuestionKind, type RubricCriterion } from "@parikshaa/core/browser";

interface Props {
  readonly initial?: Exam;
  readonly saving: boolean;
  readonly serverProblems: readonly ExamProblem[];
  readonly onSave: (exam: Exam) => void;
  readonly onCancel: () => void;
}

const blankQuestion = (id: string): Question => ({
  id: id as Question["id"],
  kind: "mcq",
  stem: "",
  maxScore: 1,
  rubric: [],
  options: ["", ""],
  correctIndex: 0,
});

/** Swap a question's kind, replacing the fields that do not carry across. */
function changeKind(question: Question, kind: QuestionKind): Question {
  const base = { id: question.id, stem: question.stem, maxScore: question.maxScore, rubric: question.rubric };
  switch (kind) {
    case "mcq":
      return { ...base, kind, options: ["", ""], correctIndex: 0 };
    case "numeric":
      return { ...base, kind, expected: 0, tolerance: 0 };
    case "short":
      return { ...base, kind, expectedPoints: [] };
    case "code":
      return { ...base, kind, language: "python" };
  }
}

export function ExamEditor({ initial, saving, serverProblems, onSave, onCancel }: Props) {
  const [exam, setExam] = useState<Exam>(
    initial ?? {
      id: `exam-${Date.now()}` as Exam["id"],
      title: "",
      questions: [blankQuestion("q1")],
      policy: { durationMs: 60 * 60 * 1000, allowRevision: true, vivaTriggerRatio: 0.5 },
    },
  );
  const [attempted, setAttempted] = useState(false);

  const validation = validateExam(exam);
  const problems: readonly ExamProblem[] =
    serverProblems.length > 0 ? serverProblems : validation.ok ? [] : validation.problems;
  const showProblems = attempted || serverProblems.length > 0;

  const patchQuestion = (index: number, next: Question) =>
    setExam((e) => ({ ...e, questions: e.questions.map((q, i) => (i === index ? next : q)) }));

  const patchRubric = (index: number, rubric: readonly RubricCriterion[]) =>
    patchQuestion(index, { ...exam.questions[index]!, rubric } as Question);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setAttempted(true);
        if (validateExam(exam).ok) onSave(exam);
      }}
    >
      <section className="card">
        <div className="field">
          <label htmlFor="exam-title">Title</label>
          <input
            id="exam-title"
            value={exam.title}
            onChange={(e) => setExam({ ...exam, title: e.target.value })}
          />
        </div>

        <div className="grid">
          <div className="field">
            <label htmlFor="duration">Duration (minutes)</label>
            <input
              id="duration"
              type="number"
              min={1}
              value={Math.round(exam.policy.durationMs / 60000)}
              onChange={(e) =>
                setExam({
                  ...exam,
                  policy: { ...exam.policy, durationMs: Number(e.target.value) * 60000 },
                })
              }
            />
          </div>

          <div className="field">
            <label htmlFor="ratio">Viva trigger ratio</label>
            <input
              id="ratio"
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={exam.policy.vivaTriggerRatio}
              onChange={(e) =>
                setExam({
                  ...exam,
                  policy: { ...exam.policy, vivaTriggerRatio: Number(e.target.value) },
                })
              }
            />
            <p className="notice">
              Answers scoring at or above this fraction are followed up. Below it, the
              answer is already wrong and its provenance does not matter.
            </p>
          </div>

          <div className="field">
            <label htmlFor="revision">Revision</label>
            <select
              id="revision"
              value={String(exam.policy.allowRevision)}
              onChange={(e) =>
                setExam({
                  ...exam,
                  policy: { ...exam.policy, allowRevision: e.target.value === "true" },
                })
              }
            >
              <option value="true">Answers may be changed</option>
              <option value="false">Answers are final</option>
            </select>
          </div>
        </div>
      </section>

      {exam.questions.map((question, index) => (
        <section className="card" key={question.id} aria-label={`Question ${index + 1}`}>
          <div className="bar">
            <strong>Question {index + 1}</strong>
            <span className="spacer" />
            <button
              type="button"
              className="quiet"
              disabled={exam.questions.length === 1}
              onClick={() =>
                setExam((e) => ({ ...e, questions: e.questions.filter((_, i) => i !== index) }))
              }
            >
              Remove
            </button>
          </div>

          <div className="field">
            <label htmlFor={`stem-${question.id}`}>Question</label>
            <textarea
              id={`stem-${question.id}`}
              value={question.stem}
              onChange={(e) => patchQuestion(index, { ...question, stem: e.target.value })}
            />
          </div>

          <div className="grid">
            <div className="field">
              <label htmlFor={`kind-${question.id}`}>Type</label>
              <select
                id={`kind-${question.id}`}
                value={question.kind}
                onChange={(e) => patchQuestion(index, changeKind(question, e.target.value as QuestionKind))}
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
                onChange={(e) => patchQuestion(index, { ...question, maxScore: Number(e.target.value) })}
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
                    onChange={() => patchQuestion(index, { ...question, correctIndex: optionIndex })}
                    style={{ width: "auto" }}
                  />
                  <input
                    aria-label={`Option ${optionIndex + 1}`}
                    value={option}
                    onChange={(e) =>
                      patchQuestion(index, {
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
                  onClick={() => patchQuestion(index, { ...question, options: [...question.options, ""] })}
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
                  onChange={(e) => patchQuestion(index, { ...question, expected: Number(e.target.value) })}
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
                  onChange={(e) => patchQuestion(index, { ...question, tolerance: Number(e.target.value) })}
                />
              </div>
            </div>
          ) : null}

          {question.kind === "code" ? (
            <div className="field">
              <label htmlFor={`lang-${question.id}`}>Language</label>
              <input
                id={`lang-${question.id}`}
                value={question.language}
                onChange={(e) => patchQuestion(index, { ...question, language: e.target.value })}
              />
            </div>
          ) : null}

          {question.kind === "short" || question.kind === "code" ? (
            <div className="field">
              <label>Rubric — what a grader must justify against</label>
              {question.rubric.map((criterion, criterionIndex) => (
                <div className="row" key={criterion.id} style={{ marginTop: ".35rem" }}>
                  <input
                    aria-label={`Criterion ${criterionIndex + 1}`}
                    value={criterion.description}
                    onChange={(e) =>
                      patchRubric(
                        index,
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
                      patchRubric(
                        index,
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
                    patchRubric(index, [
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
        </section>
      ))}

      <div className="row">
        <button
          type="button"
          className="secondary"
          onClick={() =>
            setExam((e) => ({ ...e, questions: [...e.questions, blankQuestion(`q${e.questions.length + 1}`)] }))
          }
        >
          Add question
        </button>
      </div>

      {showProblems && problems.length > 0 ? (
        <ul className="problems" aria-label="Problems with this exam">
          {problems.map((problem) => (
            <li key={`${problem.path}:${problem.message}`}>
              <span className="mono">{problem.path}</span> — {problem.message}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="row">
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save exam"}
        </button>
        <button type="button" className="quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
