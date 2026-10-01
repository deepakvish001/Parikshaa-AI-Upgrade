import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Building2, Copy, HandCoins, Plus, Trash2 } from "lucide-react";
import { useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type ConsoleClient, type DriveApplication, type DriveCollege, type OfferFigures } from "../api.ts";

/**
 * A company's side of a drive (docs/PREP-TRACKER.md, V2-12: CO15, CO33):
 * partner colleges, each with its own link to apply, and offers sent with a
 * link the candidate answers — followed to joining.
 */

const failure = (error: unknown) => (error instanceof ConsoleError && error.detail !== undefined ? error.detail : "That did not go through. Try again.");
const RESPONSE = { accepted: "Accepted", declined: "Declined" } as const;

async function copy(text: string, toast: ReturnType<typeof useToast>, word: string) {
  await navigator.clipboard?.writeText(text).catch(() => undefined);
  toast(word, "success");
}

export function Colleges({ client, driveId, colleges, onChange }: { client: ConsoleClient; driveId: string; colleges: readonly DriveCollege[]; onChange: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const add = useMutation({
    mutationFn: () => client.addDriveCollege(driveId, { name, code }),
    onSuccess: async (made) => {
      setName("");
      setCode("");
      onChange();
      await copy(made.link, toast, `${made.name}'s link copied`);
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => client.removeDriveCollege(driveId, id), onSuccess: onChange });

  return (
    <section className="card" aria-label="Colleges in this drive">
      <div className="bar">
        <Building2 aria-hidden="true" />
        <strong>Colleges in this drive</strong>
        <span className="notice">One drive across many campuses: each college gets its own link, and its students' roll numbers carry its short code.</span>
      </div>
      <form
        className="row"
        aria-label="Add a college"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <input aria-label="College name" placeholder="College, e.g. NIT Tiruchirappalli" required value={name} onChange={(e) => setName(e.target.value)} />
        <input aria-label="Short code" placeholder="Short code, e.g. NITT" required maxLength={12} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <button type="submit" disabled={add.isPending}>
          <Plus aria-hidden="true" />
          Add and copy its link
        </button>
      </form>
      {add.error === null ? null : (
        <p className="error" role="alert">
          {failure(add.error)}
        </p>
      )}
      {colleges.length === 0 ? null : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">College</th>
                <th scope="col">Code</th>
                <th scope="col" className="num">
                  Applied
                </th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {colleges.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="mono">{c.code}</td>
                  <td className="num">{c.applied}</td>
                  <td>
                    <button type="button" className="quiet" onClick={() => void copy(c.link, toast, "Link copied")}>
                      <Copy aria-hidden="true" />
                      Copy link
                    </button>
                    <button type="button" className="quiet" aria-label={`Remove ${c.name}`} onClick={() => remove.mutate(c.id)}>
                      <Trash2 aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function Offers({
  client,
  driveId,
  figures,
  applications,
  onChange,
}: {
  client: ConsoleClient;
  driveId: string;
  figures: OfferFigures;
  applications: readonly DriveApplication[];
  onChange: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ ref: "", ctc: "", joining: "", note: "" });
  const send = useMutation({
    mutationFn: () => client.sendOffer(driveId, { ref: form.ref, ctcLpa: Number(form.ctc), joiningDate: form.joining === "" ? null : form.joining, note: form.note }),
    onSuccess: async ({ link }) => {
      setForm({ ref: "", ctc: form.ctc, joining: form.joining, note: form.note });
      onChange();
      await copy(link, toast, "Offer made: its link is copied to send the candidate");
    },
  });
  const sent = applications.filter((a) => a.offer !== undefined);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

  return (
    <section className="card" aria-label="Offers">
      <div className="bar">
        <HandCoins aria-hidden="true" />
        <strong>Offers</strong>
        <span className="notice">
          {figures.sent} sent · {figures.accepted} accepted · {figures.declined} declined · {figures.pending} waiting · {figures.joined} joined
          {figures.notJoined > 0 ? ` · ${figures.notJoined} accepted but not joined by the date` : ""}
        </span>
      </div>
      <form
        className="row"
        aria-label="Make an offer"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <select aria-label="Student" required value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })}>
          <option value="">Choose a student…</option>
          {applications
            .filter((a) => a.stage !== "rejected" && a.stage !== "withdrawn")
            .map((a) => (
              <option key={a.ref} value={a.ref}>
                {a.ref} — {a.name}
              </option>
            ))}
        </select>
        <input aria-label="Package (lakh a year)" type="number" min={0} step={0.01} required placeholder="LPA" value={form.ctc} onChange={(e) => setForm({ ...form, ctc: e.target.value })} />
        <label className="inline">
          Joining
          <input aria-label="Joining date" type="date" value={form.joining} onChange={(e) => setForm({ ...form, joining: e.target.value })} />
        </label>
        <input aria-label="Note to the candidate" placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <button type="submit" disabled={send.isPending}>
          Make the offer
        </button>
      </form>
      {send.error === null ? null : (
        <p className="error" role="alert">
          {failure(send.error)}
        </p>
      )}
      {sent.length === 0 ? null : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col" className="num">
                  LPA
                </th>
                <th scope="col">Joining</th>
                <th scope="col">Answer</th>
                <th scope="col">
                  <span className="sr-only">Link</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sent.map((a) => {
                const o = a.offer!;
                const late = o.response === "accepted" && a.stage === "offered" && o.joiningDate !== null && o.joiningDate < today;
                return (
                  <tr key={a.ref}>
                    <td>
                      {a.name}
                      <div className="notice mono">{a.ref}</div>
                    </td>
                    <td className="num">{a.offerLpa ?? "—"}</td>
                    <td>{o.joiningDate ?? "—"}</td>
                    <td>
                      {a.stage === "joined" ? (
                        <span className="badge good">Joined</span>
                      ) : o.response === null ? (
                        <span className="badge muted">Waiting</span>
                      ) : (
                        <span className={`badge ${o.response === "accepted" ? "info" : "bad"}`}>{RESPONSE[o.response]}</span>
                      )}
                      {late ? <span className="badge bad">Not joined</span> : null}
                    </td>
                    <td>
                      <button type="button" className="quiet" onClick={() => void copy(o.link, toast, "Offer link copied")}>
                        <Copy aria-hidden="true" />
                        Copy link
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
