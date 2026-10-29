import { useState } from "react";
import { Eye, Flame, Smartphone, Check, X, ArrowRight, Zap, CircleX, GripVertical, ChevronUp, ChevronDown, QrCode } from "lucide-react";
import { Link, useT } from "../lib/core";
import { Bar, Code, Confetti, Diya } from "../ui/kit";
import { PageHead } from "../ui/shell";

type Tri = [string, string, string];

/* ---------------- revision ---------------- */

const CARDS: { kind: "mistake" | "concept"; front: Tri; back: Tri; code?: string }[] = [
  {
    kind: "mistake",
    front: ["Your pair-sum code failed on a = [2³⁰, 2³⁰], target = 2³¹. Why?", "Aapka pair-sum code a = [2³⁰, 2³⁰], target = 2³¹ par fail hua. Kyun?", "आपका कोड क्यों फेल हुआ?"],
    back: ["The sum 2³¹ does not fit in a 32-bit int and wraps to a negative number. Add in long long.", "Sum 2³¹ 32-bit int me nahi aata aur negative ho jaata hai. long long me jodo.", "योग int में नहीं आता।"],
    code: "int sum = a[L] + a[R];   // from your try on 20 Oct",
  },
  {
    kind: "concept",
    front: ["When does two pointers work on a pair-sum problem?", "Pair-sum par two pointers kab chalta hai?", "दो पॉइंटर कब काम करते हैं?"],
    back: ["When the array is sorted, so moving L right only increases the sum and moving R left only decreases it.", "Jab array sorted ho, taaki L daayein sum badhaye aur R baayein ghataye.", "जब ऐरे क्रमबद्ध हो।"],
  },
];

