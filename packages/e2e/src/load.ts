import { writeFile } from "node:fs/promises";
import { hashPassword, verifyAll } from "@parikshaa/api";
import { connect, IdentityStore, LedgerStore } from "@parikshaa/store";
import { appUrl, OWNER_EMAIL, OWNER_PASSWORD, resetDatabase } from "./database.js";
import { Api, seedCohort, startServer } from "./harness.js";

/**
 * Load (ROADMAP §10): a campus drive at 10:00.
 *
 * Every candidate opens their link within the same few seconds, then sits a
 * compressed exam: autosaving drafts as they type, a heartbeat every thirty
 * seconds, committing answers, answering a follow-up when one comes, and
 * submitting — spread over the last stretch, as people finish at different
 * times. Then the institution grades everyone. Reports latency per route and
 * every error, and verifies every chain at the end.
 *
 *   npm run load -w @parikshaa/e2e -- [candidates=1000] [minutes=3] [modelMs=2000] [draftEverySec=8] [startSpreadSec=10]
 *
 * One machine plays everyone and runs the server and the database, so the
 * numbers are a floor for what a real deployment does, not a ceiling.
 */

const candidates = Number.parseInt(process.argv[2] ?? "1000", 10);
const minutes = Number.parseFloat(process.argv[3] ?? "3");
const modelMs = Number.parseInt(process.argv[4] ?? "2000", 10);
const draftEverySec = Number.parseFloat(process.argv[5] ?? "8");
const startSpreadSec = Number.parseFloat(process.argv[6] ?? "10");
// Not 4190: the Fetch standard blocks it (ManageSieve), so fetch() refuses it outright.
const PORT = 4200;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms: number) => ms * (0.5 + Math.random());

interface Sample {
  readonly route: string;
  readonly ms: number;
  readonly status: number;
}
const samples: Sample[] = [];

/** Time one request and record it under a route name; network failures count as status 0. */
async function timed(route: string, request: () => Promise<Response>): Promise<Response | null> {
  const started = performance.now();
  try {
    const res = await request();
    await res.arrayBuffer().catch(() => undefined);
    samples.push({ route, ms: performance.now() - started, status: res.status });
    return res;
  } catch {
    samples.push({ route, ms: performance.now() - started, status: 0 });
    return null;
  }
}

/** A request whose body we need: time it, then re-issue nothing — read the body inside. */
async function timedJson<T>(route: string, request: () => Promise<Response>): Promise<T | null> {
  const started = performance.now();
  try {
    const res = await request();
    const body = res.ok ? ((await res.json()) as T) : (await res.arrayBuffer(), null);
    samples.push({ route, ms: performance.now() - started, status: res.status });
    return body;
  } catch {
    samples.push({ route, ms: performance.now() - started, status: 0 });
    return null;
  }
}

async function sit(base: string, code: string, endsAt: number): Promise<void> {
  const anonymous = new Api(base);
  const opened = await timedJson<{ token: string }>("POST /invitations/redeem", () => anonymous.call("POST", "/invitations/redeem", { code }));
  if (opened === null) return;
  const me = anonymous.as(opened.token);
  await timed("GET /attempts/me", () => me.call("GET", "/attempts/me"));

  // Everyone submits somewhere in the last 30% of the sitting.
  const submitAt = endsAt - Math.random() * 0.3 * (endsAt - Date.now());
  let nextHeartbeat = Date.now() + jitter(30_000);
  let answeredMcq = false;
  let draft = 0;

  while (Date.now() < submitAt) {
    await pause(jitter(draftEverySec * 1000));
    draft++;
    await timed("PUT /attempts/me/drafts/:questionId", () =>
      me.call("PUT", "/attempts/me/drafts/q2", { answer: `The interval halves each step; after ${draft} steps it is empty.` }),
    );
    if (Date.now() > nextHeartbeat) {
      await timed("POST /attempts/me/heartbeat", () => me.call("POST", "/attempts/me/heartbeat"));
      nextHeartbeat = Date.now() + jitter(30_000);
    }
    if (!answeredMcq && Math.random() < 0.15) {
      answeredMcq = true;
      await timed("POST /attempts/me/answers", () => me.call("POST", "/attempts/me/answers", { questionId: "q1", answer: Math.random() < 0.6 ? "1" : "0" }));
      // Committing an answer asks whether a follow-up is due; the model takes its time.
      const stream = await timed("GET /attempts/me/probe", () => me.call("GET", "/attempts/me/probe"));
      if (stream?.ok) {
        const state = await timedJson<{ openProbe: { id: string } | null }>("GET /attempts/me", () => me.call("GET", "/attempts/me"));
        const probeId = state?.openProbe?.id;
        if (probeId !== undefined) {
          await pause(jitter(20_000));
          await timed("POST /attempts/me/probes/:probeId/reply", () =>
            me.call("POST", `/attempts/me/probes/${probeId}/reply`, { reply: "Merging never reorders equal keys." }),
          );
        }
      }
    }
  }
  await timed("POST /attempts/me/answers", () => me.call("POST", "/attempts/me/answers", { questionId: "q3", answer: "10" }));
  await timed("POST /attempts/me/submit", () => me.call("POST", "/attempts/me/submit"));
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;
}

