import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import { Drawer, useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type ConsoleClient, type MarkingItem } from "../api.ts";

/**
 * Marking by hand, from the Results tab: the written answers of an exam, one
 * after another and without names, each with the mark the model gave. Keep
 * it or change it; a change goes into the candidate's record with who made
 * it. Enter saves and moves on; J and K move without saving.
 */
export function Marking({ client, examId }: { client: ConsoleClient; examId: string }) {
  const queue = useQuery({ queryKey: ["marking", examId], queryFn: () => client.marking(examId) });
  const [open, setOpen] = useState(false);
  const questions = queue.data?.questions.filter((q) => q.answers > 0) ?? [];
  if (questions.length === 0) return null;
  const answers = questions.reduce((n, q) => n + q.answers, 0);
  const read = questions.reduce((n, q) => n + q.reviewed, 0);
  return (
    <section className="card marking-card" aria-label="Written answers">
      <div className="bar">
        <PenLine aria-hidden="true" />
        <strong>Written answers</strong>
        <span className="notice">
          {read} of {answers} read by a person
        </span>
        <span className="spacer" />
        <button type="button" onClick={() => setOpen(true)}>
          {read === 0 ? "Start marking" : read === answers ? "Read them again" : "Carry on marking"}
        </button>
      </div>
      <p className="notice">
        The model marked these. Read each one, without the candidate's name, and keep the mark or change it.
        {questions.some((q) => q.takeHome === true) ? " Take-homes are not marked by the model: they count as 0 until you mark them." : ""}
      </p>
      {open && queue.data !== undefined ? <MarkingDrawer client={client} examId={examId} onClose={() => setOpen(false)} /> : null}
    </section>
  );
}

