#!/usr/bin/env node
/**
 * ROADMAP §0: measure what an attempt costs.
 *
 * Sits N realistic attempts (50 by default) against a running Parikshaa with a
 * real model key, one after another, and reports the per-attempt spend as a
 * distribution — p10/p50/p90/p99/max and a histogram — with the split by route
 * (probe, assess, grade) and whether prompt caching is being read.
 *
 * It spends real API budget, so it is run deliberately by the account holder,
 * never by CI. Use an organisation that is doing nothing else while it runs:
 * spend is read from `GET /usage`, which is organisation-wide, and each
 * attempt's cost is the difference either side of it.
 *
 *   PARIKSHAA_URL=https://exam.example.org/api \
 *   PARIKSHAA_TOKEN=<staff API key or session: exam:write, attempt:start,
 *                    attempt:grade, attempt:assess, usage:read> \
 *   node scripts/cost-run.mjs [--attempts 50] [--seed 1] [--out cost-run]
 *
 * Writes <out>.json (every attempt, every number) and <out>.md (the report
 * pricing is built on). Candidates are drawn from fixed profiles by a seeded
 * generator, so two runs with the same seed sit the same attempts.
 */

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    attempts: { type: "string", default: "50" },
    seed: { type: "string", default: "1" },
    out: { type: "string", default: "cost-run" },
    exam: { type: "string", default: `cost-run-${new Date().toISOString().slice(0, 10)}` },
    "dry-run": { type: "boolean", default: false },
  },
});

const BASE = (process.env.PARIKSHAA_URL ?? "http://localhost:3000").replace(/\/$/, "");
const STAFF = process.env.PARIKSHAA_TOKEN;
const ATTEMPTS = Number.parseInt(args.attempts, 10);
if (!Number.isInteger(ATTEMPTS) || ATTEMPTS < 1) throw new Error("--attempts must be a positive integer");
if (!STAFF && !args["dry-run"]) {
  console.error("Set PARIKSHAA_TOKEN to a staff API key or session token. See the header of this file.");
  process.exit(2);
}

// --- the paper ----------------------------------------------------------------
//
// Shaped like a campus hiring screen: objective questions that are probed when
// answered right, and written answers the model grades by rubric. Code is
// rubric-graded here so the run does not need the sandbox runner; tested code
// costs the model nothing to grade, only to probe.

const Q = {
  mcqSort: "q-mcq-sort",
  mcqHash: "q-mcq-hash",
  numeric: "q-num-bsearch",
  shortIndex: "q-short-index",
  shortCap: "q-short-cap",
  code: "q-code-dedupe",
};

const exam = {
  id: args.exam,
  title: "Cost measurement — backend screen",
  policy: { durationMs: 60 * 60 * 1000, allowRevision: true, vivaTriggerRatio: 0.7 },
  questions: [
    {
      id: Q.mcqSort,
      kind: "mcq",
      stem: "Which of these sorts is stable in its usual implementation?",
      options: ["Quicksort", "Merge sort", "Heapsort", "Selection sort"],
      correctIndex: 1,
      maxScore: 2,
      rubric: [],
    },
    {
      id: Q.mcqHash,
      kind: "mcq",
      stem: "A hash table with separate chaining has load factor 3. What is the expected length of a successful search's chain walk, roughly?",
      options: ["1", "1 + 3/2", "3", "log 3"],
      correctIndex: 1,
      maxScore: 2,
      rubric: [],
    },
    {
      id: Q.numeric,
      kind: "numeric",
      stem: "At most how many comparisons does binary search need to find a key among 1,000,000 sorted items?",
      expected: 20,
      tolerance: 0,
      maxScore: 2,
      rubric: [],
    },
    {
      id: Q.shortIndex,
      kind: "short",
      stem: "A query `SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20` is slow on a 40-million-row table. What index would you add, and why that column order?",
      expectedPoints: [
        "A composite index on (customer_id, created_at)",
        "Equality column first, so the index narrows to one customer",
        "created_at second, so rows come out already ordered and the LIMIT stops early",
      ],
      maxScore: 6,
      rubric: [
        { id: "index", description: "Proposes a composite index on customer_id then created_at", weight: 3 },
        { id: "order", description: "Explains why the equality column leads", weight: 2 },
        { id: "sort", description: "Notes the index avoids a sort and lets LIMIT stop early", weight: 1 },
      ],
    },
    {
      id: Q.shortCap,
      kind: "short",
      stem: "Your service writes to a primary database in Mumbai and reads from a replica in Chennai. A user updates their address and immediately sees the old one. Explain what happened and two ways to fix it.",
      expectedPoints: [
        "Replication lag: the read hit the replica before the write arrived",
        "Read-your-writes: route the user's reads to the primary for a short window after a write",
        "Or carry a version/LSN and wait for the replica to catch up, or read from primary for that entity",
      ],
      maxScore: 6,
      rubric: [
        { id: "lag", description: "Identifies asynchronous replication lag as the cause", weight: 2 },
        { id: "fix1", description: "Gives a sound read-your-writes fix", weight: 2 },
        { id: "fix2", description: "Gives a second, different sound fix", weight: 2 },
      ],
    },
    {
      id: Q.code,
      kind: "code",
      language: "python",
      stem: "Write `dedupe(items)` that returns the items with duplicates removed, keeping the first occurrence of each and the original order. Items are hashable. Say its time complexity in a comment.",
      starter: "def dedupe(items):\n    pass\n",
      maxScore: 8,
      rubric: [
        { id: "correct", description: "Removes duplicates, keeping first occurrences in order", weight: 4 },
        { id: "linear", description: "Runs in linear time using a set, not a nested scan", weight: 3 },
        { id: "complexity", description: "States the complexity correctly", weight: 1 },
      ],
    },
  ],
};

