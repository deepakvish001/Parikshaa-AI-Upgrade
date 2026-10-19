import { useState } from "react";
import { Play, Send, Table2, KeyRound, CircleX, CircleCheck, Sparkles } from "lucide-react";
import { useT } from "../lib/core";
import { Code, Level, Seg } from "../ui/kit";
import { FocusBar } from "../ui/focus";

const Q_WRONG = `SELECT d.name AS department,
       e.name AS employee,
       e.salary
FROM employees e
JOIN departments d ON d.id = e.dept_id
WHERE e.salary = (
  SELECT MAX(salary) FROM employees
)
ORDER BY department;`;
const Q_RIGHT = Q_WRONG.replace("SELECT MAX(salary) FROM employees", "SELECT MAX(salary) FROM employees x\n  WHERE x.dept_id = e.dept_id");

export function SqlScreen() {
  const t = useT();
  const [state, setState] = useState<"wa" | "ac">("wa");
  const rowsExpected = [
    ["Design", "Meera", "92000"],
    ["Engineering", "Kabir", "148000"],
    ["Engineering", "Sana", "148000"],
    ["Sales", "Arjun", "76000"],
  ];
  const rowsYours = [
    ["Engineering", "Kabir", "148000"],
    ["Engineering", "Sana", "148000"],
  ];
  const rows = state === "ac" ? rowsExpected : rowsYours;
  return (
    <div className="work">
      <FocusBar
        back="abhyas"
        backLabel={t("Back to practice", "Abhyas par wapas", "अभ्यास पर वापस")}
        title={
          <>
            <b>{t("Top earner in each department", "Har department ka top earner", "हर विभाग में सबसे ज़्यादा वेतन")}</b>
            <span className="faint hide-phone">· SQL 50 · #14</span>
          </>
        }
      />
      <div className="work-body" style={{ ["--split" as string]: "42%" }}>
        <section className="pane pane-left m-on" aria-label="Problem">
          <div className="pane-scroll">
            <div className="stmt">
              <div className="row wrap" style={{ gap: 6 }}>
                <Level lv={3} />
                <span className="tag">{t("Subquery", "Subquery", "सबक्वेरी")}</span>
                <span className="tag">JOIN</span>
              </div>
              <p>
                {t(
                  "For every department, list the employee or employees with the highest salary in that department. Show department, employee and salary, sorted by department.",
                  "Har department ke liye us department me sabse zyada salary wale employee (ek ya zyada) dikhao. Department, employee aur salary, department ke kram me.",
                  "हर विभाग के लिए सबसे ज़्यादा वेतन वाले कर्मचारी दिखाएँ।",
                )}
              </p>
              {[
                {
                  n: "employees",
                  cols: [
                    ["id", "INT", true],
                    ["name", "TEXT", false],
                    ["salary", "INT", false],
                    ["dept_id", "INT → departments.id", false],
                  ],
                },
                {
                  n: "departments",
                  cols: [
                    ["id", "INT", true],
                    ["name", "TEXT", false],
                  ],
                },
              ].map((tb) => (
                <div key={tb.n} className="schema">
                  <div className="schema-head">
                    <Table2 size={14} /> <b className="mono">{tb.n}</b>
                  </div>
                  {tb.cols.map(([c, ty, pk]) => (
                    <div key={c as string} className="schema-row">
                      <span className="mono">
                        {pk ? <KeyRound size={12} style={{ color: "var(--plus)" }} /> : null} {c}
                      </span>
                      <span className="faint mono">{ty}</span>
                    </div>
                  ))}
                </div>
              ))}
              <p className="faint" style={{ fontSize: "var(--fs-12)" }}>
                {t("Ties count: if two people share the top salary, show both.", "Barabar ho to dono dikhao.", "बराबर हो तो दोनों दिखाएँ।")}
              </p>
            </div>
          </div>
        </section>
        <div className="split-handle" aria-hidden="true" />
        <section className="pane pane-right m-on" aria-label="Query">
          <div className="editor-top">
            <div className="file-tabs">
              <span className="file-tab on">query.sql</span>
            </div>
            <span className="chip">PostgreSQL 16</span>
          </div>
          <div className="editor">
            <Code code={state === "ac" ? Q_RIGHT : Q_WRONG} bad={state === "wa" ? [7] : []} hl={state === "ac" ? [7, 8] : []} />
          </div>
          <div className="editor-status">
            <span>{t("Saved", "Saved", "सहेजा")}</span>
            <span className="grow" />
            <button type="button" className="btn secondary sm">
              <Play size={13} /> {t("Run", "Run", "चलाएँ")}
            </button>
            <button type="button" className="btn primary sm" onClick={() => setState("ac")}>
              <Send size={13} /> {t("Submit", "Submit", "जमा करें")}
            </button>
          </div>
          <div className="console">
            <div className="console-head">
              <span className="eyebrow">{t("Result", "Nateeja", "नतीजा")}</span>
              <Seg
                label="State"
                value={state}
                onChange={setState}
                options={[
                  { value: "wa", label: "WA" },
                  { value: "ac", label: "AC" },
                ]}
              />
            </div>
            <div className="console-body" key={state}>
              <div className={`vd ${state === "wa" ? "vd-wa" : "vd-ac"}`}>
                <div className="vd-head">
                  {state === "wa" ? <CircleX size={22} /> : <CircleCheck size={22} />}
                  <div className="grow">
                    <b>{state === "wa" ? t("Wrong answer: 2 rows missing", "Galat: 2 rows kam", "गलत: 2 पंक्तियाँ कम") : t("Accepted", "Sahi", "स्वीकृत")}</b>
                    <span>
                      {state === "wa"
                        ? t("Your subquery finds the top salary of the whole company, not of each department.", "Aapki subquery poori company ka max nikalti hai, har department ka nahi.", "आपकी सबक्वेरी पूरी कंपनी का अधिकतम निकालती है।")
                        : t("All 6 test databases match.", "Saare 6 test databases match.", "सभी 6 टेस्ट मेल खाते हैं।")}
                    </span>
                  </div>
                </div>
                <div className="table-wrap panel">
                  <table className="dtable result-grid">
                    <thead>
                      <tr>
                        <th>department</th>
                        <th>employee</th>
                        <th className="r">salary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsExpected.map((r) => {
                        const present = rows.some((x) => x[1] === r[1]);
                        return (
                          <tr key={r[1]} className={present ? "" : "missing"}>
                            <td>{r[0]}</td>
                            <td>{r[1]}</td>
                            <td className="r num">{r[2]}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {state === "wa" && (
                  <div className="row wrap" style={{ gap: 8 }}>
                    <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
                      {t("Rows with a red bar are expected but missing from your result.", "Laal bar wali rows sahi jawab me hain par aapke me nahi.", "लाल पट्टी वाली पंक्तियाँ गायब हैं।")}
                    </span>
                    <span className="grow" />
                    <button type="button" className="btn secondary sm">
                      <Sparkles size={13} /> {t("Ask Sahayak", "Sahayak se poochho", "सहायक से पूछें")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
