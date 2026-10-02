import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, BookOpen, Plus, Route, Trash2 } from "lucide-react";
import { ConsoleError, type ConsoleClient, type PlusProduct, type PrepLesson, type PrepTrack } from "../api.ts";
import { EmptyState, SkeletonRows } from "./kit.tsx";

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
      ) : null}
      <section className="card prep-card" aria-label="Tracks">
        <div className="bar">
          <strong>Tracks</strong>
          {canWrite && editing === null ? (
            <button type="button" onClick={() => setEditing("new")}>
              <Plus aria-hidden="true" /> New track
            </button>
          ) : null}
        </div>
        <p className="notice">
          A track is a sheet: modules of lessons and problems, in the order to learn them. Learners plan their days around one, and are paid coins as they finish its
          modules.
        </p>
        {tracks.isPending ? (
          <SkeletonRows rows={3} columns={4} />
        ) : (tracks.data ?? []).length === 0 ? (
          <EmptyState icon={Route} compact>
            No tracks yet.
          </EmptyState>
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
                      <button type="button" className="quiet" onClick={() => setEditing(t)}>
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
  const [quizOf, setQuizOf] = useState<PrepLesson | null>(null);
  return (
    <>
      {quizOf !== null ? <LessonQuizForm key={quizOf.id} client={client} lesson={quizOf} onDone={() => setQuizOf(null)} /> : null}
      {editing !== null ? (
        <LessonForm client={client} lesson={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      ) : canWrite ? (
        <div className="row">
          <button type="button" onClick={() => setEditing("new")}>
            Write a lesson
          </button>
        </div>
      ) : null}
      <section className="card prep-card" aria-label="Lessons">
        <div className="bar">
          <strong>Lessons</strong>
        </div>
        {lessons.isPending ? (
          <SkeletonRows rows={3} columns={4} />
        ) : (lessons.data ?? []).length === 0 ? (
          <EmptyState icon={BookOpen} compact>
            No lessons yet. A lesson is Markdown, with a link to a video if it has one.
          </EmptyState>
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
                      <>
                        <button type="button" className="quiet" onClick={() => setEditing(l)}>
                          Edit
                        </button>
                        <button type="button" className="quiet" aria-label={`Quiz for ${l.title}`} onClick={() => setQuizOf(l)}>
                          Quiz
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
      className="card prep-card"
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

/**
 * A lesson's quiz: up to ten multiple-choice or number problems, asked at the
 * end of the lesson and checked at once. What a learner gets wrong goes to
 * their revision.
 */
function LessonQuizForm({ client, lesson, onDone }: { client: ConsoleClient; lesson: PrepLesson; onDone: () => void }) {
  const problems = useQuery({ queryKey: ["practice", "problems"], queryFn: () => client.practiceProblems() });
  const current = useQuery({ queryKey: ["prep", "lesson-quiz", lesson.id], queryFn: () => client.lessonQuiz(lesson.id) });
  const [chosen, setChosen] = useState<readonly string[] | null>(null);
  const picked = chosen ?? current.data ?? [];
  const save = useMutation({
    mutationFn: () => client.setLessonQuiz(lesson.id, picked),
    onSuccess: onDone,
  });
  const askable = (problems.data ?? []).filter((p) => p.question.kind === "mcq" || p.question.kind === "numeric");
  const toggle = (id: string) => setChosen(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  return (
    <form
      className="card prep-card"
      aria-label={`Quiz for ${lesson.title}`}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="bar">
        <strong>Quiz for {lesson.title}</strong>
        <span className="notice">{picked.length} of 10 at most</span>
      </div>
      <p className="notice">Multiple-choice and number problems only: they are checked the moment a learner hands the quiz in. A wrong answer goes to the learner's revision.</p>
      {problems.isPending || current.isPending ? (
        <SkeletonRows rows={3} columns={2} />
      ) : askable.length === 0 ? (
        <p className="notice">No multiple-choice or number problems yet. Add some on the Problems tab first.</p>
      ) : (
        <ul className="plain">
          {askable.map((p) => (
            <li key={p.id}>
              <label className="check">
                <input type="checkbox" checked={picked.includes(p.id)} disabled={!picked.includes(p.id) && picked.length >= 10} onChange={() => toggle(p.id)} /> {p.title}
                {p.published ? null : <span className="pill">Hidden</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
      {save.isError ? (
        <p className="error" role="alert">
          {failure(save.error, "The quiz could not be saved.")}
        </p>
      ) : null}
      <div className="row">
        <button type="submit" disabled={save.isPending || current.isPending}>
          Save quiz
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
    <section className="card prep-card" aria-label="Problem of the day">
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

// --- Plus and the tutor --------------------------------------------------------------------------------

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const FLOW_NAMES = { hint: "Hints", review: "Reviews", doubt: "Doubts" } as const;

/** Sahayak's eval scores beside their targets (Prep blueprint §14): how far the tutor can be trusted. */
export function TutorEvals({ client }: { client: ConsoleClient }) {
  const evals = useQuery({ queryKey: ["prep", "tutor-evals"], queryFn: () => client.tutorEvals() });
  if (evals.data === undefined) return null;
  const e = evals.data;
  return (
    <section className="card prep-card" aria-label="Sahayak evals">
      <div className="bar">
        <strong>Sahayak evals</strong>
      </div>
      <p className="notice">
        {e.recordedAt === null
          ? "No eval run yet: 360 cases (40 problems) wait on the first paid run. Until then the tutor is tested only against a stand-in model."
          : `Last run ${new Date(e.recordedAt).toLocaleDateString("en-IN")}, model ${e.model ?? "unknown"}.`}
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Flow</th>
            <th scope="col">Check</th>
            <th scope="col">Target</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {e.flows.flatMap((f) =>
            f.metrics.map((m, i) => (
              <tr key={`${f.flow}-${m.id}`}>
                <td>{i === 0 ? `${FLOW_NAMES[f.flow]}${f.cases > 0 ? ` (${f.cases} cases)` : ""}` : ""}</td>
                <td>{m.label}</td>
                <td>{m.target === null ? "—" : `≥ ${m.target}%`}</td>
                <td>{m.percent === null ? <span className="notice">Not run</span> : <span className={`pill ${m.met === false ? "warn" : "ok"}`}>{m.percent}%</span>}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </section>
  );
}

export function PlusAdmin({ client, canManage }: { client: ConsoleClient; canManage: boolean }) {
  const queryClient = useQueryClient();
  const admin = useQuery({ queryKey: ["prep", "plus"], queryFn: () => client.plusAdmin() });
  const learners = useQuery({ queryKey: ["practice", "learners"], queryFn: () => client.practiceLearners(), enabled: canManage });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["prep", "plus"] });
  const settings = useMutation({ mutationFn: (patch: Parameters<ConsoleClient["savePlusSettings"]>[0]) => client.savePlusSettings(patch), onSuccess: refresh });
  const [product, setProduct] = useState({ title: "", kind: "plus" as PlusProduct["kind"], days: 90, credits: 1000, rupees: 999 });
  const addProduct = useMutation({
    mutationFn: () =>
      client.savePlusProduct(null, {
        title: product.title.trim(),
        kind: product.kind,
        days: product.kind === "credits" ? 0 : product.days,
        credits: product.credits,
        pricePaise: Math.round(product.rupees * 100),
        active: true,
      }),
    onSuccess: () => {
      setProduct({ ...product, title: "" });
      void refresh();
    },
  });
  const toggle = useMutation({
    mutationFn: (p: { id: string; title: string; kind: PlusProduct["kind"]; days: number; credits: number; pricePaise: number; active: boolean }) =>
      client.savePlusProduct(p.id, { title: p.title, kind: p.kind, days: p.days, credits: p.credits, pricePaise: p.pricePaise, active: !p.active }),
    onSuccess: refresh,
  });
  const [grantTo, setGrantTo] = useState("");
  const [grantDays, setGrantDays] = useState(180);
  const grant = useMutation({ mutationFn: () => client.grantPlus(grantTo, grantDays) });

  if (admin.data === undefined) return <p className="notice">Loading…</p>;
  const s = admin.data.settings;
  return (
    <>
      <section className="card prep-card" aria-label="Plus and the tutor">
        <div className="bar">
          <strong>Plus and the tutor</strong>
        </div>
        <p className="notice">
          With Plus off, everything on the site is free. With it on, the problem set and each track's first modules stay free; the rest of the lessons and a study plan
          need Plus, which learners buy here or you give them. The tutor answers in credits; every learner gets the monthly credits, and its spend counts in this
          organisation's monthly model budget.
        </p>
        <label className="check">
          <input type="checkbox" checked={s.plusEnabled} disabled={!canManage || settings.isPending} onChange={(e) => settings.mutate({ plusEnabled: e.target.checked })} /> Sell
          Plus on this site
        </label>
        <label className="check">
          <input type="checkbox" checked={s.tutorEnabled} disabled={!canManage || settings.isPending} onChange={(e) => settings.mutate({ tutorEnabled: e.target.checked })} />{" "}
          The tutor (Sahayak) answers learners
        </label>
        <div className="row">
          <label>
            Free modules in each track
            <input type="number" min={0} max={60} defaultValue={s.freeModules} disabled={!canManage} onBlur={(e) => settings.mutate({ freeModules: Number(e.target.value) })} />
          </label>
          <label>
            Free tutor credits a month
            <input type="number" min={0} max={100000} defaultValue={s.monthlyCredits} disabled={!canManage} onBlur={(e) => settings.mutate({ monthlyCredits: Number(e.target.value) })} />
          </label>
          <label>
            Free trial, days (0: none)
            <input type="number" min={0} max={60} defaultValue={s.trialDays ?? 0} disabled={!canManage} onBlur={(e) => settings.mutate({ trialDays: Number(e.target.value) })} />
          </label>
        </div>
        {settings.isError ? (
          <p className="error" role="alert">
            {failure(settings.error, "Those settings could not be saved.")}
          </p>
        ) : null}
      </section>

      <section className="card prep-card" aria-label="Plans">
        <div className="bar">
          <strong>Plans</strong>
        </div>
        {admin.data.products.length === 0 ? (
          <p className="notice">No plans yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col">Gives</th>
                <th scope="col">Price (GST included)</th>
                <th scope="col">On sale</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {admin.data.products.map((p) => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td>
                    {p.days > 0 ? `${p.days} days of ${p.kind === "company" ? "Company Pass" : p.kind === "dsa" ? "DSA Pass" : "Plus"}` : ""}
                    {p.days > 0 && p.credits > 0 ? " + " : ""}
                    {p.credits > 0 ? `${p.credits.toLocaleString("en-IN")} credits` : ""}
                  </td>
                  <td>{rupees(p.pricePaise)}</td>
                  <td>{p.active ? <span className="pill ok">On sale</span> : <span className="pill">Off</span>}</td>
                  <td>
                    {canManage ? (
                      <button type="button" className="secondary" onClick={() => toggle.mutate(p)}>
                        {p.active ? "Take off sale" : "Put on sale"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canManage ? (
          <form
            className="row"
            aria-label="New plan"
            onSubmit={(e) => {
              e.preventDefault();
              addProduct.mutate();
            }}
          >
            <label className="grow">
              Plan name
              <input value={product.title} maxLength={120} required onChange={(e) => setProduct({ ...product, title: e.target.value })} />
            </label>
            <label>
              Kind
              <select value={product.kind} onChange={(e) => setProduct({ ...product, kind: e.target.value as PlusProduct["kind"] })}>
                <option value="plus">Plus</option>
                <option value="company">Company Pass (every company list, nothing else)</option>
                <option value="dsa">DSA Pass (every lesson and the study plan, nothing else)</option>
                <option value="credits">Credits pack</option>
              </select>
            </label>
            {product.kind !== "credits" ? (
              <label>
                Days
                <input type="number" min={1} max={1100} value={product.days} onChange={(e) => setProduct({ ...product, days: Number(e.target.value) })} />
              </label>
            ) : null}
            <label>
              Credits
              <input type="number" min={0} value={product.credits} onChange={(e) => setProduct({ ...product, credits: Number(e.target.value) })} />
            </label>
            <label>
              Price, ₹
              <input type="number" min={1} step="0.01" value={product.rupees} onChange={(e) => setProduct({ ...product, rupees: Number(e.target.value) })} />
            </label>
            <button type="submit" disabled={addProduct.isPending}>
              Add plan
            </button>
          </form>
        ) : null}
        {addProduct.isError ? (
          <p className="error" role="alert">
            {failure(addProduct.error, "The plan could not be added.")}
          </p>
        ) : null}
      </section>

      {canManage ? (
        <section className="card prep-card" aria-label="Give Plus">
          <div className="bar">
            <strong>Give Plus</strong>
          </div>
          <p className="notice">For a campus licence, a scholarship or a prize. It runs on from any Plus the learner already holds.</p>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (grantTo !== "") grant.mutate();
            }}
          >
            <label className="grow">
              Learner
              <select value={grantTo} onChange={(e) => setGrantTo(e.target.value)}>
                <option value="">Choose a learner…</option>
                {(learners.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.email})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Days
              <input type="number" min={1} max={1100} value={grantDays} onChange={(e) => setGrantDays(Number(e.target.value))} />
            </label>
            <button type="submit" disabled={grant.isPending || grantTo === ""}>
              Give Plus
            </button>
          </form>
          {grant.isSuccess ? <p className="notice">Given, until {new Date(grant.data.until).toLocaleDateString("en-IN")}.</p> : null}
          {grant.isError ? (
            <p className="error" role="alert">
              {failure(grant.error, "Plus could not be given.")}
            </p>
          ) : null}
        </section>
      ) : null}

    </>
  );
}