// --- candidates -----------------------------------------------------------------
//
// Four kinds of candidate, in the proportions a screen sees. What matters to
// cost is how many answers are right (each is a probe, a reply and an
// assessment) and how long the written answers are (grading input).

const WRITTEN = {
  strong: {
    [Q.shortIndex]:
      "Add a composite index on (customer_id, created_at DESC). customer_id goes first because it is an equality predicate: the index seeks straight to that customer's entries. created_at second means those entries are already in the order the query wants, so Postgres walks the index backwards, reads 20 rows and stops — no sort of the customer's whole history, and the LIMIT actually saves work. The other order would be useless for the WHERE clause.",
    [Q.shortCap]:
      "The write went to Mumbai and the read hit the Chennai replica before replication caught up — asynchronous replication lag, so the user read stale data. Fix 1: read-your-writes by routing that user's reads to the primary for a few seconds after they write (a cookie or session flag). Fix 2: have the write return the primary's LSN and make the replica read wait until it has replayed at least that LSN, falling back to the primary on timeout.",
    [Q.code]:
      "def dedupe(items):\n    # O(n) time, O(n) extra space: one pass, set lookups are O(1) on average.\n    seen = set()\n    out = []\n    for item in items:\n        if item not in seen:\n            seen.add(item)\n            out.append(item)\n    return out\n",
  },
  average: {
    [Q.shortIndex]: "Index on customer_id and created_at together so the filter and the order by both use the index. Put customer_id first because we filter on it.",
    [Q.shortCap]: "Replication lag — the replica has not got the update yet. Fix: read from the primary after a write. Or use synchronous replication.",
    [Q.code]: "def dedupe(items):\n    out = []\n    for i in items:\n        if i not in out:\n            out.append(i)\n    return out\n# O(n)\n",
  },
  weak: {
    [Q.shortIndex]: "add index on created_at",
    [Q.shortCap]: "cache problem, clear the cache",
    [Q.code]: "def dedupe(items):\n    return list(set(items))\n",
  },
  hinglish: {
    [Q.shortIndex]:
      "(customer_id, created_at) pe composite index banana chahiye. customer_id pehle kyunki WHERE mein equality hai, usse ek customer ki rows mil jaati hain; created_at baad mein toh rows already sorted aati hain aur LIMIT 20 jaldi ruk jaata hai, sort nahi karna padta.",
    [Q.shortCap]:
      "Yeh replication lag hai — write Mumbai primary pe gaya, read Chennai replica se hua jahan update abhi pahuncha nahi tha. Fix: write ke baad kuch seconds us user ke reads primary se karo. Dusra: write ka LSN save karo aur replica pe tab tak wait karo jab tak woh LSN replay na ho jaaye.",
    [Q.code]:
      "def dedupe(items):\n    # O(n) - set mein check karna O(1) hai\n    seen = set()\n    result = []\n    for x in items:\n        if x not in seen:\n            seen.add(x)\n            result.append(x)\n    return result\n",
  },
};

const REPLIES = {
  strong: [
    "Because merge sort only moves an element past another when it is strictly smaller, so equal keys keep their relative order through every merge.",
    "Each successful search walks on average half the chain before finding the key, plus the first probe — so about 1 + α/2 with α = 3.",
    "Each comparison halves the range, and 2^20 is just over a million, so twenty halvings get down to one item.",
  ],
  average: [
    "Merge sort keeps equal elements in the same order when merging.",
    "Load factor divided by two plus one.",
    "log2 of a million is about 20.",
  ],
  weak: ["I remembered it from class.", "Guessed.", "log n"],
  hinglish: [
    "Merge karte waqt agar dono equal hain toh left wala pehle lete hain, isliye order same rehta hai.",
    "Average mein aadha chain dekhna padta hai, toh 1 + 3/2.",
    "Har step mein range aadhi hoti hai, 2^20 ≈ 10 lakh, toh 20.",
  ],
};

