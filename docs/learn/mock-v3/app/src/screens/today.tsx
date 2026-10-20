import { useState, type ReactElement } from "react";
import {
  Play,
  BookOpen,
  CodeXml,
  RotateCcw,
  Brain,
  Sparkles,
  CalendarRange,
  Flame,
  Snowflake,
  ArrowRight,
  Trophy,
  Feather,
  TriangleAlert,
  CircleX,
  Check,
  Clock,
  Target,
  CalendarClock,
  Settings2,
  ChevronLeft,
  ChevronRight,
  CalendarX2,
  SplitSquareHorizontal,
  CalendarPlus,
  MoveRight,
  BedDouble,
} from "lucide-react";
import { Link, navigate, useT, useCountdown, hms, useToast } from "../lib/core";
import { useAi } from "../lib/state";
import { Card, Badge, Level, Check as CheckBox, Ring, Meter, Diya, PenCircle, Hl, Modal, Tick, CountUp, Seg } from "../ui/kit";

type Task = { id: string; kind: "lesson" | "problem" | "revision" | "aptitude"; title: [string, string, string]; meta: string; level?: 1 | 2 | 3 | 4 | 5; min: number; done: boolean; to: string };

const TASKS: Task[] = [
  { id: "t1", kind: "lesson", title: ["Stack: the LIFO idea", "Stack: LIFO idea", "स्टैक: LIFO का विचार"], meta: "Lesson · 4 min read + 3 questions", min: 25, done: true, to: "lesson" },
  { id: "t2", kind: "problem", title: ["Pair with target sum", "Pair with target sum", "Pair with target sum"], meta: "Two pointers", level: 2, min: 30, done: false, to: "problem" },
  { id: "t3", kind: "problem", title: ["Valid brackets", "Valid brackets", "Valid brackets"], meta: "Stack", level: 2, min: 35, done: false, to: "problem" },
  { id: "t4", kind: "revision", title: ["6 revision cards", "6 revision cards", "6 दोहराई कार्ड"], meta: "3 mistakes, 3 concepts", min: 15, done: false, to: "revision" },
  { id: "t5", kind: "aptitude", title: ["Successive percentages", "Successive percentage", "क्रमिक प्रतिशत"], meta: "Aptitude set · 10 questions", level: 2, min: 25, done: false, to: "apt-set" },
];
const KIND: Record<Task["kind"], ReactElement> = {
  lesson: <BookOpen />,
  problem: <CodeXml />,
  revision: <RotateCcw />,
  aptitude: <Brain />,
};

