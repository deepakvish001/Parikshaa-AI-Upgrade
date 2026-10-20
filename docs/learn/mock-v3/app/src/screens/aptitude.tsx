import { useState } from "react";
import {
  Calculator,
  Brain,
  BookText,
  Sigma,
  Timer,
  Flag,
  Eraser,
  ArrowRight,
  ArrowLeft,
  Lightbulb,
  Sparkles,
  Clock,
  Lock,
  Send,
  CircleCheck,
  CircleX,
  Zap,
  Target,
  BarChart3,
  Play,
  X,
} from "lucide-react";
import { Link, navigate, useT, useCountdown, hms } from "../lib/core";
import { useAi } from "../lib/state";
import { Badge, Level, Meter, Ring, Card, PageHead, Modal, Tick, Hl, CountUp, Bars, Seg } from "../ui/kit";
import { FocusBar } from "../ui/focus";

/* ---------------- hub ---------------- */

const SECTIONS = [
  { id: "q", icon: <Sigma />, name: ["Quantitative", "Quantitative", "मात्रात्मक"], acc: 68, tone: "pen", topics: [["Percentages", 74], ["Profit & loss", 61], ["Time & work", 48], ["Speed & distance", 70], ["Probability", 39]] },
  { id: "l", icon: <Brain />, name: ["Logical", "Logical", "तार्किक"], acc: 72, tone: "ai", topics: [["Series", 82], ["Coding-decoding", 77], ["Seating", 55], ["Syllogisms", 64], ["Data sufficiency", 41]] },
  { id: "v", icon: <BookText />, name: ["Verbal", "Verbal", "मौखिक"], acc: 58, tone: "teal", topics: [["Reading", 62], ["Grammar", 71], ["Para jumbles", 44], ["Vocabulary", 53], ["Sentence correction", 60]] },
] as const;

