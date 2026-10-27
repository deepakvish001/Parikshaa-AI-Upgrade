/// <reference types="node" />
// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The design tokens keep their promises (docs/DESIGN.md): every pair of text
 * and background a component is allowed to use meets WCAG 2.1 AA in both
 * themes, and there is one dark palette, not two that drift apart.
 */

const read = (file: string) => readFileSync(new URL(`../../brand/src/${file}`, import.meta.url), "utf8");
const css = read("tokens.css");
/** Learn's names (learn.css), laid over the brand's: aliases of them, or values of their own. */
const learnCss = read("learn.css");

/** The declarations inside the block that starts at `opener`. */
function block(opener: string, source = css): Map<string, string> {
  const start = source.indexOf(opener);
  expect(start, opener).toBeGreaterThanOrEqual(0);
  const body = source.slice(source.indexOf("{", start) + 1, source.indexOf("}", start));
  return new Map([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}

const light = block(":root {");
const darkMedia = block(':root:not([data-theme="light"])');
const darkAttr = block(':root[data-theme="dark"],');
const learnLight = block(":root {", learnCss);
const learnDarkMedia = block(':root:not([data-theme="light"])', learnCss);
const learnDarkAttr = block(':root[data-theme="dark"],', learnCss);

/** A token's colour in a theme: its own value, following var() back to the light palette. */
function colour(theme: Map<string, string>, name: string, base = light): string {
  let value = theme.get(name) ?? base.get(name);
  for (let i = 0; value?.startsWith("var(") && i < 5; i++) value = theme.get(value.slice(4, -1)) ?? base.get(value.slice(4, -1));
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

/** Learn's text on Learn's surfaces (DESIGN-SYSTEM §3: every readable text 4.5:1, --ink-3 and --ink-4 too). */
const LEARN_PAIRS: readonly (readonly [string, string])[] = [
  ...["--ink", "--ink-2", "--ink-3", "--ink-4"].flatMap((ink) => ["--page", "--panel", "--panel-2", "--sunk", "--raised", "--overlay", "--field"].map((bg) => [ink, bg] as const)),
  ...["--pen-text", "--red-text", "--tick-text", "--ai-text", "--coin", "--teal", "--marker-ink"].flatMap((fg) => [[fg, "--page"] as const, [fg, "--panel"] as const]),
  ["--on-pen", "--pen"],
  ["--on-red", "--red"],
  ["--on-tick", "--tick"],
  ["--on-ai", "--ai"],
  ...["--code-gutter", "--code-kw", "--code-str", "--code-num", "--code-fn", "--code-com", "--code-ty"].map((fg) => [fg, "--code-bg"] as const),
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

  it("keep one dark palette in Learn's names too", () => {
    expect([...learnDarkMedia]).toEqual([...learnDarkAttr]);
  });

  for (const [name, theme] of [
    ["light", new Map([...light, ...learnLight])],
    ["dark", new Map([...light, ...learnLight, ...darkAttr, ...learnDarkAttr])],
  ] as const) {
    it(`meet WCAG AA in Learn's names, ${name}`, () => {
      const base = new Map([...light, ...learnLight]);
      const failing = LEARN_PAIRS.map(([fg, bg]) => [fg, bg, contrast(colour(theme, fg, base), colour(theme, bg, base))] as const).filter(([, , ratio]) => ratio < 4.5);
      expect(failing.map(([fg, bg, r]) => `${fg} on ${bg}: ${r.toFixed(2)}`)).toEqual([]);
    });
  }

  it("re-value in dark every colour Learn's names set outright", () => {
    const literal = [...learnLight].filter(([, value]) => /^#/.test(value));
    expect(literal.filter(([name]) => !learnDarkAttr.has(name)).map(([name]) => name)).toEqual([]);
  });

  it("point every face at a file the font packages have", () => {
    const missing = [read("fonts.css"), learnCss]
      .flatMap((source) => [...source.matchAll(/url\("(@fontsource[^"]+)"\)/g)].map((m) => m[1]!))
      .filter((file) => !existsSync(new URL(`../../../node_modules/${file}`, import.meta.url)));
    expect(missing).toEqual([]);
  });

  it("re-value in dark every colour the light theme sets outright", () => {
    // A literal light colour left out of the dark list would show through in dark.
    const literal = [...light].filter(([name, value]) => /^#/.test(value) && !/^--(on-)?(brand|saffron|gray|medal)-/.test(name) && !/^--chrome-(text|success|warning|danger)/.test(name));
    const exempt = new Set(["--text-on-primary", "--accent-solid-hover", "--on-accent-solid", "--on-warning-solid", "--success", "--warning", "--danger", "--chrome-2"]);
    const missing = literal.filter(([name]) => !darkAttr.has(name) && !exempt.has(name)).map(([name]) => name);
    expect(missing).toEqual([]);
  });
});
