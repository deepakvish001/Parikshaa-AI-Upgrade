/**
 * Function questions: the candidate writes a function, not a program.
 *
 * A question states its function once — a name, typed parameters and a return
 * type — and from that Parikshaa writes, for every language it offers, the
 * starter code the candidate fills in and the program that runs it: read one
 * JSON value per parameter from standard input, call the function, print what
 * it returned as JSON after a marker. The candidate never sees that program;
 * they see a function to complete, as on LeetCode.
 *
 * A test's input is one JSON value per line, in parameter order, and its
 * expected output one JSON value. They are compared as values (see the
 * runner's `json` checker): `[1, 2]` and `[1,2]` are the same answer, and
 * numbers are equal within the question's tolerance.
 *
 * Each program places the candidate's code so that the compiler's line numbers
 * are the candidate's own: C and C++ by `#line`, Java by putting its imports on
 * the candidate's first line, Python and JavaScript by compiling the source
 * under its own file name.
 */

export const VALUE_TYPES = [
  "int",
  "long",
  "double",
  "boolean",
  "string",
  "int[]",
  "long[]",
  "double[]",
  "boolean[]",
  "string[]",
  "int[][]",
  "string[][]",
] as const;
export type ValueType = (typeof VALUE_TYPES)[number];

export interface Parameter {
  readonly name: string;
  readonly type: ValueType;
}

export interface Signature {
  /** The function's name, the same in every language. */
  readonly name: string;
  readonly params: readonly Parameter[];
  readonly returns: ValueType;
  /**
   * Whether a returned array may come in any order: not at all, at the top
   * level only, or at every level (a list of groups, each in any order).
   */
  readonly anyOrder?: "none" | "top" | "deep";
  /** How far a returned number may be from the expected one. Default: 1e-5 when a double is returned, else exact. */
  readonly tolerance?: number;
}

/** What the program prints before the function's result. Starts with a control character no answer prints by accident. */
export const RESULT_MARKER = "\u001eparikshaa:result:";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;

/** Words that are reserved in at least one of the languages, or taken by the generated program. */
const RESERVED = new Set(
  (
    // Python
    "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield self print input len range list dict set str int float bool " +
    // JavaScript
    "case catch const debugger default delete do export extends function instanceof let new null super switch this throw typeof var void arguments eval undefined true false " +
    // Java
    "abstract boolean byte char double enum final float goto implements interface long native package private protected public short static strictfp synchronized throws transient volatile String Object Math System Integer Long Double Boolean List " +
    // C and C++
    "auto extern inline register restrict signed sizeof struct typedef union unsigned bool namespace template typename using operator friend virtual explicit mutable std vector string main " +
    // The generated program
    "Solution Main"
  ).split(" "),
);

/** Problems with a signature, as sentences an author can act on. */
export function signatureProblems(signature: Signature): string[] {
  const problems: string[] = [];
  const nameOk = (name: string) => IDENTIFIER.test(name) && !RESERVED.has(name) && !name.startsWith("pk_") && !name.startsWith("__");
  if (!nameOk(signature.name)) problems.push(`"${signature.name}" cannot be the function's name: use letters, digits and _, starting with a letter, and not a word any of the languages reserves.`);
  if (signature.params.length === 0) problems.push("The function needs at least one parameter.");
  if (signature.params.length > 8) problems.push("A function may take at most 8 parameters.");
  const seen = new Set<string>();
  for (const p of signature.params) {
    if (!nameOk(p.name)) problems.push(`"${p.name}" cannot be a parameter's name: use letters, digits and _, and not a word any of the languages reserves.`);
    if (seen.has(p.name)) problems.push(`Two parameters are called "${p.name}".`);
    seen.add(p.name);
    if (p.name === signature.name) problems.push(`A parameter cannot share the function's name, "${p.name}".`);
    if (!(VALUE_TYPES as readonly string[]).includes(p.type)) problems.push(`"${p.type}" is not a type a parameter can have.`);
  }
  if (!(VALUE_TYPES as readonly string[]).includes(signature.returns)) problems.push(`"${signature.returns}" is not a type a function can return.`);
  if (signature.tolerance !== undefined && !(signature.tolerance >= 0 && signature.tolerance <= 1)) problems.push("The tolerance is between 0 and 1.");
  return problems;
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

const INT_MIN = -(2 ** 31);
const INT_MAX = 2 ** 31 - 1;

/** Whether a JSON value is of a type. */
export function conforms(value: unknown, type: ValueType): boolean {
  if (type.endsWith("[]")) {
    const inner = type.slice(0, -2) as ValueType;
    return Array.isArray(value) && value.every((v) => conforms(v, inner));
  }
  switch (type) {
    case "int":
      return Number.isInteger(value) && (value as number) >= INT_MIN && (value as number) <= INT_MAX;
    case "long":
      return Number.isInteger(value);
    case "double":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "string":
      return typeof value === "string";
    default:
      return false;
  }
}

/** The JSON lines of a function test's input, one per parameter, ignoring blank lines. */
export const argumentLines = (input: string): string[] =>
  input
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "");

