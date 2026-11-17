import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { orgId } from "@parikshaa/core";
import { ContentStore, versionDecision, type ContentDraft, type UploadDraft, type UploadItemDraft } from "./content-store.js";
import { migrate } from "./migrate.js";
import { PracticeStore } from "./practice-store.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/** Bulk content uploads (migration 0075): the queue, the version rule, drafts and publishing, and who may read them. As `parikshaa_app`. */

const A = orgId("org-a");
const B = orgId("org-b");
const ME = { id: "staff-1", name: "Asha" };
const HASH = (n: number) => n.toString(16).padStart(64, "0");

const item = (slug: string, over: Partial<UploadItemDraft> = {}): UploadItemDraft => ({
  namespace: "problem",
  slug,
  type: "mcq",
  version: 1,
  hash: HASH(1),
  title: `Title of ${slug}`,
  item: { schema: "parikshaa.content/mcq@1", slug },
  status: "pending",
  problems: [],
  warnings: [],
  ...over,
});
const upload = (items: readonly UploadItemDraft[], over: Partial<UploadDraft> = {}): UploadDraft => ({
  bundleId: "apt-batch-01",
  bundleVersion: 1,
  title: "Aptitude, batch 1",
  fileName: "bundle.json",
  bytes: 1234,
  manifest: { bundle_id: "apt-batch-01", tracks: [] },
  problems: [],
  createdBy: ME,
  items,
  ...over,
});
const draft = (slug: string, uploadId: string, over: Partial<ContentDraft> = {}): ContentDraft => ({
  namespace: "problem",
  slug,
  type: "mcq",
  title: `Title of ${slug}`,
  version: 1,
  hash: HASH(1),
  item: { slug },
  built: {},
  uploadId,
  warnings: [],
  ...over,
});

let db: PGlite;
let sql: SqlExecutor;
let store: ContentStore;
let clock: number;
const at = () => new Date((clock += 1000));

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  await sql.query(`INSERT INTO organisations (id, name) VALUES ('org-a', 'A'), ('org-b', 'B')`);
  await db.exec(`SET ROLE parikshaa_app`);
  store = new ContentStore(sql);
  clock = Date.parse("2026-11-17T10:00:00Z");
});

afterEach(async () => {
  await db.close();
});

/** Claim the next item and report it passed, kept as `over` says. */
async function pass(orgIdOf = A, over: Partial<ContentDraft> = {}) {
  const claim = await store.claimNext(orgIdOf, 300_000, at());
  if (claim === null) throw new Error("nothing to claim");
  return store.finishItem(orgIdOf, claim, { problems: [], warnings: [], draft: draft(claim.slug, claim.uploadId, { version: claim.version, hash: claim.hash, ...over }) }, at());
}

describe("the version rule", () => {
  it("creates, replaces, skips and refuses as the owner decided (17 Nov 2026)", () => {
    expect(versionDecision(null, { version: 1, hash: "a" })).toEqual({ action: "create" });
    expect(versionDecision({ version: 1, hash: "a", publishedVersion: null }, { version: 2, hash: "b" })).toEqual({ action: "replace" });
    expect(versionDecision({ version: 1, hash: "a", publishedVersion: null }, { version: 1, hash: "a" })).toEqual({ action: "skip" });
    // The same version, other content: the draft is replaced while that version was never published...
    expect(versionDecision({ version: 1, hash: "a", publishedVersion: null }, { version: 1, hash: "b" })).toEqual({ action: "replace" });
    expect(versionDecision({ version: 2, hash: "a", publishedVersion: 1 }, { version: 2, hash: "b" })).toEqual({ action: "replace" });
    // ...and refused once it was.
    expect(versionDecision({ version: 1, hash: "a", publishedVersion: 1 }, { version: 1, hash: "b" })).toMatchObject({ action: "refuse", reason: expect.stringContaining("Raise the version to 2") });
    expect(versionDecision({ version: 3, hash: "a", publishedVersion: null }, { version: 2, hash: "b" })).toMatchObject({ action: "refuse", reason: expect.stringContaining("older") });
  });
});

