import { lazy, Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ScrollText, UserX, Users } from "lucide-react";
import { useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type ApiKeyRole, type ConsoleClient, type StaffRole } from "../api.ts";
import { describeAction } from "./Home.tsx";
import { Banner, EmptyState, FigureStrip, RowMenu, SecretField, SettingsGroup, SkeletonRows } from "./kit.tsx";

/**
 * What an organisation's owner manages: its staff, its API keys, its model
 * spend, and the record of what everyone did. Each page is laid out the same
 * way: a group's title and what it does on the left, its controls on the
 * right, lists at full width, anything that removes something last.
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
  recruiter: "Runs hiring: jobs, applicants, tests and offers",
  hiring_manager: "Reviews and decides on the jobs they manage, and nothing else",
};
const ROLE_WORDS: Record<StaffRole, string> = {
  owner: "Owner",
  author: "Author",
  invigilator: "Invigilator",
  reviewer: "Reviewer",
  viewer: "Viewer",
  recruiter: "Recruiter",
  hiring_manager: "Hiring manager",
};

const ROLES = Object.keys(ROLE_HELP) as StaffRole[];
const KEY_ROLES = ROLES.filter((r): r is ApiKeyRole => r !== "owner" && r !== "hiring_manager");

const failure = (error: unknown): string | null =>
  error === null || error === undefined ? null : error instanceof ConsoleError ? (error.detail ?? error.message) : error instanceof Error ? error.message : "That did not work.";

const IST = "Asia/Kolkata";
const stamp = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: IST, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

// --- staff --------------------------------------------------------------------

const StaffSheet = lazy(() => import("./StaffSheet.tsx").then((m) => ({ default: m.StaffSheet })));
const StaffDepartments = lazy(() => import("./StaffSheet.tsx").then((m) => ({ default: m.StaffDepartments })));

export function StaffPanel({ client, selfId }: { client: ConsoleClient; selfId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const staff = useQuery({ queryKey: ["staff"], queryFn: () => client.listStaff() });
  const [draft, setDraft] = useState({ email: "", name: "", role: "author" as StaffRole, password: "" });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["staff"] });
  const add = useMutation({
    mutationFn: () => client.addStaff(draft),
    onSuccess: async () => {
      toast(`Added ${draft.name}`, "success");
      setDraft({ email: "", name: "", role: "author", password: "" });
      await refresh();
    },
  });
  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: StaffRole }) => client.setRole(id, role),
    onSuccess: () => toast("Role changed", "success"),
    onSettled: refresh,
  });
  const disable = useMutation({
    mutationFn: (id: string) => client.disableStaff(id),
    onSuccess: () => toast("Account disabled", "success"),
    onSettled: refresh,
  });

  const problem = failure(add.error ?? setRole.error ?? disable.error);

  return (
    <div className="settings-page-groups">
      {problem === null ? null : <Banner tone="danger" title="That did not go through.">{problem}</Banner>}
      <SettingsGroup id="staff-list" title="People" label="Staff" stacked description="Who can sign in to this console, and what each can do. A disabled account keeps its history but cannot sign in.">
        {staff.data === undefined ? (
          <SkeletonRows columns={4} label="Loading staff…" />
        ) : staff.data.length === 0 ? (
          <EmptyState icon={Users} compact>
            Everyone you add appears here, with their role.
          </EmptyState>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
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
                        <span className="pill">Disabled</span>
                      ) : (
                        <select
                          aria-label={`Role for ${user.name}`}
                          value={user.role}
                          disabled={user.id === selfId}
                          title={user.id === selfId ? "You cannot change your own role." : undefined}
                          onChange={(e) => setRole.mutate({ id: user.id, role: e.target.value as StaffRole })}
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_WORDS[role]}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="row-end">
                      <RowMenu
                        of={user.name}
                        keepPlace
                        items={[
                          !user.disabled &&
                            user.id !== selfId && { label: "Disable the account", icon: <UserX />, onSelect: () => disable.mutate(user.id), danger: true },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SettingsGroup>

      {staff.data === undefined || staff.data.length === 0 ? null : (
        <Suspense fallback={null}>
          <StaffDepartments client={client} users={staff.data.filter((u) => !u.disabled)} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <StaffSheet client={client} />
      </Suspense>

      <SettingsGroup id="staff-add" title="Add a member of staff" description="They sign in with this email and the password you give them, and should change it on first sign-in.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <div className="grid">
            <div className="field">
              <label htmlFor="staff-name">Name</label>
              <input id="staff-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="staff-email">Email</label>
              <input id="staff-email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="staff-role">Role</label>
              <select id="staff-role" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as StaffRole })}>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_WORDS[role]}
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
            <button type="submit" disabled={add.isPending || draft.name.trim() === "" || draft.email.trim() === "" || draft.password.length < 12}>
              {add.isPending ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </SettingsGroup>
    </div>
  );
}

// --- API keys -----------------------------------------------------------------

export function ApiKeysPanel({ client }: { client: ConsoleClient }) {
  const queryClient = useQueryClient();
  const toast = useToast();
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
  const revoke = useMutation({
    mutationFn: (id: string) => client.revokeApiKey(id),
    onSuccess: () => toast("Key revoked", "success"),
    onSettled: refresh,
  });
  const problem = failure(issue.error ?? revoke.error);

  return (
    <div className="settings-page-groups">
      {problem === null ? null : <Banner tone="danger" title="That did not go through.">{problem}</Banner>}
      <SettingsGroup
        id="keys-list"
        title="Keys"
        label="API keys"
        stacked
        description="For an ATS or LMS to start attempts and fetch results. A key can grade, but can never set an attempt aside: that is a person's decision."
      >
        {keys.data === undefined ? (
          <SkeletonRows columns={4} label="Loading keys…" />
        ) : keys.data.length === 0 ? (
          <EmptyState icon={KeyRound} compact>
            Keys you issue appear here, with when each was last used.
          </EmptyState>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Last used</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {keys.data.map((key) => (
                  <tr key={key.id} className={key.revoked ? "withdrawn" : undefined}>
                    <td>
                      {key.name} {key.revoked ? <span className="pill">Revoked</span> : null}
                    </td>
                    <td>{ROLE_WORDS[key.role as StaffRole] ?? key.role}</td>
                    <td className="notice">{key.lastUsedAt === null ? "Never" : stamp(key.lastUsedAt)}</td>
                    <td className="row-end">
                      <RowMenu
                        of={key.name}
                        keepPlace
                        items={[!key.revoked && { label: "Revoke the key", icon: <KeyRound />, onSelect: () => revoke.mutate(key.id), danger: true }]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SettingsGroup>

      <SettingsGroup id="keys-issue" title="Issue a key" description="Give it the least role that does the job. The key is shown once.">
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
                  {ROLE_WORDS[r]}
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
        {issued === null ? null : <SecretField id="issued-key" label={`Key for ${issued.name}`} value={issued.secret} />}
      </SettingsGroup>
    </div>
  );
}

// --- spend --------------------------------------------------------------------

/** Micro-dollars as dollars, to the cent, or finer when the amount is small. */
export const dollars = (micro: number | null): string =>
  micro === null ? "—" : `$${(micro / 1_000_000).toFixed(micro !== 0 && micro < 10_000 ? 4 : 2)}`;

