import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExamProblem } from "@parikshaa/core/browser";
import { ConsoleError, type Channel, type ConsoleClient, type ImportResult, type InvitationRow } from "../api.ts";

/**
 * A sitting: when it runs, who is invited, and whether each has their link
 * (ROADMAP §5). Nobody clicks Start two thousand times.
 */

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

/** An ISO time as a datetime-local value, in the browser's own zone. */
const toLocal = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const STATE: Record<InvitationRow["attemptState"], string> = {
  not_started: "not started",
  in_progress: "taking it",
  submitted: "submitted",
  graded: "graded",
  void: "set aside",
};

const deliveryLabel = (row: InvitationRow) => {
  const parts = (["email", "sms"] as const)
    .map((c) => (row.delivery[c] === null ? null : `${c === "email" ? "Email" : "SMS"} ${row.delivery[c]!.status}`))
    .filter((p): p is string => p !== null);
  return parts.length === 0 ? "—" : parts.join(" · ");
};

export function Candidates({ client, examId, canInvite }: { client: ConsoleClient; examId: string; canInvite: boolean }) {
  const queryClient = useQueryClient();
  const window = useQuery({ queryKey: ["window", examId], queryFn: () => client.getWindow(examId) });
  const invitations = useQuery({
    queryKey: ["invitations", examId],
    queryFn: () => client.listInvitations(examId),
    refetchInterval: 30_000,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["invitations", examId] });

  const resend = useMutation({ mutationFn: (id: string) => client.resendInvitation(id, ["email", "sms"]), onSettled: refresh });
  const revoke = useMutation({ mutationFn: (id: string) => client.revokeInvitation(id), onSettled: refresh });
  const download = useMutation({
    mutationFn: () => client.invitationLinks(examId),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${examId}-links.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const rows = invitations.data ?? [];
  const counts = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.attemptState]: (acc[r.attemptState] ?? 0) + 1 }), {});

  return (
    <>
      {window.data === undefined ? null : (
        <WindowForm client={client} examId={examId} initial={window.data} canEdit={canInvite} />
      )}

      {canInvite ? <Importer client={client} examId={examId} onImported={refresh} hasWindow={window.data !== null} /> : null}

      <section className="card" aria-label="Invited candidates">
        <div className="bar">
          <strong>Invited</strong>
          <span className="notice">
            {rows.length} candidates · {Object.entries(counts).map(([k, n]) => `${n} ${STATE[k as InvitationRow["attemptState"]]}`).join(" · ")}
          </span>
          <span className="spacer" />
          {canInvite && rows.length > 0 ? (
            <button type="button" className="secondary" onClick={() => download.mutate()}>
              Download links
            </button>
          ) : null}
        </div>
        {rows.length === 0 ? (
          <p className="notice">Nobody invited yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Ref</th>
                <th scope="col">Name</th>
                <th scope="col">Window</th>
                <th scope="col">Delivery</th>
                <th scope="col">Progress</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.candidateRef}</td>
                  <td>{row.name}</td>
                  <td className="notice">
                    {when(row.opensAt)} – {when(row.closesAt)}
                  </td>
                  <td className="notice" title={[row.delivery.email?.error, row.delivery.sms?.error].filter(Boolean).join("; ")}>
                    {deliveryLabel(row)}
                  </td>
                  <td>
                    <span className="pill" data-state={row.revoked ? "revoked" : row.attemptState}>{row.revoked ? "revoked" : STATE[row.attemptState]}</span>
                  </td>
                  <td>
                    {canInvite && !row.revoked && row.attemptState === "not_started" ? (
                      <>
                        <button type="button" className="quiet" onClick={() => resend.mutate(row.id)}>
                          Resend
                        </button>{" "}
                        <button type="button" className="quiet" onClick={() => revoke.mutate(row.id)}>
                          Revoke
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
  const [opensAt, setOpensAt] = useState(initial === null ? "" : toLocal(initial.opensAt));
  const [closesAt, setClosesAt] = useState(initial === null ? "" : toLocal(initial.closesAt));
  const [hardClose, setHardClose] = useState(initial?.hardClose ?? true);
  const save = useMutation({
    mutationFn: () =>
      client.setWindow(examId, {
        opensAt: new Date(opensAt).toISOString(),
        closesAt: new Date(closesAt).toISOString(),
        hardClose,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["window", examId] }),
  });

  return (
    <section className="card" aria-label="Schedule">
      <strong>When candidates can take it</strong>
      <div className="grid" style={{ marginTop: ".6rem" }}>
        <div className="field">
          <label htmlFor="opens-at">Opens</label>
          <input id="opens-at" type="datetime-local" value={opensAt} disabled={!canEdit} onChange={(e) => setOpensAt(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="closes-at">Closes</label>
          <input id="closes-at" type="datetime-local" value={closesAt} disabled={!canEdit} onChange={(e) => setClosesAt(e.target.value)} />
        </div>
      </div>
      <label className="inline">
        <input type="checkbox" checked={hardClose} disabled={!canEdit} onChange={(e) => setHardClose(e.target.checked)} style={{ width: "auto" }} /> End
        every attempt when the window closes, however late it was started
      </label>
      {canEdit ? (
        <div className="row">
          <button type="button" disabled={save.isPending || opensAt === "" || closesAt === "" || closesAt <= opensAt} onClick={() => save.mutate()}>
            {initial === null ? "Schedule" : "Reschedule"}
          </button>
          {save.isSuccess ? <span className="notice">Saved.</span> : null}
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
      onImported();
    },
    onError: (error) => setProblems(error instanceof ConsoleError ? error.problems : []),
  });

  const toggle = (c: Channel) => setChannels(channels.includes(c) ? channels.filter((x) => x !== c) : [...channels, c]);

  return (
    <section className="card" aria-label="Invite candidates">
      <strong>Invite from a spreadsheet</strong>
      <p className="notice">
        Save it as CSV with the columns <span className="mono">ref</span> (or roll_number), <span className="mono">name</span>,{" "}
        <span className="mono">email</span>, <span className="mono">phone</span>, and optionally <span className="mono">opens_at</span> /{" "}
        <span className="mono">closes_at</span> for a narrower window. Times are read as IST. Nothing is sent until you confirm.
        {hasWindow ? null : " Schedule the exam first, or give every candidate their own window."}
      </p>
      <div className="row">
        <label className="inline">
          <input type="checkbox" style={{ width: "auto" }} checked={channels.includes("email")} onChange={() => toggle("email")} /> Email
        </label>
        <label className="inline">
          <input type="checkbox" style={{ width: "auto" }} checked={channels.includes("sms")} onChange={() => toggle("sms")} /> SMS
        </label>
      </div>
      <div className="field" style={{ marginTop: ".6rem" }}>
        <label htmlFor="candidates-file">Candidate list (CSV)</label>
        <input
          id="candidates-file"
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file === undefined) return;
            const text = await file.text();
            setCsv(text);
            setDone(null);
            setProblems([]);
            check.mutate(text);
          }}
        />
      </div>

      {preview === null ? null : (
        <div aria-label="Import preview" role="group">
          <p>
            {preview.problems.length > 0
              ? `${preview.problems.length} problem${preview.problems.length === 1 ? "" : "s"}; fix the file and choose it again.`
              : `${preview.candidates} candidates ready to invite.`}
          </p>
          {[...preview.problems.map((p) => ({ ...p, kind: "problem" })), ...preview.warnings.map((p) => ({ ...p, kind: "warning" }))].length === 0 ? null : (
            <ul className="problems">
              {preview.problems.map((p) => (
                <li key={`p${p.row}${p.message}`}>
                  <span className="mono">row {p.row}</span> — {p.message}
                </li>
              ))}
              {preview.warnings.map((p) => (
                <li key={`w${p.row}${p.message}`} className="warning">
                  <span className="mono">row {p.row}</span> — {p.message}
                </li>
              ))}
            </ul>
          )}
          {preview.problems.length === 0 ? (
            <div className="row">
              <button type="button" disabled={commit.isPending} onClick={() => commit.mutate()}>
                Invite {preview.candidates} and send their links
              </button>
              <button type="button" className="quiet" onClick={() => setPreview(null)}>
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
      {done === null ? null : <p className="notice" role="status">{done}</p>}
    </section>
  );
}
