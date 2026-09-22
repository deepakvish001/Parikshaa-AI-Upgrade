import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OutboxStore, pgliteExecutor, type IdentityStore } from "@parikshaa/store";
import { indianMobile, sheetTime } from "./candidate-import.js";
import { InviteCodes } from "./invite-codes.js";
import { addOrganisation, addStaff, bearer, freshDatabase, PUBLIC_URL, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/**
 * ROADMAP §5: scheduling a sitting, inviting a cohort from a spreadsheet, and
 * each candidate opening their own link. Runs as `parikshaa_app`.
 */

const HOUR = 3_600_000;
// 10:00 to 13:00 IST on 1 October 2026.
const OPENS = Date.parse("2026-10-01T04:30:00Z");
const CLOSES = Date.parse("2026-10-01T07:30:00Z");

const exam = {
  id: "drive-2026",
  title: "Campus drive 2026",
  questions: [{ id: "q1", kind: "mcq", stem: "Pick", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 }],
  policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99 },
};

const CSV = [
  "Roll Number,Name,Email,Phone",
  "CS001,Ananya Iyer,ananya@college.test,98765 43210",
  "CS002,Rohan Das,rohan@college.test,+91 9123456780",
  "CS003,No Contact,,",
].join("\n");

let db: PGlite;
let app: FastifyInstance;
let identity: IdentityStore;
let clock: number;
let owner: string;

beforeEach(async () => {
  clock = OPENS - 2 * 24 * HOUR;
  db = await freshDatabase();
  ({ app, identity } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic, now: () => clock }));
  const org = await addOrganisation(identity, "org-a", "Acme");
  await addStaff(identity, org, "owner@acme.test", "owner", "Asha");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
  await call("POST", owner, "/exams", exam);
  const window = await call("PUT", owner, "/exams/drive-2026/window", {
    opensAt: new Date(OPENS).toISOString(),
    closesAt: new Date(CLOSES).toISOString(),
  });
  expect(window.statusCode).toBe(200);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const call = (method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object) =>
  app.inject({
    method,
    url,
    ...(token === null ? {} : { headers: bearer(token) }),
    ...(payload === undefined ? {} : { payload }),
  });

const importCsv = (csv: string, dryRun: boolean) =>
  call("POST", owner, "/exams/drive-2026/invitations/import", { csv, dryRun, channels: ["email", "sms"] });

async function inviteAll() {
  const res = await importCsv(CSV, false);
  expect(res.statusCode, res.payload).toBe(201);
  return (await call("GET", owner, "/exams/drive-2026/invitations")).json().invitations as { id: string; candidateRef: string }[];
}

const codeFor = (invitationId: string) => new InviteCodes(TOKEN_SECRET).issue("org-a", invitationId);
const redeem = (code: string) => call("POST", null, "/invitations/redeem", { code });

describe("reading a spreadsheet", () => {
  it("reads Indian mobiles in the forms people write them", () => {
    expect(indianMobile("98765 43210")).toBe("919876543210");
    expect(indianMobile("+91-98765-43210")).toBe("919876543210");
    expect(indianMobile("098765 43210")).toBe("919876543210");
    expect(indianMobile("12345 67890")).toBeNull();
    expect(indianMobile("98765")).toBeNull();
  });

  it("reads a bare time as IST and honours an explicit offset", () => {
    expect(sheetTime("2026-10-01 10:00")).toBe("2026-10-01T04:30:00.000Z");
    expect(sheetTime("2026-10-01T10:00:00Z")).toBe("2026-10-01T10:00:00.000Z");
    expect(sheetTime("tomorrow")).toBeNull();
  });
});

describe("importing a cohort", () => {
  it("checks a file without changing anything, and says what it would do", async () => {
    const res = await importCsv(CSV, true);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      dryRun: true,
      candidates: 3,
      problems: [],
      warnings: [{ row: 4, message: expect.stringMatching(/no email or phone/) }],
    });
    expect(res.json().preview[0]).toMatchObject({ candidateRef: "CS001", phone: "919876543210", email: "ananya@college.test" });
    expect((await call("GET", owner, "/exams/drive-2026/invitations")).json().invitations).toEqual([]);
  });

  it("reports every problem by row, and imports nothing", async () => {
    const bad = [
      "ref,name,email,phone,opens_at",
      "CS001,A,not-an-email,,",
      "CS002,B,,12345,",
      "CS001,C,c@college.test,,",
      "CS004,D,d@college.test,,2026-09-30 09:00",
    ].join("\n");

    const res = await importCsv(bad, false);

    expect(res.statusCode).toBe(422);
    expect(res.json().problems.map((p: { row: number }) => p.row)).toEqual([2, 3, 4, 5]);
    expect((await call("GET", owner, "/exams/drive-2026/invitations")).json().invitations).toEqual([]);
  });

  it("invites everyone and queues each their invitation and a reminder", async () => {
    const invited = await inviteAll();

    expect(invited.map((i) => i.candidateRef)).toEqual(["CS001", "CS002", "CS003"]);
    const queued = await new OutboxStore(pgliteExecutor(db)).recent("org-a");
    const about = (ref: string) => {
      const id = invited.find((i) => i.candidateRef === ref)!.id;
      return queued.filter((q) => q.subject["invitationId"] === id).map((q) => `${q.kind}:${q.purpose}`).sort();
    };
    expect(about("CS001")).toEqual(["email:invite", "email:reminder", "sms:invite", "sms:reminder"]);
    // Nothing to send to a candidate with no contact details.
    expect(about("CS003")).toEqual([]);
  });

  it("refuses a second import of the same candidates", async () => {
    await inviteAll();
    const again = await importCsv(CSV, true);
    expect(again.json().problems).toHaveLength(3);
  });

  it("is refused to a role that cannot start attempts", async () => {
    await addStaff(identity, "org-a" as never, "viewer@acme.test", "viewer");
    const viewer = await signIn(app, "viewer@acme.test");
    expect((await call("POST", viewer, "/exams/drive-2026/invitations/import", { csv: CSV })).statusCode).toBe(403);
  });
});

