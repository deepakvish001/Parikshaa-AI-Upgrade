import { useState } from "react";
import type { AttemptSummary } from "../api.ts";

interface Props {
  readonly attempts: readonly AttemptSummary[];
  readonly issued: { candidateId: string; token: string } | null;
  readonly starting: boolean;
  readonly onStart: (candidateId: string) => void;
  readonly onReview: (attemptId: string) => void;
  readonly canStart?: boolean;
  readonly canReview?: boolean;
}

export function AttemptList({
  attempts,
  issued,
  starting,
  onStart,
  onReview,
  canStart = true,
  canReview = true,
}: Props) {
  const [candidateId, setCandidateId] = useState("");

  return (
    <>
      <section className="card" hidden={!canStart}>
        <div className="field">
          <label htmlFor="candidate">Start an attempt for a candidate</label>
          <div className="row" style={{ marginTop: 0 }}>
            <input
              id="candidate"
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
              placeholder="Candidate reference"
            />
            <button
              type="button"
              disabled={starting || candidateId.trim() === ""}
              onClick={() => {
                onStart(candidateId.trim());
                setCandidateId("");
              }}
            >
              {starting ? "Starting…" : "Start"}
            </button>
          </div>
        </div>

        {issued === null ? null : (
          <div className="field">
            <label>Access code for {issued.candidateId}</label>
            <textarea readOnly className="mono" value={issued.token} aria-label="Access code" />
            <p className="notice">
              Hand this to the candidate. It grants this one attempt and expires with
              the exam window.
            </p>
          </div>
        )}
      </section>

      <section className="card">
        {attempts.length === 0 ? (
          <p className="notice">No attempts yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Candidate</th>
                <th scope="col">State</th>
                <th scope="col">Entries</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt) => (
                <tr key={attempt.id}>
                  <td>{attempt.candidateId}</td>
                  <td>
                    <span className="pill">{attempt.state.replace(/_/g, " ")}</span>
                  </td>
                  <td>{attempt.entries}</td>
                  <td>
                    <button
                      type="button"
                      className="crumb"
                      disabled={!canReview}
                      onClick={() => onReview(attempt.id)}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
