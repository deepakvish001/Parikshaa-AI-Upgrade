import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileStack } from "lucide-react";
import { ConsoleError, base64Of, type ConsoleClient, type ContentKey, type ContentProblem, type ContentUpload, type ContentUploadItem } from "../api.ts";
import { Banner, DropZone, EmptyState, SkeletonRows, StatBar } from "./kit.tsx";
import "./BulkUpload.css";

/**
 * The bulk content upload (tracker plan row 141, part B): a bundle of DSA,
 * SQL, MCQ, lesson, project or system design items (docs/content/
 * CONTENT-FORMAT.md) in; each item checked by machine and kept as a draft;
 * a reviewer reads the report and publishes. Learn shows nothing until then.
 *
 * Uploading and publishing need `exam:write`; the reports, `exam:read_key`
 * (everyone who sees the Practice panel).
 */

/** The server's limit on a bundle file (BUNDLE_LIMITS.fileBytes). */
export const BUNDLE_MAX_BYTES = 20 * 1024 * 1024;

const failure = (error: unknown, fallback: string) =>
  error instanceof ConsoleError ? (error.detail ?? (error.problems[0]?.message ?? fallback)) : fallback;

/** What each gate checks, in a reviewer's words: the report names the gate before what it found. */
const GATE_WORDS: Record<string, string> = {
  file: "The file",
  manifest: "The manifest",
  schema: "Format",
  rules: "Rules",
  duplicate: "Duplicate",
  version: "Version",
  generator: "Test generator",
  constraints: "Constraints",
  reference: "Reference solution",
  wrong: "Wrong solution",
  starter: "Starter code",
  solver: "Answer solver",
  code: "Code example",
  "hands-on": "Hands-on task",
  runner: "Code runner",
  store: "Saving",
  internal: "The check itself",
};

const TYPE_WORDS: Record<string, string> = {
  "dsa-problem": "DSA problem",
  "sql-problem": "SQL problem",
  mcq: "MCQ",
  lesson: "Lesson",
  project: "Project",
  "system-design": "System design",
};

/** Kinds Learn has no page for yet: they pass and stay drafts (handoff §5, Kadam 3/4). */
const NOT_ON_LEARN: Record<string, string> = {
  project: "Stays a draft: Learn has no page for projects yet.",
  "system-design": "Stays a draft: Learn has no page for system design cases yet.",
};

type Show = "all" | "failed" | "passed";

/** Where an item stands now: what its badge says, and whether it may be published from this upload. */
type Standing = { readonly badge: string; readonly tone: "ok" | "bad" | "info" | "brand" | "live" | "plain"; readonly note: string | null; readonly publishable: boolean };

export function standingOf(item: ContentUploadItem, uploadId: string): Standing {
  const c = item.current;
  if (c !== null && c.publishedVersion === item.version && c.publishedHash === item.hash) {
    return { badge: "Published", tone: "ok", note: "Live on Learn.", publishable: false };
  }
  switch (item.status) {
    case "pending":
      return { badge: "Waiting", tone: "brand", note: null, publishable: false };
    case "checking":
      return { badge: "Checking", tone: "live", note: "On the code runner now.", publishable: false };
    case "failed":
      return { badge: "Failed", tone: "bad", note: "Not kept. Fix what is listed and upload it again.", publishable: false };
    case "skipped":
      return { badge: "Skipped", tone: "plain", note: "This version, with the same content, was uploaded before; nothing changed.", publishable: false };
    case "passed": {
      if (c === null || c.version !== item.version || c.hash !== item.hash || c.uploadId !== uploadId) {
        return { badge: "Replaced", tone: "plain", note: "A later upload changed this item; publish it from that upload.", publishable: false };
      }
      const later = NOT_ON_LEARN[item.type];
      if (later !== undefined) return { badge: "Draft", tone: "info", note: later, publishable: false };
      return {
        badge: "Draft",
        tone: "info",
        note: c.publishedVersion === null ? "Passed every check. Learn shows it once it is published." : `Passed every check. Version ${c.publishedVersion} stays live until this one is published.`,
        publishable: true,
      };
    }
  }
}

