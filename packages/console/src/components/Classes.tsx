import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarCheck, Download, FlaskConical, Plus, School, Trash2 } from "lucide-react";
import { Drawer, useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type ClassOptions, type ClassReport, type ClassSession, type ConsoleClient } from "../api.ts";
import { EmptyState } from "./kit.tsx";
import "./Classes.css";

/**
 * Classes (docs/PREP-TRACKER.md plan row 95, F2 Campus). A class is a cohort
 * of the practice site's students, the course they work through, the tests
 * and contests set for it, and its sessions. Its page puts each student on a
 * line: how much of the course is done, each test's mark, each contest's
 * solves, and attendance.
 */

const failure = (error: unknown) => (error instanceof ConsoleError && error.detail !== undefined ? error.detail : "That did not go through. Try again.");
const pct = (n: number | null) => (n === null ? "—" : `${n}%`);
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const dayLabel = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short", weekday: "short" }).format(new Date(`${iso}T00:00:00Z`));

export function ClassesPanel({ client, canWrite }: { client: ConsoleClient; canWrite: boolean }) {
  const list = useQuery({ queryKey: ["classes"], queryFn: () => client.classes() });
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  if (open !== null) return <ClassPage client={client} id={open} canWrite={canWrite} onBack={() => setOpen(null)} />;
  const rows = list.data ?? [];
  return (
    <section className="card" aria-label="Classes">
      <div className="bar">
        <School aria-hidden="true" />
        <strong>Classes</strong>
        <span className="notice">A cohort, its course, its tests and contests, and who came to each session.</span>
        <span className="spacer" />
        {canWrite ? (
          <button type="button" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            New class
          </button>
        ) : null}
      </div>
      {creating ? (
        <NewClass
          client={client}
          onCancel={() => setCreating(false)}
          onMade={(id) => {
            setCreating(false);
            setOpen(id);
          }}
        />
      ) : null}
      {list.isPending ? <p className="notice">Loading…</p> : null}
      {list.isSuccess && rows.length === 0 && !creating ? (
        <EmptyState icon={School} {...(canWrite ? { action: { label: "New class", onClick: () => setCreating(true), icon: Plus } } : {})}>
          No classes yet. Make a cohort of your students under Practice, then a class from it.
        </EmptyState>
      ) : null}
      {rows.length === 0 ? null : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col">Cohort</th>
                <th scope="col">Course</th>
                <th scope="col" className="num">
                  Tests
                </th>
                <th scope="col" className="num">
                  Contests
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <button type="button" className="link" onClick={() => setOpen(c.id)}>
                      {c.name}
                    </button>
                  </td>
                  <td>{c.cohort.name}</td>
                  <td>{c.track?.title ?? "—"}</td>
                  <td className="num">{c.tests}</td>
                  <td className="num">{c.contests}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function NewClass({ client, onCancel, onMade }: { client: ConsoleClient; onCancel: () => void; onMade: (id: string) => void }) {
  const queryClient = useQueryClient();
  const options = useQuery({ queryKey: ["class-options"], queryFn: () => client.classOptions() });
  const [name, setName] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [trackId, setTrackId] = useState("");
  const make = useMutation({
    mutationFn: () => client.createClass({ name: name.trim(), cohortId, trackId: trackId === "" ? null : trackId }),
    onSuccess: async (made) => {
      await queryClient.invalidateQueries({ queryKey: ["classes"] });
      onMade(made.id);
    },
  });
  const cohorts = options.data?.cohorts ?? [];
  return (
    <form
      className="class-new"
      aria-label="New class"
      onSubmit={(e) => {
        e.preventDefault();
        make.mutate();
      }}
    >
      <div className="field">
        <label htmlFor="class-name">Name</label>
        <input id="class-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Java Programming — CSE A" />
      </div>
      <div className="field">
        <label htmlFor="class-cohort">Students (cohort)</label>
        <select id="class-cohort" value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
          <option value="">Choose a cohort</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {options.isSuccess && cohorts.length === 0 ? <p className="notice small">No cohorts yet: make one under Practice → Campus, with the students' addresses.</p> : null}
      </div>
      <div className="field">
        <label htmlFor="class-track">Course</label>
        <select id="class-track" value={trackId} onChange={(e) => setTrackId(e.target.value)}>
          <option value="">None yet</option>
          {(options.data?.tracks ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <p className="notice small">One of the practice site's tracks: its modules of lessons and problems are the course.</p>
      </div>
      {make.error === null ? null : (
        <p className="error" role="alert">
          {failure(make.error)}
        </p>
      )}
      <div className="row">
        <button type="button" className="quiet" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={make.isPending || name.trim() === "" || cohortId === ""}>
          {make.isPending ? "Making…" : "Make the class"}
        </button>
      </div>
    </form>
  );
}

function ClassPage({ client, id, canWrite, onBack }: { client: ConsoleClient; id: string; canWrite: boolean; onBack: () => void }) {
  const report = useQuery({ queryKey: ["class", id], queryFn: () => client.classReport(id) });
  const [lab, setLab] = useState<string | null>(null);
  if (report.isPending) return <p className="notice">Loading the class…</p>;
  if (report.error !== null) return <p className="error">{failure(report.error)}</p>;
  const r = report.data;
  return (
    <div className="class-page">
      <div className="bar">
        <button type="button" className="quiet" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          Classes
        </button>
      </div>
      <section className="card" aria-label={r.class.name}>
        <h2>{r.class.name}</h2>
        <p className="notice">
          {r.class.cohort.name} · {r.students.length} students · course: {r.class.track === null ? "none yet" : `${r.class.track.title} (${r.course.lessons} lessons, ${r.course.problems} problems)`} ·{" "}
          {r.sessions.length} sessions
        </p>
        <Students report={r} onLab={setLab} />
      </section>
      {lab === null ? null : <LabDrawer client={client} classId={id} email={lab} canWrite={canWrite} onClose={() => setLab(null)} />}
      {canWrite ? <Plan client={client} report={r} /> : null}
      <Attendance client={client} report={r} canWrite={canWrite} />
    </div>
  );
}

function Students({ report, onLab }: { report: ClassReport; onLab: (email: string) => void }) {
  if (report.students.length === 0) return <p className="notice">The cohort has no students yet.</p>;
  return (
    <div className="scroll">
      <table className="class-students">
        <thead>
          <tr>
            <th scope="col">Student</th>
            <th scope="col" className="num">
              Course
            </th>
            {report.tests.map((t) => (
              <th key={t.examId} scope="col" className="num">
                {t.title}
              </th>
            ))}
            {report.contests.map((c) => (
              <th key={c.id} scope="col" className="num">
                {c.title}
              </th>
            ))}
            <th scope="col" className="num">
              Attendance
            </th>
          </tr>
        </thead>
        <tbody>
          {report.students.map((s) => (
            <tr key={s.email}>
              <td>
                <strong>{s.name ?? s.email}</strong>
                <div className="notice small">{s.joined ? s.email : `${s.email} · no account yet`}</div>
                {report.class.track === null ? null : (
                  <button type="button" className="link small" onClick={() => onLab(s.email)} aria-label={`Lab record of ${s.name ?? s.email}`}>
                    Lab record
                  </button>
                )}
              </td>
              <td className="num" title={`${s.course.lessonsDone} lessons, ${s.course.problemsSolved} problems`}>
                {pct(s.course.percent)}
              </td>
              {report.tests.map((t) => (
                <td key={t.examId} className="num">
                  {pct(s.tests[t.examId] ?? null)}
                </td>
              ))}
              {report.contests.map((c) => (
                <td key={c.id} className="num">
                  {s.contests[c.id] ?? 0} / {c.problems}
                </td>
              ))}
              <td className="num">
                {s.attendance.of === 0 ? "—" : `${s.attendance.present} of ${s.attendance.of}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A student's lab record: each coding practical of the course, their accepted program, and the sign-off. */
function LabDrawer({ client, classId, email, canWrite, onClose }: { client: ConsoleClient; classId: string; email: string; canWrite: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const lab = useQuery({ queryKey: ["class-lab", classId, email], queryFn: () => client.classLab(classId, email) });
  const sign = useMutation({
    mutationFn: (v: { problemId: string; signed: boolean }) => client.signOffLab(classId, email, v.problemId, v.signed),
    onSuccess: (updated) => queryClient.setQueryData(["class-lab", classId, email], updated),
  });
  const pdf = useMutation({
    mutationFn: async () => {
      const url = URL.createObjectURL(await client.classLabPdf(classId, email));
      const a = document.createElement("a");
      a.href = url;
      a.download = "lab-record.pdf";
      a.click();
      URL.revokeObjectURL(url);
    },
  });
  const r = lab.data;
  return (
    <Drawer label="Lab record" onClose={onClose}>
      <h2 className="dialog-title">
        <FlaskConical aria-hidden="true" /> Lab record
      </h2>
      {lab.isPending ? <p className="notice">Loading…</p> : null}
      {lab.error === null ? null : <p className="error">{failure(lab.error)}</p>}
      {r === undefined ? null : (
        <>
          <p className="notice">
            {r.student.name ?? r.student.email} · {r.class.course ?? ""} · {r.practicals.filter((p) => p.submission !== null).length} of {r.practicals.length} done ·{" "}
            {r.practicals.filter((p) => p.signedBy !== null).length} signed
          </p>
          <button type="button" className="secondary" disabled={pdf.isPending} onClick={() => pdf.mutate()}>
            <Download aria-hidden="true" />
            PDF
          </button>
          {sign.error === null ? null : (
            <p className="error" role="alert">
              {failure(sign.error)}
            </p>
          )}
          <ol className="class-lab">
            {r.practicals.map((p) => (
              <li key={p.problemId}>
                <div className="bar">
                  <strong>{p.title}</strong>
                  <span className="notice small">{p.module}</span>
                  <span className="spacer" />
                  {p.signedBy === null ? null : <span className="pill outcome ok">Signed by {p.signedBy}</span>}
                  {canWrite && p.submission !== null ? (
                    <button type="button" className={p.signedBy === null ? "" : "quiet"} disabled={sign.isPending} onClick={() => sign.mutate({ problemId: p.problemId, signed: p.signedBy === null })}>
                      {p.signedBy === null ? `Sign off ${p.title}` : "Take back"}
                    </button>
                  ) : null}
                </div>
                {p.submission === null ? (
                  <p className="notice small">Not done yet.</p>
                ) : (
                  <>
                    <p className="notice small">
                      {p.submission.language ?? ""} · {p.submission.passed} of {p.submission.total} tests passed
                    </p>
                    <pre className="code">{p.submission.source}</pre>
                  </>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </Drawer>
  );
}

/** The course, tests and contests set for the class. */
function Plan({ client, report }: { client: ConsoleClient; report: ClassReport }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const options = useQuery({ queryKey: ["class-options"], queryFn: () => client.classOptions() });
  const [tests, setTests] = useState<readonly string[]>(report.tests.map((t) => t.examId));
  const [contests, setContests] = useState<readonly string[]>(report.contests.map((c) => c.id));
  const [trackId, setTrackId] = useState(report.class.track?.id ?? "");
  const save = useMutation({
    mutationFn: () => client.updateClass(report.class.id, { trackId: trackId === "" ? null : trackId, examIds: tests, contestIds: contests }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["class", report.class.id], updated);
      void queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast("Class saved", "success");
    },
  });
  const toggle = (list: readonly string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const o: ClassOptions | undefined = options.data;
  return (
    <section className="card" aria-label="Course, tests and contests">
      <strong>Course, tests and contests</strong>
      <div className="field">
        <label htmlFor="class-plan-track">Course</label>
        <select id="class-plan-track" value={trackId} onChange={(e) => setTrackId(e.target.value)}>
          <option value="">None</option>
          {(o?.tracks ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>
      <div className="class-choices">
        <fieldset>
          <legend>Tests</legend>
          {(o?.exams ?? []).length === 0 ? <p className="notice small">No exams yet.</p> : null}
          {(o?.exams ?? []).map((e) => (
            <label key={e.id}>
              <input type="checkbox" checked={tests.includes(e.id)} onChange={() => setTests(toggle(tests, e.id))} />
              {e.title}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Contests</legend>
          {(o?.contests ?? []).length === 0 ? <p className="notice small">No contests yet.</p> : null}
          {(o?.contests ?? []).map((c) => (
            <label key={c.id}>
              <input type="checkbox" checked={contests.includes(c.id)} onChange={() => setContests(toggle(contests, c.id))} />
              {c.title}
            </label>
          ))}
        </fieldset>
      </div>
      {save.error === null ? null : (
        <p className="error" role="alert">
          {failure(save.error)}
        </p>
      )}
      <button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "Saving…" : "Save"}
      </button>
    </section>
  );
}

/** Sessions, and who was present at each. */
function Attendance({ client, report, canWrite }: { client: ConsoleClient; report: ClassReport; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const id = report.class.id;
  const sessions = useQuery({ queryKey: ["class-sessions", id], queryFn: () => client.classSessions(id) });
  const [heldOn, setHeldOn] = useState(today);
  const [topic, setTopic] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const refresh = async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: ["class-sessions", id] }), queryClient.invalidateQueries({ queryKey: ["class", id] })]);
  };
  const add = useMutation({
    mutationFn: () => client.addClassSession(id, { heldOn, topic: topic.trim() }),
    onSuccess: async (made) => {
      setTopic("");
      setOpen(made.id);
      await refresh();
    },
  });
  const remove = useMutation({ mutationFn: (sessionId: string) => client.removeClassSession(id, sessionId), onSuccess: refresh });
  const list = sessions.data ?? [];
  const current = list.find((s) => s.id === open) ?? null;
  return (
    <section className="card" aria-label="Attendance">
      <div className="bar">
        <CalendarCheck aria-hidden="true" />
        <strong>Attendance</strong>
      </div>
      {canWrite ? (
        <form
          className="row class-session-new"
          aria-label="Add a session"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <label>
            Day
            <input type="date" value={heldOn} onChange={(e) => setHeldOn(e.target.value)} required />
          </label>
          <label>
            Topic
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Arrays, lab 3" />
          </label>
          <button type="submit" className="secondary" disabled={add.isPending || heldOn === ""}>
            <Plus aria-hidden="true" />
            Add session
          </button>
        </form>
      ) : null}
      {add.error === null ? null : (
        <p className="error" role="alert">
          {failure(add.error)}
        </p>
      )}
      {sessions.isSuccess && list.length === 0 ? <p className="notice">No sessions yet.</p> : null}
      {list.length === 0 ? null : (
        <ul className="class-sessions">
          {list.map((s) => {
            const present = Object.values(s.marks).filter(Boolean).length;
            return (
              <li key={s.id} className={s.id === open ? "chosen" : undefined}>
                <button type="button" className="link" aria-pressed={s.id === open} onClick={() => setOpen(s.id === open ? null : s.id)}>
                  {dayLabel(s.heldOn)}
                  {s.topic === "" ? "" : ` · ${s.topic}`}
                </button>
                <span className="notice small">{Object.keys(s.marks).length === 0 ? "not marked" : `${present} of ${report.students.length} present`}</span>
                {canWrite ? (
                  <button type="button" className="quiet icon" aria-label={`Remove the session on ${dayLabel(s.heldOn)}`} onClick={() => remove.mutate(s.id)}>
                    <Trash2 aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {current === null ? null : (
        <Register
          key={current.id}
          client={client}
          classId={id}
          session={current}
          students={report.students}
          canWrite={canWrite}
          onSaved={async () => {
            toast("Attendance saved", "success");
            await refresh();
          }}
        />
      )}
    </section>
  );
}

function Register({
  client,
  classId,
  session,
  students,
  canWrite,
  onSaved,
}: {
  client: ConsoleClient;
  classId: string;
  session: ClassSession;
  students: ClassReport["students"];
  canWrite: boolean;
  onSaved: () => Promise<void>;
}) {
  // Unmarked students start as present: a teacher ticks off who is missing.
  const [marks, setMarks] = useState<Record<string, boolean>>(() => Object.fromEntries(students.map((s) => [s.email, session.marks[s.email] ?? true])));
  const save = useMutation({ mutationFn: () => client.markAttendance(classId, session.id, marks), onSuccess: onSaved });
  const present = Object.values(marks).filter(Boolean).length;
  return (
    <fieldset className="class-register" disabled={!canWrite}>
      <legend>
        Who was present on {dayLabel(session.heldOn)} · {present} of {students.length}
      </legend>
      {students.map((s) => (
        <label key={s.email}>
          <input type="checkbox" checked={marks[s.email] ?? false} onChange={(e) => setMarks({ ...marks, [s.email]: e.target.checked })} />
          {s.name ?? s.email}
        </label>
      ))}
      {save.error === null ? null : (
        <p className="error" role="alert">
          {failure(save.error)}
        </p>
      )}
      {canWrite ? (
        <button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save attendance"}
        </button>
      ) : null}
    </fieldset>
  );
}
