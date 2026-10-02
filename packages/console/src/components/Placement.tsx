import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BriefcaseBusiness, Copy, Download, Link2, Pencil, Plus, Search, Send, Trash2, UserPlus, Users } from "lucide-react";
import { Drawer, TabPanel, Tabs, useToast } from "@parikshaa/brand/ui";
import { ConsoleError, DRIVE_STAGES, type ConsoleClient, type Drive, type DriveDraft, type DriveStage, type StudentImport, type StudentRow } from "../api.ts";
import "./Placement.css";
import { Colleges, FunnelCard, FunnelTable, Offers } from "./DriveNetwork.tsx";
import { Banner, DropZone, EmptyState, FigureStrip, PageActions, RowMenu, SkeletonRows, StatBar } from "./kit.tsx";

/**
 * The placement cell (docs/PREP-TRACKER.md, V2-12: CL8, CL52). Students are
 * entered once from the college's own sheet — roll number, branch, batch,
 * CGPA, backlogs — and each drive finds who is eligible, sends its test and
 * follows every student to an offer. No Excel in between.
 */

type Channel = "email" | "sms" | "whatsapp";

export const STAGE_WORDS: Record<DriveStage, string> = {
  applied: "Applied",
  test: "Test",
  interview: "Interview",
  offered: "Offered",
  joined: "Joined",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

const STAGE_TONE: Record<DriveStage, "live" | "ok" | "bad" | "quiet"> = {
  applied: "quiet",
  test: "live",
  interview: "live",
  offered: "ok",
  joined: "ok",
  rejected: "bad",
  withdrawn: "quiet",
};

const SAMPLE = [
  "roll_number,name,email,phone,branch,batch,cgpa,backlogs",
  "CS2023001,Ananya Iyer,ananya@college.ac.in,9876543210,CSE,2027,8.9,0",
  "EC2023014,Rohan Verma,rohan@college.ac.in,9812345678,ECE,2027,7.2,1",
].join("\n");

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const lpa = (n: number | null) => (n === null ? "—" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })} LPA`);
const failure = (error: unknown) => (error instanceof ConsoleError && error.detail !== undefined ? error.detail : "That did not work. Try again.");

export function PlacementPanel({ client, canInvite }: { client: ConsoleClient; canInvite: boolean }) {
  const [tab, setTab] = useState<"students" | "drives" | "funnel" | "readiness" | "report">("drives");
  return (
    <>
      <Tabs
        label="Placement"
        idBase="placement"
        items={[
          { id: "drives", label: "Drives" },
          { id: "students", label: "Students" },
          { id: "funnel", label: "Funnel" },
          { id: "readiness", label: "Readiness" },
          { id: "report", label: "Year-wise report" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <TabPanel idBase="placement" id="drives" value={tab}>
        {tab === "drives" ? <Drives client={client} canInvite={canInvite} onStudents={() => setTab("students")} /> : null}
      </TabPanel>
      <TabPanel idBase="placement" id="students" value={tab}>
        {tab === "students" ? <Students client={client} /> : null}
      </TabPanel>
      <TabPanel idBase="placement" id="funnel" value={tab}>
        {tab === "funnel" ? <FunnelTable client={client} /> : null}
      </TabPanel>
      <TabPanel idBase="placement" id="readiness" value={tab}>
        {tab === "readiness" ? <ReadinessView client={client} /> : null}
      </TabPanel>
      <TabPanel idBase="placement" id="report" value={tab}>
        {tab === "report" ? <ReportView client={client} /> : null}
      </TabPanel>
    </>
  );
}

// --- students -----------------------------------------------------------------------

function Students({ client }: { client: ConsoleClient }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const students = useQuery({ queryKey: ["students"], queryFn: () => client.students() });
  const [search, setSearch] = useState("");
  const [batch, setBatch] = useState<number | "all">("all");
  const [importing, setImporting] = useState(false);
  const remove = useMutation({
    mutationFn: (ref: string) => client.removeStudent(ref),
    onSuccess: (_, ref) => {
      toast(`${ref} removed`, "success");
      void queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });

  const all = students.data ?? [];
  const batches = [...new Set(all.map((s) => s.batch).filter((b): b is number => b !== null))].sort();
  const needle = search.trim().toLowerCase();
  const shown = all.filter((s) => (batch === "all" || s.batch === batch) && (needle === "" || s.ref.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle) || s.branch.toLowerCase().includes(needle)));
  const placed = all.filter((s) => s.offers > 0).length;

  return (
    <>
      <PageActions>
        <button type="button" onClick={() => setImporting(true)}>
          <UserPlus aria-hidden="true" />
          Add students from a sheet
        </button>
      </PageActions>
      {students.isPending ? (
        <section className="card">
          <SkeletonRows rows={6} columns={6} label="Loading students…" />
        </section>
      ) : all.length === 0 ? (
        <section className="card">
          <EmptyState icon={Users} action={{ label: "Add students from a sheet", onClick: () => setImporting(true), icon: UserPlus }}>
            Enter your students once — roll number, branch, batch, CGPA and backlogs — and every drive finds who is eligible by itself.
          </EmptyState>
        </section>
      ) : (
        <>
          <FigureStrip
            label="Students at a glance"
            figures={[
              { label: "Students", value: all.length, icon: Users },
              { label: "With an offer", value: placed, ...(placed > 0 ? { tone: "ok" as const } : {}) },
              { label: "Placed", value: `${Math.round((placed * 100) / all.length)}%` },
            ]}
          />
          <section className="card" aria-label="Students">
            <div className="bar filter-bar">
              <div className="chips" role="group" aria-label="Batch">
                <button type="button" className="chip" aria-pressed={batch === "all"} onClick={() => setBatch("all")}>
                  All batches
                </button>
                {batches.map((b) => (
                  <button key={b} type="button" className="chip" aria-pressed={batch === b} onClick={() => setBatch(b)}>
                    {b}
                  </button>
                ))}
              </div>
              <span className="spacer" />
              <label className="search">
                <Search aria-hidden="true" />
                <input type="search" aria-label="Roll number, name or branch" placeholder="Roll number, name or branch" value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
            </div>
            <div className="scroll">
              <table className="students-table">
                <thead>
                  <tr>
                    <th scope="col">Roll no.</th>
                    <th scope="col">Name</th>
                    <th scope="col">Branch</th>
                    <th scope="col" className="num">
                      Batch
                    </th>
                    <th scope="col" className="num">
                      CGPA
                    </th>
                    <th scope="col" className="num">
                      Backlogs
                    </th>
                    <th scope="col">Offer</th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((s) => (
                    <tr key={s.ref}>
                      <td className="mono">{s.ref}</td>
                      <td>{s.name || <span className="notice">—</span>}</td>
                      <td>{s.branch || <span className="notice">—</span>}</td>
                      <td className="num">{s.batch ?? "—"}</td>
                      <td className="num">{s.cgpa === null ? "—" : s.cgpa.toFixed(2)}</td>
                      <td className={`num${s.backlogs > 0 ? " failed" : ""}`}>{s.backlogs}</td>
                      <td>{s.offers === 0 ? <span className="notice">—</span> : <span className="pill tone-ok">{lpa(s.bestOfferLpa)}</span>}</td>
                      <td className="actions">
                        <RowMenu
                          of={s.ref}
                          items={[{ label: "Remove from the list", icon: <Trash2 aria-hidden="true" />, danger: true, onSelect: () => remove.mutate(s.ref) }]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown.length === 0 ? <p className="notice">No student matches.</p> : null}
          </section>
        </>
      )}
      {importing ? <ImportStudents client={client} onClose={() => setImporting(false)} /> : null}
    </>
  );
}

function ImportStudents({ client, onClose }: { client: ConsoleClient; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [csv, setCsv] = useState<string | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [preview, setPreview] = useState<StudentImport | null>(null);
  const check = useMutation({ mutationFn: (text: string) => client.importStudents(text, true), onSuccess: setPreview });
  const commit = useMutation({
    mutationFn: () => client.importStudents(csv!, false),
    onSuccess: (done) => {
      toast(`${done.added} added, ${done.updated} updated`, "success");
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      onClose();
    },
  });
  return (
    <Drawer label="Add students from a sheet" onClose={onClose}>
      <h2 className="dialog-title">Add students from a sheet</h2>
      <p className="notice">
        One student per row: <span className="mono">roll_number</span>, <span className="mono">name</span>, <span className="mono">email</span>, <span className="mono">phone</span>,{" "}
        <span className="mono">branch</span>, <span className="mono">batch</span> (year of passing), <span className="mono">cgpa</span> (out of 10) and{" "}
        <span className="mono">backlogs</span>. A student already on the list is updated to what the sheet says.
      </p>
      <button type="button" className="quiet" onClick={() => save(new Blob([SAMPLE], { type: "text/csv" }), "students-sample.csv")}>
        <Download aria-hidden="true" />
        Download a sample sheet
      </button>
      <DropZone
        label="Choose a spreadsheet saved as CSV"
        name="Student list (CSV)"
        accept=".csv,text/csv"
        chosen={file}
        hint="Checked first: nothing is saved until you confirm."
        onFile={async (chosen) => {
          const text = await chosen.text();
          setCsv(text);
          setFile(chosen.name);
          check.mutate(text);
        }}
      />
      {check.isPending ? <p className="notice">Checking…</p> : null}
      {preview === null ? null : preview.problems.length > 0 ? (
        <>
          <Banner tone="danger" title={`${preview.problems.length} ${preview.problems.length === 1 ? "row needs" : "rows need"} fixing.`}>
            Fix the sheet and choose it again; nothing was saved.
          </Banner>
          <ul className="problems">
            {preview.problems.slice(0, 50).map((p) => (
              <li key={`${p.row}${p.message}`}>
                <span className="mono">row {p.row}</span> — {p.message}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div role="group" aria-label="Import preview" className="import-preview">
          <p>
            <strong>
              {preview.added} new, {preview.updated} to update.
            </strong>
          </p>
          <div className="row">
            <button type="button" disabled={commit.isPending} onClick={() => commit.mutate()}>
              Save {preview.students} students
            </button>
            <button type="button" className="quiet" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {commit.error === null ? null : (
        <p className="error" role="alert">
          {failure(commit.error)}
        </p>
      )}
    </Drawer>
  );
}

// --- drives -------------------------------------------------------------------------

const EMPTY: DriveDraft = { company: "", role: "", ctcLpa: null, location: "", description: "", eligibility: {}, applyBy: null, examId: null, status: "open" };

function eligibilityWords(drive: DriveDraft): string {
  const e = drive.eligibility;
  const parts = [
    e.minCgpa === undefined ? null : `CGPA ${e.minCgpa}+`,
    e.maxBacklogs === undefined ? null : e.maxBacklogs === 0 ? "no backlogs" : `at most ${e.maxBacklogs} backlog${e.maxBacklogs === 1 ? "" : "s"}`,
    e.branches === undefined || e.branches.length === 0 ? null : e.branches.join(", "),
    e.batches === undefined || e.batches.length === 0 ? null : `batch ${e.batches.join(", ")}`,
  ].filter((p) => p !== null);
  return parts.length === 0 ? "Open to every student" : parts.join(" · ");
}

function Drives({ client, canInvite, onStudents }: { client: ConsoleClient; canInvite: boolean; onStudents: () => void }) {
  const drives = useQuery({ queryKey: ["drives"], queryFn: () => client.drives() });
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<Drive | "new" | null>(null);

  if (open !== null) return <DriveView client={client} id={open} canInvite={canInvite} onBack={() => setOpen(null)} onEdit={(d) => setEditing(d)} editing={editing} onEdited={() => setEditing(null)} />;
  const list = drives.data ?? [];
  return (
    <>
      <PageActions>
        <button type="button" onClick={() => setEditing("new")}>
          <Plus aria-hidden="true" />
          New drive
        </button>
      </PageActions>
      {drives.isPending ? (
        <section className="card">
          <SkeletonRows rows={4} columns={5} label="Loading drives…" />
        </section>
      ) : list.length === 0 ? (
        <section className="card">
          <EmptyState icon={BriefcaseBusiness} action={{ label: "New drive", onClick: () => setEditing("new"), icon: Plus }}>
            A drive is one company's visit: who may apply, its test, and each student's round up to the offer. Add your students first, so eligible ones are found for you.{" "}
            <button type="button" className="link" onClick={onStudents}>
              Add students
            </button>
          </EmptyState>
        </section>
      ) : (
        <section className="card" aria-label="Drives">
          <div className="scroll">
            <table className="drives-table">
              <thead>
                <tr>
                  <th scope="col">Company and role</th>
                  <th scope="col">Package</th>
                  <th scope="col">Who may apply</th>
                  <th scope="col" className="num">
                    Students
                  </th>
                  <th scope="col" className="num">
                    Offers
                  </th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((d) => {
                  const total = DRIVE_STAGES.reduce((n, s) => n + d.stages[s], 0);
                  return (
                    <tr key={d.id}>
                      <td>
                        <button type="button" className="link" onClick={() => setOpen(d.id)}>
                          <strong>{d.company}</strong>
                        </button>
                        <div className="notice">{d.role}</div>
                      </td>
                      <td>{lpa(d.ctcLpa)}</td>
                      <td className="notice">{eligibilityWords(d)}</td>
                      <td className="num">{total}</td>
                      <td className="num">{d.stages.offered + d.stages.joined}</td>
                      <td>
                        <span className={`pill${d.status === "open" ? " tone-live" : ""}`}>{d.status === "open" ? "Open" : "Closed"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {editing === null ? null : <DriveForm client={client} drive={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={(d) => setOpen(d.id)} />}
    </>
  );
}

function DriveForm({ client, drive, onClose, onSaved }: { client: ConsoleClient; drive: Drive | null; onClose: () => void; onSaved: (drive: Drive) => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const exams = useQuery({ queryKey: ["exams"], queryFn: () => client.listExams() });
  const students = useQuery({ queryKey: ["students"], queryFn: () => client.students() });
  const [form, setForm] = useState<DriveDraft>(drive ?? EMPTY);
  const [minCgpa, setMinCgpa] = useState(drive?.eligibility.minCgpa?.toString() ?? "");
  const [maxBacklogs, setMaxBacklogs] = useState(drive?.eligibility.maxBacklogs?.toString() ?? "");
  const [ctc, setCtc] = useState(drive?.ctcLpa?.toString() ?? "");
  const branches = useMemo(() => [...new Set((students.data ?? []).map((s) => s.branch).filter((b) => b !== ""))].sort(), [students.data]);
  const batches = useMemo(() => [...new Set((students.data ?? []).map((s) => s.batch).filter((b): b is number => b !== null))].sort(), [students.data]);
  const chosenBranches = form.eligibility.branches ?? [];
  const chosenBatches = form.eligibility.batches ?? [];

  const draft = (): DriveDraft => ({
    ...form,
    ctcLpa: ctc.trim() === "" ? null : Number(ctc),
    eligibility: {
      ...(minCgpa.trim() === "" ? {} : { minCgpa: Number(minCgpa) }),
      ...(maxBacklogs.trim() === "" ? {} : { maxBacklogs: Number(maxBacklogs) }),
      ...(chosenBranches.length === 0 ? {} : { branches: chosenBranches }),
      ...(chosenBatches.length === 0 ? {} : { batches: chosenBatches }),
    },
  });
  const eligibleNow = (students.data ?? []).filter((s) => meets(s, draft())).length;
  const saveDrive = useMutation({
    mutationFn: () => client.saveDrive(drive?.id ?? null, draft()),
    onSuccess: (saved) => {
      toast(drive === null ? `${saved.company} drive made` : "Drive saved", "success");
      void queryClient.invalidateQueries({ queryKey: ["drives"] });
      void queryClient.invalidateQueries({ queryKey: ["drive", saved.id] });
      onClose();
      onSaved(saved);
    },
  });
  const toggle = <T,>(list: readonly T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  return (
    <Drawer label={drive === null ? "New drive" : "Edit drive"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveDrive.mutate();
        }}
      >
        <h2 className="dialog-title">{drive === null ? "New drive" : `Edit ${drive.company}`}</h2>
        <div className="grid">
          <div className="field">
            <label htmlFor="drive-company">Company</label>
            <input id="drive-company" required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="e.g. Infosys" />
          </div>
          <div className="field">
            <label htmlFor="drive-role">Role</label>
            <input id="drive-role" required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Systems Engineer" />
          </div>
          <div className="field">
            <label htmlFor="drive-ctc">Package (LPA)</label>
            <input id="drive-ctc" type="number" min={0} step={0.1} value={ctc} onChange={(e) => setCtc(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="drive-location">Location</label>
            <input id="drive-location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="drive-apply-by">Apply by</label>
            <input id="drive-apply-by" type="date" value={form.applyBy ?? ""} onChange={(e) => setForm({ ...form, applyBy: e.target.value === "" ? null : e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="drive-exam">The drive's test</label>
            <select id="drive-exam" value={form.examId ?? ""} onChange={(e) => setForm({ ...form, examId: e.target.value === "" ? null : e.target.value })}>
              <option value="">None yet</option>
              {(exams.data ?? [])
                .filter((x) => x.archivedAt === undefined || x.archivedAt === null)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <fieldset className="field">
          <legend>Who may apply</legend>
          <div className="grid">
            <div className="field">
              <label htmlFor="drive-cgpa">Minimum CGPA</label>
              <input id="drive-cgpa" type="number" min={0} max={10} step={0.1} value={minCgpa} onChange={(e) => setMinCgpa(e.target.value)} placeholder="Any" />
            </div>
            <div className="field">
              <label htmlFor="drive-backlogs">Most backlogs allowed</label>
              <input id="drive-backlogs" type="number" min={0} max={100} step={1} value={maxBacklogs} onChange={(e) => setMaxBacklogs(e.target.value)} placeholder="Any" />
            </div>
          </div>
          {branches.length === 0 ? null : (
            <div className="chips" role="group" aria-label="Branches">
              {branches.map((b) => (
                <button key={b} type="button" className="chip" aria-pressed={chosenBranches.includes(b)} onClick={() => setForm({ ...form, eligibility: { ...form.eligibility, branches: toggle(chosenBranches, b) } })}>
                  {b}
                </button>
              ))}
            </div>
          )}
          {batches.length === 0 ? null : (
            <div className="chips" role="group" aria-label="Batches">
              {batches.map((b) => (
                <button key={b} type="button" className="chip" aria-pressed={chosenBatches.includes(b)} onClick={() => setForm({ ...form, eligibility: { ...form.eligibility, batches: toggle(chosenBatches, b) } })}>
                  {b}
                </button>
              ))}
            </div>
          )}
          <p className="notice" role="status">
            {students.data === undefined ? "" : `${eligibleNow} of ${students.data.length} students meet this now. No branch or batch chosen means all of them.`}
          </p>
        </fieldset>
        <div className="field">
          <label htmlFor="drive-jd">Job description</label>
          <textarea id="drive-jd" rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        {drive === null ? null : (
          <label className="inline">
            <input type="checkbox" checked={form.status === "closed"} onChange={(e) => setForm({ ...form, status: e.target.checked ? "closed" : "open" })} /> The drive is over: close it
          </label>
        )}
        {saveDrive.error === null ? null : (
          <p className="error" role="alert">
            {failure(saveDrive.error)}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={saveDrive.isPending}>
            {drive === null ? "Make the drive" : "Save"}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

/** The same rule the server applies, to say how many a draft would reach as it is typed. */
function meets(s: StudentRow, d: DriveDraft): boolean {
  const e = d.eligibility;
  if (e.minCgpa !== undefined && (s.cgpa === null || s.cgpa < e.minCgpa)) return false;
  if (e.maxBacklogs !== undefined && s.backlogs > e.maxBacklogs) return false;
  if (e.branches !== undefined && e.branches.length > 0 && !e.branches.some((b) => b.toLowerCase() === s.branch.toLowerCase())) return false;
  if (e.batches !== undefined && e.batches.length > 0 && (s.batch === null || !e.batches.includes(s.batch))) return false;
  return true;
}

function DriveView({
  client,
  id,
  canInvite,
  onBack,
  onEdit,
  editing,
  onEdited,
}: {
  client: ConsoleClient;
  id: string;
  canInvite: boolean;
  onBack: () => void;
  onEdit: (drive: Drive) => void;
  editing: Drive | "new" | null;
  onEdited: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const detail = useQuery({ queryKey: ["drive", id], queryFn: () => client.drive(id) });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [stage, setStage] = useState<DriveStage>("interview");
  const [offer, setOffer] = useState("");
  const [sending, setSending] = useState(false);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["drive", id] });
    void queryClient.invalidateQueries({ queryKey: ["drives"] });
    void queryClient.invalidateQueries({ queryKey: ["students"] });
  };
  const add = useMutation({
    mutationFn: () => client.addDriveStudents(id, "eligible"),
    onSuccess: ({ added }) => {
      toast(`${added} student${added === 1 ? "" : "s"} added`, "success");
      refresh();
    },
  });
  const move = useMutation({
    mutationFn: () => client.setDriveStage(id, [...selected], stage, offer.trim() === "" ? null : Number(offer)),
    onSuccess: ({ moved }) => {
      toast(`${moved} moved to ${STAGE_WORDS[stage]}`, "success");
      setSelected(new Set());
      refresh();
    },
  });

  if (detail.isPending) {
    return (
      <section className="card">
        <SkeletonRows rows={5} columns={5} label="Loading the drive…" />
      </section>
    );
  }
  if (detail.data === undefined) return <Banner tone="danger" title="Could not load the drive." />;
  const { drive, applications, eligibleNotAdded } = detail.data;
  const atApplied = applications.filter((a) => a.stage === "applied").length;
  const all = applications.length > 0 && selected.size === applications.length;

  return (
    <>
      <PageActions>
        <button type="button" className="quiet" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          All drives
        </button>
        <button type="button" className="secondary" onClick={() => onEdit(drive)}>
          <Pencil aria-hidden="true" />
          Edit
        </button>
        <button type="button" className="secondary" disabled={applications.length === 0} onClick={async () => save(await client.driveFile(id), `${drive.company}-${drive.role}.csv`.toLowerCase().replace(/\s+/g, "-"))}>
          <Download aria-hidden="true" />
          Download for the company
        </button>
      </PageActions>
      <section className="card drive-head" aria-label="The drive">
        <div className="bar">
          <BriefcaseBusiness aria-hidden="true" />
          <h2 className="card-title">
            {drive.company} · {drive.role}
          </h2>
          <span className={`pill${drive.status === "open" ? " tone-live" : ""}`}>{drive.status === "open" ? "Open" : "Closed"}</span>
        </div>
        <dl className="figure-line">
          <div>
            <dt>Package</dt>
            <dd>{lpa(drive.ctcLpa)}</dd>
          </div>
          <div>
            <dt>Who may apply</dt>
            <dd>{eligibilityWords(drive)}</dd>
          </div>
          <div>
            <dt>Apply by</dt>
            <dd>{drive.applyBy ?? "—"}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{drive.location || "—"}</dd>
          </div>
        </dl>
        <StatBar label="Where the drive's students stand" segments={DRIVE_STAGES.filter((s) => drive.stages[s] > 0).map((s) => ({ id: s, label: STAGE_WORDS[s], value: drive.stages[s] }))} />
        <div className="row">
          {eligibleNotAdded > 0 && drive.status === "open" ? (
            <button type="button" disabled={add.isPending} onClick={() => add.mutate()}>
              <UserPlus aria-hidden="true" />
              Add {eligibleNotAdded} eligible student{eligibleNotAdded === 1 ? "" : "s"}
            </button>
          ) : (
            <span className="notice">{applications.length === 0 ? "No student meets the criteria yet: add students, or loosen who may apply." : "Every eligible student is in the drive."}</span>
          )}
          {drive.examId === null ? (
            <span className="notice">Choose the drive's test under Edit to send it.</span>
          ) : canInvite ? (
            <button type="button" className="secondary" disabled={atApplied === 0} onClick={() => setSending(true)}>
              <Send aria-hidden="true" />
              Send the test to {atApplied}
            </button>
          ) : null}
        </div>
      </section>

      <ApplyLink client={client} id={id} link={detail.data.applyLink ?? null} openToNew={drive.openToNew ?? false} onChange={refresh} />
      {detail.data.funnel === undefined || applications.length === 0 ? null : <FunnelCard funnel={detail.data.funnel} />}
      <Colleges client={client} driveId={id} colleges={detail.data.colleges ?? []} onChange={refresh} />
      {applications.length === 0 || detail.data.offers === undefined ? null : <Offers client={client} driveId={id} figures={detail.data.offers} applications={applications} onChange={refresh} />}

      <section className="card" aria-label="Students in the drive">
        {applications.length === 0 ? (
          <EmptyState icon={Users}>Students added to the drive appear here with their round, test result and offer.</EmptyState>
        ) : (
          <>
            <div className="bar filter-bar" role="group" aria-label="Move the chosen students">
              <strong>{selected.size === 0 ? `${applications.length} students` : `${selected.size} chosen`}</strong>
              <span className="spacer" />
              <label className="inline">
                Move to{" "}
                <select value={stage} onChange={(e) => setStage(e.target.value as DriveStage)} aria-label="Stage">
                  {DRIVE_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_WORDS[s]}
                    </option>
                  ))}
                </select>
              </label>
              {stage === "offered" || stage === "joined" ? (
                <label className="inline">
                  Offer (LPA){" "}
                  <input type="number" min={0} step={0.1} className="minutes-input" value={offer} onChange={(e) => setOffer(e.target.value)} aria-label="Offer in lakh a year" />
                </label>
              ) : null}
              <button type="button" disabled={selected.size === 0 || move.isPending} onClick={() => move.mutate()}>
                Move {selected.size || ""}
              </button>
            </div>
            <div className="scroll">
              <table className="drive-students">
                <thead>
                  <tr>
                    <th scope="col">
                      <input type="checkbox" aria-label="Choose every student" checked={all} onChange={() => setSelected(all ? new Set() : new Set(applications.map((a) => a.ref)))} />
                    </th>
                    <th scope="col">Roll no.</th>
                    <th scope="col">Name</th>
                    <th scope="col">Branch</th>
                    <th scope="col" className="num">
                      CGPA
                    </th>
                    <th scope="col" className="num">
                      Test
                    </th>
                    <th scope="col">Round</th>
                    <th scope="col">Offer</th>
                    <th scope="col">
                      <span className="sr-only">Status link</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((a) => (
                    <tr key={a.ref} aria-selected={selected.has(a.ref)}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Choose ${a.ref}`}
                          checked={selected.has(a.ref)}
                          onChange={() => {
                            const next = new Set(selected);
                            if (next.has(a.ref)) next.delete(a.ref);
                            else next.add(a.ref);
                            setSelected(next);
                          }}
                        />
                      </td>
                      <td className="mono">{a.ref}</td>
                      <td>{a.name}</td>
                      <td>{a.branch}</td>
                      <td className="num">{a.cgpa === null ? "—" : a.cgpa.toFixed(2)}</td>
                      <td className={`num${a.test?.outcome === "qualified" ? " qualified" : a.test?.outcome === "failed" ? " failed" : ""}`}>{a.test === null ? <span className="notice">—</span> : `${Math.round(a.test.percent)}%`}</td>
                      <td>
                        <span className={`pill tone-${STAGE_TONE[a.stage]}`}>{STAGE_WORDS[a.stage]}</span>
                      </td>
                      <td>{a.offerLpa === null ? <span className="notice">—</span> : lpa(a.offerLpa)}</td>
                      <td>
                        {a.statusLink === undefined ? null : (
                          <button
                            type="button"
                            className="quiet icon-only"
                            aria-label={`Copy ${a.ref}'s status link`}
                            title="The student's own page to follow this application"
                            onClick={() => void navigator.clipboard?.writeText(a.statusLink!).then(() => toast("Status link copied", "success"))}
                          >
                            <Link2 aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      {move.error === null && add.error === null ? null : (
        <p className="error" role="alert">
          {failure(move.error ?? add.error)}
        </p>
      )}
      {sending ? <SendTest client={client} id={id} count={atApplied} onClose={() => setSending(false)} onSent={refresh} /> : null}
      {editing !== null && editing !== "new" ? <DriveForm client={client} drive={editing} onClose={onEdited} onSaved={() => undefined} /> : null}
    </>
  );
}

