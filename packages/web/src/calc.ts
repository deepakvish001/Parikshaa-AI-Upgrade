/**
 * The on-screen calculator's arithmetic: a small recursive-descent parser
 * over what its keys type. No `eval` — the page's Content-Security-Policy
 * forbids it, and a calculator has no business running code.
 *
 *   expr    := term (("+" | "−") term)*
 *   term    := unary (("×" | "÷") unary | implicit unary)*
 *   unary   := ("−" | "+") unary | power
 *   power   := postfix ("^" unary)?          right-associative
 *   postfix := primary ("!" | "%")*
 *   primary := number | "π" | "e" | "Ans" | func "(" expr ")" | "(" expr ")"
 */

export type AngleUnit = "deg" | "rad";

const FUNCTIONS = ["sin", "cos", "tan", "log", "ln", "√"] as const;
type Fn = (typeof FUNCTIONS)[number];

type Token =
  | { readonly kind: "num"; readonly value: number }
  | { readonly kind: "op"; readonly value: string }
  | { readonly kind: "fn"; readonly value: Fn };

function tokenize(input: string, ans: number): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = input.replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−");
  while (i < s.length) {
    const c = s[i]!;
    if (c === " ") {
      i += 1;
      continue;
    }
    const number = /^(\d+\.?\d*|\.\d+)(E[+−]?\d+)?/.exec(s.slice(i));
    if (number !== null) {
      tokens.push({ kind: "num", value: Number(number[0].replace("−", "-")) });
      i += number[0].length;
      continue;
    }
    if (s.startsWith("Ans", i)) {
      tokens.push({ kind: "num", value: ans });
      i += 3;
      continue;
    }
    const fn = FUNCTIONS.find((f) => s.startsWith(f, i));
    if (fn !== undefined) {
      tokens.push({ kind: "fn", value: fn });
      i += fn.length;
      continue;
    }
    if (c === "π") tokens.push({ kind: "num", value: Math.PI });
    else if (c === "e") tokens.push({ kind: "num", value: Math.E });
    else if ("+−×÷^()!%".includes(c)) tokens.push({ kind: "op", value: c });
    else throw new Error(`Unexpected ${c}`);
    i += 1;
  }
  return tokens;
}

const factorial = (n: number): number => {
  if (!Number.isInteger(n) || n < 0 || n > 170) throw new Error("factorial");
  let r = 1;
  for (let k = 2; k <= n; k += 1) r *= k;
  return r;
};

/** The value of an expression as the calculator's keys type it; throws when it has none. */
export function evaluate(input: string, unit: AngleUnit = "deg", ans = 0): number {
  const tokens = tokenize(input, ans);
  let at = 0;
  const peek = () => tokens[at];
  const isOp = (v: string) => peek()?.kind === "op" && peek()!.value === v;
  const toRad = (x: number) => (unit === "deg" ? (x * Math.PI) / 180 : x);

  const expr = (): number => {
    let value = term();
    while (isOp("+") || isOp("−")) {
      const op = tokens[at++]!.value;
      const right = term();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  };
  // A number followed straight by a bracket, a constant or a function multiplies: 2π, 3(4), 2√(9).
  const startsOperand = () => {
    const t = peek();
    return t !== undefined && (t.kind === "num" || t.kind === "fn" || (t.kind === "op" && t.value === "("));
  };
  const term = (): number => {
    let value = unary();
    for (;;) {
      if (isOp("×") || isOp("÷")) {
        const op = tokens[at++]!.value;
        const right = unary();
        value = op === "×" ? value * right : value / right;
      } else if (startsOperand()) value *= unary();
      else return value;
    }
  };
  const unary = (): number => {
    if (isOp("−")) {
      at += 1;
      return -unary();
    }
    if (isOp("+")) {
      at += 1;
      return unary();
    }
    return power();
  };
  const power = (): number => {
    const base = postfix();
    if (isOp("^")) {
      at += 1;
      return base ** unary();
    }
    return base;
  };
  const postfix = (): number => {
    let value = primary();
    while (isOp("!") || isOp("%")) value = tokens[at++]!.value === "!" ? factorial(value) : value / 100;
    return value;
  };
  const bracketed = (): number => {
    if (!isOp("(")) throw new Error("Expected (");
    at += 1;
    const value = expr();
    // A missing closing bracket is forgiven at the end, as on a hand calculator.
    if (isOp(")")) at += 1;
    else if (at < tokens.length) throw new Error("Expected )");
    return value;
  };
  const primary = (): number => {
    const t = tokens[at];
    if (t === undefined) throw new Error("Unexpected end");
    if (t.kind === "num") {
      at += 1;
      return t.value;
    }
    if (t.kind === "fn") {
      at += 1;
      const x = bracketed();
      switch (t.value) {
        case "sin":
          return Math.sin(toRad(x));
        case "cos":
          return Math.cos(toRad(x));
        case "tan":
          return Math.tan(toRad(x));
        case "log":
          return Math.log10(x);
        case "ln":
          return Math.log(x);
        default:
          return Math.sqrt(x);
      }
    }
    if (t.value === "(") return bracketed();
    throw new Error(`Unexpected ${t.value}`);
  };

  const value = expr();
  if (at !== tokens.length) throw new Error("Unexpected input");
  if (!Number.isFinite(value)) throw new Error("Not a number");
  return value;
}

/** A result as a calculator shows it: twelve significant figures, no float dust (sin 180° is 0). */
export function display(value: number): string {
  if (Math.abs(value) < 1e-12) return "0";
  const fixed = Number(value.toPrecision(12));
  return Math.abs(fixed) >= 1e12 || Math.abs(fixed) < 1e-6 ? fixed.toExponential(6).replace(/\.?0+e/, "e") : String(fixed);
}