export function UsagePanel({ client, canSetCap }: { client: ConsoleClient; canSetCap: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const usage = useQuery({ queryKey: ["usage"], queryFn: () => client.usage() });
  const [cap, setCap] = useState("");

  const saveCap = useMutation({
    mutationFn: (value: number | null) => client.setSpendCap(value),
    onSuccess: async (_, value) => {
      setCap("");
      toast(value === null ? "Cap removed" : "Cap set", "success");
      await queryClient.invalidateQueries({ queryKey: ["usage"] });
    },
  });

  if (usage.data === undefined)
    return usage.error === null ? (
      <section className="card">
        <SkeletonRows columns={4} label="Loading spend…" />
      </section>
    ) : (
      <Banner tone="danger" title="Could not load spend." />
    );
  const u = usage.data;

  return (
    <div className="settings-page-groups">
      <SettingsGroup
        id="spend-month"
        title="This month"
        label="Model spend"
        description={
          u.monthlyCapMicroUsd === null
            ? "No monthly cap."
            : `Cap ${dollars(u.monthlyCapMicroUsd)}. At the cap, candidates are simply not asked follow-ups, and grading or reading an exchange waits until next month or a higher cap.`
        }
      >
        <p className="notice">Model spend this month</p>
        <p className="grade">{dollars(u.spentThisMonthMicroUsd)}</p>
        <FigureStrip
          label="Per attempt"
          figures={[
            { label: "Attempts", value: u.perAttempt.attempts },
            { label: "Median per attempt", value: dollars(u.perAttempt.p50MicroUsd) },
            { label: "90th percentile", value: dollars(u.perAttempt.p90MicroUsd) },
            { label: "Highest", value: dollars(u.perAttempt.maxMicroUsd) },
          ]}
        />
      </SettingsGroup>

      <SettingsGroup id="spend-routes" title="By route" stacked description="Where the model's time went: each kind of call, its tokens, and what it cost.">
        {u.routes.length === 0 ? (
          <EmptyState icon={ScrollText} compact>
            Model calls this month appear here, by what they were for.
          </EmptyState>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Route</th>
                  <th scope="col" className="num">
                    Calls
                  </th>
                  <th scope="col" className="num">
                    Input
                  </th>
                  <th scope="col" className="num">
                    Output
                  </th>
                  <th scope="col" className="num">
                    Cache read
                  </th>
                  <th scope="col" className="num">
                    Cache write (5m / 1h)
                  </th>
                  <th scope="col" className="num">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {u.routes.map((r) => (
                  <tr key={r.route}>
                    <td>{r.route}</td>
                    <td className="num">{r.calls}</td>
                    <td className="num">{r.inputTokens.toLocaleString("en-IN")}</td>
                    <td className="num">{r.outputTokens.toLocaleString("en-IN")}</td>
                    <td className="num">{r.cacheReadTokens.toLocaleString("en-IN")}</td>
                    <td className="num">
                      {r.cacheWrite5mTokens.toLocaleString("en-IN")} / {r.cacheWrite1hTokens.toLocaleString("en-IN")}
                    </td>
                    <td className="num">{dollars(r.costMicroUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {u.inferenceGeos.length === 0 ? null : (
          <p className="notice">Inference ran in: {u.inferenceGeos.map((g) => `${g.geo ?? "unreported"} (${g.calls})`).join(", ")}</p>
        )}
      </SettingsGroup>

      {canSetCap ? (
        <SettingsGroup id="spend-cap-group" title="Monthly cap" description="A ceiling on model spend. Exams still run at the cap; only the follow-ups and model grading pause.">
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
          {saveCap.error === null ? null : <p className="error">{failure(saveCap.error)}</p>}
          <div className="row">
            <button type="button" disabled={saveCap.isPending || !(Number.parseFloat(cap) >= 0)} onClick={() => saveCap.mutate(Math.round(Number.parseFloat(cap) * 1_000_000))}>
              Set cap
            </button>
            <button type="button" className="quiet" disabled={u.monthlyCapMicroUsd === null} onClick={() => saveCap.mutate(null)}>
              Remove cap
            </button>
          </div>
        </SettingsGroup>
      ) : null}
    </div>
  );
}

// --- audit --------------------------------------------------------------------

/**
 * Every action taken in the organisation, in words, filterable by who did it
 * and what it was.
 */
export function AuditPanel({ client }: { client: ConsoleClient }) {
  const audit = useQuery({ queryKey: ["audit"], queryFn: () => client.audit() });
  // Names for the people behind the ids, where this account may read the staff list.
  const staff = useQuery({ queryKey: ["staff"], queryFn: () => client.listStaff(), retry: false });
  const [person, setPerson] = useState("");
  const [action, setAction] = useState("");
  const nameOf = (id: string | null, kind: string) =>
    kind === "api_key" ? `API key ${id ?? ""}`.trim() : kind === "system" ? "Parikshaa" : (staff.data?.find((u) => u.id === id)?.name ?? id ?? "Someone");

  const entries = audit.data ?? [];
  const people = [...new Map(entries.map((e) => [`${e.actorKind}:${e.actorId ?? ""}`, nameOf(e.actorId, e.actorKind)])).entries()];
  const actions = [...new Set(entries.map((e) => e.action))].sort((a, b) => describeAction(a).localeCompare(describeAction(b)));
  const shown = entries.filter((e) => (person === "" || `${e.actorKind}:${e.actorId ?? ""}` === person) && (action === "" || e.action === action));

  return (
    <SettingsGroup id="audit-list" title="Actions" label="Audit log" stacked description="What staff and integrations did, newest first. Candidate actions are in each attempt's own record.">
      {audit.data === undefined ? (
        audit.error === null ? (
          <SkeletonRows columns={4} label="Loading the audit log…" />
        ) : (
          <Banner tone="danger" title="Could not load the audit log." />
        )
      ) : entries.length === 0 ? (
        <EmptyState icon={ScrollText} compact>
          Every action staff and integrations take appears here, by whom and when.
        </EmptyState>
      ) : (
        <>
          <div className="filter-toolbar" role="group" aria-label="Filter the log">
            <select aria-label="Who" value={person} onChange={(e) => setPerson(e.target.value)}>
              <option value="">Anyone</option>
              {people.map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
            <select aria-label="What" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">Any action</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {describeAction(a).replace(/^./, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
            <span className="notice">
              {shown.length} of {entries.length}
            </span>
          </div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">When (IST)</th>
                  <th scope="col">Who</th>
                  <th scope="col">What</th>
                  <th scope="col">On</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((entry, i) => (
                  <tr key={`${entry.at}-${i}`}>
                    <td className="notice">{stamp(entry.at)}</td>
                    <td>{nameOf(entry.actorId, entry.actorKind)}</td>
                    <td>{describeAction(entry.action).replace(/^./, (c) => c.toUpperCase())}</td>
                    <td className="mono">{entry.target ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </SettingsGroup>
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
    <SettingsGroup id="account-password" title="Change password" description="Changing it signs you out everywhere, this tab included, so a session someone else has stops working.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          change.mutate();
        }}
      >
        <div className="grid">
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
    </SettingsGroup>
  );
}
