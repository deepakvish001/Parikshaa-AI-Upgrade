import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  attemptId as toAttemptId,
  examId,
  foldAttempt,
  orgId,
  questionId,
  verifyChain,
  type Exam,
  type LedgerEntry,
} from "@parikshaa/core";
import { DataKeys, IdentityStore as StoreIdentity, LedgerStore, pgliteExecutor, staffScope, type IdentityStore } from "@parikshaa/store";
import { parseReceipt, verifyReceipt, type Receipt } from "@parikshaa/verify";
import { ExamService } from "./service.js";
import { addOrganisation, addStaff, bearer, DATA_KEY, freshDatabase, signIn, wire } from "./testing/harness.js";

/**
 * ROADMAP §2: nothing a candidate does is ever lost.
 *
 * Drafts are autosaved outside the ledger and committed when the candidate
 * commits, submits, or runs out of time. Invigilators can see who is present
 * and grant time, on the record. Runs as `parikshaa_app`, so RLS is live.
 */

const HOUR = 3_600_000;

const rubric = { id: "c1", description: "Makes the argument", weight: 1 };

const exam = (id: string, allowRevision: boolean): Exam => ({
  id: examId(id),
  title: `Paper ${id}`,
  questions: [
    { id: "q1" as never, kind: "short", stem: "Explain.", maxScore: 5, rubric: [rubric], expectedPoints: ["x"] },
    { id: "q2" as never, kind: "short", stem: "Justify.", maxScore: 5, rubric: [rubric], expectedPoints: ["y"] },
  ],
  policy: { durationMs: HOUR, allowRevision, vivaTriggerRatio: 0.99 },
});

let db: PGlite;
let app: FastifyInstance;
let identity: IdentityStore;
let store: LedgerStore;
let clock: number;
let owner: string;
let invigilator: string;

beforeEach(async () => {
  clock = Date.UTC(2026, 8, 22, 9, 0);
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), {
    client: {} as unknown as Anthropic,
    now: () => clock,
  });
  ({ app, identity, store } = wiring);
  const org = await addOrganisation(identity, "org-a", "Acme");
  await addStaff(identity, org, "owner@acme.test", "owner", "Asha");
  await addStaff(identity, org, "inv@acme.test", "invigilator", "Imran");
  await db.exec(`SET ROLE parikshaa_app`);

  owner = await signIn(app, "owner@acme.test");
  invigilator = await signIn(app, "inv@acme.test");
  for (const e of [exam("open-book", true), exam("no-revision", false)]) {
    const saved = await app.inject({ method: "POST", url: "/exams", headers: bearer(owner), payload: e });
    expect(saved.statusCode, saved.payload).toBe(201);
  }
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const call = (method: "GET" | "POST" | "PUT", token: string, url: string, payload?: object) =>
  payload === undefined
    ? app.inject({ method, url, headers: bearer(token) })
    : app.inject({ method, url, headers: bearer(token), payload });

async function start(examName = "open-book"): Promise<{ attemptId: string; token: string }> {
  const res = await call("POST", invigilator, `/exams/${examName}/attempts`, { candidateId: "cand-1" });
  expect(res.statusCode).toBe(201);
  return res.json();
}

const draft = (token: string, question: string, answer: string) =>
  call("PUT", token, `/attempts/me/drafts/${question}`, { answer });
const commit = (token: string, question: string, answer: string) =>
  call("POST", token, "/attempts/me/answers", { questionId: question, answer });
const state = async (token: string) => (await call("GET", token, "/attempts/me")).json();

/**
 * The chain, once the attempt closes: the candidate's receipt must verify,
 * and what it records is read back opened, since answers are sealed in it.
 */
async function chain(token: string): Promise<readonly LedgerEntry[]> {
  const body = (await call("GET", token, "/attempts/me/ledger")).json();
  expect(body.sealed).toBe(true);
  const record = body.entries.map((e: LedgerEntry & { type: string }) => ({
    seq: e.seq,
    timestamp: e.timestamp,
    event: e.event,
    prevHash: e.prevHash,
    hash: e.hash,
  }));
  expect(verifyChain(record)).toEqual({ ok: true });
  const opened = await store.load(staffScope(orgId("org-a")), (await state(token)).attemptId);
  expect(opened.map((e) => e.hash)).toEqual(record.map((e: LedgerEntry) => e.hash));
  return opened;
}

const answers = (entries: readonly LedgerEntry[]) =>
  entries.flatMap((e) =>
    e.event.type === "answer_submitted"
      ? [{ q: e.event.response.questionId, a: e.event.response.answer, at: e.event.response.submittedAt }]
      : [],
  );

