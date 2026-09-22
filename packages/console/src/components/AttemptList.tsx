import { Fragment, useState } from "react";
import type { AttemptSummary } from "../api.ts";

interface Props {
  readonly attempts: readonly AttemptSummary[];
  readonly issued: { candidateId: string; token: string } | null;
  readonly starting: boolean;
  readonly onStart: (candidateId: string) => void;
  readonly onReview: (attemptId: string) => void;
  readonly canStart?: boolean;
  readonly canReview?: boolean;
  /** Present when this account may grant extra time. */
  readonly onExtend?: (attemptId: string, minutes: number, reason: string) => Promise<unknown>;
  /** For "last seen"; injectable so it can be tested. */
  readonly now?: number;
}

/** A page that checked in this recently is taken to be open in front of someone. */
const LIVE_WITHIN_MS = 90_000;
/** Mirrors the server's minimum; the reason is written into the attempt's ledger. */
const MIN_REASON = 10;

/**
 * Whether the candidate is here.
 *
 * Presence only: the page checks in every 30 seconds while visible. It says
 * nothing about what the candidate is doing, and is not evidence of anything —
 * a closed lid and a dropped connection look the same.
 */
export function presence(lastSeenAt: string | null | undefined, now: number): string {
  if (lastSeenAt == null) return "not yet";
  const ago = now - Date.parse(lastSeenAt);
  if (ago < LIVE_WITHIN_MS) return "here";
  const minutes = Math.round(ago / 60_000);
  return minutes < 60 ? `last seen ${minutes}m ago` : `last seen ${Math.round(minutes / 60)}h ago`;
}

function ExtendForm({
  candidateId,
  onExtend,
  onDone,
}: {
  candidateId: string;
  onExtend: (minutes: number, reason: string) => Promise<unknown>;
  onDone: () => void;
}) {
  const [minutes, setMinutes] = useState("10");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = Number.isInteger(Number(minutes)) && Number(minutes) >= 1 && Number(minutes) <= 240;

  return (
    <form
      aria-label={`Extra time for ${candidateId}`}
      onSubmit={async (e) => {
        e.preventDefault();
        setSending(true);
        setError(null);
        try {
          await onExtend(Number(minutes), reason.trim());
          onDone();
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : "That did not work.");
          setSending(false);
        }
      }}
    >
      <div className="grid">
        <div className="field">
          <label htmlFor={`extend-minutes-${candidateId}`}>Minutes</label>
          <input
            id={`extend-minutes-${candidateId}`}
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`extend-reason-${candidateId}`}>Reason</label>
          <input
            id={`extend-reason-${candidateId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Power cut in hall B"
          />
        </div>
      </div>
      <p className="notice">Recorded in the attempt's ledger with your name, and shown on the candidate's receipt.</p>
      {error === null ? null : (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button type="submit" disabled={sending || !valid || reason.trim().length < MIN_REASON}>
          Grant extra time
        </button>
        <button type="button" className="quiet" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function AttemptList({
  attempts,
  issued,
  starting,
  onStart,
  onReview,
  canStart = true,
  canReview = true,
  onExtend,
  now = Date.now(),
}: Props) {
  const [candidateId, setCandidateId] = useState("");
  const [extending, setExtending] = useState<string | null>(null);

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
                <th scope="col">Here</th>
                <th scope="col">Entries</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt) => (
                <Fragment key={attempt.id}>
                <tr>
                  <td>{attempt.candidateId}</td>
                  <td>
                    <span className="pill">{attempt.state.replace(/_/g, " ")}</span>
                  </td>
                  <td className="notice">{attempt.state === "in_progress" ? presence(attempt.lastSeenAt, now) : ""}</td>
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
                    {onExtend !== undefined && attempt.state === "in_progress" && extending !== attempt.id ? (
                      <button type="button" className="quiet" onClick={() => setExtending(attempt.id)}>
                        Extra time…
                      </button>
                    ) : null}
                  </td>
                </tr>
                {onExtend !== undefined && extending === attempt.id ? (
                  <tr>
                    <td colSpan={5}>
                      <ExtendForm
                        candidateId={attempt.candidateId}
                        onExtend={(minutes, reason) => onExtend(attempt.id, minutes, reason)}
                        onDone={() => setExtending(null)}
                      />
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