export function AptitudeBody() {
  const t = useT();
  return (
    <div className="col g20">
      <PageHead
        eyebrow={t("Aptitude", "Aptitude", "एप्टीट्यूड")}
        title={t("Fast, and right the first time.", "Tez, aur pehli baar me sahi.", "तेज़, और पहली बार में सही।")}
        sub={t("Every topic has a method, a shortcut and a time target. Mocks follow the real exam pattern, section by section.", "Har topic ka tareeka, shortcut aur time target. Mocks asli exam pattern par.", "हर विषय का तरीका और शॉर्टकट।")}
        actions={
          <Link to="apt-set" className="btn pri">
            <Zap />
            {t("10-minute set", "10 minute set", "10 मिनट सेट")}
          </Link>
        }
      />
      <div className="grid c3">
        {SECTIONS.map((s) => (
          <section key={s.id} className="card">
            <div className="card-h">
              <span className={`tr-ic ${s.tone}`} style={{ marginBottom: 0, width: 32, height: 32 }}>
                {s.icon}
              </span>
              <span className="h3">{t(s.name[0], s.name[1], s.name[2])}</span>
              <span className="tiny faint">
                {t("accuracy", "accuracy", "सटीकता")} <b className="num">{s.acc}%</b>
              </span>
            </div>
            <div className="card-b col g10">
              {s.topics.map(([n, a]) => (
                <Link to="apt-set" key={n} className="row g10 small apt-topic">
                  <span className="grow">{n}</span>
                  <div style={{ width: 80 }}>
                    <Meter v={a} tone={a < 50 ? "red" : a < 65 ? "coin" : "tick"} size="thin" />
                  </div>
                  <span className="tiny num faint" style={{ width: 28, textAlign: "right" }}>
                    {a}%
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="grid c2">
        <Card title={t("Mocks in the real pattern", "Asli pattern ke mocks", "असली पैटर्न के मॉक")} icon={<Timer className="ic" />} pad={false}>
          <div className="list">
            {[
              [t("Mass-recruiter pattern A", "Mass-recruiter pattern A", "पैटर्न A"), "3 sections · 90 min · −0.25", "Not started", "apt-mock"],
              [t("Mass-recruiter pattern B", "Mass-recruiter pattern B", "पैटर्न B"), "4 sections · 100 min · no negative", "36.5 / 60", "apt-result"],
              [t("Product company OA (aptitude part)", "Product OA (aptitude)", "प्रोडक्ट OA"), "1 section · 25 min", "Plus", "plus"],
            ].map(([n, m, s, to], i) => (
              <Link key={i} to={to} className="li">
                <span className="ic-box">
                  <Timer />
                </span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <b className="small">{n}</b>
                  <span className="tiny faint" style={{ display: "block" }}>
                    {m}
                  </span>
                </span>
                {s === "Plus" ? <Badge tone="solid">Plus</Badge> : s === "Not started" ? <span className="btn sm pri">{t("Start", "Shuru", "शुरू")}</span> : <Badge tone="tick">{s}</Badge>}
              </Link>
            ))}
          </div>
          <div className="card-f tiny faint">{t("Pattern names describe the format only. Company names appear only with a verified source.", "Pattern naam sirf format batate hain. Company naam sirf verified source ke saath.", "पैटर्न नाम केवल प्रारूप बताते हैं।")}</div>
        </Card>
        <Card title={t("Your speed vs target", "Aapki speed vs target", "आपकी गति बनाम लक्ष्य")} icon={<Clock className="ic" />}>
          <Bars
            h={150}
            fmt={(n) => `${n}s`}
            data={[
              { l: "%", v: 42, c: "var(--tick)" },
              { l: "P&L", v: 58, c: "var(--coin)" },
              { l: "T&W", v: 74, c: "var(--red)" },
              { l: "S&D", v: 45, c: "var(--tick)" },
              { l: "Prob", v: 66, c: "var(--coin)" },
              { l: "Series", v: 31, c: "var(--tick)" },
              { l: "Seat", v: 88, c: "var(--red)" },
              { l: "RC", v: 52, c: "var(--coin)" },
            ]}
          />
          <p className="tiny faint mt8">{t("Seconds per question. Target is 45 s; red is over a minute.", "Har sawaal ke second. Target 45 s; laal ek minute se zyada.", "प्रति प्रश्न सेकंड।")}</p>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- practice set ---------------- */

export function AptSetBody() {
  const t = useT();
  const ai = useAi();
  const [pick, setPick] = useState<number | null>(null);
  const [q, setQ] = useState(3);
  const opts = ["Increases by 4%", "Decreases by 4%", "No change", "Decreases by 2%"];
  const right = 1;
  return (
    <div className="col g16">
      <div className="set-top">
        <Link to="aptitude" className="btn sm ghost">
          <ArrowLeft />
          Aptitude
        </Link>
        <b className="small">{t("Successive percentages · set 2", "Successive percentage · set 2", "क्रमिक प्रतिशत · सेट 2")}</b>
        <span className="grow" />
        <span className="timer">
          <Clock className="faint" style={{ width: 14, height: 14 }} />
          0:48
        </span>
      </div>
      <div className="qnav">
        {Array.from({ length: 10 }, (_, i) => (
          <button key={i} className={`qn ${i < 3 ? (i === 1 ? "bad" : "ok") : i === q ? "now" : ""}`} onClick={() => setQ(i)}>
            {i + 1}
          </button>
        ))}
      </div>
      <section className="qcard">
        <div className="row between">
          <span className="eyebrow">
            {t("Question", "Sawaal", "प्रश्न")} {q + 1} / 10
          </span>
          <Level n={2} />
        </div>
        <p className="q-stem">
          {t(
            "The price of a phone rises by 20% in March and then falls by 20% in April. Compared with February, the April price:",
            "Phone ka daam March me 20% badha aur April me 20% ghata. February ke muqable April ka daam:",
            "फ़ोन की क़ीमत मार्च में 20% बढ़ी और अप्रैल में 20% घटी। फ़रवरी की तुलना में अप्रैल की क़ीमत:",
          )}
        </p>
        <div className="col g8">
          {opts.map((o, i) => (
            <button
              key={i}
              className={`option ${pick === i ? (i === right ? "right" : "wrong") : pick !== null && i === right ? "right" : ""}`}
              onClick={() => pick === null && setPick(i)}
              aria-pressed={pick === i}
            >
              <span className="opt-letter">{String.fromCharCode(65 + i)}</span>
              <span className="grow">{o}</span>
              {pick !== null && i === right && <Tick size={18} />}
              {pick === i && i !== right && <X className="t-red" />}
            </button>
          ))}
        </div>
        {pick !== null && (
          <div className="sol">
            <div className="sol-time">
              <span>
                {t("You", "Aap", "आप")} <b className="num">48 s</b>
              </span>
              <span>
                {t("Target", "Target", "लक्ष्य")} <b className="num">40 s</b>
              </span>
              <Badge tone={pick === right ? "tick" : "red"}>{pick === right ? t("Correct", "Sahi", "सही") : t("Wrong", "Galat", "गलत")}</Badge>
            </div>
            <div className="col g6">
              <span className="eyebrow">{t("Method", "Tareeka", "तरीका")}</span>
              <p className="small">
                {t("Take ₹100. After +20%: ₹120. After −20% of 120: ₹96. So it is 4% lower.", "₹100 maano. +20% ke baad ₹120. 120 ka −20%: ₹96. Yaani 4% kam.", "₹100 मानें। ₹120, फिर ₹96। 4% कम।")}
              </p>
            </div>
            <div className="shortcut">
              <Lightbulb />
              <div>
                <b className="small">{t("Shortcut", "Shortcut", "शॉर्टकट")}</b>
                <p className="small">
                  <Hl>a + b + ab/100</Hl> = 20 − 20 − 400/100 = <b>−4%</b>
                </p>
              </div>
            </div>
            <div className="row g8">
              <button className="btn sm ai" onClick={() => ai.setOpen(true)}>
                <Sparkles />
                {t("Why not 0%?", "0% kyun nahi?", "0% क्यों नहीं?")}
              </button>
              <span className="grow" />
              <button
                className="btn sm pri"
                onClick={() => {
                  setPick(null);
                  setQ((x) => Math.min(9, x + 1));
                }}
              >
                {t("Next", "Aage", "आगे")}
                <ArrowRight />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------- mock test (focus) ---------------- */

type QS = "ans" | "not" | "mark" | "am" | "nv";
const PAL: QS[] = ["ans", "ans", "not", "ans", "mark", "ans", "am", "ans", "nv", "ans", "not", "ans", "ans", "nv", "nv", "nv", "nv", "nv", "nv", "nv"];

export function AptMockScreen() {
  const t = useT();
  const [sec, setSec] = useState("q");
  const [cur, setCur] = useState(8);
  const [pick, setPick] = useState<number | null>(null);
  const [calc, setCalc] = useState(false);
  const [submit, setSubmit] = useState(false);
  const [left] = useCountdown(4 * 60 + 52);
  const warn = left < 300;
  const count = (s: QS) => PAL.filter((x) => x === s).length;
  return (
    <>
      <FocusBar
        back="aptitude"
        title={t("Mass-recruiter pattern A · mock 3", "Mass-recruiter pattern A · mock 3", "पैटर्न A · मॉक 3")}
        sub={t("Sahayak is off during tests", "Test me Sahayak band", "टेस्ट में सहायक बंद")}
        center={
          <span className={`timer big ${warn ? "warn" : ""}`}>
            <Timer style={{ width: 16, height: 16 }} />
            {hms(left)}
          </span>
        }
        right={
          <>
            <button className={`btn sm ${calc ? "pri" : ""}`} onClick={() => setCalc(!calc)}>
              <Calculator />
              <span className="hide-narrow">{t("Calculator", "Calculator", "कैलकुलेटर")}</span>
            </button>
            <button className="btn sm ink" onClick={() => setSubmit(true)}>
              <Send />
              {t("Submit", "Submit", "जमा")}
            </button>
          </>
        }
      />
      <div className="mock">
        <div className="mock-main">
          <div className="mock-secs">
            {[
              ["q", t("Quantitative", "Quantitative", "मात्रात्मक"), "20"],
              ["l", t("Logical", "Logical", "तार्किक"), "20"],
              ["v", t("Verbal", "Verbal", "मौखिक"), "20"],
            ].map(([id, n, c]) => (
              <button key={id} className={`msec ${sec === id ? "on" : ""}`} onClick={() => setSec(id)}>
                {n}
                <span className="tiny">{c}</span>
              </button>
            ))}
          </div>
          <div className="mock-q">
            <div className="row between">
              <b>
                {t("Question", "Sawaal", "प्रश्न")} {cur + 1}
              </b>
              <span className="tiny faint">{t("+1 for right · −0.25 for wrong", "+1 sahi · −0.25 galat", "+1 सही · −0.25 गलत")}</span>
            </div>
            <p className="q-stem">
              {t(
                "A can finish a job in 12 days and B in 18 days. They work together for 4 days, then A leaves. In how many more days will B finish the rest?",
                "A ek kaam 12 din me aur B 18 din me karta hai. Dono 4 din saath kaam karte hain, phir A chala jaata hai. Baaki kaam B kitne din me karega?",
                "A 12 दिन में और B 18 दिन में। 4 दिन साथ, फिर A चला गया। बाकी B कितने दिन में?",
              )}
            </p>
            <div className="col g8">
              {["6", "8", "7½", "9"].map((o, i) => (
                <button key={i} className="option" aria-pressed={pick === i} onClick={() => setPick(i)}>
                  <span className="radio" aria-checked={pick === i} />
                  <span className="grow">
                    {o} {t("days", "din", "दिन")}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="mock-foot">
            <button className="btn" onClick={() => setPick(null)}>
              <Eraser />
              {t("Clear", "Hatao", "हटाएँ")}
            </button>
            <button className="btn">
              <Flag />
              {t("Mark for review", "Review ke liye", "समीक्षा")}
            </button>
            <span className="grow" />
            <button className="btn" onClick={() => setCur((c) => Math.max(0, c - 1))}>
              <ArrowLeft />
            </button>
            <button className="btn pri" onClick={() => setCur((c) => Math.min(19, c + 1))}>
              {t("Save & next", "Save aur aage", "सहेजें और आगे")}
              <ArrowRight />
            </button>
          </div>
        </div>
        <aside className="mock-side">
          <div className="row g10">
            <span className="avatar" style={{ ["--av" as string]: "36px", ["--av-bg" as string]: "#2346E8" }}>
              AS
            </span>
            <div>
              <b className="small">Aarav Sharma</b>
              <div className="tiny faint">{t("Quantitative · 20 questions", "Quantitative · 20 sawaal", "मात्रात्मक · 20")}</div>
            </div>
          </div>
          <div className="pal">
            {PAL.map((s, i) => (
              <button key={i} className={`pq ${s} ${i === cur ? "cur" : ""}`} onClick={() => setCur(i)}>
                {i + 1}
              </button>
            ))}
          </div>
          <div className="pal-legend">
            {(
              [
                ["ans", t("Answered", "Diya", "उत्तर दिया")],
                ["not", t("Not answered", "Nahi diya", "उत्तर नहीं")],
                ["mark", t("Marked", "Marked", "चिह्नित")],
                ["am", t("Answered + marked", "Diya + marked", "उत्तर + चिह्नित")],
                ["nv", t("Not visited", "Nahi dekha", "नहीं देखा")],
              ] as [QS, string][]
            ).map(([k, l]) => (
              <span key={k}>
                <i className={`pq ${k}`}>{count(k)}</i>
                {l}
              </span>
            ))}
          </div>
          <div className="ai-off">
            <Lock />
            <span className="tiny">{t("Sahayak opens again for review after you submit.", "Submit ke baad review ke liye Sahayak khulega.", "सबमिट के बाद सहायक खुलेगा।")}</span>
          </div>
        </aside>
        {calc && (
          <div className="calc">
            <div className="row between">
              <b className="small">{t("Calculator", "Calculator", "कैलकुलेटर")}</b>
              <button className="icon-btn sm" onClick={() => setCalc(false)} aria-label="Close calculator">
                <X />
              </button>
            </div>
            <div className="calc-screen mono">1/12 + 1/18 = 0.1389</div>
            <div className="calc-keys">
              {["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "=", "+"].map((k) => (
                <button key={k} className={`ck mono ${"÷×−+=".includes(k) ? "op" : ""}`}>
                  {k}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <Modal
        open={submit}
        onClose={() => setSubmit(false)}
        title={t("Submit the test?", "Test submit karein?", "टेस्ट जमा करें?")}
        sub={t("You can't change answers after this.", "Iske baad jawab nahi badal sakte.", "इसके बाद उत्तर नहीं बदलेंगे।")}
        footer={
          <>
            <button className="btn ghost" onClick={() => setSubmit(false)}>
              {t("Keep going", "Jaari rakho", "जारी रखें")}
            </button>
            <button className="btn pri" onClick={() => navigate("apt-result")}>
              {t("Submit", "Submit", "जमा करें")}
            </button>
          </>
        }
      >
        <div className="tbl-wrap"><table className="tbl">
          <thead>
            <tr>
              <th>{t("Section", "Section", "खंड")}</th>
              <th className="r">{t("Answered", "Diye", "उत्तर")}</th>
              <th className="r">{t("Marked", "Marked", "चिह्नित")}</th>
              <th className="r">{t("Left", "Baaki", "बाकी")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Quantitative</td>
              <td className="r num">9</td>
              <td className="r num">2</td>
              <td className="r num t-red">9</td>
            </tr>
            <tr>
              <td>Logical</td>
              <td className="r num">17</td>
              <td className="r num">1</td>
              <td className="r num">2</td>
            </tr>
            <tr>
              <td>Verbal</td>
              <td className="r num">20</td>
              <td className="r num">0</td>
              <td className="r num">0</td>
            </tr>
          </tbody>
        </table></div>
      </Modal>
    </>
  );
}

/* ---------------- result ---------------- */

export function AptResultBody() {
  const t = useT();
  const [view, setView] = useState("time");
  const times = [32, 41, 55, 28, 90, 44, 61, 38, 72, 35, 49, 30, 66, 27, 84, 40, 52, 36, 58, 45];
  const res = [1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 2, 1, 1, 1, 0, 1, 1, 2, 1, 1];
  return (
    <div className="col g20">
      <section className="result-hero">
        <div className="col g8">
          <span className="eyebrow">{t("Mock result · pattern B · 19 Oct", "Mock result · pattern B · 19 Oct", "मॉक परिणाम")}</span>
          <div className="row g12" style={{ alignItems: "baseline" }}>
            <b className="display score">
              <CountUp to={36.5} decimals={1} />
            </b>
            <span className="display faint" style={{ fontSize: 30 }}>
              / 60
            </span>
          </div>
          <p className="muted">{t("Up 4.5 from your last mock. Time ran out in quant: 6 questions left blank.", "Pichhle mock se 4.5 zyada. Quant me samay khatam: 6 sawaal khaali.", "पिछले मॉक से 4.5 ज़्यादा।")}</p>
          <div className="row wrap g8">
            <Link to="apt-set" className="btn pri">
              <Target />
              {t("Practise time & work", "Time & work practice", "समय और कार्य")}
            </Link>
            <button className="btn">
              <Play />
              {t("Review answers", "Jawab dekho", "उत्तर देखें")}
            </button>
          </div>
        </div>
        <div className="sec-rings">
          {[
            ["Quant", 52, "pen"],
            ["Logical", 71, "ai"],
            ["Verbal", 64, "teal"],
          ].map(([n, v, c]) => (
            <div key={n as string} className="col g6" style={{ alignItems: "center" }}>
              <Ring v={v as number} size={84} stroke={8} tone={c as string}>
                <b className="num">{v}%</b>
              </Ring>
              <span className="small">{n}</span>
            </div>
          ))}
        </div>
      </section>
      <Card
        title={t("Every question", "Har sawaal", "हर प्रश्न")}
        icon={<BarChart3 className="ic" />}
        actions={
          <Seg
            value={view}
            onChange={setView}
            items={[
              { id: "time", label: t("Time", "Samay", "समय") },
              { id: "topic", label: t("Topic", "Topic", "विषय") },
            ]}
          />
        }
      >
        {view === "time" ? (
          <>
            <Bars h={160} fmt={(n) => `${n}s`} data={times.map((v, i) => ({ l: String(i + 1), v, c: res[i] === 1 ? "var(--tick)" : res[i] === 0 ? "var(--red)" : "var(--line-2)" }))} />
            <div className="legend mt12">
              <span>
                <i style={{ background: "var(--tick)" }} />
                {t("Right", "Sahi", "सही")}
              </span>
              <span>
                <i style={{ background: "var(--red)" }} />
                {t("Wrong", "Galat", "गलत")}
              </span>
              <span>
                <i style={{ background: "var(--line-2)" }} />
                {t("Skipped", "Chhoda", "छोड़ा")}
              </span>
              <span className="faint">{t("Quant section, seconds per question", "Quant section, har sawaal ke second", "प्रति प्रश्न सेकंड")}</span>
            </div>
          </>
        ) : (
          <div className="tbl-wrap"><table className="tbl">
            <thead>
              <tr>
                <th>{t("Topic", "Topic", "विषय")}</th>
                <th className="r">{t("Right", "Sahi", "सही")}</th>
                <th className="r">{t("Avg time", "Avg samay", "औसत")}</th>
                <th>{t("Verdict", "Faisla", "निर्णय")}</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Percentages", "4 / 4", "34 s", "tick", "Strong"],
                ["Time & work", "1 / 4", "78 s", "red", "Practise"],
                ["Profit & loss", "3 / 4", "47 s", "coin", "Speed up"],
                ["Probability", "2 / 4", "61 s", "coin", "Speed up"],
              ].map(([a, b, c, tone, v]) => (
                <tr key={a}>
                  <td>{a}</td>
                  <td className="r num">{b}</td>
                  <td className="r num">{c}</td>
                  <td>
                    <Badge tone={tone as "tick"}>{v}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>
      <div className="grid c3">
        <div className="card pad stat">
          <span className="k">{t("Accuracy", "Accuracy", "सटीकता")}</span>
          <span className="v">78%</span>
          <span className="d up">
            <CircleCheck /> 46 / 59 {t("attempted", "attempt kiye", "प्रयास")}
          </span>
        </div>
        <div className="card pad stat">
          <span className="k">{t("Negative marks", "Negative marks", "ऋणात्मक")}</span>
          <span className="v t-red">−3.25</span>
          <span className="d down">
            <CircleX /> 13 {t("wrong", "galat", "गलत")}
          </span>
        </div>
        <div className="card pad stat">
          <span className="k">{t("Time left at end", "Ant me bacha samay", "बचा समय")}</span>
          <span className="v">0:00</span>
          <span className="d">{t("Verbal finished 6 min early", "Verbal 6 min pehle khatam", "मौखिक 6 मिनट पहले")}</span>
        </div>
      </div>
    </div>
  );
}
