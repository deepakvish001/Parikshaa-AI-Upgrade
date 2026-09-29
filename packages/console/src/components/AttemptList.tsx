import { useRef, useState } from "react";
import { Clock, Copy, Users } from "lucide-react";
import { Dialog } from "@parikshaa/brand/ui";
import type { AttemptSummary } from "../api.ts";
import { TimeDialog } from "./Intervene.tsx";
import { EmptyState, RowMenu, StateBadge, ago } from "./kit.tsx";

interface Props {
  readonly attempts: readonly AttemptSummary[];
  readonly onReview: (attemptId: string) => void;
  readonly canReview?: boolean;
  /** Present when this account may grant extra time. */
  readonly onExtend?: (attemptId: string, minutes: number, reason: string) => Promise<unknown>;
  /** The one action that fills an empty list: inviting candidates. */
  readonly onInvite?: () => void;
  /** For "last seen"; injectable so it can be tested. */
  readonly now?: number;
}

/** A page that checked in this recently is taken to be open in front of someone. */
const LIVE_WITHIN_MS = 90_000;

/**
 * Whether the candidate is here.
 *
 * Presence only: the page checks in every 30 seconds while visible. It says
 * nothing about what the candidate is doing, and is not evidence of anything —
 * a closed lid and a dropped connection look the same.
 */
export function presence(lastSeenAt: string | null | undefined, now: number): { words: string; seen: "here" | "away" | "never" } {
  if (lastSeenAt == null) return { words: "Not yet", seen: "never" };
  if (now - Date.parse(lastSeenAt) < LIVE_WITHIN_MS) return { words: "Here now", seen: "here" };
  return { words: ago(lastSeenAt, now), seen: "away" };
}

/** Everyone who has started the exam, where each stands, and whether they are here. */
export function AttemptList({ attempts, onReview, canReview = true, onExtend, onInvite, now = Date.now() }: Props) {
  const [extending, setExtending] = useState<AttemptSummary | null>(null);

  return (
    <section className="card" aria-label="Attempts">
      {attempts.length === 0 ? (
        <EmptyState icon={Users} action={onInvite === undefined ? undefined : { label: "Invite candidates", onClick: onInvite }}>
          Candidates appear here as they start, with whether they are here now.
        </EmptyState>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Roll no.</th>
                <th scope="col">State</th>
                <th scope="col">Last seen</th>
                <th scope="col" className="num">
                  Record entries
                </th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt) => {
                const seen = attempt.state === "in_progress" ? presence(attempt.lastSeenAt, now) : null;
                return (
                  <tr key={attempt.id}>
                    <td className="mono">{attempt.candidateId}</td>
                    <td>
                      <StateBadge state={attempt.state} />
                    </td>
                    <td className="seen">
                      {seen === null ? (
                        <span className="notice">—</span>
                      ) : (
                        <span className={`seen-at ${seen.seen}`}>
                          <span className="seen-dot" aria-hidden="true" />
                          {seen.words}
                        </span>
                      )}
                    </td>
                    <td className="num">{attempt.entries}</td>
                    <td className="row-end">
                      <button type="button" className="quiet" disabled={!canReview} onClick={() => onReview(attempt.id)}>
                        Review
                      </button>
                      <RowMenu
                        of={attempt.candidateId}
                        keepPlace
                        items={[
                          onExtend !== undefined && attempt.state === "in_progress" && { label: "Extra time…", icon: <Clock />, onSelect: () => setExtending(attempt) },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {extending === null || onExtend === undefined ? null : (
        <TimeDialog kind="extend" who={extending.candidateId} onSubmit={(minutes, reason) => onExtend(extending.id, minutes, reason)} onClose={() => setExtending(null)} />
      )}
    </section>
  );
}

/**
 * One attempt started by hand, for a candidate without an invitation: the
 * reference in, the access code out, to hand over.
 */
export function StartAttemptDialog({
  starting,
  issued,
  error,
  onStart,
  onClose,
}: {
  starting: boolean;
  issued: { candidateId: string; token: string } | null;
  error: string | null;
  onStart: (candidateId: string) => void;
  onClose: () => void;
}) {
  const [candidateId, setCandidateId] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  return (
    <Dialog label="Start an attempt by roll number" onClose={onClose} initialFocus={input}>
      <h2 className="dialog-title">Start an attempt by roll number</h2>
      {issued === null ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onStart(candidateId.trim());
          }}
        >
          <p className="notice">For a candidate without an invitation. The attempt starts now, and its access code is shown once.</p>
          <div className="field">
            <label htmlFor="candidate">Roll number</label>
            <input ref={input} id="candidate" className="mono" value={candidateId} onChange={(e) => setCandidateId(e.target.value)} placeholder="e.g. CS001" />
          </div>
          {error === null ? null : (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button type="button" className="quiet" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={starting || candidateId.trim() === ""}>
              {starting ? "Starting…" : "Start"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="field">
            <label htmlFor="issued-code">Access code for {issued.candidateId}</label>
            <textarea id="issued-code" readOnly className="mono" value={issued.token} aria-label="Access code" />
            <p className="notice">Hand this to the candidate. It grants this one attempt, and is not shown again.</p>
          </div>
          <div className="dialog-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(issued.token).then(() => setCopied(true));
              }}
            >
              <Copy aria-hidden="true" />
              {copied ? "Copied" : "Copy code"}
            </button>
            <button type="button" onClick={onClose}>
              Done
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
