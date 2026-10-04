import { useRef, useState } from "react";
import { Dialog, Drawer, TabPanel, Tabs, useToast } from "@parikshaa/brand/ui";
import { Archive, ClipboardPlus, Download, FileSpreadsheet, FileText, Library, Pencil, Plus, Search, Tag, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { validateQuestion, type ExamProblem, type Question } from "@parikshaa/core/browser";
import { base64Of, ConsoleError, type BankEntry, type BankFilter, type ConsoleClient, type Difficulty, type DocxImport } from "../api.ts";
import { Banner, DropZone, EmptyState, PageActions, RowMenu, SkeletonRows } from "./kit.tsx";
import { QuestionFields, blankQuestion } from "./QuestionFields.tsx";

/**
 * The question bank (ROADMAP §3).
 *
 * Questions are written once, filed by topic and difficulty, and copied into
 * exams. Editing one here changes no exam already built from it.
 */

const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];
const DIFFICULTY_WORDS: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

/** What each kind of question is called in a list. */
export const KIND_NAME: Record<Question["kind"], string> = { mcq: "Multiple choice", short: "Written", numeric: "Numeric", code: "Coding" };

const summary = (q: Question) => (q.stem.length > 90 ? `${q.stem.slice(0, 90)}…` : q.stem);

/** Difficulty as a coloured badge, as on the practice site. */
export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <span className={`pill difficulty-${difficulty}`}>{DIFFICULTY_WORDS[difficulty]}</span>;
}

