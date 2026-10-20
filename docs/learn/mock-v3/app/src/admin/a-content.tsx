import { useState, type ReactElement } from "react";
import {
  Plus,
  Upload,
  Send,
  Archive,
  ListPlus,
  Eye,
  Copy,
  Trash2,
  Sparkles,
  CircleCheck,
  CircleX,
  RotateCw,
  History,
  GripVertical,
  Type,
  CodeXml,
  Image,
  MessageSquareQuote,
  ListChecks,
  Heading,
  Link2,
  Pause,
  Square,
  Building2,
  ShieldCheck,
  ExternalLink,
  TriangleAlert,
  Lock,
  Save,
  FileText,
  Factory,
  Network,
  Calculator,
  Clock,
  Play,
} from "lucide-react";
import { Link, navigate, useT, useToast } from "../lib/core";
import { Badge, Level, Tabs, Code, Card, Toggle, Drawer, Meter, Seg } from "../ui/kit";
import { AdmHead, Gate, Toolbar, Pager, RowMenu, Status, useSelection, FourEyes } from "./akit";

/* ---------------- problems list ---------------- */

const PROBS = [
  { id: "P-2231", n: "Valid brackets", st: "review", k: "DSA", lv: 2, ac: 58, rep: 1, help: 91, v: 3, upd: "10:02", ai: false },
  { id: "P-2230", n: "Pair with target sum", st: "live", k: "DSA", lv: 2, ac: 61, rep: 0, help: 94, v: 5, upd: "Yesterday", ai: false },
  { id: "P-2229", n: "Bus stop queue", st: "live", k: "DSA", lv: 3, ac: 37, rep: 2, help: 88, v: 2, upd: "18 Oct", ai: true },
  { id: "P-2228", n: "Top 3 per branch without an offer", st: "live", k: "SQL", lv: 3, ac: 44, rep: 0, help: 90, v: 1, upd: "17 Oct", ai: false },
  { id: "P-2227", n: "Tree of lamps", st: "draft", k: "CP", lv: 5, ac: 0, rep: 0, help: 0, v: 1, upd: "16 Oct", ai: true },
  { id: "P-2226", n: "Rotting oranges", st: "live", k: "DSA", lv: 3, ac: 49, rep: 5, help: 79, v: 4, upd: "15 Oct", ai: false },
  { id: "P-1990", n: "Pair sum (old)", st: "bad", k: "DSA", lv: 2, ac: 55, rep: 0, help: 70, v: 2, upd: "2 Sep", ai: false },
];
const ST: Record<string, ["live" | "review" | "draft" | "bad", string]> = { live: ["live", "Live"], review: ["review", "In review"], draft: ["draft", "Draft"], bad: ["bad", "Retired"] };

