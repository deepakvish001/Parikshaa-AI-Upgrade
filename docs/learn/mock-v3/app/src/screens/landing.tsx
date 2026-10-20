import { useState } from "react";
import {
  ArrowRight,
  Play,
  Check,
  CalendarRange,
  CircleX,
  Sparkles,
  Brain,
  Building2,
  Hammer,
  BadgeCheck,
  QrCode,
  ChevronDown,
  Menu as MenuIcon,
  X,
  Clock,
  RotateCcw,
  Flame,
  Lock,
  Globe2,
  ShieldCheck,
  School,
  ChartColumn,
  Users,
  Lightbulb,
  BookOpen,
  CodeXml,
} from "lucide-react";
import { Link, useT } from "../lib/core";
import { Logo, LogoMark, Hl, PenCircle, PenNote, Tick, Stamp, Seg, Badge, Diya } from "../ui/kit";
import { LangButton, ThemeButton } from "../ui/shell";

/* ---------------- hero collage ---------------- */

function DeskCollage() {
  const t = useT();
  return (
    <div className="desk" aria-hidden="true">
      <div className="sheet-card plan-sheet">
        <div className="row between">
          <span className="eyebrow">{t("Tuesday · 20 Oct", "Mangal · 20 Oct", "मंगल · 20 अक्टू")}</span>
          <span className="tiny faint num">2h 10m</span>
        </div>
        <div className="h3 mt8">{t("Today's plan", "Aaj ka plan", "आज की योजना")}</div>
        <ul className="ps-list">
          {[
            [t("Stack: the LIFO idea", "Stack: LIFO idea", "स्टैक: LIFO"), true],
            [t("Pair with target sum", "Pair with target sum", "Pair with target sum"), true],
            [t("Valid brackets", "Valid brackets", "Valid brackets"), false],
            [t("6 revision cards", "6 revision cards", "6 कार्ड"), false],
          ].map(([label, done], i) => (
            <li key={i} className={done ? "done" : ""}>
              <span className="ps-box">{done && <Tick size={14} />}</span>
              {label as string}
            </li>
          ))}
        </ul>
        <div className="segs mt12">
          <i className="ok" />
          <i className="ok" />
          <i />
          <i />
        </div>
      </div>

      <div className="sheet-card code-sheet">
        <div className="row between">
          <span className="mono tiny faint">solution.cpp</span>
          <Badge tone="red" icon={<CircleX />}>
            {t("Wrong · test 23", "Galat · test 23", "गलत · टेस्ट 23")}
          </Badge>
        </div>
        <pre className="cs-code">
          <span className="tk-kw">while</span> (L {"<"} R) {"{\n"}
          {"  "}
          <span className="tk-ty">int</span> sum = <PenCircle>a[L] + a[R]</PenCircle>;{"\n"}
          {"  "}
          <span className="tk-kw">if</span> (sum == target) <span className="tk-kw">return</span> {"{L, R};\n"}
          {"}"}
        </pre>
        <PenNote className="cs-note">{t("overflows past 2³¹ → long long", "2³¹ ke paar overflow → long long", "2³¹ के पार → long long")}</PenNote>
      </div>

      <div className="sheet-card ai-sheet">
        <span className="ai-mark">
          <Sparkles />
        </span>
        <div>
          <div className="tiny" style={{ fontWeight: 600, color: "var(--ai-text)" }}>
            Sahayak
          </div>
          <div className="small">
            {t("What happens when you add two of them in an int?", "Do ko int me jodo to kya hoga?", "दो को int में जोड़ें तो क्या होगा?")}
          </div>
        </div>
      </div>

      <div className="sticky-note">
        <span className="hand">{t("Exam week? Plan goes lighter ✓", "Exam week? Plan halka ✓", "परीक्षा सप्ताह? योजना हल्की ✓")}</span>
      </div>
      <div className="desk-stamp">
        <Stamp top="PRAMAAN" mid="Verified" bottom="DSA · L2" />
      </div>
    </div>
  );
}

/* ---------------- an evening, step by step ---------------- */

