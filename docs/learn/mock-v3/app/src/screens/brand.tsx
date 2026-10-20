import { useState } from "react";
import {
  ArrowLeft,
  Play,
  Send,
  Trash2,
  Sparkles,
  Plus,
  Search,
  Bell,
  Check as CheckI,
  House,
  Target,
  Library,
  Hammer,
  BadgeCheck,
  Building2,
  Trophy,
  Brain,
  Flame,
  Coins,
  Info,
  TriangleAlert,
  CircleCheck,
  Lightbulb,
  RotateCcw,
  X,
} from "lucide-react";
import { Link, useT, useToast } from "../lib/core";
import {
  Logo,
  LogoMark,
  Diya,
  Tick,
  Hl,
  PenCircle,
  PenNote,
  Stamp,
  Badge,
  Level,
  Tabs,
  Seg,
  Toggle,
  Check,
  Meter,
  Ring,
  Donut,
  Spark,
  Avatar,
  Kbd,
  Modal,
  Code,
  Skel,
  Stat,
  setLogoVariant,
  useLogoVariant,
  type LogoVariant,
} from "../ui/kit";
import { LangButton, ThemeButton } from "../ui/shell";

const SW: { name: string; v: string; light: string; dark: string; use: string }[] = [
  { name: "Paper / Black", v: "--page", light: "#F6F6F4", dark: "#000000", use: "Page" },
  { name: "Panel", v: "--panel", light: "#FFFFFF", dark: "#0C0C0E", use: "Cards, bars" },
  { name: "Ink", v: "--ink", light: "#0A0A0B", dark: "#FAFAFA", use: "Text" },
  { name: "Blue pen", v: "--pen", light: "#2349E6", dark: "#3B62F5", use: "Action, links, focus" },
  { name: "Red pen", v: "--red", light: "#D9352A", dark: "#FF5D50", use: "Wrong, danger" },
  { name: "Green tick", v: "--tick", light: "#13803C", dark: "#2CCF78", use: "Pass, done" },
  { name: "Highlighter", v: "--marker", light: "#FFD84D", dark: "#FFD84D", use: "What matters" },
  { name: "Sahayak violet", v: "--ai", light: "#6A45FF", dark: "#9F86FF", use: "Everything AI" },
  { name: "Kesar", v: "--coin", light: "#A85A00", dark: "#FFAB2E", use: "Coins, streak" },
];

type L3 = [string, string, string];
const LOGO_OPTS: { id: LogoVariant; key: string; name: L3; idea: L3; good: L3; watch: L3 }[] = [
  {
    id: "pass",
    key: "A",
    name: ["Pass: P with a tick", "Pass: P + tick", "पास: P और टिक"],
    idea: [
      "The stem of the P is the long arm of a tick. Preparation ends in a pass.",
      "P ka danda hi tick ki lambi line hai. Taiyari ka ant: pass.",
      "P का डंडा ही टिक की लंबी रेखा है। तैयारी का अंत: पास।",
    ],
    good: ["Says what we do: practise, then pass.", "Seedha kehta hai hum kya karte hain: taiyari, phir pass.", "सीधा कहता है: तैयारी, फिर पास।"],
    watch: ["At 16 px the tick is small, still readable.", "16 px par tick chhota hai, phir bhi padhne me aata hai.", "16 px पर टिक छोटा है, फिर भी पढ़ने में आता है।"],
  },
  {
    id: "prompt",
    key: "B",
    name: ["Prompt: P as a code chevron", "Prompt: P code ka >", "प्रॉम्प्ट: P कोड का >"],
    idea: [
      "The bowl of the P is the terminal's > and a cursor waits below. Made for people who code.",
      "P ka pet terminal ka > hai, neeche cursor intezaar me. Code likhne walon ke liye.",
      "P का पेट टर्मिनल का > है, नीचे कर्सर।",
    ],
    good: ["Stands apart from every other P logo.", "Baaki P logos se bilkul alag dikhta hai.", "बाकी P लोगो से अलग दिखता है।"],
    watch: ["Can read as a flag; says less about aptitude and interviews.", "Jhande jaisa bhi padhta hai; aptitude aur interview se kam judta hai.", "झंडे जैसा भी पढ़ता है।"],
  },
  {
    id: "progress",
    key: "C",
    name: ["Progress: a P that fills", "Pragati: bharta hua P", "प्रगति: भरता हुआ P"],
    idea: [
      "The lower half of the bowl is gold, like a progress ring halfway round.",
      "P ke pet ka neeche wala aadha peela hai, jaise progress ring aadhi bhari.",
      "P के पेट का निचला आधा पीला है, जैसे आधी भरी प्रगति रिंग।",
    ],
    good: ["The clearest P at every size.", "Har size par sabse saaf P.", "हर आकार पर सबसे साफ़ P।"],
    watch: ["A plain P on a blue square looks like a parking sign.", "Neele dabbe par seedha P parking ke board jaisa lagta hai.", "नीले डिब्बे पर सीधा P पार्किंग बोर्ड जैसा लगता है।"],
  },
];

