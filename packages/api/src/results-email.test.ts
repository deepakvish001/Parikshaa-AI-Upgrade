import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { strFromU8, unzipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor } from "@parikshaa/store";
import { DeliveryWorker, OutboxLog, type EmailMessage } from "./delivery.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/** The results workbook by email: to the one who asks, at their own address, as it stands when sent. */

const exam = {
  id: "drive",
  title: "Campus drive",
  questions: [{ id: "q1", kind: "mcq", stem: "Which sort is stable?", maxScore: 2, rubric: [], options: ["Merge sort", "Heap sort"], correctIndex: 0 }],
  policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.99 },
};

let db: PGlite;
let app: FastifyInstance;

afterEach(async () => {
  await app.close();
  await db.close();
});

async function start(mail: OutboxLog | null) {
  db = await freshDatabase();
  const sql = pgliteExecutor(db);
  const wiring = await wire(sql, { client: {} as unknown as Anthropic, ...(mail === null ? {} : { mailer: mail }) });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme");
  await addStaff(wiring.identity, org, "owner@acme.test", "owner", "Asha");
  await addStaff(wiring.identity, org, "watch@acme.test", "invigilator", "Ravi");
  await db.exec(`SET ROLE parikshaa_app`);
  const owner = await signIn(app, "owner@acme.test");
  expect((await app.inject({ method: "POST", url: "/exams", headers: bearer(owner), payload: exam })).statusCode).toBe(201);
  const worker = new DeliveryWorker({
    outbox: new OutboxStore(sql),
    invitations: new InvitationStore(sql),
    store: new LedgerStore(sql),
    identity: new IdentityStore(sql),
    link: () => "",
    mailer: mail,
    sms: null,
    handlers: wiring.handlers,
  });
  return { owner, worker };
}

describe("the results by email", () => {
  it("sends the workbook to the asker's own address, and records the export", async () => {
    const mail = new OutboxLog();
    const { owner, worker } = await start(mail);
    const started = await app.inject({ method: "POST", url: "/exams/drive/attempts", headers: bearer(owner), payload: { candidateId: "CS001" } });
    const { token } = started.json();
    await app.inject({ method: "POST", url: "/attempts/me/answers", headers: bearer(token), payload: { questionId: "q1", answer: "0" } });
    await app.inject({ method: "POST", url: "/attempts/me/submit", headers: bearer(token) });

    const res = await app.inject({ method: "POST", url: "/exams/drive/results/email", headers: bearer(owner) });
    expect(res.statusCode, res.payload).toBe(202);
    expect(res.json()).toEqual({ to: "owner@acme.test" });

    await worker.tick();
    const sent = mail.sent.filter((m): m is EmailMessage => "subject" in m);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "owner@acme.test", subject: "Results: Campus drive" });
    const [file] = sent[0]!.attachments!;
    expect(file!.filename).toBe("drive-results.xlsx");
    const sheet = strFromU8(unzipSync(file!.content)["xl/worksheets/sheet1.xml"]!);
    expect(sheet).toContain("CS001");

    const audit = (await app.inject({ method: "GET", url: "/audit", headers: bearer(owner) })).json().entries.map((e: { action: string }) => e.action);
    expect(audit).toContain("results.exported");
  });

  it("is for those who may read results, and says when email is not set up", async () => {
    await start(null);
    const owner = await signIn(app, "owner@acme.test");
    const watcher = await signIn(app, "watch@acme.test");
    expect((await app.inject({ method: "POST", url: "/exams/drive/results/email", headers: bearer(watcher) })).statusCode).toBe(403);
    const refused = await app.inject({ method: "POST", url: "/exams/drive/results/email", headers: bearer(owner) });
    expect(refused.statusCode).toBe(409);
    expect(refused.json().message).toContain("Email is not set up");
  });
});