export function RevisionBody() {
  const t = useT();
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [done, setDone] = useState(2);
  const c = CARDS[i % CARDS.length];
  const next = () => {
    setFlip(false);
    setDone((d) => Math.min(6, d + 1));
    setI((x) => x + 1);
  };
  return (
    <div className="page narrow stagger">
      <PageHead
        title={t("Revision", "Revision", "दोहराई")}
        sub={t("Cards come back just before you would forget them. Half of today's are from your own mistakes.", "Cards tab wapas aate hain jab bhoolne wale ho. Aaj ke aadhe aapki galtiyon se.", "भूलने से ठीक पहले कार्ड लौटते हैं।")}
      />
      <div className="row" style={{ gap: 12 }}>
        <span className="grow">
          <Bar value={(done / 6) * 100} />
        </span>
        <span className="faint num" style={{ fontSize: "var(--fs-12)" }}>
          {done} / 6 {t("today", "aaj", "आज")}
        </span>
      </div>
      {done >= 6 ? (
        <div className="panel pad-lg stack" style={{ alignItems: "center", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <Confetti />
          <Diya size={88} mood="cheer" />
          <h2 style={{ fontSize: "var(--fs-22)", fontWeight: 800 }}>{t("All revised for today", "Aaj ka revision poora", "आज की दोहराई पूरी")}</h2>
          <p className="muted">{t("Next cards come back tomorrow. That's enough for today.", "Agle cards kal. Aaj ke liye kaafi.", "अगले कार्ड कल।")}</p>
          <Link to="aaj" className="btn primary">
            {t("Back to Today", "Aaj par wapas", "आज पर वापस")}
          </Link>
        </div>
      ) : (
        <>
          <div className={`flashcard ${flip ? "flipped" : ""}`} key={i}>
            <div className="fc-face fc-front">
              <span className={`tag ${c.kind === "mistake" ? "bad" : "info"}`} style={{ alignSelf: "flex-start" }}>
                {c.kind === "mistake" ? t("Your mistake", "Aapki galti", "आपकी गलती") : t("Concept", "Concept", "अवधारणा")}
              </span>
              <p className="fc-q">{t(...c.front)}</p>
              {c.code && (
                <div className="code-card">
                  <Code code={c.code} bad={[1]} />
                </div>
              )}
              <button type="button" className="btn secondary" style={{ alignSelf: "center" }} onClick={() => setFlip(true)}>
                <Eye size={15} /> {t("Show answer", "Jawab dikhao", "उत्तर दिखाएँ")}
              </button>
            </div>
            <div className="fc-face fc-back">
              <span className="eyebrow">{t("Answer", "Jawab", "उत्तर")}</span>
              <p className="fc-q">{t(...c.back)}</p>
            </div>
          </div>
          {flip && (
            <div className="grade-row">
              {(
                [
                  ["again", t("Forgot", "Bhool gaya", "भूल गया"), "10 min"],
                  ["hard", t("Hard", "Mushkil", "कठिन"), t("1 day", "1 din", "1 दिन")],
                  ["good", t("Got it", "Aa gaya", "आ गया"), t("4 days", "4 din", "4 दिन")],
                  ["easy", t("Easy", "Aasaan", "आसान"), t("9 days", "9 din", "9 दिन")],
                ] as [string, string, string][]
              ).map(([k, l, w]) => (
                <button key={k} type="button" className={`grade ${k}`} onClick={next}>
                  <b>{l}</b>
                  <small>{w}</small>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <section className="stack">
        <div className="section-title">
          <h2>{t("Mistake notebook", "Galtiyon ki copy", "गलतियों की कॉपी")}</h2>
          <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
            {t("Made from your wrong answers", "Aapke galat jawabon se bani", "आपके गलत उत्तरों से")}
          </span>
        </div>
        <div className="panel list">
          {[
            [t("Overflow in a sum", "Sum me overflow", "योग में ओवरफ़्लो"), 3, "Pair with target sum · Towers in a row"],
            [t("Equal is not greater", "Barabar, bada nahi", "बराबर बड़ा नहीं"), 2, "Towers in a row"],
            [t("Off by one in binary search", "Binary search me ek ki galti", "बाइनरी सर्च"), 2, "First bad version"],
          ].map(([n, c2, w]) => (
            <div key={n as string} className="list-row">
              <CircleX size={15} style={{ color: "var(--bad)" }} />
              <span className="t">
                {n}
                <small>{w}</small>
              </span>
              <span className="tag bad">×{c2}</span>
              <Link to="sheet" className="btn ghost sm">
                <Zap size={13} /> {t("Drill", "Drill", "अभ्यास")}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------------- daily 10 ---------------- */

const PARSONS = ["for (int i = 0; i < n; i++) {", "  if (a[i] > best) best = a[i];", "int best = a[0];", "}", "return best;"];

export function DailyBody() {
  const t = useT();
  const [q, setQ] = useState(3);
  const [pick, setPick] = useState<number | null>(null);
  const [lines, setLines] = useState([0, 1, 2, 3, 4]);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= lines.length) return;
    setLines((l) => {
      const c = l.slice();
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  };
  const parsonsOk = lines.join() === "2,0,1,3,4";
  return (
    <div className="page daily-page">
      <div className="daily-wrap">
        <div className="daily-phone">
          <div className="dp-top">
            <Link to="aaj" className="icon-btn" aria-label="Close">
              <X size={18} />
            </Link>
            <div className="dp-dots" aria-label={`Question ${q + 1} of 10`}>
              {Array.from({ length: 10 }, (_, i) => (
                <i key={i} className={i < q ? "done" : i === q ? "now" : ""} />
              ))}
            </div>
            <span className="row" style={{ gap: 4, fontWeight: 800, color: "var(--plus)" }}>
              <Flame size={16} /> 12
            </span>
          </div>
          {q === 3 ? (
            <div className="dp-body" key="q3">
              <span className="eyebrow">{t("Predict the output", "Output batao", "आउटपुट बताएँ")}</span>
              <div className="code-card">
                <Code code={`a = [1, 2, 3]\nfor x in a[::-1]:\n    print(x, end="")`} />
              </div>
              <div className="dp-opts">
                {["123", "321", "3 2 1", t("Error", "Error", "त्रुटि")].map((o, i) => (
                  <button
                    key={o}
                    type="button"
                    className={`opt ${pick === null ? "" : i === 1 ? "right" : i === pick ? "wrong" : ""}`}
                    onClick={() => setPick(i)}
                  >
                    <span className="mono">{o}</span>
                  </button>
                ))}
              </div>
              {pick !== null && (
                <div className={`dp-feedback ${pick === 1 ? "ok" : "bad"}`}>
                  {pick === 1 ? <Check size={16} /> : <X size={16} />}
                  <span>
                    {pick === 1
                      ? t("Right. [::-1] walks the list backwards; end=\"\" keeps it on one line.", "Sahi. [::-1] list ko ulta chalata hai; end=\"\" ek line me rakhta hai.", "सही।")
                      : t("a[::-1] reverses the list, and end=\"\" prints no spaces: 321.", "a[::-1] list ulti karta hai, end=\"\" space nahi deta: 321.", "321 छपेगा।")}
                  </span>
                </div>
              )}
              <button
                type="button"
                className="btn primary lg block dp-cta"
                disabled={pick === null}
                onClick={() => {
                  setQ(4);
                  setPick(null);
                }}
              >
                {t("Continue", "Aage", "आगे")} <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="dp-body" key="q4">
              <span className="eyebrow">{t("Put the lines in order", "Lines ka kram lagao", "पंक्तियाँ क्रम में लगाएँ")}</span>
              <p style={{ fontSize: "var(--fs-14)" }}>{t("Find the largest number in a.", "a me sabse bada number.", "a में सबसे बड़ी संख्या।")}</p>
              <div className="parsons">
                {lines.map((li, i) => (
                  <div key={li} className="parsons-line">
                    <GripVertical size={14} className="faint" />
                    <code>{PARSONS[li]}</code>
                    <span className="row" style={{ gap: 0 }}>
                      <button type="button" className="icon-btn" aria-label="Move up" onClick={() => move(i, -1)}>
                        <ChevronUp size={15} />
                      </button>
                      <button type="button" className="icon-btn" aria-label="Move down" onClick={() => move(i, 1)}>
                        <ChevronDown size={15} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
              {parsonsOk && (
                <div className="dp-feedback ok">
                  <Check size={16} /> {t("Right order.", "Sahi kram.", "सही क्रम।")}
                </div>
              )}
              <div className="kbd-row" aria-label="Code keys">
                {["{", "}", "(", ")", "[", "]", ";", "=", "<", ">", '"'].map((k) => (
                  <button key={k} type="button">
                    {k}
                  </button>
                ))}
              </div>
              <button type="button" className="btn primary lg block dp-cta" onClick={() => setQ(3)} disabled={!parsonsOk}>
                {t("Check", "Jaancho", "जाँचें")}
              </button>
            </div>
          )}
        </div>
        <aside className="daily-side stack">
          <Diya size={72} mood="happy" className="bob" />
          <h2 style={{ fontSize: "var(--fs-22)", fontWeight: 800 }}>{t("Daily 10", "Daily 10", "रोज़ 10")}</h2>
          <p className="muted">
            {t(
              "Ten one-minute questions from what you learned this week: predict the output, order the lines, fill the blank, spot the bug, step a dry run.",
              "Is hafte ke seekhe se 10 ek-minute ke sawaal: output batao, lines ka kram, khaali jagah, bug pakdo, dry run ka agla kadam.",
              "इस हफ़्ते के सीखे से 10 सवाल।",
            )}
          </p>
          <div className="qr-box">
            <QrCode size={64} />
            <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
              <Smartphone size={12} style={{ verticalAlign: -2 }} /> {t("Built for phones. Scan to continue there.", "Phone ke liye bana. Scan karke wahan jaari rakho.", "फ़ोन के लिए बना।")}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
