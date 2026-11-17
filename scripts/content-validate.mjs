#!/usr/bin/env node
/**
 * Content validator for bulk uploads (docs/content/CONTENT-FORMAT.md, tracker plan row 141).
 *
 *   node scripts/content-validate.mjs <bundle.json | folder | item.json>... [options]
 *
 *   --no-run          schema and semantic gates only (no runner)
 *   --only a,b        only these types (dsa-problem, sql-problem, mcq, lesson, project, system-design)
 *   --mutate          also mutate each DSA item's Python reference and report how many mutants the tests kill
 *   --json            print the report as JSON
 *   --pack out.json   write a single-file bundle (every $file inlined) after the checks pass
 *   --runner-url URL  use a runner that is already up (token from RUNNER_TOKEN); otherwise one is started from
 *                     packages/runner/dist/main.js with RUNNER_ISOLATION=unsafe-none: a developer's tool only,
 *                     the code it runs is the content author's own.
 *
 * Producing steps (generators' test inputs, the input validator, the Python reference's expected outputs, SQL
 * datasets and expected rows) run on the runner with fullOutput, which returns a test's whole output (up to the
 * runner's 1 MiB) instead of the few kilobytes a report keeps. Judging steps (every solution against every test) run
 * there too. Only MCQ and estimate solvers run with the local python3: their output is one short line, and an
 * MCQ-only bundle then needs no runner. Exit code 0 when every item passes, 1 when any fails, 2 on a usage or setup
 * error. No dependencies beyond Node and python3 (and gcc, g++, javac/java, node for the runner).
 */
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_DIR = join(ROOT, "docs", "content", "schema");
const RUNNER_MAIN = join(ROOT, "packages", "runner", "dist", "main.js");
const TYPES = ["dsa-problem", "sql-problem", "mcq", "lesson", "project", "system-design"];
const MIB = 1024 * 1024;
const LANGS = ["c", "cpp", "java", "python", "javascript"];

// ---------------------------------------------------------------------------------------------------------------
// A small JSON Schema checker: the subset the schemas in docs/content/schema use. A schema using any other keyword
// is refused, so the schemas cannot quietly say more than this checks.

const KEYWORDS = new Set([
  "$schema", "$id", "$comment", "$defs", "$ref", "title", "description", "default", "examples",
  "type", "properties", "required", "additionalProperties", "propertyNames", "items", "enum", "const",
  "minLength", "maxLength", "pattern", "minimum", "maximum", "minItems", "maxItems", "uniqueItems", "oneOf", "anyOf", "allOf",
]);

export function loadSchemas(dir = SCHEMA_DIR) {
  const schemas = {};
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".schema.json"))) {
    schemas[name] = JSON.parse(readFileSync(join(dir, name), "utf8"));
    checkKeywords(schemas[name], name);
  }
  return schemas;
}

function checkKeywords(schema, where) {
  if (typeof schema !== "object" || schema === null) return;
  for (const [key, value] of Object.entries(schema)) {
    if (key.startsWith("x-")) continue;
    if (!KEYWORDS.has(key)) throw new Error(`${where}: schema keyword "${key}" is not supported by the validator`);
    if (key === "properties" || key === "$defs") for (const [k, v] of Object.entries(value)) checkKeywords(v, `${where}/${key}/${k}`);
    else if (key === "items" || key === "propertyNames" || (key === "additionalProperties" && typeof value === "object")) checkKeywords(value, `${where}/${key}`);
    else if (key === "oneOf" || key === "anyOf" || key === "allOf") value.forEach((v, i) => checkKeywords(v, `${where}/${key}/${i}`));
  }
}

const typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "number" ? (Number.isInteger(v) ? "integer" : "number") : typeof v);
const typeMatches = (v, t) => t === typeOf(v) || (t === "number" && typeof v === "number");

export function validateSchema(value, schema, schemas, file, path = "", errors = []) {
  if (schema.$ref !== undefined) {
    const [refFile, pointer = ""] = schema.$ref.split("#");
    const target = refFile === "" ? file : refFile;
    let node = schemas[target];
    if (node === undefined) throw new Error(`schema ${target} not found (from ${file})`);
    for (const seg of pointer.split("/").slice(1)) node = node?.[seg];
    if (node === undefined) throw new Error(`schema ref ${schema.$ref} not found (from ${file})`);
    validateSchema(value, node, schemas, target, path, errors);
  }
  const at = path === "" ? "(item)" : path;
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(value, t))) {
      errors.push(`${at}: expected ${types.join(" or ")}, got ${typeOf(value)}`);
      return errors;
    }
  }
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) errors.push(`${at}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum !== undefined && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) errors.push(`${at}: must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(", ")}`);
  if (typeof value === "string") {
    const length = [...value].length;
    if (schema.minLength !== undefined && length < schema.minLength) errors.push(`${at}: shorter than ${schema.minLength} characters`);
    if (schema.maxLength !== undefined && length > schema.maxLength) errors.push(`${at}: longer than ${schema.maxLength} characters`);
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, "u").test(value)) errors.push(`${at}: does not match ${schema.pattern}`);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${at}: below ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${at}: above ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${at}: fewer than ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${at}: more than ${schema.maxItems} items`);
    if (schema.uniqueItems === true && new Set(value.map((v) => JSON.stringify(v))).size !== value.length) errors.push(`${at}: items repeat`);
    if (schema.items !== undefined) value.forEach((v, i) => validateSchema(v, schema.items, schemas, file, `${path}[${i}]`, errors));
  }
  if (typeOf(value) === "object") {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${at}: missing "${key}"`);
    const props = schema.properties ?? {};
    for (const [key, v] of Object.entries(value)) {
      const child = path === "" ? key : `${path}.${key}`;
      if (schema.propertyNames !== undefined) validateSchema(key, schema.propertyNames, schemas, file, `${child} (name)`, errors);
      if (props[key] !== undefined) validateSchema(v, props[key], schemas, file, child, errors);
      else if (schema.additionalProperties === false) errors.push(`${at}: unknown field "${key}"`);
      else if (typeof schema.additionalProperties === "object") validateSchema(v, schema.additionalProperties, schemas, file, child, errors);
    }
  }
  for (const s of schema.allOf ?? []) validateSchema(value, s, schemas, file, path, errors);
  for (const [key, need] of [["oneOf", 1], ["anyOf", 0]]) {
    if (schema[key] === undefined) continue;
    const tries = schema[key].map((s) => validateSchema(value, s, schemas, file, path, []));
    const ok = tries.filter((t) => t.length === 0).length;
    if ((need === 1 && ok !== 1) || (need === 0 && ok === 0)) {
      const best = tries.reduce((a, b) => (b.length < a.length ? b : a));
      errors.push(ok > 1 ? `${at}: matches more than one form` : `${at}: matches none of the allowed forms; closest: ${best.slice(0, 3).join("; ")}`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------------------------------------------
// Loading: a single-file bundle, a folder (with or without manifest.json), or one item file. In a folder, any
// string may be {"$file": "relative/path"}, read relative to the JSON file that holds it.

function resolveFiles(value, baseDir, root, problems, where) {
  if (Array.isArray(value)) return value.map((v, i) => resolveFiles(v, baseDir, root, problems, `${where}[${i}]`));
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === "$file") {
      const target = resolve(baseDir, value.$file);
      if (!(target === root || target.startsWith(root + sep))) {
        problems.push(`${where}: $file ${value.$file} is outside the bundle`);
        return "";
      }
      const text = readText(target);
      if (typeof text !== "string") {
        problems.push(`${where}: $file ${value.$file} ${text === null ? "is a folder" : "not found"}`);
        return "";
      }
      return text;
    }
    return Object.fromEntries(keys.map((k) => [k, resolveFiles(value[k], baseDir, root, problems, where === "" ? k : `${where}.${k}`)]));
  }
  return value;
}

// Reads a file without checking for it first: a check and then a read races a change made in between.
// undefined: no such file; null: a folder.
function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return undefined;
    if (e.code === "EISDIR") return null;
    throw e;
  }
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

export function loadContent(paths) {
  const items = [];
  const manifests = [];
  const problems = [];
  for (const p of paths) {
    const full = resolve(p);
    const text = readText(full);
    if (text === undefined) {
      problems.push(`${p}: not found`);
      continue;
    }
    if (text === null) {
      const manifestPath = join(full, "manifest.json");
      const manifestText = readText(manifestPath);
      if (typeof manifestText === "string") {
        try {
          manifests.push({ file: manifestPath, data: JSON.parse(manifestText) });
        } catch (e) {
          problems.push(`${relative(ROOT, manifestPath)}: not JSON (${e.message})`);
        }
      }
      for (const file of walk(full)) {
        if (file === manifestPath) continue;
        let data;
        try {
          data = JSON.parse(readFileSync(file, "utf8"));
        } catch (e) {
          problems.push(`${relative(ROOT, file)}: not JSON (${e.message})`);
          continue;
        }
        if (typeof data?.schema !== "string" || !data.schema.startsWith("parikshaa.content/") || data.schema.startsWith("parikshaa.content/bundle")) continue;
        const local = [];
        const item = resolveFiles(data, dirname(file), full, local, "");
        items.push({ item, file, problems: local });
      }
    } else {
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        problems.push(`${p}: not JSON (${e.message})`);
        continue;
      }
      if (data?.schema === "parikshaa.content/bundle@1") {
        manifests.push({ file: full, data });
        for (const [i, item] of (data.items ?? []).entries()) items.push({ item, file: `${full}#items[${i}]`, problems: [] });
      } else {
        const local = [];
        items.push({ item: resolveFiles(data, dirname(full), dirname(full), local, ""), file: full, problems: local });
      }
    }
  }
  return { items, manifests, problems };
}

