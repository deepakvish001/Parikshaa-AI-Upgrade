import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { ConsoleError, type ConsoleClient, type ContentUpload, type ContentUploadItem } from "../api.ts";
import { DropZone, EmptyState, SkeletonRows, StatBar } from "./kit.tsx";

/**
 * The bulk content upload (tracker plan row 141, part B): a bundle of DSA,
 * SQL, MCQ, lesson, project or system design items (docs/content/
 * CONTENT-FORMAT.md) in; each item checked by machine and kept as a draft;
 * a reviewer reads the report and publishes. Learn shows nothing until then.
 */

const failure = (error: unknown, fallback: string) =>
  error instanceof ConsoleError ? (error.detail ?? (error.problems[0]?.message ?? fallback)) : fallback;

const STATUS_WORDS: Record<ContentUploadItem["status"], string> = {
  pending: "Waiting",
  checking: "Checking",
  passed: "Passed: draft",
  failed: "Failed",
  skipped: "Skipped: kept already",
};

type Show = "all" | "failed" | "passed";

/** Read a file as base64, for the upload's JSON body. */
async function base64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const live = (item: ContentUploadItem) => item.current !== null && item.current.publishedVersion === item.version && item.current.hash === item.hash;
const keyOf = (item: Pick<ContentUploadItem, "namespace" | "slug">) => `${item.namespace}:${item.slug}`;

