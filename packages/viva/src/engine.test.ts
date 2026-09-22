import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import {
  questionId,
  vivaId,
  type ProbeTarget,
  type ShortQuestion,
  type VivaExchange,
  type VivaProbe,
} from "@parikshaa/core";
import { assessReply, generateProbe, gradeWithRubric, RefusedError } from "./engine.js";
import { redact } from "./redact.js";

const Q = questionId("q1");

const question: ShortQuestion = {
  id: Q,
  kind: "short",
  stem: "Why does the algorithm terminate?",
  maxScore: 10,
  rubric: [{ id: "c1", description: "Identifies the decreasing measure", weight: 1 }],
  expectedPoints: ["the measure strictly decreases"],
};

const target: ProbeTarget = {
  question,
  response: { questionId: Q, answer: "Because the potential strictly decreases each round.", submittedAt: 1 },
  score: { questionId: Q, score: 8, maxScore: 10, method: "rubric", reasoning: "Most criteria met." },
};

const probe: VivaProbe = {
  id: vivaId("probe-1"),
  questionId: Q,
  prompt: "Which quantity decreases, and what stops it going below zero?",
  rationale: "n/a",
  askedAt: 1,
};

const exchange: VivaExchange = {
  probeId: probe.id,
  reply: "The potential function; it is bounded below by zero since it counts inversions.",
  repliedAt: 2,
  latencyMs: 14_000,
};

/** Captures the request so tests can assert on what was actually sent. */
function fakeClient(options: {
  readonly probeText?: string;
  readonly parsed?: unknown;
  readonly stopReason?: string;
}) {
  const calls: Record<string, unknown>[] = [];

  const client = {
    beta: {
      messages: {
        stream(params: Record<string, unknown>) {
          calls.push(params);
          const text = options.probeText ?? "What stops the measure going below zero?";
          return {
            on(_event: string, callback: (delta: string) => void) {
              callback(text);
            },
            async finalMessage() {
              return {
                content: [{ type: "text", text }],
                usage: { input_tokens: 120, output_tokens: 40, cache_read_input_tokens: 800, speed: "fast" },
                stop_reason: options.stopReason ?? "end_turn",
                stop_details: options.stopReason === "refusal" ? { category: "cyber" } : null,
              };
            },
          };
        },
      },
    },
    messages: {
      async parse(params: Record<string, unknown>) {
        calls.push(params);
        return {
          usage: { input_tokens: 300, output_tokens: 90 },
          stop_reason: options.stopReason ?? "end_turn",
          stop_details: options.stopReason === "refusal" ? { category: "cyber" } : null,
          parsed_output: options.parsed ?? null,
        };
      },
    },
  };

  return { client: client as unknown as Anthropic, calls };
}

describe("redact", () => {
  it("carries the question and answer but has nowhere to put an identity", () => {
    const redacted = redact(question, target.response);

    expect(redacted).toEqual({
      questionKind: "short",
      stem: question.stem,
      rubric: question.rubric,
      maxScore: 10,
      answer: target.response.answer,
    });
  });
});

