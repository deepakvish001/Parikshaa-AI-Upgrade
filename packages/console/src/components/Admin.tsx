import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConsoleError, type ApiKeyRole, type ConsoleClient, type StaffRole } from "../api.ts";

/**
 * What an organisation's owner manages: its staff, its API keys, its model
 * spend, and the record of what everyone did.
 *
 * Each panel is shown only to an account whose role carries the permission, and
 * the server refuses the calls to anyone else regardless.
 */

const ROLE_HELP: Record<StaffRole, string> = {
  owner: "Everything, including staff, keys and spend",
  author: "Writes exams and starts attempts",
  invigilator: "Starts attempts; never sees answer keys or evidence",
  reviewer: "Grades, reads follow-ups, and sets attempts aside",
  viewer: "Reads results",
};

const ROLES = Object.keys(ROLE_HELP) as StaffRole[];
const KEY_ROLES = ROLES.filter((r): r is ApiKeyRole => r !== "owner");

const failure = (error: unknown): string | null =>
  error === null || error === undefined ? null : error instanceof Error ? error.message : "That did not work.";

// --- staff --------------------------------------------------------------------

export function StaffPanel({ client, selfId }: { client: ConsoleClient; selfId: string }) {
  const queryClient = useQueryClient();
  const staff = useQuery({ queryKey: ["staff"], queryFn: () => client.listStaff() });
  const [draft, setDraft] = useState({ email: "", name: "", role: "author" as StaffRole, password: "" });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["staff"] });
  const add = useMutation({
    mutationFn: () => client.addStaff(draft),
    onSuccess: async () => {
      setDraft({ email: "", name: "", role: "author", password: "" });
      await refresh();
    },
  });
  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: StaffRole }) => client.setRole(id, role),
    onSettled: refresh,
  });
  const disable = useMutation({ mutationFn: (id: string) => client.disableStaff(id), onSettled: refresh });

  const problem = failure(add.error ?? setRole.error ?? disable.error);

  return (
    <>
      <section className="card" aria-label="Staff">
        <strong>Staff</strong>
        {staff.data === undefined ? (
          <p className="notice">Loading…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {staff.data.map((user) => (
                <tr key={user.id}>
                  <td>
                    {user.name}
                    {user.id === selfId ? <span className="notice"> (you)</span> : null}
                  </td>
                  <td className="mono">{user.email}</td>
                  <td>
                    {user.disabled ? (
                      <span className="pill">disabled</span>
                    ) : (
                      <select
                        aria-label={`Role for ${user.name}`}
                        value={user.role}
                        onChange={(e) => setRole.mutate({ id: user.id, role: e.target.value as StaffRole })}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    {user.disabled ? null : (
                      <button type="button" className="quiet" onClick={() => disable.mutate(user.id)}>
                        Disable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {problem === null ? null : (
          <p className="error" role="alert">
            {problem}
          </p>
        )}
      </section>

      <section className="card" aria-label="Add a member of staff">
        <strong>Add a member of staff</strong>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <div className="grid" style={{ marginTop: ".75rem" }}>
            <div className="field">
              <label htmlFor="staff-name">Name</label>
              <input id="staff-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="staff-email">Email</label>
              <input
                id="staff-email"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="staff-role">Role</label>
              <select
                id="staff-role"
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value as StaffRole })}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="staff-password">Initial password</label>
              <input
                id="staff-password"
                type="password"
                autoComplete="new-password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              />
            </div>
          </div>
          <p className="notice">{ROLE_HELP[draft.role]}. At least 12 characters; ask them to change it on first sign-in.</p>
          <div className="row">
            <button
              type="submit"
              disabled={add.isPending || draft.name.trim() === "" || draft.email.trim() === "" || draft.password.length < 12}
            >
              {add.isPending ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

// --- API keys -----------------------------------------------------------------

export function ApiKeysPanel({ client }: { client: ConsoleClient }) {
  const queryClient = useQueryClient();
  const keys = useQuery({ queryKey: ["api-keys"], queryFn: () => client.listApiKeys() });
  const [name, setName] = useState("");
  const [role, setRole] = useState<ApiKeyRole>("invigilator");
  const [issued, setIssued] = useState<{ name: string; secret: string } | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["api-keys"] });
  const issue = useMutation({
    mutationFn: () => client.issueApiKey(name.trim(), role),
    onSuccess: async (result) => {
      setIssued({ name: name.trim(), secret: result.secret });
      setName("");
      await refresh();
    },
  });
  const revoke = useMutation({ mutationFn: (id: string) => client.revokeApiKey(id), onSettled: refresh });

  return (
    <>
      <section className="card" aria-label="API keys">
        <strong>API keys</strong>
        <p className="notice">
          For an ATS or LMS to start attempts and fetch results. A key can grade, but can never set an attempt
          aside: that is a person's decision.
        </p>
        {keys.data === undefined ? null : keys.data.length === 0 ? (
          <p className="notice">No keys yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Last used</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {keys.data.map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td>{key.role}</td>
                  <td className="notice">{key.lastUsedAt === null ? "never" : new Date(key.lastUsedAt).toLocaleString()}</td>
                  <td>
                    {key.revoked ? (
                      <span className="pill">revoked</span>
                    ) : (
                      <button type="button" className="quiet" onClick={() => revoke.mutate(key.id)}>
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card" aria-label="Issue a key">
        <div className="grid">
          <div className="field">
            <label htmlFor="key-name">Name</label>
            <input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Greenhouse" />
          </div>
          <div className="field">
            <label htmlFor="key-role">Role</label>
            <select id="key-role" value={role} onChange={(e) => setRole(e.target.value as ApiKeyRole)}>
              {KEY_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row">
          <button type="button" disabled={issue.isPending || name.trim() === ""} onClick={() => issue.mutate()}>
            Issue key
          </button>
        </div>
        {issued === null ? null : (
          <div className="field" style={{ marginTop: ".75rem" }}>
            <label htmlFor="issued-key">Key for {issued.name}</label>
            <textarea id="issued-key" readOnly className="mono" value={issued.secret} />
            <p className="notice">Copy it now. It is stored only as a digest and will not be shown again.</p>
          </div>
        )}
      </section>
    </>
  );
}

// --- spend --------------------------------------------------------------------

/** Micro-dollars as dollars, to the cent, or finer when the amount is small. */
export const dollars = (micro: number | null): string =>
  micro === null ? "—" : `$${(micro / 1_000_000).toFixed(micro !== 0 && micro < 10_000 ? 4 : 2)}`;

export function UsagePanel({ client, canSetCap }: { client: ConsoleClient; canSetCap: boolean }) {
  const queryClient = useQueryClient();
  const usage = useQuery({ queryKey: ["usage"], queryFn: () => client.usage() });
  const [cap, setCap] = useState("");

  const saveCap = useMutation({
    mutationFn: (value: number | null) => client.setSpendCap(value),
    onSuccess: async () => {
      setCap("");
      await queryClient.invalidateQueries({ queryKey: ["usage"] });
    },
  });

  if (usage.data === undefined) return <p className="notice">Loading…</p>;
  const u = usage.data;

  return (
    <>
      <section className="card" aria-label="Model spend">
        <p className="notice">Model spend this month</p>
        <p className="grade">{dollars(u.spentThisMonthMicroUsd)}</p>
        <p className="notice">
          {u.monthlyCapMicroUsd === null
            ? "No monthly cap."
            : `Cap ${dollars(u.monthlyCapMicroUsd)}. At the cap, candidates are simply not asked follow-ups, and grading or reading an exchange waits until next month or a higher cap.`}
        </p>

        <table style={{ marginTop: ".75rem" }}>
          <thead>
            <tr>
              <th scope="col">Per attempt</th>
              <th scope="col">Attempts</th>
              <th scope="col">Median</th>
              <th scope="col">90th percentile</th>
              <th scope="col">Highest</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td />
              <td>{u.perAttempt.attempts}</td>
              <td>{dollars(u.perAttempt.p50MicroUsd)}</td>
              <td>{dollars(u.perAttempt.p90MicroUsd)}</td>
              <td>{dollars(u.perAttempt.maxMicroUsd)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="card" aria-label="By route">
        <table>
          <thead>
            <tr>
              <th scope="col">Route</th>
              <th scope="col">Calls</th>
              <th scope="col">Input</th>
              <th scope="col">Output</th>
              <th scope="col">Cache read</th>
              <th scope="col">Cache write (5m / 1h)</th>
              <th scope="col">Cost</th>
            </tr>
          </thead>
          <tbody>
            {u.routes.map((r) => (
              <tr key={r.route}>
                <td>{r.route}</td>
                <td>{r.calls}</td>
                <td>{r.inputTokens.toLocaleString()}</td>
                <td>{r.outputTokens.toLocaleString()}</td>
                <td>{r.cacheReadTokens.toLocaleString()}</td>
                <td>
                  {r.cacheWrite5mTokens.toLocaleString()} / {r.cacheWrite1hTokens.toLocaleString()}
                </td>
                <td>{dollars(r.costMicroUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {u.routes.length === 0 ? <p className="notice">No model calls yet this month.</p> : null}
        {u.inferenceGeos.length === 0 ? null : (
          <p className="notice">
            Inference ran in: {u.inferenceGeos.map((g) => `${g.geo ?? "unreported"} (${g.calls})`).join(", ")}
          </p>
        )}
      </section>

      {canSetCap ? (
        <section className="card" aria-label="Monthly cap">
          <div className="field">
            <label htmlFor="spend-cap">Monthly cap, in US dollars</label>
            <input
              id="spend-cap"
              inputMode="decimal"
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              placeholder={u.monthlyCapMicroUsd === null ? "No cap" : String(u.monthlyCapMicroUsd / 1_000_000)}
            />
          </div>
          <div className="row">
            <button
              type="button"
              disabled={saveCap.isPending || !(Number.parseFloat(cap) >= 0)}
              onClick={() => saveCap.mutate(Math.round(Number.parseFloat(cap) * 1_000_000))}
            >
              Set cap
            </button>
            <button type="button" className="quiet" onClick={() => saveCap.mutate(null)}>
              Remove cap
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}

// --- audit --------------------------------------------------------------------

export function AuditPanel({ client }: { client: ConsoleClient }) {
  const audit = useQuery({ queryKey: ["audit"], queryFn: () => client.audit() });

  return (
    <section className="card" aria-label="Audit log">
      <strong>Audit log</strong>
      <p className="notice">What staff and integrations did, newest first. Candidate actions are in each attempt's own record.</p>
      {audit.data === undefined ? null : (
        <table>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Who</th>
              <th scope="col">Action</th>
              <th scope="col">On</th>
            </tr>
          </thead>
          <tbody>
            {audit.data.map((entry, i) => (
              <tr key={`${entry.at}-${i}`}>
                <td className="notice">{new Date(entry.at).toLocaleString()}</td>
                <td className="mono">
                  {entry.actorKind === "api_key" ? "key " : ""}
                  {entry.actorId ?? entry.actorKind}
                </td>
                <td>{entry.action}</td>
                <td className="mono">{entry.target ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// --- the signed-in account ----------------------------------------------------

export function AccountPanel({ client, onSignedOut }: { client: ConsoleClient; onSignedOut: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  const change = useMutation({
    mutationFn: () => client.changePassword(current, next),
    // Every session ends, this one included, so a stolen one stops working.
    onSuccess: onSignedOut,
  });
  const problem =
    change.error instanceof ConsoleError && change.error.status === 401
      ? "The current password was not accepted."
      : failure(change.error);

  return (
    <section className="card" aria-label="Change password">
      <strong>Change password</strong>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          change.mutate();
        }}
      >
        <div className="grid" style={{ marginTop: ".75rem" }}>
          <div className="field">
            <label htmlFor="current-password">Current password</label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
        </div>
        <p className="notice">At least 12 characters. Changing it signs you out everywhere, here included.</p>
        {problem === null ? null : (
          <p className="error" role="alert">
            {problem}
          </p>
        )}
        <div className="row">
          <button type="submit" disabled={change.isPending || current === "" || next.length < 12}>
            Change password
          </button>
        </div>
      </form>
    </section>
  );
}
