import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import type { ContentUploads } from "./content-uploads.js";
import { bundleJson, dsaItem, fakeRunner, lessonItem, MANIFEST, mcqItem, sqlItem } from "./testing/content-fixtures.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/**
 * The console's bulk content upload, through the API (row 141 part B): a
 * bundle in, gates 1–2 at once and the runner's after, drafts that Learn does
 * not show, Publish, and the version rule across uploads. The runner is the
 * fixtures' fake.
 */

let db: PGlite;
let app: FastifyInstance;
let uploads: ContentUploads;
let owner: string;
let viewer: string;

const call = (method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object) =>
  app.inject({ method, url, headers: token === null ? {} : bearer(token), ...(payload === undefined ? {} : { payload }) });
const send = (token: string, text: string, name = "bundle.json") => call("POST", token, "/practice-admin/content/uploads", { name, file: Buffer.from(text).toString("base64") });
/** Upload a bundle and wait for the runner's gates. */
async function upload(items: readonly unknown[], manifest: Record<string, unknown> = MANIFEST) {
  const res = await send(owner, bundleJson(items, manifest));
  expect(res.statusCode, res.payload).toBe(201);
  await uploads.idle("org-a" as never);
  const done = await call("GET", owner, `/practice-admin/content/uploads/${res.json().id}`);
  return done.json();
}
const statuses = (u: { items: { slug: string; status: string }[] }) => u.items.map((i) => [i.slug, i.status]);

