import { hashPassword, verifyAll } from "@parikshaa/api";
import { connect, IdentityStore, LedgerStore } from "@parikshaa/store";
import { appUrl, ownerUrl, OWNER_EMAIL, OWNER_PASSWORD, resetDatabase } from "./database.js";
import { Api, seedCohort, startServer, type Server } from "./harness.js";

/**
 * Chaos (ROADMAP §13): kill things mid-write and prove the record survives.
 *
 * A cohort writes as fast as it can — drafts, answers, heartbeats, probes,
 * submissions — while, in turn:
 *
 *   1. the server is SIGKILLed mid-flight, as a crashed machine would be;
 *   2. every database connection the server holds is terminated under it.
 *
 * After each, every chain in the database must verify, every candidate must be
 * able to reopen their link and carry on, and the server must serve again
 * without a restart in the second case. Exits non-zero on any failure.
 *
 *   npm run chaos -w @parikshaa/e2e -- [candidates=60] [rounds=3]
 */

const candidates = Number.parseInt(process.argv[2] ?? "60", 10);
const rounds = Number.parseInt(process.argv[3] ?? "3", 10);
const PORT = 4180;

const failures: string[] = [];
let server: Server | undefined;
const check = (ok: boolean, what: string) => {
  process.stdout.write(`${ok ? "  ok  " : "  FAIL"} ${what}\n`);
  if (!ok) failures.push(what);
};

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One candidate writing as fast as the server lets them, until told to stop. Errors are expected once things die. */
async function write(api: Api, stop: { stopped: boolean }, counts: { ok: number; failed: number }) {
  for (let i = 0; !stop.stopped; i++) {
    const step = i % 6;
    try {
      const res =
        step === 0
          ? await api.call("PUT", "/attempts/me/drafts/q2", { answer: `Draft ${i}: the interval halves each step` })
          : step === 1
            ? await api.call("POST", "/attempts/me/answers", { questionId: "q2", answer: `Answer ${i}: the interval halves` })
            : step === 2
              ? await api.call("POST", "/attempts/me/answers", { questionId: "q1", answer: String(i % 2) })
              : step === 3
                ? await api.call("POST", "/attempts/me/heartbeat")
                : step === 4
                  ? await api.call("GET", "/attempts/me/probe")
                  : await api.call("POST", "/attempts/me/answers", { questionId: "q3", answer: String(8 + (i % 4)) });
      await res.arrayBuffer();
      if (res.ok) counts.ok++;
      else counts.failed++;
    } catch {
      counts.failed++;
      await pause(20);
    }
  }
}

async function verifyEverything(label: string): Promise<void> {
  const sql = connect(appUrl, { max: 2 });
  try {
    const executor = sql;
    const report = await verifyAll(new LedgerStore(executor), new IdentityStore(executor));
    check(report.failures.length === 0, `${label}: ${report.attempts} chains, ${report.entries} entries, all verify${report.failures.length === 0 ? "" : ` — ${JSON.stringify(report.failures.slice(0, 3))}`}`);
  } finally {
    await sql.end();
  }
}

/** Every candidate reopens their link and can still write; returns their fresh handles. */
async function everyoneCarriesOn(server: Server, codes: readonly string[], label: string): Promise<Api[]> {
  const anonymous = new Api(server.base);
  const reopened = await Promise.all(
    codes.map(async (code) => {
      const res = await anonymous.call("POST", "/invitations/redeem", { code });
      if (!res.ok) return null;
      const { token } = (await res.json()) as { token: string };
      const api = anonymous.as(token);
      const state = await api.call("GET", "/attempts/me");
      const wrote = await api.call("PUT", "/attempts/me/drafts/q2", { answer: "still here" });
      return state.ok && wrote.ok ? api : null;
    }),
  );
  check(reopened.every((a) => a !== null), `${label}: all ${codes.length} candidates reopened their links and wrote again`);
  return reopened.filter((a): a is Api => a !== null);
}

async function main() {
  process.stdout.write(`chaos: ${candidates} candidates, ${rounds} rounds of each fault\n`);
  await resetDatabase(hashPassword);
  server = await startServer({ port: PORT, reset: false, env: { E2E_MODEL_LATENCY_MS: "50" } });
  const { api: owner, codes } = await seedCohort(server.base, { email: OWNER_EMAIL, password: OWNER_PASSWORD }, "chaos", candidates);
  let writers = await everyoneCarriesOn(server, codes, "start");

  for (let round = 1; round <= rounds; round++) {
    // --- the server dies mid-write ---------------------------------------------
    const stop = { stopped: false };
    const counts = { ok: 0, failed: 0 };
    const running = writers.map((w) => write(w, stop, counts));
    await pause(800 + Math.random() * 700);
    await server.kill();
    stop.stopped = true;
    await Promise.all(running);
    process.stdout.write(`round ${round}: killed the server after ${counts.ok} writes succeeded\n`);
    await verifyEverything(`round ${round}, after SIGKILL`);

    server = await startServer({ port: PORT, reset: false, env: { E2E_MODEL_LATENCY_MS: "50" } });
    writers = await everyoneCarriesOn(server, codes, `round ${round}, after restart`);

    // --- the database drops every connection under a running server -------------
    const stop2 = { stopped: false };
    const counts2 = { ok: 0, failed: 0 };
    const running2 = writers.map((w) => write(w, stop2, counts2));
    await pause(500 + Math.random() * 500);
    const admin = connect(ownerUrl, { max: 1 });
    // The owner role needs pg_signal_backend for this (see the chaos section of docs/OPERATIONS.md).
    const rows = await admin.query<{ killed: number }>(
      `SELECT count(pg_terminate_backend(pid))::int AS killed FROM pg_stat_activity WHERE usename = 'parikshaa_app'`,
    );
    const killed = rows[0]!.killed;
    await admin.end();
    await pause(800);
    stop2.stopped = true;
    await Promise.all(running2);
    process.stdout.write(`round ${round}: terminated ${killed} database connections mid-write (${counts2.ok} writes ok, ${counts2.failed} refused)\n`);
    const serves = await new Api(server.base).call("GET", "/health");
    check(serves.ok, `round ${round}: the server serves again without a restart`);
    writers = await everyoneCarriesOn(server, codes, `round ${round}, after the connections dropped`);
    await verifyEverything(`round ${round}, after the connections dropped`);
  }

  // Finally everyone submits and is graded, and the chains still verify.
  const submitted = await Promise.all(writers.map(async (w) => (await w.call("POST", "/attempts/me/submit")).ok));
  check(submitted.every(Boolean), `all ${writers.length} candidates submitted`);
  const attempts = (await owner.json<{ attempts: { id: string }[] }>("GET", "/exams/chaos/attempts")).attempts;
  const graded = await Promise.all(attempts.map(async (a) => (await owner.call("POST", `/attempts/${a.id}/grade`)).ok));
  check(graded.every(Boolean) && attempts.length === candidates, `all ${attempts.length} attempts graded`);
  await verifyEverything("at the end");

  await server.stop();
  process.stdout.write(failures.length === 0 ? "chaos: every check passed\n" : `chaos: ${failures.length} checks failed\n`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

try {
  await main();
} finally {
  // Never leave a server behind, whatever failed.
  server?.process.kill("SIGKILL");
}
