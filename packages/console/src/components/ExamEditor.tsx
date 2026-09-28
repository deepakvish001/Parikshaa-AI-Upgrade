import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Eye, Library, Play, Plus, Trash2 } from "lucide-react";
import { validateExam, type Exam, type ExamCutoff, type ExamProblem, type ProctoringPolicy, type Question } from "@parikshaa/core/browser";
import { BankPicker, KIND_NAME, type BankLoader } from "./Bank.tsx";
import { QuestionView, TryTest } from "./Preview.tsx";
import { QuestionFields, blankQuestion, type ImageUploader } from "./QuestionFields.tsx";

interface Props {
  readonly initial?: Exam;
  readonly saving: boolean;
  readonly serverProblems: readonly ExamProblem[];
  readonly onSave: (exam: Exam) => void;
  readonly onCancel: () => void;
  /** Present when the account may read the bank, to add questions from it. */
  readonly loadBank?: BankLoader;
  /** Uploads a picture for a question or passage. */
  readonly uploadImage?: ImageUploader;
}

type Picking = { readonly into: "fixed" } | { readonly into: "section"; readonly index: number } | null;
type Tab = "questions" | "settings";

/** The marks a paper from this exam is out of: every fixed question, and each section's draw. */
export function paperMarks(exam: Exam): number {
  const fixed = exam.questions.reduce((sum, q) => sum + q.maxScore, 0);
  const drawn = (exam.sections ?? []).reduce((sum, s) => sum + s.pick * (s.pool[0]?.maxScore ?? 0), 0);
  return fixed + drawn;
}

const nextId = (exam: Exam): string => {
  const taken = new Set([...exam.questions, ...(exam.sections ?? []).flatMap((s) => s.pool)].map((q) => q.id as string));
  let n = exam.questions.length + 1;
  while (taken.has(`q${n}`)) n += 1;
  return `q${n}`;
};

const short = (stem: string) => (stem.trim() === "" ? "Untitled question" : stem.length > 110 ? `${stem.slice(0, 110)}…` : stem);

/**
 * Writing an exam, as a test platform lays it out: the paper as a list of
 * questions, each opened to edit or preview, moved up or down, or copied in
 * from the library; and beside it the settings — time, the qualifying mark,
 * the tools a candidate gets and what the camera does. "Try test" sits the
 * paper as a candidate would, and records nothing.
 */
