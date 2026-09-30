/**
 * What a model call cost (ROADMAP §0).
 *
 * Nobody knew the per-attempt spend, and a price list cannot be built on an
 * estimate. Every call the engine makes reports its token counts through
 * `onUsage`, and this module turns them into money.
 *
 * Prices are per million tokens, in US dollars, from Anthropic's published
 * rates as of 2026-06. Cache reads are billed at 0.1x the input price; cache
 * writes at 1.25x for the five-minute TTL and 2x for the one-hour TTL. Fast
 * mode doubles the base rates, and the cache multipliers are applied to the
 * rate actually charged. Output tokens include thinking tokens, which are
 * billed as output.
 *
 * Micro-dollars keep the arithmetic in integers: a price of $5 per million
 * tokens is exactly 5 micro-dollars per token.
 */

export type ModelRoute = "probe" | "assess" | "grade" | "tutor" | "author";

export interface ModelUsage {
  readonly route: ModelRoute;
  readonly model: string;
  readonly speed: "standard" | "fast";
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWrite5mTokens: number;
  readonly cacheWrite1hTokens: number;
  readonly inferenceGeo: string | null;
  readonly costMicroUsd: number;
}

interface Rate {
  readonly input: number;
  readonly output: number;
}

const STANDARD: Readonly<Record<string, Rate>> = {
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

const FAST: Readonly<Record<string, Rate>> = {
  "claude-opus-5-5": { input: 8, output: 40 },
  "claude-opus-5": { input: 10, output: 50 },
};

/**
 * The most expensive published rate, used for a model this table does not
 * know. Overstating is the safe error here: a spend ceiling that counts too
 * much stops early, one that counts too little does not stop at all.
 */
const UNKNOWN: Rate = { input: 10, output: 50 };

export function rateFor(model: string, speed: "standard" | "fast"): Rate {
  return (speed === "fast" ? FAST[model] : undefined) ?? STANDARD[model] ?? UNKNOWN;
}

/** Whether `rateFor` is using the conservative fallback for this model. */
export const isPriced = (model: string): boolean => model in STANDARD;

/** The shape both the regular and beta SDK responses report usage in. */
export interface ReportedUsage {
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cache_read_input_tokens?: number | null;
  readonly cache_creation_input_tokens?: number | null;
  readonly cache_creation?: {
    readonly ephemeral_5m_input_tokens: number;
    readonly ephemeral_1h_input_tokens: number;
  } | null;
  readonly inference_geo?: string | null;
  readonly speed?: "standard" | "fast" | null;
}

export function measure(route: ModelRoute, model: string, usage: ReportedUsage): ModelUsage {
  const speed = usage.speed === "fast" ? "fast" : "standard";
  const cacheRead = usage.cache_read_input_tokens ?? 0;

  // The breakdown by TTL is authoritative when present. Without it, an
  // unattributed write is priced at the one-hour rate — the dearer of the two.
  const write5m = usage.cache_creation?.ephemeral_5m_input_tokens ?? 0;
  const write1h =
    usage.cache_creation?.ephemeral_1h_input_tokens ??
    (usage.cache_creation === null || usage.cache_creation === undefined
      ? (usage.cache_creation_input_tokens ?? 0)
      : 0);

  const rate = rateFor(model, speed);
  const cost =
    usage.input_tokens * rate.input +
    usage.output_tokens * rate.output +
    cacheRead * rate.input * 0.1 +
    write5m * rate.input * 1.25 +
    write1h * rate.input * 2;

  return {
    route,
    model,
    speed,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: cacheRead,
    cacheWrite5mTokens: write5m,
    cacheWrite1hTokens: write1h,
    inferenceGeo: usage.inference_geo ?? null,
    costMicroUsd: Math.round(cost),
  };
}
