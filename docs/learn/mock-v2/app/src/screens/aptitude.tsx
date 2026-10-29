import { useState } from "react";
import {
  Calculator,
  Percent,
  Brain,
  BookA,
  ArrowRight,
  PlayCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Flag,
  Eraser,
  Timer,
  CircleCheck,
  CircleX,
  Lightbulb,
  Zap,
  Ban,
  ShieldCheck,
  Send,
} from "lucide-react";
import { Link, hms, navigate, useCountdown, useT } from "../lib/core";
import { Bar, Ring, SampleNote, Modal } from "../ui/kit";
import { PageHead } from "../ui/shell";
import { FocusBar } from "../ui/focus";

type Tri = [string, string, string];

const SECTIONS: { icon: typeof Percent; name: Tri; color: string; done: number; total: number; topics: [string, number][] }[] = [
  {
    icon: Percent,
    name: ["Quantitative", "Quantitative", "गणितीय"],
    color: "var(--t-apt)",
    done: 210,
    total: 900,
    topics: [
      ["Percentages", 80],
      ["Profit and loss", 55],
      ["Time, speed and distance", 40],
      ["Time and work", 25],
      ["Ratio and proportion", 60],
      ["Probability", 10],
    ],
  },
  {
    icon: Brain,
    name: ["Logical reasoning", "Logical reasoning", "तार्किक"],
    color: "var(--t-core)",
    done: 96,
    total: 600,
    topics: [
      ["Series", 70],
      ["Coding and decoding", 45],
      ["Blood relations", 30],
      ["Seating arrangement", 12],
      ["Syllogisms", 20],
      ["Data sufficiency", 0],
    ],
  },
  {
    icon: BookA,
    name: ["Verbal ability", "Verbal ability", "भाषा"],
    color: "var(--t-dev)",
    done: 34,
    total: 300,
    topics: [
      ["Reading comprehension", 15],
      ["Sentence correction", 30],
      ["Para jumbles", 8],
      ["Vocabulary in context", 22],
    ],
  },
];

