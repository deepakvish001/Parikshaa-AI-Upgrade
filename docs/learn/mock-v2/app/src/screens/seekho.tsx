import { useEffect, useState } from "react";
import {
  CodeXml,
  Cpu,
  Network,
  Globe,
  BarChart3,
  Brain,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  Award,
  Search,
  ArrowRight,
  BookOpen,
  PlayCircle,
  ListChecks,
  FlaskConical,
  CircleCheck,
  Circle,
  CircleDot,
  Clock,
  Lock,
  Sparkles,
  ExternalLink,
  SkipForward,
  Hammer,
  Languages,
  MessageCircleQuestion,
} from "lucide-react";
import { Link, useT, useToast, useLang } from "../lib/core";
import { Bar, Drawer, Ring, SampleNote } from "../ui/kit";
import { PageHead } from "../ui/shell";

type Tri = [string, string, string];
type Group = { label: Tri; items: { n: string; to?: string; pramaan?: boolean }[] };
const STAMBH: { icon: typeof CodeXml; color: string; name: Tri; sub: Tri; count: string; groups: Group[] }[] = [
  {
    icon: CodeXml,
    color: "var(--t-dsa)",
    name: ["DSA", "DSA", "DSA"],
    sub: ["From the first loop to interview patterns", "Pehle loop se interview patterns tak", "पहले लूप से इंटरव्यू पैटर्न तक"],
    count: "9",
    groups: [
      { label: ["Start coding · free certificate", "Coding shuru · free certificate", "कोडिंग शुरू · मुफ़्त प्रमाणपत्र"], items: [{ n: "C++", pramaan: true }, { n: "Java", pramaan: true }, { n: "Python", pramaan: true }] },
      { label: ["Learn from zero", "Zero se seekho", "शून्य से सीखें"], items: [{ n: "DSA from scratch", to: "course" }, { n: "Parikshaa DSA sheet", to: "sheet" }] },
      { label: ["Interview prep · India", "Interview prep · India", "इंटरव्यू · भारत"], items: [{ n: "Service company coding", to: "sheet" }, { n: "Product company patterns", to: "sheet" }] },
      { label: ["Interview prep · abroad", "Interview prep · bahar", "इंटरव्यू · विदेश"], items: [{ n: "Interview 90", to: "sheet" }, { n: "Competitive programming", to: "contests" }] },
    ],
  },
  {
    icon: Cpu,
    color: "var(--t-core)",
    name: ["Core CS", "Core CS", "कोर CS"],
    sub: ["Subjects asked in every technical round", "Har technical round ke subjects", "हर तकनीकी राउंड के विषय"],
    count: "5",
    groups: [{ label: ["Subjects", "Subjects", "विषय"], items: [{ n: "Operating systems", to: "course", pramaan: true }, { n: "DBMS", pramaan: true }, { n: "Computer networks" }, { n: "OOP" }, { n: "SQL", to: "sql", pramaan: true }] }],
  },
  {
    icon: Network,
    color: "var(--t-sys)",
    name: ["System design", "System design", "सिस्टम डिज़ाइन"],
    sub: ["Low level and high level, with simulators", "LLD aur HLD, simulator ke saath", "LLD और HLD"],
    count: "2",
    groups: [{ label: ["In depth", "Gehraai se", "गहराई से"], items: [{ n: "Low level design" }, { n: "High level design" }] }],
  },
  {
    icon: Globe,
    color: "var(--t-dev)",
    name: ["Web development", "Web development", "वेब डेवलपमेंट"],
    sub: ["Build and ship real apps", "Asli apps banao aur ship karo", "असली ऐप बनाएँ"],
    count: "6",
    groups: [{ label: ["Track", "Track", "ट्रैक"], items: [{ n: "HTML, CSS, JavaScript" }, { n: "React" }, { n: "Node and APIs" }, { n: "Databases for apps" }, { n: "Projects", to: "build" }] }],
  },
  {
    icon: BarChart3,
    color: "var(--t-data)",
    name: ["Data and AI", "Data aur AI", "डेटा और एआई"],
    sub: ["Python, analytics and machine learning basics", "Python, analytics, ML ki buniyaad", "पायथन, एनालिटिक्स"],
    count: "4",
    groups: [{ label: ["Track", "Track", "ट्रैक"], items: [{ n: "Python for data" }, { n: "SQL for analysts" }, { n: "Statistics" }, { n: "ML basics" }] }],
  },
  {
    icon: Brain,
    color: "var(--t-apt)",
    name: ["Aptitude", "Aptitude", "एप्टीट्यूड"],
    sub: ["Quant, logical and verbal for placement tests", "Placement tests ke liye quant, logical, verbal", "प्लेसमेंट टेस्ट"],
    count: "3",
    groups: [{ label: ["Sections", "Sections", "खंड"], items: [{ n: "Quantitative", to: "aptitude" }, { n: "Logical", to: "aptitude" }, { n: "Verbal", to: "aptitude" }] }],
  },
  {
    icon: BriefcaseBusiness,
    color: "var(--t-career)",
    name: ["Career", "Career", "करियर"],
    sub: ["Resume, interviews and offers", "Resume, interview aur offer", "बायोडाटा, इंटरव्यू"],
    count: "3",
    groups: [{ label: ["Guides", "Guides", "मार्गदर्शिका"], items: [{ n: "Resume that gets read", to: "jobs" }, { n: "Mock interviews" }, { n: "Comparing offers" }] }],
  },
];

