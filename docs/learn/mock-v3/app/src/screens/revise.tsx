import { useState } from "react";
import { Eye, Flame, ArrowRight, Check as CheckI, X, ChevronUp, ChevronDown, QrCode, Smartphone, Clock, BookOpen, CircleX, Zap } from "lucide-react";
import { Link, useT, useCountdown } from "../lib/core";
import { Badge, Code, PenNote, Tick, Card, Tabs, Diya } from "../ui/kit";

/* ---------------- revision ---------------- */

const CARDS = [
  {
    kind: "mistake",
    from: ["From your wrong answer · 18 Oct", "Aapke galat jawab se · 18 Oct", "आपकी गलती से · 18 अक्टू"],
    q: ["Why did a = [2³⁰, 2³⁰], target = 2³¹ return -1?", "a = [2³⁰, 2³⁰], target = 2³¹ par -1 kyun aaya?", "-1 क्यों आया?"],
    a: ["int sum overflowed: 2³⁰ + 2³⁰ = 2³¹ is one more than INT_MAX. Store the sum in long long.", "int sum overflow hua: 2³⁰ + 2³⁰ = 2³¹, INT_MAX se ek zyada. Sum long long me rakho.", "int ओवरफ़्लो हुआ।"],
    code: "long long sum = (long long)a[L] + a[R];",
  },
  {
    kind: "concept",
    from: ["Concept · Stack", "Concept · Stack", "अवधारणा · स्टैक"],
    q: ["Which data structure answers 'what was the most recent open bracket?'", "'Sabse aakhri khula bracket kaunsa?' kaunsa data structure batata hai?", "कौन-सा डेटा स्ट्रक्चर?"],
    a: ["A stack: last in, first out.", "Stack: last in, first out.", "स्टैक: LIFO।"],
    code: "",
  },
];

