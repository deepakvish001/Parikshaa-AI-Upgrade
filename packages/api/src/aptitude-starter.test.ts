import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { examId, validateExam, type OrgId } from "@parikshaa/core";
import { pgliteExecutor } from "@parikshaa/store";
import { APTITUDE_STARTER } from "./content/aptitude-starter.js";
import { project } from "./content-publish.js";
import { aptitudeQuestion, PENDING_PACKS, type StarterPacks } from "./starter-packs.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/**
 * The aptitude starter pack (K2-8): the content kit's ten aptitude samples, each exactly as the bulk upload publishes
 * it (scripts/aptitude-pack.mjs made the module; here every question is made again from its sample and must match),
 * kept from every site until the owner approves the content (F6), and, once offered, a track by section whose
 * questions a learner answers on the practice API.
 */

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const SAMPLES = join(ROOT, "content", "samples", "aptitude");
const SECTIONS = ["aptitude-quant", "aptitude-logical", "aptitude-verbal"];

/** A sample's default set, published: its solver run on that set (python3, as the content validator runs it). */
function published(item: { slug: string; solver?: string; variants?: { sets: Record<string, unknown>[] } }) {
  let values: Record<string, unknown> = {};
  if (item.solver !== undefined) {
    const ran = spawnSync("python3", ["-I", "-c", item.solver], { input: JSON.stringify(item.variants?.sets[0] ?? {}), encoding: "utf8" });
    expect(ran.status, `${item.slug}: ${ran.stderr}`).toBe(0);
    values = (JSON.parse(ran.stdout) as { values?: Record<string, unknown> }).values ?? {};
  }
  const projected = project("mcq", item, { values });
  if (projected.kind !== "problem") throw new Error(`${item.slug}: not a problem`);
  return projected.problem;
}

