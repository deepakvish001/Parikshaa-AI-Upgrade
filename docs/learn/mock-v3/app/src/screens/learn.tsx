import { useState, type CSSProperties, type ReactNode } from "react";
import {
  Search,
  BookOpen,
  PlayCircle,
  ListChecks,
  FlaskConical,
  CircleCheck,
  Circle,
  CircleDot,
  ChevronDown,
  ChevronRight,
  Clock,
  BadgeCheck,
  Lock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Plus,
  Check,
  Lightbulb,
  Bookmark,
  Languages,
  Route,
  Target,
  Layers,
  X,
} from "lucide-react";
import { Link, useT, useToast } from "../lib/core";
import { useAi } from "../lib/state";
import { Badge, Level, Meter, Ring, Seg, PageHead, Drawer, PenNote, Hl, Tick, LogoMark } from "../ui/kit";

/* ---------------- notebook covers ---------------- */

type Course = { id: string; name: [string, string, string]; sub: string; tone: string; lessons: number; hours: number; lvl: 1 | 2 | 3 | 4 | 5; p: number; motif: "grid" | "dots" | "lines" | "waves" };
const COURSES: Course[] = [
  { id: "dsa", name: ["DSA from zero", "DSA shuru se", "शुरू से DSA"], sub: "DSA", tone: "pen", lessons: 128, hours: 46, lvl: 2, p: 47, motif: "grid" },
  { id: "os", name: ["Operating systems", "Operating systems", "ऑपरेटिंग सिस्टम"], sub: "CS core", tone: "teal", lessons: 48, hours: 11, lvl: 2, p: 22, motif: "lines" },
  { id: "dbms", name: ["DBMS and SQL", "DBMS aur SQL", "DBMS और SQL"], sub: "CS core", tone: "coin", lessons: 52, hours: 13, lvl: 2, p: 35, motif: "dots" },
  { id: "cn", name: ["Computer networks", "Computer networks", "कंप्यूटर नेटवर्क"], sub: "CS core", tone: "ai", lessons: 40, hours: 9, lvl: 2, p: 0, motif: "waves" },
  { id: "oop", name: ["OOP in C++ and Java", "OOP: C++ aur Java", "OOP"], sub: "Languages", tone: "red", lessons: 36, hours: 8, lvl: 1, p: 64, motif: "grid" },
  { id: "apt", name: ["Aptitude for placements", "Placement aptitude", "प्लेसमेंट एप्टीट्यूड"], sub: "Aptitude", tone: "marker", lessons: 90, hours: 22, lvl: 1, p: 23, motif: "dots" },
  { id: "sd", name: ["System design basics", "System design basics", "सिस्टम डिज़ाइन"], sub: "Design", tone: "ink", lessons: 30, hours: 10, lvl: 3, p: 0, motif: "lines" },
  { id: "web", name: ["Web development", "Web development", "वेब डेवलपमेंट"], sub: "Build", tone: "tick", lessons: 64, hours: 24, lvl: 2, p: 10, motif: "waves" },
];

export function Cover({ c, size = "md" }: { c: Course; size?: "md" | "lg" }) {
  const t = useT();
  return (
    <div className={`cover ${size} m-${c.motif}`} style={{ "--cv": `var(--${c.tone === "ink" ? "ink" : c.tone === "marker" ? "coin" : c.tone})` } as CSSProperties}>
      <span className="cover-spine" />
      <span className="cover-label">
        <span className="cl-brand">
          <LogoMark size={12} decorative />
          parikshaa
        </span>
        <b>{t(...c.name)}</b>
        <span className="cl-lines">
          <i />
          <i />
        </span>
      </span>
      <span className="cover-sub mono">{c.sub}</span>
    </div>
  );
}

