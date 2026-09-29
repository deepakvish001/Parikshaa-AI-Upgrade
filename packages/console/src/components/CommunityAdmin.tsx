import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { ConsoleError, type ConsoleClient, type StaffCompany, type StaffExperience, type StarterPack, type StoreItem } from "../api.ts";

/**
 * Companies, interview experiences and the coin store (ROADMAP §16), for staff.
 * A company's page is counted from reports, so staff add reports — a problem,
 * and the day it was asked — rather than typing in how often. Experiences wait
 * here until someone reads them; publishing one pays its author and reports its
 * problems.
 */

const failure = (error: unknown, fallback: string) =>
  error instanceof ConsoleError ? (error.detail ?? (error.problems[0]?.message ?? fallback)) : fallback;
const today = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

// --- starter packs ------------------------------------------------------------------------------

export function StarterPacks({ client, canWrite }: { client: ConsoleClient; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const packs = useQuery({ queryKey: ["prep", "starter-packs"], queryFn: () => client.starterPacks() });
  const take = useMutation({
    mutationFn: (name: StarterPack["name"]) => client.importStarterPack(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prep"] });
      void queryClient.invalidateQueries({ queryKey: ["practice", "problems"] });
    },
  });
  if ((packs.data ?? []).length === 0) return null;
  return (
    <section className="card" aria-label="Starter packs">
      <div className="bar">
        <strong>Starter packs</strong>
      </div>
      <p className="notice">Content to open a site with. Each adds its lessons, problems and a track, once; afterwards they are yours to change or hide.</p>
      <ul className="stack">
        {(packs.data ?? []).map((p) => (
          <li key={p.name} className="row">
            <span>
              <strong>{p.title}</strong> — {p.description}{" "}
              <span className="notice">
                ({p.lessons > 0 ? `${p.lessons} lessons, ` : ""}
                {p.problems} problems)
              </span>
            </span>
            {p.imported ? (
              <span className="notice">Added</span>
            ) : canWrite ? (
              <button type="button" disabled={take.isPending} onClick={() => take.mutate(p.name)}>
                Add {p.title}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {take.isSuccess ? (
        <p role="status">
          Added {take.data.problems} problems{take.data.lessons > 0 ? ` and ${take.data.lessons} lessons` : ""}, and the track.
        </p>
      ) : null}
      {take.isError ? <p className="error">{failure(take.error, "That pack could not be added")}</p> : null}
    </section>
  );
}

// --- companies --------------------------------------------------------------------------------

export function Companies({ client, canWrite }: { client: ConsoleClient; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const companies = useQuery({ queryKey: ["prep", "companies"], queryFn: () => client.companies() });
  const problems = useQuery({ queryKey: ["practice", "problems"], queryFn: () => client.practiceProblems() });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["prep", "companies"] });
  const [name, setName] = useState("");
  const add = useMutation({
    mutationFn: () => client.saveCompany(null, { name: name.trim(), about: "" }),
    onSuccess: () => {
      setName("");
      void refresh();
    },
  });
  const [open, setOpen] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate();
  };
  return (
    <>
      <section className="card" aria-label="Companies">
        <div className="bar">
          <strong>Companies</strong>
        </div>
        <p className="notice">
          Learners see each company&apos;s problems by how often they were asked in the last 30, 60 and 180 days, counted from these reports and from published interview
          experiences. With Plus on sale, all but the five most asked are Plus.
        </p>
        {canWrite ? (
          <form className="row" aria-label="New company" onSubmit={submit}>
            <label>
              Company name
              <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
            </label>
            <button type="submit" disabled={add.isPending || name.trim() === ""}>
              Add company
            </button>
          </form>
        ) : null}
        {add.isError ? <p className="error">{failure(add.error, "That company could not be added")}</p> : null}
        {(companies.data ?? []).length === 0 ? (
          <p className="notice">No companies yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Company</th>
                <th scope="col">Reports</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {(companies.data ?? []).map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.name} <span className="notice">/{c.slug}</span>
                  </td>
                  <td>{c.reports.length}</td>
                  <td>
                    <button type="button" className="quiet" onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id}>
                      {open === c.id ? "Close" : "Reports"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {open === null ? null : (
        <CompanyReports
          key={open}
          client={client}
          company={(companies.data ?? []).find((c) => c.id === open)!}
          problems={(problems.data ?? []).map((p) => ({ id: p.id, title: p.title }))}
          canWrite={canWrite}
          onChange={() => void refresh()}
        />
      )}
    </>
  );
}

function CompanyReports({
  client,
  company,
  problems,
  canWrite,
  onChange,
}: {
  client: ConsoleClient;
  company: StaffCompany;
  problems: readonly { id: string; title: string }[];
  canWrite: boolean;
  onChange: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [day, setDay] = useState(today);
  const report = useMutation({
    mutationFn: () => client.reportProblems(company.id, picked, day),
    onSuccess: () => {
      setPicked([]);
      onChange();
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => client.deleteReport(id), onSuccess: onChange });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    report.mutate();
  };
  return (
    <section className="card" aria-label={`Reports for ${company.name}`}>
      <div className="bar">
        <strong>{company.name}: reports</strong>
      </div>
      {canWrite ? (
        <form className="stack" aria-label="Report problems" onSubmit={submit}>
          <label>
            Problems asked
            <select multiple value={picked} onChange={(e) => setPicked([...e.target.selectedOptions].map((o) => o.value))} size={Math.min(8, Math.max(3, problems.length))}>
              {problems.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Asked on
            <input type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value)} required />
          </label>
          <div className="row">
            <button type="submit" disabled={picked.length === 0 || report.isPending}>
              Add {picked.length === 0 ? "" : picked.length} report{picked.length === 1 ? "" : "s"}
            </button>
          </div>
          {report.isError ? <p className="error">{failure(report.error, "Those reports could not be added")}</p> : null}
        </form>
      ) : null}
      {company.reports.length === 0 ? (
        <p className="notice">Nothing reported yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Problem</th>
              <th scope="col">Asked on</th>
              <th scope="col">From</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {company.reports.map((r) => (
              <tr key={r.id}>
                <td>{r.problemTitle}</td>
                <td>{r.reportedOn}</td>
                <td>{r.source === "staff" ? "Staff" : "An interview experience"}</td>
                <td>
                  {canWrite ? (
                    <button type="button" className="quiet" aria-label={`Remove the report of ${r.problemTitle} on ${r.reportedOn}`} onClick={() => remove.mutate(r.id)}>
                      <Trash2 aria-hidden="true" />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// --- experiences ---------------------------------------------------------------------------------

export function Experiences({ client, canWrite }: { client: ConsoleClient; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StaffExperience["status"]>("pending");
  const list = useQuery({ queryKey: ["prep", "experiences", status], queryFn: () => client.experiences(status) });
  const decide = useMutation({
    mutationFn: ({ id, to }: { id: string; to: "published" | "rejected" }) => client.decideExperience(id, to),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prep"] }),
  });
  return (
    <section className="card" aria-label="Interview experiences">
      <div className="bar">
        <strong>Interview experiences</strong>
        <label>
          Show{" "}
          <select value={status} onChange={(e) => setStatus(e.target.value as StaffExperience["status"])}>
            <option value="pending">Waiting to be read</option>
            <option value="published">Published</option>
            <option value="rejected">Not published</option>
          </select>
        </label>
      </div>
      <p className="notice">Publishing pays the author 100 coins and reports the problems its rounds name against the company. Anything with names, contact details or leaked papers should not be published.</p>
      {decide.isError ? <p className="error">{failure(decide.error, "That could not be saved")}</p> : null}
      {(list.data ?? []).length === 0 ? (
        <p className="notice">Nothing here.</p>
      ) : (
        <ul className="stack experience-queue">
          {(list.data ?? []).map((e) => (
            <li key={e.id}>
              <article aria-label={`${e.company.name}, ${e.role}, by ${e.author}`}>
                <p>
                  <strong>{e.company.name}</strong> · {e.role} · {e.interviewed} · {e.verdict} · by {e.author}
                </p>
                <ol>
                  {e.rounds.map((r, i) => (
                    <li key={i}>
                      <strong>{r.kind}</strong>: {r.asked}
                      {r.problemSlugs.length === 0 ? null : <span className="notice"> ({r.problemSlugs.join(", ")})</span>}
                    </li>
                  ))}
                </ol>
                {e.tips === "" ? null : <p className="notice">Tips: {e.tips}</p>}
                {canWrite && e.status === "pending" ? (
                  <div className="row">
                    <button type="button" disabled={decide.isPending} onClick={() => decide.mutate({ id: e.id, to: "published" })}>
                      Publish
                    </button>
                    <button type="button" className="secondary" disabled={decide.isPending} onClick={() => decide.mutate({ id: e.id, to: "rejected" })}>
                      Don&apos;t publish
                    </button>
                  </div>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// --- the coin store -----------------------------------------------------------------------------------

const blank: Omit<StoreItem, "id"> = { title: "", description: "", kind: "digital", plusDays: 0, priceCoins: 500, stock: null, perLearner: 1, active: true };

export function CoinStore({ client, canManage }: { client: ConsoleClient; canManage: boolean }) {
  const queryClient = useQueryClient();
  const items = useQuery({ queryKey: ["prep", "store-items"], queryFn: () => client.storeItems() });
  const orders = useQuery({ queryKey: ["prep", "store-orders"], queryFn: () => client.storeOrders(), enabled: canManage });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["prep"] });
  const [draft, setDraft] = useState(blank);
  const add = useMutation({
    mutationFn: () => client.saveStoreItem(null, { ...draft, title: draft.title.trim(), plusDays: draft.kind === "plus" ? draft.plusDays : 0 }),
    onSuccess: () => {
      setDraft(blank);
      void refresh();
    },
  });
  const toggle = useMutation({ mutationFn: (item: StoreItem) => client.saveStoreItem(item.id, { ...item, active: !item.active }), onSuccess: refresh });
  const close = useMutation({
    mutationFn: ({ id, to }: { id: string; to: "fulfilled" | "cancelled" }) => client.closeStoreOrder(id, to, ""),
    onSuccess: refresh,
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate();
  };
  return (
    <>
      <section className="card" aria-label="Coin store">
        <div className="bar">
          <strong>Coin store</strong>
        </div>
        <p className="notice">What learners may spend coins on. A Plus item gives its days of Plus at once; others you send and mark sent here. Accounts spend from 14 days old.</p>
        {(items.data ?? []).length === 0 ? (
          <p className="notice">Nothing for sale yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Price</th>
                <th scope="col">Stock</th>
                <th scope="col">Each</th>
                <th scope="col">On sale</th>
              </tr>
            </thead>
            <tbody>
              {(items.data ?? []).map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.title} {item.kind === "plus" ? <span className="notice">({item.plusDays} days of Plus)</span> : <span className="notice">({item.kind})</span>}
                  </td>
                  <td>{item.priceCoins.toLocaleString("en-IN")} coins</td>
                  <td>{item.stock === null ? "No limit" : item.stock}</td>
                  <td>{item.perLearner}</td>
                  <td>
                    <input type="checkbox" aria-label={`${item.title} on sale`} checked={item.active} disabled={!canManage || toggle.isPending} onChange={() => toggle.mutate(item)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canManage ? (
          <form className="stack" aria-label="New item" onSubmit={submit}>
            <div className="row">
              <label>
                Item
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required maxLength={120} />
              </label>
              <label>
                Kind
                <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as StoreItem["kind"] })}>
                  <option value="plus">Days of Plus</option>
                  <option value="digital">Digital</option>
                  <option value="physical">Posted</option>
                </select>
              </label>
              {draft.kind === "plus" ? (
                <label>
                  Days of Plus
                  <input type="number" min={1} max={400} value={draft.plusDays} onChange={(e) => setDraft({ ...draft, plusDays: Number(e.target.value) })} />
                </label>
              ) : null}
              <label>
                Price in coins
                <input type="number" min={1} value={draft.priceCoins} onChange={(e) => setDraft({ ...draft, priceCoins: Number(e.target.value) })} />
              </label>
              <label>
                Stock (blank: no limit)
                <input type="number" min={0} value={draft.stock ?? ""} onChange={(e) => setDraft({ ...draft, stock: e.target.value === "" ? null : Number(e.target.value) })} />
              </label>
              <label>
                Each learner may buy
                <input type="number" min={1} max={100} value={draft.perLearner} onChange={(e) => setDraft({ ...draft, perLearner: Number(e.target.value) })} />
              </label>
            </div>
            <label>
              Description
              <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={2000} />
            </label>
            <div className="row">
              <button type="submit" disabled={add.isPending || draft.title.trim() === ""}>
                Add item
              </button>
            </div>
            {add.isError ? <p className="error">{failure(add.error, "That item could not be added")}</p> : null}
          </form>
        ) : null}
      </section>
      {canManage ? (
        <section className="card" aria-label="Store orders">
          <div className="bar">
            <strong>Orders</strong>
          </div>
          {(orders.data ?? []).length === 0 ? (
            <p className="notice">No orders yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Learner</th>
                  <th scope="col">Item</th>
                  <th scope="col">Send to</th>
                  <th scope="col">State</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {(orders.data ?? []).map((o) => (
                  <tr key={o.id}>
                    <td>
                      {o.learnerName} <span className="notice">{o.learnerEmail}</span>
                    </td>
                    <td>
                      {o.title} <span className="notice">({o.priceCoins} coins)</span>
                    </td>
                    <td>{o.address === "" ? "—" : o.address}</td>
                    <td>{o.status === "placed" ? "To send" : o.status === "fulfilled" ? "Sent" : "Cancelled, coins returned"}</td>
                    <td>
                      {o.status === "placed" ? (
                        <div className="row">
                          <button type="button" disabled={close.isPending} onClick={() => close.mutate({ id: o.id, to: "fulfilled" })}>
                            Mark sent
                          </button>
                          <button type="button" className="secondary" disabled={close.isPending} onClick={() => close.mutate({ id: o.id, to: "cancelled" })}>
                            Cancel
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}
    </>
  );
}
