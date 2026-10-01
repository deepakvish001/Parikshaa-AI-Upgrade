import { useEffect, useState } from "react";
import { BriefcaseBusiness, CheckCircle2, CircleX, Loader, Users } from "lucide-react";
import { GateShell } from "./Chrome.tsx";
import "./PublicPages.css";

/**
 * Pages opened from a link by someone with no account here: a hiring
 * manager's shortlist, and a placement drive's page to apply. They are written in English, for the companies and
 * recruiters who open them, and load only when such a link is opened.
 */

type Decision = "shortlist" | "hold" | "reject";

interface ShortlistView {
  readonly institution: string;
  readonly examTitle: string;
  readonly title: string;
  readonly expiresAt: string;
  readonly candidates: readonly {
    readonly ref: string;
    readonly name: string;
    readonly percent: number | null;
    readonly outcome: "qualified" | "failed" | null;
    readonly sections: readonly { readonly title: string; readonly percent: number | null }[];
    readonly decision: Decision | null;
    readonly comment: string;
    readonly decidedBy: string | null;
  }[];
}

const DECISIONS: readonly [Decision, string][] = [
  ["shortlist", "Shortlist"],
  ["hold", "Hold"],
  ["reject", "Reject"],
];

const BY_KEY = "parikshaa.shortlist.by";
const remembered = () => {
  try {
    return localStorage.getItem(BY_KEY) ?? "";
  } catch {
    return "";
  }
};

function Problem({ title, note }: { title: string; note: string }) {
  return (
    <GateShell width="narrow">
      <section className="gate-card status-card" aria-label="Shortlist">
        <CircleX className="status-icon bad" aria-hidden="true" />
        <h1>{title}</h1>
        <p className="notice">{note}</p>
      </section>
    </GateShell>
  );
}

