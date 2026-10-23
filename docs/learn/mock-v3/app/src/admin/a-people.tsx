import { useState } from "react";
import {
  KeyRound,
  LogOut,
  Crown,
  Ban,
  IndianRupee,
  Download,
  Trash2,
  Eye,
  Lock,
  Flame,
  Smartphone,
  Laptop,
  MessageSquare,
  Send,
  StickyNote,
  Link2,
  Clock,
  CircleCheck,
  EyeOff,
  ShieldAlert,
  VolumeX,
  Check,
  Flag,
} from "lucide-react";
import { Link, navigate, useT, useToast } from "../lib/core";
import { Badge, Tabs, Card, Avatar, Spark, Heatmap, Menu, Seg } from "../ui/kit";
import { AdmHead, Gate, Toolbar, Pager, Masked, FourEyes, RowMenu, useFirstLoad, SkelRows } from "./akit";

/* ---------------- learners ---------------- */

const LEARNERS: [string, string, string, "Free" | "Plus" | "Campus", number, number, string, "" | "report" | "inactive" | "risk"][] = [
  ["Aarav Sharma", "aarav", "Indore Institute of Technology", "Free", 12, 212, "2 min ago", ""],
  ["Ishita Rao", "ishita_r", "Pune College of Engineering", "Plus", 48, 540, "1 h ago", ""],
  ["Kabir Shah", "kabirs", "Campus · Lucknow Tech", "Campus", 3, 88, "yesterday", "report"],
  ["Zoya Khan", "zoya.k", "Bhopal Engineering College", "Plus", 21, 301, "3 h ago", ""],
  ["Rahul Verma", "rv_2027", "Jaipur Tech University", "Free", 0, 14, "12 days ago", "inactive"],
  ["Neha Gill", "nehag", "Campus · Ludhiana Institute", "Campus", 6, 133, "20 min ago", ""],
  ["Arjun Menon", "arjun.m", "Kochi School of Engineering", "Free", 1, 41, "4 days ago", "risk"],
  ["Sneha Patil", "sneha_p", "Nagpur Tech", "Plus", 33, 412, "5 h ago", ""],
  ["Imran Qureshi", "imranq", "Aligarh Engineering College", "Free", 9, 97, "yesterday", ""],
  ["Tanvi Joshi", "tanvij", "Campus · Nashik College", "Campus", 2, 60, "6 days ago", "risk"],
];

