import { useState, type ReactNode } from "react";
import {
  BookOpen,
  Bug,
  Check as CheckIcon,
  CircleCheck,
  CircleDashed,
  FlaskConical,
  Lock,
  ShieldCheck,
  Sparkles,
  Target,
  Lightbulb,
  ArrowRight,
  ClipboardList,
  Eye,
  Trash2,
  MessagesSquare,
  ThumbsUp,
  TriangleAlert,
  Hand,
  ListChecks,
  Download,
} from "lucide-react";
import { Link, useT, useToast } from "../lib/core";
import { Badge, Meter, Ring, Seg, Spark, CountUp } from "../ui/kit";

/* AI-era practice, second batch (LEARN-V2 §4c), owner's pick on 24 Oct 2026:
   AE1 "AI ke saath kaam" track, AE4 the AI-use report (for learning only), AE7 readiness in two parts.
   (AE8, the proof-sheet line, lives in profile.tsx.) Numbers are a sample learner. */

/* ================= AE7: readiness in two parts ================= */

/** Readiness split into fundamentals (without AI) and working with AI, weighted for the goal or the company. */
export function ReadinessSplit({ base = 66, ai = 46, wBase = 60, compact }: { base?: number; ai?: number; wBase?: number; compact?: boolean }) {
  const t = useT();
  const total = Math.round((base * wBase + ai * (100 - wBase)) / 100);
  return (
    <div className={`rs ${compact ? "compact" : ""}`}>
      <div className="row g14">
        <Ring v={total} size={compact ? 64 : 72} stroke={7}>
          <b className="display num" style={{ fontSize: compact ? 20 : 22 }}>
            <CountUp to={total} />
          </b>
        </Ring>
        <div className="col g4 small" style={{ minWidth: 0 }}>
          <b>{t(`Readiness ${total}, up 6`, `Readiness ${total}, +6`, `तैयारी ${total}, +6`)}</b>
          <span className="tiny faint">
            {t(`Weights: fundamentals ${wBase} · with AI ${100 - wBase}`, `Wazan: buniyaad ${wBase} · AI ke saath ${100 - wBase}`, `वज़न: बुनियाद ${wBase} · AI ${100 - wBase}`)}
          </span>
        </div>
      </div>
      <div className="rs-bars">
        <div className="rs-row">
          <span className="small grow">{t("Fundamentals (no AI)", "Buniyaad (bina AI)", "बुनियाद (बिना AI)")}</span>
          <b className="num small">{base}</b>
        </div>
        <Meter v={base} tone="pen" size="thin" label={t(`Fundamentals ${base}`, `Buniyaad ${base}`, `बुनियाद ${base}`)} />
        <div className="rs-row">
          <span className="small grow">{t("Working with AI", "AI ke saath kaam", "AI के साथ काम")}</span>
          <b className="num small">{ai}</b>
        </div>
        <Meter v={ai} tone="ai" size="thin" label={t(`Working with AI ${ai}`, `AI ke saath kaam ${ai}`, `AI के साथ ${ai}`)} />
      </div>
      {!compact && <span className="tiny muted">{t("Weakest: dynamic programming · with AI: reading a diff", "Sabse kamzor: DP · AI me: diff padhna", "कमज़ोर: DP · AI में: डिफ़ पढ़ना")}</span>}
    </div>
  );
}

/* ================= AE1: "AI ke saath kaam" track ================= */

