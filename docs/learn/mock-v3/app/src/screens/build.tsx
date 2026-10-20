import { useState, type ReactNode } from "react";
import {
  Rocket,
  FlaskConical,
  Globe,
  Lock,
  Play,
  CircleCheck,
  Circle,
  CircleX,
  Clock,
  BadgeCheck,
  FolderTree,
  FileCode2,
  Folder,
  ChevronDown,
  GitBranch,
  TestTube2,
  SquareTerminal,
  Sparkles,
  Eye,
  RotateCw,
  Send,
  ListChecks,
  Server,
  Smartphone,
  BrainCircuit,
  Cloud,
  Layers,
  ExternalLink,
  Check,
  Plus,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import { Link, useT, useToast } from "../lib/core";
import { Badge, Level, Ring, Seg, Tabs, Code, PenNote, Card } from "../ui/kit";
import { FocusBar, Panes, PaneHead, PaneToggles, usePanes } from "../ui/focus";
import { SahayakPanel } from "../ui/sahayak";

/* ---------------- mini app previews (pure CSS, not screenshots) ---------------- */

function SplitApp({ big, settled }: { big?: boolean; settled?: boolean }) {
  return (
    <div className={`mini-app split ${big ? "big" : ""}`}>
      <div className="ma-top">
        <b>Room 214</b>
        <span className="ma-pill">4 members</span>
      </div>
      <div className="ma-total">
        <span>This month</span>
        <b>₹6,200</b>
      </div>
      {[
        ["Aarav", "+₹1,240", "pos"],
        ["Ishita", "+₹310", "pos"],
        ["Kabir", "−₹620", "neg"],
        ["Zoya", "−₹930", "neg"],
      ].map(([n, v, c]) => (
        <div key={n} className="ma-row">
          <span className="ma-av">{n[0]}</span>
          <span className="grow">{n}</span>
          <b className={c}>{v}</b>
        </div>
      ))}
      {settled !== undefined && (
        <div className="ma-settle">
          <span className="ma-h">Settle up</span>
          {settled ? (
            <>
              <div className="ma-row sm">Zoya → Aarav ₹930</div>
              <div className="ma-row sm">Kabir → Aarav ₹310</div>
              <div className="ma-row sm">Kabir → Ishita ₹310</div>
            </>
          ) : (
            <>
              <div className="ma-row sm">Kabir → Aarav ₹620</div>
              <div className="ma-row sm bad">Kabir → Ishita ₹0</div>
              <div className="ma-row sm">Zoya → Aarav ₹620</div>
              <div className="ma-row sm">Zoya → Ishita ₹310</div>
            </>
          )}
        </div>
      )}
      <span className="ma-btn">+ Add expense</span>
    </div>
  );
}

function KanbanApp() {
  return (
    <div className="mini-app kanban">
      {[
        ["Applied", 3],
        ["OA", 2],
        ["Interview", 1],
      ].map(([h, n]) => (
        <div key={h as string} className="kb-col">
          <span className="ma-h">{h}</span>
          {Array.from({ length: n as number }, (_, i) => (
            <span key={i} className="kb-card">
              <i />
              <i />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function ShortenerApp() {
  return (
    <div className="mini-app short">
      <div className="sh-in">
        <span>https://college.edu/fest/registrations/2026…</span>
        <span className="ma-btn sm">Shorten</span>
      </div>
      <div className="sh-out mono">pk.sh/fest26</div>
      <div className="sh-bars">
        {[30, 45, 38, 70, 90, 60, 82].map((h, i) => (
          <i key={i} style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

function CanteenApp() {
  return (
    <div className="mini-app canteen">
      <div className="cn-phone">
        <span className="ma-h">Today's menu</span>
        {["Masala dosa · ₹40", "Veg thali · ₹70", "Chai · ₹10"].map((x) => (
          <span key={x} className="cn-item">
            {x}
            <i>+</i>
          </span>
        ))}
        <span className="ma-btn sm">Order · ₹50</span>
      </div>
    </div>
  );
}

function ResumeApp() {
  return (
    <div className="mini-app resume-app">
      <div className="ra-doc">
        <i className="w60" />
        <i className="w40" />
        <i />
        <i className="w80" />
        <i />
        <i className="w70" />
      </div>
      <div className="ra-fields">
        {["Name", "Skills", "CGPA", "Projects"].map((f) => (
          <span key={f}>
            <b>{f}</b>
            <i />
          </span>
        ))}
      </div>
    </div>
  );
}

function ChatApp() {
  return (
    <div className="mini-app chat-app">
      <span className="ca-b l">Anyone has DBMS notes?</span>
      <span className="ca-b r">Yes, sharing now</span>
      <span className="ca-b l">Thanks!! 🙏</span>
      <span className="ca-typing">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

export function BrowserFrame({ url, children, className }: { url: string; children: ReactNode; className?: string }) {
  return (
    <div className={`browser ${className ?? ""}`}>
      <div className="browser-bar">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <span className="url">
          <Lock />
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ---------------- hub ---------------- */

type Proj = { id: string; name: string; out: [string, string, string]; track: string; stack: string[]; lvl: 1 | 2 | 3 | 4 | 5; hours: number; ms: number; status: "new" | "doing" | "shipped"; p?: number; prev: ReactNode; proves: string };
const PROJECTS: Proj[] = [
  { id: "split", name: "Hostel Split", out: ["Split bills in your hostel room, settle up in fewest transfers", "Hostel room ke bills baanto, kam se kam transfers me hisaab", "हॉस्टल बिल बाँटें"], track: "web", stack: ["React", "Node", "Postgres"], lvl: 3, hours: 14, ms: 5, status: "doing", p: 52, prev: <SplitApp />, proves: "Full-stack L1" },
  { id: "track", name: "Placement Tracker", out: ["A board for every application, OA and interview", "Har application, OA aur interview ka board", "हर आवेदन का बोर्ड"], track: "web", stack: ["React", "LocalStorage"], lvl: 2, hours: 8, ms: 4, status: "shipped", prev: <KanbanApp />, proves: "Frontend L1" },
  { id: "short", name: "Fest Link Shortener", out: ["Short links with click charts for your college fest", "College fest ke liye short links aur click chart", "छोटे लिंक"], track: "backend", stack: ["Node", "Redis", "SQL"], lvl: 3, hours: 10, ms: 4, status: "new", prev: <ShortenerApp />, proves: "Backend L1" },
  { id: "canteen", name: "Canteen Pre-order", out: ["Order before the bell, pick up without the queue", "Bell se pehle order, bina line ke pickup", "पहले ऑर्डर"], track: "mobile", stack: ["React Native", "Firebase"], lvl: 3, hours: 16, ms: 5, status: "new", prev: <CanteenApp />, proves: "Mobile L1" },
  { id: "resume", name: "Resume Field Extractor", out: ["Pull name, skills and CGPA from a PDF resume", "PDF resume se naam, skills, CGPA nikaalo", "रिज़्यूमे से जानकारी"], track: "ai", stack: ["Python", "LLM API", "FastAPI"], lvl: 4, hours: 12, ms: 4, status: "new", prev: <ResumeApp />, proves: "Applied AI L1" },
  { id: "chat", name: "Class Chat", out: ["A realtime chat for your class with rooms", "Class ke liye realtime chat, rooms ke saath", "रियलटाइम चैट"], track: "backend", stack: ["WebSocket", "Node", "Postgres"], lvl: 4, hours: 18, ms: 5, status: "new", prev: <ChatApp />, proves: "Backend L2" },
];

export function BuildBody() {
  const t = useT();
  const [track, setTrack] = useState("all");
  const list = PROJECTS.filter((p) => track === "all" || p.track === track);
  return (
    <div className="col g24">
      <header className="page-head" style={{ marginBottom: 0 }}>
        <div className="grow">
          <div className="eyebrow">{t("Build", "Banao", "बनाओ")}</div>
          <h1 className="h1">
            {t("Make things that run. ", "Aisi cheezein banao jo chalein. ", "चलने वाली चीज़ें बनाओ। ")}
            <em className="serif-i">{t("Ship them.", "Ship karo.", "शिप करो।")}</em>
          </h1>
          <p className="muted page-sub">{t("Real projects in milestones, each checked by tests, with a live preview while you code and a link you can share when you're done.", "Milestones me asli projects; har milestone tests se jaancha jaata hai; code karte waqt live preview, aur ant me share karne ka link.", "असली प्रोजेक्ट, टेस्ट से जाँचे गए।")}</p>
        </div>
      </header>
      <div className="stat-strip" style={{ ["--n" as string]: 4 }}>
        {[
          [t("Projects shipped", "Projects ship kiye", "प्रोजेक्ट शिप"), "2", <Rocket key="a" />],
          [t("Labs done", "Labs kiye", "लैब पूरे"), "11", <FlaskConical key="b" />],
          [t("Live links", "Live links", "लाइव लिंक"), "1", <Globe key="c" />],
          [t("Reviews received", "Reviews mile", "समीक्षाएँ"), "3", <MessageSquare key="d" />],
        ].map(([k, v, ic]) => (
          <div key={k as string} className="stat">
            <span className="k row g6">
              {ic}
              {k}
            </span>
            <span className="v">{v}</span>
          </div>
        ))}
      </div>

      <section className="continue-build">
        <BrowserFrame url="hostel-split.preview.parikshaa.app" className="cb-preview">
          <SplitApp big settled={false} />
        </BrowserFrame>
        <div className="col g12" style={{ minWidth: 0 }}>
          <span className="eyebrow">{t("Continue building", "Banana jaari rakho", "जारी रखें")}</span>
          <h2 className="display" style={{ fontSize: 40, lineHeight: 1 }}>
            Hostel Split
          </h2>
          <div className="ms-strip">
            {["Setup", "Expenses", "Settle up", "Rooms", "Deploy"].map((m, i) => (
              <div key={m} className={`ms ${i < 2 ? "done" : i === 2 ? "now" : ""}`}>
                <i />
                <span className="tiny">
                  M{i + 1} · {m}
                </span>
              </div>
            ))}
          </div>
          <div className="next-step">
            <span className="eyebrow">{t("Next step", "Agla kadam", "अगला कदम")}</span>
            <p className="small">{t("Make settle() return the fewest transfers. 4 tests still fail.", "settle() ko kam se kam transfers lautane do. 4 tests abhi fail.", "settle() सुधारें। 4 टेस्ट फेल।")}</p>
            <div className="row g8">
              <div className="testbar mini">
                {Array.from({ length: 12 }, (_, i) => (
                  <i key={i} className={i < 8 ? "ok" : "bad"} />
                ))}
              </div>
              <span className="tiny num faint">8 / 12</span>
            </div>
          </div>
          <div className="row wrap g8">
            <Link to="studio" className="btn pri lg">
              <Play />
              {t("Open Studio", "Studio kholo", "स्टूडियो खोलें")}
            </Link>
            <Link to="project" className="btn lg">
              {t("Project brief", "Project brief", "प्रोजेक्ट विवरण")}
            </Link>
          </div>
        </div>
      </section>

      <div className="row wrap between g12">
        <h2 className="display" style={{ fontSize: 32 }}>
          {t("Projects", "Projects", "प्रोजेक्ट")}
        </h2>
        <Seg
          value={track}
          onChange={setTrack}
          items={[
            { id: "all", label: t("All", "Sab", "सभी"), icon: <Layers /> },
            { id: "web", label: "Web", icon: <Globe /> },
            { id: "backend", label: "Backend", icon: <Server /> },
            { id: "ai", label: "Data & AI", icon: <BrainCircuit /> },
            { id: "mobile", label: "Mobile", icon: <Smartphone /> },
            { id: "devops", label: "DevOps", icon: <Cloud /> },
          ]}
        />
      </div>
      <div className="proj-grid">
        {list.map((p) => (
          <Link key={p.id} to="project" className="proj card hov">
            <div className="proj-prev">{p.prev}</div>
            <div className="proj-b">
              <div className="row between">
                <b className="h3">{p.name}</b>
                {p.status === "shipped" ? (
                  <Badge tone="tick" icon={<Rocket />}>
                    {t("Shipped", "Ship hua", "शिप")}
                  </Badge>
                ) : p.status === "doing" ? (
                  <Badge tone="pen">{p.p}%</Badge>
                ) : null}
              </div>
              <p className="small muted">{t(...p.out)}</p>
              <div className="row wrap g4">
                {p.stack.map((s) => (
                  <span key={s} className="stack-chip mono">
                    {s}
                  </span>
                ))}
              </div>
              <div className="row between tiny faint mt4">
                <span className="row g8">
                  <Level n={p.lvl} short />
                  <span className="row g4">
                    <Clock style={{ width: 12, height: 12 }} />
                    {p.hours}h
                  </span>
                  <span>
                    {p.ms} {t("milestones", "milestones", "माइलस्टोन")}
                  </span>
                </span>
                <span className="row g4">
                  <BadgeCheck style={{ width: 13, height: 13 }} />
                  {p.proves}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid c2">
        <Card title={t("Guided labs · 20 to 45 minutes", "Guided labs · 20–45 minute", "गाइडेड लैब")} icon={<FlaskConical className="ic" />} pad={false}>
          <div className="list">
            {[
              ["Build a REST API in 30 minutes", "6 steps · Node", true],
              ["Your first database migration", "5 steps · SQL", true],
              ["Debounce a search box", "4 steps · JavaScript", false],
              ["Deploy a static site with a custom domain", "7 steps · DevOps", false],
            ].map(([n, m, d]) => (
              <Link key={n as string} to="studio" className="li">
                <span className="ic-box">{d ? <CircleCheck style={{ color: "var(--tick)" }} /> : <FlaskConical />}</span>
                <span className="grow">
                  <b className="small">{n as string}</b>
                  <span className="tiny faint" style={{ display: "block" }}>
                    {m as string}
                  </span>
                </span>
                {d ? <span className="tiny faint">{t("Done", "Ho gaya", "पूरा")}</span> : <span className="btn sm">{t("Start", "Shuru", "शुरू")}</span>}
              </Link>
            ))}
          </div>
        </Card>
        <Card title={t("How a project is checked", "Project kaise jaancha jaata hai", "कैसे जाँचा जाता है")} icon={<ListChecks className="ic" />}>
          <div className="steps">
            {[
              [t("Tests on every milestone", "Har milestone par tests", "हर माइलस्टोन पर टेस्ट"), t("Run in the browser; a milestone opens when its tests pass.", "Browser me chalte hain; tests pass to agla milestone.", "टेस्ट पास तो अगला।")],
              [t("Instant AI review", "Turant AI review", "तुरंत एआई समीक्षा"), t("Readability, edge cases, security basics, as comments on your code.", "Readability, edge cases, security, code par comments.", "कोड पर टिप्पणियाँ।")],
              [t("Human review (Plus)", "Insaan ka review (Plus)", "मानव समीक्षा (प्लस)"), t("A reviewer scores the rubric within 48 hours.", "Reviewer 48 ghante me rubric score karta hai.", "48 घंटे में।")],
              [t("Ship it", "Ship karo", "शिप करें"), t("A live link and a card on your profile.", "Live link aur profile par card.", "लाइव लिंक।")],
            ].map(([h, p], i) => (
              <div key={i} className={`step ${i < 2 ? "done" : ""}`}>
                <span className="dot">{i < 2 ? <Check /> : i + 1}</span>
                <div>
                  <b className="small">{h}</b>
                  <p className="tiny faint">{p}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- project ---------------- */

const MILESTONES = [
  { n: "Setup and schema", s: "done", tests: [6, 6], items: ["Create rooms, members, expenses tables", "Seed one room with three members", "GET /rooms/:id returns members"] },
  { n: "Add and list expenses", s: "done", tests: [9, 9], items: ["POST /expenses with payer and split", "Balances update after each expense", "List expenses newest first"] },
  { n: "Settle up", s: "now", tests: [8, 12], items: ["settle() returns who pays whom", "Use the fewest transfers possible", "Show the plan on the room page", "Mark a transfer as paid"] },
  { n: "Rooms and sign-in", s: "lock", tests: [0, 8], items: ["Invite by link", "Only members see a room"] },
  { n: "Deploy and share", s: "lock", tests: [0, 4], items: ["Deploy to a preview URL", "Add a README with screenshots"] },
] as const;

export function ProjectBody() {
  const t = useT();
  const [tab, setTab] = useState("ms");
  return (
    <div className="col g20">
      <section className="proj-hero">
        <div className="col g12" style={{ minWidth: 0 }}>
          <span className="eyebrow">{t("Project · Web · full stack", "Project · Web · full stack", "प्रोजेक्ट · वेब")}</span>
          <h1 className="display" style={{ fontSize: 56, lineHeight: 0.98 }}>
            Hostel Split
          </h1>
          <p className="muted" style={{ fontSize: 16, maxWidth: "52ch" }}>
            {t("Roommates add what they paid; the app keeps balances and tells everyone the fewest payments that settle the month.", "Roommates jo bhara wo daalein; app balance rakhe aur mahine ka hisaab kam se kam payments me bataye.", "रूममेट्स के खर्च का हिसाब।")}
          </p>
          <div className="row wrap g6">
            {["React", "Node", "Express", "Postgres"].map((s) => (
              <span key={s} className="stack-chip mono">
                {s}
              </span>
            ))}
            <Level n={3} />
          </div>
          <div className="row wrap g16 small muted">
            <span className="row g6">
              <Layers style={{ width: 15, height: 15 }} />5 {t("milestones", "milestones", "माइलस्टोन")}
            </span>
            <span className="row g6">
              <TestTube2 style={{ width: 15, height: 15 }} />39 {t("tests", "tests", "टेस्ट")}
            </span>
            <span className="row g6">
              <Clock style={{ width: 15, height: 15 }} />≈ 14 h
            </span>
            <span className="row g6">
              <BadgeCheck style={{ width: 15, height: 15 }} />
              {t("Counts toward Full-stack L1", "Full-stack L1 me ginta hai", "फ़ुल-स्टैक L1")}
            </span>
          </div>
          <div className="row wrap g8 mt8">
            <Link to="studio" className="btn pri lg">
              <Play />
              {t("Continue in Studio", "Studio me jaari", "स्टूडियो में जारी")}
            </Link>
            <button className="btn lg">
              <GitBranch />
              {t("Starter on GitHub", "GitHub par starter", "GitHub स्टार्टर")}
            </button>
          </div>
        </div>
        <div className="col g8" style={{ minWidth: 0 }}>
          <BrowserFrame url="hostel-split.parikshaa.app" className="ph-prev">
            <SplitApp big settled />
          </BrowserFrame>
          <span className="tiny faint" style={{ textAlign: "center" }}>
            {t("What you'll have at the end (reference build)", "Ant me aapke paas ye hoga (reference build)", "अंत में आपके पास")}
          </span>
        </div>
      </section>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "ms", label: t("Milestones", "Milestones", "माइलस्टोन"), count: "2/5" },
          { id: "brief", label: t("Brief", "Brief", "विवरण") },
          { id: "rubric", label: t("Rubric", "Rubric", "मूल्यांकन") },
          { id: "res", label: t("Resources", "Resources", "संसाधन") },
          { id: "subs", label: t("Submissions", "Submissions", "सबमिशन"), count: 2 },
        ]}
      />

      {tab === "ms" && (
        <div className="ms-list">
          {MILESTONES.map((m, i) => (
            <section key={m.n} className={`ms-card ${m.s}`}>
              <div className="ms-num">{m.s === "done" ? <Check /> : m.s === "lock" ? <Lock /> : i + 1}</div>
              <div className="grow col g10" style={{ minWidth: 0 }}>
                <div className="row wrap between g8">
                  <b className="h2">
                    M{i + 1} · {m.n}
                  </b>
                  <span className="row g8">
                    <span className="tiny num faint">
                      {m.tests[0]} / {m.tests[1]} {t("tests", "tests", "टेस्ट")}
                    </span>
                    {m.s === "done" && <Badge tone="tick">{t("Done", "Poora", "पूरा")}</Badge>}
                    {m.s === "now" && <Badge tone="pen">{t("In progress", "Chal raha", "प्रगति में")}</Badge>}
                    {m.s === "lock" && <Badge>{t(`Opens after M${i}`, `M${i} ke baad`, `M${i} के बाद`)}</Badge>}
                  </span>
                </div>
                {m.s !== "lock" && (
                  <div className="testbar mini">
                    {Array.from({ length: m.tests[1] }, (_, k) => (
                      <i key={k} className={k < m.tests[0] ? "ok" : "bad"} />
                    ))}
                  </div>
                )}
                <ul className="ms-items">
                  {m.items.map((it, k) => {
                    const ok = m.s === "done" || (m.s === "now" && k < 2);
                    return (
                      <li key={it} className={ok ? "ok" : ""}>
                        {ok ? <CircleCheck /> : <Circle />}
                        {it}
                      </li>
                    );
                  })}
                </ul>
                {m.s === "now" && (
                  <div className="row g8">
                    <Link to="studio" className="btn sm pri">
                      <Play />
                      {t("Open in Studio", "Studio me kholo", "स्टूडियो में खोलें")}
                    </Link>
                    <span className="tiny faint">{t("Hint: think of who owes the most and who is owed the most.", "Hint: sabse zyada dena kisko, sabse zyada lena kisko.", "संकेत: सबसे बड़ा कर्ज़दार।")}</span>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
      {tab === "brief" && (
        <div className="grid c2">
          <Card title={t("The problem", "Samasya", "समस्या")}>
            <p className="prose small">{t("Three roommates pay for groceries, Wi-Fi and the cook at different times. By month end nobody knows who owes whom, and settling takes six UPI payments when two would do.", "Teen roommates alag-alag samay groceries, Wi-Fi, cook ka bhugtaan karte hain. Mahine ke ant me pata nahi kaun kisko kitna de; chhe UPI lagte hain jab do kaafi hain.", "महीने के अंत का हिसाब।")}</p>
          </Card>
          <Card title={t("Out of scope", "Isme nahi", "इसमें नहीं")}>
            <ul className="rules small muted">
              <li>{t("Real payments (we mark transfers as paid)", "Asli payment (sirf 'paid' mark)", "असली भुगतान")}</li>
              <li>{t("Multiple currencies", "Kai currencies", "कई मुद्राएँ")}</li>
            </ul>
          </Card>
        </div>
      )}
      {tab === "rubric" && (
        <Card pad={false}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("Criterion", "Criterion", "मानदंड")}</th>
                  <th className="r">{t("Weight", "Weight", "भार")}</th>
                  <th>{t("Checked by", "Kaun jaanchta", "जाँच")}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Correctness: all tests pass", "40%", "Tests"],
                  ["Code quality: names, structure, no dead code", "20%", "AI + reviewer"],
                  ["Edge cases: zero, one member, rounding", "15%", "Tests + reviewer"],
                  ["UX: clear balances, works on a phone", "15%", "Reviewer"],
                  ["README with screenshots and setup", "10%", "Reviewer"],
                ].map(([a, b, c]) => (
                  <tr key={a}>
                    <td>{a}</td>
                    <td className="r num">{b}</td>
                    <td>
                      <Badge>{c}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {(tab === "res" || tab === "subs") && (
        <Card>
          <div className="list">
            {(tab === "res"
              ? [
                  [<BookOpen key="a" />, "Lesson: greedy settling of debts", "8 min"],
                  [<BookOpen key="b" />, "Lesson: Postgres transactions", "10 min"],
                  [<FlaskConical key="c" />, "Lab: Express routes and tests", "30 min"],
                ]
              : [
                  [<CircleCheck key="a" />, "M2 · Add and list expenses · passed", "18 Oct"],
                  [<CircleCheck key="b" />, "M1 · Setup and schema · passed", "15 Oct"],
                ]
            ).map(([ic, n, d], i) => (
              <div key={i} className="li" style={{ padding: "10px 0" }}>
                <span className="ic-box">{ic}</span>
                <span className="grow small">{n as string}</span>
                <span className="tiny faint">{d as string}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export function ProjectRail() {
  const t = useT();
  return (
    <>
      <section className="card pad col g12">
        <div className="row g12">
          <Ring v={52} size={72} stroke={7}>
            <b className="num">52%</b>
          </Ring>
          <div>
            <b className="small">{t("2 of 5 milestones", "5 me se 2 milestones", "5 में से 2")}</b>
            <p className="tiny faint">{t("23 of 39 tests pass", "39 me se 23 tests pass", "39 में से 23")}</p>
          </div>
        </div>
      </section>
      <section className="card pad col g10">
        <span className="h3">{t("Reviews", "Reviews", "समीक्षाएँ")}</span>
        <div className="row g10 small">
          <span className="ai-mark" style={{ width: 28, height: 28 }}>
            <Sparkles />
          </span>
          <span className="grow">{t("AI review on every push", "Har push par AI review", "हर पुश पर")}</span>
          <Badge tone="tick">{t("On", "On", "चालू")}</Badge>
        </div>
        <div className="row g10 small">
          <span className="avatar" style={{ ["--av" as string]: "28px", ["--av-bg" as string]: "#0E7490" }}>
            R
          </span>
          <span className="grow">{t("Human review at M5", "M5 par insaan ka review", "M5 पर मानव समीक्षा")}</span>
          <Badge tone="solid">Plus</Badge>
        </div>
      </section>
      <section className="card pad col g8">
        <span className="h3">{t("When you ship", "Ship karne par", "शिप करने पर")}</span>
        {[
          t("A live link: hostel-split.parikshaa.app", "Live link: hostel-split.parikshaa.app", "लाइव लिंक"),
          t("A project card on your profile", "Profile par project card", "प्रोफ़ाइल कार्ड"),
          t("Counts toward Pramaan Full-stack L1", "Pramaan Full-stack L1 me ginti", "प्रमाण में गिनती"),
        ].map((x) => (
          <div key={x} className="row top g8 small">
            <Rocket style={{ width: 15, height: 15, color: "var(--tick)", marginTop: 2 }} />
            {x}
          </div>
        ))}
      </section>
    </>
  );
}

/* ---------------- studio (focus) ---------------- */

const SETTLE = `import { Balance, Transfer } from "../types";

// Return the fewest transfers that settle every balance.
export function settle(balances: Balance[]): Transfer[] {
  const out: Transfer[] = [];
  const owes = balances.filter((b) => b.amount < 0);
  const gets = balances.filter((b) => b.amount > 0);
  for (const o of owes) {
    for (const g of gets) {
      const pay = Math.min(-o.amount, g.amount);
      out.push({ from: o.name, to: g.name, amount: pay });
      o.amount += pay;
      g.amount -= pay;
    }
  }
  return out;
}`;

const TREE: [string, number, "dir" | "file", boolean?][] = [
  ["hostel-split", 0, "dir"],
  ["src", 1, "dir"],
  ["api", 2, "dir"],
  ["expenses.ts", 3, "file"],
  ["settle.ts", 3, "file", true],
  ["ui", 2, "dir"],
  ["RoomPage.tsx", 3, "file"],
  ["types.ts", 2, "file"],
  ["tests", 1, "dir"],
  ["settle.test.ts", 2, "file"],
  ["package.json", 1, "file"],
  ["README.md", 1, "file"],
];

const TESTS: [string, boolean, string?][] = [
  ["returns [] when everyone is even", true],
  ["one debtor, one creditor", true],
  ["amounts are whole rupees", true],
  ["never pays more than owed", true],
  ["handles 10 members", true],
  ["ignores zero balances", true],
  ["total paid equals total owed", true],
  ["is stable for the same input", true],
  ["uses the fewest transfers (4 members)", false, "expected 3 transfers, got 4"],
  ["skips ₹0 transfers", false, "got Kabir → Ishita ₹0"],
  ["uses the fewest transfers (5 members)", false, "expected 4 transfers, got 6"],
  ["largest debtor pays first", false, "first transfer was Kabir, expected Zoya"],
];

export function StudioScreen() {
  const t = useT();
  const toast = useToast();
  const { open, toggle } = usePanes({ files: true, code: true, prev: true, ai: false });
  const [phoneTab, setPhoneTab] = useState("code");
  const [bottom, setBottom] = useState("tests");
  const [running, setRunning] = useState(false);
  const defs = [
    { id: "files", label: t("Files", "Files", "फ़ाइलें"), icon: <FolderTree /> },
    { id: "code", label: t("Editor", "Editor", "संपादक"), icon: <FileCode2 /> },
    { id: "prev", label: t("Preview", "Preview", "प्रीव्यू"), icon: <Eye /> },
    { id: "ai", label: "Sahayak", icon: <Sparkles />, tone: "ai" as const },
  ];
  const check = () => {
    setRunning(true);
    setBottom("tests");
    window.setTimeout(() => {
      setRunning(false);
      toast(t("8 of 12 tests pass · 4 to go", "12 me se 8 pass · 4 baaki", "12 में से 8 पास"));
    }, document.documentElement.classList.contains("shots") ? 0 : 1100);
  };
  return (
    <>
      <FocusBar
        back="project"
        title="hostel-split"
        sub={t("Milestone 3 · Settle up", "Milestone 3 · Settle up", "माइलस्टोन 3")}
        center={
          <span className="ms-pill">
            <TestTube2 style={{ width: 14, height: 14 }} />
            <span className="num">8 / 12</span>
            <span className="tiny faint hide-narrow">{t("tests", "tests", "टेस्ट")}</span>
          </span>
        }
        right={
          <>
            <span className="hide-phone">
              <PaneToggles panes={defs} open={open} toggle={toggle} />
            </span>
            <button className="btn sm" onClick={check} disabled={running}>
              {running ? <span className="spinner" /> : <Play />}
              <span className="hide-narrow">{t("Check my work", "Kaam jaancho", "जाँचें")}</span>
            </button>
            <button className="btn sm pri" onClick={() => toast(t("Milestone opens when all 12 tests pass", "12 tests pass hone par milestone submit", "सभी टेस्ट पास होने पर"))}>
              <Send />
              <span className="hide-narrow">{t("Submit M3", "M3 submit", "M3 जमा")}</span>
            </button>
          </>
        }
      />
      <Panes
        open={open}
        toggle={toggle}
        phoneTab={phoneTab}
        setPhoneTab={setPhoneTab}
        panes={[
          {
            ...defs[0],
            weight: 0.18,
            min: 230,
            content: (
              <>
                <PaneHead onClose={() => toggle("files")}>
                  <span className="h3" style={{ paddingLeft: 6 }}>
                    {t("Explorer", "Explorer", "एक्सप्लोरर")}
                  </span>
                  <span className="grow" />
                  <button className="icon-btn sm" aria-label="New file">
                    <Plus />
                  </button>
                </PaneHead>
                <div className="pane-body">
                  <div className="tree">
                    {TREE.map(([n, d, k, on]) => (
                      <div key={n} className={`tr ${on ? "on" : ""}`} style={{ paddingLeft: 10 + d * 14 }}>
                        {k === "dir" ? <ChevronDown className="tr-chev" /> : <span style={{ width: 13 }} />}
                        {k === "dir" ? <Folder className="tr-ic dir" /> : <FileCode2 className="tr-ic" />}
                        <span className="ellipsis">{n}</span>
                        {n === "settle.ts" && <span className="tr-dot" />}
                      </div>
                    ))}
                  </div>
                  <div className="guide">
                    <span className="eyebrow">{t("Steps for M3", "M3 ke kadam", "M3 के कदम")}</span>
                    {[
                      ["Write settle() that pays debts", true],
                      ["Pair the biggest debtor with the biggest creditor", false],
                      ["Skip zero-rupee transfers", false],
                      ["Show the plan on RoomPage", false],
                    ].map(([s, d], i) => (
                      <div key={i} className={`g-step ${d ? "done" : i === 1 ? "now" : ""}`}>
                        {d ? <CircleCheck /> : <Circle />}
                        <span>{s as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ),
          },
          {
            ...defs[1],
            weight: 0.44,
            min: 380,
            content: (
              <>
                <PaneHead onClose={() => toggle("code")}>
                  <div className="file-tabs">
                    <span className="file-tab on">
                      <FileCode2 />
                      settle.ts
                    </span>
                    <span className="file-tab">RoomPage.tsx</span>
                    <span className="file-tab">settle.test.ts</span>
                  </div>
                </PaneHead>
                <div className="editor">
                  <Code code={SETTLE} hl={[8, 9]} bad={[11]} caret={11} className="ed-code" />
                  <div className="ed-note" style={{ top: "calc(12px + 11 * 1.7em + 4px)", left: "min(300px, 60%)" }}>
                    <PenNote>{t("↖ pushes a ₹0 transfer too", "↖ ₹0 ka transfer bhi jodta hai", "↖ ₹0 भी जोड़ता है")}</PenNote>
                  </div>
                </div>
                <div className="bottom-panel">
                  <div className="bp-tabs">
                    {[
                      ["tests", t("Tests", "Tests", "टेस्ट"), <TestTube2 key="a" />, "8/12"],
                      ["term", t("Terminal", "Terminal", "टर्मिनल"), <SquareTerminal key="b" />, ""],
                      ["prob", t("Problems", "Problems", "समस्याएँ"), <CircleX key="c" />, "1"],
                    ].map(([id, l, ic, c]) => (
                      <button key={id as string} className={bottom === id ? "on" : ""} onClick={() => setBottom(id as string)}>
                        {ic}
                        {l}
                        {c && <span className="count">{c}</span>}
                      </button>
                    ))}
                  </div>
                  <div className="bp-body">
                    {running ? (
                      <div className="row g8 small muted" style={{ padding: 12 }}>
                        <span className="spinner" />
                        {t("Running 12 tests…", "12 tests chal rahe…", "12 टेस्ट चल रहे…")}
                      </div>
                    ) : bottom === "tests" ? (
                      <ul className="tests">
                        {TESTS.map(([n, ok, msg]) => (
                          <li key={n} className={ok ? "ok" : "bad"}>
                            {ok ? <CircleCheck /> : <CircleX />}
                            <span className="grow">{n}</span>
                            {msg && <span className="mono tiny t-red">{msg}</span>}
                          </li>
                        ))}
                      </ul>
                    ) : bottom === "term" ? (
                      <pre className="term mono">
                        <span className="faint">~/hostel-split$</span> npm run dev{"\n"}
                        <span className="t-tick">✓</span> ready on http://localhost:5173{"\n"}
                        <span className="faint">[api]</span> GET /rooms/214 200 12ms{"\n"}
                        <span className="faint">[api]</span> POST /settle 200 4ms{"\n"}
                        <span className="faint">~/hostel-split$</span> <span className="type-caret" />
                      </pre>
                    ) : (
                      <ul className="tests">
                        <li className="bad">
                          <CircleX />
                          <span className="grow">settle.ts:11 · {t("Transfer of 0 is pushed when pay is 0", "pay 0 hone par bhi transfer jud raha", "0 का ट्रांसफ़र")}</span>
                        </li>
                      </ul>
                    )}
                  </div>
                </div>
                <div className="statusbar">
                  <span className="row g4">
                    <GitBranch />
                    m3-settle
                  </span>
                  <span className="faint hide-narrow">Node 22 · TypeScript</span>
                  <span className="grow" />
                  <span className="faint">Ln 9, Col 18</span>
                  <span className="t-tick">{t("Saved", "Saved", "सहेजा")}</span>
                </div>
              </>
            ),
          },
          {
            ...defs[2],
            weight: 0.38,
            min: 300,
            content: (
              <>
                <PaneHead onClose={() => toggle("prev")}>
                  <span className="h3" style={{ paddingLeft: 6 }}>
                    {t("Preview", "Preview", "प्रीव्यू")}
                  </span>
                  <span className="live-dot">{t("live", "live", "लाइव")}</span>
                  <span className="grow" />
                  <button className="icon-btn sm" aria-label="Reload preview">
                    <RotateCw />
                  </button>
                  <button className="icon-btn sm" aria-label="Open in new tab">
                    <ExternalLink />
                  </button>
                </PaneHead>
                <div className="pane-body prev-body">
                  <BrowserFrame url="localhost:5173/rooms/214">
                    <SplitApp big settled={false} />
                  </BrowserFrame>
                  <PenNote className="prev-note">{t("4 transfers, one of ₹0. Should be 3.", "4 transfers, ek ₹0 ka. 3 hone chahiye.", "4 ट्रांसफ़र, 3 होने चाहिए।")}</PenNote>
                </div>
              </>
            ),
          },
          { ...defs[3], weight: 0.32, min: 320, content: <SahayakPanel context="studio" onClose={() => toggle("ai")} onMinimize={() => toggle("ai")} /> },
        ]}
      />
    </>
  );
}

