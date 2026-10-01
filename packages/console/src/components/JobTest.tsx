import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Wand2 } from "lucide-react";
import { Drawer, useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type ConsoleClient, type JobDraft, type Seniority } from "../api.ts";
import { Banner, SkeletonRows } from "./kit.tsx";

/**
 * A test from a job (docs/PREP-TRACKER.md, V2-12: CO6, CO7). Pick a role
 * from the library, or paste the job description; the draft is built from
 * the organisation's own question bank and says where the bank is short.
 * Creating it makes an ordinary exam, opened in the editor to change.
 */

const SENIORITY: Record<Seniority, string> = { fresher: "Fresher (0–1 years)", junior: "Junior (1–3 years)", mid: "Mid (3–6 years)", senior: "Senior (6+ years)" };

const failure = (error: unknown) =>
  error instanceof ConsoleError && error.status === 402
    ? "This month's AI spend cap is reached: choose a role instead, or raise the cap under Spend."
    : error instanceof ConsoleError && error.detail !== undefined
      ? error.detail
      : "That did not work. Try again.";

export function JobTestDrawer({ client, onClose, onCreated }: { client: ConsoleClient; onClose: () => void; onCreated: (examId: string) => void }) {
  const roles = useQuery({ queryKey: ["job-roles"], queryFn: () => client.jobRoles() });
  const [mode, setMode] = useState<"role" | "description">("role");
  const [roleId, setRoleId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [seniority, setSeniority] = useState<Seniority | "">("");
  const [draft, setDraft] = useState<JobDraft | null>(null);

  const ask = useMutation({
    mutationFn: () =>
      client.jobDraft({
        ...(mode === "description" ? { description } : {}),
        ...(roleId === "" ? {} : { roleId }),
        ...(seniority === "" ? {} : { seniority }),
      }),
    onSuccess: setDraft,
  });

  return (
    <Drawer label="New test from a job" onClose={onClose}>
      <h2 className="dialog-title">New test from a job</h2>
      {draft === null ? (
        <form
          className="job-test"
          onSubmit={(e) => {
            e.preventDefault();
            ask.mutate();
          }}
        >
          <div className="chips" role="radiogroup" aria-label="Start from">
            <button type="button" role="radio" className="chip" aria-checked={mode === "role"} aria-pressed={mode === "role"} onClick={() => setMode("role")}>
              A role
            </button>
            <button type="button" role="radio" className="chip" aria-checked={mode === "description"} aria-pressed={mode === "description"} onClick={() => setMode("description")}>
              A job description
            </button>
          </div>
          {mode === "description" ? (
            <div className="field">
              <label htmlFor="job-description">Paste the job description</label>
              <textarea id="job-description" rows={9} required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="We are hiring freshers for…" />
              <p className="notice">
                <Sparkles aria-hidden="true" className="inline-icon" /> The model reads which role it is, how senior, and the skills it asks for. It writes no questions: they come from your
                question bank. It counts toward this month's AI spend.
              </p>
            </div>
          ) : null}
          {roles.isPending ? (
            <SkeletonRows rows={4} columns={2} label="Loading roles…" />
          ) : (
            <fieldset className="role-list">
              <legend>{mode === "role" ? "Role" : "Role (optional: the model chooses otherwise)"}</legend>
              {(roles.data ?? []).map((r) => (
                <label key={r.id} className={`role-option${roleId === r.id ? " chosen" : ""}`}>
                  <input type="radio" name="job-role" value={r.id} checked={roleId === r.id} onChange={() => setRoleId(r.id)} />
                  <span>
                    <strong>{r.title}</strong>
                    <span className="notice">
                      {" "}
                      · {r.minutes} min · {r.sections.map((s) => `${s.count} ${s.title.toLowerCase()}`).join(", ")}
                    </span>
                    <span className="role-summary">{r.summary}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <div className="field">
            <label htmlFor="job-seniority">Experience</label>
            <select id="job-seniority" value={seniority} onChange={(e) => setSeniority(e.target.value as Seniority | "")}>
              <option value="">{mode === "description" ? "As the job says" : "Fresher"}</option>
              {(Object.keys(SENIORITY) as Seniority[]).map((s) => (
                <option key={s} value={s}>
                  {SENIORITY[s]}
                </option>
              ))}
            </select>
          </div>
          {ask.error === null ? null : (
            <p className="error" role="alert">
              {failure(ask.error)}
            </p>
          )}
          <div className="dialog-actions">
            <button type="button" className="quiet" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={ask.isPending || (mode === "role" ? roleId === "" : description.trim().length < 20)}>
              <Wand2 aria-hidden="true" />
              {ask.isPending ? "Drafting…" : "Draft the test"}
            </button>
          </div>
        </form>
      ) : (
        <DraftReview client={client} draft={draft} onBack={() => setDraft(null)} onCreated={onCreated} />
      )}
    </Drawer>
  );
}

function DraftReview({ client, draft, onBack, onCreated }: { client: ConsoleClient; draft: JobDraft; onBack: () => void; onCreated: (examId: string) => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState(draft.title);
  const [minutes, setMinutes] = useState(String(draft.durationMinutes));
  const [cutoff, setCutoff] = useState(String(draft.cutoffPercent));
  const [picks, setPicks] = useState<readonly string[]>(draft.sections.map((s) => String(s.pick)));
  // Typed freely; read as a whole number between 1 and the pool.
  const pickOf = (i: number) => Math.min(draft.sections[i]!.pool.length, Math.max(1, Math.round(Number(picks[i]) || 1)));
  const filled = draft.sections.map((s, i) => ({ ...s, pick: pickOf(i) })).filter((s) => s.pool.length > 0);
  const questions = filled.reduce((n, s) => n + s.pick, 0);
  const create = useMutation({
    mutationFn: () =>
      client.createJobTest({
        title,
        durationMinutes: Number(minutes),
        cutoffPercent: cutoff.trim() === "" ? null : Number(cutoff),
        sections: filled.map((s) => ({ title: s.title, questionIds: s.pool.map((q) => q.id), pick: Math.max(1, s.pick) })),
      }),
    onSuccess: ({ examId, questions: count }) => {
      toast(`Test made: ${count} questions per candidate`, "success");
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
      onCreated(examId);
    },
  });
  return (
    <form
      className="job-draft"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      {draft.source === "model" && draft.skills.length > 0 ? (
        <p className="notice">
          Read from the job: <strong>{SENIORITY[draft.seniority]}</strong> · {draft.skills.join(", ")}
        </p>
      ) : null}
      <div className="grid">
        <div className="field">
          <label htmlFor="draft-title">Title</label>
          <input id="draft-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="draft-minutes">Time (minutes)</label>
          <input id="draft-minutes" type="number" min={5} max={300} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="draft-cutoff">Qualifying mark (%)</label>
          <input id="draft-cutoff" type="number" min={0} max={100} value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
        </div>
      </div>
      <div className="scroll">
        <table className="draft-sections">
          <thead>
            <tr>
              <th scope="col">Section</th>
              <th scope="col" className="num">
                In the bank
              </th>
              <th scope="col" className="num">
                Each candidate gets
              </th>
            </tr>
          </thead>
          <tbody>
            {draft.sections.map((s, i) => (
              <tr key={s.id} className={s.pool.length === 0 ? "empty" : ""}>
                <td>
                  <strong>{s.title}</strong>
                  <div className="notice">{s.keywords.slice(0, 6).join(", ")}</div>
                </td>
                <td className="num">{s.pool.length}</td>
                <td className="num">
                  {s.pool.length === 0 ? (
                    <span className="notice">Left out</span>
                  ) : (
                    <input
                      type="number"
                      className="minutes-input"
                      min={1}
                      max={s.pool.length}
                      value={picks[i]}
                      aria-label={`Questions from ${s.title}`}
                      onChange={(e) => setPicks(picks.map((p, j) => (j === i ? e.target.value : p)))}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {draft.notes.length === 0 ? null : (
        <Banner tone="warning" title="Where your bank is short">
          <ul className="draft-notes">
            {draft.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Banner>
      )}
      {create.error === null ? null : (
        <p className="error" role="alert">
          {failure(create.error)}
        </p>
      )}
      <div className="dialog-actions">
        <button type="button" className="quiet" onClick={onBack}>
          Back
        </button>
        <button type="submit" disabled={create.isPending || filled.length === 0}>
          Make the test · {questions} questions
        </button>
      </div>
    </form>
  );
}