/** Problems with one test of a function question: an input line per parameter, of its type, and an expected value of the return type. */
export function functionTestProblems(signature: Signature, input: string, expected: string): string[] {
  const problems: string[] = [];
  const lines = argumentLines(input);
  if (lines.length !== signature.params.length) {
    problems.push(`The input needs one line per parameter (${signature.params.map((p) => p.name).join(", ")}); it has ${lines.length}.`);
  }
  signature.params.forEach((p, i) => {
    const line = lines[i];
    if (line === undefined) return;
    try {
      if (!conforms(JSON.parse(line), p.type)) problems.push(`Line ${i + 1} is not ${describeType(p.type)}, which ${p.name} is.`);
    } catch {
      problems.push(`Line ${i + 1} (${p.name}) is not JSON: write it as ${exampleOf(p.type)}.`);
    }
  });
  try {
    if (!conforms(JSON.parse(expected), signature.returns)) problems.push(`The expected output is not ${describeType(signature.returns)}, which the function returns.`);
  } catch {
    problems.push(`The expected output is not JSON: write it as ${exampleOf(signature.returns)}.`);
  }
  return problems;
}

/** A type in words, for authors and candidates. */
export function describeType(type: ValueType): string {
  const words: Record<string, string> = {
    int: "a whole number",
    long: "a whole number",
    double: "a number",
    boolean: "true or false",
    string: "a string",
  };
  if (type.endsWith("[][]")) return `a list of lists of ${plural(type.slice(0, -4))}`;
  if (type.endsWith("[]")) return `a list of ${plural(type.slice(0, -2))}`;
  return words[type] ?? type;
}
const plural = (base: string) => ({ int: "whole numbers", long: "whole numbers", double: "numbers", boolean: "true/false values", string: "strings" })[base] ?? base;

const exampleOf = (type: ValueType): string =>
  ({
    int: "7",
    long: "10000000000",
    double: "2.5",
    boolean: "true",
    string: '"abc"',
    "int[]": "[1,2,3]",
    "long[]": "[1,2,3]",
    "double[]": "[1.5,2]",
    "boolean[]": "[true,false]",
    "string[]": '["a","b"]',
    "int[][]": "[[1,2],[3]]",
    "string[][]": '[["a"],["b","c"]]',
  })[type];

/** The runner checker a function question's results are judged by. */
export function functionChecker(signature: Signature): { kind: "json"; tolerance: number; unordered: "none" | "top" | "deep" } {
  const returnsDouble = signature.returns.startsWith("double");
  return { kind: "json", tolerance: signature.tolerance ?? (returnsDouble ? 1e-5 : 0), unordered: signature.anyOrder ?? "none" };
}

// ---------------------------------------------------------------------------
// Starter code: what the candidate fills in
// ---------------------------------------------------------------------------

const base = (type: ValueType) => type.replace(/\[\]/g, "") as "int" | "long" | "double" | "boolean" | "string";
const depth = (type: ValueType) => (type.match(/\[\]/g) ?? []).length;

const PY: Record<string, string> = { int: "int", long: "int", double: "float", boolean: "bool", string: "str" };
const pyType = (t: ValueType) => {
  let s = PY[base(t)]!;
  for (let i = 0; i < depth(t); i++) s = `List[${s}]`;
  return s;
};

const JS: Record<string, string> = { int: "number", long: "number", double: "number", boolean: "boolean", string: "string" };
const jsType = (t: ValueType) => JS[base(t)]! + "[]".repeat(depth(t));

const JAVA: Record<string, string> = { int: "int", long: "long", double: "double", boolean: "boolean", string: "String" };
const javaType = (t: ValueType) => JAVA[base(t)]! + "[]".repeat(depth(t));

const CPP: Record<string, string> = { int: "int", long: "long long", double: "double", boolean: "bool", string: "string" };
const cppType = (t: ValueType) => {
  let s = CPP[base(t)]!;
  for (let i = 0; i < depth(t); i++) s = `vector<${s}>`;
  return s;
};
const cppParam = (p: Parameter) => (depth(p.type) > 0 ? `${cppType(p.type)}& ${p.name}` : `${cppType(p.type)} ${p.name}`);

const C: Record<string, string> = { int: "int", long: "long long", double: "double", boolean: "bool", string: "char*" };
/** C's parameters for one value, LeetCode's convention: an array brings its size, a 2-D array its row sizes too. */
const cParams = (p: Parameter): string[] => {
  const t = C[base(p.type)]!;
  switch (depth(p.type)) {
    case 0:
      return [`${t} ${p.name}`];
    case 1:
      return [`${t}* ${p.name}`, `int ${p.name}Size`];
    default:
      return [`${t}** ${p.name}`, `int ${p.name}Size`, `int* ${p.name}ColSize`];
  }
};
const cReturn = (t: ValueType) => C[base(t)]! + "*".repeat(depth(t));
const cReturnParams = (t: ValueType) => (depth(t) === 0 ? [] : depth(t) === 1 ? ["int* returnSize"] : ["int* returnSize", "int** returnColumnSizes"]);