export function AdmProblems() {
  const t = useT();
  const toast = useToast();
  const s = useSelection(PROBS.map((p) => p.id));
  const [del, setDel] = useState(false);
  return (
    <div className="col g16">
      <AdmHead
        title={t("Problems", "Problems", "प्रश्न")}
        sub={t("4,982 problems · 4,611 live · 64 in review", "4,982 problems · 4,611 live · 64 review me", "4,982 प्रश्न")}
        actions={
          <>
            <Gate mod="content" className="btn">
              <Upload />
              {t("Import package", "Package import", "पैकेज आयात")}
            </Gate>
            <Gate mod="content" className="btn pri" onClick={() => navigate("adm-problem")}>
              <Plus />
              {t("New problem", "Naya problem", "नया प्रश्न")}
            </Gate>
          </>
        }
      />
      <section className="card">
        <Toolbar
          placeholder={t("Search by title, ID, pattern", "Title, ID, pattern se khojo", "खोजें")}
          filters={[{ label: t("Status: live", "Status: live", "स्थिति: लाइव") }, { label: "DSA", on: true }, { label: t("Level", "Level", "स्तर") }, { label: t("Has reports", "Reports wale", "रिपोर्ट") }, { label: t("AI-drafted", "AI-drafted", "एआई मसौदा") }]}
          right={
            <Seg
              value="table"
              onChange={() => {}}
              items={[
                { id: "table", label: t("Table", "Table", "तालिका") },
                { id: "board", label: t("Board", "Board", "बोर्ड") },
              ]}
            />
          }
        />
        {s.count > 0 && (
          <div style={{ padding: "8px 12px" }}>
            <div className="bulkbar">
              <b>
                {s.count} {t("selected", "chune", "चयनित")}
              </b>
              <span className="grow" />
              <button className="btn" onClick={() => toast(t("Sent to review", "Review me bheja", "समीक्षा में भेजा"))}>
                <Send />
                {t("Send to review", "Review bhejo", "समीक्षा")}
              </button>
              <button className="btn">
                <ListPlus />
                {t("Add to sheet", "Sheet me jodo", "शीट में")}
              </button>
              <button className="btn" onClick={() => setDel(true)}>
                <Archive />
                {t("Retire", "Retire", "हटाएँ")}
              </button>
              <button className="icon-btn sm" style={{ color: "inherit" }} onClick={s.clear} aria-label="Clear selection">
                ✕
              </button>
            </div>
          </div>
        )}
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <span onClick={s.toggleAll}>{s.box("__all")}</span>
                </th>
                <th>{t("Problem", "Problem", "प्रश्न")}</th>
                <th>{t("Status", "Status", "स्थिति")}</th>
                <th>{t("Kind", "Kind", "प्रकार")}</th>
                <th>{t("Level", "Level", "स्तर")}</th>
                <th className="r">AC %</th>
                <th className="r">{t("Helped?", "Kaam aaya?", "उपयोगी?")}</th>
                <th className="r">{t("Reports", "Reports", "रिपोर्ट")}</th>
                <th className="r">Ver</th>
                <th>{t("Updated", "Updated", "अद्यतन")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {PROBS.map((p) => (
                <tr key={p.id} aria-selected={!!s.sel[p.id]}>
                  <td>{s.box(p.id)}</td>
                  <td>
                    <Link to="adm-problem" className="p-link">
                      {p.n}
                    </Link>
                    <span className="tiny mono faint" style={{ display: "block" }}>
                      {p.id} {p.ai && <Badge tone="ai" sq>AI draft</Badge>}
                    </span>
                  </td>
                  <td>
                    <Status s={ST[p.st][0]}>{ST[p.st][1]}</Status>
                  </td>
                  <td>{p.k}</td>
                  <td>
                    <Level n={p.lv as 2} short />
                  </td>
                  <td className="r num">{p.ac ? `${p.ac}%` : "—"}</td>
                  <td className={`r num ${p.help && p.help < 80 ? "t-red" : ""}`}>{p.help ? `${p.help}%` : "—"}</td>
                  <td className={`r num ${p.rep > 2 ? "t-red" : ""}`}>{p.rep}</td>
                  <td className="r num">v{p.v}</td>
                  <td className="faint small">{p.upd}</td>
                  <td>
                    <RowMenu
                      items={[
                        { label: t("Open editor", "Editor kholo", "संपादक"), icon: <FileText />, onClick: () => navigate("adm-problem") },
                        { label: t("View as learner", "Learner ki tarah", "शिक्षार्थी दृश्य"), icon: <Eye />, onClick: () => navigate("problem") },
                        { label: t("Duplicate", "Copy banao", "प्रतिलिपि"), icon: <Copy /> },
                        { label: t("Delete (needs approval)", "Delete (approval chahiye)", "हटाएँ (मंज़ूरी)"), icon: <Trash2 />, danger: true, onClick: () => setDel(true) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager total="4,982" shown="1–7" />
      </section>
      <FourEyes open={del} onClose={() => setDel(false)} title={t("Delete or retire content", "Content delete ya retire", "सामग्री हटाएँ")} what="P-1990 · Pair sum (old) · 2 versions · 1,240 submissions keep their history" />
    </div>
  );
}

/* ---------------- problem editor ---------------- */

const CHECKS: [string, boolean, string][] = [
  ["Reference solution (4 languages)", true, "31/31 tests · max 0.41 s"],
  ["Wrong solutions fail as expected", true, "overflow → WA on 23, O(n²) → TLE on 17"],
  ["Validator accepts every test", true, "31/31"],
  ["Second model solves independently", true, "matches on all tests"],
  ["Duplicate check", true, "nearest: P-1201 at 0.18"],
  ["Style critic", false, "2 notes: long sentence in para 2; missing 'why' for sample 2"],
  ["Hinglish version", false, "not written yet"],
];

export function AdmProblemEditor() {
  const t = useT();
  const toast = useToast();
  const [tab, setTab] = useState("statement");
  const failing = CHECKS.filter((c) => !c[1]).length;
  return (
    <div className="col g16">
      <div className="ed-head">
        <div className="grow" style={{ minWidth: 0 }}>
          <span className="tiny mono faint">P-2231 · v3 draft · {t("autosaved 10:02", "autosave 10:02", "स्वतः सहेजा 10:02")}</span>
          <h1 className="h2" style={{ fontSize: 22 }}>
            Valid brackets
          </h1>
          <div className="row g6 mt4">
            <Status s="review">{t("In review", "Review me", "समीक्षा में")}</Status>
            <Level n={2} short />
            <Badge>Stack</Badge>
            <Badge>{t("Free", "Free", "फ़्री")}</Badge>
          </div>
        </div>
        <div className="row wrap g8">
          <Link to="problem" className="btn">
            <Eye />
            {t("Preview as learner", "Learner preview", "पूर्वावलोकन")}
          </Link>
          <Gate mod="content" className="btn">
            <Save />
            {t("Save", "Save", "सहेजें")}
          </Gate>
          <button className="btn pri" disabled data-tip={t(`${failing} checks failing · review pending`, `${failing} checks fail · review baaki`, "जाँच विफल")}>
            <Lock />
            {t("Publish", "Publish", "प्रकाशित")}
          </button>
        </div>
      </div>
      <div className="banner red">
        <TriangleAlert />
        <span className="small grow">{t(`Publish opens when every check is green and a reviewer approves. ${failing} checks still need work.`, `Publish tab khulega jab saare checks hare hon aur reviewer approve kare. ${failing} checks baaki.`, "सभी जाँच हरी होने पर।")}</span>
        <button className="link small" onClick={() => setTab("checks")}>
          {t("See checks", "Checks dekho", "जाँच देखें")}
        </button>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "statement", label: t("Statement", "Statement", "कथन") },
          { id: "package", label: t("Tests", "Tests", "टेस्ट"), count: 31 },
          { id: "solutions", label: t("Solutions", "Solutions", "हल"), count: 7 },
          { id: "editorial", label: t("Editorial", "Editorial", "संपादकीय") },
          { id: "visuals", label: t("Visuals", "Visuals", "दृश्य") },
          { id: "meta", label: t("Metadata", "Metadata", "मेटाडेटा") },
          { id: "checks", label: t("Checks", "Checks", "जाँच"), count: `${CHECKS.length - failing}/${CHECKS.length}` },
          { id: "history", label: t("History", "History", "इतिहास") },
        ]}
      />
      {tab === "statement" && (
        <div className="split-ed">
          <section className="card">
            <div className="card-h">
              <span className="h3">Markdown</span>
              <Seg value="en" onChange={() => {}} items={[{ id: "en", label: "EN" }, { id: "hg", label: "HG" }, { id: "hi", label: "हि" }]} />
            </div>
            <textarea
              className="md-ed mono"
              defaultValue={`Given a string made of the characters ()[]{}, print true if every opening bracket is closed by the same type of bracket in the right order, else false.\n\nAn empty string counts as valid.\n\n## Constraints\n- 0 ≤ |s| ≤ 10^5\n\n## Example 1\nInput: ([]{})\nOutput: true`}
            />
          </section>
          <section className="card">
            <div className="card-h">
              <Eye className="ic" />
              <span className="h3">{t("Live preview", "Live preview", "लाइव पूर्वावलोकन")}</span>
            </div>
            <div className="card-b col g10">
              <h2 className="display" style={{ fontSize: 28 }}>
                Valid brackets
              </h2>
              <p className="prose small">Given a string made of the characters ()[]{"{}"}, print true if every opening bracket is closed by the same type of bracket in the right order, else false.</p>
              <p className="prose small">An empty string counts as valid.</p>
              <pre className="ex-b">{"Input   ([]{})\nOutput  true"}</pre>
            </div>
          </section>
        </div>
      )}
      {tab === "package" && (
        <section className="card">
          <Toolbar
            placeholder={t("Filter tests", "Tests filter", "टेस्ट")}
            right={
              <>
                <Gate mod="content" className="btn sm">
                  <Upload />
                  ZIP
                </Gate>
                <Gate mod="content" className="btn sm pri" onClick={() => toast(t("Regenerating 24 tests from generators", "Generators se 24 tests dobara", "टेस्ट फिर से"))}>
                  <RotateCw />
                  {t("Regenerate", "Dobara banao", "पुनः बनाएँ")}
                </Gate>
              </>
            }
          />
          <div className="tbl-wrap">
            <table className="tbl dense">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t("Type", "Type", "प्रकार")}</th>
                  <th>{t("Size", "Size", "आकार")}</th>
                  <th>{t("Source", "Source", "स्रोत")}</th>
                  <th>{t("Reference", "Reference", "संदर्भ")}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [1, "Sample", "6 chars", "hand", "0.00 s"],
                  [2, "Sample", "4 chars", "hand", "0.00 s"],
                  [3, "Edge", "empty", "hand", "0.00 s"],
                  [17, "Hidden", "100,000 chars", "gen_random(seed=17)", "0.03 s"],
                  [23, "Hidden", "99,999 '('", "gen_unbalanced()", "0.02 s"],
                  [31, "Hidden", "100,000 nested", "gen_deep()", "0.41 s"],
                ].map(([a, b, c, d, e]) => (
                  <tr key={a as number}>
                    <td className="num">{a}</td>
                    <td>
                      <Badge tone={b === "Sample" ? "pen" : b === "Edge" ? "coin" : ""}>{b}</Badge>
                    </td>
                    <td className="mono tiny">{c}</td>
                    <td className="mono tiny">{d}</td>
                    <td className="num t-tick">{e}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-f tiny faint">{t("Checker: exact match (tokens) · limits 1 s / 256 MB, Python ×3", "Checker: exact (tokens) · limits 1 s / 256 MB, Python ×3", "चेकर")}</div>
        </section>
      )}
      {tab === "solutions" && (
        <div className="grid c2">
          {[
            ["Reference · C++", "AC", "31/31"],
            ["Reference · Python", "AC", "31/31"],
            ["Wrong · forgets empty stack", "WA expected", "WA on 3 ✓"],
            ["Wrong · counts only", "WA expected", "WA on 2 ✓"],
          ].map(([n, e, r]) => (
            <section key={n} className="card pad col g8">
              <div className="row between">
                <b className="small">{n}</b>
                <Badge tone={e === "AC" ? "tick" : "red"}>{e}</Badge>
              </div>
              <Code code={"stack<char> st;\nfor (char c : s) { /* … */ }"} nonum />
              <span className="tiny t-tick">{r}</span>
            </section>
          ))}
        </div>
      )}
      {tab === "checks" && (
        <section className="card">
          <div className="list">
            {CHECKS.map(([n, ok, d]) => (
              <div key={n} className="li">
                {ok ? <CircleCheck style={{ width: 20, height: 20, color: "var(--tick)" }} /> : <CircleX style={{ width: 20, height: 20, color: "var(--red-text)" }} />}
                <span className="grow">
                  <b className="small">{n}</b>
                  <span className="tiny faint" style={{ display: "block" }}>
                    {d}
                  </span>
                </span>
                {!ok && (
                  <Gate mod="content" className="btn sm">
                    <RotateCw />
                    {t("Run again", "Dobara chalao", "फिर चलाएँ")}
                  </Gate>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {tab === "history" && (
        <section className="card">
          <div className="list">
            {[
              ["v3", "Kunal (Editor)", "draft · +2 tests, statement edited", "today 10:02"],
              ["v2", "Ananya (Reviewer)", "published", "12 Sep"],
              ["v1", "Factory batch 6", "drafted by AI, reviewed", "2 Sep"],
            ].map(([v, who, what, when]) => (
              <div key={v} className="li">
                <span className="ic-box">
                  <History />
                </span>
                <span className="grow small">
                  <b>{v}</b> · {who} · <span className="muted">{what}</span>
                </span>
                <span className="tiny faint">{when}</span>
                <button className="btn sm">{t("Diff", "Diff", "अंतर")}</button>
                {v !== "v3" && (
                  <Gate mod="content" need="full" className="btn sm">
                    {t("Roll back", "Wapas lo", "वापस")}
                  </Gate>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {(tab === "editorial" || tab === "visuals" || tab === "meta") && (
        <section className="card pad col g12">
          {tab === "meta" ? (
            <div className="grid c2">
              {[
                [t("Patterns", "Patterns", "पैटर्न"), "Stack, Matching"],
                [t("Rating / level", "Rating / level", "रेटिंग"), "1100 · L2"],
                [t("Sheet", "Sheet", "शीट"), "DSA sheet · Step 8"],
                [t("Access", "Access", "पहुँच"), "Free"],
                [t("Companies (with source)", "Companies (source ke saath)", "कंपनियाँ"), "Nimbu Labs · 3 verified experiences"],
                [t("Prerequisites", "Prerequisites", "पूर्वापेक्षा"), "Stack: the LIFO idea"],
              ].map(([k, v]) => (
                <div key={k} className="field">
                  <label>{k}</label>
                  <input className="input" defaultValue={v} />
                </div>
              ))}
            </div>
          ) : (
            <div className="row g12">
              <span className="ic-box">{tab === "editorial" ? <FileText /> : <Image />}</span>
              <span className="small muted">
                {tab === "editorial"
                  ? t("4-step editorial editor with outline, code tabs and a learner preview (same layout as the editorial page).", "4-kadam editorial editor: outline, code tabs, learner preview.", "4-चरण संपादक।")
                  : t("Visual spec JSON on the left, live sketch preview on the right, frames with captions in both languages.", "Baayein visual spec JSON, daayein live sketch, dono bhashaon me captions.", "दृश्य संपादक।")}
              </span>
              <Link to={tab === "editorial" ? "editorial" : "editorial"} className="btn sm">
                {t("See learner view", "Learner view", "शिक्षार्थी दृश्य")}
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ---------------- aptitude & quiz ---------------- */

export function AdmAptitude() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="col g16">
      <AdmHead
        title={t("Aptitude & quiz", "Aptitude aur quiz", "एप्टीट्यूड")}
        sub={t("12,480 items · 38 practice sets · 50 mocks", "12,480 items · 38 sets · 50 mocks", "12,480 आइटम")}
        actions={
          <>
            <Gate mod="content" className="btn">
              <Calculator />
              {t("Mock builder", "Mock builder", "मॉक बिल्डर")}
            </Gate>
            <Gate mod="content" className="btn pri" onClick={() => setOpen(true)}>
              <Plus />
              {t("New item", "Naya item", "नया आइटम")}
            </Gate>
          </>
        }
      />
      <div className="grid c3">
        <section className="card" style={{ gridColumn: "span 2" }}>
          <Toolbar placeholder={t("Search items", "Items khojo", "खोजें")} filters={[{ label: "Quant", on: true }, { label: t("Topic: percentages", "Topic: percentages", "प्रतिशत") }, { label: t("Wrong rate > 60%", "Galat > 60%", "गलत > 60%") }]} />
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("Item", "Item", "आइटम")}</th>
                  <th>{t("Topic", "Topic", "विषय")}</th>
                  <th className="r">{t("Target", "Target", "लक्ष्य")}</th>
                  <th className="r">{t("Wrong", "Galat", "गलत")}</th>
                  <th>{t("Status", "Status", "स्थिति")}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["+20% then −20%: net change?", "Percentages", "40 s", 46, "live"],
                  ["A 12 days, B 18 days, together 4 days…", "Time & work", "60 s", 63, "live"],
                  ["Train crosses a pole in 9 s…", "Speed & distance", "45 s", 38, "review"],
                  ["Seating: 6 people, 2 rows…", "Seating", "120 s", 71, "live"],
                ].map(([q, tp, tg, w, st]) => (
                  <tr key={q as string} onClick={() => setOpen(true)} style={{ cursor: "pointer" }}>
                    <td className="small">{q}</td>
                    <td>
                      <Badge>{tp}</Badge>
                    </td>
                    <td className="r num">{tg}</td>
                    <td className={`r num ${(w as number) > 60 ? "t-red" : ""}`}>{w}%</td>
                    <td>
                      <Status s={st === "live" ? "live" : "review"}>{st === "live" ? "Live" : "In review"}</Status>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <Card title={t("Option analysis · item 1", "Option analysis · item 1", "विकल्प विश्लेषण")} icon={<ListChecks className="ic" />}>
          <div className="col g10">
            {[
              ["A · +4%", 9],
              ["B · −4% ✓", 54],
              ["C · no change", 31],
              ["D · −2%", 6],
            ].map(([o, p]) => (
              <div key={o as string} className="col g4">
                <div className="row between small">
                  <span>{o}</span>
                  <b className="num">{p}%</b>
                </div>
                <Meter v={p as number} tone={(o as string).includes("✓") ? "tick" : (p as number) > 25 ? "red" : "pen"} />
              </div>
            ))}
            <p className="tiny faint">{t("'No change' is the trap: the shortcut card is shown after a wrong pick.", "'No change' jaal hai: galat chunne par shortcut card dikhta hai.", "जाल।")}</p>
          </div>
        </Card>
      </div>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={t("Edit item", "Item badlo", "आइटम संपादित")}
        footer={
          <>
            <button className="btn ghost" onClick={() => setOpen(false)}>
              {t("Cancel", "Raho", "रद्द")}
            </button>
            <Gate mod="content" className="btn pri grow" onClick={() => setOpen(false)}>
              {t("Send to review", "Review bhejo", "समीक्षा")}
            </Gate>
          </>
        }
      >
        <div className="col g12">
          <div className="field">
            <label>{t("Question", "Sawaal", "प्रश्न")}</label>
            <textarea className="textarea" defaultValue="The price of a phone rises by 20% in March and then falls by 20% in April. Compared with February, the April price:" />
          </div>
          {["Increases by 4%", "Decreases by 4%", "No change", "Decreases by 2%"].map((o, i) => (
            <div key={o} className="row g8">
              <span className={`radio`} aria-checked={i === 1} />
              <input className="input sm" defaultValue={o} />
            </div>
          ))}
          <div className="field">
            <label>{t("Shortcut", "Shortcut", "शॉर्टकट")}</label>
            <input className="input" defaultValue="a + b + ab/100" />
          </div>
          <div className="row g12">
            <div className="field grow">
              <label>{t("Time target (s)", "Time target (s)", "समय लक्ष्य")}</label>
              <input className="input" defaultValue="40" />
            </div>
            <div className="field grow">
              <label>{t("Level", "Level", "स्तर")}</label>
              <select className="select" defaultValue="2">
                <option value="2">L2 Easy</option>
              </select>
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}

/* ---------------- courses & lessons (block editor) ---------------- */

export function AdmLessons() {
  const t = useT();
  const blocks: [ReactElement, string, string][] = [
    [<Heading key="a" />, t("Heading", "Heading", "शीर्षक"), "Deadlocks: the four conditions"],
    [<Type key="b" />, t("Text", "Text", "पाठ"), "A deadlock is when every process in a group waits for something only another process in the same group can release."],
    [<Image key="c" />, t("Visual", "Visual", "दृश्य"), "rag-cycle.json · resource allocation graph · 1 frame"],
    [<ListChecks key="d" />, t("List", "List", "सूची"), "Mutual exclusion · Hold and wait · No preemption · Circular wait"],
    [<MessageSquareQuote key="e" />, t("Callout", "Callout", "नोट"), "Break any one condition and the deadlock cannot happen."],
    [<CodeXml key="f" />, t("Quiz", "Quiz", "क्विज़"), "Two threads always lock A then B. Can they deadlock? (3 options)"],
  ];
  return (
    <div className="col g16">
      <AdmHead title={t("Courses & lessons", "Courses aur lessons", "कोर्स और पाठ")} sub={t("65 courses · 2,214 lessons · 3 languages", "65 courses · 2,214 lessons · 3 bhasha", "65 कोर्स")} />
      <div className="lesson-ed">
        <aside className="card ltree">
          <div className="card-h">
            <span className="h3">Operating systems</span>
          </div>
          {[
            ["1 · What an OS does", "live", 0],
            ["2 · Processes and threads", "live", 0],
            ["3 · Synchronisation", "live", 0],
            ["Race conditions", "live", 1],
            ["Mutex and semaphore", "live", 1],
            ["Deadlocks: the four conditions", "review", 1],
            ["Banker's algorithm", "draft", 1],
            ["4 · CPU scheduling", "draft", 0],
          ].map(([n, s, d]) => (
            <div key={n as string} className={`lt-row ${n === "Deadlocks: the four conditions" ? "on" : ""}`} style={{ paddingLeft: 14 + (d as number) * 16 }}>
              <span className={`lt-dot ${s}`} />
              <span className="ellipsis small">{n as string}</span>
            </div>
          ))}
        </aside>
        <section className="card blocks">
          <div className="card-h">
            <span className="h3">{t("Lesson editor", "Lesson editor", "पाठ संपादक")}</span>
            <Seg value="hg" onChange={() => {}} items={[{ id: "en", label: "EN ✓" }, { id: "hg", label: "HG ✓" }, { id: "hi", label: "हि …" }]} />
          </div>
          <div className="card-b col g8">
            {blocks.map(([ic, k, v], i) => (
              <div key={i} className="blk">
                <GripVertical className="grip" />
                <span className="blk-k">
                  {ic}
                  {k}
                </span>
                <span className="grow small">{v}</span>
              </div>
            ))}
            <button className="add-block">
              <Plus />
              {t("Add a block: text, code that runs, visual, callout, question", "Block jodo: text, chalne wala code, visual, callout, sawaal", "ब्लॉक जोड़ें")}
            </button>
          </div>
        </section>
        <aside className="col g12">
          <Card title={t("Publishing", "Publishing", "प्रकाशन")}>
            <div className="col g8 small">
              <div className="row between">
                <span className="muted">{t("Status", "Status", "स्थिति")}</span>
                <Status s="review">In review</Status>
              </div>
              <div className="row between">
                <span className="muted">{t("Reviewer", "Reviewer", "समीक्षक")}</span>
                <span>Ananya Rao</span>
              </div>
              <div className="row between">
                <span className="muted">{t("Hindi version", "Hindi version", "हिंदी संस्करण")}</span>
                <span className="t-coin">{t("in progress", "chal raha", "प्रगति में")}</span>
              </div>
              <Gate mod="content" className="btn pri block mt8">
                <Send />
                {t("Send to review", "Review bhejo", "समीक्षा हेतु")}
              </Gate>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- roadmaps & sheets ---------------- */

export function AdmRoadmaps() {
  const t = useT();
  const [sel, setSel] = useState("n3");
  const nodes = [
    { id: "n1", x: 60, y: 40, t: "Programming basics" },
    { id: "n2", x: 60, y: 140, t: "Arrays & strings" },
    { id: "n3", x: 60, y: 240, t: "Lists, stacks, queues" },
    { id: "n4", x: 330, y: 190, t: "Monotonic stack", opt: true },
    { id: "n5", x: 60, y: 340, t: "Recursion" },
    { id: "n6", x: 330, y: 340, t: "Backtracking", opt: true },
  ];
  const edges = [
    ["n1", "n2"],
    ["n2", "n3"],
    ["n3", "n4"],
    ["n3", "n5"],
    ["n5", "n6"],
  ];
  const pos = (id: string) => nodes.find((n) => n.id === id)!;
  return (
    <div className="col g16">
      <AdmHead
        title={t("Roadmaps & sheets", "Roadmaps aur sheets", "रोडमैप और शीट")}
        sub="SDE at a product company · v7 draft"
        actions={
          <>
            <Gate mod="content" className="btn">
              <Plus />
              {t("Add node", "Node jodo", "नोड जोड़ें")}
            </Gate>
            <Gate mod="content" need="full" className="btn pri">
              <Send />
              {t("Publish v7", "v7 publish", "v7 प्रकाशित")}
            </Gate>
          </>
        }
      />
      <div className="rm-ed">
        <section className="card rm-canvas paper-grid">
          <svg width="100%" height="420" viewBox="0 0 560 420" aria-label="Roadmap graph editor">
            {edges.map(([a, b]) => {
              const A = pos(a);
              const B = pos(b);
              return <path key={a + b} d={`M${A.x + 90} ${A.y + 40} C ${A.x + 90} ${(A.y + B.y) / 2 + 40}, ${B.x + 90} ${(A.y + B.y) / 2}, ${B.x + 90} ${B.y}`} stroke="var(--ink-3)" strokeWidth="1.6" fill="none" strokeDasharray={B.opt ? "5 4" : undefined} />;
            })}
            {nodes.map((n) => (
              <g key={n.id} onClick={() => setSel(n.id)} style={{ cursor: "pointer" }}>
                <rect x={n.x} y={n.y} width="180" height="40" rx="10" fill="var(--panel)" stroke={sel === n.id ? "var(--pen)" : "var(--line-2)"} strokeWidth={sel === n.id ? 2.5 : 1.5} strokeDasharray={n.opt ? "5 4" : undefined} />
                <text x={n.x + 90} y={n.y + 25} textAnchor="middle" fontSize="13" fill="var(--ink)" fontFamily="var(--f-ui)" fontWeight="560">
                  {n.t}
                </text>
              </g>
            ))}
          </svg>
        </section>
        <aside className="col g12">
          <Card title={t("Node", "Node", "नोड")} icon={<Network className="ic" />}>
            <div className="col g10">
              <div className="field">
                <label>{t("Title", "Title", "शीर्षक")}</label>
                <input className="input" defaultValue={pos(sel).t} key={sel} />
              </div>
              <div className="row between small">
                <span>{t("Required", "Zaroori", "आवश्यक")}</span>
                <Toggle on={!pos(sel).opt} onChange={() => {}} label="Required" />
              </div>
              <span className="eyebrow">{t("Linked content", "Judi content", "जुड़ी सामग्री")}</span>
              {["Lesson · Stack: the LIFO idea", "Problem · Valid brackets", "Quiz · Stacks in 10"].map((x) => (
                <div key={x} className="row g8 small">
                  <Link2 style={{ width: 14, height: 14 }} />
                  <span className="grow">{x}</span>
                </div>
              ))}
              <input className="input sm" placeholder={t("Search lessons, problems, quizzes…", "Lessons, problems, quiz khojo…", "खोजें…")} />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- companies data ---------------- */

export function AdmCompanies() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="col g16">
      <AdmHead
        title={t("Companies data", "Companies data", "कंपनी डेटा")}
        sub={t("A fact shows to learners only when it has a source and a verifier.", "Koi fact learners ko tabhi dikhega jab source aur verifier ho.", "स्रोत और सत्यापक के साथ।")}
        actions={
          <Gate mod="content" className="btn pri">
            <Plus />
            {t("Add company", "Company jodo", "कंपनी जोड़ें")}
          </Gate>
        }
      />
      <section className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t("Company", "Company", "कंपनी")}</th>
                <th>{t("Type", "Type", "प्रकार")}</th>
                <th className="r">{t("Sources", "Sources", "स्रोत")}</th>
                <th>{t("Verified facts", "Verified facts", "सत्यापित")}</th>
                <th>{t("Last checked", "Last checked", "अंतिम जाँच")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[
                ["Nimbu Labs", "Product", 16, 92, "12 Oct"],
                ["Sitara Infotech", "Service", 24, 100, "8 Oct"],
                ["Kesar Cloud", "Product", 6, 67, "2 Sep"],
                ["Jugnu Apps", "Startup", 3, 40, "—"],
              ].map(([n, ty, s, v, d]) => (
                <tr key={n as string} onClick={() => setOpen(true)} style={{ cursor: "pointer" }}>
                  <td className="row g8">
                    <Building2 style={{ width: 15, height: 15 }} className="faint" />
                    <b className="small">{n}</b>
                  </td>
                  <td>{ty}</td>
                  <td className="r num">{s}</td>
                  <td style={{ minWidth: 160 }}>
                    <div className="row g8">
                      <div className="grow">
                        <Meter v={v as number} tone={(v as number) > 80 ? "tick" : (v as number) > 50 ? "coin" : "red"} size="thin" />
                      </div>
                      <span className="tiny num">{v}%</span>
                    </div>
                  </td>
                  <td className="faint small">{d}</td>
                  <td>
                    <ExternalLink style={{ width: 14, height: 14 }} className="faint" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Drawer open={open} onClose={() => setOpen(false)} title="Nimbu Labs · facts">
        <div className="col g10">
          {[
            ["Rounds: OA → 2 tech → HR", "14 experiences", true],
            ["OA: 90 min, 2 coding + 20 MCQ", "9 experiences · 1 job post", true],
            ["CTC for SDE 1", "No source yet", false],
          ].map(([f, s, ok]) => (
            <div key={f as string} className={`fact-row ${ok ? "" : "bad"}`}>
              {ok ? <ShieldCheck style={{ color: "var(--tick)" }} /> : <TriangleAlert style={{ color: "var(--red-text)" }} />}
              <div className="grow">
                <b className="small">{f as string}</b>
                <span className="tiny faint" style={{ display: "block" }}>
                  {s as string} {ok ? "· verified by Ananya" : "· hidden from learners"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Drawer>
    </div>
  );
}

/* ---------------- factory ---------------- */

export function AdmFactory() {
  const t = useT();
  const toast = useToast();
  const [kill, setKill] = useState(false);
  return (
    <div className="col g16">
      <AdmHead
        title={t("Content factory", "Content factory", "कंटेंट फ़ैक्टरी")}
        sub={t("AI drafts in batches at night; every item goes through machine checks, then a human reviewer.", "Raat me AI batches me draft karta hai; har item machine checks aur phir reviewer se guzarta hai.", "रात में बैच।")}
        actions={
          <Gate mod="factory" need="full" className="btn pri">
            <Factory />
            {t("New batch", "Naya batch", "नया बैच")}
          </Gate>
        }
      />
      <div className="stat-strip" style={{ ["--n" as string]: 4 }}>
        {[
          [t("Spend today", "Aaj kharch", "आज खर्च"), "$41.20", t("cap $60", "cap $60", "सीमा $60")],
          [t("Items tonight", "Aaj raat items", "आज रात"), "320", "01:00–05:00"],
          [t("Pass rate (checks)", "Pass rate", "पास दर"), "84%", "+3 pts"],
          [t("Waiting for review", "Review baaki", "समीक्षा बाकी"), "64", t("SLA 48 h", "SLA 48 h", "SLA 48 घं")],
        ].map(([k, v, d]) => (
          <div key={k} className="stat">
            <span className="k">{k}</span>
            <span className="v">{v}</span>
            <span className="d">{d}</span>
          </div>
        ))}
      </div>
      <section className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t("Batch", "Batch", "बैच")}</th>
                <th>{t("Plan", "Plan", "योजना")}</th>
                <th style={{ minWidth: 220 }}>{t("Stages", "Stages", "चरण")}</th>
                <th className="r">{t("Spend", "Kharch", "खर्च")}</th>
                <th>{t("Status", "Status", "स्थिति")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[
                ["#14", "DP problems × 60, L3–L4", [30, 18, 12, 0], "$12.80", "run"],
                ["#13", "Aptitude · percentages × 200", [140, 40, 0, 20], "$6.10", "done"],
                ["#12", "Lessons · CN Hindi × 24", [10, 6, 0, 8], "$9.40", "pause"],
              ].map(([b, p, st, sp, s]) => {
                const [ok, rev, fail, pub] = st as number[];
                const tot = ok + rev + fail + pub;
                return (
                  <tr key={b as string}>
                    <td className="mono">{b}</td>
                    <td className="small">{p}</td>
                    <td>
                      <div className="stack-bar">
                        <i style={{ width: `${(pub / tot) * 100}%`, background: "var(--tick)" }} />
                        <i style={{ width: `${(ok / tot) * 100}%`, background: "var(--ai)" }} />
                        <i style={{ width: `${(rev / tot) * 100}%`, background: "var(--coin)" }} />
                        <i style={{ width: `${(fail / tot) * 100}%`, background: "var(--red)" }} />
                      </div>
                      <span className="tiny faint">
                        {pub} {t("published", "publish", "प्रकाशित")} · {ok} {t("checked", "checked", "जाँचे")} · {rev} {t("review", "review", "समीक्षा")} · <span className="t-red">{fail} {t("failed", "fail", "विफल")}</span>
                      </span>
                    </td>
                    <td className="r num">{sp}</td>
                    <td>{s === "run" ? <Status s="info">{t("Running", "Chal raha", "चालू")}</Status> : s === "done" ? <Status s="live">{t("Done", "Ho gaya", "पूरा")}</Status> : <Status s="review">{t("Paused", "Ruka", "रुका")}</Status>}</td>
                    <td>
                      <span className="row g4">
                        <Gate mod="factory" need="full" className="icon-btn sm" onClick={() => toast(t("Batch paused", "Batch ruka", "बैच रुका"))}>
                          {s === "pause" ? <Play /> : <Pause />}
                        </Gate>
                        <Gate mod="factory" need="full" className="icon-btn sm" onClick={() => setKill(true)}>
                          <Square />
                        </Gate>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <Card title={t("Batch #14 · why items failed", "Batch #14 · fail kyun", "विफलता के कारण")} icon={<Sparkles className="ic" />}>
        <div className="col g8">
          {[
            ["Duplicate of an existing problem (> 0.8 similarity)", 7],
            ["Reference solution TLE on generated tests", 3],
            ["Second model disagrees on 1+ test", 2],
          ].map(([r, n]) => (
            <div key={r as string} className="row g10 small">
              <span className="grow">{r}</span>
              <b className="num">{n}</b>
              <button className="btn sm">{t("Retry these", "Dobara", "पुनः")}</button>
            </div>
          ))}
          <span className="tiny faint row g4">
            <Clock style={{ width: 12, height: 12 }} />
            {t("Night window 01:00–05:00 · daily cap $60 · duplicate threshold 0.8", "Raat 01:00–05:00 · cap $60 · duplicate 0.8", "रात 1–5")}
          </span>
        </div>
      </Card>
      <FourEyes open={kill} onClose={() => setKill(false)} title={t("Stop batch #14", "Batch #14 roko", "बैच रोकें")} what="Stops all running stages; drafted items stay for review." needs="Content admin" />
    </div>
  );
}
