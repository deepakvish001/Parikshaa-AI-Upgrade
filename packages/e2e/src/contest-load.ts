import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { digest, hashPassword } from "@parikshaa/api";
import { orgId } from "@parikshaa/core";
import { connect, PracticeStore } from "@parikshaa/store";
import { ORG, OWNER_EMAIL, OWNER_PASSWORD, ownerUrl, resetDatabase } from "./database.js";
import { Api, startServer } from "./harness.js";

/**
 * Load (Prep blueprint F11, §20): a weekly contest that thousands enter at once.
 *
 * Every learner opens the contest within the first few seconds of its start,
 * then works through its problems: reads one, runs it on the examples, submits
 * — sometimes wrong first — and checks the scoreboard now and then. Alongside,
 * a smaller crowd practises as on any evening. The judge is a simulated runner
 * that takes `runnerMs` a program, as many at once as `concurrency` (the
 * judge's queue, as in production); a running contest's programs go first.
 * When the contest ends, it is rated and its top ten paid, once. Reports
 * latency per route and every error, and checks the database at the end.
 *
 *   npm run contest-load -w @parikshaa/e2e -- [learners=2000] [minutes=3] [runnerMs=400] [concurrency=32] [practisers=200]
 *
 * One machine plays everyone and runs the server and the database, so the
 * numbers are a floor for what a real deployment does, not a ceiling.
 */

const learners = Number.parseInt(process.argv[2] ?? "2000", 10);
const minutes = Number.parseFloat(process.argv[3] ?? "3");
const runnerMs = Number.parseInt(process.argv[4] ?? "400", 10);
const concurrency = Number.parseInt(process.argv[5] ?? "32", 10);
const practisers = Number.parseInt(process.argv[6] ?? "200", 10);
const PORT = 4210;
const SITE = "contest-load";

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms: number) => ms * (0.5 + Math.random());

interface Sample {
  readonly route: string;
  readonly ms: number;
  readonly status: number;
}
const samples: Sample[] = [];

async function timed<T>(route: string, request: () => Promise<Response>): Promise<{ status: number; body: T | null }> {
  const started = performance.now();
  try {
    const res = await request();
    const body = res.ok ? ((await res.json()) as T) : (await res.arrayBuffer(), null);
    samples.push({ route, ms: performance.now() - started, status: res.status });
    return { status: res.status, body };
  } catch {
    samples.push({ route, ms: performance.now() - started, status: 0 });
    return { status: 0, body: null };
  }
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;
}

function report(title: string, from: number, to: number): string {
  const byRoute = new Map<string, Sample[]>();
  for (const s of samples.slice(from, to)) byRoute.set(s.route, [...(byRoute.get(s.route) ?? []), s]);
  const lines = [`\n${title}`, "route".padEnd(46) + "count".padStart(7) + "errors".padStart(8) + "p50".padStart(8) + "p95".padStart(8) + "p99".padStart(8) + "max".padStart(8)];
  for (const [route, list] of [...byRoute].sort((a, b) => b[1].length - a[1].length)) {
    const ms = list.map((s) => s.ms).sort((a, b) => a - b);
    const errors = list.filter((s) => s.status < 200 || s.status >= 300);
    const kinds = [...new Set(errors.map((e) => e.status))].map((st) => `${st}×${errors.filter((e) => e.status === st).length}`).join(" ");
    lines.push(
      route.padEnd(46) +
        String(list.length).padStart(7) +
        String(errors.length).padStart(8) +
        [50, 95, 99, 100].map((p) => `${Math.round(percentile(ms, p))}`.padStart(8)).join("") +
        (kinds === "" ? "" : `   ${kinds}`),
    );
  }
  return lines.join("\n");
}

const SUM = (title: string) => ({
  question: {
    kind: "code",
    stem: `${title}\n\nRead two integers and print their sum.`,
    maxScore: 10,
    rubric: [],
    language: "python",
    languages: ["python"],
    tests: [
      { id: "sample", input: "2 3\n", expected: "5\n", hidden: false, weight: 1 },
      { id: "hidden-1", input: "4 5\n", expected: "9\n", hidden: true, weight: 1 },
      { id: "hidden-2", input: "10 20\n", expected: "30\n", hidden: true, weight: 1 },
    ],
  },
  difficulty: "medium",
});