/** The code a candidate starts from, in one language. */
export function starterFor(signature: Signature, language: string): string {
  const { name, params, returns } = signature;
  switch (language) {
    case "python":
      return [
        "class Solution:",
        `    def ${name}(self, ${params.map((p) => `${p.name}: ${pyType(p.type)}`).join(", ")}) -> ${pyType(returns)}:`,
        "        pass",
        "",
      ].join("\n");
    case "javascript":
      return [
        "/**",
        ...params.map((p) => ` * @param {${jsType(p.type)}} ${p.name}`),
        ` * @return {${jsType(returns)}}`,
        " */",
        `var ${name} = function(${params.map((p) => p.name).join(", ")}) {`,
        "    ",
        "};",
        "",
      ].join("\n");
    case "java":
      return [
        "class Solution {",
        `    public ${javaType(returns)} ${name}(${params.map((p) => `${javaType(p.type)} ${p.name}`).join(", ")}) {`,
        "        ",
        "    }",
        "}",
        "",
      ].join("\n");
    case "cpp":
      return [
        "class Solution {",
        "public:",
        `    ${cppType(returns)} ${name}(${params.map(cppParam).join(", ")}) {`,
        "        ",
        "    }",
        "};",
        "",
      ].join("\n");
    case "c": {
      const note =
        depth(returns) === 0
          ? []
          : depth(returns) === 1
            ? ["/**", " * Return an array you malloc; set *returnSize to its length.", " */"]
            : ["/**", " * Return an array of arrays you malloc; set *returnSize to the number of rows,", " * and *returnColumnSizes to a malloc'd array of each row's length.", " */"];
      return [...note, `${cReturn(returns)} ${name}(${[...params.flatMap(cParams), ...cReturnParams(returns)].join(", ")}) {`, "    ", "}", ""].join("\n");
    }
    default:
      throw new Error(`No starter for ${language}`);
  }
}

// ---------------------------------------------------------------------------
// Programs: the candidate's function, called on a test's input
// ---------------------------------------------------------------------------

/** The whole program for one language: the candidate's code, and what calls it. */
export function programFor(signature: Signature, language: string, source: string): string {
  switch (language) {
    case "python":
      return pythonProgram(signature, source);
    case "javascript":
      return javascriptProgram(signature, source);
    case "java":
      return javaProgram(signature, source);
    case "cpp":
      return cppProgram(signature, source);
    case "c":
      return cProgram(signature, source);
    default:
      throw new Error(`No program for ${language}`);
  }
}

// --- Python ------------------------------------------------------------------

function pythonProgram(signature: Signature, source: string): string {
  const convert = (type: ValueType, expr: string): string => {
    if (depth(type) > 0) return `[${convert(type.slice(0, -2) as ValueType, "x" + depth(type))} for x${depth(type)} in ${expr}]`;
    return { int: `int(${expr})`, long: `int(${expr})`, double: `float(${expr})`, boolean: `bool(${expr})`, string: `str(${expr})` }[base(type)]!;
  };
  return [
    "import sys as pk_sys, json as pk_json",
    `pk_source = ${JSON.stringify(source)}`,
    'pk_env = {"__name__": "solution"}',
    'exec("from typing import *\\nimport math, collections, heapq, itertools, functools, bisect, re, string\\nfrom collections import *\\nfrom functools import lru_cache, cache, reduce\\nfrom heapq import *\\nfrom bisect import *\\nfrom math import inf, gcd", pk_env)',
    'exec(compile(pk_source, "Solution.py", "exec"), pk_env)',
    "pk_lines = [l for l in pk_sys.stdin.read().split(\"\\n\") if l.strip() != \"\"]",
    `pk_args = [${signature.params.map((p, i) => convert(p.type, `pk_json.loads(pk_lines[${i}])`)).join(", ")}]`,
    `pk_fn = getattr(pk_env["Solution"](), ${JSON.stringify(signature.name)}) if "Solution" in pk_env else pk_env[${JSON.stringify(signature.name)}]`,
    "pk_result = pk_fn(*pk_args)",
    `pk_out = pk_json.dumps(${convert(signature.returns, "pk_result")}, separators=(",", ":"), ensure_ascii=False) if pk_result is not None else "null"`,
    "pk_sys.stdout.flush()",
    `pk_sys.stdout.write("\\n" + ${JSON.stringify(RESULT_MARKER)} + pk_out + "\\n")`,
    "",
  ].join("\n");
}

// --- JavaScript ----------------------------------------------------------------

