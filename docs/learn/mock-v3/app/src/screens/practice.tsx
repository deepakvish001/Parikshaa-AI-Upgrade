import { useState } from "react";
import {
  CodeXml,
  Database,
  Brain,
  Cpu,
  Swords,
  ArrowRight,
  Search,
  ChevronDown,
  ChevronRight,
  Star,
  FileText,
  Sparkles,
  CircleCheck,
  Circle,
  CircleDot,
  Filter,
  Shuffle,
  ListChecks,
  Building2,
  RotateCcw,
  Trophy,
  CalendarCheck,
  Play,
} from "lucide-react";
import { Link, useT, useCountdown, hms } from "../lib/core";
import { Badge, Level, Ring, Meter, Spark, Card, PageHead, Tabs, Check } from "../ui/kit";

/* ---------------- practice hub ---------------- */

const TRACKS = [
  { id: "dsa", icon: <CodeXml />, name: ["DSA", "DSA", "DSA"], done: 212, total: 455, tone: "pen", to: "sheet", sub: ["Arrays to DP, with a judge", "Arrays se DP tak, judge ke saath", "ऐरे से DP तक"] },
  { id: "sql", icon: <Database />, name: ["SQL", "SQL", "SQL"], done: 38, total: 120, tone: "teal", to: "sql", sub: ["Joins, windows, real schemas", "Joins, windows, asli schema", "जॉइन, विंडो"] },
  { id: "apt", icon: <Brain />, name: ["Aptitude", "Aptitude", "एप्टीट्यूड"], done: 140, total: 600, tone: "coin", to: "aptitude", sub: ["Quant, logical, verbal", "Quant, logical, verbal", "मात्रात्मक, तार्किक"] },
  { id: "core", icon: <Cpu />, name: ["CS core", "CS core", "CS कोर"], done: 64, total: 300, tone: "ai", to: "courses", sub: ["OS, DBMS, networks, OOP quizzes", "OS, DBMS, networks, OOP quiz", "OS, DBMS"] },
  { id: "cp", icon: <Swords />, name: ["Competitive", "Competitive", "प्रतिस्पर्धी"], done: 9, total: 2000, tone: "red", to: "contests", sub: ["Rated problems, 800 to 2400", "Rated problems, 800–2400", "रेटेड प्रश्न"] },
] as const;

const PATTERNS = [
  ["Two pointers", 14, 18],
  ["Sliding window", 6, 14],
  ["Binary search", 11, 20],
  ["Prefix sums", 9, 10],
  ["Stack", 7, 16],
  ["Hashing", 15, 22],
  ["Recursion", 8, 15],
  ["Graphs (BFS/DFS)", 4, 24],
  ["Dynamic programming", 5, 40],
  ["Greedy", 6, 18],
] as const;

