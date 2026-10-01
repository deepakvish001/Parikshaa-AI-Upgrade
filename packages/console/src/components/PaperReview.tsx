import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type ConsoleClient, type ExamReview } from "../api.ts";

/**
 * A paper's review (docs/PREP-TRACKER.md, CL60): the setter sends it, someone
 * else approves it or returns it with a comment, and an approved paper is
 * locked until an owner reopens it.
 */

const STATUS: Record<ExamReview["status"], string> = { in_review: "With its reviewer", approved: "Approved · locked", returned: "Returned for changes", reopened: "Reopened for changes" };
const failure = (error: unknown) => (error instanceof ConsoleError && error.detail !== undefined ? error.detail : "That did not go through. Try again.");
const when = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

export function PaperReview({ client, examId, selfId, canWrite, canReopen }: { client: ConsoleClient; examId: string; selfId: string | null; canWrite: boolean; canReopen: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const review = useQuery({ queryKey: ["review", examId], queryFn: () => client.examReview(examId) });
  const [text, setText] = useState("");
  const done = (word: string) => () => {
    setText("");
    toast(word, "success");
    void queryClient.invalidateQueries({ queryKey: ["review", examId] });
  };
  const send = useMutation({ mutationFn: () => client.sendForReview(examId, text), onSuccess: done("Sent for review: the paper is locked until it is decided") });
  const decide = useMutation({ mutationFn: (decision: "approve" | "return") => client.decideReview(examId, decision, text), onSuccess: done("Decision saved") });
  const reopen = useMutation({ mutationFn: () => client.reopenReview(examId, text), onSuccess: done("Reopened for changes") });
  const error = [send.error, decide.error, reopen.error].find((e) => e !== null);
  if (review.data === undefined) return null;
  const r = review.data;
  const mine = r !== null && r.submittedById === selfId;
  const waiting = r?.status === "in_review";
  const locked = waiting || r?.status === "approved";

  return (
    <section className="card" aria-label="Paper review">
      <div className="bar">
        <ShieldCheck aria-hidden="true" />
        <strong>Paper review</strong>
        <span className="notice">
          {r === null
            ? "Send the paper to your head of department to approve. It is locked while they look, and once approved."
            : `${STATUS[r.status]} · sent by ${r.submittedBy} ${when(r.submittedAt)}${r.reviewer === null ? "" : ` · ${r.reviewer}`}`}
        </span>
      </div>
      {r === null || r.note === "" ? null : <p className="notice">Setter's note: {r.note}</p>}
      {r === null || r.comment === "" ? null : <p>Comment: {r.comment}</p>}
      {canWrite || canReopen ? (
        <div className="row">
          <input aria-label={waiting ? "Comment" : locked ? "Reason to reopen" : "Note for the reviewer"} placeholder={waiting ? "Comment (needed to return)" : locked ? "Why reopen it" : "Note for the reviewer (optional)"} value={text} onChange={(e) => setText(e.target.value)} />
          {!locked && canWrite ? (
            <button type="button" disabled={send.isPending} onClick={() => send.mutate()}>
              Send for review
            </button>
          ) : null}
          {waiting && canWrite && !mine ? (
            <>
              <button type="button" disabled={decide.isPending} onClick={() => decide.mutate("approve")}>
                Approve and lock
              </button>
              <button type="button" className="secondary" disabled={decide.isPending || text.trim() === ""} onClick={() => decide.mutate("return")}>
                Return with comment
              </button>
            </>
          ) : null}
          {waiting && mine ? <span className="notice">Someone else reviews your paper.</span> : null}
          {locked && canReopen ? (
            <button type="button" className="quiet" disabled={reopen.isPending || text.trim().length < 5} onClick={() => reopen.mutate()}>
              Reopen for changes
            </button>
          ) : null}
        </div>
      ) : null}
      {error === undefined ? null : (
        <p className="error" role="alert">
          {failure(error)}
        </p>
      )}
    </section>
  );
}