describe("the aptitude starter pack", () => {
  it("is the content kit's aptitude samples, each question as the bulk upload publishes it", () => {
    const samples = readdirSync(SAMPLES).map((name) => JSON.parse(readFileSync(join(SAMPLES, name, "item.json"), "utf8")) as Parameters<typeof published>[0]);
    expect(APTITUDE_STARTER.questions.map((q) => q.slug).sort()).toEqual(samples.map((s) => s.slug).sort());
    for (const sample of samples) {
      const p = published(sample);
      const q = APTITUDE_STARTER.questions.find((x) => x.slug === sample.slug)!;
      expect({ slug: q.slug, title: q.title, difficulty: q.difficulty, tags: q.tags, question: aptitudeQuestion(q), editorial: q.editorial }, sample.slug).toEqual({
        slug: p.slug,
        title: p.title,
        difficulty: p.difficulty,
        tags: p.tags,
        question: p.question,
        editorial: p.editorial,
      });
    }
  });

  it("is a valid paper: every question in one of the three sections, its explanation in four steps, nothing left unfilled", () => {
    const questions = APTITUDE_STARTER.questions.map(aptitudeQuestion);
    expect(validateExam({ id: examId("aptitude"), title: "Aptitude", questions, policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.5 } })).toEqual({ ok: true });
    for (const q of APTITUDE_STARTER.questions) {
      expect(SECTIONS, q.slug).toContain(q.tags[0]);
      // Understand, Plan, Solve, Check (in Hinglish: Samjho, Plan, Hal, Jaancho).
      expect(q.editorial.match(/^### /gm), q.slug).toHaveLength(4);
      expect(JSON.stringify(q), q.slug).not.toMatch(/\{\{[a-z]/);
    }
    expect(SECTIONS.map((s) => APTITUDE_STARTER.questions.filter((q) => q.tags[0] === s).length)).toEqual([5, 3, 2]);
  });
});

describe("taking the aptitude pack in", () => {
  let db: PGlite;
  let app: FastifyInstance;
  let packs: StarterPacks;
  let org: OrgId;
  let owner: string;
  const call = (method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object) =>
    app.inject({ method, url, headers: token === null ? {} : bearer(token), ...(payload === undefined ? {} : { payload }) });

  async function setUp(pendingPacks: boolean) {
    db = await freshDatabase();
    let identity;
    ({ app, identity, starterPacks: packs } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic, pendingPacks }));
    org = await addOrganisation(identity, "org-a", "NIT Trichy");
    await addStaff(identity, org, "owner@nit.test", "owner", "Ravi Kumar");
    await db.exec(`SET ROLE parikshaa_app`);
    owner = await signIn(app, "owner@nit.test");
    expect((await call("PUT", owner, "/practice-admin/site", { slug: "nit-practice", title: "NIT Practice", welcome: "", open: true })).statusCode).toBe(200);
  }

  afterEach(async () => {
    await app.close();
    await db.close();
  });

  it("waits for the owner's approval (F6): no site is offered it or can take it", async () => {
    await setUp(false);
    expect(PENDING_PACKS).toContain("aptitude-starter");
    const listed = (await call("GET", owner, "/practice-admin/starter-packs")).json().packs as { name: string }[];
    expect(listed.map((p) => p.name)).not.toContain("aptitude-starter");
    expect((await call("POST", owner, "/practice-admin/starter-packs/aptitude-starter")).statusCode).toBe(400);
    await expect(packs.import(org, "aptitude-starter")).rejects.toMatchObject({ code: "not_found" });
    expect((await call("GET", null, "/practice/nit-practice/tracks/aptitude-starter")).statusCode).toBe(404);
  });

  it("once offered, adds a track by section whose questions a learner answers, the explanation opening on a right answer", async () => {
    await setUp(true);
    expect((await packs.list(org)).find((p) => p.name === "aptitude-starter")).toMatchObject({ problems: 10, imported: false });
    expect(await packs.import(org, "aptitude-starter")).toEqual({ track: "aptitude-starter", lessons: 0, problems: 10 });
    await expect(packs.import(org, "aptitude-starter")).rejects.toMatchObject({ code: "slug_taken" });

    const track = (await call("GET", null, "/practice/nit-practice/tracks/aptitude-starter")).json();
    expect(track.modules.map((m: { title: string; items: unknown[] }) => [m.title, m.items.length])).toEqual([
      ["Quantitative aptitude", 5],
      ["Logical reasoning", 3],
      ["Verbal ability", 2],
    ]);
    const listed = (await call("GET", null, "/practice/nit-practice/problems")).json().problems as { slug: string; kind: string; tags: string[] }[];
    expect(listed.find((p) => p.slug === "apt-quant-si-ci-difference")).toMatchObject({ kind: "numeric", tags: ["aptitude-quant", "interest", "ci-minus-si"] });

    // The reading question carries its passage to the learner.
    const reading = (await call("GET", null, "/practice/nit-practice/problems/apt-verbal-rc-mess-committee")).json();
    expect(reading.question.passage).toMatchObject({ title: "The mess committee's experiment", text: expect.stringContaining("Bhopal") });

    const token = (await call("POST", null, "/practice/nit-practice/signup", { name: "Asha", email: "asha@example.com", password: "a long enough password" })).json().token as string;
    const answer = async (slug: string, value: string) => (await call("POST", token, `/practice/nit-practice/problems/${slug}/submit`, { answer: value })).json().status as string;
    const view = async (slug: string) => (await call("GET", token, `/practice/nit-practice/problems/${slug}`)).json() as { editorial: string | null; editorialLocked: boolean };

    // Wrong: the explanation stays shut. Right: it opens, steps and shortcut.
    expect(await answer("apt-quant-price-rise-then-fall", "1")).not.toBe("passed");
    expect(await view("apt-quant-price-rise-then-fall")).toMatchObject({ editorial: null, editorialLocked: true });
    expect(await answer("apt-quant-price-rise-then-fall", "0")).toBe("passed");
    expect((await view("apt-quant-price-rise-then-fall")).editorial).toMatch(/^### Understand[\s\S]*> \*\*Shortcut:\*\* Net change/);
    // A number to type: ₹25,000 at 8% for two years.
    expect(await answer("apt-quant-si-ci-difference", "160")).toBe("passed");
  }, 60_000);
});
