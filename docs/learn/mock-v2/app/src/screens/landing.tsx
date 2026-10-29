import { useState, type ComponentType } from "react";
import {
  ArrowRight,
  CalendarCheck,
  BookOpen,
  CodeXml,
  Sparkles,
  Building2,
  Hammer,
  Award,
  Check,
  ChevronDown,
  Smartphone,
  Languages,
  ShieldCheck,
  SearchCode,
  SlidersHorizontal,
  WifiOff,
} from "lucide-react";
import { Link, useT } from "../lib/core";
import { HandUnderline, LogoMark, Diya } from "../ui/kit";
import { LangMenu, ThemeButton } from "../ui/shell";
import { RotatingDemo, DemoTasks, DemoVerdict, DemoDry, DemoSahayak, DemoCompany, DemoPramaan } from "../ui/demos";

type Tri = [string, string, string];
const PILLARS: { id: string; icon: typeof CalendarCheck; name: Tri; head: Tri; word: Tri; points: Tri[]; demo: ComponentType; to: string }[] = [
  {
    id: "plan",
    icon: CalendarCheck,
    name: ["Plan", "Plan", "योजना"],
    head: ["Know what today needs. ", "Aaj kya karna hai, ", "आज क्या करना है, "],
    word: ["Every day.", "roz pata.", "रोज़ पता।"],
    points: [
      ["Six questions build a day-by-day plan around your college calendar.", "6 sawaal se din-wise plan, college calendar ke hisaab se.", "6 सवाल से दिन-वार योजना।"],
      ["Missed a day? Pick how to catch up and see the new end date first.", "Din chhoota? Kaise pakdein chuno, naya end date pehle dekho.", "दिन छूटा? नई तारीख पहले देखें।"],
      ["A timer that pauses when you leave, so the hours are real.", "Timer jo aap jaane par ruk jaata hai, ghante asli.", "टाइमर जो रुक जाता है।"],
    ],
    demo: DemoTasks,
    to: "onboarding",
  },
  {
    id: "learn",
    icon: BookOpen,
    name: ["Learn", "Seekho", "सीखो"],
    head: ["Lessons that ", "Lessons jo ", "पाठ जो "],
    word: ["show the steps.", "har kadam dikhayein.", "हर कदम दिखाएँ।"],
    points: [
      ["Every dry run is a slider you can step through, drawn from real code.", "Har dry run ek slider, asli code se bana.", "हर ड्राई रन एक स्लाइडर।"],
      ["Formulas, cheat sheets and the mistakes people usually make.", "Formula, cheat sheet aur aam galtiyan.", "सूत्र, चीट शीट, आम गलतियाँ।"],
      ["Read in English, Hinglish or Hindi.", "English, Hinglish ya Hindi me padho.", "अंग्रेज़ी, हिंग्लिश या हिंदी में।"],
    ],
    demo: DemoDry,
    to: "lesson",
  },
  {
    id: "practice",
    icon: CodeXml,
    name: ["Practice", "Abhyas", "अभ्यास"],
    head: ["A judge that tells you ", "Judge jo batata hai ", "जज जो बताता है "],
    word: ["why.", "kyun.", "क्यों।"],
    points: [
      ["On a wrong answer you see the smallest input your code fails.", "Galat jawab par sabse chhota input jahan code fail.", "सबसे छोटा गलत इनपुट।"],
      ["DSA, SQL and aptitude in one place, with contests every week.", "DSA, SQL, aptitude ek jagah, har hafte contest.", "DSA, SQL, एप्टीट्यूड एक जगह।"],
      ["Editorials with brute, better and best approaches.", "Editorial: brute, better, best.", "हल: तीन तरीके।"],
    ],
    demo: DemoVerdict,
    to: "problem",
  },
  {
    id: "sahayak",
    icon: Sparkles,
    name: ["Sahayak", "Sahayak", "सहायक"],
    head: ["A tutor that ", "Tutor jo ", "शिक्षक जो "],
    word: ["asks before it tells.", "pehle poochhe, phir bataye.", "पहले पूछे, फिर बताए।"],
    points: [
      ["Learn mode asks you questions; build mode points to the fix.", "Seekho mode sawaal poochhta, banao mode fix batata.", "दो मोड।"],
      ["Knows your problem, your code and your last verdict.", "Problem, code aur verdict jaanta hai.", "आपका प्रश्न और कोड जानता है।"],
      ["Switched off in contests and certificate tests.", "Contest aur Pramaan test me band.", "प्रतियोगिता में बंद।"],
    ],
    demo: DemoSahayak,
    to: "sahayak",
  },
  {
    id: "companies",
    icon: Building2,
    name: ["Companies", "Companies", "कंपनियाँ"],
    head: ["Company prep ", "Company prep ", "कंपनी तैयारी "],
    word: ["with sources.", "source ke saath.", "स्रोत के साथ।"],
    points: [
      ["Every topic chart says how many verified reports it comes from.", "Har chart batata hai kitne verified reports se bana.", "हर चार्ट का स्रोत।"],
      ["Service company patterns: sections, timing, negative marking.", "Service companies ka pattern: sections, samay, negative.", "सर्विस कंपनियों का पैटर्न।"],
      ["Round-by-round interview experiences, checked by moderators.", "Round-wise experiences, moderators ne jaanche.", "राउंड-वार अनुभव।"],
    ],
    demo: DemoCompany,
    to: "company",
  },
  {
    id: "build",
    icon: Hammer,
    name: ["Build", "Banao", "बनाओ"],
    head: ["Build things ", "Asli cheezein ", "असली चीज़ें "],
    word: ["you can show.", "banao aur dikhao.", "बनाओ और दिखाओ।"],
    points: [
      ["Guided labs in the browser: files, tests and a terminal.", "Browser me labs: files, tests, terminal.", "ब्राउज़र में लैब।"],
      ["Projects with a design, requirements and acceptance tests.", "Design, zarooratein aur tests ke saath projects.", "प्रोजेक्ट।"],
      ["Ship it once and it appears on your profile with a live link.", "Ek baar ship karo, profile par live link.", "प्रोफ़ाइल पर लिंक।"],
    ],
    demo: DemoTasks,
    to: "studio",
  },
  {
    id: "pramaan",
    icon: Award,
    name: ["Pramaan", "Pramaan", "प्रमाण"],
    head: ["Proof of skill, ", "Kaabiliyat ka saboot, ", "कौशल का प्रमाण, "],
    word: ["not attendance.", "attendance nahi.", "हाज़िरी नहीं।"],
    points: [
      ["Proctored tests on the same engine colleges use for exams.", "Wahi proctored engine jo college exams me lagta hai.", "निगरानी वाली परीक्षा।"],
      ["Each certificate has a QR anyone can verify.", "Har certificate par QR, koi bhi verify kare.", "QR से जाँच।"],
      ["Recruiters see it only if you choose to share.", "Recruiter tabhi dekhe jab aap share karo.", "आप चाहें तभी दिखे।"],
    ],
    demo: DemoPramaan,
    to: "pramaan",
  },
];