type NodeT = { id: string; state: "done" | "now" | "next" | "lock"; title: [string, string, string]; parts: [string, string, string][]; to?: string };
const NODES: NodeT[] = [
  { id: "n1", state: "done", title: ["What AI does well, and where it slips", "AI kya achha karta, kahan phisalta", "AI कहाँ अच्छा, कहाँ फिसलता"], parts: [["Lesson 6 min", "Lesson 6 min", "पाठ 6 मि"], ["Quiz 5", "Quiz 5", "क्विज़ 5"]] },
  { id: "n2", state: "done", title: ["Giving context: file, ticket, what you want", "Context dena: file, ticket, kya chahiye", "संदर्भ देना"], parts: [["Lesson 8 min", "Lesson 8 min", "पाठ 8 मि"], ["Drill 6", "Drill 6", "ड्रिल 6"]] },
  { id: "n3", state: "now", title: ["Plan before code: PLAN.md and testable checks", "Code se pehle plan: PLAN.md aur jaanchne layak shartein", "कोड से पहले योजना"], parts: [["Lesson 10 min", "Lesson 10 min", "पाठ 10 मि"], ["Practice 3", "Practice 3", "अभ्यास 3"], ["Lab step", "Lab ka kadam", "लैब चरण"]], to: "ticket-lab" },
  { id: "n4", state: "next", title: ["Reading the AI's diff", "AI ka diff padhna", "AI का डिफ़ पढ़ना"], parts: [["Lesson 8 min", "Lesson 8 min", "पाठ 8 मि"], ["Drill 10", "Drill 10", "ड्रिल 10"]] },
  { id: "n5", state: "next", title: ["Catching wrong output", "Galat output pakadna", "गलत आउटपुट पकड़ना"], parts: [["Daily drill", "Roz ka drill", "रोज़ का ड्रिल"]], to: "ai-drill" },
  { id: "n6", state: "next", title: ["Proving it with tests", "Test se saabit karna", "टेस्ट से साबित करना"], parts: [["Lesson 10 min", "Lesson 10 min", "पाठ 10 मि"], ["Lab", "Lab", "लैब"]] },
  { id: "n7", state: "next", title: ["When not to use AI", "Kab AI na lein", "कब AI न लें"], parts: [["Lesson 6 min", "Lesson 6 min", "पाठ 6 मि"], ["Quiz 5", "Quiz 5", "क्विज़ 5"]] },
  { id: "n8", state: "next", title: ["Data and privacy limits", "Data aur privacy ki seema", "डेटा और निजता की सीमा"], parts: [["Lesson 6 min", "Lesson 6 min", "पाठ 6 मि"], ["Quiz 5", "Quiz 5", "क्विज़ 5"]] },
  { id: "n9", state: "next", title: ["Three ticket labs", "Teen ticket labs", "तीन टिकट लैब"], parts: [["Lab 1 of 3 done", "Lab 1 / 3 poora", "लैब 1 / 3"]], to: "ticket-lab" },
  { id: "n10", state: "lock", title: ["Pramaan AI-Saath (proctored viva)", "Pramaan AI-Saath (proctored viva)", "प्रमाण AI-साथ"], parts: [["After nodes 1–9", "Padaav 1–9 ke baad", "पड़ाव 1–9 के बाद"]] },
];

function NodeIcon({ s, n }: { s: NodeT["state"]; n: number }) {
  if (s === "done") return <CheckIcon />;
  if (s === "lock") return <Lock />;
  return <>{n}</>;
}

function NowLesson() {
  const t = useT();
  return (
    <div className="at-now">
      <div className="at-cmp">
        <div className="at-col at-weak">
          <span className="eyebrow">
            <TriangleAlert /> {t("Weak prompt", "Kamzor prompt", "कमज़ोर प्रॉम्प्ट")}
          </span>
          <p className="mono small">"fix my code"</p>
          <span className="tiny muted">{t("The AI has to guess what is wrong and often rewrites everything.", "AI ko andaaza lagana padta kya galat hai, aksar sab badal deta.", "AI अंदाज़ा लगाता है।")}</span>
        </div>
        <div className="at-col at-good">
          <span className="eyebrow">
            <ThumbsUp /> {t("Strong prompt", "Achha prompt", "अच्छा प्रॉम्प्ट")}
          </span>
          <p className="mono small">"@orders.js T-102: one order is created twice at rush hour. Stop it on the server using orderKey. Tell me the change first, code later."</p>
          <span className="tiny muted">{t("File, ticket, what you want and what you don't: the AI answers the real question.", "File, ticket, kya chahiye aur kya nahi: AI asli sawaal ka jawab deta.", "फ़ाइल, टिकट, क्या चाहिए।")}</span>
        </div>
      </div>
      <div className="at-cmp">
        <div className="at-col at-weak">
          <span className="eyebrow">
            <TriangleAlert /> {t("A check you cannot test", "Aisi shart jo test na ho", "जाँच न हो सके")}
          </span>
          <p className="small">"{t("The time shows correctly", "Time sahi dikhe", "समय सही दिखे")}"</p>
        </div>
        <div className="at-col at-good">
          <span className="eyebrow">
            <ThumbsUp /> {t("A check a test can prove", "Shart jo test saabit kare", "जो टेस्ट साबित करे")}
          </span>
          <p className="small">"07:30 UTC → 1:00 pm IST"</p>
        </div>
      </div>
      <div className="row wrap g8">
        <button className="btn pri">
          <BookOpen /> {t("Read the lesson · 10 min", "Lesson padho · 10 min", "पाठ पढ़ो · 10 मि")}
        </button>
        <button className="btn">
          <ListChecks /> {t("Fix 3 vague checks", "3 dheeli shartein theek karo", "3 ढीली शर्तें ठीक करो")}
        </button>
        <Link to="ticket-lab" className="btn ghost">
          <FlaskConical /> {t("Try it in the lab", "Lab me aazmao", "लैब में आज़माओ")}
        </Link>
      </div>
    </div>
  );
}

