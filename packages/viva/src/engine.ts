import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  vivaId,
  type ProbeTarget,
  type QuestionScore,
  type Timestamp,
  type VivaAssessment,
  type VivaExchange,
  type VivaId,
  type VivaProbe,
} from "@parikshaa/core";
import { redact, type RedactedAnswer } from "./redact.js";
import { measure, type ModelRoute, type ModelUsage, type ReportedUsage } from "./usage.js";
import {
  ASSESS_SYSTEM,
  GRADE_SYSTEM,
  PROBE_SYSTEM,
  answerBlock,
  questionContext,
  replyBlock,
} from "./prompts.js";

/** The model everything here runs on. See STACK.md §4 before changing it. */
export const DEFAULT_MODEL = "claude-opus-5";

/** Fast mode: same model, higher output throughput, premium rate. Opus 5 only. */
const FAST_MODE_BETA = "fast-mode-2026-02-01";

export interface EngineOptions {
  readonly client: Anthropic;
  readonly model?: string;
  /**
   * Fast mode for probe generation. The candidate is waiting mid-exam, so the
   * premium rate buys something real there; it is pointless for the assessment
   * and grading paths, which run after submission.
   */
  readonly fastProbes?: boolean;
  readonly now?: () => Timestamp;
  readonly newVivaId?: () => VivaId;
  /**
   * Called with what every model call cost, before its result is used —
   * including a call that ends in a refusal, which is billed all the same.
   * Awaited, so a spend ceiling sees the cost before the next call is made.
   */
  readonly onUsage?: (usage: ModelUsage) => void | Promise<void>;
}

interface Resolved {
  readonly client: Anthropic;
  readonly model: string;
  readonly fastProbes: boolean;
  readonly now: () => Timestamp;
  readonly newVivaId: () => VivaId;
}

function resolve(options: EngineOptions): Resolved {
  return {
    client: options.client,
    model: options.model ?? DEFAULT_MODEL,
    fastProbes: options.fastProbes ?? true,
    now: options.now ?? (() => Date.now()),
    newVivaId: options.newVivaId ?? (() => vivaId(crypto.randomUUID())),
  };
}

/** Cached prefix first, per-candidate content after it. See prompts.ts. */
function systemBlocks(answer: RedactedAnswer, instructions: string): Anthropic.TextBlockParam[] {
  return [
    { type: "text", text: instructions },
    {
      type: "text",
      text: questionContext(answer),
      cache_control: { type: "ephemeral", ttl: "1h" },
    },
  ];
}

/** Pass one call's measured usage to the caller, if they asked for it. */
async function report(
  options: EngineOptions,
  route: ModelRoute,
  model: string,
  usage: ReportedUsage,
): Promise<void> {
  if (options.onUsage !== undefined) await options.onUsage(measure(route, model, usage));
}

/**
 * Concatenate the text blocks of a response.
 *
 * Typed structurally because the beta and non-beta endpoints return different
 * content-block unions that differ only in blocks we never ask for.
 */
function textOf(content: readonly { readonly type: string }[]): string {
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === "text" && "text" in block && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("").trim();
}

/** Raised when the model declines the request outright. */
export class RefusedError extends Error {
  constructor(readonly category: string | null) {
    super(`The model declined this request${category === null ? "" : ` (${category})`}`);
    this.name = "RefusedError";
  }
}

// ---------------------------------------------------------------------------
// Probe generation
// ---------------------------------------------------------------------------

export interface GenerateProbeOptions extends EngineOptions {
  /** Called with each token as it arrives, for streaming a probe to the candidate. */
  readonly onToken?: (token: string) => void;
}

/**
 * Generate one micro-viva probe from a candidate's own answer.
 *
 * The probe's `rationale` is not written by the model. It is a fact the system
 * already knows — this answer cleared the exam's trigger ratio — and an appeal
 * board should read the real reason the probe was raised, not a plausible
 * sentence generated after the fact.
 */
