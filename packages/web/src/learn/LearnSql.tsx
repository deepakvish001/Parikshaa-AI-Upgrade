import { useId, type ReactNode } from "react";
import type { Tri } from "./screens.ts";
import "./learn-sql.css";

/**
 * SQL in the problem workspace (tracker row 140, K2-7; the mock's SQL
 * workspace, docs/learn/mock-v3/app/src/screens/problem.tsx), its own chunk,
 * loaded only when an SQL problem opens. An SQL problem is a code problem in
 * the language `sql`: each test's input is the SQL that makes and fills its
 * tables, the answer is one query, the judge runs it on SQLite and compares
 * the rows it prints (one to a line, columns split by a tab). So:
 *
 * - the tables a problem gives (names, columns and their types) and each
 *   example's rows are read back from the examples' own SQL (as the old
 *   site's `sql-view.ts` does); what cannot be read stays the SQL text;
 * - a result, the learner's or the expected one, is rows without column
 *   names (the judge compares rows only), each row marked when it is missing
 *   from the learner's result or not in the expected one, in words as well as
 *   colour.
 *
 * Every value is text in a cell, never HTML: a result is the learner's own
 * output. Tables show at most `ROWS` rows and `COLS` columns, with a line for
 * the rest, and a long value is cut. Nothing here goes to Sahayak: the API
 * reads the problem and the learner's query itself.
 *
 * It imports nothing of Learn's own: the workspace hands it the words (`t`)
 * and the icon. Imported, Learn's shared modules would have a new importer
 * and the bundler would cut the shared chunks anew (old pages included).
 */

/** The workspace's words: a Tri in the learner's language. */
type Say = (tri: Tri) => string;
const fill = (text: string, values: Readonly<Record<string, string | number>>) => text.replace(/\{(\w+)\}/g, (all, key: string) => (Object.hasOwn(values, key) ? String(values[key]) : all));

/*
 * Reading a test's SQL back as tables, and the runner's output as rows: the
 * old site's components/sql-view.ts, copied here. Imported, it would join this
 * chunk to the old pages' shared ones and the bundler would cut those anew, so
 * the pages without the flag would fetch other files (as icons.tsx says).
 */

