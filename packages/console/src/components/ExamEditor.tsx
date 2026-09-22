import { useState } from "react";
import { validateExam, type Exam, type ExamProblem, type Question } from "@parikshaa/core/browser";
import { BankPicker, type BankLoader } from "./Bank.tsx";
import { QuestionFields, blankQuestion } from "./QuestionFields.tsx";

interface Props {
  readonly initial?: Exam;
  readonly saving: boolean;
  readonly serverProblems: readonly ExamProblem[];
  readonly onSave: (exam: Exam) => void;
  readonly onCancel: () => void;
  /** Present when the account may read the bank, to add questions from it. */
  readonly loadBank?: BankLoader;
}

type Picking = { readonly into: "fixed" } | { readonly into: "section"; readonly index: number } | null;

export function ExamEditor({ initial, saving, serverProblems, onSave, onCancel, loadBank }: Props) {
  const [picking, setPicking] = useState<Picking>(null);
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

  const sections = exam.sections ?? [];
  type Section = (typeof sections)[number];
  const patchSection = (index: number, next: Section) =>
    setExam((e) => ({ ...e, sections: (e.sections ?? []).map((s, i) => (i === index ? next : s)) }));
  const onExam = new Set([...exam.questions, ...sections.flatMap((s) => s.pool)].map((q) => q.id as string));

  const addFromBank = (questions: readonly Question[]) => {
    if (picking?.into === "fixed") {
      setExam((e) => ({ ...e, questions: [...e.questions, ...questions] }));
    } else if (picking?.into === "section") {
      const section = sections[picking.index]!;
      patchSection(picking.index, { ...section, pool: [...section.pool, ...questions] });
    }
    setPicking(null);
  };

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
              disabled={exam.questions.length === 1 && sections.length === 0}
              onClick={() =>
                setExam((e) => ({ ...e, questions: e.questions.filter((_, i) => i !== index) }))
              }
            >
              Remove
            </button>
          </div>

          <QuestionFields question={question} onChange={(next) => patchQuestion(index, next)} />
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
        {loadBank === undefined ? null : (
          <button type="button" className="secondary" onClick={() => setPicking({ into: "fixed" })}>
            Add from bank
          </button>
        )}
      </div>
      {picking?.into === "fixed" && loadBank !== undefined ? (
        <BankPicker load={loadBank} exclude={onExam} onPick={addFromBank} onClose={() => setPicking(null)} />
      ) : null}

      {/*
       * Sections: each candidate draws `pick` questions from the pool, seeded
       * by their attempt, so neighbours sit different papers. The pool is a
       * copy; questions in it are edited in the bank and added again.
       */}
      {sections.map((section, index) => (
        <section className="card" key={section.id} aria-label={`Section ${index + 1}`}>
          <div className="bar">
            <strong>Section {index + 1}</strong>
            <span className="spacer" />
            <button
              type="button"
              className="quiet"
              onClick={() => setExam((e) => ({ ...e, sections: (e.sections ?? []).filter((_, i) => i !== index) }))}
            >
              Remove section
            </button>
          </div>
          <div className="grid">
            <div className="field">
              <label htmlFor={`section-title-${section.id}`}>Section title</label>
              <input
                id={`section-title-${section.id}`}
                value={section.title}
                onChange={(e) => patchSection(index, { ...section, title: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor={`section-pick-${section.id}`}>Questions per candidate</label>
              <input
                id={`section-pick-${section.id}`}
                type="number"
                min={1}
                max={Math.max(1, section.pool.length)}
                value={section.pick}
                onChange={(e) => patchSection(index, { ...section, pick: Number(e.target.value) })}
              />
            </div>
          </div>
          <p className="notice">
            Each candidate draws {section.pick} of these {section.pool.length}. Every question in the pool must carry the
            same marks, so every paper is worth the same.
          </p>
          <ul className="pool">
            {section.pool.map((question) => (
              <li key={question.id}>
                <span>{question.stem}</span> <span className="notice">· {question.maxScore} marks</span>{" "}
                <button
                  type="button"
                  className="quiet"
                  aria-label={`Remove "${question.stem}" from the pool`}
                  onClick={() => patchSection(index, { ...section, pool: section.pool.filter((q) => q.id !== question.id) })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          {loadBank === undefined ? null : (
            <div className="row">
              <button type="button" className="secondary" onClick={() => setPicking({ into: "section", index })}>
                Add from bank
              </button>
            </div>
          )}
          {picking?.into === "section" && picking.index === index && loadBank !== undefined ? (
            <BankPicker load={loadBank} exclude={onExam} onPick={addFromBank} onClose={() => setPicking(null)} />
          ) : null}
        </section>
      ))}

      <div className="row">
        <button
          type="button"
          className="secondary"
          onClick={() =>
            setExam((e) => ({
              ...e,
              sections: [...(e.sections ?? []), { id: `s${(e.sections ?? []).length + 1}`, title: "", pick: 1, pool: [] }],
            }))
          }
        >
          Add a section drawn per candidate
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
