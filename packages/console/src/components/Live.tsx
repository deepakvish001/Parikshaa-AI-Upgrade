import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Megaphone, RotateCcw, Users } from "lucide-react";
import { Dialog, Drawer, useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type ConsoleClient, type LiveRow } from "../api.ts";
import { TimeDialog } from "./Intervene.tsx";
import { Banner, EmptyState, PageActions, RowMenu, SkeletonRows, StatBar, StateBadge, ago } from "./kit.tsx";
import { IDENTITY_LABEL, ProctoringReview } from "./Proctoring.tsx";
// Loaded when the Live page is: most staff never open it.
const LabCard = lazy(() => import("./Lab.tsx").then((m) => ({ default: m.LabCard })));

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
/** A page that checked in this recently is taken to be open in front of someone. */
const HERE_WITHIN_MS = 90_000;

const left = (now: number, at: number | null) => (at === null ? "—" : at <= now ? "Time up" : `${Math.ceil((at - now) / 60_000)} min`);

type Filter = "attention" | "all" | "not_started" | "submitted";

const needsAttention = (r: LiveRow) =>
  r.flags.away || r.flags.idle || r.flags.overdue || r.flags.cameraOff || r.awaitingReply || r.proctoring?.identity === "pending";

/** The page's clock, a second at a time, for "Updated 5 s ago". */
function useNow(everyMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(timer);
  }, [everyMs]);
  return now;
}

/** When the page last heard from the server, with a ring that fills until it asks again. */
function Freshness({ updatedAt, now }: { updatedAt: number; now: number }) {
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  return (
    <span className="freshness">
      <svg key={updatedAt} className="refresh-ring" viewBox="0 0 16 16" aria-hidden="true" style={{ ["--refresh" as string]: `${REFRESH_MS}ms` }}>
        <circle cx="8" cy="8" r="6" className="refresh-track" />
        <circle cx="8" cy="8" r="6" className="refresh-fill" pathLength={100} />
      </svg>
      Updated {seconds < 1 ? "just now" : `${seconds} s ago`}
    </span>
  );
}

