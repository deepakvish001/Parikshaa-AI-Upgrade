import { useEffect, useRef, useState } from "react";
import { Dialog } from "@parikshaa/brand/ui";
import type { AttemptReview as Review, CandidateReport, VivaReview } from "../api.ts";
import { PageActions, PageMeta, PageStatus, StateBadge } from "./kit.tsx";

/** Mirrors the server's minimum; the reason is recorded and shown to the candidate. */
const MIN_REASON = 10;

interface Props {
  readonly attemptId: string;
  readonly review: Review;
  readonly grading: boolean;
  readonly assessing: string | null;
  readonly voiding: boolean;
  readonly onGrade: () => void;
  readonly onAssess: (probeId: string) => void;
  readonly onVoid: (reason: string) => void;
  /** What this account may do here. The server enforces it; this only hides what would be refused. */
  readonly can?: { readonly grade: boolean; readonly assess: boolean; readonly void: boolean };
  /** Why the last action failed, in the server's words. */
  readonly failure?: string | null;
  /** The candidate's answers and marks, when this account may read the scorecard. */
  readonly answers?: CandidateReport | undefined;
}

const EVERYTHING = { grade: true, assess: true, void: true } as const;

const VERDICT_LABEL: Record<NonNullable<VivaReview["verdict"]>, string> = {
  consistent: "Consistent with having produced the answer",
  shallow: "Engaged the answer only superficially",
  inconsistent: "Contradicts or misreads their own answer",
  inconclusive: "Not enough to judge either way",
};

const seconds = (ms: number | null) => (ms === null ? "—" : `${Math.round(ms / 1000)}s`);

/**
 * Reviewing one attempt.
 *
 * The grade and the provenance evidence are presented as two different kinds of
 * object, because they are (SPEC §6.1). The grade is a settled number. The
 * evidence below it is material for a human to weigh, and there is deliberately
 * no control on this screen that turns a verdict into a mark — adjusting a
 * grade is a decision someone makes and owns, not a button that launders a
 * model's opinion into a number.
 */
