import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConsoleError, type ConsoleClient, type LiveRow } from "../api.ts";

/**
 * The sitting, live (ROADMAP §8): who has started, how far each candidate is,
 * who has gone quiet, and a way to tell the whole room something at once.
 *
 * "Away" and "idle" are kept apart because they call for different things:
 * a page that has stopped checking in is closed or offline, which is worth a
 * look; an open page where nothing is being typed is someone thinking, as
 * often as not. Neither is a finding about anyone.
 */

const REFRESH_MS = 5_000;

const STATE: Record<LiveRow["state"], string> = {
  not_started: "not started",
  in_progress: "taking it",
  submitted: "submitted",
  graded: "graded",
  void: "set aside",
};

const ago = (now: number, at: number | null) => {
  if (at === null) return "not yet";
  const minutes = Math.floor((now - at) / 60_000);
  return now - at < 90_000 ? "here now" : `${minutes} min ago`;
};

const left = (now: number, at: number | null) => (at === null ? "—" : at <= now ? "time up" : `${Math.ceil((at - now) / 60_000)} min`);

type Filter = "attention" | "all" | "not_started" | "submitted";

const needsAttention = (r: LiveRow) => r.flags.away || r.flags.idle || r.flags.overdue || r.awaitingReply;

export function LivePanel({ client, examId, canIntervene }: { client: ConsoleClient; examId: string; canIntervene: boolean }) {
  const [idleMinutes, setIdleMinutes] = useState(5);
  const [filter, setFilter] = useState<Filter>("all");
  const live = useQuery({
    queryKey: ["live", examId, idleMinutes],
    queryFn: () => client.live(examId, idleMinutes),
    refetchInterval: REFRESH_MS,
  });

  if (live.isPending) return <p className="notice">Loading…</p>;
  if (live.error !== null) return <p className="error">Could not load the sitting.</p>;
  const { counts, rows, at, announcements } = live.data;
  const shown = rows.filter((r) =>
    filter === "all" ? true : filter === "attention" ? needsAttention(r) : filter === "not_started" ? r.state === "not_started" : r.state === "submitted",
  );

  return (
    <>
      <section className="card" aria-label="The sitting now">
        <div className="bar" style={{ marginBottom: ".4rem" }}>
          <strong>{live.data.exam.title}</strong>
          <span className="notice">updates every {REFRESH_MS / 1000} s</span>
        </div>
        <dl className="figures">
          <Figure label="Invited" value={counts.invited} />
          <Figure label="Not started" value={counts.notStarted} />
          <Figure label="Taking it" value={counts.inProgress} />
          <Figure label="Away" value={counts.away} warn={counts.away > 0} />
          <Figure label="Idle" value={counts.idle} />
          <Figure label="Submitted" value={counts.submitted + counts.graded} />
          <Figure label="Set aside" value={counts.void} />
        </dl>
      </section>

      {canIntervene ? <Announce client={client} examId={examId} /> : null}
      {announcements.length === 0 ? null : (
        <section className="card" aria-label="Told to the room">
          <strong>Told to the room</strong>
          <ul className="pool">
            {[...announcements].reverse().map((a) => (
              <li key={a.id}>
                <span className="notice">
                  {new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", timeStyle: "short" }).format(new Date(a.at))} · {a.authorName}
                </span>{" "}
                — {a.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card" aria-label="Candidates now">
        <div className="row" style={{ marginTop: 0 }}>
          <label className="inline">
            Show{" "}
            <select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} style={{ width: "auto" }}>
              <option value="all">everyone</option>
              <option value="attention">needing attention</option>
              <option value="not_started">not started</option>
              <option value="submitted">submitted</option>
            </select>
          </label>
          <label className="inline">
            Idle after{" "}
            <input
              aria-label="Idle after (minutes)"
              type="number"
              min={1}
              max={120}
              value={idleMinutes}
              onChange={(e) => setIdleMinutes(Math.max(1, Number(e.target.value) || 5))}
              style={{ width: "4.5rem" }}
            />{" "}
            min
          </label>
        </div>
        {shown.length === 0 ? (
          <p className="notice">{filter === "attention" ? "Nobody needs attention." : "Nobody here."}</p>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Ref</th>
                  <th scope="col">Name</th>
                  <th scope="col">Progress</th>
                  <th scope="col">Last seen</th>
                  <th scope="col">Time left</th>
                  <th scope="col">State</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <Row key={r.invitationId ?? r.attemptId} row={r} now={at} client={client} canIntervene={canIntervene} examId={examId} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Figure({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={warn ? "warn" : undefined}>{value}</dd>
    </div>
  );
}

function Row({ row, now, client, canIntervene, examId }: { row: LiveRow; now: number; client: ConsoleClient; canIntervene: boolean; examId: string }) {
  const [acting, setActing] = useState<"extend" | "reopen" | null>(null);
  const flags = [
    row.flags.away ? "away" : null,
    row.flags.idle ? "idle" : null,
    row.flags.overdue ? "time up" : null,
    row.awaitingReply ? "answering a follow-up" : null,
    row.extraMinutes > 0 ? `+${row.extraMinutes} min` : null,
    row.reopened > 0 ? `reopened${row.reopened > 1 ? ` ×${row.reopened}` : ""}` : null,
  ].filter((f): f is string => f !== null);

  return (
    <>
      <tr>
        <td className="mono">{row.ref}</td>
        <td>{row.name}</td>
        <td>
          {row.state === "not_started" ? (
            "—"
          ) : (
            <span aria-label={`${row.answered} of ${row.questions} answered`}>
              <meter min={0} max={row.questions} value={row.answered} /> {row.answered}/{row.questions}
            </span>
          )}
        </td>
        <td className="notice">{row.state === "in_progress" ? ago(now, row.lastSeenAt) : "—"}</td>
        <td>{row.state === "in_progress" ? left(now, row.expiresAt) : "—"}</td>
        <td>
          <span className="pill">{STATE[row.state]}</span>{" "}
          {flags.map((f) => (
            <span key={f} className={f === "away" || f === "time up" ? "pill attention" : "pill"}>
              {f}
            </span>
          ))}
        </td>
        <td>
          {canIntervene && row.attemptId !== null && row.state === "in_progress" ? (
            <button type="button" className="quiet" onClick={() => setActing(acting === "extend" ? null : "extend")}>
              Extend…
            </button>
          ) : null}
          {canIntervene && row.attemptId !== null && row.state === "submitted" ? (
            <button type="button" className="quiet" onClick={() => setActing(acting === "reopen" ? null : "reopen")}>
              Reopen…
            </button>
          ) : null}
        </td>
      </tr>
      {acting !== null && row.attemptId !== null ? (
        <tr>
          <td colSpan={7}>
            <Intervene client={client} examId={examId} attemptId={row.attemptId} kind={acting} ref_={row.ref} onDone={() => setActing(null)} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

/** Extend or reopen: minutes and a reason, both recorded in the candidate's ledger with the person's name. */
function Intervene({
  client,
  examId,
  attemptId,
  kind,
  ref_,
  onDone,
}: {
  client: ConsoleClient;
  examId: string;
  attemptId: string;
  kind: "extend" | "reopen";
  ref_: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState(kind === "reopen" ? 15 : 10);
  const [reason, setReason] = useState("");
  const act = useMutation({
    mutationFn: () => (kind === "extend" ? client.extendTime(attemptId, minutes, reason) : client.reopen(attemptId, minutes, reason)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["live", examId] });
      onDone();
    },
  });
  const verb = kind === "extend" ? "Extend" : "Reopen";
  return (
    <form
      aria-label={`${verb} ${ref_}`}
      onSubmit={(e) => {
        e.preventDefault();
        act.mutate();
      }}
    >
      <div className="grid">
        <div className="field">
          <label htmlFor={`minutes-${attemptId}`}>{kind === "extend" ? "Extra minutes" : "Minutes from now"}</label>
          <input id={`minutes-${attemptId}`} type="number" min={1} max={240} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        </div>
        <div className="field">
          <label htmlFor={`reason-${attemptId}`}>Reason (goes on the candidate's record)</label>
          <input id={`reason-${attemptId}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. laptop crashed and submitted" />
        </div>
      </div>
      <div className="row">
        <button type="submit" disabled={act.isPending || reason.trim().length < 10 || minutes < 1}>
          {verb}
        </button>
        <button type="button" className="quiet" onClick={onDone}>
          Cancel
        </button>
        {reason.trim().length > 0 && reason.trim().length < 10 ? <span className="notice">At least 10 characters.</span> : null}
        {act.error instanceof ConsoleError ? <span className="error">{act.error.detail ?? "That did not work."}</span> : null}
      </div>
    </form>
  );
}

function Announce({ client, examId }: { client: ConsoleClient; examId: string }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const send = useMutation({
    mutationFn: () => client.announce(examId, message.trim()),
    onSuccess: async () => {
      setMessage("");
      await queryClient.invalidateQueries({ queryKey: ["live", examId] });
    },
  });
  return (
    <section className="card" aria-label="Tell the room">
      <label htmlFor="announcement">Tell everyone sitting this exam</label>
      <textarea
        id="announcement"
        maxLength={500}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="e.g. Question 4: assume the array is sorted."
      />
      <div className="row">
        <button type="button" disabled={send.isPending || message.trim() === ""} onClick={() => send.mutate()}>
          Send to everyone
        </button>
        <span className="notice">Appears on every candidate's page within half a minute.</span>
        {send.isSuccess ? <span className="notice" role="status">Sent.</span> : null}
      </div>
    </section>
  );
}