export function LivePanel({
  client,
  examId,
  canIntervene,
  canConfigure = false,
}: {
  client: ConsoleClient;
  examId: string;
  canIntervene: boolean;
  /** Set lab mode: those who write exams. */
  canConfigure?: boolean;
}) {
  const [idleMinutes, setIdleMinutes] = useState(5);
  const [filter, setFilter] = useState<Filter>("all");
  const [announcing, setAnnouncing] = useState(false);
  const [acting, setActing] = useState<{ kind: "extend" | "reopen"; row: LiveRow } | null>(null);
  const [extendingAll, setExtendingAll] = useState(false);
  const [reviewing, setReviewing] = useState<LiveRow | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const clock = useNow(1000);
  const live = useQuery({
    queryKey: ["live", examId, idleMinutes],
    queryFn: () => client.live(examId, idleMinutes),
    refetchInterval: REFRESH_MS,
  });

  const sitting = live.data?.rows.filter((r) => r.attemptId !== null && r.state === "in_progress").length ?? 0;
  const header = canIntervene ? (
    <PageActions>
      <button type="button" className="secondary" disabled={sitting === 0} onClick={() => setExtendingAll(true)}>
        <Clock aria-hidden="true" />
        Extra time for everyone
      </button>
      <button type="button" className="secondary" onClick={() => setAnnouncing(true)}>
        <Megaphone aria-hidden="true" />
        Announce
      </button>
    </PageActions>
  ) : null;

  if (live.isPending)
    return (
      <>
        {header}
        <section className="card">
          <SkeletonRows columns={6} label="Loading the sitting…" />
        </section>
      </>
    );
  if (live.error !== null) return <Banner tone="danger" title="Could not load the sitting.">It is asked for again every few seconds.</Banner>;
  const { counts, rows, at, announcements } = live.data;
  const proctored = rows.some((r) => r.proctoring !== null);
  const inProgress = rows.filter((r) => r.state === "in_progress");
  const away = inProgress.filter((r) => r.flags.away).length;
  const idle = inProgress.filter((r) => !r.flags.away && r.flags.idle).length;
  const shown = rows
    .filter((r) => (filter === "all" ? true : filter === "attention" ? needsAttention(r) : filter === "not_started" ? r.state === "not_started" : r.state === "submitted"))
    // Whoever needs someone comes first; otherwise the server's order.
    .map((r, i) => ({ r, i }))
    .sort((a, b) => Number(needsAttention(b.r)) - Number(needsAttention(a.r)) || a.i - b.i)
    .map(({ r }) => r);

  return (
    <>
      {header}
      <section className="card live-summary" aria-label="The sitting now">
        <div className="bar">
          <strong>Where everyone stands</strong>
          <span className="spacer" />
          <Freshness updatedAt={live.dataUpdatedAt} now={Math.max(clock, live.dataUpdatedAt)} />
        </div>
        <StatBar
          label="Candidates by where they stand"
          segments={[
            { id: "not_started", label: "Not started", value: counts.notStarted },
            { id: "in_progress", label: "In progress", value: inProgress.length - away - idle },
            { id: "away", label: "Away", value: away },
            { id: "idle", label: "Idle", value: idle },
            { id: "submitted", label: "Submitted", value: counts.submitted + counts.graded },
          ]}
        />
        <dl className="figure-line live-line">
          <div>
            <dt>Invited</dt>
            <dd>{counts.invited}</dd>
          </div>
          <div>
            <dt>Set aside</dt>
            <dd>{counts.void}</dd>
          </div>
          {proctored ? (
            <>
              <div className={counts.cameraOff > 0 ? "attention" : undefined}>
                <dt>Camera off</dt>
                <dd>{counts.cameraOff}</dd>
              </div>
              <div className={counts.identityPending > 0 ? "attention" : undefined}>
                <dt>ID to check</dt>
                <dd>{counts.identityPending}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </section>

      <Suspense fallback={null}>
        <LabCard client={client} examId={examId} canStart={canIntervene} canConfigure={canConfigure} />
      </Suspense>

      {announcements.length === 0 ? null : (
        <section className="card told" aria-label="Told to the room">
          <strong>Told to the room</strong>
          <ul className="told-list">
            {[...announcements].reverse().map((a) => (
              <li key={a.id}>
                <span className="notice">
                  {new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", timeStyle: "short" }).format(new Date(a.at))} · {a.authorName}
                </span>
                <span>{a.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card live-table" aria-label="Candidates now">
        <div className="bar filter-bar">
          <strong>Candidates</strong>
          <span className="spacer" />
          <label className="inline">
            Show{" "}
            <select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="all">Everyone</option>
              <option value="attention">Needing attention</option>
              <option value="not_started">Not started</option>
              <option value="submitted">Submitted</option>
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
              className="minutes-input"
            />{" "}
            min
          </label>
        </div>
        {shown.length === 0 ? (
          <EmptyState icon={Users} compact {...(filter === "all" ? {} : { action: { label: "Show everyone", onClick: () => setFilter("all") } })}>
            {filter === "attention" ? "Nobody needs attention." : rows.length === 0 ? "Candidates appear here once they are invited." : "Nobody in this state just now."}
          </EmptyState>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Roll no.</th>
                  <th scope="col">Name</th>
                  <th scope="col">State</th>
                  <th scope="col">Progress</th>
                  <th scope="col">Last seen</th>
                  <th scope="col" className="num">
                    Time left
                  </th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <Row
                    key={r.invitationId ?? r.attemptId}
                    row={r}
                    now={at}
                    canIntervene={canIntervene}
                    onAct={(kind) => setActing({ kind, row: r })}
                    onReview={() => setReviewing(r)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {announcing ? <Announce client={client} examId={examId} onClose={() => setAnnouncing(false)} /> : null}
      {extendingAll ? (
        <TimeDialog
          kind="everyone"
          who={`${sitting} candidate${sitting === 1 ? "" : "s"}`}
          onSubmit={async (minutes, reason) => {
            const result = await client.extendOpen(examId, minutes, reason);
            await queryClient.invalidateQueries({ queryKey: ["live", examId] });
            toast(
              `${minutes} extra minute${minutes === 1 ? "" : "s"} given to ${result.extended} candidate${result.extended === 1 ? "" : "s"}` +
                (result.failed.length === 0 ? "" : `; ${result.failed.length} had already finished`),
              "success",
            );
          }}
          onClose={() => setExtendingAll(false)}
        />
      ) : null}
      {acting === null || acting.row.attemptId === null ? null : (
        <TimeDialog
          kind={acting.kind}
          who={acting.row.ref}
          onSubmit={async (minutes, reason) => {
            const attemptId = acting.row.attemptId!;
            await (acting.kind === "extend" ? client.extendTime(attemptId, minutes, reason) : client.reopen(attemptId, minutes, reason));
            await queryClient.invalidateQueries({ queryKey: ["live", examId] });
            toast(acting.kind === "extend" ? `Extra time given to ${acting.row.ref}` : `Reopened for ${acting.row.ref}`, "success");
          }}
          onClose={() => setActing(null)}
        />
      )}
      {reviewing === null || reviewing.attemptId === null ? null : (
        <Drawer label={`Proctoring for ${reviewing.name === "" ? reviewing.ref : reviewing.name}`} onClose={() => setReviewing(null)} className="proctoring-drawer">
          <ProctoringReview
            client={client}
            attemptId={reviewing.attemptId}
            name={reviewing.name === "" ? reviewing.ref : reviewing.name}
            canDecide={canIntervene}
            onClose={() => setReviewing(null)}
          />
        </Drawer>
      )}
    </>
  );
}

function Row({ row, now, canIntervene, onAct, onReview }: { row: LiveRow; now: number; canIntervene: boolean; onAct: (kind: "extend" | "reopen") => void; onReview: () => void }) {
  const browser = Object.values(row.proctoring?.events ?? {}).reduce((sum, n) => sum + n, 0) - (row.proctoring?.events["camera_on"] ?? 0);
  // Words that ask for someone are coloured; the rest are plain facts.
  type Tone = "attention" | "ok" | "";
  const flag = (words: string, tone: Tone): readonly [string, Tone] => [words, tone];
  const identity = row.proctoring?.identity ?? "not_taken";
  const flags = [
    row.flags.cameraOff ? flag("Camera off", "attention") : null,
    identity === "not_taken" ? null : flag(IDENTITY_LABEL[identity], identity === "verified" ? "ok" : "attention"),
    browser > 0 ? flag(`${browser} browser event${browser === 1 ? "" : "s"}`, "") : null,
    row.flags.away ? flag("Away", "attention") : null,
    row.flags.idle ? flag("Idle", "") : null,
    row.flags.overdue ? flag("Time up", "attention") : null,
    row.awaitingReply ? flag("Answering a follow-up", "") : null,
    row.extraMinutes > 0 ? flag(`+${row.extraMinutes} min`, "") : null,
    row.reopened > 0 ? flag(`Reopened${row.reopened > 1 ? ` ×${row.reopened}` : ""}`, "") : null,
  ].filter((f) => f !== null);
  const seen = row.state !== "in_progress" ? null : row.lastSeenAt === null ? "never" : now - row.lastSeenAt < HERE_WITHIN_MS ? "here" : "away";

  return (
    <tr className={needsAttention(row) ? "needs-attention" : undefined}>
      <td className="mono">{row.ref}</td>
      <td>{row.name}</td>
      <td>
        <div className="live-state">
          <StateBadge state={row.state} />
          {flags.map(([f, tone]) => (
            <span key={f} className={`pill${tone === "" ? "" : ` ${tone}`}`}>
              {f}
            </span>
          ))}
        </div>
      </td>
      <td>
        {row.state === "not_started" ? (
          <span className="notice">—</span>
        ) : (
          <span className="progress-cell" aria-label={`${row.answered} of ${row.questions} answered`}>
            <meter min={0} max={row.questions} value={row.answered} /> {row.answered}/{row.questions}
          </span>
        )}
      </td>
      <td>
        {seen === null ? (
          <span className="notice">—</span>
        ) : (
          <span className={`seen-at ${seen}`}>
            <span className="seen-dot" aria-hidden="true" />
            {seen === "never" ? "Not yet" : seen === "here" ? "Here now" : ago(new Date(row.lastSeenAt!).toISOString(), now)}
          </span>
        )}
      </td>
      <td className="num">{row.state === "in_progress" ? left(now, row.expiresAt) : "—"}</td>
      <td className="row-end">
        {row.proctoring !== null && row.attemptId !== null ? (
          <button type="button" className="quiet" aria-label={`Review ${row.ref}`} onClick={onReview}>
            Review
          </button>
        ) : null}
        <RowMenu
          of={row.ref}
          keepPlace
          items={[
            canIntervene && row.attemptId !== null && row.state === "in_progress" && { label: "Extra time…", icon: <Clock />, onSelect: () => onAct("extend") },
            canIntervene && row.attemptId !== null && row.state === "submitted" && { label: "Reopen…", icon: <RotateCcw />, onSelect: () => onAct("reopen") },
          ]}
        />
      </td>
    </tr>
  );
}

/** Something the whole room should know, on every candidate's page within half a minute. */
function Announce({ client, examId, onClose }: { client: ConsoleClient; examId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [message, setMessage] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const send = useMutation({
    mutationFn: () => client.announce(examId, message.trim()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["live", examId] });
      toast("Sent to everyone", "success");
      onClose();
    },
  });
  return (
    <Dialog label="Tell the room" onClose={onClose} initialFocus={field} dismissable={!send.isPending}>
      <section aria-label="Tell the room">
        <h2 className="dialog-title">Tell the room</h2>
        <div className="field">
          <label htmlFor="announcement">Tell everyone sitting this exam</label>
          <textarea
            ref={field}
            id="announcement"
            maxLength={500}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Question 4: assume the array is sorted."
          />
          <p className="notice small">Appears on every candidate's page within half a minute, and stays in the record.</p>
        </div>
        {send.error === null ? null : (
          <p className="error" role="alert">
            {send.error instanceof ConsoleError ? (send.error.detail ?? "That did not send.") : "That did not send."}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="button" disabled={send.isPending || message.trim() === ""} onClick={() => send.mutate()}>
            Send to everyone
          </button>
        </div>
      </section>
    </Dialog>
  );
}