function Evening() {
  const t = useT();
  const steps = [
    { time: "7:30", icon: <CalendarRange />, h: t("Open today", "Aaj kholo", "आज खोलें"), p: t("Your plan already knows the next thing. One button: Resume.", "Plan ko agla kaam pata hai. Ek button: Resume.", "योजना को अगला काम पता है।") },
    { time: "7:45", icon: <CodeXml />, h: t("Solve with a real judge", "Asli judge par solve", "असली जज पर हल"), p: t("Fail a hidden test? You see the smallest input that breaks you.", "Hidden test fail? Sabse chhota input dikhega jo todta hai.", "सबसे छोटा इनपुट दिखेगा।") },
    { time: "8:05", icon: <Sparkles />, h: t("Stuck? Sahayak asks", "Atke? Sahayak poochhta hai", "अटके? सहायक पूछता है"), p: t("A tutor that asks the right question instead of pasting the answer.", "Tutor jo jawab chipkaane ki jagah sahi sawaal poochhe.", "सही सवाल पूछने वाला शिक्षक।") },
    { time: "8:40", icon: <BookOpen />, h: t("Watch the editorial", "Editorial dekho", "हल देखें"), p: t("Brute, better, best, with a dry run you can scrub.", "Brute, better, best, dry run slider ke saath.", "ड्राई रन के साथ।") },
    { time: "9:20", icon: <RotateCcw />, h: t("Revise before you forget", "Bhoolne se pehle dohrao", "भूलने से पहले दोहराएँ"), p: t("Six cards picked from your own mistakes.", "Aapki galtiyon se 6 cards.", "आपकी गलतियों से 6 कार्ड।") },
    { time: "9:30", icon: <Flame />, h: t("Done. Streak 13.", "Ho gaya. Streak 13.", "हो गया। लगातार 13।"), p: t("Tomorrow's plan is ready before you sleep.", "Kal ka plan sone se pehle taiyaar.", "कल की योजना तैयार।") },
  ];
  return (
    <div className="evening">
      {steps.map((s, i) => (
        <div className="ev-step" key={i}>
          <span className="ev-time mono">{s.time}</span>
          <span className="ev-ic">{s.icon}</span>
          <b>{s.h}</b>
          <p className="small muted">{s.p}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------------- bento ---------------- */

function MiniPlan() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="mini-plan">
      {days.map((d, i) => (
        <div key={i} className={`mp-day ${i === 5 ? "missed" : ""} ${i === 1 ? "today" : ""} ${i < 1 ? "done" : ""}`}>
          <span className="tiny">{d}</span>
          <i />
          <i />
          {i !== 5 && <i />}
          {i === 6 || i === 2 || i === 3 ? <i className="moved" /> : null}
        </div>
      ))}
    </div>
  );
}

function MiniVerdict() {
  const t = useT();
  return (
    <div className="mini-verdict">
      <div className="mv-bar">
        {Array.from({ length: 24 }, (_, i) => (
          <i key={i} className={i === 22 ? "bad" : "ok"} />
        ))}
      </div>
      <div className="mv-test">
        <span className="tiny faint">{t("Smallest test you fail", "Sabse chhota fail test", "सबसे छोटा फेल टेस्ट")}</span>
        <code className="mono small">a = [2³⁰, 2³⁰], target = 2³¹</code>
        <div className="row g12 tiny">
          <span>
            {t("yours", "aapka", "आपका")} <b className="t-red mono">-1</b>
          </span>
          <span>
            {t("expected", "sahi", "सही")} <b className="t-tick mono">0 1</b>
          </span>
        </div>
      </div>
    </div>
  );
}

function MiniDry() {
  const arr = [1, 3, 4, 6, 8, 11];
  return (
    <div className="mini-dry">
      <div className="md-row">
        {arr.map((v, i) => (
          <span key={i} className={`md-cell ${i === 2 || i === 3 ? "hit" : ""}`}>
            {v}
          </span>
        ))}
      </div>
      <div className="md-ptr">
        <span style={{ left: `${(2 / 6) * 100 + 8.3}%` }}>L</span>
        <span style={{ left: `${(3 / 6) * 100 + 8.3}%` }}>R</span>
      </div>
      <input type="range" min={0} max={5} defaultValue={4} className="md-range" aria-label="Dry run step" />
    </div>
  );
}

function MiniPalette() {
  const s = ["a", "a", "r", "a", "n", "a", "m", "a", "", "a", "r", "", "a", "a", "", "n", "a", "", "", "", ""];
  return (
    <div className="mini-pal">
      {s.map((x, i) => (
        <span key={i} className={`mpal ${x}`}>
          {i + 1}
        </span>
      ))}
    </div>
  );
}

function Bento() {
  const t = useT();
  return (
    <div className="bento">
      <article className="bento-tile b-plan">
        <div className="bt-h">
          <span className="bt-ic">
            <CalendarRange />
          </span>
          <div>
            <h3>{t("A plan that bends, not breaks", "Plan jo jhukta hai, tootta nahi", "योजना जो झुकती है, टूटती नहीं")}</h3>
            <p>{t("Built from your goal, hours and college calendar. Miss Saturday and the work spreads over the next days, with the new end date shown before you agree.", "Goal, ghante aur college calendar se bana. Shanivar chhoota to kaam agle dino me baant jaata hai, nayi end date pehle dikhti hai.", "आपके लक्ष्य, घंटों और कॉलेज कैलेंडर से बनी।")}</p>
          </div>
        </div>
        <MiniPlan />
      </article>
      <article className="bento-tile b-verdict">
        <div className="bt-h">
          <span className="bt-ic red">
            <CircleX />
          </span>
          <div>
            <h3>{t("The smallest test you fail", "Sabse chhota test jo fail hua", "सबसे छोटा फेल टेस्ट")}</h3>
            <p>{t("Hidden tests stay hidden. We shrink the failing one so you can see why.", "Hidden tests chhupe rehte hain. Fail wala chhota karke dikhate hain.", "फेल टेस्ट को छोटा करके दिखाते हैं।")}</p>
          </div>
        </div>
        <MiniVerdict />
      </article>
      <article className="bento-tile b-dry">
        <div className="bt-h">
          <span className="bt-ic">
            <BookOpen />
          </span>
          <div>
            <h3>{t("Editorials you can scrub", "Editorial jo chala kar dekho", "चलाकर देखने वाले हल")}</h3>
            <p>{t("Brute, better, best, and a dry run step by step.", "Brute, better, best, aur kadam-dar-kadam dry run.", "क्रमवार ड्राई रन।")}</p>
          </div>
        </div>
        <MiniDry />
      </article>
      <article className="bento-tile b-ai">
        <div className="bt-h">
          <span className="bt-ic ai">
            <Sparkles />
          </span>
          <div>
            <h3>{t("Sahayak asks before it tells", "Sahayak batane se pehle poochhta hai", "सहायक बताने से पहले पूछता है")}</h3>
            <p>{t("Learn mode gives hints and questions. Hints you take show on your submission, honestly.", "Seekho mode me hint aur sawaal. Liye hint submission par dikhte hain.", "लिए गए संकेत सबमिशन पर दिखते हैं।")}</p>
          </div>
        </div>
        <div className="mini-chat">
          <div className="msg me">{t("Why test 23?", "Test 23 kyun?", "टेस्ट 23 क्यों?")}</div>
          <div className="ai-q">
            <Lightbulb />
            <span>{t("What is the biggest value a[L] + a[R] can reach?", "a[L] + a[R] sabse bada kitna ho sakta hai?", "a[L] + a[R] सबसे बड़ा कितना हो सकता है?")}</span>
          </div>
        </div>
      </article>
      <article className="bento-tile b-apt">
        <div className="bt-h">
          <span className="bt-ic coin">
            <Brain />
          </span>
          <div>
            <h3>{t("Aptitude in the real pattern", "Asli pattern me aptitude", "असली पैटर्न में एप्टीट्यूड")}</h3>
            <p>{t("Sections, timers and negative marking as the test you will sit, then time spent on every question.", "Section, timer, negative marking asli test jaisa, phir har sawaal ka samay.", "असली परीक्षा जैसा।")}</p>
          </div>
        </div>
        <MiniPalette />
      </article>
      <article className="bento-tile b-company">
        <div className="bt-h">
          <span className="bt-ic">
            <Building2 />
          </span>
          <div>
            <h3>{t("Company prep with sources", "Company taiyari, source ke saath", "स्रोत के साथ कंपनी तैयारी")}</h3>
            <p>{t("Rounds and topics only when they are verified; every claim links to where it came from.", "Rounds aur topics tabhi jab verified hon; har baat ka source.", "सत्यापित होने पर ही।")}</p>
          </div>
        </div>
        <div className="mini-rounds">
          {[t("Online test", "Online test", "ऑनलाइन टेस्ट"), t("Tech 1", "Tech 1", "तकनीकी 1"), t("Tech 2", "Tech 2", "तकनीकी 2"), "HR"].map((r, i) => (
            <span key={i} className="mr-step">
              <i>{i + 1}</i>
              {r}
            </span>
          ))}
          <Badge tone="tick" icon={<ShieldCheck />}>
            {t("14 verified experiences", "14 verified experiences", "14 सत्यापित अनुभव")}
          </Badge>
        </div>
      </article>
      <article className="bento-tile b-build">
        <div className="bt-h">
          <span className="bt-ic tick">
            <Hammer />
          </span>
          <div>
            <h3>{t("Build things that run", "Aisi cheez banao jo chale", "चलने वाली चीज़ें बनाओ")}</h3>
            <p>{t("Real projects with milestones, tests and a live preview in the browser.", "Asli projects: milestones, tests aur browser me live preview.", "असली प्रोजेक्ट।")}</p>
          </div>
        </div>
        <div className="browser mini-browser">
          <div className="browser-bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <span className="url">
              <Lock />
              hostel-split.parikshaa.app
            </span>
          </div>
          <div className="mb-app">
            <div className="row between">
              <b className="small">Room 214</b>
              <span className="badge tick">₹0 due</span>
            </div>
            {["Aarav paid ₹1,240", "Kabir owes ₹310", "Zoya owes ₹310"].map((x) => (
              <div key={x} className="mb-row tiny">
                {x}
              </div>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}

/* ---------------- languages demo ---------------- */

function LanguageDemo() {
  const [l, setL] = useState<"en" | "hg" | "hi">("hg");
  const text = {
    en: { h: "Two pointers", p: "Keep one finger at each end of a sorted array. If the sum is too small, move the left finger right; if it is too big, move the right finger left." },
    hg: { h: "Two pointers", p: "Sorted array ke dono kinaron par ek-ek ungli rakho. Sum chhota ho to baayi ungli daayein khiskao; bada ho to daayi ungli baayein." },
    hi: { h: "दो पॉइंटर", p: "क्रमबद्ध ऐरे के दोनों सिरों पर एक-एक उँगली रखें। योग छोटा हो तो बाईं उँगली दाईं ओर, बड़ा हो तो दाईं उँगली बाईं ओर खिसकाएँ।" },
  }[l];
  return (
    <div className="lang-demo">
      <Seg
        value={l}
        onChange={setL}
        items={[
          { id: "en", label: "English" },
          { id: "hg", label: "Hinglish" },
          { id: "hi", label: "हिंदी" },
        ]}
      />
      <div className="lang-page margin-page paper-ruled" key={l}>
        <span className="eyebrow">Lesson 4 · Arrays</span>
        <h3 className="display" style={{ fontSize: 34 }}>
          {text.h}
        </h3>
        <p className="prose">{text.p}</p>
        <div className="code nonum" style={{ maxWidth: 420 }}>
          <span className="ln">
            <span className="tk-kw">while</span> (L {"<"} R) {"{ … }"}
          </span>
        </div>
        <PenNote className="lang-note">{l === "hi" ? "कोड हमेशा अंग्रेज़ी में" : "code stays in English"}</PenNote>
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */

const FAQ: [string, string, string, string][] = [
  ["Is it really free?", "Kya sach me free hai?", "The free plan has the full DSA sheet, the judge, editorials, revision and a daily Sahayak allowance. Plus adds unlimited mocks and more Sahayak.", "Free plan me poori DSA sheet, judge, editorials, revision aur roz ka Sahayak quota hai. Plus me unlimited mocks aur zyada Sahayak."],
  ["Do I need to know coding already?", "Kya pehle se coding aani chahiye?", "No. The plan starts from where you are, even from your first line of code.", "Nahi. Plan wahan se shuru hota hai jahan aap ho, pehli line se bhi."],
  ["Will Sahayak just give me the answer?", "Kya Sahayak seedha jawab de dega?", "In Learn mode it gives hints and questions, not full solutions. In Build mode it can suggest code as a diff you choose to apply.", "Seekho mode me hint aur sawaal, poora hal nahi. Banao mode me diff ke roop me code sujhata hai, lagana aapki marzi."],
  ["Can my college use it for placement tests?", "Kya college placement test ke liye use kar sakta hai?", "Yes. Colleges run proctored tests, see readiness by branch and manage drives from one place.", "Haan. College proctored test, branch-war readiness aur drives ek jagah se chala sakte hain."],
  ["Is my data sold?", "Kya mera data becha jaata hai?", "No. Your data is used to run your plan. You can export or delete it from Settings at any time.", "Nahi. Data sirf aapka plan chalane ke liye. Settings se kabhi bhi export ya delete karo."],
];

export function LandingBody() {
  const t = useT();
  const [nav, setNav] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const links = [
    [t("Learn", "Seekho", "सीखो"), "#l-features"],
    [t("Practice", "Abhyas", "अभ्यास"), "#l-evening"],
    [t("Build", "Banao", "बनाओ"), "#l-features"],
    [t("Colleges", "Colleges", "कॉलेज"), "#l-colleges"],
    [t("Pricing", "Pricing", "क़ीमत"), "#l-pricing"],
  ];
  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth" });
    setNav(false);
  };
  return (
    <div className="landing">
      <header className="l-nav">
        <div className="l-wrap l-nav-in">
          <Link to="landing" aria-label="Parikshaa">
            <Logo size={30} />
          </Link>
          <nav className="l-links">
            {links.map(([label, href]) => (
              <a key={label} href={href} onClick={go(href)}>
                {label}
              </a>
            ))}
          </nav>
          <div className="row g4">
            <span className="hide-phone row g4">
              <LangButton compact />
              <ThemeButton />
            </span>
            <Link to="login" className="btn ghost hide-phone">
              {t("Sign in", "Sign in", "साइन इन")}
            </Link>
            <Link to="login" className="btn pri">
              {t("Start free", "Free shuru karo", "मुफ़्त शुरू करें")}
            </Link>
            <button className="icon-btn l-burger" onClick={() => setNav(!nav)} aria-label="Menu">
              {nav ? <X /> : <MenuIcon />}
            </button>
          </div>
        </div>
        {nav && (
          <div className="l-mobile">
            {links.map(([label, href]) => (
              <a key={label} href={href} onClick={go(href)}>
                {label}
              </a>
            ))}
            <div className="row g8">
              <LangButton />
              <ThemeButton />
              <Link to="login" className="btn grow">
                {t("Sign in", "Sign in", "साइन इन")}
              </Link>
            </div>
          </div>
        )}
      </header>

      <section className="l-hero paper-grid">
        <div className="l-wrap l-hero-in">
          <div className="l-hero-copy">
            <span className="l-pill">
              <span className="badge marker sq">{t("New", "Naya", "नया")}</span>
              {t("Plans now follow your college exam calendar", "Plan ab college exam calendar ke saath chalta hai", "योजना अब कॉलेज परीक्षा कैलेंडर के साथ")}
              <ArrowRight />
            </span>
            <h1 className="display l-h1">
              {t("Placement prep,", "Placement ki taiyari,", "प्लेसमेंट की तैयारी,")}
              <br />
              {t("planned ", "planned ", "योजना ")}
              <Hl>{t("to the day.", "har din ki.", "हर दिन की।")}</Hl>
            </h1>
            <p className="l-sub">
              {t(
                "Parikshaa turns your goal and your college calendar into a plan for every evening, checks every solution, circles the exact line that broke, and turns your work into proof a company can verify.",
                "Parikshaa aapke goal aur college calendar se har shaam ka plan banata hai, har solution jaanchta hai, todne wali line ko ghera karta hai, aur aapke kaam ko aisa saboot banata hai jise company verify kar sake.",
                "परीक्षा आपके लक्ष्य और कॉलेज कैलेंडर से हर शाम की योजना बनाता है, हर हल जाँचता है, और आपके काम को सत्यापन-योग्य प्रमाण बनाता है।",
              )}
            </p>
            <div className="row wrap g10 mt24">
              <Link to="login" className="btn pri lg">
                {t("Build my plan, free", "Mera plan banao, free", "मेरी योजना बनाओ")}
                <ArrowRight />
              </Link>
              <a href="#l-evening" className="btn lg" onClick={go("#l-evening")}>
                <Play />
                {t("See one evening", "Ek shaam dekho", "एक शाम देखें")}
              </a>
            </div>
            <div className="l-trust">
              <span>
                <Check /> {t("Free plan, no card", "Free plan, card nahi", "मुफ़्त, कार्ड नहीं")}
              </span>
              <span>
                <Globe2 /> English · Hinglish · हिंदी
              </span>
              <span>
                <ShieldCheck /> {t("Your data, exportable", "Aapka data, export karo", "आपका डेटा")}
              </span>
            </div>
          </div>
          <DeskCollage />
        </div>
      </section>

      <section className="l-sec" id="l-evening">
        <div className="l-wrap">
          <div className="l-sec-h">
            <span className="eyebrow">{t("How it works", "Kaise chalta hai", "कैसे चलता है")}</span>
            <h2 className="display l-h2">{t("One evening with Parikshaa.", "Parikshaa ke saath ek shaam.", "परीक्षा के साथ एक शाम।")}</h2>
            <p className="muted l-lead">{t("Two hours, no guessing what to do next.", "Do ghante, agla kya karna hai ye sochna nahi.", "दो घंटे, अगला क्या करें यह सोचना नहीं।")}</p>
          </div>
          <Evening />
        </div>
      </section>

      <section className="l-sec l-alt" id="l-features">
        <div className="l-wrap">
          <div className="l-sec-h">
            <span className="eyebrow">{t("Everything in one place", "Sab ek jagah", "सब एक जगह")}</span>
            <h2 className="display l-h2">
              {t("Learn, practise, build, ", "Seekho, practice karo, banao, ", "सीखो, अभ्यास करो, बनाओ, ")}
              <em>{t("prove.", "saabit karo.", "साबित करो।")}</em>
            </h2>
          </div>
          <Bento />
        </div>
      </section>

      <section className="l-sec">
        <div className="l-wrap l-split">
          <div>
            <span className="eyebrow">{t("Your language", "Aapki bhasha", "आपकी भाषा")}</span>
            <h2 className="display l-h2">{t("Learn in the language you think in.", "Usi bhasha me seekho jisme sochte ho.", "उसी भाषा में सीखो जिसमें सोचते हो।")}</h2>
            <p className="muted l-lead">
              {t(
                "Every lesson, editorial and Sahayak reply in English, Hinglish or Hindi. Switch any time; code stays code.",
                "Har lesson, editorial aur Sahayak ka jawab English, Hinglish ya Hindi me. Kabhi bhi badlo; code code hi rehta hai.",
                "हर पाठ, हल और सहायक का जवाब तीनों भाषाओं में।",
              )}
            </p>
          </div>
          <LanguageDemo />
        </div>
      </section>

      <section className="l-sec l-ink">
        <div className="l-wrap l-split">
          <div className="l-proof">
            <div className="proof-card">
              <div className="row g12">
                <span className="avatar" style={{ ["--av" as string]: "44px", ["--av-bg" as string]: "#2346E8" }}>
                  AS
                </span>
                <div>
                  <b>Aarav Sharma</b>
                  <div className="tiny" style={{ opacity: 0.7 }}>
                    B.Tech CSE · 2027
                  </div>
                </div>
              </div>
              <div className="proof-cols">
                <div>
                  <div className="eyebrow" style={{ color: "#6EE7A0" }}>
                    {t("Verified by Parikshaa", "Parikshaa ne verify kiya", "सत्यापित")}
                  </div>
                  {[
                    ["DSA · L2", t("proctored, 78/100", "proctored, 78/100", "निगरानी में, 78/100")],
                    ["212", t("problems solved on the judge", "judge par solve", "जज पर हल")],
                    ["SQL · L1", t("proctored, 84/100", "proctored, 84/100", "निगरानी में, 84/100")],
                  ].map(([a, b]) => (
                    <div className="proof-row" key={a}>
                      <BadgeCheck />
                      <b>{a}</b>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="eyebrow" style={{ opacity: 0.6 }}>
                    {t("Self-declared", "Khud bataya", "स्व-घोषित")}
                  </div>
                  {["React", "Figma", "Public speaking"].map((a) => (
                    <div className="proof-row dim" key={a}>
                      <span className="dot" />
                      <span>{a}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="proof-qr">
                <QrCode />
                <span className="tiny">parikshaa.in/v/7KQ2-91XA</span>
              </div>
              <div className="proof-stamp">
                <Stamp top="PRAMAAN" mid="Verified" bottom="20 · 10 · 2026" />
              </div>
            </div>
          </div>
          <div>
            <span className="eyebrow" style={{ color: "#F5DD6B" }}>
              Pramaan
            </span>
            <h2 className="display l-h2">{t("Proof, not claims.", "Saboot, daave nahi.", "प्रमाण, दावे नहीं।")}</h2>
            <p className="l-lead" style={{ opacity: 0.8 }}>
              {t(
                "Take a proctored skill test and get a certificate with a QR anyone can check. Your profile keeps what you proved apart from what you typed.",
                "Proctored skill test do aur QR wala certificate pao jise koi bhi check kare. Profile me jo saabit kiya wo, aur jo khud likha wo, alag dikhta hai.",
                "निगरानी वाला टेस्ट दें और QR वाला प्रमाणपत्र पाएँ।",
              )}
            </p>
            <Link to="pramaan" className="btn lg mt24 l-ink-btn">
              {t("See Pramaan tests", "Pramaan tests dekho", "प्रमाण टेस्ट देखें")}
              <ArrowRight />
            </Link>
          </div>
        </div>
      </section>

      <section className="l-sec" id="l-colleges">
        <div className="l-wrap">
          <div className="l-college">
            <div>
              <span className="eyebrow">{t("For colleges", "Colleges ke liye", "कॉलेजों के लिए")}</span>
              <h2 className="display l-h2">{t("Running placements? We run the tests too.", "Placement chalate ho? Test bhi hum chalate hain.", "प्लेसमेंट चलाते हैं? टेस्ट भी हम चलाते हैं।")}</h2>
              <p className="muted l-lead">
                {t(
                  "Proctored exams, branch-wise readiness, drives and company shortlists, on the same platform your students practise on.",
                  "Proctored exams, branch-war readiness, drives aur company shortlists, usi platform par jahan students practice karte hain.",
                  "उसी प्लेटफ़ॉर्म पर जहाँ छात्र अभ्यास करते हैं।",
                )}
              </p>
              <div className="row wrap g10 mt16">
                <a className="btn ink lg" href="#l-pricing" onClick={go("#l-pricing")}>
                  <School />
                  {t("Campus plans", "Campus plans", "कैंपस योजनाएँ")}
                </a>
              </div>
            </div>
            <div className="college-grid">
              {[
                [<ShieldCheck key="a" />, t("Proctored tests", "Proctored tests", "निगरानी वाले टेस्ट"), t("Camera, screen and tab checks, with a human review queue.", "Camera, screen, tab checks; insaan review karta hai.", "कैमरा, स्क्रीन, टैब जाँच।")],
                [<ChartColumn key="b" />, t("Readiness heatmap", "Readiness heatmap", "तैयारी हीटमैप"), t("Which branch is ready for which company, this week.", "Kaunsi branch kis company ke liye taiyaar.", "कौन-सी शाखा तैयार।")],
                [<Users key="c" />, t("Drives & shortlists", "Drives aur shortlist", "ड्राइव और शॉर्टलिस्ट"), t("Eligibility, rounds and offers in one board.", "Eligibility, rounds, offers ek board par.", "एक बोर्ड पर।")],
                [<Clock key="d" />, t("Exam-aware plans", "Exam ke hisaab se plan", "परीक्षा-अनुसार योजना"), t("Student plans lighten during semester exams.", "Semester exam me student ka plan halka.", "परीक्षा में योजना हल्की।")],
              ].map(([ic, h, p], i) => (
                <div className="cg-tile" key={i}>
                  <span className="bt-ic">{ic}</span>
                  <b>{h}</b>
                  <p className="small muted">{p}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="l-sec l-alt" id="l-pricing">
        <div className="l-wrap">
          <div className="l-sec-h center">
            <span className="eyebrow">{t("Pricing", "Pricing", "क़ीमत")}</span>
            <h2 className="display l-h2">{t("Start free. Stay if it helps.", "Free shuru karo. Kaam aaye to ruko.", "मुफ़्त शुरू करें।")}</h2>
          </div>
          <div className="price-grid">
            <div className="price-card">
              <b className="h2">Free</b>
              <div className="price">
                <span className="display">₹0</span>
              </div>
              <p className="small muted">{t("Everything you need to start and keep going.", "Shuru karne aur chalte rehne ke liye sab.", "शुरू करने के लिए सब।")}</p>
              <ul className="price-list">
                {[
                  t("Daily plan that follows your calendar", "Calendar ke saath roz ka plan", "कैलेंडर-अनुसार योजना"),
                  t("Full DSA sheet and judge", "Poori DSA sheet aur judge", "पूरी DSA शीट और जज"),
                  t("Editorials with dry runs", "Dry run wale editorials", "ड्राई रन वाले हल"),
                  t("Revision cards", "Revision cards", "दोहराई कार्ड"),
                  t("Sahayak: 20 messages a day", "Sahayak: roz 20 message", "सहायक: रोज़ 20 संदेश"),
                ].map((x) => (
                  <li key={x}>
                    <Check />
                    {x}
                  </li>
                ))}
              </ul>
              <Link to="login" className="btn lg block">
                {t("Start free", "Free shuru karo", "मुफ़्त शुरू करें")}
              </Link>
            </div>
            <div className="price-card plus">
              <div className="row between">
                <b className="h2">Plus</b>
                <Badge tone="marker">{t("Most chosen", "Sabse zyada chuna", "सबसे लोकप्रिय")}</Badge>
              </div>
              <div className="price">
                <span className="display">₹[yearly price]</span>
                <span className="small muted">/ {t("year", "saal", "वर्ष")}</span>
              </div>
              <p className="small muted">{t("Price to be set by Parikshaa. Shown here as a placeholder.", "Daam Parikshaa tay karega. Yahan sirf jagah rakhi hai.", "क़ीमत तय होनी है।")}</p>
              <ul className="price-list">
                {[
                  t("Everything in Free", "Free ka sab kuch", "फ़्री का सब"),
                  t("Unlimited aptitude and company-pattern mocks", "Unlimited aptitude aur company-pattern mocks", "असीमित मॉक"),
                  t("Sahayak: 200 messages a day, Build mode", "Sahayak: roz 200, Banao mode", "सहायक: रोज़ 200"),
                  t("Guided projects with review", "Review ke saath projects", "समीक्षा सहित प्रोजेक्ट"),
                  t("One Pramaan test every month", "Har mahine ek Pramaan test", "हर महीने एक प्रमाण टेस्ट"),
                ].map((x) => (
                  <li key={x}>
                    <Check />
                    {x}
                  </li>
                ))}
              </ul>
              <Link to="plus" className="btn pri lg block">
                {t("See Plus", "Plus dekho", "प्लस देखें")}
              </Link>
            </div>
            <div className="price-card">
              <b className="h2">{t("Campus", "Campus", "कैंपस")}</b>
              <div className="price">
                <span className="display" style={{ fontSize: 40 }}>
                  {t("Per student", "Per student", "प्रति छात्र")}
                </span>
              </div>
              <p className="small muted">{t("For training and placement cells.", "Training aur placement cell ke liye.", "प्लेसमेंट सेल के लिए।")}</p>
              <ul className="price-list">
                {[
                  t("Plus for every student", "Har student ko Plus", "हर छात्र को प्लस"),
                  t("Proctored tests and drives", "Proctored tests aur drives", "टेस्ट और ड्राइव"),
                  t("Readiness by branch", "Branch-war readiness", "शाखा-वार तैयारी"),
                  t("GST invoice, PO and NEFT", "GST invoice, PO, NEFT", "GST चालान"),
                ].map((x) => (
                  <li key={x}>
                    <Check />
                    {x}
                  </li>
                ))}
              </ul>
              <a className="btn ink lg block" href="#l-colleges" onClick={go("#l-colleges")}>
                {t("Talk to us", "Baat karo", "बात करें")}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="l-sec">
        <div className="l-wrap l-faq">
          <div>
            <span className="eyebrow">FAQ</span>
            <h2 className="display l-h2">{t("Fair questions.", "Seedhe sawaal.", "सीधे सवाल।")}</h2>
            <Diya size={88} mood="happy" />
          </div>
          <div className="faq">
            {FAQ.map((f, i) => (
              <div key={i} className={`faq-item ${open === i ? "open" : ""}`}>
                <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                  <span>{t(f[0], f[1], f[1])}</span>
                  <ChevronDown />
                </button>
                {open === i && <p className="muted">{t(f[2], f[3], f[3])}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="l-final paper-grid">
        <div className="l-wrap">
          <h2 className="display l-final-h">
            {t("Your exam has a date.", "Exam ki tareekh tay hai.", "परीक्षा की तारीख़ तय है।")}
            <br />
            <em>{t("Your plan should too.", "Plan ki bhi honi chahiye.", "योजना की भी होनी चाहिए।")}</em>
          </h2>
          <Link to="login" className="btn pri lg mt24">
            {t("Build my plan, free", "Mera plan banao, free", "मेरी योजना बनाओ")}
            <ArrowRight />
          </Link>
        </div>
      </section>

      <footer className="l-foot">
        <div className="l-wrap">
          <div className="l-foot-grid">
            <div className="col g12">
              <Logo size={28} />
              <p className="small muted" style={{ maxWidth: 280 }}>
                {t("Placement prep for Indian engineering students, in the language you think in.", "Indian engineering students ke liye placement prep, aapki bhasha me.", "भारतीय इंजीनियरिंग छात्रों के लिए।")}
              </p>
            </div>
            {[
              [t("Learn", "Seekho", "सीखो"), ["DSA sheet", "Aptitude", "SQL", "Roadmaps"]],
              [t("Career", "Career", "करियर"), ["Companies", "Pramaan", "Jobs", "Build"]],
              [t("Company", "Company", "कंपनी"), [t("About", "About", "परिचय"), t("Colleges", "Colleges", "कॉलेज"), t("Careers", "Careers", "नौकरियाँ"), t("Contact", "Contact", "संपर्क")]],
              [t("Legal", "Legal", "क़ानूनी"), [t("Privacy", "Privacy", "गोपनीयता"), t("Terms", "Terms", "शर्तें"), t("Refunds", "Refunds", "रिफ़ंड"), "DPDP"]],
            ].map(([h, items]) => (
              <div key={h as string} className="col g6">
                <b className="small">{h as string}</b>
                {(items as string[]).map((x) => (
                  <a key={x} href="#landing" className="small muted">
                    {x}
                  </a>
                ))}
              </div>
            ))}
          </div>
          <div className="l-word display" aria-hidden="true">
            परीक्षा
          </div>
          <div className="row between wrap small faint" style={{ gap: 8 }}>
            <span className="row g6">
              <LogoMark size={16} /> © 2026 Parikshaa
            </span>
            <span>{t("Made in India", "Made in India", "भारत में बना")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