export function AiTrackBody() {
  const t = useT();
  const [open, setOpen] = useState("n3");
  const done = NODES.filter((n) => n.state === "done").length;
  return (
    <div className="col g20">
      <header className="page-head" style={{ marginBottom: 0 }}>
        <div className="grow">
          <div className="eyebrow">{t("Learn · skill track", "Seekho · skill track", "सीखो · कौशल ट्रैक")}</div>
          <h1 className="h1">{t("Working with AI", "AI ke saath kaam", "AI के साथ काम")}</h1>
          <p className="muted page-sub">
            {t(
              "Ten stops: give context, plan before code, read the AI's diff, catch wrong output, prove it with tests, and know when not to use AI. Each stop has a lesson and practice that checks itself.",
              "Das padaav: context dena, code se pehle plan, AI ka diff padhna, galat output pakadna, test se saabit karna, aur kab AI na lein. Har padaav par lesson aur practice jo khud jaanchti hai.",
              "दस पड़ाव: संदर्भ, योजना, डिफ़, गलत आउटपुट, टेस्ट, और कब AI न लें।",
            )}
          </p>
        </div>
        <div className="at-prog">
          <b className="num">
            {done} / {NODES.length}
          </b>
          <span className="tiny faint">{t("stops done", "padaav poore", "पड़ाव पूरे")}</span>
        </div>
      </header>
      <ol className="at-path">
        {NODES.map((n, i) => {
          const isOpen = open === n.id;
          return (
            <li key={n.id} className={`at-node ${n.state} ${isOpen ? "open" : ""}`}>
              <span className="at-dot" aria-hidden="true">
                <NodeIcon s={n.state} n={i + 1} />
              </span>
              <div className="at-body card">
                <button className="at-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? "" : n.id)} disabled={n.state === "lock"}>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <b>{t(...n.title)}</b>
                    <span className="at-parts">
                      {n.parts.map((p) => (
                        <span key={p[0]} className="tiny">
                          {t(...p)}
                        </span>
                      ))}
                    </span>
                  </span>
                  {n.state === "done" ? (
                    <Badge tone="tick">{t("Done", "Poora", "पूरा")}</Badge>
                  ) : n.state === "now" ? (
                    <Badge tone="pen">{t("You are here", "Aap yahan", "आप यहाँ")}</Badge>
                  ) : n.state === "lock" ? (
                    <Badge>{t("Locked", "Band", "बंद")}</Badge>
                  ) : null}
                </button>
                {isOpen && n.state === "now" && <NowLesson />}
                {isOpen && n.state !== "now" && n.state !== "lock" && (
                  <div className="at-more row wrap g8">
                    <span className="small muted grow">{n.state === "done" ? t("Done on 21 Oct. Revise any time.", "21 Oct ko poora. Kabhi bhi dohrao.", "21 अक्टूबर को पूरा।") : t("Opens after the stop before it.", "Pichhla padaav poora hone par khulega.", "पिछला पड़ाव पूरा होने पर।")}</span>
                    {n.to && (
                      <Link to={n.to} className="btn sm">
                        {t("Open", "Kholo", "खोलें")} <ArrowRight />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function AiTrackRail() {
  const t = useT();
  return (
    <>
      <section className="card pad col g12">
        <span className="h3 row g8">
          <ShieldCheck className="ic" /> Pramaan AI-Saath
        </span>
        <div className="col g6">
          <div className="row between small">
            <span>{t("Stops", "Padaav", "पड़ाव")}</span>
            <span className="num faint">2 / 9</span>
          </div>
          <Meter v={22} tone="ai" size="thin" label={t("Stops 2 of 9", "Padaav 2 / 9", "पड़ाव 2 / 9")} />
          <div className="row between small">
            <span>{t("Ticket labs", "Ticket labs", "टिकट लैब")}</span>
            <span className="num faint">1 / 3</span>
          </div>
          <Meter v={33} tone="tick" size="thin" label={t("Labs 1 of 3", "Labs 1 / 3", "लैब 1 / 3")} />
          <div className="row between small">
            <span>{t("Proctored viva", "Proctored viva", "प्रॉक्टर्ड वाइवा")}</span>
            <span className="faint tiny">{t("after the labs", "labs ke baad", "लैब के बाद")}</span>
          </div>
        </div>
        <p className="tiny faint">{t("Your profile sheet shows a checked \"Working with AI\" line from the first lab; Pramaan makes it a certificate.", "Pehle lab se profile ke kaagaz me jaanchi hui \"AI ke saath kaam\" line aati; Pramaan use certificate banata.", "पहले लैब से प्रोफ़ाइल में लाइन।")}</p>
      </section>
      <section className="card pad col g10">
        <span className="h3 row g8">
          <Lightbulb className="ic" /> {t("Why this track", "Ye track kyun", "यह ट्रैक क्यों")}
        </span>
        <p className="small muted">{t("More hiring rounds now give you an AI and watch how you use it. Studies also show that asking AI why keeps you learning, while letting it write the code does not.", "Ab zyada hiring rounds AI dete hain aur dekhte hain aap kaise istemal karte ho. Study bhi kehti: AI se \"kyun\" poochhne par seekh bani rehti, code likhwane par nahi.", "AI से \"क्यों\" पूछो, कोड मत लिखवाओ।")}</p>
      </section>
      <section className="card pad col g10">
        <span className="h3 row g8">
          <Hand className="ic" /> {t("Where AI is on or off", "AI kahan khula, kahan band", "AI कहाँ खुला, कहाँ बंद")}
        </span>
        <ul className="at-rules small">
          <li>
            <CircleCheck className="t-tick" /> {t("Lessons and practice: Sahayak gives hints", "Lesson aur practice: Sahayak hint deta", "पाठ: सहायक संकेत देता")}
          </li>
          <li>
            <CircleCheck className="t-tick" /> {t("Labs: the agent writes code; you decide", "Labs: agent code likhta; faisla aapka", "लैब: फ़ैसला आपका")}
          </li>
          <li>
            <Lock className="faint" /> {t("Contests, Pramaan, mocks: off", "Contest, Pramaan, mock: band", "प्रतियोगिता, प्रमाण: बंद")}
          </li>
        </ul>
        <Link to="ai-report" className="btn sm block">
          <Eye /> {t("My AI-use report", "Meri AI istemal report", "मेरी AI उपयोग रिपोर्ट")}
        </Link>
      </section>
    </>
  );
}

/* ================= AE4: AI-use report (learning only) ================= */

type Ev = { src: [string, string, string]; at: string; quote: string; good: boolean; note: [string, string, string]; to: string };

const DIMS: { id: string; icon: ReactNode; name: [string, string, string]; level: "strong" | "ok" | "work"; fact: [string, string, string]; spark: number[]; ev: Ev[] }[] = [
  {
    id: "ctx",
    icon: <ClipboardList />,
    name: ["Context you gave", "Aapne kitna context diya", "आपने कितना संदर्भ दिया"],
    level: "ok",
    fact: ["9 of 12 prompts named the file, the task and what you wanted", "12 me se 9 prompts me file, kaam aur kya chahiye tha", "12 में से 9"],
    spark: [40, 48, 55, 61, 70, 75],
    ev: [
      { src: ["Ticket lab · Canteen Queue", "Ticket lab · Canteen Queue", "टिकट लैब"], at: "05:40", quote: "@orders.js @PLAN.md T-102: one order is created twice at rush hour…", good: true, note: ["File, ticket and the ask, in one line", "File, ticket aur maang, ek line me", "फ़ाइल, टिकट, माँग"], to: "ticket-lab" },
      { src: ["Problem · Pair with target sum", "Problem · Pair with target sum", "प्रश्न"], at: "21 Oct", quote: "fix my code", good: false, note: ["Did not say which test fails or what you expected", "Kaunsa test fail, kya chahiye tha, ye nahi bataya", "कौन सा टेस्ट, नहीं बताया"], to: "problem" },
    ],
  },
  {
    id: "check",
    icon: <ListChecks />,
    name: ["Checking the AI's output", "AI ka output jaanchna", "AI का आउटपुट जाँचना"],
    level: "strong",
    fact: ["Ran tests after 11 of 14 accepted changes; rejected 2 with a reason", "14 me se 11 maane badlavon ke baad tests chalaye; 2 wajah ke saath mana kiye", "14 में से 11"],
    spark: [50, 52, 60, 66, 72, 79],
    ev: [
      { src: ["Ticket lab · Canteen Queue", "Ticket lab · Canteen Queue", "टिकट लैब"], at: "09:12", quote: "Two tabs or a network retry still send two. It has to stop on the server.", good: true, note: ["Rejected a client-only fix with a reason", "Sirf client wala fix wajah ke saath mana", "कारण के साथ मना"], to: "ticket-lab" },
      { src: ["Code Studio · Hostel Split", "Code Studio · Hostel Split", "स्टूडियो"], at: "22 Oct", quote: "accepted quick fix in settle()", good: false, note: ["Accepted without running the 4 failing tests", "4 fail tests chalaye bina maana", "टेस्ट बिना माना"], to: "studio" },
    ],
  },
  {
    id: "collab",
    icon: <MessagesSquare />,
    name: ["Working back and forth", "Aage-peeche baat", "आगे-पीछे बात"],
    level: "work",
    fact: ["Asked \"why\" 4 times; 3 sessions ended after the first answer", "4 baar \"kyun\" poochha; 3 session pehle jawab ke baad khatam", "4 बार \"क्यों\""],
    spark: [30, 28, 35, 33, 40, 42],
    ev: [
      { src: ["Sahayak · Lesson · Deadlocks", "Sahayak · Lesson · Deadlocks", "सहायक"], at: "23 Oct", quote: "why does the order of locks matter here?", good: true, note: ["Followed up on the answer instead of moving on", "Jawab par aage poochha, aage nahi bhage", "आगे पूछा"], to: "sahayak" },
    ],
  },
];

const LEVEL: Record<string, [string, string, string]> = {
  strong: ["Strong", "Mazboot", "मज़बूत"],
  ok: ["Getting there", "Theek, badh raha", "ठीक, बढ़ रहा"],
  work: ["Needs work", "Sudhaar chahiye", "सुधार चाहिए"],
};

export function AiReportBody() {
  const t = useT();
  const [span, setSpan] = useState<"week" | "lab">("week");
  return (
    <div className="col g20">
      <header className="page-head" style={{ marginBottom: 0 }}>
        <div className="grow">
          <div className="eyebrow">{t("Sahayak · AI-use report", "Sahayak · AI istemal report", "सहायक · AI उपयोग रिपोर्ट")}</div>
          <h1 className="h1">{t("How you worked with AI", "Aapne AI ke saath kaise kaam kiya", "आपने AI के साथ कैसे काम किया")}</h1>
          <p className="muted page-sub">{t("From your own chats, labs and Studio sessions. For your learning only: no score, and companies never see it.", "Aapki apni chats, labs aur Studio se. Sirf aapke seekhne ke liye: koi score nahi, companies kabhi nahi dekhtin.", "सिर्फ़ आपके सीखने के लिए।")}</p>
        </div>
        <Seg
          value={span}
          onChange={setSpan}
          items={[
            { id: "week", label: t("This week", "Is hafte", "इस सप्ताह") },
            { id: "lab", label: t("Last lab", "Pichhla lab", "पिछला लैब") },
          ]}
        />
      </header>
      <div className="ar-grid">
        {DIMS.map((d) => (
          <section key={d.id} className="card ar-dim" aria-labelledby={`ar-${d.id}`}>
            <div className="ar-dim-h">
              <span className={`ar-ic ${d.level}`}>{d.icon}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <b id={`ar-${d.id}`}>{t(...d.name)}</b>
                <span className={`ar-level ${d.level} tiny`}>{t(...LEVEL[d.level])}</span>
              </div>
              <span role="img" aria-label={t(`Last 6 weeks, up from ${d.spark[0]} to ${d.spark[5]}`, `Pichhle 6 hafte: ${d.spark[0]} se ${d.spark[5]}`, `6 सप्ताह`)}>
                <Spark data={d.spark} w={72} h={24} color={d.level === "work" ? "var(--coin)" : "var(--tick)"} fill={false} />
              </span>
            </div>
            <p className="small">{t(...d.fact)}</p>
            <ul className="ar-ev">
              {d.ev.map((e) => (
                <li key={e.at + e.quote} className={e.good ? "ar-good" : "ar-weak"}>
                  {e.good ? <CircleCheck /> : <CircleDashed />}
                  <div className="col g4" style={{ minWidth: 0 }}>
                    <span className="tiny faint">
                      {t(...e.src)} · <span className="mono">{e.at}</span>
                    </span>
                    <q className="mono tiny">{e.quote}</q>
                    <span className="tiny">{t(...e.note)}</span>
                  </div>
                  <Link to={e.to} className="icon-btn sm" aria-label={t(`Open ${e.src[0]}`, `Kholo: ${e.src[1]}`, "खोलें")}>
                    <ArrowRight />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="grid c2">
        <section className="card pad col g8">
          <span className="h3 row g8">
            <Hand className="ic" /> {t("When you chose not to use AI", "Jab aapne AI nahi liya", "जब आपने AI नहीं लिया")}
          </span>
          <p className="small muted">{t("You debugged \"Valid brackets\" for 12 minutes on your own before asking for a hint. That is how the debugging skill grows.", "\"Valid brackets\" ko hint maangne se pehle 12 minute khud debug kiya. Debugging ka hunar aise hi badhta.", "12 मिनट ख़ुद डिबग किया।")}</p>
        </section>
        <section className="card pad col g8 ar-habit">
          <span className="h3 row g8">
            <Target className="ic" /> {t("One habit for next week", "Agle hafte ek aadat", "अगले सप्ताह एक आदत")}
          </span>
          <p className="small">{t("After the AI answers, ask one follow-up before you accept: \"what breaks this?\"", "AI ke jawab ke baad, maanne se pehle ek sawaal aur: \"isse kya tootega?\"", "\"इससे क्या टूटेगा?\"")}</p>
          <Link to="ai-track" className="btn sm">
            <Sparkles /> {t("Practise in the track", "Track me practice", "ट्रैक में अभ्यास")}
          </Link>
        </section>
      </div>
      <div className="banner pen">
        <Lightbulb />
        <span className="small">{t("How it is made: a small model reads your transcripts against a short rubric, and every line above links to the moment it came from. It can be wrong; tap a line to check it.", "Kaise banti: ek chhota model aapke transcripts ko chhote rubric se padhta, aur upar ki har line us pal se judi. Galat ho sakti; line par tap karke jaancho.", "हर लाइन उस पल से जुड़ी है।")}</span>
      </div>
    </div>
  );
}

export function AiReportRail() {
  const t = useT();
  const toast = useToast();
  return (
    <section className="card pad col g10">
      <span className="h3 row g8">
        <ShieldCheck className="ic" /> {t("Your data", "Aapka data", "आपका डेटा")}
      </span>
      <ul className="at-rules small">
        <li>
          <Eye className="faint" /> {t("Only you see this report", "Ye report sirf aap dekhte ho", "सिर्फ़ आप देखते हैं")}
        </li>
        <li>
          <Lock className="faint" /> {t("Never shared with companies or colleges", "Companies ya college ko kabhi nahi", "कंपनी को कभी नहीं")}
        </li>
        <li>
          <Bug className="faint" /> {t("Built from 14 sessions in the last 7 days", "Pichhle 7 din ke 14 session se", "14 सत्र से")}
        </li>
      </ul>
      <button className="btn sm" onClick={() => toast(t("Report saved as PDF", "Report PDF me save", "PDF सहेजा"))}>
        <Download /> {t("Download", "Download", "डाउनलोड")}
      </button>
      <button className="btn sm ghost" onClick={() => toast(t("Report and its notes deleted", "Report aur uske notes delete", "रिपोर्ट हटाई"))}>
        <Trash2 /> {t("Delete this report", "Ye report delete karo", "रिपोर्ट हटाएँ")}
      </button>
    </section>
  );
}
