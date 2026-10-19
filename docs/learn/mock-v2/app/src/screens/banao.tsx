import { useState } from "react";
import {
  FlaskConical,
  Rocket,
  Clock,
  ArrowRight,
  FileCode2,
  Folder,
  FolderOpen,
  CircleCheck,
  CircleX,
  Play,
  Sparkles,
  Check,
  Download,
  ExternalLink,
  Image as ImageIcon,
  ListChecks,
  ChevronRight,
  Users,
} from "lucide-react";
import { Link, useT, useToast } from "../lib/core";
import { Bar, Code, Confetti, Level, SampleNote } from "../ui/kit";
import { PageHead } from "../ui/shell";
import { FocusBar } from "../ui/focus";

function MiniApp({ variant = 0 }: { variant?: number }) {
  return (
    <div className={`mini-app v${variant}`} aria-hidden="true">
      <div className="ma-top">
        <i />
        <i />
        <i />
      </div>
      <div className="ma-body">
        <div className="ma-side">
          <b />
          <b />
          <b />
        </div>
        <div className="ma-main">
          <span className="ma-h" />
          <div className="ma-cards">
            <span />
            <span />
            <span />
          </div>
          <span className="ma-line" />
          <span className="ma-line short" />
        </div>
      </div>
    </div>
  );
}

