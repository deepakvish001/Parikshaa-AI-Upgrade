import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, BookOpen, CalendarDays, CircleCheck, Coins, Crown, Flame, ListChecks, Lock, NotebookPen, Play, Plus, Repeat, Square, Target, Timer } from "lucide-react";
import { Markdown } from "@parikshaa/brand/markdown";
import { usePreferences } from "../i18n.tsx";
import { ApiError } from "../api.ts";
import type { Grade, Level, Note, NoteKind, PlanInput, PlanTask, Reward } from "./client.ts";
import { loadCheckout, type RazorpayConstructor } from "./checkout.ts";
import { LessonDoubt } from "./Tutor.tsx";
import { DifficultyPill, Link, messageOf, SignInNeeded, useWhen, type Context } from "./parts.tsx";
import { usePrepText, type PrepKey } from "./prep-text.ts";
import "./prep.css";

/**
 * The prep pages (ROADMAP §16): the learner's dashboard, tracks and lessons,
 * the study plan with its focus timer, revision, lists, notes, the problem of
 * the day and coins. Everything here is the signed-in learner's own, or what
 * the site has published.
 */

type Signed = Context & { readonly learner: NonNullable<Context["learner"]> };

const key = (site: string, ...rest: readonly unknown[]) => ["practice", site, "prep", ...rest];
const hours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

