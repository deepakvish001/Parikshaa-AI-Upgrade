import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleStop, KeyRound, RotateCw, Send, Webhook as WebhookIcon } from "lucide-react";
import { ConsoleError, WEBHOOK_EVENTS, type AtsConnector, type AtsProvider, type ConsoleClient, type LtiPlatform, type Webhook } from "../api.ts";
import { EmptyState, RowMenu, SettingsGroup, SkeletonRows } from "./kit.tsx";

/**
 * Integrations (ROADMAP §7): webhooks to the organisation's own systems, and
 * Greenhouse, Lever, Zoho Recruit and Darwinbox. Owner only.
 */

/** What each webhook event is, in words; its name, for the receiving system, beside it. */
const EVENT_WORDS: Record<(typeof WEBHOOK_EVENTS)[number], string> = {
  "attempt.started": "An attempt starts",
  "attempt.submitted": "An attempt is submitted",
  "attempt.graded": "An attempt is graded",
  "attempt.voided": "An attempt is set aside",
};

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export function IntegrationsPanel({ client }: { client: ConsoleClient }) {
  return (
    <div className="settings-page-groups">
      <Webhooks client={client} />
      <Greenhouse client={client} />
      <AtsConnectors client={client} />
      <LtiPlatforms client={client} />
    </div>
  );
}

