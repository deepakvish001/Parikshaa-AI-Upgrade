import { writeFileSync } from "node:fs";
import { casesOf, type EvalCase } from "./cases.js";
import { clientOf } from "./eval.js";
import { gradeOf, judge, JUDGE_MODEL } from "./grade.js";

/**
 * Does the grading tell right from wrong? Answers whose grade is known in
 * advance go through the same judge and checks as the tutor's: a worked
 * solution given as a rung-1 hint must fail, a review that names the hidden
 * mistake must pass, an empty or off-topic answer must fail. Costs only judge
 * calls. Prints each expectation and whether it held; exits 1 if any did not.
 *
 *   ANTHROPIC_API_KEY=... npx tsx packages/api/src/testing/sahayak-eval/judge-sanity.ts [out.json]
 */

interface Probe {
  readonly name: string;
  readonly c: EvalCase;
  readonly answer: string;
  /** Metric → the value it must get. */
  readonly expect: Readonly<Record<string, 0 | 1>>;
}

const find = (flow: "hint" | "review" | "doubt", id: string) => {
  const c = casesOf(flow).find((x) => x.id === id);
  if (c === undefined) throw new Error(`no ${flow} case ${id}`);
  return c;
};

function probes(): Probe[] {
  const hint1 = casesOf("hint").find((c) => c.flow === "hint" && c.rung === 1)!;
  const review = find("review", "count-inversions.overflow");
  const push = casesOf("doubt").find((c) => c.flow === "doubt" && c.doubt.kind === "push" && c.problem.slug === "trapped-rainwater")!;
  const concept = casesOf("doubt").find((c) => c.flow === "doubt" && c.doubt.kind === "concept" && c.problem.slug === "trapped-rainwater")!;
  const solution = (c: EvalCase) => `Here is the full solution:\n\n\`\`\`python\n${c.problem.reference}\`\`\``;
  if (review.flow !== "review") throw new Error("unreachable");
  return [
    { name: "hint: the worked solution at rung 1", c: hint1, answer: solution(hint1), expect: { leak_free: 0, within_rung: 0, no_code: 0 } },
    { name: "hint: the full approach in prose at rung 1", c: hint1, answer: `The approach: ${hint1.problem.editorial}`, expect: { leak_free: 0, within_rung: 0 } },
    { name: "hint: empty of substance", c: hint1, answer: "Keep trying, you can do it! Think carefully about the problem.", expect: { helpful: 0 } },
    {
      name: "review: names the hidden mistake and the complexity",
      c: review,
      answer: `Your merge-sort idea is right and runs in ${review.bug.time}, which is the best possible here. The bug: ${review.bug.mistake} Check the largest inputs, and a list in reverse order.`,
      expect: { bug_found: 1, complexity_right: 1, no_fixed_program: 1 },
    },
    { name: "review: \"looks good\"", c: review, answer: "This looks correct to me. Nice work!", expect: { bug_found: 0, complexity_right: 0 } },
    { name: "review: the corrected program", c: review, answer: `Here is the fixed version:\n\n\`\`\`python\n${review.problem.reference}\`\`\``, expect: { no_fixed_program: 0 } },
    { name: "review: an answer to a different problem", c: review, answer: "Your binary search misses the case where the target is the first element; also the time is O(log n).", expect: { bug_found: 0, complexity_right: 0 } },
    { name: "doubt (push): gives the solution", c: push, answer: solution(push), expect: { no_solution: 0 } },
    { name: "doubt (push): only refuses", c: push, answer: "Sorry, I cannot give you the solution.", expect: { no_solution: 1, answered: 0 } },
    { name: "doubt (concept): \"I don't know\"", c: concept, answer: "I don't know.", expect: { answered: 0 } },
    { name: "doubt: empty", c: concept, answer: "", expect: { answered: 0 } },
  ];
}

async function main() {
  const out = process.argv[2];
  const rows = [];
  let wrong = 0;
  for (const p of probes()) {
    const j = await judge(clientOf(), p.c, p.answer, process.env.SAHAYAK_EVAL_JUDGE ?? JUDGE_MODEL);
    const { grade, explanation } = gradeOf(p.c, p.answer, j);
    const misses = Object.entries(p.expect).filter(([k, v]) => grade[k] !== v);
    wrong += misses.length === 0 ? 0 : 1;
    rows.push({ name: p.name, case: p.c.id, expect: p.expect, grade, explanation, judge_model: j.model, judge_usage: j.usage, held: misses.length === 0 });
    console.log(`${misses.length === 0 ? "held  " : "BROKEN"} ${p.name}${misses.length === 0 ? "" : `: ${misses.map(([k, v]) => `${k} should be ${v}`).join(", ")}`}`);
  }
  if (out !== undefined) writeFileSync(out, JSON.stringify(rows, null, 2) + "\n");
  console.log(`${rows.length - wrong} of ${rows.length} held`);
  process.exit(wrong === 0 ? 0 : 1);
}

void main();
