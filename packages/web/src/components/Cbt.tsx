import { useEffect, useRef, useState, type ReactNode } from "react";
import { Clock3 } from "lucide-react";
import { Wordmark } from "@parikshaa/brand/react";
import { usePreferences } from "../i18n.tsx";
import type { CandidateState } from "../api.ts";

type CandidateQuestion = CandidateState["exam"]["questions"][number];

/**
 * The bar across the top of a sitting, the way a computer-based test hall
 * lays it out: the name and the paper on the left, the clock in the middle
 * where the eye finds it, how the page reads and the way out on the right.
 * Only what changes during the test lives here. Ink in both themes, so the
 * paper below it is the brightest thing on the screen.
 */
export function ExamBar({
  title,
  clock,
  status,
  display,
  action,
}: {
  readonly title: string;
  readonly clock?: ReactNode;
  /** Small state beside the title: the camera, the connection. */
  readonly status?: ReactNode;
  /** The Display menu: language, text size, theme, low bandwidth. */
  readonly display?: ReactNode;
  /** The way out: submitting the test, or leaving the section. */
  readonly action?: ReactNode;
}) {
  return (
    <header className="exambar">
      <div className="exambar-inner">
        <div className="exambar-start">
          <Wordmark size={26} />
          <span className="divider" aria-hidden="true" />
          <h1 className="exam-name" title={title}>
            {title}
          </h1>
          {status}
        </div>
        <div className="exambar-clock">{clock}</div>
        <div className="exambar-end">
          {display}
          {action}
        </div>
      </div>
    </header>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A section's own clock, shown in the pill in place of the test's. */
export interface SectionClock {
  readonly title: string;
  readonly endsAt: number;
  /** The section's own length: a short one warns later than 15 minutes out. */
  readonly durationMs: number | null;
}

/**
 * Time left, to the second, in a pill in the middle of the bar: the test's,
 * or the current section's where it has its own. Warning from 15 minutes (a
 * short section's last quarter), danger in the last one, with one pulse as
 * each begins and never a loop.
 *
 * This is the exam's own window, which a candidate is entitled to see. It is
 * not a timer on the micro-viva — SPEC §8 rules that out, and the probe panel
 * shows none. Read aloud as words ("45m left"), shown as a clock.
 */
export function Countdown({ expiresAt, section = null }: { readonly expiresAt: number; readonly section?: SectionClock | null }) {
  const { t } = usePreferences();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const end = section === null ? expiresAt : Math.min(section.endsAt, expiresAt);
  const remaining = Math.max(0, end - now);
  const seconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const words = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
  const digits = section === null ? `${pad(hours)}:${pad(minutes % 60)}:${pad(seconds % 60)}` : `${hours > 0 ? `${hours}:${pad(minutes % 60)}` : minutes}:${pad(seconds % 60)}`;
  const spoken =
    remaining === 0
      ? t("exam.timeUp")
      : section === null
        ? t("exam.timeLeft", { time: words })
        : t("section.timeLeft", { time: `${hours > 0 ? `${hours}:${pad(minutes % 60)}` : minutes}:${pad(seconds % 60)}` });
  const soonAt = section?.durationMs == null ? 15 * 60_000 : Math.min(15 * 60_000, section.durationMs / 4);
  const tone = remaining <= 60_000 ? " urgent" : remaining <= soonAt ? " soon" : "";
  return (
    <div className={`countdown${tone}${section === null ? "" : " section"}`} role="timer" aria-label={spoken} title={spoken}>
      <span className="countdown-label" aria-hidden="true">
        {section === null ? t("exam.timeLeftLabel") : section.title}
      </span>
      <span className="countdown-digits" aria-hidden="true">
        {digits}
      </span>
    </div>
  );
}

/** What kind of answer a question wants, in the words a candidate expects to see above it. */
export function kindLabel(question: CandidateQuestion, t: ReturnType<typeof usePreferences>["t"]): string {
  switch (question.kind) {
    case "mcq":
      return question.multiple ? t("exam.kind.multiple") : t("exam.kind.single");
    case "numeric":
      return t("exam.kind.numeric");
    case "code":
      return t("exam.kind.code");
    default:
      return t("exam.kind.short");
  }
}

export interface PaperCounts {
  readonly answered: number;
  readonly notAnswered: number;
  readonly notVisited: number;
  readonly marked: number;
  readonly answeredMarked: number;
}

/** How many questions stand where, each beside its palette shape. */
export function Tally({ counts }: { readonly counts: PaperCounts }) {
  const { t } = usePreferences();
  const rows: readonly [string, string, number][] = [
    ["answered", t("palette.answered"), counts.answered],
    ["not-answered", t("palette.notAnswered"), counts.notAnswered],
    ["not-visited", t("palette.notVisited"), counts.notVisited],
    ["marked", t("palette.marked"), counts.marked],
    ["answered-marked", t("palette.answeredMarked"), counts.answeredMarked],
  ];
  return (
    <dl className="tally">
      {rows.map(([status, label, n]) => (
        <div key={status}>
          <dt>
            <span className={`pq ${status}`} aria-hidden="true" />
            {label}
          </dt>
          <dd>{n}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A part of the paper and where its questions stand, for the submit summary. */
export interface PaperGroup {
  readonly title: string;
  readonly counts: PaperCounts;
}

const plus = (a: PaperCounts, b: PaperCounts): PaperCounts => ({
  answered: a.answered + b.answered,
  notAnswered: a.notAnswered + b.notAnswered,
  notVisited: a.notVisited + b.notVisited,
  marked: a.marked + b.marked,
  answeredMarked: a.answeredMarked + b.answeredMarked,
});

/**
 * The last look before submitting, as a CBT hall shows it: a row for each
 * section — answered, not answered, marked, never opened, each headed by its
 * palette shape — and the whole paper's total, so nothing is submitted by
 * surprise. Focus starts on "Keep working"; Submit is the saffron of the
 * bar's button, so the one thing that cannot be undone looks the same both
 * times. On a phone it is a sheet with the totals, and the sections a tap away.
 */
export function SubmitDialog({
  counts,
  groups = [],
  pending,
  onConfirm,
  onCancel,
}: {
  readonly counts: PaperCounts;
  /** The sections, when the paper has more than one; the totals are always shown. */
  readonly groups?: readonly PaperGroup[];
  readonly pending: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const { t } = usePreferences();
  const back = useRef<HTMLButtonElement>(null);
  const [bySection, setBySection] = useState(false);
  // Focus goes to "Keep working" once, when the summary opens — not again on
  // every render behind it, which would pull it back from "Yes, submit".
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  useEffect(() => {
    back.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const total = groups.length > 1 ? groups.map((g) => g.counts).reduce(plus) : counts;
  const left = total.notAnswered + total.notVisited + total.marked;
  const columns: readonly (readonly [string, string, (c: PaperCounts) => number])[] = [
    ["answered", t("palette.answered"), (c) => c.answered + c.answeredMarked],
    ["not-answered", t("palette.notAnswered"), (c) => c.notAnswered],
    ["marked", t("palette.marked"), (c) => c.marked],
    ["not-visited", t("palette.notVisited"), (c) => c.notVisited],
  ];
  const row = (title: string, c: PaperCounts, className: string) => (
    <tr key={`${className}-${title}`} className={className}>
      <th scope="row">{title}</th>
      {columns.map(([status, , of]) => (
        <td key={status}>{of(c)}</td>
      ))}
    </tr>
  );
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog submit-dialog" role="dialog" aria-modal="true" aria-labelledby="submit-title" aria-describedby="submit-note">
        <h2 id="submit-title">{t("submit.title")}</h2>
        <table className={`submit-table${bySection ? "" : " folded"}`}>
          <thead>
            <tr>
              <th scope="col">{groups.length > 1 ? t("brief.section") : <span className="visually-hidden">{t("brief.section")}</span>}</th>
              {columns.map(([status, label]) => (
                <th scope="col" key={status}>
                  <span className={`pq ${status}`} aria-hidden="true" />
                  <span className="col-label">{label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.length > 1 ? groups.map((g) => row(g.title, g.counts, "section-row")) : null}
            {row(groups.length > 1 ? t("submit.total") : t("submit.allQuestions"), total, "total-row")}
          </tbody>
        </table>
        {groups.length > 1 ? (
          <button type="button" className="link show-sections" aria-expanded={bySection} onClick={() => setBySection(!bySection)}>
            {bySection ? t("submit.hideSections") : t("submit.bySection")}
          </button>
        ) : null}
        {left > 0 ? (
          <p className="dialog-warn">{left === 1 ? t("submit.unansweredOne") : t("submit.unanswered", { n: left })}</p>
        ) : null}
        <p className="notice" id="submit-note">
          {total.answeredMarked > 0 ? `${t("submit.markedNote")} ` : ""}
          {t("exam.submitNote")}
        </p>
        <div className="dialog-actions">
          <button type="button" className="secondary" ref={back} onClick={onCancel}>
            {t("submit.back")}
          </button>
          <button type="button" className="submit-confirm" onClick={onConfirm} disabled={pending}>
            {pending ? t("exam.submitting") : t("submit.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** How long the "time is up" screen stays before the record opens by itself. */
export const TIME_UP_SECONDS = 5;

/**
 * The end of the time, without alarm: a clock, "Time is up", when the saved
 * answers went in, and the record a few seconds later — by itself, counting
 * down, or at once with Continue. No red: the moment is stressful enough.
 */
export function TimeUpScreen({ at, ready, onContinue }: { readonly at: number; readonly ready: boolean; readonly onContinue: () => void }) {
  const { t, language } = usePreferences();
  const [left, setLeft] = useState(TIME_UP_SECONDS);
  const button = useRef<HTMLButtonElement>(null);
  const done = useRef(onContinue);
  done.current = onContinue;
  useEffect(() => {
    button.current?.focus();
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    if (left <= 0) {
      done.current();
      return;
    }
    const id = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [ready, left]);
  const when = new Intl.DateTimeFormat(`${language}-IN`, { timeZone: "Asia/Kolkata", timeStyle: "short" }).format(new Date(at));
  return (
    <div className="time-up-screen">
      <section className="time-up" role="alertdialog" aria-modal="true" aria-labelledby="time-up-title" aria-describedby="time-up-note">
        <Clock3 aria-hidden="true" />
        <h1 id="time-up-title">{t("tools.timeUpTitle")}</h1>
        <p id="time-up-note">{ready ? t("timeup.submitted", { time: `${when} IST` }) : t("tools.timeUpNote")}</p>
        <button type="button" ref={button} className="large" disabled={!ready} onClick={onContinue}>
          {t("timeup.continue")}
        </button>
        <p className="notice" aria-live="off">
          {ready ? t("timeup.auto", { n: left }) : "\u00a0"}
        </p>
      </section>
    </div>
  );
}