interface SqlTable {
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
function sqlTables(setup: string): SqlTable[] {
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
function sqlRows(output: string): string[][] {
  return output
    .split("\n")
    .filter((line, i, all) => !(line === "" && i === all.length - 1))
    .map((line) => line.split("\t"));
}

export const LQ = {
  noRows: ["No rows", "Koi row nahi", "कोई पंक्ति नहीं"],
  moreRows: ["…and {n} more rows", "…aur {n} rows", "…और {n} पंक्तियाँ"],
  moreCols: ["{n} more columns not shown", "{n} aur columns nahi dikhaye", "{n} और कॉलम नहीं दिखाए"],
  rowCount: ["{n} rows", "{n} rows", "{n} पंक्तियाँ"],
  setupSql: ["The SQL that makes these tables", "Ye tables banane wali SQL", "ये तालिकाएँ बनाने वाली SQL"],
  yours: ["Your result", "Aapka nateeja", "आपका परिणाम"],
  expected: ["Expected", "Sahi nateeja", "अपेक्षित परिणाम"],
  missing: ["missing from your result", "aapke nateeje me nahi", "आपके परिणाम में नहीं"],
  extra: ["not in the expected result", "sahi nateeje me nahi", "अपेक्षित परिणाम में नहीं"],
  differ: ["{missing} rows missing, {extra} rows extra", "{missing} rows kam, {extra} rows zyada", "{missing} पंक्तियाँ कम, {extra} ज़्यादा"],
  order: [
    "The same rows, in another order: this problem checks the order.",
    "Rows wahi, kram alag: is problem me kram bhi jaancha jaata hai.",
    "पंक्तियाँ वही, क्रम अलग: इस प्रश्न में क्रम भी जाँचा जाता है।",
  ],
  columns: ["Columns of {table}", "{table} ke columns", "{table} के कॉलम"],
} as const satisfies Record<string, Tri>;

/** Rows shown of a table; columns shown; characters shown of a value. */
export const ROWS = 12;
export const COLS = 10;
const CHARS = 120;
const cut = (value: string) => (value.length > CHARS ? `${value.slice(0, CHARS)}…` : value);

type Mark = "ok" | "missing" | "extra";

/**
 * The learner's rows against the expected ones, as sets that count repeats:
 * each of the learner's rows is "extra" when the expected result has no row
 * like it left over, each expected row "missing" when the learner's has none.
 * `sameRows` when nothing is either: then only the order differs.
 */
export function compareRows(yours: readonly (readonly string[])[], expected: readonly (readonly string[])[]): { yours: Mark[]; expected: Mark[]; sameRows: boolean } {
  const key = (row: readonly string[]) => row.join("\t");
  const left = new Map<string, number>();
  for (const row of expected) left.set(key(row), (left.get(key(row)) ?? 0) + 1);
  const marksYours = yours.map((row): Mark => {
    const n = left.get(key(row)) ?? 0;
    if (n === 0) return "extra";
    left.set(key(row), n - 1);
    return "ok";
  });
  const right = new Map<string, number>();
  for (const row of yours) right.set(key(row), (right.get(key(row)) ?? 0) + 1);
  const marksExpected = expected.map((row): Mark => {
    const n = right.get(key(row)) ?? 0;
    if (n === 0) return "missing";
    right.set(key(row), n - 1);
    return "ok";
  });
  return { yours: marksYours, expected: marksExpected, sameRows: !marksYours.includes("extra") && !marksExpected.includes("missing") };
}

/** One table: a caption, the column names when known, at most ROWS rows and COLS columns, each value as text. */
function Grid({ t, label, caption, columns, rows, marks }: { readonly t: Say; readonly label: string; readonly caption?: ReactNode; readonly columns?: readonly string[]; readonly rows: readonly (readonly string[])[]; readonly marks?: readonly Mark[] }) {
  const width = Math.max(columns?.length ?? 0, ...rows.map((r) => r.length));
  const hiddenCols = Math.max(0, width - COLS);
  const shown = rows.slice(0, ROWS);
  return (
    <div className="lq-grid">
      <div className="lq-scroll" tabIndex={0} role="region" aria-label={label}>
        <table className="lq-table">
          <caption>{caption ?? label}</caption>
          {columns === undefined ? null : (
            <thead>
              <tr>
                {columns.slice(0, COLS).map((c, i) => (
                  <th key={`${i}-${c}`} scope="col">
                    {cut(c)}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {shown.map((row, i) => {
              const mark = marks?.[i] ?? "ok";
              return (
                <tr key={i} className={mark === "ok" ? undefined : `lq-${mark}`}>
                  {row.slice(0, COLS).map((value, j) => (
                    <td key={j}>
                      {j === 0 && mark !== "ok" ? (
                        <>
                          <span className="lq-sign" aria-hidden="true">
                            {mark === "missing" ? "−" : "+"}
                          </span>
                          <span className="ln-sr">({t(mark === "missing" ? LQ.missing : LQ.extra)}) </span>
                        </>
                      ) : null}
                      {cut(value)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > ROWS ? <p className="ln-faint lq-more">{fill(t(LQ.moreRows), { n: rows.length - ROWS })}</p> : null}
      {hiddenCols > 0 ? <p className="ln-faint lq-more">{fill(t(LQ.moreCols), { n: hiddenCols })}</p> : null}
    </div>
  );
}

/** The tables a problem gives, as a learner reads a schema: each table's columns and their types. Nothing when they cannot be read. */
export function SqlSchema({ setup, t, icon }: { readonly setup: string; readonly t: Say; readonly icon: ReactNode }) {
  const tables = sqlTables(setup);
  if (tables.length === 0) return null;
  return (
    <div className="lq-schema">
      {tables.map((table) => (
        <section key={table.name} className="lq-sch" aria-label={fill(t(LQ.columns), { table: table.name })}>
          <p className="lq-sch-h">
            {icon}
            {table.name}
          </p>
          <ul className="lq-cols">
            {table.columns.map((c) => (
              <li key={c.name}>
                <span>{c.name}</span>
                <span className="ln-faint">{c.type}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** An example's tables with their rows, and the SQL that makes them; that SQL alone when it cannot be read. */
export function SqlSetup({ setup, t }: { readonly setup: string; readonly t: Say }) {
  const tables = sqlTables(setup);
  if (tables.length === 0) return <pre tabIndex={0}>{setup}</pre>;
  return (
    <div className="lq-setup">
      {tables.map((table) => (
        <Grid
          t={t}
          key={table.name}
          label={`${table.name} · ${fill(t(LQ.rowCount), { n: table.rows.length })}`}
          caption={
            <>
              <span className="lq-name">{table.name}</span> <span className="ln-faint">· {fill(t(LQ.rowCount), { n: table.rows.length })}</span>
            </>
          }
          columns={table.columns.map((c) => c.name)}
          rows={table.rows}
        />
      ))}
      <details className="lq-sql">
        <summary>{t(LQ.setupSql)}</summary>
        <pre tabIndex={0}>{setup}</pre>
      </details>
    </div>
  );
}

/** Rows a query printed (or should print), without column names: the judge compares rows only. */
export function SqlRows({ text, label, t }: { readonly text: string; readonly label: string; readonly t: Say }) {
  const rows = sqlRows(text);
  if (rows.length === 0) return <p className="lq-none">{t(LQ.noRows)}</p>;
  return <Grid t={t} label={label} rows={rows} />;
}

/** The learner's result beside the expected one, rows marked where they differ; the learner's alone when nothing is expected (their own tables). */
export function SqlCompare({ yours, expected, t }: { readonly yours: string; readonly expected: string | null; readonly t: Say }) {
  const id = useId();
  const mine = sqlRows(yours);
  if (expected === null) {
    return (
      <div className="lq-compare">
        <Side t={t} label={t(LQ.yours)} rows={mine} />
      </div>
    );
  }
  const right = sqlRows(expected);
  const marks = compareRows(mine, right);
  const missing = marks.expected.filter((m) => m === "missing").length;
  const extra = marks.yours.filter((m) => m === "extra").length;
  const differs = yours !== expected;
  return (
    <div className="lq-compare-wrap">
      {!differs ? null : marks.sameRows ? (
        <p className="lq-note" id={`${id}-n`}>
          {t(LQ.order)}
        </p>
      ) : (
        <p className="lq-note" id={`${id}-n`}>
          {fill(t(LQ.differ), { missing, extra })}
        </p>
      )}
      <div className="lq-compare">
        <Side t={t} label={t(LQ.yours)} rows={mine} marks={marks.sameRows ? undefined : marks.yours} />
        <Side t={t} label={t(LQ.expected)} rows={right} marks={marks.sameRows ? undefined : marks.expected} />
      </div>
    </div>
  );
}

function Side({ t, label, rows, marks }: { readonly t: Say; readonly label: string; readonly rows: readonly (readonly string[])[]; readonly marks?: readonly Mark[] | undefined }) {
  if (rows.length === 0) {
    return (
      <div className="lq-side" role="group" aria-label={label}>
        <span className="ln-eyebrow">{label}</span>
        <p className="lq-none">{t(LQ.noRows)}</p>
      </div>
    );
  }
  return (
    <div className="lq-side" role="group" aria-label={label}>
      <Grid t={t} label={`${label} · ${fill(t(LQ.rowCount), { n: rows.length })}`} rows={rows} {...(marks === undefined ? {} : { marks })} />
    </div>
  );
}