const SPREADSHEET_TEMPLATE = [
  "kind,question,options,answer,marks,topic,difficulty,tags",
  "mcq,Which sorting algorithm is stable?,Quicksort|Merge sort|Heap sort,Merge sort,2,Sorting,easy,dsa",
  "numeric,A train covers 180 km in 2.5 hours. Its average speed in km/h?,,72,2,Aptitude,medium,speed",
  "short,Why does binary search terminate?,,,4,Searching,medium,reasoning",
].join("\n");

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Filters({
  filter,
  topics,
  onChange,
  kind,
  onKind,
}: {
  filter: BankFilter;
  topics: readonly string[];
  onChange: (next: BankFilter) => void;
  kind?: Question["kind"] | "";
  onKind?: (next: Question["kind"] | "") => void;
}) {
  return (
    <div className="filter-toolbar" role="group" aria-label="Filter questions">
      <label className="search">
        <Search aria-hidden="true" />
        <input id="bank-search" type="search" aria-label="Search" placeholder="Search questions" value={filter.q ?? ""} onChange={(e) => onChange({ ...filter, q: e.target.value })} />
      </label>
      <select id="bank-topic" aria-label="Topic" value={filter.topic ?? ""} onChange={(e) => onChange({ ...filter, topic: e.target.value })}>
        <option value="">Any topic</option>
        {topics.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        id="bank-difficulty"
        aria-label="Difficulty"
        value={filter.difficulty ?? ""}
        onChange={(e) =>
          onChange(
            e.target.value === ""
              ? { ...(filter.topic === undefined ? {} : { topic: filter.topic }), ...(filter.q === undefined ? {} : { q: filter.q }) }
              : { ...filter, difficulty: e.target.value as Difficulty },
          )
        }
      >
        <option value="">Any difficulty</option>
        {DIFFICULTIES.map((d) => (
          <option key={d} value={d}>
            {DIFFICULTY_WORDS[d]}
          </option>
        ))}
      </select>
      {onKind === undefined ? null : (
        <select id="bank-kind" aria-label="Type" value={kind ?? ""} onChange={(e) => onKind(e.target.value as Question["kind"] | "")}>
          <option value="">Any type</option>
          {(Object.keys(KIND_NAME) as Question["kind"][]).map((k) => (
            <option key={k} value={k}>
              {KIND_NAME[k]}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

// --- the bank page ------------------------------------------------------------

export function BankPanel({ client, canWrite }: { client: ConsoleClient; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<BankFilter>({});
  const [kind, setKind] = useState<Question["kind"] | "">("");
  const [editing, setEditing] = useState<BankEntry | "new" | null>(null);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [bulk, setBulk] = useState<"topic" | "exam" | null>(null);
  const [importing, setImporting] = useState<"csv" | "docx">("csv");
  const importCard = useRef<HTMLElement>(null);

  const bank = useQuery({ queryKey: ["bank", filter], queryFn: () => client.listBank(filter) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["bank"] });

  const archive = useMutation({
    mutationFn: async (ids: readonly string[]) => {
      for (const id of ids) await client.archiveQuestion(id);
      return ids.length;
    },
    onSuccess: (n) => {
      setChosen(new Set());
      toast(`Archived ${n} question${n === 1 ? "" : "s"}`, "success");
    },
    onSettled: refresh,
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

  const shown = (bank.data?.questions ?? []).filter((e) => kind === "" || e.question.kind === kind);
  const picked = shown.filter((e) => chosen.has(e.id));
  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
  };

  return (
    <>
      {canWrite ? (
        <PageActions>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              importCard.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
              importCard.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
            }}
          >
            <FileSpreadsheet aria-hidden="true" />
            Import
          </button>
          <button type="button" onClick={() => setEditing("new")}>
            <Plus aria-hidden="true" />
            New question
          </button>
        </PageActions>
      ) : null}

      <section className="card" aria-label="Question bank">
        <div className="bar filter-bar">
          <Filters filter={filter} topics={bank.data?.topics ?? []} onChange={setFilter} kind={kind} onKind={setKind} />
        </div>

        {canWrite && picked.length > 0 ? (
          <div className="bulk-bar" role="group" aria-label="With the chosen questions">
            <strong>{picked.length} chosen</strong>
            <span className="spacer" />
            <button type="button" className="secondary" onClick={() => setBulk("exam")}>
              <ClipboardPlus aria-hidden="true" />
              Add to an exam…
            </button>
            <button type="button" className="secondary" onClick={() => setBulk("topic")}>
              <Tag aria-hidden="true" />
              Change topic…
            </button>
            <button type="button" className="secondary" disabled={archive.isPending} onClick={() => archive.mutate(picked.map((e) => e.id))}>
              <Archive aria-hidden="true" />
              Archive
            </button>
            <button type="button" className="quiet" onClick={() => setChosen(new Set())}>
              Clear
            </button>
          </div>
        ) : null}

        {bank.data === undefined ? (
          bank.error === null ? (
            <SkeletonRows columns={5} label="Loading questions…" />
          ) : (
            <Banner tone="danger" title="Could not load the bank." />
          )
        ) : bank.data.questions.length === 0 && Object.values(filter).every((v) => v === undefined || v === "") ? (
          <EmptyState icon={Library} action={canWrite ? { label: "New question", onClick: () => setEditing("new"), icon: Plus } : undefined}>
            Questions you file here, by topic and difficulty, can be drawn into any exam. Write one, or import a spreadsheet or a Word paper below.
          </EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState icon={Search} compact>
            No questions match.
          </EmptyState>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  {canWrite ? (
                    <th scope="col" className="check-cell">
                      <input
                        type="checkbox"
                        aria-label="Choose every question shown"
                        checked={picked.length === shown.length}
                        onChange={(e) => setChosen(e.target.checked ? new Set(shown.map((q) => q.id)) : new Set())}
                      />
                    </th>
                  ) : null}
                  <th scope="col">Question</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="num">
                    Marks
                  </th>
                  <th scope="col">Topic</th>
                  <th scope="col">Difficulty</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((entry) => (
                  <tr key={entry.id} className={chosen.has(entry.id) ? "selected" : undefined}>
                    {canWrite ? (
                      <td className="check-cell">
                        <input type="checkbox" aria-label={`Choose “${summary(entry.question)}”`} checked={chosen.has(entry.id)} onChange={() => toggle(entry.id)} />
                      </td>
                    ) : null}
                    <td>{summary(entry.question)}</td>
                    <td>
                      <span className="tag">{KIND_NAME[entry.question.kind]}</span>
                    </td>
                    <td className="num">{entry.question.maxScore}</td>
                    <td>{entry.topic || <span className="notice">—</span>}</td>
                    <td>
                      <DifficultyBadge difficulty={entry.difficulty} />
                    </td>
                    <td className="row-end">
                      {canWrite ? (
                        <>
                          <button type="button" className="quiet" onClick={() => setEditing(entry)}>
                            Edit
                          </button>
                          <RowMenu
                            of={summary(entry.question)}
                            items={[{ label: "Archive", icon: <Archive />, onSelect: () => archive.mutate([entry.id]), danger: true }]}
                          />
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canWrite ? (
        <section className="card import-card" aria-label="Import questions" ref={importCard}>
          <h2 className="card-title">Import</h2>
          <Tabs
            label="Import from"
            idBase="bank-import"
            value={importing}
            onChange={setImporting}
            items={[
              {
                id: "csv",
                label: (
                  <>
                    <FileSpreadsheet aria-hidden="true" /> Spreadsheet
                  </>
                ),
              },
              {
                id: "docx",
                label: (
                  <>
                    <FileText aria-hidden="true" /> Word document
                  </>
                ),
              },
            ]}
          />
          <TabPanel idBase="bank-import" id="csv" value={importing}>
            <SpreadsheetImport client={client} onImported={refresh} />
          </TabPanel>
          <TabPanel idBase="bank-import" id="docx" value={importing}>
            <WordImport client={client} onImported={refresh} />
          </TabPanel>
        </section>
      ) : null}

      {bulk === "topic" ? (
        <TopicDialog
          topics={bank.data?.topics ?? []}
          count={picked.length}
          onClose={() => setBulk(null)}
          onSave={async (topic) => {
            for (const entry of picked) {
              const { id: _, ...question } = entry.question;
              await client.editQuestion(entry.id, { question, topic, difficulty: entry.difficulty, tags: entry.tags });
            }
            await refresh();
            setChosen(new Set());
            toast(`Moved ${picked.length} to “${topic}”`, "success");
          }}
        />
      ) : null}
      {bulk === "exam" ? (
        <AddToExamDialog
          client={client}
          questions={picked.map((e) => e.question)}
          onClose={() => setBulk(null)}
          onAdded={(title) => {
            setChosen(new Set());
            toast(`Added ${picked.length} to “${title}”`, "success");
          }}
        />
      ) : null}
    </>
  );
}

/** A topic for every chosen question at once. */
function TopicDialog({ topics, count, onSave, onClose }: { topics: readonly string[]; count: number; onSave: (topic: string) => Promise<void>; onClose: () => void }) {
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  return (
    <Dialog label="Change topic" onClose={onClose} initialFocus={field} dismissable={!saving}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          try {
            await onSave(topic.trim());
            onClose();
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : "That did not save.");
            setSaving(false);
          }
        }}
      >
        <h2 className="dialog-title">
          Change the topic of {count} question{count === 1 ? "" : "s"}
        </h2>
        <div className="field">
          <label htmlFor="bulk-topic">Topic</label>
          <input ref={field} id="bulk-topic" list="bulk-topics" value={topic} onChange={(e) => setTopic(e.target.value)} />
          <datalist id="bulk-topics">
            {topics.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        {error === null ? null : (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="quiet" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" disabled={saving || topic.trim() === ""}>
            Change topic
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * The chosen questions, copied onto the end of an exam not yet sat. A sat
 * exam is frozen, so it is not offered.
 */
function AddToExamDialog({ client, questions, onAdded, onClose }: { client: ConsoleClient; questions: readonly Question[]; onAdded: (title: string) => void; onClose: () => void }) {
  const queryClient = useQueryClient();
  const exams = useQuery({ queryKey: ["exams"], queryFn: () => client.listExams() });
  const [examId, setExamId] = useState("");
  const open = (exams.data ?? []).filter((e) => {
    const c = e.attempts;
    return (e.archivedAt ?? null) === null && (c === undefined || c.inProgress + c.submitted + c.graded + c.void === 0);
  });
  const add = useMutation({
    mutationFn: async () => {
      const exam = await client.loadExam(examId);
      const have = new Set(exam.questions.map((q) => q.id as string));
      await client.saveExam({ ...exam, questions: [...exam.questions, ...questions.filter((q) => !have.has(q.id as string))] });
      return exam.title;
    },
    onSuccess: async (title) => {
      await queryClient.invalidateQueries({ queryKey: ["exams"] });
      await queryClient.invalidateQueries({ queryKey: ["exam"] });
      onAdded(title);
      onClose();
    },
  });
  return (
    <Dialog label="Add to an exam" onClose={onClose} dismissable={!add.isPending}>
      <h2 className="dialog-title">
        Add {questions.length} question{questions.length === 1 ? "" : "s"} to an exam
      </h2>
      <p className="notice">They are copied onto the end of its paper; editing them here later does not change it. Exams already sat are fixed, so are not listed.</p>
      <div className="field">
        <label htmlFor="bulk-exam">Exam</label>
        <select id="bulk-exam" value={examId} onChange={(e) => setExamId(e.target.value)}>
          <option value="">Choose an exam</option>
          {open.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      </div>
      {add.error === null ? null : (
        <p className="error" role="alert">
          {add.error instanceof ConsoleError ? (add.error.problems[0]?.message ?? add.error.message) : "That did not save."}
        </p>
      )}
      <div className="dialog-actions">
        <button type="button" className="quiet" onClick={onClose} disabled={add.isPending}>
          Cancel
        </button>
        <button type="button" disabled={examId === "" || add.isPending} onClick={() => add.mutate()}>
          Add to the exam
        </button>
      </div>
    </Dialog>
  );
}

// --- importing a spreadsheet ---------------------------------------------------------

function SpreadsheetImport({ client, onImported }: { client: ConsoleClient; onImported: () => Promise<unknown> }) {
  const [file, setFile] = useState<string | null>(null);
  const [imported, setImported] = useState<string | null>(null);
  const [problems, setProblems] = useState<readonly ExamProblem[]>([]);
  const importCsv = useMutation({
    mutationFn: (csv: string) => client.importBank(csv),
    onSuccess: async (count) => {
      setProblems([]);
      setImported(`Imported ${count} question${count === 1 ? "" : "s"}.`);
      await onImported();
    },
    onError: (error) => {
      setImported(null);
      setProblems(error instanceof ConsoleError ? error.problems : [{ path: "", message: "The import failed." }]);
    },
  });
  return (
    <>
      <div className="bar import-head">
        <p className="notice">
          One question per row under a header row: <span className="mono">kind</span> (<span className="mono">mcq</span> for multiple choice, <span className="mono">numeric</span>, or <span className="mono">short</span> for written), <span className="mono">question</span>,{" "}
          <span className="mono">options</span> (separated by |), <span className="mono">answer</span>, <span className="mono">marks</span>,{" "}
          <span className="mono">topic</span>, <span className="mono">difficulty</span>, <span className="mono">tags</span>. Any problem imports nothing, and every
          problem is listed by row.
        </p>
        <button type="button" className="quiet" onClick={() => save(new Blob([SPREADSHEET_TEMPLATE], { type: "text/csv" }), "question-bank-template.csv")}>
          <Download aria-hidden="true" />
          Download the template
        </button>
      </div>
      <DropZone
        label="Choose a spreadsheet saved as CSV"
        name="CSV file"
        accept=".csv,text/csv"
        chosen={file}
        onFile={async (chosen) => {
          setFile(chosen.name);
          importCsv.mutate(await chosen.text());
        }}
      />
      {imported === null ? null : (
        <p className="notice" role="status">
          {imported}
        </p>
      )}
      {problems.length === 0 ? null : (
        <ul className="problems" aria-label="Problems with this file">
          {problems.map((p) => (
            <li key={`${p.path}:${p.message}`}>
              <span className="mono">{p.path}</span> — {p.message}
            </li>
          ))}
        </ul>
      )}
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
    <section aria-label="Import from Word">
      <p className="notice">
        Type the paper as usual: number each question (<span className="mono">1.</span> or Word's numbered list), letter its options (
        <span className="mono">a)</span>), then an <span className="mono">Answer:</span> line — or mark the right option with <span className="mono">*</span>.
        Optional lines: <span className="mono">Marks:</span>, <span className="mono">Topic:</span>, <span className="mono">Difficulty:</span>,{" "}
        <span className="mono">Tags:</span>, <span className="mono">Type:</span>, <span className="mono">Negative:</span>. Several right options:{" "}
        <span className="mono">Answer: a, c</span>. Pictures pasted into the paper come with their question, and a <span className="mono">Passage:</span> line
        starts a passage for the questions after it. You will see every question before anything is added.
      </p>
      <DropZone
        label="Choose a Word document"
        name="Word file (.docx)"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        chosen={file?.name ?? null}
        onFile={async (chosen) => {
          setDone(null);
          const data = await base64Of(chosen);
          setFile({ name: chosen.name, data });
          check.mutate(data);
        }}
      />
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
          <div className="scroll">
            <table aria-label="Questions found">
              <thead>
                <tr>
                  <th scope="col" className="num">
                    #
                  </th>
                  <th scope="col">Question</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="num">
                    Marks
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.map((q) => (
                  <tr key={q.question} className={q.note === null ? undefined : "warning"}>
                    <td className="num">{q.question}</td>
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
                    <td>{KIND_NAME[q.kind as Question["kind"]] ?? q.kind}</td>
                    <td className="num">{q.marks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row">
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
        <QuestionFields question={question} onChange={setQuestion} upload={(file) => client.uploadImage(file)} checkReference={(q, language, source) => client.checkReference(q, language, source)} />
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
                  {DIFFICULTY_WORDS[d]}
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
          {bank.data === undefined ? (
            <SkeletonRows rows={4} columns={2} label="Loading the bank…" />
          ) : available.length === 0 ? (
            <EmptyState icon={Search} compact>
              No questions match. Questions already on this exam are not listed again.
            </EmptyState>
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
                    <DifficultyBadge difficulty={entry.difficulty} />
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
