import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { ConsoleError, type ConsoleClient, type ContentPublished, type ContentUpload, type ContentUploadItem } from "../api.ts";
import { BUNDLE_MAX_BYTES, BulkUpload, standingOf } from "./BulkUpload.tsx";

/**
 * The console's bulk content upload (plan row 141, part B), against a stub of
 * its client: choose a bundle, upload it, watch it on the code runner, read
 * the report, publish, and the history. axe as in kit.test.tsx: colour
 * contrast and target size need a laid-out page, so the browser checks them.
 */

async function violations(container: Element): Promise<string[]> {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false }, "target-size": { enabled: false } },
    resultTypes: ["violations"],
  });
  return result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

const UPLOAD = "up-1";

function item(position: number, slug: string, patch: Partial<ContentUploadItem> = {}): ContentUploadItem {
  return {
    position,
    namespace: "problem",
    slug,
    type: "mcq",
    version: 1,
    hash: `hash-${slug}`,
    title: slug.replace(/-/g, " "),
    status: "passed",
    problems: [],
    warnings: [],
    checkedAt: "2026-11-18T06:00:00.000Z",
    current: { version: 1, hash: `hash-${slug}`, state: "draft", publishedVersion: null, publishedHash: null, uploadId: UPLOAD },
    ...patch,
  };
}

function upload(items: readonly ContentUploadItem[], patch: Partial<ContentUpload> = {}): ContentUpload {
  const count = (s: ContentUploadItem["status"]) => items.filter((i) => i.status === s).length;
  return {
    id: UPLOAD,
    bundleId: "launch-batch-01",
    bundleVersion: 1,
    title: "Launch batch 1",
    fileName: "launch.json",
    bytes: 52_000,
    state: items.some((i) => i.status === "pending" || i.status === "checking") ? "checking" : "done",
    createdBy: { id: "u1", name: "Asha Rao" },
    createdAt: "2026-11-18T05:58:00.000Z",
    finishedAt: null,
    counts: { total: items.length, pending: count("pending"), checking: count("checking"), passed: count("passed"), failed: count("failed"), skipped: count("skipped") },
    published: items.filter((i) => i.current?.publishedHash === i.hash).length,
    manifest: {},
    problems: [],
    items,
    ...patch,
  };
}

const sum = item(0, "list-total", { type: "dsa-problem", title: "Total of a list" });
const sql = item(1, "sql-customer-totals", {
  type: "sql-problem",
  title: "What each customer spent",
  status: "failed",
  current: null,
  problems: [
    { gate: "wrong", message: "the wrong query (counts the orders instead of adding the amounts) passes every dataset: add a dataset that catches it" },
    { gate: "rules", message: "datasets: no empty dataset" },
  ],
});
const mcq = item(2, "apt-quant-two-numbers", { title: "Two piles of mangoes", warnings: ["not checked yet: variant sets 2 to 2; only the first set (the default) went through the gates"] });
const lesson = item(3, "os-what-a-process-is", { namespace: "lesson", type: "lesson", title: "What a process is" });

/** The four items while the runner is on the second; then done, with one failure. */
const checking = upload([{ ...sum, status: "passed" }, { ...sql, status: "checking", problems: [] }, { ...mcq, status: "pending", current: null }, { ...lesson, status: "pending", current: null }]);
const done = upload([sum, sql, mcq, lesson]);

function stub(reports: ContentUpload[] = [checking, done]) {
  let shown = 0;
  const history: ContentUpload[] = [];
  const client = {
    contentUploads: vi.fn(async () => history.map(({ manifest: _m, problems: _p, items: _i, ...summary }) => summary)),
    contentUpload: vi.fn(async () => reports[Math.min(shown++, reports.length - 1)]!),
    uploadContent: vi.fn(async (_name: string, _file: string) => {
      history.unshift(reports.at(-1)!);
      return reports[0]!;
    }),
    publishContent: vi.fn(async (_upload: string, items?: readonly { namespace: string; slug: string }[]): Promise<ContentPublished> => ({
      published: (items ?? []).map((k) => ({ ...(k as { namespace: "problem" | "lesson"; slug: string }), version: 1 })),
      refused: [],
    })),
  };
  return client;
}

