import { describe, expect, it } from "vitest";
import { isPriced, measure, rateFor } from "./usage.js";

describe("measure", () => {
  it("prices plain input and output at the model's rate", () => {
    // Opus 5: $5 in, $25 out per million tokens, i.e. 5 and 25 micro-dollars per token.
    const usage = measure("grade", "claude-opus-5", { input_tokens: 1000, output_tokens: 200 });

    expect(usage.costMicroUsd).toBe(1000 * 5 + 200 * 25);
    expect(usage.speed).toBe("standard");
  });

  it("prices cache reads at a tenth and writes by TTL", () => {
    const usage = measure("probe", "claude-opus-5", {
      input_tokens: 100,
      output_tokens: 0,
      cache_read_input_tokens: 1000,
      cache_creation_input_tokens: 600,
      cache_creation: { ephemeral_5m_input_tokens: 200, ephemeral_1h_input_tokens: 400 },
    });

    expect(usage.cacheReadTokens).toBe(1000);
    expect(usage.cacheWrite5mTokens).toBe(200);
    expect(usage.cacheWrite1hTokens).toBe(400);
    expect(usage.costMicroUsd).toBe(Math.round(100 * 5 + 1000 * 0.5 + 200 * 6.25 + 400 * 10));
  });

  it("treats an unattributed cache write as the dearer one-hour kind", () => {
    const usage = measure("probe", "claude-opus-5", {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 500,
    });

    expect(usage.cacheWrite1hTokens).toBe(500);
    expect(usage.costMicroUsd).toBe(500 * 10);
  });

  it("doubles the rate in fast mode", () => {
    const usage = measure("probe", "claude-opus-5", { input_tokens: 100, output_tokens: 100, speed: "fast" });

    expect(usage.speed).toBe("fast");
    expect(usage.costMicroUsd).toBe(100 * 10 + 100 * 50);
  });

  it("records where the provider says the inference ran", () => {
    expect(measure("assess", "claude-opus-5", { input_tokens: 1, output_tokens: 1, inference_geo: "us" }).inferenceGeo).toBe("us");
    expect(measure("assess", "claude-opus-5", { input_tokens: 1, output_tokens: 1 }).inferenceGeo).toBeNull();
  });

  it("overstates, never understates, a model it has no price for", () => {
    // A ceiling that counts too much stops early; one that counts too little
    // never stops.
    expect(isPriced("some-future-model")).toBe(false);
    expect(rateFor("some-future-model", "standard")).toEqual(rateFor("claude-fable-5-1", "standard"));
    expect(isPriced("claude-opus-5")).toBe(true);
  });
});
