import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { ConsoleError, type ConsoleClient, type PrepLesson, type PrepTrack } from "../api.ts";

/**
 * Prep content (ROADMAP §16): the tracks a practice site's learners follow,
 * the lessons in them, and the problem of each day. A track is saved whole:
 * its modules and items are replaced by what the form holds. A learner's
 * progress belongs to the problems and lessons, so it survives a rearrangement.
 */

const failure = (error: unknown, fallback: string) =>
  error instanceof ConsoleError ? (error.detail ?? (error.problems[0]?.message ?? fallback)) : fallback;

type Item = { readonly problemId: string } | { readonly lessonId: string };
interface ModuleDraft {
  title: string;
  items: Item[];
}

const itemKey = (item: Item) => ("problemId" in item ? `p:${item.problemId}` : `l:${item.lessonId}`);

// --- tracks ----------------------------------------------------------------------------

export function Tracks({ client, canWrite }: { client: ConsoleClient; canWrite: boolean }) {
  const tracks = useQuery({ queryKey: ["prep", "tracks"], queryFn: () => client.prepTracks() });
  const problems = useQuery({ queryKey: ["practice", "problems"], queryFn: () => client.practiceProblems() });
  const lessons = useQuery({ queryKey: ["prep", "lessons"], queryFn: () => client.prepLessons() });
  const [editing, setEditing] = useState<PrepTrack | "new" | null>(null);
  const items = (t: PrepTrack) => t.modules.reduce((n, m) => n + m.items.length, 0);
  return (
    <>
      {editing !== null ? (
        <TrackForm client={client} track={editing === "new" ? null : editing} onDone={() => setEditing(null)} problems={problems.data ?? []} lessons={lessons.data ?? []} />
      ) : canWrite ? (
        <div className="row">
          <button type="button" onClick={() => setEditing("new")}>
            New track
          </button>
        </div>
      ) : null}
      <section className="card" aria-label="Tracks">
        <div className="bar">
          <strong>Tracks</strong>
        </div>
        <p className="notice">
          A track is a sheet: modules of lessons and problems, in the order to learn them. Learners plan their days around one, and are paid coins as they finish its
          modules.
        </p>
        {(tracks.data ?? []).length === 0 ? (
          <p className="notice">No tracks yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Track</th>
                <th scope="col">Modules</th>
                <th scope="col">Items</th>
                <th scope="col">Shown</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tracks.data!.map((t) => (
                <tr key={t.id}>
                  <td>
                    {t.title} <span className="notice">/{t.slug}</span>
                  </td>
                  <td>{t.modules.length}</td>
                  <td>{items(t)}</td>
                  <td>{t.published ? <span className="pill ok">Shown</span> : <span className="pill">Hidden</span>}</td>
                  <td>
                    {canWrite ? (
                      <button type="button" className="secondary" onClick={() => setEditing(t)}>
                        Edit
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function TrackForm({
  client,
  track,
  problems,
  lessons,
  onDone,
}: {
  client: ConsoleClient;
  track: PrepTrack | null;
  problems: readonly { id: string; title: string; published: boolean }[];
  lessons: readonly PrepLesson[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(track?.title ?? "");
  const [description, setDescription] = useState(track?.description ?? "");
  const [published, setPublished] = useState(track?.published ?? true);
  const [modules, setModules] = useState<ModuleDraft[]>(
    track?.modules.map((m) => ({
      title: m.title,
      items: m.items.map((i): Item => (i.problemId !== null ? { problemId: i.problemId } : { lessonId: i.lessonId! })),
    })) ?? [{ title: "Module 1", items: [] }],
  );
  const save = useMutation({
    mutationFn: () => client.saveTrack(track?.id ?? null, { title: title.trim(), description, published, modules }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prep", "tracks"] });
      onDone();
    },
  });
  const problemTitle = new Map(problems.map((p) => [p.id, p.title]));
  const lessonTitle = new Map(lessons.map((l) => [l.id, l.title]));
  const change = (i: number, patch: Partial<ModuleDraft>) => setModules(modules.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const move = <T,>(list: T[], from: number, to: number): T[] => {
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    return next;
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <form className="card track-form" onSubmit={submit} aria-label={track === null ? "New track" : `Edit ${track.title}`}>
      <div className="bar">
        <strong>{track === null ? "New track" : `Edit ${track.title}`}</strong>
      </div>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required />
      </label>
      <label>
        Description (Markdown)
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={20_000} />
      </label>
      <label className="check">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Shown to learners
      </label>
      {modules.map((m, i) => (
        <fieldset key={i} className="module-draft">
          <legend>Module {i + 1}</legend>
          <div className="row">
            <label className="grow">
              Title
              <input value={m.title} onChange={(e) => change(i, { title: e.target.value })} maxLength={160} required />
            </label>
            <button type="button" className="quiet" aria-label={`Move module ${i + 1} up`} onClick={() => setModules(move(modules, i, i - 1))}>
              <ArrowUp aria-hidden="true" />
            </button>
            <button type="button" className="quiet" aria-label={`Move module ${i + 1} down`} onClick={() => setModules(move(modules, i, i + 1))}>
              <ArrowDown aria-hidden="true" />
            </button>
            <button type="button" className="quiet" aria-label={`Remove module ${i + 1}`} onClick={() => setModules(modules.filter((_, j) => j !== i))}>
              <Trash2 aria-hidden="true" />
            </button>
          </div>
          <ol className="item-drafts">
            {m.items.map((item, k) => (
              <li key={itemKey(item)}>
                <span className="pill">{"problemId" in item ? "Problem" : "Lesson"}</span>{" "}
                {"problemId" in item ? (problemTitle.get(item.problemId) ?? item.problemId) : (lessonTitle.get(item.lessonId) ?? item.lessonId)}
                <span className="spacer" />
                <button type="button" className="quiet" aria-label="Up" onClick={() => change(i, { items: move(m.items, k, k - 1) })}>
                  <ArrowUp aria-hidden="true" />
                </button>
                <button type="button" className="quiet" aria-label="Down" onClick={() => change(i, { items: move(m.items, k, k + 1) })}>
                  <ArrowDown aria-hidden="true" />
                </button>
                <button type="button" className="quiet" aria-label="Remove" onClick={() => change(i, { items: m.items.filter((_, j) => j !== k) })}>
                  <Trash2 aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
          <label>
            Add to module {i + 1}
            <select
              value=""
              onChange={(e) => {
                const [kind, id] = e.target.value.split(":") as [string, string];
                if (id === undefined) return;
                const item: Item = kind === "p" ? { problemId: id } : { lessonId: id };
                if (m.items.some((x) => itemKey(x) === itemKey(item))) return;
                change(i, { items: [...m.items, item] });
              }}
            >
              <option value="">Choose a problem or a lesson…</option>
              <optgroup label="Lessons">
                {lessons.map((l) => (
                  <option key={l.id} value={`l:${l.id}`}>
                    {l.title}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Problems">
                {problems.map((p) => (
                  <option key={p.id} value={`p:${p.id}`}>
                    {p.title}
                    {p.published ? "" : " (hidden)"}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
        </fieldset>
      ))}
      <div className="row">
        <button type="button" className="secondary" onClick={() => setModules([...modules, { title: `Module ${modules.length + 1}`, items: [] }])}>
          <Plus aria-hidden="true" /> Add a module
        </button>
      </div>
      {save.isError ? (
        <p className="error" role="alert">
          {failure(save.error, "The track could not be saved.")}
        </p>
      ) : null}
      <div className="row">
        <button type="submit" disabled={save.isPending}>
          Save track
        </button>
        <button type="button" className="quiet" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// --- lessons ------------------------------------------------------------------------------

export function Lessons({ client, canWrite }: { client: ConsoleClient; canWrite: boolean }) {
  const lessons = useQuery({ queryKey: ["prep", "lessons"], queryFn: () => client.prepLessons() });
  const [editing, setEditing] = useState<PrepLesson | "new" | null>(null);
  return (
    <>
      {editing !== null ? (
        <LessonForm client={client} lesson={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      ) : canWrite ? (
        <div className="row">
          <button type="button" onClick={() => setEditing("new")}>
            Write a lesson
          </button>
        </div>
      ) : null}
      <section className="card" aria-label="Lessons">
        <div className="bar">
          <strong>Lessons</strong>
        </div>
        {(lessons.data ?? []).length === 0 ? (
          <p className="notice">No lessons yet. A lesson is Markdown, with a link to a video if it has one.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Lesson</th>
                <th scope="col">Minutes</th>
                <th scope="col">Video</th>
                <th scope="col">Shown</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lessons.data!.map((l) => (
                <tr key={l.id}>
                  <td>
                    {l.title} <span className="notice">/{l.slug}</span>
                  </td>
                  <td>{l.estMinutes}</td>
                  <td>{l.videoUrl === "" ? "—" : "Yes"}</td>
                  <td>{l.published ? <span className="pill ok">Shown</span> : <span className="pill">Hidden</span>}</td>
                  <td>
                    {canWrite ? (
                      <button type="button" className="secondary" onClick={() => setEditing(l)}>
                        Edit
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function LessonForm({ client, lesson, onDone }: { client: ConsoleClient; lesson: PrepLesson | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [body, setBody] = useState(lesson?.body ?? "");
  const [videoUrl, setVideoUrl] = useState(lesson?.videoUrl ?? "");
  const [estMinutes, setEstMinutes] = useState(lesson?.estMinutes ?? 15);
  const [published, setPublished] = useState(lesson?.published ?? true);
  const save = useMutation({
    mutationFn: () => client.saveLesson(lesson?.id ?? null, { title: title.trim(), body, videoUrl: videoUrl.trim(), estMinutes, published }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prep", "lessons"] });
      onDone();
    },
  });
  return (
    <form
      className="card"
      aria-label={lesson === null ? "New lesson" : `Edit ${lesson.title}`}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="bar">
        <strong>{lesson === null ? "New lesson" : `Edit ${lesson.title}`}</strong>
      </div>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required />
      </label>
      <label>
        Lesson (Markdown)
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} maxLength={200_000} />
      </label>
      <div className="row">
        <label className="grow">
          Video link (https://…)
          <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} maxLength={500} placeholder="https://" />
        </label>
        <label>
          Minutes
          <input type="number" min={1} max={600} value={estMinutes} onChange={(e) => setEstMinutes(Number(e.target.value))} />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Shown to learners
      </label>
      {save.isError ? (
        <p className="error" role="alert">
          {failure(save.error, "The lesson could not be saved.")}
        </p>
      ) : null}
      <div className="row">
        <button type="submit" disabled={save.isPending}>
          Save lesson
        </button>
        <button type="button" className="quiet" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// --- the problem of the day --------------------------------------------------------------------

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function ProblemOfTheDay({ client, canWrite }: { client: ConsoleClient; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const schedule = useQuery({ queryKey: ["prep", "potd"], queryFn: () => client.potdSchedule() });
  const problems = useQuery({ queryKey: ["practice", "problems"], queryFn: () => client.practiceProblems() });
  const set = useMutation({
    mutationFn: ({ day, problemId }: { day: string; problemId: string | null }) => client.setPotd(day, problemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prep", "potd"] }),
  });
  if (schedule.data === undefined) return <p className="notice">Loading…</p>;
  const set_ = new Map(schedule.data.days.map((d) => [d.day, d.problemId]));
  const days = Array.from({ length: 21 }, (_, i) => addDays(schedule.data.today, i));
  const shown = (problems.data ?? []).filter((p) => p.published);
  return (
    <section className="card" aria-label="Problem of the day">
      <div className="bar">
        <strong>Problem of the day</strong>
      </div>
      <p className="notice">
        One published problem a day, by India Standard Time. Solving it on its day keeps a learner's streak and pays five coins more. Learners see only today's and
        the past month's.
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Problem</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day}>
              <td>
                {new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`))}
                {day === schedule.data.today ? <span className="pill brand"> today</span> : null}
              </td>
              <td>
                <select
                  aria-label={`Problem for ${day}`}
                  value={set_.get(day) ?? ""}
                  disabled={!canWrite || set.isPending}
                  onChange={(e) => set.mutate({ day, problemId: e.target.value === "" ? null : e.target.value })}
                >
                  <option value="">None</option>
                  {shown.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {set.isError ? (
        <p className="error" role="alert">
          {failure(set.error, "That day could not be set.")}
        </p>
      ) : null}
    </section>
  );
}
