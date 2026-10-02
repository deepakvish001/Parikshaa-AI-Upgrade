import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Calculator, Download, Plus, X } from "lucide-react";
import { ConsoleError, type ConsoleClient, type InternalMarksRequest } from "../api.ts";

/**
 * Internal marks (docs/PREP-TRACKER.md, CL65): this exam with the course's
 * other tests, each scaled to the marks it is worth, the best of them if the
 * scheme says so, rounded as the university asks — and the sheet to upload
 * to its portal (roll number, name, each component, total; AB for absent).
 */

const failure = (error: unknown) => (error instanceof ConsoleError && error.detail !== undefined ? error.detail : "That did not go through. Try again.");

function save(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function InternalMarks({ client, examId }: { client: ConsoleClient; examId: string }) {
  const exams = useQuery({ queryKey: ["exams"], queryFn: () => client.listExams() });
  const [parts, setParts] = useState<{ examId: string; label: string; marks: string }[]>([{ examId, label: "", marks: "10" }]);
  const [best, setBest] = useState("");
  const [rounding, setRounding] = useState<InternalMarksRequest["rounding"]>("up");
  const work = useMutation({
    mutationFn: () =>
      client.internalMarks({
        components: parts.map((p) => ({ examId: p.examId, marks: Number(p.marks), ...(p.label.trim() === "" ? {} : { label: p.label.trim() }) })),
        ...(best === "" ? {} : { best: Number(best) }),
        rounding,
      }),
  });
  const set = (i: number, patch: Partial<(typeof parts)[number]>) => setParts(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const others = (exams.data ?? []).filter((e) => !parts.some((p) => p.examId === e.id));
  const sheet = work.data;

  return (
    <section className="card" aria-label="Internal marks">
      <div className="bar">
        <Calculator aria-hidden="true" />
        <strong>Internal marks (CIA)</strong>
        <span className="notice">Put this exam together with the course's other tests, each scaled to its marks, for the university's sheet.</span>
      </div>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Exam</th>
              <th scope="col">Column name</th>
              <th scope="col">Marks</th>
              <th scope="col">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {parts.map((p, i) => (
              <tr key={p.examId}>
                <td>{exams.data?.find((e) => e.id === p.examId)?.title ?? p.examId}</td>
                <td>
                  <input aria-label={`Column name for component ${i + 1}`} value={p.label} placeholder="The exam's title" onChange={(e) => set(i, { label: e.target.value })} />
                </td>
                <td>
                  <input aria-label={`Marks for component ${i + 1}`} type="number" min={1} max={1000} value={p.marks} onChange={(e) => set(i, { marks: e.target.value })} />
                </td>
                <td>
                  {i === 0 ? null : (
                    <button type="button" className="quiet" aria-label={`Remove component ${i + 1}`} onClick={() => setParts(parts.filter((_, j) => j !== i))}>
                      <X aria-hidden="true" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row">
        {others.length === 0 ? null : (
          <label className="field">
            <span>
              <Plus aria-hidden="true" /> Add an exam
            </span>
            <select value="" onChange={(e) => e.target.value !== "" && setParts([...parts, { examId: e.target.value, label: "", marks: parts[0]?.marks ?? "10" }])}>
              <option value="">Choose…</option>
              {others.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </label>
        )}
        {parts.length < 2 ? null : (
          <label className="field">
            Count
            <select value={best} onChange={(e) => setBest(e.target.value)}>
              <option value="">All of them</option>
              {parts.slice(1).map((_, i) => (
                <option key={i} value={String(i + 1)}>
                  The best {i + 1}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          Rounding
          <select value={rounding} onChange={(e) => setRounding(e.target.value as InternalMarksRequest["rounding"])}>
            <option value="up">Up to a whole mark</option>
            <option value="nearest">To the nearest mark</option>
            <option value="none">Two decimals</option>
          </select>
        </label>
        <button type="button" disabled={work.isPending} onClick={() => work.mutate()}>
          Work out the marks
        </button>
      </div>
      {work.error === null ? null : (
        <p className="error" role="alert">
          {failure(work.error)}
        </p>
      )}
      {sheet === undefined ? null : (
        <>
          <div className="row">
            <span className="notice" role="status">
              {sheet.rows.length} students · out of {sheet.outOf}
              {sheet.best === null ? "" : ` (best ${sheet.best})`}
            </span>
            <button type="button" className="secondary" onClick={() => save(sheet.csv, "internal-marks.csv")}>
              <Download aria-hidden="true" />
              Download the sheet (CSV)
            </button>
          </div>
          <div className="scroll">
            <table aria-label="Internal marks">
              <thead>
                <tr>
                  <th scope="col">Roll number</th>
                  <th scope="col">Name</th>
                  {sheet.columns.map((c) => (
                    <th key={c.examId} scope="col">
                      {c.label} ({c.marks})
                    </th>
                  ))}
                  <th scope="col">Total ({sheet.outOf})</th>
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((r) => (
                  <tr key={r.ref}>
                    <td className="mono">{r.ref}</td>
                    <td>{r.name}</td>
                    {r.marks.map((m, i) => (
                      <td key={sheet.columns[i]!.examId}>{m === null ? "AB" : m}</td>
                    ))}
                    <td>
                      <strong>{r.total}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