function javascriptProgram(signature: Signature, source: string): string {
  const convert = (type: ValueType, expr: string): string => {
    if (depth(type) > 0) return `Array.from(${expr}, (x${depth(type)}) => ${convert(type.slice(0, -2) as ValueType, "x" + depth(type))})`;
    return { int: `Number(${expr})`, long: `Number(${expr})`, double: `Number(${expr})`, boolean: `Boolean(${expr})`, string: `String(${expr})` }[base(type)]!;
  };
  const name = JSON.stringify(signature.name);
  return [
    'const pk_vm = require("vm");',
    `pk_vm.runInThisContext(${JSON.stringify(source)}, { filename: "solution.js" });`,
    // The function by whichever way it was declared: var, function, const, or a Solution class.
    `const pk_fn = pk_vm.runInThisContext("typeof ${signature.name} === 'function' ? ${signature.name} : (typeof Solution === 'function' ? ((s) => s[" + ${JSON.stringify(name)} + "].bind(s))(new Solution()) : undefined)");`,
    `if (typeof pk_fn !== "function") { console.error("No function called " + ${name} + " was defined."); process.exit(1); }`,
    'const pk_lines = require("fs").readFileSync(0, "utf8").split("\\n").filter((l) => l.trim() !== "");',
    `const pk_args = [${signature.params.map((p, i) => convert(p.type, `JSON.parse(pk_lines[${i}])`)).join(", ")}];`,
    "const pk_result = pk_fn(...pk_args);",
    `const pk_out = pk_result === undefined || pk_result === null ? "null" : JSON.stringify(${convert(signature.returns, "pk_result")});`,
    `process.stdout.write("\\n" + ${JSON.stringify(RESULT_MARKER)} + pk_out + "\\n");`,
    "",
  ].join("\n");
}

// --- Java --------------------------------------------------------------------

const JAVA_SUPPORT = String.raw`
final class PkJson {
    private final String s; private int i;
    private PkJson(String s) { this.s = s; }
    static Object parse(String s) {
        PkJson p = new PkJson(s); Object v = p.value(); p.ws();
        if (p.i != s.length()) throw new IllegalArgumentException("Not JSON: " + s);
        return v;
    }
    private void ws() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }
    private Object value() {
        ws(); char c = s.charAt(i);
        if (c == '[') {
            i++; java.util.List<Object> l = new java.util.ArrayList<>(); ws();
            if (s.charAt(i) == ']') { i++; return l; }
            while (true) { l.add(value()); ws(); char d = s.charAt(i++); if (d == ']') return l; if (d != ',') throw new IllegalArgumentException("Not JSON"); }
        }
        if (c == '"') return str();
        if (s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
        if (s.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
        if (s.startsWith("null", i)) { i += 4; return null; }
        int st = i; while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
        String n = s.substring(st, i);
        if (n.indexOf('.') >= 0 || n.indexOf('e') >= 0 || n.indexOf('E') >= 0) return Double.parseDouble(n);
        return Long.parseLong(n);
    }
    private String str() {
        i++; StringBuilder b = new StringBuilder();
        while (true) {
            char c = s.charAt(i++);
            if (c == '"') return b.toString();
            if (c != '\\') { b.append(c); continue; }
            char e = s.charAt(i++);
            switch (e) {
                case 'n': b.append('\n'); break; case 't': b.append('\t'); break; case 'r': b.append('\r'); break;
                case 'b': b.append('\b'); break; case 'f': b.append('\f'); break;
                case 'u': b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; break;
                default: b.append(e);
            }
        }
    }
    private static java.util.List<?> list(Object o) { return (java.util.List<?>) o; }
    static int toInt(Object o) { return ((Number) o).intValue(); }
    static long toLong(Object o) { return ((Number) o).longValue(); }
    static double toDouble(Object o) { return ((Number) o).doubleValue(); }
    static boolean toBoolean(Object o) { return (Boolean) o; }
    static String toStr(Object o) { return (String) o; }
    static int[] toIntArray(Object o) { java.util.List<?> l = list(o); int[] r = new int[l.size()]; for (int k = 0; k < r.length; k++) r[k] = toInt(l.get(k)); return r; }
    static long[] toLongArray(Object o) { java.util.List<?> l = list(o); long[] r = new long[l.size()]; for (int k = 0; k < r.length; k++) r[k] = toLong(l.get(k)); return r; }
    static double[] toDoubleArray(Object o) { java.util.List<?> l = list(o); double[] r = new double[l.size()]; for (int k = 0; k < r.length; k++) r[k] = toDouble(l.get(k)); return r; }
    static boolean[] toBooleanArray(Object o) { java.util.List<?> l = list(o); boolean[] r = new boolean[l.size()]; for (int k = 0; k < r.length; k++) r[k] = toBoolean(l.get(k)); return r; }
    static String[] toStringArray(Object o) { java.util.List<?> l = list(o); String[] r = new String[l.size()]; for (int k = 0; k < r.length; k++) r[k] = toStr(l.get(k)); return r; }
    static int[][] toIntGrid(Object o) { java.util.List<?> l = list(o); int[][] r = new int[l.size()][]; for (int k = 0; k < r.length; k++) r[k] = toIntArray(l.get(k)); return r; }
    static String[][] toStringGrid(Object o) { java.util.List<?> l = list(o); String[][] r = new String[l.size()][]; for (int k = 0; k < r.length; k++) r[k] = toStringArray(l.get(k)); return r; }

    static void w(StringBuilder b, int v) { b.append(v); }
    static void w(StringBuilder b, long v) { b.append(v); }
    static void w(StringBuilder b, double v) { b.append(Double.toString(v)); }
    static void w(StringBuilder b, boolean v) { b.append(v); }
    static void w(StringBuilder b, String v) {
        if (v == null) { b.append("null"); return; }
        b.append('"');
        for (int k = 0; k < v.length(); k++) {
            char c = v.charAt(k);
            switch (c) {
                case '"': b.append("\\\""); break; case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break; case '\r': b.append("\\r"); break; case '\t': b.append("\\t"); break;
                default: if (c < 0x20) b.append(String.format("\\u%04x", (int) c)); else b.append(c);
            }
        }
        b.append('"');
    }
    static void w(StringBuilder b, int[] v) { if (v == null) { b.append("null"); return; } b.append('['); for (int k = 0; k < v.length; k++) { if (k > 0) b.append(','); w(b, v[k]); } b.append(']'); }
    static void w(StringBuilder b, long[] v) { if (v == null) { b.append("null"); return; } b.append('['); for (int k = 0; k < v.length; k++) { if (k > 0) b.append(','); w(b, v[k]); } b.append(']'); }
    static void w(StringBuilder b, double[] v) { if (v == null) { b.append("null"); return; } b.append('['); for (int k = 0; k < v.length; k++) { if (k > 0) b.append(','); w(b, v[k]); } b.append(']'); }
    static void w(StringBuilder b, boolean[] v) { if (v == null) { b.append("null"); return; } b.append('['); for (int k = 0; k < v.length; k++) { if (k > 0) b.append(','); w(b, v[k]); } b.append(']'); }
    static void w(StringBuilder b, String[] v) { if (v == null) { b.append("null"); return; } b.append('['); for (int k = 0; k < v.length; k++) { if (k > 0) b.append(','); w(b, v[k]); } b.append(']'); }
    static void w(StringBuilder b, int[][] v) { if (v == null) { b.append("null"); return; } b.append('['); for (int k = 0; k < v.length; k++) { if (k > 0) b.append(','); w(b, v[k]); } b.append(']'); }
    static void w(StringBuilder b, String[][] v) { if (v == null) { b.append("null"); return; } b.append('['); for (int k = 0; k < v.length; k++) { if (k > 0) b.append(','); w(b, v[k]); } b.append(']'); }
}
`;