describe("drafts", () => {
  it("keeps what was typed without writing it to the ledger, and restores it on resume", async () => {
    const { token } = await start();

    expect((await draft(token, "q1", "Because the invariant")).statusCode).toBe(202);
    clock += 5_000;
    expect((await draft(token, "q1", "Because the invariant holds")).statusCode).toBe(202);

    const resumed = await state(token);
    expect(resumed.answers).toEqual([]);
    expect(resumed.drafts).toEqual([{ questionId: "q1", answer: "Because the invariant holds", savedAt: clock }]);
  });

  it("does not offer a draft that says what was already committed", async () => {
    const { token } = await start();
    await draft(token, "q1", "Final words");
    await commit(token, "q1", "Final words");

    expect((await state(token)).drafts).toEqual([]);
  });

  it("refuses a draft for a question that is not on the exam", async () => {
    const { token } = await start();
    expect((await draft(token, "q-ghost", "x")).statusCode).toBe(409);
  });
});

describe("closing an attempt commits what was typed", () => {
  it("commits outstanding drafts on submit, stamped when they were written", async () => {
    const { token } = await start();
    await commit(token, "q1", "Committed answer");
    clock += 60_000;
    await draft(token, "q2", "Typed, never committed");
    const typedAt = clock;
    clock += 60_000;

    expect((await call("POST", token, "/attempts/me/submit")).statusCode).toBe(200);

    const entries = await chain(token);
    expect(answers(entries)).toEqual([
      { q: "q1", a: "Committed answer", at: expect.any(Number) },
      { q: "q2", a: "Typed, never committed", at: typedAt },
    ]);
    expect(entries.at(-1)?.event.type).toBe("attempt_submitted");
  });

  it("commits drafts saved before the deadline when time runs out, and none after", async () => {
    const { token } = await start();
    await draft(token, "q1", "Written in time");
    clock += HOUR + 1;

    // The first write after the deadline finds it, closes the attempt, and is refused.
    const late = await draft(token, "q2", "Written too late");
    expect(late.statusCode).toBe(410);

    expect(answers(await chain(token))).toEqual([{ q: "q1", a: "Written in time", at: expect.any(Number) }]);
    expect((await state(token)).state).toBe("submitted");
  });

  it("submits after the deadline with only what was saved in time", async () => {
    const { token } = await start();
    await draft(token, "q1", "In time");
    clock += HOUR + 1;

    expect((await call("POST", token, "/attempts/me/submit")).statusCode).toBe(200);
    expect(answers(await chain(token)).map((a) => a.a)).toEqual(["In time"]);
  });

  it("keeps the committed answer on an exam that forbids revision", async () => {
    const { token } = await start("no-revision");
    await commit(token, "q1", "My final answer");
    await draft(token, "q1", "Second thoughts");
    await draft(token, "q2", "Uncommitted but new");

    await call("POST", token, "/attempts/me/submit");

    expect(answers(await chain(token)).map((a) => [a.q, a.a])).toEqual([
      ["q1", "My final answer"],
      ["q2", "Uncommitted but new"],
    ]);
  });

  it("closes once when two submits arrive together, and the chain still folds", async () => {
    const { token } = await start();
    await draft(token, "q1", "Something");

    const [a, b] = await Promise.all([
      call("POST", token, "/attempts/me/submit"),
      call("POST", token, "/attempts/me/submit"),
    ]);
    expect([a.statusCode, b.statusCode]).toContain(200);

    const entries = await chain(token);
    expect(entries.filter((e) => e.event.type === "attempt_submitted")).toHaveLength(1);
    expect(foldAttempt(entries).ok).toBe(true);
  });

  it("refuses an answer that arrives as the attempt closes, rather than corrupting the chain", async () => {
    const { attemptId, token } = await start();

    // An answer that has read the attempt as open is held just before its
    // append, while a submit runs to completion. Then it is let go. Without the
    // guard it would land behind attempt_submitted and the chain would no
    // longer fold — the attempt would become unreadable.
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let reachedAppend!: () => void;
    const atAppend = new Promise<void>((resolve) => (reachedAppend = resolve));

    class HeldStore extends LedgerStore {
      override async append(...args: Parameters<LedgerStore["append"]>) {
        if (args[2].type === "answer_submitted") {
          reachedAppend();
          await held;
        }
        return super.append(...args);
      }
    }
    const sql = pgliteExecutor(db);
    const racing = new ExamService({
      store: new HeldStore(sql, { clock: () => clock, keys: new DataKeys(DATA_KEY) }),
      identity: new StoreIdentity(sql),
      client: {} as unknown as Anthropic,
      now: () => clock,
    });
    const access = { orgId: orgId("org-a"), attemptId: toAttemptId(attemptId) };

    const late = racing.submitAnswer(access, questionId("q1"), "Racing the submit");
    await atAppend;
    expect((await call("POST", token, "/attempts/me/submit")).statusCode).toBe(200);
    release();

    await expect(late).rejects.toThrow(/closed/);
    const entries = await chain(token);
    expect(foldAttempt(entries).ok).toBe(true);
    expect(answers(entries)).toEqual([]);
  });
});