export function BrandBody() {
  const t = useT();
  const toast = useToast();
  const [tab, setTab] = useState("one");
  const [seg, setSeg] = useState("learn");
  const [on, setOn] = useState(true);
  const [chk, setChk] = useState(true);
  const [modal, setModal] = useState(false);
  const [replay, setReplay] = useState(0);
  const logo = useLogoVariant();
  return (
    <div className="brand">
      <header className="map-top">
        <Link to="map" className="btn sm ghost">
          <ArrowLeft />
          {t("All screens", "Saare screens", "सभी स्क्रीन")}
        </Link>
        <div className="row g4">
          <LangButton />
          <ThemeButton />
        </div>
      </header>

      <section className="brand-hero paper-grid">
        <div className="eyebrow">{t("Brand & design system · v4", "Brand aur design system · v4", "ब्रांड और डिज़ाइन · v4")}</div>
        <h1 className="display brand-h1">
          {t("Paper and ", "Kaagaz aur ", "काग़ज़ और ")}
          <em>{t("ink.", "syaahi.", "स्याही।")}</em>
        </h1>
        <p className="map-sub">
          {t(
            "Every student in India has written an exam in blue pen, had a mistake circled in red and earned a green tick. That is our visual language, set on true black by default and on clean paper when you switch.",
            "Har Indian student ne neele pen se exam likha, laal pen se galti ghiri dekhi, aur hara tick kamaya. Yahi hamari visual bhasha hai: default me gehra kaala, switch karo to saaf kaagaz.",
            "हर भारतीय छात्र ने नीले पेन से परीक्षा लिखी, लाल पेन से गलती घिरी देखी, और हरा टिक पाया। यही हमारी दृश्य भाषा है।",
          )}
        </p>
      </section>

      <section className="brand-sec">
        <h2 className="brand-h2">
          <span className="num">01</span> {t("Logo: three ways to draw a P", "Logo: P banane ke teen raaste", "लोगो: P के तीन रूप")}
        </h2>
        <p className="brand-lead">
          {t(
            "Each option is the letter P with one idea inside it. Press \u201cUse across the app\u201d to see it on every screen (sidebar, Studio, certificate, landing). The choice stays in this browser.",
            "Har option P akshar hai, andar ek idea ke saath. \u201cPoore app me lagao\u201d dabao to wahi logo har screen par dikhega (sidebar, Studio, certificate, landing). Choice isi browser me rehti hai.",
            "हर विकल्प P अक्षर है, भीतर एक विचार के साथ। \u201cपूरे ऐप में लगाओ\u201d दबाओ तो हर स्क्रीन पर वही दिखेगा।",
          )}
        </p>
        <div className="logo-opts">
          {LOGO_OPTS.map((o) => {
            const on = logo === o.id;
            return (
              <article className={`logo-opt ${on ? "on" : ""}`} key={o.id}>
                <header className="lo-head">
                  <span className="lo-name">
                    <span className="mono faint">{o.key}</span> {t(...o.name)}
                  </span>
                  {on ? (
                    <Badge tone="tick" icon={<CheckI size={13} />}>
                      {t("In use", "Laga hua", "लगा हुआ")}
                    </Badge>
                  ) : (
                    <button className="btn sm" onClick={() => setLogoVariant(o.id)}>
                      {t("Use across the app", "Poore app me lagao", "पूरे ऐप में लगाओ")}
                    </button>
                  )}
                </header>
                <div className="lo-tile dark-tile">
                  <div className="lo-sizes">
                    <LogoMark size={96} variant={o.id} />
                    <LogoMark size={48} variant={o.id} />
                    <LogoMark size={28} variant={o.id} />
                    <LogoMark size={16} variant={o.id} />
                  </div>
                  <span className="logo" style={{ ["--ls" as string]: "30px", color: "#FAFAFA" }}>
                    <LogoMark size={30} variant={o.id} decorative />
                    <span className="logo-word">parikshaa</span>
                  </span>
                </div>
                <div className="lo-tile light-tile">
                  <span className="logo" style={{ ["--ls" as string]: "30px", color: "#0A0A0B" }}>
                    <LogoMark size={30} variant={o.id} decorative />
                    <span className="logo-word">parikshaa</span>
                  </span>
                  <span className="lo-fav">
                    <LogoMark size={16} variant={o.id} decorative />
                    <span>Parikshaa · Aaj</span>
                  </span>
                </div>
                <p className="lo-idea">{t(...o.idea)}</p>
                <ul className="lo-notes">
                  <li className="ok">{t(...o.good)}</li>
                  <li className="warn">{t(...o.watch)}</li>
                </ul>
              </article>
            );
          })}
        </div>
        <div className="brand-grid c3 mt16">
          <div className="brand-tile">
            <div className="row g10">
              <Logo size={30} tag="Learn" />
            </div>
            <div className="row g10">
              <Logo size={30} tag="Admin" />
            </div>
            <span className="tiny faint">{t("Product tags", "Product tags", "उत्पाद टैग")}</span>
          </div>
          <div className="brand-tile">
            <span className="display" style={{ fontSize: 36 }}>
              परीक्षा
            </span>
            <span className="tiny faint">{t("Devanagari wordmark (footer, certificates)", "Devanagari wordmark (footer, certificate)", "देवनागरी वर्डमार्क")}</span>
          </div>
          <div className="brand-tile">
            <div className="dont-row">
              <span className="dont">
                <LogoMark size={40} />
                <X />
              </span>
              <span className="dont" style={{ filter: "hue-rotate(140deg)" }}>
                <LogoMark size={40} />
                <X />
              </span>
              <span className="dont" style={{ transform: "rotate(-14deg)" }}>
                <LogoMark size={40} />
                <X />
              </span>
            </div>
            <span className="tiny faint">{t("Don't stretch, recolour or tilt the mark.", "Mark ko na kheencho, na rang badlo, na tirchha karo.", "मार्क न खींचें, न रंग बदलें।")}</span>
          </div>
        </div>
      </section>

      <section className="brand-sec">
        <h2 className="brand-h2">
          <span className="num">02</span> {t("Colour: pens on black and paper", "Rang: kaale aur kaagaz par pen", "रंग: काले और काग़ज़ पर पेन")}
        </h2>
        <div className="swatches">
          {SW.map((s) => (
            <div className="swatch" key={s.v}>
              <span className="sw" style={{ background: `var(${s.v})` }} />
              <b>{s.name}</b>
              <span className="tiny faint">{s.use}</span>
              <span className="tiny mono faint">
                {s.light} · {s.dark}
              </span>
            </div>
          ))}
        </div>
        <div className="brand-grid c2 mt16">
          <div className="brand-tile light-tile paper-grid" style={{ minHeight: 150 }}>
            <b className="display" style={{ fontSize: 26, color: "#15161A" }}>
              Kaagaz
            </b>
            <span className="tiny" style={{ color: "#4B4D57" }}>
              {t("Light: clean paper, ink text, blue pen.", "Light: saaf kaagaz, syaahi, neela pen.", "लाइट: साफ़ काग़ज़।")}
            </span>
          </div>
          <div className="brand-tile dark-tile" style={{ minHeight: 150 }}>
            <b className="display" style={{ fontSize: 26 }}>
              Syaahi
            </b>
            <span className="tiny" style={{ color: "#C4C4CC" }}>
              {t("Dark, the default: true black, every edge and icon visible.", "Dark, default: gehra kaala, har dhaar aur icon saaf.", "डार्क, डिफ़ॉल्ट: गहरा काला।")}
            </span>
          </div>
        </div>
      </section>

      <section className="brand-sec">
        <h2 className="brand-h2">
          <span className="num">03</span> {t("Type", "Font", "फ़ॉन्ट")}
        </h2>
        <div className="brand-grid c3">
          <div className="brand-tile">
            <span style={{ fontSize: 56, lineHeight: 1, fontWeight: 700, letterSpacing: "-0.03em" }}>
              Aa <span style={{ fontWeight: 400 }}>Aa</span>
            </span>
            <b>IBM Plex Sans</b>
            <span className="tiny faint">{t("Titles 700, labels 500–600, text 400. Built for screens, clear on black", "Title 700, label 500–600, text 400. Screen ke liye, kaale par saaf", "शीर्षक 700, लेबल 500–600")}</span>
          </div>
          <div className="brand-tile">
            <span style={{ fontSize: 44, lineHeight: 1.25, fontWeight: 600 }}>हिंदी में सीखो</span>
            <b>IBM Plex Sans Devanagari</b>
            <span className="tiny faint">{t("Drawn with Plex, so Hindi and English sit at the same height and weight", "Plex ke saath bana: Hindi aur English ek unchai aur wazan", "हिंदी और अंग्रेज़ी एक जैसी")}</span>
          </div>
          <div className="brand-tile">
            <span className="mono" style={{ fontSize: 40, lineHeight: 1.25 }}>
              {"0O l1 {a[i]}"}
            </span>
            <b>JetBrains Mono</b>
            <span className="tiny faint">{t("Code, timers, IDs. 0 and O, l and 1 never mix up", "Code, timer, ID. 0/O aur l/1 alag", "कोड, टाइमर")}</span>
          </div>
          <div className="brand-tile">
            <span style={{ fontFamily: "var(--f-serif)", fontWeight: 600, fontSize: 40, lineHeight: 1.2 }}>Aarav Sharma</span>
            <b>IBM Plex Serif</b>
            <span className="tiny faint">{t("Only on certificates and the Pramaan stamp", "Sirf certificate aur Pramaan ki mohar", "केवल प्रमाणपत्र")}</span>
          </div>
          <div className="brand-tile">
            <span className="hand" style={{ fontSize: 34, lineHeight: 1.2, color: "var(--red-text)" }}>
              overflow here!
            </span>
            <b>Kalam</b>
            <span className="tiny faint">{t("Teacher's red-pen notes only", "Sirf teacher ke laal pen note", "केवल लाल पेन नोट")}</span>
          </div>
          <div className="brand-tile">
            <div className="col g4">
              <span className="display" style={{ fontSize: 30 }}>Page title 28 / 700</span>
              <span className="h2">Heading 18 / 650</span>
              <span className="h3">Card title 15 / 600</span>
              <span>Body 14 / 1.55</span>
              <span className="eyebrow">Label 11.5 caps</span>
            </div>
          </div>
        </div>
      </section>

      <section className="brand-sec">
        <h2 className="brand-h2">
          <span className="num">04</span> {t("Motifs that mean something", "Motif jo kuch kehte hain", "अर्थपूर्ण मोटिफ़")}
          <button className="btn sm ghost" style={{ marginLeft: "auto" }} onClick={() => setReplay((r) => r + 1)}>
            <RotateCcw />
            {t("Replay", "Phir chalao", "फिर चलाएँ")}
          </button>
        </h2>
        <div className="brand-grid c4" key={replay}>
          <div className="brand-tile">
            <span style={{ fontSize: 22, fontWeight: 600 }}>
              {t("Plan ", "Plan ", "योजना ")}
              <Hl>{t("to the day", "din tak", "दिन तक")}</Hl>
            </span>
            <span className="tiny faint">{t("Highlighter: the one phrase that matters", "Highlighter: sabse zaroori shabd", "हाइलाइटर")}</span>
          </div>
          <div className="brand-tile">
            <span className="mono" style={{ fontSize: 16 }}>
              int sum = <PenCircle>a[L] + a[R]</PenCircle>;
            </span>
            <PenNote>{t("overflows past 2³¹", "2³¹ ke paar overflow", "2³¹ के पार")}</PenNote>
            <span className="tiny faint">{t("Red pen: exactly where it went wrong", "Laal pen: theek jahan galti hai", "लाल पेन")}</span>
          </div>
          <div className="brand-tile" style={{ alignItems: "center" }}>
            <Tick size={52} />
            <span className="tiny faint">{t("Green tick draws itself when you finish", "Kaam poora to tick khud banta hai", "हरा टिक")}</span>
          </div>
          <div className="brand-tile" style={{ alignItems: "center" }}>
            <Stamp top="PRAMAAN" mid="Verified" bottom="DSA · L2" />
            <span className="tiny faint">{t("Stamp: only on verified proof", "Mohar: sirf verified saboot par", "मुहर")}</span>
          </div>
        </div>
      </section>

      <section className="brand-sec">
        <h2 className="brand-h2">
          <span className="num">05</span> {t("Components", "Components", "घटक")}
        </h2>
        <div className="brand-grid c2">
          <div className="brand-tile">
            <div className="eyebrow">{t("Buttons", "Buttons", "बटन")}</div>
            <div className="row wrap g8">
              <button className="btn pri">
                <Play />
                {t("Run", "Chalao", "चलाएँ")}
              </button>
              <button className="btn">{t("Secondary", "Secondary", "द्वितीयक")}</button>
              <button className="btn ink">
                <Send />
                {t("Submit", "Submit", "जमा करें")}
              </button>
              <button className="btn ai">
                <Sparkles />
                Sahayak
              </button>
              <button className="btn ghost">{t("Ghost", "Ghost", "घोस्ट")}</button>
              <button className="btn dang">
                <Trash2 />
                {t("Delete", "Hatao", "हटाएँ")}
              </button>
              <button className="btn" disabled>
                {t("Disabled", "Band", "अक्षम")}
              </button>
            </div>
            <div className="row wrap g8">
              <button className="btn pri sm">Small</button>
              <button className="btn pri">Default</button>
              <button className="btn pri lg">Large</button>
              <button className="icon-btn" aria-label="Search">
                <Search />
              </button>
              <button className="icon-btn" aria-label="Bell">
                <Bell />
                <span className="dot-badge" />
              </button>
            </div>
          </div>
          <div className="brand-tile">
            <div className="eyebrow">{t("Badges, levels, keys", "Badges, level, keys", "बैज, स्तर")}</div>
            <div className="row wrap g6">
              <Badge>Neutral</Badge>
              <Badge tone="pen">Pen</Badge>
              <Badge tone="tick" icon={<CircleCheck />}>
                Accepted
              </Badge>
              <Badge tone="red">Wrong answer</Badge>
              <Badge tone="ai" sq>
                AI
              </Badge>
              <Badge tone="coin" icon={<Coins />}>
                +20
              </Badge>
              <Badge tone="marker">New</Badge>
              <Badge tone="solid">Plus</Badge>
            </div>
            <div className="row wrap g12">
              <Level n={1} />
              <Level n={2} />
              <Level n={3} />
              <Level n={4} />
              <Level n={5} />
            </div>
            <div className="row g6">
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
              <span className="tiny faint">{t("search", "khojo", "खोजें")}</span>
            </div>
          </div>
          <div className="brand-tile">
            <div className="eyebrow">{t("Inputs", "Inputs", "इनपुट")}</div>
            <div className="field">
              <label>{t("Email", "Email", "ईमेल")}</label>
              <input className="input" placeholder="you@college.edu" />
            </div>
            <div className="field">
              <label>{t("Phone", "Phone", "फ़ोन")}</label>
              <input className="input bad" defaultValue="98765" />
              <span className="err">{t("Enter all 10 digits", "Poore 10 ank likho", "पूरे 10 अंक")}</span>
            </div>
            <div className="row g16">
              <span className="row g8">
                <Toggle on={on} onChange={setOn} label="Toggle" />
                <span className="small">{t("Reminders", "Reminders", "रिमाइंडर")}</span>
              </span>
              <span className="row g8">
                <Check on={chk} onChange={setChk} label="Check" />
                <span className="small">{t("Remember me", "Yaad rakho", "याद रखें")}</span>
              </span>
            </div>
          </div>
          <div className="brand-tile">
            <div className="eyebrow">{t("Tabs & segments", "Tabs aur segments", "टैब")}</div>
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { id: "one", label: t("Statement", "Statement", "कथन") },
                { id: "two", label: t("Editorial", "Editorial", "हल") },
                { id: "three", label: t("Submissions", "Submissions", "जमा"), count: 4 },
              ]}
            />
            <Seg
              value={seg}
              onChange={setSeg}
              items={[
                { id: "learn", label: t("Learn", "Seekho", "सीखो") },
                { id: "build", label: t("Build", "Banao", "बनाओ") },
                { id: "test", label: t("Test", "Test", "टेस्ट") },
              ]}
            />
          </div>
          <div className="brand-tile">
            <div className="eyebrow">{t("Progress & numbers", "Pragati aur number", "प्रगति")}</div>
            <div className="row g16 wrap">
              <Ring v={62} size={72} stroke={7}>
                <b className="num">62%</b>
              </Ring>
              <Donut
                size={72}
                stroke={10}
                parts={[
                  { v: 40, c: "var(--tick)" },
                  { v: 25, c: "var(--coin)" },
                  { v: 12, c: "var(--red)" },
                ]}
              />
              <Spark data={[3, 5, 4, 7, 6, 9, 8, 11]} w={140} h={44} />
              <Stat k={t("Solved", "Solved", "हल")} v="212" d="+14 this week" dir="up" />
            </div>
            <Meter v={46} />
            <Meter v={78} tone="tick" />
          </div>
          <div className="brand-tile">
            <div className="eyebrow">{t("Feedback", "Feedback", "प्रतिक्रिया")}</div>
            <div className="banner pen">
              <Info />
              <span>{t("Your plan moved one day because you missed Tuesday.", "Mangal chhoota, isliye plan ek din khiska.", "योजना एक दिन खिसकी।")}</span>
            </div>
            <div className="banner red">
              <TriangleAlert />
              <span>{t("Two tests fail on large numbers.", "Bade number par 2 test fail.", "बड़े नंबरों पर 2 टेस्ट फेल।")}</span>
            </div>
            <div className="banner ai">
              <Lightbulb />
              <span>{t("Sahayak noticed the same mistake twice this week.", "Sahayak ne is hafte ek hi galti do baar dekhi.", "सहायक ने वही गलती दो बार देखी।")}</span>
            </div>
            <div className="row g8">
              <button className="btn sm" onClick={() => toast(t("Saved to your list", "List me save hua", "सूची में सहेजा"))}>
                {t("Show a toast", "Toast dikhao", "टोस्ट")}
              </button>
              <button className="btn sm" onClick={() => setModal(true)}>
                {t("Open a dialog", "Dialog kholo", "डायलॉग")}
              </button>
            </div>
          </div>
          <div className="brand-tile">
            <div className="eyebrow">{t("Code", "Code", "कोड")}</div>
            <Code code={"long long sum = (long long)a[L] + a[R];\nif (sum == target) return {L, R};"} good={[1]} />
            <div className="row g8">
              <Skel w={120} h={12} />
              <Skel w={80} h={12} />
            </div>
          </div>
          <div className="brand-tile">
            <div className="eyebrow">{t("People", "Log", "लोग")}</div>
            <div className="row g10">
              <span className="avatars">
                <Avatar name="Aarav Sharma" />
                <Avatar name="Diya Rao" />
                <Avatar name="Kabir Shah" />
                <Avatar name="Zoya Khan" />
              </span>
              <span className="small muted">{t("+1,240 solving today", "+1,240 aaj solve kar rahe", "+1,240 आज")}</span>
            </div>
            <div className="row g8 small">
              <Flame style={{ color: "var(--coin)" }} />
              {t("12-day streak", "12 din ki streak", "12 दिन")}
            </div>
          </div>
        </div>
        <Modal
          open={modal}
          onClose={() => setModal(false)}
          title={t("Missed yesterday?", "Kal chhoot gaya?", "कल छूट गया?")}
          sub={t("Pick how your plan should catch up. Nothing is lost.", "Plan kaise pakde, chuno. Kuch nahi khota.", "चुनें योजना कैसे पकड़े।")}
          footer={
            <>
              <button className="btn ghost" onClick={() => setModal(false)}>
                {t("Later", "Baad me", "बाद में")}
              </button>
              <button className="btn pri" onClick={() => setModal(false)}>
                <CheckI />
                {t("Spread it over 3 days", "3 din me baanto", "3 दिनों में बाँटें")}
              </button>
            </>
          }
        />
      </section>

      <section className="brand-sec">
        <h2 className="brand-h2">
          <span className="num">06</span> {t("Icons", "Icons", "आइकन")}
        </h2>
        <div className="icon-grid">
          {[House, Target, Library, Hammer, BadgeCheck, Building2, Trophy, Brain, Sparkles, Flame, Coins, Plus].map((I, i) => (
            <span key={i} className="icon-cell">
              <I />
            </span>
          ))}
        </div>
        <p className="tiny faint mt8">{t("Lucide, 1.75 stroke, 16/18/20 px. One family everywhere.", "Lucide, 1.75 stroke, 16/18/20 px. Har jagah ek hi family.", "Lucide, एक ही परिवार।")}</p>
      </section>

      <section className="brand-sec">
        <h2 className="brand-h2">
          <span className="num">07</span> {t("Diya, the mascot (concept)", "Diya, mascot (concept)", "दीया, शुभंकर")}
        </h2>
        <div className="row wrap g24">
          {(["happy", "think", "cheer", "sleepy", "peek"] as const).map((m) => (
            <div key={m} className="col g6" style={{ alignItems: "center" }}>
              <Diya size={84} mood={m} />
              <span className="tiny faint">{m}</span>
            </div>
          ))}
        </div>
        <p className="tiny faint mt8">
          {t("Used sparingly: empty states, streaks, onboarding. Final art by an illustrator.", "Kam jagah: khaali haalat, streak, onboarding. Asli art illustrator banaye.", "कम जगह पर।")}
        </p>
      </section>

      <section className="brand-sec">
        <h2 className="brand-h2">
          <span className="num">08</span> {t("Voice", "Bolne ka tareeka", "भाषा")}
        </h2>
        <div className="brand-grid c3">
          <div className="brand-tile">
            <b>{t("Plain", "Seedha", "सीधा")}</b>
            <span className="small muted">{t("“Your code fails when the sum is bigger than an int.” Not “Edge case detected.”", "“Sum int se bada ho to code fail.” Na ki “Edge case detected.”", "सीधी बात।")}</span>
          </div>
          <div className="brand-tile">
            <b>{t("Honest", "Imaandaar", "ईमानदार")}</b>
            <span className="small muted">{t("Sample data says so. No fake reviews, no invented numbers.", "Sample data par likha. Koi nakli review ya number nahi.", "नकली कुछ नहीं।")}</span>
          </div>
          <div className="brand-tile">
            <b>{t("Your language", "Aapki bhasha", "आपकी भाषा")}</b>
            <span className="small muted">{t("English, Hinglish or हिंदी, switchable on every screen.", "English, Hinglish ya हिंदी, har screen par.", "हर स्क्रीन पर।")}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
