import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileImage, Scale, Sparkles, Upload } from "lucide-react";
import { Drawer, useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type AnswerScript, type ConsoleClient, type ScriptBook, type ScriptMarks } from "../api.ts";
import "./Copies.css";

/**
 * Handwritten copies (docs/PREP-TRACKER.md, V2-12: CL24–CL26). Scan each
 * candidate's copy in from a phone or scanner; the model reads it and
 * suggests marks with its reasons; the examiner's marks are the marks. A
 * second examiner moderates a sample, and a head examiner settles any copy
 * where the two are further apart than the tolerance.
 */

const STATUS = { uploaded: "Not checked", checked: "Checked", moderated: "Moderated", disputed: "Disputed" } as const;
const TONE = { uploaded: "muted", checked: "info", moderated: "good", disputed: "bad" } as const;

const failure = (error: unknown) => (error instanceof ConsoleError && error.detail !== undefined ? error.detail : "That did not go through. Try again.");

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** A photo as base64, made smaller first where the browser can: a phone photo is often several MB. */
async function asBase64(file: File): Promise<string> {
  let blob: Blob = file;
  if (typeof createImageBitmap === "function" && file.size > 1_500_000) {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
    } catch {
      blob = file;
    }
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function Copies({ client, examId, canSettle }: { client: ConsoleClient; examId: string; canSettle: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const book = useQuery({ queryKey: ["scripts", examId], queryFn: () => client.scripts(examId) });
  const [ref, setRef] = useState("");
  const [name, setName] = useState("");
  const [files, setFiles] = useState<readonly File[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [sampled, setSampled] = useState<ReadonlySet<string>>(new Set());
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["scripts", examId] });
  const upload = useMutation({
    mutationFn: async () => {
      for (const file of files) await client.addScriptPage(examId, { ref: ref.trim(), name: name.trim(), image: await asBase64(file) });
    },
    onSuccess: () => {
      toast(`${files.length} ${files.length === 1 ? "page" : "pages"} added to ${ref.trim()}'s copy`, "success");
      setRef("");
      setName("");
      setFiles([]);
      refresh();
    },
    onSettled: refresh,
  });
  const sample = useMutation({ mutationFn: () => client.sampleScripts(examId, 10), onSuccess: (ids) => setSampled(new Set(ids)) });
  const sheet = useMutation({ mutationFn: async () => save(await client.scriptsFile(examId), `${examId}-marks.csv`) });
  const data = book.data;
  const scripts = data?.scripts ?? [];
  const current = scripts.find((s) => s.id === open);

  return (
    <section className="card copies" aria-label="Handwritten copies">
      <div className="bar">
        <FileImage aria-hidden="true" />
        <strong>Handwritten copies</strong>
        <span className="notice">For a paper sat on paper: scan each copy in, let the model suggest marks, and check them. Only your marks count.</span>
      </div>
      <form
        className="row"
        aria-label="Add pages of a copy"
        onSubmit={(e) => {
          e.preventDefault();
          upload.mutate();
        }}
      >
        <input aria-label="Roll number" placeholder="Roll number" required value={ref} onChange={(e) => setRef(e.target.value)} />
        <input aria-label="Candidate's name" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        <input aria-label="Pages (photos or scans)" type="file" accept="image/*" capture="environment" multiple onChange={(e) => setFiles([...(e.target.files ?? [])])} />
        <button type="submit" disabled={ref.trim() === "" || files.length === 0 || upload.isPending}>
          <Upload aria-hidden="true" />
          {upload.isPending ? "Adding…" : "Add pages"}
        </button>
      </form>
      {upload.error === null ? null : (
        <p className="error" role="alert">
          {failure(upload.error)}
        </p>
      )}
      {scripts.length === 0 ? (
        <p className="notice">No copies yet. Photograph each page in order; a copy's pages can be added in several goes.</p>
      ) : (
        <>
          <div className="row">
            <button type="button" className="quiet" onClick={() => sheet.mutate()}>
              <Download aria-hidden="true" />
              Marks sheet (CSV)
            </button>
            <button type="button" className="quiet" disabled={!scripts.some((s) => s.status === "checked")} onClick={() => sample.mutate()}>
              <Scale aria-hidden="true" />
              Choose 10% for a second examiner
            </button>
            <span className="notice">
              {scripts.filter((s) => s.status !== "uploaded").length} of {scripts.length} checked · tolerance {data?.tolerancePercent}% of {data?.total} marks
            </span>
          </div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Roll number</th>
                  <th scope="col">Name</th>
                  <th scope="col" className="num">
                    Pages
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">
                    Marks
                  </th>
                  <th scope="col">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {scripts.map((s) => (
                  <tr key={s.id} className={sampled.has(s.id) ? "sampled" : undefined}>
                    <td className="mono">{s.candidateRef}</td>
                    <td>{s.candidateName}</td>
                    <td className="num">{s.pages}</td>
                    <td>
                      <span className={`badge ${TONE[s.status]}`}>{STATUS[s.status]}</span>
                      {sampled.has(s.id) ? <span className="badge info">For moderation</span> : null}
                    </td>
                    <td className="num">{s.status === "uploaded" ? "—" : `${s.finalTotal} / ${data?.total}`}</td>
                    <td>
                      <button type="button" className="quiet" onClick={() => setOpen(s.id)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {current === undefined || data === undefined ? null : <Copy client={client} book={data} script={current} canSettle={canSettle} onClose={() => setOpen(null)} onChange={refresh} />}
    </section>
  );
}

function Copy({ client, book, script, canSettle, onClose, onChange }: { client: ConsoleClient; book: ScriptBook; script: AnswerScript; canSettle: boolean; onClose: () => void; onChange: () => void }) {
  const toast = useToast();
  const [urls, setUrls] = useState<readonly string[]>([]);
  const suggested = new Map(script.suggestion?.questions.map((q) => [q.questionId, q]) ?? []);
  const moderating = script.status === "checked";
  // Not yet checked: the examiner's own marks, else the suggestion. A second examiner starts blank.
  const start = () =>
    Object.fromEntries(book.questions.map((q) => [q.id, moderating ? "" : String(script.marks?.[q.id]?.score ?? (script.status === "uploaded" ? suggested.get(q.id)?.score : undefined) ?? "")]));
  const [scores, setScores] = useState<Record<string, string>>(start);
  const [comments, setComments] = useState<Record<string, string>>(() => Object.fromEntries(book.questions.map((q) => [q.id, script.marks?.[q.id]?.comment ?? ""])));

  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    void (async () => {
      for (let n = 1; n <= script.pages; n++) {
        const blob = await client.scriptPage(script.id, n).catch(() => null);
        if (!alive || blob === null) continue;
        made.push(URL.createObjectURL(blob));
        setUrls([...made]);
      }
    })();
    return () => {
      alive = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [client, script.id, script.pages]);

  useEffect(() => setScores(start()), [script.suggestion?.at, script.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const marks = (): ScriptMarks => Object.fromEntries(book.questions.map((q) => [q.id, { score: Number(scores[q.id]), comment: comments[q.id] ?? "" }]));
  const done = (word: string) => () => {
    toast(word, "success");
    onChange();
  };
  const suggest = useMutation({ mutationFn: () => client.suggestScript(script.id), onSuccess: done("Marks suggested: check each one") });
  const check = useMutation({ mutationFn: () => client.checkScript(script.id, marks()), onSuccess: done("Marks saved") });
  const moderate = useMutation({ mutationFn: () => client.moderateScript(script.id, marks()), onSuccess: done("Second examiner's marks saved") });
  const settle = useMutation({ mutationFn: () => client.resolveScript(script.id, marks()), onSuccess: done("Copy settled") });
  const error = [suggest.error, check.error, moderate.error, settle.error].find((e) => e !== null);
  const editable = script.status === "uploaded" || moderating || (script.status === "disputed" && canSettle);
  const filled = book.questions.every((q) => scores[q.id] !== "" && scores[q.id] !== undefined);

  return (
    <Drawer label={`Copy of ${script.candidateRef}`} onClose={onClose}>
      <h2 className="dialog-title">
        {script.candidateRef} {script.candidateName === "" ? null : `— ${script.candidateName}`}
      </h2>
      <p className="notice">
        {STATUS[script.status]}
        {script.checkedBy === null ? null : ` · checked by ${script.checkedBy}`}
        {script.moderation === null ? null : ` · moderated by ${script.moderation.by} (gap ${script.moderation.gap})`}
        {script.moderation?.resolvedBy === undefined ? null : ` · settled by ${script.moderation.resolvedBy}`}
      </p>
      <div className="copy-pages" aria-label="Pages">
        {urls.map((u, i) => (
          <a key={u} href={u} target="_blank" rel="noreferrer">
            <img src={u} alt={`Page ${i + 1}`} />
          </a>
        ))}
      </div>
      {script.status === "uploaded" ? (
        <button type="button" className="secondary" disabled={suggest.isPending} onClick={() => suggest.mutate()}>
          <Sparkles aria-hidden="true" />
          {suggest.isPending ? "Reading the copy…" : script.suggestion === null ? "Suggest marks" : "Suggest again"}
        </button>
      ) : null}
      {moderating ? <p className="notice">As the second examiner, mark the copy afresh: the first examiner's marks are not shown until you save.</p> : null}
      <form
        aria-label="Marks"
        className="copy-marks"
        onSubmit={(e) => {
          e.preventDefault();
          (script.status === "uploaded" ? check : moderating ? moderate : settle).mutate();
        }}
      >
        {book.questions.map((q) => {
          const s = suggested.get(q.id);
          return (
            <fieldset key={q.id}>
              <legend>
                Q{q.number} <span className="notice">({q.maxScore} marks)</span> {q.stem.slice(0, 120)}
              </legend>
              {s === undefined || moderating ? null : (
                <p className="suggestion">
                  <Sparkles aria-hidden="true" className="inline-icon" /> Suggested {s.score}: {s.reason}
                  {s.transcript === "" ? null : <span className="transcript">Read: “{s.transcript}”</span>}
                </p>
              )}
              {script.status === "disputed" && script.moderation !== null ? (
                <p className="notice">
                  First examiner {script.marks?.[q.id]?.score ?? "—"} · second examiner {script.moderation.marks[q.id]?.score ?? "—"}
                </p>
              ) : null}
              <div className="row">
                <label className="inline">
                  Marks
                  <input type="number" min={0} max={q.maxScore} step={0.5} required readOnly={!editable} value={scores[q.id] ?? ""} onChange={(e) => setScores({ ...scores, [q.id]: e.target.value })} />
                </label>
                <input aria-label={`Comment on Q${q.number}`} placeholder="Comment (optional)" readOnly={!editable} value={comments[q.id] ?? ""} onChange={(e) => setComments({ ...comments, [q.id]: e.target.value })} />
              </div>
            </fieldset>
          );
        })}
        {error === undefined ? null : (
          <p className="error" role="alert">
            {failure(error)}
          </p>
        )}
        {script.status === "uploaded" ? (
          <button type="submit" disabled={!filled || check.isPending}>
            Save my marks
          </button>
        ) : moderating ? (
          <button type="submit" disabled={!filled || moderate.isPending}>
            Save as second examiner
          </button>
        ) : script.status === "disputed" && canSettle ? (
          <button type="submit" disabled={!filled || settle.isPending}>
            Settle with these marks
          </button>
        ) : null}
      </form>
    </Drawer>
  );
}
