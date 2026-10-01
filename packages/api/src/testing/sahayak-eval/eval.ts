import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { execute, type CodeRunner } from "@parikshaa/runner";
import { EvalApp, type Answered } from "./app.js";
import { casesOf, pilotOf, type EvalCase, type Flow } from "./cases.js";
import { gradeOf, judge, JUDGE_MODEL } from "./grade.js";

/**
 * The glue `run-eval.mjs` calls: which cases a flow has, how one is run, and
 * how it is graded. The flow is the flow directory's name:
 * `.claude/hillclimb/sahayak-hint` runs the hint cases.
 *
 * SAHAYAK_EVAL_CASES=pilot runs the pilot's eight cases a flow; a
 * comma-separated list of case ids runs those.
 */

export interface Item {
  readonly id: string;
  readonly prompt: string;
  readonly tags: readonly string[];
  readonly meta: Readonly<Record<string, unknown>>;
  readonly c: EvalCase;
}

export function flowOf(flowDir: string): Flow {
  const name = basename(flowDir.replace(/\/+$/, ""));
  const flow = name.replace(/^sahayak-/, "");
  if (flow !== "hint" && flow !== "review" && flow !== "doubt") throw new Error(`the flow directory is named sahayak-hint, sahayak-review or sahayak-doubt, not ${name}`);
  return flow;
}

const KIND = { off_by_one: "off by one", overflow: "overflow", tle: "too slow" } as const;

export function itemOf(c: EvalCase): Item {
  const lang = c.replyIn === "hi" ? "Hindi" : "English";
  if (c.flow === "hint") {
    return {
      id: c.id,
      prompt: `Rung ${c.rung} hint on "${c.problem.title}", with the learner's ${c.bug.language} program (${KIND[c.bug.kind]}), in ${lang}`,
      tags: [`rung ${c.rung}`, lang, c.bug.language, KIND[c.bug.kind]],
      meta: { problem: c.problem.slug, rung: c.rung, bug: c.bug.kind },
      c,
    };
  }
  if (c.flow === "review") {
    return {
      id: c.id,
      prompt: `Review of the learner's ${c.bug.language} program for "${c.problem.title}" (${KIND[c.bug.kind]}), in ${lang}`,
      tags: [KIND[c.bug.kind], lang, c.bug.language],
      meta: { problem: c.problem.slug, bug: c.bug.kind, mistake: c.bug.mistake, time: c.bug.time },
      c,
    };
  }
  return { id: c.id, prompt: c.doubt.text, tags: [c.doubt.kind, lang], meta: { problem: c.problem.slug, doubt: c.doubt.kind }, c };
}

export function loadCases(flowDir: string, which = process.env.SAHAYAK_EVAL_CASES ?? ""): Item[] {
  const flow = flowOf(flowDir);
  let cases = which === "pilot" ? pilotOf(flow) : casesOf(flow);
  if (which !== "" && which !== "pilot") {
    const ids = new Set(which.split(",").map((s) => s.trim()));
    cases = cases.filter((c) => ids.has(c.id));
    if (cases.length !== ids.size) throw new Error(`SAHAYAK_EVAL_CASES names ids this flow does not have`);
  }
  return cases.map(itemOf);
}

// --- running --------------------------------------------------------------------

let client: Anthropic | null = null;
/** The API itself, never a proxy the environment happens to set: the eval is billed to the key it is given. */
export function clientOf(): Anthropic {
  if (client !== null) return client;
  if (process.env.SAHAYAK_EVAL_DRY === "1") return (client = dryClient());
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY: the eval calls the model for real.");
  client = new Anthropic({ baseURL: process.env.SAHAYAK_EVAL_BASE_URL ?? "https://api.anthropic.com", maxRetries: 0 });
  return client;
}

/**
 * SAHAYAK_EVAL_DRY=1: a stand-in model, to try the runner, the files it
 * writes and the report without spending anything. Its tutor answers one
 * sentence; its judge passes everything. Never for a real result.
 */
function dryClient(): Anthropic {
  const create = async (params: Anthropic.MessageCreateParamsNonStreaming) => {
    const schema = params.output_config?.format?.schema as { required?: string[] } | undefined;
    // The tutor's review answers in a fixed shape too; the judge's shape is per-criterion verdicts.
    const reviewing = schema?.required?.includes("logic") === true;
    const text = reviewing
      ? JSON.stringify({ verdict: "partly", summary: "Look at where your loop stops.", logic: { right: [], wrong: ["The loop stops early."] }, complexity: { time: "O(n)", space: "O(1)", better: "" }, quality: [], edgeCases: [] })
      : schema !== undefined
        ? JSON.stringify(Object.fromEntries((schema.required ?? []).map((k) => [k, { reasoning: "dry run", verdict: "pass" }])))
        : "Look at where your loop stops.";
    return { id: "dry", type: "message", role: "assistant", model: params.model, content: [{ type: "text", text }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } };
  };
  return { messages: { create } } as unknown as Anthropic;
}

let app: Promise<EvalApp> | null = null;
async function appFor(cases: readonly EvalCase[]): Promise<EvalApp> {
  app ??= (async () => {
    const workRoot = await mkdtemp(join(tmpdir(), "sahayak-eval-"));
    const runner: CodeRunner = { run: (request) => execute(request, { workRoot, slot: null }) };
    return EvalApp.open(clientOf(), runner, cases);
  })();
  return app;
}

export interface Run {
  readonly output: string;
  readonly transcript: readonly { role: string; content: string }[];
  readonly model: string;
  readonly usage: Anthropic.Usage;
  readonly stop_reason: string | null;
  readonly answered: Answered;
}

/** Opens the app before the first case, so its setup is not timed as the first cases' latency. */
export async function prepare(flowDir: string): Promise<void> {
  await appFor(loadCases(flowDir).map((i) => i.c));
}

export async function runCase(item: Item, ctx: { flow: string; model?: string }): Promise<Run> {
  const eval_ = await appFor(loadCases(ctx.flow).map((i) => i.c));
  const answered = await eval_.ask(item.c);
  const { exchange } = answered;
  if (ctx.model !== undefined && exchange.params.model !== ctx.model) {
    throw Object.assign(new Error(`the tutor asks for ${exchange.params.model}, but --model says ${ctx.model}`), { failure_class: "serving_substitution" });
  }
  const response = exchange.response!;
  return {
    output: answered.answer,
    transcript: [
      { role: "system", content: exchange.system },
      { role: "user", content: exchange.user },
      { role: "assistant", content: answered.answer },
    ],
    model: response.model,
    usage: response.usage,
    stop_reason: response.stop_reason,
    answered,
  };
}

export async function gradeCase(item: Item, run: Run) {
  const verdict = await judge(clientOf(), item.c, run.output, process.env.SAHAYAK_EVAL_JUDGE ?? JUDGE_MODEL);
  const { grade, explanation } = gradeOf(item.c, run.output, verdict);
  return { grade, explanation, judge_model: verdict.model, judge_usage: verdict.usage };
}
