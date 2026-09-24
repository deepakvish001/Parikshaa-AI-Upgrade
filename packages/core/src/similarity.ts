/**
 * How alike two candidates' code answers are (ROADMAP §4).
 *
 * The method is winnowing (Schleimer, Wilkerson and Aiken, 2003), the idea
 * behind MOSS. Each answer is reduced to tokens that survive the usual ways of
 * disguising a copy: comments and layout are dropped, every name a candidate
 * chose becomes the same token, and so do every string and every number. The
 * token stream is cut into overlapping runs of K tokens, each run is hashed,
 * and the smallest hash in every window of W runs is kept as a fingerprint.
 * Two answers that share a stretch of at least K + W - 1 tokens are certain to
 * share a fingerprint, whatever is renamed or moved around it.
 *
 * What the exam gave everyone — the starter code — is taken out first, so
 * filling in the same template is not counted as copying.
 *
 * The result is a measure for a person to look at, never a finding: two short
 * answers to a narrow question can be honestly identical, and a pair is only
 * reported when both answers are long enough for the measure to mean something.
 */

export interface CodeSubmission {
  /** Whose answer this is, for the caller to name; opaque here. */
  readonly key: string;
  readonly language: string;
  readonly source: string;
}

export interface SimilarPair {
  readonly a: string;
  readonly b: string;
  /** Shared fingerprints over the fingerprints of the shorter answer, 0–1. */
  readonly similarity: number;
  readonly shared: number;
}

/** Tokens per hashed run. */
export const K = 5;
/** Runs per winnowing window. */
export const W = 4;
/** Below this many fingerprints an answer is too short for the measure to mean anything. */
export const MIN_FINGERPRINTS = 8;
/** Pairs at or above this are reported. */
export const REPORT_AT = 0.7;

const KEYWORDS: Record<string, ReadonlySet<string>> = {
  python: new Set(
    "and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield True False None print range len input int str list dict set".split(" "),
  ),
  javascript: new Set(
    "break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield async await of null undefined true false console log require process".split(" "),
  ),
  c: new Set(
    "auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while include define printf scanf malloc free".split(" "),
  ),
  cpp: new Set(
    "auto bool break case catch char class const continue default delete do double else enum explicit extern false float for friend if inline int long namespace new operator private protected public return short signed sizeof static struct switch template this throw true try typedef typename union unsigned using virtual void volatile while include define std cin cout endl vector string map set pair".split(" "),
  ),
  java: new Set(
    "abstract boolean break byte case catch char class continue default do double else enum extends final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch this throw throws try void while true false String System out println Scanner".split(" "),
  ),
};

/**
 * The answer as tokens that survive disguise: keywords stay as they are; names
 * become "v", numbers "n", strings "s"; comments and whitespace go.
 */
export function tokensOf(source: string, language: string): string[] {
  const keywords = KEYWORDS[language] ?? new Set<string>();
  const hashComments = language === "python";
  let text = source;
  // Strings first, so a "#" or "//" inside one is not taken for a comment.
  // A control character stands for a string: no name a candidate writes can be it.
  text = text.replace(/"""[\s\S]*?"""|'''[\s\S]*?'''/g, hashComments ? " \u0001 " : "$&");
  text = text.replace(/`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, " \u0001 ");
  text = hashComments ? text.replace(/#[^\n]*/g, " ") : text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  if (!hashComments) text = text.replace(/^\s*#\s*(include|define)\b[^\n]*/gm, (line) => line.replace(/<[^>]*>|"[^"]*"/g, " "));

  const tokens: string[] = [];
  for (const [token] of text.matchAll(/[A-Za-z_]\w*|\d+(?:\.\d+)?|==|!=|<=|>=|&&|\|\||\+\+|--|<<|>>|->|\+=|-=|\*=|\/=|[^\s\w]/g)) {
    if (/^\d/.test(token)) tokens.push("n");
    else if (/^[A-Za-z_]/.test(token)) tokens.push(keywords.has(token) ? token : "v");
    else tokens.push(token === "\u0001" ? "s" : token);
  }
  return tokens;
}

/** FNV-1a, 32-bit: fast, and good enough to tell runs of tokens apart. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The winnowed fingerprints of an answer. */
export function fingerprintsOf(source: string, language: string): ReadonlySet<number> {
  const tokens = tokensOf(source, language);
  const runs: number[] = [];
  for (let i = 0; i + K <= tokens.length; i++) runs.push(hash(tokens.slice(i, i + K).join(" ")));
  const kept = new Set<number>();
  if (runs.length === 0) return kept;
  if (runs.length < W) {
    kept.add(Math.min(...runs));
    return kept;
  }
  for (let i = 0; i + W <= runs.length; i++) kept.add(Math.min(...runs.slice(i, i + W)));
  return kept;
}

/**
 * Every pair of answers, in the same language, alike enough to be worth a
 * look — most alike first.
 */
export function similarPairs(submissions: readonly CodeSubmission[], starter: string | null = null): SimilarPair[] {
  const byLanguage = new Map<string, { key: string; prints: ReadonlySet<number> }[]>();
  for (const s of submissions) {
    const given = starter === null ? new Set<number>() : fingerprintsOf(starter, s.language);
    const prints = new Set([...fingerprintsOf(s.source, s.language)].filter((p) => !given.has(p)));
    const list = byLanguage.get(s.language) ?? [];
    list.push({ key: s.key, prints });
    byLanguage.set(s.language, list);
  }

  const pairs: SimilarPair[] = [];
  for (const list of byLanguage.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [x, y] = [list[i]!, list[j]!];
        const smaller = Math.min(x.prints.size, y.prints.size);
        if (smaller < MIN_FINGERPRINTS) continue;
        let shared = 0;
        for (const p of x.prints) if (y.prints.has(p)) shared++;
        const similarity = shared / smaller;
        if (similarity >= REPORT_AT) pairs.push({ a: x.key, b: y.key, similarity: Math.round(similarity * 1000) / 1000, shared });
      }
    }
  }
  return pairs.sort((p, q) => q.similarity - p.similarity || q.shared - p.shared);
}
