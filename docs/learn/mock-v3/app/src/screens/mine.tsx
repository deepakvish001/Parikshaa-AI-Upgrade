import { useState } from "react";
import {
  Plus,
  Lock,
  Globe,
  Share2,
  Bookmark,
  Search,
  Sparkles,
  Tag,
  Link2,
  MessageSquare,
  CircleCheck,
  EyeOff,
  Users,
  Check,
  Crown,
  ShieldCheck,
  Bell,
  Palette,
  User,
  Download,
  Trash2,
  Smartphone,
  Laptop,
  KeyRound,
  CreditCard,
  CalendarClock,
  Languages,
  Info,
  ArrowUp,
  Flame,
} from "lucide-react";
import { Link, useT, useToast, useTheme, useLang } from "../lib/core";
import { Badge, Level, Card, PageHead, Tabs, Seg, Toggle, Modal, Meter, Avatar, Hl } from "../ui/kit";
import { SahayakPanel } from "../ui/sahayak";

/* ---------------- lists ---------------- */

export function ListsBody() {
  const t = useT();
  const toast = useToast();
  const [sel, setSel] = useState(0);
  const [make, setMake] = useState(false);
  const lists = [
    { n: "Before Nimbu Labs OA", c: 18, d: 7, pub: false, tone: "pen" },
    { n: "DP I keep getting wrong", c: 12, d: 3, pub: false, tone: "red" },
    { n: "Graphs, my favourites", c: 9, d: 9, pub: true, tone: "tick" },
    { n: "Sunday revision", c: 25, d: 14, pub: false, tone: "coin" },
  ];
  return (
    <div className="col g20">
      <PageHead
        eyebrow={t("My lists", "Meri lists", "मेरी सूचियाँ")}
        title={t("Your own sheets.", "Aapki apni sheets.", "आपकी अपनी शीट।")}
        actions={
          <button className="btn pri" onClick={() => setMake(true)}>
            <Plus />
            {t("New list", "Nayi list", "नई सूची")}
          </button>
        }
      />
      <div className="lists-grid">
        {lists.map((l, i) => (
          <button key={l.n} className={`list-card ${sel === i ? "on" : ""}`} onClick={() => setSel(i)}>
            <span className={`lc-tab ${l.tone}`} />
            <b className="h3">{l.n}</b>
            <span className="tiny faint row g6">
              {l.pub ? <Globe style={{ width: 12, height: 12 }} /> : <Lock style={{ width: 12, height: 12 }} />}
              {l.pub ? t("Public", "Public", "सार्वजनिक") : t("Private", "Private", "निजी")} · {l.c} {t("problems", "problems", "प्रश्न")}
            </span>
            <div className="row g8">
              <div className="grow">
                <Meter v={(l.d / l.c) * 100} tone={l.tone} size="thin" />
              </div>
              <span className="tiny num faint">
                {l.d}/{l.c}
              </span>
            </div>
          </button>
        ))}
      </div>
      <Card
        title={lists[sel].n}
        icon={<Bookmark className="ic" />}
        actions={
          <button className="btn sm" onClick={() => toast(t("Share link copied", "Share link copy hua", "लिंक कॉपी"))}>
            <Share2 />
            {t("Share", "Share", "साझा")}
          </button>
        }
        pad={false}
      >
        <div className="tbl-wrap">
          <table className="tbl">
            <tbody>
              {[
                ["Pair with target sum", 2, "Overflow!", false],
                ["Rotting oranges", 3, "Multi-source BFS", true],
                ["Longest increasing subsequence", 4, "Do the n log n one", false],
                ["Top view of a binary tree", 3, "", true],
              ].map(([n, l, note, d]) => (
                <tr key={n as string}>
                  <td style={{ width: 36 }}>{d ? <CircleCheck style={{ width: 18, height: 18, color: "var(--tick)" }} /> : <span className="check" />}</td>
                  <td>
                    <Link to="problem" className="p-link">
                      {n as string}
                    </Link>
                  </td>
                  <td>
                    <Level n={l as 3} short />
                  </td>
                  <td className="hand t-red" style={{ fontSize: 15 }}>
                    {note as string}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal
        open={make}
        onClose={() => setMake(false)}
        title={t("New list", "Nayi list", "नई सूची")}
        footer={
          <>
            <button className="btn ghost" onClick={() => setMake(false)}>
              {t("Cancel", "Raho", "रद्द")}
            </button>
            <button
              className="btn pri"
              onClick={() => {
                setMake(false);
                toast(t("List created", "List bani", "सूची बनी"));
              }}
            >
              {t("Create", "Banao", "बनाएँ")}
            </button>
          </>
        }
      >
        <div className="col g12">
          <div className="field">
            <label>{t("Name", "Naam", "नाम")}</label>
            <input className="input" defaultValue="Patang Tech round 1" />
          </div>
          <div className="row between">
            <span className="small">{t("Public (anyone with the link)", "Public (link wala koi bhi)", "सार्वजनिक")}</span>
            <Toggle on={false} onChange={() => {}} label="Public" />
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------- notes ---------------- */

export function NotesBody() {
  const t = useT();
  const [sel, setSel] = useState(0);
  const notes = [
    ["Overflow checklist", "Two pointers · 2 days ago", true],
    ["Monotonic stack pattern", "Stack · 5 days ago", false],
    ["Deadlock: 4 conditions", "OS · 1 week ago", false],
    ["SQL: LIMIT is not per group", "SQL · 1 week ago", true],
  ];
  return (
    <div className="notes">
      <aside className="notes-list">
        <div className="row g8">
          <div className="input-ic grow">
            <Search />
            <input className="input sm" placeholder={t("Search notes", "Notes khojo", "नोट्स खोजें")} />
          </div>
          <button className="icon-btn" aria-label="New note">
            <Plus />
          </button>
        </div>
        <div className="ai-suggest">
          <Sparkles />
          <div className="grow">
            <b className="small">{t("2 notes Sahayak can draft", "Sahayak 2 notes bana sakta hai", "2 नोट्स")}</b>
            <span className="tiny faint" style={{ display: "block" }}>
              {t("From this week's wrong answers", "Is hafte ke galat jawabon se", "इस सप्ताह की गलतियों से")}
            </span>
          </div>
        </div>
        {notes.map(([n, m, ai], i) => (
          <button key={n as string} className={`note-item ${sel === i ? "on" : ""}`} onClick={() => setSel(i)}>
            <b className="small">{n as string}</b>
            <span className="tiny faint row g6">
              {m as string}
              {ai && <Badge tone="ai" sq>AI</Badge>}
            </span>
          </button>
        ))}
      </aside>
      <article className="note-paper margin-page paper-ruled">
        <div className="row between">
          <span className="tiny faint row g6">
            <Tag style={{ width: 13, height: 13 }} />
            Two pointers · Overflow
          </span>
          <Badge tone="ai" sq>
            {t("Drafted by Sahayak, edited by you", "Sahayak ne likha, aapne badla", "सहायक ने लिखा")}
          </Badge>
        </div>
        <h1 className="display" style={{ fontSize: 40 }}>
          {notes[sel][0] as string}
        </h1>
        <ol className="note-body">
          <li>{t("What's the biggest value? max(a) × count, or max(a) + max(a).", "Sabse badi value? max(a) × count, ya max(a) + max(a).", "सबसे बड़ा मान?")}</li>
          <li>
            {t("If it's above 2 × 10⁹, use ", "2 × 10⁹ se upar ho to ", "2 × 10⁹ से ऊपर हो तो ")}
            <code className="inl">long long</code>.
          </li>
          <li>
            <Hl long>{t("Cast before adding, not after: (long long)a + b.", "Jodne se pehle cast karo: (long long)a + b.", "जोड़ने से पहले cast करें।")}</Hl>
          </li>
          <li>{t("Test with 2³⁰ + 2³⁰ before submitting.", "Submit se pehle 2³⁰ + 2³⁰ se test karo.", "2³⁰ + 2³⁰ से जाँचें।")}</li>
        </ol>
        <div className="note-links">
          <span className="eyebrow">{t("Linked", "Jude hue", "जुड़े")}</span>
          <Link to="problem" className="chip">
            <Link2 />
            Pair with target sum
          </Link>
          <Link to="editorial" className="chip">
            <Link2 />
            {t("Editorial", "Editorial", "हल")}
          </Link>
          <Link to="revision" className="chip">
            <Link2 />
            {t("Revision card", "Revision card", "दोहराई कार्ड")}
          </Link>
        </div>
      </article>
    </div>
  );
}

/* ---------------- sahayak page ---------------- */

export function SahayakPageBody() {
  const t = useT();
  return (
    <div className="sp">
      <aside className="sp-hist">
        <button className="btn pri block">
          <Plus />
          {t("New chat", "Nayi chat", "नई चैट")}
        </button>
        <span className="eyebrow mt8">{t("Today", "Aaj", "आज")}</span>
        {[
          ["Why does my code fail test 23?", "Problem · Pair with target sum", true],
          ["Explain deadlock with a story", "Lesson · Deadlocks", false],
        ].map(([q, c, on]) => (
          <button key={q as string} className={`note-item ${on ? "on" : ""}`}>
            <b className="small ellipsis" style={{ display: "block" }}>
              {q as string}
            </b>
            <span className="tiny faint">{c as string}</span>
          </button>
        ))}
        <span className="eyebrow mt8">{t("This week", "Is hafte", "इस सप्ताह")}</span>
        {["Review my settle() function", "Make me a 3-day DP plan", "Mock HR: tell me about yourself"].map((q) => (
          <button key={q} className="note-item">
            <b className="small ellipsis" style={{ display: "block" }}>
              {q}
            </b>
          </button>
        ))}
      </aside>
      <div className="sp-chat">
        <SahayakPanel full context="problem" />
      </div>
      <aside className="sp-side">
        <Card title={t("What Sahayak can see", "Sahayak kya dekh sakta hai", "सहायक क्या देख सकता है")} icon={<Info className="ic" />}>
          <ul className="sees small">
            {[
              t("Your plan and today's tasks", "Aapka plan aur aaj ke kaam", "आपकी योजना"),
              t("Code and verdict of the problem you're on", "Jis problem par ho uska code aur verdict", "वर्तमान कोड"),
              t("Your weak topics", "Aapke kamzor topics", "कमज़ोर विषय"),
            ].map((x) => (
              <li key={x}>
                <Check />
                {x}
              </li>
            ))}
          </ul>
          <p className="tiny faint mt8">{t("Chats are private. Staff can read one only if it is reported, with a written reason, and that is logged.", "Chats private hain. Staff tabhi padh sakta hai jab report ho, likhit wajah ke saath, aur log hota hai.", "चैट निजी हैं।")}</p>
        </Card>
        <Card title={t("Today", "Aaj", "आज")} icon={<Flame className="ic" />}>
          <div className="row between small">
            <span className="muted">{t("Messages", "Messages", "संदेश")}</span>
            <b className="num">38 / 200</b>
          </div>
          <Meter v={19} tone="ai" />
          <p className="tiny faint mt8">{t("Free plan: 20 a day. Plus: 200 a day, fair use.", "Free: roz 20. Plus: roz 200, fair use.", "फ़्री: 20, प्लस: 200")}</p>
        </Card>
      </aside>
    </div>
  );
}

/* ---------------- community ---------------- */

export function CommunityBody() {
  const t = useT();
  const [tab, setTab] = useState("disc");
  const posts = [
    { a: "Ishita Rao", t: "Is it okay to use long long everywhere in C++?", tags: ["C++", "Overflow"], votes: 34, ans: 12, solved: true, spoiler: false, b: ["Short answer: not everywhere. Use it where values can cross 2 × 10⁹; it costs memory in big arrays.", "Chhota jawab: har jagah nahi. Jahan value 2 × 10⁹ ke paar jaa sake wahan; bade arrays me memory lagti hai.", "हर जगह नहीं।"] },
    { a: "Kabir Shah", t: "Weekly Round 12, problem C: my greedy idea", tags: ["Contest", "Greedy"], votes: 21, ans: 8, solved: false, spoiler: true, b: ["", "", ""] },
    { a: "Zoya Khan", t: "How I revised OS in 5 days before Tech 2", tags: ["OS", "Interview"], votes: 57, ans: 19, solved: false, spoiler: false, b: ["Day 1 processes, day 2 sync and deadlocks, day 3 scheduling numericals, day 4 memory, day 5 two mock vivas with a friend.", "Din 1 processes, din 2 sync aur deadlocks, din 3 scheduling numericals, din 4 memory, din 5 dost ke saath do mock viva.", "पाँच दिन की योजना।"] },
  ];
  return (
    <div className="col g20">
      <PageHead
        eyebrow={t("Community", "Community", "समुदाय")}
        title={t("Ask, answer, study together.", "Poochho, batao, saath padho.", "पूछो, बताओ, साथ पढ़ो।")}
        actions={
          <button className="btn pri">
            <Plus />
            {t("Ask a question", "Sawaal poochho", "सवाल पूछें")}
          </button>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "disc", label: t("Discussions", "Charcha", "चर्चा") },
          { id: "groups", label: t("Study groups", "Study groups", "अध्ययन समूह"), count: 3 },
        ]}
      />
      {tab === "disc" ? (
        <div className="community">
          <div className="col g10">
            {posts.map((p) => (
              <article key={p.t} className="card post">
                <div className="votes">
                  <button className="icon-btn sm" aria-label="Upvote">
                    <ArrowUp />
                  </button>
                  <b className="num small">{p.votes}</b>
                </div>
                <div className="grow col g8" style={{ minWidth: 0 }}>
                  <div className="row g8 tiny faint">
                    <Avatar name={p.a} size={20} />
                    {p.a} · {t("2 h ago", "2 ghante pehle", "2 घंटे पहले")}
                    {p.solved && (
                      <Badge tone="tick" icon={<CircleCheck />}>
                        {t("Answered", "Jawab mila", "उत्तरित")}
                      </Badge>
                    )}
                  </div>
                  <b className="h3">{p.t}</b>
                  {p.spoiler ? (
                    <div className="spoiler">
                      <EyeOff />
                      <span className="small">{t("Contains a solution. Tap to show.", "Isme hal hai. Dekhne ke liye tap.", "हल है। दिखाने के लिए टैप।")}</span>
                    </div>
                  ) : (
                    <p className="small muted">{t(p.b[0], p.b[1], p.b[2])}</p>
                  )}
                  <div className="row g6">
                    {p.tags.map((x) => (
                      <span key={x} className="stack-chip">
                        {x}
                      </span>
                    ))}
                    <span className="grow" />
                    <span className="tiny faint row g4">
                      <MessageSquare style={{ width: 13, height: 13 }} />
                      {p.ans}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <aside className="col g12">
            <Card title={t("House rules", "Niyam", "नियम")} icon={<ShieldCheck className="ic" />}>
              <ul className="rules small muted">
                <li>{t("Hide full solutions behind a spoiler", "Poora hal spoiler me", "हल स्पॉइलर में")}</li>
                <li>{t("No contest discussion while it's live", "Live contest ki charcha nahi", "लाइव प्रतियोगिता पर चर्चा नहीं")}</li>
                <li>{t("Be kind; report, don't argue", "Achhe raho; report karo", "दयालु रहें")}</li>
              </ul>
            </Card>
          </aside>
        </div>
      ) : (
        <div className="grid c3">
          {[
            ["Product SDE · Dec batch", 38, "Daily 9 pm call · 2 problems"],
            ["Aptitude sprint (service)", 64, "Mock every Sunday"],
            ["Our college · CSE 2027", 112, "Campus cohort"],
          ].map(([n, m, d]) => (
            <section key={n as string} className="card pad col g10">
              <span className="avatars">
                {["A S", "I R", "K S", "Z K"].map((x) => (
                  <Avatar key={x} name={x} size={28} />
                ))}
              </span>
              <b className="h3">{n as string}</b>
              <span className="tiny faint row g6">
                <Users style={{ width: 13, height: 13 }} />
                {m as number} {t("members", "members", "सदस्य")} · {d as string}
              </span>
              <button className="btn sm">{t("Join", "Join", "जुड़ें")}</button>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- plus ---------------- */

export function PlusBody() {
  const t = useT();
  const [pay, setPay] = useState(false);
  const rows = [
    [t("Daily plan, judge, sheet, editorials", "Daily plan, judge, sheet, editorials", "योजना, जज, शीट"), true, true],
    [t("Sahayak messages a day", "Sahayak messages roz", "सहायक संदेश/दिन"), "20", "200"],
    [t("Sahayak Build mode (code diffs)", "Sahayak Banao mode", "बनाओ मोड"), false, true],
    [t("Aptitude and company-pattern mocks", "Aptitude aur company-pattern mocks", "मॉक"), "2 / month", t("Unlimited", "Unlimited", "असीमित")],
    [t("Guided projects with human review", "Insaan ke review wale projects", "मानव समीक्षा"), false, true],
    [t("Pramaan tests", "Pramaan tests", "प्रमाण टेस्ट"), t("Pay per test", "Har test ka bhugtaan", "प्रति टेस्ट"), t("1 a month included", "Mahine me 1 shaamil", "महीने में 1")],
    [t("Custom roadmaps", "Custom roadmaps", "कस्टम रोडमैप"), "3", "100"],
  ];
  return (
    <div className="col g20">
      <section className="plus-hero">
        <div className="col g10" style={{ minWidth: 0 }}>
          <span className="eyebrow row g6">
            <Crown style={{ width: 14, height: 14, color: "var(--coin)" }} />
            Plus
          </span>
          <h1 className="display" style={{ fontSize: 54, lineHeight: 1 }}>
            {t("More help, when the exam is close.", "Exam paas ho to zyada madad.", "परीक्षा पास हो तो ज़्यादा मदद।")}
          </h1>
          <p className="muted">{t("Everything that teaches stays free. Plus adds the expensive parts: more AI, unlimited mocks, human review.", "Jo sikhata hai wo free rehta hai. Plus mehenge hisse jodta hai: zyada AI, unlimited mocks, insaan ka review.", "सिखाने वाला सब फ़्री रहता है।")}</p>
        </div>
        <div className="plus-price">
          <span className="tiny faint">{t("Yearly", "Saalana", "वार्षिक")}</span>
          <b className="display">₹[yearly price]</b>
          <span className="tiny faint">{t("Price set by Parikshaa · placeholder", "Daam Parikshaa tay karega · placeholder", "क़ीमत तय होनी है")}</span>
          <button className="btn pri lg block" onClick={() => setPay(true)}>
            <Crown />
            {t("Get Plus", "Plus lo", "प्लस लें")}
          </button>
          <span className="tiny faint">{t("Cancel any time · GST invoice", "Kabhi bhi cancel · GST invoice", "कभी भी रद्द")}</span>
        </div>
      </section>
      <Card pad={false}>
        <div className="tbl-wrap">
          <table className="tbl plus-tbl">
            <thead>
              <tr>
                <th></th>
                <th className="r">Free</th>
                <th className="r">Plus</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([f, a, b]) => (
                <tr key={f as string}>
                  <td>{f as string}</td>
                  {[a, b].map((v, i) => (
                    <td key={i} className="r">
                      {v === true ? <Check style={{ width: 17, height: 17, color: "var(--tick)" }} /> : v === false ? <span className="faint">—</span> : <b className="small">{v as string}</b>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="banner">
        <Users />
        <span className="small grow">{t("Is your college on a campus licence? Then you already have Plus: sign in with your college.", "College campus licence par hai? To aapke paas Plus hai: college se sign in karo.", "कैंपस लाइसेंस? तो प्लस है।")}</span>
      </div>
      <Modal
        open={pay}
        onClose={() => setPay(false)}
        title={t("Get Plus", "Plus lo", "प्लस लें")}
        sub={t("Payment by Razorpay. We never see your card or UPI PIN.", "Bhugtaan Razorpay se. Card ya UPI PIN hum nahi dekhte.", "Razorpay से भुगतान।")}
        footer={
          <>
            <button className="btn ghost" onClick={() => setPay(false)}>
              {t("Not now", "Abhi nahi", "अभी नहीं")}
            </button>
            <button className="btn pri" onClick={() => setPay(false)}>
              {t("Pay ₹[yearly price]", "₹[yearly price] do", "भुगतान करें")}
            </button>
          </>
        }
      >
        <div className="col g12">
          <div className="field">
            <label>{t("Coupon", "Coupon", "कूपन")}</label>
            <div className="row g8">
              <input className="input" placeholder="CAMPUS2026" />
              <button className="btn">{t("Apply", "Lagao", "लागू")}</button>
            </div>
          </div>
          <div className="col g6">
            {[
              ["UPI", <Smartphone key="u" />],
              [t("Card", "Card", "कार्ड"), <CreditCard key="c" />],
            ].map(([n, ic], i) => (
              <button key={i} className="option" aria-pressed={i === 0}>
                <span className="opt-ic">{ic}</span>
                <span className="grow">{n as string}</span>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------- settings ---------------- */

export function SettingsBody() {
  const t = useT();
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const { lang, setLang } = useLang();
  const [sec, setSec] = useState("learn");
  const [n, setN] = useState({ email: true, wa: true, push: false, streak: true, contest: true });
  const [del, setDel] = useState(false);
  const nav = [
    ["account", t("Account", "Account", "खाता"), <User key="a" />],
    ["learn", t("Learning", "Padhai", "पढ़ाई"), <CalendarClock key="b" />],
    ["look", t("Language & look", "Bhasha aur look", "भाषा और रूप"), <Palette key="c" />],
    ["notify", t("Notifications", "Notifications", "सूचनाएँ"), <Bell key="d" />],
    ["privacy", t("Privacy & data", "Privacy aur data", "गोपनीयता"), <ShieldCheck key="e" />],
    ["security", t("Sign-in & devices", "Sign-in aur devices", "डिवाइस"), <KeyRound key="f" />],
    ["billing", t("Billing", "Billing", "बिलिंग"), <CreditCard key="g" />],
  ];
  return (
    <div className="col g20">
      <PageHead eyebrow={t("Settings", "Settings", "सेटिंग्स")} title={t("Make it yours.", "Apne hisaab se.", "अपने हिसाब से।")} />
      <div className="settings">
        <nav className="set-nav">
          {nav.map(([id, l, ic]) => (
            <button key={id as string} className={`set-item ${sec === id ? "on" : ""}`} onClick={() => setSec(id as string)}>
              {ic}
              {l as string}
            </button>
          ))}
        </nav>
        <div className="col g16">
          <section className="card">
            <div className="card-h">
              <span className="h3">{t("Learning", "Padhai", "पढ़ाई")}</span>
            </div>
            <div className="set-rows">
              <div className="set-row">
                <div>
                  <b className="small">{t("Goal", "Goal", "लक्ष्य")}</b>
                  <p className="tiny faint">{t("Changing it re-balances your plan.", "Badalne par plan khud adjust.", "योजना बदल जाएगी।")}</p>
                </div>
                <select className="select sm" style={{ width: 220 }} defaultValue="p">
                  <option value="p">Product company SDE</option>
                  <option value="s">Service companies</option>
                </select>
              </div>
              <div className="set-row">
                <div>
                  <b className="small">{t("Time on weekdays", "Weekday ka samay", "सप्ताह के दिन")}</b>
                  <p className="tiny faint">{t("End date moves with it.", "End date saath me khiskegi.", "तिथि खिसकेगी।")}</p>
                </div>
                <Seg value="2" onChange={() => {}} items={[{ id: "1", label: "1h" }, { id: "2", label: "2h" }, { id: "3", label: "3h" }, { id: "4", label: "4h+" }]} />
              </div>
              <div className="set-row">
                <div>
                  <b className="small">{t("Semester exams", "Semester exams", "सेमेस्टर परीक्षा")}</b>
                  <p className="tiny faint">{t("Plan goes lighter in these weeks.", "In hafton me plan halka.", "योजना हल्की।")}</p>
                </div>
                <button className="btn sm">3–15 Nov · {t("edit", "badlo", "बदलें")}</button>
              </div>
            </div>
          </section>
          <section className="card">
            <div className="card-h">
              <span className="h3">{t("Language & look", "Bhasha aur look", "भाषा और रूप")}</span>
            </div>
            <div className="set-rows">
              <div className="set-row">
                <div>
                  <b className="small row g6">
                    <Languages style={{ width: 15, height: 15 }} />
                    {t("Language", "Bhasha", "भाषा")}
                  </b>
                  <p className="tiny faint">{t("Code stays in English.", "Code English me hi.", "कोड अंग्रेज़ी में।")}</p>
                </div>
                <Seg value={lang} onChange={setLang} items={[{ id: "en", label: "English" }, { id: "hg", label: "Hinglish" }, { id: "hi", label: "हिंदी" }]} />
              </div>
              <div className="set-row">
                <div>
                  <b className="small">{t("Theme", "Theme", "थीम")}</b>
                  <p className="tiny faint">{t("Paper by day, blackboard by night.", "Din me kaagaz, raat me blackboard.", "दिन में काग़ज़, रात में ब्लैकबोर्ड।")}</p>
                </div>
                <Seg value={theme} onChange={setTheme} items={[{ id: "light", label: t("Paper", "Kaagaz", "काग़ज़") }, { id: "dark", label: "Blackboard" }]} />
              </div>
            </div>
          </section>
          <section className="card">
            <div className="card-h">
              <span className="h3">{t("Notifications", "Notifications", "सूचनाएँ")}</span>
            </div>
            <div className="set-rows">
              {(
                [
                  ["email", t("Email: weekly summary", "Email: hafte ka saar", "ईमेल")],
                  ["wa", t("WhatsApp: today's plan at 7 pm", "WhatsApp: 7 baje aaj ka plan", "व्हाट्सऐप")],
                  ["push", t("Push on phone", "Phone par push", "पुश")],
                  ["streak", t("Streak about to break", "Streak tootne wali", "लगातार टूटने वाली")],
                  ["contest", t("Contest starts in 15 minutes", "Contest 15 min me", "प्रतियोगिता 15 मिनट में")],
                ] as [keyof typeof n, string][]
              ).map(([k, l]) => (
                <div key={k} className="set-row">
                  <b className="small">{l}</b>
                  <Toggle on={n[k]} onChange={(v) => setN((x) => ({ ...x, [k]: v }))} label={l} />
                </div>
              ))}
              <p className="tiny faint" style={{ padding: "0 18px 14px" }}>
                {t("Quiet hours 10 pm – 7 am. At most 2 messages a day.", "Shant samay 10 pm – 7 am. Roz zyada se zyada 2 message.", "शांत समय 10–7।")}
              </p>
            </div>
          </section>
          <section className="card">
            <div className="card-h">
              <span className="h3">{t("Privacy & data", "Privacy aur data", "गोपनीयता")}</span>
            </div>
            <div className="set-rows">
              <div className="set-row">
                <div>
                  <b className="small">{t("Download my data", "Mera data download", "मेरा डेटा")}</b>
                  <p className="tiny faint">{t("Everything we hold about you, as a ZIP, within 48 hours.", "Aapke baare me sab, ZIP me, 48 ghante me.", "48 घंटे में ZIP।")}</p>
                </div>
                <button className="btn sm" onClick={() => toast(t("We'll email the link within 48 hours", "48 ghante me email par link", "48 घंटे में लिंक"))}>
                  <Download />
                  {t("Request", "Maango", "माँगें")}
                </button>
              </div>
              <div className="set-row">
                <div>
                  <b className="small">{t("Signed-in devices", "Signed-in devices", "डिवाइस")}</b>
                  <p className="tiny faint">Chrome · Windows (this one) · Android app · 2 days ago</p>
                </div>
                <span className="row g6">
                  <Laptop style={{ width: 16, height: 16 }} />
                  <Smartphone style={{ width: 16, height: 16 }} />
                  <button className="btn sm">{t("Sign out others", "Baaki se sign out", "अन्य से साइन आउट")}</button>
                </span>
              </div>
              <div className="set-row danger">
                <div>
                  <b className="small t-red">{t("Delete my account", "Account delete karo", "खाता हटाएँ")}</b>
                  <p className="tiny faint">{t("Removes your data under the DPDP Act. Certificates you shared stop verifying.", "DPDP Act ke tahat data hatega. Share kiye certificates verify hona band.", "DPDP के तहत।")}</p>
                </div>
                <button className="btn sm dang" onClick={() => setDel(true)}>
                  <Trash2 />
                  {t("Delete", "Delete", "हटाएँ")}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
      <Modal
        open={del}
        onClose={() => setDel(false)}
        title={t("Delete your account?", "Account delete karein?", "खाता हटाएँ?")}
        sub={t("This can't be undone after 14 days. Type DELETE to confirm.", "14 din baad wapas nahi hoga. DELETE likho.", "14 दिन बाद वापस नहीं।")}
        footer={
          <>
            <button className="btn ghost" onClick={() => setDel(false)}>
              {t("Keep my account", "Account rakho", "खाता रखें")}
            </button>
            <button className="btn dang" onClick={() => setDel(false)}>
              {t("Delete", "Delete", "हटाएँ")}
            </button>
          </>
        }
      >
        <input className="input" placeholder="DELETE" />
      </Modal>
    </div>
  );
}

