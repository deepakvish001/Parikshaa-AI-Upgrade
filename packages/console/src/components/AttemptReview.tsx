import type { AttemptReview as Review, VivaReview } from "../api.ts";

interface Props {
  readonly attemptId: string;
  readonly review: Review;
  readonly grading: boolean;
  readonly assessing: string | null;
  readonly onGrade: () => void;
  readonly onAssess: (probeId: string) => void;
}

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
export function AttemptReview({ attemptId, review, grading, assessing, onGrade, onAssess }: Props) {
  const gradable = review.state === "submitted";

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

              {viva.verdict === null && viva.reply !== null ? (
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

      <p className="notice mono">{attemptId}</p>
    </>
  );
}