function MarkingDrawer({ client, examId, onClose }: { client: ConsoleClient; examId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const queue = useQuery({ queryKey: ["marking", examId], queryFn: () => client.marking(examId) });
  const questions = useMemo(() => queue.data?.questions.filter((q) => q.answers > 0) ?? [], [queue.data]);
  const [questionId, setQuestionId] = useState<string | null>(null);
  const current = questions.find((q) => q.id === questionId) ?? questions[0];
  // The order fixed when a question is opened, so saving one does not reshuffle the rest.
  const [order, setOrder] = useState<readonly MarkingItem[]>([]);
  const [at, setAt] = useState(0);
  const [score, setScore] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (current === undefined || queue.data === undefined) return;
    setOrder(queue.data.items.filter((i) => i.questionId === current.id));
    setAt(0);
    // Only when the question changes: a refetch after saving keeps the reader's place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, queue.data === undefined]);
  const item = order[at];
  useEffect(() => {
    if (item !== undefined) setScore(String(item.score));
    input.current?.focus();
  }, [item]);

  const save = useMutation({
    mutationFn: (value: number) => client.markAnswer(examId, item!.attemptId, item!.questionId, value),
    onSuccess: (saved) => {
      setOrder((o) => o.map((x, i) => (i === at ? { ...x, score: saved.score, reviewed: true } : x)));
      if (saved.changed) toast(`Mark changed to ${saved.score}`, "success");
      void queryClient.invalidateQueries({ queryKey: ["marking", examId] });
      void queryClient.invalidateQueries({ queryKey: ["results", examId] });
      setAt((n) => Math.min(n + 1, order.length - 1));
    },
  });

  if (current === undefined) return null;
  const value = Number(score);
  const valid = score.trim() !== "" && value >= 0 && value <= current.max;
  const read = order.filter((i) => i.reviewed).length;
  const move = (step: number) => setAt((n) => Math.max(0, Math.min(order.length - 1, n + step)));

  return (
    <Drawer label="Marking written answers" onClose={onClose}>
      <div
        className="marking"
        onKeyDown={(e) => {
          if (e.target instanceof HTMLTextAreaElement) return;
          if (e.key === "j" || e.key === "J") move(1);
          else if (e.key === "k" || e.key === "K") move(-1);
          else return;
          e.preventDefault();
        }}
      >
        <h2 className="dialog-title">Marking written answers</h2>
        <label>
          Question{" "}
          <select value={current.id} onChange={(e) => setQuestionId(e.target.value)}>
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.number}. {q.stem.slice(0, 60)} — {q.reviewed} of {q.answers} read
              </option>
            ))}
          </select>
        </label>
        <div className="marking-question">
          <p>{current.stem}</p>
          {current.rubric.length + current.expectedPoints.length === 0 ? null : (
            <ul className="marking-rubric" aria-label="What the marking looks for">
              {[...current.rubric, ...current.expectedPoints].map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="marking-progress" role="progressbar" aria-label="Answers read" aria-valuemin={0} aria-valuemax={order.length} aria-valuenow={read}>
          <span style={{ width: `${order.length === 0 ? 0 : (read * 100) / order.length}%` }} />
        </div>
        {item === undefined ? (
          <p className="notice">No answers to this question.</p>
        ) : (
          <form
            className="marking-answer"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) save.mutate(value);
            }}
          >
            <div className="bar">
              <strong>
                Answer {at + 1} of {order.length}
              </strong>
              <span className="notice">{item.reviewed ? "Read" : "Not read yet"}</span>
            </div>
            {current.takeHome === true ? (
              <TakeHomeWork answer={item.answer} />
            ) : (
              <pre className={item.language === null ? "marking-text" : "marking-text code"}>{item.answer}</pre>
            )}
            <div className="marking-controls">
              <label className="inline">
                Mark{" "}
                <input
                  ref={input}
                  type="number"
                  min={0}
                  max={current.max}
                  step={0.25}
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  className="minutes-input"
                  aria-label={`Mark, out of ${current.max}`}
                />{" "}
                / {current.max}
              </label>
              <button type="submit" disabled={!valid || save.isPending}>
                {value === item.score ? "Keep the mark" : "Save the mark"}
              </button>
              <span className="spacer" />
              <button type="button" className="quiet" onClick={() => move(-1)} disabled={at === 0} aria-label="Previous answer">
                <ChevronLeft aria-hidden="true" />
              </button>
              <button type="button" className="quiet" onClick={() => move(1)} disabled={at >= order.length - 1} aria-label="Next answer">
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
            {save.error === null ? null : (
              <p className="error" role="alert">
                {save.error instanceof ConsoleError && save.error.detail !== undefined ? save.error.detail : "That did not save. Try again."}
              </p>
            )}
            <p className="notice">Enter keeps or saves the mark and moves on. J and K move without saving.</p>
          </form>
        )}
      </div>
    </Drawer>
  );
}

/** A take-home's stored answer, `{link, notes}` (core's takehome.ts), read here without pulling core into this chunk. */
function decodeTakeHomeAnswer(stored: string): { link: string; notes: string } | null {
  try {
    const parsed = JSON.parse(stored) as { link?: unknown; notes?: unknown };
    return typeof parsed.link === "string" ? { link: parsed.link, notes: typeof parsed.notes === "string" ? parsed.notes : "" } : null;
  } catch {
    return null;
  }
}

/** Only an https address becomes a link (as core's validTakeHomeLink). */
function validTakeHomeLink(link: string): boolean {
  try {
    const url = new URL(link);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch {
    return false;
  }
}

/** A take-home's answer: the link to open, and the candidate's notes. Scored 0 until marked here. */
function TakeHomeWork({ answer }: { answer: string }) {
  const work = decodeTakeHomeAnswer(answer);
  if (work === null) return <pre className="marking-text">{answer === "" ? "No work was submitted." : answer}</pre>;
  return (
    <div className="take-home-work">
      <p>
        {/* Checked when the candidate committed it; checked again before it becomes a link. */}
        {validTakeHomeLink(work.link) ? (
          <a href={work.link} target="_blank" rel="noreferrer noopener">
            {work.link}
          </a>
        ) : (
          <span className="mono">{work.link}</span>
        )}
      </p>
      <p className="notice">Open the work, and mark it against the rubric. Until you do, it counts as 0.</p>
      {work.notes.trim() === "" ? null : <pre className="marking-text">{work.notes}</pre>}
    </div>
  );
}