export function BulkUpload({ client, canWrite }: { client: ConsoleClient; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState<string | null>(null);
  const history = useQuery({ queryKey: ["content", "uploads"], queryFn: () => client.contentUploads() });
  const send = useMutation({
    mutationFn: async (file: File) => client.uploadContent(file.name, await base64(file)),
    onSuccess: (upload) => {
      setChosen(upload.id);
      void queryClient.invalidateQueries({ queryKey: ["content", "uploads"] });
    },
  });
  return (
    <>
      {canWrite ? (
        <section className="card prep-card" aria-label="Upload content">
          <div className="bar">
            <strong>Bulk upload</strong>
          </div>
          <p className="notice">
            A bundle of content (one JSON file, or a ZIP of a folder with manifest.json), written to the format in docs/content. Every item is checked: its schema and rules at once, then its
            programs on the code runner. An item that passes is kept as a draft; Learn shows it only when you publish it.
          </p>
          <DropZone label="Choose a bundle" name="Content bundle (JSON or ZIP)" accept=".json,.zip,application/json,application/zip" onFile={(file) => send.mutate(file)} disabled={send.isPending ? "Uploading…" : undefined} />
          {send.isError ? <p className="error">{failure(send.error, "That bundle could not be uploaded")}</p> : null}
        </section>
      ) : null}
      {chosen === null ? null : <UploadReport client={client} id={chosen} canWrite={canWrite} />}
      <section className="card prep-card" aria-label="Uploads">
        <div className="bar">
          <strong>Uploads</strong>
        </div>
        {history.isPending ? (
          <SkeletonRows rows={3} columns={4} />
        ) : (history.data ?? []).length === 0 ? (
          <EmptyState icon={Upload} compact>
            No uploads yet.
          </EmptyState>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Bundle</th>
                <th scope="col">Items</th>
                <th scope="col">Published</th>
                <th scope="col">By</th>
              </tr>
            </thead>
            <tbody>
              {(history.data ?? []).map((u) => (
                <tr key={u.id}>
                  <td>
                    <button type="button" className="link" onClick={() => setChosen(u.id)}>
                      {u.title}
                    </button>{" "}
                    <span className="notice">
                      ({u.bundleId} v{u.bundleVersion}){u.state === "checking" ? ", checking…" : ""}
                    </span>
                  </td>
                  <td>
                    {u.counts.passed} passed, {u.counts.failed} failed{u.counts.skipped > 0 ? `, ${u.counts.skipped} skipped` : ""} of {u.counts.total}
                  </td>
                  <td>{u.published}</td>
                  <td>{u.createdBy.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function UploadReport({ client, id, canWrite }: { client: ConsoleClient; id: string; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [show, setShow] = useState<Show>("all");
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const report = useQuery({
    queryKey: ["content", "upload", id],
    queryFn: () => client.contentUpload(id),
    // Still on the runner: look again every few seconds.
    refetchInterval: (query) => (query.state.data?.state === "checking" ? 3000 : false),
  });
  const publish = useMutation({
    mutationFn: (items: readonly { namespace: "problem" | "lesson"; slug: string }[] | undefined) => client.publishContent(id, items),
    onSuccess: () => {
      setPicked(new Set());
      void queryClient.invalidateQueries({ queryKey: ["content"] });
      void queryClient.invalidateQueries({ queryKey: ["practice", "problems"] });
      void queryClient.invalidateQueries({ queryKey: ["prep"] });
    },
  });
  if (report.isPending) return <SkeletonRows rows={4} columns={3} label="Loading the report…" />;
  if (report.isError) return <p className="error">{failure(report.error, "The report could not be loaded")}</p>;
  const u: ContentUpload = report.data;
  const items = u.items.filter((i) => show === "all" || (show === "failed" ? i.status === "failed" : i.status === "passed"));
  const publishable = u.items.filter((i) => i.status === "passed" && !live(i));
  const toggle = (item: ContentUploadItem) =>
    setPicked((now) => {
      const next = new Set(now);
      if (next.has(keyOf(item))) next.delete(keyOf(item));
      else next.add(keyOf(item));
      return next;
    });
  return (
    <section className="card prep-card" aria-label={`Report: ${u.title}`}>
      <div className="bar">
        <strong>{u.title}</strong>
        <span className="notice">
          {u.fileName}, {u.state === "checking" ? "checking on the code runner…" : "checked"}
        </span>
      </div>
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
        <div role="alert" className="error">
          <p>The bundle itself has problems:</p>
          <ul>
            {u.problems.map((p, i) => (
              <li key={i}>{p.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="tabs" role="tablist" aria-label="Show items">
        {(
          [
            ["all", "All"],
            ["failed", "Failed"],
            ["passed", "Passed"],
          ] as [Show, string][]
        ).map(([name, label]) => (
          <button key={name} type="button" role="tab" aria-selected={show === name} className={show === name ? "tab on" : "tab"} onClick={() => setShow(name)}>
            {label}
          </button>
        ))}
      </div>
      <ul className="stack" aria-label="Items">
        {items.map((item) => (
          <li key={item.position} className="row">
            <span>
              {canWrite && item.status === "passed" && !live(item) ? (
                <input type="checkbox" aria-label={`Choose ${item.slug}`} checked={picked.has(keyOf(item))} onChange={() => toggle(item)} />
              ) : null}{" "}
              <strong>{item.title === "" ? item.slug : item.title}</strong> <span className="notice">({item.type}, {item.slug}, version {item.version})</span>
              <br />
              <span>{live(item) ? "Published: live on Learn" : STATUS_WORDS[item.status]}</span>
              {item.problems.length > 0 ? (
                <ul>
                  {item.problems.map((p, i) => (
                    <li key={i} className="error">
                      {p.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              {item.warnings.length > 0 ? (
                <details>
                  <summary>
                    {item.warnings.length} {item.warnings.length === 1 ? "note" : "notes"} for the reviewer
                  </summary>
                  <ul>
                    {item.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {canWrite && publishable.length > 0 ? (
        <div className="bar">
          <button
            type="button"
            disabled={picked.size === 0 || publish.isPending}
            onClick={() => publish.mutate(publishable.filter((i) => picked.has(keyOf(i))).map((i) => ({ namespace: i.namespace, slug: i.slug })))}
          >
            Publish selected ({picked.size})
          </button>
          <button type="button" disabled={publish.isPending} onClick={() => publish.mutate(undefined)}>
            Publish all passed ({publishable.length})
          </button>
        </div>
      ) : null}
      {publish.isSuccess ? (
        <div role="status">
          <p>
            Published {publish.data.published.length} {publish.data.published.length === 1 ? "item" : "items"}.
          </p>
          {publish.data.refused.length > 0 ? (
            <ul>
              {publish.data.refused.map((r) => (
                <li key={`${r.namespace}:${r.slug}`}>
                  {r.slug}: {r.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {publish.isError ? <p className="error">{failure(publish.error, "Those items could not be published")}</p> : null}
    </section>
  );
}