/** A secret shown once, in a field to copy from, with the warning that it will not be shown again. */
function Secret({ label, value, onDone }: { label: string; value: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="secret-once" role="status" aria-label={label}>
      <p>
        <strong>{label}</strong> — copy it now into the receiving system. It will not be shown again here.
      </p>
      <div className="secret-row">
        <input readOnly className="mono" aria-label={label} value={value} onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className="secondary"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => setCopied(true));
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" className="quiet" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

function Webhooks({ client }: { client: ConsoleClient }) {
  const queryClient = useQueryClient();
  const hooks = useQuery({ queryKey: ["webhooks"], queryFn: () => client.listWebhooks() });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["webhooks"] });
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<readonly string[]>([]);
  const [shown, setShown] = useState<{ label: string; value: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () => client.addWebhook(url.trim(), events, ""),
    onSuccess: async ({ webhook, secret }) => {
      setShown({ label: `Signing secret for ${webhook.url}`, value: secret });
      setUrl("");
      setEvents([]);
      await refresh();
    },
  });
  const reveal = useMutation({
    mutationFn: async (hook: Webhook) => ({ hook, secret: await client.webhookSecret(hook.id) }),
    onSuccess: ({ hook, secret }) => setShown({ label: `Signing secret for ${hook.url}`, value: secret }),
  });
  const rotate = useMutation({
    mutationFn: (hook: Webhook) => client.rotateWebhook(hook.id),
    onSuccess: async ({ webhook, secret }) => {
      setShown({ label: `New signing secret for ${webhook.url}`, value: secret });
      await refresh();
    },
  });
  const disable = useMutation({ mutationFn: (id: string) => client.disableWebhook(id), onSettled: refresh });
  const test = useMutation({ mutationFn: (id: string) => client.testWebhook(id) });

  const toggle = (e: string) => setEvents(events.includes(e) ? events.filter((x) => x !== e) : [...events, e]);
  const refused =
    add.error === null
      ? null
      : add.error instanceof ConsoleError && add.error.code === "unsafe_url"
        ? `That address cannot be used: ${add.error.detail ?? "it must be https, on the public internet"}.`
        : "Could not add it.";

  return (
    <>
      <SettingsGroup
        id="webhooks"
        title="Webhooks"
        stacked
        description={
          <>
            Your systems are told when an attempt starts, is submitted, is graded or is set aside. Each delivery is signed as{" "}
            <a href="https://www.standardwebhooks.com/">Standard Webhooks</a> describes, so any of its libraries can check it, and is retried,
            backing off, for about two hours if your end is down.
          </>
        }
      >
        {shown === null ? null : <Secret label={shown.label} value={shown.value} onDone={() => setShown(null)} />}
        {hooks.data === undefined ? (
          <SkeletonRows columns={3} label="Loading webhooks…" />
        ) : hooks.data.length === 0 ? (
          <EmptyState icon={WebhookIcon} compact>
            Webhooks you add appear here, each with a log of what was sent.
          </EmptyState>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Address</th>
                <th scope="col">Events</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {hooks.data.map((hook) => (
                <HookRow
                  key={hook.id}
                  client={client}
                  hook={hook}
                  open={open === hook.id}
                  onToggle={() => setOpen(open === hook.id ? null : hook.id)}
                  onTest={() => test.mutate(hook.id)}
                  onReveal={() => reveal.mutate(hook)}
                  onRotate={() => rotate.mutate(hook)}
                  onDisable={() => disable.mutate(hook.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </SettingsGroup>

      <SettingsGroup
        id="webhook-add"
        title="Add a webhook"
      >
        <div className="field" style={{ marginTop: ".6rem" }}>
          <label htmlFor="webhook-url">Address (https)</label>
          <input id="webhook-url" type="url" placeholder="https://ats.example.com/parikshaa" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="row" role="group" aria-label="Events">
          {WEBHOOK_EVENTS.map((e) => (
            <label key={e} className="inline">
              <input type="checkbox" style={{ width: "auto" }} checked={events.includes(e)} onChange={() => toggle(e)} /> {EVENT_WORDS[e]}{" "}
              <span className="mono notice">{e}</span>
            </label>
          ))}
        </div>
        <p className="notice">Tick none to receive every event.</p>
        <button type="button" disabled={add.isPending || !url.trim().startsWith("https://")} onClick={() => add.mutate()}>
          Add
        </button>
        {refused === null ? null : <p className="error">{refused}</p>}
      </SettingsGroup>
    </>
  );
}

function HookRow({
  client,
  hook,
  open,
  onToggle,
  onTest,
  onReveal,
  onRotate,
  onDisable,
}: {
  client: ConsoleClient;
  hook: Webhook;
  open: boolean;
  onToggle: () => void;
  onTest: () => void;
  onReveal: () => void;
  onRotate: () => void;
  onDisable: () => void;
}) {
  const deliveries = useQuery({
    queryKey: ["webhook-deliveries", hook.id],
    queryFn: () => client.webhookDeliveries(hook.id),
    enabled: open,
    refetchInterval: open ? 10_000 : false,
  });
  return (
    <>
      <tr>
        <td className="mono" style={{ wordBreak: "break-all" }}>
          {hook.url}
        </td>
        <td className="notice">{hook.events.length === 0 ? "Every event" : hook.events.map((e) => EVENT_WORDS[e as keyof typeof EVENT_WORDS] ?? e).join(", ")}</td>
        <td className="row-end">
          {hook.disabled ? (
            <span className="pill">Stopped</span>
          ) : (
            <>
              <button type="button" className="quiet" aria-expanded={open} onClick={onToggle}>
                {open ? "Hide log" : "Log"}
              </button>
              <RowMenu
                of={hook.url}
                items={[
                  { label: "Send a test", icon: <Send />, onSelect: onTest },
                  { label: "Show the signing secret", icon: <KeyRound />, onSelect: onReveal },
                  { label: "Rotate the secret", icon: <RotateCw />, onSelect: onRotate },
                  { label: "Stop deliveries", icon: <CircleStop />, onSelect: onDisable, danger: true },
                ]}
              />
            </>
          )}
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={3}>
            {deliveries.data === undefined ? (
              <SkeletonRows rows={2} columns={4} label="Loading deliveries…" />
            ) : deliveries.data.length === 0 ? (
              <p className="notice">Nothing sent yet.</p>
            ) : (
              <table aria-label={`Deliveries to ${hook.url}`}>
                <tbody>
                  {deliveries.data.map((d) => (
                    <tr key={d.id}>
                      <td className="notice">{when(d.createdAt)}</td>
                      <td>
                        {EVENT_WORDS[d.event as keyof typeof EVENT_WORDS] ?? d.event} <span className="mono notice">{d.event}</span>
                      </td>
                      <td>
                        <span className="pill" data-state={d.status}>{d.status}</span>
                        {d.attempts > 1 ? <span className="notice"> after {d.attempts} tries</span> : null}
                      </td>
                      <td className="notice">{d.error ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Greenhouse({ client }: { client: ConsoleClient }) {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["greenhouse"], queryFn: () => client.greenhouse() });
  const [key, setKey] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["greenhouse"] });
  const issue = useMutation({
    mutationFn: () => client.issueGreenhouseKey(),
    onSuccess: async (result) => {
      setKey(result.key);
      await refresh();
    },
  });
  const disable = useMutation({ mutationFn: () => client.disableGreenhouse(), onSettled: refresh });

  if (settings.data === undefined) return null;
  const { enabled, endpoints } = settings.data;
  return (
    <SettingsGroup
      id="greenhouse"
      title="Greenhouse"
      description={
        <>
          Recruiters send a test from a candidate's Greenhouse profile; the candidate gets their link from here, and Greenhouse is told the moment
          the attempt is graded, with the score and a link to the report. Greenhouse sees marks, never answers or follow-ups.
        </>
      }
      actions={<span className={`pill${enabled ? " ok" : ""}`}>{enabled ? "On" : "Off"}</span>}
    >
      {key === null ? null : <Secret label="Your Greenhouse key" value={key} onDone={() => setKey(null)} />}
      <details>
        <summary className="notice">What to send Greenhouse</summary>
        <p className="notice">Email these to partners@greenhouse.io with the key, or give them to your Greenhouse account manager:</p>
        <dl className="viva">
          {Object.entries(endpoints).map(([name, url]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd className="mono">{url}</dd>
            </div>
          ))}
        </dl>
      </details>
      <div className="row">
        <button type="button" className={enabled ? "secondary" : ""} disabled={issue.isPending} onClick={() => issue.mutate()}>
          {enabled ? "Issue a new key" : "Turn on and issue a key"}
        </button>
        {enabled ? (
          <button type="button" className="quiet" disabled={disable.isPending} onClick={() => disable.mutate()}>
            Turn off
          </button>
        ) : null}
      </div>
      {enabled ? <p className="notice">A new key stops the old one at once: send Greenhouse the new one straight away.</p> : null}
    </SettingsGroup>
  );
}

// --- Lever, Zoho Recruit, Darwinbox ---------------------------------------------------

type AtsFields = {
  readonly settings: readonly { readonly name: string; readonly label: string; readonly placeholder?: string; readonly options?: readonly string[] }[];
  readonly credentials: readonly { readonly name: string; readonly label: string }[];
  readonly help: string;
  readonly hookHelp: string;
};

const ATS_FIELDS: Record<AtsProvider, AtsFields> = {
  lever: {
    settings: [{ name: "stageExams", label: "Stage → exam", placeholder: "stage id = exam id, one per line" }],
    credentials: [
      { name: "apiKey", label: "Lever API key" },
      { name: "signatureToken", label: "Webhook signature token" },
    ],
    help: "Moving a candidate into a stage you map here sends them that exam. The result is added as a note on the opportunity.",
    hookHelp: "In Lever, Settings → Integrations and API → Webhooks: add this URL for “Candidate stage change”, and paste its signature token above.",
  },
  zoho_recruit: {
    settings: [
      { name: "dataCentre", label: "Zoho data centre", options: ["in", "com", "eu", "com.au", "jp", "com.cn"] },
      { name: "defaultExamId", label: "Exam when none is named", placeholder: "exam id" },
    ],
    credentials: [
      { name: "clientId", label: "Client ID" },
      { name: "clientSecret", label: "Client secret" },
      { name: "refreshToken", label: "Refresh token" },
    ],
    help: "A workflow rule in Zoho Recruit calls the hook; the result is added as a note on the candidate. Make a Self Client in Zoho's API console with the ZohoRecruit.modules.ALL scope for the refresh token.",
    hookHelp: "In Zoho Recruit, Setup → Automation → Webhooks: POST to this URL with a raw JSON body of candidateId, email, firstName, lastName, mobile (and examId to choose the exam).",
  },
  darwinbox: {
    settings: [
      { name: "callbackUrl", label: "Result callback URL", placeholder: "https://…darwinbox…/assessment-result" },
      { name: "defaultExamId", label: "Exam when none is named", placeholder: "exam id" },
    ],
    credentials: [{ name: "callbackToken", label: "Callback bearer token" }],
    help: "Darwinbox's recruitment workflow calls the hook; the result is posted back to the callback address with the token Darwinbox gives you.",
    hookHelp: "Give your Darwinbox administrator this URL. It takes JSON: candidate_id, name, email, phone, job_id, and test_id (an exam id).",
  },
};

function AtsConnectors({ client }: { client: ConsoleClient }) {
  const connectors = useQuery({ queryKey: ["ats"], queryFn: () => client.atsConnectors() });
  if (connectors.data === undefined) return null;
  return (
    <>
      {connectors.data.map((c) => (
        <AtsCard key={c.provider} client={client} connector={c} />
      ))}
    </>
  );
}

const stageText = (map: unknown) =>
  Object.entries((map ?? {}) as Record<string, string>)
    .map(([stage, exam]) => `${stage} = ${exam}`)
    .join("\n");

function AtsCard({ client, connector }: { client: ConsoleClient; connector: AtsConnector }) {
  const queryClient = useQueryClient();
  const fields = ATS_FIELDS[connector.provider];
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.settings.map((f) => [
        f.name,
        f.name === "stageExams" ? stageText(connector.settings["stageExams"]) : String(connector.settings[f.name] ?? (f.options?.[0] ?? "")),
      ]),
    ),
  );
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [hook, setHook] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["ats"] });

  const save = useMutation({
    mutationFn: () => {
      const shaped: Record<string, unknown> = {};
      for (const f of fields.settings) {
        const value = settings[f.name] ?? "";
        if (f.name === "stageExams") {
          shaped[f.name] = Object.fromEntries(
            value
              .split("\n")
              .map((line) => line.split("=").map((part) => part.trim()))
              .filter((pair) => pair.length === 2 && pair[0] !== "" && pair[1] !== ""),
          );
        } else shaped[f.name] = f.name === "defaultExamId" && value.trim() === "" ? null : value.trim();
      }
      const filled = fields.credentials.every((f) => (credentials[f.name] ?? "") !== "");
      return client.saveAts(connector.provider, shaped, filled ? credentials : undefined);
    },
    onSuccess: async () => {
      setCredentials({});
      await refresh();
    },
  });
  const issue = useMutation({ mutationFn: () => client.issueAtsHook(connector.provider), onSuccess: (r) => setHook(r.hookUrl) });
  const disable = useMutation({ mutationFn: () => client.disableAts(connector.provider), onSettled: refresh });
  const check = useMutation({ mutationFn: () => client.checkAts(connector.provider) });
  const problem = save.error ?? issue.error ?? disable.error ?? check.error;

  return (
    <SettingsGroup
      id={`ats-${connector.provider}`}
      title={connector.label}
      description={
        <>
          {fields.help} It sees marks and a link to the report, never answers or follow-ups.
        </>
      }
      actions={<span className={`pill${connector.enabled ? " ok" : ""}`}>{connector.enabled ? "On" : "Off"}</span>}
    >
      {hook === null ? null : (
        <>
          <Secret label={`${connector.label} hook URL`} value={hook} onDone={() => setHook(null)} />
          <p className="notice">{fields.hookHelp}</p>
        </>
      )}
      {open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid">
            {fields.settings.map((f) => (
              <div className="field" key={f.name}>
                <label htmlFor={`${connector.provider}-${f.name}`}>{f.label}</label>
                {f.options !== undefined ? (
                  <select id={`${connector.provider}-${f.name}`} value={settings[f.name]} onChange={(e) => setSettings({ ...settings, [f.name]: e.target.value })}>
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        zoho.{o}
                      </option>
                    ))}
                  </select>
                ) : f.name === "stageExams" ? (
                  <textarea
                    id={`${connector.provider}-${f.name}`}
                    rows={3}
                    placeholder={f.placeholder}
                    value={settings[f.name]}
                    onChange={(e) => setSettings({ ...settings, [f.name]: e.target.value })}
                  />
                ) : (
                  <input
                    id={`${connector.provider}-${f.name}`}
                    placeholder={f.placeholder}
                    value={settings[f.name]}
                    onChange={(e) => setSettings({ ...settings, [f.name]: e.target.value })}
                  />
                )}
              </div>
            ))}
            {fields.credentials.map((f) => (
              <div className="field" key={f.name}>
                <label htmlFor={`${connector.provider}-${f.name}`}>{f.label}</label>
                <input
                  id={`${connector.provider}-${f.name}`}
                  type="password"
                  autoComplete="off"
                  placeholder={connector.credentialsSet ? "Unchanged" : ""}
                  value={credentials[f.name] ?? ""}
                  onChange={(e) => setCredentials({ ...credentials, [f.name]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="row">
            <button type="submit" disabled={save.isPending}>
              Save and turn on
            </button>
            <button type="button" className="quiet" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </form>
      ) : null}
      {problem === null ? null : (
        <p className="error" role="alert">
          {problem instanceof ConsoleError ? (problem.detail ?? problem.message) : "That did not work."}
        </p>
      )}
      {check.data === undefined ? null : (
        <p className={check.data.ok ? "notice connection-ok" : "error"} role="status">
          {check.data.ok ? "Connected: " : "Not connected: "}
          {check.data.detail}
        </p>
      )}
      <div className="row">
        {open ? null : (
          <button type="button" className={connector.configured ? "secondary" : ""} onClick={() => setOpen(true)}>
            {connector.configured ? "Change settings" : `Set up ${connector.label}`}
          </button>
        )}
        {connector.enabled ? (
          <>
            <button type="button" className="secondary" disabled={issue.isPending} onClick={() => issue.mutate()}>
              Issue hook URL
            </button>
            <button type="button" className="secondary" disabled={check.isPending} onClick={() => check.mutate()}>
              {check.isPending ? "Testing…" : "Test connection"}
            </button>
            <button type="button" className="quiet" disabled={disable.isPending} onClick={() => disable.mutate()}>
              Turn off
            </button>
          </>
        ) : null}
      </div>
    </SettingsGroup>
  );
}

// --- Moodle and other LMSs, through LTI 1.3 --------------------------------------------

function LtiPlatforms({ client }: { client: ConsoleClient }) {
  const queryClient = useQueryClient();
  const platforms = useQuery({ queryKey: ["lti"], queryFn: () => client.ltiPlatforms() });
  const [site, setSite] = useState("");
  const [clientId, setClientId] = useState("");
  const [deployment, setDeployment] = useState("");
  const register = useMutation({
    mutationFn: () => {
      const root = site.trim().replace(/\/+$/, "");
      return client.registerLti({
        name: new URL(root).hostname,
        issuer: root,
        clientId: clientId.trim(),
        deploymentIds: deployment.trim() === "" ? [] : [deployment.trim()],
        authLoginUrl: `${root}/mod/lti/auth.php`,
        authTokenUrl: `${root}/mod/lti/token.php`,
        jwksUrl: `${root}/mod/lti/certs.php`,
      });
    },
    onSuccess: async () => {
      setClientId("");
      setDeployment("");
      await queryClient.invalidateQueries({ queryKey: ["lti"] });
    },
  });
  const toggle = useMutation({
    mutationFn: (p: LtiPlatform) => client.updateLti(p.id, { ...p, enabled: !p.enabled }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["lti"] }),
  });
  let validSite = false;
  try {
    validSite = /^https?:$/.test(new URL(site.trim()).protocol);
  } catch {
    validSite = false;
  }
  return (
    <SettingsGroup
      id="lti"
      title="Moodle and other LMSs"
      label="Moodle (LTI 1.3)"
      description={
        <>
          Put an exam in a Moodle course as an activity. Each student who opens it gets their own attempt — no link to email — and their grade goes back
          to the course's grade book once the attempt is graded. Canvas and Blackboard work the same way.
        </>
      }
      actions={<span className="pill">LTI 1.3</span>}
    >
      {(platforms.data ?? []).map((p) => (
        <div key={p.id} className="lti-platform">
          <p>
            <strong>{p.name}</strong> <span className={`pill${p.enabled ? " ok" : ""}`}>{p.enabled ? "On" : "Off"}</span>{" "}
            <button type="button" className="quiet" onClick={() => toggle.mutate(p)}>
              {p.enabled ? "Turn off" : "Turn on"}
            </button>
          </p>
          <p className="notice">In Moodle, Site administration → Plugins → External tool → Manage tools → configure a tool manually, LTI 1.3, with:</p>
          <dl className="viva">
            <div>
              <dt>Tool URL</dt>
              <dd className="mono">{p.tool.toolUrl}</dd>
            </div>
            <div>
              <dt>Initiate login URL</dt>
              <dd className="mono">{p.tool.loginUrl}</dd>
            </div>
            <div>
              <dt>Redirection URI</dt>
              <dd className="mono">{p.tool.redirectUrl}</dd>
            </div>
            <div>
              <dt>Public keyset URL</dt>
              <dd className="mono">{p.tool.jwksUrl}</dd>
            </div>
            <div>
              <dt>Custom parameters (per activity)</dt>
              <dd className="mono">{p.tool.customParameters}</dd>
            </div>
          </dl>
          <p className="notice">
            Tick “IMS LTI Assignment and Grade Services” (use this service for grade sync only), and set the default launch container to “New window”:
            Parikshaa's pages do not load inside a frame.
          </p>
        </div>
      ))}
      <details open={(platforms.data ?? []).length === 0}>
        <summary className="notice">Register a Moodle site</summary>
        <p className="notice">Register the tool in Moodle first to get its client ID and deployment ID, then enter them here.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            register.mutate();
          }}
        >
          <div className="grid">
            <div className="field">
              <label htmlFor="lti-site">Moodle site address</label>
              <input id="lti-site" placeholder="https://lms.college.ac.in" value={site} onChange={(e) => setSite(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="lti-client">Client ID</label>
              <input id="lti-client" value={clientId} onChange={(e) => setClientId(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="lti-deployment">Deployment ID</label>
              <input id="lti-deployment" value={deployment} onChange={(e) => setDeployment(e.target.value)} />
            </div>
          </div>
          {register.error === null ? null : (
            <p className="error" role="alert">
              {register.error instanceof ConsoleError ? (register.error.detail ?? register.error.message) : "Not registered."}
            </p>
          )}
          <div className="row">
            <button type="submit" disabled={register.isPending || !validSite || clientId.trim() === ""}>
              Register
            </button>
          </div>
        </form>
      </details>
    </SettingsGroup>
  );
}