describe("generateProbe", () => {
  it("returns the model's text as the probe", async () => {
    const { client } = fakeClient({ probeText: "Which quantity decreases?" });

    const result = await generateProbe(target, { client, now: () => 99, newVivaId: () => vivaId("p") });

    expect(result.prompt).toBe("Which quantity decreases?");
    expect(result.questionId).toBe(Q);
    expect(result.askedAt).toBe(99);
  });

  it("writes the rationale from the score, not from the model", async () => {
    const { client } = fakeClient({});

    const result = await generateProbe(target, { client });

    // The reason a probe was raised is a fact the system knows; an appeal board
    // must not be shown a sentence the model invented after the fact.
    expect(result.rationale).toContain("8/10");
    expect(result.rationale).toContain("0.80");
  });

  it("puts the question in the cached prefix and the answer outside it", async () => {
    const { client, calls } = fakeClient({});

    await generateProbe(target, { client });

    const system = calls[0]?.["system"] as { text: string; cache_control?: unknown }[];
    const last = system.at(-1);
    expect(last?.cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
    // The cached blocks must not contain this candidate's answer, or the prefix
    // would differ per candidate and never be reused.
    for (const block of system) {
      expect(block.text).not.toContain(target.response.answer);
    }
    expect(JSON.stringify(calls[0]?.["messages"])).toContain(target.response.answer);
  });

  it("sends no identifying information to the model at all", async () => {
    const { client, calls } = fakeClient({});

    await generateProbe(target, { client });

    const sent = JSON.stringify(calls[0]);
    for (const identifier of ["attempt-1", "cand-1", "exam-1", "q1"]) {
      expect(sent).not.toContain(identifier);
    }
  });

  it("uses fast mode by default and drops it when disabled", async () => {
    const fast = fakeClient({});
    await generateProbe(target, { client: fast.client });
    expect(fast.calls[0]?.["speed"]).toBe("fast");
    expect(fast.calls[0]?.["betas"]).toEqual(["fast-mode-2026-02-01"]);

    const slow = fakeClient({});
    await generateProbe(target, { client: slow.client, fastProbes: false });
    expect(slow.calls[0]?.["speed"]).toBeUndefined();
    expect(slow.calls[0]?.["betas"]).toBeUndefined();
  });

  it("streams tokens to the caller", async () => {
    const { client } = fakeClient({ probeText: "Streamed probe." });
    const seen: string[] = [];

    await generateProbe(target, { client, onToken: (t) => seen.push(t) });

    expect(seen.join("")).toBe("Streamed probe.");
  });

  it("raises on a refusal and on an empty probe", async () => {
    const refused = fakeClient({ stopReason: "refusal" });
    await expect(generateProbe(target, { client: refused.client })).rejects.toBeInstanceOf(RefusedError);

    const empty = fakeClient({ probeText: "   " });
    await expect(generateProbe(target, { client: empty.client })).rejects.toThrow(/empty probe/);
  });
});

describe("assessReply", () => {
  it("returns the model's verdict bound to the probe", async () => {
    const { client } = fakeClient({
      parsed: { verdict: "consistent", confidence: 0.82, reasoning: "Named the bound correctly." },
    });

    const result = await assessReply(target, probe, exchange, { client });

    expect(result).toEqual({
      probeId: probe.id,
      verdict: "consistent",
      confidence: 0.82,
      reasoning: "Named the bound correctly.",
    });
  });

  it("falls back to inconclusive on a refusal", async () => {
    const { client } = fakeClient({ stopReason: "refusal" });

    const result = await assessReply(target, probe, exchange, { client });

    expect(result.verdict).toBe("inconclusive");
    expect(result.confidence).toBe(0);
    expect(result.reasoning).toMatch(/human may review/);
  });

  it("falls back to inconclusive when nothing parsed", async () => {
    const { client } = fakeClient({ parsed: null });

    const result = await assessReply(target, probe, exchange, { client });

    expect(result.verdict).toBe("inconclusive");
  });

  it("gives the assessor the server-measured latency", async () => {
    const { client, calls } = fakeClient({
      parsed: { verdict: "shallow", confidence: 0.5, reasoning: "Restated the answer." },
    });

    await assessReply(target, probe, exchange, { client });

    expect(JSON.stringify(calls[0]?.["messages"])).toContain("14s");
  });
});

describe("gradeWithRubric", () => {
  it("returns a rubric score with the model's reasoning", async () => {
    const { client } = fakeClient({
      parsed: { score: 7, criteriaMet: ["c1"], reasoning: "Identifies the measure." },
    });

    const result = await gradeWithRubric(target, { client });

    expect(result).toEqual({
      questionId: Q,
      score: 7,
      maxScore: 10,
      method: "rubric",
      reasoning: "Identifies the measure.",
    });
  });

  it("clamps a score the model put outside the valid range", async () => {
    const over = fakeClient({ parsed: { score: 12, criteriaMet: [], reasoning: "x" } });
    expect((await gradeWithRubric(target, { client: over.client })).score).toBe(10);

    const under = fakeClient({ parsed: { score: -3, criteriaMet: [], reasoning: "x" } });
    expect((await gradeWithRubric(target, { client: under.client })).score).toBe(0);
  });

  it("raises rather than guessing when grading fails", async () => {
    const refused = fakeClient({ stopReason: "refusal" });
    await expect(gradeWithRubric(target, { client: refused.client })).rejects.toBeInstanceOf(RefusedError);

    const unparsed = fakeClient({ parsed: null });
    await expect(gradeWithRubric(target, { client: unparsed.client })).rejects.toThrow(/no usable score/);
  });
});

describe("usage reporting", () => {
  it("reports what each route cost", async () => {
    const seen: { route: string; cost: number }[] = [];
    const onUsage = (u: { route: string; costMicroUsd: number }) => void seen.push({ route: u.route, cost: u.costMicroUsd });

    const probeClient = fakeClient({});
    await generateProbe(target, { client: probeClient.client, onUsage });
    const assessClient = fakeClient({ parsed: { verdict: "consistent", confidence: 0.8, reasoning: "ok" } });
    await assessReply(target, probe, exchange, { client: assessClient.client, onUsage });
    const gradeClient = fakeClient({ parsed: { score: 5, criteriaMet: [], reasoning: "ok" } });
    await gradeWithRubric(target, { client: gradeClient.client, onUsage });

    expect(seen.map((s) => s.route)).toEqual(["probe", "assess", "grade"]);
    // Fast-mode probe: 120 in at 10, 40 out at 50, 800 cached at a tenth of 10.
    expect(seen[0]?.cost).toBe(120 * 10 + 40 * 50 + 800);
    expect(seen[1]?.cost).toBe(300 * 5 + 90 * 25);
  });

  it("reports a refused call, which is billed all the same", async () => {
    const seen: string[] = [];
    const { client } = fakeClient({ stopReason: "refusal" });

    await expect(
      generateProbe(target, { client, onUsage: (u) => void seen.push(u.route) }),
    ).rejects.toBeInstanceOf(RefusedError);

    expect(seen).toEqual(["probe"]);
  });
});
