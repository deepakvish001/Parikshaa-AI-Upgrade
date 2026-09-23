import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConsoleError, type ConsoleClient, type Notice, type PrivacyDraft } from "../api.ts";

/**
 * Privacy (ROADMAP §11; the DPDP Act, 2023): the notice every candidate agrees
 * to before their clock starts, and how long their data is kept. Owner only.
 */

const EMPTY: PrivacyDraft = { controllerName: "", grievanceName: "", grievanceEmail: "", purpose: "", retentionDays: 180 };

export function PrivacyPanel({ client }: { client: ConsoleClient }) {
  const queryClient = useQueryClient();
  const current = useQuery({ queryKey: ["privacy"], queryFn: () => client.privacy() });
  const [draft, setDraft] = useState<PrivacyDraft>(EMPTY);
  useEffect(() => {
    const s = current.data?.settings;
    if (s != null) {
      setDraft({
        controllerName: s.controllerName,
        grievanceName: s.grievanceName,
        grievanceEmail: s.grievanceEmail,
        purpose: s.purpose,
        retentionDays: s.retentionDays,
      });
    }
  }, [current.data]);
  const save = useMutation({
    mutationFn: () => client.savePrivacy(draft),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["privacy"] });
    },
  });

  if (current.isPending) return <p className="notice">Loading…</p>;
  if (current.error !== null) return <p className="error">Could not load the privacy settings.</p>;
  const set = (field: keyof PrivacyDraft) => (e: { target: { value: string } }) =>
    setDraft({ ...draft, [field]: field === "retentionDays" ? Number(e.target.value) : e.target.value });

  return (
    <>
      <section className="card" aria-label="Privacy settings">
        <h2 style={{ marginTop: 0 }}>Privacy notice and retention</h2>
        {current.data.settings === null ? (
          <p className="notice">
            Not set yet. Until it is, candidates are not shown a notice and nothing is erased automatically — which the
            DPDP Act does not allow for real candidates.
          </p>
        ) : (
          <p className="notice">
            Notice version {current.data.settings.noticeVersion}. Changing the wording issues a new version; candidates
            who have already started keep the one they agreed to.
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid">
            <div className="field">
              <label htmlFor="controller">Organisation responsible for the data</label>
              <input id="controller" value={draft.controllerName} onChange={set("controllerName")} placeholder="e.g. Acme Technologies Pvt Ltd" />
            </div>
            <div className="field">
              <label htmlFor="retention">Erase personal data after (days)</label>
              <input id="retention" type="number" min={7} max={3650} value={draft.retentionDays} onChange={set("retentionDays")} />
            </div>
            <div className="field">
              <label htmlFor="grievance-name">Grievance officer</label>
              <input id="grievance-name" value={draft.grievanceName} onChange={set("grievanceName")} />
            </div>
            <div className="field">
              <label htmlFor="grievance-email">Grievance officer's email</label>
              <input id="grievance-email" type="email" value={draft.grievanceEmail} onChange={set("grievanceEmail")} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="purpose">Why the data is collected</label>
            <textarea id="purpose" value={draft.purpose} onChange={set("purpose")} placeholder="e.g. To assess candidates for engineering roles at Acme." />
          </div>
          <div className="row">
            <button type="submit" disabled={save.isPending}>
              Save
            </button>
            {save.isSuccess ? (
              <span className="notice" role="status">
                Saved.
              </span>
            ) : null}
            {save.error instanceof ConsoleError ? <span className="error">{save.error.detail ?? "That did not save."}</span> : null}
          </div>
        </form>
      </section>
      {current.data.notice === null ? null : <NoticePreview notice={current.data.notice} />}
    </>
  );
}

/** The notice as a candidate reads it, before they start. */
function NoticePreview({ notice }: { notice: Notice }) {
  return (
    <section className="card" aria-label="What candidates see">
      <strong>What candidates see before they start</strong>
      <p>
        <strong>{notice.controllerName}</strong> — {notice.purpose}
      </p>
      <ul className="pool">
        {notice.collected.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <p>Kept for {notice.retentionDays} days after the attempt closes, then erased.</p>
      <ul className="pool">
        {notice.rights.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="notice">
        Grievance officer: {notice.grievance.name} ({notice.grievance.email}) · version {notice.version} ·{" "}
        <span className="mono">{notice.hash.slice(0, 16)}…</span>
      </p>
    </section>
  );
}

/**
 * Erase one candidate's personal data, at their request. Irreversible, so it
 * asks for the reference to be typed back.
 */
export function EraseCard({ client, attemptId, reference, onErased }: { client: ConsoleClient; attemptId: string; reference: string; onErased: () => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const erase = useMutation({ mutationFn: () => client.eraseAttempt(attemptId), onSuccess: onErased });
  if (!open) {
    return (
      <div className="row no-print">
        <button type="button" className="quiet" onClick={() => setOpen(true)}>
          Erase personal data…
        </button>
      </div>
    );
  }
  return (
    <section className="card evidence no-print" aria-label="Erase personal data">
      <p style={{ marginTop: 0 }}>
        <strong>Erase this candidate's personal data?</strong> Their answers, replies, name, email, phone and reference
        become unreadable, permanently. The scores and the record's integrity stay. Use this when the candidate asks,
        or withdraws consent.
      </p>
      <label htmlFor="erase-confirm">Type {reference} to confirm</label>
      <input id="erase-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} />
      <div className="row">
        <button type="button" disabled={typed.trim() !== reference || erase.isPending} onClick={() => erase.mutate()}>
          Erase permanently
        </button>
        <button type="button" className="quiet" onClick={() => setOpen(false)}>
          Cancel
        </button>
        {erase.error instanceof ConsoleError ? <span className="error">{erase.error.detail ?? "That did not work."}</span> : null}
      </div>
    </section>
  );
}
