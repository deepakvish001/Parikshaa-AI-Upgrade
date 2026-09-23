import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConsoleError, type ConsoleClient, type IdentityState } from "../api.ts";

/**
 * Reviewing one candidate's proctoring (ROADMAP §14): the identity photos side
 * by side with a decision to record, the webcam photos, and what the browser
 * reported. Observations to weigh — the page says so, and decides nothing.
 */

const EVENT_NAMES: Readonly<Record<string, string>> = {
  tab_hidden: "Left the tab",
  fullscreen_exit: "Left full screen",
  copy: "Copied",
  paste: "Pasted",
  camera_off: "Camera stopped",
  camera_on: "Camera back",
};

export const IDENTITY_LABEL: Readonly<Record<IdentityState, string>> = {
  not_taken: "ID not taken",
  pending: "ID to check",
  verified: "ID confirmed",
  rejected: "ID not confirmed",
};

const time = (iso: string | number) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", timeStyle: "medium" }).format(new Date(iso));

/** A photo fetched with the session's token; its object URL is revoked when it leaves the page. */
function Photo({ client, attemptId, mediaId, alt, className }: { client: ConsoleClient; attemptId: string; mediaId: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let revoked: string | null = null;
    client
      .photoUrl(attemptId, mediaId)
      .then((u) => {
        revoked = u;
        setUrl(u);
      })
      .catch(() => setFailed(true));
    return () => {
      if (revoked !== null) URL.revokeObjectURL(revoked);
    };
  }, [client, attemptId, mediaId]);
  if (failed) return <p className="notice">Photo unavailable</p>;
  return url === null ? <div className={`photo-placeholder ${className ?? ""}`} aria-hidden="true" /> : <img src={url} alt={alt} className={className} />;
}

export function ProctoringReview({ client, attemptId, name, canDecide, onClose }: { client: ConsoleClient; attemptId: string; name: string; canDecide: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const view = useQuery({ queryKey: ["proctoring", attemptId], queryFn: () => client.proctoring(attemptId) });
  const [reason, setReason] = useState("");
  const decide = useMutation({
    mutationFn: (outcome: "verified" | "rejected") => client.reviewIdentity(attemptId, outcome, reason.trim()),
    onSuccess: async () => {
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["proctoring", attemptId] });
      await queryClient.invalidateQueries({ queryKey: ["live"] });
    },
  });

  if (view.isPending) return <p className="notice">Loading…</p>;
  if (view.error !== null) return <p className="error">Could not load the proctoring record.</p>;
  const { identity, snapshots, events } = view.data;

  return (
    <section className="card proctoring-review" aria-label={`Proctoring for ${name}`}>
      <div className="bar">
        <strong>Proctoring — {name}</strong>
        <span className="spacer" />
        <button type="button" className="quiet" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="notice">Observations to weigh. None of this marks anyone down by itself.</p>

      <h3>Identity</h3>
      {identity.selfie === null || identity.id === null ? (
        <p className="notice">Not taken yet.</p>
      ) : (
        <>
          <div className="id-pair">
            <figure>
              <Photo client={client} attemptId={attemptId} mediaId={identity.selfie.id} alt={`Photo of ${name}`} />
              <figcaption>Candidate</figcaption>
            </figure>
            <figure>
              <Photo client={client} attemptId={attemptId} mediaId={identity.id.id} alt={`Photo ID held by ${name}`} />
              <figcaption>Photo ID</figcaption>
            </figure>
          </div>
          {identity.matchesLedger ? null : (
            <p className="error">These photos do not match the hashes the ledger recorded when they were taken.</p>
          )}
          {identity.review === null ? (
            <p>
              <span className="pill attention">To check</span>
            </p>
          ) : (
            <p>
              <span className={identity.review.outcome === "verified" ? "pill ok" : "pill attention"}>
                {identity.review.outcome === "verified" ? "Confirmed" : "Not confirmed"}
              </span>{" "}
              by {identity.review.decidedBy} at {time(identity.review.at)} — {identity.review.reason}
            </p>
          )}
          {canDecide ? (
            <form
              aria-label="Decide on the identity photos"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <label htmlFor={`id-reason-${attemptId}`}>What you compared (goes on the candidate's record)</label>
              <input
                id={`id-reason-${attemptId}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Face matches the college ID card"
              />
              <div className="row">
                <button type="button" disabled={decide.isPending || reason.trim().length < 5} onClick={() => decide.mutate("verified")}>
                  Confirm identity
                </button>
                <button type="button" className="secondary" disabled={decide.isPending || reason.trim().length < 5} onClick={() => decide.mutate("rejected")}>
                  Does not match
                </button>
                {decide.error instanceof ConsoleError ? <span className="error">{decide.error.detail ?? "That did not work."}</span> : null}
              </div>
            </form>
          ) : null}
        </>
      )}

      <h3>Webcam photos ({snapshots.length})</h3>
      {snapshots.length === 0 ? (
        <p className="notice">None yet.</p>
      ) : (
        <ol className="snapshots">
          {snapshots.slice(0, 24).map((s) => (
            <li key={s.id}>
              <Photo client={client} attemptId={attemptId} mediaId={s.id} alt={`Webcam photo at ${time(s.takenAt)}`} className="thumb" />
              <span className="notice">{time(s.takenAt)}</span>
            </li>
          ))}
        </ol>
      )}
      {snapshots.length > 24 ? <p className="notice">The latest 24 of {snapshots.length}.</p> : null}

      <h3>Browser ({events.length})</h3>
      {events.length === 0 ? (
        <p className="notice">Nothing reported.</p>
      ) : (
        <ul className="timeline">
          {events.map((e, i) => (
            <li key={i}>
              <span className="mono">{time(e.at)}</span> {EVENT_NAMES[e.kind] ?? e.kind}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
