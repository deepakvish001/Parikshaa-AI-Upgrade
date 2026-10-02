import { usePreferences } from "../i18n.tsx";
import { sqlRows, sqlTables } from "./sql-view.ts";

/** Rows shown of a table before "and n more". */
const SHOWN = 8;

/** A test's tables, as a learner reads a schema: columns with types, the first rows, and the SQL beside. */
export function SqlSchema({ setup }: { readonly setup: string }) {
  const { t } = usePreferences();
  const tables = sqlTables(setup);
  if (tables.length === 0) return <pre>{setup}</pre>;
  return (
    <div className="sql-schema">
      {tables.map((table) => (
        <div className="scroll" key={table.name}>
          <table className="sql-table">
            <caption>{table.name}</caption>
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th key={c.name} scope="col">
                    {c.name} <span className="notice">{c.type}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.slice(0, SHOWN).map((row, i) => (
                <tr key={i}>
                  {row.map((v, j) => (
                    <td key={j}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {table.rows.length > SHOWN ? <p className="notice">{t("code.moreRows", { n: table.rows.length - SHOWN })}</p> : null}
        </div>
      ))}
      <details>
        <summary>{t("code.setupSql")}</summary>
        <pre>{setup}</pre>
      </details>
    </div>
  );
}

/** What a query returned, as rows; the plain text stays what is checked. */
export function SqlResult({ text, label }: { readonly text: string; readonly label: string }) {
  const { t } = usePreferences();
  const rows = sqlRows(text);
  if (rows.length === 0) return <p className="notice">{t("code.noRows")}</p>;
  return (
    <div className="scroll">
      <table className="sql-table" aria-label={label}>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((v, j) => (
                <td key={j}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