export function SeekhoBody() {
  const t = useT();
  const [open, setOpen] = useState(0);
  return (
    <div className="page stagger">
      <PageHead
        title={t("Learn", "Seekho", "सीखो")}
        sub={t("Courses grouped by what you want to become. Every course ends in a project or a Pramaan test.", "Aap kya banna chahte ho, uske hisaab se courses. Har course ke ant me project ya Pramaan test.", "हर कोर्स के अंत में प्रोजेक्ट या प्रमाण।")}
        actions={
          <label className="input" style={{ width: 280 }}>
            <Search size={15} />
            <input id="learn-q" placeholder={t("Search 65 courses", "65 courses me dhoondho", "65 कोर्स में खोजें")} />
          </label>
        }
      />
      <section className="stack">
        <div className="section-title">
          <h2>{t("For your goal: product company SDE", "Aapke goal ke liye: product SDE", "आपके लक्ष्य के लिए")}</h2>
        </div>
        <div className="grid c3">
          {[
            ["DSA from scratch", 72, "38 h · 120 lessons", "var(--t-dsa)"],
            ["Operating systems", 18, "14 h · 42 lessons", "var(--t-core)"],
            ["Low level design", 0, "16 h · 30 lessons", "var(--t-sys)"],
          ].map(([n, p, m, c]) => (
            <Link key={n as string} to="course" className="panel pad stack hover-card course-card">
              <span className="course-band" style={{ background: c as string }} />
              <b style={{ fontSize: "var(--fs-16)" }}>{n}</b>
              <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
                {m}
              </span>
              <div className="row" style={{ gap: 10 }}>
                <span className="grow">
                  <Bar value={p as number} thin />
                </span>
                <span className="faint num" style={{ fontSize: "var(--fs-12)" }}>
                  {p}%
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="stack">
        <div className="section-title">
          <h2>{t("All subjects", "Saare subjects", "सभी विषय")}</h2>
          <span className="faint" style={{ fontSize: "var(--fs-12)", display: "flex", gap: 6, alignItems: "center" }}>
            <Award size={13} style={{ color: "var(--plus)" }} /> = {t("ends in a Pramaan certificate", "Pramaan certificate milta hai", "प्रमाण प्रमाणपत्र")}
          </span>
        </div>
        <div className="stambh-list">
          {STAMBH.map((s, i) => {
            const Icon = s.icon;
            const isOpen = open === i;
            return (
              <div key={s.name[0]} className={`stambh ${isOpen ? "open" : ""}`}>
                <button type="button" className="stambh-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? -1 : i)}>
                  <span className="stambh-ico" style={{ color: s.color, background: `color-mix(in srgb, ${s.color} 16%, transparent)` }}>
                    <Icon size={20} />
                  </span>
                  <span className="grow">
                    <b>{t(...s.name)}</b>
                    <small>{t(...s.sub)}</small>
                  </span>
                  <span className="faint num" style={{ fontSize: "var(--fs-12)" }}>
                    {s.count} {t("courses", "courses", "कोर्स")}
                  </span>
                  {isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                </button>
                {isOpen && (
                  <div className="stambh-body">
                    {s.groups.map((g) => (
                      <div key={g.label[0]} className="stack sm">
                        <span className="eyebrow">{t(...g.label)}</span>
                        <div className="course-chips">
                          {g.items.map((it) => (
                            <Link key={it.n} to={it.to ?? "course"} className="course-chip">
                              {it.n}
                              {it.pramaan && <Award size={13} style={{ color: "var(--plus)" }} />}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ---------------- roadmap ---------------- */

type NodeSt = "done" | "learning" | "todo" | "skip";
const ROADMAP: { stage: Tri; nodes: { n: string; st: NodeSt; opt?: boolean }[] }[] = [
  { stage: ["Foundations", "Neev", "नींव"], nodes: [{ n: "One language well (C++)", st: "done" }, { n: "Complexity", st: "done" }, { n: "Git basics", st: "done", opt: true }] },
  { stage: ["Core DSA", "Core DSA", "मूल DSA"], nodes: [{ n: "Arrays & hashing", st: "done" }, { n: "Two pointers", st: "learning" }, { n: "Linked lists", st: "learning" }, { n: "Stacks & queues", st: "todo" }, { n: "Binary search", st: "done" }] },
  { stage: ["Advanced", "Advanced", "उन्नत"], nodes: [{ n: "Trees", st: "todo" }, { n: "Graphs", st: "todo" }, { n: "Dynamic programming", st: "todo" }, { n: "Tries", st: "skip", opt: true }] },
  { stage: ["Around DSA", "DSA ke saath", "DSA के साथ"], nodes: [{ n: "OOP", st: "todo" }, { n: "DBMS + SQL", st: "learning" }, { n: "Operating systems", st: "todo" }, { n: "Networks", st: "todo", opt: true }] },
  { stage: ["Interview", "Interview", "इंटरव्यू"], nodes: [{ n: "Low level design", st: "todo" }, { n: "Projects (2)", st: "todo" }, { n: "Mock interviews", st: "todo" }, { n: "Resume", st: "todo" }] },
];

export function RoadmapBody() {
  const t = useT();
  const toast = useToast();
  const [node, setNode] = useState<string | null>(null);
  const [onlyCore, setOnlyCore] = useState(false);
  const all = ROADMAP.flatMap((s) => s.nodes);
  const done = all.filter((n) => n.st === "done").length;
  return (
    <div className="page stagger">
      <PageHead
        crumbs={[{ to: "seekho", label: t("Learn", "Seekho", "सीखो") }, { label: t("Roadmaps", "Roadmaps", "रोडमैप") }]}
        title={t("SDE at a product company", "Product company SDE", "प्रोडक्ट कंपनी SDE")}
        sub={t("Click any step to see what it is, our lessons and practice, and to mark it.", "Kisi bhi step par click karo: kya hai, lessons, practice, aur mark karo.", "किसी भी कदम पर क्लिक करें।")}
        actions={
          <div className="row" style={{ gap: 10 }}>
            <button type="button" className={`chip ${onlyCore ? "on" : ""}`} aria-pressed={onlyCore} onClick={() => setOnlyCore((x) => !x)}>
              {t("Hide optional", "Optional chhupao", "वैकल्पिक छुपाएँ")}
            </button>
            <Ring value={(done / all.length) * 100} size={52} stroke={5}>
              <b style={{ fontSize: 11 }} className="num">
                {done}/{all.length}
              </b>
            </Ring>
          </div>
        }
      />
      <div className="rm-legend">
        <span>
          <i className="rm-dot done" /> {t("Done", "Ho gaya", "पूरा")}
        </span>
        <span>
          <i className="rm-dot learning" /> {t("Learning", "Seekh raha", "सीख रहे")}
        </span>
        <span>
          <i className="rm-dot todo" /> {t("Not started", "Shuru nahi", "शुरू नहीं")}
        </span>
        <span>
          <i className="rm-dot skip" /> {t("Skipped", "Skip kiya", "छोड़ा")}
        </span>
      </div>
      <div className="roadmap">
        {ROADMAP.map((s, i) => (
          <div key={s.stage[0]} className="rm-stage">
            <div className="rm-stage-head">
              <span className="rm-num">{i + 1}</span>
              <b>{t(...s.stage)}</b>
            </div>
            <div className="rm-nodes">
              {s.nodes
                .filter((n) => !onlyCore || !n.opt)
                .map((n) => (
                  <button key={n.n} type="button" className={`rm-node ${n.st}`} onClick={() => setNode(n.n)}>
                    {n.st === "done" ? <CircleCheck size={15} /> : n.st === "learning" ? <CircleDot size={15} /> : n.st === "skip" ? <SkipForward size={14} /> : <Circle size={15} />}
                    <span>{n.n}</span>
                    {n.opt && <small>{t("optional", "optional", "वैकल्पिक")}</small>}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
      {node && (
        <Drawer title={node} onClose={() => setNode(null)}>
          <div className="stack lg" style={{ padding: 20 }}>
            <p className="muted">
              {t(
                "Two pointers walk through an array from both ends or at two speeds, so many O(n²) pair problems become O(n).",
                "Two pointers array ko dono kinaron se ya do raftaar se chalte hain, isliye kai O(n²) jodi wale problems O(n) ban jaate hain.",
                "दो पॉइंटर O(n²) को O(n) बनाते हैं।",
              )}
            </p>
            <div className="stack sm">
              <span className="eyebrow">{t("On Parikshaa", "Parikshaa par", "परीक्षा पर")}</span>
              <Link to="lesson" className="list-row panel" style={{ borderRadius: 10 }}>
                <BookOpen size={15} /> <span className="t">Two pointers: the idea</span>
                <span className="faint">12 min</span>
              </Link>
              <Link to="sheet" className="list-row panel" style={{ borderRadius: 10 }}>
                <ListChecks size={15} /> <span className="t">{t("14 practice problems", "14 practice problems", "14 अभ्यास प्रश्न")}</span>
                <span className="faint">8/14</span>
              </Link>
              <Link to="daily" className="list-row panel" style={{ borderRadius: 10 }}>
                <Sparkles size={15} /> <span className="t">{t("5-question quiz", "5 sawaal ka quiz", "5 सवाल का क्विज़")}</span>
                <span className="faint">4 min</span>
              </Link>
            </div>
            <div className="stack sm">
              <span className="eyebrow">{t("Free links outside", "Bahar ke free links", "बाहरी मुफ़्त लिंक")}</span>
              <a href="#roadmap" onClick={(e) => e.preventDefault()} className="row" style={{ gap: 6 }}>
                <ExternalLink size={13} /> {t("A university lecture note on two pointers", "Ek university lecture note", "विश्वविद्यालय का नोट")}
              </a>
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              <button type="button" className="btn secondary sm" onClick={() => toast(t("Marked as learning", "Seekh raha mark", "सीख रहे"))}>
                <CircleDot size={14} /> {t("Learning", "Seekh raha", "सीख रहे")}
              </button>
              <button type="button" className="btn ok sm" onClick={() => toast(t("Marked done", "Ho gaya mark", "पूरा"))}>
                <CircleCheck size={14} /> {t("Done", "Ho gaya", "पूरा")}
              </button>
              <button type="button" className="btn ghost sm">
                <SkipForward size={14} /> {t("Skip", "Skip", "छोड़ें")}
              </button>
            </div>
            <Link to="pramaan" className="btn plus">
              <Award size={15} /> {t("Prove it with a 20-min Pramaan quiz", "20 min ke Pramaan quiz se saabit karo", "20 मिनट के प्रमाण क्विज़ से")}
            </Link>
          </div>
        </Drawer>
      )}
    </div>
  );
}

/* ---------------- course ---------------- */

const MODULES: { n: string; lessons: { n: string; k: "read" | "video" | "quiz" | "lab"; m: number; st: "done" | "now" | "todo" | "lock" }[] }[] = [
  {
    n: "1. Processes and threads",
    lessons: [
      { n: "What a process is", k: "read", m: 8, st: "done" },
      { n: "Process states, drawn", k: "video", m: 6, st: "done" },
      { n: "Threads vs processes", k: "read", m: 10, st: "done" },
      { n: "Quiz: processes", k: "quiz", m: 5, st: "done" },
    ],
  },
  {
    n: "2. CPU scheduling",
    lessons: [
      { n: "FCFS and SJF with a timeline", k: "read", m: 12, st: "done" },
      { n: "Round robin, step by step", k: "read", m: 14, st: "now" },
      { n: "Lab: simulate round robin", k: "lab", m: 25, st: "todo" },
      { n: "Quiz: scheduling", k: "quiz", m: 6, st: "todo" },
    ],
  },
  { n: "3. Synchronisation", lessons: [{ n: "Race conditions", k: "read", m: 10, st: "lock" }] },
  { n: "4. Deadlocks", lessons: [{ n: "The four conditions", k: "read", m: 9, st: "lock" }] },
  { n: "5. Memory and paging", lessons: [{ n: "Paging with pictures", k: "read", m: 15, st: "lock" }] },
];

export function CourseBody() {
  const t = useT();
  const [open, setOpen] = useState<number[]>([1]);
  const KIcon = { read: BookOpen, video: PlayCircle, quiz: ListChecks, lab: FlaskConical };
  return (
    <div className="page">
      <div className="course-hero panel">
        <div className="stack" style={{ gap: 12 }}>
          <div className="crumbs">
            <Link to="seekho">{t("Learn", "Seekho", "सीखो")}</Link> / Core CS
          </div>
          <h1>{t("Operating systems", "Operating systems", "ऑपरेटिंग सिस्टम")}</h1>
          <p className="muted">{t("The OS questions interviews actually ask, drawn step by step. Ends with a Pramaan test.", "Interview me jo OS sawaal poochhe jaate hain, step-by-step chitron ke saath. Ant me Pramaan test.", "इंटरव्यू वाले OS सवाल, चित्रों के साथ।")}</p>
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="tag">
              <Clock size={12} /> 14 h
            </span>
            <span className="tag">42 {t("lessons", "lessons", "पाठ")}</span>
            <span className="tag">6 labs</span>
            <span className="tag plus">
              <Award size={12} /> Pramaan
            </span>
            <span className="tag">
              <Languages size={12} /> EN · HG · हिं
            </span>
          </div>
          <div className="row wrap" style={{ gap: 10 }}>
            <Link to="lesson" className="btn primary lg">
              {t("Continue: Round robin", "Jaari: Round robin", "जारी रखें")} <ArrowRight size={15} />
            </Link>
            <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
              {t("Written by the Parikshaa team · checked by 2 reviewers", "Parikshaa team ne likha · 2 reviewers ne jaancha", "परीक्षा टीम · 2 समीक्षक")}
            </span>
          </div>
        </div>
        <Ring value={18} size={110} stroke={10}>
          <b className="num">18%</b>
          <small>5 / 42</small>
        </Ring>
      </div>
      <div className="course-layout">
        <section className="stack">
          {MODULES.map((m, i) => {
            const isOpen = open.includes(i);
            const doneN = m.lessons.filter((l) => l.st === "done").length;
            return (
              <div key={m.n} className={`sheet-sec ${isOpen ? "open" : ""}`}>
                <button type="button" className="sec-head" aria-expanded={isOpen} onClick={() => setOpen((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]))}>
                  {isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                  <b>{m.n}</b>
                  <span className="grow" />
                  {m.lessons[0].st === "lock" ? <Lock size={14} className="faint" /> : <span className="sec-count num">{doneN}/{m.lessons.length}</span>}
                </button>
                {isOpen && (
                  <div className="sec-body">
                    {m.lessons.map((l) => {
                      const I = KIcon[l.k];
                      return (
                        <Link key={l.n} to={l.k === "lab" ? "studio" : l.k === "quiz" ? "daily" : "lesson"} className={`lesson-row ${l.st}`}>
                          <span className="ls-ic">{l.st === "done" ? <CircleCheck size={16} /> : <I size={16} />}</span>
                          <span className="grow">{l.n}</span>
                          {l.st === "now" && <span className="tag action">{t("You stopped here", "Yahan ruke the", "यहाँ रुके थे")}</span>}
                          <span className="faint num" style={{ fontSize: "var(--fs-12)" }}>
                            {l.m} min
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </section>
        <aside className="stack">
          <div className="panel pad stack">
            <b style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Hammer size={15} /> {t("What you will build", "Kya banaoge", "क्या बनाएँगे")}
            </b>
            <div className="mini-shot" aria-hidden="true">
              <div className="ms-bar" />
              <div className="ms-gantt">
                {[40, 25, 55, 30, 45].map((w, i) => (
                  <i key={i} style={{ width: `${w}%`, marginLeft: `${i * 9}%` }} />
                ))}
              </div>
            </div>
            <p className="muted" style={{ fontSize: "var(--fs-13)" }}>
              {t("A CPU scheduler simulator that draws the timeline for FCFS, SJF and round robin.", "CPU scheduler simulator jo FCFS, SJF, round robin ki timeline banata hai.", "CPU शेड्यूलर सिम्युलेटर।")}
            </p>
          </div>
          <div className="panel pad stack">
            <b>{t("Ends with", "Ant me", "अंत में")}</b>
            <span className="row" style={{ gap: 8, fontSize: "var(--fs-13)" }}>
              <Award size={15} style={{ color: "var(--plus)" }} /> {t("Pramaan · OS level 1 · 45 min proctored", "Pramaan · OS L1 · 45 min proctored", "प्रमाण · 45 मिनट")}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- lesson ---------------- */

const TOC: Tri[] = [
  ["The one formula", "Ek formula", "एक सूत्र"],
  ["Units without mistakes", "Units bina galti", "इकाइयाँ"],
  ["Relative speed", "Relative speed", "सापेक्ष गति"],
  ["Cheat sheet", "Cheat sheet", "चीट शीट"],
  ["Check yourself", "Khud jaancho", "खुद जाँचें"],
  ["Questions people ask", "Log kya poochhte hain", "सवाल"],
];

export function LessonBody() {
  const t = useT();
  const { lang } = useLang();
  const [progress, setProgress] = useState(0);
  const [ans, setAns] = useState<number | null>(null);
  const [faq, setFaq] = useState(0);
  useEffect(() => {
    const h = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? (window.scrollY / max) * 100 : 0);
    };
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  return (
    <div className="page lesson-page">
      <div className="read-progress" style={{ width: `${progress}%` }} aria-hidden="true" />
      <div className="lesson-grid">
        <nav className="toc" aria-label={t("On this page", "Is page par", "इस पेज पर")}>
          <span className="eyebrow">{t("On this page", "Is page par", "इस पेज पर")}</span>
          {TOC.map((x, i) => (
            <a key={i} href={`#lesson`} onClick={(e) => e.preventDefault()} className={i === 1 ? "on" : ""}>
              {t(...x)}
            </a>
          ))}
          <div className="divider" />
          <span className="faint" style={{ fontSize: "var(--fs-11)" }}>
            {t("12 min · Aptitude · Lesson 4 of 9", "12 min · Aptitude · Lesson 4/9", "12 मिनट · पाठ 4/9")}
          </span>
        </nav>
        <article className="article lesson">
          <div className="crumbs">
            <Link to="aptitude">{t("Aptitude", "Aptitude", "एप्टीट्यूड")}</Link> / {t("Quantitative", "Quantitative", "गणितीय")}
          </div>
          <h1>{t("Speed, time and distance", "Speed, time aur distance", "चाल, समय और दूरी")}</h1>
          <p className="lead">
            {t(
              "Almost every question here is one formula used carefully. Most marks are lost on units and on which speed to use, not on the maths.",
              "Yahan lagbhag har sawaal ek hi formula ko dhyan se lagana hai. Zyadatar number units aur kaunsi speed lein, isme jaate hain, maths me nahi.",
              "लगभग हर सवाल एक ही सूत्र है। ज़्यादातर अंक इकाइयों में जाते हैं।",
            )}
          </p>
          <section>
            <h2>{t("The one formula", "Ek formula", "एक सूत्र")}</h2>
            <div className="formula">
              <math display="block">
                <mrow>
                  <mi>distance</mi>
                  <mo>=</mo>
                  <mi>speed</mi>
                  <mo>×</mo>
                  <mi>time</mi>
                </mrow>
              </math>
            </div>
            <p>
              {t(
                "Every other rule in this lesson is this one, rearranged or applied to two moving things at once.",
                "Is lesson ka har niyam isi formula ka roop hai, ya do chalti cheezon par ek saath.",
                "बाकी हर नियम इसी का रूप है।",
              )}
            </p>
          </section>
          <section>
            <h2>{t("Units without mistakes", "Units bina galti", "इकाइयाँ बिना गलती")}</h2>
            <div className="rule-box">
              <b>km/h → m/s</b>
              <span>
                {t("multiply by", "guna karo", "गुणा करें")}{" "}
                <math>
                  <mfrac>
                    <mn>5</mn>
                    <mn>18</mn>
                  </mfrac>
                </math>
              </span>
              <b>m/s → km/h</b>
              <span>
                {t("multiply by", "guna karo", "गुणा करें")}{" "}
                <math>
                  <mfrac>
                    <mn>18</mn>
                    <mn>5</mn>
                  </mfrac>
                </math>
              </span>
            </div>
            <p>
              <mark className="ask-mark">
                {t("A train at 72 km/h covers 20 metres every second", "72 km/h ki train har second 20 metre chalti hai", "72 km/h की ट्रेन हर सेकंड 20 मीटर")}
              </mark>
              {t(", because 72 × 5/18 = 20. Convert first, then solve.", ", kyunki 72 × 5/18 = 20. Pehle convert, phir hal.", ", क्योंकि 72 × 5/18 = 20।")}
              <span className="ask-pop" role="note">
                <MessageCircleQuestion size={13} /> {t("Ask Sahayak about this", "Is par Sahayak se poochho", "सहायक से पूछें")}
              </span>
            </p>
          </section>
          <section>
            <h2>{t("Relative speed", "Relative speed", "सापेक्ष गति")}</h2>
            <div className="grid c2">
              <div className="rule-card">
                <span className="eyebrow">{t("Opposite directions", "Ulti disha", "विपरीत दिशा")}</span>
                <div className="formula" style={{ fontSize: "var(--fs-16)" }}>
                  <math>
                    <msub>
                      <mi>v</mi>
                      <mi>rel</mi>
                    </msub>
                    <mo>=</mo>
                    <msub>
                      <mi>v</mi>
                      <mn>1</mn>
                    </msub>
                    <mo>+</mo>
                    <msub>
                      <mi>v</mi>
                      <mn>2</mn>
                    </msub>
                  </math>
                </div>
              </div>
              <div className="rule-card">
                <span className="eyebrow">{t("Same direction", "Ek disha", "एक दिशा")}</span>
                <div className="formula" style={{ fontSize: "var(--fs-16)" }}>
                  <math>
                    <msub>
                      <mi>v</mi>
                      <mi>rel</mi>
                    </msub>
                    <mo>=</mo>
                    <mo>|</mo>
                    <msub>
                      <mi>v</mi>
                      <mn>1</mn>
                    </msub>
                    <mo>−</mo>
                    <msub>
                      <mi>v</mi>
                      <mn>2</mn>
                    </msub>
                    <mo>|</mo>
                  </math>
                </div>
              </div>
            </div>
          </section>
          <section>
            <h2>{t("Cheat sheet", "Cheat sheet", "चीट शीट")}</h2>
            <div className="table-wrap panel">
              <table className="dtable">
                <thead>
                  <tr>
                    <th>{t("Situation", "Sthiti", "स्थिति")}</th>
                    <th>{t("Use", "Kya lagao", "क्या लगाएँ")}</th>
                    <th>{t("Watch out", "Dhyan do", "ध्यान दें")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{t("Train crosses a pole", "Train khambha paar", "ट्रेन खंभा पार")}</td>
                    <td className="mono">t = L / v</td>
                    <td>{t("Only the train's length", "Sirf train ki lambai", "केवल ट्रेन की लंबाई")}</td>
                  </tr>
                  <tr>
                    <td>{t("Train crosses a platform", "Train platform paar", "ट्रेन प्लेटफ़ॉर्म पार")}</td>
                    <td className="mono">t = (L + P) / v</td>
                    <td>{t("Add both lengths", "Dono lambai jodo", "दोनों लंबाई जोड़ें")}</td>
                  </tr>
                  <tr>
                    <td>{t("Two trains pass each other", "Do train ek doosre ko paar", "दो ट्रेनें")}</td>
                    <td className="mono">t = (L₁ + L₂) / v_rel</td>
                    <td>{t("Pick + or − by direction", "Disha se + ya −", "दिशा से + या −")}</td>
                  </tr>
                  <tr>
                    <td>{t("Average speed, two equal distances", "Average speed, do barabar doori", "औसत चाल")}</td>
                    <td className="mono">2ab / (a + b)</td>
                    <td>{t("Not (a + b) / 2", "(a + b) / 2 nahi", "(a + b)/2 नहीं")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h2>{t("Check yourself", "Khud jaancho", "खुद जाँचें")}</h2>
            <div className="panel pad stack">
              <p style={{ fontSize: "var(--fs-16)" }}>
                {t(
                  "A 150 m train at 54 km/h crosses a 250 m platform. How long does it take?",
                  "150 m ki train 54 km/h par 250 m platform paar karti hai. Kitna samay?",
                  "150 मी की ट्रेन 54 km/h पर 250 मी प्लेटफ़ॉर्म पार करती है।",
                )}
              </p>
              <div className="opts">
                {["10 s", "26.7 s", "16.7 s", "20 s"].map((o, i) => (
                  <button key={o} type="button" className={`opt ${ans === null ? "" : i === 1 ? "right" : i === ans ? "wrong" : ""}`} onClick={() => setAns(i)}>
                    <span className="opt-key">{String.fromCharCode(65 + i)}</span>
                    {o}
                  </button>
                ))}
              </div>
              {ans !== null && (
                <p className="muted" style={{ fontSize: "var(--fs-13)" }}>
                  {t("54 km/h = 15 m/s. Distance = 150 + 250 = 400 m. Time = 400 / 15 ≈ 26.7 s.", "54 km/h = 15 m/s. Doori = 150 + 250 = 400 m. Samay = 400 / 15 ≈ 26.7 s.", "400 / 15 ≈ 26.7 s।")}
                </p>
              )}
            </div>
          </section>
          <section>
            <h2>{t("Questions people ask", "Log kya poochhte hain", "लोग क्या पूछते हैं")}</h2>
            <div className="faq-list">
              {[
                [t("Why is average speed not the simple average?", "Average speed seedha average kyun nahi?", "औसत चाल सीधा औसत क्यों नहीं?"), t("Because you spend more time at the slower speed, so it counts more.", "Kyunki dheemi speed par zyada samay lagta hai, wo zyada gine jaati hai.", "धीमी चाल पर ज़्यादा समय।")],
                [t("Do I always convert to m/s?", "Hamesha m/s me badlein?", "हमेशा m/s में?"), t("Convert to whatever unit the answer is asked in, before you start.", "Jo unit jawab me maangi hai, shuru me usi me badlo.", "जो इकाई माँगी है उसमें।")],
              ].map(([q, a], i) => (
                <div key={i} className={`faq-item ${faq === i ? "open" : ""}`}>
                  <button type="button" aria-expanded={faq === i} onClick={() => setFaq(faq === i ? -1 : i)}>
                    {q}
                    <ChevronDown size={18} />
                  </button>
                  {faq === i && <p>{a}</p>}
                </div>
              ))}
            </div>
          </section>
          <div className="article-foot">
            <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
              {lang === "en" ? "Switch to Hinglish or हिंदी from the top bar; your place is kept." : t("", "Bhasha badalne par aapki jagah wahi rehti hai.", "भाषा बदलने पर जगह वही रहती है।")}
            </span>
            <Link to="apt-set" className="btn primary">
              {t("Practise 10 questions", "10 sawaal practice", "10 सवाल अभ्यास")} <ArrowRight size={15} />
            </Link>
          </div>
        </article>
      </div>
      <SampleNote>{t("Lesson written for the mock", "Mock ke liye likha lesson", "मॉक के लिए लिखा पाठ")}</SampleNote>
    </div>
  );
}
