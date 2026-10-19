import { useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CodeXml,
  BookOpen,
  RotateCcw,
  Brain,
  Activity,
  ListTodo,
  Target,
  Flame,
  Trophy,
  CalendarCheck,
  Sparkles,
  Zap,
  Clock3,
  CircleCheck,
  Play,
  TriangleAlert,
  Smartphone,
} from "lucide-react";
import { Link, useCountdown, useT, useToast, useLoaded } from "../lib/core";
import { Bar, CountBoxes, Diya, Ring, Skel, Check } from "../ui/kit";

type TaskItem = { kind: "problem" | "lesson" | "revision" | "apt"; name: [string, string, string]; sub: string; mins: number; to: string };

export const TODAY: TaskItem[] = [
  { kind: "lesson", name: ["Stacks: the LIFO idea", "Stacks: LIFO ka idea", "स्टैक: LIFO का विचार"], sub: "Lesson · 4 min read + 3 questions", mins: 25, to: "lesson" },
  { kind: "problem", name: ["Pair with target sum", "Pair with target sum", "लक्ष्य योग वाली जोड़ी"], sub: "Two pointers · L2", mins: 30, to: "problem" },
  { kind: "problem", name: ["Valid brackets", "Valid brackets", "सही कोष्ठक"], sub: "Stack · L2", mins: 35, to: "problem" },
  { kind: "revision", name: ["Revise 6 cards", "6 cards revise karo", "6 कार्ड दोहराएँ"], sub: "3 mistakes, 3 concepts", mins: 15, to: "revision" },
  { kind: "apt", name: ["Successive percentage", "Successive percentage", "क्रमिक प्रतिशत"], sub: "Aptitude set · 10 questions", mins: 25, to: "apt-set" },
];

export const KIND_ICON = { problem: CodeXml, lesson: BookOpen, revision: RotateCcw, apt: Brain } as const;

