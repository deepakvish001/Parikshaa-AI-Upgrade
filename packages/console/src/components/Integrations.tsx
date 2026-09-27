import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConsoleError, WEBHOOK_EVENTS, type AtsConnector, type AtsProvider, type ConsoleClient, type Webhook } from "../api.ts";

/**
 * Integrations (ROADMAP §7): webhooks to the organisation's own systems, and
 * Greenhouse, Lever, Zoho Recruit and Darwinbox. Owner only.
 */

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function IntegrationsPanel({ client }: { client: ConsoleClient }) {
  return (
    <>
      <Webhooks client={client} />
      <Greenhouse client={client} />
      <AtsConnectors client={client} />
    </>
  );
}

/** A secret shown once, to copy now. */
function Secret({ label, value, onDone }: { label: string; value: string; onDone: () => void }) {
  return (
    <div className="card evidence" role="status" aria-label={label}>
      <p style={{ marginTop: 0 }}>
        <strong>{label}</strong> — copy it now into the receiving system.
      </p>
      <p className="mono" style={{ wordBreak: "break-all" }}>
        {value}
      </p>
      <button type="button" className="quiet" onClick={onDone}>
        Done
      </button>
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
      <section className="card" aria-label="Webhooks">
        <strong>Webhooks</strong>
        <p className="notice">
          Your systems are told when an attempt starts, is submitted, is graded or is set aside. Each delivery is signed as{" "}
          <a href="https://www.standardwebhooks.com/">Standard Webhooks</a> describes, so any of its libraries can check it, and is retried,
          backing off, for about two hours if your end is down.
        </p>
        {shown === null ? null : <Secret label={shown.label} value={shown.value} onDone={() => setShown(null)} />}
        {hooks.data === undefined ? null : hooks.data.length === 0 ? (
          <p className="notice">None yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Address</th>
                <th scope="col">Events</th>
                <th scope="col" />
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
      </section>

      <section className="card" aria-label="Add a webhook">
        <strong>Add a webhook</strong>
        <div className="field" style={{ marginTop: ".6rem" }}>
          <label htmlFor="webhook-url">Address (https)</label>
          <input id="webhook-url" type="url" placeholder="https://ats.example.com/parikshaa" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="row" role="group" aria-label="Events">
          {WEBHOOK_EVENTS.map((e) => (
            <label key={e} className="inline">
              <input type="checkbox" style={{ width: "auto" }} checked={events.includes(e)} onChange={() => toggle(e)} /> {e}
            </label>
          ))}
        </div>
        <p className="notice">Tick none to receive every event.</p>
        <button type="button" disabled={add.isPending || !url.trim().startsWith("https://")} onClick={() => add.mutate()}>
          Add
        </button>
        {refused === null ? null : <p className="error">{refused}</p>}
      </section>
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
        <td className="notice">{hook.events.length === 0 ? "every event" : hook.events.join(", ")}</td>
        <td>
          {hook.disabled ? (
            <span className="pill">stopped</span>
          ) : (
            <span className="row" style={{ marginTop: 0 }}>
              <button type="button" className="quiet" onClick={onToggle}>
                {open ? "Hide log" : "Log"}
              </button>
              <button type="button" className="quiet" onClick={onTest}>
                Send test
              </button>
              <button type="button" className="quiet" onClick={onReveal}>
                Secret
              </button>
              <button type="button" className="quiet" onClick={onRotate}>
                Rotate
              </button>
              <button type="button" className="quiet" onClick={onDisable}>
                Stop
              </button>
            </span>
          )}
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={3}>
            {deliveries.data === undefined ? (
              <p className="notice">Loading…</p>
            ) : deliveries.data.length === 0 ? (
              <p className="notice">Nothing sent yet.</p>
            ) : (
              <table aria-label={`Deliveries to ${hook.url}`}>
                <tbody>
                  {deliveries.data.map((d) => (
                    <tr key={d.id}>
                      <td className="notice">{when(d.createdAt)}</td>
                      <td className="mono">{d.event}</td>
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
    <section className="card" aria-label="Greenhouse">
      <strong>Greenhouse</strong> <span className="pill">{enabled ? "on" : "off"}</span>
      <p className="notice">
        Recruiters send a test from a candidate's Greenhouse profile; the candidate gets their link from here, and Greenhouse is told the moment
        the attempt is graded, with the score and a link to the report. Greenhouse sees marks, never answers or follow-ups.
      </p>
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
    </section>
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
  const problem = save.error ?? issue.error ?? disable.error;

  return (
    <section className="card" aria-label={connector.label}>
      <strong>{connector.label}</strong> <span className="pill">{connector.enabled ? "on" : "off"}</span>
      <p className="notice">{fields.help} It sees marks and a link to the report, never answers or follow-ups.</p>
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
            <button type="button" className="quiet" disabled={disable.isPending} onClick={() => disable.mutate()}>
              Turn off
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
