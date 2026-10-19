import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CalendarDays, Target, Clock3, Layers, Loader2, Sparkles } from "lucide-react";
import { Link, navigate, useT } from "../lib/core";
import { Confetti, Diya, LogoMark, Bar } from "../ui/kit";

type Tri = [string, string, string];
type Q = { id: string; title: Tri; sub: Tri; options: { v: string; l: Tri; d?: Tri }[]; multi?: boolean };

const QS: Q[] = [
  {
    id: "who",
    title: ["Where are you right now?", "Aap abhi kahan ho?", "आप अभी कहाँ हैं?"],
    sub: ["So the plan fits your semester.", "Taaki plan semester me fit ho.", "ताकि योजना सेमेस्टर में फ़िट हो।"],
    options: [
      { v: "y1", l: ["1st year", "1st year", "पहला साल"] },
      { v: "y2", l: ["2nd year", "2nd year", "दूसरा साल"] },
      { v: "y3", l: ["3rd year", "3rd year", "तीसरा साल"] },
      { v: "y4", l: ["Final year", "Final year", "अंतिम साल"] },
      { v: "grad", l: ["Graduated", "Graduate", "स्नातक"] },
      { v: "work", l: ["Working (0–3 yrs)", "Job me (0–3 saal)", "नौकरी में (0–3 साल)"] },
    ],
  },
  {
    id: "goal",
    title: ["What are you preparing for?", "Kis cheez ki taiyaari?", "किसकी तैयारी?"],
    sub: ["You can change this later.", "Baad me badal sakte ho.", "बाद में बदल सकते हैं।"],
    options: [
      { v: "product", l: ["Product company SDE", "Product company SDE", "प्रोडक्ट कंपनी SDE"], d: ["DSA, system design, projects", "DSA, system design, projects", "DSA, सिस्टम डिज़ाइन"] },
      { v: "service", l: ["Service company", "Service company", "सर्विस कंपनी"], d: ["Aptitude + coding round patterns", "Aptitude + coding round", "एप्टीट्यूड + कोडिंग"] },
      { v: "data", l: ["Data / analyst", "Data / analyst", "डेटा / एनालिस्ट"], d: ["SQL, statistics, Python", "SQL, stats, Python", "SQL, सांख्यिकी"] },
      { v: "web", l: ["Frontend / backend", "Frontend / backend", "फ़्रंटएंड / बैकएंड"], d: ["Projects first, then DSA", "Pehle projects, phir DSA", "पहले प्रोजेक्ट"] },
      { v: "unsure", l: ["Not sure yet", "Abhi pata nahi", "अभी पता नहीं"], d: ["We start with basics and a short quiz", "Basics aur chhota quiz", "बुनियादी बातें और क्विज़"] },
    ],
  },
  {
    id: "when",
    title: ["By when?", "Kab tak?", "कब तक?"],
    sub: ["Placement season, an interview date, or just a pace.", "Placement season, interview date, ya bas ek raftaar.", "प्लेसमेंट, इंटरव्यू की तारीख, या रफ़्तार।"],
    options: [
      { v: "3", l: ["3 months", "3 mahine", "3 महीने"] },
      { v: "6", l: ["6 months", "6 mahine", "6 महीने"] },
      { v: "12", l: ["12 months", "12 mahine", "12 महीने"] },
      { v: "date", l: ["A date: 12 Dec 2026", "Taareekh: 12 Dec 2026", "तारीख: 12 दिसंबर 2026"] },
    ],
  },
  {
    id: "time",
    title: ["How much time on a normal day?", "Aam din kitna samay?", "आम दिन कितना समय?"],
    sub: ["Be honest. A small plan you finish beats a big one you skip.", "Sach batao. Chhota plan jo poora ho, bade se behtar.", "सच बताएँ। छोटी योजना बेहतर।"],
    options: [
      { v: "30", l: ["30 min", "30 min", "30 मिनट"] },
      { v: "60", l: ["1 hour", "1 ghanta", "1 घंटा"] },
      { v: "120", l: ["2 hours", "2 ghante", "2 घंटे"] },
      { v: "180", l: ["3+ hours", "3+ ghante", "3+ घंटे"] },
    ],
  },
  {
    id: "lang",
    title: ["Which coding language?", "Kaunsi coding language?", "कौन-सी कोडिंग भाषा?"],
    sub: ["Editorials and the editor open in this one.", "Editorial aur editor isi me khulenge.", "हल और एडिटर इसी में।"],
    options: [
      { v: "cpp", l: ["C++", "C++", "C++"] },
      { v: "java", l: ["Java", "Java", "Java"] },
      { v: "py", l: ["Python", "Python", "Python"] },
      { v: "js", l: ["JavaScript", "JavaScript", "JavaScript"] },
    ],
  },
  {
    id: "level",
    title: ["How comfortable are you with DSA?", "DSA me kitne comfortable ho?", "DSA में कितने सहज हैं?"],
    sub: ["Or take a 10-minute quiz and we will place you.", "Ya 10 minute ka quiz do, hum level tay karenge.", "या 10 मिनट का क्विज़ दें।"],
    options: [
      { v: "0", l: ["Never started", "Kabhi shuru nahi kiya", "कभी शुरू नहीं"] },
      { v: "1", l: ["Arrays and strings", "Arrays aur strings", "ऐरे और स्ट्रिंग"] },
      { v: "2", l: ["Up to trees", "Trees tak", "ट्री तक"] },
      { v: "3", l: ["Comfortable, need practice", "Aata hai, practice chahiye", "आता है, अभ्यास चाहिए"] },
      { v: "quiz", l: ["Take the 10-minute quiz", "10 minute ka quiz", "10 मिनट का क्विज़"] },
    ],
  },
];

