import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Mail, MessageSquare, RotateCw, Send, UserX, Users } from "lucide-react";
import type { ExamProblem } from "@parikshaa/core/browser";
import { Tooltip, useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type Channel, type ConsoleClient, type Delivery, type ImportResult, type InvitationRow } from "../api.ts";
import { Banner, DropZone, EmptyState, PageActions, RowMenu, SkeletonRows, StateBadge } from "./kit.tsx";

/**
 * A sitting: when it runs, who is invited, and whether each has their link
 * (ROADMAP §5). Nobody clicks Start two thousand times.
 */

const IST = "Asia/Kolkata";
const when = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: IST, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

/** An instant as a datetime-local value on India's clock, whatever the browser's own zone. */
const toIst = (iso: string) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts["year"]}-${parts["month"]}-${parts["day"]}T${parts["hour"]}:${parts["minute"]}`;
};
/** A datetime-local value read as IST. */
const fromIst = (local: string) => new Date(`${local}:00+05:30`).toISOString();

const SAMPLE = [
  "roll_number,name,email,phone,opens_at,closes_at",
  "CS001,Ananya Iyer,ananya.iyer@college.edu.in,98765 43210,,",
  "CS002,Rohan Das,rohan.das@college.edu.in,+91 91234 56780,,",
  "CS003,Meera Pillai,,98450 12345,2026-10-01 14:00,2026-10-01 16:00",
].join("\n");

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** One line of a spreadsheet saved as CSV, quotes and all. */
function cellsOf(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      cells.push(cell);
      cell = "";
    } else cell += c;
  }
  return [...cells, cell];
}

const DELIVERY_WORDS: Record<string, string> = { sent: "sent", failed: "failed", skipped: "not sent", pending: "waiting", sending: "sending" };
/** Which message the icon is about: the invitation itself, or one of its reminders. */
const PURPOSE_WORDS: Record<string, string> = { invite: "", reminder: "reminder ", reminder_day: "reminder " };

/** Email and SMS as two small icons, each coloured by how its delivery went; what went wrong is in a tooltip. */
function DeliveryIcons({ row }: { row: InvitationRow }) {
  const icon = (channel: Channel, d: Delivery) => {
    const Icon = channel === "email" ? Mail : MessageSquare;
    const tone = d.status === "sent" ? "ok" : d.status === "failed" || d.status === "skipped" ? "bad" : "pending";
    const words = `${channel === "email" ? "Email" : "SMS"} ${PURPOSE_WORDS[d.purpose] ?? ""}${DELIVERY_WORDS[d.status] ?? d.status}`;
    const mark = (
      <span className={`delivery-icon ${tone}`} role="img" aria-label={d.error === null ? words : `${words}: ${d.error}`} tabIndex={d.error === null ? undefined : 0}>
        <Icon aria-hidden="true" />
      </span>
    );
    return d.error === null ? (
      <span key={channel}>{mark}</span>
    ) : (
      <Tooltip key={channel} text={d.error}>
        {mark}
      </Tooltip>
    );
  };
  const shown = (["email", "sms"] as const).filter((c) => row.delivery[c] !== null);
  return shown.length === 0 ? <span className="notice">—</span> : <span className="delivery">{shown.map((c) => icon(c, row.delivery[c]!))}</span>;
}

export function Candidates({ client, examId, canInvite }: { client: ConsoleClient; examId: string; canInvite: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const window = useQuery({ queryKey: ["window", examId], queryFn: () => client.getWindow(examId) });
  const invitations = useQuery({
    queryKey: ["invitations", examId],
    queryFn: () => client.listInvitations(examId),
    refetchInterval: 30_000,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["invitations", examId] });

  const resend = useMutation({
    mutationFn: (row: InvitationRow) => client.resendInvitation(row.id, ["email", "sms"]),
    onSuccess: (_, row) => toast(`Link sent again to ${row.candidateRef}`, "success"),
    onSettled: refresh,
  });
  const revoke = useMutation({
    mutationFn: (row: InvitationRow) => client.revokeInvitation(row.id),
    onSuccess: (_, row) => toast(`${row.candidateRef}'s invitation withdrawn`, "success"),
    onSettled: refresh,
  });
  const download = useMutation({ mutationFn: () => client.invitationLinks(examId), onSuccess: (blob) => save(blob, `${examId}-links.csv`) });

  const rows = invitations.data ?? [];
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    const key = r.revoked ? "withdrawn" : r.attemptState;
    return { ...acc, [key]: (acc[key] ?? 0) + 1 };
  }, {});
  const WORDS: Record<string, string> = { not_started: "not started", in_progress: "in progress", submitted: "to grade", graded: "graded", void: "set aside", withdrawn: "withdrawn" };

  return (
    <>
      {canInvite && rows.length > 0 ? (
        <PageActions>
          <button type="button" className="secondary" disabled={download.isPending} onClick={() => download.mutate()}>
            <Download aria-hidden="true" />
            Download links
          </button>
        </PageActions>
      ) : null}
      {[resend.error, revoke.error, download.error].some((e) => e !== null) ? (
        <Banner tone="danger" title="That did not go through.">
          Try again; if it keeps failing, the audit log records what was attempted.
        </Banner>
      ) : null}

      {window.data === undefined ? null : <WindowForm client={client} examId={examId} initial={window.data} canEdit={canInvite} />}

      {canInvite ? <Importer client={client} examId={examId} onImported={refresh} hasWindow={window.data !== null && window.data !== undefined} /> : null}

      <section className="card" aria-label="Invited candidates">
        <div className="bar">
          <strong>Invited</strong>
          <span className="notice">
            {rows.length} candidates
            {Object.keys(counts).length === 0 ? "" : ` · ${Object.entries(counts).map(([k, n]) => `${n} ${WORDS[k] ?? k}`).join(" · ")}`}
          </span>
        </div>
        {invitations.isPending ? (
          <SkeletonRows columns={5} label="Loading invitations…" />
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} compact>
            Candidates appear here once invited from a spreadsheet, each with whether their link reached them.
          </EmptyState>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Roll no.</th>
                  <th scope="col">Name</th>
                  <th scope="col">Window (IST)</th>
                  <th scope="col">Delivery</th>
                  <th scope="col">State</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={row.revoked ? "withdrawn" : undefined}>
                    <td className="mono">{row.candidateRef}</td>
                    <td>{row.name}</td>
                    <td className="notice">
                      {when(row.opensAt)} – {when(row.closesAt)}
                    </td>
                    <td>
                      <DeliveryIcons row={row} />
                    </td>
                    <td>{row.revoked ? <span className="pill">Withdrawn</span> : <StateBadge state={row.attemptState} />}</td>
                    <td className="row-end">
                      <RowMenu
                        of={row.candidateRef}
                        keepPlace
                        items={[
                          canInvite && !row.revoked && row.attemptState === "not_started" && { label: "Resend the link", icon: <RotateCw />, onSelect: () => resend.mutate(row) },
                          canInvite &&
                            !row.revoked &&
                            row.attemptState === "not_started" && { label: "Withdraw the invitation", icon: <UserX />, onSelect: () => revoke.mutate(row), danger: true },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function WindowForm({
  client,
  examId,
  initial,
  canEdit,
}: {
  client: ConsoleClient;
  examId: string;
  initial: { opensAt: string; closesAt: string; hardClose: boolean } | null;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [opensAt, setOpensAt] = useState(initial === null ? "" : toIst(initial.opensAt));
  const [closesAt, setClosesAt] = useState(initial === null ? "" : toIst(initial.closesAt));
  const [hardClose, setHardClose] = useState(initial?.hardClose ?? true);
  const save = useMutation({
    mutationFn: () => client.setWindow(examId, { opensAt: fromIst(opensAt), closesAt: fromIst(closesAt), hardClose }),
    onSuccess: async () => {
      toast(initial === null ? "Scheduled" : "Rescheduled", "success");
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["window", examId] }), queryClient.invalidateQueries({ queryKey: ["exams"] })]);
    },
  });
  const backwards = opensAt !== "" && closesAt !== "" && closesAt <= opensAt;

  return (
    <section className="card" aria-label="Schedule">
      <h2 className="card-title">When candidates can take it</h2>
      <div className="grid">
        <div className="field">
          <label htmlFor="opens-at">Opens (IST)</label>
          <input id="opens-at" type="datetime-local" value={opensAt} disabled={!canEdit} onChange={(e) => setOpensAt(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="closes-at">Closes (IST)</label>
          <input id="closes-at" type="datetime-local" value={closesAt} disabled={!canEdit} onChange={(e) => setClosesAt(e.target.value)} aria-invalid={backwards} />
          {backwards ? <p className="error">It must close after it opens.</p> : null}
        </div>
      </div>
      <label className="inline">
        <input type="checkbox" checked={hardClose} disabled={!canEdit} onChange={(e) => setHardClose(e.target.checked)} /> End every attempt when the window
        closes, however late it was started
      </label>
      {canEdit ? (
        <div className="row">
          <button type="button" disabled={save.isPending || opensAt === "" || closesAt === "" || backwards} onClick={() => save.mutate()}>
            {initial === null ? "Schedule" : "Reschedule"}
          </button>
          {save.error === null ? null : <span className="error">{save.error instanceof ConsoleError ? (save.error.detail ?? "That did not save.") : "That did not save."}</span>}
        </div>
      ) : null}
    </section>
  );
}

function Importer({
  client,
  examId,
  onImported,
  hasWindow,
}: {
  client: ConsoleClient;
  examId: string;
  onImported: () => void;
  hasWindow: boolean;
}) {
  const [csv, setCsv] = useState<string | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [channels, setChannels] = useState<readonly Channel[]>(["email", "sms"]);
  const [preview, setPreview] = useState<Extract<ImportResult, { dryRun: true }> | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [problems, setProblems] = useState<readonly ExamProblem[]>([]);

  const check = useMutation({
    mutationFn: (text: string) => client.importCandidates(examId, text, true, channels),
    onSuccess: (result) => {
      if (result.dryRun) setPreview(result);
    },
  });
  const commit = useMutation({
    mutationFn: () => client.importCandidates(examId, csv!, false, channels),
    onSuccess: (result) => {
      if (!result.dryRun) setDone(`Invited ${result.invited}. Their links are on their way.`);
      setPreview(null);
      setCsv(null);
      setFile(null);
      onImported();
    },
    onError: (error) => setProblems(error instanceof ConsoleError ? error.problems : []),
  });

  const toggle = (c: Channel) => setChannels(channels.includes(c) ? channels.filter((x) => x !== c) : [...channels, c]);
  // The rows the check objected to, as the sheet has them, each with its reason.
  const lines = csv === null ? [] : csv.split(/\r?\n/);
  const flagged =
    preview === null
      ? []
      : [...preview.problems.map((p) => ({ ...p, kind: "problem" as const })), ...preview.warnings.map((p) => ({ ...p, kind: "warning" as const }))].sort(
          (a, b) => a.row - b.row,
        );

  return (
    <section className="card" aria-label="Invite candidates">
      <div className="bar">
        <h2 className="card-title">Invite from a spreadsheet</h2>
        <span className="spacer" />
        <button type="button" className="quiet" onClick={() => save(new Blob([SAMPLE], { type: "text/csv" }), "candidates-sample.csv")}>
          <Download aria-hidden="true" />
          Download a sample sheet
        </button>
      </div>
      <p className="notice">
        One candidate per row: <span className="mono">roll_number</span> (or ref), <span className="mono">name</span>, <span className="mono">email</span>,{" "}
        <span className="mono">phone</span>, and optionally <span className="mono">opens_at</span> / <span className="mono">closes_at</span> for a narrower window,
        read as IST. Nothing is sent until you confirm. Each candidate then gets their link at once, a reminder the day before their window opens,
        and another an hour before; a candidate who has already begun is not reminded.
        {hasWindow ? null : " Schedule the exam first, or give every candidate their own window."}
      </p>
      <DropZone
        label="Choose a spreadsheet saved as CSV"
        name="Candidate list (CSV)"
        accept=".csv,text/csv"
        chosen={file}
        hint="Checked first: you see who would be invited, and any problems, before anything is sent."
        onFile={async (chosen) => {
          const text = await chosen.text();
          setCsv(text);
          setFile(chosen.name);
          setDone(null);
          setProblems([]);
          check.mutate(text);
        }}
      />
      <fieldset className="row channels">
        <legend className="visually-hidden">Send the links by</legend>
        <span className="notice">Send the links by</span>
        <label className="inline">
          <input type="checkbox" checked={channels.includes("email")} onChange={() => toggle("email")} /> Email
        </label>
        <label className="inline">
          <input type="checkbox" checked={channels.includes("sms")} onChange={() => toggle("sms")} /> SMS
        </label>
      </fieldset>

      {preview === null ? null : (
        <div aria-label="Import preview" role="group" className="import-preview">
          {preview.problems.length > 0 ? (
            <Banner tone="danger" title={`${preview.problems.length} ${preview.problems.length === 1 ? "row needs" : "rows need"} fixing before anyone is invited.`}>
              Fix the file and choose it again.
            </Banner>
          ) : (
            <p>
              <strong>{preview.candidates} candidates ready to invite.</strong>
            </p>
          )}
          {flagged.length === 0 ? null : (
            <div className="scroll">
              <table className="import-rows">
                <thead>
                  <tr>
                    <th scope="col" className="num">
                      Row
                    </th>
                    <th scope="col">As the sheet has it</th>
                    <th scope="col">What is wrong</th>
                  </tr>
                </thead>
                <tbody>
                  {flagged.map((p) => (
                    <tr key={`${p.kind}${p.row}${p.message}`} className={p.kind}>
                      <td className="num mono">{p.row}</td>
                      <td className="mono sheet-cells">{p.row >= 2 && lines[p.row - 1] !== undefined ? cellsOf(lines[p.row - 1]!).filter((c) => c !== "").join(" · ") : "—"}</td>
                      <td>
                        <span className="visually-hidden">row {p.row} — </span>
                        {p.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview.problems.length === 0 ? (
            <div className="row">
              <button type="button" disabled={commit.isPending || channels.length === 0} onClick={() => commit.mutate()}>
                <Send aria-hidden="true" />
                Invite {preview.candidates} and send their links
              </button>
              <button
                type="button"
                className="quiet"
                onClick={() => {
                  setPreview(null);
                  setFile(null);
                }}
              >
                Cancel
              </button>
            </div>
          ) : null}
        </div>
      )}
      {problems.length === 0 ? null : (
        <ul className="problems">
          {problems.map((p) => (
            <li key={`${p.path}${p.message}`}>
              <span className="mono">{p.path}</span> — {p.message}
            </li>
          ))}
        </ul>
      )}
      {done === null ? null : (
        <p className="notice" role="status">
          {done}
        </p>
      )}
    </section>
  );
}