export function AajBody() {
  const t = useT();
  const toast = useToast();
  const loaded = useLoaded(380);
  const [done, setDone] = useState<boolean[]>([true, false, false, false, false]);
  const [potd] = useCountdown(3 * 3600 + 57 * 60 + 39);
  const doneCount = done.filter(Boolean).length;
  const minsDone = TODAY.reduce((a, x, i) => a + (done[i] ? x.mins : 0), 0);
  const minsAll = TODAY.reduce((a, x) => a + x.mins, 0);

  return (
    <div className="page stagger">
      <div className="hello">
        <div>
          <span className="eyebrow">{t("Tuesday, 20 October", "Mangalvaar, 20 October", "मंगलवार, 20 अक्टूबर")}</span>
          <h1 style={{ marginTop: 4 }}>{t("Good evening, Aarav", "Shubh sandhya, Aarav", "शुभ संध्या, आरव")}</h1>
          <div className="meta">
            <span className="chip">
              <Target size={13} /> {t("Product company SDE", "Product company SDE", "प्रोडक्ट कंपनी SDE")}
            </span>
            <span className="chip">
              <CalendarCheck size={13} /> {t("Plan ends 12 Dec", "Plan 12 Dec ko khatam", "योजना 12 दिसंबर तक")}
            </span>
            <span className="chip on">
              <Activity size={13} /> {t("On track, 2 days ahead", "Track par, 2 din aage", "सही रास्ते पर, 2 दिन आगे")}
            </span>
          </div>
        </div>
        <span className="hide-phone"><Diya size={64} mood="happy" className="bob" /></span>
      </div>

      <section className="panel featured continue" aria-label={t("Continue", "Jaari rakho", "जारी रखें")}>
        <span className="ico">
          <CodeXml size={24} />
        </span>
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">{t("Continue where you left off", "Jahan chhoda tha, wahin se", "जहाँ छोड़ा था, वहीं से")}</span>
          <h2>Pair with target sum</h2>
          <p className="muted" style={{ fontSize: "var(--fs-13)" }}>
            {t("Wrong answer on 1 hidden test · opened 14 min ago · 18 min spent", "1 hidden test par galat · 14 min pehle khola · 18 min lage", "1 छिपे टेस्ट पर गलत · 14 मिनट पहले")}
          </p>
        </div>
        <Link to="problem" className="btn primary lg">
          {t("Continue", "Jaari rakho", "जारी रखें")} <ArrowRight size={16} />
        </Link>
      </section>

      <div className="tiles4">
        <section className="panel">
          <div className="panel-head">
            <h2>
              <Activity size={15} /> {t("Overall progress", "Poori progress", "कुल प्रगति")}
            </h2>
            <Link to="plan" className="btn ghost sm">
              {t("View plan", "Plan dekho", "योजना देखें")}
            </Link>
          </div>
          <div className="panel-body overall">
            {loaded ? (
              <Ring value={46} size={112} stroke={10} label="46 percent">
                <b className="num">46%</b>
                <small>{t("done", "hua", "पूरा")}</small>
              </Ring>
            ) : (
              <Skel w={112} h={112} r={56} />
            )}
            <dl className="kv grow" style={{ margin: 0 }}>
              <dt>Sprints</dt>
              <dd>2 / 6</dd>
              <dt>{t("Topics", "Topics", "विषय")}</dt>
              <dd>68 / 148</dd>
              <dt>{t("Time", "Samay", "समय")}</dt>
              <dd>41h 35m / 90h</dd>
              <dt>{t("Finishes", "Khatam", "पूरा होगा")}</dt>
              <dd style={{ color: "var(--ok)" }}>{t("10 Dec (2 days early)", "10 Dec (2 din pehle)", "10 दिसंबर (2 दिन पहले)")}</dd>
            </dl>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>
              <CalendarCheck size={15} /> {t("Sprint 3 · Linked lists, stacks, queues", "Sprint 3 · Linked lists, stacks, queues", "स्प्रिंट 3 · लिंक्ड लिस्ट, स्टैक, क्यू")}
            </h2>
            <div className="row" style={{ gap: 2 }}>
              <button className="icon-btn" type="button" aria-label="Previous sprint">
                <ChevronLeft size={16} />
              </button>
              <button className="icon-btn" type="button" aria-label="Next sprint">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="panel-body stack">
            <div className="days7">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                const st = d === 3 ? "off" : d < 6 ? "done" : d === 6 ? "today" : "";
                return (
                  <div key={d} className={`day ${st}`}>
                    <i>{st === "done" ? <CircleCheck size={16} /> : d}</i>
                    {st === "today" ? t("Today", "Aaj", "आज") : st === "off" ? t("Rest", "Chhutti", "छुट्टी") : `${t("Day", "Din", "दिन")} ${d}`}
                  </div>
                );
              })}
            </div>
            <div className="row between wrap" style={{ fontSize: "var(--fs-12)" }}>
              <span className="muted">{t("4 of 6 study days done · Saturday was your rest day", "6 me se 4 din hue · Shanivaar chhutti thi", "6 में से 4 दिन पूरे · शनिवार छुट्टी")}</span>
              <span className="tag plus">
                <Sparkles size={11} /> {t("Wrap-up unlocks on day 7", "Din 7 par wrap-up", "दिन 7 पर सार")}
              </span>
            </div>
          </div>
        </section>
      </div>

      <div className="tiles4">
        <section className="panel">
          <div className="panel-head">
            <h2>
              <ListTodo size={15} /> {t("Today's tasks", "Aaj ke kaam", "आज के काम")}
              <span className="tag">{doneCount} / {TODAY.length}</span>
            </h2>
            <span className="faint num" style={{ fontSize: "var(--fs-12)" }}>
              {minsDone} / {minsAll} min
            </span>
          </div>
          <div className="list">
            {TODAY.map((task, i) => {
              const Icon = KIND_ICON[task.kind];
              const isLive = !done[i] && done.slice(0, i).every(Boolean);
              return (
                <div key={i} className={`task ${done[i] ? "done" : isLive ? "live" : ""}`}>
                  <span className="kind">
                    <Icon size={16} />
                  </span>
                  <div className="name">
                    <span>{t(...task.name)}</span>
                    <small>{task.sub}</small>
                  </div>
                  <span className="mins">{task.mins} min</span>
                  {done[i] ? (
                    <Check
                      on
                      label="Done"
                      onChange={() => setDone((d) => d.map((v, j) => (j === i ? false : v)))}
                    />
                  ) : (
                    <Link
                      to={task.to}
                      className={`btn sm ${isLive ? "primary" : "secondary"}`}
                      onClick={() => {
                        if (task.kind === "revision") toast(t("Opening revision", "Revision khul raha hai", "दोहराई खुल रही है"));
                      }}
                    >
                      <Play size={12} /> {t("Start", "Shuru", "शुरू")}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="stack">
          <section className="panel pad stack">
            <div className="row between">
              <h3 style={{ fontSize: "var(--fs-14)" }}>{t("Today's progress", "Aaj ki progress", "आज की प्रगति")}</h3>
              <span className="tag action">{Math.round((minsDone / minsAll) * 100)}%</span>
            </div>
            <Bar value={(minsDone / minsAll) * 100} />
            <div className="mini3">
              <div className="mini-stat">
                <b>{doneCount}/{TODAY.length}</b>
                <span>{t("tasks", "kaam", "काम")}</span>
              </div>
              <div className="mini-stat">
                <b>38m</b>
                <span>{t("focused time", "focus samay", "ध्यान का समय")}</span>
              </div>
              <div className="mini-stat">
                <b>2h 10m</b>
                <span>{t("planned", "plan me", "योजना में")}</span>
              </div>
            </div>
          </section>

          <section className="panel pad stack">
            <div className="row between">
              <h3 style={{ fontSize: "var(--fs-14)", display: "flex", gap: 8, alignItems: "center" }}>
                <CalendarCheck size={15} /> {t("Problem of the day", "Aaj ka problem", "आज का प्रश्न")}
              </h3>
              <span className="tag plus">+20 {t("coins", "coins", "सिक्के")}</span>
            </div>
            <b>Bus stop queue</b>
            <div className="row between wrap">
              <CountBoxes seconds={potd} />
              <Link to="potd" className="btn primary sm">
                {t("Solve", "Hal karo", "हल करें")} <ArrowRight size={13} />
              </Link>
            </div>
          </section>
        </div>
      </div>

      <div className="grid c3">
        <Link to="revision" className="panel pad stack hover-card">
          <div className="row between">
            <span className="eyebrow">{t("Revision due", "Revision baaki", "दोहराई बाकी")}</span>
            <RotateCcw size={16} className="faint" />
          </div>
          <b style={{ fontSize: "var(--fs-22)" }}>6 {t("cards", "cards", "कार्ड")}</b>
          <span className="muted" style={{ fontSize: "var(--fs-13)" }}>
            {t("3 from your mistakes this week, 3 concepts you last saw 7 days ago", "3 is hafte ki galtiyon se, 3 concepts jo 7 din pehle dekhe", "3 इस हफ़्ते की गलतियों से, 3 पुराने")}
          </span>
        </Link>
        <Link to="contests" className="panel pad stack hover-card">
          <div className="row between">
            <span className="eyebrow">{t("Next contest", "Agla contest", "अगली प्रतियोगिता")}</span>
            <Trophy size={16} className="faint" />
          </div>
          <b style={{ fontSize: "var(--fs-16)" }}>Weekly Round 12</b>
          <span className="muted" style={{ fontSize: "var(--fs-13)" }}>
            {t("Sunday 8:00 PM · 90 min · rated · 1,902 registered", "Ravivaar 8:00 PM · 90 min · rated · 1,902 registered", "रविवार रात 8 बजे · 90 मिनट")}
          </span>
        </Link>
        <Link to="daily" className="panel pad stack hover-card">
          <div className="row between">
            <span className="eyebrow">Daily 10</span>
            <Smartphone size={16} className="faint" />
          </div>
          <b style={{ fontSize: "var(--fs-16)" }}>{t("10 questions, 6 minutes", "10 sawaal, 6 minute", "10 सवाल, 6 मिनट")}</b>
          <span className="muted" style={{ fontSize: "var(--fs-13)" }}>
            {t("Best on your phone, on the bus or between classes", "Phone par best: bus me, class ke beech", "फ़ोन पर सबसे अच्छा")}
          </span>
        </Link>
      </div>
    </div>
  );
}

export function AajRail() {
  const t = useT();
  return (
    <>
      <div className="rail-card">
        <h3>
          <Target size={15} /> {t("Readiness · product SDE", "Taiyaari · product SDE", "तैयारी · प्रोडक्ट SDE")}
        </h3>
        <div className="readiness">
          <Ring value={58} size={76} stroke={8} color="var(--plus)">
            <b className="num" style={{ fontSize: "var(--fs-16)" }}>58</b>
          </Ring>
          <p className="muted" style={{ fontSize: "var(--fs-12)" }}>
            {t("Based on 212 solved problems, 3 mocks and 1 contest. Not a prediction of an offer.", "212 solved problems, 3 mock aur 1 contest se. Offer ki guarantee nahi.", "212 हल प्रश्न, 3 मॉक, 1 प्रतियोगिता से")}
          </p>
        </div>
        <div className="weak">
          <span className="eyebrow">{t("Weakest topics", "Sabse kamzor topics", "सबसे कमज़ोर विषय")}</span>
          {[
            ["Dynamic programming", 22],
            ["Graphs", 31],
            ["Sliding window", 44],
          ].map(([n, v]) => (
            <div className="weak-row" key={n as string}>
              <span>{n}</span>
              <Bar value={v as number} tone="plus" thin />
              <span>{v}%</span>
            </div>
          ))}
        </div>
        <Link to="sheet" className="btn secondary sm">
          {t("Drill the weakest", "Kamzor topic ka drill", "कमज़ोर विषय का अभ्यास")}
        </Link>
      </div>

      <div className="rail-card">
        <h3>
          <Flame size={15} style={{ color: "var(--plus)" }} /> {t("12-day streak", "12 din ki streak", "12 दिन लगातार")}
        </h3>
        <div className="streak-week">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className={i < 1 ? "" : i === 1 ? "today" : i < 1 ? "done" : "next"}>
              <i className={i === 0 ? "lit" : i === 1 ? "lit now" : ""}>
                <Flame size={14} />
              </i>
              {d}
            </span>
          ))}
        </div>
        <p className="faint" style={{ fontSize: "var(--fs-12)" }}>
          {t("1 streak freeze left this month. Days off in your plan never break the streak.", "Is mahine 1 freeze baaki. Plan ki chhutti se streak nahi tootti.", "इस महीने 1 फ़्रीज़ बाकी।")}
        </p>
      </div>

      <div className="rail-card">
        <h3>
          <Sparkles size={15} /> Sahayak
        </h3>
        <p className="muted" style={{ fontSize: "var(--fs-13)" }}>
          {t("You missed the same overflow bug twice this week. Want a 5-minute drill on it?", "Is hafte overflow wali galti 2 baar hui. 5 minute ka drill karein?", "इस हफ़्ते ओवरफ़्लो वाली गलती 2 बार हुई।")}
        </p>
        <div className="row wrap" style={{ gap: 6 }}>
          <Link to="revision" className="btn secondary sm">
            <Zap size={13} /> {t("Yes, 5 min", "Haan, 5 min", "हाँ, 5 मिनट")}
          </Link>
          <button type="button" className="btn ghost sm">
            {t("Later", "Baad me", "बाद में")}
          </button>
        </div>
      </div>

      <div className="rail-card" style={{ borderColor: "var(--line)" }}>
        <h3>
          <TriangleAlert size={15} style={{ color: "var(--warn)" }} /> {t("Exam week ahead", "Exam ka hafta aa raha", "परीक्षा का हफ़्ता")}
        </h3>
        <p className="muted" style={{ fontSize: "var(--fs-13)" }}>
          {t("Your semester exams start 3 Nov. Sprint 5 is lighter by 40 min a day.", "Semester exam 3 Nov se. Sprint 5 roz 40 min halka.", "सेमेस्टर परीक्षा 3 नवंबर से।")}
        </p>
        <span className="faint" style={{ fontSize: "var(--fs-12)", display: "flex", gap: 6, alignItems: "center" }}>
          <Clock3 size={12} /> {t("From your college calendar", "College calendar se", "कॉलेज कैलेंडर से")}
        </span>
      </div>
    </>
  );
}
