import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The graded cases of one or more flows as one Markdown file, to read on a
 * phone: for each case what the learner sent, what the tutor answered, and
 * each grade with the judge's reasoning. `report.html` has the numbers; this
 * has the words behind them.
 *
 *   npx tsx packages/api/src/testing/sahayak-eval/review-md.ts out.md .claude/hillclimb/sahayak-hint [...]
 */

interface Row {
  prompt_id: string;
  rep: number;
  prompt: string;
  tags?: string[];
  status: string;
  grade: Record<string, number>;
  explanation?: Record<string, string>;
  usage?: { input_tokens: number; output_tokens: number };
}

const fence = (body: string) => {
  let f = "```";
  while (body.includes(f)) f += "`";
  return `${f}\n${body.replace(/\n$/, "")}\n${f}`;
};
/** Only a regular file inside the flow directory: ids are data. */
const readInside = (dir: string, name: string): string | null => {
  if (!/^[\w.-]+$/.test(name)) return null;
  const path = join(dir, name);
  try {
    return lstatSync(path).isFile() ? readFileSync(path, "utf8") : null;
  } catch {
    return null;
  }
};

function flowSection(dir: string): string {
  const variant = join(dir, "baseline");
  const rows = (readInside(variant, "results.jsonl") ?? "")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as Row);
  const metrics = [...new Set(rows.flatMap((r) => Object.keys(r.grade)))];
  const out = [`## ${dir.split("/").filter(Boolean).at(-1)}: ${rows.length} cases\n`];
  out.push(`| Metric | Pass |\n|---|---|`);
  for (const m of metrics) {
    const scored = rows.filter((r) => r.status === "ok" && m in r.grade);
    out.push(`| ${m} | ${scored.filter((r) => r.grade[m] === 1).length} / ${scored.length} |`);
  }
  out.push("");
  for (const r of rows) {
    const trace = readInside(join(variant, "traces"), `${r.prompt_id}_rep${r.rep}.json`);
    const turns = trace === null ? [] : (JSON.parse(trace) as { role: string; content: string }[]);
    const user = turns.find((t) => t.role === "user")?.content ?? "(no trace)";
    const answer = turns.find((t) => t.role === "assistant")?.content ?? "(no trace)";
    const failed = metrics.filter((m) => r.grade[m] === 0);
    out.push(`### ${r.prompt_id} ${failed.length === 0 ? "✅" : `❌ ${failed.join(", ")}`}\n`);
    out.push(`${r.prompt}${r.tags?.length ? ` · ${r.tags.join(" · ")}` : ""}${r.status === "ok" ? "" : ` · **${r.status}**`}\n`);
    out.push(`<details><summary>What the tutor was sent</summary>\n\n${fence(user)}\n\n</details>\n`);
    out.push(`**Tutor's answer**\n\n${fence(answer)}\n`);
    out.push(`| Grade | | Why |\n|---|---|---|`);
    for (const m of metrics) out.push(`| ${m} | ${r.grade[m] === 1 ? "pass" : r.grade[m] === 0 ? "**fail**" : "-"} | ${(r.explanation?.[m] ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ")} |`);
    out.push("");
  }
  return out.join("\n");
}

const [outPath, ...dirs] = process.argv.slice(2);
if (outPath === undefined || dirs.length === 0) {
  console.error("usage: review-md.ts OUT.md FLOW_DIR...");
  process.exit(2);
}
writeFileSync(outPath, `# Sahayak eval: graded cases\n\n${dirs.map(flowSection).join("\n\n---\n\n")}\n`);
console.log(`wrote ${outPath}`);
