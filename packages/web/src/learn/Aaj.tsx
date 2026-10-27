import { ArrowRight, BookOpen, CalendarRange, Check, CircleX, Feather, NotebookPen, Play, RotateCcw, Snowflake, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { Meter, Ring } from "@parikshaa/brand/kit";
import type { ContestSummary, Difficulty, Home, PlanTask, Submission } from "../practice/client.ts";
import { ScreenLink, useLearn } from "./context.tsx";
import { Failed, Loading, Offline, SignedOut, useContests, useHome, useLearnData, useOnline, useSubmissions, useTargets, waitingForNetwork } from "./data.tsx";
import { CodeXml, Flame, Sparkles, Timer } from "./icons.tsx";
import { screenById, type Tri } from "./screens.ts";
import { A, fill, type LearnLang } from "./text.ts";

/**
 * Aaj, roop A "Ek kaam" (DESIGN-SYSTEM §7a; the mock's `AajBody` and
 * `AajRail` in docs/learn/mock-v3/app/src/screens/today.tsx), on the learner's
 * own day (tracker row 140, K2-1): `GET /practice/<site>/home` (today's plan,
 * streak, days off, revision due, the problem of the day), the latest
 * submission on the task at hand, the companies aimed for, and the contests.
 *
 * What has no backend yet is not shown, rather than shown as if it were real:
 * the mock's AI drill, the semester-exam line, the two-part readiness (AE7)
 * and the AI's "why it fails" line go to Kadam 3.
 */

/* ---------------- days and dates ---------------- */

const DAY_MS = 86_400_000;
const dayNumber = (day: string): number => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
/** Whole days from one YYYY-MM-DD to another. */
export const daysBetween = (from: string, to: string): number => dayNumber(to) - dayNumber(from);
/** The day in India of an instant. */
export const istDay = (iso: string): string => new Date(Date.parse(iso) + 5.5 * 3_600_000).toISOString().slice(0, 10);

const HINGLISH_DAYS = ["Ravivaar", "Somvaar", "Mangalvaar", "Budhvaar", "Guruvaar", "Shukravaar", "Shanivaar"] as const;
const LOCALE: Record<LearnLang, string> = { en: "en-IN", hg: "en-IN", hi: "hi-IN" };

/** "Tuesday, 27 October", "Mangalvaar, 27 October", "मंगलवार, 27 अक्टूबर". */
export function longDay(day: string, lang: LearnLang): string {
  const at = new Date(`${day}T00:00:00Z`);
  if (lang === "hg") return `${HINGLISH_DAYS[at.getUTCDay()]!}, ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", timeZone: "UTC" }).format(at)}`;
  return new Intl.DateTimeFormat(LOCALE[lang], { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(at);
}
const shortDay = (day: string, lang: LearnLang) => new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
const when = (iso: string, lang: LearnLang) => new Intl.DateTimeFormat(LOCALE[lang], { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));

/** The greeting for the learner's own hour. */
export const greeting = (hour: number): Tri => (hour < 12 ? A.morning : hour < 17 ? A.afternoon : A.evening);

/** What a task is, in words: its kind and, for a problem, how hard. */
const KIND_WORD: Record<PlanTask["kind"], Tri> = { learn: A.kLearn, practice: A.kPractice, revise: A.kRevise, custom: A.kCustom };
const LEVEL_WORD: Record<Difficulty, Tri> = { easy: A.easy, medium: A.medium, hard: A.hard };
const KIND_ICON: Record<PlanTask["kind"], ReactNode> = {
  learn: <BookOpen aria-hidden="true" />,
  practice: <CodeXml aria-hidden="true" />,
  revise: <RotateCcw aria-hidden="true" />,
  custom: <NotebookPen aria-hidden="true" />,
};
const KIND_CLASS: Record<PlanTask["kind"], string> = { learn: "ln-k-lesson", practice: "ln-k-problem", revise: "ln-k-revision", custom: "ln-k-custom" };

/** Where a task is done: its problem or lesson (their addresses on this site), revision, or the plan. */
export function taskScreen(task: PlanTask): string {
  if (task.link !== null) return `${task.link.kind === "lesson" ? "lessons" : "problems"}/${encodeURIComponent(task.link.slug)}`;
  return task.kind === "revise" ? "revision" : "plan";
}

const STATUS_WORD: Record<string, Tri> = {
  wrong_answer: A.stWrong,
  time_limit: A.stTime,
  memory_limit: A.stMemory,
  runtime_error: A.stRuntime,
  compile_error: A.stCompile,
};

/** The task's latest submission, when it did not pass. */
export function failing(submissions: readonly Submission[] | undefined): Submission | null {
  const latest = submissions?.[0];
  return latest === undefined || latest.status === "passed" ? null : latest;
}

/** The contest to show: one running, else the next to start. */
export function nextContest(contests: readonly ContestSummary[] | undefined): ContestSummary | null {
  const open = (contests ?? []).filter((c) => c.state !== "ended");
  return open.find((c) => c.state === "running") ?? [...open].sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;
}

/* ---------------- the page ---------------- */

/** Aaj's heading where the day itself cannot show: signed out, loading, failed. */
function Frame({ children }: { readonly children: ReactNode }) {
  const { t } = useLearn();
  const screen = screenById("aaj");
  return (
    <div className="ln-stack">
      <h1 className="ln-page-h1">{screen === undefined ? null : t(screen.title)}</h1>
      {children}
    </div>
  );
}

export function AajBody() {
  const { signedIn } = useLearnData();
  const home = useHome();
  const online = useOnline();
  if (!signedIn) {
    return (
      <Frame>
        <SignedOut />
      </Frame>
    );
  }
  if (waitingForNetwork(home)) {
    return (
      <Frame>
        <Offline waiting />
      </Frame>
    );
  }
  if (home.isPending) {
    return (
      <Frame>
        <Loading />
      </Frame>
    );
  }
  if (home.isError) {
    return (
      <Frame>
        <Failed error={home.error} onRetry={() => void home.refetch()} retrying={home.isFetching} />
      </Frame>
    );
  }
  return <Day home={home.data} offline={!online} />;
}

function Day({ home, offline }: { readonly home: Home; readonly offline: boolean }) {
  const { t, lang } = useLearn();
  const plan = home.plan;
  const tasks = plan?.today ?? [];
  const left = tasks.filter((task) => !task.done);
  const mins = left.reduce((sum, task) => sum + task.estMinutes, 0);
  const now = left[0] ?? null;
  const name = home.name.split(" ")[0] ?? home.name;
  const sub =
    plan === null ? null
    : left.length > 0 ? fill(t(left.length === 1 ? A.leftOne : A.left), { n: left.length, m: mins })
    : tasks.length > 0 ? t(A.allDone)
    : t(A.nothingToday);
  const started = plan === null ? null : istDay(plan.startedAt);
  return (
    <div className="ln-stack">
      {offline ? <Offline /> : null}
      <div className="ln-aaj-head">
        <div className="ln-grow">
          <p className="ln-eyebrow">
            <span className="ln-dated">{longDay(home.today, lang)}</span>
            {started === null ? null : <> · {fill(t(A.dayOf), { n: Math.max(1, daysBetween(started, home.today) + 1), of: Math.max(1, daysBetween(started, plan!.deadline) + 1) })}</>}
          </p>
          <h1 className="ln-aaj-h1">
            {fill(t(greeting(new Date().getHours())), { name })}
            {sub === null ? null : <> <span className="ln-aaj-sub">{sub}</span></>}
          </h1>
        </div>
        <Pace home={home} />
      </div>
      {plan === null ? (
        <NoPlan />
      ) : now === null ? (
        tasks.length > 0 ? <AllDone /> : null
      ) : (
        <Now task={now} at={tasks.indexOf(now) + 1} tasks={tasks} />
      )}
      {plan === null ? null : <Then tasks={tasks.filter((task) => task !== now)} all={tasks} />}
    </div>
  );
}

/** One badge: a day off, or how the plan's finish stands against its deadline. */
function Pace({ home }: { readonly home: Home }) {
  const { t } = useLearn();
  if (home.frozenToday) {
    return (
      <span className="ln-badge ln-tone-ai">
        <Snowflake aria-hidden="true" />
        {t(A.dayOff)}
      </span>
    );
  }
  if (home.plan === null) return null;
  const spare = daysBetween(home.plan.finishOn, home.plan.deadline);
  if (spare < 0) {
    return (
      <span className="ln-badge ln-tone-red">
        <CircleX aria-hidden="true" />
        {fill(t(spare === -1 ? A.behindOne : A.behind), { n: -spare })}
      </span>
    );
  }
  return (
    <span className="ln-badge ln-tone-tick">
      <Check aria-hidden="true" />
      {spare === 0 ? t(A.onTrack) : fill(t(spare === 1 ? A.aheadOne : A.ahead), { n: spare })}
    </span>
  );
}

function meta(task: PlanTask, t: (tri: Tri) => string): string {
  return [t(KIND_WORD[task.kind]), task.difficulty === null ? null : t(LEVEL_WORD[task.difficulty])].filter((part) => part !== null).join(" · ");
}

function Now({ task, at, tasks }: { readonly task: PlanTask; readonly at: number; readonly tasks: readonly PlanTask[] }) {
  const { t, lang, openSahayak } = useLearn();
  const submissions = useSubmissions(task.link?.kind === "problem" ? task.link.slug : null);
  const failed = failing(submissions.data);
  const tried = (submissions.data?.length ?? 0) > 0;
  const done = tasks.filter((x) => x.done).length;
  return (
    <section className="ln-now" aria-labelledby="ln-now-title">
      <div className="ln-now-top">
        <span className="ln-eyebrow">{fill(t(A.now), { i: at, n: tasks.length })}</span>
        <span className="ln-faint">{fill(t(A.min), { m: task.estMinutes })}</span>
      </div>
      <div className="ln-now-main">
        <div className="ln-grow">
          <h2 className="ln-now-title" id="ln-now-title">
            {task.title}
          </h2>
          <p className="ln-now-why">
            {failed === null ? null : (
              <span className="ln-badge ln-tone-red">
                <CircleX aria-hidden="true" />
                {t(STATUS_WORD[failed.status] ?? A.stOther)} · {fill(t(A.tests), { passed: failed.passed, total: failed.total })}
              </span>
            )}
            <span>{meta(task, t)}</span>
            {task.movedFrom === null ? null : <span className="ln-faint ln-dated">{fill(t(A.moved), { date: shortDay(task.movedFrom, lang) })}</span>}
          </p>
        </div>
        <div className="ln-now-act">
          <ScreenLink to={taskScreen(task)} className="ln-btn ln-btn-pri ln-btn-lg">
            <Play aria-hidden="true" />
            {t(tried ? A.resume : A.start)}
          </ScreenLink>
          {failed === null ? null : (
            <button type="button" className="ln-btn ln-btn-ai" onClick={openSahayak}>
              <Sparkles aria-hidden="true" />
              {t(A.askWhy)}
            </button>
          )}
        </div>
      </div>
      <Meter label={t(A.todays)} value={done} max={tasks.length} valueText={fill(t(A.doneOf), { done, n: tasks.length })} tone="pen" size="thin" />
    </section>
  );
}

function AllDone() {
  const { t } = useLearn();
  return (
    <section className="ln-card ln-card-pad ln-day-done" aria-labelledby="ln-done-title">
      <span className="ln-tick" aria-hidden="true">
        <Check />
      </span>
      <div className="ln-grow">
        <h2 className="ln-h3" id="ln-done-title">
          {t(A.doneTitle)}
        </h2>
        <p className="ln-faint">{t(A.doneBody)}</p>
      </div>
    </section>
  );
}

function NoPlan() {
  const { t } = useLearn();
  return (
    <section className="ln-card ln-card-pad" aria-labelledby="ln-noplan-title">
      <h2 className="ln-h3" id="ln-noplan-title">
        {t(A.noPlanTitle)}
      </h2>
      <p className="ln-faint">{t(A.noPlanBody)}</p>
      <div>
        <ScreenLink to="plan" className="ln-btn ln-btn-pri">
          <CalendarRange aria-hidden="true" />
          {t(A.makePlan)}
        </ScreenLink>
      </div>
    </section>
  );
}

function Then({ tasks, all }: { readonly tasks: readonly PlanTask[]; readonly all: readonly PlanTask[] }) {
  const { t, lang } = useLearn();
  const done = all.filter((task) => task.done).length;
  if (tasks.length === 0) return null;
  return (
    <section className="ln-card" aria-labelledby="ln-then-title">
      <div className="ln-card-h">
        <h2 className="ln-h3" id="ln-then-title">
          {t(A.then)}
        </h2>
        <span className="ln-faint">{fill(t(A.doneOf), { done, n: all.length })}</span>
      </div>
      <ul className="ln-tasks">
        {tasks.map((task) => (
          <li key={task.id} className={task.done ? "ln-done" : undefined}>
            <span className={`ln-task-ic ${KIND_CLASS[task.kind]}`}>{KIND_ICON[task.kind]}</span>
            <span className="ln-grow">
              <b>{task.title}</b>
              <span className="ln-faint">
                {meta(task, t)}
                {task.movedFrom === null ? null : (
                  <>
                    {" · "}
                    <span className="ln-dated">{fill(t(A.moved), { date: shortDay(task.movedFrom, lang) })}</span>
                  </>
                )}
              </span>
            </span>
            <span className="ln-faint">{fill(t(A.min), { m: task.estMinutes })}</span>
            {task.done ? (
              <span className="ln-tick" role="img" aria-label={t(A.done)}>
                <Check aria-hidden="true" />
              </span>
            ) : (
              <ScreenLink to={taskScreen(task)} className="ln-icon-btn" label={`${t(A.open)}: ${task.title}`}>
                <ArrowRight aria-hidden="true" />
              </ScreenLink>
            )}
          </li>
        ))}
      </ul>
      <div className="ln-card-f">
        <Feather aria-hidden="true" />
        <span className="ln-grow">{t(A.heavy)}</span>
        <ScreenLink to="plan" className="ln-btn ln-btn-ghost">
          {t(A.lighter)}
        </ScreenLink>
      </div>
    </section>
  );
}

/* ---------------- the rail ---------------- */

function Agenda({ icon, title, sub, to, action }: { readonly icon: ReactNode; readonly title: string; readonly sub: ReactNode; readonly to?: string; readonly action?: string }) {
  return (
    <li>
      {icon}
      <span className="ln-grow">
        <b>{title}</b>
        <span className="ln-faint">{sub}</span>
      </span>
      {to === undefined || action === undefined ? null : (
        <ScreenLink to={to} className="ln-btn ln-btn-sm" label={`${action}: ${title}`}>
          {action}
        </ScreenLink>
      )}
    </li>
  );
}

/** Beside Aaj, for a signed-in learner: the week (readiness, streak) and what is coming up. Quiet while the day loads or fails. */
export function AajRail() {
  const { t, lang } = useLearn();
  const home = useHome();
  const targets = useTargets();
  const contests = useContests();
  if (home.data === undefined) return null;
  const h = home.data;
  const target = targets.data?.[0];
  const sprint = h.plan?.sprints.find((s) => s.sprint === h.plan?.sprint);
  const contest = nextContest(contests.data);
  return (
    <>
      <section className="ln-card ln-card-pad" aria-labelledby="ln-week-title">
        <h2 className="ln-h3" id="ln-week-title">
          {t(A.week)}
        </h2>
        {target === undefined ? null : (
          <div className="ln-week">
            <Ring label={fill(t(A.readyFor), { company: target.name })} value={target.readiness.percent} valueText={`${target.readiness.percent}%`} size={72} tone="pen">
              {target.readiness.percent}%
            </Ring>
            <p className="ln-faint">{fill(t(A.readyBody), { company: target.name, solved: target.readiness.solved, of: target.readiness.of })}</p>
          </div>
        )}
        <div className="ln-streak">
          <Flame aria-hidden="true" />
          <b>{h.streak}</b>
          <span className="ln-grow">{t(A.streak)}</span>
          <span className="ln-faint">
            <Snowflake aria-hidden="true" />
            {fill(t(A.freezes), { n: h.freezesLeft })}
          </span>
        </div>
      </section>
      <section className="ln-card" aria-labelledby="ln-next-title">
        <div className="ln-card-h">
          <h2 className="ln-h3" id="ln-next-title">
            {t(A.comingUp)}
          </h2>
        </div>
        <ul className="ln-agenda">
          {h.potd === null ? null : (
            <Agenda
              icon={<Timer aria-hidden="true" />}
              title={t(A.potd)}
              sub={`${h.potd.title} · ${t(LEVEL_WORD[h.potd.difficulty])}${h.potd.solvedThatDay ? ` · ${t(A.solvedToday)}` : ""}`}
              {...(h.potd.solvedThatDay ? {} : { to: `problems/${encodeURIComponent(h.potd.slug)}`, action: t(A.solve) })}
            />
          )}
          {h.dueCards === 0 ? null : <Agenda icon={<RotateCcw aria-hidden="true" />} title={fill(t(A.cards), { n: h.dueCards })} sub={t(A.cardsBody)} to="revision" action={t(A.revise)} />}
          {sprint === undefined ? null : (
            <Agenda
              icon={<CalendarRange aria-hidden="true" />}
              title={fill(t(A.sprintTest), { n: sprint.sprint })}
              sub={
                <>
                  <span className="ln-dated">{shortDay(sprint.to, lang)}</span> · {fill(t(A.sprintBody), { done: sprint.done, tasks: sprint.tasks })}
                </>
              }
            />
          )}
          {contest === null ? null : (
            <Agenda
              icon={<Trophy aria-hidden="true" />}
              title={contest.title}
              sub={contest.state === "running" ? t(A.live) : <span className="ln-dated">{when(contest.startsAt, lang)}</span>}
              to="contests"
              action={t(A.openContest)}
            />
          )}
        </ul>
        {h.potd === null && h.dueCards === 0 && sprint === undefined && contest === null ? <p className="ln-rail-none ln-faint">{t(A.nothingAhead)}</p> : null}
      </section>
    </>
  );
}