export function AptitudeBody() {
  const t = useT();
  return (
    <div className="page stagger">
      <PageHead
        title={t("Aptitude", "Aptitude", "एप्टीट्यूड")}
        sub={t(
          "Every topic has a short lesson, practice sets with full solutions, and timed mocks in the patterns companies use.",
          "Har topic me chhota lesson, poore hal wale practice sets, aur company pattern ke timed mocks.",
          "हर विषय में पाठ, अभ्यास सेट और समयबद्ध मॉक।",
        )}
        actions={
          <Link to="apt-mock" className="btn primary">
            <Timer size={15} /> {t("Take a 30-min mock", "30 min ka mock do", "30 मिनट का मॉक")}
          </Link>
        }
      />
      <div className="grid c3">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <section key={s.name[0]} className="panel apt-sec">
              <div className="apt-sec-head">
                <span className="track-ico" style={{ color: s.color, background: `color-mix(in srgb, ${s.color} 14%, transparent)` }}>
                  <Icon size={19} />
                </span>
                <div className="grow">
                  <b>{t(...s.name)}</b>
                  <span className="faint num" style={{ fontSize: "var(--fs-12)", display: "block" }}>
                    {s.done} / {s.total} {t("questions", "sawaal", "सवाल")}
                  </span>
                </div>
                <Ring value={(s.done / s.total) * 100} size={44} stroke={4} color={s.color}>
                  <b style={{ fontSize: 10 }} className="num">
                    {Math.round((s.done / s.total) * 100)}%
                  </b>
                </Ring>
              </div>
              <div className="list">
                {s.topics.map(([n, p]) => (
                  <Link key={n} to="apt-set" className="list-row apt-topic">
                    <span className="t">{n}</span>
                    <span style={{ width: 70 }}>
                      <Bar value={p} thin />
                    </span>
                    <span className="faint num" style={{ fontSize: "var(--fs-11)", width: 30, textAlign: "right" }}>
                      {p}%
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <section className="stack">
        <div className="section-title">
          <h2>{t("Company pattern mocks", "Company pattern mocks", "कंपनी पैटर्न मॉक")}</h2>
          <SampleNote />
        </div>
        <div className="grid c3">
          {[
            ["Service pattern A", "3 sections · 90 min · −0.25 per wrong", "Updated Aug 2026 · 23 reports"],
            ["Service pattern B", "Adaptive · 65 min · no negative", "Updated Sep 2026 · 17 reports"],
            ["Product OA (aptitude part)", "20 questions · 30 min", "Updated Oct 2026 · 9 reports"],
          ].map(([n, d, src]) => (
            <Link key={n} to="apt-mock" className="panel pad stack hover-card">
              <b>{n}</b>
              <span className="muted" style={{ fontSize: "var(--fs-13)" }}>
                {d}
              </span>
              <span className="faint" style={{ fontSize: "var(--fs-11)", display: "flex", gap: 6, alignItems: "center" }}>
                <ShieldCheck size={12} /> {src}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------------- practice set ---------------- */

const OPTIONS: Tri[] = [
  ["It falls by 4%", "4% kam hota hai", "4% घटता है"],
  ["No change", "Koi badlaav nahi", "कोई बदलाव नहीं"],
  ["It rises by 4%", "4% badhta hai", "4% बढ़ता है"],
  ["It falls by 2%", "2% kam hota hai", "2% घटता है"],
];

export function AptSetBody() {
  const t = useT();
  const [pick, setPick] = useState<number | null>(1);
  const correct = 0;
  const states = Array.from({ length: 30 }, (_, i) => (i < 6 ? (i === 2 || i === 4 ? "bad" : "ok") : i === 6 ? "now" : i === 11 ? "review" : ""));
  return (
    <div className="page">
      <PageHead
        crumbs={[
          { to: "aptitude", label: t("Aptitude", "Aptitude", "एप्टीट्यूड") },
          { label: t("Percentages · Set 2", "Percentages · Set 2", "प्रतिशत · सेट 2") },
        ]}
        title={t("Successive percentage change", "Successive percentage change", "क्रमिक प्रतिशत परिवर्तन")}
        sub={t("Untimed practice. Answer, then read the full solution.", "Bina timer. Jawab do, phir poora hal padho.", "बिना समय सीमा।")}
      />
      <div className="apt-layout">
        <div className="stack lg">
          <section className="panel pad-lg stack">
            <span className="tag outline" style={{ alignSelf: "flex-start" }}>
              {t("Question", "Sawaal", "सवाल")} 7 / 30
            </span>
            <p className="q-text">
              {t(
                "The price of a phone rises by 20% in March and then falls by 20% in April. Compared with February, the price in April:",
                "Ek phone ka daam March me 20% badhta hai aur April me 20% ghatta hai. February ke mukable April ka daam:",
                "एक फ़ोन का दाम मार्च में 20% बढ़ता है और अप्रैल में 20% घटता है। फ़रवरी की तुलना में अप्रैल का दाम:",
              )}
            </p>
            <div className="opts">
              {OPTIONS.map((o, i) => {
                const state = pick === null ? "" : i === correct ? "right" : i === pick ? "wrong" : "";
                return (
                  <button key={i} type="button" className={`opt ${state}`} onClick={() => setPick(i)} aria-pressed={pick === i}>
                    <span className="opt-key">{String.fromCharCode(65 + i)}</span>
                    {t(...o)}
                    {state === "right" && <CircleCheck size={17} className="opt-ic" />}
                    {state === "wrong" && <CircleX size={17} className="opt-ic" />}
                  </button>
                );
              })}
            </div>
            {pick !== null && (
              <p className={`q-feedback ${pick === correct ? "ok" : "bad"}`}>
                {pick === correct
                  ? t("Correct. 31 seconds.", "Sahi. 31 second.", "सही। 31 सेकंड।")
                  : t("Not quite. Most people pick this one; here is why it is wrong.", "Nahi. Zyadatar log yahi chunte hain; kyun galat hai, neeche.", "नहीं। क्यों गलत है, नीचे देखें।")}
              </p>
            )}
          </section>

          {pick !== null && (
            <section className="panel pad-lg solution">
              <div className="row between wrap">
                <h2>{t("Solution", "Hal", "हल")}</h2>
                <button type="button" className="btn ghost sm">
                  <PlayCircle size={14} /> {t("Video · 4 min (optional)", "Video · 4 min (optional)", "वीडियो · 4 मिनट")}
                </button>
              </div>
              <div className="sol-block">
                <h3>
                  <Lightbulb size={15} /> {t("Intuition", "Samajh", "समझ")}
                </h3>
                <p>
                  {t(
                    "Percentage changes multiply; they do not cancel. The 20% fall is taken on the higher price, so it removes more than the rise added.",
                    "Percentage badlaav guna hote hain, katte nahi. 20% ki girawat bade daam par lagti hai, isliye jitna badha tha usse zyada ghatata hai.",
                    "प्रतिशत गुणा होते हैं, कटते नहीं।",
                  )}
                </p>
              </div>
              <div className="sol-block">
                <h3>{t("Approach", "Tareeka", "तरीका")}</h3>
                <ol className="sol-steps">
                  <li>
                    {t("Take the February price as 100.", "February ka daam 100 maan lo.", "फ़रवरी का दाम 100 मानें।")}
                  </li>
                  <li>
                    {t("After the rise:", "Badhne ke baad:", "बढ़ने के बाद:")}{" "}
                    <math>
                      <mn>100</mn>
                      <mo>×</mo>
                      <mn>1.2</mn>
                      <mo>=</mo>
                      <mn>120</mn>
                    </math>
                  </li>
                  <li>
                    {t("After the fall:", "Girne ke baad:", "घटने के बाद:")}{" "}
                    <math>
                      <mn>120</mn>
                      <mo>×</mo>
                      <mn>0.8</mn>
                      <mo>=</mo>
                      <mn>96</mn>
                    </math>
                  </li>
                  <li>{t("100 → 96 is a 4% fall.", "100 → 96 matlab 4% kam.", "100 → 96 यानी 4% कम।")}</li>
                </ol>
              </div>
              <div className="sol-block">
                <h3>{t("Why it works", "Kyun chalta hai", "क्यों काम करता है")}</h3>
                <div className="formula">
                  <math display="block">
                    <mrow>
                      <mo>(</mo>
                      <mn>1</mn>
                      <mo>+</mo>
                      <mfrac>
                        <mi>x</mi>
                        <mn>100</mn>
                      </mfrac>
                      <mo>)</mo>
                      <mo>(</mo>
                      <mn>1</mn>
                      <mo>−</mo>
                      <mfrac>
                        <mi>x</mi>
                        <mn>100</mn>
                      </mfrac>
                      <mo>)</mo>
                      <mo>=</mo>
                      <mn>1</mn>
                      <mo>−</mo>
                      <msup>
                        <mrow>
                          <mo>(</mo>
                          <mfrac>
                            <mi>x</mi>
                            <mn>100</mn>
                          </mfrac>
                          <mo>)</mo>
                        </mrow>
                        <mn>2</mn>
                      </msup>
                    </mrow>
                  </math>
                </div>
                <p className="muted">
                  {t("So an equal rise and fall of x% always loses x²/100 %. Here 20²/100 = 4.", "Isliye barabar x% badhna-ghatna hamesha x²/100 % ka nuksaan. Yahan 20²/100 = 4.", "इसलिए हमेशा x²/100 % का नुकसान।")}
                </p>
              </div>
              <div className="sol-two">
                <div className="callout">
                  <h3>
                    <Zap size={15} style={{ color: "var(--plus)" }} /> {t("Shortcut", "Shortcut", "शॉर्टकट")}
                  </h3>
                  <p>
                    {t("Two changes a% and b%: net = a + b + ab/100. Here 20 − 20 − 400/100 = −4.", "Do badlaav a% aur b%: net = a + b + ab/100. Yahan 20 − 20 − 4 = −4.", "a + b + ab/100")}
                  </p>
                </div>
                <div className="callout">
                  <h3>
                    <Ban size={15} /> {t("When it does not apply", "Kab nahi lagta", "कब लागू नहीं")}
                  </h3>
                  <p>{t("When the second change is on the original price, not the new one (for example, a flat discount on MRP).", "Jab doosra badlaav purane daam par ho, naye par nahi (jaise MRP par seedha discount).", "जब दूसरा बदलाव मूल दाम पर हो।")}</p>
                </div>
              </div>
            </section>
          )}

          <div className="row between">
            <button type="button" className="btn secondary">
              <ChevronLeft size={15} /> {t("Previous", "Pichhla", "पिछला")}
            </button>
            <button type="button" className="btn primary" onClick={() => setPick(null)}>
              {t("Next question", "Agla sawaal", "अगला सवाल")} <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <aside className="stack">
          <div className="panel pad stack">
            <div className="row between">
              <span className="eyebrow">{t("Question palette", "Question palette", "प्रश्न पैलेट")}</span>
              <span className="faint num" style={{ fontSize: "var(--fs-12)" }}>
                6/30
              </span>
            </div>
            <div className="palette">
              {states.map((s, i) => (
                <button key={i} type="button" className={`pal ${s}`} aria-label={`Question ${i + 1}`}>
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="legend">
              <span>
                <i className="pal ok" /> {t("Correct", "Sahi", "सही")}
              </span>
              <span>
                <i className="pal bad" /> {t("Wrong", "Galat", "गलत")}
              </span>
              <span>
                <i className="pal now" /> {t("Current", "Abhi", "अभी")}
              </span>
              <span>
                <i className="pal review" /> {t("Saved for later", "Baad ke liye", "बाद के लिए")}
              </span>
            </div>
          </div>
          <div className="panel pad stack">
            <b style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Sparkles size={15} style={{ color: "var(--action)" }} /> Sahayak
            </b>
            <p className="muted" style={{ fontSize: "var(--fs-13)" }}>
              {t("Stuck? Ask why your option is wrong. It explains with your own answer, not a new one.", "Atke ho? Poochho aapka option galat kyun hai. Aapke hi jawab se samjhata hai.", "अटके हैं? पूछें आपका विकल्प गलत क्यों है।")}
            </p>
            <button type="button" className="btn secondary sm">
              {t("Why is B wrong?", "B galat kyun?", "B गलत क्यों?")}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- mock test ---------------- */

export function AptMockScreen() {
  const t = useT();
  const [left] = useCountdown(29 * 60 + 37);
  const [sec, setSec] = useState(0);
  const [pick, setPick] = useState<number | null>(0);
  const [calc, setCalc] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const pal = Array.from({ length: 20 }, (_, i) => (i < 4 ? "ans" : i === 4 ? "now" : i === 7 ? "review" : i === 9 ? "ans-review" : i < 9 ? "seen" : ""));
  return (
    <div className="exam">
      <FocusBar
        back="aptitude"
        backLabel={t("Leave the mock", "Mock chhodo", "मॉक छोड़ें")}
        title={<b>{t("Aptitude mock · Service pattern A", "Aptitude mock · Service pattern A", "एप्टीट्यूड मॉक")}</b>}
        center={
          <span className={`exam-timer ${left < 300 ? "urgent" : ""}`} role="timer">
            <Timer size={15} /> <span className="num">{hms(left)}</span>
          </span>
        }
        right={
          <>
            <button type="button" className="btn ghost sm" onClick={() => setCalc((c) => !c)}>
              <Calculator size={14} /> <span className="hide-phone">{t("Calculator", "Calculator", "कैलकुलेटर")}</span>
            </button>
            <button type="button" className="btn primary sm" onClick={() => setConfirm(true)}>
              <Send size={13} /> {t("Submit", "Submit", "जमा करें")}
            </button>
          </>
        }
      />
      <div className="exam-body">
        <main className="exam-main">
          <div className="exam-secs" role="tablist" aria-label="Sections">
            {[t("Quantitative", "Quantitative", "गणितीय"), t("Logical", "Logical", "तार्किक"), t("Verbal", "Verbal", "भाषा")].map((n, i) => (
              <button key={i} type="button" role="tab" aria-selected={sec === i} onClick={() => setSec(i)}>
                {n} <span className="faint num">{i === 0 ? "5/20" : "0/20"}</span>
              </button>
            ))}
          </div>
          <div className="exam-q">
            <div className="row between">
              <span className="tag outline">{t("Question", "Sawaal", "सवाल")} 5</span>
              <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
                +1 / −0.25
              </span>
            </div>
            <p className="q-text">
              {t(
                "If CARE is written as 3-1-18-5, how is ROAD written in the same code?",
                "Agar CARE ko 3-1-18-5 likha jaata hai, to ROAD ko isi code me kaise likhenge?",
                "यदि CARE को 3-1-18-5 लिखा जाता है, तो ROAD को कैसे लिखेंगे?",
              )}
            </p>
            <div className="opts">
              {["18-15-1-4", "18-15-2-4", "17-15-1-4", "18-14-1-4"].map((o, i) => (
                <button key={o} type="button" className={`opt ${pick === i ? "picked" : ""}`} aria-pressed={pick === i} onClick={() => setPick(i)}>
                  <span className="opt-key">{String.fromCharCode(65 + i)}</span>
                  <span className="mono">{o}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="exam-foot">
            <button type="button" className="btn secondary">
              <Flag size={14} /> <span className="hide-phone">{t("Mark for review & next", "Review ke liye mark", "समीक्षा हेतु चिह्नित")}</span>
            </button>
            <button type="button" className="btn ghost" onClick={() => setPick(null)}>
              <Eraser size={14} /> {t("Clear", "Hatao", "हटाएँ")}
            </button>
            <span className="grow" />
            <button type="button" className="btn primary">
              {t("Save & next", "Save & next", "सहेजें और आगे")} <ArrowRight size={14} />
            </button>
          </div>
        </main>
        <aside className="exam-side">
          <div className="row between">
            <b>{t("Quantitative", "Quantitative", "गणितीय")}</b>
            <span className="faint num" style={{ fontSize: "var(--fs-12)" }}>
              20
            </span>
          </div>
          <div className="palette nta">
            {pal.map((s, i) => (
              <button key={i} type="button" className={`pal ${s}`} aria-label={`Question ${i + 1}`}>
                {i + 1}
              </button>
            ))}
          </div>
          <div className="legend">
            <span>
              <i className="pal ans" /> {t("Answered", "Jawab diya", "उत्तर दिया")} · 5
            </span>
            <span>
              <i className="pal seen" /> {t("Not answered", "Jawab nahi", "उत्तर नहीं")} · 3
            </span>
            <span>
              <i className="pal review" /> {t("For review", "Review", "समीक्षा")} · 1
            </span>
            <span>
              <i className="pal ans-review" /> {t("Answered + review", "Jawab + review", "उत्तर + समीक्षा")} · 1
            </span>
            <span>
              <i className="pal" /> {t("Not visited", "Nahi dekha", "नहीं देखा")} · 10
            </span>
          </div>
          <p className="faint" style={{ fontSize: "var(--fs-11)" }}>
            {t("Same engine and palette as college exams on Parikshaa. Answers save every few seconds.", "Wahi engine jo college exams me. Jawab har kuch second me save.", "कॉलेज परीक्षा वाला इंजन।")}
          </p>
        </aside>
      </div>
      {calc && (
        <div className="calc" role="dialog" aria-label="Calculator">
          <div className="calc-screen num">120 × 0.8 = 96</div>
          <div className="calc-keys">
            {["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "=", "+"].map((k) => (
              <button key={k} type="button">
                {k}
              </button>
            ))}
          </div>
        </div>
      )}
      {confirm && (
        <Modal
          title={t("Submit the mock?", "Mock submit karein?", "मॉक जमा करें?")}
          onClose={() => setConfirm(false)}
          foot={
            <>
              <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>
                {t("Keep going", "Jaari rakho", "जारी रखें")}
              </button>
              <button type="button" className="btn primary" onClick={() => navigate("apt-result")}>
                {t("Submit", "Submit", "जमा करें")}
              </button>
            </>
          }
        >
          <table className="dtable">
            <thead>
              <tr>
                <th>{t("Section", "Section", "खंड")}</th>
                <th className="r">{t("Answered", "Jawab", "उत्तर")}</th>
                <th className="r">{t("Review", "Review", "समीक्षा")}</th>
                <th className="r">{t("Left", "Baaki", "बाकी")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Quantitative</td>
                <td className="r num">6</td>
                <td className="r num">2</td>
                <td className="r num">12</td>
              </tr>
              <tr>
                <td>Logical</td>
                <td className="r num">0</td>
                <td className="r num">0</td>
                <td className="r num">20</td>
              </tr>
              <tr>
                <td>Verbal</td>
                <td className="r num">0</td>
                <td className="r num">0</td>
                <td className="r num">20</td>
              </tr>
            </tbody>
          </table>
          <p className="faint" style={{ fontSize: "var(--fs-12)", marginTop: 10 }}>
            {t("29 minutes are still left. You cannot change answers after submitting.", "Abhi 29 minute baaki. Submit ke baad jawab nahi badlenge.", "29 मिनट बाकी हैं।")}
          </p>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- result ---------------- */

export function AptResultBody() {
  const t = useT();
  const qs = Array.from({ length: 60 }, (_, i) => {
    const r = (i * 37) % 11;
    const st = r < 6 ? "ok" : r < 8 ? "bad" : "skip";
    return { st, secs: 20 + ((i * 53) % 110) };
  });
  const max = Math.max(...qs.map((q) => q.secs));
  return (
    <div className="page stagger">
      <PageHead
        crumbs={[{ to: "aptitude", label: t("Aptitude", "Aptitude", "एप्टीट्यूड") }, { label: t("Mock result", "Mock ka nateeja", "मॉक का नतीजा") }]}
        title={t("Mock result · Service pattern A", "Mock ka nateeja · Service pattern A", "मॉक का नतीजा")}
        sub={t("Submitted today at 6:42 PM · 58 of 60 minutes used", "Aaj 6:42 PM par submit · 60 me se 58 minute", "आज 6:42 बजे जमा")}
        actions={
          <Link to="apt-set" className="btn primary">
            <Zap size={15} /> {t("Drill the weakest topic", "Kamzor topic ka drill", "कमज़ोर विषय का अभ्यास")}
          </Link>
        }
      />
      <div className="result-top">
        <div className="panel pad-lg score-card">
          <Ring value={(36.5 / 60) * 100} size={128} stroke={11}>
            <b className="num" style={{ fontSize: "var(--fs-28)" }}>
              36.5
            </b>
            <small>/ 60</small>
          </Ring>
          <div className="stack sm">
            <span className="tag ok" style={{ alignSelf: "flex-start" }}>
              {t("Above the usual cut-off (32)", "Aam cut-off (32) se upar", "सामान्य कट-ऑफ़ से ऊपर")}
            </span>
            <span className="muted" style={{ fontSize: "var(--fs-13)" }}>
              {t("38 right · 6 wrong (−1.5) · 16 left", "38 sahi · 6 galat (−1.5) · 16 chhode", "38 सही · 6 गलत · 16 छोड़े")}
            </span>
            <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
              {t("Percentile appears after 500 people take this mock (now 212).", "Percentile 500 logon ke baad (abhi 212).", "500 लोगों के बाद प्रतिशतक।")}
            </span>
          </div>
        </div>
        <div className="panel pad-lg stack">
          <b>{t("By section", "Section-wise", "खंड-वार")}</b>
          {[
            ["Quantitative", 15, 20],
            ["Logical", 13.5, 20],
            ["Verbal", 8, 20],
          ].map(([n, s, tot]) => (
            <div key={n as string} className="weak-row" style={{ gridTemplateColumns: "110px minmax(0,1fr) 60px" }}>
              <span>{n}</span>
              <Bar value={((s as number) / (tot as number)) * 100} tone={(s as number) < 10 ? "bad" : undefined} />
              <span>
                {s}/{tot}
              </span>
            </div>
          ))}
        </div>
      </div>
      <section className="panel pad-lg stack">
        <div className="row between wrap">
          <b>{t("Time on each question", "Har sawaal par samay", "हर सवाल पर समय")}</b>
          <div className="legend" style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <span>
              <i className="pal ok" /> {t("Right", "Sahi", "सही")}
            </span>
            <span>
              <i className="pal bad" /> {t("Wrong", "Galat", "गलत")}
            </span>
            <span>
              <i className="pal" /> {t("Left", "Chhoda", "छोड़ा")}
            </span>
          </div>
        </div>
        <div className="qtime" role="img" aria-label="Seconds spent per question">
          {qs.map((q, i) => (
            <i key={i} className={q.st} style={{ height: `${(q.secs / max) * 100}%` }} title={`Q${i + 1}: ${q.secs}s`} />
          ))}
        </div>
        <div className="row between faint num" style={{ fontSize: "var(--fs-11)" }}>
          <span>Q1</span>
          <span>{t("Quantitative", "Quantitative", "गणितीय")} │ Logical │ Verbal</span>
          <span>Q60</span>
        </div>
        <p className="muted" style={{ fontSize: "var(--fs-13)" }}>
          {t(
            "You spent over 2 minutes on 7 questions and got 4 of them wrong. In this pattern, skipping after 75 seconds would have saved about 6 minutes.",
            "7 sawaalon par 2 minute se zyada lage aur unme se 4 galat. Is pattern me 75 second ke baad skip karte to ~6 minute bachte.",
            "7 सवालों पर 2 मिनट से ज़्यादा लगे।",
          )}
        </p>
      </section>
    </div>
  );
}
