import { useState, type ReactNode } from "react";
import {
  Bot,
  Bug,
  Check as CheckIcon,
  CircleCheck,
  CircleX,
  CircleDashed,
  ClipboardList,
  Clock,
  CodeXml,
  FileText,
  FlaskConical,
  FolderTree,
  GitCompare,
  Lightbulb,
  ListChecks,
  Lock,
  MessagesSquare,
  Mic,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  ArrowRight,
  Flame,
  AtSign,
} from "lucide-react";
import { Link, useT, useToast, useCountdown, hms } from "../lib/core";
import { useVariant } from "../lib/variant";
import { Badge, Code, Meter, Seg, Moment } from "../ui/kit";
import { FocusBar, Panes, PaneHead, usePanes } from "../ui/focus";

/* AI-era practice (LEARN-V2 §4c), owner's pick for the mock on 24 Oct 2026:
   AE2 ticket lab: a small real repo with bug tickets; plan first, then fix with an agent, prove it with tests, and
   explain it in a short viva. AE3 "Galat AI pakdo": a five-minute daily drill on AI code that is almost right.
   Both are for learning; neither produces a hiring score. Steps are kept in pk43-v-lab / pk43-v-drill so the mock
   (and its screenshots) can open any step. */

/* ================= AE2: ticket lab ================= */

type LabStep = "tickets" | "plan" | "build" | "viva" | "result";
const STEPS: LabStep[] = ["tickets", "plan", "build", "viva", "result"];

type Ticket = { id: string; title: [string, string, string]; pri: string; from: [string, string, string]; now: [string, string, string]; want: [string, string, string] };
const TICKETS: Ticket[] = [
  {
    id: "T-101",
    title: ["Bill total is off by a paisa", "Bill ka total ek paisa galat", "बिल का कुल एक पैसा गलत"],
    pri: "P2",
    from: ["Canteen manager", "Canteen manager", "कैंटीन मैनेजर"],
    now: ["3 samosas (₹12) + 1 chai (₹10) shows ₹48.31", "3 samose (₹12) + 1 chai (₹10) par ₹48.31 dikhta", "₹48.31 दिखता है"],
    want: ["5% GST on the subtotal, rounded once to the paisa: ₹48.30", "Subtotal par 5% GST, paise tak ek hi baar round: ₹48.30", "₹48.30"],
  },
  {
    id: "T-102",
    title: ["One order is placed twice at rush hour", "Rush me ek order do baar banta", "भीड़ में एक ऑर्डर दो बार"],
    pri: "P1",
    from: ["Hostel warden", "Hostel warden", "हॉस्टल वार्डन"],
    now: ["A double tap or a slow network sends two orders; the kitchen cooks both", "Double tap ya dheema net: do order, kitchen dono banata", "दो ऑर्डर बनते हैं"],
    want: ["The same order sent twice creates one order", "Wahi order do baar aaye to ek hi bane", "एक ही ऑर्डर बने"],
  },
  {
    id: "T-103",
    title: ["Ready time shows in UTC", "Ready time UTC me dikhta", "तैयार समय UTC में"],
    pri: "P2",
    from: ["Students (3 reports)", "Students (3 reports)", "छात्र (3 रिपोर्ट)"],
    now: ["An order ready at 1:00 pm shows 7:30 am", "1:00 pm wala order 7:30 am dikhata", "7:30 am दिखता है"],
    want: ["Times show in IST: 1:00 pm", "Samay IST me: 1:00 pm", "IST में: 1:00 pm"],
  },
];

const ORDERS_JS = `router.post("/orders", async (req, res) => {
  const { items, orderKey } = req.body;
  if (!orderKey) return res.status(400).json({ error: "orderKey required" });
  const existing = await Order.findOne({ orderKey });
  if (existing) return res.status(200).json(existing);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const total = Math.round(subtotal * 1.05 * 100) / 100;
  const order = await Order.create({ items, orderKey, subtotal, total });
  res.status(201).json(order);
});`;

const TIME_JS = `export function formatReady(iso) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}`;

