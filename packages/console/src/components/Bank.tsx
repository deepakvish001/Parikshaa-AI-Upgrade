import { useRef, useState } from "react";
import { Drawer } from "@parikshaa/brand/ui";
import { Library, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { validateQuestion, type ExamProblem, type Question } from "@parikshaa/core/browser";
import { base64Of, ConsoleError, type BankEntry, type BankFilter, type ConsoleClient, type Difficulty, type DocxImport } from "../api.ts";
import { QuestionFields, blankQuestion } from "./QuestionFields.tsx";

/**
 * The question bank (ROADMAP §3).
 *
 * Questions are written once, filed by topic and difficulty, and copied into
 * exams. Editing one here changes no exam already built from it.
 */

const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

/** What each kind of question is called in a list. */
export const KIND_NAME: Record<Question["kind"], string> = { mcq: "Multiple choice", short: "Written", numeric: "Numeric", code: "Coding" };

const summary = (q: Question) => (q.stem.length > 90 ? `${q.stem.slice(0, 90)}…` : q.stem);

function Filters({
  filter,
  topics,
  onChange,
}: {
  filter: BankFilter;
  topics: readonly string[];
  onChange: (next: BankFilter) => void;
}) {
  return (
    <div className="grid">
      <div className="field">
        <label htmlFor="bank-topic">Topic</label>
        <select
          id="bank-topic"
          value={filter.topic ?? ""}
          onChange={(e) => onChange({ ...filter, topic: e.target.value })}
        >
          <option value="">Any</option>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="bank-difficulty">Difficulty</label>
        <select
          id="bank-difficulty"
          value={filter.difficulty ?? ""}
          onChange={(e) =>
            onChange(
              e.target.value === ""
                ? { ...(filter.topic === undefined ? {} : { topic: filter.topic }), ...(filter.q === undefined ? {} : { q: filter.q }) }
                : { ...filter, difficulty: e.target.value as Difficulty },
            )
          }
        >
          <option value="">Any</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="bank-search">Search</label>
        <input id="bank-search" value={filter.q ?? ""} onChange={(e) => onChange({ ...filter, q: e.target.value })} />
      </div>
    </div>
  );
}

// --- the bank page ------------------------------------------------------------

export function BankPanel({ client, canWrite }: { client: ConsoleClient; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<BankFilter>({});
  const [editing, setEditing] = useState<BankEntry | "new" | null>(null);
  const [imported, setImported] = useState<string | null>(null);
  const [importProblems, setImportProblems] = useState<readonly ExamProblem[]>([]);

  const bank = useQuery({ queryKey: ["bank", filter], queryFn: () => client.listBank(filter) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["bank"] });

  const archive = useMutation({ mutationFn: (id: string) => client.archiveQuestion(id), onSettled: refresh });
  const importCsv = useMutation({
    mutationFn: (csv: string) => client.importBank(csv),
    onSuccess: async (count) => {
      setImportProblems([]);
      setImported(`Imported ${count} question${count === 1 ? "" : "s"}.`);
      await refresh();
    },
    onError: (error) => {
      setImported(null);
      setImportProblems(error instanceof ConsoleError ? error.problems : [{ path: "", message: "The import failed." }]);
    },
  });

  if (editing !== null) {
    return (
      <BankEditor
        client={client}
        entry={editing === "new" ? null : editing}
        topics={bank.data?.topics ?? []}
        onDone={async () => {
          setEditing(null);
          await refresh();
        }}
      />
    );
  }

  return (
    <>
      <section className="card" aria-label="Question bank">
        <div className="bar">
          <strong>Question bank</strong>
          <span className="spacer" />
          {canWrite ? (
            <button type="button" onClick={() => setEditing("new")}>
              New question
            </button>
          ) : null}
        </div>
        <Filters filter={filter} topics={bank.data?.topics ?? []} onChange={setFilter} />

        {bank.data === undefined ? (
          <p className="notice">Loading…</p>
        ) : bank.data.questions.length === 0 ? (
          <p className="notice">No questions match.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Question</th>
                <th scope="col">Type</th>
                <th scope="col">Marks</th>
                <th scope="col">Topic</th>
                <th scope="col">Difficulty</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {bank.data.questions.map((entry) => (
                <tr key={entry.id}>
                  <td>{summary(entry.question)}</td>
                  <td>{entry.question.kind}</td>
                  <td>{entry.question.maxScore}</td>
                  <td>{entry.topic}</td>
                  <td>{entry.difficulty}</td>
                  <td>
                    {canWrite ? (
                      <>
                        <button type="button" className="quiet" onClick={() => setEditing(entry)}>
                          Edit
                        </button>{" "}
                        <button type="button" className="quiet" onClick={() => archive.mutate(entry.id)}>
                          Archive
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {canWrite ? (
        <section className="card" aria-label="Import questions">
          <strong>Import from a spreadsheet</strong>
          <p className="notice">
            Save the sheet as CSV. One question per row under a header row with the columns <span className="mono">kind</span>{" "}
            (mcq, numeric or short), <span className="mono">question</span>, <span className="mono">options</span> (separated
            by |), <span className="mono">answer</span>, <span className="mono">marks</span>, <span className="mono">topic</span>,{" "}
            <span className="mono">difficulty</span>, <span className="mono">tags</span>. Any problem imports nothing, and
            every problem is listed by row.
          </p>
          <div className="field">
            <label htmlFor="bank-import">CSV file</label>
            <input
              id="bank-import"
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file !== undefined) importCsv.mutate(await file.text());
                e.target.value = "";
              }}
            />
          </div>
          {imported === null ? null : <p className="notice" role="status">{imported}</p>}
          {importProblems.length === 0 ? null : (
            <ul className="problems" aria-label="Problems with this file">
              {importProblems.map((p) => (
                <li key={`${p.path}:${p.message}`}>
                  <span className="mono">{p.path}</span> — {p.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {canWrite ? <WordImport client={client} onImported={refresh} /> : null}
    </>
  );
}

// --- importing a Word question paper ---------------------------------------------

/**
 * A question paper typed in Word. The file is read first without adding
 * anything, so the teacher sees what it became — and anything left out, such
 * as a picture — before the bank changes.
 */
function WordImport({ client, onImported }: { client: ConsoleClient; onImported: () => Promise<unknown> }) {
  const [file, setFile] = useState<{ name: string; data: string } | null>(null);
  const [preview, setPreview] = useState<DocxImport["preview"] | null>(null);
  const [problems, setProblems] = useState<readonly ExamProblem[]>([]);
  const [done, setDone] = useState<string | null>(null);

  const failed = (error: unknown) => {
    setPreview(null);
    setProblems(error instanceof ConsoleError && error.problems.length > 0 ? error.problems : [{ path: "", message: "The file could not be read." }]);
  };
  const check = useMutation({
    mutationFn: (data: string) => client.importDocx(data, true),
    onSuccess: (result) => {
      setProblems([]);
      setPreview(result.preview);
    },
    onError: failed,
  });
  const commit = useMutation({
    mutationFn: (data: string) => client.importDocx(data, false),
    onSuccess: async (result) => {
      setPreview(null);
      setFile(null);
      setDone(`Imported ${result.imported} question${result.imported === 1 ? "" : "s"} from the document.`);
      await onImported();
    },
    onError: failed,
  });

  return (
    <section className="card" aria-label="Import from Word">
      <strong>Import from a Word document</strong>
      <p className="notice">
        Type the paper as usual: number each question (<span className="mono">1.</span> or Word's numbered list), letter its
        options (<span className="mono">a)</span>), then an <span className="mono">Answer:</span> line — or mark the right
        option with <span className="mono">*</span>. Optional lines: <span className="mono">Marks:</span>,{" "}
        <span className="mono">Topic:</span>, <span className="mono">Difficulty:</span>, <span className="mono">Tags:</span>,{" "}
        <span className="mono">Type:</span>, <span className="mono">Negative:</span>. Several right options:{" "}
        <span className="mono">Answer: a, c</span>. Pictures pasted into the paper come with their question, and a{" "}
        <span className="mono">Passage:</span> line starts a passage for the questions after it. You will see every question
        before anything is added.
      </p>
      <div className="field">
        <label htmlFor="bank-import-docx">Word file (.docx)</label>
        <input
          id="bank-import-docx"
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={async (e) => {
            const chosen = e.target.files?.[0];
            e.target.value = "";
            if (chosen === undefined) return;
            setDone(null);
            const data = await base64Of(chosen);
            setFile({ name: chosen.name, data });
            check.mutate(data);
          }}
        />
      </div>
      {check.isPending ? <p className="notice">Reading {file?.name}…</p> : null}
      {done === null ? null : (
        <p className="notice" role="status">
          {done}
        </p>
      )}
      {problems.length === 0 ? null : (
        <ul className="problems" aria-label="Problems with this document">
          {problems.map((p) => (
            <li key={`${p.path}:${p.message}`}>
              <span className="mono">{p.path}</span> — {p.message}
            </li>
          ))}
        </ul>
      )}
      {preview === null || file === null ? null : (
        <>
          <table aria-label="Questions found">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Question</th>
                <th scope="col">Type</th>
                <th scope="col">Marks</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((q) => (
                <tr key={q.question}>
                  <td>{q.question}</td>
                  <td>
                    {q.stem}
                    {q.passage === null && q.pictures === 0 ? null : (
                      <div className="notice">
                        {[q.passage === null ? null : `Passage: ${q.passage}`, q.pictures === 0 ? null : `${q.pictures} picture${q.pictures === 1 ? "" : "s"}`]
                          .filter((x) => x !== null)
                          .join(" · ")}
                      </div>
                    )}
                    {q.note === null ? null : <div className="notice">{q.note}</div>}
                  </td>
                  <td>{q.kind}</td>
                  <td>{q.marks}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bar">
            <button type="button" onClick={() => commit.mutate(file.data)} disabled={commit.isPending}>
              Add {preview.length} question{preview.length === 1 ? "" : "s"} to the bank
            </button>
            <button
              type="button"
              className="quiet"
              onClick={() => {
                setPreview(null);
                setFile(null);
              }}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// --- writing one question -----------------------------------------------------

function BankEditor({
  client,
  entry,
  topics,
  onDone,
}: {
  client: ConsoleClient;
  entry: BankEntry | null;
  topics: readonly string[];
  onDone: () => void;
}) {
  const [question, setQuestion] = useState<Question>(entry?.question ?? blankQuestion("new"));
  const [topic, setTopic] = useState(entry?.topic ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>(entry?.difficulty ?? "medium");
  const [tags, setTags] = useState((entry?.tags ?? []).join(", "));
  const [attempted, setAttempted] = useState(false);

  const problems = validateQuestion(question, "question");
  const save = useMutation({
    mutationFn: () => {
      const { id: _, ...body } = question;
      const draft = {
        question: body,
        topic,
        difficulty,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t !== ""),
      };
      return entry === null ? client.fileQuestion(draft) : client.editQuestion(entry.id, draft);
    },
    onSuccess: onDone,
  });

  return (
    <form
      aria-label={entry === null ? "New question" : "Edit question"}
      onSubmit={(e) => {
        e.preventDefault();
        setAttempted(true);
        if (problems.length === 0) save.mutate();
      }}
    >
      <section className="card">
        <QuestionFields question={question} onChange={setQuestion} upload={(file) => client.uploadImage(file)} />
        <div className="grid">
          <div className="field">
            <label htmlFor="q-topic">Topic</label>
            <input id="q-topic" list="bank-topics" value={topic} onChange={(e) => setTopic(e.target.value)} />
            <datalist id="bank-topics">
              {topics.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="q-difficulty">Difficulty</label>
            <select id="q-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="q-tags">Tags, comma separated</label>
            <input id="q-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
        </div>
        {entry === null ? null : (
          <p className="notice">Exams already built from this question keep their own copy; this edit does not reach them.</p>
        )}
      </section>

      {attempted && problems.length > 0 ? (
        <ul className="problems" aria-label="Problems with this question">
          {problems.map((p) => (
            <li key={`${p.path}:${p.message}`}>{p.message}</li>
          ))}
        </ul>
      ) : null}
      {save.error === null ? null : <p className="error" role="alert">{save.error.message}</p>}

      <div className="row">
        <button type="submit" disabled={save.isPending}>
          Save to bank
        </button>
        <button type="button" className="quiet" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// --- choosing questions for an exam -------------------------------------------

export type BankLoader = (filter: BankFilter) => Promise<{
  readonly questions: readonly BankEntry[];
  readonly topics: readonly string[];
}>;

/**
 * Choose questions from the bank to copy into an exam. What is added is a copy:
 * the exam will not change when the bank does.
 */
export function BankPicker({
  load,
  exclude,
  onPick,
  onClose,
}: {
  load: BankLoader;
  /** Question ids already on the exam, which cannot be added twice. */
  exclude: ReadonlySet<string>;
  onPick: (questions: readonly Question[]) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<BankFilter>({});
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const bank = useQuery({ queryKey: ["bank-picker", filter], queryFn: () => load(filter) });
  const available = (bank.data?.questions ?? []).filter((e) => !exclude.has(e.id));

  const heading = useRef<HTMLHeadingElement>(null);
  const marks = available.filter((e) => chosen.has(e.id)).reduce((sum, e) => sum + e.question.maxScore, 0);

  return (
    <Drawer label="Add from the question bank" onClose={onClose} initialFocus={heading} className="drawer">
        <header className="drawer-head">
          <Library aria-hidden="true" />
          <h2 ref={heading} tabIndex={-1}>
            Add from the library
          </h2>
          <span className="spacer" />
          <button type="button" className="quiet icon" aria-label="Close" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>
        <p className="notice">What you add is a copy: editing the question in the bank later will not change this exam.</p>
        <Filters filter={filter} topics={bank.data?.topics ?? []} onChange={setFilter} />
        <div className="drawer-body">
          {available.length === 0 ? (
            <p className="notice">{bank.data === undefined ? "Loading…" : "No questions match."}</p>
          ) : (
            <div className="row" style={{ marginTop: 0 }}>
              <button type="button" className="quiet" onClick={() => setChosen(new Set(available.map((e) => e.id)))}>
                Select all {available.length}
              </button>
            </div>
          )}
          <ul className="library">
            {available.map((entry) => (
              <li key={entry.id} className={chosen.has(entry.id) ? "chosen" : undefined}>
                <label className="option">
                  <input
                    type="checkbox"
                    style={{ width: "auto" }}
                    checked={chosen.has(entry.id)}
                    onChange={(e) => {
                      const next = new Set(chosen);
                      if (e.target.checked) next.add(entry.id);
                      else next.delete(entry.id);
                      setChosen(next);
                    }}
                  />{" "}
                  <span className="library-stem">{summary(entry.question)}</span>
                  <span className="library-meta">
                    <span className="tag">{KIND_NAME[entry.question.kind]}</span>
                    <span className={`difficulty ${entry.difficulty}`}>{entry.difficulty}</span>
                    <span className="notice">
                      {entry.question.maxScore} marks · {entry.topic || "no topic"}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <footer className="drawer-foot">
          <span className="notice">{chosen.size === 0 ? "Nothing chosen" : `${chosen.size} chosen · ${marks} marks`}</span>
          <span className="spacer" />
          <button type="button" className="quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="button" disabled={chosen.size === 0} onClick={() => onPick(available.filter((e) => chosen.has(e.id)).map((e) => e.question))}>
            Add {chosen.size} question{chosen.size === 1 ? "" : "s"}
          </button>
        </footer>
    </Drawer>
  );
}
