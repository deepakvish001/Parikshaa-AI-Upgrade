import { useEffect, useRef, useState, type ReactNode } from "react";
import { Wordmark } from "@parikshaa/brand/react";
import { PreferencesBar, usePreferences, type Language } from "../i18n.tsx";
import type { CandidateState } from "../api.ts";

type CandidateQuestion = CandidateState["exam"]["questions"][number];

/**
 * The bar across the top of a sitting, the way a computer-based test hall
 * lays it out: the name and the paper on the left, the clock in the middle
 * where the eye finds it, the language and the way out on the right. Ink in
 * both themes, so the paper below it is the brightest thing on the screen.
 */
export function ExamBar({
  title,
  offered = [],
  clock,
  status,
  action,
}: {
  readonly title: string;
  readonly offered?: readonly Language[];
  readonly clock?: ReactNode;
  /** Small state beside the title: the camera, the connection. */
  readonly status?: ReactNode;
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
          <PreferencesBar offered={offered} />
          {action}
        </div>
      </div>
    </header>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Time left in the exam, to the second, in the middle of the bar.
 *
 * This is the exam's own window, which a candidate is entitled to see. It is
 * not a timer on the micro-viva — SPEC §8 rules that out, and the probe panel
 * shows none. Read aloud as words ("45m left"), shown as a clock.
 */
export function Countdown({ expiresAt }: { readonly expiresAt: number }) {
  const { t } = usePreferences();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, expiresAt - now);
  const seconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const spoken = remaining === 0 ? t("exam.timeUp") : t("exam.timeLeft", { time: hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m` });
  const tone = remaining < 5 * 60_000 ? " urgent" : remaining < 15 * 60_000 ? " soon" : "";
  return (
    <div className={`countdown${tone}`} role="timer" aria-label={spoken} title={spoken}>
      <span className="countdown-label" aria-hidden="true">
        {t("exam.timeLeftLabel")}
      </span>
      <span className="countdown-digits" aria-hidden="true">
        {pad(hours)}:{pad(minutes % 60)}:{pad(seconds % 60)}
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

/**
 * The last look before submitting, as a CBT hall shows it: how many
 * questions are answered, left, never opened and marked, so nothing is
 * submitted by surprise. Escape or "Keep working" goes back to the paper.
 */
export function SubmitDialog({
  counts,
  pending,
  onConfirm,
  onCancel,
}: {
  readonly counts: PaperCounts;
  readonly pending: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const { t } = usePreferences();
  const back = useRef<HTMLButtonElement>(null);
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
  const left = counts.notAnswered + counts.notVisited + counts.marked;
  const rows: readonly [string, string, number][] = [
    ["answered", t("palette.answered"), counts.answered],
    ["not-answered", t("palette.notAnswered"), counts.notAnswered],
    ["not-visited", t("palette.notVisited"), counts.notVisited],
    ["marked", t("palette.marked"), counts.marked],
    ["answered-marked", t("palette.answeredMarked"), counts.answeredMarked],
  ];
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="submit-title" aria-describedby="submit-note">
        <h2 id="submit-title">{t("submit.title")}</h2>
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
        {left > 0 ? <p className="dialog-warn">{t("submit.unanswered", { n: left })}</p> : null}
        <p className="notice" id="submit-note">
          {counts.answeredMarked > 0 ? `${t("submit.markedNote")} ` : ""}
          {t("exam.submitNote")}
        </p>
        <div className="dialog-actions">
          <button type="button" className="secondary" ref={back} onClick={onCancel}>
            {t("submit.back")}
          </button>
          <button type="button" onClick={onConfirm} disabled={pending}>
            {pending ? t("exam.submitting") : t("submit.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