describe("a candidate opening their link", () => {
  it("is told when to come back if it is early", async () => {
    const [first] = await inviteAll();
    const res = await redeem(codeFor(first!.id));

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({
      error: "not_open_yet",
      opensAt: new Date(OPENS).toISOString(),
      closesAt: new Date(CLOSES).toISOString(),
    });
  });

  it("starts the attempt inside the window, and resumes the same one from another device", async () => {
    const [first] = await inviteAll();
    clock = OPENS + 10 * 60_000;

    const opened = await redeem(codeFor(first!.id));
    expect(opened.statusCode, opened.payload).toBe(200);
    expect(opened.json().resumed).toBe(false);
    const state = (await call("GET", opened.json().token, "/attempts/me")).json();
    expect(state.exam.title).toBe("Campus drive 2026");

    clock += 5 * 60_000;
    const again = await redeem(codeFor(first!.id));
    expect(again.json()).toMatchObject({ attemptId: opened.json().attemptId, resumed: true });

    const list = (await call("GET", owner, "/exams/drive-2026/invitations")).json().invitations;
    expect(list.find((i: { id: string }) => i.id === first!.id).attemptState).toBe("in_progress");
  });

  it("ends a late starter's attempt when the window closes, and says so in the record", async () => {
    const [first] = await inviteAll();
    clock = CLOSES - 20 * 60_000; // a 60-minute exam, started with 20 minutes of window left

    const { token } = (await redeem(codeFor(first!.id))).json();
    const state = (await call("GET", token, "/attempts/me")).json();

    expect(state.expiresAt).toBe(CLOSES);
    clock = CLOSES + 1;
    expect((await call("POST", token, "/attempts/me/answers", { questionId: "q1", answer: "0" })).statusCode).toBe(410);
    const ledger = (await call("GET", token, "/attempts/me/ledger")).json();
    expect(ledger.entries[0].event.closesAt).toBe(CLOSES);
  });

  it("will not start after the window, but still lets a started candidate back in", async () => {
    const [first, second] = await inviteAll();
    clock = OPENS + HOUR;
    await redeem(codeFor(first!.id));

    clock = CLOSES + 60_000;
    expect((await redeem(codeFor(second!.id))).statusCode).toBe(410);
    expect((await redeem(codeFor(first!.id))).json().resumed).toBe(true);
  });

  it("refuses a code the server did not issue, and one that was revoked, the same way", async () => {
    const [first, second] = await inviteAll();
    clock = OPENS + 60_000;

    const forged = codeFor(first!.id).replace(/.$/, (c) => (c === "A" ? "B" : "A"));
    await call("POST", owner, `/invitations/${second!.id}/revoke`);

    const results = [await redeem(forged), await redeem(codeFor(second!.id)), await redeem("not-a-code")];
    for (const res of results) {
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("invalid_invitation");
    }
  });
});

describe("handing out links yourself", () => {
  it("exports every candidate's working link, defusing spreadsheet formulas", async () => {
    await importCsv("ref,name,email\nCS009,=HYPERLINK(\"http://evil\"),x@college.test", false);

    const res = await call("GET", owner, "/exams/drive-2026/invitations/links.csv");

    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.payload).toContain(`"'=HYPERLINK(""http://evil"")"`);
    const link = res.payload.match(/https:\/\/exam\.test\/\?invite=([^"]+)/)![1]!;
    expect(PUBLIC_URL).toBe("https://exam.test");
    clock = OPENS + 1;
    expect((await redeem(decodeURIComponent(link))).statusCode).toBe(200);

    const audit = (await call("GET", owner, "/audit")).json().entries.map((e: { action: string }) => e.action);
    expect(audit).toContain("invitations.links_exported");
  });
});
