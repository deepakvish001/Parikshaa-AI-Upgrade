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
} from "../ui/kit";
import { LangButton, ThemeButton } from "../ui/shell";

const SW: { name: string; v: string; light: string; dark: string; use: string }[] = [
  { name: "Paper / Board", v: "--page", light: "#F5F3EE", dark: "#0F1512", use: "Page" },
  { name: "Panel", v: "--panel", light: "#FFFFFF", dark: "#151D19", use: "Cards, bars" },
  { name: "Ink / Chalk", v: "--ink", light: "#15161A", dark: "#E9EEEA", use: "Text" },
  { name: "Blue pen", v: "--pen", light: "#2346E8", dark: "#8EA6FF", use: "Action, links, focus" },
  { name: "Red pen", v: "--red", light: "#D93A2B", dark: "#FF8A7A", use: "Wrong, danger" },
  { name: "Green tick", v: "--tick", light: "#15803D", dark: "#6EE7A0", use: "Pass, done" },
  { name: "Highlighter", v: "--marker", light: "#FFE45C", dark: "#F5DD6B", use: "What matters" },
  { name: "Sahayak violet", v: "--ai", light: "#6D4AFF", dark: "#B7A5FF", use: "Everything AI" },
  { name: "Kesar", v: "--coin", light: "#C26A04", dark: "#FFB547", use: "Coins, streak" },
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
        <div className="eyebrow">{t("Brand & design system · v3", "Brand aur design system · v3", "ब्रांड और डिज़ाइन · v3")}</div>
        <h1 className="display brand-h1">
          {t("Paper and ", "Kaagaz aur ", "काग़ज़ और ")}
          <em>{t("blackboard.", "blackboard.", "ब्लैकबोर्ड।")}</em>
        </h1>
        <p className="map-sub">
          {t(
            "Every student in India has written an exam in blue pen, had a mistake circled in red and earned a green tick. That is our whole visual language: no borrowed orange-on-black.",
            "Har Indian student ne neele pen se exam likha, laal pen se galti ghiri dekhi, aur hara tick kamaya. Yahi hamari poori visual bhasha hai: kisi aur ka naranga-kaala nahi.",
            "हर भारतीय छात्र ने नीले पेन से परीक्षा लिखी, लाल पेन से गलती घिरी देखी, और हरा टिक पाया। यही हमारी दृश्य भाषा है।",
          )}
        </p>
      </section>

      <section className="brand-sec">
        <h2 className="brand-h2">
          <span className="num">01</span> {t("Logo", "Logo", "लोगो")}
        </h2>
        <div className="brand-grid c3">
          <div className="brand-tile light-tile">
            <Logo size={44} />
            <span className="tiny">{t("Primary lockup on paper", "Kaagaz par", "काग़ज़ पर")}</span>
          </div>
          <div className="brand-tile dark-tile">
            <span className="logo" style={{ ["--ls" as string]: "44px", color: "#E9EEEA" }}>
              <LogoMark size={44} />
              <span className="logo-word">parikshaa</span>
            </span>
            <span className="tiny">{t("On the blackboard", "Blackboard par", "ब्लैकबोर्ड पर")}</span>
          </div>
          <div className="brand-tile">
            <div className="row g12" style={{ alignItems: "flex-end" }}>
              <LogoMark size={96} />
              <LogoMark size={48} />
              <LogoMark size={28} />
              <LogoMark size={16} />
            </div>
            <span className="tiny faint">{t("The mark: प whose inner stroke is a tick. Readable at 16 px.", "Mark: प jiska andar ka hissa tick hai. 16 px par bhi saaf.", "मार्क: प जिसका भीतरी हिस्सा टिक है।")}</span>
          </div>
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
          <span className="num">02</span> {t("Colour: the pencil box", "Rang: pencil box", "रंग: पेंसिल बॉक्स")}
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
              {t("Light: warm exam paper, ink text, blue pen.", "Light: garam kaagaz, syahi, neela pen.", "लाइट: गर्म काग़ज़।")}
            </span>
          </div>
          <div className="brand-tile dark-tile" style={{ minHeight: 150 }}>
            <b className="display" style={{ fontSize: 26 }}>
              Blackboard
            </b>
            <span className="tiny" style={{ color: "#A9B6AF" }}>
              {t("Dark: green-black board, chalk colours.", "Dark: hari-kaali patti, chalk ke rang.", "डार्क: ब्लैकबोर्ड, चॉक।")}
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
