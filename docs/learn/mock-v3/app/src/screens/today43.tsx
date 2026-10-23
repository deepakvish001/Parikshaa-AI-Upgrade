import { useState } from "react";
import { Play, Sparkles, CircleX, Check, Flame, Snowflake, Trophy, CalendarClock, Feather, SkipForward, RotateCcw, Timer, CalendarRange, ArrowRight } from "lucide-react";
import { Link, navigate, useT, useCountdown, hms } from "../lib/core";
import { useAi } from "../lib/state";
import { Badge, Level, Check as CheckBox, Ring, Diya, PenCircle, Tick, CountUp, Moment } from "../ui/kit";
import { TASKS, KIND, LighterModal } from "./today";

/* Mock v4.3: three directions for Today. A puts the next task first, B writes the day on a ruled page,
   C lays the evening out as a timeline. They share the same data so only the design differs. */

const NOW = "t2";

function useDone() {
  return useState<Record<string, boolean>>(Object.fromEntries(TASKS.map((x) => [x.id, x.done])));
}

/** The moments Today can show: the day finished, the plan made lighter, or the streak kept with a freeze. */
function DayMoment({ allDone, lit }: { allDone: boolean; lit: string | null }) {
  const t = useT();
  if (allDone)
    return (
      <Moment
        title={t("Today's work is done", "Aaj ka kaam poora", "आज का काम पूरा")}
        note={t("13 days in a row. Nothing left for tonight; tomorrow's plan is ready.", "Lagaataar 13 din. Aaj raat kuch nahi bacha; kal ka plan taiyaar.", "लगातार 13 दिन।")}
        stamp={{ top: "AAJ", mid: "Poora", bottom: "13 DIN" }}
      />
    );
  if (lit === "off")
    return (
      <Moment
        mood="sleepy"
        tone="coin"
        title={t("Day off. Your streak is safe.", "Aaj chhutti. Streak bachi rahi.", "आज छुट्टी। लगातार बचा रहा।")}
        note={t("One freeze used. I will remind you tomorrow at 7 pm.", "Ek freeze laga. Kal shaam 7 baje yaad dilaunga.", "एक फ़्रीज़ लगा।")}
        stamp={{ top: "STREAK", mid: "12", bottom: "SAFE" }}
      />
    );
  if (lit)
    return (
      <Moment
        mood="happy"
        tone="pen"
        title={t("Today is lighter. The plan took care of it.", "Aaj halka hua. Plan ne khud sambhala.", "आज हल्का हुआ।")}
        note={t("End date is still 10 Dec; tomorrow has 20 extra minutes.", "End date ab bhi 10 Dec; kal 20 minute zyada.", "अंतिम तारीख़ वही 10 दिसंबर।")}
      />
    );
  return null;
}

/* ---------------- A: one thing at a time ---------------- */

