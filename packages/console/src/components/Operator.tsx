import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building, Coins, Mail, Pause, Play, Plus, ShieldCheck } from "lucide-react";
import { useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type ConsoleClient, type NewOrg, type OperatorOrg } from "../api.ts";
import { EmptyState } from "./kit.tsx";
import "./Operator.css";

/**
 * Parikshaa's operator panel (docs/F1-GO-LIVE-PLAN.md §3, G1): every company
 * and college by its Company ID, opening one with its owner, pausing and
 * resuming it, giving credits, and sending the owner's invitation again.
 * Shown only to an operator; the server answers 404 to anyone else.
 */

const failure = (error: unknown) => (error instanceof ConsoleError && error.detail !== undefined ? error.detail : "That did not go through. Try again.");
const when = (iso: string | null) =>
  iso === null ? "—" : new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

export function OperatorPanel({ client }: { client: ConsoleClient }) {
  const list = useQuery({ queryKey: ["operator-companies"], queryFn: () => client.operatorOrgs(), retry: false });
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("");
  const needs2fa = list.error instanceof ConsoleError && list.error.code === "operator_needs_2fa";
  const rows = (list.data ?? []).filter((c) => {
    const q = filter.trim().toLowerCase();
    return q === "" || c.name.toLowerCase().includes(q) || c.publicId.toLowerCase().includes(q) || (c.owner?.email.toLowerCase().includes(q) ?? false);
  });
  return (
    <section className="card" aria-label="Companies">
      <div className="bar">
        <Building aria-hidden="true" />
        <strong>Companies and colleges</strong>
        <span className="notice">Every organisation on Parikshaa, by its Company ID.</span>
        <span className="spacer" />
        {needs2fa ? null : (
          <button type="button" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            New company
          </button>
        )}
      </div>
      {needs2fa ? (
        <p className="notice" role="alert">
          <ShieldCheck aria-hidden="true" /> {failure(list.error)}. Turn it on under Account.
        </p>
      ) : null}
      {list.error !== null && !needs2fa ? <p className="error">{failure(list.error)}</p> : null}
      {creating ? <NewOrgForm client={client} onDone={() => setCreating(false)} /> : null}
      {needs2fa ? null : <LibrarySeed client={client} />}
      {list.isPending ? <p className="notice">Loading…</p> : null}
      {list.isSuccess && list.data.length === 0 && !creating ? (
        <EmptyState icon={Building} action={{ label: "New company", onClick: () => setCreating(true), icon: Plus }}>
          No organisations yet.
        </EmptyState>
      ) : null}
      {list.isSuccess && list.data.length > 0 ? (
        <>
          <div className="field operator-filter">
            <label htmlFor="operator-filter">Find</label>
            <input id="operator-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Name, Company ID or owner's email" />
          </div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Company ID</th>
                  <th scope="col">Name</th>
                  <th scope="col">Owner</th>
                  <th scope="col" className="num">
                    Credits
                  </th>
                  <th scope="col" className="num">
                    Candidates
                  </th>
                  <th scope="col">Last active</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <CompanyRow key={c.id} client={client} company={c} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

/** File Parikshaa's built-in questions again: the API does it at start; this is for after a content change. */
function LibrarySeed({ client }: { client: ConsoleClient }) {
  const toast = useToast();
  const seed = useMutation({
    mutationFn: () => client.seedLibrary(),
    onSuccess: (r) => toast(`Library: ${r.added} added, ${r.updated} updated, ${r.unchanged} unchanged`, "success"),
  });
  return (
    <div className="row operator-library">
      <span className="notice">Parikshaa Library: Parikshaa's built-in questions are filed when the API starts.</span>
      <button type="button" className="secondary" disabled={seed.isPending} onClick={() => seed.mutate()}>
        File them now
      </button>
      {seed.error === null ? null : (
        <span className="error" role="alert">
          {failure(seed.error)}
        </span>
      )}
    </div>
  );
}

function CompanyRow({ client, company: c }: { client: ConsoleClient; company: OperatorOrg }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [doing, setDoing] = useState<"suspend" | "credits" | null>(null);
  const [reason, setReason] = useState("");
  const [credits, setCredits] = useState("");
  const [note, setNote] = useState("");
  const done = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ["operator-companies"] });
    setDoing(null);
    toast(message, "success");
  };
  const suspend = useMutation({ mutationFn: () => client.suspendOrg(c.publicId, reason.trim()), onSuccess: () => done(`${c.name} is paused`) });
  const resume = useMutation({ mutationFn: () => client.resumeOrg(c.publicId), onSuccess: () => done(`${c.name} is running again`) });
  const grant = useMutation({ mutationFn: () => client.grantOrgCredits(c.publicId, Number(credits), note.trim()), onSuccess: () => done(`${credits} credits given to ${c.name}`) });
  const invite = useMutation({ mutationFn: () => client.reinviteOwner(c.publicId), onSuccess: () => toast(`Invitation sent to ${c.owner?.email ?? "the owner"}`, "success") });
  const error = [suspend.error, resume.error, grant.error, invite.error].find((e) => e !== null);
  return (
    <>
      <tr>
        <td>
          <code>{c.publicId}</code>
        </td>
        <td>
          {c.name}
          <span className="notice small"> · {c.kind === "company" ? "company" : "college"}</span>
          {c.suspended === null ? null : (
            <span className="pill tone-bad" title={c.suspended.reason}>
              Paused
            </span>
          )}
        </td>
        <td>
          {c.owner === null ? (
            "—"
          ) : (
            <>
              {c.owner.name}
              <span className="notice small"> {c.owner.email}</span>
            </>
          )}
        </td>
        <td className="num">{c.credits ?? "invoiced"}</td>
        <td className="num">
          {c.started} / {c.invited}
        </td>
        <td>{when(c.lastActivity)}</td>
        <td className="operator-actions">
          {c.suspended === null ? (
            <button type="button" className="quiet" onClick={() => setDoing(doing === "suspend" ? null : "suspend")} aria-label={`Pause ${c.name}`}>
              <Pause aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className="quiet" disabled={resume.isPending} onClick={() => resume.mutate()} aria-label={`Resume ${c.name}`}>
              <Play aria-hidden="true" />
            </button>
          )}
          <button type="button" className="quiet" onClick={() => setDoing(doing === "credits" ? null : "credits")} aria-label={`Give credits to ${c.name}`}>
            <Coins aria-hidden="true" />
          </button>
          <button type="button" className="quiet" disabled={invite.isPending || c.owner === null} onClick={() => invite.mutate()} aria-label={`Send ${c.name}'s owner a new invitation`}>
            <Mail aria-hidden="true" />
          </button>
        </td>
      </tr>
      {doing === "suspend" ? (
        <tr>
          <td colSpan={7}>
            <form
              className="operator-inline"
              aria-label={`Pause ${c.name}`}
              onSubmit={(e) => {
                e.preventDefault();
                suspend.mutate();
              }}
            >
              <label htmlFor={`reason-${c.id}`}>Why (the owner is told)</label>
              <input id={`reason-${c.id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Invoice unpaid for 60 days" />
              <button type="submit" disabled={suspend.isPending || reason.trim().length < 3}>
                Pause
              </button>
            </form>
          </td>
        </tr>
      ) : null}
      {doing === "credits" ? (
        <tr>
          <td colSpan={7}>
            <form
              className="operator-inline"
              aria-label={`Give credits to ${c.name}`}
              onSubmit={(e) => {
                e.preventDefault();
                grant.mutate();
              }}
            >
              <label htmlFor={`credits-${c.id}`}>Credits</label>
              <input id={`credits-${c.id}`} inputMode="numeric" value={credits} onChange={(e) => setCredits(e.target.value.replace(/\D/g, ""))} />
              <label htmlFor={`note-${c.id}`}>Note</label>
              <input id={`note-${c.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Paid by NEFT, UTR …" />
              <button type="submit" disabled={grant.isPending || !(Number(credits) > 0) || note.trim().length < 3}>
                Give
              </button>
            </form>
          </td>
        </tr>
      ) : null}
      {error === undefined ? null : (
        <tr>
          <td colSpan={7}>
            <p className="error" role="alert">
              {failure(error)}
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

function NewOrgForm({ client, onDone }: { client: ConsoleClient; onDone: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<NewOrg>({ name: "", kind: "company", ownerName: "", ownerEmail: "", pricePerAttemptRupees: 99, invoiced: false, credits: 25 });
  const set = <K extends keyof NewOrg>(key: K, value: NewOrg[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const make = useMutation({
    mutationFn: () => client.createOrg({ ...draft, name: draft.name.trim(), ownerName: draft.ownerName.trim(), ownerEmail: draft.ownerEmail.trim() }),
    onSuccess: async (made) => {
      await queryClient.invalidateQueries({ queryKey: ["operator-companies"] });
      toast(`${made.name} is open as ${made.publicId}; ${made.owner?.email ?? "the owner"} has been sent a link`, "success");
      onDone();
    },
  });
  const ready = draft.name.trim().length >= 2 && draft.ownerName.trim() !== "" && draft.ownerEmail.includes("@") && draft.pricePerAttemptRupees > 0;
  return (
    <form
      className="operator-new"
      aria-label="New company"
      onSubmit={(e) => {
        e.preventDefault();
        make.mutate();
      }}
    >
      <div className="field">
        <label htmlFor="company-name">Name</label>
        <input id="company-name" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Zeta Labs" />
      </div>
      <div className="field">
        <label htmlFor="company-kind">Kind</label>
        <select id="company-kind" value={draft.kind} onChange={(e) => set("kind", e.target.value as NewOrg["kind"])}>
          <option value="company">Company (hiring)</option>
          <option value="institution">College</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="company-owner">Owner's name</label>
        <input id="company-owner" value={draft.ownerName} onChange={(e) => set("ownerName", e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="company-email">Owner's work email</label>
        <input id="company-email" type="email" value={draft.ownerEmail} onChange={(e) => set("ownerEmail", e.target.value)} />
        <p className="notice small">They get a link to set their password, valid seven days.</p>
      </div>
      <div className="field">
        <label htmlFor="company-price">Price per attempt (₹, before GST)</label>
        <input id="company-price" inputMode="decimal" value={String(draft.pricePerAttemptRupees)} onChange={(e) => set("pricePerAttemptRupees", Number(e.target.value) || 0)} />
      </div>
      <div className="field">
        <label htmlFor="company-credits">Credits to start with</label>
        <input id="company-credits" inputMode="numeric" value={String(draft.credits)} onChange={(e) => set("credits", Number(e.target.value.replace(/\D/g, "")) || 0)} />
      </div>
      <label className="check">
        <input type="checkbox" checked={draft.invoiced} onChange={(e) => set("invoiced", e.target.checked)} />
        Invoiced monthly (instead of prepaid)
      </label>
      {make.error === null ? null : (
        <p className="error" role="alert">
          {failure(make.error)}
        </p>
      )}
      <div className="row">
        <button type="button" className="quiet" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" disabled={make.isPending || !ready}>
          {make.isPending ? "Opening…" : "Open the account"}
        </button>
      </div>
    </form>
  );
}
