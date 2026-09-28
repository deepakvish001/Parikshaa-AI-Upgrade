import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CameraOff, ChevronLeft, ChevronRight, ClipboardPaste, Copy, EyeOff, Minimize2, type LucideIcon } from "lucide-react";
import { Dialog } from "@parikshaa/brand/ui";
import { ConsoleError, type ConsoleClient, type IdentityState, type ProctoringMedia } from "../api.ts";
import { Banner, SkeletonRows } from "./kit.tsx";

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
const EVENT_ICONS: Readonly<Record<string, LucideIcon>> = {
  tab_hidden: EyeOff,
  fullscreen_exit: Minimize2,
  copy: Copy,
  paste: ClipboardPaste,
  camera_off: CameraOff,
  camera_on: Camera,
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

/** One webcam photo large, with the ones before and after it a key away. */
function Lightbox({ client, attemptId, name, photos, at, onMove, onClose }: { client: ConsoleClient; attemptId: string; name: string; photos: readonly ProctoringMedia[]; at: number; onMove: (to: number) => void; onClose: () => void }) {
  const photo = photos[at]!;
  return (
    <Dialog label={`Webcam photo ${at + 1} of ${photos.length}`} onClose={onClose} className="lightbox">
      <div
        className="lightbox-body"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" && at > 0) onMove(at - 1);
          if (event.key === "ArrowRight" && at < photos.length - 1) onMove(at + 1);
        }}
      >
        <div className="lightbox-head">
          <strong>
            {at + 1} of {photos.length}
          </strong>
          <span className="notice">{time(photo.takenAt)} IST</span>
          <span className="spacer" />
          <button type="button" className="quiet" onClick={onClose}>
            Close
          </button>
        </div>
        <Photo key={photo.id} client={client} attemptId={attemptId} mediaId={photo.id} alt={`Webcam photo of ${name} at ${time(photo.takenAt)}`} className="lightbox-photo" />
        <div className="lightbox-nav">
          <button type="button" className="secondary" disabled={at === 0} onClick={() => onMove(at - 1)}>
            <ChevronLeft aria-hidden="true" />
            Earlier
          </button>
          <button type="button" className="secondary" disabled={at === photos.length - 1} onClick={() => onMove(at + 1)}>
            Later
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </Dialog>
  );
}

export function ProctoringReview({ client, attemptId, name, canDecide, onClose }: { client: ConsoleClient; attemptId: string; name: string; canDecide: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const view = useQuery({ queryKey: ["proctoring", attemptId], queryFn: () => client.proctoring(attemptId) });
  const [reason, setReason] = useState("");
  const [looking, setLooking] = useState<number | null>(null);
  const decide = useMutation({
    mutationFn: (outcome: "verified" | "rejected") => client.reviewIdentity(attemptId, outcome, reason.trim()),
    onSuccess: async () => {
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["proctoring", attemptId] });
      await queryClient.invalidateQueries({ queryKey: ["live"] });
    },
  });

  if (view.isPending) return <SkeletonRows rows={4} columns={2} label="Loading the proctoring record…" />;
  if (view.error !== null) return <Banner tone="danger" title="Could not load the proctoring record." />;
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
              <span className="pill attention">ID to check</span>
            </p>
          ) : (
            <p>
              <span className={identity.review.outcome === "verified" ? "pill ok" : "pill bad"}>
                {identity.review.outcome === "verified" ? "ID confirmed" : "ID not confirmed"}
              </span>{" "}
              by {identity.review.decidedBy} at {time(identity.review.at)} — {identity.review.reason}
            </p>
          )}
        </>
      )}

      <h3>Webcam photos ({snapshots.length})</h3>
      {snapshots.length === 0 ? (
        <p className="notice">None yet.</p>
      ) : (
        <ol className="snapshots">
          {snapshots.slice(0, 24).map((s, i) => (
            <li key={s.id}>
              <button type="button" className="thumb-button" aria-label={`Open the webcam photo at ${time(s.takenAt)}`} onClick={() => setLooking(i)}>
                <Photo client={client} attemptId={attemptId} mediaId={s.id} alt="" className="thumb" />
              </button>
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
          {events.map((e, i) => {
            const Icon = EVENT_ICONS[e.kind];
            return (
              <li key={i}>
                <span className="timeline-icon" aria-hidden="true">
                  {Icon === undefined ? null : <Icon />}
                </span>
                <span className="mono">{time(e.at)}</span> {EVENT_NAMES[e.kind] ?? e.kind}
              </li>
            );
          })}
        </ul>
      )}
      {/* The decision stays at the foot of the drawer while the photos above are looked through. */}
      {canDecide && identity.selfie !== null && identity.id !== null ? (
        <form
          className="decision-bar"
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
      {looking === null ? null : (
        <Lightbox client={client} attemptId={attemptId} name={name} photos={snapshots.slice(0, 24)} at={looking} onMove={setLooking} onClose={() => setLooking(null)} />
      )}
    </section>
  );
}