function SendTest({ client, id, count, onClose, onSent }: { client: ConsoleClient; id: string; count: number; onClose: () => void; onSent: () => void }) {
  const toast = useToast();
  const [channels, setChannels] = useState<readonly Channel[]>(["email"]);
  const send = useMutation({
    mutationFn: () => client.sendDriveTest(id, channels),
    onSuccess: ({ invited, skipped }) => {
      toast(`Test sent to ${invited}${skipped > 0 ? `; ${skipped} already had it` : ""}`, "success");
      onSent();
      onClose();
    },
  });
  const toggle = (c: Channel) => setChannels(channels.includes(c) ? channels.filter((x) => x !== c) : [...channels, c]);
  return (
    <Drawer label="Send the drive's test" onClose={onClose}>
      <h2 className="dialog-title">Send the test to {count} students</h2>
      <p className="notice">Each student at Applied gets their own link to the drive's test, on its window, and moves to Test. Anyone already invited to it keeps their link.</p>
      <fieldset className="row channels">
        <legend className="visually-hidden">Send the links by</legend>
        {(["email", "sms", "whatsapp"] as const).map((c) => (
          <label key={c} className="inline">
            <input type="checkbox" checked={channels.includes(c)} onChange={() => toggle(c)} /> {c === "email" ? "Email" : c === "sms" ? "SMS" : "WhatsApp"}
          </label>
        ))}
      </fieldset>
      {send.error === null ? null : (
        <p className="error" role="alert">
          {failure(send.error)}
        </p>
      )}
      <div className="dialog-actions">
        <button type="button" className="quiet" onClick={onClose}>
          Cancel
        </button>
        <button type="button" disabled={channels.length === 0 || send.isPending} onClick={() => send.mutate()}>
          <Send aria-hidden="true" />
          Send to {count}
        </button>
      </div>
    </Drawer>
  );
}