const DAYS: Tri[] = [
  ["Mon", "Som", "सोम"],
  ["Tue", "Mangal", "मंगल"],
  ["Wed", "Budh", "बुध"],
  ["Thu", "Guru", "गुरु"],
  ["Fri", "Shukra", "शुक्र"],
  ["Sat", "Shani", "शनि"],
  ["Sun", "Ravi", "रवि"],
];

export function OnboardingScreen() {
  const t = useT();
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState<Record<string, string>>({ who: "y3", goal: "product" });
  const [days, setDays] = useState([true, true, true, true, true, false, true]);
  const [phase, setPhase] = useState<"ask" | "build" | "ready">("ask");
  const q = QS[step];

  const months = ans.when === "6" ? 6 : ans.when === "12" ? 12 : 3;
  const sprints = months === 3 ? 6 : months === 6 ? 12 : 24;
  const mins = Number(ans.time ?? 120);

  if (phase === "build") return <Building onDone={() => setPhase("ready")} />;
  if (phase === "ready") return <Ready sprints={sprints} months={months} mins={mins} />;

  return (
    <div className="onb">
      <header className="onb-top">
        <Link to="landing" className="brand">
          <LogoMark size={28} /> Parikshaa
        </Link>
        <div className="onb-progress">
          <span className="faint num" style={{ fontSize: "var(--fs-12)" }}>
            {step + 1} / {QS.length}
          </span>
          <Bar value={((step + 1) / QS.length) * 100} thin />
        </div>
        <Link to="aaj" className="btn ghost sm">
          {t("Skip for now", "Abhi skip", "अभी छोड़ें")}
        </Link>
      </header>

      <div className="onb-body">
        <ol className="onb-steps" aria-label="Steps">
          {QS.map((x, i) => (
            <li key={x.id} className={i < step ? "done" : i === step ? "now" : ""}>
              <span className="dot">{i < step ? <Check size={12} /> : i + 1}</span>
              <button type="button" onClick={() => i <= step && setStep(i)}>
                {t(...x.title)}
              </button>
            </li>
          ))}
        </ol>

        <section className="onb-q" key={q.id} aria-labelledby="q-title">
          <span className="eyebrow">
            {t("Question", "Sawaal", "सवाल")} {step + 1}
          </span>
          <h1 id="q-title">{t(...q.title)}</h1>
          <p className="muted">{t(...q.sub)}</p>
          <div className={`onb-options ${q.options.some((o) => o.d) ? "rich" : ""}`}>
            {q.options.map((o) => (
              <button key={o.v} type="button" className="choice" aria-pressed={ans[q.id] === o.v} onClick={() => setAns((a) => ({ ...a, [q.id]: o.v }))}>
                <span className="check">{ans[q.id] === o.v && <Check size={12} />}</span>
                <span>
                  {t(...o.l)}
                  {o.d && <small>{t(...o.d)}</small>}
                </span>
              </button>
            ))}
          </div>
          {q.id === "time" && (
            <div className="stack sm" style={{ marginTop: 8 }}>
              <span className="label" style={{ fontWeight: 700, fontSize: "var(--fs-13)" }}>
                {t("Which days?", "Kaun se din?", "कौन-से दिन?")}
              </span>
              <div className="row wrap" style={{ gap: 6 }}>
                {DAYS.map((d, i) => (
                  <button key={i} type="button" className="chip" aria-pressed={days[i]} onClick={() => setDays((x) => x.map((v, j) => (j === i ? !v : v)))}>
                    {t(...d)}
                  </button>
                ))}
              </div>
              <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
                {t("Days you leave out become rest days in the plan. They never break your streak.", "Jo din chhodoge wo chhutti banenge. Streak nahi tootegi.", "छोड़े दिन छुट्टी बनेंगे।")}
              </span>
            </div>
          )}
          <div className="onb-nav">
            <button type="button" className="btn ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              <ArrowLeft size={15} /> {t("Back", "Peeche", "पीछे")}
            </button>
            <button
              type="button"
              className="btn primary lg"
              disabled={!ans[q.id]}
              onClick={() => (step === QS.length - 1 ? setPhase("build") : setStep((s) => s + 1))}
            >
              {step === QS.length - 1 ? t("Build my plan", "Mera plan banao", "मेरी योजना बनाएँ") : t("Next", "Aage", "आगे")} <ArrowRight size={15} />
            </button>
          </div>
        </section>

        <aside className="onb-preview" aria-label={t("Your plan so far", "Ab tak ka plan", "अब तक की योजना")}>
          <span className="eyebrow">{t("Your plan so far", "Ab tak ka plan", "अब तक की योजना")}</span>
          <div className="onb-prev-row">
            <Target size={15} />
            <span>{t(...(QS[1].options.find((o) => o.v === ans.goal)?.l ?? ["Pick a goal", "Goal chuno", "लक्ष्य चुनें"]))}</span>
          </div>
          <div className="onb-prev-row">
            <CalendarDays size={15} />
            <span>
              {ans.when ? `${months} ${t("months", "mahine", "महीने")}` : t("Pick a timeline", "Samay chuno", "समय चुनें")}
            </span>
          </div>
          <div className="onb-prev-row">
            <Layers size={15} />
            <span>
              {ans.when ? `${sprints} sprints · ${t("1 topic group a week", "har hafte 1 topic group", "हर हफ़्ते 1 विषय")}` : "—"}
            </span>
          </div>
          <div className="onb-prev-row">
            <Clock3 size={15} />
            <span>
              {ans.time ? `${mins >= 60 ? `${mins / 60}h` : `${mins}m`} × ${days.filter(Boolean).length} ${t("days a week", "din/hafta", "दिन/हफ़्ता")}` : "—"}
            </span>
          </div>
          <div className="onb-mini-plan">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className={i < (ans.when ? 6 : 2) ? "on" : ""} style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
          <Diya size={56} mood="think" className="bob" />
        </aside>
      </div>
    </div>
  );
}

