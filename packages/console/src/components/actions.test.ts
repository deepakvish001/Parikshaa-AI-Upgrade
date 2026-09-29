/// <reference types="node" />
// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACTIONS } from "./Home.tsx";

/**
 * The audit log and Home say what happened in words. Every action the API
 * can record is found in its source, and each must have its words here, so a
 * new one cannot reach the page as "practice problem edited".
 */
describe("the audit log's words", () => {
  it("has words for every action the API records", () => {
    const dir = new URL("../../../api/src/", import.meta.url);
    const recorded = new Set<string>();
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
      const source = readFileSync(new URL(file, dir), "utf8");
      // An action is named where an audit entry is written: within a few lines of audit( or recordAudit(.
      const lines = source.split("\n");
      lines.forEach((line, i) => {
        if (!/audit\(|Audit\(/.test(line)) return;
        for (const near of lines.slice(i, i + 4)) for (const m of near.matchAll(/"([a-z]+\.[a-z_]+)"/g)) recorded.add(m[1]!);
      });
    }
    expect(recorded.size).toBeGreaterThan(40);
    const missing = [...recorded].filter((a) => !(a in ACTIONS) && !a.startsWith("greenhouse.io"));
    expect(missing).toEqual([]);
  });
});
