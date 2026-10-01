import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, CircleCheck, Circle, CircleDot, ClipboardList, Compass, FilePlus2, FileUp, FlaskConical, History, Library, Play, Plus, Search, SquareCheckBig, Users } from "lucide-react";
import type { Dashboard, ExamSummary } from "../api.ts";
import type { ExamFilter } from "./ExamList.tsx";
import { Banner, EmptyState, FigureStrip, PageActions, PageMeta, PhaseBadge, SkeletonRows, ago, type Phase as ExamPhase } from "./kit.tsx";

/**
 * The console's home page, as a test platform's dashboard: what is sitting
 * now and next on a calendar, what has just happened, and — until an
 * organisation has done them — the first steps to running a test.
 */

export type HomeTarget = "new-exam" | "bank" | "exams" | "staff" | "privacy" | "search" | "billing";

/** Credits left at which a prepaid organisation is warned: about a small batch's worth. */
export const FEW_CREDITS = 5;

/** What the home page can do with the sample exam (see the API's `onboarding.ts`). */
export interface SampleActions {
  readonly onLoad: () => void;
  readonly onTry: (examId: string) => void;
  readonly onOpen: (examId: string) => void;
  readonly onRemove: () => void;
  /** Loading or putting it away is under way. */
  readonly busy: boolean;
}

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