function Building({ onDone }: { onDone: () => void }) {
  const t = useT();
  const steps: Tri[] = [
    ["Reading your answers", "Aapke jawab padh rahe hain", "आपके जवाब पढ़ रहे हैं"],
    ["Marking exam weeks from your college calendar", "College calendar se exam ke hafte", "कॉलेज कैलेंडर से परीक्षा के हफ़्ते"],
    ["Ordering 148 topics, easiest first", "148 topics ka kram, aasaan pehle", "148 विषयों का क्रम"],
    ["Grouping them into weekly sprints", "Hafte ke sprints me baant rahe hain", "हफ़्ते के स्प्रिंट"],
    ["Writing day 1", "Din 1 likh rahe hain", "दिन 1 लिख रहे हैं"],
  ];
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= steps.length) {
      const id = window.setTimeout(onDone, 500);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setN((x) => x + 1), 650);
    return () => window.clearTimeout(id);
  }, [n, steps.length, onDone]);
  return (
    <div className="onb-center">
      <div className="build-card panel featured">
        <h1>
          {t("Building your ", "Aapka ", "आपकी ")}
          <em>{t("personal", "apna", "अपनी")}</em>
          {t(" plan", " plan ban raha hai", " योजना बन रही है")}
        </h1>
        <Diya size={88} mood="think" className="bob" />
        <ol className="build-steps">
          {steps.map((s, i) => (
            <li key={i} className={i < n ? "done" : i === n ? "now" : ""}>
              <span className="ic">{i < n ? <Check size={13} /> : i === n ? <Loader2 size={14} className="spin" /> : null}</span>
              {t(...s)}
            </li>
          ))}
        </ol>
        <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
          {t("The plan is made by rules. AI only names the sprints.", "Plan niyamon se banta hai. AI sirf sprints ke naam deta hai.", "योजना नियमों से बनती है।")}
        </span>
      </div>
    </div>
  );
}