const JAVA_CONVERT: Record<ValueType, string> = {
  int: "toInt",
  long: "toLong",
  double: "toDouble",
  boolean: "toBoolean",
  string: "toStr",
  "int[]": "toIntArray",
  "long[]": "toLongArray",
  "double[]": "toDoubleArray",
  "boolean[]": "toBooleanArray",
  "string[]": "toStringArray",
  "int[][]": "toIntGrid",
  "string[][]": "toStringGrid",
};

function javaProgram(signature: Signature, source: string): string {
  // A public class must live in a file of its name; the candidate's goes in Main.java.
  const candidate = source.replace(/\bpublic\s+(final\s+)?class\s+Solution\b/, (_m, fin: string | undefined) => `${fin ?? ""}class Solution`);
  const imports = "import java.util.*; import java.util.function.*; import java.util.stream.*; ";
  return [
    // On the candidate's first line, so the compiler's line numbers are theirs.
    imports + candidate,
    JAVA_SUPPORT,
    "public class Main {",
    "    public static void main(String[] pkArgs) throws Exception {",
    "        java.io.BufferedReader pkIn = new java.io.BufferedReader(new java.io.InputStreamReader(System.in, java.nio.charset.StandardCharsets.UTF_8));",
    "        java.util.List<String> pkLines = new java.util.ArrayList<>();",
    "        for (String l = pkIn.readLine(); l != null; l = pkIn.readLine()) if (!l.trim().isEmpty()) pkLines.add(l);",
    ...signature.params.map((p, i) => `        ${javaType(p.type)} pk_a${i} = PkJson.${JAVA_CONVERT[p.type]}(PkJson.parse(pkLines.get(${i})));`),
    `        ${javaType(signature.returns)} pkResult = new Solution().${signature.name}(${signature.params.map((_p, i) => `pk_a${i}`).join(", ")});`,
    "        StringBuilder pkOut = new StringBuilder();",
    "        PkJson.w(pkOut, pkResult);",
    "        System.out.flush();",
    `        System.out.print("\\n" + ${JSON.stringify(RESULT_MARKER)} + pkOut + "\\n");`,
    "        System.out.flush();",
    "    }",
    "}",
    "",
  ].join("\n");
}

// --- C++ ---------------------------------------------------------------------