function show(client: ReturnType<typeof stub>, canWrite = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BulkUpload client={client as unknown as ConsoleClient} canWrite={canWrite} pollMs={20} />
    </QueryClientProvider>,
  );
}

const bundle = (name = "launch.json", text = '{"schema":"parikshaa.content/bundle@1"}') => new File([text], name, { type: "application/json" });

describe("the bulk upload", () => {
  it("uploads a chosen bundle, shows its progress on the runner, then the report", async () => {
    const client = stub();
    const { container } = show(client);
    expect(await screen.findByText(/No bundles uploaded yet/)).toBeInTheDocument();
    const start = screen.getByRole("button", { name: "Upload and check" });
    expect(start).toBeDisabled();

    await userEvent.upload(screen.getByLabelText("Content bundle (JSON or ZIP)"), bundle());
    expect(screen.getByText(/launch\.json \(0\.00 MB\)/)).toBeInTheDocument();
    expect(client.uploadContent).not.toHaveBeenCalled();
    await userEvent.click(start);
    await waitFor(() => expect(client.uploadContent).toHaveBeenCalledWith("launch.json", btoa('{"schema":"parikshaa.content/bundle@1"}')));

    // On the runner: the progress, as far as it has gone.
    const report = await screen.findByRole("region", { name: "Report: Launch batch 1" });
    const progress = within(report).getByRole("progressbar", { name: "Checked on the code runner" });
    expect(progress).toHaveAttribute("aria-valuenow", "1");
    expect(progress).toHaveAttribute("aria-valuemax", "4");
    expect(report).toHaveTextContent("1 of 4 items done");
    expect(await violations(container)).toEqual([]);

    // Done: the bar gives way to the counts, and the history has the upload.
    await waitFor(() => expect(within(report).queryByRole("progressbar")).not.toBeInTheDocument());
    expect(report).toHaveTextContent("Checked: 3 passed, 1 failed.");
    const history = screen.getByRole("region", { name: "Uploads" });
    expect(await within(history).findByRole("button", { name: "Launch batch 1" })).toBeInTheDocument();
    expect(history).toHaveTextContent("3 passed, 1 failed");
    expect(history).toHaveTextContent("by Asha Rao");
    expect(await violations(container)).toEqual([]);
  });

  it("names every failure in plain words, and filters by what passed and what failed", async () => {
    const client = stub([done]);
    const { container } = show(client);
    await userEvent.upload(screen.getByLabelText("Content bundle (JSON or ZIP)"), bundle());
    await userEvent.click(screen.getByRole("button", { name: "Upload and check" }));
    const report = await screen.findByRole("region", { name: "Report: Launch batch 1" });
    const items = within(report).getByRole("list", { name: "Items" });
    expect(within(items).getAllByRole("listitem").filter((li) => li.classList.contains("content-item"))).toHaveLength(4);

    const failed = within(report).getByRole("list", { name: "What failed in What each customer spent" });
    expect(failed).toHaveTextContent("Wrong solution: the wrong query (counts the orders instead of adding the amounts) passes every dataset: add a dataset that catches it");
    expect(failed).toHaveTextContent("Rules: datasets: no empty dataset");
    expect(report).toHaveTextContent("Not kept. Fix what is listed and upload it again.");
    // What the gates did not check, for the reviewer.
    expect(within(report).getByText("1 note for the reviewer")).toBeInTheDocument();

    const filter = within(report).getByRole("group", { name: "Show" });
    await userEvent.click(within(filter).getByRole("button", { name: "Failed 1" }));
    expect(within(filter).getByRole("button", { name: "Failed 1" })).toHaveAttribute("aria-pressed", "true");
    expect(within(report).getByRole("list", { name: "Items" })).toHaveTextContent("What each customer spent");
    expect(within(report).getByRole("list", { name: "Items" })).not.toHaveTextContent("Total of a list");
    await userEvent.click(within(filter).getByRole("button", { name: "Passed 3" }));
    expect(within(report).getByRole("list", { name: "Items" })).not.toHaveTextContent("What each customer spent");
    expect(within(report).getByRole("list", { name: "Items" })).toHaveTextContent("What a process is");
    await userEvent.click(within(filter).getByRole("button", { name: "All 4" }));
    expect(within(report).getByRole("list", { name: "Items" })).toHaveTextContent("What each customer spent");
    expect(await violations(container)).toEqual([]);
  });

  it("publishes the items a reviewer ticks, or every one that passed", async () => {
    const client = stub([done]);
    const { container } = show(client);
    await userEvent.upload(screen.getByLabelText("Content bundle (JSON or ZIP)"), bundle());
    await userEvent.click(screen.getByRole("button", { name: "Upload and check" }));
    const report = await screen.findByRole("region", { name: "Report: Launch batch 1" });

    const selected = within(report).getByRole("button", { name: "Publish selected (0)" });
    expect(selected).toBeDisabled();
    // A failed item has nothing to tick.
    expect(within(report).queryByRole("checkbox", { name: "What each customer spent" })).not.toBeInTheDocument();
    await userEvent.click(within(report).getByRole("checkbox", { name: "Total of a list" }));
    await userEvent.click(within(report).getByRole("checkbox", { name: "What a process is" }));
    await userEvent.click(within(report).getByRole("button", { name: "Publish selected (2)" }));
    await waitFor(() =>
      expect(client.publishContent).toHaveBeenCalledWith(UPLOAD, [
        { namespace: "problem", slug: "list-total" },
        { namespace: "lesson", slug: "os-what-a-process-is" },
      ]),
    );
    expect(await within(report).findByText("Published 2 items.")).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);

    await userEvent.click(within(report).getByRole("button", { name: "Publish all passed (3)" }));
    await waitFor(() =>
      expect(client.publishContent).toHaveBeenLastCalledWith(UPLOAD, [
        { namespace: "problem", slug: "list-total" },
        { namespace: "problem", slug: "apt-quant-two-numbers" },
        { namespace: "lesson", slug: "os-what-a-process-is" },
      ]),
    );
  });

  it("says what was not published, and why", async () => {
    const client = stub([done]);
    client.publishContent.mockResolvedValueOnce({
      published: [{ namespace: "problem", slug: "list-total", version: 1 }],
      refused: [{ namespace: "problem", slug: "apt-quant-two-numbers", message: "A later upload has changed this item since; publish it from that upload" }],
    });
    show(client);
    await userEvent.upload(screen.getByLabelText("Content bundle (JSON or ZIP)"), bundle());
    await userEvent.click(screen.getByRole("button", { name: "Upload and check" }));
    const report = await screen.findByRole("region", { name: "Report: Launch batch 1" });
    await userEvent.click(within(report).getByRole("button", { name: "Publish all passed (3)" }));
    const refused = await within(report).findByRole("list", { name: "Not published" });
    expect(refused).toHaveTextContent("apt-quant-two-numbers: A later upload has changed this item since; publish it from that upload");
    expect(within(report).getByText("Published 1 item.")).toBeInTheDocument();
  });

  it("refuses a file over 20 MB before sending it, and shows the server's word on a bad bundle", async () => {
    const client = stub();
    client.uploadContent.mockRejectedValueOnce(new ConsoleError(422, "invalid_bundle", [], "The file is neither JSON nor a ZIP"));
    show(client);
    const big = bundle("everything.zip");
    Object.defineProperty(big, "size", { value: BUNDLE_MAX_BYTES + 1 });
    await userEvent.upload(screen.getByLabelText("Content bundle (JSON or ZIP)"), big);
    expect(screen.getByRole("alert")).toHaveTextContent("everything.zip is 20.0 MB; a bundle may be 20 MB at most. Split it into two bundles.");
    expect(screen.getByRole("button", { name: "Upload and check" })).toBeDisabled();

    await userEvent.upload(screen.getByLabelText("Content bundle (JSON or ZIP)"), bundle("notes.json", "not json"));
    await userEvent.click(screen.getByRole("button", { name: "Upload and check" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The file is neither JSON nor a ZIP");
    expect(screen.queryByRole("region", { name: /^Report/ })).not.toBeInTheDocument();
  });

  it("shows what is wrong with the bundle as a whole", async () => {
    const broken = upload([{ ...mcq, status: "failed", current: null, problems: [{ gate: "manifest", message: 'manifest: missing "originality"' }] }], {
      problems: [{ gate: "manifest", message: 'manifest: missing "originality"' }],
    });
    const { container } = show(stub([broken]));
    await userEvent.upload(screen.getByLabelText("Content bundle (JSON or ZIP)"), bundle());
    await userEvent.click(screen.getByRole("button", { name: "Upload and check" }));
    const report = await screen.findByRole("region", { name: "Report: Launch batch 1" });
    expect(within(report).getByRole("list", { name: "Problems with the bundle" })).toHaveTextContent('The manifest: manifest: missing "originality"');
    // Nothing passed, so nothing to publish.
    expect(within(report).queryByRole("button", { name: /Publish/ })).not.toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
  });

  it("lets a reader open the reports, but not upload or publish", async () => {
    const client = stub([done]);
    await client.uploadContent("launch.json", "e30=");
    const { container } = show(client, false);
    expect(screen.queryByLabelText("Content bundle (JSON or ZIP)")).not.toBeInTheDocument();
    expect(screen.getByText(/Uploading and publishing are for staff who may change exams/)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Launch batch 1" }));
    const report = await screen.findByRole("region", { name: "Report: Launch batch 1" });
    expect(within(report).getByRole("list", { name: "What failed in What each customer spent" })).toBeInTheDocument();
    expect(within(report).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(report).queryByRole("button", { name: /Publish/ })).not.toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
  });
});

describe("where an item stands", () => {
  it("is published when its version and content are the live ones", () => {
    const live = item(0, "a", { current: { version: 1, hash: "hash-a", state: "published", publishedVersion: 1, publishedHash: "hash-a", uploadId: UPLOAD } });
    expect(standingOf(live, UPLOAD)).toMatchObject({ badge: "Published", publishable: false });
    // Still live after a newer draft came in, from another upload.
    const older = item(0, "a", { current: { version: 2, hash: "hash-a2", state: "draft", publishedVersion: 1, publishedHash: "hash-a", uploadId: "up-2" } });
    expect(standingOf(older, UPLOAD)).toMatchObject({ badge: "Published", publishable: false });
  });

  it("is replaced when a later upload changed the draft, and stays a draft where Learn has no page", () => {
    const replaced = item(0, "a", { current: { version: 2, hash: "hash-a2", state: "draft", publishedVersion: null, publishedHash: null, uploadId: "up-2" } });
    expect(standingOf(replaced, UPLOAD)).toMatchObject({ badge: "Replaced", publishable: false });
    expect(standingOf(item(0, "kata", { type: "system-design" }), UPLOAD)).toMatchObject({ badge: "Draft", publishable: false, note: expect.stringContaining("no page for system design") });
    expect(standingOf(item(0, "app", { type: "project" }), UPLOAD)).toMatchObject({ badge: "Draft", publishable: false });
  });

  it("can be published as a new version while the old one stays live", () => {
    const next = item(0, "a", { version: 2, hash: "hash-a2", current: { version: 2, hash: "hash-a2", state: "draft", publishedVersion: 1, publishedHash: "hash-a", uploadId: UPLOAD } });
    expect(standingOf(next, UPLOAD)).toMatchObject({ badge: "Draft", publishable: true, note: "Passed every check. Version 1 stays live until this one is published." });
  });

  it("is skipped, waiting or failed as the gates said", () => {
    expect(standingOf(item(0, "a", { status: "skipped", current: { version: 1, hash: "hash-a", state: "draft", publishedVersion: null, publishedHash: null, uploadId: "up-0" } }), UPLOAD).badge).toBe("Skipped");
    expect(standingOf(item(0, "a", { status: "pending", current: null }), UPLOAD).badge).toBe("Waiting");
    expect(standingOf(item(0, "a", { status: "checking", current: null }), UPLOAD).badge).toBe("Checking");
    expect(standingOf(item(0, "a", { status: "failed", current: null }), UPLOAD).badge).toBe("Failed");
  });
});