export function AdmLearners() {
  const t = useT();
  const loading = useFirstLoad();
  const [view, setView] = useState("all");
  const rows = LEARNERS.filter((r) =>
    view === "all" ? true : view === "plus" ? r[3] === "Plus" : view === "campus" ? r[3] === "Campus" : view === "risk" ? r[7] === "risk" || r[7] === "inactive" : r[7] === "report",
  );
  return (
    <div className="col g16">
      <AdmHead
        title={t("Learners", "Learners", "शिक्षार्थी")}
        sub={t("4,82,310 accounts · 38,410 active today · data is masked until you give a reason", "4,82,310 accounts · aaj 38,410 active · data wajah dene tak masked", "4,82,310 खाते")}
      />
      <div className="stat-strip" style={{ ["--n" as string]: 4 }}>
        {[
          [t("New this week", "Is hafte naye", "इस सप्ताह नए"), "9,412", "+6.2%"],
          [t("Active 7 days", "7 din active", "7 दिन सक्रिय"), "1,21,880", "25%"],
          [t("At risk (no plan 5+ days)", "Risk me (5+ din plan nahi)", "जोखिम में"), "14,206", t("nudge sent to 9,100", "9,100 ko nudge", "9,100 को")],
          [t("Open reports", "Khuli reports", "खुली रिपोर्ट"), "37", t("11 older than 24 h", "11 purani 24 h se", "11 पुरानी")],
        ].map(([k, v, d]) => (
          <div key={k} className="stat">
            <span className="k">{k}</span>
            <span className="v">{v}</span>
            <span className="d">{d}</span>
          </div>
        ))}
      </div>
      <section className="card">
        <div style={{ padding: "0 12px" }}>
          <Tabs
            value={view}
            onChange={setView}
            items={[
              { id: "all", label: t("All", "Sab", "सभी") },
              { id: "plus", label: "Plus", count: LEARNERS.filter((r) => r[3] === "Plus").length },
              { id: "campus", label: t("Campus licence", "Campus licence", "कैंपस"), count: LEARNERS.filter((r) => r[3] === "Campus").length },
              { id: "risk", label: t("At risk", "Risk me", "जोखिम"), count: LEARNERS.filter((r) => r[7] === "risk" || r[7] === "inactive").length },
              { id: "reported", label: t("Reported", "Reported", "रिपोर्टेड"), count: 1 },
            ]}
          />
        </div>
        <Toolbar
          placeholder={t("Email, phone, handle or ID", "Email, phone, handle ya ID", "ईमेल, फ़ोन, हैंडल")}
          filters={[{ label: t("College", "College", "कॉलेज") }, { label: t("Goal", "Goal", "लक्ष्य") }, { label: t("Year", "Year", "वर्ष") }, { label: t("Joined", "Joined", "जुड़े") }]}
          right={
            <Gate mod="learners" need="full" className="btn sm">
              <Download />
              CSV
            </Gate>
          }
        />
        <div className="tbl-wrap" tabIndex={0}>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t("Learner", "Learner", "शिक्षार्थी")}</th>
                <th>{t("College", "College", "कॉलेज")}</th>
                <th>{t("Plan", "Plan", "योजना")}</th>
                <th className="r">{t("Streak", "Streak", "लगातार")}</th>
                <th className="r">{t("Solved", "Solved", "हल")}</th>
                <th>{t("Last seen", "Last seen", "अंतिम")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkelRows cols={7} rows={8} />
              ) : (
                rows.map(([n, h, c, p, st, so, ls, f], i) => (
                  <tr key={h} onClick={() => navigate("adm-learner")} style={{ cursor: "pointer" }}>
                    <td>
                      <span className="row g10">
                        <Avatar name={n} size={30} tone={i} />
                        <span>
                          <b className="small">{n}</b>
                          <span className="tiny faint" style={{ display: "block" }}>
                            @{h}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="small muted">{c}</td>
                    <td>
                      <Badge tone={p === "Plus" ? "solid" : p === "Campus" ? "pen" : ""}>{p}</Badge>
                    </td>
                    <td className="r num">{st}</td>
                    <td className="r num">{so}</td>
                    <td className="small faint">{ls}</td>
                    <td>
                      {f === "report" ? (
                        <Badge tone="red">1 report</Badge>
                      ) : f === "inactive" ? (
                        <Badge>{t("inactive", "inactive", "निष्क्रिय")}</Badge>
                      ) : f === "risk" ? (
                        <Badge tone="coin">{t("at risk", "risk me", "जोखिम")}</Badge>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pager total="4,82,310" shown={`1–${rows.length}`} />
      </section>
    </div>
  );
}

export function AdmLearner() {
  const t = useT();
  const toast = useToast();
  const [tab, setTab] = useState("ov");
  const [del, setDel] = useState(false);
  const [why, setWhy] = useState(false);
  return (
    <div className="col g16">
      <section className="card pad lrn-head">
        <Avatar name="Aarav Sharma" size={64} tone={0} />
        <div className="grow col g4" style={{ minWidth: 0 }}>
          <div className="row wrap g8">
            <h1 className="h2" style={{ fontSize: 22 }}>
              Aarav Sharma
            </h1>
            <Badge>Free</Badge>
            <Badge tone="tick">{t("Email verified", "Email verified", "ईमेल सत्यापित")}</Badge>
          </div>
          <span className="small muted">@aarav · ID 48213 · Indore Institute of Technology · {t("joined 2 Aug 2026", "2 Aug 2026 se", "2 अगस्त 2026")}</span>
          <div className="row wrap g16 small">
            <Masked value="aarav.sharma@college.edu.in" masked="a•••••@college.edu.in" />
            <Masked value="+91 98765 43210" masked="+91 •••••  ••210" />
          </div>
        </div>
        <div className="row wrap g8">
          <Gate mod="learners" need="full" className="btn" onClick={() => setWhy(true)}>
            <Eye />
            {t("View as learner", "Learner ki nazar se", "शिक्षार्थी दृश्य")}
          </Gate>
          <Menu
            width={250}
            trigger={(_, toggle) => (
              <button className="btn pri" onClick={toggle}>
                {t("Actions", "Actions", "कार्य")}
              </button>
            )}
          >
            {(close) => (
              <>
                {[
                  [<KeyRound key="a" />, t("Send password reset link", "Reset link bhejo", "रीसेट लिंक"), false],
                  [<LogOut key="b" />, t("End all sessions", "Saare sessions band", "सभी सत्र बंद"), false],
                  [<Crown key="c" />, t("Give Plus for N days", "N din ka Plus do", "प्लस दें"), false],
                  [<IndianRupee key="d" />, t("Ask finance for a refund", "Finance se refund maango", "रिफ़ंड माँगें"), false],
                  [<Download key="e" />, t("Export data (DPDP)", "Data export (DPDP)", "डेटा निर्यात"), false],
                  [<Ban key="f" />, t("Suspend with reason", "Wajah ke saath suspend", "निलंबित"), true],
                  [<Trash2 key="g" />, t("Delete account (needs approval)", "Account delete (approval)", "खाता हटाएँ"), true],
                ].map(([ic, l, d], i) => (
                  <button
                    key={i}
                    className={`menu-item ${d ? "dang" : ""}`}
                    onClick={() => {
                      close();
                      if (i === 6) setDel(true);
                      else toast(t("Done · logged", "Ho gaya · log hua", "हो गया · लॉग"));
                    }}
                  >
                    {ic}
                    {l as string}
                  </button>
                ))}
              </>
            )}
          </Menu>
        </div>
      </section>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "ov", label: t("Overview", "Overview", "सारांश") },
          { id: "subs", label: t("Submissions", "Submissions", "सबमिशन"), count: 418 },
          { id: "ai", label: t("Sahayak use", "Sahayak use", "सहायक उपयोग") },
          { id: "pay", label: t("Payments", "Payments", "भुगतान") },
          { id: "dev", label: t("Devices", "Devices", "डिवाइस"), count: 2 },
          { id: "audit", label: t("Staff actions", "Staff actions", "स्टाफ़ कार्य") },
        ]}
      />
      {tab === "ov" && (
        <div className="grid c3">
          <Card title={t("Activity", "Activity", "गतिविधि")} icon={<Flame className="ic" />} style={{ gridColumn: "span 2" }}>
            <div className="row g24 wrap">
              {[
                ["12", t("day streak", "din streak", "दिन")],
                ["212", t("solved", "solved", "हल")],
                ["58", t("readiness", "readiness", "तैयारी")],
                ["1,529", t("rating", "rating", "रेटिंग")],
              ].map(([v, k]) => (
                <div key={k} className="stat">
                  <span className="v">{v}</span>
                  <span className="k">{k}</span>
                </div>
              ))}
            </div>
            <div className="mt12" style={{ overflowX: "auto" }}>
              <Heatmap weeks={20} seed={11} />
            </div>
          </Card>
          <Card title={t("Plan", "Plan", "योजना")}>
            <div className="col g6 small">
              <span>Product company SDE · {t("ends 10 Dec", "10 Dec tak", "10 दिसंबर")}</span>
              <span className="muted">{t("2 h weekdays · exams 3–15 Nov", "2 ghante weekdays · exams 3–15 Nov", "2 घंटे")}</span>
              <span className="t-tick">{t("2 days ahead", "2 din aage", "2 दिन आगे")}</span>
            </div>
          </Card>
        </div>
      )}
      {tab === "ai" && (
        <div className="grid c2">
          <Card title={t("Sahayak use, 30 days", "Sahayak use, 30 din", "30 दिन")}>
            <div className="row between small">
              <span>{t("Messages", "Messages", "संदेश")}</span>
              <b className="num">612</b>
            </div>
            <div className="row between small">
              <span>{t("Cost", "Kharch", "खर्च")}</span>
              <b className="num">₹41</b>
            </div>
            <Spark data={[10, 18, 22, 15, 30, 26, 21, 19, 25, 28]} w={300} h={50} color="var(--ai)" />
          </Card>
          <Card title={t("Chat text", "Chat text", "चैट पाठ")} icon={<Lock className="ic" />}>
            <div className="col g10">
              <p className="small muted">{t("Hidden. Staff can open a chat only if the learner reported it or safety flagged it, with a written reason. Opening is logged and the learner is told.", "Chhupa hai. Staff tabhi khol sakta hai jab learner ne report kiya ho ya safety ne flag kiya ho, likhit wajah ke saath. Kholna log hota hai aur learner ko bataya jaata hai.", "छिपा है।")}</p>
              <span className="tiny faint">{t("Flagged chats for this learner: 0", "Is learner ki flagged chats: 0", "फ़्लैग चैट: 0")}</span>
              <button className="btn sm" disabled>
                <EyeOff />
                {t("Nothing to open", "Kholne ko kuch nahi", "कुछ नहीं")}
              </button>
            </div>
          </Card>
        </div>
      )}
      {tab === "dev" && (
        <Card pad={false}>
          <div className="list">
            {[
              [<Laptop key="a" />, "Chrome · Windows · Indore", "now"],
              [<Smartphone key="b" />, "Android app 3.4 · Indore", "2 days ago"],
            ].map(([ic, d, w], i) => (
              <div key={i} className="li">
                <span className="ic-box">{ic}</span>
                <span className="grow small">{d as string}</span>
                <span className="tiny faint">{w as string}</span>
                <Gate mod="learners" need="full" className="btn sm">
                  <LogOut />
                  {t("End", "Band", "बंद")}
                </Gate>
              </div>
            ))}
          </div>
        </Card>
      )}
      {(tab === "subs" || tab === "pay" || tab === "audit") && (
        <Card pad={false}>
          <div className="tbl-wrap" tabIndex={0}>
            <table className="tbl">
              <tbody>
                {(tab === "subs"
                  ? [
                      ["Pair with target sum", "Wrong answer · test 23", "14 min ago"],
                      ["Valid brackets", "Accepted", "yesterday"],
                    ]
                  : tab === "pay"
                    ? [["No payments", "Free plan", "—"]]
                    : [
                        ["Rohit Nair (Support)", "sent password reset link", "3 Oct 11:02"],
                        ["Meera Iyer (Super admin)", "revealed email · reason: ticket #8812", "3 Oct 10:58"],
                      ]
                ).map(([a, b, c]) => (
                  <tr key={a + b}>
                    <td className="small">{a}</td>
                    <td className="small muted">{b}</td>
                    <td className="tiny faint">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <FourEyes open={del} onClose={() => setDel(false)} title={t("Delete this learner's account", "Is learner ka account delete", "खाता हटाएँ")} what="Aarav Sharma · ID 48213 · 418 submissions, 3 certificates (certificates stop verifying)" />
      <FourEyes open={why} onClose={() => setWhy(false)} title={t("Open a read-only view as this learner", "Is learner ki nazar se read-only view", "पठन-मात्र दृश्य")} what={t("Read-only for 15 minutes. Every page you open is logged and the learner can see it in their account.", "15 minute read-only. Har page log hota hai aur learner apne account me dekh sakta hai.", "15 मिनट पठन-मात्र।")} needs="Support lead" />
    </div>
  );
}

/* ---------------- support & reports ---------------- */

export function AdmSupport() {
  const t = useT();
  const toast = useToast();
  const [cur, setCur] = useState(0);
  const items = [
    { k: "report", t: "Test 14 of 'Valid brackets' expects the wrong output", who: "Ishita Rao", age: "26 h", sla: true, item: "P-2231" },
    { k: "ticket", t: "Charged twice for Plus yearly", who: "Kabir Shah", age: "3 h", sla: false, item: "Order 7712" },
    { k: "report", t: "Hindi editorial for 'Pair with target sum' has a typo", who: "Zoya Khan", age: "1 h", sla: false, item: "E-0912" },
  ];
  const c = items[cur];
  return (
    <div className="col g16">
      <AdmHead title={t("Support & reports", "Support aur reports", "सहायता")} sub={t("'Report a mistake' from learners and email tickets in one inbox", "Learners ke 'galti batao' aur email tickets ek inbox me", "एक इनबॉक्स")} />
      <div className="inbox-grid">
        <aside className="ib-list">
          <Seg value="all" onChange={() => {}} items={[{ id: "all", label: t("All 9", "Sab 9", "सभी 9") }, { id: "mine", label: t("Mine 3", "Mere 3", "मेरे 3") }, { id: "sla", label: t("Past SLA 3", "SLA paar 3", "SLA पार 3") }]} />
          {items.map((x, i) => (
            <button key={x.t} className={`rq-item ${cur === i ? "on" : ""}`} onClick={() => setCur(i)}>
              <div className="row between">
                <Badge tone={x.k === "report" ? "coin" : "pen"} icon={x.k === "report" ? <Flag /> : <MessageSquare />}>
                  {x.k === "report" ? t("Mistake report", "Galti report", "गलती रिपोर्ट") : t("Ticket", "Ticket", "टिकट")}
                </Badge>
                <span className={`tiny ${x.sla ? "t-red" : "faint"}`}>
                  <Clock style={{ width: 11, height: 11, verticalAlign: -1 }} /> {x.age}
                </span>
              </div>
              <b className="small">{x.t}</b>
              <span className="tiny faint">{x.who}</span>
            </button>
          ))}
        </aside>
        <section className="card ib-thread">
          <div className="card-h">
            <span className="h3">{c.t}</span>
          </div>
          <div className="card-b col g12">
            <div className="msg-in">
              <Avatar name={c.who} size={28} />
              <div className="bubble">
                <b className="small">{c.who}</b>
                <p className="small">{t("For input '([)]{}' the expected output says true, but the brackets cross. I think it should be false.", "Input '([)]{}' ke liye expected true likha hai, par brackets cross ho rahe hain. False hona chahiye.", "अपेक्षित आउटपुट गलत।")}</p>
              </div>
            </div>
            <div className="note-int">
              <StickyNote />
              <span className="small">
                <b>{t("Internal note", "Andar ka note", "आंतरिक नोट")} · Kunal:</b> {t("Confirmed. Test 14 regenerated in v3; waiting for review.", "Sahi hai. v3 me test 14 dobara bana; review baaki.", "पुष्टि।")}
              </span>
            </div>
            <div className="field">
              <label>{t("Reply to learner", "Learner ko jawab", "जवाब")}</label>
              <textarea aria-label={t("Reply to learner", "Learner ko jawab", "जवाब")} className="textarea" defaultValue={t("Thank you, you're right. We've fixed test 14; the fix goes live after review. +20 coins added for the report.", "Shukriya, aap sahi ho. Test 14 theek kar diya; review ke baad live. Report ke liye +20 coins.", "धन्यवाद, आप सही हैं।")} />
            </div>
            <div className="row g8">
              <select className="select sm" style={{ width: 200 }} defaultValue="t1" aria-label={t("Reply template", "Jawab ka template", "टेम्पलेट")}>
                <option value="t1">{t("Template: fixed, thanks", "Template: theek, shukriya", "टेम्पलेट")}</option>
              </select>
              <span className="grow" />
              <Gate mod="support" className="btn pri" onClick={() => toast(t("Reply sent", "Jawab gaya", "जवाब भेजा"))}>
                <Send />
                {t("Send", "Bhejo", "भेजें")}
              </Gate>
            </div>
          </div>
        </section>
        <aside className="col g12">
          <Card title={t("Details", "Details", "विवरण")}>
            <div className="col g8 small">
              <div className="row between">
                <span className="muted">{t("Item", "Item", "आइटम")}</span>
                <Link to="adm-problem" className="link">
                  <Link2 />
                  {c.item}
                </Link>
              </div>
              <div className="row between">
                <span className="muted">{t("Assignee", "Kisko", "किसे")}</span>
                <span>Kunal (Editor)</span>
              </div>
              <div className="row between">
                <span className="muted">{t("SLA", "SLA", "SLA")}</span>
                <span className={c.sla ? "t-red" : ""}>{c.sla ? t("2 h over", "2 ghante upar", "2 घंटे ऊपर") : t("21 h left", "21 ghante baaki", "21 घंटे बाकी")}</span>
              </div>
            </div>
          </Card>
          <Card title={t("Status", "Status", "स्थिति")}>
            <div className="steps">
              {[t("New", "Naya", "नया"), t("With editor", "Editor ke paas", "संपादक के पास"), t("Fixed", "Theek", "ठीक"), t("Closed", "Band", "बंद")].map((s, i) => (
                <div key={s} className={`step ${i < 1 ? "done" : i === 1 ? "now" : ""}`}>
                  <span className="dot">{i < 1 ? <Check /> : i + 1}</span>
                  <span className="small">{s}</span>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- community moderation ---------------- */

export function AdmCommunity() {
  const t = useT();
  const toast = useToast();
  const [ban, setBan] = useState(false);
  const [tab, setTab] = useState("flags");
  return (
    <div className="col g16">
      <AdmHead
        title={t("Community", "Community", "समुदाय")}
        sub={t("Flags first, then experiences waiting for approval. House rules are public; every action tells the person why.", "Pehle flags, phir approval wale experiences. Niyam public hain; har action ki wajah insaan ko batayi jaati hai.", "पहले फ़्लैग")}
      />
      <div className="stat-strip" style={{ ["--n" as string]: 4 }}>
        {[
          [t("Open flags", "Khule flags", "खुले फ़्लैग"), "2", t("oldest 3 h", "sabse purana 3 h", "3 घंटे")],
          [t("Posts today", "Aaj ke posts", "आज के पोस्ट"), "1,204", "+8%"],
          [t("Experiences waiting", "Experiences baaki", "अनुभव बाकी"), "2", t("1 with proof", "1 proof ke saath", "1 प्रमाण")],
          [t("Active bans", "Active bans", "सक्रिय प्रतिबंध"), "2", t("1 appeal open", "1 appeal khuli", "1 अपील")],
        ].map(([k, v, d]) => (
          <div key={k} className="stat">
            <span className="k">{k}</span>
            <span className="v">{v}</span>
            <span className="d">{d}</span>
          </div>
        ))}
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "flags", label: t("Flags", "Flags", "फ़्लैग"), count: 2 },
          { id: "exp", label: t("Experiences", "Experiences", "अनुभव"), count: 2 },
          { id: "posts", label: t("All posts", "Saare posts", "सभी पोस्ट") },
          { id: "bans", label: t("Mutes & bans", "Mute aur ban", "प्रतिबंध"), count: 2 },
        ]}
      />
      {tab === "flags" && (
        <div className="col g10">
          {[
            { w: "Kabir Shah", r: t("Full solution without a spoiler", "Bina spoiler poora hal", "स्पॉइलर बिना हल"), n: 4, txt: "Here is my AC code for Weekly 12 C: …", where: "Discussions · Weekly Round 12", age: "3 h" },
            { w: "@spam_bot_22", r: t("Spam · links", "Spam · links", "स्पैम"), n: 11, txt: "Buy cheap course bundles at …", where: "Study group · DSA 2027", age: "40 min" },
          ].map((f) => (
            <section key={f.w} className="card flag-card">
              <div className="row g10">
                <ShieldAlert style={{ width: 20, height: 20, color: "var(--red-text)" }} />
                <b className="small grow">
                  {f.r} · {f.n} {t("flags", "flags", "फ़्लैग")}
                </b>
                <span className="tiny faint">
                  {f.w} · {f.where} · {f.age}
                </span>
              </div>
              <div className="spoiler">
                <EyeOff />
                <span className="small">{f.txt}</span>
              </div>
              <div className="row wrap g8">
                <Gate mod="community" className="btn sm" onClick={() => toast(t("Kept · flaggers told", "Rakha · flag walon ko bataya", "रखा"))}>
                  <Check />
                  {t("Keep", "Rakho", "रखें")}
                </Gate>
                <Gate mod="community" className="btn sm" onClick={() => toast(t("Hidden behind spoiler", "Spoiler me chhupaya", "छिपाया"))}>
                  <EyeOff />
                  {t("Hide as spoiler", "Spoiler me", "स्पॉइलर")}
                </Gate>
                <Gate mod="community" className="btn sm" onClick={() => toast(t("Muted for 7 days · they were told why", "7 din mute · wajah batayi", "म्यूट"))}>
                  <VolumeX />
                  {t("Mute 7 days", "7 din mute", "7 दिन म्यूट")}
                </Gate>
                <Gate mod="community" need="full" className="btn sm dang" onClick={() => setBan(true)}>
                  <Ban />
                  {t("Ban", "Ban", "प्रतिबंध")}
                </Gate>
              </div>
            </section>
          ))}
        </div>
      )}
      {tab === "exp" && (
        <Card title={t("Experiences waiting", "Experiences baaki", "अनुभव बाकी")} pad={false}>
          <div className="list">
            {[
              ["Nimbu Labs · SDE 1 · Sep 2026", t("offer letter attached · 3 rounds described", "offer letter laga · 3 rounds", "ऑफ़र पत्र"), true],
              ["Kesar Cloud · Backend · Aug 2026", t("no proof · names an interviewer (will be removed)", "proof nahi · interviewer ka naam (hatega)", "प्रमाण नहीं"), false],
            ].map(([n, p, ok]) => (
              <div key={n as string} className="li">
                <span className="grow">
                  <b className="small">{n as string}</b>
                  <span className={`tiny ${ok ? "t-tick" : "faint"}`} style={{ display: "block" }}>
                    {ok ? <CircleCheck style={{ width: 12, height: 12, verticalAlign: -2 }} /> : null} {p as string}
                  </span>
                </span>
                <Gate mod="community" className="btn sm">
                  {ok ? t("Approve as verified", "Verified approve", "सत्यापित") : t("Approve as unverified", "Unverified approve", "असत्यापित")}
                </Gate>
                <RowMenu items={[{ label: t("Edit before approving", "Approve se pehle edit", "संपादित") }, { label: t("Reject with reason", "Wajah ke saath reject", "अस्वीकार"), danger: true }]} />
              </div>
            ))}
          </div>
        </Card>
      )}
      {tab === "posts" && (
        <section className="card">
          <Toolbar placeholder={t("Search posts or people", "Posts ya log khojo", "पोस्ट खोजें")} filters={[{ label: t("Has spoiler", "Spoiler", "स्पॉइलर") }, { label: t("Answered", "Answered", "उत्तरित") }, { label: t("Reported once", "Ek report", "एक रिपोर्ट") }]} />
          <div className="tbl-wrap" tabIndex={0}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("Post", "Post", "पोस्ट")}</th>
                  <th>{t("Where", "Kahan", "कहाँ")}</th>
                  <th className="r">{t("Votes", "Votes", "वोट")}</th>
                  <th className="r">{t("Replies", "Replies", "जवाब")}</th>
                  <th>{t("State", "Haalat", "स्थिति")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[
                  ["Is it okay to use long long everywhere in C++?", "Discussions", 34, 12, "live"],
                  ["Weekly Round 12, problem C: my greedy idea", "Contest", 21, 8, "review"],
                  ["How I revised OS in 5 days before Tech 2", "Experiences", 57, 19, "live"],
                  ["Study partner for DP, evenings IST", "Study groups", 6, 3, "live"],
                ].map(([p, w, v, r, st]) => (
                  <tr key={p as string}>
                    <td className="small">{p}</td>
                    <td>
                      <Badge>{w}</Badge>
                    </td>
                    <td className="r num">{v}</td>
                    <td className="r num">{r}</td>
                    <td>{st === "live" ? <span className="small t-tick">{t("Visible", "Dikh raha", "दिख रहा")}</span> : <span className="small t-coin">{t("Behind spoiler", "Spoiler me", "स्पॉइलर")}</span>}</td>
                    <td>
                      <RowMenu items={[{ label: t("Open", "Kholo", "खोलें") }, { label: t("Pin to top", "Upar pin", "पिन") }, { label: t("Hide", "Chhupao", "छिपाएँ"), danger: true }]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === "bans" && (
        <section className="card">
          <div className="tbl-wrap" tabIndex={0}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("Account", "Account", "खाता")}</th>
                  <th>{t("Action", "Action", "कार्य")}</th>
                  <th>{t("Reason", "Wajah", "कारण")}</th>
                  <th>{t("Until", "Kab tak", "कब तक")}</th>
                  <th>{t("By", "Kisne", "किसने")}</th>
                  <th>{t("Appeal", "Appeal", "अपील")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="mono small">@spam_bot_22</td>
                  <td>
                    <Badge tone="red">Ban</Badge>
                  </td>
                  <td className="small">Spam links ×34 in 2 days</td>
                  <td className="small">{t("Permanent", "Hamesha", "स्थायी")}</td>
                  <td className="small muted">Sana Q. + Meera I.</td>
                  <td className="small faint">—</td>
                </tr>
                <tr>
                  <td className="mono small">@zz_top</td>
                  <td>
                    <Badge tone="coin">Mute</Badge>
                  </td>
                  <td className="small">Rude replies ×3</td>
                  <td className="small">27 Oct</td>
                  <td className="small muted">Sana Q.</td>
                  <td>
                    <Gate mod="community" className="btn sm">
                      {t("Review appeal", "Appeal dekho", "अपील देखें")}
                    </Gate>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
      <FourEyes open={ban} onClose={() => setBan(false)} title={t("Ban this account from the community", "Community se ban", "प्रतिबंध")} what="@spam_bot_22 · 11 flags · 34 posts in 2 days" needs="Super admin" />
    </div>
  );
}