/** Learners straight into the database, each with a session: the sign-up page holds one address to a few a minute, rightly. */
async function seedLearners(count: number, prefix: string): Promise<string[]> {
  const sql = connect(ownerUrl, { max: 8 });
  const store = new PracticeStore(sql);
  const passwordHash = await hashPassword("a long enough password");
  const tokens: string[] = [];
  try {
    for (let i = 0; i < count; i += 50) {
      const batch = await Promise.all(
        Array.from({ length: Math.min(50, count - i) }, async (_, j) => {
          const n = i + j + 1;
          const learner = await store.createLearner({ orgId: orgId(ORG), email: `${prefix}${n}@college.test`, name: `${prefix} ${n}`, passwordHash, verified: true });
          const token = `pl_${randomBytes(32).toString("base64url")}`;
          await store.createSession(learner.id, digest(token), new Date(Date.now() + 86_400_000));
          return token;
        }),
      );
      tokens.push(...batch);
    }
  } finally {
    await sql.end();
  }
  return tokens;
}

async function compete(base: string, token: string, contest: string, slugs: readonly string[], endsAt: number): Promise<void> {
  const me = new Api(base, token);
  const S = `/practice/${SITE}`;
  await timed("GET contest", () => me.call("GET", `${S}/contests/${contest}`));
  let nextBoard = Date.now() + jitter(20_000);
  for (const slug of slugs) {
    if (Date.now() >= endsAt - 2_000) return;
    await timed("GET contest problem", () => me.call("GET", `${S}/problems/${slug}?contest=${contest}`));
    await pause(jitter(10_000));
    if (Date.now() >= endsAt - 1_000) return;
    await timed("POST run (contest)", () => me.call("POST", `${S}/problems/${slug}/run`, { language: "python", source: "a, b = map(int, input().split())\nprint(a + b)\n", contest }));
    // A third get it wrong first.
    const tries = Math.random() < 1 / 3 ? ["# WRONG\nprint(0)\n", "a, b = map(int, input().split())\nprint(a + b)\n"] : ["a, b = map(int, input().split())\nprint(a + b)\n"];
    for (const source of tries) {
      await pause(jitter(8_000));
      // Not a moment after the end: that would be practice, not the contest.
      if (Date.now() >= endsAt - 500) return;
      await timed("POST submit (contest)", () => me.call("POST", `${S}/problems/${slug}/submit`, { answer: source, language: "python", contest }));
    }
    if (Date.now() >= nextBoard) {
      await timed("GET contest (scoreboard)", () => me.call("GET", `${S}/contests/${contest}`));
      nextBoard = Date.now() + jitter(20_000);
    }
  }
}

async function practise(base: string, token: string, slug: string, endsAt: number): Promise<void> {
  const me = new Api(base, token);
  const S = `/practice/${SITE}`;
  while (Date.now() < endsAt - 5_000) {
    await pause(jitter(15_000));
    await timed("POST submit (practice)", () => me.call("POST", `${S}/problems/${slug}/submit`, { answer: "a, b = map(int, input().split())\nprint(a + b)\n", language: "python" }));
  }
}

