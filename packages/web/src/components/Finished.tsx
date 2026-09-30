import { CircleCheck, Printer } from "lucide-react";
import type { CandidateLedger } from "../api.ts";
import { usePreferences } from "../i18n.tsx";
import { Feedback, type FeedbackClient } from "./Feedback.tsx";

/** When the attempt was submitted, from the record itself: the last submission's entry. */
export function submittedAt(ledger: CandidateLedger | undefined): number | null {
  const entries = ledger?.entries ?? [];
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i]!;
    if (entry.event.type === "attempt_submitted") return entry.timestamp;
  }
  return null;
}

/**
 * The end of a sitting, said plainly: submitted, when, and how the paper was
 * left — answered, not answered, marked — before the record below it. A
 * printout (or "Save as PDF") carries the same, with the record's fingerprint.
 */
export function Finished({
  title,
  graded,
  at,
  total,
  answered,
  marked,
  feedback,
}: {
  readonly title: string;
  readonly graded: boolean;
  readonly at: number | null;
  readonly total: number;
  readonly answered: number;
  readonly marked: number;
  /** Where to send how the test went; absent, the question is not asked. */
  readonly feedback?: FeedbackClient;
}) {
  const { t, language } = usePreferences();
  const when =
    at === null
      ? null
      : new Intl.DateTimeFormat(`${language}-IN`, { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(at));
  const figures: readonly [string, number, string][] = [
    [t("done.total"), total, ""],
    [t("done.answered"), answered, " ok"],
    [t("done.unanswered"), total - answered, total - answered > 0 ? " left" : ""],
    [t("done.marked"), marked, ""],
  ];
  return (
    <section className="finished" aria-labelledby="finished-title">
      <span className="finished-mark" aria-hidden="true">
        <CircleCheck />
      </span>
      <p className="eyebrow">{title}</p>
      <h2 id="finished-title">{graded ? t("done.graded") : t("done.title")}</h2>
      <p className="finished-lead">
        {t("done.lead")}
        {when === null ? null : (
          <>
            {" "}
            <strong>{t("done.at", { time: `${when} IST` })}</strong>
          </>
        )}
      </p>
      <dl className="finished-figures">
        {figures.map(([label, value, tone]) => (
          <div key={label} className={`figure-tile${tone}`}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="next-steps">
        <h3>{t("done.nextTitle")}</h3>
        <ol>
          <li>{t("done.step1")}</li>
          <li>{t("done.step2")}</li>
          <li>{t("done.step3")}</li>
        </ol>
      </div>
      {feedback === undefined ? null : <Feedback client={feedback} />}
      <p className="notice">{t("done.next")}</p>
      <div className="finished-actions">
        <button type="button" className="secondary" onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          {t("done.print")}
        </button>
      </div>
    </section>
  );
}
