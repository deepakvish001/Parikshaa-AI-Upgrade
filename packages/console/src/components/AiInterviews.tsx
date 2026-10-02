import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bot, Copy, Plus, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { Drawer, useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type AiInterviewDetail, type ConsoleClient, type Recommendation, type Seniority } from "../api.ts";
import { EmptyState } from "./kit.tsx";
import "./AiInterviews.css";

/**
 * The AI interviewer (docs/PREP-TRACKER.md plan row 86). Set one up for a role
 * from the library or a job description and send the candidate the link; the
 * model holds a first round by chat, never told who the candidate is. Here is
 * the whole transcript, whether its hash chain holds, the model's reading with
 * the candidate's own words as evidence, and the decision, which a person makes.
 */

const RECOMMENDATIONS: readonly [Recommendation, string][] = [
  ["strong_yes", "Strong yes"],
  ["yes", "Yes"],
  ["no", "No"],
  ["strong_no", "Strong no"],
];
const CRITERIA = ["Problem solving", "Technical knowledge", "Code quality", "Communication"];
const STATUS = { invited: "Invited", in_progress: "In progress", done: "Finished", cancelled: "Cancelled" } as const;
const SENIORITY: readonly [Seniority, string][] = [
  ["fresher", "Fresher (0–1 years)"],
  ["junior", "Junior (1–3 years)"],
  ["mid", "Mid (3–6 years)"],
  ["senior", "Senior (6+ years)"],
];

const when = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
const failure = (error: unknown) => (error instanceof ConsoleError && error.detail !== undefined ? error.detail : "That did not go through. Try again.");