function useDay() {
  const { language } = usePreferences();
  return (day: string) => new Intl.DateTimeFormat(`${language}-IN`, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/** Coins just earned, said once. */
export function RewardNote({ reward }: { readonly reward: Reward | undefined | null }) {
  const p = usePrepText();
  if (reward === undefined || reward === null || reward.coins <= 0) return null;
  return (
    <p className="reward-note" role="status">
      <Coins aria-hidden="true" /> {p("coins.reward", { n: reward.coins })}
    </p>
  );
}

function Loading() {
  const p = usePrepText();
  return <p className="notice">{p("common.loading")}</p>;
}

function Failed({ error }: { readonly error: unknown }) {
  const p = usePrepText();
  return (
    <p className="error" role="alert">
      {messageOf(error, p("common.failed"))}
    </p>
  );
}

// --- the dashboard -------------------------------------------------------------------------

export function HomePage({ client, nav, learner, site }: Signed) {
  const p = usePrepText();
  const day = useDay();
  const home = useQuery({ queryKey: key(site, "home", learner.id), queryFn: () => client.home() });
  if (home.isPending) return <Loading />;
  if (home.isError) return <Failed error={home.error} />;
  const h = home.data;
  const plan = h.plan;
  const doneToday = plan?.today.filter((t) => t.done).length ?? 0;
  const minutesToday = plan?.today.reduce((sum, t) => sum + t.estMinutes, 0) ?? 0;

  return (
    <div className="prep-page home-page">
      <header className="prep-head">
        <div>
          <h1>{p("home.hello", { name: h.name.split(" ")[0] ?? h.name })}</h1>
          {plan === null ? null : (
            <p className="notice">
              {p("plan.sprint", { n: plan.sprint })} · {plan.track.title} · {p("plan.finish", { date: day(plan.finishOn) })}
            </p>
          )}
        </div>
        <div className="stat-chips">
          <span className="stat-chip streak-chip">
            <Flame aria-hidden="true" /> {p("home.streak", { n: h.streak })}
          </span>
          <Link nav={nav} to="/coins" className="stat-chip">
            <Coins aria-hidden="true" /> {p("home.coins", { n: h.coins.toLocaleString("en-IN") })}
          </Link>
        </div>
      </header>
      {h.checkin > 0 ? (
        <p className="reward-note" role="status">
          <Coins aria-hidden="true" /> {p("home.checkin", { n: h.checkin })}
        </p>
      ) : null}

      <div className="home-grid">
        <section className="card today-card" aria-labelledby="today-title">
          <div className="card-head">
            <h2 id="today-title">{p("home.todayPlan")}</h2>
            {plan === null ? null : (
              <span className="notice">
                {p("home.doneOf", { done: doneToday, total: plan.today.length })} · {p("home.minutes", { n: minutesToday })}
              </span>
            )}
          </div>
          {plan === null ? (
            <div className="empty-state">
              <p>{p("home.noPlan")}</p>
              <Link nav={nav} to="/plan" className="button">
                <Target aria-hidden="true" /> {p("home.makePlan")}
              </Link>
            </div>
          ) : (
            <>
              <div className="meter" aria-hidden="true">
                <span style={{ width: `${plan.today.length === 0 ? 0 : (doneToday / plan.today.length) * 100}%` }} />
              </div>
              {plan.moved > 0 ? <p className="notice moved-note">{p("home.moved", { n: plan.moved })}</p> : null}
              <TaskList tasks={plan.today} nav={nav} empty={p("plan.nothingToday")} />
              <Link nav={nav} to="/plan">
                {p("nav.plan")} →
              </Link>
            </>
          )}
        </section>

        <div className="home-side">
          <section className="card" aria-labelledby="potd-title">
            <h2 id="potd-title">{p("home.potd")}</h2>
            {h.potd === null ? (
              <p className="notice">{p("home.noPotd")}</p>
            ) : (
              <div className="potd-row">
                <div>
                  <strong>{h.potd.title}</strong> <DifficultyPill difficulty={h.potd.difficulty} />
                </div>
                <Link nav={nav} to={`/problems/${h.potd.slug}`} className={h.potd.solvedThatDay ? "button quiet" : "button"}>
                  {h.potd.solvedThatDay ? p("home.solvedIt") : p("home.solveIt")}
                </Link>
              </div>
            )}
          </section>
          <section className="card" aria-labelledby="revise-title">
            <h2 id="revise-title">{p("home.revise")}</h2>
            <p>{h.dueCards > 0 ? p("home.dueCards", { n: h.dueCards }) : p("home.noDue")}</p>
            {h.dueCards > 0 ? (
              <Link nav={nav} to="/revise" className="button secondary">
                <Repeat aria-hidden="true" /> {p("nav.revise")}
              </Link>
            ) : null}
          </section>
          <section className="card prep-figures" aria-label={p("home.focus")}>
            <div>
              <span className="prep-figure">{h.focusMinutesToday}</span>
              <span className="notice">{p("home.focus")} (min)</span>
            </div>
            <div>
              <span className="prep-figure">{h.solved}</span>
              <span className="notice">{p("home.solved")}</span>
            </div>
          </section>
        </div>
      </div>

      {h.continue === null ? null : (
        <section className="card continue-card" aria-labelledby="continue-title">
          <div className="card-head">
            <h2 id="continue-title">
              {p("home.continue")}: {h.continue.title}
            </h2>
            <span className="notice">{p("tracks.progress", { done: h.continue.done, total: h.continue.items })}</span>
          </div>
          <div className="meter" aria-hidden="true">
            <span style={{ width: `${(h.continue.done / h.continue.items) * 100}%` }} />
          </div>
          <div className="row">
            {h.continue.next === null ? null : (
              <Link nav={nav} to={h.continue.next.kind === "lesson" ? `/lessons/${h.continue.next.slug}` : `/problems/${h.continue.next.slug}`} className="button">
                {p("home.next", { title: h.continue.next.title })}
              </Link>
            )}
            <Link nav={nav} to={`/tracks/${h.continue.slug}`} className="button quiet">
              {p("home.open")}
            </Link>
          </div>
        </section>
      )}

      <nav className="prep-shortcuts" aria-label={p("nav.home")}>
        <Link nav={nav} to="/tracks">
          <BookOpen aria-hidden="true" /> {p("nav.tracks")}
        </Link>
        <Link nav={nav} to="/lists">
          <ListChecks aria-hidden="true" /> {p("nav.lists")}
        </Link>
        <Link nav={nav} to="/notes">
          <NotebookPen aria-hidden="true" /> {p("nav.notes")}
        </Link>
        <Link nav={nav} to="/potd">
          <CalendarDays aria-hidden="true" /> {p("nav.potd")}
        </Link>
        <Link nav={nav} to="/coins">
          <Coins aria-hidden="true" /> {p("nav.coins")}
        </Link>
        <Link nav={nav} to="/plus">
          <Crown aria-hidden="true" /> {p("nav.plus")}
        </Link>
      </nav>
    </div>
  );
}

function TaskList({
  tasks,
  nav,
  empty,
  onToggle,
}: {
  readonly tasks: readonly PlanTask[];
  readonly nav: Context["nav"];
  readonly empty: string;
  readonly onToggle?: (task: PlanTask) => void;
}) {
  const p = usePrepText();
  const day = useDay();
  if (tasks.length === 0) return <p className="notice">{empty}</p>;
  return (
    <ul className="task-list">
      {tasks.map((t) => {
        // A lesson's or a problem's task is done by doing it; the rest are ticked by hand.
        const manual = t.link === null && onToggle !== undefined;
        return (
          <li key={t.id} className={t.done ? "done" : ""}>
            {manual ? (
              <input type="checkbox" id={`task-${t.id}`} checked={t.done} onChange={() => onToggle(t)} aria-label={t.title} />
            ) : t.done ? (
              <CircleCheck className="task-done" aria-label={p("lesson.doneAlready")} />
            ) : (
              <span className="task-open" aria-hidden="true" />
            )}
            <span className={`task-kind kind-${t.kind}`}>{p(`plan.kind.${t.kind}` as PrepKey)}</span>
            <span className="task-title">
              {t.link === null ? (
                <label htmlFor={manual ? `task-${t.id}` : undefined}>{t.title}</label>
              ) : (
                <Link nav={nav} to={t.link.kind === "lesson" ? `/lessons/${t.link.slug}` : `/problems/${t.link.slug}`}>
                  {t.title}
                </Link>
              )}
              {t.difficulty === null ? null : <DifficultyPill difficulty={t.difficulty} />}
              {t.movedFrom === null ? null : <span className="moved">{p("plan.movedFrom", { date: day(t.movedFrom) })}</span>}
            </span>
            <span className="notice task-minutes">{p("home.minutes", { n: t.estMinutes })}</span>
          </li>
        );
      })}
    </ul>
  );
}

// --- tracks and lessons ---------------------------------------------------------------------------

export function TracksPage({ client, nav, learner, site }: Context) {
  const p = usePrepText();
  const tracks = useQuery({ queryKey: key(site, "tracks", learner?.id ?? null), queryFn: () => client.tracks() });
  return (
    <div className="prep-page">
      <header className="prep-head">
        <div>
          <h1>{p("tracks.title")}</h1>
          <p className="notice">{p("tracks.hint")}</p>
        </div>
      </header>
      {tracks.isPending ? (
        <Loading />
      ) : tracks.isError ? (
        <Failed error={tracks.error} />
      ) : tracks.data.length === 0 ? (
        <p className="notice">{p("tracks.none")}</p>
      ) : (
        <div className="track-cards">
          {tracks.data.map((t) => (
            <Link key={t.slug} nav={nav} to={`/tracks/${t.slug}`} className="card track-card">
              <h2>{t.title}</h2>
              {t.description === "" ? null : <p className="notice">{t.description.split("\n")[0]}</p>}
              <div className="meter" aria-hidden="true">
                <span style={{ width: `${t.items === 0 ? 0 : (t.done / t.items) * 100}%` }} />
              </div>
              <span className="notice">
                {p("tracks.modules", { n: t.modules })} · {p("tracks.items", { n: t.items })} · {p("tracks.progress", { done: t.done, total: t.items })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function TrackPage({ client, nav, learner, site, slug }: Context & { readonly slug: string }) {
  const p = usePrepText();
  const track = useQuery({ queryKey: key(site, "track", slug, learner?.id ?? null), queryFn: () => client.track(slug) });
  const [open, setOpen] = useState<number | null>(null);
  if (track.isPending) return <Loading />;
  if (track.isError) return <Failed error={track.error} />;
  const t = track.data;
  // The first module not yet finished is open to begin with.
  const firstOpen = t.modules.findIndex((m) => m.done < m.items.length);
  const shown = open ?? (firstOpen < 0 ? 0 : firstOpen);
  return (
    <div className="prep-page">
      <div className="crumbs">
        <Link nav={nav} to="/tracks">
          ← {p("track.back")}
        </Link>
      </div>
      <header className="prep-head">
        <div>
          <h1>{t.title}</h1>
          {t.description === "" ? null : <Markdown source={t.description} />}
        </div>
        <div className="track-progress">
          <div className="meter" aria-hidden="true">
            <span style={{ width: `${t.items === 0 ? 0 : (t.done / t.items) * 100}%` }} />
          </div>
          <span className="notice">{p("tracks.progress", { done: t.done, total: t.items })}</span>
          {learner === null ? null : (
            <Link nav={nav} to={`/plan?track=${encodeURIComponent(t.slug)}`} className="button secondary">
              <Target aria-hidden="true" /> {p("track.plan")}
            </Link>
          )}
        </div>
      </header>
      <div className="modules">
        {t.modules.map((m, i) => (
          <section key={`${m.title}-${i}`} className="card module">
            <h2>
              <button type="button" className="module-toggle" aria-expanded={shown === i} aria-controls={`module-${i}`} onClick={() => setOpen(shown === i ? -1 : i)}>
                <span>
                  {i + 1}. {m.title}
                </span>
                <span className="notice">
                  {m.done} / {m.items.length}
                </span>
              </button>
            </h2>
            {shown === i ? (
              <ul className="item-list" id={`module-${i}`}>
                {m.items.map((item) => (
                  <li key={`${item.kind}-${item.slug}`} className={item.status === "done" ? "done" : ""}>
                    {item.status === "done" ? (
                      <CircleCheck className="task-done" aria-label={p("lesson.doneAlready")} />
                    ) : item.locked ? (
                      <Lock className="task-locked" aria-label={p("plus.locked")} />
                    ) : (
                      <span className="task-open" aria-hidden="true" />
                    )}
                    <span className={`task-kind ${item.kind === "lesson" ? "kind-learn" : "kind-practice"}`}>{p(item.kind === "lesson" ? "track.lesson" : "track.problem")}</span>
                    <Link nav={nav} to={item.kind === "lesson" ? `/lessons/${item.slug}` : `/problems/${item.slug}`}>
                      {item.title}
                    </Link>
                    {item.difficulty === null ? null : <DifficultyPill difficulty={item.difficulty} />}
                    <span className="notice task-minutes">{p("home.minutes", { n: item.estMinutes })}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}

export function LessonPage({ client, nav, learner, site, slug }: Context & { readonly slug: string }) {
  const p = usePrepText();
  const queryClient = useQueryClient();
  const lesson = useQuery({ queryKey: key(site, "lesson", slug, learner?.id ?? null), queryFn: () => client.lesson(slug) });
  const done = useMutation({
    mutationFn: () => client.lessonDone(slug),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["practice", site] }),
  });
  if (lesson.isPending) return <Loading />;
  if (lesson.isError) return <Failed error={lesson.error} />;
  const l = lesson.data;
  return (
    <div className="prep-page lesson-page">
      <header className="prep-head">
        <div>
          <h1>{l.title}</h1>
          <p className="notice">{p("lesson.minutes", { n: l.estMinutes })}</p>
        </div>
        {learner === null || l.locked ? null : l.done || done.isSuccess ? (
          <span className="pill ok">
            <CircleCheck aria-hidden="true" /> {p("lesson.doneAlready")}
          </span>
        ) : (
          <button type="button" disabled={done.isPending} onClick={() => done.mutate()}>
            {p("lesson.done")}
          </button>
        )}
      </header>
      <RewardNote reward={done.data} />
      {l.locked ? (
        <div className="card locked-card">
          <p>
            <Lock aria-hidden="true" /> {p("plus.locked")}
          </p>
          <Link nav={nav} to="/plus" className="button">
            <Crown aria-hidden="true" /> {p("plus.get")}
          </Link>
        </div>
      ) : null}
      {l.videoUrl === null ? null : (
        <p>
          <a className="button secondary" href={l.videoUrl} target="_blank" rel="noopener noreferrer">
            <Play aria-hidden="true" /> {p("lesson.video")}
          </a>
        </p>
      )}
      {l.locked ? null : (
        <article className="card lesson-body">
          <Markdown source={l.body} />
        </article>
      )}
      {learner === null ? (
        <SignInNeeded nav={nav} next={`/lessons/${slug}`} />
      ) : l.locked ? null : (
        <>
          <NoteEditor client={client} site={site} kind="lesson" refId={slug} />
          <LessonDoubt client={client} lesson={slug} onCredits={() => nav.go("/plus")} />
        </>
      )}
    </div>
  );
}

// --- notes ------------------------------------------------------------------------------------------

export function NoteEditor({ client, site, kind, refId }: { readonly client: Context["client"]; readonly site: string; readonly kind: NoteKind; readonly refId: string }) {
  const p = usePrepText();
  const queryClient = useQueryClient();
  const note = useQuery({ queryKey: key(site, "note", kind, refId), queryFn: () => client.note(kind, refId) });
  const [body, setBody] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (text: string) => client.saveNote(kind, refId, text),
    onSuccess: (saved) => {
      queryClient.setQueryData(key(site, "note", kind, refId), saved);
      void queryClient.invalidateQueries({ queryKey: key(site, "notes") });
    },
  });
  const value = body ?? note.data?.body ?? "";
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(value);
  };
  return (
    <form className="card note-editor" onSubmit={submit}>
      <label htmlFor={`note-${kind}-${refId}`}>
        <NotebookPen aria-hidden="true" /> {p("notes.tab")}
      </label>
      <textarea
        id={`note-${kind}-${refId}`}
        value={value}
        rows={6}
        maxLength={50_000}
        placeholder={p("notes.placeholder")}
        onChange={(e) => {
          setBody(e.target.value);
          save.reset();
        }}
      />
      <div className="row">
        <button type="submit" className="secondary" disabled={save.isPending || note.isPending}>
          {p("notes.save")}
        </button>
        {save.isSuccess ? <span className="notice">{p("notes.saved")}</span> : null}
        {save.isError ? <Failed error={save.error} /> : null}
      </div>
    </form>
  );
}

export function NotesPage({ client, nav, learner, site }: Signed) {
  const p = usePrepText();
  const when = useWhen();
  const notes = useQuery({ queryKey: key(site, "notes", learner.id), queryFn: () => client.notes() });
  const [topic, setTopic] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="prep-page">
      <header className="prep-head">
        <div>
          <h1>{p("notes.title")}</h1>
          <p className="notice">{p("notes.hint")}</p>
        </div>
      </header>
      <form
        className="card inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (topic.trim() !== "") setEditing(topic.trim());
        }}
      >
        <label htmlFor="new-topic">{p("notes.newTopic")}</label>
        <input id="new-topic" value={topic} maxLength={80} placeholder={p("notes.topicName")} onChange={(e) => setTopic(e.target.value)} />
        <button type="submit" className="secondary">
          <Plus aria-hidden="true" /> {p("notes.write")}
        </button>
      </form>
      {editing === null ? null : <NoteEditor key={editing} client={client} site={site} kind="topic" refId={editing} />}
      {notes.isPending ? (
        <Loading />
      ) : notes.isError ? (
        <Failed error={notes.error} />
      ) : notes.data.length === 0 ? (
        <p className="notice">{p("notes.none")}</p>
      ) : (
        <ul className="note-list">
          {notes.data.map((n: Note) => (
            <li key={`${n.kind}-${n.ref}`} className="card">
              <div className="card-head">
                <h2>
                  <span className="task-kind kind-learn">{p(`notes.kind.${n.kind}` as PrepKey)}</span>{" "}
                  {n.kind === "topic" ? (
                    <button type="button" className="link-button" onClick={() => setEditing(n.title)}>
                      {n.title}
                    </button>
                  ) : (
                    <Link nav={nav} to={n.kind === "lesson" ? `/lessons/${n.ref}` : `/problems/${n.ref}`}>
                      {n.title}
                    </Link>
                  )}
                </h2>
                {n.updatedAt === null ? null : <span className="notice">{when(n.updatedAt)}</span>}
              </div>
              <Markdown source={n.body} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- lists ---------------------------------------------------------------------------------------------

/** Save a problem to a list: bookmarks at a click, or a list by name. */
export function SaveMenu({ client, site, slug }: { readonly client: Context["client"]; readonly site: string; readonly slug: string }) {
  const p = usePrepText();
  const queryClient = useQueryClient();
  const lists = useQuery({ queryKey: key(site, "lists"), queryFn: () => client.lists() });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const toggle = useMutation({
    mutationFn: ({ list, on }: { list: string; on: boolean }) => (on ? client.saveTo(list, slug) : client.removeFrom(list, slug)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(site, "lists") }),
  });
  const inList = (list: string) => lists.data?.find((l) => l.name === list)?.problems.some((x) => x.slug === slug) === true;
  const bookmarked = inList("Bookmarks");
  return (
    <div className="save-menu">
      <button type="button" className="quiet" aria-pressed={bookmarked} onClick={() => toggle.mutate({ list: "Bookmarks", on: !bookmarked })} disabled={toggle.isPending}>
        {bookmarked ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />} {bookmarked ? p("lists.saved") : p("lists.save")}
      </button>
      <button type="button" className="quiet" aria-expanded={open} onClick={() => setOpen(!open)}>
        <ListChecks aria-hidden="true" /> {p("nav.lists")}
      </button>
      {open ? (
        <div className="save-popover card">
          {(lists.data ?? [])
            .filter((l) => l.name !== "Bookmarks")
            .map((l) => (
              <label key={l.name} className="check-row">
                <input type="checkbox" checked={inList(l.name)} onChange={(e) => toggle.mutate({ list: l.name, on: e.target.checked })} /> {l.name}
              </label>
            ))}
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim() === "") return;
              toggle.mutate({ list: name.trim(), on: true });
              setName("");
            }}
          >
            <input aria-label={p("lists.newList")} placeholder={p("lists.newList")} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            <button type="submit" className="secondary">
              {p("lists.add")}
            </button>
          </form>
          {toggle.isError ? <Failed error={toggle.error} /> : null}
        </div>
      ) : null}
    </div>
  );
}

export function ListsPage({ client, nav, learner, site }: Signed) {
  const p = usePrepText();
  const queryClient = useQueryClient();
  const lists = useQuery({ queryKey: key(site, "lists", learner.id), queryFn: () => client.lists() });
  const remove = useMutation({
    mutationFn: ({ list, slug }: { list: string; slug: string }) => client.removeFrom(list, slug),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(site, "lists") }),
  });
  return (
    <div className="prep-page">
      <header className="prep-head">
        <div>
          <h1>{p("lists.title")}</h1>
          <p className="notice">{p("lists.hint")}</p>
        </div>
      </header>
      {lists.isPending ? (
        <Loading />
      ) : lists.isError ? (
        <Failed error={lists.error} />
      ) : (
        lists.data.map((l) => (
          <section key={l.name} className="card list-card" aria-labelledby={`list-${l.name}`}>
            <div className="card-head">
              <h2 id={`list-${l.name}`}>{l.name}</h2>
              <span className="notice">{p("tracks.progress", { done: l.solved, total: l.problems.length })}</span>
            </div>
            {l.problems.length === 0 ? (
              <p className="notice">{p("lists.empty")}</p>
            ) : (
              <ul className="item-list">
                {l.problems.map((x) => (
                  <li key={x.slug} className={x.solved ? "done" : ""}>
                    {x.solved ? <CircleCheck className="task-done" aria-label={p("home.solvedIt")} /> : <span className="task-open" aria-hidden="true" />}
                    <Link nav={nav} to={`/problems/${x.slug}`}>
                      {x.title}
                    </Link>
                    <DifficultyPill difficulty={x.difficulty} />
                    <button type="button" className="quiet small" onClick={() => remove.mutate({ list: l.name, slug: x.slug })}>
                      {p("lists.remove")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
}

// --- revision --------------------------------------------------------------------------------------------

export function RevisePage({ client, nav, learner, site }: Signed) {
  const p = usePrepText();
  const queryClient = useQueryClient();
  const revision = useQuery({ queryKey: key(site, "revise", learner.id), queryFn: () => client.revision() });
  const [shown, setShown] = useState<string | null>(null);
  const [last, setLast] = useState<{ slug: string; days: number } | null>(null);
  const grade = useMutation({
    mutationFn: ({ slug, g }: { slug: string; g: Grade }) => client.grade(slug, g),
    onSuccess: (result, { slug }) => {
      setLast({ slug, days: result.intervalDays });
      setShown(null);
      void queryClient.invalidateQueries({ queryKey: ["practice", site] });
    },
  });
  return (
    <div className="prep-page">
      <header className="prep-head">
        <div>
          <h1>{p("revise.title")}</h1>
          <p className="notice">{p("revise.hint")}</p>
        </div>
      </header>
      {last === null ? null : (
        <p className="notice" role="status">
          {p("revise.next", { n: last.days })}
        </p>
      )}
      {revision.isPending ? (
        <Loading />
      ) : revision.isError ? (
        <Failed error={revision.error} />
      ) : revision.data.due.length === 0 ? (
        <div className="card empty-state">
          <p>{p("revise.none")}</p>
          {revision.data.upcoming > 0 ? <p className="notice">{p("revise.upcoming", { n: revision.data.upcoming })}</p> : null}
        </div>
      ) : (
        <>
          <ul className="revise-list">
            {revision.data.due.map((c) => (
              <li key={c.slug} className="card revise-card">
                <div className="card-head">
                  <h2>
                    <Link nav={nav} to={`/problems/${c.slug}`}>
                      {c.title}
                    </Link>{" "}
                    <DifficultyPill difficulty={c.difficulty} />
                  </h2>
                  <span className="notice">{p("revise.reviewed", { n: c.reps })}</span>
                </div>
                {c.tags.length === 0 ? null : (
                  <div className="tag-row">
                    {c.tags.map((tag) => (
                      <span key={tag} className="chip static">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {shown === c.slug ? (
                  c.note === null ? (
                    <p className="notice">{p("revise.noNote")}</p>
                  ) : (
                    <div className="revise-note">
                      <Markdown source={c.note} />
                    </div>
                  )
                ) : (
                  <button type="button" className="quiet" onClick={() => setShown(c.slug)}>
                    {p("revise.show")}
                  </button>
                )}
                <div className="grade-row" role="group" aria-label={c.title}>
                  {(["again", "hard", "good", "easy"] as const).map((g) => (
                    <button key={g} type="button" className={`grade ${g}`} disabled={grade.isPending} onClick={() => grade.mutate({ slug: c.slug, g })}>
                      {p(`revise.${g}` as PrepKey)}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {revision.data.later > 0 ? <p className="notice">{p("revise.later", { n: revision.data.later })}</p> : null}
        </>
      )}
    </div>
  );
}

// --- the plan ---------------------------------------------------------------------------------------------

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const plusDays = (days: number) => new Date(Date.now() + 5.5 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);

export function PlanPage({ client, nav, learner, site, track: wanted }: Signed & { readonly track: string | undefined }) {
  const plan = useQuery({ queryKey: key(site, "plan", learner.id), queryFn: () => client.plan() });
  if (plan.isPending) return <Loading />;
  if (plan.isError) return <Failed error={plan.error} />;
  return plan.data === null ? (
    <PlanSetup client={client} nav={nav} learner={learner} site={site} track={wanted} />
  ) : (
    <PlanView client={client} nav={nav} learner={learner} site={site} />
  );
}

function PlanSetup({ client, nav, learner, site, track: wanted }: Signed & { readonly track: string | undefined }) {
  const p = usePrepText();
  const day = useDay();
  const queryClient = useQueryClient();
  const tracks = useQuery({ queryKey: key(site, "tracks", learner.id), queryFn: () => client.tracks() });
  const [input, setInput] = useState<PlanInput>({ track: wanted ?? "", level: "intermediate", deadline: plusDays(90), dailyMinutes: 120, offDays: [0] });
  const [goal, setGoal] = useState("");
  useEffect(() => {
    if (input.track === "" && tracks.data !== undefined && tracks.data[0] !== undefined) setInput((i) => ({ ...i, track: tracks.data[0]!.slug }));
  }, [tracks.data, input.track]);
  const preview = useMutation({ mutationFn: (i: PlanInput) => client.previewPlan(i) });
  const needsPlus = preview.error instanceof ApiError && preview.error.code === "plus_required";
  const start = useMutation({
    mutationFn: (i: PlanInput) => client.startPlan({ ...i, ...(goal.trim() === "" ? {} : { goal: goal.trim() }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["practice", site] }),
  });
  const set = (patch: Partial<PlanInput>) => {
    setInput((i) => ({ ...i, ...patch }));
    preview.reset();
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    preview.mutate(input);
  };
  const shown = preview.data;
  const maxSprint = shown === undefined ? 1 : Math.max(1, ...shown.sprints.map((s) => s.tasks));

  return (
    <div className="prep-page">
      <header className="prep-head">
        <div>
          <h1>{p("plan.setup")}</h1>
          <p className="notice">{p("plan.setupHint")}</p>
        </div>
      </header>
      <div className="plan-setup">
        <form className="card plan-form" onSubmit={submit}>
          <label htmlFor="plan-track">{p("plan.track")}</label>
          <select id="plan-track" value={input.track} onChange={(e) => set({ track: e.target.value })} required>
            {(tracks.data ?? []).map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.title} ({p("tracks.progress", { done: t.done, total: t.items })})
              </option>
            ))}
          </select>
          <fieldset>
            <legend>{p("plan.level")}</legend>
            {(["beginner", "intermediate", "advanced"] as const).map((level: Level) => (
              <label key={level} className="check-row">
                <input type="radio" name="plan-level" value={level} checked={input.level === level} onChange={() => set({ level })} /> {p(`plan.level.${level}` as PrepKey)}
              </label>
            ))}
          </fieldset>
          <label htmlFor="plan-deadline">{p("plan.deadline")}</label>
          <input id="plan-deadline" type="date" value={input.deadline} min={plusDays(6)} onChange={(e) => set({ deadline: e.target.value })} required />
          <label htmlFor="plan-daily">{p("plan.daily")}</label>
          <input id="plan-daily" type="number" min={15} max={720} step={15} value={input.dailyMinutes} onChange={(e) => set({ dailyMinutes: Number(e.target.value) })} required />
          <fieldset>
            <legend>{p("plan.offDays")}</legend>
            <div className="weekday-row">
              {WEEKDAYS.map((name, i) => (
                <label key={name} className="check-row">
                  <input
                    type="checkbox"
                    checked={input.offDays.includes(i)}
                    onChange={(e) => set({ offDays: e.target.checked ? [...input.offDays, i] : input.offDays.filter((d) => d !== i) })}
                  />{" "}
                  {name}
                </label>
              ))}
            </div>
          </fieldset>
          <label htmlFor="plan-goal">{p("plan.goal")}</label>
          <input id="plan-goal" value={goal} maxLength={200} placeholder={p("plan.goalPlaceholder")} onChange={(e) => setGoal(e.target.value)} />
          <button type="submit" disabled={preview.isPending || input.track === ""}>
            {p("plan.preview")}
          </button>
          {needsPlus ? (
            <div className="locked-card">
              <p>
                <Lock aria-hidden="true" /> {p("plus.lockedPlan")}
              </p>
              <Link nav={nav} to="/plus" className="button">
                <Crown aria-hidden="true" /> {p("plus.get")}
              </Link>
            </div>
          ) : preview.isError ? (
            <Failed error={preview.error} />
          ) : null}
        </form>

        {shown === undefined ? null : (
          <section className="card plan-preview" aria-labelledby="preview-title">
            <h2 id="preview-title">{shown.track.title}</h2>
            <p className="notice">{p("plan.summary", { tasks: shown.tasks, hours: hours(shown.totalMinutes), sprints: shown.sprints.length })}</p>
            {shown.fits ? (
              <p className="alert ok">{p("plan.fits", { date: day(shown.finishOn) })}</p>
            ) : (
              <div className="alert warn">
                <p>{p("plan.noFit", { n: input.dailyMinutes, date: day(shown.finishOn) })}</p>
                {shown.dailyMinutesToFit === null ? null : (
                  <button type="button" className="secondary" onClick={() => set({ dailyMinutes: shown.dailyMinutesToFit! })}>
                    {p("plan.toFit", { n: shown.dailyMinutesToFit })}
                  </button>
                )}
              </div>
            )}
            <ol className="sprint-bars">
              {shown.sprints.map((s) => (
                <li key={s.sprint}>
                  <span className="sprint-name">{p("plan.sprint", { n: s.sprint })}</span>
                  <span className="sprint-bar" aria-hidden="true">
                    <span style={{ width: `${(s.tasks / maxSprint) * 100}%` }} />
                  </span>
                  <span className="notice">
                    {day(s.from)}–{day(s.to)}
                  </span>
                </li>
              ))}
            </ol>
            <button type="button" disabled={start.isPending} onClick={() => start.mutate(input)}>
              {p("plan.start")}
            </button>
            {start.isError ? <Failed error={start.error} /> : null}
          </section>
        )}
      </div>
    </div>
  );
}

type PlanTab = "today" | "upcoming" | "completed" | "sprints";

function PlanView({ client, nav, learner, site }: Signed) {
  const p = usePrepText();
  const day = useDay();
  const queryClient = useQueryClient();
  const plan = useQuery({ queryKey: key(site, "plan", learner.id), queryFn: () => client.plan() });
  const [tab, setTab] = useState<PlanTab>("today");
  const [confirmStop, setConfirmStop] = useState(false);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(30);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["practice", site] });
  const toggle = useMutation({ mutationFn: (t: PlanTask) => client.setTaskDone(t.id, !t.done), onSuccess: refresh });
  const add = useMutation({
    mutationFn: () => client.addTask(title.trim(), minutes),
    onSuccess: () => {
      setTitle("");
      void refresh();
    },
  });
  const stop = useMutation({ mutationFn: () => client.stopPlan(), onSuccess: refresh });
  if (plan.data === undefined || plan.data === null) return <Loading />;
  const pl = plan.data;
  const list = tab === "today" ? pl.today : tab === "upcoming" ? pl.upcoming : tab === "completed" ? pl.completed : [];

  return (
    <div className="prep-page">
      <header className="prep-head">
        <div>
          <h1>
            {p("plan.title")}: {pl.track.title}
          </h1>
          <p className="notice">
            {p("plan.sprint", { n: pl.sprint })} · {p("plan.finish", { date: day(pl.finishOn) })} · {p("plan.deadlineOn", { date: day(pl.deadline) })} · {p("plan.days", { n: pl.daysLeft })}
          </p>
        </div>
        <span className={`pill ${pl.onTrack ? "ok" : "warn"}`}>{pl.onTrack ? p("plan.onTrack") : p("plan.behind")}</span>
      </header>
      <div className="meter" aria-hidden="true">
        <span style={{ width: `${pl.total === 0 ? 0 : (pl.done / pl.total) * 100}%` }} />
      </div>
      <p className="notice">{p("home.doneOf", { done: pl.done, total: pl.total })}</p>
      {pl.moved > 0 ? <p className="alert warn">{p("home.moved", { n: pl.moved })}</p> : null}

      <div className="plan-layout">
        <section className="card">
          <div className="problem-tabs" role="tablist" aria-label={p("plan.title")}>
            {(["today", "upcoming", "completed", "sprints"] as const).map((name) => (
              <button key={name} type="button" role="tab" aria-selected={tab === name} className={tab === name ? "on" : ""} onClick={() => setTab(name)}>
                {p(`plan.${name}` as PrepKey)}
              </button>
            ))}
          </div>
          {tab === "sprints" ? (
            <ol className="sprint-bars">
              {pl.sprints.map((s) => (
                <li key={s.sprint} className={s.sprint === pl.sprint ? "current" : ""}>
                  <span className="sprint-name">{p("plan.sprint", { n: s.sprint })}</span>
                  <span className="sprint-bar" aria-hidden="true">
                    <span style={{ width: `${s.tasks === 0 ? 0 : (s.done / s.tasks) * 100}%` }} />
                  </span>
                  <span className="notice">
                    {s.done}/{s.tasks} · {day(s.from)}–{day(s.to)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <TaskList tasks={list} nav={nav} empty={p("plan.nothingToday")} onToggle={(t) => toggle.mutate(t)} />
          )}
          <form
            className="inline-form add-task"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim() !== "") add.mutate();
            }}
          >
            <label htmlFor="task-title" className="visually-hidden">
              {p("plan.taskTitle")}
            </label>
            <input id="task-title" value={title} maxLength={200} placeholder={p("plan.addTask")} onChange={(e) => setTitle(e.target.value)} />
            <label htmlFor="task-minutes" className="visually-hidden">
              {p("plan.taskMinutes")}
            </label>
            <input id="task-minutes" type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
            <button type="submit" className="secondary" disabled={add.isPending}>
              <Plus aria-hidden="true" /> {p("plan.add")}
            </button>
          </form>
          {add.isError ? <Failed error={add.error} /> : null}
        </section>
        <FocusTimer client={client} site={site} learner={learner} tasks={pl.today.filter((t) => !t.done)} />
      </div>

      <div className="danger-zone">
        {confirmStop ? (
          <div className="row">
            <span>{p("plan.stopConfirm")}</span>
            <button type="button" className="danger" onClick={() => stop.mutate()} disabled={stop.isPending}>
              {p("plan.stop")}
            </button>
            <button type="button" className="quiet" onClick={() => setConfirmStop(false)}>
              ✕
            </button>
          </div>
        ) : (
          <button type="button" className="quiet" onClick={() => setConfirmStop(true)}>
            {p("plan.stop")}
          </button>
        )}
      </div>
    </div>
  );
}

const focusKey = (site: string) => `parikshaa.practice.${site}.focus`;

/** A study timer. The session is timed by the server; the page only remembers which one is open. */
function FocusTimer({ client, site, learner, tasks }: { readonly client: Context["client"]; readonly site: string; readonly learner: Signed["learner"]; readonly tasks: readonly PlanTask[] }) {
  const p = usePrepText();
  const queryClient = useQueryClient();
  const week = useQuery({ queryKey: key(site, "focus", learner.id), queryFn: () => client.focusWeek() });
  const [running, setRunning] = useState<{ id: string; startedAt: string; task: string | null } | null>(() => {
    try {
      const saved = localStorage.getItem(focusKey(site));
      return saved === null ? null : (JSON.parse(saved) as { id: string; startedAt: string; task: string | null });
    } catch {
      return null;
    }
  });
  const [taskId, setTaskId] = useState<string>("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (running === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  const remember = (value: typeof running) => {
    setRunning(value);
    try {
      if (value === null) localStorage.removeItem(focusKey(site));
      else localStorage.setItem(focusKey(site), JSON.stringify(value));
    } catch {
      // A private window: the timer lasts this page.
    }
  };
  const start = useMutation({
    mutationFn: () => client.startFocus(taskId === "" ? null : taskId),
    onSuccess: (s) => remember({ id: s.id, startedAt: s.startedAt, task: tasks.find((t) => t.id === taskId)?.title ?? null }),
  });
  const stop = useMutation({
    mutationFn: (id: string) => client.stopFocus(id),
    onSettled: () => {
      remember(null);
      void queryClient.invalidateQueries({ queryKey: key(site, "focus") });
    },
  });
  const elapsed = running === null ? 0 : Math.max(0, Math.floor((now - Date.parse(running.startedAt)) / 1000));
  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const max = Math.max(30, ...(week.data ?? []).map((d) => d.minutes));
  const total = useMemo(() => (week.data ?? []).reduce((s, d) => s + d.minutes, 0), [week.data]);

  return (
    <section className="card focus-card" aria-labelledby="focus-title">
      <h2 id="focus-title">
        <Timer aria-hidden="true" /> {p("focus.title")}
      </h2>
      <p className="focus-clock" aria-live="off">
        {clock}
      </p>
      {running === null ? (
        <>
          <label htmlFor="focus-task" className="visually-hidden">
            {p("plan.taskTitle")}
          </label>
          <select id="focus-task" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">{p("focus.free")}</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => start.mutate()} disabled={start.isPending}>
            <Play aria-hidden="true" /> {p("focus.start")}
          </button>
        </>
      ) : (
        <>
          <p className="notice">{p("focus.on", { task: running.task ?? p("focus.free") })}</p>
          <button type="button" onClick={() => stop.mutate(running.id)} disabled={stop.isPending}>
            <Square aria-hidden="true" /> {p("focus.stop")}
          </button>
        </>
      )}
      <h3>{p("focus.week")}</h3>
      <div className="focus-week" aria-label={p("focus.logged", { n: total })} role="img">
        {(week.data ?? []).map((d) => (
          <span key={d.day} className="focus-bar" title={`${d.day}: ${d.minutes} min`}>
            <span style={{ height: `${(d.minutes / max) * 100}%` }} />
          </span>
        ))}
      </div>
      <p className="notice">{p("focus.logged", { n: total })}</p>
    </section>
  );
}

// --- the problem of the day, and coins -------------------------------------------------------------------

export function PotdPage({ client, nav, learner, site }: Context) {
  const p = usePrepText();
  const day = useDay();
  const potd = useQuery({ queryKey: key(site, "potd", learner?.id ?? null), queryFn: () => client.potd() });
  return (
    <div className="prep-page">
      <header className="prep-head">
        <div>
          <h1>{p("potd.title")}</h1>
          <p className="notice">{p("potd.hint")}</p>
        </div>
      </header>
      {potd.isPending ? (
        <Loading />
      ) : potd.isError ? (
        <Failed error={potd.error} />
      ) : (
        <>
          {potd.data.today === null ? (
            <p className="notice">{p("potd.none")}</p>
          ) : (
            <section className="card potd-today">
              <span className="notice">{day(potd.data.today.day)}</span>
              <h2>
                {potd.data.today.title} <DifficultyPill difficulty={potd.data.today.difficulty} />
              </h2>
              <Link nav={nav} to={`/problems/${potd.data.today.slug}`} className="button">
                {potd.data.today.solvedThatDay ? p("home.solvedIt") : p("home.solveIt")}
              </Link>
            </section>
          )}
          <h2>{p("potd.past")}</h2>
          <section className="card">
          <ul className="item-list">
            {potd.data.calendar.map((d) => (
              <li key={d.day} className={d.solved ? "done" : ""}>
                {d.solved ? <CircleCheck className="task-done" aria-label={p("home.solvedIt")} /> : <span className="task-open" aria-hidden="true" />}
                <span className="notice potd-day">{day(d.day)}</span>
                <Link nav={nav} to={`/problems/${d.slug}`}>
                  {d.title}
                </Link>
                <DifficultyPill difficulty={d.difficulty} />
              </li>
            ))}
          </ul>
          </section>
        </>
      )}
    </div>
  );
}

export function CoinsPage({ client, nav, learner, site }: Signed) {
  const p = usePrepText();
  const when = useWhen();
  const coins = useQuery({ queryKey: key(site, "coins", learner.id), queryFn: () => client.coins() });
  const leaders = useQuery({ queryKey: key(site, "coin-leaders", learner.id), queryFn: () => client.coinLeaders() });
  const ruleName = (rule: string) => (["checkin", "solve", "solve_after_solution", "potd", "lesson", "module", "track", "streak", "experience", "store", "store_refund", "grant"].includes(rule) ? p(`coins.rule.${rule}` as PrepKey) : rule);
  return (
    <div className="prep-page">
      <header className="prep-head">
        <div>
          <h1>{p("coins.title")}</h1>
        </div>
        <span className="coin-balance">
          <Coins aria-hidden="true" /> {coins.data?.balance.toLocaleString("en-IN") ?? "—"}
        </span>
        <Link nav={nav} to="/store" className="button secondary">
          {p("coins.store")}
        </Link>
      </header>
      <section className="card">
        <h2>{p("coins.how")}</h2>
        <p>{p("coins.rules", { cap: coins.data?.dailyCap ?? 300 })}</p>
      </section>
      <div className="plan-layout">
        <section className="card">
          <h2>{p("coins.history")}</h2>
          {coins.isPending ? (
            <Loading />
          ) : coins.isError ? (
            <Failed error={coins.error} />
          ) : coins.data.history.length === 0 ? (
            <p className="notice">{p("coins.none")}</p>
          ) : (
            <ul className="coin-history">
              {coins.data.history.map((h, i) => (
                <li key={`${h.at}-${i}`}>
                  <span>{ruleName(h.rule)}</span>
                  <span className="notice">{when(h.at)}</span>
                  <strong className={h.amount > 0 ? "plus" : "minus"}>
                    {h.amount > 0 ? "+" : ""}
                    {h.amount}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h2>{p("coins.leaders")}</h2>
          <ol className="coin-leaders">
            {(leaders.data ?? []).map((l) => (
              <li key={l.rank} className={l.you ? "you" : ""}>
                <span className="rank">{l.rank}</span>
                <span>
                  {l.name}
                  {l.you ? ` (${p("common.you")})` : ""}
                </span>
                <strong>{l.coins.toLocaleString("en-IN")}</strong>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

// --- Plus -----------------------------------------------------------------------------------------------

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function PlusPage({ client, nav, learner, site, checkout = loadCheckout }: Context & { readonly checkout?: () => Promise<RazorpayConstructor> }) {
  const p = usePrepText();
  const day = useDay();
  const when = useWhen();
  const queryClient = useQueryClient();
  const plus = useQuery({ queryKey: key(site, "plus", learner?.id ?? null), queryFn: () => client.plus() });
  const credits = useQuery({ queryKey: key(site, "credits"), queryFn: () => client.credits(), enabled: learner !== null });
  const orders = useQuery({ queryKey: key(site, "orders", learner?.id ?? null), queryFn: () => client.orders(), enabled: learner !== null });
  const [outcome, setOutcome] = useState<"paid" | "failed" | null>(null);
  const buy = useMutation({
    mutationFn: async (productId: string) => {
      const [order, Razorpay] = await Promise.all([client.checkout(productId), checkout()]);
      await new Promise<void>((resolve, reject) => {
        const rz = new Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amountPaise,
          currency: "INR",
          name: order.title,
          prefill: { name: order.learner.name, email: order.learner.email },
          handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            client.confirmPayment(r.razorpay_order_id, r.razorpay_payment_id, r.razorpay_signature).then(() => resolve(), reject);
          },
          modal: { ondismiss: () => reject(new Error("dismissed")) },
        });
        rz.on("payment.failed", () => reject(new Error("failed")));
        rz.open();
      });
    },
    onSuccess: () => {
      setOutcome("paid");
      void queryClient.invalidateQueries({ queryKey: ["practice", site] });
    },
    onError: () => setOutcome("failed"),
  });
  if (plus.isPending) return <Loading />;
  if (plus.isError) return <Failed error={plus.error} />;
  const o = plus.data;
  return (
    <div className="prep-page">
      <header className="prep-head">
        <div>
          <h1>
            <Crown aria-hidden="true" /> {p("plus.title")}
          </h1>
          <p className="notice">{o.enabled ? p("plus.hint") : p("plus.off")}</p>
        </div>
        {o.enabled && learner !== null ? (
          <span className={`pill ${o.active ? "ok" : ""}`}>{o.active && o.until !== null ? p("plus.active", { date: day(o.until.slice(0, 10)) }) : p("plus.none")}</span>
        ) : null}
      </header>
      {outcome === "paid" ? <p className="alert ok" role="status">{p("plus.paid")}</p> : outcome === "failed" ? <p className="alert warn" role="alert">{p("plus.failed")}</p> : null}
      {o.products.length === 0 ? null : (
        <div className="track-cards">
          {o.products.map((product) => (
            <section key={product.id} className="card plan-card" aria-label={product.title}>
              <h2>{product.title}</h2>
              <p className="price">{rupees(product.pricePaise)}</p>
              <p className="notice">{p("plus.gst")}</p>
              <ul>
                {product.days > 0 ? <li>{p("plus.days", { n: product.days })}</li> : null}
                {product.credits > 0 ? <li>{p("plus.credits", { n: product.credits.toLocaleString("en-IN") })}</li> : null}
              </ul>
              {learner === null ? (
                <SignInNeeded nav={nav} next="/plus" />
              ) : o.checkout ? (
                <button type="button" disabled={buy.isPending} onClick={() => { setOutcome(null); buy.mutate(product.id); }}>
                  {p("plus.buy", { price: rupees(product.pricePaise) })}
                </button>
              ) : (
                <p className="notice">{p("plus.noCheckout")}</p>
              )}
            </section>
          ))}
        </div>
      )}
      {learner === null ? null : (
        <div className="plan-layout">
          <section className="card" aria-labelledby="credits-title">
            <h2 id="credits-title">{p("credits.title")}</h2>
            <p className="coin-balance">{p("credits.balance", { n: credits.data?.balance ?? 0 })}</p>
            {o.monthlyCredits > 0 ? <p className="notice">{p("credits.monthly", { n: o.monthlyCredits })}</p> : null}
            <ul className="coin-history">
              {(credits.data?.history ?? []).map((h, i) => (
                <li key={`${h.at}-${i}`}>
                  <span>{p(`credits.reason.${h.reason}` as PrepKey)}</span>
                  <span className="notice">{when(h.at)}</span>
                  <strong className={h.delta > 0 ? "plus" : "minus"}>
                    {h.delta > 0 ? "+" : ""}
                    {h.delta}
                  </strong>
                </li>
              ))}
            </ul>
          </section>
          <section className="card" aria-labelledby="orders-title">
            <h2 id="orders-title">{p("plus.orders")}</h2>
            {(orders.data ?? []).every((x) => x.status !== "paid") ? <p className="notice">{p("plus.noOrders")}</p> : null}
            <ul className="coin-history">
              {(orders.data ?? [])
                .filter((x) => x.status === "paid")
                .map((x) => (
                  <li key={x.id}>
                    <span>{x.title}</span>
                    <span className="notice">{x.paidAt === null ? "" : when(x.paidAt)}</span>
                    <strong>{rupees(x.amountPaise)}</strong>
                  </li>
                ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