export async function generateProbe(
  target: ProbeTarget,
  options: GenerateProbeOptions,
): Promise<VivaProbe> {
  const { client, model, fastProbes, now, newVivaId } = resolve(options);
  const answer = redact(target.question, target.response);

  const stream = client.beta.messages.stream({
    model,
    max_tokens: 512,
    ...(fastProbes ? { betas: [FAST_MODE_BETA], speed: "fast" as const } : {}),
    output_config: { effort: "low" },
    system: systemBlocks(answer, PROBE_SYSTEM),
    messages: [{ role: "user", content: answerBlock(answer) }],
  });

  if (options.onToken !== undefined) {
    const emit = options.onToken;
    stream.on("text", (delta: string) => emit(delta));
  }

  const message = await stream.finalMessage();
  await report(options, "probe", model, message.usage);
  if (message.stop_reason === "refusal") {
    throw new RefusedError(message.stop_details?.category ?? null);
  }

  const prompt = textOf(message.content);
  if (prompt === "") {
    throw new Error("The model returned an empty probe");
  }

  const ratio = (target.score.score / target.score.maxScore).toFixed(2);
  return {
    id: newVivaId(),
    questionId: target.question.id,
    prompt,
    rationale: `Answer scored ${target.score.score}/${target.score.maxScore} (${ratio}), at or above this exam's viva trigger ratio.`,
    askedAt: now(),
  };
}

// ---------------------------------------------------------------------------
// Verdict assessment
// ---------------------------------------------------------------------------

const AssessmentSchema = z.object({
  verdict: z.enum(["consistent", "shallow", "inconsistent", "inconclusive"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});

/**
 * Judge whether a reply is consistent with having produced the original answer.
 *
 * A refusal or an unparseable response resolves to `inconclusive` rather than
 * throwing. SPEC §6.3 makes inconclusive a first-class outcome, and a system
 * that failed loudly here would be under pressure to guess instead.
 */
export async function assessReply(
  target: ProbeTarget,
  probe: VivaProbe,
  exchange: VivaExchange,
  options: EngineOptions,
): Promise<VivaAssessment> {
  const { client, model } = resolve(options);
  const answer = redact(target.question, target.response);

  const inconclusive = (reasoning: string): VivaAssessment => ({
    probeId: probe.id,
    verdict: "inconclusive",
    confidence: 0,
    reasoning,
  });

  const response = await client.messages.parse({
    model,
    max_tokens: 4096,
    output_config: { effort: "high", format: zodOutputFormat(AssessmentSchema) },
    system: systemBlocks(answer, ASSESS_SYSTEM),
    messages: [
      {
        role: "user",
        content: `${answerBlock(answer)}\n\n${replyBlock(probe.prompt, exchange.reply, exchange.latencyMs)}`,
      },
    ],
  });
  await report(options, "assess", model, response.usage);

  if (response.stop_reason === "refusal") {
    return inconclusive("The assessment model declined to judge this exchange. Recorded as inconclusive; a human may review it.");
  }

  const parsed = response.parsed_output;
  if (parsed === null || parsed === undefined) {
    return inconclusive("The assessment model returned no usable verdict. Recorded as inconclusive; a human may review it.");
  }

  return { probeId: probe.id, ...parsed };
}

// ---------------------------------------------------------------------------
// Rubric grading
// ---------------------------------------------------------------------------

const GradeSchema = z.object({
  score: z.number(),
  criteriaMet: z.array(z.string()),
  reasoning: z.string().min(1),
});

/**
 * Grade a short or code answer against its rubric.
 *
 * The returned score is clamped into `[0, maxScore]`. A model that returns 12
 * out of 10 is not a reason to hand a candidate 12 marks.
 */
export async function gradeWithRubric(
  target: Pick<ProbeTarget, "question" | "response">,
  options: EngineOptions,
): Promise<QuestionScore> {
  const { client, model } = resolve(options);
  const answer = redact(target.question, target.response);
  const maxScore = target.question.maxScore;

  const response = await client.messages.parse({
    model,
    max_tokens: 4096,
    output_config: { effort: "high", format: zodOutputFormat(GradeSchema) },
    system: systemBlocks(answer, GRADE_SYSTEM),
    messages: [{ role: "user", content: answerBlock(answer) }],
  });
  await report(options, "grade", model, response.usage);

  if (response.stop_reason === "refusal") {
    throw new RefusedError(response.stop_details?.category ?? null);
  }

  const parsed = response.parsed_output;
  if (parsed === null || parsed === undefined) {
    throw new Error("The grading model returned no usable score");
  }

  return {
    questionId: target.question.id,
    score: Math.min(Math.max(parsed.score, 0), maxScore),
    maxScore,
    method: "rubric",
    reasoning: parsed.reasoning,
  };
}
