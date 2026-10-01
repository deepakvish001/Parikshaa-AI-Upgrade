import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type ConsoleClient } from "../api.ts";

/**
 * Course outcomes (docs/PREP-TRACKER.md, V2-12 CL47): map each question to
 * the COs it assesses and each CO to the POs, and read attainment the way
 * NBA's SAR asks for it. Nothing here changes a mark.
 */

const POS = ["PO1", "PO2", "PO3", "PO4", "PO5", "PO6", "PO7", "PO8", "PO9", "PO10", "PO11", "PO12", "PSO1", "PSO2"];

export function Outcomes({ client, examId, canEdit }: { client: ConsoleClient; examId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const map = useQuery({ queryKey: ["outcomes", examId], queryFn: () => client.outcomes(examId) });
  const attainment = useQuery({ queryKey: ["attainment", examId], queryFn: () => client.attainment(examId) });
  const [open, setOpen] = useState(false);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>>>({});
  const [threshold, setThreshold] = useState("60");
  useEffect(() => {
    if (map.data === undefined) return;
    setCodes(Object.fromEntries(map.data.questions.map((q) => [q.id, (map.data.mapping[q.id] ?? []).join(", ")])));
    setMatrix(Object.fromEntries(Object.entries(map.data.matrix).map(([co, row]) => [co, { ...row }])));
    setThreshold(String(map.data.threshold));
  }, [map.data]);
  const cos = [...new Set(Object.values(codes).flatMap((v) => v.split(/[\s,]+/).map((c) => c.trim().toUpperCase()).filter((c) => c !== "")))].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const save = useMutation({
    mutationFn: () =>
      client.saveOutcomes(examId, {
        mapping: Object.fromEntries(Object.entries(codes).map(([id, v]) => [id, v.split(/[\s,]+/).filter((c) => c !== "")])),
        matrix: Object.fromEntries(cos.map((co) => [co, Object.fromEntries(Object.entries(matrix[co] ?? {}).filter(([, s]) => s > 0))])),
        threshold: Number(threshold),
      }),
    onSuccess: () => {
      toast("Outcomes saved", "success");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["outcomes", examId] });
      void queryClient.invalidateQueries({ queryKey: ["attainment", examId] });
    },
  });
  const data = attainment.data;
  const mapped = (data?.courseOutcomes.length ?? 0) > 0;

  return (
    <section className="card" aria-label="Course outcomes">
      <div className="bar">
        <Target aria-hidden="true" />
        <strong>Course outcomes (CO–PO)</strong>
        <span className="notice">{mapped ? `A CO is attained by earning ${data!.threshold}% of its marks; level 3 at 70% of candidates, 2 at 60%, 1 at 50%.` : "Map questions to course outcomes for an NBA/NAAC attainment report."}</span>
        <span className="spacer" />
        {canEdit ? (
          <button type="button" className="secondary" onClick={() => setOpen(!open)}>
            {open ? "Close" : mapped ? "Change the mapping" : "Map outcomes"}
          </button>
        ) : null}
      </div>
      {mapped && data !== undefined ? (
        <div className="scroll">
          <table aria-label="Attainment">
            <thead>
              <tr>
                <th scope="col">Outcome</th>
                <th scope="col" className="num">
                  Questions
                </th>
                <th scope="col" className="num">
                  Attained
                </th>
                <th scope="col" className="num">
                  Level
                </th>
              </tr>
            </thead>
            <tbody>
              {data.courseOutcomes.map((c) => (
                <tr key={c.co}>
                  <th scope="row">{c.co}</th>
                  <td className="num">{c.questions}</td>
                  <td className="num">
                    {c.attained} of {c.candidates} ({c.percent}%)
                  </td>
                  <td className="num">
                    <strong>{c.level}</strong>
                  </td>
                </tr>
              ))}
              {data.programmeOutcomes.map((p) => (
                <tr key={p.po}>
                  <th scope="row">{p.po}</th>
                  <td className="notice" colSpan={2}>
                    weighted by the CO–PO matrix
                  </td>
                  <td className="num">
                    <strong>{p.level.toFixed(2)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {open && map.data !== undefined ? (
        <form
          aria-label="Outcome mapping"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Q</th>
                  <th scope="col">Question</th>
                  <th scope="col">Course outcomes</th>
                </tr>
              </thead>
              <tbody>
                {map.data.questions.map((q) => (
                  <tr key={q.id}>
                    <td className="num">{q.number}</td>
                    <td>{q.stem}</td>
                    <td>
                      <input aria-label={`Course outcomes for question ${q.number}`} placeholder="CO1, CO2" value={codes[q.id] ?? ""} onChange={(e) => setCodes({ ...codes, [q.id]: e.target.value })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cos.length === 0 ? null : (
            <div className="scroll">
              <table aria-label="CO–PO matrix">
                <thead>
                  <tr>
                    <th scope="col">CO</th>
                    {POS.map((p) => (
                      <th key={p} scope="col" className="num">
                        {p}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cos.map((co) => (
                    <tr key={co}>
                      <th scope="row">{co}</th>
                      {POS.map((po) => (
                        <td key={po}>
                          <select
                            aria-label={`${co} to ${po}`}
                            value={matrix[co]?.[po] ?? 0}
                            onChange={(e) => setMatrix({ ...matrix, [co]: { ...(matrix[co] ?? {}), [po]: Number(e.target.value) } })}
                          >
                            <option value={0}>–</option>
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                          </select>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="row">
            <label className="inline">
              Attained at{" "}
              <input type="number" min={1} max={100} className="minutes-input" value={threshold} onChange={(e) => setThreshold(e.target.value)} aria-label="Threshold percent" />% of a CO's marks
            </label>
            <span className="spacer" />
            <button type="submit" disabled={save.isPending}>
              Save
            </button>
          </div>
          {save.error === null ? null : (
            <p className="error" role="alert">
              {save.error instanceof ConsoleError && save.error.detail !== undefined ? save.error.detail : "That did not save."}
            </p>
          )}
        </form>
      ) : null}
    </section>
  );
}