function TaskList() {
  const t = useT();
  const [done, setDone] = useState<Record<string, boolean>>(Object.fromEntries(TASKS.map((x) => [x.id, x.done])));
  const n = Object.values(done).filter(Boolean).length;
  const mins = TASKS.filter((x) => done[x.id]).reduce((a, x) => a + x.min, 0);
  const [light, setLight] = useState(false);
  return (
    <section className="card">
      <div className="card-h">
        <span className="h3">{t("Today's work", "Aaj ka kaam", "आज का काम")}</span>
        <span className="tiny faint num">
          {n} / {TASKS.length} · {mins} / 130 {t("min", "min", "मिनट")}
        </span>
      </div>
      <div className="segs" style={{ padding: "12px 18px 4px" }}>
        {TASKS.map((x) => (
          <i key={x.id} className={done[x.id] ? "ok" : ""} />
        ))}
      </div>
      <ul className="tasks">
        {TASKS.map((x, i) => {
          const isDone = done[x.id];
          const next = !isDone && TASKS.slice(0, i).every((y) => done[y.id]);
          return (
            <li key={x.id} className={`task ${isDone ? "done" : ""} ${next ? "next" : ""}`}>
              <CheckBox round tick on={isDone} onChange={(v) => setDone((d) => ({ ...d, [x.id]: v }))} label="Done" />
              <span className={`task-ic k-${x.kind}`}>{KIND[x.kind]}</span>
              <span className="grow" style={{ minWidth: 0 }}>
                <b className="task-t ellipsis">{t(...x.title)}</b>
                <span className="tiny faint row g8">
                  {x.meta}
                  {x.level && <Level n={x.level} short />}
                </span>
              </span>
              <span className="tiny faint num hide-phone">{x.min} min</span>
              {isDone ? (
                <span className="task-done">
                  <Tick size={16} />
                </span>
              ) : (
                <Link to={x.to} className={`btn sm ${next ? "pri" : ""}`}>
                  <Play />
                  {next ? t("Start", "Shuru", "शुरू") : t("Open", "Kholo", "खोलें")}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <div className="card-f">
        <Feather className="faint" style={{ width: 15, height: 15 }} />
        <span className="small muted grow">{t("Heavy day? Make today lighter and the plan re-balances.", "Bhaari din? Aaj halka karo, plan khud sambhal lega.", "भारी दिन? आज हल्का करें।")}</span>
        <button className="btn sm ghost" onClick={() => setLight(true)}>
          {t("Make lighter", "Halka karo", "हल्का करें")}
        </button>
      </div>
      <LighterModal open={light} onClose={() => setLight(false)} />
    </section>
  );
}

function LighterModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const [pick, setPick] = useState("half");
  const opts = [
    { id: "half", h: t("Keep the two problems, move the rest", "Do problems rakho, baaki aage", "दो प्रश्न रखें"), p: t("65 min today · end date stays 10 Dec", "Aaj 65 min · end date 10 Dec hi", "आज 65 मिनट"), icon: <SplitSquareHorizontal /> },
    { id: "rev", h: t("Only revision today", "Aaj sirf revision", "आज केवल दोहराई"), p: t("15 min today · end date 11 Dec", "Aaj 15 min · end date 11 Dec", "आज 15 मिनट"), icon: <RotateCcw /> },
    { id: "off", h: t("Take the day off", "Aaj chhutti", "आज छुट्टी"), p: t("Streak protected with a freeze · end date 11 Dec", "Freeze se streak bachegi · end date 11 Dec", "फ़्रीज़ से लगातार बचेगी"), icon: <BedDouble /> },
  ];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("Make today lighter", "Aaj halka karo", "आज हल्का करें")}
      sub={t("Pick one. You see the new end date before anything changes.", "Ek chuno. Kuch badalne se pehle nayi end date dikhegi.", "एक चुनें।")}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            {t("Keep as is", "Jaisa hai", "जैसा है")}
          </button>
          <button
            className="btn pri"
            onClick={() => {
              onClose();
              toast(t("Plan updated. Tomorrow has 20 extra minutes.", "Plan badla. Kal 20 minute zyada.", "योजना बदली।"));
            }}
          >
            {t("Update plan", "Plan badlo", "योजना बदलें")}
          </button>
        </>
      }
    >
      <div className="col g8">
        {opts.map((o) => (
          <button key={o.id} className="option" aria-pressed={pick === o.id} onClick={() => setPick(o.id)}>
            <span className="opt-ic">{o.icon}</span>
            <span className="grow">
              <b style={{ fontWeight: 560 }}>{o.h}</b>
              <span className="tiny faint" style={{ display: "block" }}>
                {o.p}
              </span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function WeekStrip() {
  const t = useT();
  const days = [
    { d: t("Mon", "Som", "सोम"), n: 19, s: "done" },
    { d: t("Tue", "Mangal", "मंगल"), n: 20, s: "today" },
    { d: t("Wed", "Budh", "बुध"), n: 21, s: "" },
    { d: t("Thu", "Guru", "गुरु"), n: 22, s: "" },
    { d: t("Fri", "Shukra", "शुक्र"), n: 23, s: "" },
    { d: t("Sat", "Shani", "शनि"), n: 24, s: "test" },
    { d: t("Sun", "Ravi", "रवि"), n: 25, s: "rest" },
  ];
  return (
    <div className="week">
      {days.map((x) => (
        <div key={x.n} className={`wk ${x.s}`}>
          <span className="tiny faint">{x.d}</span>
          <b className="num">{x.n}</b>
          <span className="wk-dot">{x.s === "done" ? <Tick size={12} color="currentColor" /> : x.s === "test" ? "T" : x.s === "rest" ? "·" : ""}</span>
        </div>
      ))}
    </div>
  );
}

export function AajBody() {
  const t = useT();
  const ai = useAi();
  return (
    <div className="col g20">
      <header className="aaj-head">
        <div className="grow">
          <div className="eyebrow">{t("Tuesday, 20 October", "Mangalvaar, 20 October", "मंगलवार, 20 अक्टूबर")}</div>
          <h1 className="h1 aaj-h1">{t("Good evening, Aarav.", "Shubh sandhya, Aarav.", "शुभ संध्या, आरव।")}</h1>
          <div className="row wrap g6 mt12">
            <Badge icon={<Target />}>{t("Product company SDE", "Product company SDE", "प्रोडक्ट कंपनी SDE")}</Badge>
            <Badge icon={<CalendarRange />}>{t("Plan ends 10 Dec", "Plan 10 Dec tak", "योजना 10 दिसंबर तक")}</Badge>
            <Badge tone="tick" icon={<Check />}>
              {t("2 days ahead", "2 din aage", "2 दिन आगे")}
            </Badge>
          </div>
        </div>
        <div className="aaj-day">
          <Diya size={60} />
          <div>
            <b className="display num" style={{ fontSize: 30 }}>
              38
            </b>
            <span className="tiny faint"> / 90 {t("days", "din", "दिन")}</span>
          </div>
        </div>
      </header>

      <section className="resume">
        <div className="resume-l">
          <span className="eyebrow">{t("Pick up where you stopped", "Jahan chhoda, wahin se", "जहाँ छोड़ा, वहीं से")}</span>
          <h2 className="resume-t">Pair with target sum</h2>
          <div className="row wrap g8 small muted">
            <Badge tone="red" icon={<CircleX />}>
              {t("Wrong answer · test 23", "Galat · test 23", "गलत · टेस्ट 23")}
            </Badge>
            <span>{t("14 min ago · 23 of 24 tests pass", "14 min pehle · 24 me se 23 pass", "14 मिनट पहले")}</span>
          </div>
          <div className="resume-code mono">
            <span className="faint">4 </span>int sum = <PenCircle>a[L] + a[R]</PenCircle>;
          </div>
        </div>
        <div className="resume-r">
          <button className="btn pri lg" onClick={() => navigate("problem")}>
            <Play />
            {t("Resume", "Jaari rakho", "जारी रखें")}
          </button>
          <button className="btn ai" onClick={() => ai.setOpen(true)}>
            <Sparkles />
            {t("Ask why it fails", "Fail kyun? Poochho", "क्यों फेल? पूछें")}
          </button>
        </div>
      </section>

      <TaskList />

      <div className="grid c2">
        <Card
          title={t("Sprint 3 · Linked lists, stacks, queues", "Sprint 3 · Linked list, stack, queue", "स्प्रिंट 3")}
          icon={<CalendarRange className="ic" />}
          actions={
            <Link to="plan" className="link small">
              {t("Plan", "Plan", "योजना")}
              <ArrowRight />
            </Link>
          }
        >
          <WeekStrip />
          <div className="row between mt12 small">
            <span className="muted">{t("Day 6 of 7 · Saturday is a sprint test", "Din 6/7 · Shanivar sprint test", "दिन 6/7")}</span>
            <span className="num strong">68%</span>
          </div>
          <Meter v={68} />
        </Card>
        <Card
          title={t("Revision due", "Revision baaki", "दोहराई बाकी")}
          icon={<RotateCcw className="ic" />}
          actions={<Badge tone="red">6</Badge>}
        >
          <div className="rev-stack">
            <div className="rev-card r3" />
            <div className="rev-card r2" />
            <div className="rev-card r1">
              <span className="tiny faint">{t("From your mistake · 2 days ago", "Aapki galti se · 2 din pehle", "आपकी गलती से")}</span>
              <b className="small">{t("Why did 2³⁰ + 2³⁰ break your int?", "2³⁰ + 2³⁰ ne int kyun toda?", "2³⁰ + 2³⁰ ने int क्यों तोड़ा?")}</b>
            </div>
          </div>
          <Link to="revision" className="btn block mt12">
            {t("Revise 6 cards · 8 min", "6 cards dohrao · 8 min", "6 कार्ड · 8 मिनट")}
          </Link>
        </Card>
      </div>

      <div className="banner marker">
        <CalendarClock />
        <span className="grow">
          <b>{t("Semester exams 3–15 Nov.", "Semester exams 3–15 Nov.", "सेमेस्टर परीक्षा 3–15 नवंबर।")}</b>{" "}
          {t("Your plan drops to 45 minutes a day in those weeks, mostly revision. Nothing for you to do.", "Un hafton me plan roz 45 minute, zyada revision. Aapko kuch nahi karna.", "उन सप्ताहों में 45 मिनट रोज़।")}
        </span>
        <Link to="plan" className="link small">
          {t("Edit dates", "Dates badlo", "तारीख़ें बदलें")}
        </Link>
      </div>
    </div>
  );
}

export function AajRail() {
  const t = useT();
  const [left] = useCountdown(3 * 3600 + 57 * 60 + 38);
  return (
    <>
      <section className="card pad col g12">
        <div className="row between">
          <span className="h3">{t("Readiness", "Readiness", "तैयारी")}</span>
          <span className="tiny faint">Product SDE</span>
        </div>
        <div className="row g16">
          <Ring v={58} size={86} stroke={8}>
            <span>
              <b className="display num" style={{ fontSize: 30 }}>
                <CountUp to={58} />
              </b>
            </span>
          </Ring>
          <p className="small muted">{t("From 212 solved, 3 mocks and 1 contest. Up 6 this week.", "212 solved, 3 mocks, 1 contest se. Is hafte +6.", "212 हल, 3 मॉक से।")}</p>
        </div>
        <div className="col g10">
          <span className="eyebrow">{t("Weakest", "Sabse kamzor", "सबसे कमज़ोर")}</span>
          {[
            ["Dynamic programming", 22, "red"],
            ["Graphs", 31, "coin"],
            ["Sliding window", 44, "coin"],
          ].map(([n, v, c]) => (
            <div key={n as string} className="weak">
              <span className="small grow">{n}</span>
              <div style={{ width: 90 }}>
                <Meter v={v as number} tone={c as string} />
              </div>
              <span className="tiny num faint" style={{ width: 30, textAlign: "right" }}>
                {v}%
              </span>
            </div>
          ))}
        </div>
        <Link to="sheet" className="btn sm block">
          {t("Practise weak topics", "Kamzor topics practice", "कमज़ोर विषय")}
        </Link>
      </section>

      <section className="card pad col g10 potd-mini">
        <div className="row between">
          <span className="h3">{t("Problem of the day", "Aaj ka problem", "आज का प्रश्न")}</span>
          <Badge tone="coin">+20</Badge>
        </div>
        <b>Bus stop queue</b>
        <div className="row between">
          <span className="mono num potd-clock">{hms(left)}</span>
          <Link to="potd" className="btn sm pri">
            {t("Solve", "Solve karo", "हल करें")}
          </Link>
        </div>
      </section>

      <section className="card pad col g10">
        <div className="row g8">
          <Flame style={{ color: "var(--coin)", width: 18, height: 18 }} />
          <span className="h3 grow">{t("12-day streak", "12 din ki streak", "12 दिन लगातार")}</span>
          <span className="tiny faint row g4">
            <Snowflake style={{ width: 13, height: 13 }} />1
          </span>
        </div>
        <div className="flames">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className={`fl ${i === 0 ? "on" : i === 1 ? "now" : ""}`}>
              <Flame />
              <i>{d}</i>
            </span>
          ))}
        </div>
      </section>

      <section className="card pad row g12">
        <span className="task-ic k-contest">
          <Trophy />
        </span>
        <span className="grow">
          <b className="small">Weekly Round 13</b>
          <span className="tiny faint" style={{ display: "block" }}>
            {t("Sunday 8:00 pm · 90 min", "Ravivaar 8 baje · 90 min", "रविवार 8 बजे")}
          </span>
        </span>
        <Link to="contest-brief" className="btn sm">
          {t("Register", "Register", "पंजीकरण")}
        </Link>
      </section>
    </>
  );
}

/* ---------------- my plan ---------------- */

const SPRINTS = [
  { n: 1, name: ["Foundations", "Buniyaad", "बुनियाद"], w: 12, p: 100 },
  { n: 2, name: ["Arrays & strings", "Arrays aur strings", "ऐरे और स्ट्रिंग"], w: 16, p: 100 },
  { n: 3, name: ["Lists, stacks, queues", "List, stack, queue", "लिस्ट, स्टैक, क्यू"], w: 14, p: 68 },
  { n: 4, name: ["Trees & graphs", "Trees aur graphs", "ट्री और ग्राफ़"], w: 22, p: 0 },
  { n: 5, name: ["Dynamic programming", "Dynamic programming", "डायनामिक प्रोग्रामिंग"], w: 20, p: 0 },
  { n: 6, name: ["Mocks & interviews", "Mocks aur interviews", "मॉक और इंटरव्यू"], w: 16, p: 0 },
] as const;

type DayT = { k: string; t: string; m: number; done?: boolean };
const WEEK: { d: string; date: number; state: "done" | "today" | "missed" | "" | "test" | "rest"; tasks: DayT[] }[] = [
  { d: "Mon", date: 19, state: "done", tasks: [{ k: "lesson", t: "Stack basics", m: 20, done: true }, { k: "problem", t: "Min stack", m: 35, done: true }, { k: "revision", t: "5 cards", m: 10, done: true }] },
  { d: "Tue", date: 20, state: "today", tasks: [{ k: "lesson", t: "LIFO idea", m: 25, done: true }, { k: "problem", t: "Pair with target sum", m: 30 }, { k: "problem", t: "Valid brackets", m: 35 }, { k: "revision", t: "6 cards", m: 15 }, { k: "aptitude", t: "Percentages", m: 25 }] },
  { d: "Wed", date: 21, state: "", tasks: [{ k: "lesson", t: "Queue and deque", m: 25 }, { k: "problem", t: "Sliding max", m: 40 }, { k: "revision", t: "4 cards", m: 10 }] },
  { d: "Thu", date: 22, state: "", tasks: [{ k: "problem", t: "Next greater", m: 35 }, { k: "problem", t: "Stock span", m: 35 }, { k: "aptitude", t: "Ratios", m: 25 }] },
  { d: "Fri", date: 23, state: "", tasks: [{ k: "lesson", t: "Monotonic stack", m: 25 }, { k: "problem", t: "Largest rectangle", m: 45 }] },
  { d: "Sat", date: 24, state: "test", tasks: [{ k: "test", t: "Sprint 3 test", m: 60 }, { k: "revision", t: "Mistakes", m: 20 }] },
  { d: "Sun", date: 25, state: "rest", tasks: [] },
];

function MissedModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const [pick, setPick] = useState("spread");
  const opts = [
    { id: "spread", icon: <SplitSquareHorizontal />, h: t("Spread it over the next 3 days", "Agle 3 din me baanto", "अगले 3 दिनों में बाँटें"), p: t("+25 min a day · ends 10 Dec (no change)", "+25 min roz · 10 Dec hi", "+25 मिनट रोज़"), best: true },
    { id: "sunday", icon: <CalendarPlus />, h: t("Use Sunday, my rest day", "Ravivaar (chhutti) lagao", "रविवार लगाएँ"), p: t("Sunday 1h 40m · ends 10 Dec", "Ravivaar 1h 40m · 10 Dec", "रविवार 1 घं 40 मि") },
    { id: "extend", icon: <MoveRight />, h: t("Push the plan by one day", "Plan ek din aage", "योजना एक दिन आगे"), p: t("Same daily load · ends 11 Dec", "Roz ka bojh wahi · 11 Dec", "11 दिसंबर") },
    { id: "skip", icon: <CalendarX2 />, h: t("Skip the extra practice", "Extra practice chhodo", "अतिरिक्त अभ्यास छोड़ें"), p: t("Drops 2 optional problems · ends 10 Dec", "2 optional problems hatenge · 10 Dec", "2 वैकल्पिक प्रश्न हटेंगे") },
  ];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("You missed Saturday. No problem.", "Shanivar chhoot gaya. Koi baat nahi.", "शनिवार छूट गया। कोई बात नहीं।")}
      sub={t("1h 20m of work is waiting. Choose how the plan catches up.", "1h 20m ka kaam baaki. Plan kaise pakde, chuno.", "1 घं 20 मि का काम बाकी।")}
      icon={<span className="opt-ic red"><CalendarX2 /></span>}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            {t("Decide later", "Baad me", "बाद में")}
          </button>
          <button
            className="btn pri"
            onClick={() => {
              onClose();
              toast(t("Plan updated. End date stays 10 Dec.", "Plan badla. End date 10 Dec hi.", "योजना बदली।"));
            }}
          >
            {t("Update my plan", "Plan badlo", "योजना बदलें")}
          </button>
        </>
      }
    >
      <div className="col g8">
        {opts.map((o) => (
          <button key={o.id} className="option" aria-pressed={pick === o.id} onClick={() => setPick(o.id)}>
            <span className="opt-ic">{o.icon}</span>
            <span className="grow">
              <span className="row g6">
                <b style={{ fontWeight: 560 }}>{o.h}</b>
                {o.best && <Badge tone="tick">{t("Suggested", "Sujhaav", "सुझाव")}</Badge>}
              </span>
              <span className="tiny faint" style={{ display: "block" }}>
                {o.p}
              </span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function PlanBody() {
  const t = useT();
  const [missed, setMissed] = useState(false);
  const [view, setView] = useState<"week" | "list">("week");
  const total = SPRINTS.reduce((a, s) => a + s.w, 0);
  const KI: Record<string, ReactElement> = { lesson: <BookOpen />, problem: <CodeXml />, revision: <RotateCcw />, aptitude: <Brain />, test: <TriangleAlert /> };
  return (
    <div className="col g20">
      <header className="page-head" style={{ marginBottom: 0 }}>
        <div className="grow">
          <div className="eyebrow">{t("My plan", "Mera plan", "मेरी योजना")}</div>
          <h1 className="h1">
            {t("Product SDE, ready by ", "Product SDE, taiyaar ", "प्रोडक्ट SDE, तैयार ")}
            <Hl>{t("10 Dec", "10 Dec", "10 दिसंबर")}</Hl>
          </h1>
          <p className="muted page-sub">{t("Built from your goal, 2 hours a weekday, more on weekends, and your exam dates.", "Aapke goal, weekday 2 ghante, weekend zyada, aur exam dates se bana.", "आपके लक्ष्य और परीक्षा तिथियों से बनी।")}</p>
        </div>
        <div className="page-actions">
          <button className="btn">
            <Settings2 />
            {t("Plan settings", "Plan settings", "सेटिंग्स")}
          </button>
        </div>
      </header>

      <div className="stat-strip" style={{ ["--n" as string]: 4 }}>
        <div className="stat">
          <span className="k">{t("Sprint", "Sprint", "स्प्रिंट")}</span>
          <span className="v num">3 / 6</span>
          <span className="d">{t("Lists, stacks, queues", "List, stack, queue", "लिस्ट, स्टैक")}</span>
        </div>
        <div className="stat">
          <span className="k">{t("Topics", "Topics", "विषय")}</span>
          <span className="v num">68 / 148</span>
          <span className="d up">+9 {t("this week", "is hafte", "इस सप्ताह")}</span>
        </div>
        <div className="stat">
          <span className="k">{t("Time", "Samay", "समय")}</span>
          <span className="v num">41h / 90h</span>
          <span className="d">{t("avg 1h 52m a day", "avg 1h 52m roz", "औसत 1 घं 52 मि")}</span>
        </div>
        <div className="stat">
          <span className="k">{t("Finish", "Khatam", "समाप्ति")}</span>
          <span className="v num t-tick">8 Dec</span>
          <span className="d up">{t("2 days before plan", "Plan se 2 din pehle", "2 दिन पहले")}</span>
        </div>
      </div>

      <section className="card">
        <div className="card-h">
          <span className="h3">{t("Sprints", "Sprints", "स्प्रिंट")}</span>
          <span className="tiny faint">{t("Oct → Dec", "Oct → Dec", "अक्टू → दिसं")}</span>
        </div>
        <div className="card-b">
          <div className="sprints">
            {SPRINTS.map((s) => (
              <div key={s.n} className={`spr ${s.p === 100 ? "done" : s.p > 0 ? "now" : ""}`} style={{ flex: s.w / total }}>
                <div className="spr-bar">
                  <i style={{ width: `${s.p}%` }} />
                </div>
                <span className="tiny faint num">S{s.n}</span>
                <b className="small ellipsis">{t(s.name[0], s.name[1], s.name[2])}</b>
              </div>
            ))}
            <div className="exam-band" style={{ left: "47%", width: "11%" }}>
              <span className="tiny">{t("Exams", "Exams", "परीक्षा")}</span>
            </div>
            <div className="today-mark" style={{ left: "35%" }}>
              <span className="tiny">{t("today", "aaj", "आज")}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-h">
          <button className="icon-btn sm" aria-label="Previous week">
            <ChevronLeft />
          </button>
          <span className="h3" style={{ flex: "0 0 auto" }}>
            {t("19 – 25 October", "19 – 25 October", "19 – 25 अक्टूबर")}
          </span>
          <button className="icon-btn sm" aria-label="Next week">
            <ChevronRight />
          </button>
          <span className="grow" />
          <Seg
            value={view}
            onChange={setView}
            items={[
              { id: "week", label: t("Week", "Hafta", "सप्ताह") },
              { id: "list", label: t("List", "List", "सूची") },
            ]}
          />
        </div>
        <div className={`week-grid ${view}`}>
          {WEEK.map((d) => (
            <div key={d.date} className={`wday ${d.state}`}>
              <div className="wday-h">
                <span className="tiny faint">{d.d}</span>
                <b className="num">{d.date}</b>
                {d.state === "today" && <Badge tone="pen">{t("Today", "Aaj", "आज")}</Badge>}
                {d.state === "test" && <Badge tone="coin">{t("Test", "Test", "टेस्ट")}</Badge>}
              </div>
              {d.state === "rest" ? (
                <div className="wday-rest">
                  <BedDouble />
                  <span className="tiny">{t("Rest day", "Chhutti", "आराम")}</span>
                </div>
              ) : (
                d.tasks.map((x, i) => (
                  <div key={i} className={`wtask k-${x.k} ${x.done ? "done" : ""}`}>
                    {KI[x.k]}
                    <span className="grow">{x.t}</span>
                    <span className="num">{x.m}m</span>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
        <div className="card-f">
          <span className="missed-note">
            <CalendarX2 />
            {t("Last Saturday (17 Oct) was missed.", "Pichhla Shanivar (17 Oct) chhoot gaya.", "पिछला शनिवार छूटा।")}
          </span>
          <span className="grow" />
          <button className="btn sm" onClick={() => setMissed(true)}>
            {t("Re-plan it", "Dobara plan karo", "फिर से योजना")}
          </button>
        </div>
      </section>

      <div className="grid c3">
        <Card title={t("Daily time", "Roz ka samay", "रोज़ का समय")} icon={<Clock className="ic" />}>
          <div className="time-bars">
            {[["Mon", 2], ["Tue", 2], ["Wed", 2], ["Thu", 2], ["Fri", 1.5], ["Sat", 3], ["Sun", 0]].map(([d, h]) => (
              <div key={d as string} className="tb">
                <i style={{ height: `${((h as number) / 3) * 100}%` }} />
                <span className="tiny faint">{(d as string)[0]}</span>
              </div>
            ))}
          </div>
          <p className="tiny faint mt8">{t("Change hours any time; the end date moves with it.", "Ghante kabhi bhi badlo; end date saath me khiskegi.", "घंटे कभी भी बदलें।")}</p>
        </Card>
        <Card title={t("Exam weeks", "Exam weeks", "परीक्षा सप्ताह")} icon={<CalendarClock className="ic" />}>
          <div className="col g8">
            <div className="row between small">
              <b>3 – 15 Nov</b>
              <Badge tone="marker">{t("45 min / day", "45 min / din", "45 मि/दिन")}</Badge>
            </div>
            <p className="tiny faint">{t("From your college calendar · mostly revision", "College calendar se · zyada revision", "कॉलेज कैलेंडर से")}</p>
            <button className="btn sm">{t("Add exam dates", "Exam dates jodo", "तिथि जोड़ें")}</button>
          </div>
        </Card>
        <Card title={t("How the plan decides", "Plan kaise tay karta hai", "योजना कैसे तय करती है")} icon={<Sparkles className="ic" />}>
          <ul className="rules small muted">
            <li>{t("New topic, then 2 problems, then revision in 2 days", "Naya topic, 2 problems, 2 din baad revision", "नया विषय, 2 प्रश्न, दोहराई")}</li>
            <li>{t("A sprint test every 7th day", "Har 7ve din sprint test", "हर 7वें दिन टेस्ट")}</li>
            <li>{t("Weak topics come back sooner", "Kamzor topics jaldi lautte", "कमज़ोर विषय जल्दी लौटते")}</li>
          </ul>
        </Card>
      </div>
      <MissedModal open={missed} onClose={() => setMissed(false)} />
    </div>
  );
}
