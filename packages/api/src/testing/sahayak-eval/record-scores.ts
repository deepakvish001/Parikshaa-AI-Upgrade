import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { EvalFlow, EvalScores } from "../../content/sahayak-eval-scores.js";

/**
 * Writes the latest run's scores into `content/sahayak-eval-scores.ts`, for
 * the console's Sahayak page: for each flow, the newest version directory
 * with results, and per metric how many graded cases passed. Truncated
 * answers count against the run (a learner would have seen them).
 *
 *   npx tsx packages/api/src/testing/sahayak-eval/record-scores.ts [.claude/hillclimb]
 */

const root = process.argv[2] ?? ".claude/hillclimb";
const FLOWS: readonly EvalFlow[] = ["hint", "review", "doubt"];

interface Row {
  readonly status: string;
  readonly model?: string;
  readonly grade?: Record<string, number>;
}

/** The scores in one flow directory, from its newest results; null when it has none. */
export function scoresOf(dir: string): { version: string; cases: number; passed: Record<string, number>; model: string | null } | null {
  if (!existsSync(dir)) return null;
  const versions = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, "results.jsonl")))
    .map((d) => d.name)
    .sort((a, b) => (a === "baseline" ? -1 : b === "baseline" ? 1 : Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, ""))));
  const version = versions.at(-1);
  if (version === undefined) return null;
  const rows = readFileSync(join(dir, version, "results.jsonl"), "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as Row);
  const passed: Record<string, number> = {};
  for (const row of rows) for (const [metric, value] of Object.entries(row.grade ?? {})) passed[metric] = (passed[metric] ?? 0) + (row.status === "ok" && value >= 1 ? 1 : 0);
  return { version, cases: rows.length, passed, model: rows.find((r) => r.model !== undefined)?.model ?? null };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const flows: Record<string, unknown> = {};
  let model: string | null = null;
  for (const flow of FLOWS) {
    const s = scoresOf(join(root, `sahayak-${flow}`));
    if (s === null) continue;
    flows[flow] = { version: s.version, cases: s.cases, passed: s.passed };
    model ??= s.model;
  }
  if (Object.keys(flows).length === 0) throw new Error(`No results under ${root}: run the eval first`);
  const scores = { recordedAt: new Date().toISOString(), model, flows } as EvalScores;
  const file = fileURLToPath(new URL("../../content/sahayak-eval-scores.ts", import.meta.url));
  const source = readFileSync(file, "utf8").replace(/export const SAHAYAK_EVAL_SCORES: EvalScores = [\s\S]*?\n};\n/, `export const SAHAYAK_EVAL_SCORES: EvalScores = ${JSON.stringify(scores, null, 2)};\n`);
  writeFileSync(file, source);
  process.stdout.write(`recorded ${Object.keys(flows).join(", ")} into ${file}\n`);
}
