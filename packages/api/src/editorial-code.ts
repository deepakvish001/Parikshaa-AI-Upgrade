/**
 * The programs in an editorial (Prep plan row 48): each fenced block in one of
 * the problem's languages, in order. A block whose info string says
 * `no-check` (```python no-check) is a fragment, not a program, and is left
 * out: a staff member marks it so on purpose.
 */

const ALIASES: Readonly<Record<string, string>> = { py: "python", python3: "python", "c++": "cpp", cc: "cpp", js: "javascript", node: "javascript" };

export interface EditorialProgram {
  /** 1-based, counting only fenced blocks. */
  readonly block: number;
  readonly language: string;
  readonly source: string;
}

export function editorialPrograms(markdown: string, languages: readonly string[]): EditorialProgram[] {
  const out: EditorialProgram[] = [];
  const fence = /^(`{3,}|~{3,})[ \t]*([^\n]*)\n([\s\S]*?)^\1[ \t]*$/gm;
  let block = 0;
  for (const match of markdown.matchAll(fence)) {
    block++;
    const info = match[2]!.trim().toLowerCase().split(/\s+/);
    const word = info[0] ?? "";
    const language = ALIASES[word] ?? word;
    if (!languages.includes(language) || info.includes("no-check")) continue;
    out.push({ block, language, source: match[3]! });
  }
  return out;
}
