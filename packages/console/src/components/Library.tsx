import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, Eye, Plus, RefreshCw, Shuffle } from "lucide-react";
import { Drawer, useToast } from "@parikshaa/brand/ui";
import { Markdown } from "@parikshaa/brand/markdown";
import { ConsoleError, type ConsoleClient, type Difficulty, type LibraryEntry, type LibraryFilter, type LibrarySection } from "../api.ts";
import { DifficultyBadge } from "./Bank.tsx";
import { EmptyState } from "./kit.tsx";
import "./Library.css";

/**
 * The Parikshaa Library (docs/F1-GO-LIVE-PLAN.md §4, G2): Parikshaa's own
 * questions, by section and topic, to copy into this organisation's bank,
 * chosen one by one or a few at random. A copy is the organisation's to
 * change; when the library has a newer version, it says so and offers it.
 */

const SECTION: Record<LibrarySection, string> = {
  aptitude: "Aptitude",
  cs: "CS fundamentals",
  programming: "Programming",
  dsa: "DSA coding",
  sql: "SQL",
  frontend: "Frontend",
};
const KIND: Record<string, string> = { mcq: "Multiple choice", short: "Written", numeric: "Number", code: "Coding" };
const PAGE = 50;

const failure = (error: unknown) => (error instanceof ConsoleError && error.detail !== undefined ? error.detail : "That did not go through. Try again.");
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export function LibraryPanel({ client, canWrite }: { client: ConsoleClient; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<LibraryFilter>({});
  const [offset, setOffset] = useState(0);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [open, setOpen] = useState<LibraryEntry | null>(null);
  const [count, setCount] = useState("5");
  const list = useQuery({ queryKey: ["library", filter, offset], queryFn: () => client.library(filter, offset) });

  const change = (next: LibraryFilter) => {
    setFilter(next);
    setOffset(0);
    setChosen(new Set());
  };
  const after = async (taken: { added: number; already: number }, how: string) => {
    setChosen(new Set());
    await queryClient.invalidateQueries({ queryKey: ["library"] });
    await queryClient.invalidateQueries({ queryKey: ["bank"] });
    toast(
      taken.added === 0 ? "Nothing new: those are in your bank already." : `${plural(taken.added, "question")} ${how} your bank${taken.already > 0 ? `; ${taken.already} were there already` : ""}.`,
      "success",
    );
  };
  const take = useMutation({ mutationFn: (ids: readonly string[]) => client.takeFromLibrary(ids), onSuccess: (t) => after(t, "copied into") });
  const pick = useMutation({
    mutationFn: () => {
      const { notTaken: _, ...rest } = filter;
      return client.pickFromLibrary(rest, Number(count));
    },
    onSuccess: (t) => after(t, "picked at random into"),
  });

  const facets = list.data?.facets;
  const topics = facets?.sections.find((s) => s.section === filter.section)?.topics ?? [];
  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
  };
  const error = take.error ?? pick.error;

  return (
    <section className="card library" aria-label="Parikshaa Library">
      <div className="bar">
        <BookOpenCheck aria-hidden="true" />
        <strong>Parikshaa Library</strong>
        <span className="notice">
          {facets === undefined ? "" : `${facets.total} questions by Parikshaa. `}Copy what you need into your bank and change it as you like. Library questions are known to many: add some of your own.
        </span>
      </div>

      <div className="chips library-sections" role="group" aria-label="Section">
        <button type="button" className="chip" aria-pressed={filter.section === undefined} onClick={() => change({ ...filter, section: undefined, topic: undefined })}>
          All
        </button>
        {(facets?.sections ?? []).map((s) => (
          <button
            key={s.section}
            type="button"
            className="chip"
            aria-pressed={filter.section === s.section}
            disabled={s.count === 0}
            onClick={() => change({ ...filter, section: s.section, topic: undefined })}
          >
            {SECTION[s.section]} <span className="chip-count">{s.count}</span>
          </button>
        ))}
      </div>

      <div className="library-filters">
        <div className="field">
          <label htmlFor="library-topic">Topic</label>
          <select id="library-topic" value={filter.topic ?? ""} disabled={topics.length === 0} onChange={(e) => change({ ...filter, topic: e.target.value === "" ? undefined : e.target.value })}>
            <option value="">{filter.section === undefined ? "Choose a section first" : "Every topic"}</option>
            {topics.map((t) => (
              <option key={t.topic} value={t.topic}>
                {t.topic} ({t.count})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="library-difficulty">Difficulty</label>
          <select id="library-difficulty" value={filter.difficulty ?? ""} onChange={(e) => change({ ...filter, difficulty: e.target.value === "" ? undefined : (e.target.value as Difficulty) })}>
            <option value="">Any</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="library-search">Find</label>
          <input id="library-search" value={filter.q ?? ""} onChange={(e) => change({ ...filter, q: e.target.value })} placeholder="Words in the question, a topic or a tag" />
        </div>
        <label className="check">
          <input type="checkbox" checked={filter.notTaken === true} onChange={(e) => change({ ...filter, notTaken: e.target.checked || undefined })} />
          Only what is not in my bank
        </label>
      </div>

      {canWrite ? (
        <div className="bulk-bar" role="group" aria-label="Add to my bank">
          {chosen.size > 0 ? (
            <button type="button" disabled={take.isPending} onClick={() => take.mutate([...chosen])}>
              <Plus aria-hidden="true" />
              Add {plural(chosen.size, "question")} to my bank
            </button>
          ) : (
            <span className="notice">Tick questions to add them, or let the library pick:</span>
          )}
          <span className="spacer" />
          <form
            className="library-pick"
            aria-label="Pick at random"
            onSubmit={(e) => {
              e.preventDefault();
              pick.mutate();
            }}
          >
            <label htmlFor="library-count">How many</label>
            <input id="library-count" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, "").slice(0, 2))} />
            <button type="submit" className="secondary" disabled={pick.isPending || !(Number(count) >= 1 && Number(count) <= 50)}>
              <Shuffle aria-hidden="true" />
              Pick at random
            </button>
          </form>
        </div>
      ) : null}
      {error === null ? null : (
        <p className="error" role="alert">
          {failure(error)}
        </p>
      )}

      {list.isPending ? <p className="notice">Loading…</p> : null}
      {list.error !== null ? <p className="error">{failure(list.error)}</p> : null}
      {list.isSuccess && items.length === 0 ? <EmptyState icon={BookOpenCheck}>No library questions match. Try another section or fewer filters.</EmptyState> : null}
      {items.length === 0 ? null : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                {canWrite ? (
                  <th scope="col">
                    <span className="visually-hidden">Choose</span>
                  </th>
                ) : null}
                <th scope="col">Question</th>
                <th scope="col">Topic</th>
                <th scope="col">Difficulty</th>
                <th scope="col">In my bank</th>
                <th scope="col">
                  <span className="visually-hidden">Preview</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <LibraryRow key={e.id} client={client} entry={e} canWrite={canWrite} chosen={chosen.has(e.id)} onToggle={() => toggle(e.id)} onOpen={() => setOpen(e)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > PAGE ? (
        <div className="row library-pages">
          <button type="button" className="quiet" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
            Previous
          </button>
          <span className="notice">
            {offset + 1}–{Math.min(offset + PAGE, total)} of {total}
          </span>
          <button type="button" className="quiet" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>
            Next
          </button>
        </div>
      ) : null}
      {open === null ? null : <LibraryPreview entry={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function LibraryRow({
  client,
  entry: e,
  canWrite,
  chosen,
  onToggle,
  onOpen,
}: {
  client: ConsoleClient;
  entry: LibraryEntry;
  canWrite: boolean;
  chosen: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const refresh = useMutation({
    mutationFn: () => client.refreshFromLibrary(e.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["library"] });
      await queryClient.invalidateQueries({ queryKey: ["bank"] });
      toast("Your copy now matches the library", "success");
    },
  });
  const stem = e.question.stem.split("\n").find((line) => line.trim() !== "") ?? e.question.stem;
  return (
    <tr>
      {canWrite ? (
        <td>
          <input type="checkbox" aria-label={`Choose: ${stem}`} checked={chosen} disabled={e.adopted !== null} onChange={onToggle} />
        </td>
      ) : null}
      <td className="library-stem">
        {stem.replace(/^#+\s*/, "")}
        <span className="notice small"> · {KIND[e.question.kind] ?? e.question.kind}</span>
        {e.tier === "hire" ? <span className="pill tone-ok">Hire-only</span> : null}
      </td>
      <td>{e.topic}</td>
      <td>
        <DifficultyBadge difficulty={e.difficulty} />
      </td>
      <td>
        {e.adopted === null ? (
          "—"
        ) : e.newerVersion && canWrite ? (
          <button type="button" className="quiet" disabled={refresh.isPending} onClick={() => refresh.mutate()} aria-label={`Update my copy of: ${stem}`}>
            <RefreshCw aria-hidden="true" />
            Newer version
          </button>
        ) : (
          "Yes"
        )}
      </td>
      <td>
        <button type="button" className="quiet" onClick={onOpen} aria-label={`Preview: ${stem}`}>
          <Eye aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
}

function LibraryPreview({ entry: e, onClose }: { entry: LibraryEntry; onClose: () => void }) {
  const q = e.question;
  return (
    <Drawer label="Library question" onClose={onClose}>
      <h2 className="dialog-title">
        <BookOpenCheck aria-hidden="true" /> {SECTION[e.section]} · {e.topic}
      </h2>
      <p className="notice">
        {KIND[q.kind] ?? q.kind} · {e.difficulty} · version {e.version}
        {e.exposure === null ? "" : ` · taken by ${plural(e.exposure, "organisation")}`}
      </p>
      <Markdown source={q.stem} />
      {q.kind === "mcq" ? (
        <ol className="library-options">
          {q.options.map((o, i) => (
            <li key={i} className={i === q.correctIndex ? "right" : undefined}>
              {o}
              {i === q.correctIndex ? <span className="visually-hidden"> (the answer)</span> : null}
            </li>
          ))}
        </ol>
      ) : null}
      {q.kind === "code" ? (
        <p className="notice">
          {(q.tests ?? []).filter((t) => !t.hidden).length} example and {(q.tests ?? []).filter((t) => t.hidden).length} hidden tests · {(q.languages ?? [q.language]).join(", ")}
        </p>
      ) : null}
      {e.explanation.trim() === "" ? null : (
        <details className="library-explanation">
          <summary>Explanation</summary>
          <Markdown source={e.explanation} />
        </details>
      )}
    </Drawer>
  );
}