/** Mulberry32: small, seeded, good enough to pick profiles reproducibly. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = prng(Number.parseInt(args.seed, 10));
const pickProfile = () => {
  const r = random();
  return r < 0.25 ? "strong" : r < 0.65 ? "average" : r < 0.85 ? "weak" : "hinglish";
};

/** Objective answers: a strong candidate is usually right, a weak one usually not. */
function objectiveAnswers(profile) {
  const pRight = { strong: 0.9, average: 0.65, weak: 0.3, hinglish: 0.75 }[profile];
  const right = () => random() < pRight;
  return {
    [Q.mcqSort]: right() ? "1" : String([0, 2, 3][Math.floor(random() * 3)]),
    [Q.mcqHash]: right() ? "1" : String([0, 2, 3][Math.floor(random() * 3)]),
    [Q.numeric]: right() ? "20" : String([19, 21, 1000, 10][Math.floor(random() * 4)]),
  };
}

// --- the API ------------------------------------------------------------------

async function call(method, path, { token = STAFF, body, query } = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status}: ${text.slice(0, 300)}`);
  return text === "" ? {} : JSON.parse(text);
}

const usage = (since) => call("GET", "/usage", { query: { since } });

/** One candidate, start to finish: answer, take each probe as it comes, submit; then assess and grade. */
async function sit(index, profile) {
  const candidateId = `cost-run-${args.seed}-${String(index).padStart(3, "0")}`;
  const { attemptId, token } = await call("POST", `/exams/${exam.id}/attempts`, { body: { candidateId } });
  const asCandidate = { token };
  const answers = { ...objectiveAnswers(profile), ...WRITTEN[profile] };
  const probes = [];
  let replyIndex = 0;

  const takeProbe = async () => {
    const { probe } = await call("GET", "/attempts/me/probe", { ...asCandidate, query: { stream: "0" } });
    if (probe === null) return;
    const replies = REPLIES[profile];
    await call("POST", `/attempts/me/probes/${probe.id}/reply`, {
      ...asCandidate,
      body: { reply: replies[replyIndex++ % replies.length] },
    });
    probes.push(probe.id);
  };

  for (const question of exam.questions) {
    await call("POST", "/attempts/me/answers", { ...asCandidate, body: { questionId: question.id, answer: answers[question.id] } });
    // The candidate page asks after every save; most asks find nothing due.
    await takeProbe();
  }
  await call("POST", "/attempts/me/submit", asCandidate);
  // Readings before the grade: grading closes the attempt's record.
  const verdicts = [];
  for (const probeId of probes) verdicts.push((await call("POST", `/attempts/${attemptId}/assess/${probeId}`)).verdict);
  const { total } = await call("POST", `/attempts/${attemptId}/grade`);
  return { attemptId, candidateId, profile, total, probes: probes.length, verdicts };
}

// --- the report ---------------------------------------------------------------

const quantile = (sorted, q) => {
  if (sorted.length === 0) return null;
  const at = (sorted.length - 1) * q;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo));
};

const usd = (micro) => (micro === null ? "—" : `$${(micro / 1e6).toFixed(4)}`);
const inr = (micro, rate) => (micro === null ? "—" : `₹${((micro / 1e6) * rate).toFixed(2)}`);

function histogram(values, buckets = 10) {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = Math.max(1, Math.ceil((max - min + 1) / buckets));
  const rows = Array.from({ length: buckets }, (_, i) => ({ from: min + i * width, to: min + (i + 1) * width, n: 0 }));
  for (const v of values) rows[Math.min(buckets - 1, Math.floor((v - min) / width))].n += 1;
  return rows.filter((r) => r.from <= max);
}

function report(run) {
  const rate = run.usdInr;
  const costs = run.attempts.map((a) => a.costMicroUsd).sort((a, b) => a - b);
  const q = (p) => quantile(costs, p);
  const groups = new Map();
  for (const a of run.attempts) groups.set(a.profile, [...(groups.get(a.profile) ?? []), a]);
  const byProfile = [...groups].map(([profile, list]) => {
    const sorted = list.map((a) => a.costMicroUsd).sort((a, b) => a - b);
    return `| ${profile} | ${list.length} | ${usd(quantile(sorted, 0.5))} | ${usd(sorted.at(-1))} | ${(list.reduce((s, a) => s + a.probes, 0) / list.length).toFixed(1)} |`;
  });
  const routes = run.usage.routes.map(
    (r) =>
      `| ${r.route} | ${r.calls} | ${r.inputTokens} | ${r.outputTokens} | ${r.cacheReadTokens} | ${r.cacheWrite5mTokens + r.cacheWrite1hTokens} | ${usd(r.costMicroUsd)} |`,
  );
  const cacheRead = run.usage.routes.reduce((s, r) => s + r.cacheReadTokens, 0);
  const bars = histogram(costs).map((b) => `| ${usd(b.from)}–${usd(b.to)} | ${"█".repeat(b.n)} ${b.n} |`);

  return `# Cost per attempt — measured

