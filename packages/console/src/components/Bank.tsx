import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { validateQuestion, type ExamProblem, type Question } from "@parikshaa/core/browser";
import { ConsoleError, type BankEntry, type BankFilter, type ConsoleClient, type Difficulty } from "../api.ts";
import { QuestionFields, blankQuestion } from "./QuestionFields.tsx";

/**
 * The question bank (ROADMAP §3).
 *
 * Questions are written once, filed by topic and difficulty, and copied into
 * exams. Editing one here changes no exam already built from it.
 */

const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

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
    </>
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
        <QuestionFields question={question} onChange={setQuestion} />
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

  return (
    <div className="card picker" role="dialog" aria-label="Add from the question bank">
      <Filters filter={filter} topics={bank.data?.topics ?? []} onChange={setFilter} />
      {available.length === 0 ? (
        <p className="notice">{bank.data === undefined ? "Loading…" : "No questions match."}</p>
      ) : (
        <div className="row">
          <button
            type="button"
            className="quiet"
            onClick={() => setChosen(new Set(available.map((e) => e.id)))}
          >
            Select all {available.length}
          </button>
        </div>
      )}
      {available.map((entry) => (
        <label className="option" key={entry.id}>
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
          {summary(entry.question)}{" "}
          <span className="notice">
            · {entry.question.maxScore} marks · {entry.topic || "no topic"} · {entry.difficulty}
          </span>
        </label>
      ))}
      <div className="row">
        <button
          type="button"
          disabled={chosen.size === 0}
          onClick={() => onPick(available.filter((e) => chosen.has(e.id)).map((e) => e.question))}
        >
          Add {chosen.size} question{chosen.size === 1 ? "" : "s"}
        </button>
        <button type="button" className="quiet" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
