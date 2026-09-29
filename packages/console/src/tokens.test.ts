/// <reference types="node" />
// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The design tokens keep their promises (docs/DESIGN.md): every pair of text
 * and background a component is allowed to use meets WCAG 2.1 AA in both
 * themes, and there is one dark palette, not two that drift apart.
 */

const css = readFileSync(new URL("../../brand/src/tokens.css", import.meta.url), "utf8");

/** The declarations inside the block that starts at `opener`. */
function block(opener: string): Map<string, string> {
  const start = css.indexOf(opener);
  expect(start, opener).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return new Map([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}

const light = block(":root {");
const darkMedia = block(':root:not([data-theme="light"])');
const darkAttr = block(':root[data-theme="dark"],');

/** A token's colour in a theme: its own value, following var() back to the light palette. */
function colour(theme: Map<string, string>, name: string): string {
  let value = theme.get(name) ?? light.get(name);
  for (let i = 0; value?.startsWith("var(") && i < 5; i++) value = theme.get(value.slice(4, -1)) ?? light.get(value.slice(4, -1));
  expect(value, name).toMatch(/^#[0-9a-f]{6}$/i);
  return value!;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

/** [foreground, background] pairs a component may put together. */
const PAIRS: readonly (readonly [string, string])[] = [
  ["--text", "--bg"],
  ["--text", "--surface"],
  ["--text-secondary", "--surface"],
  ["--text-secondary", "--bg"],
  ["--text-muted", "--surface"],
  ["--text-muted", "--bg"],
  ["--text-muted", "--surface-2"],
  ["--text-muted", "--surface-sunken"],
  ["--primary", "--surface"],
  ["--primary", "--bg"],
  ["--primary", "--primary-soft"],
  ["--on-primary", "--primary"],
  ["--accent-text", "--surface"],
  ["--accent-text", "--bg"],
  ["--on-accent-solid", "--accent-solid"],
  ["--on-neutral-solid", "--neutral-solid"],
  ...["success", "warning", "danger", "review", "info"].flatMap((s) => [
    [`--${s}`, "--surface"] as const,
    [`--${s}`, "--bg"] as const,
    [`--${s}`, `--${s}-soft`] as const,
    [`--on-${s}-solid`, `--${s}-solid`] as const,
  ]),
  ["--chrome-text", "--chrome"],
  ["--chrome-text-strong", "--chrome"],
  ["--chrome-success", "--chrome"],
  ["--chrome-warning", "--chrome"],
  ["--chrome-danger", "--chrome"],
];

describe("design tokens", () => {
  for (const [name, theme] of [
    ["light", light],
    ["dark", darkAttr],
  ] as const) {
    it(`meet WCAG AA for every pair a component may use, ${name}`, () => {
      const failing = PAIRS.map(([fg, bg]) => [fg, bg, contrast(colour(theme, fg), colour(theme, bg))] as const).filter(([, , ratio]) => ratio < 4.5);
      expect(failing.map(([fg, bg, r]) => `${fg} on ${bg}: ${r.toFixed(2)}`)).toEqual([]);
    });
  }

  it("keep one dark palette: the system's and the switch's are the same", () => {
    expect([...darkMedia]).toEqual([...darkAttr]);
  });

  it("re-value in dark every colour the light theme sets outright", () => {
    // A literal light colour left out of the dark list would show through in dark.
    const literal = [...light].filter(([name, value]) => /^#/.test(value) && !/^--(on-)?(brand|saffron|gray|medal)-/.test(name) && !/^--chrome-(text|success|warning|danger)/.test(name));
    const exempt = new Set(["--text-on-primary", "--accent-solid-hover", "--on-accent-solid", "--on-warning-solid", "--success", "--warning", "--danger", "--chrome-2"]);
    const missing = literal.filter(([name]) => !darkAttr.has(name) && !exempt.has(name)).map(([name]) => name);
    expect(missing).toEqual([]);
  });
});
