import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
  // What sending would do, from the server: it knows who has been sent theirs and which ways are set up.
  const preview = useQuery({ queryKey: ["release-preview", examId], queryFn: () => client.releaseResults(examId, false, true), retry: false });
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
  const counts = preview.data;
  const ways = counts === undefined ? "" : counts.channels.map((c) => (c === "email" ? "email" : "WhatsApp")).join(" and ");
  const failure = send.error ?? preview.error;
  return (
    <Dialog label="Send results to candidates" onClose={onClose} initialFocus={first} dismissable={!send.isPending}>
      <h2 className="dialog-title">Send results to candidates</h2>
      <p>
        Each graded candidate is sent their marks{outcome && cutoff ? " and whether they reached the qualifying mark" : ""}, with a link to their record
        {ways === "" ? "" : `, by ${ways}`}. Nobody is sent theirs twice, so you can send again after grading more.
      </p>
      {counts === undefined ? (
        preview.isPending ? <p className="notice">Counting who it would reach…</p> : null
      ) : (
        <ul className="release-counts">
          <li>
            <strong>{plural(counts.sent, "candidate")}</strong> to send to
          </li>
          {counts.alreadySent > 0 ? <li>{plural(counts.alreadySent, "candidate")} sent theirs already: not sent again</li> : null}
          {counts.notGraded > 0 ? <li>{plural(counts.notGraded, "attempt")} still to grade: not sent until graded</li> : null}
          {counts.unreachable > 0 ? (
            <li>
              {plural(counts.unreachable, "graded candidate")} with no {counts.channels.includes("whatsapp") ? "email address or mobile number" : "email address"}
            </li>
          ) : null}
        </ul>
      )}
      {cutoff ? (
        <label className="inline">
          <input type="checkbox" checked={outcome} onChange={(e) => setOutcome(e.target.checked)} /> Say whether each reached the qualifying mark
        </label>
      ) : null}
      {failure === null ? null : (
        <p className="error" role="alert">
          {failure instanceof ConsoleError && failure.detail !== undefined ? failure.detail : "That did not send. Try again."}
        </p>
      )}
      <div className="dialog-actions">
        <button type="button" className="quiet" onClick={onClose} disabled={send.isPending}>
          Cancel
        </button>
        <button ref={first} type="button" disabled={counts === undefined || counts.sent === 0 || send.isPending} onClick={() => send.mutate()}>
          {counts === undefined || counts.sent > 0 ? `Send to ${plural(counts?.sent ?? 0, "candidate")}` : "Nobody to send to"}
        </button>
      </div>
    </Dialog>
  );
}