Run ${run.startedAt} → ${run.finishedAt} against ${run.base}, exam \`${run.exam}\`, seed ${run.seed}.
${run.attempts.length} attempts, one at a time. Rupee figures at ₹${rate}/US$ (set USD_INR to change).

## Per attempt

| | USD | INR |
|---|---|---|
| p10 | ${usd(q(0.1))} | ${inr(q(0.1), rate)} |
| **p50** | **${usd(q(0.5))}** | **${inr(q(0.5), rate)}** |
| p90 | ${usd(q(0.9))} | ${inr(q(0.9), rate)} |
| p99 | ${usd(q(0.99))} | ${inr(q(0.99), rate)} |
| max | ${usd(costs.at(-1) ?? null)} | ${inr(costs.at(-1) ?? null, rate)} |
| mean | ${usd(Math.round(costs.reduce((s, c) => s + c, 0) / Math.max(1, costs.length)))} | ${inr(Math.round(costs.reduce((s, c) => s + c, 0) / Math.max(1, costs.length)), rate)} |

The server's own reading for the same window: p50 ${usd(run.usage.perAttempt.p50MicroUsd)}, p90 ${usd(run.usage.perAttempt.p90MicroUsd)}, max ${usd(run.usage.perAttempt.maxMicroUsd)} over ${run.usage.perAttempt.attempts} attempts.

## Distribution

| Cost | Attempts |
|---|---|
${bars.join("\n")}

## By candidate

| Profile | Attempts | p50 | max | Probes per attempt |
|---|---|---|---|---|
${byProfile.join("\n")}

## By route

| Route | Calls | Input | Output | Cache read | Cache write | Cost |
|---|---|---|---|---|---|---|
${routes.join("\n")}

Prompt caching: ${cacheRead > 0 ? `read ${cacheRead} tokens — working.` : "**no cache reads at all** — check the cache breakpoints before pricing on this."}
Inference regions: ${run.usage.inferenceGeos.map((g) => `${g.geo ?? "unreported"} (${g.calls})`).join(", ") || "—"}.

## What this does not measure

- Code answers scored by tests (the sandbox runs them; the model only probes them).
- Batch-API grading, which ROADMAP §0 lists as the first lever: every grade here is a live call.
- A cohort sitting together, where the 1-hour cache is shared across candidates; here attempts run back to back, which is close to that for one exam.
`;
}

// --- run ----------------------------------------------------------------------

async function main() {
  if (args["dry-run"]) {
    // Drawn exactly as a real run draws them, so this is the mix it will sit.
    const candidates = Array.from({ length: ATTEMPTS }, () => {
      const profile = pickProfile();
      return { profile, objective: objectiveAnswers(profile) };
    });
    console.log(JSON.stringify({ exam, candidates }, null, 2));
    return;
  }

  const startedAt = new Date().toISOString();
  // A second's margin: /usage's `since` is inclusive of the first call.
  const since = new Date(Date.now() - 1000).toISOString();
  await call("POST", "/exams", { body: exam });
  console.error(`Exam ${exam.id} created. Sitting ${ATTEMPTS} attempts against ${BASE}…`);

  const attempts = [];
  let before = (await usage(since)).totalCostMicroUsd;
  for (let i = 1; i <= ATTEMPTS; i += 1) {
    const profile = pickProfile();
    const sat = await sit(i, profile);
    const after = (await usage(since)).totalCostMicroUsd;
    attempts.push({ ...sat, costMicroUsd: after - before });
    console.error(`${String(i).padStart(3)} ${profile.padEnd(8)} probes=${sat.probes} cost=${usd(after - before)}`);
    before = after;
  }

  const run = {
    base: BASE,
    exam: exam.id,
    seed: args.seed,
    startedAt,
    finishedAt: new Date().toISOString(),
    usdInr: Number(process.env.USD_INR ?? 84),
    usage: await usage(since),
    attempts,
  };
  writeFileSync(`${args.out}.json`, `${JSON.stringify(run, null, 2)}\n`);
  writeFileSync(`${args.out}.md`, report(run));
  console.error(`Wrote ${args.out}.json and ${args.out}.md`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