function LabStepper({ step, setStep, phone }: { step: LabStep; setStep: (s: LabStep) => void; phone?: boolean }) {
  const t = useT();
  const at = STEPS.indexOf(step);
  const names: Record<LabStep, string> = {
    tickets: t("Understand", "Samjho", "समझो"),
    plan: t("Plan", "Plan", "योजना"),
    build: t("Build", "Banao", "बनाओ"),
    viva: t("Explain", "Viva", "वाइवा"),
    result: t("Result", "Nateeja", "नतीजा"),
  };
  return (
    <ol className={`tl-steps ${phone ? "phone" : ""}`} aria-label={t("Lab steps", "Lab ke kadam", "लैब के चरण")}>
      {STEPS.map((s, i) => (
        <li key={s}>
          <button
            className={`tl-step ${i < at ? "done" : i === at ? "now" : ""}`}
            aria-current={i === at ? "step" : undefined}
            aria-label={`${i + 1}. ${names[s]}${i < at ? ` (${t("done", "ho gaya", "पूरा")})` : ""}`}
            onClick={() => setStep(s)}
          >
            <span className="tl-num">{i < at ? <CheckIcon /> : i + 1}</span>
            <span className="tl-name">{names[s]}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function TicketsStep({ next }: { next: () => void }) {
  const t = useT();
  return (
    <div className="tl-page">
      <header className="tl-head">
        <span className="eyebrow">{t("Step 1 · Understand", "Kadam 1 · Samjho", "चरण 1 · समझो")}</span>
        <h1 className="h1">{t("Three bugs in Canteen Queue", "Canteen Queue me teen bug", "कैंटीन क्यू में तीन बग")}</h1>
        <p className="muted">
          {t(
            "A hostel canteen's ordering app (React, Node, MongoDB). People have reported three problems. Read them, then write a plan before any code.",
            "Hostel canteen ka order app (React, Node, MongoDB). Logon ne teen dikkatein bataayi hain. Padho, phir code se pehle plan likho.",
            "हॉस्टल कैंटीन का ऑर्डर ऐप। पहले पढ़ो, फिर योजना लिखो।",
          )}
        </p>
      </header>
      <div className="tl-grid">
        <div className="col g12">
          {TICKETS.map((k) => (
            <article key={k.id} className="tl-ticket card">
              <div className="row wrap g8">
                <span className="mono tiny tl-id">{k.id}</span>
                <Badge tone="red" icon={<Bug size={13} />}>
                  {t("Bug", "Bug", "बग")}
                </Badge>
                <Badge tone={k.pri === "P1" ? "coin" : ""}>{k.pri}</Badge>
                <span className="grow" />
                <span className="tiny faint">{t(...k.from)}</span>
              </div>
              <h2 className="h3">{t(...k.title)}</h2>
              <dl className="tl-dl">
                <dt>{t("What happens", "Kya hota hai", "क्या होता है")}</dt>
                <dd>{t(...k.now)}</dd>
                <dt>{t("What should happen", "Kya hona chahiye", "क्या होना चाहिए")}</dt>
                <dd>{t(...k.want)}</dd>
              </dl>
            </article>
          ))}
        </div>
        <aside className="col g12">
          <section className="card pad col g10">
            <span className="h3 row g8">
              <FolderTree className="ic" /> {t("The repo", "Repo", "रिपो")}
            </span>
            <pre className="tl-tree mono tiny" tabIndex={0} aria-label={t("Files in the repo", "Repo ki files", "रिपो की फ़ाइलें")}>
              {`canteen-queue/
├─ client/src/lib/time.js
├─ client/src/pages/Order.jsx
├─ server/routes/orders.js
├─ server/models/Order.js
├─ tests/  (14 tests, 3 fail)
├─ PLAN.md  ← you write this
└─ README.md`}
            </pre>
            <div className="testbar mini" role="img" aria-label={t("11 of 14 tests pass", "14 me se 11 tests pass", "14 में से 11 पास")}>
              {Array.from({ length: 14 }, (_, i) => (
                <i key={i} className={i < 11 ? "ok" : "bad"} />
              ))}
            </div>
          </section>
          <section className="card pad col g8 tl-rules">
            <span className="h3 row g8">
              <ClipboardList className="ic" /> {t("How this lab works", "Lab kaise chalta", "लैब कैसे चलता है")}
            </span>
            <ul className="small col g6">
              <li>{t("The AI agent opens after your plan has a testable check for every ticket.", "AI agent tab khulta hai jab plan me har ticket ki jaanchne layak shart ho.", "योजना के बाद एजेंट खुलता है।")}</li>
              <li>{t("Accepting an agent change needs one line on why.", "Agent ka badlav maanne par ek line 'kyun' likhni hoti hai.", "हर बदलाव पर एक लाइन 'क्यों'।")}</li>
              <li>{t("Tests decide when a ticket is fixed, not the agent.", "Ticket theek hua ya nahi, tests batate hain, agent nahi.", "टेस्ट तय करते हैं।")}</li>
              <li>{t("Three short questions at the end (viva). The agent is off then.", "Aakhir me teen chhote sawaal (viva). Tab agent band.", "अंत में तीन सवाल।")}</li>
            </ul>
          </section>
        </aside>
      </div>
      <div className="row wrap g8">
        <button className="btn pri lg" onClick={next}>
          <FileText /> {t("Write the plan", "Plan likho", "योजना लिखो")}
        </button>
      </div>
    </div>
  );
}

type Crit = { tk: string; text: [string, string, string]; ok: boolean };
const CRITERIA: Crit[] = [
  { tk: "T-101", text: ["3 × ₹12 + 1 × ₹10 = ₹46; with 5% GST the bill is ₹48.30", "3 × ₹12 + 1 × ₹10 = ₹46; 5% GST ke saath bill ₹48.30", "बिल ₹48.30"], ok: true },
  { tk: "T-101", text: ["The total is rounded once, to the paisa", "Total ek hi baar round, paise tak", "एक ही बार राउंड"], ok: true },
  { tk: "T-102", text: ["Two POSTs with the same orderKey create one order; the second returns the first", "Same orderKey ke do POST: ek hi order; doosra pehla wala lautaye", "एक ही ऑर्डर"], ok: true },
  { tk: "T-102", text: ["Two different keys still make two orders", "Do alag key: do order", "अलग की: दो ऑर्डर"], ok: true },
  { tk: "T-103", text: ["The time shows correctly", "Time sahi dikhe", "समय सही दिखे"], ok: false },
];

function PlanStep({ next }: { next: () => void }) {
  const t = useT();
  const checks: [boolean, string][] = [
    [true, t("Every ticket has an understanding line", "Har ticket ki samajh likhi", "हर टिकट की समझ")],
    [true, t("Out of scope is written down", "Scope ke bahar kya, likha", "दायरे से बाहर लिखा")],
    [true, t("At least one risk", "Kam se kam ek risk", "कम से कम एक जोखिम")],
    [false, t("T-103's check cannot be tested yet: which time, in which zone? Add an example.", "T-103 ki shart abhi jaanch nahi sakte: kaunsa time, kis zone me? Ek example likho.", "T-103 की शर्त जाँचने लायक नहीं।")],
  ];
  return (
    <div className="tl-page">
      <header className="tl-head">
        <span className="eyebrow">{t("Step 2 · Plan before code", "Kadam 2 · Code se pehle plan", "चरण 2 · कोड से पहले योजना")}</span>
        <h1 className="h1">PLAN.md</h1>
        <p className="muted">{t("Short is fine. Each check must be something a test can prove.", "Chhota chalega. Har shart aisi ho jo test saabit kar sake.", "हर शर्त टेस्ट से साबित हो।")}</p>
      </header>
      <div className="tl-grid">
        <article className="tl-plan card" aria-label="PLAN.md">
          <section>
            <h2 className="tl-h">{t("1. What is wrong", "1. Kya galat hai", "1. क्या गलत है")}</h2>
            <ul className="small">
              <li>
                <span className="mono tl-tk">T-101</span> {t("GST is rounded per item, so paise add up.", "GST har item par round ho raha, paise jud jaate.", "हर आइटम पर राउंड।")}
              </li>
              <li>
                <span className="mono tl-tk">T-102</span> {t("The server accepts the same order twice; nothing ties two requests together.", "Server wahi order do baar le leta; do requests ko jodne wala kuch nahi.", "सर्वर दो बार लेता है।")}
              </li>
              <li>
                <span className="mono tl-tk">T-103</span> {t("The ready time is formatted without a time zone.", "Ready time bina time zone ke format hota.", "टाइम ज़ोन नहीं।")}
              </li>
            </ul>
          </section>
          <section>
            <h2 className="tl-h">{t("2. Scope", "2. Scope", "2. दायरा")}</h2>
            <p className="small">
              <b>{t("In:", "Andar:", "अंदर:")}</b> T-101, T-102, T-103. <b>{t("Out:", "Bahar:", "बाहर:")}</b> {t("menu redesign, payments, the old duplicate orders already in the database.", "menu ka naya design, payments, DB me pehle se pade duplicate orders.", "मेन्यू, भुगतान, पुराने ऑर्डर।")}
            </p>
          </section>
          <section>
            <h2 className="tl-h">{t("3. Approach", "3. Tareeka", "3. तरीका")}</h2>
            <ol className="small">
              <li>{t("Round the bill once, on the subtotal with GST.", "Bill ko ek baar round karo, subtotal + GST par.", "एक बार राउंड।")}</li>
              <li>{t("The client sends an orderKey; the server returns the existing order for a known key.", "Client orderKey bheje; server pehchaani key par purana order lautaye.", "orderKey से पुराना ऑर्डर।")}</li>
              <li>{t("Format times with timeZone: Asia/Kolkata.", "Time ko timeZone: Asia/Kolkata ke saath format karo.", "Asia/Kolkata।")}</li>
            </ol>
          </section>
          <section>
            <h2 className="tl-h">{t("4. Done when (acceptance checks)", "4. Kab poora (acceptance shartein)", "4. कब पूरा")}</h2>
            <ul className="tl-crit">
              {CRITERIA.map((c, i) => (
                <li key={i} className={c.ok ? "" : "vague"}>
                  {c.ok ? <CircleCheck className="t-tick" /> : <TriangleAlert className="t-coin" />}
                  <span className="mono tl-tk">{c.tk}</span>
                  <span className="small">{t(...c.text)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="tl-h">{t("5. Risks", "5. Risk", "5. जोखिम")}</h2>
            <p className="small">{t("A unique index on orderKey will fail if old duplicates exist; check the data first. GST rate: is it in config or in code?", "orderKey par unique index purane duplicates ho to fail hoga; pehle data dekho. GST rate config me hai ya code me?", "पहले डेटा देखो।")}</p>
          </section>
        </article>
        <aside className="col g12">
          <section className="card pad col g10" aria-labelledby="tl-check-h">
            <span className="h3 row g8" id="tl-check-h">
              <ListChecks className="ic" /> {t("Plan check", "Plan ki jaanch", "योजना की जाँच")}
            </span>
            <ul className="tl-checks">
              {checks.map(([ok, l]) => (
                <li key={l} className={ok ? "ok" : "warn"}>
                  {ok ? <CircleCheck /> : <TriangleAlert />}
                  <span className="small">{l}</span>
                </li>
              ))}
            </ul>
            <p className="tiny faint">{t("Rules, not AI: they look for a check per ticket, an out-of-scope line and a risk.", "Ye niyam hain, AI nahi: har ticket ki shart, scope ke bahar ki line aur ek risk dhoondhte.", "ये नियम हैं, AI नहीं।")}</p>
          </section>
          <div className="banner pen">
            <Lock />
            <span className="small">{t("The agent opens when every ticket has a testable check. Fix T-103's line.", "Agent tab khulega jab har ticket ki shart jaanchne layak ho. T-103 ki line theek karo.", "T-103 की लाइन ठीक करो।")}</span>
          </div>
        </aside>
      </div>
      <div className="row wrap g8">
        <button className="btn pri lg" onClick={next}>
          <CheckIcon /> {t("Plan done, open the agent", "Plan pakka, agent kholo", "योजना पक्की")}
        </button>
        <span className="tiny faint">{t("In the sample, T-103's check becomes \"07:30 UTC shows 1:00 pm\".", "Sample me T-103 ki shart banti: \"07:30 UTC → 1:00 pm\".", "नमूने में शर्त बदलती है।")}</span>
      </div>
    </div>
  );
}

type Prop = { id: string; who: "me" | "ai"; text: [string, string, string]; diff?: { file: string; plus: number; minus: number; state: "rejected" | "accepted" | "open"; why?: [string, string, string] } };
const CHAT: Prop[] = [
  {
    id: "m1",
    who: "me",
    text: [
      "@server/routes/orders.js @PLAN.md T-102: one order is created twice at rush hour; the client can send the same POST twice. I want idempotency on the server using an orderKey from the client. Tell me the change first, no code yet.",
      "@server/routes/orders.js @PLAN.md T-102: rush me ek order do baar banta; client wahi POST do baar bhej sakta. Server par client ke orderKey se idempotency chahiye. Pehle badlav batao, code baad me.",
      "T-102: सर्वर पर orderKey से एक ही ऑर्डर।",
    ],
  },
  {
    id: "a1",
    who: "ai",
    text: ["Simplest fix: disable the Order button for 2 seconds after a tap.", "Sabse aasaan: tap ke baad Order button 2 second band kar do.", "बटन 2 सेकंड बंद।"],
    diff: { file: "client/src/pages/Order.jsx", plus: 4, minus: 1, state: "rejected", why: ["Two tabs or a network retry still send two. It has to stop on the server.", "Do tab ya network retry se phir bhi do jaayenge. Server par rokna hoga.", "सर्वर पर रोकना होगा।"] },
  },
  {
    id: "a2",
    who: "ai",
    text: ["On the server: read orderKey, return the existing order for a known key, add a unique index.", "Server par: orderKey lo, pehchaani key par purana order lautao, unique index lagao.", "सर्वर पर orderKey और यूनिक इंडेक्स।"],
    diff: { file: "server/routes/orders.js", plus: 5, minus: 1, state: "accepted", why: ["Meets checks 3 and 4 in the plan; the index covers two requests at the same moment.", "Plan ki shart 3 aur 4 poori; index ek saath aayi do requests ko bhi rokta.", "शर्त 3 और 4 पूरी।"] },
  },
  {
    id: "m2",
    who: "me",
    text: ["@client/src/lib/time.js T-103: change only formatReady to show IST, and add a test for 07:30 UTC → 1:00 pm.", "@client/src/lib/time.js T-103: sirf formatReady badlo, IST dikhao, aur 07:30 UTC → 1:00 pm ka test jodo.", "T-103: केवल formatReady बदलो।"],
  },
  {
    id: "a3",
    who: "ai",
    text: ["Added timeZone: \"Asia/Kolkata\" and one test.", "timeZone: \"Asia/Kolkata\" joda aur ek test.", "टाइम ज़ोन जोड़ा।"],
    diff: { file: "client/src/lib/time.js", plus: 4, minus: 1, state: "open" },
  },
];

function DiffCard({ d }: { d: NonNullable<Prop["diff"]> }) {
  const t = useT();
  const toast = useToast();
  const [state, setState] = useState(d.state);
  const [why, setWhy] = useState(d.why ? t(...d.why) : "");
  return (
    <div className={`tl-diff ${state}`}>
      <div className="row g8">
        <GitCompare />
        <span className="mono tiny grow ellipsis">{d.file}</span>
        <span className="mono tiny t-tick">+{d.plus}</span>
        <span className="mono tiny t-red">−{d.minus}</span>
      </div>
      {state === "open" ? (
        <>
          <label className="field">
            <span className="tiny faint">{t("Why accept or reject? (one line)", "Kyun maano ya mana karo? (ek line)", "क्यों? (एक लाइन)")}</span>
            <input className="input" value={why} placeholder={t("e.g. meets check 5; the test covers 07:30 UTC", "jaise: shart 5 poori; test 07:30 UTC pakadta", "जैसे: शर्त 5 पूरी")} onChange={(e) => setWhy(e.target.value)} />
          </label>
          <div className="row g8">
            <button
              className="btn sm pri"
              disabled={!why.trim()}
              onClick={() => {
                setState("accepted");
                toast(t("Change accepted with your note", "Badlav maana, aapki note ke saath", "बदलाव माना"));
              }}
            >
              <ThumbsUp /> {t("Accept", "Maano", "मानो")}
            </button>
            <button className="btn sm ghost" disabled={!why.trim()} onClick={() => setState("rejected")}>
              <ThumbsDown /> {t("Reject", "Mana karo", "मना करो")}
            </button>
            <span className="tiny faint">{t("A note is needed either way.", "Dono me note zaroori.", "नोट ज़रूरी।")}</span>
          </div>
        </>
      ) : (
        <p className="tiny tl-why">
          {state === "accepted" ? <ThumbsUp /> : <ThumbsDown />}
          <b>{state === "accepted" ? t("Accepted", "Maana", "माना") : t("Rejected", "Mana kiya", "मना किया")}:</b> {why}
        </p>
      )}
    </div>
  );
}

function AgentPane() {
  const t = useT();
  const [mode, setMode] = useState<"plan" | "agent">("agent");
  return (
    <div className="tl-agent">
      <PaneHead>
        <span className="pane-title row g6">
          <Bot /> {t("Agent", "Agent", "एजेंट")}
        </span>
        <span className="grow" />
        <Seg
          value={mode}
          onChange={setMode}
          items={[
            { id: "plan", label: t("Plan", "Plan", "योजना") },
            { id: "agent", label: t("Agent", "Agent", "एजेंट") },
          ]}
        />
      </PaneHead>
      <div className="tl-chat" tabIndex={0} role="log" aria-label={t("Agent conversation", "Agent se baat", "एजेंट से बात")}>
        {CHAT.map((m) => (
          <div key={m.id} className={`tl-msg ${m.who}`}>
            <p className="small">{t(...m.text)}</p>
            {m.diff && <DiffCard d={m.diff} />}
          </div>
        ))}
      </div>
      <div className="tl-ask">
        <label className="sr-only" htmlFor="tl-ask">
          {t("Tell the agent what to do", "Agent ko batao kya karna hai", "एजेंट को बताओ")}
        </label>
        <textarea id="tl-ask" className="input" rows={2} placeholder={t("Tell the agent what to do. Use @ for files.", "Agent ko batao kya karna hai. File ke liye @.", "एजेंट को बताओ। फ़ाइल के लिए @।")} />
        <div className="row g8">
          <button className="icon-btn sm" aria-label={t("Mention a file", "File mention karo", "फ़ाइल जोड़ो")}>
            <AtSign />
          </button>
          <span className="tiny faint grow">{t("Lab model: a smaller, cheaper one. Every suggestion is kept.", "Lab ka model: chhota, sasta. Har sujhaav record hota.", "लैब का मॉडल छोटा।")}</span>
          <button className="btn sm ai" aria-label={t("Send", "Bhejo", "भेजो")}>
            <Send />
          </button>
        </div>
      </div>
    </div>
  );
}

function TestsPane() {
  const t = useT();
  const toast = useToast();
  const rows: [string, string, number, number][] = [
    ["T-101", t("Bill rounding", "Bill ki rounding", "बिल राउंडिंग"), 2, 2],
    ["T-102", t("Same order twice", "Wahi order do baar", "दो बार ऑर्डर"), 3, 3],
    ["T-103", t("Ready time in IST", "Ready time IST me", "IST में समय"), 0, 2],
    ["—", t("Old tests (nothing broke)", "Purane tests (kuch toota nahi)", "पुराने टेस्ट"), 9, 9],
  ];
  return (
    <div className="tl-tests">
      <PaneHead>
        <span className="pane-title row g6">
          <FlaskConical /> {t("Tests", "Tests", "टेस्ट")}
        </span>
        <span className="grow" />
        <button className="btn sm" onClick={() => toast(t("14 of 16 pass · T-103 waits for your decision", "16 me se 14 pass · T-103 aapke faisle ka intezaar", "16 में से 14 पास"))}>
          <Play /> {t("Run tests", "Tests chalao", "टेस्ट चलाओ")}
        </button>
      </PaneHead>
      <ul className="tl-tlist">
        {rows.map(([id, name, pass, all]) => (
          <li key={id + name} className={pass === all ? "ok" : "bad"}>
            {pass === all ? <CircleCheck /> : <CircleX />}
            <span className="mono tiny tl-tk">{id}</span>
            <span className="small grow">{name}</span>
            <span className="num small">
              {pass}/{all}
            </span>
          </li>
        ))}
      </ul>
      <pre className="tl-term mono tiny" tabIndex={0} aria-label={t("Test output", "Test output", "टेस्ट आउटपुट")}>
        {`$ npm test
 PASS  tests/bill.test.js (2)
 PASS  tests/orders.test.js (3)
 FAIL  tests/time.test.js
   ✕ 07:30 UTC shows 1:00 pm
     expected "1:00 pm", got "7:30 am"
Tests: 14 passed, 2 failed, 16 total`}
      </pre>
    </div>
  );
}

function BuildStep() {
  const t = useT();
  const { open, toggle } = usePanes({ code: true, agent: true, tests: true });
  const [phoneTab, setPhoneTab] = useState("agent");
  const [file, setFile] = useState<"orders" | "time">("orders");
  return (
    <div className="tl-build">
      <Panes
        open={open}
        toggle={toggle}
        phoneTab={phoneTab}
        setPhoneTab={setPhoneTab}
        panes={[
          {
            id: "code",
            label: t("Code", "Code", "कोड"),
            icon: <CodeXml />,
            weight: 0.4,
            min: 340,
            content: (
              <div className="tl-code">
                <PaneHead onClose={() => toggle("code")} closeLabel={t("Hide code", "Code chhupao", "कोड छिपाएँ")}>
                  <div className="file-tabs">
                    <button className={`file-tab tl-ftab ${file === "orders" ? "on" : ""}`} aria-current={file === "orders" ? "true" : undefined} onClick={() => setFile("orders")}>
                      <CodeXml /> orders.js
                    </button>
                    <button className={`file-tab tl-ftab ${file === "time" ? "on" : ""}`} aria-current={file === "time" ? "true" : undefined} onClick={() => setFile("time")}>
                      <CodeXml /> time.js
                    </button>
                  </div>
                </PaneHead>
                <div className="editor" tabIndex={0} role="region" aria-label={t("Code", "Code", "कोड")}>
                  {file === "orders" ? <Code code={ORDERS_JS} good={[2, 3, 4, 5, 7]} className="ed-code" /> : <Code code={TIME_JS} hl={[5]} className="ed-code" />}
                </div>
                <div className="statusbar">
                  <span className="faint">{file === "orders" ? "server/routes/orders.js" : "client/src/lib/time.js"}</span>
                  <span className="grow" />
                  <span className="tiny faint">{file === "orders" ? t("Green lines: accepted agent change", "Hari lines: maana hua agent badlav", "हरी लाइनें: माना बदलाव") : t("Proposed, not accepted yet", "Sujhaav, abhi maana nahi", "सुझाव, अभी नहीं माना")}</span>
                </div>
              </div>
            ),
          },
          { id: "agent", label: t("Agent", "Agent", "एजेंट"), icon: <Bot />, weight: 0.34, min: 320, tone: "ai", content: <AgentPane /> },
          { id: "tests", label: t("Tests", "Tests", "टेस्ट"), icon: <FlaskConical />, weight: 0.26, min: 260, content: <TestsPane /> },
        ]}
      />
    </div>
  );
}

function VivaStep({ next }: { next: () => void }) {
  const t = useT();
  const qa: { q: [string, string, string]; a: [string, string, string]; v: "ok" | "part"; note: [string, string, string] }[] = [
    {
      q: ["The agent first suggested disabling the button. Why wasn't that enough?", "Agent ne pehle button band karna sujhaya. Wo kaafi kyun nahi tha?", "बटन बंद करना काफ़ी क्यों नहीं?"],
      a: ["Two tabs or a retry on a slow network still send two requests. Only the server sees both.", "Do tab ya dheeme net par retry se do requests phir bhi aati. Dono sirf server dekhta.", "सर्वर ही दोनों देखता है।"],
      v: "ok",
      note: ["Clear and tied to how the bug happens.", "Saaf, aur bug kaise hota usse juda.", "साफ़।"],
    },
    {
      q: ["Two requests with the same key arrive at the same moment. findOne finds nothing for both. What happens?", "Same key ki do requests ek hi pal me aayein. findOne dono me kuch nahi paata. Kya hoga?", "एक साथ दो अनुरोध?"],
      a: ["The unique index makes the second create fail, so only one order is saved.", "Unique index se doosra create fail hoga, isliye ek hi order bachega.", "दूसरा create फ़ेल होगा।"],
      v: "part",
      note: ["Right idea, but the route does not catch that error (code 11000), so the second customer sees a 500. No test covers it.", "Idea sahi, par route wo error (code 11000) nahi pakadta, doosre ko 500 dikhega. Iska test nahi.", "11000 नहीं पकड़ा, टेस्ट नहीं।"],
    },
    {
      q: ["Which test proves T-103, and what did it catch that the old ones missed?", "T-103 kaunsa test saabit karta, aur purane tests kya chhod rahe the?", "T-103 कौन सा टेस्ट साबित करता है?"],
      a: ["07:30 UTC must show 1:00 pm. The old test used a time that is the same in both zones.", "07:30 UTC → 1:00 pm. Purana test aisa time leta tha jo dono zone me same dikhe.", "पुराना टेस्ट दोनों ज़ोन में एक जैसा।"],
      v: "ok",
      note: ["Good: you found why the old test was blind.", "Badhiya: purana test andha kyun tha, ye pakda.", "बढ़िया।"],
    },
  ];
  return (
    <div className="tl-page">
      <header className="tl-head">
        <span className="eyebrow">{t("Step 4 · Explain your change", "Kadam 4 · Apna badlav samjhao", "चरण 4 · बदलाव समझाओ")}</span>
        <h1 className="h1">{t("Three short questions", "Teen chhote sawaal", "तीन छोटे सवाल")}</h1>
        <p className="muted">{t("About your code, not trivia. Speak or type. The agent is off now.", "Aapke code par, ratne wale nahi. Bolo ya likho. Ab agent band.", "आपके कोड पर। एजेंट बंद।")}</p>
      </header>
      <div className="tl-viva">
        {qa.map((x, i) => (
          <section key={i} className="card tl-qa">
            <div className="tl-q">
              <span className="iv-ava sm" aria-hidden="true">
                <MessagesSquare />
              </span>
              <p className="small">
                <b>{i + 1}.</b> {t(...x.q)}
              </p>
            </div>
            <p className="tl-a small">{t(...x.a)}</p>
            <p className={`tl-v tiny ${x.v}`}>
              {x.v === "ok" ? <CircleCheck /> : <CircleDashed />}
              <b>{x.v === "ok" ? t("Understood", "Samjha", "समझा") : t("Partly", "Adhoora", "अधूरा")}:</b> {t(...x.note)}
            </p>
          </section>
        ))}
      </div>
      <div className="row wrap g8">
        <button className="btn" aria-label={t("Answer by voice", "Bolkar jawab", "बोलकर जवाब")}>
          <Mic /> {t("Answer by voice", "Bolkar jawab", "बोलकर")}
        </button>
        <span className="grow" />
        <button className="btn pri lg" onClick={next}>
          {t("See the result", "Nateeja dekho", "नतीजा देखो")} <ArrowRight />
        </button>
      </div>
    </div>
  );
}

function ResultStep({ again }: { again: () => void }) {
  const t = useT();
  const stats: [string, string, string][] = [
    [t("Tickets", "Tickets", "टिकट"), "3 / 3", t("all tests pass", "saare tests pass", "सभी टेस्ट पास")],
    [t("Plan checks met", "Plan ki shartein", "शर्तें"), "5 / 5", t("one made testable", "ek ko jaanchne layak banaya", "एक सुधारी")],
    [t("Viva", "Viva", "वाइवा"), "2 + ½", t("race condition partly", "race condition adhoora", "रेस अधूरा")],
    [t("Time", "Samay", "समय"), "1h 12m", t("of 2h", "2h me se", "2 घंटे में से")],
  ];
  const ai: [ReactNode, string][] = [
    [<ThumbsUp key="a" />, t("5 agent suggestions: 3 accepted, 1 rejected with a reason, 1 changed and then accepted", "Agent ke 5 sujhaav: 3 maane, 1 wajah ke saath mana, 1 badal kar maana", "5 सुझाव: 3 माने, 1 मना")],
    [<AtSign key="b" />, t("4 of 5 prompts named the file, the ticket and what you wanted", "5 me se 4 prompts me file, ticket aur kya chahiye, sab tha", "5 में से 4 प्रॉम्प्ट में पूरा संदर्भ")],
    [<FlaskConical key="c" />, t("You ran the tests after every accepted change", "Har maane badlav ke baad tests chalaye", "हर बदलाव के बाद टेस्ट")],
  ];
  return (
    <div className="tl-page">
      <Moment
        mood="happy"
        tone="tick"
        title={t("Lab done: three tickets fixed", "Lab poora: teen ticket theek", "लैब पूरा")}
        note={t("One habit to add: when a fix depends on the database, write the test for two requests at once.", "Ek aadat jodo: jab fix database par tika ho, ek saath do requests ka test likho.", "एक साथ दो अनुरोधों का टेस्ट लिखो।")}
        stamp={{ top: "LAB", mid: "3/3", bottom: "AI-SAATH" }}
      />
      <div className="stat-strip" style={{ ["--n" as string]: 4 }}>
        {stats.map(([k, v, d]) => (
          <div key={k} className="stat">
            <span className="k">{k}</span>
            <span className="v num">{v}</span>
            <span className="d">{d}</span>
          </div>
        ))}
      </div>
      <div className="grid c2">
        <section className="card pad col g10">
          <span className="h3 row g8">
            <Sparkles className="ic" /> {t("How you worked with the agent", "Agent ke saath kaise kaam kiya", "एजेंट के साथ काम")}
          </span>
          <ul className="tl-facts">
            {ai.map(([ic, l]) => (
              <li key={l} className="small">
                {ic}
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card pad col g10">
          <span className="h3 row g8">
            <ShieldCheck className="ic" /> {t("What this counts towards", "Ye kahan ginta hai", "यह कहाँ गिनता है")}
          </span>
          <p className="small">{t("Pramaan AI-Saath: lab 1 of 3 done. After three labs and a proctored viva, your profile sheet gets a checked line.", "Pramaan AI-Saath: 3 me se 1 lab poora. Teen lab aur proctored viva ke baad profile ke kaagaz me jaanchi hui line aayegi.", "प्रमाण AI-साथ: 3 में से 1।")}</p>
          <Meter v={33} tone="tick" label={t("Pramaan AI-Saath progress", "Pramaan AI-Saath ki pragati", "प्रगति")} />
        </section>
      </div>
      <div className="banner pen">
        <Lightbulb />
        <span className="small">{t("This report is for your learning. It is not a hiring score, and companies do not see it.", "Ye report aapke seekhne ke liye hai. Hiring score nahi, aur companies ise nahi dekhtin.", "यह हायरिंग स्कोर नहीं।")}</span>
      </div>
      <div className="row wrap g8">
        <button className="btn pri">
          <Bug /> {t("Add the race test (5 min)", "Race ka test jodo (5 min)", "रेस टेस्ट जोड़ो")}
        </button>
        <Link to="build" className="btn">
          {t("Next lab", "Agla lab", "अगला लैब")} <ArrowRight />
        </Link>
        <span className="grow" />
        <button className="btn ghost sm" onClick={again}>
          <RotateCcw /> {t("Start again", "Phir se", "फिर से")}
        </button>
      </div>
    </div>
  );
}

export function TicketLabScreen() {
  const t = useT();
  const [raw, setRaw] = useVariant("lab", "build");
  const step = (STEPS.includes(raw as LabStep) ? raw : "build") as LabStep;
  const setStep = (s: LabStep) => setRaw(s);
  const go = (d: number) => setStep(STEPS[Math.max(0, Math.min(STEPS.length - 1, STEPS.indexOf(step) + d))]);
  const [left] = useCountdown(48 * 60 + 12, step === "build");
  return (
    <>
      <FocusBar
        back="build"
        title={t("Ticket lab · Canteen Queue", "Ticket lab · Canteen Queue", "टिकट लैब · कैंटीन क्यू")}
        sub={t("Build · AI-Saath · React + Node + MongoDB · sample", "Banao · AI-Saath · React + Node + MongoDB · sample", "बनाओ · नमूना")}
        center={<LabStepper step={step} setStep={setStep} />}
        right={
          <span className="tl-timer mono" aria-label={t("Time left", "Baaki samay", "बाकी समय")}>
            <Clock /> {hms(left)}
          </span>
        }
      />
      <div className={`tl-wrap ${step === "build" ? "is-build" : ""}`}>
        <div className="tl-phone-steps">
          <LabStepper step={step} setStep={setStep} phone />
        </div>
        {step === "tickets" && <TicketsStep next={() => go(1)} />}
        {step === "plan" && <PlanStep next={() => go(1)} />}
        {step === "build" && <BuildStep />}
        {step === "viva" && <VivaStep next={() => go(1)} />}
        {step === "result" && <ResultStep again={() => setStep("tickets")} />}
      </div>
    </>
  );
}

/* ================= AE3: "Galat AI pakdo" daily drill ================= */

type DrillStep = "pick" | "test" | "fix" | "learn";
const DSTEPS: DrillStep[] = ["pick", "test", "fix", "learn"];

const AI_CODE = `def first_index(a, target):
    lo, hi = 0, len(a) - 1
    ans = -1
    while lo < hi:
        mid = (lo + hi) // 2
        if a[mid] >= target:
            if a[mid] == target:
                ans = mid
            hi = mid - 1
        else:
            lo = mid + 1
    return ans`;
const BAD_LINE = 4;

const CATS: [string, string, string][] = [
  ["Off-by-one / boundary", "Off-by-one / seema", "सीमा की गलती"],
  ["Overflow", "Overflow", "ओवरफ़्लो"],
  ["Missed edge case", "Edge case chhoota", "किनारे का मामला"],
  ["Wrong or made-up API", "Galat ya banaya hua API", "गलत API"],
  ["Security", "Security", "सुरक्षा"],
  ["Language trap", "Bhasha ka jaal", "भाषा का जाल"],
];

export function AiDrillBody() {
  const t = useT();
  const toast = useToast();
  const [raw, setRaw] = useVariant("drill", "test");
  const step = (DSTEPS.includes(raw as DrillStep) ? raw : "test") as DrillStep;
  const at = DSTEPS.indexOf(step);
  const [picked, setPicked] = useState<number | null>(at > 0 ? BAD_LINE : null);
  const [cat, setCat] = useState(0);
  const [left] = useCountdown(3 * 60 + 12);
  const lines = AI_CODE.split("\n");
  const fixed = at >= 3;
  const stepNames: Record<DrillStep, string> = {
    pick: t("Find the line", "Line dhoondho", "लाइन ढूँढो"),
    test: t("Prove it with a test", "Test se saabit karo", "टेस्ट से साबित करो"),
    fix: t("Fix it", "Theek karo", "ठीक करो"),
    learn: t("One line to remember", "Ek line yaad rakho", "एक लाइन याद"),
  };
  return (
    <div className="col g20">
      <header className="page-head" style={{ marginBottom: 0 }}>
        <div className="grow">
          <div className="eyebrow">{t("Practice · today's drill", "Abhyas · aaj ka drill", "अभ्यास · आज का ड्रिल")}</div>
          <h1 className="h1">{t("Catch the AI's mistake", "Galat AI pakdo", "गलत AI पकड़ो")}</h1>
          <p className="muted page-sub">{t("AI code is often almost right. Three drills, five minutes: find the bug, prove it with a test, fix it.", "AI ka code aksar lagbhag sahi hota hai. Teen drill, paanch minute: galti dhoondho, test se saabit karo, theek karo.", "तीन ड्रिल, पाँच मिनट।")}</p>
        </div>
        <div className="dr-top">
          <span className="dr-timer mono" aria-label={t("Time left today", "Aaj ka baaki samay", "आज का बाकी समय")}>
            <Clock /> {hms(left, false)}
          </span>
          <ol className="dr-dots" aria-label={t("Today's drills", "Aaj ke drill", "आज के ड्रिल")}>
            <li className="done">
              <CheckIcon /> <span className="sr-only">{t("Drill 1 done", "Drill 1 poora", "ड्रिल 1 पूरा")}</span>
            </li>
            <li className="now" aria-current="step">
              2
            </li>
            <li>3</li>
          </ol>
        </div>
      </header>

      <div className="dr-grid">
        <section className="card dr-card" aria-labelledby="dr-ask">
          <div className="dr-ask">
            <span className="eyebrow" id="dr-ask">
              {t("Someone asked an AI", "Kisi ne AI se maanga", "किसी ने AI से माँगा")}
            </span>
            <p className="small">{t("\"Python: return the first index of target in a sorted list, or -1. It must be O(log n).\"", "\"Python: sorted list me target ka pehla index lautao, na mile to -1. O(log n) chahiye.\"", "\"पहला इंडेक्स, O(log n)\"")}</p>
          </div>
          <div className="dr-code-h row g8">
            <Bot />
            <span className="small grow">{t("The AI's answer. Tap the line you think is wrong.", "AI ka jawab. Jo line galat lage us par tap karo.", "AI का जवाब। गलत लाइन पर टैप करो।")}</span>
            <Badge sq>Python</Badge>
          </div>
          <div className="dr-code" role="group" aria-label={t("Lines of the AI's code", "AI ke code ki lines", "AI के कोड की लाइनें")}>
            {lines.map((l, i) => {
              const n = i + 1;
              const isPick = picked === n;
              const shown = fixed && n === BAD_LINE ? "    while lo <= hi:" : l;
              return (
                <button
                  key={n}
                  className={`dr-ln ${isPick ? (fixed ? "fixed" : "picked") : ""}`}
                  aria-pressed={isPick}
                  aria-label={`${t("Line", "Line", "लाइन")} ${n}: ${shown.trim()}`}
                  onClick={() => {
                    setPicked(n);
                    if (step === "pick") setRaw("test");
                  }}
                >
                  <span className="dr-n">{n}</span>
                  <code>{shown}</code>
                </button>
              );
            })}
          </div>
        </section>

        <section className="card pad col g12 dr-steps" aria-labelledby="dr-step-h">
          <ol className="dr-stepper">
            {DSTEPS.map((s, i) => (
              <li key={s} className={i < at ? "done" : i === at ? "now" : ""}>
                <button onClick={() => setRaw(s)} aria-current={i === at ? "step" : undefined}>
                  <span className="tl-num">{i < at ? <CheckIcon /> : i + 1}</span>
                  <span className="small">{stepNames[s]}</span>
                </button>
              </li>
            ))}
          </ol>
          <h2 className="h3" id="dr-step-h">
            {stepNames[step]}
          </h2>

          {step === "pick" && <p className="small muted">{t("Read it the way a reviewer would: the loop condition, the bounds, what happens with one element.", "Reviewer ki tarah padho: loop ki shart, seemaayein, ek element par kya hoga.", "समीक्षक की तरह पढ़ो।")}</p>}

          {step === "test" && (
            <>
              <p className="small muted">{t("You picked line 4. Now write the smallest input where the AI's code gives a wrong answer.", "Aapne line 4 chuni. Ab sabse chhota input likho jahan AI ka code galat jawab de.", "सबसे छोटा इनपुट लिखो।")}</p>
              <div className="dr-inputs">
                <label className="field">
                  <span className="tiny faint">a</span>
                  <input className="input mono" defaultValue="[5]" />
                </label>
                <label className="field">
                  <span className="tiny faint">target</span>
                  <input className="input mono" defaultValue="5" />
                </label>
                <label className="field">
                  <span className="tiny faint">{t("Expected", "Sahi jawab", "अपेक्षित")}</span>
                  <input className="input mono" defaultValue="0" />
                </label>
              </div>
              <div className="dr-run bad">
                <CircleX />
                <span className="small">
                  {t("AI's code returns", "AI ka code deta", "AI का कोड देता")} <b className="mono">-1</b>, {t("expected", "chahiye", "चाहिए")} <b className="mono">0</b>. {t("Bug proven.", "Galti saabit.", "गलती साबित।")}
                </span>
              </div>
              <button className="btn pri" onClick={() => setRaw("fix")}>
                {t("Now fix it", "Ab theek karo", "अब ठीक करो")} <ArrowRight />
              </button>
            </>
          )}

          {step === "fix" && (
            <>
              <label className="field">
                <span className="tiny faint">{t("Line 4", "Line 4", "लाइन 4")}</span>
                <input className="input mono" defaultValue="    while lo <= hi:" />
              </label>
              <button
                className="btn pri"
                onClick={() => {
                  toast(t("Your test and 24 hidden tests pass", "Aapka test aur 24 chhupe tests pass", "सभी टेस्ट पास"));
                  setRaw("learn");
                }}
              >
                <Play /> {t("Run again", "Phir chalao", "फिर चलाओ")}
              </button>
              <p className="tiny faint">{t("Hidden tests check that only this line changed and the answer is still O(log n).", "Chhupe tests dekhte ki sirf yahi line badli aur jawab ab bhi O(log n).", "सिर्फ़ यही लाइन बदली।")}</p>
            </>
          )}

          {step === "learn" && (
            <>
              <div className="dr-run ok">
                <CircleCheck />
                <span className="small">{t("Your test and 24 hidden tests pass.", "Aapka test aur 24 chhupe tests pass.", "सभी टेस्ट पास।")}</span>
              </div>
              <div className="col g6">
                <span className="tiny faint" id="dr-cat-l">
                  {t("What kind of mistake was it?", "Galti kis tarah ki thi?", "गलती किस तरह की थी?")}
                </span>
                <div className="dr-cats" role="group" aria-labelledby="dr-cat-l">
                  {CATS.map((c, i) => (
                    <button key={c[0]} className="chip" aria-pressed={cat === i} onClick={() => setCat(i)}>
                      {t(...c)}
                    </button>
                  ))}
                </div>
              </div>
              <label className="field">
                <span className="tiny faint">{t("One line to remember", "Ek line yaad rakhne ko", "याद रखने की एक लाइन")}</span>
                <input className="input" defaultValue={t("With hi = len − 1, the loop needs lo <= hi or a one-item list is skipped.", "hi = len − 1 ho to loop me lo <= hi chahiye, warna ek item wali list chhoot jaati.", "lo <= hi चाहिए।")} />
              </label>
              <button className="btn pri" onClick={() => toast(t("Saved to your mistake notebook · drill 3 next", "Galtiyon ki copy me save · agla drill 3", "सहेजा"))}>
                <CheckIcon /> {t("Save and next drill", "Save karo, agla drill", "सहेजो, अगला")}
              </button>
            </>
          )}
        </section>
      </div>

      <div className="banner pen">
        <Lightbulb />
        <span className="small">{t("Every drill is written by an AI and then proven by our judge: the bug is real and sits on one line. A person checks a sample each week.", "Har drill AI likhta hai, phir hamara judge saabit karta: galti asli hai aur ek hi line me. Har hafte insaan sample jaanchta.", "हर ड्रिल जज से साबित।")}</span>
      </div>
    </div>
  );
}

export function AiDrillRail() {
  const t = useT();
  const cats: [string, number, number, string][] = [
    [t("Off-by-one", "Off-by-one", "सीमा"), 4, 5, "tick"],
    [t("Edge cases", "Edge cases", "किनारे"), 3, 4, "tick"],
    [t("Security", "Security", "सुरक्षा"), 1, 3, "coin"],
    [t("Made-up API", "Banaya hua API", "गलत API"), 0, 2, "red"],
  ];
  return (
    <>
      <section className="card pad col g12">
        <div className="row g8">
          <Flame style={{ color: "var(--coin)", width: 18, height: 18 }} />
          <span className="h3 grow">{t("6-day drill streak", "6 din ki drill streak", "6 दिन")}</span>
        </div>
        <span className="eyebrow">{t("Caught this week", "Is hafte pakdi", "इस सप्ताह पकड़ी")}</span>
        {cats.map(([n, a, b, tone]) => (
          <div key={n} className="col g4">
            <div className="row between small">
              <span>{n}</span>
              <span className="num faint">
                {a}/{b}
              </span>
            </div>
            <Meter v={(a / b) * 100} tone={tone} size="thin" label={`${n} ${a}/${b}`} />
          </div>
        ))}
        <p className="tiny faint">{t("Weakest: made-up APIs. Tomorrow's drills lean that way.", "Sabse kamzor: banaye hue API. Kal ke drill usi taraf.", "कल के ड्रिल उसी तरफ़।")}</p>
      </section>
      <section className="card pad col g10">
        <span className="h3 row g8">
          <TerminalSquare className="ic" /> {t("Bigger practice", "Badi practice", "बड़ा अभ्यास")}
        </span>
        <Link to="ticket-lab" className="btn sm block">
          <Bug /> {t("Ticket lab: Canteen Queue", "Ticket lab: Canteen Queue", "टिकट लैब")}
        </Link>
        <Link to="interview" className="btn sm block ghost">
          <Bot /> {t("Mock interview with AI", "AI ke saath mock interview", "AI के साथ इंटरव्यू")}
        </Link>
      </section>
    </>
  );
}