const keyOf = (item: ContentKey) => `${item.namespace}:${item.slug}`;
const when = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function BulkUpload({ client, canWrite, pollMs = 2000 }: { client: ConsoleClient; canWrite: boolean; pollMs?: number }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const history = useQuery({
    queryKey: ["content", "uploads"],
    queryFn: () => client.contentUploads(),
    // An upload still on the runner: its counts move.
    refetchInterval: (query) => (query.state.data?.some((u) => u.state === "checking") === true ? pollMs : false),
  });
  const send = useMutation({
    mutationFn: async (chosen: File) => client.uploadContent(chosen.name, await base64Of(chosen)),
    onSuccess: (upload) => {
      setFile(null);
      queryClient.setQueryData(["content", "upload", upload.id], upload);
      setOpen(upload.id);
      void queryClient.invalidateQueries({ queryKey: ["content", "uploads"] });
    },
  });
  const tooBig = file !== null && file.size > BUNDLE_MAX_BYTES;
  const uploads = history.data ?? [];

  return (
    <>
      <section className="card prep-card" aria-label="Bulk upload">
        <div className="bar">
          <strong>Bulk upload</strong>
        </div>
        <p className="notice">
          A bundle of lessons and problems written to the content format (docs/content): DSA, SQL, MCQ, lessons, projects and system design. Each item is checked by machine, its
          format and rules at once, then its programs on the code runner. An item that passes is kept as a draft; learners see it only once a reviewer publishes it here.
        </p>
        {canWrite ? (
          <>
            <DropZone
              label="Choose a bundle"
              name="Content bundle (JSON or ZIP)"
              accept=".json,.zip,application/json,application/zip"
              chosen={file === null ? null : `${file.name} (${megabytes(file.size)})`}
              hint="One JSON file, or a ZIP of a folder with manifest.json at its root. 20 MB at most."
              onFile={(chosen) => {
                send.reset();
                setFile(chosen);
              }}
              disabled={send.isPending ? "Uploading…" : undefined}
            />
            {tooBig ? (
              <p className="error" role="alert">
                {file.name} is {megabytes(file.size)}; a bundle may be 20 MB at most. Split it into two bundles.
              </p>
            ) : null}
            <div className="row">
              <button type="button" disabled={file === null || tooBig || send.isPending} onClick={() => file !== null && send.mutate(file)}>
                {send.isPending ? "Uploading…" : "Upload and check"}
              </button>
            </div>
            {send.isError ? (
              <p className="error" role="alert">
                {failure(send.error, "That bundle could not be uploaded. Try again.")}
              </p>
            ) : null}
          </>
        ) : (
          <p className="notice">You can read the reports here. Uploading and publishing are for staff who may change exams: an owner or an author.</p>
        )}
      </section>

      {open === null ? null : <UploadReport key={open} client={client} id={open} canWrite={canWrite} pollMs={pollMs} />}

      <section className="card prep-card" aria-label="Uploads">
        <div className="bar">
          <strong>Uploads</strong>
        </div>
        {history.isPending ? (
          <SkeletonRows rows={3} columns={5} label="Loading the uploads…" />
        ) : history.isError ? (
          <p className="error" role="alert">
            {failure(history.error, "The uploads could not be loaded.")}
          </p>
        ) : uploads.length === 0 ? (
          <EmptyState icon={FileStack} compact>
            No bundles uploaded yet. Each upload and its report stays here.
          </EmptyState>
        ) : (
          <div className="scroll">
            <table className="content-uploads">
              <thead>
                <tr>
                  <th scope="col">Bundle</th>
                  <th scope="col">Uploaded</th>
                  <th scope="col">Items</th>
                  <th scope="col">Live on Learn</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u) => (
                  <tr key={u.id} aria-current={u.id === open ? "true" : undefined}>
                    <td>
                      <button type="button" className="link" onClick={() => setOpen(u.id)}>
                        {u.title}
                      </button>
                      <div className="notice">
                        {u.bundleId}, version {u.bundleVersion}
                      </div>
                    </td>
                    <td>
                      {when(u.createdAt)}
                      <div className="notice">by {u.createdBy.name}</div>
                    </td>
                    <td>
                      {u.state === "checking" ? (
                        <span className="pill live">Checking</span>
                      ) : (
                        <>
                          {u.counts.passed} passed, {u.counts.failed} failed
                          {u.counts.skipped > 0 ? `, ${u.counts.skipped} skipped` : ""}
                        </>
                      )}
                      <div className="notice">of {plural(u.counts.total, "item")}</div>
                    </td>
                    <td className="num">{u.published}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Problems({ problems, label }: { problems: readonly ContentProblem[]; label: string }) {
  return (
    <ul className="problems" aria-label={label}>
      {problems.map((p, i) => (
        <li key={i}>
          <strong>{GATE_WORDS[p.gate] ?? p.gate}:</strong> {p.message}
        </li>
      ))}
    </ul>
  );
}

function UploadReport({ client, id, canWrite, pollMs }: { client: ConsoleClient; id: string; canWrite: boolean; pollMs: number }) {
  const queryClient = useQueryClient();
  const [show, setShow] = useState<Show>("all");
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const report = useQuery({
    queryKey: ["content", "upload", id],
    queryFn: () => client.contentUpload(id),
    // Still on the runner: look again every few seconds.
    refetchInterval: (query) => (query.state.data?.state === "checking" ? pollMs : false),
  });
  const publish = useMutation({
    mutationFn: (items: readonly ContentKey[]) => client.publishContent(id, items),
    onSuccess: () => {
      setPicked(new Set());
      void queryClient.invalidateQueries({ queryKey: ["content"] });
      void queryClient.invalidateQueries({ queryKey: ["practice", "problems"] });
      void queryClient.invalidateQueries({ queryKey: ["prep"] });
    },
  });

  if (report.isPending) return <SkeletonRows rows={4} columns={3} label="Loading the report…" />;
  if (report.isError) {
    return (
      <p className="error" role="alert">
        {failure(report.error, "The report could not be loaded.")}
      </p>
    );
  }
  const u: ContentUpload = report.data;
  const standing = new Map(u.items.map((i) => [i.position, standingOf(i, u.id)]));
  const publishable = u.items.filter((i) => standing.get(i.position)?.publishable === true);
  const chosen = publishable.filter((i) => picked.has(keyOf(i)));
  const counts: Record<Show, number> = { all: u.items.length, failed: u.counts.failed, passed: u.counts.passed };
  const shown = u.items.filter((i) => show === "all" || i.status === show);
  const done = u.counts.total - u.counts.pending - u.counts.checking;
  const toggle = (item: ContentUploadItem) =>
    setPicked((now) => {
      const next = new Set(now);
      if (next.has(keyOf(item))) next.delete(keyOf(item));
      else next.add(keyOf(item));
      return next;
    });

  return (
    <section className="card prep-card content-report" aria-label={`Report: ${u.title}`}>
      <div className="bar">
        <strong>{u.title}</strong>
        <span className="notice">
          {u.fileName}, {megabytes(u.bytes)}, uploaded {when(u.createdAt)} by {u.createdBy.name}
        </span>
      </div>
      {u.state === "checking" ? (
        <>
          <div className="progress" role="progressbar" aria-label="Checked on the code runner" aria-valuemin={0} aria-valuemax={u.counts.total} aria-valuenow={done}>
            <span style={{ width: `${u.counts.total === 0 ? 0 : (done / u.counts.total) * 100}%` }} />
          </div>
          <p className="notice">
            Checking on the code runner: {done} of {plural(u.counts.total, "item")} done. This report updates by itself; you can leave and come back.
          </p>
        </>
      ) : (
        <p className="notice">
          Checked: {u.counts.passed} passed, {u.counts.failed} failed{u.counts.skipped > 0 ? `, ${u.counts.skipped} skipped` : ""}.
          {u.published > 0 ? ` ${u.published} live on Learn.` : ""}
        </p>
      )}
      <StatBar
        label="Items"
        segments={[
          { id: "passed", label: "Passed", value: u.counts.passed },
          { id: "failed", label: "Failed", value: u.counts.failed },
          { id: "skipped", label: "Skipped", value: u.counts.skipped },
          { id: "waiting", label: "Waiting", value: u.counts.pending + u.counts.checking },
        ]}
      />
      {u.problems.length > 0 ? (
        <Banner tone="danger" title="The bundle itself has problems">
          <Problems problems={u.problems} label="Problems with the bundle" />
        </Banner>
      ) : null}

      <div className="chips" role="group" aria-label="Show">
        {(
          [
            ["all", "All"],
            ["failed", "Failed"],
            ["passed", "Passed"],
          ] as const
        ).map(([name, label]) => (
          <button key={name} type="button" className="chip" aria-pressed={show === name} onClick={() => setShow(name)}>
            {label} <span className="chip-count">{counts[name]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="notice">{show === "failed" ? "No item failed." : show === "passed" ? (u.state === "checking" ? "None has passed yet." : "No item passed.") : "This bundle has no items."}</p>
      ) : (
        <ul className="content-items" aria-label="Items">
          {shown.map((item) => {
            const s = standing.get(item.position)!;
            const name = item.title === "" ? item.slug : item.title;
            return (
              <li key={item.position} className="content-item">
                <div className="content-item-head">
                  {canWrite && s.publishable ? (
                    <label className="content-item-name">
                      <input type="checkbox" checked={picked.has(keyOf(item))} onChange={() => toggle(item)} />
                      <strong>{name}</strong>
                    </label>
                  ) : (
                    <strong className="content-item-name">{name}</strong>
                  )}
                  <span className={s.tone === "plain" ? "pill" : `pill ${s.tone}`}>{s.badge}</span>
                </div>
                <p className="notice content-item-meta">
                  {TYPE_WORDS[item.type] ?? item.type}, <span className="mono">{item.slug}</span>, version {item.version}
                  {s.note === null ? "" : `. ${s.note}`}
                </p>
                {item.problems.length > 0 ? <Problems problems={item.problems} label={`What failed in ${name}`} /> : null}
                {item.warnings.length > 0 ? (
                  <details>
                    <summary>{plural(item.warnings.length, "note")} for the reviewer</summary>
                    <ul>
                      {item.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {canWrite && publishable.length > 0 ? (
        <div className="row content-publish">
          <button type="button" disabled={chosen.length === 0 || publish.isPending} onClick={() => publish.mutate(chosen.map((i) => ({ namespace: i.namespace, slug: i.slug })))}>
            Publish selected ({chosen.length})
          </button>
          <button type="button" className="quiet" disabled={publish.isPending} onClick={() => publish.mutate(publishable.map((i) => ({ namespace: i.namespace, slug: i.slug })))}>
            Publish all passed ({publishable.length})
          </button>
        </div>
      ) : null}
      {publish.isPending ? <p className="notice">Publishing…</p> : null}
      {publish.isSuccess ? (
        <Banner tone={publish.data.refused.length > 0 ? "warning" : "success"} title={`Published ${plural(publish.data.published.length, "item")}.`}>
          {publish.data.published.length > 0 ? <p>Learners see them now, in their tracks.</p> : null}
          {publish.data.refused.length > 0 ? (
            <ul aria-label="Not published">
              {publish.data.refused.map((r) => (
                <li key={keyOf(r)}>
                  <span className="mono">{r.slug}</span>: {r.message}
                </li>
              ))}
            </ul>
          ) : null}
        </Banner>
      ) : null}
      {publish.isError ? (
        <p className="error" role="alert">
          {failure(publish.error, "Those items could not be published. Try again.")}
        </p>
      ) : null}
    </section>
  );
}
