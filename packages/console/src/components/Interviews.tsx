import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Plus, Video } from "lucide-react";
import { Drawer, useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type ConsoleClient, type Interview, type Recommendation } from "../api.ts";
import { EmptyState } from "./kit.tsx";
import "./Interviews.css";

/**
 * The interview room (docs/PREP-TRACKER.md, V2-12 CO26–CO28). Schedule an
 * interview and send the candidate their link; in the room, the video call
 * opens in its own tab while the candidate's code shows here as they type,
 * beside the problem (which can be changed mid-way), your notes, and the
 * scorecard that closes it.
 */

const LANGUAGES = ["python", "javascript", "java", "cpp", "c", "sql", "text"] as const;
const CRITERIA = ["Problem solving", "Code quality", "Communication", "Fundamentals"];
const RECOMMENDATIONS: readonly [Recommendation, string][] = [
  ["strong_yes", "Strong yes"],
  ["yes", "Yes"],
  ["no", "No"],
  ["strong_no", "Strong no"],
];
const STATUS = { scheduled: "Scheduled", done: "Scored", cancelled: "Cancelled" } as const;

const when = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
const failure = (error: unknown) => (error instanceof ConsoleError && error.detail !== undefined ? error.detail : "That did not go through. Try again.");

export function InterviewsPanel({ client }: { client: ConsoleClient }) {
  const list = useQuery({ queryKey: ["interviews"], queryFn: () => client.interviews() });
  const [scheduling, setScheduling] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  if (open !== null) return <Room client={client} id={open} onBack={() => setOpen(null)} />;
  const rows = list.data ?? [];

  return (
    <section className="card" aria-label="Interviews">
      <div className="bar">
        <Video aria-hidden="true" />
        <strong>Interviews</strong>
        <span className="notice">The candidate joins by a link: the video call, the problem, and a code editor you watch live.</span>
        <button type="button" onClick={() => setScheduling(true)}>
          <Plus aria-hidden="true" />
          Schedule an interview
        </button>
      </div>
      {list.isPending ? <p className="notice">Loading…</p> : null}
      {list.isSuccess && rows.length === 0 ? (
        <EmptyState icon={Video} action={{ label: "Schedule an interview", onClick: () => setScheduling(true), icon: Plus }}>
          No interviews yet. Schedule one, and send the candidate the link it gives you.
        </EmptyState>
      ) : null}
      {rows.length === 0 ? null : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Candidate</th>
                <th scope="col">Interview</th>
                <th scope="col">Interviewer</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td>{when(i.scheduledAt)}</td>
                  <td>
                    {i.candidateName}
                    {i.candidateRef === "" ? null : <div className="notice mono">{i.candidateRef}</div>}
                  </td>
                  <td>{i.title}</td>
                  <td>{i.interviewer}</td>
                  <td>
                    <span className={`badge ${i.status === "done" ? "good" : i.status === "cancelled" ? "muted" : "info"}`}>{STATUS[i.status]}</span>
                    {i.scorecard === null ? null : <div className="notice">{RECOMMENDATIONS.find(([r]) => r === i.scorecard?.recommendation)?.[1]}</div>}
                  </td>
                  <td>
                    <button type="button" className="quiet" onClick={() => setOpen(i.id)}>
                      Open the room
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {scheduling ? <Schedule client={client} onClose={() => setScheduling(false)} onMade={(id) => setOpen(id)} /> : null}
    </section>
  );
}

function Schedule({ client, onClose, onMade }: { client: ConsoleClient; onClose: () => void; onMade: (id: string) => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ title: "", candidateName: "", candidateRef: "", candidateEmail: "", at: "", minutes: "45", meetingUrl: "", problem: "", language: "python" });
  const make = useMutation({
    mutationFn: () =>
      client.scheduleInterview({
        title: form.title,
        candidateName: form.candidateName,
        candidateRef: form.candidateRef,
        candidateEmail: form.candidateEmail.trim() === "" ? null : form.candidateEmail.trim(),
        // The time typed is India time.
        scheduledAt: `${form.at}:00+05:30`,
        minutes: Number(form.minutes) || 45,
        meetingUrl: form.meetingUrl.trim() === "" ? null : form.meetingUrl.trim(),
        problem: form.problem,
        language: form.language,
      }),
    onSuccess: async (made) => {
      void queryClient.invalidateQueries({ queryKey: ["interviews"] });
      await navigator.clipboard?.writeText(made.link).catch(() => undefined);
      toast("Scheduled. The candidate's link is copied", "success");
      onClose();
      onMade(made.id);
    },
  });
  const field = (key: keyof typeof form, label: string, type = "text", required = false) => (
    <label className="field">
      {label}
      <input type={type} required={required} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </label>
  );
  return (
    <Drawer label="Schedule an interview" onClose={onClose}>
      <h2 className="dialog-title">Schedule an interview</h2>
      <form
        aria-label="Interview details"
        onSubmit={(e) => {
          e.preventDefault();
          make.mutate();
        }}
      >
        {field("title", "Interview", "text", true)}
        {field("candidateName", "Candidate's name", "text", true)}
        {field("candidateRef", "Roll number or reference")}
        {field("candidateEmail", "Candidate's email", "email")}
        {field("at", "Date and time (India time)", "datetime-local", true)}
        {field("minutes", "Minutes", "number")}
        {field("meetingUrl", "Video call link (blank for a new Jitsi room)", "url")}
        <label className="field">
          Language
          <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
            {LANGUAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Problem to start with
          <textarea rows={5} value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} />
        </label>
        {make.error === null ? null : (
          <p className="error" role="alert">
            {failure(make.error)}
          </p>
        )}
        <button type="submit" disabled={make.isPending}>
          Schedule and copy the link
        </button>
      </form>
    </Drawer>
  );
}