const typeName = (item) => /^parikshaa\.content\/([a-z-]+)@1$/.exec(item?.schema ?? "")?.[1] ?? null;

// ---------------------------------------------------------------------------------------------------------------
// Variants: sets[0] is the default. Every string gets {{name}} replaced, for the declared names only.

export function expandVariants(item) {
  const v = item.variants;
  if (v === undefined) return [{ index: 0, values: null, item }];
  const names = new Set(v.params.map((p) => p.name));
  return v.sets.map((set, index) => {
    const sub = (x) =>
      typeof x === "string"
        ? x.replace(/\{\{([a-z][a-z0-9_]{0,30})\}\}/g, (m, name) => (names.has(name) && name in set ? String(set[name]) : m))
        : Array.isArray(x)
          ? x.map(sub)
          : x !== null && typeof x === "object"
            ? Object.fromEntries(Object.entries(x).map(([k, val]) => [k, k === "variants" ? val : sub(val)]))
            : x;
    return { index, values: set, item: sub(item) };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Semantic gates.

const PROBLEM_SITES = /(leetcode\.com|geeksforgeeks\.org|interviewbit\.com|hackerrank\.com|codeforces\.com|codechef\.com|hackerearth\.com|indiabix\.com|takeuforward\.org|naukri\.com\/code360|codingninjas\.com|spoj\.com|atcoder\.jp|algoexpert\.io|educative\.io|neetcode\.io)/i;
const CLICHES = ["delve", "tapestry", "in today's fast-paced", "it's worth noting", "it is worth noting", "as an ai", "embark on", "unlock the power", "game-changer", "seamlessly", "in the realm of"];
const EDITORIAL_HEADINGS = {
  en: ["Problem", "Understand The Problem", "Coming Up With The Solution", "Writing The Solution", "Testing / Reflection"],
  "hi-Latn": ["Samasya", "Samasya samjho", "Hal tak pahuncho", "Code likho", "Jaancho aur seekho"],
};
const APTITUDE_HEADINGS = { en: ["Understand", "Plan", "Solve", "Check"], "hi-Latn": ["Samjho", "Plan", "Hal", "Jaancho"] };
const MIN_TESTS = { L0: 15, L1: 20, L2: 30, L3: 40, L4: 50 };
const LEVEL_DIFFICULTY = { L0: "easy", L1: "easy", L2: "medium", L3: "hard", L4: "hard" };

const stripCode = (md) => md.replace(/```[\s\S]*?```/g, " ");
export const countWords = (md) => stripCode(md).split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
const headings = (md, level) => stripCode(md).split("\n").filter((l) => l.startsWith("#".repeat(level) + " ")).map((l) => l.slice(level + 1).trim());
const allText = (item) => JSON.stringify(item);

function checkEditorial(md, lengthSpec, lang, errors, warnings, { needCodeTabs = true, visuals = [] } = {}) {
  const want = EDITORIAL_HEADINGS[lang] ?? EDITORIAL_HEADINGS.en;
  const h2 = headings(md, 2);
  if (JSON.stringify(h2) !== JSON.stringify(want)) errors.push(`editorial: ## headings must be exactly ${want.map((h) => `"${h}"`).join(", ")} in order; found ${h2.map((h) => `"${h}"`).join(", ") || "none"}`);
  const long = lengthSpec?.form === "long";
  const notes = (md.match(/^> \*\*Note:\*\*/gm) ?? []).length;
  if (notes < (long ? 3 : 1)) errors.push(`editorial: ${notes} "> **Note:**" callouts, need at least ${long ? 3 : 1}`);
  const why = (md.match(/Why this example\?|Kyun ye example\?/g) ?? []).length;
  if (why < (long ? 3 : 1)) errors.push(`editorial: "Why this example?" appears ${why} times, need at least ${long ? 3 : 1}`);
  if (needCodeTabs && !md.includes("[[code-tabs]]")) errors.push("editorial: [[code-tabs]] missing (where the reference code goes)");
  for (const [, id] of md.matchAll(/\[\[visual:([a-z0-9-]+)\]\]/g)) if (!visuals.some((v) => v.id === id)) errors.push(`editorial: [[visual:${id}]] has no visual with that id`);
  const words = countWords(md);
  if (lengthSpec !== undefined) {
    if (words < 0.85 * lengthSpec.target_words) errors.push(`editorial: ${words} words, below 85% of the target ${lengthSpec.target_words}`);
    else if (words < lengthSpec.target_words) warnings.push(`editorial: ${words} words, under the target ${lengthSpec.target_words}`);
  }
  if (!/time complexity/i.test(md) && !/samay/i.test(md)) errors.push("editorial: no time complexity in Testing / Reflection");
  return words;
}

function checkCommon(item, errors, warnings) {
  const text = allText(item);
  const site = PROBLEM_SITES.exec(text);
  if (site !== null) errors.push(`links to another problem site (${site[1]}): use our own slugs in related`);
  const lower = text.toLowerCase();
  for (const c of CLICHES) if (lower.includes(c)) errors.push(`banned phrase "${c}" (EDITORIAL-STYLE section 6)`);
  if (item.level !== undefined && item.difficulty !== undefined && LEVEL_DIFFICULTY[item.level] !== item.difficulty) errors.push(`level ${item.level} goes with difficulty ${LEVEL_DIFFICULTY[item.level]}, not ${item.difficulty}`);
  if (item.variants !== undefined) {
    const names = item.variants.params.map((p) => p.name);
    item.variants.sets.forEach((set, i) => {
      const keys = Object.keys(set).sort();
      if (JSON.stringify(keys) !== JSON.stringify([...names].sort())) errors.push(`variants.sets[${i}] must give exactly ${names.join(", ")}`);
    });
    for (const n of names) if (!text.includes(`{{${n}}}`)) warnings.push(`variant parameter ${n} is never used as {{${n}}}`);
  }
}

function semanticDsa(item, errors, warnings) {
  for (const lang of item.languages) {
    if (item.starters[lang] === undefined) errors.push(`starters: no ${lang} starter`);
    if (!item.solutions.some((s) => s.role === "reference" && s.lang === lang)) errors.push(`solutions: no ${lang} reference`);
    if (item.limits.time_ms[lang] === undefined) errors.push(`limits.time_ms: no ${lang}`);
  }
  if (!item.solutions.some((s) => s.role === "reference" && s.lang === "python")) errors.push("solutions: a Python reference is required (it makes the expected outputs)");
  if (!item.solutions.some((s) => s.role === "brute")) errors.push("solutions: no brute");
  const wrong = item.solutions.filter((s) => s.role === "wrong");
  if (wrong.length < 2) errors.push(`solutions: ${wrong.length} wrong solutions, need at least 2`);
  for (const w of wrong) if (w.expect === undefined || w.why === undefined) errors.push("solutions: every wrong solution needs expect and why");
  if (item.hints.length < 3) errors.push(`hints: ${item.hints.length}, need 3`);
  const names = new Set((item.generators ?? []).map((g) => g.name));
  const count = {};
  let total = 0;
  for (const [i, g] of item.test_plan.entries()) {
    const n = (g.tests?.length ?? 0) + (g.gen !== undefined ? (g.args?.length ?? 0) : 0);
    if (n === 0) errors.push(`test_plan[${i}] (${g.group}): no tests`);
    if (g.gen !== undefined && !names.has(g.gen)) errors.push(`test_plan[${i}]: generator ${g.gen} not defined`);
    if (g.gen === undefined && g.args !== undefined) errors.push(`test_plan[${i}]: args without gen`);
    if (g.group === "samples" && g.hidden) errors.push("test_plan: samples must have hidden false");
    if (g.group !== "samples" && !g.hidden) warnings.push(`test_plan: group ${g.group} is visible`);
    if (g.group === "samples") for (const t of g.tests ?? []) if (!t.explanation) errors.push("test_plan: every sample needs an explanation");
    for (const t of g.tests ?? []) if (t.input.length > 2048) warnings.push(`test_plan: a literal ${g.group} test is over 2 KB; use a generator`);
    count[g.group] = (count[g.group] ?? 0) + n;
    total += n;
  }
  const need = { samples: 2, minimal: 2, boundary: 2, edge: 5, random_small: item.level === "L0" ? 5 : 10, random_large: 3, anti: 1 };
  for (const [group, min] of Object.entries(need)) if ((count[group] ?? 0) < min) errors.push(`test_plan: ${count[group] ?? 0} ${group} tests, need at least ${min}`);
  if (total < MIN_TESTS[item.level]) errors.push(`test_plan: ${total} tests in all, ${item.level} needs at least ${MIN_TESTS[item.level]}`);
  for (const a of ["brute", "optimal"]) if (!item.approaches.some((x) => x.name === a)) errors.push(`approaches: no ${a}`);
  checkEditorial(item.editorial, item.editorial_length, item.text_language, errors, warnings, { visuals: item.visuals ?? [] });
  const step2 = item.editorial.split(/^## /m)[3] ?? "";
  for (const h of ["Brute force", "Optimal"]) if (!headings("## " + step2, 3).some((x) => x.startsWith(h))) errors.push(`editorial: "### ${h}" missing in step 2`);
  if (!(item.visuals ?? []).some((v) => v.kind === "dry-run")) errors.push("visuals: at least one dry-run visual");
  if (!item.editorial.includes("[[visual:")) errors.push("editorial: no [[visual:...]] marker");
}

function semanticSql(item, errors, warnings) {
  const purposes = new Set(item.datasets.map((d) => d.purpose));
  for (const p of ["sample", "empty", "many-rows"]) if (!purposes.has(p)) errors.push(`datasets: no ${p} dataset`);
  if (/\bNULL\b/i.test(item.schema_sql) || !/NOT NULL/i.test(item.schema_sql)) if (!purposes.has("null")) warnings.push("datasets: no null dataset (add one when a column can be NULL)");
  if ((item.order_matters || /rank|top|highest|lowest|first|latest/i.test(item.stem)) && !purposes.has("ties")) errors.push("datasets: no ties dataset, and the order or ranking matters");
  if (!item.datasets.some((d) => !d.hidden)) errors.push("datasets: none is shown (hidden false)");
  if (!item.datasets.some((d) => d.hidden)) errors.push("datasets: none is hidden");
  for (const d of item.datasets) if ((d.rows_sql === undefined) === (d.gen === undefined)) errors.push(`datasets ${d.id}: give rows_sql or gen, not both or neither`);
  if (new Set(item.datasets.map((d) => d.id)).size !== item.datasets.length) errors.push("datasets: ids repeat");
  if (/\b(RIGHT|FULL)\s+(OUTER\s+)?JOIN\b/i.test(item.reference)) errors.push("reference: RIGHT/FULL JOIN is not in older SQLite");
  checkEditorial(item.editorial, item.editorial_length, item.text_language, errors, warnings);
}

function semanticMcq(item, errors, warnings) {
  if (item.kind === "mcq") {
    if (item.options === undefined || item.correct === undefined) errors.push("an mcq needs options and correct");
    else if (item.correct >= item.options.length) errors.push("correct is past the last option");
    for (const d of item.distractors ?? []) if (d.option === item.correct || d.option >= (item.options?.length ?? 0)) errors.push(`distractors: option ${d.option} is not a wrong option`);
    if (item.options !== undefined && (item.distractors ?? []).length < item.options.length - 1) warnings.push("distractors: not every wrong option says which mistake leads to it");
  } else if (item.answer === undefined) errors.push("a numeric question needs answer");
  if (item.section.startsWith("aptitude-")) {
    const want = APTITUDE_HEADINGS[item.text_language] ?? APTITUDE_HEADINGS.en;
    const h3 = headings(item.explanation, 3);
    if (JSON.stringify(h3) !== JSON.stringify(want)) errors.push(`explanation: ### headings must be ${want.join(", ")}; found ${h3.join(", ") || "none"}`);
  }
  if ((item.section === "aptitude-quant" || item.variants !== undefined) && item.solver === undefined) errors.push("solver: required for quant items and for items with variants");
}

function semanticLesson(item, errors, warnings) {
  const kinds = new Set(item.sections.map((s) => s.kind));
  for (const k of ["why", "concept", "misconception", "interview", "summary"]) if (!kinds.has(k)) errors.push(`sections: no ${k} section`);
  if (item.sections[0].kind !== "why") errors.push("sections: the first section is the why");
  for (const s of item.sections) if (s.kind === "interview" && (s.qa?.length ?? 0) < 2) errors.push("sections: the interview section needs 2+ qa pairs");
  for (const [i, q] of item.quiz.entries()) if (q.correct >= q.options.length) errors.push(`quiz[${i}]: correct is past the last option`);
  const words = countWords(item.sections.map((s) => s.body + " " + (s.qa ?? []).map((x) => x.q + " " + x.a).join(" ")).join("\n"));
  if (words < 800) errors.push(`sections: ${words} words, a lesson needs at least 800 (1,200-2,500 is the aim)`);
  else if (words < 1200) warnings.push(`sections: ${words} words, under the 1,200 aim`);
  const runnable = item.sections.flatMap((s) => s.code ?? []).filter((c) => c.expected_output !== undefined);
  for (const c of runnable) if (![...LANGS, "sql"].includes(c.lang)) errors.push(`code (${c.lang}): expected_output given but the runner has no ${c.lang}`);
  if (item.course.startsWith("lang-")) {
    if (runnable.length === 0) errors.push("a language lesson needs runnable examples with expected_output");
    if ((item.hands_on ?? []).length === 0) errors.push("a language lesson needs a hands_on task");
  }
  for (const h of item.hands_on ?? []) if (!h.tests.some((t) => t.hidden) || !h.tests.some((t) => !t.hidden)) errors.push(`hands_on ${h.id}: needs visible and hidden tests`);
  for (const s of item.sections) if (s.visual !== undefined && s.visual.alt.length < 15) errors.push("sections: a visual needs alt text");
}

function checkRubric(rubric, errors) {
  const sum = rubric.reduce((n, r) => n + r.weight, 0);
  if (sum !== 100) errors.push(`rubric: weights sum to ${sum}, not 100`);
  const ai = rubric.filter((r) => r.checked_by === "ai-feedback").reduce((n, r) => n + r.weight, 0);
  if (ai > 20) errors.push(`rubric: ai-feedback weighs ${ai}, at most 20`);
}

function checkFileSet(files, solutionFiles, order, language, where, errors) {
  const paths = new Set(files.map((f) => f.path));
  for (const f of solutionFiles) if (!paths.has(f.path)) errors.push(`${where}: solution file ${f.path} is not in files`);
  for (const p of order) if (!paths.has(p)) errors.push(`${where}: bundle_order names ${p}, which is not in files`);
  const code = { python: /\.py$/, javascript: /\.js$/, java: /\.java$/, c: /\.[ch]$/, cpp: /\.(cpp|cc|h|hpp)$/ }[language];
  for (const f of files) if (code.test(f.path) && !order.includes(f.path)) errors.push(`${where}: ${f.path} is not in bundle_order`);
  if ((language === "python" || language === "javascript") && files.some((f) => f.path.includes("/"))) errors.push(`${where}: ${language} project files must sit at the top level`);
  if (language === "java") {
    for (const f of [...files, ...solutionFiles]) {
      if (/^\s*package\s/m.test(f.content)) errors.push(`${where}: ${f.path} has a package line`);
      if (/^public\s+(?:final\s+|abstract\s+)*(?:class|interface|enum|record)\s+(?!Main\b)/m.test(f.content)) errors.push(`${where}: ${f.path}: only Main may be public`);
    }
  }
}

function semanticProject(item, errors) {
  checkRubric(item.rubric, errors);
  checkFileSet(item.files, item.solution_files, item.bundle_order, item.language, "files", errors);
  const milestones = new Set(item.milestones.map((m) => m.id));
  for (const t of item.tests) if (t.milestone !== undefined && !milestones.has(t.milestone)) errors.push(`tests ${t.id}: milestone ${t.milestone} does not exist`);
  if (!item.tests.some((t) => t.hidden) || !item.tests.some((t) => !t.hidden)) errors.push("tests: needs visible and hidden tests");
  if (new Set(item.tests.map((t) => t.id)).size !== item.tests.length) errors.push("tests: ids repeat");
}

function semanticDesign(item, errors) {
  checkRubric(item.rubric, errors);
  if (item.diagram === undefined) errors.push("diagram: required");
  if (item.mode === "hld") {
    if ((item.estimates ?? []).length < 3) errors.push("estimates: an HLD case needs at least 3");
    if ((item.expected_components ?? []).length < 6) errors.push("expected_components: an HLD case needs at least 6");
    if ((item.deep_dives ?? []).length < 2) errors.push("deep_dives: an HLD case needs at least 2");
  } else {
    if (item.kata === undefined) errors.push("kata: an LLD case needs one");
    if ((item.entities ?? []).length < 3) errors.push("entities: an LLD case needs at least 3");
    if ((item.patterns ?? []).length < 1) errors.push("patterns: an LLD case names at least one, with why");
    for (const [i, impl] of (item.kata?.implementations ?? []).entries()) {
      checkFileSet(impl.files, impl.solution_files, impl.bundle_order, impl.language, `kata.implementations[${i}]`, errors);
      if (item.kata.change_request !== undefined && impl.change_files === undefined) errors.push(`kata.implementations[${i}]: change_files missing for the change request`);
    }
    const langs = (item.kata?.implementations ?? []).map((i) => i.language);
    if (new Set(langs).size !== langs.length) errors.push("kata: one implementation per language");
  }
  for (const [i, q] of item.concept_checks.entries()) if (q.correct >= q.options.length) errors.push(`concept_checks[${i}]: correct is past the last option`);
}

const SEMANTIC = { "dsa-problem": semanticDsa, "sql-problem": semanticSql, mcq: semanticMcq, lesson: semanticLesson, project: semanticProject, "system-design": semanticDesign };

// ---------------------------------------------------------------------------------------------------------------
// Local python3, for MCQ and estimate solvers (one short line of output each).

function python(source, stdin, { timeoutMs = 60_000 } = {}) {
  const r = spawnSync("python3", ["-I", "-B", "-c", source], { input: stdin, encoding: "utf8", maxBuffer: 64 * MIB, timeout: timeoutMs, env: { PATH: process.env.PATH ?? "/usr/bin:/bin", LANG: "C.UTF-8" } });
  if (r.error !== undefined) return { ok: false, stdout: "", stderr: String(r.error.message) };
  return { ok: r.status === 0, stdout: r.stdout, stderr: r.stderr, status: r.status };
}

const norm = (s) => s.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n").replace(/\n+$/, "");
const sameOutput = (a, b, unordered) => (unordered ? norm(a).split("\n").sort().join("\n") === norm(b).split("\n").sort().join("\n") : norm(a) === norm(b));
const lastLine = (s) => String(s ?? "").trim().split("\n").pop();

// ---------------------------------------------------------------------------------------------------------------
// The runner: started locally from packages/runner/dist/main.js, or one already up.

const freePort = () =>
  new Promise((ok, fail) => {
    const s = createServer();
    s.once("error", fail);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });

export class Runner {
  constructor(url, token, child = null, workdir = null) {
    this.url = url;
    this.token = token;
    this.child = child;
    this.workdir = workdir;
    this.active = 0;
    this.queue = [];
    this.limit = 4;
  }

  static async start(options = {}) {
    if (options.url !== undefined) return new Runner(options.url.replace(/\/$/, ""), process.env.RUNNER_TOKEN ?? "");
    if (!existsSync(RUNNER_MAIN)) throw new Error(`${relative(ROOT, RUNNER_MAIN)} is missing: run "npm run build" first`);
    const token = randomBytes(24).toString("hex");
    const port = await freePort();
    const workdir = mkdtempSync(join(tmpdir(), "content-runner-"));
    const child = spawn(process.execPath, [RUNNER_MAIN], {
      env: { ...process.env, RUNNER_ISOLATION: "unsafe-none", RUNNER_TOKEN: token, PORT: String(port), RUNNER_WORKDIR: workdir },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    child.stdout.on("data", (d) => (log += d));
    child.stderr.on("data", (d) => (log += d));
    const runner = new Runner(`http://127.0.0.1:${port}`, token, child, workdir);
    for (let i = 0; i < 150; i++) {
      if (child.exitCode !== null) throw new Error(`the runner stopped: ${log}`);
      try {
        if ((await fetch(`${runner.url}/health`)).ok) return runner;
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    runner.stop();
    throw new Error(`the runner did not start: ${log}`);
  }

  stop() {
    this.child?.kill();
    if (this.workdir !== null) rmSync(this.workdir, { recursive: true, force: true });
  }

  async #slot(fn) {
    if (this.active >= this.limit) await new Promise((r) => this.queue.push(r));
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }

  async #post(body) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${this.url}/run`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${this.token}` }, body: JSON.stringify(body) });
      if (res.status === 503 && attempt < 20) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      if (!res.ok) throw new Error(`runner answered ${res.status}: ${await res.text()}`);
      return res.json();
    }
  }

  /** Runs every test, in batches the runner takes (100 tests, about 40 MB). */
  async run({ language, source, tests, timeMs = 2000, memoryMb = 256, checker, fullOutput = false }) {
    const batches = [];
    let batch = [];
    let size = 0;
    for (const t of tests) {
      const bytes = t.input.length + t.expected.length;
      if (batch.length > 0 && (batch.length >= 100 || size + bytes > 40 * MIB)) {
        batches.push(batch);
        batch = [];
        size = 0;
      }
      batch.push({ id: t.id, input: t.input, expected: t.expected });
      size += bytes;
    }
    if (batch.length > 0 || tests.length === 0) batches.push(batch);
    const results = [];
    for (const b of batches) {
      const body = { language, source, tests: b, limits: { timeMs: Math.min(10_000, Math.max(100, Math.round(timeMs))), memoryMb: Math.min(1024, Math.max(32, memoryMb)) } };
      if (checker !== undefined && checker.kind !== "exact") body.checker = checker;
      if (fullOutput) body.fullOutput = true;
      const r = await this.#slot(() => this.#post(body));
      if (!r.compiled) return { compiled: false, compileOutput: r.compileOutput, tests: [] };
      results.push(...r.tests);
    }
    return { compiled: true, tests: results };
  }

  /**
   * Runs a producing program (a generator, an input validator, the reference that makes the expected outputs) once
   * per input and returns each run's whole standard output (RunRequest.fullOutput). ok: it exited 0, whatever it
   * printed.
   */
  async produce({ language, source, inputs, timeMs = 10_000, memoryMb = 512 }) {
    const tests = inputs.map((input, i) => ({ id: `p${i + 1}`, input, expected: "" }));
    const r = await this.run({ language, source, tests, timeMs, memoryMb, fullOutput: true });
    if (!r.compiled) return inputs.map(() => ({ ok: false, stdout: "", stderr: String(r.compileOutput) }));
    return r.tests.map((t) => ({ ok: t.status === "passed" || t.status === "wrong_answer", stdout: t.stdout, stderr: t.stderr || (verdict[t.status] ?? t.status), status: t.status }));
  }
}

const verdict = { passed: "OK", wrong_answer: "WA", time_limit: "TLE", memory_limit: "MLE", runtime_error: "RE", output_limit: "OLE", checker_error: "CHECKER" };
const summarise = (r) => {
  if (!r.compiled) return `does not compile: ${String(r.compileOutput).split("\n").slice(0, 4).join(" | ")}`;
  const bad = r.tests.filter((t) => t.status !== "passed");
  const shown = bad.slice(0, 4).map((t) => `${t.id} ${verdict[t.status] ?? t.status}${t.stderr ? ` (${t.stderr.trim().split("\n").pop().slice(0, 120)})` : ""}`);
  return `${r.tests.length - bad.length}/${r.tests.length} passed; ${shown.join(", ")}${bad.length > 4 ? ", ..." : ""}`;
};
const allPassed = (r) => r.compiled && r.tests.every((t) => t.status === "passed");
const runChecker = (c) => (c === undefined ? undefined : c.kind === "custom" ? { kind: "custom", source: c.source } : c);

// ---------------------------------------------------------------------------------------------------------------
// Joining a project's files into the runner's one source (CONTENT-FORMAT.md section 8).

export function bundleFiles(language, files, overrides, order) {
  const byPath = new Map(files.map((f) => [f.path, f.content]));
  for (const f of overrides ?? []) byPath.set(f.path, f.content);
  const entry = order[order.length - 1];
  const modules = order.slice(0, -1);
  const name = (p) => basename(p).replace(/\.[a-z]+$/, "");
  if (language === "python") {
    const src = Object.fromEntries(modules.map((p) => [name(p), byPath.get(p)]));
    return [
      "import sys as _sys, importlib.abc as _abc, importlib.util as _util",
      `_SOURCES = ${JSON.stringify(src)}`,
      "class _Bundled(_abc.MetaPathFinder, _abc.Loader):",
      "    def find_spec(self, fullname, path, target=None):",
      "        return _util.spec_from_loader(fullname, self) if fullname in _SOURCES else None",
      "    def create_module(self, spec):",
      "        return None",
      "    def exec_module(self, module):",
      "        exec(compile(_SOURCES[module.__name__], module.__name__ + '.py', 'exec'), module.__dict__)",
      "_sys.meta_path.insert(0, _Bundled())",
      byPath.get(entry),
    ].join("\n");
  }
  if (language === "javascript") {
    const mods = modules.map((p) => `${JSON.stringify(name(p))}: function (module, exports, require) {\n${byPath.get(p)}\n}`).join(",\n");
    return [
      `const __sources = {\n${mods}\n};`,
      "const __cache = {};",
      "const __nodeRequire = require;",
      "function __require(p) {",
      "  if (!p.startsWith('./')) return __nodeRequire(p);",
      "  const key = p.slice(2).replace(/\\.js$/, '');",
      "  if (!(key in __sources)) throw new Error('Cannot find module ' + p);",
      "  if (!(key in __cache)) { const module = { exports: {} }; __cache[key] = module; __sources[key](module, module.exports, __require); }",
      "  return __cache[key].exports;",
      "}",
      `(function (require) {\n${byPath.get(entry)}\n})(__require);`,
    ].join("\n");
  }
  if (language === "java") {
    const imports = new Set();
    const bodies = order.map((p) =>
      byPath
        .get(p)
        .split("\n")
        .filter((l) => {
          const m = /^\s*import\s+[\w.*]+\s*;\s*$/.exec(l);
          if (m) imports.add(l.trim());
          return !m;
        })
        .join("\n"),
    );
    return [...imports, "", ...bodies].join("\n");
  }
  const local = new Set(order.map((p) => basename(p)));
  return order
    .map((p) =>
      byPath
        .get(p)
        .split("\n")
        .filter((l) => {
          const inc = /^\s*#\s*include\s*"([^"]+)"/.exec(l);
          return !(inc && local.has(basename(inc[1]))) && !/^\s*#\s*pragma\s+once/.test(l);
        })
        .join("\n"),
    )
    .join("\n");
}

// ---------------------------------------------------------------------------------------------------------------
// Running gates.

async function buildDsaTests(item, setIndex, runner, errors) {
  const gens = new Map((item.generators ?? []).map((g) => [g.name, g]));
  const tests = [];
  const wanted = new Map(); // generator name -> the tests it makes, in order
  for (const g of item.test_plan) {
    let n = 0;
    const brute = g.brute ?? ["samples", "minimal", "edge", "random_small", "output_edge"].includes(g.group);
    for (const t of g.tests ?? []) tests.push({ id: `${g.group}-${++n}`, group: g.group, hidden: g.hidden, brute, input: t.input, given: t.expected, explanation: t.explanation });
    if (g.gen !== undefined && gens.has(g.gen)) {
      for (const args of g.args ?? []) {
        const t = { id: `${g.group}-${++n}`, group: g.group, hidden: g.hidden, brute, input: null, args };
        tests.push(t);
        if (!wanted.has(g.gen)) wanted.set(g.gen, []);
        wanted.get(g.gen).push(t);
      }
    }
  }
  // Generators: one run each on the runner, one test per argument line, whole output kept.
  await Promise.all(
    [...wanted].map(async ([name, list]) => {
      const outs = await runner.produce({ language: "python", source: gens.get(name).src, inputs: list.map((t) => t.args.join(" ") + "\n") });
      list.forEach((t, i) => {
        if (outs[i].ok) t.input = outs[i].stdout;
        else errors.push(`generator ${name} ${t.args.join(" ")}: failed: ${lastLine(outs[i].stderr)}`);
      });
    }),
  );
  if (errors.length > 0) return tests;
  for (const t of tests) if (Buffer.byteLength(t.input) > MIB) errors.push(`test ${t.id}: input over 1 MiB (runner limit)`);
  if (errors.length > 0) return tests;
  const inputs = tests.map((t) => t.input);
  if (item.validator !== undefined) {
    const checked = await runner.produce({ language: "python", source: item.validator.src, inputs });
    checked.forEach((v, i) => {
      if (!v.ok) errors.push(`test ${tests[i].id} breaks the constraints (validator): ${lastLine(v.stderr)}`);
    });
  }
  const reference = item.solutions.find((s) => s.role === "reference" && s.lang === "python");
  const made = await runner.produce({ language: "python", source: reference.src, inputs, memoryMb: item.limits.memory_mb });
  made.forEach((out, i) => {
    const t = tests[i];
    if (!out.ok) {
      errors.push(`Python reference fails on ${t.id}: ${lastLine(out.stderr)}`);
      t.expected = "";
      return;
    }
    t.expected = out.stdout;
    if (setIndex === 0 && t.given !== undefined && !sameOutput(t.given, t.expected, item.checker?.kind === "unordered")) errors.push(`test ${t.id}: the given expected output differs from the reference's`);
  });
  return tests;
}

function wrongMatches(expect, r) {
  if (!r.compiled) return expect === "FAIL" || expect === "RE";
  const statuses = new Set(r.tests.map((t) => t.status));
  return { WA: statuses.has("wrong_answer"), TLE: statuses.has("time_limit"), RE: statuses.has("runtime_error"), MLE: statuses.has("memory_limit") || statuses.has("runtime_error"), FAIL: [...statuses].some((s) => s !== "passed") }[expect];
}

function mutants(src) {
  const ops = [
    [/<=/g, "<"], [/>=/g, ">"], [/(?<![<>=!])<(?![<=])/g, "<="], [/(?<![<>=!-])>(?![>=])/g, ">="], [/==/g, "!="], [/!=/g, "=="],
    [/\+ 1\b/g, "+ 2"], [/- 1\b/g, "- 2"], [/\band\b/g, "or"], [/\bor\b/g, "and"], [/\bmin\(/g, "max("], [/\bmax\(/g, "min("], [/\+=/g, "-="],
  ];
  const lines = src.split("\n");
  const out = [];
  lines.forEach((line, i) => {
    const code = line.replace(/#.*$/, "");
    if (/^\s*(?:import|from)\s/.test(code) || /sys\.stdin|input\(|print\(/.test(code) || code.trim() === "") return;
    for (const [re, rep] of ops) {
      for (const m of code.matchAll(re)) {
        const changed = line.slice(0, m.index) + rep + line.slice(m.index + m[0].length);
        out.push({ line: i + 1, src: [...lines.slice(0, i), changed, ...lines.slice(i + 1)].join("\n") });
      }
    }
  });
  if (out.length <= 60) return out;
  const step = out.length / 60;
  return Array.from({ length: 60 }, (_, k) => out[Math.floor(k * step)]);
}

async function runDsa(item, runner, report, options) {
  for (const { index, item: it } of expandVariants(item)) {
    const tag = item.variants === undefined ? "" : ` [set ${index}]`;
    const errors = [];
    const tests = await buildDsaTests(it, index, runner, errors);
    report.errors.push(...errors.map((e) => e + tag));
    if (errors.length > 0) continue;
    const judge = (t) => ({ id: t.id, input: t.input, expected: t.expected });
    const timeOf = (lang) => it.limits.time_ms[lang] ?? 2000;
    const jobs = it.solutions.map(async (s) => {
      const subset = s.role === "brute" ? tests.filter((t) => t.brute) : tests;
      const r = await runner.run({ language: s.lang, source: s.src, tests: subset.map(judge), timeMs: s.role === "brute" ? Math.max(timeOf(s.lang), 5000) : timeOf(s.lang), memoryMb: it.limits.memory_mb, checker: runChecker(it.checker) });
      if (s.role === "wrong") {
        if (allPassed(r)) report.errors.push(`wrong solution (${s.lang}, ${s.why}) passes every test: the tests are too weak${tag}`);
        else if (!wrongMatches(s.expect, r)) report.errors.push(`wrong solution (${s.lang}, ${s.why}) fails, but not with ${s.expect}: ${summarise(r)}${tag}`);
        else report.stats.wrongCaught = (report.stats.wrongCaught ?? 0) + 1;
      } else if (!allPassed(r)) report.errors.push(`${s.role} (${s.lang}) does not pass: ${summarise(r)}${tag}`);
      else {
        const slowest = Math.max(0, ...r.tests.map((t) => t.timeMs));
        if (s.role === "reference") {
          report.stats.refsPassed = (report.stats.refsPassed ?? 0) + 1;
          if (slowest > timeOf(s.lang) * (s.lang === "cpp" || s.lang === "c" ? 0.25 : 0.5)) report.warnings.push(`reference (${s.lang}) slowest test ${slowest} ms is over ${s.lang === "cpp" || s.lang === "c" ? "25" : "50"}% of its time limit${tag}`);
        }
      }
    });
    const starterJobs = Object.entries(it.starters).map(async ([lang, src]) => {
      const sample = tests.filter((t) => t.group === "samples" || t.group === "minimal");
      const r = await runner.run({ language: lang, source: src, tests: sample.map(judge), timeMs: timeOf(lang), memoryMb: it.limits.memory_mb, checker: runChecker(it.checker) });
      if (!r.compiled) report.errors.push(`starter (${lang}) does not compile: ${summarise(r)}${tag}`);
      else if (allPassed(r)) report.errors.push(`starter (${lang}) already passes the samples${tag}`);
    });
    await Promise.all([...jobs, ...starterJobs]);
    report.stats.tests = tests.length;
    if (options.mutate && index === 0) {
      const ref = it.solutions.find((s) => s.role === "reference" && s.lang === "python");
      let killed = 0;
      const ms = mutants(ref.src);
      const survivors = [];
      await Promise.all(
        ms.map(async (m) => {
          const r = await runner.run({ language: "python", source: m.src, tests: tests.map(judge), timeMs: timeOf("python"), memoryMb: it.limits.memory_mb, checker: runChecker(it.checker) });
          if (allPassed(r)) survivors.push(m.line);
          else killed++;
        }),
      );
      report.stats.mutation = `${killed}/${ms.length}`;
      if (ms.length > 0 && killed / ms.length < 0.95) report.warnings.push(`mutation: ${killed}/${ms.length} killed (goal 95%); survivors on lines ${[...new Set(survivors)].sort((a, b) => a - b).join(", ")}: check each is an equivalent mutant`);
    }
  }
}

async function runSql(item, runner, report) {
  for (const { index, item: it } of expandVariants(item)) {
    const tag = item.variants === undefined ? "" : ` [set ${index}]`;
    const unordered = !it.order_matters;
    // Datasets made by a generator: run on the runner, whole output kept.
    const made = new Map();
    await Promise.all(
      it.datasets
        .filter((d) => d.gen !== undefined)
        .map(async (d) => {
          const [g] = await runner.produce({ language: "python", source: d.gen.src, inputs: [(d.gen.args ?? "") + "\n"] });
          if (g.ok) made.set(d.id, g.stdout);
          else report.errors.push(`dataset ${d.id}: generator failed: ${lastLine(g.stderr)}${tag}`);
        }),
    );
    const ready = it.datasets.filter((d) => d.gen === undefined || made.has(d.id));
    const inputs = ready.map((d) => `${it.schema_sql.trim()}\n${d.gen === undefined ? d.rows_sql : made.get(d.id)}`);
    const rows = await runner.produce({ language: "sql", source: it.reference, inputs, timeMs: 5000 });
    const tests = [];
    ready.forEach((d, i) => {
      const input = inputs[i];
      const out = rows[i];
      if (Buffer.byteLength(input) > MIB) report.errors.push(`dataset ${d.id}: over 1 MiB${tag}`);
      if (!out.ok) {
        report.errors.push(`reference fails on dataset ${d.id}: ${lastLine(out.stderr)}${tag}`);
        return;
      }
      if (index === 0 && d.expected !== undefined && !sameOutput(d.expected, out.stdout, unordered)) report.errors.push(`dataset ${d.id}: the given expected rows differ from the reference's${tag}`);
      if (d.purpose === "empty" && norm(out.stdout) !== "" && !/COUNT|SUM|TOTAL|COALESCE/i.test(it.reference)) report.warnings.push(`dataset ${d.id} (empty) gives rows${tag}`);
      tests.push({ id: d.id, input, expected: out.stdout });
    });
    if (tests.length !== it.datasets.length) continue;
    const distinct = new Set(tests.map((t) => norm(t.expected)));
    if (distinct.size < Math.min(3, tests.length)) report.warnings.push(`only ${distinct.size} different expected outputs across datasets${tag}`);
    const checker = unordered ? { kind: "unordered" } : undefined;
    const right = [it.reference, ...(it.alternatives ?? [])];
    await Promise.all([
      ...right.map(async (q, i) => {
        const r = await runner.run({ language: "sql", source: q, tests, timeMs: 5000, checker });
        if (!allPassed(r)) report.errors.push(`${i === 0 ? "reference" : `alternative ${i}`} does not pass: ${summarise(r)}${tag}`);
        else report.stats.refsPassed = (report.stats.refsPassed ?? 0) + 1;
      }),
      ...it.wrong.map(async (w) => {
        const r = await runner.run({ language: "sql", source: w.src, tests, timeMs: 5000, checker });
        if (allPassed(r)) report.errors.push(`wrong query (${w.why}) passes every dataset: add a dataset that catches it${tag}`);
        else report.stats.wrongCaught = (report.stats.wrongCaught ?? 0) + 1;
      }),
    ]);
    const starter = await runner.run({ language: "sql", source: it.starter.trim() === "" ? "SELECT 1;" : it.starter, tests: tests.slice(0, 2), timeMs: 5000, checker });
    if (allPassed(starter)) report.errors.push(`starter already passes${tag}`);
    report.stats.tests = tests.length;
  }
}

function runMcq(item, report) {
  if (item.solver === undefined) return;
  for (const { index, values, item: it } of expandVariants(item)) {
    const tag = item.variants === undefined ? "" : ` [set ${index}]`;
    const out = python(it.solver, JSON.stringify(values ?? {}));
    if (!out.ok) {
      report.errors.push(`solver fails: ${out.stderr.trim().split("\n").pop()}${tag}`);
      continue;
    }
    let got;
    try {
      got = JSON.parse(out.stdout.trim().split("\n").pop());
    } catch {
      report.errors.push(`solver output is not one line of JSON: ${out.stdout.slice(0, 80)}${tag}`);
      continue;
    }
    // Derived values (the solver's "values") fill {{name}} in the stem, options and explanation for this set.
    const derived = got.values ?? {};
    const fill = (s) => String(s).replace(/\{\{([a-z][a-z0-9_]{0,30})\}\}/g, (m, n) => (n in derived ? String(derived[n]) : m));
    const shown = [it.stem, it.explanation, ...(it.options ?? [])].map(fill);
    const left = shown.join("\n").match(/\{\{[a-z][a-z0-9_]*\}\}/);
    if (left !== null) report.errors.push(`${left[0]} is not filled for this set (a parameter, or a value the solver prints)${tag}`);
    if (it.kind === "numeric") {
      if (typeof got.answer !== "number") report.errors.push(`solver's answer is not a number${tag}`);
      else if (index === 0 && Math.abs(got.answer - it.answer) > Math.max(it.tolerance ?? 0, 1e-9)) report.errors.push(`solver says ${got.answer}, the key is ${it.answer}${tag}`);
      else report.stats.solver = "ok";
      continue;
    }
    const options = it.options.map(fill);
    if (new Set(options).size !== options.length) report.errors.push(`options repeat for this set: ${options.join(" | ")}${tag}`);
    if (String(got.answer).trim() !== options[it.correct].trim()) report.errors.push(`solver says "${got.answer}", the key is "${options[it.correct]}"${tag}`);
    report.stats.solver = "ok";
  }
}

async function runCode(runner, report, label, { language, source, tests, timeMs = 3000, checker, mustPass = true }) {
  const r = await runner.run({ language, source, tests, timeMs, checker: runChecker(checker) });
  if (mustPass && !allPassed(r)) report.errors.push(`${label} does not pass: ${summarise(r)}`);
  if (!mustPass) {
    if (!r.compiled) report.errors.push(`${label} does not compile: ${summarise(r)}`);
    else if (allPassed(r)) report.errors.push(`${label} already passes every test`);
  }
  return r;
}

async function runLesson(item, runner, report) {
  const jobs = [];
  let blocks = 0;
  for (const s of item.sections) {
    for (const c of s.code ?? []) {
      if (c.expected_output === undefined) continue;
      blocks++;
      jobs.push(runCode(runner, report, `code block in "${s.heading}" (${c.lang})`, { language: c.lang, source: c.src, tests: [{ id: "run", input: c.stdin ?? "", expected: c.expected_output }] }));
    }
  }
  for (const h of item.hands_on ?? []) {
    jobs.push(runCode(runner, report, `hands_on ${h.id} solution`, { language: h.lang, source: h.solution, tests: h.tests, checker: h.checker }));
    jobs.push(runCode(runner, report, `hands_on ${h.id} starter`, { language: h.lang, source: h.starter, tests: h.tests, checker: h.checker, mustPass: false }));
  }
  await Promise.all(jobs);
  report.stats.codeBlocks = blocks;
}

async function runProject(item, runner, report) {
  const timeMs = item.limits?.time_ms ?? 3000;
  for (const { index, item: it } of expandVariants(item)) {
    const tag = item.variants === undefined ? "" : ` [set ${index}]`;
    await Promise.all([
      runCode(runner, report, `solution${tag}`, { language: it.language, source: bundleFiles(it.language, it.files, it.solution_files, it.bundle_order), tests: it.tests, timeMs, checker: it.checker }),
      runCode(runner, report, `starter${tag}`, { language: it.language, source: bundleFiles(it.language, it.files, [], it.bundle_order), tests: it.tests, timeMs, checker: it.checker, mustPass: false }),
    ]);
  }
  report.stats.tests = item.tests.length;
}

async function runDesign(item, runner, report) {
  for (const e of item.estimates ?? []) {
    if (e.solver === undefined) continue;
    const out = python(e.solver, "{}");
    const got = Number(out.stdout.trim().split("\n").pop());
    if (!out.ok || !Number.isFinite(got)) report.errors.push(`estimate ${e.id}: solver failed`);
    else if (Math.abs(got - e.answer) > Math.abs(e.answer) * 1e-9 + 1e-9) report.errors.push(`estimate ${e.id}: solver says ${got}, answer is ${e.answer}`);
  }
  if (item.kata === undefined) return;
  const k = item.kata;
  const change = k.change_request?.tests ?? [];
  await Promise.all(
    k.implementations.map(async (impl) => {
      const L = impl.language;
      await runCode(runner, report, `kata ${L} solution`, { language: L, source: bundleFiles(L, impl.files, impl.solution_files, impl.bundle_order), tests: k.tests });
      await runCode(runner, report, `kata ${L} starter`, { language: L, source: bundleFiles(L, impl.files, [], impl.bundle_order), tests: k.tests, mustPass: false });
      if (impl.change_files !== undefined && change.length > 0) {
        const merged = [...impl.solution_files.filter((f) => !impl.change_files.some((c) => c.path === f.path)), ...impl.change_files];
        await runCode(runner, report, `kata ${L} after the change request`, { language: L, source: bundleFiles(L, impl.files, merged, impl.bundle_order), tests: [...k.tests, ...change] });
        const before = await runner.run({ language: L, source: bundleFiles(L, impl.files, impl.solution_files, impl.bundle_order), tests: change });
        if (allPassed(before)) report.errors.push(`kata ${L}: the change request's tests already pass before the change`);
      }
    }),
  );
  report.stats.tests = k.tests.length + change.length;
}

// ---------------------------------------------------------------------------------------------------------------

function similarity(a, b) {
  const shingles = (s) => {
    const w = s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
    const out = new Set();
    for (let i = 0; i + 2 < w.length; i++) out.add(w.slice(i, i + 3).join(" "));
    return out;
  };
  const A = shingles(a);
  const B = shingles(b);
  if (A.size === 0 || B.size === 0) return 0;
  let common = 0;
  for (const x of A) if (B.has(x)) common++;
  return common / Math.min(A.size, B.size);
}

const mainText = (item) => item.statement ?? item.stem ?? item.scenario ?? item.brief ?? (item.sections ?? []).map((s) => s.body).join("\n");

export async function validate(paths, options = {}) {
  const schemas = loadSchemas();
  const { items, manifests, problems } = loadContent(paths);
  const reports = [];
  const global = [...problems];
  for (const m of manifests) {
    const errs = validateSchema(m.data, schemas["bundle.schema.json"], schemas, "bundle.schema.json");
    for (const e of errs) global.push(`${relative(ROOT, m.file)}: ${e}`);
  }
  const tracks = new Set(manifests.flatMap((m) => (m.data.manifest?.tracks ?? []).map((t) => t.slug)));
  const seen = new Map();
  for (const { item, file, problems: local } of items) {
    const type = typeName(item);
    const report = { slug: item?.slug ?? "(no slug)", type: type ?? "(unknown)", file: relative(ROOT, file.split("#")[0]) || file, errors: [...local], warnings: [], stats: {} };
    reports.push(report);
    if (type === null || !TYPES.includes(type)) {
      report.errors.push(`schema "${item?.schema}" is not a content type`);
      continue;
    }
    if (options.only !== undefined && !options.only.includes(type)) {
      report.skipped = true;
      continue;
    }
    report.errors.push(...validateSchema(item, schemas[`${type}.schema.json`], schemas, `${type}.schema.json`));
    if (report.errors.length > 0) continue;
    checkCommon(item, report.errors, report.warnings);
    SEMANTIC[type](item, report.errors, report.warnings);
    const space = type === "lesson" ? "lesson" : "problem";
    const key = `${space}:${item.slug}`;
    if (seen.has(key)) report.errors.push(`slug ${item.slug} is used twice (also ${seen.get(key)})`);
    else seen.set(key, report.file);
    for (const p of item.placement ?? []) if (tracks.size > 0 && !tracks.has(p.track)) report.warnings.push(`placement: track ${p.track} is not declared in the manifest`);
  }
  for (let i = 0; i < reports.length; i++) {
    for (let j = i + 1; j < reports.length; j++) {
      const a = items[i].item;
      const b = items[j].item;
      if (typeName(a) !== typeName(b) || reports[i].skipped || reports[j].skipped) continue;
      if (String(a.title).toLowerCase() === String(b.title).toLowerCase()) reports[j].errors.push(`same title as ${reports[i].slug}`);
      const ta = mainText(a);
      const tb = mainText(b);
      if (typeof ta === "string" && typeof tb === "string" && ta.length > 200 && similarity(ta, tb) > 0.5) reports[j].warnings.push(`text is very like ${reports[i].slug}: check it is not a duplicate`);
    }
  }
  const runnable = reports.filter((r) => !r.skipped && r.errors.length === 0);
  if (!options.noRun && runnable.length > 0) {
    const needsRunner = runnable.some((r) => r.type !== "mcq");
    const runner = needsRunner ? await Runner.start({ url: options.runnerUrl }) : null;
    try {
      for (const report of runnable) {
        const item = items[reports.indexOf(report)].item;
        const started = Date.now();
        if (report.type === "dsa-problem") await runDsa(item, runner, report, options);
        else if (report.type === "sql-problem") await runSql(item, runner, report);
        else if (report.type === "mcq") runMcq(item, report);
        else if (report.type === "lesson") await runLesson(item, runner, report);
        else if (report.type === "project") await runProject(item, runner, report);
        else await runDesign(item, runner, report);
        report.stats.seconds = Math.round((Date.now() - started) / 100) / 10;
        if (options.progress) options.progress(report);
      }
    } finally {
      runner?.stop();
    }
  }
  return { reports, global, items, manifests };
}

function format({ reports, global }) {
  const lines = [];
  for (const g of global) lines.push(`ERROR ${g}`);
  for (const r of reports) {
    if (r.skipped) continue;
    const stats = Object.entries(r.stats).map(([k, v]) => `${k} ${v}`).join(", ");
    lines.push(`${r.errors.length === 0 ? "PASS" : "FAIL"} ${r.type} ${r.slug}${stats ? ` (${stats})` : ""}`);
    for (const e of r.errors) lines.push(`  error: ${e}`);
    for (const w of r.warnings) lines.push(`  warning: ${w}`);
  }
  const done = reports.filter((r) => !r.skipped);
  const passed = done.filter((r) => r.errors.length === 0).length;
  const byType = {};
  for (const r of done) {
    byType[r.type] ??= [0, 0];
    byType[r.type][1]++;
    if (r.errors.length === 0) byType[r.type][0]++;
  }
  lines.push("");
  lines.push(`${passed}/${done.length} items pass${global.length > 0 ? `, ${global.length} bundle errors` : ""}: ${Object.entries(byType).map(([t, [p, n]]) => `${t} ${p}/${n}`).join(", ")}`);
  return lines.join("\n");
}

function pack(result, out) {
  const manifest = result.manifests[0]?.data?.manifest;
  if (manifest === undefined) throw new Error("--pack needs a manifest.json in the folder");
  writeFileSync(out, JSON.stringify({ schema: "parikshaa.content/bundle@1", manifest, items: result.items.map((i) => i.item) }, null, 2) + "\n");
}

async function main(argv) {
  const options = { noRun: false, mutate: false, json: false };
  const paths = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-run") options.noRun = true;
    else if (a === "--mutate") options.mutate = true;
    else if (a === "--json") options.json = true;
    else if (a === "--only") options.only = argv[++i].split(",");
    else if (a === "--pack") options.pack = argv[++i];
    else if (a === "--runner-url") options.runnerUrl = argv[++i];
    else if (a === "--help" || a === "-h") {
      process.stdout.write(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0] + "*/\n");
      return 0;
    } else if (a.startsWith("--")) {
      process.stderr.write(`unknown option ${a}\n`);
      return 2;
    } else paths.push(a);
  }
  if (paths.length === 0) {
    process.stderr.write("usage: node scripts/content-validate.mjs <bundle.json | folder | item.json>... [--no-run] [--only types] [--mutate] [--json] [--pack out.json]\n");
    return 2;
  }
  if (!options.json) options.progress = (r) => process.stderr.write(`  checked ${r.type} ${r.slug} (${r.stats.seconds}s)\n`);
  let result;
  try {
    result = await validate(paths, options);
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    return 2;
  }
  process.stdout.write(options.json ? JSON.stringify({ global: result.global, items: result.reports }, null, 2) + "\n" : format(result) + "\n");
  const ok = result.global.length === 0 && result.reports.every((r) => r.skipped || r.errors.length === 0);
  if (ok && options.pack !== undefined) pack(result, options.pack);
  return ok ? 0 : 1;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