const CPP_SUPPORT = String.raw`
namespace pk {
struct J { int kind = 0; double num = 0; long long inum = 0; bool isInt = false; bool flag = false; std::string str; std::vector<J> items; };
struct Parser {
    const std::string& s; size_t i = 0;
    explicit Parser(const std::string& s) : s(s) {}
    void ws() { while (i < s.size() && isspace((unsigned char)s[i])) i++; }
    J value() {
        ws(); J v; char c = s[i];
        if (c == '[') { i++; v.kind = 4; ws(); if (s[i] == ']') { i++; return v; }
            while (true) { v.items.push_back(value()); ws(); char d = s[i++]; if (d == ']') return v; } }
        if (c == '"') { v.kind = 3; v.str = str(); return v; }
        if (s.compare(i, 4, "true") == 0) { i += 4; v.kind = 2; v.flag = true; return v; }
        if (s.compare(i, 5, "false") == 0) { i += 5; v.kind = 2; v.flag = false; return v; }
        if (s.compare(i, 4, "null") == 0) { i += 4; v.kind = 0; return v; }
        size_t st = i; while (i < s.size() && std::string("+-0123456789.eE").find(s[i]) != std::string::npos) i++;
        std::string n = s.substr(st, i - st); v.kind = 1;
        if (n.find_first_of(".eE") == std::string::npos) { v.isInt = true; v.inum = std::stoll(n); v.num = (double)v.inum; }
        else v.num = std::stod(n);
        return v;
    }
    std::string str() {
        i++; std::string b;
        while (true) {
            char c = s[i++];
            if (c == '"') return b;
            if (c != '\\') { b += c; continue; }
            char e = s[i++];
            switch (e) {
                case 'n': b += '\n'; break; case 't': b += '\t'; break; case 'r': b += '\r'; break;
                case 'b': b += '\b'; break; case 'f': b += '\f'; break;
                case 'u': { unsigned cp = std::stoul(s.substr(i, 4), nullptr, 16); i += 4;
                    if (cp < 0x80) b += (char)cp; else if (cp < 0x800) { b += (char)(0xC0 | (cp >> 6)); b += (char)(0x80 | (cp & 0x3F)); }
                    else { b += (char)(0xE0 | (cp >> 12)); b += (char)(0x80 | ((cp >> 6) & 0x3F)); b += (char)(0x80 | (cp & 0x3F)); } break; }
                default: b += e;
            }
        }
    }
};
inline J parse(const std::string& s) { Parser p(s); return p.value(); }
inline long long asLong(const J& j) { return j.isInt ? j.inum : (long long)j.num; }
template <typename T> T as(const J& j);
template <> inline int as<int>(const J& j) { return (int)asLong(j); }
template <> inline long long as<long long>(const J& j) { return asLong(j); }
template <> inline double as<double>(const J& j) { return j.num; }
template <> inline bool as<bool>(const J& j) { return j.flag; }
template <> inline std::string as<std::string>(const J& j) { return j.str; }
template <typename T> struct Conv { static T of(const J& j) { return as<T>(j); } };
template <typename T> struct Conv<std::vector<T>> { static std::vector<T> of(const J& j) { std::vector<T> r; for (const J& x : j.items) r.push_back(Conv<T>::of(x)); return r; } };

inline void w(std::ostream& o, int v) { o << v; }
inline void w(std::ostream& o, long long v) { o << v; }
inline void w(std::ostream& o, double v) { std::ostringstream t; t << std::setprecision(17) << v; o << t.str(); }
inline void w(std::ostream& o, bool v) { o << (v ? "true" : "false"); }
inline void w(std::ostream& o, const std::string& v) {
    o << '"';
    for (unsigned char c : v) {
        switch (c) {
            case '"': o << "\\\""; break; case '\\': o << "\\\\"; break;
            case '\n': o << "\\n"; break; case '\r': o << "\\r"; break; case '\t': o << "\\t"; break;
            default: if (c < 0x20) { char buf[8]; snprintf(buf, sizeof buf, "\\u%04x", c); o << buf; } else o << c;
        }
    }
    o << '"';
}
template <typename T> void w(std::ostream& o, const std::vector<T>& v) {
    o << '[';
    for (size_t k = 0; k < v.size(); k++) { if (k > 0) o << ','; T x = v[k]; w(o, x); }
    o << ']';
}
}
`;

function cppProgram(signature: Signature, source: string): string {
  return [
    "#include <bits/stdc++.h>",
    "using namespace std;",
    '#line 1 "solution.cpp"',
    source,
    '#line 1 "main.cpp"',
    CPP_SUPPORT,
    "int main() {",
    "    std::ios::sync_with_stdio(true);",
    "    std::vector<std::string> pk_lines; std::string pk_l;",
    "    while (std::getline(std::cin, pk_l)) { if (pk_l.find_first_not_of(\" \\t\\r\") != std::string::npos) pk_lines.push_back(pk_l); }",
    ...signature.params.map((p, i) => `    ${cppType(p.type)} pk_a${i} = pk::Conv<${cppType(p.type)}>::of(pk::parse(pk_lines[${i}]));`),
    "    Solution pk_s;",
    `    ${cppType(signature.returns)} pk_r = pk_s.${signature.name}(${signature.params.map((_p, i) => `pk_a${i}`).join(", ")});`,
    "    std::ostringstream pk_o; pk::w(pk_o, pk_r);",
    "    std::cout.flush(); fflush(stdout);",
    `    std::cout << "\\n" << ${cString(RESULT_MARKER)} << pk_o.str() << "\\n";`,
    "    std::cout.flush();",
    "    return 0;",
    "}",
    "",
  ].join("\n");
}

