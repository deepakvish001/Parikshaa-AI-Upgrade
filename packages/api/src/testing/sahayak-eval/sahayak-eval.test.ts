import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execute, type CodeRunner } from "@parikshaa/runner";
import { EvalApp } from "./app.js";
import { casesOf, pilotOf, PROBLEMS, type EvalCase } from "./cases.js";
import { flowOf, loadCases } from "./eval.js";
import { codeWithinRung, devanagariShare, gradeOf, judge, JudgeError, rightScript, writesProgram, type JudgeResult } from "./grade.js";
import { buildTests, checkBugs } from "./validate.js";

/**
 * The Sahayak eval's own tests. The model is a stand-in throughout: these
 * check that the cases are what the eval says they are, that a case reaches
 * the tutor as a learner's request would, and that the grading reads what it
 * should. Paid runs are `run-eval.mjs`'s, never the test suite's.
 */

describe("the cases", () => {
  it("are 40 problems, each with one wrong program of each kind and one doubt of each kind", () => {
    expect(PROBLEMS).toHaveLength(40);
    expect(new Set(PROBLEMS.map((p) => p.slug)).size).toBe(40);
    for (const p of PROBLEMS) {
      expect(p.bugs.map((b) => b.kind), p.slug).toEqual(["off_by_one", "overflow", "tle"]);
      expect(p.doubts.map((d) => d.kind), p.slug).toEqual(["push", "concept", "stuck"]);
      expect(p.examples.length, p.slug).toBeGreaterThan(0);
      for (const b of p.bugs) expect(b.mistake.length, `${p.slug} ${b.kind}`).toBeGreaterThan(20);
    }
  });

  it("make 120 of each flow, with the rungs split evenly and a fifth of the problems in Hindi", () => {
    for (const flow of ["hint", "review", "doubt"] as const) {
      const cases = casesOf(flow);
      expect(cases).toHaveLength(120);
      expect(new Set(cases.map((c) => c.id)).size).toBe(120);
    }
    const rungs = casesOf("hint").map((c) => (c.flow === "hint" ? c.rung : 0));
    expect([1, 2, 3].map((r) => rungs.filter((x) => x === r).length)).toEqual([40, 40, 40]);
    expect(PROBLEMS.filter((p) => p.hindi)).toHaveLength(8);
    expect(casesOf("doubt").filter((c) => c.replyIn === "hi")).toHaveLength(24);
  });

  it("have a pilot of eight a flow, over several rungs, kinds and both languages", () => {
    for (const flow of ["hint", "review", "doubt"] as const) {
      const pilot = pilotOf(flow);
      expect(pilot).toHaveLength(8);
      expect(new Set(pilot.map((c) => c.replyIn))).toEqual(new Set(["en", "hi"]));
    }
    expect(new Set(pilotOf("hint").map((c) => (c.flow === "hint" ? c.rung : 0)))).toEqual(new Set([1, 2, 3]));
    expect(new Set(pilotOf("doubt").map((c) => (c.flow === "doubt" ? c.doubt.kind : "")))).toEqual(new Set(["push", "concept", "stuck"]));
  });

  it("are chosen by the flow directory's name, and by SAHAYAK_EVAL_CASES", () => {
    expect(flowOf(".claude/hillclimb/sahayak-review/")).toBe("review");
    expect(() => flowOf(".claude/hillclimb/tutor")).toThrow(/sahayak-hint/);
    expect(loadCases(".claude/hillclimb/sahayak-hint", "pilot")).toHaveLength(8);
    const two = loadCases(".claude/hillclimb/sahayak-doubt", "house-robber.push,rope-joining.stuck");
    expect(two.map((i) => i.id)).toEqual(["house-robber.push", "rope-joining.stuck"]);
    expect(two[0]!.tags).toEqual(["push", "Hindi"]);
    expect(() => loadCases(".claude/hillclimb/sahayak-doubt", "no-such.case")).toThrow(/does not have/);
  });
});

/**
 * Every wrong program fails the way its case says: that is what makes a
 * review's "found the bug" gradable. Checking all 40 problems takes minutes
 * (each slow program waits out its time limit), so by default three are
 * checked, one per language a mistake is written in; SAHAYAK_EVAL_VALIDATE=all
 * checks every one.
 */