describe("presence", () => {
  it("shows an invigilator when a candidate's page last checked in", async () => {
    const { attemptId, token } = await start();
    const list = async () =>
      (await call("GET", invigilator, "/exams/open-book/attempts")).json().attempts.find(
        (a: { id: string }) => a.id === attemptId,
      );

    expect((await list()).lastSeenAt).toBeNull();

    const beat = await call("POST", token, "/attempts/me/heartbeat");
    expect(beat.json()).toEqual({ state: "in_progress", expiresAt: clock + HOUR, announcements: 0 });
    expect((await list()).lastSeenAt).toBe(new Date(clock).toISOString());
  });

  it("never closes an attempt, even past its deadline", async () => {
    const { token } = await start();
    clock += HOUR + 1;

    expect((await call("POST", token, "/attempts/me/heartbeat")).json().state).toBe("in_progress");
  });
});

describe("extra time", () => {
  const extend = (token: string, attemptId: string, minutes: number, reason: string) =>
    call("POST", token, `/attempts/${attemptId}/extend`, { minutes, reason });

  it("lets an invigilator grant time on the record, and the candidate's page learns of it", async () => {
    const started = clock;
    const { attemptId, token } = await start();
    clock += HOUR - 60_000;

    const res = await extend(invigilator, attemptId, 15, "Power cut in hall B at 09:50.");
    expect(res.json()).toEqual({ expiresAt: started + HOUR + 15 * 60_000 });
    expect((await call("POST", token, "/attempts/me/heartbeat")).json().expiresAt).toBe(started + HOUR + 15 * 60_000);

    // Past the original window, inside the extended one.
    clock += 10 * 60_000;
    expect((await commit(token, "q1", "Finished after the power came back")).statusCode).toBe(202);
    await call("POST", token, "/attempts/me/submit");

    const receipt = parseReceipt((await call("GET", token, "/attempts/me/ledger")).json());
    if ("error" in receipt) throw new Error(receipt.error);
    const report = verifyReceipt(receipt as Receipt);
    expect(report.ok).toBe(true);
    if (report.ok) {
      expect(report.timeline.map((t) => t.what)).toContain(
        "Time extended by 15 min by Imran — Power cut in hall B at 09:50.",
      );
    }
  });

  it("can still be granted after the window passed, if nothing closed the attempt", async () => {
    const { attemptId, token } = await start();
    clock += HOUR + 5 * 60_000; // the laptop died; nothing was written since

    expect((await extend(invigilator, attemptId, 20, "Laptop battery failed; verified by invigilator.")).statusCode).toBe(200);
    expect((await draft(token, "q1", "Back online")).statusCode).toBe(202);
  });

  it("is a person's decision, with a reason, within limits, on an open attempt", async () => {
    const { attemptId, token } = await start();
    await addStaff(identity, "org-a" as never, "viewer@acme.test", "viewer");
    const viewer = await signIn(app, "viewer@acme.test");
    const key = (await call("POST", owner, "/api-keys", { name: "ATS", role: "invigilator" })).json().secret as string;

    expect((await extend(key, attemptId, 10, "Automated accommodation.")).statusCode).toBe(403);
    expect((await extend(viewer, attemptId, 10, "Not my call to make.")).statusCode).toBe(403);
    expect((await extend(invigilator, attemptId, 10, "short")).statusCode).toBe(422);
    expect((await extend(invigilator, attemptId, 0, "No time at all, oddly.")).statusCode).toBe(400);

    await call("POST", token, "/attempts/me/submit");
    expect((await extend(invigilator, attemptId, 10, "Too late for this one.")).statusCode).toBe(409);
  });

  it("can be given to everyone still sitting at once, leaving the submitted as they are", async () => {
    const started = clock;
    const sitting = async (candidateId: string) => {
      const res = await call("POST", invigilator, "/exams/open-book/attempts", { candidateId });
      expect(res.statusCode).toBe(201);
      return res.json() as { attemptId: string; token: string };
    };
    const a = await sitting("cand-a");
    const b = await sitting("cand-b");
    const done = await sitting("cand-c");
    await call("POST", done.token, "/attempts/me/submit");

    const everyone = (minutes: number, reason: string, token = invigilator) =>
      call("POST", token, "/exams/open-book/extend-open", { minutes, reason });
    expect((await everyone(10, "short")).statusCode).toBe(422);
    const res = await everyone(10, "Power cut across the lab block at 09:40.");
    expect(res.statusCode, res.payload).toBe(200);
    expect(res.json()).toEqual({ extended: 2, failed: [] });
    for (const t of [a.token, b.token]) {
      expect((await call("POST", t, "/attempts/me/heartbeat")).json().expiresAt).toBe(started + HOUR + 10 * 60_000);
    }
    const audit = (await call("GET", owner, "/audit")).json().entries.filter((e: { action: string }) => e.action === "attempt.extended");
    expect(audit).toHaveLength(2);

    await addStaff(identity, "org-a" as never, "viewer@acme.test", "viewer");
    expect((await everyone(10, "Not my call to make.", await signIn(app, "viewer@acme.test"))).statusCode).toBe(403);
  });

  it("is audited", async () => {
    const { attemptId } = await start();
    await extend(invigilator, attemptId, 10, "Accessibility accommodation on file.");

    const entries = (await call("GET", owner, "/audit")).json().entries as { action: string }[];
    expect(entries.map((e) => e.action)).toContain("attempt.extended");
  });
});