// --- readiness ----------------------------------------------------------------------

/** A cell's band, for its colour: the same five steps everywhere a percentage is shaded. */
const band = (percent: number) => (percent < 40 ? 0 : percent < 55 ? 1 : percent < 70 ? 2 : percent < 85 ? 3 : 4);

function ReadinessView({ client }: { client: ConsoleClient }) {
  const students = useQuery({ queryKey: ["students"], queryFn: () => client.students() });
  const [batch, setBatch] = useState<number | undefined>(undefined);
  const readiness = useQuery({ queryKey: ["readiness", batch ?? "all"], queryFn: () => client.readiness(batch) });
  const batches = [...new Set((students.data ?? []).map((s) => s.batch).filter((b): b is number => b !== null))].sort();
  const data = readiness.data;
  return (
    <>
      <section className="card" aria-label="Readiness by branch and topic">
        <div className="bar filter-bar">
          <div className="chips" role="group" aria-label="Batch">
            <button type="button" className="chip" aria-pressed={batch === undefined} onClick={() => setBatch(undefined)}>
              All batches
            </button>
            {batches.map((b) => (
              <button key={b} type="button" className="chip" aria-pressed={batch === b} onClick={() => setBatch(b)}>
                {b}
              </button>
            ))}
          </div>
          <span className="spacer" />
          <span className="notice">{data === undefined ? "" : `From ${data.exams.length} recent test${data.exams.length === 1 ? "" : "s"}: ${data.exams.map((e) => e.title).join(", ")}`}</span>
        </div>
        {readiness.isPending ? (
          <SkeletonRows rows={4} columns={5} label="Reading results…" />
        ) : data === undefined || data.branches.length === 0 ? (
          <EmptyState icon={Users}>Once your students have sat a graded test, each branch shows here topic by topic. Add students first, so their branch is known.</EmptyState>
        ) : (
          <div className="scroll">
            <table className="heatmap">
              <thead>
                <tr>
                  <th scope="col">Branch</th>
                  <th scope="col" className="num">
                    Students
                  </th>
                  {data.topics.map((t) => (
                    <th key={t} scope="col" className="num">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.branches.map((b) => (
                  <tr key={b.branch}>
                    <th scope="row">{b.branch}</th>
                    <td className="num">{b.students}</td>
                    {data.topics.map((t) => {
                      const cell = b.cells[t];
                      return cell === undefined ? (
                        <td key={t} className="num notice">
                          —
                        </td>
                      ) : (
                        <td key={t} className={`num heat-${band(cell.percent)}`} title={`${cell.students} students`}>
                          {Math.round(cell.percent)}%
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="notice">Average percentage of the marks on offer. A topic is where the question is filed in the question bank, else the section it came from.</p>
      </section>
      {data === undefined || data.atRisk.length === 0 ? null : (
        <section className="card" aria-label="Students who need help">
          <div className="bar">
            <strong>Below 40% overall</strong>
            <span className="notice">{data.atRisk.length} students, weakest topic first to work on</span>
          </div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Roll no.</th>
                  <th scope="col">Name</th>
                  <th scope="col">Branch</th>
                  <th scope="col" className="num">
                    Overall
                  </th>
                  <th scope="col">Weakest topic</th>
                </tr>
              </thead>
              <tbody>
                {data.atRisk.map((r) => (
                  <tr key={r.ref}>
                    <td className="mono">{r.ref}</td>
                    <td>{r.name || "—"}</td>
                    <td>{r.branch}</td>
                    <td className="num failed">{Math.round(r.percent)}%</td>
                    <td>{r.weakest}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

/** The drive's public link: students apply with their roll number and the email on file. */
function ApplyLink({ client, id, link, openToNew, onChange }: { client: ConsoleClient; id: string; link: string | null; openToNew: boolean; onChange: () => void }) {
  const toast = useToast();
  const [offCampus, setOffCampus] = useState(openToNew);
  const set = useMutation({
    mutationFn: (open: boolean) => client.setApplyLink(id, open, offCampus),
    onSuccess: async ({ link: made }) => {
      onChange();
      if (made !== null) {
        await navigator.clipboard?.writeText(made).catch(() => undefined);
        toast("Link copied: share it with students", "success");
      }
    },
  });
  const alert = useMutation({
    mutationFn: () => client.alertDrive(id),
    onSuccess: ({ queued, already, unreachable }) =>
      toast(
        [`${queued} eligible ${queued === 1 ? "student" : "students"} told`, already > 0 ? `${already} already told` : "", unreachable > 0 ? `${unreachable} with no email or phone` : ""].filter((p) => p !== "").join(" · "),
        "success",
      ),
    onError: (error) => toast(failure(error), "error"),
  });
  return (
    <section className="card" aria-label="Link to apply">
      <div className="bar">
        <Link2 aria-hidden="true" />
        <strong>Link to apply</strong>
        <span className="notice">{link === null ? "Students can apply themselves from a link, with their roll number and the email on file." : `Open${openToNew ? ", also to students not on your list" : ""}.`}</span>
        <span className="spacer" />
        {link === null ? (
          <>
            <label className="inline">
              <input type="checkbox" checked={offCampus} onChange={(e) => setOffCampus(e.target.checked)} /> Off-campus: take people not on the list
            </label>
            <button type="button" onClick={() => set.mutate(true)} disabled={set.isPending}>
              Open the link
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={alert.isPending} onClick={() => alert.mutate()}>
              <Send aria-hidden="true" />
              Tell eligible students
            </button>
            <button type="button" className="secondary" onClick={() => void navigator.clipboard?.writeText(link).then(() => toast("Link copied", "success"))}>
              <Copy aria-hidden="true" />
              Copy the link
            </button>
            <button type="button" className="quiet" onClick={() => set.mutate(false)} disabled={set.isPending}>
              Close it
            </button>
          </>
        )}
      </div>
      {link === null ? null : <p className="mono notice">{link}</p>}
    </section>
  );
}

// --- the year-wise placement report -------------------------------------------------

function ReportView({ client }: { client: ConsoleClient }) {
  const report = useQuery({ queryKey: ["placement-report"], queryFn: () => client.placementReport() });
  const download = useMutation({ mutationFn: () => client.placementReportFile().then((blob) => save(blob, "placement-report.csv")) });
  const n = (v: number | null) => (v === null ? "—" : v.toLocaleString("en-IN", { maximumFractionDigits: 2 }));
  return (
    <>
      <PageActions>
        <button type="button" className="secondary" onClick={() => download.mutate()} disabled={download.isPending}>
          <Download aria-hidden="true" />
          Download CSV
        </button>
      </PageActions>
      {report.isPending ? (
        <section className="card">
          <SkeletonRows rows={4} columns={7} label="Counting offers…" />
        </section>
      ) : (report.data?.batches ?? []).length === 0 ? (
        <section className="card">
          <EmptyState icon={BriefcaseBusiness}>Add your students and record offers in drives: the report counts itself.</EmptyState>
        </section>
      ) : (
        (report.data?.batches ?? []).map((b) => (
          <section key={String(b.batch)} className="card" aria-label={`Passing in ${b.batch ?? "an unknown year"}`}>
            <div className="bar">
              <strong>Passing in {b.batch ?? "—"}</strong>
              <span className="notice">
                {b.placed} of {b.students} placed ({b.percent}%) · median ₹{n(b.medianLpa)} LPA · highest ₹{n(b.highestLpa)} LPA
              </span>
            </div>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Branch</th>
                    <th scope="col" className="num">
                      Students
                    </th>
                    <th scope="col" className="num">
                      Placed
                    </th>
                    <th scope="col" className="num">
                      %
                    </th>
                    <th scope="col" className="num">
                      Median (LPA)
                    </th>
                    <th scope="col" className="num">
                      Highest
                    </th>
                    <th scope="col" className="num">
                      Average
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {b.branches.map((r) => (
                    <tr key={r.branch}>
                      <th scope="row">{r.branch}</th>
                      <td className="num">{r.students}</td>
                      <td className="num">{r.placed}</td>
                      <td className="num">{r.percent}</td>
                      <td className="num">{n(r.medianLpa)}</td>
                      <td className="num">{n(r.highestLpa)}</td>
                      <td className="num">{n(r.averageLpa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
      <p className="notice">Placed means an offer, or joined, in any drive here; the package is each student's best offer. Higher studies are not tracked here.</p>
    </>
  );
}