export function AiInterviewsPanel({ client, canWrite }: { client: ConsoleClient; canWrite: boolean }) {
  const list = useQuery({ queryKey: ["ai-interviews"], queryFn: () => client.aiInterviews() });
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  if (open !== null) return <Transcript client={client} id={open} canWrite={canWrite} onBack={() => setOpen(null)} />;
  const rows = list.data ?? [];

  return (
    <section className="card" aria-label="AI interviews">
      <div className="bar">
        <Bot aria-hidden="true" />
        <strong>AI interviews</strong>
        <span className="notice">A first round by chat, held by the AI for a role. You read the transcript and decide.</span>
        {canWrite ? (
          <button type="button" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            Set up an AI interview
          </button>
        ) : null}
      </div>
      {list.isPending ? <p className="notice">Loading…</p> : null}
      {list.isSuccess && rows.length === 0 ? (
        <EmptyState icon={Bot} {...(canWrite ? { action: { label: "Set up an AI interview", onClick: () => setCreating(true), icon: Plus } } : {})}>
          No AI interviews yet. Set one up and send the candidate the link it gives you.
        </EmptyState>
      ) : null}
      {rows.length === 0 ? null : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Set up</th>
                <th scope="col">Candidate</th>
                <th scope="col">Interview</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td>{when(i.createdAt)}</td>
                  <td>
                    {i.candidateName}
                    {i.candidateRef === "" ? null : <div className="notice mono">{i.candidateRef}</div>}
                  </td>
                  <td>{i.title}</td>
                  <td>
                    <span className={`pill ${i.status === "done" ? "ok" : i.status === "cancelled" ? "" : "info"}`} data-state={i.status}>{STATUS[i.status]}</span>
                    {i.scorecard === null ? null : <div className="notice">{RECOMMENDATIONS.find(([r]) => r === i.scorecard?.recommendation)?.[1]}</div>}
                  </td>
                  <td>
                    <button type="button" className="quiet" onClick={() => setOpen(i.id)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating ? <SetUp client={client} onClose={() => setCreating(false)} onMade={(id) => setOpen(id)} /> : null}
    </section>
  );
}

function SetUp({ client, onClose, onMade }: { client: ConsoleClient; onClose: () => void; onMade: (id: string) => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const roles = useQuery({ queryKey: ["job-roles"], queryFn: () => client.jobRoles() });
  const [form, setForm] = useState({ title: "", roleId: "", job: "", seniority: "junior" as Seniority, questions: "4", minutes: "30", candidateName: "", candidateRef: "", candidateEmail: "", resume: "" });
  const families = useMemo(() => {
    const by = new Map<string, { id: string; title: string }[]>();
    for (const r of roles.data ?? []) by.set(r.family, [...(by.get(r.family) ?? []), { id: r.id, title: r.title }]);
    return [...by];
  }, [roles.data]);
  const make = useMutation({
    mutationFn: () =>
      client.createAiInterview({
        title: form.title,
        roleId: form.roleId === "" ? null : form.roleId,
        job: form.job,
        seniority: form.seniority,
        questions: Number(form.questions) || 4,
        minutes: Number(form.minutes) || 30,
        candidateName: form.candidateName,
        candidateRef: form.candidateRef,
        candidateEmail: form.candidateEmail.trim() === "" ? null : form.candidateEmail.trim(),
        resume: form.resume.trim() === "" ? null : form.resume,
      }),
    onSuccess: async (made) => {
      void queryClient.invalidateQueries({ queryKey: ["ai-interviews"] });
      await navigator.clipboard?.writeText(made.link).catch(() => undefined);
      toast(made.candidateEmail === null ? "Set up. The candidate's link is copied" : "Set up. The link is emailed to the candidate, and copied", "success");
      onClose();
      onMade(made.id);
    },
  });
  const field = (key: "title" | "candidateName" | "candidateRef" | "candidateEmail" | "questions" | "minutes", label: string, type = "text", required = false, extra: object = {}) => (
    <label className="field">
      {label}
      <input type={type} required={required} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...extra} />
    </label>
  );
  return (
    <Drawer label="Set up an AI interview" onClose={onClose}>
      <h2 className="dialog-title">Set up an AI interview</h2>
      <form
        aria-label="AI interview details"
        onSubmit={(e) => {
          e.preventDefault();
          make.mutate();
        }}
      >
        {field("title", "Interview", "text", true)}
        <label className="field">
          Role
          <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
            <option value="">None: use the job description</option>
            {families.map(([family, list]) => (
              <optgroup key={family} label={family}>
                {list.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="field">
          Job description {form.roleId === "" ? "" : "(optional, adds to the role)"}
          <textarea rows={5} required={form.roleId === ""} maxLength={20000} value={form.job} onChange={(e) => setForm({ ...form, job: e.target.value })} />
        </label>
        <label className="field">
          Level
          <select value={form.seniority} onChange={(e) => setForm({ ...form, seniority: e.target.value as Seniority })}>
            {SENIORITY.map(([s, label]) => (
              <option key={s} value={s}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {field("questions", "Questions (each with one follow-up)", "number", true, { min: 2, max: 8 })}
        {field("minutes", "Minutes at most", "number", true, { min: 10, max: 90 })}
        {field("candidateName", "Candidate's name", "text", true)}
        {field("candidateRef", "Roll number or reference")}
        {field("candidateEmail", "Candidate's email (the link is emailed to it)", "email")}
        <label className="field">
          Resume (optional: paste its text, for questions from their own work)
          <textarea rows={5} maxLength={20000} value={form.resume} onChange={(e) => setForm({ ...form, resume: e.target.value })} />
        </label>
        <p className="notice">The AI is told the role, the level, the job description and the resume with the name, email, phone and links taken out; never the candidate's name, email or reference.</p>
        {make.error === null ? null : (
          <p className="error" role="alert">
            {failure(make.error)}
          </p>
        )}
        <button type="submit" disabled={make.isPending}>
          Set up and copy the link
        </button>
      </form>
    </Drawer>
  );
}

function Transcript({ client, id, canWrite, onBack }: { client: ConsoleClient; id: string; canWrite: boolean; onBack: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  // While it is on, the transcript grows: read it again every few seconds.
  const interview = useQuery({ queryKey: ["ai-interview", id], queryFn: () => client.aiInterview(id), refetchInterval: (q) => (q.state.data?.status === "in_progress" ? 5000 : false) });
  const [scores, setScores] = useState<Record<string, number>>({});
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [summary, setSummary] = useState("");
  const saved = (u: AiInterviewDetail) => {
    queryClient.setQueryData(["ai-interview", id], u);
    void queryClient.invalidateQueries({ queryKey: ["ai-interviews"] });
  };
  const decide = useMutation({
    mutationFn: () => client.decideAiInterview(id, { criteria: Object.entries(scores).map(([name, score]) => ({ name, score })), recommendation: recommendation!, summary }),
    onSuccess: (u) => (saved(u), toast("Decision saved", "success")),
  });
  const reassess = useMutation({ mutationFn: () => client.reassessAiInterview(id), onSuccess: (u) => (saved(u), toast(u.assessment === null ? "The reading did not come: try again later" : "Read again", u.assessment === null ? "error" : "success")) });
  const cancel = useMutation({ mutationFn: () => client.cancelAiInterview(id), onSuccess: (u) => (saved(u), toast("Cancelled: the link no longer works", "success")) });
  const i = interview.data;
  if (i === undefined) return <p className="notice">Opening the interview…</p>;
  const live = i.status === "invited" || i.status === "in_progress";

  return (
    <section className="card ai-transcript" aria-label={`AI interview: ${i.title}`}>
      <div className="bar">
        <button type="button" className="quiet" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          All AI interviews
        </button>
        <strong>
          {i.title} — {i.candidateName}
        </strong>
        <span className="notice">
          {i.questions} questions · {i.minutes} min · {STATUS[i.status]}
          {i.startedAt === null ? null : ` · started ${when(i.startedAt)}`}
        </span>
      </div>
      <div className="row">
        <button
          type="button"
          className="quiet"
          onClick={async () => {
            await navigator.clipboard?.writeText(i.link).catch(() => undefined);
            toast("Candidate's link copied", "success");
          }}
        >
          <Copy aria-hidden="true" />
          Copy the candidate's link
        </button>
        {live && canWrite ? (
          <button type="button" className="quiet danger" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
            Cancel the interview
          </button>
        ) : null}
        {i.turns.length === 0 ? null : i.transcriptIntact ? (
          <span className="pill ok">
            <ShieldCheck aria-hidden="true" /> Transcript unchanged
          </span>
        ) : (
          <span className="pill bad" role="alert">
            <ShieldAlert aria-hidden="true" /> The transcript was changed after it was written
          </span>
        )}
      </div>
      <div className="ai-grid">
        <section aria-label="Transcript">
          {i.resume === null ? null : (
            <details className="resume">
              <summary>The resume the questions drew on</summary>
              <p className="pre-line">{i.resume}</p>
            </details>
          )}
          <h3>Transcript</h3>
          {i.turns.length === 0 ? <p className="notice">The candidate has not started yet.</p> : null}
          <ol className="ai-turns">
            {i.turns.map((t) => (
              <li key={t.seq} className={t.speaker === "interviewer" ? "from-ai" : "from-candidate"}>
                <span className="notice">
                  {t.speaker === "interviewer" ? (t.kind === "follow_up" ? "AI · follow-up" : t.kind === "closing" ? "AI · end" : "AI · question") : "Candidate"} · {new Date(t.at).toLocaleTimeString("en-IN")}
                </span>
                <p>{t.body}</p>
                {t.code === null ? null : (
                  <pre aria-label={`Candidate's code (${t.language ?? "text"})`}>
                    <code>{t.code}</code>
                  </pre>
                )}
              </li>
            ))}
          </ol>
        </section>
        <div>
          {i.status === "done" ? (
            <section aria-label="The AI's reading" className="reading">
              <h3>The AI's reading</h3>
              <p className="notice">A suggestion with the candidate's own words as evidence. Check it against the transcript: you decide.</p>
              {i.assessment === null ? (
                <>
                  <p className="notice">No reading yet: the model may have been busy, or the spend cap reached.</p>
                  <button type="button" className="quiet" disabled={reassess.isPending} onClick={() => reassess.mutate()}>
                    <RefreshCw aria-hidden="true" />
                    Read it again
                  </button>
                </>
              ) : (
                <>
                  <ul>
                    {i.assessment.criteria.map((c) => (
                      <li key={c.name}>
                        {c.name}: <strong>{c.score === 0 ? "no evidence" : `${c.score} / 5`}</strong>
                        {c.evidence.length === 0 ? null : (
                          <ul className="evidence">
                            {c.evidence.map((e) => (
                              <li key={e}>“{e}”</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="pre-line">{i.assessment.summary}</p>
                  {i.assessment.concerns.length === 0 ? null : (
                    <>
                      <h4>To look at</h4>
                      <ul>
                        {i.assessment.concerns.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </section>
          ) : null}
          {i.scorecard !== null ? (
            <section aria-label="Decision" className="scorecard">
              <h3>Decision — {RECOMMENDATIONS.find(([r]) => r === i.scorecard?.recommendation)?.[1]}</h3>
              <ul>
                {i.scorecard.criteria.map((c) => (
                  <li key={c.name}>
                    {c.name}: <strong>{c.score}</strong> / 5
                  </li>
                ))}
              </ul>
              {i.scorecard.summary === "" ? null : <p className="pre-line">{i.scorecard.summary}</p>}
              <p className="notice">
                By {i.decidedBy}
                {i.decidedAt === null ? null : `, ${when(i.decidedAt)}`}
              </p>
            </section>
          ) : i.status === "done" ? (
            <form
              aria-label="Decision"
              className="scorecard"
              onSubmit={(e) => {
                e.preventDefault();
                decide.mutate();
              }}
            >
              <h3>Your decision</h3>
              {CRITERIA.map((c) => (
                <div key={c} role="group" aria-label={c} className="row">
                  <span className="criterion">{c}</span>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" className="chip" aria-pressed={scores[c] === n} onClick={() => setScores({ ...scores, [c]: n })}>
                      {n}
                    </button>
                  ))}
                </div>
              ))}
              <div role="group" aria-label="Recommendation" className="row">
                {RECOMMENDATIONS.map(([r, label]) => (
                  <button key={r} type="button" className="chip" aria-pressed={recommendation === r} onClick={() => setRecommendation(r)}>
                    {label}
                  </button>
                ))}
              </div>
              <label className="field">
                Summary
                <textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
              </label>
              {decide.error === null ? null : (
                <p className="error" role="alert">
                  {failure(decide.error)}
                </p>
              )}
              <button type="submit" disabled={recommendation === null || Object.keys(scores).length === 0 || decide.isPending}>
                Save the decision
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </section>
  );
}