export function AttemptReview({
  attemptId,
  review,
  grading,
  assessing,
  voiding,
  onGrade,
  onAssess,
  onVoid,
  can = EVERYTHING,
  failure = null,
  answers,
}: Props) {
  const gradable = review.state === "submitted" && can.grade;
  const [deciding, setDeciding] = useState(false);
  const list = useRef<HTMLOListElement>(null);

  // J and K move between answers, as in a mail client; never while typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "j" && event.key !== "k") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target !== null && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (document.querySelector('[role="dialog"]') !== null) return;
      const items = [...(list.current?.querySelectorAll<HTMLElement>(".review-answer") ?? [])];
      if (items.length === 0) return;
      const at = items.findIndex((item) => item.contains(document.activeElement));
      const to = event.key === "j" ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1);
      event.preventDefault();
      items[to]!.focus();
      items[to]!.scrollIntoView?.({ block: "nearest" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const who = answers === undefined ? null : `${answers.candidate.ref}${answers.candidate.name === "" ? "" : ` · ${answers.candidate.name}`}`;

  return (
    <>
      <PageStatus>
        <StateBadge state={review.state} />
      </PageStatus>
      <PageMeta>
        <span>
          {[who, review.total === null ? "Not graded yet" : `${review.total}${answers === undefined ? "" : ` / ${answers.result.maxTotal}`} marks`].filter((x) => x !== null).join(" · ")}
        </span>
      </PageMeta>
      {gradable ? (
        <PageActions>
          <button type="button" onClick={onGrade} disabled={grading}>
            {grading ? "Grading…" : "Grade attempt"}
          </button>
        </PageActions>
      ) : null}

      <div className="review-layout">
        <div className="review-main">
          <section className="card review-grade" aria-label="Grade">
            <p className="notice">Grade</p>
            <p className="grade">{review.total ?? "—"}</p>
            {failure === null ? null : (
              <p className="error" role="alert">
                {failure}
              </p>
            )}
          </section>

          {answers === undefined ? null : (
            <section className="card" aria-label="Answers">
              <div className="bar">
                <strong>Answers</strong>
                <span className="spacer" />
                <span className="notice small">
                  <kbd>J</kbd> and <kbd>K</kbd> move between them
                </span>
              </div>
              <ol className="review-answers" ref={list}>
                {answers.questions.map((q, i) => (
                  <li key={q.id} className="review-answer answer" tabIndex={-1} aria-label={`Answer ${i + 1}`}>
                    <div className="bar">
                      <span>
                        <span className="mono notice">{i + 1}.</span> {q.stem}
                      </span>
                      <span className="spacer" />
                      <span className="mono">{q.score === null ? `— / ${q.maxScore}` : `${q.score} / ${q.maxScore}`}</span>
                    </div>
                    {q.answer === null ? <p className="notice">Not answered.</p> : q.kind === "code" ? <pre className="code">{q.answer}</pre> : <p className="given">{q.answer}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {review.state === "void" ? (
            <section className="card" aria-label="Set aside">
              <h2 className="card-title">This attempt was set aside{review.voidedBy == null ? "" : ` by ${review.voidedBy.name}`}</h2>
              <p className="notice">{review.voidReason}</p>
            </section>
          ) : !can.void ? null : (
            /*
             * The decision, and deliberately its own section — not in the grade card,
             * which would make it look like a grading action, and not in the evidence
             * card, which would make it look like the verdict's consequence. SPEC §6.1
             * reserves this for a person.
             *
             * It takes two steps and a written reason on purpose. The reason goes into
             * a tamper-evident record, is shown to the candidate, and is what an appeal
             * is argued against; a one-click button would not produce one worth having.
             */
            <section className="card" aria-label="Decision">
              <h2 className="card-title">Decision</h2>
              <p className="notice">
                Nothing above sets this attempt aside on its own. If you decide it should be, the reason you give is recorded and shown to the candidate.
              </p>
              <div className="row">
                <button type="button" className="secondary" onClick={() => setDeciding(true)}>
                  Set aside…
                </button>
              </div>
            </section>
          )}
          <p className="notice mono">{attemptId}</p>
        </div>

        <section className="card evidence review-evidence" aria-label="Provenance evidence">
          <p className="evidence-label">Evidence · does not change marks</p>
          <h2>Provenance evidence</h2>
          <p className="notice">
            This is not part of the grade and has not changed it. It records what the candidate was asked about their own answers and how they
            responded, for you to weigh.
          </p>

          {review.vivas.length === 0 ? (
            <p className="notice">
              No follow-up was raised on this attempt. That is the ordinary case: a probe is only worth asking when an answer scored well enough that
              where it came from matters.
            </p>
          ) : (
            review.vivas.map((viva) => (
              <div className="viva" key={viva.probeId}>
                <dl>
                  <dt>Asked because</dt>
                  <dd className="notice">{viva.rationale}</dd>

                  <dt>Follow-up</dt>
                  <dd>{viva.prompt}</dd>

                  <dt>Reply {viva.reply === null ? "" : `· ${seconds(viva.latencyMs)}`}</dt>
                  <dd>{viva.reply ?? <span className="notice">No reply was given.</span>}</dd>

                  {viva.verdict === null ? null : (
                    <>
                      <dt>Reading</dt>
                      <dd>
                        <span className="verdict" data-v={viva.verdict}>
                          {VERDICT_LABEL[viva.verdict]}
                        </span>
                        {viva.confidence === null ? null : <span className="notice"> · confidence {viva.confidence.toFixed(2)}</span>}
                      </dd>
                      <dt>Reasoning</dt>
                      <dd className="notice">{viva.reasoning}</dd>
                    </>
                  )}
                </dl>

                {viva.verdict === null && viva.reply !== null && can.assess ? (
                  <div className="row">
                    <button type="button" className="secondary" disabled={assessing === viva.probeId} onClick={() => onAssess(viva.probeId)}>
                      {assessing === viva.probeId ? "Reading…" : "Read this exchange"}
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </section>
      </div>

      {deciding ? <SetAside voiding={voiding} onVoid={onVoid} onClose={() => setDeciding(false)} /> : null}
    </>
  );
}

/** Setting an attempt aside: a reason worth defending on appeal, then the decision. */
function SetAside({ voiding, onVoid, onClose }: { voiding: boolean; onVoid: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const short = reason.trim().length > 0 && reason.trim().length < MIN_REASON;
  return (
    <Dialog label="Set this attempt aside" onClose={onClose} initialFocus={field} dismissable={!voiding}>
      <h2 className="dialog-title">Set this attempt aside</h2>
      <p className="notice">It will not be graded or ranked. The reason is written into the attempt's record, shown to the candidate, and is what an appeal is argued against.</p>
      <div className="field">
        <label htmlFor="void-reason">Reason</label>
        <textarea ref={field} id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What you concluded, and on what basis." />
        {short ? <p className="error">A reason this short cannot be defended on appeal.</p> : <p className="notice small">At least {MIN_REASON} characters.</p>}
      </div>
      <div className="dialog-actions">
        <button type="button" className="quiet" onClick={onClose} disabled={voiding}>
          Cancel
        </button>
        <button type="button" className="danger" disabled={voiding || reason.trim().length < MIN_REASON} onClick={() => onVoid(reason.trim())}>
          {voiding ? "Recording…" : "Set this attempt aside"}
        </button>
      </div>
    </Dialog>
  );
}
