import { describe, expect, it } from "vitest";
import { loudness, VOICE_COOLDOWN_MS, VOICE_LEVEL, VOICE_SUSTAIN_MS, voiceDetector } from "./voice.ts";

/** Secure mode's listening: only sustained sound is reported, and at most once a minute. Nothing is recorded. */

const feed = (heard: (l: number, t: number) => boolean, level: number, from: number, to: number, step = 250) => {
  const reports: number[] = [];
  for (let t = from; t <= to; t += step) if (heard(level, t)) reports.push(t);
  return reports;
};

describe("hearing a voice", () => {
  it("ignores quiet, and a moment of noise", () => {
    const heard = voiceDetector();
    expect(feed(heard, VOICE_LEVEL / 2, 0, 60_000)).toEqual([]);
    // A cough: loud for a second, then quiet.
    expect(feed(heard, VOICE_LEVEL * 3, 70_000, 71_000)).toEqual([]);
    expect(feed(heard, 0, 71_250, 72_000)).toEqual([]);
  });

  it("reports sound that lasts, once, then waits a minute before reporting again", () => {
    const heard = voiceDetector();
    const reports = feed(heard, VOICE_LEVEL * 2, 0, 3 * 60_000);
    expect(reports[0]).toBe(VOICE_SUSTAIN_MS);
    expect(reports).toHaveLength(3);
    for (let i = 1; i < reports.length; i++) expect(reports[i]! - reports[i - 1]!).toBeGreaterThanOrEqual(VOICE_COOLDOWN_MS);
  });

  it("measures loudness as the root mean square of a frame", () => {
    expect(loudness(new Float32Array([]))).toBe(0);
    expect(loudness(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5);
    expect(loudness(new Float32Array(100))).toBe(0);
  });
});