function Ready({ sprints, months, mins }: { sprints: number; months: number; mins: number }) {
  const t = useT();
  const end = useMemo(() => (months === 3 ? "18 Jan 2027" : months === 6 ? "20 Apr 2027" : "20 Oct 2027"), [months]);
  return (
    <div className="onb-center">
      <div className="ready-card panel featured" style={{ position: "relative", overflow: "hidden" }}>
        <Confetti />
        <Diya size={96} mood="cheer" />
        <h1>{t("Your plan is ready", "Aapka plan taiyaar hai", "आपकी योजना तैयार है")}</h1>
        <p className="muted">{t("Day by day, around your goal, your time and your college calendar.", "Din-wise, aapke goal, samay aur college calendar ke hisaab se.", "दिन-वार, आपके लक्ष्य और समय के हिसाब से।")}</p>
        <div className="ready-plan">
          <div className="ready-name">
            <span className="ico">
              <Target size={20} />
            </span>
            <div>
              <b>{t("Product company SDE", "Product company SDE", "प्रोडक्ट कंपनी SDE")}</b>
              <span className="faint">{t("Starts with arrays and hashing", "Arrays aur hashing se shuru", "ऐरे और हैशिंग से शुरू")}</span>
            </div>
          </div>
          <div className="ready-cells">
            <div>
              <span>{t("Starts", "Shuru", "शुरू")}</span>
              <b>21 Oct 2026</b>
            </div>
            <div>
              <span>{t("Ends", "Khatam", "समाप्त")}</span>
              <b>{end}</b>
            </div>
            <div>
              <span>Sprints</span>
              <b>{sprints}</b>
            </div>
            <div>
              <span>{t("Per day", "Roz", "रोज़")}</span>
              <b>{mins >= 60 ? `${mins / 60} h` : `${mins} min`}</b>
            </div>
          </div>
        </div>
        <button type="button" className="btn primary lg" onClick={() => navigate("aaj")}>
          {t("Go to Today", "Aaj par chalo", "आज पर चलें")} <ArrowRight size={16} />
        </button>
        <span className="faint" style={{ fontSize: "var(--fs-12)", display: "flex", gap: 6, alignItems: "center" }}>
          <Sparkles size={12} /> {t("Sprint names suggested by AI. Everything else is rules.", "Sprint ke naam AI ne sujhaye. Baaki sab niyam se.", "स्प्रिंट के नाम एआई से।")}
        </span>
      </div>
    </div>
  );
}
