import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Accessibility } from "lucide-react";
import { useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type ConsoleClient } from "../api.ts";

/**
 * Arrangements for candidates with a disability (docs/PREP-TRACKER.md, CL62):
 * compensatory time (20 minutes an hour is a third), a scribe, larger text.
 * The time is added to the attempt's record as it starts, with your name; the
 * note is for staff, kept sealed, and never shown to the candidate.
 */

const failure = (error: unknown) => (error instanceof ConsoleError && error.detail !== undefined ? error.detail : "That did not go through. Try again.");
const EMPTY = { ref: "", extraPercent: "33", scribe: false, largeText: false, note: "" };

export function Arrangements({ client, examId }: { client: ConsoleClient; examId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const list = useQuery({ queryKey: ["arrangements", examId], queryFn: () => client.arrangements(examId), retry: false });
  const [form, setForm] = useState(EMPTY);
  const done = (word: string) => () => {
    toast(word, "success");
    void queryClient.invalidateQueries({ queryKey: ["arrangements", examId] });
  };
  const save = useMutation({
    mutationFn: () => client.setArrangement(examId, form.ref.trim(), { extraPercent: Number(form.extraPercent) || 0, scribe: form.scribe, largeText: form.largeText, note: form.note }),
    onSuccess: () => (setForm(EMPTY), done("Arrangements saved; they apply when the candidate starts")()),
  });
  const remove = useMutation({ mutationFn: (ref: string) => client.removeArrangement(examId, ref), onSuccess: done("Arrangements removed") });
  const error = save.error ?? remove.error;
  const rows = list.data ?? [];

  return (
    <section className="card" aria-label="Arrangements for a disability">
      <div className="bar">
        <Accessibility aria-hidden="true" />
        <strong>Arrangements for a disability</strong>
        <span className="notice">Extra time is added to the attempt as it starts, with your name on the record. Set it before the candidate begins; for one already writing, extend their time instead.</span>
      </div>
      {rows.length === 0 ? null : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Roll number</th>
                <th scope="col">Arranged</th>
                <th scope="col">Note (staff only)</th>
                <th scope="col">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.candidateRef}>
                  <td className="mono">{a.candidateRef}</td>
                  <td>{[a.extraPercent > 0 ? `${a.extraPercent}% extra time` : "", a.scribe ? "scribe" : "", a.largeText ? "larger text" : ""].filter(Boolean).join(" · ")}</td>
                  <td>{a.note}</td>
                  <td>
                    <button type="button" className="quiet" disabled={remove.isPending} onClick={() => remove.mutate(a.candidateRef)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form
        aria-label="Arrange for a candidate"
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label className="field">
          Roll number
          <input required value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} />
        </label>
        <label className="field">
          Extra time (% of the paper's)
          <input type="number" min={0} max={100} value={form.extraPercent} onChange={(e) => setForm({ ...form, extraPercent: e.target.value })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={form.scribe} onChange={(e) => setForm({ ...form, scribe: e.target.checked })} /> A scribe
        </label>
        <label className="check">
          <input type="checkbox" checked={form.largeText} onChange={(e) => setForm({ ...form, largeText: e.target.checked })} /> Larger text
        </label>
        <label className="field">
          Note (staff only)
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Certificate number, what the invigilator should know" />
        </label>
        <button type="submit" disabled={save.isPending || form.ref.trim() === ""}>
          Save
        </button>
      </form>
      {error === null ? null : (
        <p className="error" role="alert">
          {failure(error)}
        </p>
      )}
    </section>
  );
}
