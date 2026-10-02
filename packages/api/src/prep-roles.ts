import type { Question } from "@parikshaa/core";
import { patternsOf } from "./patterns.js";

/**
 * The job a learner prepares for (Prep blueprint S1, plan row 46). It never
 * reorders a track's modules, which build on each other: within each module
 * its problems on the role's topics come first, and some of the site's other
 * problems on them join the plan. A general SDE plan is the track as it is.
 */
export type PrepRole = "sde" | "backend" | "frontend" | "data";

export const PREP_ROLES: readonly { readonly slug: PrepRole; readonly name: string; readonly patterns: readonly string[]; readonly sql: boolean }[] = [
  { slug: "sde", name: "Software engineer (SDE)", patterns: [], sql: false },
  { slug: "backend", name: "Backend engineer", patterns: ["Hashing and counting", "Graphs", "Heaps", "Sorting"], sql: true },
  { slug: "frontend", name: "Frontend engineer", patterns: ["Strings", "Stacks and queues", "Recursion and backtracking", "Hashing and counting"], sql: false },
  { slug: "data", name: "Data analyst or data engineer", patterns: ["Prefix sums", "Sorting", "Hashing and counting", "Math"], sql: true },
];

export const ROLE_SLUGS: readonly string[] = PREP_ROLES.map((r) => r.slug);

/** Whether a problem is on one of the role's topics: a pattern of its tags, or SQL for a role that writes it. */
export function fitsRole(role: string | null, problem: { readonly tags: readonly string[]; readonly question: Question }): boolean {
  const r = PREP_ROLES.find((x) => x.slug === role);
  if (r === undefined) return false;
  if (r.sql && problem.question.kind === "code" && problem.question.language === "sql") return true;
  const patterns = patternsOf(problem.tags);
  return r.patterns.some((p) => patterns.includes(p));
}
