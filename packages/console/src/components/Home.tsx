import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, CircleCheck, Circle, CircleDot, ClipboardList, History, Library, Plus, Search, SquareCheckBig, Users } from "lucide-react";
import type { Dashboard, ExamSummary } from "../api.ts";
import type { ExamFilter } from "./ExamList.tsx";
import { EmptyState, FigureStrip, PageActions, PageMeta, PhaseBadge, SkeletonRows, ago, type Phase as ExamPhase } from "./kit.tsx";

/**
 * The console's home page, as a test platform's dashboard: what is sitting
 * now and next on a calendar, what has just happened, and — until an
 * organisation has done them — the first steps to running a test.
 */

export type HomeTarget = "new-exam" | "bank" | "exams" | "staff" | "privacy" | "search";

const IST = "Asia/Kolkata";
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const time = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
const dayName = (key: string, today: string) => {
  const d = new Date(`${key}T12:00:00+05:30`);
  const diff = Math.round((d.getTime() - new Date(`${today}T12:00:00+05:30`).getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" }).format(d);
};

type Sitting = Dashboard["sittings"][number];
const phaseOf = (s: Sitting, now: number): ExamPhase => (Date.parse(s.opensAt) > now ? "scheduled" : Date.parse(s.closesAt) > now ? "open" : "closed");
/** Hours of the day in IST, as a fraction: 10:30 is 10.5. */
const hourOf = (at: number) => {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(at)).split(":").map(Number) as [number, number];
  return h + m / 60;
};
const addDays = (key: string, by: number) => {
  const d = new Date(`${key}T12:00:00+05:30`);
  d.setUTCDate(d.getUTCDate() + by);
  return dayKey(d);
};

/** What an audit entry means, in words. */
const ACTIONS: Record<string, string> = {
  "exam.saved": "saved an exam",
  "exam.archived": "archived an exam",
  "exam.restored": "brought an exam back from the archive",
  "exam.window_set": "scheduled a sitting",
  "invitations.imported": "invited candidates",
  "invitations.created": "invited a candidate",
  "invitations.resent": "resent an invitation",
  "invitations.revoked": "withdrew an invitation",
  "invitations.links_exported": "downloaded candidates' links",
  "attempt.started": "started an attempt",
  "attempt.graded": "graded an attempt",
  "attempt.assessed": "read a follow-up",
  "attempt.voided": "set an attempt aside",
  "attempt.extended": "gave a candidate extra time",
  "attempt.reopened": "reopened an attempt",
  "attempt.erased": "erased a candidate's data",
  "results.exported": "downloaded results",
  "bank.added": "added a question to the bank",
  "bank.edited": "edited a bank question",
  "bank.imported": "imported questions",
  "bank.archived": "archived a bank question",
  "staff.created": "added a member of staff",
  "staff.role_changed": "changed someone's role",
  "staff.disabled": "disabled an account",
  "auth.login": "signed in",
  "auth.password_changed": "changed their password",
  "privacy.saved": "updated the privacy notice",
  "billing.paid": "bought attempt credits",
  "sitting.announced": "made an announcement",
  "apikey.issued": "issued an API key",
  "webhook.created": "added a webhook",
};
export const describeAction = (action: string) => ACTIONS[action] ?? action.replace(/[._]/g, " ");

export function Home({
  dashboard,
  exams,
  name,
  now = Date.now(),
  canWrite,
  onExam,
  onExams,
  onGo,
}: {
  dashboard: Dashboard | undefined;
  exams: readonly ExamSummary[];
  name: string | undefined;
  now?: number;
  canWrite: boolean;
  onExam: (examId: string) => void;
  /** The exam list, filtered to what a figure counts. */
  onExams?: (filter: ExamFilter) => void;
  onGo: (target: HomeTarget) => void;
}) {
  const totals = exams.reduce(
    (sum, e) => {
      const c = e.attempts;
      return c === undefined ? sum : { sitting: sum.sitting + c.inProgress, grade: sum.grade + c.submitted, candidates: sum.candidates + c.invited };
    },
    { sitting: 0, grade: 0, candidates: 0 },
  );
  const open = (filter: ExamFilter) => (onExams === undefined ? {} : { onOpen: () => onExams(filter) });
  const hour = Number(new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", hourCycle: "h23" }).format(new Date(now)));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="home">
      <PageMeta>
        <span className="home-greeting">
          {greeting}
          {name === undefined ? "" : `, ${name.split(" ")[0]}`}.
        </span>
      </PageMeta>
      <PageActions>
        <button type="button" className="secondary" onClick={() => onGo("search")}>
          <Search aria-hidden="true" />
          Find a candidate
        </button>
        <button type="button" className="secondary" onClick={() => onGo("bank")}>
          <Library aria-hidden="true" />
          Question bank
        </button>
        {canWrite ? (
          <button type="button" onClick={() => onGo("new-exam")}>
            <Plus aria-hidden="true" />
            New exam
          </button>
        ) : null}
      </PageActions>

      <FigureStrip
        figures={[
          { label: "In progress", value: totals.sitting, icon: CircleDot, ...(totals.sitting > 0 ? { tone: "live" as const } : {}), ...open("open") },
          { label: "To grade", value: totals.grade, icon: SquareCheckBig, ...(totals.grade > 0 ? { tone: "attention" as const } : {}), ...open("grading") },
          { label: "Exams", value: exams.filter((e) => (e.archivedAt ?? null) === null).length, icon: ClipboardList, ...open("all") },
          { label: "Candidates invited", value: totals.candidates, icon: Users },
        ]}
      />

      <div className="home-grid">
        <Calendar sittings={dashboard?.sittings} now={now} onExam={onExam} onSchedule={() => onGo("exams")} />
        <div className="home-side">
          {dashboard === undefined ? null : <Setup setup={dashboard.setup} onGo={onGo} />}
          {dashboard?.activity == null ? null : <Activity activity={dashboard.activity} now={now} onExam={onExam} />}
        </div>
      </div>
    </div>
  );
}

/**
 * A month of days, those with a sitting marked, beside the sittings
 * themselves by day. Choosing a day shows only its sittings.
 */
function Calendar({
  sittings,
  now,
  onExam,
  onSchedule,
}: {
  sittings: Dashboard["sittings"] | undefined;
  now: number;
  onExam: (examId: string) => void;
  onSchedule: () => void;
}) {
  const today = dayKey(new Date(now));
  const [mode, setMode] = useState<"month" | "week">("month");
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [picked, setPicked] = useState<string | null>(null);
  // Monday of the week shown.
  const [week, setWeek] = useState(() => addDays(today, -((new Date(`${today}T12:00:00+05:30`).getUTCDay() + 6) % 7)));

  const byDay = useMemo(() => {
    const days = new Map<string, Sitting[]>();
    for (const s of sittings ?? []) {
      // A sitting is on every day its window touches.
      const last = dayKey(new Date(Date.parse(s.closesAt) - 1));
      for (let d = dayKey(new Date(s.opensAt)), guard = 0; d <= last && guard < 31; guard++) {
        days.set(d, [...(days.get(d) ?? []), s]);
        const next = new Date(`${d}T12:00:00+05:30`);
        next.setUTCDate(next.getUTCDate() + 1);
        d = dayKey(next);
      }
    }
    return days;
  }, [sittings]);

  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const shift = (by: number) => {
    const d = new Date(Date.UTC(y, m - 1 + by, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    setPicked(null);
  };

  const listed = (sittings ?? []).filter((s) => picked === null || (byDay.get(picked) ?? []).includes(s));
  const groups = new Map<string, Sitting[]>();
  for (const s of listed) {
    const key = picked ?? dayKey(new Date(s.opensAt));
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  return (
    <section className="card home-calendar" aria-label="Sittings">
      <div className="bar">
        <CalendarDays aria-hidden="true" className="inline-icon" />
        <strong>Sittings</strong>
        <span className="notice">open now, scheduled, and closed in the last week</span>
        <span className="spacer" />
        <div className="segmented" role="group" aria-label="Show the calendar by">
          <button type="button" aria-pressed={mode === "month"} onClick={() => setMode("month")}>
            Month
          </button>
          <button type="button" aria-pressed={mode === "week"} onClick={() => setMode("week")}>
            Week
          </button>
        </div>
      </div>
      {mode === "week" ? (
        <Week sittings={sittings ?? []} start={week} today={today} now={now} onShift={(by) => setWeek(addDays(week, 7 * by))} onExam={onExam} />
      ) : (
      <div className="calendar-layout">
        <div className="month" role="group" aria-label={new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(first)}>
          <div className="month-head">
            <button type="button" className="quiet icon" aria-label="Previous month" onClick={() => shift(-1)}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <strong>{new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(first)}</strong>
            <button type="button" className="quiet icon" aria-label="Next month" onClick={() => shift(1)}>
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
          <div className="month-grid">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span key={i} className="month-dow" aria-hidden="true">
                {d}
              </span>
            ))}
            {cells.map((key, i) =>
              key === null ? (
                <span key={`gap-${i}`} />
              ) : (
                <button
                  key={key}
                  type="button"
                  className={`month-day${key === today ? " today" : ""}${key === picked ? " picked" : ""}${byDay.has(key) ? " busy" : ""}`}
                  aria-pressed={key === picked}
                  aria-label={`${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`))}${byDay.has(key) ? `: ${byDay.get(key)!.length} sitting${byDay.get(key)!.length === 1 ? "" : "s"}` : ""}`}
                  onClick={() => setPicked(key === picked ? null : key)}
                >
                  {Number(key.slice(8))}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="agenda">
          {picked === null ? null : (
            <button type="button" className="quiet agenda-clear" onClick={() => setPicked(null)}>
              Show every sitting
            </button>
          )}
          {sittings === undefined ? (
            <SkeletonRows rows={3} columns={2} label="Loading sittings…" />
          ) : listed.length === 0 ? (
            <EmptyState icon={CalendarDays} compact action={picked === null ? { label: "Schedule a sitting", onClick: onSchedule } : undefined}>
              {picked === null ? "Sittings appear here once an exam has a window: set one from the exam's Candidates tab." : "No sitting that day."}
            </EmptyState>
          ) : (
            [...groups].map(([key, list]) => (
              <div key={key} className="agenda-day">
                <p className="agenda-date">{dayName(key, today)}</p>
                <ul>
                  {list.map((s) => {
                    const phase = phaseOf(s, now);
                    return (
                      <li key={`${key}-${s.examId}`} className={`agenda-item ${phase}`}>
                        <span className="agenda-time">
                          {time(s.opensAt)} – {time(s.closesAt)}
                        </span>
                        <button type="button" className="crumb agenda-title" onClick={() => onExam(s.examId)}>
                          {s.title}
                        </button>
                        <span className="agenda-meta">
                          <PhaseBadge phase={phase} />
                          <span className="notice">
                            {s.started} of {s.invited} started
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
      )}
    </section>
  );
}

const HOURS_DEFAULT: readonly [number, number] = [9, 18];

/**
 * A week, Monday first, with each sitting drawn as a block across its hours
 * (IST), so a clash or a gap between two sittings shows at once.
 */
function Week({
  sittings,
  start,
  today,
  now,
  onShift,
  onExam,
}: {
  sittings: readonly Sitting[];
  start: string;
  today: string;
  now: number;
  onShift: (by: number) => void;
  onExam: (examId: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const dayStart = (key: string) => Date.parse(`${key}T00:00:00+05:30`);
  const blocks = days.map((key) =>
    sittings
      .filter((s) => Date.parse(s.opensAt) < dayStart(key) + 86_400_000 && Date.parse(s.closesAt) > dayStart(key))
      .map((s) => {
        const from = Math.max(Date.parse(s.opensAt), dayStart(key));
        const to = Math.min(Date.parse(s.closesAt), dayStart(key) + 86_400_000);
        return { sitting: s, from: hourOf(from), to: to >= dayStart(key) + 86_400_000 ? 24 : hourOf(to) };
      }),
  );
  const all = blocks.flat();
  const first = Math.max(0, Math.min(HOURS_DEFAULT[0], ...all.map((b) => Math.floor(b.from))));
  const last = Math.min(24, Math.max(HOURS_DEFAULT[1], ...all.map((b) => Math.ceil(b.to))));
  const span = last - first;
  const hours = Array.from({ length: span }, (_, i) => first + i);
  const label = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${start}T00:00:00Z`));
  const hourName = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 || h === 24 ? "am" : "pm"}`;

  return (
    <div className="week" role="group" aria-label={`Week of ${label}`}>
      <div className="month-head">
        <button type="button" className="quiet icon" aria-label="Previous week" onClick={() => onShift(-1)}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <strong>Week of {label}</strong>
        <button type="button" className="quiet icon" aria-label="Next week" onClick={() => onShift(1)}>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
      <div className="week-grid" style={{ ["--hours" as string]: span }}>
        <div className="week-hours" aria-hidden="true">
          {hours.map((h) => (
            <span key={h}>{hourName(h)}</span>
          ))}
        </div>
        {days.map((key, i) => (
          <div key={key} className={`week-day${key === today ? " today" : ""}`}>
            <p className="week-date">
              {new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`))}
            </p>
            <ul className="week-track">
              {blocks[i]!.map(({ sitting, from, to }) => (
                <li
                  key={sitting.examId}
                  className={`week-block ${phaseOf(sitting, now)}`}
                  style={{ top: `${((from - first) / span) * 100}%`, height: `${Math.max(((to - from) / span) * 100, 6)}%` }}
                >
                  <button type="button" className="crumb" onClick={() => onExam(sitting.examId)}>
                    {sitting.title}
                  </button>
                  <span className="week-time">
                    {time(sitting.opensAt)} – {time(sitting.closesAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {all.length === 0 ? <p className="notice week-empty">No sitting this week.</p> : null}
    </div>
  );
}

/** The first steps, until they are all done. */
function Setup({ setup, onGo }: { setup: Dashboard["setup"]; onGo: (target: HomeTarget) => void }) {
  const steps: readonly { label: string; done: boolean; target: HomeTarget; hint: string }[] = [
    { label: "Add questions to the bank", done: setup.bankQuestions > 0, target: "bank", hint: "Write them, or import a spreadsheet or a Word paper." },
    { label: "Create an exam", done: setup.exams > 0, target: "new-exam", hint: "From the bank or from scratch." },
    { label: "Schedule a sitting", done: setup.scheduled > 0, target: "exams", hint: "When candidates may open it." },
    { label: "Invite candidates", done: setup.invited > 0, target: "exams", hint: "A spreadsheet of roll numbers, names and emails." },
    { label: "Add your staff", done: setup.staff > 1, target: "staff", hint: "Authors, invigilators and reviewers." },
    { label: "Publish your privacy notice", done: setup.privacyNotice, target: "privacy", hint: "What candidates agree to before they start." },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <section className="card setup" aria-label="Get started">
      <div className="bar">
        <strong>Get started</strong>
        <span className="spacer" />
        <span className="notice">
          {done} of {steps.length} done
        </span>
      </div>
      <div className="progress" role="progressbar" aria-label="Setup" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}>
        <span style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="setup-steps">
        {steps.map((step) => (
          <li key={step.label} className={step.done ? "done" : undefined}>
            {step.done ? <CircleCheck aria-hidden="true" /> : <Circle aria-hidden="true" />}
            <span className="setup-text">
              {step.done ? (
                <span>
                  {step.label}
                  <span className="visually-hidden"> (done)</span>
                </span>
              ) : (
                <button type="button" className="crumb" onClick={() => onGo(step.target)}>
                  {step.label}
                </button>
              )}
              {step.done ? null : <span className="notice small">{step.hint}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The latest actions, by day, each naming the exam it concerns. */
function Activity({ activity, now, onExam }: { activity: NonNullable<Dashboard["activity"]>; now: number; onExam: (examId: string) => void }) {
  const today = dayKey(new Date(now));
  const days = new Map<string, (typeof activity)[number][]>();
  for (const a of activity) {
    const key = dayKey(new Date(a.at));
    days.set(key, [...(days.get(key) ?? []), a]);
  }
  return (
    <section className="card activity" aria-label="Recent activity">
      <strong>Recent activity</strong>
      {activity.length === 0 ? (
        <EmptyState icon={History} compact>
          What your staff do — saving exams, inviting, grading — appears here.
        </EmptyState>
      ) : (
        [...days].map(([key, list]) => (
          <div key={key} className="activity-day">
            <p className="agenda-date">{dayName(key, today)}</p>
            <ol className="activity-list">
              {list.map((a, i) => (
                <li key={`${a.at}-${i}`}>
                  <span className="activity-dot" aria-hidden="true" />
                  <span className="activity-text">
                    <strong>{a.actor}</strong> {describeAction(a.action)}
                    {a.exam == null ? null : (
                      <>
                        {" · "}
                        <button type="button" className="crumb" onClick={() => onExam(a.exam!.id)}>
                          {a.exam.title}
                        </button>
                      </>
                    )}
                  </span>
                  <time className="activity-time" dateTime={a.at}>
                    {key === today ? ago(a.at, now) : time(a.at)}
                  </time>
                </li>
              ))}
            </ol>
          </div>
        ))
      )}
    </section>
  );
}
