import { useState } from "react";
import {
  Bookmark,
  Plus,
  Globe,
  Lock,
  Share2,
  MoreHorizontal,
  FileText,
  Download,
  X,
  Bold,
  Italic,
  Underline,
  List,
  Heading2,
  ImageIcon,
  Loader2,
  Sparkles,
  MessageSquare,
  ThumbsUp,
  Users,
  Flag,
  Check,
  Crown,
  Bell,
  Palette,
  ShieldCheck,
  CreditCard,
  Trash2,
  Moon,
  Search,
  CircleCheck,
  Pin,
  History,
} from "lucide-react";
import { Link, useT, useTheme, useLang, useToast } from "../lib/core";
import { Bar, Check as CheckBox, Diya, Level, Seg, Toggle, SampleNote } from "../ui/kit";
import { PageHead } from "../ui/shell";
import { SahayakChat } from "../ui/sahayak-dock";

/* ---------------- lists ---------------- */

export function ListsBody() {
  const t = useT();
  const toast = useToast();
  const [pub, setPub] = useState(true);
  const [done, setDone] = useState([false, true, false, false, false]);
  const items: [string, 2 | 3 | 4][] = [
    ["Pair with target sum", 2],
    ["Maximum subarray sum", 3],
    ["Merge overlapping intervals", 4],
    ["Rotten oranges", 3],
    ["Longest substring without repeats", 3],
  ];
  const pct = Math.round((done.filter(Boolean).length / items.length) * 100);
  return (
    <div className="page stagger">
      <PageHead
        title={t("My lists", "Meri lists", "मेरी सूचियाँ")}
        sub={t("Make a list for any goal: a company, a revision week, or the problems a friend should try.", "Kisi bhi goal ki list: company, revision hafta, ya dost ke liye problems.", "किसी भी लक्ष्य की सूची।")}
        actions={
          <button type="button" className="btn primary">
            <Plus size={15} /> {t("New list", "Nayi list", "नई सूची")}
          </button>
        }
      />
      <div className="lists-layout">
        <nav className="panel list" aria-label="Lists">
          {[
            [t("Nimbu Labs sprint", "Nimbu Labs sprint", "निम्बू लैब्स"), 5, true, true],
            [t("Revision week", "Revision hafta", "दोहराई हफ़्ता"), 18, false, false],
            [t("Mistakes I keep making", "Baar-baar ki galtiyan", "बार-बार की गलतियाँ"), 9, false, false],
            [t("For Riya", "Riya ke liye", "रिया के लिए"), 6, true, false],
          ].map(([n, c, p, on]) => (
            <button key={n as string} type="button" className={`list-row ${on ? "on-row" : ""}`}>
              <Bookmark size={15} />
              <span className="t">{n}</span>
              {p ? <Globe size={13} className="faint" /> : <Lock size={13} className="faint" />}
              <span className="faint num" style={{ fontSize: "var(--fs-12)" }}>
                {c}
              </span>
            </button>
          ))}
        </nav>
        <section className="stack">
          <div className="panel pad-lg list-head">
            <div className="stack sm grow">
              <h2 style={{ fontSize: "var(--fs-22)", fontWeight: 800 }}>{t("Nimbu Labs sprint", "Nimbu Labs sprint", "निम्बू लैब्स")}</h2>
              <span className="muted">{t("Problems asked there in 2026, by topic.", "Wahan 2026 me poochhe gaye problems, topic-wise.", "2026 में पूछे गए प्रश्न।")}</span>
              <div className="row" style={{ gap: 10, fontSize: "var(--fs-13)" }}>
                <span className="row" style={{ gap: 6 }}>
                  <button type="button" className="toggle" aria-pressed={pub} aria-label="Public" onClick={() => setPub(!pub)} />
                  {pub ? t("Public", "Public", "सार्वजनिक") : t("Private", "Private", "निजी")}
                </span>
                <button type="button" className="btn ghost sm" onClick={() => toast(t("Link copied", "Link copy hua", "लिंक कॉपी"))}>
                  <Share2 size={13} /> {t("Share", "Share", "साझा")}
                </button>
                <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
                  {t("23 people copied this list", "23 logon ne copy ki", "23 लोगों ने कॉपी की")}
                </span>
              </div>
            </div>
            <div className="list-pct">
              <b className="num">{pct}%</b>
              <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
                {done.filter(Boolean).length} / {items.length} {t("solved", "hal", "हल")}
              </span>
              <Bar value={pct} />
            </div>
          </div>
          <div className="panel list">
            {items.map(([n, lv], i) => (
              <div key={n} className="list-row">
                <CheckBox on={done[i]} onChange={(v) => setDone((d) => d.map((x, j) => (j === i ? v : x)))} label={n} />
                <Link to="problem" className="t" style={{ color: "var(--text)" }}>
                  {n}
                </Link>
                <Level lv={lv} />
                <Link to="editorial" className="icon-btn" aria-label="Editorial">
                  <FileText size={15} />
                </Link>
                <span className="icon-btn" aria-label="More">
                  <MoreHorizontal size={15} />
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------------- notes ---------------- */

export function NotesBody() {
  const t = useT();
  const [open, setOpen] = useState(true);
  const [writing, setWriting] = useState(false);
  return (
    <div className="page stagger">
      <PageHead
        title={t("Notes", "Notes", "नोट्स")}
        sub={t("Your notes, plus notes Sahayak drafts from your own submissions and mistakes. You edit; it never publishes.", "Aapke notes, aur Sahayak ke draft jo aapke submissions aur galtiyon se bante hain. Aap edit karo.", "आपके नोट्स।")}
        actions={
          <button type="button" className="btn primary" onClick={() => setOpen(true)}>
            <Plus size={15} /> {t("New note", "Naya note", "नया नोट")}
          </button>
        }
      />
      <div className="notes-grid">
        {[
          ["Two pointers", t("When the array is sorted, start at both ends. Keep the sum in long long.", "Sorted ho to dono kinaron se. Sum long long me.", "दोनों सिरों से।"), ["arrays", "pattern"], t("2 days ago", "2 din pehle", "2 दिन पहले")],
          ["Overflow checklist", t("Any sum of two values over 10⁹ → 64-bit. Any product → check before multiplying.", "Do values ka sum 10⁹ se upar → 64-bit. Guna → pehle jaancho.", "64-बिट।"), ["mistakes"], t("Today", "Aaj", "आज")],
          ["Round robin", t("Quantum small → many switches. Draw the Gantt chart first.", "Chhota quantum → zyada switch. Pehle Gantt chart.", "पहले गैंट चार्ट।"), ["os"], t("5 days ago", "5 din pehle", "5 दिन पहले")],
          ["Speed, time, distance", t("Convert km/h with 5/18 first. Average speed for equal distances = 2ab/(a+b).", "Pehle 5/18 se convert. Barabar doori ki average = 2ab/(a+b).", "पहले 5/18 से।"), ["aptitude"], t("1 week ago", "1 hafta pehle", "1 हफ़्ता पहले")],
        ].map(([title, body, tags, when]) => (
          <button key={title as string} type="button" className="note-card" onClick={() => setOpen(true)}>
            <b>{title as string}</b>
            <p>{body as string}</p>
            <div className="row wrap" style={{ gap: 4 }}>
              {(tags as string[]).map((x) => (
                <span key={x} className="tag">
                  {x}
                </span>
              ))}
            </div>
            <span className="faint" style={{ fontSize: "var(--fs-11)" }}>
              {when as string}
            </span>
          </button>
        ))}
      </div>
      {open && (
        <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="note-modal" role="dialog" aria-modal="true" aria-label="Note">
            <div className="row between" style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
              <div>
                <b>Pair with target sum</b>
                <div className="faint" style={{ fontSize: "var(--fs-11)" }}>
                  {t("Edited just now", "Abhi edit hua", "अभी बदला")}
                </div>
              </div>
              <div className="row" style={{ gap: 2 }}>
                <button type="button" className="icon-btn" aria-label="Download">
                  <Download size={15} />
                </button>
                <button type="button" className="icon-btn" aria-label="Close" onClick={() => setOpen(false)}>
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="note-tools">
              {[Bold, Italic, Underline, Heading2, List, ImageIcon].map((I, i) => (
                <button key={i} type="button" className="icon-btn" aria-label="Format">
                  <I size={15} />
                </button>
              ))}
            </div>
            <div className="note-body">
              {writing ? (
                <div className="note-writing">
                  <Loader2 size={20} className="spin" />
                  <span className="faint">{t("Sahayak is drafting from your 3 submissions…", "Sahayak aapke 3 submissions se draft likh raha hai…", "सहायक लिख रहा है…")}</span>
                </div>
              ) : (
                <>
                  <h3>{t("What I got wrong", "Kya galat kiya", "क्या गलत किया")}</h3>
                  <p>
                    {t(
                      "Tries 1 and 2 kept the sum in an int. The smallest failing test was a = [2³⁰, 2³⁰], target = 2³¹.",
                      "Try 1 aur 2 me sum int me tha. Sabse chhota galat test: a = [2³⁰, 2³⁰], target = 2³¹.",
                      "योग int में था।",
                    )}
                  </p>
                  <h3>{t("The fix", "Fix", "सुधार")}</h3>
                  <p className="mono" style={{ fontSize: "var(--fs-12)" }}>
                    long long s = (long long)a[L] + a[R];
                  </p>
                  <h3>{t("Remember", "Yaad rakho", "याद रखें")}</h3>
                  <p>{t("Read the constraints before choosing types.", "Type chunne se pehle constraints padho.", "पहले शर्तें पढ़ें।")}</p>
                </>
              )}
            </div>
            <div className="row between" style={{ padding: "10px 16px", borderTop: "1px solid var(--line)" }}>
              <div className="row" style={{ gap: 4 }}>
                <span className="tag">two-pointers</span>
                <span className="tag">mistakes</span>
                <span className="faint" style={{ fontSize: "var(--fs-11)", marginLeft: 8 }}>
                  {t("Words", "Shabd", "शब्द")}: 62
                </span>
              </div>
              <button type="button" className="btn secondary sm" onClick={() => {
                setWriting(true);
                window.setTimeout(() => setWriting(false), 1600);
              }}>
                <Sparkles size={13} /> {t("Draft from my submissions", "Mere submissions se draft", "मेरे जमा से मसौदा")}
              </button>
            </div>
            <Diya size={54} mood={writing ? "think" : "happy"} className="note-diya bob" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- sahayak page ---------------- */

export function SahayakPageBody() {
  const t = useT();
  return (
    <div className="page">
      <div className="sahayak-page panel">
        <aside className="sp-history">
          <button type="button" className="btn primary sm" style={{ width: "100%" }}>
            <Plus size={14} /> {t("New chat", "Nayi chat", "नई बातचीत")}
          </button>
          <span className="eyebrow">{t("Today", "Aaj", "आज")}</span>
          {[
            [t("Why my pair sum fails", "Pair sum kyun fail", "जोड़ी योग क्यों फेल"), true],
            [t("Round robin vs FCFS", "Round robin vs FCFS", "राउंड रॉबिन"), false],
          ].map(([n, on]) => (
            <button key={n as string} type="button" className={`sp-item ${on ? "on" : ""}`}>
              <MessageSquare size={14} /> {n}
            </button>
          ))}
          <span className="eyebrow">{t("This week", "Is hafte", "इस हफ़्ते")}</span>
          {[t("Resume bullet for my project", "Project ka resume bullet", "बायोडाटा"), t("Successive % shortcut", "Successive % shortcut", "प्रतिशत शॉर्टकट"), t("Explain BFS like a queue at a bus stop", "BFS ko bus stop ki line se samjhao", "BFS समझाएँ")].map((n) => (
            <button key={n} type="button" className="sp-item">
              <History size={14} /> {n}
            </button>
          ))}
          <div className="divider" />
          <span className="faint" style={{ fontSize: "var(--fs-11)" }}>
            {t("Chats are kept 90 days. You can delete any of them.", "Chats 90 din rehti hain. Koi bhi delete kar sakte ho.", "90 दिन रखी जाती हैं।")}
          </span>
        </aside>
        <div className="sp-chat">
          <SahayakChat />
        </div>
      </div>
    </div>
  );
}

/* ---------------- community ---------------- */

export function CommunityBody() {
  const t = useT();
  return (
    <div className="page stagger">
      <PageHead
        title={t("Community", "Community", "समुदाय")}
        sub={t("Ask, answer and study together. Spoilers stay blurred until you choose to see them.", "Poochho, jawab do, saath padho. Spoiler tab tak dhundle jab tak aap na kholo.", "पूछें, जवाब दें, साथ पढ़ें।")}
        actions={
          <button type="button" className="btn primary">
            <Plus size={15} /> {t("Ask a question", "Sawaal poochho", "सवाल पूछें")}
          </button>
        }
      />
      <div className="comm-layout">
        <div className="stack">
          <div className="row wrap" style={{ gap: 8 }}>
            <label className="input" style={{ flex: "1 1 220px", maxWidth: 340 }}>
              <Search size={15} />
              <input id="comm-q" placeholder={t("Search discussions", "Charcha dhoondho", "चर्चा खोजें")} />
            </label>
            {[t("Newest", "Naya", "नया"), t("Unanswered", "Bina jawab", "बिना जवाब"), t("My college", "Mera college", "मेरा कॉलेज"), "DSA", t("Placements", "Placements", "प्लेसमेंट")].map((c, i) => (
              <button key={c} type="button" className={`chip ${i === 0 ? "on" : ""}`}>
                {c}
              </button>
            ))}
          </div>
          <div className="panel list">
            {[
              [true, "Why does two pointers need a sorted array?", "DSA · Pair with target sum", 12, 31, true, "Riya K"],
              [false, "Sitara Infotech aptitude: how many questions in each section this year?", "Placements", 6, 18, true, "Kabir R"],
              [false, "Round robin quantum: how do I pick it in an interview?", "Core CS · OS", 2, 7, false, "Meera"],
              [false, "Hindi me DP samjhane wala koi lesson hai?", "DSA · DP", 4, 12, true, "Ankit"],
            ].map(([pin, q, tag, a, v, ans, who]) => (
              <Link key={q as string} to="community" className="list-row thread">
                <div className="vote">
                  <ThumbsUp size={14} />
                  <b className="num">{v}</b>
                </div>
                <span className="t">
                  {pin ? <Pin size={12} style={{ color: "var(--plus)", marginRight: 6 }} /> : null}
                  {q}
                  <small>
                    {tag} · {who}
                  </small>
                </span>
                {ans ? (
                  <span className="tag ok">
                    <CircleCheck size={12} /> {t("Answered", "Jawab mila", "जवाब मिला")}
                  </span>
                ) : (
                  <span className="tag warn">{t("Needs an answer", "Jawab chahiye", "जवाब चाहिए")}</span>
                )}
                <span className="faint num" style={{ fontSize: "var(--fs-12)", display: "flex", gap: 4, alignItems: "center" }}>
                  <MessageSquare size={13} /> {a}
                </span>
              </Link>
            ))}
          </div>
        </div>
        <aside className="stack">
          <div className="panel pad stack">
            <b style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Users size={15} /> {t("Your study cohort", "Aapka study cohort", "आपका अध्ययन समूह")}
            </b>
            <span className="muted" style={{ fontSize: "var(--fs-13)" }}>
              {t("8 students from your college, same plan. Goal this week: finish sprint 3.", "Aapke college ke 8 students, wahi plan. Is hafte ka goal: sprint 3.", "8 छात्र, वही योजना।")}
            </span>
            {[
              ["Aarav (you)", 58],
              ["Riya", 71],
              ["Kabir", 40],
              ["Meera", 66],
            ].map(([n, v]) => (
              <div key={n as string} className="weak-row" style={{ gridTemplateColumns: "90px minmax(0,1fr) 36px" }}>
                <span>{n}</span>
                <Bar value={v as number} thin />
                <span>{v}%</span>
              </div>
            ))}
            <span className="faint" style={{ fontSize: "var(--fs-11)" }}>
              {t("Only members who agreed share their progress.", "Sirf jinhone haan kaha, unki progress dikhti hai.", "केवल सहमति वाले सदस्य।")}
            </span>
          </div>
          <div className="panel pad stack">
            <b style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Flag size={15} /> {t("House rules", "Niyam", "नियम")}
            </b>
            <span className="muted" style={{ fontSize: "var(--fs-12)" }}>
              {t("Be kind. No full solutions to live contest problems. Answers in any language are welcome.", "Achha bolo. Live contest ke poore hal nahi. Kisi bhi bhasha me jawab chalega.", "विनम्र रहें।")}
            </span>
          </div>
        </aside>
      </div>
      <SampleNote />
    </div>
  );
}

/* ---------------- plus ---------------- */

export function PlusBody() {
  const t = useT();
  const [period, setPeriod] = useState<"month" | "year">("year");
  const free = [
    t("Daily plan and all lessons", "Roz ka plan aur saare lessons", "योजना और सभी पाठ"),
    t("The DSA sheet, SQL and aptitude practice", "DSA sheet, SQL, aptitude practice", "शीट और अभ्यास"),
    t("Problem of the day and weekly contests", "POTD aur weekly contests", "आज का प्रश्न, प्रतियोगिता"),
    t("Smallest failing test on every wrong answer", "Har galat jawab par sabse chhota test", "सबसे छोटा गलत टेस्ट"),
    t("20 Sahayak messages a day", "Roz 20 Sahayak message", "रोज़ 20 संदेश"),
  ];
  const plus = [
    t("200 Sahayak messages a day", "Roz 200 Sahayak message", "रोज़ 200 संदेश"),
    t("Company sets with sources", "Source ke saath company sets", "कंपनी सेट"),
    t("AI mock interviews with feedback", "AI mock interview aur feedback", "एआई मॉक इंटरव्यू"),
    t("All Pramaan tests", "Saare Pramaan tests", "सभी प्रमाण"),
    t("Resume rewrite help", "Resume sudhaar", "बायोडाटा सुधार"),
  ];
  return (
    <div className="page stagger">
      <PageHead
        title="Plus"
        sub={t("Free is enough to learn everything. Plus is for the last stretch before interviews.", "Free me sab seekh sakte ho. Plus interview se pehle ke aakhri hisse ke liye.", "मुफ़्त में सब सीख सकते हैं।")}
        actions={
          <Seg
            label="Billing"
            value={period}
            onChange={setPeriod}
            options={[
              { value: "month", label: t("Monthly", "Mahina", "मासिक") },
              { value: "year", label: t("Yearly", "Saal", "वार्षिक") },
            ]}
          />
        }
      />
      <div className="price-grid">
        <section className="panel pad-lg stack price">
          <b style={{ fontSize: "var(--fs-18)" }}>Free</b>
          <div className="price-num num">₹0</div>
          <span className="muted" style={{ fontSize: "var(--fs-13)" }}>
            {t("Forever. No card.", "Hamesha. Card nahi.", "हमेशा। कार्ड नहीं।")}
          </span>
          <div className="stack sm">
            {free.map((x) => (
              <span key={x} className="row" style={{ gap: 8, fontSize: "var(--fs-13)" }}>
                <Check size={14} style={{ color: "var(--ok)" }} /> {x}
              </span>
            ))}
          </div>
          <button type="button" className="btn secondary" disabled>
            {t("Your current plan", "Abhi ka plan", "वर्तमान योजना")}
          </button>
        </section>
        <section className="panel pad-lg stack price plus-glow">
          <div className="row between">
            <b style={{ fontSize: "var(--fs-18)", display: "flex", gap: 8, alignItems: "center" }}>
              <Crown size={18} style={{ color: "var(--plus)" }} /> Plus
            </b>
            {period === "year" && <span className="tag plus">{t("2 months free", "2 mahine free", "2 महीने मुफ़्त")}</span>}
          </div>
          <div className="price-num num">
            ₹[{period === "year" ? t("yearly price", "saal ka daam", "वार्षिक") : t("monthly price", "mahine ka daam", "मासिक")}]
          </div>
          <span className="muted" style={{ fontSize: "var(--fs-13)" }}>
            {t("Price to be set by the owner. UPI, cards and EMI.", "Daam owner tay karenge. UPI, card, EMI.", "दाम मालिक तय करेंगे।")}
          </span>
          <div className="stack sm">
            <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
              {t("Everything in Free, and:", "Free ka sab, aur:", "मुफ़्त का सब, और:")}
            </span>
            {plus.map((x) => (
              <span key={x} className="row" style={{ gap: 8, fontSize: "var(--fs-13)" }}>
                <Check size={14} style={{ color: "var(--plus)" }} /> {x}
              </span>
            ))}
          </div>
          <button type="button" className="btn plus lg">
            {t("Get Plus", "Plus lo", "प्लस लें")}
          </button>
          <span className="faint" style={{ fontSize: "var(--fs-11)" }}>
            {t("Cancel in two taps from Settings. Refund within 7 days, no questions.", "Settings se do tap me cancel. 7 din me refund, koi sawaal nahi.", "7 दिन में धनवापसी।")}
          </span>
        </section>
      </div>
      <section className="panel pad-lg stack">
        <b>{t("Scholarships", "Scholarship", "छात्रवृत्ति")}</b>
        <span className="muted" style={{ fontSize: "var(--fs-13)" }}>
          {t("If the price is a problem, apply with your college ID. We approve within 3 days.", "Daam mushkil ho to college ID se apply karo. 3 din me manzoori.", "कॉलेज आईडी से आवेदन करें।")}
        </span>
        <button type="button" className="btn secondary sm" style={{ alignSelf: "flex-start" }}>
          {t("Apply for a scholarship", "Scholarship ke liye apply", "छात्रवृत्ति के लिए आवेदन")}
        </button>
      </section>
    </div>
  );
}

/* ---------------- settings ---------------- */

export function SettingsBody() {
  const t = useT();
  const { theme, setTheme } = useTheme();
  const { lang, setLang } = useLang();
  const [n, setN] = useState({ wa: true, email: true, push: false, quiet: true, contest: true, revision: true });
  const [sec, setSec] = useState("general");
  const secs: [string, typeof Bell, string][] = [
    ["general", Palette, t("Look and language", "Look aur bhasha", "रूप और भाषा")],
    ["notify", Bell, t("Notifications", "Notifications", "सूचनाएँ")],
    ["privacy", ShieldCheck, t("Privacy", "Privacy", "निजता")],
    ["billing", CreditCard, t("Plan and billing", "Plan aur billing", "योजना और भुगतान")],
    ["data", Trash2, t("Your data", "Aapka data", "आपका डेटा")],
  ];
  return (
    <div className="page">
      <PageHead title={t("Settings", "Settings", "सेटिंग्स")} />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings">
          {secs.map(([id, I, l]) => (
            <button key={id} type="button" className={`side-link ${sec === id ? "on" : ""}`} aria-current={sec === id ? "page" : undefined} onClick={() => setSec(id)}>
              <I size={16} /> {l}
            </button>
          ))}
        </nav>
        <div className="stack lg">
          <section className="panel">
            <div className="panel-head">
              <h2>
                <Palette size={15} /> {t("Look and language", "Look aur bhasha", "रूप और भाषा")}
              </h2>
            </div>
            <div className="set-row">
              <div>
                <b>{t("Theme", "Theme", "थीम")}</b>
                <span>{t("Dark is easier on the eyes at night.", "Raat me dark aankhon ke liye aasaan.", "रात में डार्क आसान।")}</span>
              </div>
              <Seg
                label="Theme"
                value={theme}
                onChange={setTheme}
                options={[
                  { value: "dark", label: <><Moon size={12} /> Dark</> },
                  { value: "light", label: "Light" },
                ]}
              />
            </div>
            <div className="set-row">
              <div>
                <b>{t("Language", "Bhasha", "भाषा")}</b>
                <span>{t("For menus, lessons and Sahayak. Code stays in English.", "Menu, lessons aur Sahayak ke liye. Code English me.", "मेनू, पाठ और सहायक के लिए।")}</span>
              </div>
              <Seg
                label="Language"
                value={lang}
                onChange={setLang}
                options={[
                  { value: "en", label: "English" },
                  { value: "hg", label: "Hinglish" },
                  { value: "hi", label: "हिंदी" },
                ]}
              />
            </div>
            <div className="set-row">
              <div>
                <b>{t("Data saver", "Data saver", "डेटा बचत")}</b>
                <span>{t("No videos or large images until you tap them.", "Video aur badi images tap karne par hi.", "वीडियो टैप करने पर।")}</span>
              </div>
              <Toggle on={false} onChange={() => {}} label="Data saver" />
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>
                <Bell size={15} /> {t("Notifications", "Notifications", "सूचनाएँ")}
              </h2>
            </div>
            {(
              [
                ["wa", "WhatsApp", t("Daily plan at 7 PM, contest reminders", "Roz 7 PM plan, contest reminder", "रोज़ 7 बजे योजना")],
                ["email", "Email", t("Weekly summary on Sunday", "Ravivaar ko weekly summary", "साप्ताहिक सारांश")],
                ["push", t("Phone notifications", "Phone notifications", "फ़ोन सूचनाएँ"), t("Revision due, streak at risk", "Revision baaki, streak khatre me", "दोहराई बाकी")],
                ["quiet", t("Quiet hours", "Shaant samay", "शांत समय"), t("Nothing between 10 PM and 7 AM", "Raat 10 se subah 7 tak kuch nahi", "रात 10 से सुबह 7")],
              ] as [keyof typeof n, string, string][]
            ).map(([k, l, d]) => (
              <div key={k} className="set-row">
                <div>
                  <b>{l}</b>
                  <span>{d}</span>
                </div>
                <Toggle on={n[k]} onChange={(v) => setN((s) => ({ ...s, [k]: v }))} label={l} />
              </div>
            ))}
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>
                <ShieldCheck size={15} /> {t("Privacy", "Privacy", "निजता")}
              </h2>
            </div>
            <div className="set-row">
              <div>
                <b>{t("Profile visible to", "Profile kise dikhe", "प्रोफ़ाइल किसे दिखे")}</b>
                <span>{t("Recruiters only see it after you apply.", "Recruiter apply ke baad hi dekhte hain.", "आवेदन के बाद ही।")}</span>
              </div>
              <Link to="profile" className="btn secondary sm">
                {t("Recruiters", "Recruiters", "भर्तीकर्ता")}
              </Link>
            </div>
            <div className="set-row">
              <div>
                <b>{t("Show me on leaderboards", "Leaderboard par dikhao", "लीडरबोर्ड पर")}</b>
                <span>{t("Off shows you as 'A learner from Indore'.", "Band par 'Indore ka ek learner'.", "बंद पर नाम नहीं।")}</span>
              </div>
              <Toggle on={true} onChange={() => {}} label="Leaderboards" />
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>
                <Trash2 size={15} /> {t("Your data", "Aapka data", "आपका डेटा")}
              </h2>
            </div>
            <div className="set-row">
              <div>
                <b>{t("Download everything", "Sab download karo", "सब डाउनलोड करें")}</b>
                <span>{t("Code, notes, chats and results as a zip, by email.", "Code, notes, chats, results zip me, email par.", "ज़िप ईमेल पर।")}</span>
              </div>
              <button type="button" className="btn secondary sm">
                {t("Request", "Maango", "माँगें")}
              </button>
            </div>
            <div className="set-row">
              <div>
                <b style={{ color: "var(--bad)" }}>{t("Delete account", "Account delete", "खाता हटाएँ")}</b>
                <span>{t("Removed within 30 days. Certificates stay verifiable unless you ask.", "30 din me hatega. Certificate verify hote rahenge jab tak aap na kaho.", "30 दिनों में हटेगा।")}</span>
              </div>
              <button type="button" className="btn danger sm">
                {t("Delete", "Delete", "हटाएँ")}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