describe("the problems, on the real runner", () => {
  let runner: CodeRunner;
  beforeAll(async () => {
    const workRoot = await mkdtemp(join(tmpdir(), "sahayak-validate-"));
    runner = { run: (request) => execute(request, { workRoot, slot: null }) };
  });
  const chosen = process.env.SAHAYAK_EVAL_VALIDATE === "all" ? PROBLEMS : PROBLEMS.filter((p) => ["range-sum-queries", "pairs-with-target-sum", "widest-container"].includes(p.slug));
  for (const p of chosen) {
    it(`${p.slug}: each wrong program is wrong as described, and the others agree with the reference where they should`, async () => {
      const tests = await buildTests(p, runner);
      const checks = await checkBugs(p, tests, runner);
      expect(checks.map((c) => `${c.kind}: ${c.ok ? "ok" : `BAD, ${c.why}`}`)).toEqual(["off_by_one: ok", "overflow: ok", "tle: ok"]);
    }, 120_000);
  }
});

// --- the app, with a stand-in model ----------------------------------------------

const model = {
  requests: [] as { system: string; user: string; model: string; maxTokens: number }[],
  fail: null as unknown,
};
const client = {
  messages: {
    async create(params: { model: string; max_tokens: number; system: { text: string }[]; messages: { content: string }[] }) {
      // Answers slowly, so cases run side by side overlap.
      await new Promise((r) => setTimeout(r, 20));
      model.requests.push({ system: params.system.map((b) => b.text).join("\n"), user: params.messages[0]!.content, model: params.model, maxTokens: params.max_tokens });
      if (model.fail !== null) throw model.fail;
      return {
        id: "msg",
        type: "message",
        role: "assistant",
        model: params.model,
        content: [{ type: "text", text: `Answer to: ${params.messages[0]!.content.slice(0, 40)}` }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      };
    },
  },
} as unknown as Anthropic;

/** Every program passes; the reference's output is "1". Enough to have submissions and tests. */
const runner: CodeRunner = {
  run: async (request) => ({ compiled: true, tests: request.tests.map((t) => ({ id: t.id, status: "passed", timeMs: 5, memoryKb: 1000, stdout: "1\n", stderr: "" })) }),
};

describe("a case, run through the real server", () => {
  const pick = <T extends EvalCase>(list: EvalCase[], f: (c: EvalCase) => c is T) => list.find(f)!;
  const hint = pick(casesOf("hint"), (c): c is Extract<EvalCase, { flow: "hint" }> => c.flow === "hint" && c.rung === 3 && c.problem.slug === "range-sum-queries");
  const review = pick(casesOf("review"), (c): c is Extract<EvalCase, { flow: "review" }> => c.flow === "review" && c.problem.slug === "pairs-with-target-sum" && c.bug.kind === "overflow");
  const doubt = pick(casesOf("doubt"), (c): c is Extract<EvalCase, { flow: "doubt" }> => c.flow === "doubt" && c.problem.slug === "range-sum-queries" && c.doubt.kind === "push");
  let app: EvalApp;

  beforeAll(async () => {
    app = await EvalApp.open(client, runner, [hint, review, doubt]);
  }, 60_000);
  afterAll(async () => {
    await app.close();
  });

  it("asks for the case's rung with the learner's program, reviews the submission, and answers the doubt, each as its own learner", async () => {
    model.requests = [];
    // Side by side, as the runner runs them: each case must get its own call back.
    const [h, r, d] = await Promise.all([app.ask(hint), app.ask(review), app.ask(doubt)]);
    expect(model.requests).toHaveLength(3);

    expect(h.exchange.user).toContain("Give rung 3 of the hint ladder");
    expect(h.exchange.user).toContain(hint.bug.source.trim().split("\n")[0]);
    expect(h.exchange.system).toContain("tutor only");
    expect(h.exchange.params.max_tokens).toBe(1200);
    expect(h.answer).toBe(`Answer to: ${h.exchange.user.slice(0, 40)}`);

    expect(r.verdict).toEqual({ status: "passed", passed: expect.any(Number), total: expect.any(Number) });
    expect(r.exchange.user).toContain("Review this submission. Answer in Hindi");
    expect(r.exchange.user).toContain('<learner_code language="java">');

    expect(d.exchange.user).toContain(`<learner_question>\n${doubt.doubt.text}`);
    expect(d.exchange.response?.usage.input_tokens).toBe(1000);
    // No case sees another's history: a second rung-3 case climbs from rung 2 again.
    expect((await app.ask(hint)).exchange.user).toContain("Give rung 3");
  });

  it("hands a model error on as it came, so a rate limit is retried as one", async () => {
    const limited = Object.assign(new Error("rate limited"), { status: 429 });
    model.fail = limited;
    try {
      await expect(app.ask(doubt)).rejects.toBe(limited);
    } finally {
      model.fail = null;
    }
  });
});

// --- grading ---------------------------------------------------------------------

describe("what a script checks", () => {
  const fenced = (tag: string, body: string) => `Here:\n\n\`\`\`${tag}\n${body}\n\`\`\`\n`;

  it("allows no code block at rungs 1 and 2, and only pseudo-code at rung 3", () => {
    expect(codeWithinRung("Think about prefix sums; `pre[i]` is enough.", 1).ok).toBe(true);
    expect(codeWithinRung(fenced("", "for each i\n  add a[i]"), 2).ok).toBe(false);
    expect(codeWithinRung(fenced("", "for each query (l, r):\n  answer = pre[r] - pre[l - 1]"), 3).ok).toBe(true);
    expect(codeWithinRung(fenced("text", "set total to 0\nfor i from 1 to n\n  total ← total + a[i]"), 3).ok).toBe(true);
    expect(codeWithinRung(fenced("python", "total = 0\nfor x in a:\n    total += x"), 3).ok).toBe(false);
    expect(codeWithinRung(fenced("", "#include <bits/stdc++.h>\nint main() {\n  long long s = 0;\n}"), 3).ok).toBe(false);
  });

  it("allows a line pointed at in a review, not a program", () => {
    expect(writesProgram(fenced("cpp", "long long total = 0;")).ok).toBe(true);
    const program = "import sys\ndef main():\n    n = int(input())\n    print(n)\nmain()";
    expect(writesProgram(fenced("python", program))).toEqual({ ok: false, why: "5 lines of real code" });
    expect(writesProgram("No code at all.").ok).toBe(true);
  });

  it("wants Devanagari for Hindi, with English terms allowed, and none for English", () => {
    const hindi = "आपका loop आख़िरी element तक नहीं जाता। `range(n - 1)` को देखिए, prefix sum सही है।";
    expect(devanagariShare(hindi)).toBeGreaterThan(0.5);
    expect(rightScript(hindi, "hi").ok).toBe(true);
    expect(rightScript(hindi, "en").ok).toBe(false);
    expect(rightScript("Your loop stops one short of the end.", "hi").ok).toBe(false);
    expect(rightScript("Your loop stops one short of the end.", "en").ok).toBe(true);
    // Code does not count either way.
    expect(rightScript(`आपका loop ठीक है।\n\n\`\`\`python\nfor i in range(n): pass\n\`\`\``, "hi").ok).toBe(true);
  });
});

describe("the judge, and the grade", () => {
  const hint1 = casesOf("hint").find((c) => c.flow === "hint" && c.rung === 1)!;
  const review = casesOf("review")[0]!;
  const reply = (text: string) =>
    ({
      messages: {
        create: async (params: { output_config: { format: { schema: { required: string[] } } }; model: string; messages: { content: string }[] }) => {
          model.requests.push({ system: "", user: params.messages[0]!.content, model: params.model, maxTokens: 0 });
          return { model: params.model, content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 3000, output_tokens: 200 } };
        },
      },
    }) as unknown as Anthropic;
  const verdicts = (v: Record<string, "pass" | "fail">) => JSON.stringify(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, { reasoning: `because ${k}`, verdict: x }])));

  it("is shown the hidden mistake for a review, and grades by the flow's criteria", async () => {
    model.requests = [];
    const j = await judge(reply(verdicts({ bug_found: "pass", complexity_right: "fail", no_fixed_program: "pass" })), review, "The loop misses the last element.");
    expect(model.requests[0]!.model).toBe("claude-sonnet-5-5");
    expect(model.requests[0]!.user).toContain(review.flow === "review" ? review.bug.mistake : "");
    expect(model.requests[0]!.user).toContain("<tutor_answer>\nThe loop misses the last element.");
    expect(gradeOf(review, "The loop misses the last element.", j).grade).toEqual({ bug_found: 1, complexity_right: 0, no_fixed_program: 1, language: 1 });
  });

  it("fails a hint that shows code at rung 1, whatever the judge says", async () => {
    const answer = "Try this:\n\n```python\nfor i in range(n):\n    total += a[i]\n```";
    const j: JudgeResult = { verdicts: { within_rung: { pass: true, reasoning: "ok" }, helpful: { pass: true, reasoning: "ok" } }, model: "m", usage: {} as Anthropic.Usage };
    expect(gradeOf(hint1, answer, j).grade).toMatchObject({ leak_free: 0, within_rung: 1, no_code: 0 });
  });

  it("reports a judge that answers out of shape, with what it cost", async () => {
    const error = await judge(reply("not json"), hint1, "x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(JudgeError);
    expect((error as JudgeError).judge_usage?.input_tokens).toBe(3000);
    await expect(judge(reply(verdicts({ within_rung: "pass" })), hint1, "x")).rejects.toThrow(/no verdict for helpful/);
  });
});