describe("uploads", () => {
  it("records an upload and its items, and counts them by what came of each", async () => {
    const id = await store.createUpload(
      A,
      upload([item("apt-one"), item("apt-two", { status: "failed", problems: [{ gate: "schema", message: "stem: missing" }], item: null }), item("apt-three", { status: "skipped", item: null })]),
      at(),
    );
    const [summary] = await store.uploads(A);
    expect(summary).toMatchObject({ id, bundleId: "apt-batch-01", state: "checking", createdBy: ME, counts: { total: 3, pending: 1, passed: 0, failed: 1, skipped: 1 }, published: 0 });
    const detail = await store.upload(A, id);
    expect(detail?.items.map((i) => [i.slug, i.status, i.problems])).toEqual([
      ["apt-one", "pending", []],
      ["apt-two", "failed", [{ gate: "schema", message: "stem: missing" }]],
      ["apt-three", "skipped", []],
    ]);
    expect(detail?.manifest).toEqual({ bundle_id: "apt-batch-01", tracks: [] });
    expect(await store.upload(A, "nope")).toBeNull();
  });

  it("is done at once when nothing waits for the runner", async () => {
    const id = await store.createUpload(A, upload([item("apt-one", { status: "failed", item: null })]), at());
    expect((await store.upload(A, id))?.state).toBe("done");
    expect((await store.upload(A, id))?.finishedAt).not.toBeNull();
  });

  it("hands each item to one worker at a time, and takes back one whose worker went quiet", async () => {
    await store.createUpload(A, upload([item("apt-one"), item("apt-two")]), at());
    const first = await store.claimNext(A, 300_000, at());
    const second = await store.claimNext(A, 300_000, at());
    expect([first?.slug, second?.slug]).toEqual(["apt-one", "apt-two"]);
    expect(second?.item).toEqual({ schema: "parikshaa.content/mcq@1", slug: "apt-two" });
    expect(await store.claimNext(A, 300_000, at())).toBeNull();
    // Five minutes on, the first worker has said nothing: another takes the item.
    clock += 301_000;
    const again = await store.claimNext(A, 300_000, at());
    expect(again?.slug).toBe("apt-one");
    // The first worker's report comes too late and changes nothing.
    expect(await store.finishItem(A, first!, { problems: [], warnings: [], draft: draft("apt-one", first!.uploadId) }, at())).toBe("lost");
    expect(await store.item(A, "problem", "apt-one")).toBeNull();
  });

  it("puts an item back to wait when the runner cannot be reached", async () => {
    await store.createUpload(A, upload([item("apt-one")]), at());
    const claim = await store.claimNext(A, 300_000, at());
    await store.releaseItem(A, claim!);
    expect((await store.claimNext(A, 300_000, at()))?.slug).toBe("apt-one");
  });

  it("keeps a passed item as a draft, a failed one not at all, and closes the upload with its last item", async () => {
    const id = await store.createUpload(A, upload([item("apt-one"), item("apt-two")]), at());
    expect(await pass()).toBe("passed");
    const claim = await store.claimNext(A, 300_000, at());
    expect(await store.finishItem(A, claim!, { problems: [{ gate: "solver", message: "solver says 12, the key is 14" }], warnings: ["mutation: not checked yet"], draft: null }, at())).toBe("failed");
    const detail = await store.upload(A, id);
    expect(detail).toMatchObject({ state: "done", counts: { passed: 1, failed: 1, pending: 0, checking: 0 } });
    expect(detail?.items[1]).toMatchObject({ status: "failed", warnings: ["mutation: not checked yet"], current: null });
    expect(detail?.items[0]?.current).toMatchObject({ version: 1, state: "draft", publishedVersion: null, uploadId: id });
    expect(await store.item(A, "problem", "apt-one")).toMatchObject({ type: "mcq", version: 1, state: "draft", uploadId: id, item: { slug: "apt-one" } });
    expect(await store.item(A, "problem", "apt-two")).toBeNull();
  });

  it("applies the version rule again when a draft is kept, and publishes only the version it was asked to", async () => {
    const first = await store.createUpload(A, upload([item("apt-one")]), at());
    await pass();
    // The same version, other content, never published: the draft is replaced.
    const second = await store.createUpload(A, upload([item("apt-one", { hash: HASH(2) })]), at());
    expect(await pass()).toBe("passed");
    expect(await store.item(A, "problem", "apt-one")).toMatchObject({ hash: HASH(2), uploadId: second });
    // The first upload's version is gone: publishing it is refused.
    expect(await store.markPublished(A, { namespace: "problem", slug: "apt-one", version: 1, hash: HASH(1) }, {}, ME, at())).toBe(false);
    const problem = await new PracticeStore(sql).addProblem(A, {
      slug: "apt-one",
      title: "One",
      question: { id: "q", kind: "mcq", stem: "?", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 } as never,
      difficulty: "easy",
      tags: [],
      editorial: "",
      fromBank: null,
      position: 0,
      published: true,
    });
    expect(await store.markPublished(A, { namespace: "problem", slug: "apt-one", version: 1, hash: HASH(2) }, { problemId: problem.id }, ME, at())).toBe(true);
    expect(await store.item(A, "problem", "apt-one")).toMatchObject({ state: "published", publishedVersion: 1, publishedHash: HASH(2), problemId: problem.id, publishedBy: ME });
    // Published: the same version with other content is refused, the same content skipped.
    await store.createUpload(A, upload([item("apt-one", { hash: HASH(3) })]), at());
    expect(await pass()).toBe("failed");
    await store.createUpload(A, upload([item("apt-one", { hash: HASH(2) })]), at());
    expect(await pass()).toBe("skipped");
    // A higher version is a new draft beside the published one.
    await store.createUpload(A, upload([item("apt-one", { version: 2, hash: HASH(4) })]), at());
    expect(await pass()).toBe("passed");
    expect(await store.item(A, "problem", "apt-one")).toMatchObject({ version: 2, state: "draft", publishedVersion: 1, problemId: problem.id });
    // A lower one is refused, with the reason in its report.
    const lower = await store.createUpload(A, upload([item("apt-one", { version: 1, hash: HASH(5) })]), at());
    expect(await pass()).toBe("failed");
    expect((await store.upload(A, lower))?.items[0]?.problems).toEqual([{ gate: "version", message: expect.stringContaining("older") }]);
    expect((await store.upload(A, first))?.published).toBe(0);
  });

  it("refuses a slug a problem or lesson made another way already uses", async () => {
    await new PracticeStore(sql).addProblem(A, {
      slug: "apt-one",
      title: "One",
      question: { id: "q", kind: "mcq", stem: "?", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 } as never,
      difficulty: "easy",
      tags: [],
      editorial: "",
      fromBank: null,
      position: 0,
      published: true,
    });
    const standing = await store.standing(A, [
      { namespace: "problem", slug: "apt-one" },
      { namespace: "lesson", slug: "apt-one" },
    ]);
    expect(standing.get("problem:apt-one")).toEqual({ foreign: expect.stringContaining("not uploaded") });
    expect(standing.has("lesson:apt-one")).toBe(false);
    await store.createUpload(A, upload([item("apt-one")]), at());
    expect(await pass()).toBe("failed");
    expect(await store.item(A, "problem", "apt-one")).toBeNull();
  });

  it("says where each slug stands, for the check made as an upload comes in", async () => {
    await store.createUpload(A, upload([item("apt-one")]), at());
    await pass();
    const standing = await store.standing(A, [
      { namespace: "problem", slug: "apt-one" },
      { namespace: "problem", slug: "apt-two" },
    ]);
    expect(standing.get("problem:apt-one")).toEqual({ version: 1, hash: HASH(1), publishedVersion: null });
    expect(standing.has("problem:apt-two")).toBe(false);
  });

  it("is one organisation's staff's alone: another organisation and every learner read nothing", async () => {
    await store.createUpload(A, upload([item("apt-one")]), at());
    await pass();
    expect(await store.uploads(B)).toEqual([]);
    expect(await store.item(B, "problem", "apt-one")).toBeNull();
    expect(await store.claimNext(B, 0, at())).toBeNull();
    const learner = { "parikshaa.org_id": "org-a", "parikshaa.actor": "learner", "parikshaa.learner_id": "l1", "parikshaa.attempt_id": "" };
    for (const table of ["content_uploads", "content_upload_items", "content_items"]) {
      expect(await sql.transaction((tx) => tx.query(`SELECT * FROM ${table}`), learner)).toEqual([]);
    }
    await expect(
      sql.transaction((tx) => tx.query(`INSERT INTO content_uploads (org_id, id, bundle_id, bundle_version, title, file_name, bytes, created_by_id, created_by_name) VALUES ('org-a', 'x', 'b', 1, 't', 'f', 1, 'l1', 'L')`), learner),
    ).rejects.toThrow(/row-level security/);
  });
});
