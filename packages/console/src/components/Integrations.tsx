import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConsoleError, WEBHOOK_EVENTS, type ConsoleClient, type Webhook } from "../api.ts";

/**
 * Integrations (ROADMAP §7): webhooks to the organisation's own systems, and
 * the Greenhouse connector. Owner only.
 */

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function IntegrationsPanel({ client }: { client: ConsoleClient }) {
  return (
    <>
      <Webhooks client={client} />
      <Greenhouse client={client} />
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