beforeEach(async () => {
  db = await freshDatabase();
  let identity;
  ({ app, identity, contentUploads: uploads } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic, runner: { run: fakeRunner().run } }));
  const org = await addOrganisation(identity, "org-a", "Parikshaa");
  await addStaff(identity, org, "owner@parikshaa.test", "owner", "Asha Rao");
  await addStaff(identity, org, "viewer@parikshaa.test", "viewer");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@parikshaa.test");
  viewer = await signIn(app, "viewer@parikshaa.test");
  expect((await call("PUT", owner, "/practice-admin/site", { slug: "learn", title: "Parikshaa Learn", welcome: "", open: true })).statusCode).toBe(200);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("a bulk upload", () => {
  it("checks every item, keeps those that pass as drafts Learn does not show, and publishes them on a reviewer's word", async () => {
    const first = await send(owner, bundleJson([dsaItem(), sqlItem(), mcqItem(), lessonItem()]));
    expect(first.statusCode, first.payload).toBe(201);
    expect(first.json()).toMatchObject({ bundleId: "content-tests-01", state: "checking", counts: { total: 4, failed: 0, passed: 0 }, problems: [] });
    await uploads.idle("org-a" as never);
    const done = (await call("GET", owner, `/practice-admin/content/uploads/${first.json().id}`)).json();
    expect(done).toMatchObject({ state: "done", counts: { passed: 4, failed: 0 }, published: 0, createdBy: { name: "Asha Rao" } });
    expect(done.items[0]).toMatchObject({ slug: "list-total", type: "dsa-problem", status: "passed", current: { version: 1, state: "draft", publishedVersion: null } });
    expect(done.items[0].warnings).toEqual(expect.arrayContaining([expect.stringContaining("mutation")]));
    expect((await call("GET", owner, "/practice-admin/content/uploads")).json().uploads).toHaveLength(1);

    // A draft is not on Learn.
    expect((await call("GET", null, "/practice/learn/problems/list-total")).statusCode).toBe(404);
    expect((await call("GET", null, "/practice/learn/lessons/os-what-a-process-is")).statusCode).toBe(404);

    expect((await call("POST", viewer, "/practice-admin/content/publish", { upload: done.id })).statusCode).toBe(403);
    const published = await call("POST", owner, "/practice-admin/content/publish", { upload: done.id });
    expect(published.statusCode, published.payload).toBe(200);
    expect(published.json()).toEqual({
      published: [
        { namespace: "problem", slug: "list-total", version: 1 },
        { namespace: "problem", slug: "sql-customer-totals", version: 1 },
        { namespace: "problem", slug: "apt-quant-two-numbers", version: 1 },
        { namespace: "lesson", slug: "os-what-a-process-is", version: 1 },
      ],
      refused: [],
    });

    // On Learn now: the problems, the lesson, its quiz and hands-on task, and the track.
    const dsa = (await call("GET", null, "/practice/learn/problems/list-total")).json();
    expect(dsa).toMatchObject({ title: "Total of a list", difficulty: "easy" });
    expect(JSON.stringify(dsa)).not.toContain("random_large");
    const mcq = (await call("GET", null, "/practice/learn/problems/apt-quant-two-numbers")).json();
    expect(JSON.stringify(mcq)).toContain("12 mangoes");
    expect((await call("GET", null, "/practice/learn/problems/os-what-a-process-is-q1")).statusCode).toBe(200);
    expect((await call("GET", null, "/practice/learn/problems/os-what-a-process-is-add-two")).statusCode).toBe(200);
    const lesson = (await call("GET", null, "/practice/learn/lessons/os-what-a-process-is")).json();
    expect(JSON.stringify(lesson)).toContain("Why it matters");
    const track = (await call("GET", null, "/practice/learn/tracks/os-basics")).json();
    expect(track.title).toBe("Operating systems, the basics");
    expect(track.modules.map((m: { title: string; items: unknown[] }) => [m.title, m.items.length])).toEqual([
      ["Processes", 2],
      ["Memory", 0],
    ]);

    const after = (await call("GET", owner, `/practice-admin/content/uploads/${done.id}`)).json();
    expect(after.published).toBe(4);
    expect(after.items[3].current).toMatchObject({ state: "published", publishedVersion: 1 });
    expect(JSON.stringify((await call("GET", owner, "/audit")).json().entries)).toContain("practice.content_published");
    // Publishing again changes nothing.
    expect((await call("POST", owner, "/practice-admin/content/publish", { upload: done.id })).json().refused).toHaveLength(4);
  });

  it("applies the version rule: the same content is skipped, other content needs a new version once published, and a new version replaces the live one only when published", async () => {
    const first = await upload([mcqItem()]);
    await call("POST", owner, "/practice-admin/content/publish", { upload: first.id });
    const live = (await call("GET", null, "/practice/learn/problems/apt-quant-two-numbers")).json();

    expect(statuses(await upload([mcqItem()]))).toEqual([["apt-quant-two-numbers", "skipped"]]);
    const changed = await upload([mcqItem({ title: "Two piles of ripe mangoes" })]);
    expect(changed.items[0]).toMatchObject({ status: "failed", problems: [{ gate: "version", message: expect.stringContaining("Raise the version to 2") }] });

    const second = await upload([mcqItem({ version: 2, title: "Two piles of ripe mangoes" })]);
    expect(statuses(second)).toEqual([["apt-quant-two-numbers", "passed"]]);
    expect(second.items[0].current).toMatchObject({ version: 2, state: "draft", publishedVersion: 1 });
    // Version 1 stays live until version 2 is published.
    expect((await call("GET", null, "/practice/learn/problems/apt-quant-two-numbers")).json().title).toBe("Two piles of mangoes");
    // The first upload cannot publish over the newer draft.
    expect((await call("POST", owner, "/practice-admin/content/publish", { upload: first.id })).json().refused[0].message).toMatch(/later upload/);
    const res = await call("POST", owner, "/practice-admin/content/publish", { upload: second.id, items: [{ namespace: "problem", slug: "apt-quant-two-numbers" }] });
    expect(res.json().published).toEqual([{ namespace: "problem", slug: "apt-quant-two-numbers", version: 2 }]);
    const now = (await call("GET", null, "/practice/learn/problems/apt-quant-two-numbers")).json();
    expect(now.title).toBe("Two piles of ripe mangoes");
    expect(now.slug).toBe(live.slug);
    // One problem, updated in place.
    expect((await call("GET", owner, "/practice-admin/problems")).json().problems.filter((p: { slug: string }) => p.slug === "apt-quant-two-numbers")).toHaveLength(1);
  });

  it("reports gate 1 and 2 problems at once, item by item, and sends only good items to the runner", async () => {
    const noEmpty = sqlItem().datasets.map((d) => (d.purpose === "empty" ? { ...d, purpose: "edge" } : d));
    const res = await send(owner, bundleJson([mcqItem({ correct: 7 }), mcqItem({ slug: "apt-copy" }), sqlItem({ datasets: noEmpty }), mcqItem({ slug: "apt-quant-two-numbers" })]));
    expect(res.statusCode).toBe(201);
    const items = res.json().items as { slug: string; status: string; problems: { gate: string; message: string }[] }[];
    expect(items.map((i) => [i.slug, i.status, i.problems.map((p) => p.gate)])).toEqual([
      ["apt-quant-two-numbers", "failed", ["schema"]],
      ["apt-copy", "failed", ["duplicate"]],
      ["sql-customer-totals", "failed", ["rules"]],
      ["apt-quant-two-numbers", "failed", ["duplicate"]],
    ]);
    expect(items[1]?.problems[0]?.message).toMatch(/same title as item 1/);
    expect(items[2]?.problems[0]?.message).toBe("datasets: no empty dataset");
  });

  it("refuses a bundle that is not one, too big, or with a broken manifest, and a slug the site uses already", async () => {
    expect((await send(owner, "not json at all")).statusCode).toBe(422);
    const big = await call("POST", owner, "/practice-admin/content/uploads", { name: "big.zip", file: Buffer.alloc(20 * 1024 * 1024 + 1).toString("base64") });
    expect(big.statusCode).toBe(413);
    const broken = await send(owner, bundleJson([mcqItem()], { ...MANIFEST, originality: undefined } as never));
    expect(broken.json()).toMatchObject({ problems: [{ gate: "manifest", message: 'manifest: manifest: missing "originality"' }], counts: { failed: 1 } });
    expect((await call("POST", viewer, "/practice-admin/content/uploads", { name: "b.json", file: "e30=" })).statusCode).toBe(403);
    expect((await call("POST", owner, "/practice-admin/starter-packs/sql-starter")).statusCode).toBe(201);
    const taken = await send(owner, bundleJson([sqlItem({ slug: "duplicate-emails" })]));
    expect(taken.json().items[0].problems).toEqual([{ gate: "version", message: expect.stringContaining("not uploaded") }]);
  });

  it("refuses to publish an upload that does not exist, or an item it does not have", async () => {
    expect((await call("POST", owner, "/practice-admin/content/publish", { upload: "nope" })).statusCode).toBe(404);
    expect((await call("GET", owner, "/practice-admin/content/uploads/nope")).statusCode).toBe(404);
    const u = await upload([mcqItem()]);
    const res = await call("POST", owner, "/practice-admin/content/publish", { upload: u.id, items: [{ namespace: "problem", slug: "not-here" }] });
    expect(res.json()).toEqual({ published: [], refused: [{ namespace: "problem", slug: "not-here", message: "This upload has no such item" }] });
  });
});