export function ExamEditor({ initial, saving, serverProblems, onSave, onCancel, loadBank, uploadImage }: Props) {
  const [picking, setPicking] = useState<Picking>(null);
  const [tab, setTab] = useState<Tab>("questions");
  const [trying, setTrying] = useState(false);
  const [exam, setExam] = useState<Exam>(
    initial ?? {
      id: `exam-${Date.now()}` as Exam["id"],
      title: "",
      questions: [blankQuestion("q1")],
      policy: { durationMs: 60 * 60 * 1000, allowRevision: true, vivaTriggerRatio: 0.5 },
    },
  );
  // A new exam opens on its blank first question; a saved one as a list to scan.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(initial === undefined ? ["q1"] : []));
  const [previewing, setPreviewing] = useState<ReadonlySet<string>>(new Set());
  const [attempted, setAttempted] = useState(false);

  const validation = validateExam(exam);
  const problems: readonly ExamProblem[] =
    serverProblems.length > 0 ? serverProblems : validation.ok ? [] : validation.problems;
  const showProblems = attempted || serverProblems.length > 0;

  const patchQuestion = (index: number, next: Question) =>
    setExam((e) => ({ ...e, questions: e.questions.map((q, i) => (i === index ? next : q)) }));
  const move = (index: number, by: -1 | 1) =>
    setExam((e) => {
      const to = index + by;
      if (to < 0 || to >= e.questions.length) return e;
      const questions = [...e.questions];
      [questions[index], questions[to]] = [questions[to]!, questions[index]!];
      return { ...e, questions };
    });
  const toggle = (set: ReadonlySet<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const sections = exam.sections ?? [];
  type Section = (typeof sections)[number];
  const patchSection = (index: number, next: Section) =>
    setExam((e) => ({ ...e, sections: (e.sections ?? []).map((s, i) => (i === index ? next : s)) }));
  const onExam = new Set([...exam.questions, ...sections.flatMap((s) => s.pool)].map((q) => q.id as string));
  const setPolicy = (patch: Partial<Exam["policy"]>) => setExam((e) => ({ ...e, policy: { ...e.policy, ...patch } }));

  const addFromBank = (questions: readonly Question[]) => {
    if (picking?.into === "fixed") {
      setExam((e) => ({ ...e, questions: [...e.questions, ...questions] }));
    } else if (picking?.into === "section") {
      const section = sections[picking.index]!;
      patchSection(picking.index, { ...section, pool: [...section.pool, ...questions] });
    }
    setPicking(null);
  };

  const marks = paperMarks(exam);
  const count = exam.questions.length + sections.reduce((sum, s) => sum + s.pick, 0);
  const cutoff = exam.policy.cutoff;

  return (
    <form
      className="exam-editor"
      onSubmit={(event) => {
        event.preventDefault();
        setAttempted(true);
        if (validateExam(exam).ok) onSave(exam);
      }}
    >
      <section className="card editor-head">
        <div className="field">
          <label htmlFor="exam-title">Title</label>
          <input id="exam-title" value={exam.title} onChange={(e) => setExam({ ...exam, title: e.target.value })} />
        </div>
        <dl className="editor-facts" aria-label="This paper">
          <div>
            <dt>Questions</dt>
            <dd>{count}</dd>
          </div>
          <div>
            <dt>Marks</dt>
            <dd>{marks}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{Math.round(exam.policy.durationMs / 60000)} min</dd>
          </div>
          <div>
            <dt>Qualifying</dt>
            <dd>{cutoff === undefined ? "—" : `${cutoff.percent}%`}</dd>
          </div>
        </dl>
        <button type="button" className="secondary try-button" onClick={() => setTrying(true)}>
          <Play aria-hidden="true" />
          Try test
        </button>
      </section>
      {trying ? <TryTest exam={exam} onClose={() => setTrying(false)} /> : null}

      <div className="tabs" role="tablist" aria-label="Exam editor">
        {(
          [
            ["questions", "Questions"],
            ["settings", "Settings"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`editor-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`editor-panel-${id}`}
            className={`tab${tab === id ? " on" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="editor-panel-settings" aria-labelledby="editor-tab-settings" hidden={tab !== "settings"}>
        <section className="card">
          <h2 className="card-title">Timing and answers</h2>
          <div className="grid">
            <div className="field">
              <label htmlFor="duration">Duration (minutes)</label>
              <input
                id="duration"
                type="number"
                min={1}
                value={Math.round(exam.policy.durationMs / 60000)}
                onChange={(e) => setPolicy({ durationMs: Number(e.target.value) * 60000 })}
              />
            </div>

            <div className="field">
              <label htmlFor="revision">Revision</label>
              <select id="revision" value={String(exam.policy.allowRevision)} onChange={(e) => setPolicy({ allowRevision: e.target.value === "true" })}>
                <option value="true">Answers may be changed</option>
                <option value="false">Answers are final</option>
              </select>
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
                onChange={(e) => setPolicy({ vivaTriggerRatio: Number(e.target.value) })}
              />
              <p className="notice">
                Answers scoring at or above this fraction are followed up. Below it, the answer is already wrong and its provenance does not matter.
              </p>
            </div>
          </div>
        </section>

        <CutoffFields exam={exam} onChange={(next) => {
          const { cutoff: _, ...rest } = exam.policy;
          setExam({ ...exam, policy: next === undefined ? rest : { ...rest, cutoff: next } });
        }} />

        <section className="card">
          <h2 className="card-title">Candidate tools</h2>
          <fieldset className="grid">
            <legend className="visually-hidden">Candidate tools</legend>
            <label className="inline">
              <input type="checkbox" checked={exam.policy.calculator === true} onChange={(e) => setPolicy({ calculator: e.target.checked })} style={{ width: "auto" }} />{" "}
              Offer an on-screen scientific calculator
            </label>
          </fieldset>
          {[...exam.questions, ...sections.flatMap((s) => s.pool)].some((q) => q.kind === "code") ? (
            <fieldset className="grid code-policy">
              <legend>Coding questions</legend>
              <div className="field">
                <label htmlFor="test-feedback">Submit shows the candidate</label>
                <select
                  id="test-feedback"
                  value={exam.policy.testFeedback ?? "all"}
                  onChange={(e) => setPolicy({ testFeedback: e.target.value as "all" | "visible" })}
                >
                  <option value="all">Every test's verdict, hidden ones without their content</option>
                  <option value="visible">Only the visible tests; hidden ones after the test</option>
                </select>
              </div>
              <label className="inline" style={{ alignSelf: "end" }}>
                <input type="checkbox" checked={exam.policy.codeCompletion === true} onChange={(e) => setPolicy({ codeCompletion: e.target.checked })} style={{ width: "auto" }} />{" "}
                Offer completion in the code editor
              </label>
            </fieldset>
          ) : null}
        </section>

        <section className="card">
          <ProctoringFields
            value={exam.policy.proctoring}
            onChange={(proctoring) => {
              const { proctoring: _, ...rest } = exam.policy;
              setExam({ ...exam, policy: proctoring === undefined ? rest : { ...rest, proctoring } });
            }}
          />
        </section>
      </div>

      <div role="tabpanel" id="editor-panel-questions" aria-labelledby="editor-tab-questions" hidden={tab !== "questions"}>
        <div className="qlist-head">
          <strong>Every candidate gets</strong>
          <span className="notice">
            {exam.questions.length} question{exam.questions.length === 1 ? "" : "s"} · {exam.questions.reduce((s, q) => s + q.maxScore, 0)} marks
          </span>
          <span className="spacer" />
          {exam.questions.length > 1 ? (
            <button type="button" className="quiet" onClick={() => setOpen(open.size > 0 ? new Set() : new Set(exam.questions.map((q) => q.id as string)))}>
              {open.size > 0 ? "Collapse all" : "Expand all"}
            </button>
          ) : null}
        </div>

        <ol className="qlist">
          {exam.questions.map((question, index) => {
            const id = question.id as string;
            const editing = open.has(id);
            return (
              <li key={id}>
                <section className={`card qitem${editing ? " editing" : ""}`} aria-label={`Question ${index + 1}`}>
                  <div className="qitem-row">
                    <span className="qitem-num" aria-hidden="true">
                      {index + 1}
                    </span>
                    <span className="tag">{KIND_NAME[question.kind]}</span>
                    <button type="button" className="qitem-stem" onClick={() => setOpen(toggle(open, id))} aria-expanded={editing}>
                      {short(question.stem)}
                    </button>
                    <span className="qitem-marks">
                      {question.maxScore} mark{question.maxScore === 1 ? "" : "s"}
                    </span>
                    <span className="qitem-actions">
                      <button type="button" className="quiet icon" aria-label={`Move question ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                        <ArrowUp aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="quiet icon"
                        aria-label={`Move question ${index + 1} down`}
                        disabled={index === exam.questions.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="quiet icon"
                        aria-label={`Preview question ${index + 1}`}
                        aria-pressed={previewing.has(id)}
                        onClick={() => setPreviewing(toggle(previewing, id))}
                      >
                        <Eye aria-hidden="true" />
                      </button>
                      <button type="button" className="quiet" onClick={() => setOpen(toggle(open, id))}>
                        {editing ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                        {editing ? "Done" : "Edit"}
                      </button>
                      <button
                        type="button"
                        className="quiet icon danger-quiet"
                        aria-label={`Remove question ${index + 1}`}
                        disabled={exam.questions.length === 1 && sections.length === 0}
                        onClick={() => setExam((e) => ({ ...e, questions: e.questions.filter((_, i) => i !== index) }))}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </span>
                  </div>

                  {previewing.has(id) ? (
                    <div className="qitem-preview" aria-label={`Preview of question ${index + 1}`} role="group">
                      <QuestionView question={question} number={index + 1} />
                    </div>
                  ) : null}

                  {editing ? (
                    <div className="qitem-fields">
                      <QuestionFields
                        question={question}
                        onChange={(next) => patchQuestion(index, next)}
                        {...(uploadImage === undefined ? {} : { upload: uploadImage })}
                        {...(exam.questions[index - 1]?.passage === undefined ? {} : { previousPassage: exam.questions[index - 1]!.passage! })}
                      />
                    </div>
                  ) : null}
                </section>
              </li>
            );
          })}
        </ol>

        <div className="row">
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const id = nextId(exam);
              setExam((e) => ({ ...e, questions: [...e.questions, blankQuestion(id)] }));
              setOpen((o) => new Set([...o, id]));
            }}
          >
            <Plus aria-hidden="true" />
            Add question
          </button>
          {loadBank === undefined ? null : (
            <button type="button" className="secondary" onClick={() => setPicking({ into: "fixed" })}>
              <Library aria-hidden="true" />
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
                onClick={() =>
                  setExam((e) => {
                    const cutoff = e.policy.cutoff;
                    const { [section.id]: _, ...minimums } = cutoff?.sections ?? {};
                    const { sections: __, ...overall } = cutoff ?? { percent: 0 };
                    return {
                      ...e,
                      sections: (e.sections ?? []).filter((_, i) => i !== index),
                      policy:
                        cutoff === undefined ? e.policy : { ...e.policy, cutoff: Object.keys(minimums).length === 0 ? overall : { ...overall, sections: minimums } },
                    };
                  })
                }
              >
                Remove section
              </button>
            </div>
            <div className="grid">
              <div className="field">
                <label htmlFor={`section-title-${section.id}`}>Section title</label>
                <input id={`section-title-${section.id}`} value={section.title} onChange={(e) => patchSection(index, { ...section, title: e.target.value })} />
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
              <div className="field">
                <label htmlFor={`section-time-${section.id}`}>Own time (minutes)</label>
                <input
                  id={`section-time-${section.id}`}
                  type="number"
                  min={1}
                  placeholder="None"
                  value={section.durationMs === undefined ? "" : section.durationMs / 60_000}
                  onChange={(e) => {
                    const { durationMs: _, ...rest } = section;
                    patchSection(index, e.target.value === "" ? rest : { ...rest, durationMs: Number(e.target.value) * 60_000 });
                  }}
                />
              </div>
            </div>
            <p className="notice">
              Each candidate draws {section.pick} of these {section.pool.length}. Every question in the pool must carry the same marks, so every paper is
              worth the same.
              {section.durationMs === undefined
                ? null
                : ` Once any section has its own time, the test is taken section by section, in order: each is locked once left, and closes when its ${section.durationMs / 60_000} minutes are up.`}
            </p>
            <ul className="pool">
              {section.pool.map((question) => (
                <li key={question.id}>
                  <span className="tag">{KIND_NAME[question.kind]}</span> <span>{question.stem}</span>{" "}
                  <span className="notice">· {question.maxScore} marks</span>{" "}
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
                  <Library aria-hidden="true" />
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

      <div className="row editor-actions">
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

/**
 * The qualifying mark: a share of the whole paper and, for a sectioned exam,
 * optionally of each part. Results then say who qualified; a person still
 * decides what happens next.
 */
function CutoffFields({ exam, onChange }: { exam: Exam; onChange: (next: ExamCutoff | undefined) => void }) {
  const cutoff = exam.policy.cutoff;
  const sections = exam.sections ?? [];
  const parts = sections.length === 0 ? [] : [...(exam.questions.length > 0 ? [{ id: "", title: "General (every candidate's questions)" }] : []), ...sections.map((s) => ({ id: s.id, title: s.title || s.id }))];
  const setSection = (id: string, value: string) => {
    if (cutoff === undefined) return;
    const { [id]: _, ...rest } = cutoff.sections ?? {};
    const next = value === "" ? rest : { ...rest, [id]: Number(value) };
    const { sections: __, ...base } = cutoff;
    onChange(Object.keys(next).length === 0 ? base : { ...base, sections: next });
  };
  return (
    <section className="card">
      <h2 className="card-title">Qualifying mark</h2>
      <label className="inline">
        <input type="checkbox" checked={cutoff !== undefined} onChange={(e) => onChange(e.target.checked ? { percent: 60 } : undefined)} style={{ width: "auto" }} /> Set a
        qualifying mark
      </label>
      {cutoff === undefined ? (
        <p className="notice">Off: results show marks only, with no one marked as qualified or not.</p>
      ) : (
        <>
          <div className="grid">
            <div className="field">
              <label htmlFor="cutoff-percent">Qualifying mark (% of the paper)</label>
              <input id="cutoff-percent" type="number" min={0} max={100} step={0.5} value={cutoff.percent} onChange={(e) => onChange({ ...cutoff, percent: Number(e.target.value) })} />
            </div>
            {parts.map((part) => (
              <div className="field" key={part.id}>
                <label htmlFor={`cutoff-section-${part.id || "general"}`}>Minimum in {part.title} (%)</label>
                <input
                  id={`cutoff-section-${part.id || "general"}`}
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  placeholder="None"
                  value={cutoff.sections?.[part.id] ?? ""}
                  onChange={(e) => setSection(part.id, e.target.value)}
                />
              </div>
            ))}
          </div>
          <p className="notice">
            A candidate qualifies at {cutoff.percent}% or more of their paper
            {Object.keys(cutoff.sections ?? {}).length > 0 ? ", and the minimum in every section that has one" : ""}. Results and the scorecard say
            Qualified or Not qualified; nothing is sent to anyone because of it.
          </p>
        </>
      )}
    </section>
  );
}

/**
 * Camera proctoring (ROADMAP §14), off unless the author turns it on. Each
 * piece is an observation for a person; candidates are told exactly what is
 * taken before their clock starts.
 */
function ProctoringFields({ value, onChange }: { value: ProctoringPolicy | undefined; onChange: (next: ProctoringPolicy | undefined) => void }) {
  const on = value !== undefined;
  const policy: ProctoringPolicy = value ?? { identity: true, snapshotEverySeconds: 60, browserEvents: true };
  return (
    <fieldset className="proctoring">
      <legend>Proctoring</legend>
      <label className="inline">
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? policy : undefined)} /> Use the candidate's camera
      </label>
      {on ? (
        <div className="grid">
          <label className="inline">
            <input type="checkbox" checked={policy.identity} onChange={(e) => onChange({ ...policy, identity: e.target.checked })} /> Photo of the candidate and
            their ID before they start
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={policy.snapshotEverySeconds !== null}
              onChange={(e) => onChange({ ...policy, snapshotEverySeconds: e.target.checked ? 60 : null })}
            />{" "}
            Webcam photos while they answer
          </label>
          {policy.snapshotEverySeconds === null ? null : (
            <div className="field">
              <label htmlFor="snapshot-every">Every (seconds)</label>
              <input
                id="snapshot-every"
                type="number"
                min={15}
                max={900}
                value={policy.snapshotEverySeconds}
                onChange={(e) => onChange({ ...policy, snapshotEverySeconds: Number(e.target.value) })}
              />
            </div>
          )}
          <label className="inline">
            <input type="checkbox" checked={policy.browserEvents} onChange={(e) => onChange({ ...policy, browserEvents: e.target.checked })} /> Record leaving
            the tab or full screen, copy and paste
          </label>
        </div>
      ) : (
        <p className="notice">Off: the test uses no camera, and records nothing about the candidate's browser.</p>
      )}
      {on ? <p className="notice">Candidates are told all of this before their clock starts. Nothing here marks anyone down by itself.</p> : null}
    </fieldset>
  );
}