export function AajFocus() {
  const t = useT();
  const ai = useAi();
  const [done, setDone] = useDone();
  const [light, setLight] = useState(false);
  const [lit, setLit] = useState<string | null>(null);
  const left = TASKS.filter((x) => !done[x.id]);
  const mins = left.reduce((a, x) => a + x.min, 0);
  const rest = TASKS.filter((x) => x.id !== NOW);
  return (
    <div className="col g16">
      <header className="af-head">
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="eyebrow">{t("Tuesday, 20 October · day 38 of 90", "Mangalvaar, 20 October · din 38/90", "मंगलवार, 20 अक्टूबर · दिन 38/90")}</div>
          <h1 className="af-h1">
            {t("Good evening, Aarav.", "Shubh sandhya, Aarav.", "शुभ संध्या, आरव।")}{" "}
            <span className="af-sub">
              {t(`${left.length} things left, about ${mins} min.`, `${left.length} kaam baaki, lagbhag ${mins} min.`, `${left.length} काम बाकी, लगभग ${mins} मिनट।`)}
            </span>
          </h1>
        </div>
        <Badge tone="tick" icon={<Check />}>
          {t("2 days ahead", "2 din aage", "2 दिन आगे")}
        </Badge>
      </header>
      <DayMoment allDone={left.length === 0} lit={lit} />

      <section className="af-now" aria-labelledby="af-now-t">
        <div className="af-now-top">
          <span className="eyebrow">{t("Now · task 2 of 5", "Abhi · kaam 2 / 5", "अभी · काम 2 / 5")}</span>
          <span className="tiny faint num">30 min</span>
        </div>
        <div className="af-now-main">
          <div className="grow" style={{ minWidth: 0 }}>
            <h2 className="af-now-t" id="af-now-t">
              Pair with target sum
            </h2>
            <div className="row wrap g8 small muted">
              <Badge tone="red" icon={<CircleX />}>
                {t("Wrong answer · test 23", "Galat · test 23", "गलत · टेस्ट 23")}
              </Badge>
              <span>{t("The idea is right; one input breaks it.", "Idea sahi hai; ek input todta hai.", "विचार सही है; एक इनपुट तोड़ता है।")}</span>
            </div>
            <div className="resume-code mono">
              <span className="faint">4 </span>int sum = <PenCircle>a[L] + a[R]</PenCircle>;
            </div>
          </div>
          <div className="af-now-act">
            <button className="btn pri lg" onClick={() => navigate("problem")}>
              <Play />
              {t("Resume", "Jaari rakho", "जारी रखें")}
            </button>
            <button className="btn ai" onClick={() => ai.setOpen(true)}>
              <Sparkles />
              {t("Ask why it fails", "Fail kyun? Poochho", "क्यों फेल? पूछें")}
            </button>
          </div>
        </div>
        <div className="segs af-segs" aria-hidden="true">
          {TASKS.map((x) => (
            <i key={x.id} className={done[x.id] ? "ok" : x.id === NOW ? "now" : ""} />
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-h">
          <span className="h3">{t("Then", "Phir", "फिर")}</span>
          <span className="tiny faint num">
            {Object.values(done).filter(Boolean).length} / {TASKS.length} {t("done", "ho gaye", "पूरे")}
          </span>
        </div>
        <ul className="af-list">
          {rest.map((x) => (
            <li key={x.id} className={done[x.id] ? "done" : ""}>
              <CheckBox round tick on={done[x.id]} onChange={(v) => setDone((d) => ({ ...d, [x.id]: v }))} label={t("Done", "Ho gaya", "पूरा")} />
              <span className={`task-ic k-${x.kind}`}>{KIND[x.kind]}</span>
              <span className="grow" style={{ minWidth: 0 }}>
                <b className="ellipsis">{t(...x.title)}</b>
                <span className="tiny faint row g8">
                  {x.meta}
                  {x.level && <Level n={x.level} short />}
                </span>
              </span>
              <span className="tiny faint num">{x.min} min</span>
              {done[x.id] ? (
                <Tick size={16} />
              ) : (
                <Link to={x.to} className="btn sm ghost" aria-label={`${t("Open", "Kholo", "खोलें")}: ${t(...x.title)}`}>
                  <ArrowRight />
                </Link>
              )}
            </li>
          ))}
        </ul>
        <div className="card-f">
          <Feather className="faint" style={{ width: 15, height: 15 }} />
          <span className="small muted grow">{t("Heavy day? Make today lighter.", "Bhaari din? Aaj halka karo.", "भारी दिन? आज हल्का करें।")}</span>
          <button className="btn sm ghost" onClick={() => setLight(true)}>
            {t("Make lighter", "Halka karo", "हल्का करें")}
          </button>
        </div>
      </section>
      <LighterModal open={light} onClose={() => setLight(false)} onDone={setLit} />
    </div>
  );
}

export function RailFocus() {
  const t = useT();
  const [left] = useCountdown(3 * 3600 + 57 * 60 + 38);
  return (
    <>
      <section className="card pad col g12">
        <span className="h3">{t("This week", "Is hafte", "इस सप्ताह")}</span>
        <div className="row g14">
          <Ring v={58} size={72} stroke={7}>
            <b className="display num" style={{ fontSize: 22 }}>
              <CountUp to={58} />
            </b>
          </Ring>
          <div className="col g4 small">
            <b>{t("Readiness 58, up 6", "Readiness 58, +6", "तैयारी 58, +6")}</b>
            <span className="muted">{t("Weakest: dynamic programming", "Sabse kamzor: DP", "सबसे कमज़ोर: DP")}</span>
          </div>
        </div>
        <div className="af-streak">
          <Flame />
          <b className="num">12</b>
          <span className="small muted grow">{t("day streak", "din ki streak", "दिन लगातार")}</span>
          <span className="tiny faint row g4">
            <Snowflake style={{ width: 13, height: 13 }} />1 {t("freeze", "freeze", "फ़्रीज़")}
          </span>
        </div>
      </section>
      <section className="card">
        <div className="card-h">
          <span className="h3">{t("Coming up", "Aage", "आगे")}</span>
        </div>
        <ul className="agenda">
          <li>
            <Timer />
            <span className="grow">
              <b className="small">{t("Problem of the day", "Aaj ka problem", "आज का प्रश्न")}</b>
              <span className="tiny faint mono num" style={{ display: "block" }}>
                {hms(left)} {t("left", "baaki", "बाकी")}
              </span>
            </span>
            <Link to="potd" className="btn sm">
              {t("Solve", "Solve", "हल करें")}
            </Link>
          </li>
          <li>
            <CalendarRange />
            <span className="grow">
              <b className="small">{t("Sprint test", "Sprint test", "स्प्रिंट टेस्ट")}</b>
              <span className="tiny faint" style={{ display: "block" }}>
                {t("Saturday · 45 min", "Shanivar · 45 min", "शनिवार · 45 मिनट")}
              </span>
            </span>
          </li>
          <li>
            <Trophy />
            <span className="grow">
              <b className="small">Weekly Round 13</b>
              <span className="tiny faint" style={{ display: "block" }}>
                {t("Sunday 8:00 pm", "Ravivaar 8 baje", "रविवार 8 बजे")}
              </span>
            </span>
            <Link to="contest-brief" className="btn sm">
              {t("Register", "Register", "पंजीकरण")}
            </Link>
          </li>
          <li>
            <CalendarClock />
            <span className="grow">
              <b className="small">{t("Semester exams 3–15 Nov", "Semester exams 3–15 Nov", "सेमेस्टर परीक्षा 3–15 नवंबर")}</b>
              <span className="tiny faint" style={{ display: "block" }}>
                {t("Plan drops to 45 min a day", "Plan roz 45 min ho jaayega", "योजना रोज़ 45 मिनट")}
              </span>
            </span>
          </li>
        </ul>
      </section>
    </>
  );
}

/* ---------------- B: the day on a ruled page ---------------- */

const NOTES: Record<string, [string, string, string]> = {
  t1: ["done in 25 min", "25 min me ho gaya", "25 मिनट में"],
  t2: ["stuck on test 23: int overflow?", "test 23 pe atka: int overflow?", "टेस्ट 23 पर अटका: int overflow?"],
  t4: ["3 old mistakes", "3 purani galtiyan", "3 पुरानी गलतियाँ"],
};
const AT = ["7:00", "7:25", "7:55", "8:30", "8:45"];

export function AajPaper() {
  const t = useT();
  const ai = useAi();
  const [done, setDone] = useDone();
  const [light, setLight] = useState(false);
  const [lit, setLit] = useState<string | null>(null);
  const n = Object.values(done).filter(Boolean).length;
  return (
    <div className="col g16">
      <DayMoment allDone={n === TASKS.length} lit={lit} />
      <article className="ap-page" aria-labelledby="ap-t">
        <div className="ap-top">
          <div className="grow" style={{ minWidth: 0 }}>
            <span className="ap-date">{t("Tue, 20 Oct", "Mangal, 20 Oct", "मंगल, 20 अक्टूबर")}</span>
            <h1 className="ap-t" id="ap-t">
              {t("Today's page", "Aaj ka panna", "आज का पन्ना")}
            </h1>
            <span className="small muted">
              {t("Good evening, Aarav. Day 38 of 90, two days ahead.", "Shubh sandhya, Aarav. Din 38/90, do din aage.", "शुभ संध्या, आरव। दिन 38/90, दो दिन आगे।")}
            </span>
          </div>
          <Diya size={64} mood={n >= 3 ? "cheer" : "happy"} />
        </div>
        <ol className="ap-lines">
          {TASKS.map((x, i) => {
            const isDone = done[x.id];
            const now = x.id === NOW && !isDone;
            return (
              <li key={x.id} className={`${isDone ? "done" : ""} ${now ? "now" : ""}`}>
                <span className="ap-at num">{AT[i]}</span>
                <CheckBox round tick on={isDone} onChange={(v) => setDone((d) => ({ ...d, [x.id]: v }))} label={t("Done", "Ho gaya", "पूरा")} />
                <span className="ap-body">
                  <span className="ap-title">{now ? <mark className="ap-mark">{t(...x.title)}</mark> : t(...x.title)}</span>
                  <span className="tiny faint row g8 wrap">
                    {x.meta} · {x.min} min
                    {x.level && <Level n={x.level} short />}
                  </span>
                </span>
                {NOTES[x.id] && <span className="ap-note">{t(...NOTES[x.id])}</span>}
                {now ? (
                  <span className="row g6 ap-act">
                    <button className="btn pri sm" onClick={() => navigate("problem")}>
                      <Play />
                      {t("Resume", "Jaari rakho", "जारी रखें")}
                    </button>
                    <button className="btn ai sm" onClick={() => ai.setOpen(true)} aria-label={t("Ask Sahayak why it fails", "Sahayak se poochho", "सहायक से पूछें")}>
                      <Sparkles />
                    </button>
                  </span>
                ) : (
                  !isDone && (
                    <Link to={x.to} className="btn sm ghost ap-act" aria-label={`${t("Open", "Kholo", "खोलें")}: ${t(...x.title)}`}>
                      <ArrowRight />
                    </Link>
                  )
                )}
              </li>
            );
          })}
        </ol>
        <div className="ap-foot">
          <span className="ap-sum">
            {n} / {TASKS.length} · 130 min
          </span>
          <button className="ap-pencil" onClick={() => setLight(true)}>
            <Feather />
            {t("Heavy day? Make it lighter", "Bhaari din? Halka karo", "भारी दिन? हल्का करें")}
          </button>
        </div>
      </article>
      <LighterModal open={light} onClose={() => setLight(false)} onDone={setLit} />
    </div>
  );
}

export function RailPaper() {
  const t = useT();
  return (
    <>
      <div className="rail-note">
        <b>{t("Exams 3–15 Nov", "Exams 3–15 Nov", "परीक्षा 3–15 नवंबर")}</b>
        <span>{t("Plan goes to 45 min a day, mostly revision. Nothing to do.", "Plan roz 45 min, zyada revision. Kuch nahi karna.", "रोज़ 45 मिनट, ज़्यादातर दोहराई।")}</span>
      </div>
      <section className="card pad col g12">
        <span className="h3">{t("This week", "Is hafte", "इस सप्ताह")}</span>
        <div className="row g14">
          <span className="ap-score" aria-label={t("Readiness 58", "Readiness 58", "तैयारी 58")}>
            <b className="num">58</b>
            <small>{t("ready", "ready", "तैयार")}</small>
          </span>
          <div className="col g4 small">
            <b>{t("Up 6 this week", "Is hafte +6", "इस सप्ताह +6")}</b>
            <Link to="sheet" className="link small">
              {t("Weakest: DP", "Kamzor: DP", "कमज़ोर: DP")}
              <ArrowRight />
            </Link>
          </div>
        </div>
        <div className="tally" aria-label={t("12 day streak", "12 din ki streak", "12 दिन लगातार")}>
          <span className="tally-g" />
          <span className="tally-g" />
          <span className="tally-r">||</span>
          <span className="small muted">{t("12 days in a row", "12 din lagaataar", "12 दिन लगातार")}</span>
        </div>
        <Link to="revision" className="btn sm block">
          <RotateCcw />
          {t("6 revision cards · 8 min", "6 revision cards · 8 min", "6 कार्ड · 8 मिनट")}
        </Link>
      </section>
    </>
  );
}

/* ---------------- C: the evening as a timeline ---------------- */

export function AajTimeline() {
  const t = useT();
  const ai = useAi();
  const [done] = useDone();
  const total = TASKS.reduce((a, x) => a + x.min, 0);
  const nowAt = 25 + 14;
  let acc = 0;
  return (
    <div className="col g16">
      <header className="af-head">
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="eyebrow">{t("Tuesday, 20 October", "Mangalvaar, 20 October", "मंगलवार, 20 अक्टूबर")}</div>
          <h1 className="af-h1">
            {t("Tonight, 7:00 to 9:10 pm", "Aaj shaam, 7:00 se 9:10", "आज शाम, 7:00 से 9:10")} <span className="af-sub">{t("You are 14 min into task 2.", "Kaam 2 me 14 min ho gaye.", "काम 2 में 14 मिनट हुए।")}</span>
          </h1>
        </div>
        <span className="row g8">
          <Diya size={44} />
          <span className="small muted num">38 / 90</span>
        </span>
      </header>

      <section className="card at-card" aria-label={t("Tonight's timeline", "Aaj shaam ki timeline", "आज शाम की समय-रेखा")}>
        <div className="at-track">
          {TASKS.map((x) => {
            const start = acc;
            acc += x.min;
            const st = done[x.id] ? "done" : x.id === NOW ? "now" : "";
            return (
              <Link key={x.id} to={x.to} className={`at-blk k-${x.kind} ${st}`} style={{ left: `${(start / total) * 100}%`, width: `${(x.min / total) * 100}%` }} aria-label={`${t(...x.title)}, ${x.min} min`}>
                <span className="at-ic">{KIND[x.kind]}</span>
                <span className="at-l ellipsis">{t(...x.title)}</span>
              </Link>
            );
          })}
          <span className="at-now" style={{ left: `${(nowAt / total) * 100}%` }} aria-hidden="true">
            <i>7:39</i>
          </span>
        </div>
        <div className="at-ticks num tiny faint" aria-hidden="true">
          {["7:00", "7:30", "8:00", "8:30", "9:00"].map((h, i) => (
            <span key={h} style={{ left: `${((i * 30) / total) * 100}%` }}>
              {h}
            </span>
          ))}
        </div>
      </section>

      <div className="at-grid">
        <section className="card at-nowcard">
          <div className="card-h">
            <span className="h3">{t("Now", "Abhi", "अभी")}</span>
            <Badge tone="red" icon={<CircleX />}>
              {t("Wrong answer · test 23", "Galat · test 23", "गलत · टेस्ट 23")}
            </Badge>
          </div>
          <div className="card-b col g12">
            <h2 className="af-now-t">Pair with target sum</h2>
            <div className="resume-code mono">
              <span className="faint">4 </span>int sum = <PenCircle>a[L] + a[R]</PenCircle>;
            </div>
            <div className="row wrap g8">
              <button className="btn pri" onClick={() => navigate("problem")}>
                <Play />
                {t("Resume", "Jaari rakho", "जारी रखें")}
              </button>
              <button className="btn ai" onClick={() => ai.setOpen(true)}>
                <Sparkles />
                {t("Ask why it fails", "Fail kyun?", "क्यों फेल?")}
              </button>
              <button className="btn ghost">
                <SkipForward />
                {t("Skip for today", "Aaj chhodo", "आज छोड़ें")}
              </button>
            </div>
          </div>
        </section>
        <section className="card">
          <div className="card-h">
            <span className="h3">{t("Up next", "Agla", "अगला")}</span>
          </div>
          <ul className="agenda">
            {TASKS.slice(2).map((x, i) => (
              <li key={x.id}>
                <span className="num tiny faint at-time">{AT[i + 2]}</span>
                <span className={`task-ic k-${x.kind}`}>{KIND[x.kind]}</span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <b className="small ellipsis" style={{ display: "block" }}>
                    {t(...x.title)}
                  </b>
                  <span className="tiny faint">{x.min} min</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="at-week">
        {[
          { to: "plan", ic: <CalendarRange />, k: t("Sprint 3", "Sprint 3", "स्प्रिंट 3"), v: "68%", s: t("Test on Saturday", "Shanivar ko test", "शनिवार को टेस्ट") },
          { to: "revision", ic: <RotateCcw />, k: t("Revision", "Revision", "दोहराई"), v: "6", s: t("cards due · 8 min", "cards baaki · 8 min", "कार्ड बाकी") },
          { to: "sheet", ic: <Check />, k: t("Readiness", "Readiness", "तैयारी"), v: "58", s: t("up 6 this week", "is hafte +6", "इस सप्ताह +6") },
          { to: "contest-brief", ic: <Trophy />, k: "Weekly Round 13", v: t("Sun", "Ravi", "रवि"), s: "8:00 pm · 90 min" },
        ].map((x) => (
          <Link key={x.k} to={x.to} className="at-tile card hov">
            <span className="row g6 tiny faint">
              {x.ic}
              {x.k}
            </span>
            <b className="display num">{x.v}</b>
            <span className="tiny faint">{x.s}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