const FAQ: [Tri, Tri][] = [
  [
    ["Can I start for free?", "Kya free me shuru kar sakte hain?", "क्या मुफ़्त में शुरू कर सकते हैं?"],
    ["Yes. The plan, lessons, the DSA sheet, the daily problem and contests are free. Plus adds more Sahayak messages, mock interviews and company sets.", "Haan. Plan, lessons, DSA sheet, POTD aur contests free hain. Plus me zyada Sahayak, mock interview aur company sets.", "हाँ। योजना, पाठ, शीट, रोज़ का प्रश्न और प्रतियोगिताएँ मुफ़्त हैं।"],
  ],
  [
    ["Does it work on my phone?", "Kya phone par chalega?", "क्या फ़ोन पर चलेगा?"],
    ["Yes, every screen is designed for a phone first. Long coding is easier on a laptop; the app will offer to continue there.", "Haan, har screen pehle phone ke liye. Lamba coding laptop par aasaan; app wahan jaari karne dega.", "हाँ, हर स्क्रीन पहले फ़ोन के लिए।"],
  ],
  [
    ["Is the company data real?", "Company data asli hai?", "कंपनी डेटा असली है?"],
    ["Only data with a source is shown, with the number of reports and the latest date. Where we have too little, the page says so.", "Sirf source wala data, reports ki ginti aur taareekh ke saath. Kam ho to page saaf bolta hai.", "सिर्फ़ स्रोत वाला डेटा।"],
  ],
  [
    ["Will the AI just give me the answer?", "AI seedha jawab de dega?", "क्या एआई सीधा जवाब देगा?"],
    ["Not in learn mode. It asks you questions first. In build mode it points to the fix. In contests and tests it is off.", "Seekho mode me nahi; pehle sawaal poochhta hai. Banao mode me fix batata hai. Contest me band.", "सीखो मोड में नहीं।"],
  ],
];