/** What an audit entry means, in words: every action the API records has its own. */
export const ACTIONS: Record<string, string> = {
  "exam.saved": "saved an exam",
  "exam.archived": "archived an exam",
  "exam.restored": "brought an exam back from the archive",
  "exam.window_set": "set when an exam is open",
  "invitations.imported": "invited candidates",
  "invitations.created": "invited a candidate",
  "invitations.resent": "resent an invitation",
  "invitations.revoked": "withdrew an invitation",
  "invitations.links_exported": "downloaded candidates' links",
  "attempt.started": "started an attempt",
  "attempt.submitted": "submitted an attempt",
  "attempt.graded": "graded an attempt",
  "attempt.assessed": "read a follow-up question",
  "attempt.voided": "set an attempt aside",
  "attempt.extended": "gave a candidate extra time",
  "attempt.reopened": "reopened an attempt",
  "attempt.erased": "erased a candidate's data",
  "results.exported": "downloaded results",
  "results.released": "sent candidates their results",
  "exam.lab_set": "changed lab mode",
  "exam.lab_started": "started the sitting for everyone",
  "attempt.score_revised": "changed a mark",
  "recheck.answered": "answered a recheck",
  "ats.checked": "tested an ATS connection",
  "students.imported": "added students from a sheet",
  "student.removed": "removed a student",
  "drive.created": "made a placement drive",
  "drive.saved": "changed a placement drive",
  "drive.students_added": "added students to a drive",
  "drive.stage_set": "moved students to the next round",
  "drive.exported": "downloaded a drive's students",
  "exam.seats_allocated": "seated the candidates",
  "exam.attendance_marked": "marked a candidate present",
  "shortlist.created": "sent a shortlist to a hiring manager",
  "shortlist.withdrawn": "withdrew a shortlist link",
  "billing.quoted": "asked for a quotation",
  "drive.apply_opened": "opened a drive's link to apply",
  "drive.apply_closed": "closed a drive's link to apply",
  "placement.report_exported": "downloaded the placement report",
  "exam.outcomes_set": "mapped course outcomes",
  "bank.added": "added a question to the bank",
  "bank.edited": "edited a bank question",
  "bank.imported": "imported questions",
  "bank.archived": "archived a bank question",
  "staff.created": "added a member of staff",
  "staff.role_changed": "changed someone's role",
  "staff.disabled": "disabled an account",
  "auth.login": "signed in",
  "auth.sso_login": "signed in through their organisation",
  "auth.password_changed": "changed their password",
  "auth.email_verified": "confirmed their email address",
  "auth.password_reset": "reset their password",
  "auth.password_reset_requested": "asked to reset their password",
  "org.created": "made the organisation's account",
  "sample.loaded": "loaded the sample exam",
  "sample.removed": "put the sample exam away",
  "org.sso_configured": "set up signing in through the organisation",
  "org.spend_cap_set": "set the spending limit",
  "privacy.saved": "updated the privacy notice",
  "billing.details_saved": "saved the billing details",
  "billing.order_created": "started a purchase",
  "billing.paid": "bought attempt credits",
  "billing.refunded": "issued a refund",
  "sitting.announced": "made an announcement",
  "apikey.issued": "issued an API key",
  "apikey.revoked": "revoked an API key",
  "webhook.created": "added a webhook",
  "webhook.disabled": "turned a webhook off",
  "webhook.rotated": "changed a webhook's secret",
  "webhook.secret_shown": "looked at a webhook's secret",
  "webhook.test": "sent a test to a webhook",
  "ats.configured": "connected an ATS",
  "ats.disabled": "disconnected an ATS",
  "ats.key_issued": "issued a key for an ATS",
  "greenhouse.key_issued": "issued a key for Greenhouse",
  "greenhouse.disabled": "disconnected Greenhouse",
  "greenhouse.response_error": "got an error back from Greenhouse",
  "lti.platform_registered": "connected an LMS",
  "lti.platform_updated": "changed an LMS connection",
  "practice.site_saved": "saved the practice site",
  "practice.site_opened": "opened the practice site",
  "practice.sign_in_saved": "changed how learners sign in",
  "practice.problem_published": "published a practice problem",
  "practice.problem_edited": "edited a practice problem",
  "practice.contest_scheduled": "scheduled a contest",
  "practice.contest_changed": "changed a contest",
  "practice.comment_hidden": "hid a comment",
  "practice.comment_shown": "showed a hidden comment again",
  "practice.similarity_viewed": "compared learners' code",
  "prep.track_created": "added a track",
  "prep.track_changed": "changed a track",
  "prep.lesson_created": "added a lesson",
  "prep.lesson_changed": "changed a lesson",
  "prep.plan_created": "added a study plan",
  "prep.plan_changed": "changed a study plan",
  "prep.potd_set": "set the problem of the day",
  "prep.plus_settings": "changed the Plus settings",
  "prep.plus_granted": "gave a learner Plus",
  "prep.company_created": "added a company",
  "prep.starter_pack_imported": "imported a starter pack",
  "prep.store_item_created": "added an item to the coin store",
  "prep.store_item_changed": "changed an item in the coin store",
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
  sample,
  onTour,
  canBuy = false,
  onResults,
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
  /** Absent for an account that cannot write exams. */
  sample?: SampleActions;
  /** Start the guided tour. */
  onTour?: () => void;
  /** This account buys credits (an owner): the warning then offers to. */
  canBuy?: boolean;
  /** An exam's Results tab, where its waiting attempts are graded; absent for an account that cannot grade. */
  onResults?: (examId: string) => void;
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

      {dashboard === undefined ? null : <Credits left={dashboard.setup.prepaidCredits ?? null} canBuy={canBuy} onBuy={() => onGo("billing")} />}
      {onResults === undefined ? null : <ToGrade exams={exams} onResults={onResults} onExams={onExams} />}

      {dashboard === undefined || !canWrite ? null : (
        <Welcome setup={dashboard.setup} sample={sample} onGo={onGo} onTour={onTour} />
      )}

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
          {dashboard === undefined ? null : <Setup setup={dashboard.setup} onGo={onGo} onTour={onTour} />}
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

/**
 * Attempts waiting to be graded, and the way straight to them: one exam's
 * Results tab, where Grade all is, or the exams that have some.
 */
function ToGrade({
  exams,
  onResults,
  onExams,
}: {
  exams: readonly ExamSummary[];
  onResults: (examId: string) => void;
  onExams: ((filter: ExamFilter) => void) | undefined;
}) {
  const waiting = exams.filter((e) => (e.attempts?.submitted ?? 0) > 0 && (e.archivedAt ?? null) === null);
  if (waiting.length === 0) return null;
  const total = waiting.reduce((sum, e) => sum + e.attempts!.submitted, 0);
  const only = waiting.length === 1 ? waiting[0]! : null;
  return (
    <div className="to-grade-line">
      <Banner
        tone="info"
        title={`${total} attempt${total === 1 ? "" : "s"} waiting to be graded`}
        action={
          only !== null ? (
            <button type="button" onClick={() => onResults(only.id)}>
              Grade them
            </button>
          ) : onExams === undefined ? undefined : (
            <button type="button" onClick={() => onExams("grading")}>
              See which exams
            </button>
          )
        }
      >
        {only !== null ? `In “${only.title}”: Grade all on its Results tab grades every one.` : `Across ${waiting.length} exams: each exam's Results tab has Grade all.`}
      </Banner>
    </div>
  );
}

/**
 * A prepaid organisation running out: said before a candidate is turned away
 * at the start of their test, not after.
 */
function Credits({ left, canBuy, onBuy }: { left: number | null; canBuy: boolean; onBuy: () => void }) {
  if (left === null || left > FEW_CREDITS) return null;
  const none = left <= 0;
  return (
    <div className="credits-line">
      <Banner
        tone={none ? "danger" : "warning"}
        title={none ? "No attempts left" : `${left} attempt${left === 1 ? "" : "s"} left`}
        action={
          canBuy ? (
            <button type="button" onClick={onBuy}>
              Buy credits
            </button>
          ) : undefined
        }
      >
        {none
          ? "Candidates cannot start a test until more credits are bought."
          : "Each candidate who starts a test uses one. Buy more before your next sitting so nobody is turned away."}
        {canBuy ? null : " Ask your organisation's owner to buy more."}
      </Banner>
    </div>
  );
}

/** Nothing of the organisation's own yet: no exam and no question in the bank. */
export const isNew = (setup: Dashboard["setup"]) => setup.exams === 0 && setup.bankQuestions === 0;

/**
 * A new organisation's first screen: three ways to begin, and the tour. Once
 * it has an exam or a question of its own this gives way to the first steps;
 * a sample exam still loaded then keeps a line of its own.
 */
function Welcome({
  setup,
  sample,
  onGo,
  onTour,
}: {
  setup: Dashboard["setup"];
  sample: SampleActions | undefined;
  onGo: (target: HomeTarget) => void;
  onTour: (() => void) | undefined;
}) {
  const loaded = setup.sampleExamId ?? null;
  if (!isNew(setup)) {
    if (loaded === null || sample === undefined) return null;
    return (
      <div className="sample-line">
        <Banner
          title="The sample exam is still here"
          action={
            <>
              <button type="button" className="secondary" onClick={() => sample.onOpen(loaded)}>
                Open it
              </button>
              <button type="button" className="quiet" disabled={sample.busy} onClick={sample.onRemove}>
                Put it away
              </button>
            </>
          }
        >
          It does not count as one of your exams. Put it away once you no longer need it; its questions leave the bank with it.
        </Banner>
      </div>
    );
  }
  return (
    <section className="card welcome" aria-labelledby="welcome-title" data-tour="welcome">
      <div className="welcome-head">
        <div>
          <h2 id="welcome-title">Welcome to Parikshaa. Three ways to begin.</h2>
          <p className="notice">Nothing reaches a candidate until you invite one, so try anything.</p>
        </div>
        {onTour === undefined ? null : (
          <button type="button" className="secondary" onClick={onTour}>
            <Compass aria-hidden="true" />
            Take the tour
          </button>
        )}
      </div>
      <ol className="welcome-paths">
        <li>
          <FlaskConical aria-hidden="true" className="welcome-icon" />
          <h3>Try the sample exam</h3>
          <p>A 20-minute campus aptitude round with every kind of question. Sit it as a candidate would; nothing is recorded.</p>
          {sample === undefined ? null : loaded === null ? (
            <button type="button" disabled={sample.busy} onClick={sample.onLoad}>
              {sample.busy ? "Loading…" : "Load the sample exam"}
            </button>
          ) : (
            <div className="row">
              <button type="button" onClick={() => sample.onTry(loaded)}>
                <Play aria-hidden="true" />
                Try it as a candidate
              </button>
              <button type="button" className="quiet" onClick={() => sample.onOpen(loaded)}>
                Open it
              </button>
            </div>
          )}
        </li>
        <li>
          <FilePlus2 aria-hidden="true" className="welcome-icon" />
          <h3>Write your first exam</h3>
          <p>Multiple choice, numbers, written answers and code, with a timer, sections and a qualifying mark.</p>
          <button type="button" className="secondary" onClick={() => onGo("new-exam")}>
            New exam
          </button>
        </li>
        <li>
          <FileUp aria-hidden="true" className="welcome-icon" />
          <h3>Bring a question paper</h3>
          <p>Import a Word question paper or a spreadsheet into the question bank, then build exams from it.</p>
          <button type="button" className="secondary" onClick={() => onGo("bank")}>
            Import questions
          </button>
        </li>
      </ol>
    </section>
  );
}

/** The first steps, until they are all done. */
function Setup({ setup, onGo, onTour }: { setup: Dashboard["setup"]; onGo: (target: HomeTarget) => void; onTour?: (() => void) | undefined }) {
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
      {onTour === undefined || isNew(setup) ? null : (
        <button type="button" className="quiet setup-tour" onClick={onTour}>
          <Compass aria-hidden="true" />
          Take the tour again
        </button>
      )}
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