async function main() {
  process.stdout.write(`contest load: ${learners} learners in a ${minutes}-minute contest, ${practisers} practising, judge ${concurrency} at once at ~${runnerMs} ms a program\n`);
  await resetDatabase(hashPassword);
  const server = await startServer({
    port: PORT,
    reset: false,
    env: {
      E2E_RUNNER: "simulated",
      E2E_RUNNER_MS: String(runnerMs),
      JUDGE_CONCURRENCY: String(concurrency),
      JUDGE_QUEUE_MAX: String(learners * 2),
      JUDGE_WAIT_MS: "120000",
      RATE_LIMITS: "on",
      DATABASE_POOL_MAX: process.env["DATABASE_POOL_MAX"] ?? "20",
    },
  });
  try {
    const anonymous = new Api(server.base);
    const { token } = await anonymous.json<{ token: string }>("POST", "/auth/login", { email: OWNER_EMAIL, password: OWNER_PASSWORD });
    const owner = anonymous.as(token);
    await owner.json("PUT", "/practice-admin/site", { slug: SITE, title: "Contest load", welcome: "", open: true });
    const slugs: string[] = [];
    const ids: string[] = [];
    for (const title of ["Pair sum", "Range total", "Two counters"]) {
      const q = await owner.json<{ id: string }>("POST", "/bank", SUM(title));
      const p = await owner.json<{ id: string; slug: string }>("POST", "/practice-admin/problems", { bankQuestionId: q.id, published: false });
      slugs.push(p.slug);
      ids.push(p.id);
    }
    const practiceQ = await owner.json<{ id: string }>("POST", "/bank", SUM("Warm up"));
    const practiceProblem = await owner.json<{ slug: string }>("POST", "/practice-admin/problems", { bankQuestionId: practiceQ.id });

    const seeded = Date.now();
    const contestants = await seedLearners(learners, "Contestant");
    const others = await seedLearners(practisers, "Practiser");
    process.stdout.write(`seeded ${learners + practisers} learners in ${((Date.now() - seeded) / 1000).toFixed(1)}s\n`);

    const startsAt = Date.now() + 5_000;
    const endsAt = startsAt + minutes * 60_000;
    const contest = await owner.json<{ slug: string }>("POST", "/practice-admin/contests", {
      title: "Weekly load",
      description: "",
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      problemIds: ids,
    });

    // Judge stats through the contest, every five seconds.
    const peaks = { waiting: 0, running: 0 };
    let watching = true;
    const watch = (async () => {
      while (watching) {
        const j = (await owner.json<{ judge: { running: number; waiting: { contest: number; practice: number } } | null }>("GET", "/practice-admin/judge")).judge;
        if (j !== null) {
          peaks.waiting = Math.max(peaks.waiting, j.waiting.contest + j.waiting.practice);
          peaks.running = Math.max(peaks.running, j.running);
        }
        await pause(5_000);
      }
    })();

    await pause(startsAt - Date.now());
    const started = Date.now();
    await Promise.all([
      ...contestants.map(async (t) => {
        await pause(Math.random() * 5_000);
        await compete(server.base, t, contest.slug, slugs, endsAt);
      }),
      ...others.map((t) => practise(server.base, t, practiceProblem.slug, endsAt)),
    ]);
    const ranFor = (Date.now() - started) / 1000;
    const duringContest = samples.length;
    watching = false;
    await watch;

    // It ends; the first to look at the ratings has it rated and the top ten paid.
    await pause(Math.max(0, endsAt - Date.now()) + 1_000);
    await timed("GET rating (rates the contest)", () => new Api(server.base, contestants[0]!).call("GET", `/practice/${SITE}/rating`));
    await Promise.all(contestants.slice(1, 200).map((t) => timed("GET rating", () => new Api(server.base, t).call("GET", `/practice/${SITE}/rating`))));
    const judge = (await owner.json<{ judge: unknown }>("GET", "/practice-admin/judge")).judge;

    const sql = connect(ownerUrl, { max: 2 });
    const [counts] = await sql.query<{ submissions: string; contest: string; rated: string; paid: string }>(
      `SELECT (SELECT count(*) FROM practice_submissions WHERE org_id = $1) AS submissions,
              (SELECT count(*) FROM practice_submissions WHERE org_id = $1 AND contest_id IS NOT NULL) AS contest,
              (SELECT count(*) FROM prep_ratings WHERE org_id = $1) AS rated,
              (SELECT count(*) FROM prep_coins WHERE org_id = $1 AND rule = 'contest_rank') AS paid`,
      [ORG],
    );
    await sql.end();
    const accepted = samples.filter((s) => s.route.startsWith("POST submit") && s.status === 200).length;
    const contestAnswered = samples.filter((s) => s.route === "POST submit (contest)" && s.status === 200).length;

    const text = [
      report(`The contest: ${duringContest} requests in ${ranFor.toFixed(0)}s (${(duringContest / ranFor).toFixed(0)} req/s on average)`, 0, duringContest),
      report("After it ended", duringContest, samples.length),
      `\njudge: ${concurrency} at once; at the busiest ${peaks.running} running and ${peaks.waiting} waiting; at the end ${JSON.stringify(judge)}`,
      `database: ${counts!.submissions} submissions recorded (${accepted} answered 200), ${counts!.contest} on the contest` +
        ` (${contestAnswered - Number(counts!.contest)} sent in its last half second reached the server after the end, and count as practice);` +
        ` ${counts!.rated} ratings; ${counts!.paid} paid for rank`,
    ].join("\n");
    process.stdout.write(`${text}\n`);
    await writeFile(`contest-${learners}-judge${concurrency}.txt`, `${new Date().toISOString()}\n${text}\n`);

    const errors = samples.filter((s) => s.status < 200 || s.status >= 300).length;
    // Every answer recorded, and prizes to ten, no more.
    process.exitCode = errors === 0 && Number(counts!.submissions) === accepted && Number(counts!.paid) === Math.min(10, learners) ? 0 : 1;
  } finally {
    await server.stop();
  }
}

await main();