/** A C string literal. Octal escapes, never hex: a hex escape runs on through any following hex digit. */
const cString = (text: string): string =>
  `"${[...text].map((ch) => (ch.charCodeAt(0) < 0x20 || ch === '"' || ch === "\\" ? `\\${ch.charCodeAt(0).toString(8).padStart(3, "0")}` : ch)).join("")}"`;

// --- C -----------------------------------------------------------------------

const C_SUPPORT = String.raw`
typedef struct pk_j { int kind; double num; long long inum; int is_int; int flag; char* str; struct pk_j* items; int n; } pk_j;
static const char* pk_s; static size_t pk_i;
static void pk_ws(void) { while (pk_s[pk_i] && isspace((unsigned char)pk_s[pk_i])) pk_i++; }
static void pk_value(pk_j* v);
static char* pk_str(void) {
    size_t cap = 16, len = 0; char* b = malloc(cap); pk_i++;
    for (;;) {
        char c = pk_s[pk_i++];
        if (c == '"' || c == 0) break;
        if (len + 4 >= cap) { cap *= 2; b = realloc(b, cap); }
        if (c != '\\') { b[len++] = c; continue; }
        char e = pk_s[pk_i++];
        switch (e) {
            case 'n': b[len++] = '\n'; break; case 't': b[len++] = '\t'; break; case 'r': b[len++] = '\r'; break;
            case 'b': b[len++] = '\b'; break; case 'f': b[len++] = '\f'; break;
            case 'u': { char h[5] = {0}; memcpy(h, pk_s + pk_i, 4); pk_i += 4; unsigned cp = (unsigned)strtoul(h, NULL, 16);
                if (cp < 0x80) b[len++] = (char)cp;
                else if (cp < 0x800) { b[len++] = (char)(0xC0 | (cp >> 6)); b[len++] = (char)(0x80 | (cp & 0x3F)); }
                else { b[len++] = (char)(0xE0 | (cp >> 12)); b[len++] = (char)(0x80 | ((cp >> 6) & 0x3F)); b[len++] = (char)(0x80 | (cp & 0x3F)); }
                break; }
            default: b[len++] = e;
        }
    }
    b[len] = 0; return b;
}
static void pk_value(pk_j* v) {
    memset(v, 0, sizeof *v); pk_ws(); char c = pk_s[pk_i];
    if (c == '[') {
        int cap = 4; v->kind = 4; v->items = malloc(sizeof(pk_j) * cap); pk_i++; pk_ws();
        if (pk_s[pk_i] == ']') { pk_i++; return; }
        for (;;) {
            if (v->n == cap) { cap *= 2; v->items = realloc(v->items, sizeof(pk_j) * cap); }
            pk_value(&v->items[v->n++]); pk_ws();
            if (pk_s[pk_i++] == ']') return;
        }
    }
    if (c == '"') { v->kind = 3; v->str = pk_str(); return; }
    if (strncmp(pk_s + pk_i, "true", 4) == 0) { pk_i += 4; v->kind = 2; v->flag = 1; return; }
    if (strncmp(pk_s + pk_i, "false", 5) == 0) { pk_i += 5; v->kind = 2; return; }
    if (strncmp(pk_s + pk_i, "null", 4) == 0) { pk_i += 4; return; }
    size_t st = pk_i; int frac = 0;
    while (pk_s[pk_i] && strchr("+-0123456789.eE", pk_s[pk_i])) { if (strchr(".eE", pk_s[pk_i])) frac = 1; pk_i++; }
    char buf[64] = {0}; size_t n = pk_i - st < 63 ? pk_i - st : 63; memcpy(buf, pk_s + st, n);
    v->kind = 1;
    if (frac) v->num = strtod(buf, NULL); else { v->is_int = 1; v->inum = strtoll(buf, NULL, 10); v->num = (double)v->inum; }
}
static pk_j pk_parse(const char* s) { pk_j v; pk_s = s; pk_i = 0; pk_value(&v); return v; }
static long long pk_long(const pk_j* j) { return j->is_int ? j->inum : (long long)j->num; }

static void pk_w_int(long long v) { printf("%lld", v); }
static void pk_w_double(double v) { printf("%.17g", v); }
static void pk_w_bool(bool v) { fputs(v ? "true" : "false", stdout); }
static void pk_w_str(const char* v) {
    if (v == NULL) { printf("null"); return; }
    putchar('"');
    for (const unsigned char* c = (const unsigned char*)v; *c; c++) {
        switch (*c) {
            case '"': printf("\\\""); break; case '\\': printf("\\\\"); break;
            case '\n': printf("\\n"); break; case '\r': printf("\\r"); break; case '\t': printf("\\t"); break;
            default: if (*c < 0x20) printf("\\u%04x", *c); else putchar(*c);
        }
    }
    putchar('"');
}
`;