export function ShortlistPage({ code }: { readonly code: string }) {
  const [view, setView] = useState<ShortlistView | { error: string } | null>(null);
  const [by, setBy] = useState(remembered);
  const [saving, setSaving] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const url = `/api/shortlists/view/${encodeURIComponent(code)}`;

  const load = async () => {
    const response = await fetch(url);
    const body = (await response.json().catch(() => ({}))) as ShortlistView & { error?: string };
    setView(response.ok ? body : { error: body.error ?? "unknown" });
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (view === null) {
    return (
      <GateShell width="narrow">
        <section className="gate-card status-card" aria-busy="true" aria-label="Shortlist">
          <Loader className="status-icon spin" aria-hidden="true" />
          <h1>Opening the shortlist…</h1>
        </section>
      </GateShell>
    );
  }
  if ("error" in view) {
    return view.error === "shortlist_expired" ? (
      <Problem title="This shortlist has expired" note="Ask the recruiter who sent it for a new link." />
    ) : view.error === "shortlist_withdrawn" ? (
      <Problem title="This shortlist was withdrawn" note="The recruiter has taken this link back. Ask them for the current one." />
    ) : (
      <Problem title="This link is not a shortlist" note="Check that the whole link was copied." />
    );
  }

  const decide = async (ref: string, decision: Decision) => {
    if (by.trim() === "") return;
    setSaving(ref);
    try {
      localStorage.setItem(BY_KEY, by.trim());
    } catch {
      // Remembering the name is a convenience only.
    }
    await fetch(`${url}/decisions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ref, decision, comment: comments[ref] ?? "", by: by.trim() }) });
    await load();
    setSaving(null);
  };
  const expires = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" }).format(new Date(view.expiresAt));
  const counts = DECISIONS.map(([d, label]) => `${view.candidates.filter((c) => c.decision === d).length} ${label.toLowerCase()}`).join(" · ");

  return (
    <GateShell width="full">
      <section className="gate-card public-page" aria-label="Shortlist">
        <p className="notice">
          {view.institution} · {view.examTitle}
        </p>
        <h1>
          <Users aria-hidden="true" className="inline-icon" /> {view.title}
        </h1>
        <p className="notice">
          {view.candidates.length} candidates · {counts} · this link works until {expires}. Marks only: answers and contact details stay with the recruiter.
        </p>
        <label className="field public-by">
          Your name, recorded with each decision
          <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="e.g. Priya, Engineering Manager" />
        </label>
        <div className="scroll">
          <table className="shortlist-table">
            <thead>
              <tr>
                <th scope="col">Candidate</th>
                <th scope="col" className="num">
                  Score
                </th>
                <th scope="col">Sections</th>
                <th scope="col">Comment</th>
                <th scope="col">Decision</th>
              </tr>
            </thead>
            <tbody>
              {view.candidates.map((c) => (
                <tr key={c.ref}>
                  <td>
                    <strong>{c.name || c.ref}</strong>
                    <div className="notice mono">{c.ref}</div>
                  </td>
                  <td className={`num${c.outcome === "qualified" ? " good" : c.outcome === "failed" ? " bad" : ""}`}>{c.percent === null ? "—" : `${c.percent}%`}</td>
                  <td className="notice">{c.sections.length === 0 ? "—" : c.sections.map((s) => `${s.title} ${s.percent ?? "—"}%`).join(" · ")}</td>
                  <td>
                    <input
                      aria-label={`Comment on ${c.ref}`}
                      value={comments[c.ref] ?? c.comment}
                      onChange={(e) => setComments({ ...comments, [c.ref]: e.target.value })}
                      placeholder={c.decidedBy === null ? "Optional" : `By ${c.decidedBy}`}
                    />
                  </td>
                  <td>
                    <div className="decision" role="group" aria-label={`Decision on ${c.ref}`}>
                      {DECISIONS.map(([d, label]) => (
                        <button
                          key={d}
                          type="button"
                          className={`chip ${d}`}
                          aria-pressed={c.decision === d}
                          disabled={by.trim() === "" || saving === c.ref}
                          onClick={() => void decide(c.ref, d)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {by.trim() === "" ? <p className="notice">Enter your name above to decide.</p> : null}
      </section>
    </GateShell>
  );
}

interface PublicDrive {
  readonly institution: string;
  readonly company: string;
  readonly role: string;
  readonly ctcLpa: number | null;
  readonly location: string;
  readonly description: string;
  readonly applyBy: string | null;
  readonly eligibility: { readonly minCgpa?: number; readonly maxBacklogs?: number; readonly branches?: readonly string[]; readonly batches?: readonly number[] };
  readonly openToNew: boolean;
  readonly closed: boolean;
}

function who(e: PublicDrive["eligibility"]): string {
  const parts = [
    e.minCgpa === undefined ? null : `CGPA ${e.minCgpa} or more`,
    e.maxBacklogs === undefined ? null : e.maxBacklogs === 0 ? "no active backlogs" : `at most ${e.maxBacklogs} backlogs`,
    e.branches === undefined || e.branches.length === 0 ? null : e.branches.join(", "),
    e.batches === undefined || e.batches.length === 0 ? null : `passing in ${e.batches.join(" or ")}`,
  ].filter((p) => p !== null);
  return parts.length === 0 ? "Open to every student" : parts.join(" · ");
}

export function ApplyPage({ code }: { readonly code: string }) {
  const [drive, setDrive] = useState<PublicDrive | "missing" | null>(null);
  const [form, setForm] = useState({ ref: "", email: "", name: "", phone: "", branch: "", batch: "", cgpa: "", backlogs: "0" });
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const url = `/api/apply/${encodeURIComponent(code)}`;
  useEffect(() => {
    fetch(url).then(
      async (r) => setDrive(r.ok ? ((await r.json()) as PublicDrive) : "missing"),
      () => setDrive("missing"),
    );
  }, [url]);

  if (drive === null) {
    return (
      <GateShell width="narrow">
        <section className="gate-card status-card" aria-busy="true" aria-label="Apply">
          <Loader className="status-icon spin" aria-hidden="true" />
          <h1>Opening the drive…</h1>
        </section>
      </GateShell>
    );
  }
  if (drive === "missing") return <Problem title="This drive is not open to apply" note="The link may have been closed. Ask your placement cell for the current one." />;

  const submit = async () => {
    setSending(true);
    const number = (v: string) => (v.trim() === "" ? null : Number(v));
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ref: form.ref.trim(),
        email: form.email.trim(),
        ...(drive.openToNew ? { name: form.name, phone: form.phone.trim() === "" ? null : form.phone, branch: form.branch, batch: number(form.batch), cgpa: number(form.cgpa), backlogs: Number(form.backlogs) || 0 } : {}),
      }),
    }).catch(() => null);
    const body = (await response?.json().catch(() => ({}))) as { status?: string; message?: string };
    setResult(
      response?.ok === true
        ? { ok: true, text: body.status === "already" ? "You had already applied. Nothing more to do." : "You have applied. Your placement cell will tell you about the test." }
        : { ok: false, text: body.message ?? "That did not go through. Try again." },
    );
    setSending(false);
  };
  const field = (key: keyof typeof form, label: string, type = "text", required = false) => (
    <label className="field" key={key}>
      {label}
      <input type={type} required={required} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </label>
  );

  return (
    <GateShell width="reading">
      <section className="gate-card public-page" aria-label="Apply">
        <p className="notice">{drive.institution} · placement drive</p>
        <h1>
          <BriefcaseBusiness aria-hidden="true" className="inline-icon" /> {drive.company} — {drive.role}
        </h1>
        <dl className="drive-facts">
          {drive.ctcLpa === null ? null : (
            <div>
              <dt>Package</dt>
              <dd>₹{drive.ctcLpa} lakh a year</dd>
            </div>
          )}
          {drive.location === "" ? null : (
            <div>
              <dt>Location</dt>
              <dd>{drive.location}</dd>
            </div>
          )}
          <div>
            <dt>Who may apply</dt>
            <dd>{who(drive.eligibility)}</dd>
          </div>
          {drive.applyBy === null ? null : (
            <div>
              <dt>Apply by</dt>
              <dd>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(`${drive.applyBy}T00:00:00+05:30`))}</dd>
            </div>
          )}
        </dl>
        {drive.description === "" ? null : <p className="drive-description">{drive.description}</p>}
        {drive.closed ? (
          <p className="notice" role="status">
            Applications have closed.
          </p>
        ) : result?.ok === true ? (
          <p className="applied" role="status">
            <CheckCircle2 aria-hidden="true" className="inline-icon" /> {result.text}
          </p>
        ) : (
          <form
            aria-label="Your details"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {field("ref", "Roll number", "text", true)}
            {field("email", drive.openToNew ? "Email" : "Email (the one the college has)", "email", true)}
            {drive.openToNew ? (
              <>
                <p className="notice">If you are not on the college's list, tell us about yourself. The placement cell checks it.</p>
                {field("name", "Full name")}
                {field("phone", "Mobile", "tel")}
                {field("branch", "Branch")}
                {field("batch", "Year of passing", "number")}
                {field("cgpa", "CGPA (out of 10)", "number")}
                {field("backlogs", "Active backlogs", "number")}
              </>
            ) : null}
            {result === null ? null : (
              <p className="error" role="alert">
                {result.text}
              </p>
            )}
            <button type="submit" disabled={sending}>
              Apply
            </button>
          </form>
        )}
      </section>
    </GateShell>
  );
}