export function CoursesBody() {
  const t = useT();
  const [goal, setGoal] = useState("product");
  const [subj, setSubj] = useState("all");
  const subjects = ["all", "DSA", "CS core", "Languages", "Aptitude", "Design", "Build"];
  const list = COURSES.filter((c) => subj === "all" || c.sub === subj);
  return (
    <div className="col g24">
      <PageHead
        eyebrow={t("Courses", "Courses", "कोर्स")}
        title={t("Learn anything you'll be asked.", "Jo bhi poocha jaayega, seekho.", "जो भी पूछा जाएगा, सीखो।")}
        sub={t("Short lessons you can run, with a quiz at the end of each. Written by our team, checked by an expert.", "Chhote lessons jo chala sako, har ek ke baad quiz. Hamari team ne likhe, expert ne jaanche.", "छोटे पाठ, हर एक के बाद क्विज़।")}
        actions={
          <div className="input-ic" style={{ width: 300 }}>
            <Search />
            <input className="input" placeholder={t("Search courses and lessons", "Courses aur lessons khojo", "कोर्स खोजें")} />
          </div>
        }
      />
      <section className="path-card">
        <div className="col g8" style={{ minWidth: 0 }}>
          <span className="eyebrow">{t("Your path", "Aapka raasta", "आपका रास्ता")}</span>
          <h2 className="display" style={{ fontSize: 28 }}>
            {t("Product company SDE", "Product company SDE", "प्रोडक्ट कंपनी SDE")}
          </h2>
          <Seg
            value={goal}
            onChange={setGoal}
            items={[
              { id: "product", label: t("Product SDE", "Product SDE", "प्रोडक्ट SDE") },
              { id: "service", label: t("Service", "Service", "सर्विस") },
              { id: "front", label: t("Frontend", "Frontend", "फ़्रंटएंड") },
              { id: "data", label: t("Data analyst", "Data analyst", "डेटा") },
            ]}
          />
        </div>
        <ol className="path-steps">
          {["dsa", "oop", "os", "dbms", "cn", "sd"].map((id, i) => {
            const c = COURSES.find((x) => x.id === id)!;
            return (
              <li key={id} className={c.p > 40 ? "done" : c.p > 0 ? "now" : ""}>
                <span className="ps-n">{c.p > 60 ? <Check /> : i + 1}</span>
                <Link to="course" className="ellipsis">
                  {t(...c.name)}
                </Link>
                <span className="tiny faint num">{c.p}%</span>
              </li>
            );
          })}
        </ol>
      </section>
      <div className="row wrap g6">
        {subjects.map((s) => (
          <button key={s} className="chip" aria-pressed={subj === s} onClick={() => setSubj(s)}>
            {s === "all" ? t("All", "Sab", "सभी") : s}
          </button>
        ))}
      </div>
      <div className="course-grid">
        {list.map((c) => (
          <Link key={c.id} to="course" className="course-card">
            <Cover c={c} />
            <div className="cc-b">
              <b className="h3">{t(...c.name)}</b>
              <span className="tiny faint">
                {c.lessons} {t("lessons", "lessons", "पाठ")} · {c.hours}h · <Level n={c.lvl} short />
              </span>
              {c.p > 0 ? (
                <div className="row g8 mt4">
                  <div className="grow">
                    <Meter v={c.p} tone={c.tone === "ink" ? "pen" : c.tone === "marker" ? "coin" : c.tone} size="thin" />
                  </div>
                  <span className="tiny num faint">{c.p}%</span>
                </div>
              ) : (
                <span className="tiny t-pen mt4">{t("Start →", "Shuru karo →", "शुरू करें →")}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------------- roadmap ---------------- */

type Node = { id: string; t: string; s: "done" | "now" | "todo"; side?: string[]; opt?: boolean };
const NODES: Node[] = [
  { id: "n1", t: "Programming basics", s: "done", side: ["C++ or Java", "Complexity"] },
  { id: "n2", t: "Arrays & strings", s: "done", side: ["Two pointers", "Sliding window", "Prefix sums"] },
  { id: "n3", t: "Linked lists, stacks, queues", s: "now", side: ["Monotonic stack", "Deque"] },
  { id: "n4", t: "Recursion & backtracking", s: "todo" },
  { id: "n5", t: "Trees & graphs", s: "todo", side: ["BFS / DFS", "Shortest paths", "Union find"] },
  { id: "n6", t: "Dynamic programming", s: "todo", side: ["1-D", "2-D", "On trees"] },
  { id: "n7", t: "CS core: OS, DBMS, CN", s: "todo", side: ["Deadlocks", "Indexing", "TCP vs UDP"] },
  { id: "n8", t: "System design basics", s: "todo", opt: true },
  { id: "n9", t: "Mocks & interviews", s: "todo" },
];

export function RoadmapBody() {
  const t = useT();
  const toast = useToast();
  const [role, setRole] = useState("sde");
  const [sel, setSel] = useState<Node | null>(null);
  return (
    <div className="col g20">
      <PageHead
        eyebrow={t("Roadmap", "Roadmap", "रोडमैप")}
        title={t("SDE at a product company", "Product company me SDE", "प्रोडक्ट कंपनी में SDE")}
        sub={t("Nine stops from your first loop to your first interview. Tap a stop to see what's inside.", "Pehle loop se pehle interview tak nau padaav. Kisi padaav par tap karo.", "नौ पड़ाव।")}
        actions={
          <button className="btn">
            <Plus />
            {t("Make my own", "Apna banao", "अपना बनाएँ")}
          </button>
        }
      />
      <div className="row wrap between g12">
        <Seg
          value={role}
          onChange={setRole}
          items={[
            { id: "sde", label: "Product SDE" },
            { id: "svc", label: t("Service SDE", "Service SDE", "सर्विस SDE") },
            { id: "fe", label: "Frontend" },
            { id: "be", label: "Backend" },
            { id: "da", label: t("Data analyst", "Data analyst", "डेटा") },
          ]}
        />
        <div className="legend">
          <span>
            <i style={{ background: "var(--tick)" }} />
            {t("Done", "Ho gaya", "पूरा")}
          </span>
          <span>
            <i style={{ background: "var(--pen)" }} />
            {t("You are here", "Aap yahan", "आप यहाँ")}
          </span>
          <span>
            <i style={{ background: "var(--line-2)" }} />
            {t("Next", "Aage", "आगे")}
          </span>
          <span>
            <i style={{ border: "1.5px dashed var(--ink-3)" }} />
            {t("Optional", "Optional", "वैकल्पिक")}
          </span>
        </div>
      </div>
      <div className="road paper-grid">
        {NODES.map((n, i) => (
          <div key={n.id} className={`rd-row ${i % 2 ? "flip" : ""}`}>
            <div className="rd-side">
              {n.side?.map((x) => (
                <button key={x} className={`rd-chip ${n.s}`} onClick={() => setSel(n)}>
                  {n.s === "done" && <Check />}
                  {x}
                </button>
              ))}
            </div>
            <div className="rd-spine">
              <span className={`rd-dot ${n.s}`}>{n.s === "done" ? <Check /> : i + 1}</span>
            </div>
            <button className={`rd-node ${n.s} ${n.opt ? "opt" : ""}`} onClick={() => setSel(n)}>
              <b>{n.t}</b>
              <span className="tiny faint">
                {n.s === "done" ? t("Done", "Ho gaya", "पूरा") : n.s === "now" ? t("68% · you are here", "68% · aap yahan", "68% · आप यहाँ") : n.opt ? t("Optional", "Optional", "वैकल्पिक") : t("12 lessons · 30 problems", "12 lessons · 30 problems", "12 पाठ · 30 प्रश्न")}
              </span>
              {n.s === "now" && <Meter v={68} size="thin" />}
            </button>
          </div>
        ))}
      </div>
      <Drawer
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel?.t ?? ""}
        footer={
          <>
            <button
              className="btn"
              onClick={() => {
                setSel(null);
                toast(t("Marked as known after a 5-question check", "5 sawaal ke check ke baad 'aata hai' mark", "जाँच के बाद चिह्नित"));
              }}
            >
              <Check />
              {t("I know this", "Ye aata hai", "यह आता है")}
            </button>
            <Link to="course" className="btn pri grow">
              {t("Start learning", "Seekhna shuru", "सीखना शुरू")}
              <ArrowRight />
            </Link>
          </>
        }
      >
        {sel && (
          <div className="col g16">
            <p className="muted">{t("Why it matters: interviewers ask these patterns in round one at most product companies (based on verified experiences).", "Kyun zaroori: zyada tar product companies round one me ye patterns poochhti hain (verified experiences se).", "क्यों ज़रूरी।")}</p>
            <div className="row g12">
              <Ring v={sel.s === "done" ? 100 : sel.s === "now" ? 68 : 0} size={64} stroke={6} tone={sel.s === "done" ? "tick" : "pen"}>
                <b className="small num">{sel.s === "done" ? 100 : sel.s === "now" ? 68 : 0}%</b>
              </Ring>
              <div className="col g4">
                <span className="small">12 {t("lessons", "lessons", "पाठ")} · 30 {t("problems", "problems", "प्रश्न")} · 2 {t("quizzes", "quiz", "क्विज़")}</span>
                <span className="tiny faint">≈ 9 {t("hours", "ghante", "घंटे")}</span>
              </div>
            </div>
            <div className="col g6">
              <span className="eyebrow">{t("Inside", "Andar", "अंदर")}</span>
              {[
                [<BookOpen key="a" />, "Stack: the LIFO idea", "done"],
                [<BookOpen key="b" />, "Queue and deque", "todo"],
                [<ListChecks key="c" />, "Valid brackets · problem", "todo"],
                [<ListChecks key="d" />, "Next greater element · problem", "todo"],
                [<FlaskConical key="e" />, "Quiz: stacks in 10 questions", "todo"],
              ].map(([ic, n, s], i) => (
                <div key={i} className="li" style={{ padding: "8px 0" }}>
                  <span className="ic-box">{ic}</span>
                  <span className="grow small">{n as string}</span>
                  {s === "done" ? <CircleCheck style={{ color: "var(--tick)", width: 18, height: 18 }} /> : <Circle style={{ color: "var(--line-2)", width: 18, height: 18 }} />}
                </div>
              ))}
            </div>
            <div className="banner">
              <Route />
              <span className="small">{t("Outside links open only from approved sites. Everything else is on Parikshaa.", "Bahar ke link sirf manzoor sites se. Baaki sab Parikshaa par.", "बाहरी लिंक केवल मंज़ूर साइटों से।")}</span>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

/* ---------------- course ---------------- */

const CHAPTERS: { n: string; lessons: [string, "read" | "video" | "quiz" | "lab", string, "done" | "now" | "todo"][] }[] = [
  { n: "1 · What an OS does", lessons: [["Kernel and user mode", "read", "6 min", "done"], ["System calls", "read", "8 min", "done"], ["Quiz: basics", "quiz", "5 min", "done"]] },
  { n: "2 · Processes and threads", lessons: [["Process vs thread", "read", "7 min", "done"], ["Context switch", "video", "9 min", "done"], ["Lab: fork() in C", "lab", "20 min", "done"]] },
  {
    n: "3 · Synchronisation and deadlocks",
    lessons: [
      ["Race conditions", "read", "7 min", "done"],
      ["Mutex and semaphore", "read", "9 min", "done"],
      ["Classic problems", "video", "12 min", "done"],
      ["Deadlocks: the four conditions", "read", "8 min", "now"],
      ["Banker's algorithm", "read", "10 min", "todo"],
      ["Quiz: deadlocks", "quiz", "6 min", "todo"],
    ],
  },
  { n: "4 · CPU scheduling", lessons: [] },
  { n: "5 · Memory and paging", lessons: [] },
  { n: "6 · File systems", lessons: [] },
];
const KI: Record<string, ReactNode> = { read: <BookOpen />, video: <PlayCircle />, quiz: <ListChecks />, lab: <FlaskConical /> };

export function CourseBody() {
  const t = useT();
  const [open, setOpen] = useState<Record<number, boolean>>({ 2: true });
  const c = COURSES[1];
  return (
    <div className="col g24">
      <section className="course-hero">
        <Cover c={c} size="lg" />
        <div className="col g12" style={{ minWidth: 0 }}>
          <span className="eyebrow">{t("Course · CS core", "Course · CS core", "कोर्स · CS कोर")}</span>
          <h1 className="h1" style={{ fontSize: 36 }}>
            {t(...c.name)}
          </h1>
          <p className="muted" style={{ maxWidth: "58ch" }}>
            {t(
              "Processes, threads, deadlocks, scheduling and memory, explained with pictures you can step through and labs you run in the browser.",
              "Processes, threads, deadlocks, scheduling aur memory: aise chitron ke saath jo kadam-dar-kadam chalein, aur browser me chalne wale labs.",
              "प्रोसेस, थ्रेड, डेडलॉक, शेड्यूलिंग, मेमोरी।",
            )}
          </p>
          <div className="row wrap g16 small">
            <span className="row g6">
              <Layers className="faint" style={{ width: 16, height: 16 }} />9 {t("chapters", "chapters", "अध्याय")}
            </span>
            <span className="row g6">
              <BookOpen className="faint" style={{ width: 16, height: 16 }} />48 {t("lessons", "lessons", "पाठ")}
            </span>
            <span className="row g6">
              <Clock className="faint" style={{ width: 16, height: 16 }} />11 h
            </span>
            <span className="row g6">
              <BadgeCheck className="faint" style={{ width: 16, height: 16 }} />
              {t("Ends with a Pramaan test", "Ant me Pramaan test", "अंत में प्रमाण टेस्ट")}
            </span>
          </div>
          <div className="row wrap g10 mt8">
            <Link to="lesson" className="btn pri lg">
              <PlayCircle />
              {t("Resume: Deadlocks", "Jaari: Deadlocks", "जारी: डेडलॉक")}
            </Link>
            <span className="row g8 small muted">
              <Ring v={22} size={36} stroke={4} />
              {t("10 of 48 done", "48 me se 10", "48 में से 10")}
            </span>
          </div>
        </div>
      </section>
      <section className="col g8">
        {CHAPTERS.map((ch, i) => (
          <div key={ch.n} className={`acc ${open[i] ? "open" : ""}`}>
            <button className="acc-h" onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}>
              {open[i] ? <ChevronDown /> : <ChevronRight />}
              <b className="grow">{ch.n}</b>
              {ch.lessons.length > 0 && ch.lessons.every((l) => l[3] === "done") && <Badge tone="tick">{t("Done", "Poora", "पूरा")}</Badge>}
              <span className="tiny faint">{ch.lessons.length || 5} {t("lessons", "lessons", "पाठ")}</span>
            </button>
            {open[i] && (
              <div className="acc-group">
                {ch.lessons.map(([n, k, d, s]) => (
                  <Link key={n} to="lesson" className={`lesson-row ${s}`}>
                    {s === "done" ? <CircleCheck className="st done" /> : s === "now" ? <CircleDot className="st now" /> : <Circle className="st" />}
                    <span className={`lr-k k-${k}`}>{KI[k]}</span>
                    <span className="grow">{n}</span>
                    {s === "now" && <Badge tone="pen">{t("Continue", "Jaari", "जारी")}</Badge>}
                    <span className="tiny faint num">{d}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

export function CourseRail() {
  const t = useT();
  return (
    <>
      <section className="card pad col g10">
        <span className="h3">{t("You'll be able to", "Aap kar paoge", "आप कर पाएँगे")}</span>
        {[
          t("Explain a context switch in an interview", "Interview me context switch samjhana", "कॉन्टेक्स्ट स्विच समझाना"),
          t("Spot the four deadlock conditions", "Deadlock ki chaar shartein pehchaanna", "चार शर्तें पहचानना"),
          t("Solve scheduling numericals fast", "Scheduling numericals tez solve", "शेड्यूलिंग प्रश्न"),
        ].map((x) => (
          <div key={x} className="row top g8 small">
            <Check style={{ width: 16, height: 16, color: "var(--tick)", marginTop: 2 }} />
            {x}
          </div>
        ))}
      </section>
      <section className="card pad col g10">
        <span className="h3 row g8">
          <BadgeCheck style={{ width: 17, height: 17, color: "var(--red-text)" }} />
          Pramaan · OS L1
        </span>
        <p className="small muted">{t("A 40-minute proctored test at the end. Pass and the certificate goes on your profile.", "Ant me 40 minute ka proctored test. Pass karo to certificate profile par.", "40 मिनट का टेस्ट।")}</p>
        <span className="row g6 tiny faint">
          <Lock style={{ width: 13, height: 13 }} />
          {t("Opens at 80% of the course", "Course ke 80% par khulega", "80% पर खुलेगा")}
        </span>
      </section>
      <section className="card pad col g8">
        <span className="h3">{t("Written by", "Likha", "लेखक")}</span>
        <p className="small muted">{t("Parikshaa content team · reviewed by an expert reviewer · last updated 12 Oct 2026", "Parikshaa content team · expert reviewer ne jaancha · 12 Oct 2026", "परीक्षा टीम")}</p>
      </section>
    </>
  );
}

/* ---------------- lesson ---------------- */

export function LessonBody() {
  const t = useT();
  const ai = useAi();
  const [ans, setAns] = useState<number | null>(null);
  const [lang, setLang] = useState("hg");
  const [saved, setSaved] = useState(false);
  return (
    <div className="col g16">
      <div className="lesson-top">
        <Link to="course" className="btn sm ghost">
          <ArrowLeft />
          {t("Operating systems", "Operating systems", "ऑपरेटिंग सिस्टम")}
        </Link>
        <span className="tiny faint">{t("Chapter 3 · lesson 4 of 6", "Chapter 3 · lesson 4/6", "अध्याय 3 · पाठ 4/6")}</span>
        <span className="grow" />
        <Seg
          value={lang}
          onChange={setLang}
          items={[
            { id: "en", label: "EN" },
            { id: "hg", label: "HG", icon: <Languages /> },
            { id: "hi", label: "हि" },
          ]}
        />
        <button className={`icon-btn ${saved ? "starred" : ""}`} onClick={() => setSaved(!saved)} aria-pressed={saved} aria-label={t("Save", "Save", "सहेजें")} data-tip={t("Save", "Save", "सहेजें")}>
          <Bookmark />
        </button>
      </div>
      <div className="read-prog">
        <i style={{ width: "46%" }} />
      </div>
      <article className="lesson margin-page">
        <span className="eyebrow">{t("8 min read", "8 min padhai", "8 मिनट")}</span>
        <h1 className="display lesson-h">{t("Deadlocks: the four conditions", "Deadlocks: chaar shartein", "डेडलॉक: चार शर्तें")}</h1>
        <p className="prose lead">
          {t(
            "A deadlock is when every process in a group waits for something only another process in the same group can release. Nobody moves, forever.",
            "Deadlock tab hota hai jab group ka har process kisi aisi cheez ka intezaar kare jo sirf usi group ka doosra process chhod sakta hai. Koi nahi hilta, kabhi nahi.",
            "डेडलॉक तब होता है जब समूह की हर प्रक्रिया किसी और का इंतज़ार करती है।",
          )}
        </p>
        <aside className="margin-note" style={{ top: 120, left: -4 }}>
          <PenNote>{t("asked a lot!", "bahut poocha jaata!", "बहुत पूछा जाता!")}</PenNote>
        </aside>

        <figure className="rag">
          <svg viewBox="0 0 420 200" width="100%" style={{ maxWidth: 420 }} aria-label="Resource allocation graph with a cycle">
            <defs>
              <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="var(--ink)" />
              </marker>
              <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="var(--red)" />
              </marker>
            </defs>
            <circle cx="80" cy="60" r="28" fill="var(--pen-soft)" stroke="var(--pen)" strokeWidth="2" />
            <text x="80" y="66" textAnchor="middle" className="dry-hand" fontSize="18" fontWeight="700">
              P1
            </text>
            <circle cx="340" cy="140" r="28" fill="var(--pen-soft)" stroke="var(--pen)" strokeWidth="2" />
            <text x="340" y="146" textAnchor="middle" className="dry-hand" fontSize="18" fontWeight="700">
              P2
            </text>
            <rect x="310" y="32" width="56" height="56" rx="6" fill="var(--coin-soft)" stroke="var(--coin)" strokeWidth="2" />
            <text x="338" y="66" textAnchor="middle" className="dry-hand" fontSize="18" fontWeight="700">
              R1
            </text>
            <rect x="52" y="112" width="56" height="56" rx="6" fill="var(--coin-soft)" stroke="var(--coin)" strokeWidth="2" />
            <text x="80" y="146" textAnchor="middle" className="dry-hand" fontSize="18" fontWeight="700">
              R2
            </text>
            <path d="M310 60 L112 60" stroke="var(--ink)" strokeWidth="2" markerEnd="url(#ar)" />
            <text x="210" y="50" textAnchor="middle" className="dry-idx">
              R1 held by P1
            </text>
            <path d="M108 60 C 200 60, 280 100, 312 132" stroke="var(--red)" strokeWidth="2" strokeDasharray="5 4" markerEnd="url(#arr)" fill="none" />
            <path d="M312 148 L112 148" stroke="var(--ink)" strokeWidth="2" markerEnd="url(#ar)" fill="none" />
            <text x="210" y="168" textAnchor="middle" className="dry-idx">
              R2 held by P2
            </text>
            <path d="M80 112 L80 92" stroke="var(--red)" strokeWidth="2" strokeDasharray="5 4" markerEnd="url(#arr)" />
          </svg>
          <figcaption className="small muted">
            {t("Solid: holds. Dashed red: waits for. The red loop is the deadlock.", "Solid: pakda hua. Laal dashed: intezaar. Laal ghera hi deadlock hai.", "लाल घेरा ही डेडलॉक है।")}
          </figcaption>
        </figure>

        <h2 className="h2 mt8">{t("All four must hold at once", "Chaaron ek saath hon tabhi", "चारों एक साथ")}</h2>
        <ol className="conds">
          {[
            [t("Mutual exclusion", "Mutual exclusion", "पारस्परिक बहिष्करण"), t("A resource can be held by one process at a time.", "Ek resource ek samay me ek hi process ke paas.", "एक समय में एक।")],
            [t("Hold and wait", "Hold and wait", "पकड़ो और रुको"), t("A process holds one resource while waiting for another.", "Ek pakad kar doosre ka intezaar.", "एक पकड़कर दूसरे का इंतज़ार।")],
            [t("No preemption", "No preemption", "छीनना नहीं"), t("Nobody can take a resource away; it must be released.", "Koi chheen nahi sakta; khud chhodna hoga.", "कोई छीन नहीं सकता।")],
            [t("Circular wait", "Circular wait", "चक्रीय प्रतीक्षा"), t("P1 waits for P2, which waits for P1: a loop.", "P1, P2 ka; P2, P1 ka intezaar: ek ghera.", "एक घेरा।")],
          ].map(([h, p], i) => (
            <li key={i}>
              <span className="cond-n">{i + 1}</span>
              <div>
                <b>{h}</b>
                <p className="small muted">{p}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="cheat">
          <span className="eyebrow">{t("Cheat sheet", "Cheat sheet", "सार")}</span>
          <p>
            <Hl long>{t("Break any one condition and the deadlock cannot happen.", "Koi ek shart todo, deadlock ho hi nahi sakta.", "कोई एक शर्त तोड़ें।")}</Hl>{" "}
            {t("Ordering locks the same way everywhere breaks circular wait; it's the fix interviewers expect.", "Har jagah locks ek hi kram me lena circular wait todta hai; interviewer yahi fix chahte hain.", "लॉक का एक क्रम।")}
          </p>
        </div>

        <div className="try">
          <div className="row between">
            <span className="eyebrow">{t("Quick check", "Jhat-pat check", "त्वरित जाँच")}</span>
            <span className="tiny faint">1 / 3</span>
          </div>
          <b>{t("Two threads always lock A then B. Can they deadlock on A and B?", "Do threads hamesha pehle A phir B lock karte hain. Kya A aur B par deadlock ho sakta hai?", "क्या डेडलॉक हो सकता है?")}</b>
          <div className="col g6">
            {[t("Yes, always", "Haan, hamesha", "हाँ"), t("No: same order means no circular wait", "Nahi: ek hi kram, circular wait nahi", "नहीं: एक क्रम"), t("Only on one CPU", "Sirf ek CPU par", "केवल एक CPU पर")].map((o, i) => (
              <button key={i} className={`option ${ans === i ? (i === 1 ? "right" : "wrong") : ans !== null && i === 1 ? "right" : ""}`} onClick={() => setAns(i)} aria-pressed={ans === i}>
                <span className="radio" aria-hidden="true" data-on={ans === i} />
                <span className="grow">{o}</span>
                {ans !== null && i === 1 && <Tick size={18} />}
                {ans === i && i !== 1 && <X className="t-red" />}
              </button>
            ))}
          </div>
        </div>

        <div className="lesson-foot">
          <button className="btn ai" onClick={() => ai.setOpen(true)}>
            <Sparkles />
            {t("Ask Sahayak about this lesson", "Is lesson par Sahayak se poochho", "इस पाठ पर पूछें")}
          </button>
          <span className="grow" />
          <Link to="course" className="btn pri">
            {t("Next: Banker's algorithm", "Agla: Banker's algorithm", "अगला: बैंकर एल्गोरिदम")}
            <ArrowRight />
          </Link>
        </div>
      </article>
    </div>
  );
}

export function LessonRail() {
  const t = useT();
  return (
    <>
      <section className="card pad col g6 toc">
        <span className="eyebrow">{t("Chapter 3", "Chapter 3", "अध्याय 3")}</span>
        {CHAPTERS[2].lessons.map(([n, k, , s], i) => (
          <Link key={n} to="lesson" className={s === "now" ? "on" : ""}>
            <span className="num">{s === "done" ? <Check style={{ width: 11, height: 11 }} /> : i + 1}</span>
            <span className={s === "done" ? "faint" : ""}>{n}</span>
            {k === "quiz" && <ListChecks className="faint" style={{ width: 13, height: 13, marginLeft: "auto" }} />}
          </Link>
        ))}
      </section>
      <section className="card pad col g8">
        <span className="h3 row g8">
          <Lightbulb style={{ width: 16, height: 16, color: "var(--marker-ink)" }} />
          {t("Interview angle", "Interview angle", "इंटरव्यू")}
        </span>
        <p className="small muted">{t("Usually asked as: 'How would you prevent a deadlock in your code?' Answer with lock ordering.", "Aise poocha jaata: 'Apne code me deadlock kaise rokoge?' Jawab: lock ordering.", "लॉक ऑर्डरिंग से जवाब दें।")}</p>
      </section>
      <section className="card pad row g10">
        <Target style={{ width: 18, height: 18, color: "var(--pen-text)" }} />
        <span className="small grow">{t("3 problems use this idea", "3 problems me ye idea", "3 प्रश्न")}</span>
        <Link to="sheet" className="btn sm">
          {t("Practise", "Practice", "अभ्यास")}
        </Link>
      </section>
    </>
  );
}