function report(title: string, from: number, to: number): string {
  const byRoute = new Map<string, Sample[]>();
  for (const s of samples.slice(from, to)) byRoute.set(s.route, [...(byRoute.get(s.route) ?? []), s]);
  const lines = [`\n${title}`, "route".padEnd(42) + "count".padStart(7) + "errors".padStart(8) + "p50".padStart(8) + "p95".padStart(8) + "p99".padStart(8) + "max".padStart(8)];
  for (const [route, list] of [...byRoute].sort((a, b) => b[1].length - a[1].length)) {
    const ms = list.map((s) => s.ms).sort((a, b) => a - b);
    const errors = list.filter((s) => s.status < 200 || s.status >= 300);
    const kinds = [...new Set(errors.map((e) => e.status))].map((st) => `${st}×${errors.filter((e) => e.status === st).length}`).join(" ");
    lines.push(
      route.padEnd(42) +
        String(list.length).padStart(7) +
        String(errors.length).padStart(8) +
        [50, 95, 99, 100].map((p) => `${Math.round(percentile(ms, p))}`.padStart(8)).join("") +
        (kinds === "" ? "" : `   ${kinds}`),
    );
  }
  return lines.join("\n");
}

async function main() {
  process.stdout.write(
    `load: ${candidates} candidates starting within ${startSpreadSec}s, a ${minutes}-minute sitting, model ${modelMs} ms, a draft every ~${draftEverySec}s\n`,
  );
  await resetDatabase(hashPassword);
  process.stdout.write("database reset\n");
  const server = await startServer({
    port: PORT,
    reset: false,
    env: { E2E_MODEL_LATENCY_MS: String(modelMs), RATE_LIMITS: "on", DATABASE_POOL_MAX: process.env["DATABASE_POOL_MAX"] ?? "20" },
  });
  process.stdout.write("server up\n");
  try {
    const seeded = Date.now();
    const { api: owner, codes } = await seedCohort(server.base, { email: OWNER_EMAIL, password: OWNER_PASSWORD }, "load", candidates);
    process.stdout.write(`seeded ${candidates} invitations in ${((Date.now() - seeded) / 1000).toFixed(1)}s\n`);

    // 10:00 — everyone opens their link inside the same few seconds.
    const started = Date.now();
    const endsAt = started + minutes * 60_000;
    const sittings = codes.map(async (code) => {
      await pause(Math.random() * startSpreadSec * 1000);
      await sit(server.base, code, endsAt);
    });
    await Promise.all(sittings);
    const satFor = (Date.now() - started) / 1000;
    const afterSitting = samples.length;
    const rps = afterSitting / satFor;

    // The institution grades everyone, twenty at a time.
    const gradingStarted = Date.now();
    const attempts = (await owner.json<{ attempts: { id: string }[] }>("GET", "/exams/load/attempts")).attempts;
    for (let i = 0; i < attempts.length; i += 20) {
      await Promise.all(attempts.slice(i, i + 20).map((a) => timed("POST /attempts/:attemptId/grade", () => owner.call("POST", `/attempts/${a.id}/grade`))));
    }
    const gradedIn = (Date.now() - gradingStarted) / 1000;
    await timed("GET /exams/:examId/results.xlsx", () => owner.call("GET", "/exams/load/results.xlsx"));

    const db = connect(appUrl, { max: 4 });
    const verified = await verifyAll(new LedgerStore(db), new IdentityStore(db));
    await db.end();

    const text = [
      report(`The sitting: ${afterSitting} requests in ${satFor.toFixed(0)}s (${rps.toFixed(0)} req/s on average)`, 0, afterSitting),
      report(`Grading ${attempts.length} attempts took ${gradedIn.toFixed(1)}s (${(attempts.length / gradedIn).toFixed(1)}/s, model ${modelMs} ms per call)`, afterSitting, samples.length),
      `\nverified ${verified.attempts} chains, ${verified.entries} entries: ${verified.failures.length === 0 ? "all intact" : `${verified.failures.length} FAILED`}`,
    ].join("\n");
    process.stdout.write(`${text}\n`);
    await writeFile(`load-${candidates}-${draftEverySec}s.txt`, `${new Date().toISOString()}\n${text}\n`);

    const errors = samples.filter((s) => s.status < 200 || s.status >= 300).length;
    process.exitCode = verified.failures.length === 0 && errors === 0 && attempts.length === candidates ? 0 : 1;
  } finally {
    await server.stop();
  }
}

await main();
