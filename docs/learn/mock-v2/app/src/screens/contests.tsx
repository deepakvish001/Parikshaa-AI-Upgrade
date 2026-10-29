import { useState } from "react";
import {
  Trophy,
  CalendarClock,
  Users,
  ArrowRight,
  CircleCheck,
  ShieldCheck,
  Maximize,
  Wifi,
  BotOff,
  Snowflake,
  Copy,
  Timer,
  CircleX,
  Circle,
  ListOrdered,
  Send,
  TrendingUp,
  Sparkles,
  Building2,
  School,
} from "lucide-react";
import { Link, hms, navigate, useCountdown, useT } from "../lib/core";
import { Code, Level, Check, Tabs, Spark, Bar } from "../ui/kit";
import { PageHead } from "../ui/shell";
import { FocusBar } from "../ui/focus";

export function ContestsBody() {
  const t = useT();
  const [tab, setTab] = useState<"up" | "past">("up");
  const [left] = useCountdown(4 * 86400 + 2 * 3600 + 11 * 60);
  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  return (
    <div className="page stagger">
      <PageHead
        title={t("Contests", "Contests", "प्रतियोगिताएँ")}
        sub={t("Weekly rated rounds, college contests and hiring challenges. AI help is off during every contest.", "Har hafte rated rounds, college contests aur hiring challenges. Har contest me AI band.", "हर प्रतियोगिता में एआई बंद।")}
      />
      <div className="contest-top">
        <section className="panel featured contest-hero">
          <span className="tag action" style={{ alignSelf: "flex-start" }}>
            {t("Next rated round", "Agla rated round", "अगला रेटेड राउंड")}
          </span>
          <h2>Weekly Round 12</h2>
          <div className="row wrap muted" style={{ gap: 14, fontSize: "var(--fs-13)" }}>
            <span className="row" style={{ gap: 6 }}>
              <CalendarClock size={14} /> {t("Sun 25 Oct, 8:00 PM", "Ravi 25 Oct, 8:00 PM", "रवि 25 अक्टू, रात 8")}
            </span>
            <span className="row" style={{ gap: 6 }}>
              <Timer size={14} /> 90 min · ICPC
            </span>
            <span className="row" style={{ gap: 6 }}>
              <Users size={14} /> 1,902 {t("registered", "registered", "पंजीकृत")}
            </span>
          </div>
          <div className="row wrap between" style={{ gap: 12 }}>
            <div className="big-count num">
              {d}
              <small>d</small> {h}
              <small>h</small>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <Link to="contest-brief" className="btn primary lg">
                {t("Register", "Register karo", "पंजीकरण करें")} <ArrowRight size={15} />
              </Link>
              <Link to="contest-live" className="btn secondary lg">
                {t("See live (demo)", "Live dekho (demo)", "लाइव देखें")}
              </Link>
            </div>
          </div>
        </section>
        <section className="panel pad stack">
          <div className="row between">
            <b style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <TrendingUp size={15} /> {t("Your rating", "Aapki rating", "आपकी रेटिंग")}
            </b>
            <span className="tag ok">+38</span>
          </div>
          <div className="rating-num num">1,486</div>
          <Spark data={[1200, 1236, 1220, 1288, 1310, 1295, 1352, 1401, 1448, 1486]} w={260} h={70} />
          <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
            {t("10 rated rounds · best rank 214", "10 rated rounds · best rank 214", "10 राउंड · सबसे अच्छी रैंक 214")}
          </span>
        </section>
      </div>
      <Tabs
        label="Contests"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "up", label: t("Upcoming", "Aane wale", "आने वाली") },
          { value: "past", label: t("Past", "Pichhle", "पिछली") },
        ]}
      />
      {tab === "up" ? (
        <div className="grid c3">
          {[
            { icon: Trophy, n: "Weekly Round 12", d: t("Sun 25 Oct · 8 PM · rated", "Ravi 25 Oct · 8 PM · rated", "रवि 25 अक्टू"), tag: t("Open to all", "Sab ke liye", "सबके लिए") },
            { icon: School, n: "College Cup · Round 2", d: t("Wed 28 Oct · 4 PM · your college only", "Budh 28 Oct · 4 PM · sirf aapka college", "केवल आपका कॉलेज"), tag: t("Your college", "Aapka college", "आपका कॉलेज") },
            { icon: Building2, n: "Patang Tech hiring challenge", d: t("Sat 31 Oct · 11 AM · top 50 get an interview", "Shani 31 Oct · 11 AM · top 50 ko interview", "शीर्ष 50 को इंटरव्यू"), tag: t("Via Hire · sample", "Hire se · namuna", "हायर से · नमूना") },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <Link key={c.n} to="contest-brief" className="panel pad stack hover-card">
                <div className="row between">
                  <Icon size={18} className="faint" />
                  <span className="tag outline">{c.tag}</span>
                </div>
                <b style={{ fontSize: "var(--fs-16)" }}>{c.n}</b>
                <span className="muted" style={{ fontSize: "var(--fs-13)" }}>
                  {c.d}
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="panel table-wrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>{t("Contest", "Contest", "प्रतियोगिता")}</th>
                <th className="r">{t("Rank", "Rank", "रैंक")}</th>
                <th className="r">{t("Solved", "Hal", "हल")}</th>
                <th className="r">{t("Rating", "Rating", "रेटिंग")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[
                ["Weekly Round 11", "214 / 1,840", "3 / 4", "+38"],
                ["Weekly Round 10", "402 / 1,716", "2 / 4", "+47"],
                ["Weekly Round 9", "655 / 1,690", "2 / 4", "−15"],
              ].map((r) => (
                <tr key={r[0]}>
                  <td>
                    <b>{r[0]}</b>
                  </td>
                  <td className="r num">{r[1]}</td>
                  <td className="r num">{r[2]}</td>
                  <td className={`r num ${r[3].startsWith("+") ? "pos" : "neg"}`}>{r[3]}</td>
                  <td className="r">
                    <Link to="contest-result" className="btn ghost sm">
                      {t("Review", "Review", "समीक्षा")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ContestBriefBody() {
  const t = useT();
  const [agree, setAgree] = useState(false);
  const rules: [typeof BotOff, string][] = [
    [BotOff, t("Sahayak and all AI help are off until the contest ends.", "Contest khatam hone tak Sahayak aur saari AI madad band.", "सहायक और एआई बंद।")],
    [Maximize, t("Stay in full screen. Leaving it or switching tabs counts as a warning; 3 warnings end your attempt.", "Full screen me raho. Bahar jaana ya tab badalna warning; 3 warning par attempt khatam.", "पूरी स्क्रीन में रहें।")],
    [Copy, t("Every submission is checked for copying after the contest.", "Contest ke baad har submission ki copy jaanch.", "नकल की जाँच।")],
    [Snowflake, t("The scoreboard freezes for the last 15 minutes.", "Aakhri 15 minute scoreboard freeze.", "आखिरी 15 मिनट स्कोरबोर्ड रुका।")],
    [ListOrdered, t("ICPC rules: each wrong submission adds 10 penalty minutes once you solve the problem.", "ICPC: problem hal hone par har galat submission par 10 minute penalty.", "हर गलत जमा पर 10 मिनट।")],
  ];
  return (
    <div className="page narrow stagger">
      <PageHead
        crumbs={[{ to: "contests", label: t("Contests", "Contests", "प्रतियोगिताएँ") }, { label: "Weekly Round 12" }]}
        title="Weekly Round 12"
        sub={t("Read the rules first. The clock starts only when you press Start.", "Pehle niyam padho. Ghadi tabhi chalegi jab Start dabaoge.", "पहले नियम पढ़ें।")}
      />
      <section className="panel brief-hero">
        <div className="brief-art" aria-hidden="true">
          <Trophy size={46} />
        </div>
        <div className="grid c4 brief-facts">
          <div>
            <span>{t("Problems", "Problems", "प्रश्न")}</span>
            <b>4</b>
          </div>
          <div>
            <span>{t("Duration", "Samay", "अवधि")}</span>
            <b>90 min</b>
          </div>
          <div>
            <span>{t("Format", "Format", "प्रारूप")}</span>
            <b>ICPC</b>
          </div>
          <div>
            <span>{t("Rated", "Rated", "रेटेड")}</span>
            <b>{t("Yes", "Haan", "हाँ")}</b>
          </div>
        </div>
      </section>
      <section className="panel pad-lg stack">
        <b>{t("Rules", "Niyam", "नियम")}</b>
        {rules.map(([Icon, r], i) => (
          <div key={i} className="rule">
            <Icon size={16} />
            <span>{r}</span>
          </div>
        ))}
      </section>
      <section className="panel pad-lg stack">
        <b>{t("Quick check", "Jhatpat jaanch", "त्वरित जाँच")}</b>
        <div className="checks">
          <span className="ok">
            <CircleCheck size={15} /> {t("Browser supports full screen", "Browser full screen chalata hai", "पूरी स्क्रीन")}
          </span>
          <span className="ok">
            <Wifi size={15} /> {t("Connection steady (42 ms)", "Connection theek (42 ms)", "कनेक्शन ठीक")}
          </span>
          <span className="ok">
            <ShieldCheck size={15} /> {t("Camera not needed for this round", "Is round me camera nahi chahiye", "कैमरा नहीं चाहिए")}
          </span>
        </div>
      </section>
      <label className="row" style={{ gap: 10, fontWeight: 600 }}>
        <Check on={agree} onChange={setAgree} label="I agree" />
        {t("I have read the rules. I will not use AI or copy code.", "Maine niyam padh liye. AI ya copy nahi karunga.", "मैंने नियम पढ़ लिए।")}
      </label>
      <div className="row between wrap" style={{ gap: 10 }}>
        <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
          {t("Once you start, you cannot restart this round.", "Shuru karne ke baad round dobara nahi hoga.", "शुरू करने के बाद दोबारा नहीं।")}
        </span>
        <button type="button" className="btn primary lg" disabled={!agree} onClick={() => navigate("contest-live")}>
          {t("Start contest", "Contest shuru karo", "प्रतियोगिता शुरू करें")} <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

const CONTEST_CODE = `int main() {
    int n;
    cin >> n;
    vector<long long> h(n);
    for (auto& x : h) cin >> x;
    // TODO: count towers you can see
}`;

export function ContestLiveScreen() {
  const t = useT();
  const [left] = useCountdown(9 * 60 + 16);
  const [sel, setSel] = useState(2);
  const probs: [string, string, number, "ac" | "wa" | ""][] = [
    ["A", "Seedhi line", 100, "ac"],
    ["B", "Do dukaan", 100, "ac"],
    ["C", "Towers in a row", 100, "wa"],
    ["D", "Toll plaza", 100, ""],
  ];
  return (
    <div className="work">
      <FocusBar
        back="contests"
        backLabel={t("Leave contest", "Contest chhodo", "प्रतियोगिता छोड़ें")}
        title={<b>Weekly Round 12</b>}
        center={
          <span className={`exam-timer ${left < 600 ? "urgent" : ""}`} role="timer" aria-label="Time left">
            <Timer size={15} /> <span className="num">{hms(left)}</span>
          </span>
        }
        right={
          <Link to="contest-result" className="btn secondary sm">
            {t("Finish", "Khatam", "समाप्त")}
          </Link>
        }
      />
      <div className="contest-body">
        <aside className="contest-side">
          <span className="eyebrow">{t("Problems", "Problems", "प्रश्न")}</span>
          {probs.map(([id, n, pts, st], i) => (
            <button key={id} type="button" className={`cprob ${sel === i ? "on" : ""} ${st}`} onClick={() => setSel(i)}>
              <b>{id}</b>
              <span className="grow">{n}</span>
              {st === "ac" ? <CircleCheck size={15} /> : st === "wa" ? <CircleX size={15} /> : <Circle size={15} />}
              <span className="num faint">{pts}</span>
            </button>
          ))}
          <div className="divider" />
          <div className="stack sm" style={{ fontSize: "var(--fs-12)" }}>
            <div className="row between">
              <span className="faint">{t("Your rank", "Aapki rank", "आपकी रैंक")}</span>
              <b className="num">241</b>
            </div>
            <div className="row between">
              <span className="faint">{t("Penalty", "Penalty", "दंड")}</span>
              <b className="num">58 min</b>
            </div>
            <span className="tag warn" style={{ alignSelf: "flex-start" }}>
              <Snowflake size={11} /> {t("Scoreboard frozen", "Scoreboard freeze", "स्कोरबोर्ड रुका")}
            </span>
          </div>
          <span className="faint" style={{ fontSize: "var(--fs-11)" }}>
            {t("Under 10 minutes the timer turns red. It never jumps or hides.", "10 minute se kam par timer laal. Kabhi chhupta nahi.", "10 मिनट से कम पर लाल।")}
          </span>
        </aside>
        <section className="contest-main">
          <div className="stmt" style={{ maxWidth: "none" }}>
            <div className="row wrap" style={{ gap: 6 }}>
              <span className="tag outline">C · 100</span>
              <Level lv={3} />
              <span className="tag bad">{t("1 wrong try", "1 galat koshish", "1 गलत")}</span>
            </div>
            <h1>Towers in a row</h1>
            <p>
              {t(
                "n towers stand in a row with heights h[i]. Standing at the left end, a tower is visible if it is taller than every tower before it. Print how many towers you can see.",
                "n towers ek line me, unchai h[i]. Baayein kinare se, ek tower dikhta hai agar wo apne pehle ke har tower se uncha ho. Kitne towers dikhte hain?",
                "कितने टावर दिखते हैं?",
              )}
            </p>
            <div className="ex">
              <b>{t("Example", "Udaharan", "उदाहरण")}</b>
              <pre>
                <span className="k">Input</span>
                {"   5\n        3 1 4 4 7\n"}
                <span className="k">Output</span>
                {"  3   (towers 3, 4 and 7)"}
              </pre>
            </div>
          </div>
          <div className="contest-editor">
            <div className="editor-top">
              <span className="file-tab on">C.cpp</span>
              <span className="chip">C++ 17</span>
            </div>
            <div className="editor">
              <Code code={CONTEST_CODE} caretLine={6} />
            </div>
            <div className="editor-status">
              <span>{t("Saved", "Saved", "सहेजा")}</span>
              <span className="grow" />
              <button type="button" className="btn secondary sm">
                {t("Run samples", "Samples chalao", "नमूने चलाएँ")}
              </button>
              <button type="button" className="btn primary sm">
                <Send size={13} /> {t("Submit", "Submit", "जमा करें")}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function ContestResultBody() {
  const t = useT();
  const rows: [string, string, string, string, "ac" | "wa" | ""][] = [
    ["A", "Seedhi line", "100", "11 min", "ac"],
    ["B", "Do dukaan", "100", "29 min", "ac"],
    ["C", "Towers in a row", "100", "71 min · 1 wrong", "ac"],
    ["D", "Toll plaza", "0", t("not tried", "try nahi kiya", "नहीं किया"), ""],
  ];
  return (
    <div className="page stagger">
      <PageHead
        crumbs={[{ to: "contests", label: t("Contests", "Contests", "प्रतियोगिताएँ") }, { label: "Weekly Round 12" }]}
        title={t("Weekly Round 12: your result", "Weekly Round 12: aapka nateeja", "आपका नतीजा")}
        sub={t("Final standings after the plagiarism check · 25 Oct 2026", "Plagiarism jaanch ke baad final · 25 Oct 2026", "अंतिम स्थिति")}
      />
      <div className="grid c4">
        {[
          [t("Score", "Score", "अंक"), "300 / 400", ""],
          [t("Rank", "Rank", "रैंक"), "188 / 1,902", t("top 10%", "top 10%", "शीर्ष 10%")],
          [t("Rating", "Rating", "रेटिंग"), "1,486 → 1,529", "+43"],
          [t("Penalty", "Penalty", "दंड"), "121 min", ""],
        ].map(([k, v, s]) => (
          <div key={k} className="panel pad mini-stat">
            <span>{k}</span>
            <b>{v}</b>
            {s && <span className="tag ok" style={{ alignSelf: "flex-start" }}>{s}</span>}
          </div>
        ))}
      </div>
      <section className="panel list">
        {rows.map(([id, n, sc, tm, st]) => (
          <div key={id} className="list-row">
            <span className={`res-id ${st}`}>{id}</span>
            <span className="t">
              {n}
              <small>{tm}</small>
            </span>
            <b className="num" style={{ minWidth: 40, textAlign: "right" }}>
              {sc}
            </b>
            <Link to={st === "" ? "problem" : "editorial"} className="btn ghost sm">
              {st === "" ? t("Upsolve", "Ab hal karo", "अब हल करें") : t("Editorial", "Editorial", "हल")}
            </Link>
          </div>
        ))}
      </section>
      <section className="panel pad-lg stack">
        <b style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Sparkles size={15} style={{ color: "var(--action)" }} /> {t("What to fix before the next round", "Agle round se pehle kya sudhaarein", "अगले राउंड से पहले क्या सुधारें")}
        </b>
        <div className="grid c2">
          <div className="callout warn">
            <h3>{t("Your wrong try on C", "C par galat koshish", "C पर गलत कोशिश")}</h3>
            <p>
              {t(
                "Smallest failing test: n = 3, h = [5, 5, 6] → you printed 3, expected 2. Equal heights do not count as taller. That cost 10 penalty minutes.",
                "Sabse chhota galat test: n = 3, h = [5, 5, 6] → aapne 3 diya, sahi 2. Barabar unchai \"zyada\" nahi. 10 minute penalty lagi.",
                "बराबर ऊँचाई ज़्यादा नहीं गिनी जाती।",
              )}
            </p>
          </div>
          <div className="callout">
            <h3>{t("D was within reach", "D ho sakta tha", "D हो सकता था")}</h3>
            <p>
              {t(
                "D uses a monotonic stack, the same idea as C. 61% of people with your rating who tried it solved it. Your plan adds it to sprint 3.",
                "D me monotonic stack, C jaisa idea. Aapki rating wale 61% ne try karke hal kiya. Plan ne ise sprint 3 me joda.",
                "D में मोनोटोनिक स्टैक।",
              )}
            </p>
          </div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
            {t("Time per problem", "Har problem ka samay", "हर प्रश्न का समय")}
          </span>
          <span className="grow">
            <Bar value={78} />
          </span>
          <span className="faint num" style={{ fontSize: "var(--fs-12)" }}>
            71 / 90 min
          </span>
        </div>
      </section>
    </div>
  );
}