export function BuildBody() {
  const t = useT();
  return (
    <div className="page stagger">
      <PageHead
        title={t("Projects and labs", "Projects aur labs", "प्रोजेक्ट और लैब")}
        sub={t("Labs teach one skill in steps, with tests that check each step. Projects are open: a design, requirements and tests, and you ship a live link.", "Labs ek skill step-by-step, har step par tests. Projects khule: design, zarooratein, tests, aur live link ship.", "लैब: कदम-दर-कदम। प्रोजेक्ट: खुले।")}
      />
      <section className="stack">
        <div className="section-title">
          <h2>
            <FlaskConical size={17} style={{ verticalAlign: -3 }} /> {t("Guided labs", "Guided labs", "गाइडेड लैब")}
          </h2>
        </div>
        <div className="grid c3">
          {[
            ["Build a URL shortener API", "Node · Express · SQLite", "8 steps · 2 h", 3],
            ["Git: undo anything", "Git in the browser", "6 steps · 40 min", 6],
            ["SQL joins on a real shop", "PostgreSQL", "7 steps · 1 h", 0],
          ].map(([n, s, m, d]) => (
            <Link key={n as string} to="studio" className="panel pad stack hover-card">
              <b>{n}</b>
              <span className="muted" style={{ fontSize: "var(--fs-13)" }}>
                {s}
              </span>
              <span className="faint" style={{ fontSize: "var(--fs-12)", display: "flex", gap: 6, alignItems: "center" }}>
                <Clock size={12} /> {m}
              </span>
              <Bar value={((d as number) / 8) * 100} thin />
            </Link>
          ))}
        </div>
      </section>
      <section className="stack">
        <div className="section-title">
          <h2>
            <Rocket size={17} style={{ verticalAlign: -3 }} /> {t("Projects", "Projects", "प्रोजेक्ट")}
          </h2>
        </div>
        <div className="grid c3">
          {[
            ["Expense splitter for hostel rooms", "React · REST", 3],
            ["Placement tracker for your college", "Full stack · auth", 4],
            ["CPU scheduler simulator", "Any language · OS", 3],
          ].map(([n, s, lv], i) => (
            <Link key={n as string} to="project" className="panel stack hover-card project-card">
              <MiniApp variant={i} />
              <div className="stack sm" style={{ padding: "0 16px 16px" }}>
                <b>{n}</b>
                <div className="row between">
                  <span className="muted" style={{ fontSize: "var(--fs-12)" }}>
                    {s}
                  </span>
                  <Level lv={lv as 3 | 4} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

const SRC = `import express from "express";
import { db } from "./db.js";
import { makeCode } from "./code.js";

const app = express();
app.use(express.json());

app.post("/links", (req, res) => {
  const { url } = req.body;
  if (!/^https?:\\/\\//.test(url)) {
    return res.status(400).json({ error: "url must start with http" });
  }
  const code = makeCode(6);
  db.insert(code, url);
  res.status(201).json({ code });
});

// Step 3: add GET /:code that redirects
`;

export function StudioScreen() {
  const t = useT();
  const toast = useToast();
  const [ran, setRan] = useState(false);
  const tests: [string, boolean][] = [
    ["POST /links returns 201 and a 6-letter code", true],
    ["POST /links rejects a url without http", true],
    ["Codes are unique for 1,000 links", true],
    ["GET /:code redirects with 302", ran],
    ["GET /:code returns 404 for an unknown code", false],
    ["Redirect count goes up by one", false],
  ];
  const pass = tests.filter((x) => x[1]).length;
  return (
    <div className="work">
      <FocusBar
        back="build"
        backLabel={t("Back to labs", "Labs par wapas", "लैब पर वापस")}
        title={
          <>
            <b>Build a URL shortener API</b>
            <span className="faint hide-phone">· {t("step 3 of 8", "step 3/8", "कदम 3/8")}</span>
          </>
        }
        right={
          <button type="button" className="btn ghost sm">
            <Sparkles size={14} /> <span className="hide-phone">Sahayak</span>
          </button>
        }
      />
      <div className="studio">
        <aside className="studio-steps">
          <span className="eyebrow">{t("Lab steps", "Lab steps", "लैब के कदम")}</span>
          {["Set up the server", "Create links", "Redirect", "Count clicks", "Expiry dates", "Rate limit", "Tests for edge cases", "Ship it"].map((s, i) => (
            <div key={s} className={`st-step ${i < 2 ? "done" : i === 2 ? "now" : ""}`}>
              <span className="st-dot">{i < 2 ? <Check size={12} /> : i + 1}</span>
              {s}
            </div>
          ))}
          <div className="st-task">
            <b>{t("Step 3: redirect", "Step 3: redirect", "कदम 3: रीडायरेक्ट")}</b>
            <p>
              {t(
                "Add GET /:code. Look the code up; if it exists, answer 302 with a Location header; if not, answer 404 with a short JSON error.",
                "GET /:code jodo. Code dhoondho; mile to 302 aur Location header; na mile to 404 aur chhota JSON error.",
                "GET /:code जोड़ें।",
              )}
            </p>
            <ul>
              <li>{t("Use db.find(code)", "db.find(code) lagao", "db.find(code)")}</li>
              <li>{t("Don't forget the 404", "404 mat bhoolna", "404 न भूलें")}</li>
            </ul>
          </div>
        </aside>
        <section className="studio-editor">
          <div className="studio-files">
            <div className="ft">
              <span className="ft-row">
                <FolderOpen size={14} /> src
              </span>
              <span className="ft-row in on">
                <FileCode2 size={14} /> server.js
              </span>
              <span className="ft-row in">
                <FileCode2 size={14} /> db.js
              </span>
              <span className="ft-row in">
                <FileCode2 size={14} /> code.js
              </span>
              <span className="ft-row">
                <Folder size={14} /> tests
              </span>
              <span className="ft-row">
                <FileCode2 size={14} /> package.json
              </span>
            </div>
            <div className="editor" style={{ borderLeft: "1px solid var(--line)" }}>
              <Code code={SRC} caretLine={18} />
            </div>
          </div>
          <div className="studio-bottom">
            <div className="studio-tests">
              <div className="row between" style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
                <b style={{ fontSize: "var(--fs-13)" }}>
                  {t("Tests", "Tests", "टेस्ट")} <span className={`num ${pass === 6 ? "pos" : ""}`}>{pass}/6</span>
                </b>
                <button
                  type="button"
                  className="btn primary sm"
                  onClick={() => {
                    setRan(true);
                    toast(t("4 of 6 tests pass. Next: the 404.", "6 me se 4 pass. Agla: 404.", "6 में से 4 पास।"));
                  }}
                >
                  <Play size={13} /> {t("Run tests", "Tests chalao", "टेस्ट चलाएँ")}
                </button>
              </div>
              <div className="list">
                {tests.map(([n, ok]) => (
                  <div key={n} className={`list-row test-row ${ok ? "ok" : "no"}`}>
                    {ok ? <CircleCheck size={15} /> : <CircleX size={15} />}
                    <span className="t mono" style={{ fontSize: "var(--fs-12)", fontWeight: 500 }}>
                      {n}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="terminal" aria-label="Terminal">
              <div className="term-head">
                <span>Terminal</span>
              </div>
              <pre>
                <span className="faint">$ </span>npm test{"\n"}
                <span className="ok">✓</span> links.create (12 ms){"\n"}
                <span className="ok">✓</span> links.reject-bad-url (3 ms){"\n"}
                <span className="ok">✓</span> links.unique (418 ms){"\n"}
                {ran ? (
                  <>
                    <span className="ok">✓</span> redirect.302 (6 ms){"\n"}
                  </>
                ) : (
                  <>
                    <span className="bad">✗</span> redirect.302{"\n"}
                    {"    "}
                    <span className="bad">expected 302, got 404</span>
                    {"\n"}
                  </>
                )}
                <span className="bad">✗</span> redirect.404-unknown{"\n"}
                {"    "}
                <span className="bad">expected 404, got 500 (TypeError: cannot read 'url' of undefined)</span>
              </pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function ProjectBody() {
  const t = useT();
  const toast = useToast();
  const [shipped, setShipped] = useState(false);
  const reqs = [
    t("Add people to a room and log a shared expense", "Room me log jodo aur saajha kharcha likho", "लोग जोड़ें, खर्च लिखें"),
    t("Split equally or by custom shares", "Barabar ya apne hisse se baanto", "बराबर या हिस्से से बाँटें"),
    t("Show who owes whom with the fewest payments", "Kam se kam payments me kaun kisko dega", "कम भुगतान में हिसाब"),
    t("Works on a 390 px phone screen", "390 px phone par chale", "फ़ोन पर चले"),
    t("Data stays after a refresh", "Refresh ke baad data rahe", "रिफ़्रेश के बाद डेटा"),
  ];
  return (
    <div className="page">
      <PageHead
        crumbs={[{ to: "build", label: t("Projects", "Projects", "प्रोजेक्ट") }, { label: "Expense splitter" }]}
        title={t("Expense splitter for hostel rooms", "Hostel rooms ke liye expense splitter", "हॉस्टल खर्च बाँटने वाला ऐप")}
        sub={t("A real app your friends can use. Build it from the design, pass the tests, ship a live link.", "Asli app jo dost use kar sakein. Design se banao, tests pass karo, live link ship karo.", "असली ऐप।")}
        actions={
          <>
            <Level lv={3} />
            <span className="tag">React · REST</span>
          </>
        }
      />
      <div className="project-layout">
        <div className="stack lg">
          <section className="panel pad stack">
            <div className="row between">
              <b style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <ImageIcon size={15} /> {t("Design", "Design", "डिज़ाइन")}
              </b>
              <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
                {t("desktop and phone", "desktop aur phone", "डेस्कटॉप और फ़ोन")}
              </span>
            </div>
            <div className="design-pair">
              <MiniApp variant={0} />
              <div className="mini-phone" aria-hidden="true">
                <span className="ma-h" />
                <span className="mp-card" />
                <span className="mp-card" />
                <span className="mp-btn" />
              </div>
            </div>
          </section>
          <section className="panel pad stack">
            <b style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <ListChecks size={15} /> {t("Requirements", "Zarooratein", "ज़रूरतें")}
            </b>
            {reqs.map((r, i) => (
              <div key={i} className="req">
                <CircleCheck size={15} className={i < 2 ? "ok" : ""} />
                {r}
              </div>
            ))}
          </section>
          <section className="panel table-wrap">
            <table className="dtable">
              <thead>
                <tr>
                  <th>{t("Endpoint", "Endpoint", "एंडपॉइंट")}</th>
                  <th>{t("Does", "Kaam", "काम")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="mono">POST /rooms</td>
                  <td>{t("Create a room", "Room banao", "रूम बनाएँ")}</td>
                </tr>
                <tr>
                  <td className="mono">POST /rooms/:id/expenses</td>
                  <td>{t("Add an expense", "Kharcha jodo", "खर्च जोड़ें")}</td>
                </tr>
                <tr>
                  <td className="mono">GET /rooms/:id/settle</td>
                  <td>{t("Who pays whom", "Kaun kisko dega", "कौन किसे देगा")}</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
        <aside className="stack">
          <div className="panel pad stack" style={{ position: "relative", overflow: "hidden" }}>
            {shipped && <Confetti count={16} />}
            <b>{t("Acceptance tests", "Acceptance tests", "स्वीकृति टेस्ट")}</b>
            <div className="row" style={{ gap: 10 }}>
              <span className="grow">
                <Bar value={shipped ? 100 : 66} tone={shipped ? "ok" : undefined} />
              </span>
              <span className="num faint" style={{ fontSize: "var(--fs-12)" }}>
                {shipped ? "24/24" : "16/24"}
              </span>
            </div>
            <Link to="studio" className="btn secondary">
              {t("Open in Studio", "Studio me kholo", "स्टूडियो में खोलें")} <ArrowRight size={14} />
            </Link>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setShipped(true);
                toast(t("Shipped. Live at hostel-split.parikshaa.app", "Ship ho gaya. Live: hostel-split.parikshaa.app", "शिप हो गया"));
              }}
            >
              <Rocket size={15} /> {shipped ? t("Shipped", "Ship ho gaya", "शिप हुआ") : t("Ship it (demo)", "Ship karo (demo)", "शिप करें (डेमो)")}
            </button>
            {shipped && (
              <a href="#project" onClick={(e) => e.preventDefault()} className="row" style={{ gap: 6, fontSize: "var(--fs-13)" }}>
                <ExternalLink size={13} /> hostel-split.parikshaa.app
              </a>
            )}
            <span className="faint" style={{ fontSize: "var(--fs-11)" }}>
              {t("Shipped projects appear on your profile with the live link.", "Ship kiye projects profile par live link ke saath.", "प्रोफ़ाइल पर दिखते हैं।")}
            </span>
          </div>
          <div className="panel pad stack">
            <b>{t("Assets", "Assets", "सामग्री")}</b>
            <span className="row" style={{ gap: 8, fontSize: "var(--fs-13)" }}>
              <Download size={14} /> {t("Icons and colours (zip, 120 KB)", "Icons aur rang (zip, 120 KB)", "आइकन और रंग")}
            </span>
          </div>
          <div className="panel pad stack">
            <b style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Users size={15} /> {t("Others who built it", "Doosron ne banaya", "दूसरों ने बनाया")}
            </b>
            <div className="row" style={{ gap: 6 }}>
              {["R", "K", "S", "M", "P"].map((x) => (
                <span key={x} className="avatar sm">
                  {x}
                </span>
              ))}
              <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
                +213
              </span>
            </div>
            <Link to="community" className="row" style={{ gap: 4, fontSize: "var(--fs-13)" }}>
              {t("See their solutions after you ship", "Ship ke baad unke hal dekho", "शिप के बाद उनके हल")} <ChevronRight size={13} />
            </Link>
          </div>
        </aside>
      </div>
      <SampleNote />
    </div>
  );
}
