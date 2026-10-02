import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor, type SqlExecutor } from "@parikshaa/store";
import { DeliveryWorker, OutboxLog, type EmailMessage, type WhatsAppMessage } from "./delivery.js";
import { fakeModel } from "./fake-model.js";
import { addOrganisation, addStaff, bearer, freshDatabase, PUBLIC_URL, signIn, wire, type Wiring } from "./testing/harness.js";

/** CO42 and CL67: an offer and a new drive reach the student by email and WhatsApp, from the student list. */

let db: PGlite;
let app: FastifyInstance;
let owner: string;
let mail: OutboxLog;
let phone: OutboxLog;
let worker: DeliveryWorker;
const clock = Date.parse("2026-10-05T05:00:00Z");

const SHEET = [
  "roll_number,name,email,phone,branch,batch,cgpa,backlogs",
  "CS001,Ananya Iyer,ananya@college.test,9876543210,CSE,2027,8.9,0",
  "CS002,Rohan Verma,rohan@college.test,,CSE,2027,6.4,0",
  "ME001,Kabir Singh,,9123456789,MECH,2027,9.1,0",
  "EC001,Meera Nair,,,ECE,2027,8.0,0",
].join("\n");

const call = (method: "GET" | "POST" | "PUT", url: string, payload?: object) => app.inject({ method, url, headers: bearer(owner), ...(payload === undefined ? {} : { payload }) });
const emails = () => mail.sent as EmailMessage[];
const whatsapps = () => phone.sent as WhatsAppMessage[];
async function drain() {
  for (let i = 0; i < 5; i++) if ((await worker.tick()) === 0) return;
}

beforeEach(async () => {
  db = await freshDatabase();
  mail = new OutboxLog();
  phone = new OutboxLog();
  const sql: SqlExecutor = pgliteExecutor(db);
  const wiring: Wiring = await wire(sql, { client: fakeModel({ latencyMs: 0 }).client, now: () => clock, mailer: mail, whatsappSender: phone });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme Engineering College");
  await addStaff(wiring.identity, org, "tpo@acme.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "tpo@acme.test");
  worker = new DeliveryWorker({
    outbox: new OutboxStore(sql),
    invitations: new InvitationStore(sql),
    store: new LedgerStore(sql),
    identity: new IdentityStore(sql),
    link: () => PUBLIC_URL,
    mailer: mail,
    sms: null,
    whatsapp: phone,
    handlers: wiring.handlers,
    now: () => clock,
  });
  await call("POST", "/students/import", { csv: SHEET, dryRun: false });
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("telling students", () => {
  it("sends an offer's link by email and WhatsApp as it is made, and not once it is answered", async () => {
    const id = (await call("POST", "/drives", { company: "Infosys", role: "Systems Engineer" })).json().id;
    await call("POST", `/drives/${id}/students`, { refs: ["CS001", "CS002"] });
    const made = (await call("POST", `/drives/${id}/offers`, { ref: "CS001", ctcLpa: 3.6, joiningDate: "2027-07-01", note: "Bring your ID" })).json();
    expect(made.sent).toEqual(["email", "whatsapp"]);
    await drain();
    expect(emails()).toEqual([expect.objectContaining({ to: "ananya@college.test", subject: "Your offer from Infosys: Systems Engineer" })]);
    expect(emails()[0]!.text).toContain(made.link);
    expect(emails()[0]!.text).toContain("Bring your ID");
    expect(whatsapps()).toEqual([{ to: "919876543210", template: "offer", parameters: ["Ananya Iyer", "Infosys", "Systems Engineer", "₹3.6 lakh a year", made.link] }]);

    // Rohan has no phone: email only. Answered before the worker runs: nothing goes.
    const second = (await call("POST", `/drives/${id}/offers`, { ref: "CS002", ctcLpa: 3.6 })).json();
    expect(second.sent).toEqual(["email"]);
    const code = encodeURIComponent(new URL(second.link).searchParams.get("offer")!);
    await app.inject({ method: "POST", url: `/offers/${code}/response`, payload: { response: "declined" } });
    await drain();
    expect(emails()).toHaveLength(1);
  });

  it("tells eligible students of a new drive once, with its link to apply", async () => {
    const id = (await call("POST", "/drives", { company: "TCS", role: "Ninja", eligibility: { minCgpa: 7.5 }, applyBy: "2026-10-20" })).json().id;
    expect((await call("POST", `/drives/${id}/alert`)).json().message).toMatch(/link to apply/);
    const { link } = (await call("POST", `/drives/${id}/apply-link`, { open: true })).json();
    // CS001 and ME001 meet the bar; EC001 does too but cannot be reached; CS002 does not.
    expect((await call("POST", `/drives/${id}/alert`)).json()).toEqual({ queued: 2, already: 0, unreachable: 1 });
    expect((await call("POST", `/drives/${id}/alert`)).json()).toEqual({ queued: 0, already: 2, unreachable: 1 });
    await drain();
    expect(emails().map((e) => e.to)).toEqual(["ananya@college.test"]);
    expect(emails()[0]!.text).toContain(link);
    // Items written together are sent in no set order.
    expect(whatsapps().map((w) => [w.to, w.template, w.parameters.at(-1)]).sort()).toEqual([
      ["919123456789", "drive", link],
      ["919876543210", "drive", link],
    ]);
    expect(JSON.stringify((await call("GET", "/audit")).json())).toContain("drive.alerted");
  });
});