export function LandingScreen() {
  const t = useT();
  const [tab, setTab] = useState(PILLARS[0].id);
  const [open, setOpen] = useState(0);
  const P = PILLARS.find((p) => p.id === tab)!;
  const Demo = P.demo;
  return (
    <div className="landing">
      <header className="l-nav">
        <div className="l-wrap row between">
          <Link to="landing" className="brand">
            <LogoMark size={30} />
            Parikshaa
          </Link>
          <nav className="l-links hide-phone" aria-label="Site">
            <Link to="seekho">{t("Courses", "Courses", "कोर्स")}</Link>
            <Link to="abhyas">{t("Practice", "Abhyas", "अभ्यास")}</Link>
            <Link to="companies">{t("Companies", "Companies", "कंपनियाँ")}</Link>
            <Link to="plus">{t("Pricing", "Pricing", "कीमत")}</Link>
          </nav>
          <div className="row" style={{ gap: 6 }}>
            <LangMenu />
            <ThemeButton />
            <Link to="login" className="btn ghost hide-phone">
              {t("Log in", "Log in", "लॉग इन")}
            </Link>
            <Link to="login" className="btn primary">
              {t("Start free", "Free shuru karo", "मुफ़्त शुरू करें")}
            </Link>
          </div>
        </div>
      </header>

      <section className="l-hero l-wrap">
        <div className="l-hero-copy">
          <span className="pill">
            <Languages size={14} /> {t("Made for Indian colleges · English, Hinglish, हिंदी", "Indian colleges ke liye · English, Hinglish, हिंदी", "भारतीय कॉलेजों के लिए · अंग्रेज़ी, हिंग्लिश, हिंदी")}
          </span>
          <h1>
            {t("From your first line of code to your ", "Pehli line of code se ", "कोड की पहली लाइन से ")}
            <HandUnderline>{t("first offer", "pehle offer", "पहले ऑफ़र")}</HandUnderline>
            {t(".", " tak.", " तक।")}
          </h1>
          <p>
            {t(
              "Learn, practise and prove your skills in one place: a daily plan that adapts to you, a judge that shows the smallest test you fail, and a tutor that asks before it tells.",
              "Seekho, abhyas karo aur saboot do, ek jagah: roz ka plan jo aapke hisaab se badle, judge jo sabse chhota galat test dikhaye, aur tutor jo pehle poochhe.",
              "सीखो, अभ्यास करो और प्रमाण दो, एक जगह: रोज़ की योजना, जज जो सबसे छोटा गलत टेस्ट दिखाए, और शिक्षक जो पहले पूछे।",
            )}
          </p>
          <div className="row wrap" style={{ gap: 10 }}>
            <Link to="login" className="btn primary lg">
              {t("Start free", "Free shuru karo", "मुफ़्त शुरू करें")} <ArrowRight size={16} />
            </Link>
            <Link to="problem" className="btn secondary lg">
              <CodeXml size={16} /> {t("Try a problem first", "Pehle ek problem try karo", "पहले एक प्रश्न आज़माएँ")}
            </Link>
          </div>
          <ul className="l-trust">
            <li>
              <Check size={14} /> {t("Free to start, no card", "Free shuru, card nahi", "मुफ़्त, कार्ड नहीं")}
            </li>
            <li>
              <Smartphone size={14} /> {t("Fast on a ₹10,000 phone", "₹10,000 ke phone par tez", "सस्ते फ़ोन पर तेज़")}
            </li>
            <li>
              <WifiOff size={14} /> {t("Keeps your work when the net drops", "Net jaaye to kaam safe", "नेट जाए तो काम सुरक्षित")}
            </li>
          </ul>
        </div>
        <RotatingDemo />
      </section>

      <section className="l-section l-wrap" aria-labelledby="pillars">
        <div className="l-section-head">
          <span className="eyebrow">{t("One platform", "Ek platform", "एक प्लेटफ़ॉर्म")}</span>
          <h2 id="pillars">{t("Everything from day one to the offer letter", "Pehle din se offer letter tak, sab kuch", "पहले दिन से ऑफ़र लेटर तक")}</h2>
        </div>
        <div className="pill-tabs" role="tablist" aria-label="Pillars">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <button key={p.id} type="button" role="tab" aria-selected={p.id === tab} onClick={() => setTab(p.id)}>
                <Icon size={15} />
                {t(...p.name)}
              </button>
            );
          })}
        </div>
        <div className="pillar" key={P.id}>
          <div className="pillar-copy">
            <h3>
              {t(...P.head)}
              <em>{t(...P.word)}</em>
            </h3>
            <ul>
              {P.points.map((pt, i) => (
                <li key={i}>
                  <Check size={15} />
                  {t(...pt)}
                </li>
              ))}
            </ul>
            <Link to={P.to} className="btn secondary">
              {t("Open this screen", "Ye screen kholo", "यह स्क्रीन खोलें")} <ArrowRight size={14} />
            </Link>
          </div>
          <div className="pillar-demo">
            <Demo />
          </div>
        </div>
      </section>

      <section className="l-section l-wrap" aria-labelledby="diff">
        <div className="l-section-head">
          <span className="eyebrow">{t("Why it is different", "Alag kyun", "अलग क्यों")}</span>
          <h2 id="diff">{t("Three things you will not find elsewhere", "Teen cheezein jo aur kahin nahi", "तीन चीज़ें जो और कहीं नहीं")}</h2>
        </div>
        <div className="grid c3">
          <div className="diff-card">
            <SearchCode size={22} />
            <h3>{t("The smallest failing test", "Sabse chhota galat test", "सबसे छोटा गलत टेस्ट")}</h3>
            <p>{t("Wrong answer? The judge shrinks the failing input to the smallest one, so you see the bug, not a wall of numbers.", "Galat jawab par judge input ko sabse chhota karta hai, taaki bug dikhe, numbers ki deewar nahi.", "जज गलत इनपुट को सबसे छोटा करता है।")}</p>
            <DemoVerdict />
          </div>
          <div className="diff-card">
            <SlidersHorizontal size={22} />
            <h3>{t("Dry runs you can slide", "Slide karne wale dry run", "स्लाइड वाले ड्राई रन")}</h3>
            <p>{t("Every editorial has a step-by-step sketch made by running the real solution. Numbers can never be wrong.", "Har editorial me asli solution chala kar bana sketch. Number galat ho hi nahi sakte.", "असली हल चलाकर बना चित्र।")}</p>
            <DemoDry />
          </div>
          <div className="diff-card">
            <Languages size={22} />
            <h3>{t("Your language", "Aapki bhasha", "आपकी भाषा")}</h3>
            <p>{t("Lessons, hints and Sahayak in English, Hinglish or Hindi. Switch any time, even mid-lesson.", "Lessons, hints, Sahayak English, Hinglish ya Hindi me. Kabhi bhi badlo.", "पाठ, संकेत और सहायक हिंदी में भी।")}</p>
            <div className="lang-demo">
              <p>
                <span className="tag outline">EN</span> Move R left to make the sum smaller.
              </p>
              <p>
                <span className="tag outline">HG</span> Sum ghataane ke liye R ko baayein.
              </p>
              <p lang="hi">
                <span className="tag outline">हिं</span> योग घटाने के लिए R को बाएँ खिसकाएँ।
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="l-wrap" aria-labelledby="proof">
        <div className="proof">
        <div>
          <span className="eyebrow">{t("Results", "Nateeje", "नतीजे")}</span>
          <h2 id="proof">{t("Real results, after the pilot", "Asli nateeje, pilot ke baad", "असली नतीजे, पायलट के बाद")}</h2>
          <p className="muted">
            {t(
              "We will show placement numbers and student stories only after the first college pilot, with each student's written permission. No made-up numbers here.",
              "Placement numbers aur kahaniyan sirf pehle college pilot ke baad, har student ki likhit anumati ke saath. Yahan koi nakli number nahi.",
              "पायलट के बाद ही, अनुमति के साथ। कोई नकली संख्या नहीं।",
            )}
          </p>
        </div>
        <Diya size={110} mood="cheer" className="bob" />
        </div>
      </section>

      <section className="l-section l-wrap faq" aria-labelledby="faq">
        <h2 id="faq">{t("Questions", "Sawaal", "सवाल")}</h2>
        <div className="faq-list">
          {FAQ.map(([q, a], i) => (
            <div key={i} className={`faq-item ${open === i ? "open" : ""}`}>
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                {t(...q)}
                <ChevronDown size={18} />
              </button>
              {open === i && <p>{t(...a)}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="l-cta l-wrap">
        <h2>{t("Start with six questions.", "6 sawaal se shuru karo.", "6 सवालों से शुरू करें।")}</h2>
        <p className="muted">{t("Your plan is ready in under three minutes.", "3 minute se kam me plan taiyaar.", "3 मिनट में योजना तैयार।")}</p>
        <Link to="onboarding" className="btn primary lg">
          {t("Build my plan", "Mera plan banao", "मेरी योजना बनाएँ")} <ArrowRight size={16} />
        </Link>
      </section>

      <footer className="l-foot">
        <div className="l-wrap l-foot-grid">
          <div className="stack">
            <span className="brand">
              <LogoMark size={26} /> Parikshaa
            </span>
            <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
              <ShieldCheck size={12} style={{ verticalAlign: -2 }} /> {t("Your data stays in India", "Aapka data India me rehta hai", "आपका डेटा भारत में")}
            </span>
          </div>
          {[
            [t("Learn", "Seekho", "सीखो"), ["Roadmaps", "DSA", "Core CS", "Web development", "Aptitude"]],
            [t("Practice", "Abhyas", "अभ्यास"), ["DSA sheet", "SQL", "Problem of the day", "Contests"]],
            [t("Career", "Career", "करियर"), ["Pramaan", "Profile", "Jobs", "Companies"]],
            [t("Help", "Madad", "मदद"), [t("Contact", "Sampark", "संपर्क"), "FAQ", t("Privacy", "Privacy", "निजता"), t("Refunds", "Refund", "धनवापसी")]],
          ].map(([h, items]) => (
            <div key={h as string} className="stack sm">
              <b>{h as string}</b>
              {(items as string[]).map((x) => (
                <a key={x} href="#landing" onClick={(e) => e.preventDefault()}>
                  {x}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div className="l-wordmark" aria-hidden="true">
          परीक्षा
        </div>
      </footer>
    </div>
  );
}