export function RevisionBody() {
  const t = useT();
  const [i, setI] = useState(0);
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(1);
  const c = CARDS[i % CARDS.length];
  const grade = () => {
    setShow(false);
    setDone((d) => Math.min(6, d + 1));
    setI((x) => x + 1);
  };
  const finished = done >= 6;
  return (
    <div className="col g20">
      <header className="page-head" style={{ marginBottom: 0 }}>
        <div className="grow">
          <div className="eyebrow">{t("Revision", "Revision", "दोहराई")}</div>
          <h1 className="h1">{t("Six cards before you forget.", "Bhoolne se pehle chhe cards.", "भूलने से पहले छह कार्ड।")}</h1>
          <p className="muted page-sub">{t("Picked from your own mistakes and today's topics. Each answer sets when you see the card again.", "Aapki galtiyon aur aaj ke topics se. Har jawab tay karta hai card dobara kab aayega.", "आपकी गलतियों से चुने।")}</p>
        </div>
        <div className="rev-prog">
          <div className="segs" style={{ width: 180 }}>
            {Array.from({ length: 6 }, (_, k) => (
              <i key={k} className={k < done ? "ok" : ""} />
            ))}
          </div>
          <span className="tiny faint num">
            {Math.min(done + 1, 6)} / 6 · ~8 min
          </span>
        </div>
      </header>

      {finished ? (
        <div className="rev-done paper-grid">
          <Tick size={56} />
          <h2 className="display" style={{ fontSize: 40 }}>
            {t("All six done.", "Chhe ke chhe ho gaye.", "सभी छह हो गए।")}
          </h2>
          <p className="muted">{t("Next revision: tomorrow, 4 cards.", "Agla revision: kal, 4 cards.", "अगली दोहराई: कल, 4 कार्ड।")}</p>
          <Link to="aaj" className="btn pri">
            {t("Back to today", "Aaj par wapas", "आज पर वापस")}
            <ArrowRight />
          </Link>
        </div>
      ) : (
        <div className="flash-wrap">
          <div className={`flash ${show ? "flipped" : ""}`} key={i}>
            <div className="flash-top">
              <Badge tone={c.kind === "mistake" ? "red" : "pen"} icon={c.kind === "mistake" ? <CircleX /> : <BookOpen />}>
                {c.kind === "mistake" ? t("Your mistake", "Aapki galti", "आपकी गलती") : t("Concept", "Concept", "अवधारणा")}
              </Badge>
              <span className="tiny faint">{t(c.from[0], c.from[1], c.from[2])}</span>
            </div>
            <div className="flash-q display">{t(c.q[0], c.q[1], c.q[2])}</div>
            {show ? (
              <div className="flash-a">
                <div className="eyebrow">{t("Answer", "Jawab", "उत्तर")}</div>
                <p className="prose">{t(c.a[0], c.a[1], c.a[2])}</p>
                {c.code && <Code code={c.code} good={[1]} nonum />}
              </div>
            ) : (
              <div className="flash-think">
                <PenNote>{t("Say it out loud first, then flip.", "Pehle bol kar batao, phir palto.", "पहले बोलकर बताएँ।")}</PenNote>
              </div>
            )}
          </div>
          {show ? (
            <div className="grades">
              {[
                ["again", t("Again", "Phir se", "फिर से"), "1 min"],
                ["hard", t("Hard", "Mushkil", "कठिन"), "2 d"],
                ["good", t("Good", "Theek", "ठीक"), "5 d"],
                ["easy", t("Easy", "Aasaan", "आसान"), "12 d"],
              ].map(([k, l, d]) => (
                <button key={k} className={`grade g-${k}`} onClick={grade}>
                  <b>{l}</b>
                  <span className="tiny">{d}</span>
                </button>
              ))}
            </div>
          ) : (
            <button className="btn pri lg flip-btn" onClick={() => setShow(true)}>
              <Eye />
              {t("Show answer", "Jawab dikhao", "उत्तर दिखाएँ")}
              <span className="kbd" style={{ marginLeft: 6, background: "transparent", color: "inherit", borderColor: "rgba(255,255,255,.4)" }}>
                Space
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function RevisionRail() {
  const t = useT();
  const [tab, setTab] = useState("all");
  return (
    <>
      <section className="card">
        <div className="card-h">
          <span className="h3">{t("Mistake notebook", "Galtiyon ki copy", "गलतियों की कॉपी")}</span>
          <Badge>23</Badge>
        </div>
        <div style={{ padding: "0 14px" }}>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "all", label: t("All", "Sab", "सभी") },
              { id: "open", label: t("Open", "Khule", "खुले"), count: 7 },
              { id: "fixed", label: t("Fixed", "Theek", "ठीक") },
            ]}
          />
        </div>
        <ul className="notebook paper-ruled">
          {[
            ["Overflow on int sum", "Pair with target sum", "open"],
            ["Off-by-one in while (L <= R)", "Binary search", "fixed"],
            ["Forgot empty stack check", "Valid brackets", "open"],
            ["Used % before checking 0", "GCD of array", "fixed"],
          ].map(([m, p, s]) => (
            <li key={m}>
              <span className={`nb-dot ${s}`} />
              <span className="grow" style={{ minWidth: 0 }}>
                <b className="small" style={{ display: "block" }}>
                  {m}
                </b>
                <span className="tiny faint">{p}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="card pad col g8">
        <span className="h3 row g8">
          <Flame style={{ width: 17, height: 17, color: "var(--coin)" }} />
          {t("Memory strength", "Yaad ki taakat", "याद की ताक़त")}
        </span>
        <div className="mem">
          {[
            ["Arrays", 86],
            ["Two pointers", 64],
            ["Stack", 41],
            ["Binary search", 72],
          ].map(([n, v]) => (
            <div key={n as string} className="mem-row">
              <span className="small grow">{n}</span>
              <span className="mem-bar">
                <i style={{ width: `${v}%` }} />
              </span>
              <span className="tiny num faint">{v}%</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/* ---------------- daily 10 ---------------- */

const PARSONS = ["for (int i = 1; i < n; i++)", "    if (a[i] > best) best = a[i];", "int best = a[0];", "return best;"];

export function DailyCard() {
  const t = useT();
  const [q, setQ] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [lines, setLines] = useState([0, 1, 2, 3]);
  const [left] = useCountdown(48);
  const ok = lines.join() === "2,0,1,3";
  const move = (k: number, d: number) => {
    const j = k + d;
    if (j < 0 || j >= lines.length) return;
    const n = [...lines];
    [n[k], n[j]] = [n[j], n[k]];
    setLines(n);
  };
  return (
    <div className="daily">
      <div className="daily-top">
        <span className="row g6 small">
          <Zap style={{ width: 16, height: 16, color: "var(--coin)" }} />
          <b>Daily 10</b>
        </span>
        <span className="tiny faint num">
          {q + 3} / 10 · 0:{String(left).padStart(2, "0")}
        </span>
      </div>
      <div className="segs">
        {Array.from({ length: 10 }, (_, k) => (
          <i key={k} className={k < q + 2 ? (k === 1 ? "bad" : "ok") : k === q + 2 ? "on" : ""} />
        ))}
      </div>
      {q === 0 ? (
        <>
          <div className="eyebrow">{t("Predict the output", "Output batao", "आउटपुट बताएँ")}</div>
          <Code code={'int x = 7;\nx = x++ + ++x;\ncout << (x > 15 ? "big" : "small");'} nonum />
          <div className="col g6">
            {["big", "small", t("compile error", "compile error", "कंपाइल त्रुटि"), t("undefined behaviour", "undefined behaviour", "अपरिभाषित")].map((o, k) => (
              <button
                key={o}
                className={`option daily-opt ${pick === k ? (k === 3 ? "right" : "wrong") : pick !== null && k === 3 ? "right" : ""}`}
                onClick={() => setPick(k)}
                disabled={pick !== null}
              >
                <span className="mono small">{String.fromCharCode(65 + k)}</span>
                <span className="grow">{o}</span>
                {pick !== null && k === 3 && <CheckI className="t-tick" />}
                {pick === k && k !== 3 && <X className="t-red" />}
              </button>
            ))}
          </div>
          {pick !== null && (
            <div className="banner pen">
              <BookOpen />
              <span className="small">{t("Modifying x twice without a sequence point is undefined in C++. Never rely on it.", "Ek hi expression me x ko do baar badalna C++ me undefined hai.", "C++ में अपरिभाषित।")}</span>
            </div>
          )}
          <button className="btn pri block" onClick={() => setQ(1)} disabled={pick === null}>
            {t("Next", "Aage", "आगे")}
            <ArrowRight />
          </button>
        </>
      ) : (
        <>
          <div className="eyebrow">{t("Put the lines in order", "Lines ko kram me lagao", "पंक्तियाँ क्रम में")}</div>
          <p className="small muted">{t("Find the largest element.", "Sabse bada element dhoondho.", "सबसे बड़ा तत्व।")}</p>
          <div className="parsons">
            {lines.map((li, k) => (
              <div key={li} className={`pl ${ok ? "ok" : ""}`}>
                <code className="mono">{PARSONS[li]}</code>
                <span className="pl-ctrl">
                  <button className="icon-btn sm" onClick={() => move(k, -1)} aria-label="Move up">
                    <ChevronUp />
                  </button>
                  <button className="icon-btn sm" onClick={() => move(k, 1)} aria-label="Move down">
                    <ChevronDown />
                  </button>
                </span>
              </div>
            ))}
          </div>
          <div className="code-keys">
            {["{", "}", "(", ")", ";", "[", "]", "<", ">", "=", "+", "++"].map((k) => (
              <button key={k} className="ck mono">
                {k}
              </button>
            ))}
          </div>
          <button className={`btn block ${ok ? "ok" : "pri"}`} onClick={() => setLines([2, 0, 1, 3])}>
            {ok ? (
              <>
                <CheckI />
                {t("Correct · +5 coins", "Sahi · +5 coins", "सही · +5")}
              </>
            ) : (
              t("Check", "Jaancho", "जाँचें")
            )}
          </button>
        </>
      )}
    </div>
  );
}

export function DailyBody() {
  const t = useT();
  return (
    <div className="col g20">
      <header className="page-head" style={{ marginBottom: 0 }}>
        <div className="grow">
          <div className="eyebrow">Daily 10</div>
          <h1 className="h1">{t("Ten minutes, on the bus.", "Das minute, bus me.", "दस मिनट, बस में।")}</h1>
          <p className="muted page-sub">{t("Ten one-minute questions a day: predict output, order lines, spot the bug. Made for your phone.", "Roz das ek-minute ke sawaal: output batao, lines lagao, bug pakdo. Phone ke liye bana.", "रोज़ दस एक-मिनट के सवाल।")}</p>
        </div>
      </header>
      <div className="daily-stage">
        <div className="phone-frame">
          <div className="phone-screen">
            <div className="phone-notch" />
            <DailyCard />
          </div>
        </div>
        <div className="col g16 daily-side">
          <Card title={t("Continue on your phone", "Phone par jaari rakho", "फ़ोन पर जारी रखें")} icon={<Smartphone className="ic" />}>
            <div className="row g16">
              <span className="qr">
                <QrCode />
              </span>
              <p className="small muted">{t("Scan to open Daily 10 in your phone browser. No app needed; it saves your place.", "Scan karke phone browser me kholo. App nahi chahiye; jagah yaad rehti hai.", "स्कैन करके फ़ोन पर खोलें।")}</p>
            </div>
          </Card>
          <Card title={t("This week", "Is hafte", "इस सप्ताह")} icon={<Clock className="ic" />}>
            <div className="dw">
              {[10, 10, 8, 10, 3, 0, 0].map((v, k) => (
                <div key={k} className="dw-col">
                  <span className="dw-bar" style={{ height: `${v * 10}%` }} />
                  <span className="tiny faint">{"MTWTFSS"[k]}</span>
                </div>
              ))}
            </div>
            <p className="tiny faint mt8">{t("41 of 50 · best streak 9 days", "50 me 41 · best streak 9 din", "50 में 41")}</p>
          </Card>
          <div className="row g10">
            <Diya size={48} mood="cheer" />
            <span className="small muted">{t("Every right answer is a coin; wrong ones turn into revision cards.", "Har sahi jawab ek coin; galat wale revision cards ban jaate hain.", "गलत जवाब दोहराई कार्ड बनते हैं।")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

