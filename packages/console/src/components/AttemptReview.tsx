import { useState } from "react";
import type { AttemptReview as Review, VivaReview } from "../api.ts";

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
}: Props) {
  const gradable = review.state === "submitted" && can.grade;
  const [deciding, setDeciding] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <>
      <section className="card">
        <p className="notice">Grade</p>
        <p className="grade">{review.total ?? "—"}</p>
        <div className="row">
          <span className="pill">{review.state.replace(/_/g, " ")}</span>
          {gradable ? (
            <button type="button" onClick={onGrade} disabled={grading}>
              {grading ? "Grading…" : "Grade attempt"}
            </button>
          ) : null}
        </div>
        {failure === null ? null : (
          <p className="error" role="alert">
            {failure}
          </p>
        )}
      </section>

      <section className="card evidence" aria-label="Provenance evidence">
        <h2>Provenance evidence</h2>
        <p className="notice">
          This is not part of the grade and has not changed it. It records what the
          candidate was asked about their own answers and how they responded, for
          you to weigh.
        </p>

        {review.vivas.length === 0 ? (
          <p className="notice" style={{ marginTop: "1rem" }}>
            No follow-up was raised on this attempt. That is the ordinary case: a
            probe is only worth asking when an answer scored well enough that
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
                      {viva.confidence === null ? null : (
                        <span className="notice"> · confidence {viva.confidence.toFixed(2)}</span>
                      )}
                    </dd>
                    <dt>Reasoning</dt>
                    <dd className="notice">{viva.reasoning}</dd>
                  </>
                )}
              </dl>

              {viva.verdict === null && viva.reply !== null && can.assess ? (
                <div className="row">
                  <button
                    type="button"
                    className="secondary"
                    disabled={assessing === viva.probeId}
                    onClick={() => onAssess(viva.probeId)}
                  >
                    {assessing === viva.probeId ? "Reading…" : "Read this exchange"}
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </section>

      {review.state === "void" ? (
        <section className="card" aria-label="Set aside">
          <h2 style={{ fontSize: ".95rem", margin: "0 0 .3rem" }}>
            This attempt was set aside{review.voidedBy == null ? "" : ` by ${review.voidedBy.name}`}
          </h2>
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
          <h2 style={{ fontSize: ".95rem", margin: "0 0 .3rem" }}>Decision</h2>
          <p className="notice">
            Nothing above sets this attempt aside on its own. If you decide it should
            be, the reason you give is recorded and shown to the candidate.
          </p>

          {deciding ? (
            <>
              <div className="field" style={{ marginTop: ".75rem" }}>
                <label htmlFor="void-reason">Reason</label>
                <textarea
                  id="void-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="What you concluded, and on what basis."
                />
              </div>
              <div className="row">
                <button
                  type="button"
                  disabled={voiding || reason.trim().length < MIN_REASON}
                  onClick={() => onVoid(reason.trim())}
                >
                  {voiding ? "Recording…" : "Set this attempt aside"}
                </button>
                <button type="button" className="quiet" onClick={() => setDeciding(false)}>
                  Cancel
                </button>
                {reason.trim().length > 0 && reason.trim().length < MIN_REASON ? (
                  <span className="notice">A reason this short cannot be defended on appeal.</span>
                ) : null}
              </div>
            </>
          ) : (
            <div className="row">
              <button type="button" className="quiet" onClick={() => setDeciding(true)}>
                Set aside…
              </button>
            </div>
          )}
        </section>
      )}

      <p className="notice mono">{attemptId}</p>
    </>
  );
}