/** C: declarations, and the arguments to pass, for one parameter from line `i`. */
function cArgument(p: Parameter, i: number): { setup: string[]; args: string[] } {
  const j = `pk_j${i}`;
  const a = `pk_a${i}`;
  const one = (t: string, from: string) =>
    ({ int: `(int)pk_long(${from})`, long: `pk_long(${from})`, double: `(${from})->num`, boolean: `(bool)(${from})->flag`, string: `(${from})->str` })[t]!;
  const elem = C[base(p.type)]!;
  const setup = [`pk_j ${j} = pk_parse(pk_lines[${i}]);`];
  switch (depth(p.type)) {
    case 0:
      setup.push(`${elem} ${a} = ${one(base(p.type), `&${j}`)};`);
      return { setup, args: [a] };
    case 1:
      setup.push(
        `int ${a}Size = ${j}.n; ${elem}* ${a} = malloc(sizeof(${elem}) * (${a}Size > 0 ? ${a}Size : 1));`,
        `for (int k = 0; k < ${a}Size; k++) ${a}[k] = ${one(base(p.type), `&${j}.items[k]`)};`,
      );
      return { setup, args: [a, `${a}Size`] };
    default:
      setup.push(
        `int ${a}Size = ${j}.n; ${elem}** ${a} = malloc(sizeof(${elem}*) * (${a}Size > 0 ? ${a}Size : 1)); int* ${a}ColSize = malloc(sizeof(int) * (${a}Size > 0 ? ${a}Size : 1));`,
        `for (int r = 0; r < ${a}Size; r++) { ${a}ColSize[r] = ${j}.items[r].n; ${a}[r] = malloc(sizeof(${elem}) * (${a}ColSize[r] > 0 ? ${a}ColSize[r] : 1));`,
        `    for (int k = 0; k < ${a}ColSize[r]; k++) ${a}[r][k] = ${one(base(p.type), `&${j}.items[r].items[k]`)}; }`,
      );
      return { setup, args: [a, `${a}Size`, `${a}ColSize`] };
  }
}

function cProgram(signature: Signature, source: string): string {
  const params = signature.params.map((p, i) => cArgument(p, i));
  const writer = { int: "pk_w_int", long: "pk_w_int", double: "pk_w_double", boolean: "pk_w_bool", string: "pk_w_str" }[base(signature.returns)]!;
  const ret = signature.returns;
  const call = `${signature.name}(${[
    ...params.flatMap((p) => p.args),
    ...(depth(ret) === 0 ? [] : depth(ret) === 1 ? ["&pk_rs"] : ["&pk_rs", "&pk_rc"]),
  ].join(", ")})`;
  const print =
    depth(ret) === 0
      ? [`${writer}(pk_r);`]
      : depth(ret) === 1
        ? [`if (pk_r == NULL) printf("null"); else { putchar('['); for (int k = 0; k < pk_rs; k++) { if (k) putchar(','); ${writer}(pk_r[k]); } putchar(']'); }`]
        : [
            `if (pk_r == NULL) printf("null"); else { putchar('['); for (int r = 0; r < pk_rs; r++) { if (r) putchar(','); putchar('[');`,
            `    for (int k = 0; k < pk_rc[r]; k++) { if (k) putchar(','); ${writer}(pk_r[r][k]); } putchar(']'); } putchar(']'); }`,
          ];
  return [
    "#include <stdio.h>",
    "#include <stdlib.h>",
    "#include <string.h>",
    "#include <stdbool.h>",
    "#include <limits.h>",
    "#include <math.h>",
    "#include <ctype.h>",
    '#line 1 "solution.c"',
    source,
    '#line 1 "main.c"',
    C_SUPPORT,
    "int main(void) {",
    "    char* pk_lines[16]; int pk_n = 0; size_t pk_cap = 1 << 22;",
    "    char* pk_all = malloc(pk_cap); size_t pk_len = fread(pk_all, 1, pk_cap - 1, stdin); pk_all[pk_len] = 0;",
    "    for (char* pk_p = strtok(pk_all, \"\\n\"); pk_p != NULL && pk_n < 16; pk_p = strtok(NULL, \"\\n\")) {",
    "        char* q = pk_p; while (*q && isspace((unsigned char)*q)) q++; if (*q) pk_lines[pk_n++] = pk_p; }",
    ...params.flatMap((p) => p.setup.map((l) => `    ${l}`)),
    ...(depth(ret) === 0 ? [] : ["    int pk_rs = 0;"]),
    ...(depth(ret) === 2 ? ["    int* pk_rc = NULL;"] : []),
    `    ${cReturn(ret)} pk_r = ${call};`,
    "    fflush(stdout);",
    `    printf("\\n%s", ${cString(RESULT_MARKER)});`,
    ...print.map((l) => `    ${l}`),
    '    printf("\\n");',
    "    return 0;",
    "}",
    "",
  ].join("\n");
}
