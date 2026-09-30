import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type ConsoleClient, type RecheckRow } from "../api.ts";

const when = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

/**
 * Rechecks candidates asked for, on the Results tab (docs/PILOT.md, "After"):
 * each with the answer it is about and the mark as it stands, answered with a
 * mark and a reply. A different mark goes into the attempt's record, with who
 * changed it and why; the candidate is emailed. Nothing shows until someone asks.
 */
export function Rechecks({ client, examId, canAnswer }: { client: ConsoleClient; examId: string; canAnswer: boolean }) {
  const rechecks = useQuery({ queryKey: ["rechecks", examId], queryFn: () => client.rechecks(examId) });
  const rows = rechecks.data ?? [];
  if (rows.length === 0) return null;
  const open = rows.filter((r) => r.status === "open").length;
  return (
    <section className="card rechecks" aria-label="Rechecks asked for">
      <div className="bar">
        <h2 className="card-title">Rechecks asked for</h2>
        <span className="notice">{open === 0 ? "All answered" : `${open} to answer`}</span>
      </div>
      <ul className="recheck-list">
        {rows.map((r) => (
          <RecheckItem key={r.id} client={client} examId={examId} row={r} canAnswer={canAnswer} />
        ))}
      </ul>
    </section>
  );
}

function RecheckItem({ client, examId, row, canAnswer }: { client: ConsoleClient; examId: string; row: RecheckRow; canAnswer: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [score, setScore] = useState(String(row.score));
  const [reply, setReply] = useState("");
  const answer = useMutation({
    mutationFn: () => client.answerRecheck(row.id, Number(score), reply),
    onSuccess: (saved) => {
      toast(saved.status === "changed" ? `Mark changed for ${row.candidate.ref}; they have been told` : `Mark stands for ${row.candidate.ref}; they have been told`, "success");
      void queryClient.invalidateQueries({ queryKey: ["rechecks", examId] });
      void queryClient.invalidateQueries({ queryKey: ["results", examId] });
    },
  });
  const valid = score.trim() !== "" && Number(score) >= 0 && Number(score) <= row.question.max && reply.trim() !== "";
  return (
    <li className={`recheck-item ${row.status}`}>
      <div className="recheck-head">
        <strong>
          {row.candidate.ref} · {row.candidate.name}
        </strong>
        <span className="notice">
          Question {row.question.number} · {row.score} / {row.question.max} · asked {when(row.createdAt)}
        </span>
      </div>
      <p className="recheck-stem">{row.question.stem}</p>
      <blockquote className="recheck-reason">{row.reason}</blockquote>
      {row.answer === null ? null : (
        <details>
          <summary>Their answer</summary>
          <pre className="recheck-answer">{row.answer}</pre>
        </details>
      )}
      {row.status !== "open" ? (
        <p className="notice">
          {row.status === "changed" ? `Changed from ${row.scoreBefore} to ${row.scoreAfter}` : `Stands at ${row.scoreAfter}`} by {row.decidedBy}
          {row.decidedAt === null ? "" : `, ${when(row.decidedAt)}`}: “{row.reply}”
        </p>
      ) : canAnswer ? (
        <form
          className="recheck-answer-form"
          onSubmit={(e) => {
            e.preventDefault();
            answer.mutate();
          }}
        >
          <label className="inline">
            Mark{" "}
            <input
              type="number"
              min={0}
              max={row.question.max}
              step={0.25}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="minutes-input"
              aria-label={`Mark for question ${row.question.number}, out of ${row.question.max}`}
            />{" "}
            / {row.question.max}
          </label>
          <label>
            Reply to the candidate
            <textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="What you looked at, and why the mark stands or changes." />
          </label>
          {answer.error === null ? null : (
            <p className="error" role="alert">
              {answer.error instanceof ConsoleError && answer.error.detail !== undefined ? answer.error.detail : "That did not save. Try again."}
            </p>
          )}
          <div className="row">
            <button type="submit" disabled={!valid || answer.isPending}>
              {Number(score) === row.score ? "Keep the mark and reply" : "Change the mark and reply"}
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
