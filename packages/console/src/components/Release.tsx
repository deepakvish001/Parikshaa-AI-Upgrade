import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type ConsoleClient, type Results } from "../api.ts";

/**
 * Sending each graded candidate their result: who will get one, who will not
 * and why, said before anything goes. Nobody is sent theirs twice, so it is
 * safe to send again after more grading.
 */
export function ReleaseDialog({ client, examId, results, onClose }: { client: ConsoleClient; examId: string; results: Results; onClose: () => void }) {
  const toast = useToast();
  const cutoff = (results.exam.cutoff ?? null) !== null;
  const [outcome, setOutcome] = useState(cutoff);
  const graded = results.rows.filter((r) => r.state === "graded");
  const reachable = graded.filter((r) => r.email !== null).length;
  const waiting = results.rows.filter((r) => r.state === "submitted").length;
  const first = useRef<HTMLButtonElement>(null);
  const send = useMutation({
    mutationFn: () => client.releaseResults(examId, outcome && cutoff),
    onSuccess: ({ sent, alreadySent }) => {
      toast(
        sent === 0
          ? alreadySent > 0
            ? "Everyone graded has been sent their result already."
            : "Nobody to send a result to yet."
          : `Results on their way to ${sent === 1 ? "1 candidate" : `${sent} candidates`}${alreadySent > 0 ? `; ${alreadySent} had theirs already` : ""}.`,
        "success",
      );
      onClose();
    },
  });
  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  return (
    <Dialog label="Send results to candidates" onClose={onClose} initialFocus={first} dismissable={!send.isPending}>
      <h2 className="dialog-title">Send results to candidates</h2>
      <p>
        Each graded candidate with an email address is sent their marks{outcome && cutoff ? ", and whether they reached the qualifying mark" : ""}, with a
        link to their record. Nobody is sent theirs twice, so you can send again after grading more.
      </p>
      <ul className="release-counts">
        <li>
          <strong>{plural(reachable, "candidate")}</strong> graded, with an email address
        </li>
        {waiting > 0 ? <li>{plural(waiting, "attempt")} still to grade: not sent until graded</li> : null}
        {graded.length > reachable ? <li>{plural(graded.length - reachable, "graded candidate")} without an email address</li> : null}
      </ul>
      {cutoff ? (
        <label className="inline">
          <input type="checkbox" checked={outcome} onChange={(e) => setOutcome(e.target.checked)} /> Say whether each reached the qualifying mark
        </label>
      ) : null}
      {send.error === null ? null : (
        <p className="error" role="alert">
          {send.error instanceof ConsoleError && send.error.detail !== undefined ? send.error.detail : "That did not send. Try again."}
        </p>
      )}
      <div className="dialog-actions">
        <button type="button" className="quiet" onClick={onClose} disabled={send.isPending}>
          Cancel
        </button>
        <button ref={first} type="button" disabled={reachable === 0 || send.isPending} onClick={() => send.mutate()}>
          {reachable === 0 ? "Nobody to send to" : `Send to ${plural(reachable, "candidate")}`}
        </button>
      </div>
    </Dialog>
  );
}