export function PracticeBody() {
  const t = useT();
  const [left] = useCountdown(3 * 3600 + 57 * 60 + 38);
  return (
    <div className="col g20">
      <PageHead
        eyebrow={t("Practice", "Abhyas", "अभ्यास")}
        title={t("Every kind of practice, one place.", "Har tarah ki practice, ek jagah.", "हर तरह का अभ्यास, एक जगह।")}
        actions={
          <>
            <button className="btn">
              <Shuffle />
              {t("Random problem", "Random problem", "कोई भी प्रश्न")}
            </button>
            <Link to="problem" className="btn pri">
              <Play />
              {t("Continue", "Jaari rakho", "जारी रखें")}
            </Link>
          </>
        }
      />
      <div className="tracks">
        {TRACKS.map((tr) => (
          <Link key={tr.id} to={tr.to} className="track card hov">
            <span className={`tr-ic ${tr.tone}`}>{tr.icon}</span>
            <b className="h3">{t(tr.name[0], tr.name[1], tr.name[2])}</b>
            <span className="tiny faint">{t(tr.sub[0], tr.sub[1], tr.sub[2])}</span>
            <div className="row between mt8">
              <span className="num small">
                <b>{tr.done}</b>
                <span className="faint"> / {tr.total}</span>
              </span>
              <span className="tiny faint num">{Math.round((tr.done / tr.total) * 100)}%</span>
            </div>
            <Meter v={(tr.done / tr.total) * 100} tone={tr.tone} />
          </Link>
        ))}
      </div>

      <div className="grid c3">
        <section className="card pad col g10 potd-card">
          <div className="row between">
            <span className="row g8 h3">
              <CalendarCheck style={{ width: 17, height: 17, color: "var(--coin)" }} />
              {t("Problem of the day", "Aaj ka problem", "आज का प्रश्न")}
            </span>
            <Badge tone="coin">+20</Badge>
          </div>
          <b className="display" style={{ fontSize: 24 }}>
            Bus stop queue
          </b>
          <div className="row g8">
            <Level n={3} />
            <Badge>Queue</Badge>
          </div>
          <div className="row between mt8">
            <span className="mono num potd-clock">{hms(left)}</span>
            <Link to="potd" className="btn pri sm">
              {t("Solve", "Solve karo", "हल करें")}
            </Link>
          </div>
        </section>
        <section className="card pad col g10">
          <div className="row between">
            <span className="row g8 h3">
              <Trophy style={{ width: 17, height: 17, color: "var(--ai-text)" }} />
              {t("Next contest", "Agla contest", "अगली प्रतियोगिता")}
            </span>
            <Badge tone="ai">{t("Rated", "Rated", "रेटेड")}</Badge>
          </div>
          <b className="display" style={{ fontSize: 24 }}>
            Weekly Round 13
          </b>
          <span className="small muted">{t("Sunday 8:00 pm · 90 min · 4 problems", "Ravivaar 8 baje · 90 min · 4 problems", "रविवार 8 बजे")}</span>
          <div className="row between mt8">
            <span className="small">
              {t("Your rating", "Aapki rating", "आपकी रेटिंग")} <b className="num">1,486</b>
            </span>
            <Link to="contest-brief" className="btn sm">
              {t("Register", "Register", "पंजीकरण")}
            </Link>
          </div>
        </section>
        <section className="card pad col g10">
          <div className="row between">
            <span className="row g8 h3">
              <RotateCcw style={{ width: 17, height: 17, color: "var(--marker-ink)" }} />
              {t("Retry your misses", "Chhoote dobara", "छूटे दोबारा")}
            </span>
            <Badge tone="red">7</Badge>
          </div>
          <span className="small muted">{t("Problems you got wrong and haven't solved since.", "Jo galat hue aur tab se solve nahi kiye.", "जो गलत हुए।")}</span>
          {["Pair with target sum", "Valid brackets", "Longest substring"].map((p) => (
            <Link key={p} to="problem" className="row between small rail-link">
              <span>{p}</span>
              <ChevronRight className="faint" style={{ width: 14, height: 14 }} />
            </Link>
          ))}
        </section>
      </div>

      <Card
        title={t("By pattern", "Pattern se", "पैटर्न से")}
        icon={<ListChecks className="ic" />}
        actions={<span className="tiny faint">{t("The plan picks from your weakest", "Plan sabse kamzor se chunta hai", "सबसे कमज़ोर से")}</span>}
      >
        <div className="patterns">
          {PATTERNS.map(([n, d, tot]) => {
            const p = (d / tot) * 100;
            return (
              <Link to="sheet" key={n} className="pattern">
                <Ring v={p} size={38} stroke={4} tone={p > 70 ? "tick" : p > 35 ? "pen" : "red"} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <b className="small ellipsis" style={{ display: "block" }}>
                    {n}
                  </b>
                  <span className="tiny faint num">
                    {d} / {tot}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </Card>

      <div className="grid c2">
        <Card title={t("Sheets", "Sheets", "शीट")} icon={<FileText className="ic" />} pad={false}>
          <div className="list">
            {[
              ["Parikshaa DSA sheet", "455 · 18 steps", 47, "sheet"],
              ["Product company 150", "150 · by pattern", 31, "sheet"],
              ["Service company 120", "120 · aptitude + coding", 58, "sheet"],
              ["30 days of SQL", "30 · one a day", 40, "sql"],
            ].map(([n, m, p, to]) => (
              <Link key={n as string} to={to as string} className="li">
                <span className="ic-box">
                  <FileText />
                </span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <b className="small">{n as string}</b>
                  <span className="tiny faint" style={{ display: "block" }}>
                    {m as string}
                  </span>
                </span>
                <div style={{ width: 80 }}>
                  <Meter v={p as number} />
                </div>
                <span className="tiny num faint" style={{ width: 30, textAlign: "right" }}>
                  {p as number}%
                </span>
              </Link>
            ))}
          </div>
        </Card>
        <Card title={t("Last 30 days", "Pichhle 30 din", "पिछले 30 दिन")} icon={<Sparkles className="ic" />}>
          <div className="row between">
            <div className="stat">
              <span className="k">{t("Solved", "Solved", "हल")}</span>
              <span className="v">64</span>
              <span className="d up">+18 {t("vs last month", "pichhle mahine se", "पिछले महीने से")}</span>
            </div>
            <div className="stat">
              <span className="k">{t("First-try AC", "Pehli baar AC", "पहली बार AC")}</span>
              <span className="v">41%</span>
              <span className="d up">+6%</span>
            </div>
          </div>
          <div className="mt12">
            <Spark data={[1, 3, 2, 4, 3, 5, 2, 6, 4, 3, 5, 7, 4, 6, 5, 8, 3, 6, 7, 5, 9, 6, 7, 8, 6, 9, 7, 10, 8, 9]} w={460} h={70} />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- DSA sheet ---------------- */

type P = { n: string; lv: 1 | 2 | 3 | 4 | 5; s: "done" | "tried" | "todo"; star?: boolean; co?: number };
const STEPS: { n: string; total: number; done: number; open?: boolean; groups?: { g: string; items: P[] }[] }[] = [
  { n: "Step 1 · Basics: loops, maths, recursion", total: 32, done: 32 },
  { n: "Step 2 · Sorting", total: 14, done: 14 },
  {
    n: "Step 3 · Arrays",
    total: 40,
    done: 29,
    open: true,
    groups: [
      {
        g: "Easy",
        items: [
          { n: "Largest element", lv: 1, s: "done", co: 4 },
          { n: "Second largest without sorting", lv: 1, s: "done", co: 6 },
          { n: "Is the array sorted?", lv: 1, s: "done" },
          { n: "Remove duplicates in place", lv: 2, s: "done", star: true, co: 9 },
        ],
      },
      {
        g: "Medium",
        items: [
          { n: "Pair with target sum", lv: 2, s: "tried", star: true, co: 12 },
          { n: "Sort 0s, 1s and 2s", lv: 2, s: "done", co: 15 },
          { n: "Majority element", lv: 3, s: "todo", co: 8 },
          { n: "Maximum subarray sum", lv: 3, s: "todo", star: true, co: 21 },
          { n: "Rearrange by sign", lv: 3, s: "todo" },
        ],
      },
      {
        g: "Hard",
        items: [
          { n: "Count inversions", lv: 4, s: "todo", co: 7 },
          { n: "Maximum product subarray", lv: 4, s: "todo", co: 10 },
        ],
      },
    ],
  },
  { n: "Step 4 · Binary search", total: 32, done: 11 },
  { n: "Step 5 · Strings", total: 18, done: 6 },
  { n: "Step 6 · Linked lists", total: 31, done: 4 },
  { n: "Step 7 · Recursion and backtracking", total: 25, done: 0 },
  { n: "Step 8 · Stacks and queues", total: 30, done: 7 },
  { n: "Step 9 · Heaps", total: 17, done: 9 },
  { n: "Step 10 · Greedy", total: 16, done: 6 },
  { n: "Step 11 · Binary trees", total: 39, done: 22 },
  { n: "Step 12 · Binary search trees", total: 16, done: 8 },
  { n: "Step 13 · Graphs", total: 54, done: 18 },
  { n: "Step 14 · Dynamic programming", total: 56, done: 21 },
  { n: "Step 15 · Tries", total: 7, done: 3 },
  { n: "Step 16 · Bit manipulation", total: 18, done: 14 },
  { n: "Step 17 · Advanced strings", total: 6, done: 4 },
  { n: "Step 18 · Mixed interview set", total: 4, done: 4 },
];

export function SheetBody() {
  const t = useT();
  const [open, setOpen] = useState<Record<string, boolean>>(Object.fromEntries(STEPS.map((s) => [s.n, !!s.open])));
  const [f, setF] = useState("all");
  const [q, setQ] = useState("");
  const done = STEPS.reduce((a, s) => a + s.done, 0);
  return (
    <div className="col g16">
      <header className="sheet-head">
        <div className="grow">
          <div className="eyebrow">{t("Sheet", "Sheet", "शीट")}</div>
          <h1 className="h1">{t("Parikshaa DSA sheet", "Parikshaa DSA sheet", "परीक्षा DSA शीट")}</h1>
          <p className="muted page-sub">{t("455 problems in 18 steps, in the order the plan teaches them. Written by our team; every test checked by a runner.", "455 problems, 18 steps, plan ke kram me. Hamari team ne likhe; har test runner se jaancha.", "455 प्रश्न, 18 चरण।")}</p>
        </div>
        <Ring v={(done / 455) * 100} size={96} stroke={9}>
          <span>
            <b className="display num" style={{ fontSize: 24 }}>
              {done}
            </b>
            <span className="tiny faint" style={{ display: "block" }}>
              / 455
            </span>
          </span>
        </Ring>
      </header>
      <div className="lvl-strip">
        {[
          [1, 120, 88],
          [2, 160, 79],
          [3, 110, 39],
          [4, 50, 6],
          [5, 15, 0],
        ].map(([l, tot, d]) => (
          <div key={l} className="lvl-cell">
            <Level n={l as 1} />
            <span className="num small">
              <b>{d}</b>
              <span className="faint"> / {tot}</span>
            </span>
            <Meter v={((d as number) / (tot as number)) * 100} tone={`lv${l}`} size="thin" />
          </div>
        ))}
      </div>
      <div className="sheet-tools">
        <div className="input-ic grow" style={{ maxWidth: 360 }}>
          <Search />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search problems", "Problems khojo", "प्रश्न खोजें")} />
        </div>
        <Tabs
          value={f}
          onChange={setF}
          className="sheet-tabs"
          items={[
            { id: "all", label: t("All", "Sab", "सभी") },
            { id: "todo", label: t("To do", "Baaki", "बाकी"), count: 243 },
            { id: "rev", label: t("Revision", "Revision", "दोहराई"), count: 18 },
            { id: "star", label: <Star style={{ width: 14, height: 14 }} />, count: 26 },
          ]}
        />
        <button className="btn sm">
          <Filter />
          {t("Filters", "Filters", "फ़िल्टर")}
        </button>
      </div>
      <div className="steps-acc">
        {STEPS.map((s) => {
          const isOpen = open[s.n];
          const p = (s.done / s.total) * 100;
          return (
            <section key={s.n} className={`acc ${isOpen ? "open" : ""}`}>
              <button className="acc-h" onClick={() => setOpen((o) => ({ ...o, [s.n]: !o[s.n] }))} aria-expanded={isOpen}>
                {isOpen ? <ChevronDown /> : <ChevronRight />}
                <b className="grow">{s.n}</b>
                {p === 100 && <Badge tone="tick">{t("Done", "Poora", "पूरा")}</Badge>}
                <span className="num tiny faint">
                  {s.done} / {s.total}
                </span>
                <div style={{ width: 120 }} className="hide-phone">
                  <Meter v={p} tone={p === 100 ? "tick" : "pen"} />
                </div>
              </button>
              {isOpen &&
                s.groups?.map((g) => (
                  <div key={g.g} className="acc-group">
                    <div className="acc-g">{g.g}</div>
                    <table className="tbl sheet-tbl">
                      <tbody>
                        {g.items
                          .filter((x) => !q || x.n.toLowerCase().includes(q.toLowerCase()))
                          .map((x) => (
                            <tr key={x.n} className={x.s === "done" ? "is-done" : ""}>
                              <td style={{ width: 40 }}>
                                {x.s === "done" ? <CircleCheck className="st done" /> : x.s === "tried" ? <CircleDot className="st tried" /> : <Circle className="st" />}
                              </td>
                              <td>
                                <Link to="problem" className="p-link">
                                  {x.n}
                                </Link>
                                {x.s === "tried" && <span className="tiny t-red" style={{ marginLeft: 8 }}>{t("wrong on test 23", "test 23 par galat", "टेस्ट 23 पर गलत")}</span>}
                              </td>
                              <td className="hide-phone" style={{ width: 120 }}>
                                <Level n={x.lv} />
                              </td>
                              <td className="hide-phone" style={{ width: 90 }}>
                                {x.co ? (
                                  <span className="tiny faint row g4">
                                    <Building2 style={{ width: 13, height: 13 }} />
                                    {x.co}
                                  </span>
                                ) : null}
                              </td>
                              <td style={{ width: 140 }} className="r">
                                <span className="row g4" style={{ justifyContent: "flex-end" }}>
                                  <Link to="editorial" className="icon-btn sm" aria-label={t("Editorial", "Editorial", "हल")} data-tip={t("Editorial", "Editorial", "हल")}>
                                    <FileText />
                                  </Link>
                                  <Link to="problem" className="icon-btn sm" aria-label={t("Solve", "Solve", "हल")} data-tip={t("Solve", "Solve", "हल")}>
                                    <CodeXml />
                                  </Link>
                                  <button className={`icon-btn sm ${x.star ? "starred" : ""}`} aria-label={t("Revision", "Revision", "दोहराई")} data-tip={t("Revision", "Revision", "दोहराई")} aria-pressed={!!x.star}>
                                    <Star />
                                  </button>
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function SheetRail() {
  const t = useT();
  const [pick, setPick] = useState<Record<string, boolean>>({ a: true, b: false, c: false });
  return (
    <>
      <section className="card pad col g10 resume-mini">
        <span className="eyebrow">{t("Continue", "Jaari rakho", "जारी रखें")}</span>
        <b className="display" style={{ fontSize: 22 }}>
          Pair with target sum
        </b>
        <span className="tiny t-red">{t("Wrong on test 23 · 14 min ago", "Test 23 par galat · 14 min pehle", "टेस्ट 23 पर गलत")}</span>
        <Link to="problem" className="btn pri sm">
          <Play />
          {t("Resume", "Jaari rakho", "जारी रखें")}
        </Link>
      </section>
      <section className="card pad col g10">
        <span className="h3">{t("Your pace", "Aapki raftaar", "आपकी गति")}</span>
        <div className="row between small">
          <span className="muted">{t("This week", "Is hafte", "इस सप्ताह")}</span>
          <b className="num">14 {t("solved", "solved", "हल")}</b>
        </div>
        <Spark data={[2, 3, 1, 4, 2, 0, 2]} w={260} h={46} />
        <p className="tiny faint">{t("At this pace the sheet is done by 2 Dec.", "Is raftaar se sheet 2 Dec tak.", "इस गति से 2 दिसंबर तक।")}</p>
      </section>
      <section className="card pad col g8">
        <span className="h3">{t("Today's picks", "Aaj ke chune hue", "आज के चुने")}</span>
        {[
          ["a", "Pair with target sum"],
          ["b", "Majority element"],
          ["c", "Maximum subarray sum"],
        ].map(([k, n]) => (
          <div key={k} className="row g10 small">
            <Check on={pick[k]} onChange={(v) => setPick((p) => ({ ...p, [k]: v }))} round tick label={n} />
            <span className={pick[k] ? "faint" : ""} style={{ textDecoration: pick[k] ? "line-through" : undefined }}>
              {n}
            </span>
          </div>
        ))}
        <Link to="aaj" className="link small">
          {t("From today's plan", "Aaj ke plan se", "आज की योजना से")}
          <ArrowRight />
        </Link>
      </section>
    </>
  );
}
