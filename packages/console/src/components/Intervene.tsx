import { useRef, useState } from "react";
import { Dialog } from "@parikshaa/brand/ui";
import { ConsoleError } from "../api.ts";

/** Mirrors the server's minimum; the reason is written into the attempt's ledger. */
export const MIN_REASON = 10;

/**
 * Extra time for a candidate still sitting, or reopening one who has
 * submitted: minutes and a reason, both recorded in the candidate's ledger
 * with the person's name and shown on their receipt.
 */
export function TimeDialog({
  kind,
  who,
  onSubmit,
  onClose,
}: {
  kind: "extend" | "reopen";
  /** The candidate, as the page names them: a roll number or a name. */
  who: string;
  onSubmit: (minutes: number, reason: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [minutes, setMinutes] = useState(kind === "reopen" ? "15" : "10");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);
  const n = Number(minutes);
  const validMinutes = Number.isInteger(n) && n >= 1 && n <= 240;
  const short = reason.trim().length > 0 && reason.trim().length < MIN_REASON;
  const title = kind === "extend" ? `Extra time for ${who}` : `Reopen ${who}`;

  return (
    <Dialog label={title} onClose={onClose} initialFocus={first} dismissable={!sending}>
      <form
        aria-label={title}
        onSubmit={async (event) => {
          event.preventDefault();
          setSending(true);
          setError(null);
          try {
            await onSubmit(n, reason.trim());
            onClose();
          } catch (failure) {
            setError(failure instanceof ConsoleError ? (failure.detail ?? failure.message) : failure instanceof Error ? failure.message : "That did not work.");
            setSending(false);
          }
        }}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="notice">
          {kind === "extend"
            ? "Added to the candidate's clock now."
            : "The candidate can go back in and carry on until this many minutes from now."}{" "}
          Recorded in the attempt's ledger with your name, and shown on the candidate's receipt.
        </p>
        <div className="field">
          <label htmlFor="time-minutes">{kind === "extend" ? "Extra minutes" : "Minutes from now"}</label>
          <input ref={first} id="time-minutes" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-invalid={!validMinutes} />
          {validMinutes ? null : <p className="error">Between 1 and 240 minutes.</p>}
        </div>
        <div className="field">
          <label htmlFor="time-reason">Reason</label>
          <input
            id="time-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={kind === "extend" ? "e.g. Power cut in hall B" : "e.g. Laptop crashed and submitted"}
            aria-describedby="time-reason-hint"
          />
          <p id="time-reason-hint" className={short ? "error" : "notice small"}>
            {short ? `At least ${MIN_REASON} characters.` : "Goes on the candidate's record."}
          </p>
        </div>
        {error === null ? null : (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="quiet" onClick={onClose} disabled={sending}>
            Cancel
          </button>
          <button type="submit" disabled={sending || !validMinutes || reason.trim().length < MIN_REASON}>
            {kind === "extend" ? "Grant extra time" : "Reopen"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
