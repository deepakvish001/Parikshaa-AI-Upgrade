/**
 * SQL practice, shown as tables (Prep plan row 45): a test's setup script read
 * back as its tables (columns and rows), and the runner's output (one row to a
 * line, columns separated by a tab) as rows. Reading only: anything this does
 * not follow is left to the raw text beside it.
 */

export interface SqlTable {
  readonly name: string;
  readonly columns: readonly { readonly name: string; readonly type: string }[];
  readonly rows: readonly (readonly string[])[];
}

/** Split on a separator outside quotes and brackets. */
function splitTop(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quote !== null) {
      current += c;
      if (c === quote) {
        if (text[i + 1] === quote) current += text[++i]!;
        else quote = null;
      }
      continue;
    }
    if (c === "'" || c === '"' || c === "`") quote = c;
    else if (c === "(") depth++;
    else if (c === ")") depth--;
    if (c === separator && depth === 0) {
      parts.push(current);
      current = "";
    } else current += c;
  }
  if (current.trim() !== "") parts.push(current);
  return parts;
}

const unquote = (name: string) => name.trim().replace(/^["`[]|["`\]]$/g, "");
const value = (v: string) => {
  const t = v.trim();
  if (/^null$/i.test(t)) return "NULL";
  return t.startsWith("'") && t.endsWith("'") ? t.slice(1, -1).replace(/''/g, "'") : t;
};
const CONSTRAINT = /^(primary|foreign|unique|check|constraint)\b/i;

/** The tables a setup script makes, with the rows it puts in them; [] when it cannot be read. */
export function sqlTables(setup: string): SqlTable[] {
  const tables = new Map<string, { name: string; columns: { name: string; type: string }[]; rows: string[][] }>();
  for (const statement of splitTop(setup, ";")) {
    const s = statement.trim();
    const create = /^create\s+table\s+(?:if\s+not\s+exists\s+)?([^\s(]+)\s*\(([\s\S]*)\)\s*$/i.exec(s);
    if (create !== null) {
      const columns = splitTop(create[2]!, ",")
        .map((c) => c.trim())
        .filter((c) => c !== "" && !CONSTRAINT.test(c))
        .map((c) => {
          const [name = "", type = ""] = c.split(/\s+/);
          return { name: unquote(name), type: type.toUpperCase() };
        });
      tables.set(unquote(create[1]!).toLowerCase(), { name: unquote(create[1]!), columns, rows: [] });
      continue;
    }
    const insert = /^insert\s+into\s+([^\s(]+)\s*(?:\(([^)]*)\))?\s*values\s*([\s\S]*)$/i.exec(s);
    if (insert !== null) {
      const table = tables.get(unquote(insert[1]!).toLowerCase());
      if (table === undefined) continue;
      const named = insert[2] === undefined ? null : insert[2].split(",").map(unquote);
      for (const tuple of splitTop(insert[3]!, ",")) {
        const inner = /^\s*\(([\s\S]*)\)\s*$/.exec(tuple);
        if (inner === null) continue;
        const values = splitTop(inner[1]!, ",").map(value);
        table.rows.push(named === null ? values : table.columns.map((c) => values[named.findIndex((n) => n.toLowerCase() === c.name.toLowerCase())] ?? "NULL"));
      }
    }
  }
  return [...tables.values()];
}

/** The runner's output as rows: a line each, columns split on a tab. */
export function sqlRows(output: string): string[][] {
  return output
    .split("\n")
    .filter((line, i, all) => !(line === "" && i === all.length - 1))
    .map((line) => line.split("\t"));
}