function Room({ client, id, onBack }: { client: ConsoleClient; id: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  // The candidate's code, every two seconds while the interview is on.
  const interview = useQuery({ queryKey: ["interview", id], queryFn: () => client.interview(id), refetchInterval: (q) => (q.state.data?.status === "scheduled" ? 2000 : false) });
  const [problem, setProblem] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [summary, setSummary] = useState("");
  const i = interview.data;
  useEffect(() => {
    if (i === undefined) return;
    setProblem((p) => p ?? i.problem);
    setNotes((n) => n ?? i.notes);
  }, [i]);
  const saved = (updated: Interview) => queryClient.setQueryData(["interview", id], updated);
  const edit = useMutation({ mutationFn: (patch: { problem?: string; notes?: string; cancel?: boolean }) => client.editInterview(id, patch), onSuccess: (u) => (saved(u), toast("Saved", "success")) });
  const score = useMutation({
    mutationFn: () => client.scoreInterview(id, { criteria: Object.entries(scores).map(([name, s]) => ({ name, score: s })), recommendation: recommendation!, summary }),
    onSuccess: (u) => {
      saved(u);
      void queryClient.invalidateQueries({ queryKey: ["interviews"] });
      toast("Scorecard saved", "success");
    },
  });
  if (i === undefined) return <p className="notice">Opening the room…</p>;
  const open = i.status === "scheduled";

  return (
    <section className="card interview-room" aria-label={`Interview: ${i.title}`}>
      <div className="bar">
        <button type="button" className="quiet" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          All interviews
        </button>
        <strong>
          {i.title} — {i.candidateName}
        </strong>
        <span className="notice">
          {when(i.scheduledAt)} · {i.minutes} min · {STATUS[i.status]}
        </span>
      </div>
      <div className="row">
        <a className="button" href={i.meetingUrl} target="_blank" rel="noreferrer">
          <Video aria-hidden="true" />
          Join the video call
        </a>
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
        {open ? (
          <button type="button" className="quiet danger" onClick={() => edit.mutate({ cancel: true })}>
            Cancel the interview
          </button>
        ) : null}
      </div>
      <div className="room-grid">
        <div>
          <label className="field">
            Problem the candidate sees
            <textarea rows={6} value={problem ?? ""} readOnly={!open} onChange={(e) => setProblem(e.target.value)} />
          </label>
          {open ? (
            <button type="button" className="quiet" disabled={problem === i.problem} onClick={() => edit.mutate({ problem: problem ?? "" })}>
              Show the candidate this problem
            </button>
          ) : null}
          <label className="field">
            Your notes (the candidate never sees them)
            <textarea rows={6} value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== null && notes !== i.notes && edit.mutate({ notes })} />
          </label>
        </div>
        <div>
          <p className="notice">
            Candidate's code · <span className="mono">{i.language}</span> · {i.codeUpdatedAt === null ? "nothing typed yet" : `last typed ${new Date(i.codeUpdatedAt).toLocaleTimeString("en-IN")}`}
          </p>
          <pre className="live-code" aria-label="Candidate's code" aria-live="off">
            {i.code === "" ? "—" : i.code}
          </pre>
        </div>
      </div>
      {i.scorecard !== null ? (
        <section aria-label="Scorecard" className="scorecard">
          <h3>Scorecard — {RECOMMENDATIONS.find(([r]) => r === i.scorecard?.recommendation)?.[1]}</h3>
          <ul>
            {i.scorecard.criteria.map((c) => (
              <li key={c.name}>
                {c.name}: <strong>{c.score}</strong> / 5
              </li>
            ))}
          </ul>
          {i.scorecard.summary === "" ? null : <p>{i.scorecard.summary}</p>}
        </section>
      ) : open ? (
        <form
          aria-label="Scorecard"
          className="scorecard"
          onSubmit={(e) => {
            e.preventDefault();
            score.mutate();
          }}
        >
          <h3>Scorecard</h3>
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
          {score.error === null ? null : (
            <p className="error" role="alert">
              {failure(score.error)}
            </p>
          )}
          <button type="submit" disabled={recommendation === null || Object.keys(scores).length === 0 || score.isPending}>
            Save the scorecard and close
          </button>
        </form>
      ) : null}
    </section>
  );
}
