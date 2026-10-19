import { useEffect, useState } from "react";
import { CircleCheck, CircleX, Sparkles, ShieldCheck, ListTodo, Building2, Award, Check } from "lucide-react";
import { useInterval, useT } from "../lib/core";
import { Diya, Bar } from "./kit";
import { DryRunPlayer } from "./dryrun";

/* Small live demos used on the landing page and the onboarding side panel. */

export function DemoTasks() {
  const t = useT();
  const [n, setN] = useState(1);
  useInterval(() => setN((x) => (x >= 5 ? 1 : x + 1)), 900);
  const rows: [string, string][] = [
    [t("Stacks: the LIFO idea", "Stacks: LIFO ka idea", "स्टैक: LIFO"), "25 min"],
    ["Pair with target sum", "30 min"],
    ["Valid brackets", "35 min"],
    [t("Revise 6 cards", "6 cards revise", "6 कार्ड दोहराएँ"), "15 min"],
    [t("Successive percentage", "Successive percentage", "क्रमिक प्रतिशत"), "25 min"],
  ];
  return (
    <div className="demo-card">
      <div className="row between">
        <span className="tag action">
          <ListTodo size={12} /> {t("Today's plan", "Aaj ka plan", "आज की योजना")}
        </span>
        <b className="num">
          {Math.min(n, 5) - 1} / 5
        </b>
      </div>
      <div className="demo-tasks">
        {rows.map(([name, m], i) => (
          <div key={i} className={`demo-task ${i < n - 1 ? "done" : ""}`}>
            <span className="c">{i < n - 1 ? <Check size={11} /> : null}</span>
            <span className="n">{name}</span>
            <span className="m num">{m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DemoVerdict() {
  const t = useT();
  return (
    <div className="demo-card">
      <div className="verdict-line bad">
        <CircleX size={18} />
        <div>
          <b>{t("Wrong answer", "Galat jawab", "गलत उत्तर")}</b>
          <span className="num">23 / 24 {t("tests", "tests", "टेस्ट")}</span>
        </div>
      </div>
      <Bar value={96} tone="ok" thin />
      <div className="sft">
        <span className="eyebrow">{t("Smallest test you fail", "Sabse chhota galat test", "सबसे छोटा गलत टेस्ट")}</span>
        <dl>
          <dt>{t("Input", "Input", "इनपुट")}</dt>
          <dd className="mono">n=2 · a=[1e9, 1e9] · target=2e9</dd>
          <dt>{t("Yours", "Aapka", "आपका")}</dt>
          <dd className="mono bad">-1</dd>
          <dt>{t("Expected", "Sahi", "सही")}</dt>
          <dd className="mono ok">0 1</dd>
        </dl>
      </div>
      <span className="faint" style={{ fontSize: "var(--fs-11)" }}>
        {t("Found by the judge by shrinking the failing test. Hidden tests stay hidden.", "Judge ne galat test ko chhota karke nikala. Hidden tests chhupe rehte hain.", "जज ने गलत टेस्ट को छोटा करके निकाला।")}
      </span>
    </div>
  );
}

export function DemoDry() {
  return (
    <div className="demo-card" style={{ padding: 10 }}>
      <DryRunPlayer autoplay compact showCode={false} />
    </div>
  );
}

export function DemoSahayak() {
  const t = useT();
  return (
    <div className="demo-card">
      <div className="row" style={{ gap: 8 }}>
        <Diya size={26} mood="think" />
        <b>Sahayak</b>
        <span className="tag action">{t("Learn mode", "Seekho mode", "सीखो मोड")}</span>
      </div>
      <div className="demo-bubble me">{t("Why does my code fail?", "Mera code fail kyun?", "मेरा कोड फेल क्यों?")}</div>
      <div className="demo-bubble ai">
        <span className="ok">
          <CircleCheck size={13} /> {t("Two pointers is the right idea.", "Two pointers sahi idea hai.", "दो पॉइंटर सही विचार है।")}
        </span>
        <span>
          <Sparkles size={13} style={{ color: "var(--plus)" }} />{" "}
          {t("How large can a[i] + a[j] get? Check the constraints.", "a[i] + a[j] kitna bada ho sakta hai? Constraints dekho.", "a[i] + a[j] कितना बड़ा हो सकता है?")}
        </span>
      </div>
    </div>
  );
}

export function DemoCompany() {
  const t = useT();
  const rows: [string, number][] = [
    ["Arrays & hashing", 34],
    ["Two pointers", 22],
    ["Trees", 18],
    ["Dynamic programming", 14],
  ];
  return (
    <div className="demo-card">
      <div className="row between">
        <div className="row" style={{ gap: 8 }}>
          <span className="co-logo" style={{ background: "#16a34a" }}>N</span>
          <b>Nimbu Labs</b>
          <span className="tag outline">{t("sample", "namuna", "नमूना")}</span>
        </div>
        <Building2 size={15} className="faint" />
      </div>
      <span className="eyebrow">{t("Topics in coding rounds", "Coding rounds ke topics", "कोडिंग राउंड के विषय")}</span>
      <div className="stack sm">
        {rows.map(([n, v]) => (
          <div key={n} className="weak-row" style={{ gridTemplateColumns: "minmax(0,1fr) 110px 36px" }}>
            <span>{n}</span>
            <Bar value={v * 2.6} thin />
            <span>{v}%</span>
          </div>
        ))}
      </div>
      <span className="faint" style={{ fontSize: "var(--fs-11)", display: "flex", gap: 6, alignItems: "center" }}>
        <ShieldCheck size={12} /> {t("From 41 verified interview reports · last one 9 Oct", "41 verified reports se · aakhri 9 Oct", "41 जाँची रिपोर्ट से")}
      </span>
    </div>
  );
}

export function DemoPramaan() {
  const t = useT();
  return (
    <div className="demo-card cert-mini">
      <div className="row between">
        <span className="tag plus">
          <Award size={12} /> Pramaan
        </span>
        <span className="qr" aria-hidden="true" />
      </div>
      <b style={{ fontSize: "var(--fs-18)" }}>Data Structures · Level 2</b>
      <span className="muted">Aarav Sharma · {t("proctored · 82 / 100", "proctored · 82 / 100", "निगरानी में · 82 / 100")}</span>
      <span className="faint mono" style={{ fontSize: "var(--fs-11)" }}>
        parikshaa.in/v/PRM-7Q4K-22
      </span>
    </div>
  );
}

export const DEMOS = [
  { id: "plan", C: DemoTasks, label: ["A plan for today", "Aaj ka plan", "आज की योजना"] as [string, string, string] },
  { id: "verdict", C: DemoVerdict, label: ["The smallest test you fail", "Sabse chhota galat test", "सबसे छोटा गलत टेस्ट"] as [string, string, string] },
  { id: "dry", C: DemoDry, label: ["Dry runs you can slide", "Slide karne wale dry run", "स्लाइड वाले ड्राई रन"] as [string, string, string] },
  { id: "sahayak", C: DemoSahayak, label: ["A tutor that asks first", "Pehle sawaal poochhne wala tutor", "पहले सवाल पूछने वाला शिक्षक"] as [string, string, string] },
  { id: "company", C: DemoCompany, label: ["Company prep with sources", "Source ke saath company prep", "स्रोत के साथ कंपनी तैयारी"] as [string, string, string] },
];

export function RotatingDemo() {
  const t = useT();
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (hold) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % DEMOS.length), 4200);
    return () => window.clearInterval(id);
  }, [hold]);
  const D = DEMOS[i];
  return (
    <div className="rotator" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
      <div className="rotator-head">
        <span className="eyebrow">{t("Live demo", "Live demo", "लाइव डेमो")}</span>
        <b>{t(...D.label)}</b>
      </div>
      <div className="rotator-stage" key={D.id}>
        <D.C />
      </div>
      <div className="rotator-dots" role="tablist" aria-label="Demos">
        {DEMOS.map((d, k) => (
          <button key={d.id} type="button" role="tab" aria-selected={k === i} aria-label={t(...d.label)} onClick={() => setI(k)} />
        ))}
      </div>
    </div>
  );
}
