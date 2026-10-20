import { useState } from "react";
import {
  CalendarCheck,
  Coins,
  Flame,
  Snowflake,
  Trophy,
  Clock,
  Users,
  ShieldCheck,
  Lock,
  ArrowRight,
  CircleCheck,
  Circle,
  CircleX,
  Timer,
  FileText,
  CodeXml,
  Sparkles,
  Medal,
  TrendingUp,
  Share2,
  BookOpen,
  Camera,
  Wifi,
  Monitor,
  Play,
  Send,
} from "lucide-react";
import { Link, navigate, useT, useCountdown, hms } from "../lib/core";
import { Badge, Level, Card, PageHead, LineChart, Tabs, Code, CountUp, Stamp, Tick } from "../ui/kit";
import { FocusBar, Panes, PaneHead, usePanes, PaneToggles } from "../ui/focus";
import { SahayakPanel } from "../ui/sahayak";
import { BUGGY } from "./problem";

/* ---------------- problem of the day ---------------- */

export function PotdBody() {
  const t = useT();
  const [left] = useCountdown(3 * 3600 + 57 * 60 + 38);
  const solved = new Set([1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  const frozen = new Set([4]);
  return (
    <div className="col g20">
      <section className="potd-hero paper-grid">
        <div className="col g10" style={{ minWidth: 0 }}>
          <span className="eyebrow row g6">
            <CalendarCheck style={{ width: 14, height: 14 }} />
            {t("Problem of the day · Tuesday 20 October", "Aaj ka problem · Mangal 20 Oct", "आज का प्रश्न · 20 अक्टूबर")}
          </span>
          <h1 className="display" style={{ fontSize: 46, lineHeight: 1 }}>
            Bus stop queue
          </h1>
          <div className="row wrap g8">
            <Level n={3} />
            <Badge>Queue</Badge>
            <Badge>Simulation</Badge>
            <Badge tone="coin" icon={<Coins />}>
              +20
            </Badge>
          </div>
          <p className="muted" style={{ maxWidth: "56ch" }}>
            {t(
              "People join a queue at given times and a bus takes up to k of them every m minutes. Find when each person boards.",
              "Log diye samay par line me lagte hain aur bus har m minute me k logon ko le jaati hai. Har insaan kab chadhta hai, batao.",
              "हर व्यक्ति कब चढ़ता है?",
            )}
          </p>
          <div className="row g10 mt8">
            <Link to="problem" className="btn pri lg">
              <Play />
              {t("Solve now", "Abhi solve karo", "अभी हल करें")}
            </Link>
            <span className="small muted">{t("2,140 solved today · sample", "Aaj 2,140 ne solve kiya · sample", "आज 2,140 · नमूना")}</span>
          </div>
        </div>
        <div className="potd-count">
          <span className="tiny faint">{t("Ends in", "Khatam hone me", "समाप्ति")}</span>
          <div className="count-boxes">
            {hms(left)
              .split(":")
              .map((x, i) => (
                <span key={i} className="cbox">
                  <b className="mono">{x}</b>
                  <span className="tiny">{["hr", "min", "sec"][i]}</span>
                </span>
              ))}
          </div>
        </div>
      </section>
      <div className="grid c3">
        <div className="card pad stat">
          <span className="k">{t("Current streak", "Abhi ki streak", "वर्तमान")}</span>
          <span className="v row g6">
            <Flame style={{ color: "var(--coin)", width: 24, height: 24 }} />
            12
          </span>
          <span className="d">{t("1 freeze left this month", "Is mahine 1 freeze baaki", "1 फ़्रीज़ बाकी")}</span>
        </div>
        <div className="card pad stat">
          <span className="k">{t("Best streak", "Sabse lambi", "सबसे लंबी")}</span>
          <span className="v">23</span>
          <span className="d">{t("August 2026", "August 2026", "अगस्त 2026")}</span>
        </div>
        <div className="card pad stat">
          <span className="k">{t("Coins from POTD", "POTD se coins", "सिक्के")}</span>
          <span className="v row g6">
            <Coins style={{ color: "var(--coin)", width: 22, height: 22 }} />
            340
          </span>
          <span className="d">{t("Spend in the store", "Store me kharch karo", "स्टोर में")}</span>
        </div>
      </div>
      <Card title={t("October 2026", "October 2026", "अक्टूबर 2026")} icon={<CalendarCheck className="ic" />}>
        <div className="cal">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className="cal-h tiny faint">
              {d}
            </span>
          ))}
          {Array.from({ length: 3 }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {Array.from({ length: 31 }, (_, i) => {
            const d = i + 1;
            const s = d === 20 ? "today" : solved.has(d) ? "ok" : frozen.has(d) ? "frz" : d < 20 ? "miss" : "fut";
            return (
              <span key={d} className={`cal-d ${s}`}>
                <span className="num">{d}</span>
                {s === "ok" && <Tick size={14} draw={false} />}
                {s === "frz" && <Snowflake />}
              </span>
            );
          })}
        </div>
        <div className="legend mt12">
          <span>
            <i style={{ background: "var(--tick)" }} />
            {t("Solved", "Solve kiya", "हल")}
          </span>
          <span>
            <i style={{ background: "var(--teal)" }} />
            {t("Freeze used", "Freeze lagaya", "फ़्रीज़")}
          </span>
          <span>
            <i style={{ background: "var(--pen)" }} />
            {t("Today", "Aaj", "आज")}
          </span>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- contests ---------------- */

export function ContestsBody() {
  const t = useT();
  const [tab, setTab] = useState("up");
  const rating = [1180, 1215, 1201, 1260, 1302, 1288, 1341, 1376, 1402, 1395, 1443, 1486];
  return (
    <div className="col g20">
      <PageHead
        eyebrow={t("Contests", "Contests", "प्रतियोगिताएँ")}
        title={t("Ninety minutes, four problems, a real rank.", "Nabbe minute, chaar problems, asli rank.", "नब्बे मिनट, चार प्रश्न।")}
        actions={
          <Link to="contest-brief" className="btn pri">
            <Trophy />
            {t("Next: Weekly Round 13", "Agla: Weekly Round 13", "अगला: राउंड 13")}
          </Link>
        }
      />
      <div className="grid c3">
        <section className="card pad col g8 rating-card">
          <span className="tiny faint">{t("Your rating", "Aapki rating", "आपकी रेटिंग")}</span>
          <div className="row g8" style={{ alignItems: "baseline" }}>
            <b className="display" style={{ fontSize: 43, lineHeight: 1 }}>
              <CountUp to={1486} />
            </b>
            <Badge tone="tick" icon={<TrendingUp />}>
              +43
            </Badge>
          </div>
          <span className="small muted">{t("Specialist · top 18% · 12 rated rounds", "Specialist · top 18% · 12 rounds", "शीर्ष 18%")}</span>
        </section>
        <section className="card pad" style={{ gridColumn: "span 2" }}>
          <LineChart h={150} labels={rating.map((_, i) => `R${i + 2}`)} series={[{ name: "Rating", data: rating, c: "var(--pen)" }]} />
        </section>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "up", label: t("Upcoming", "Aane wale", "आगामी"), count: 3 },
          { id: "past", label: t("Past", "Pichhle", "पिछली") },
          { id: "virtual", label: t("Virtual", "Virtual", "वर्चुअल") },
        ]}
      />
      {tab === "up" ? (
        <div className="col g10">
          {[
            ["Weekly Round 13", t("Sun 25 Oct · 8:00 pm", "Ravi 25 Oct · 8 baje", "रवि 25 अक्टू · 8 बजे"), "90 min · 4", t("Rated", "Rated", "रेटेड"), "ai", 4210, true],
            ["Campus Cup · Round 2", t("Wed 28 Oct · 6:00 pm", "Budh 28 Oct · 6 baje", "बुध 28 अक्टू"), "120 min · 5", t("Your college only", "Sirf aapka college", "केवल आपका कॉलेज"), "pen", 312, false],
            ["Biweekly 7", t("Sat 31 Oct · 8:00 pm", "Shani 31 Oct · 8 baje", "शनि 31 अक्टू"), "90 min · 4", t("Rated", "Rated", "रेटेड"), "ai", 1890, false],
          ].map(([n, w, d, b, tone, reg, mine]) => (
            <div key={n as string} className="contest-row card">
              <span className="cr-date">
                <b className="display">{(w as string).match(/\d+/)?.[0]}</b>
                <span className="tiny">OCT</span>
              </span>
              <div className="grow" style={{ minWidth: 0 }}>
                <b className="h3">{n as string}</b>
                <div className="row wrap g8 tiny faint mt4">
                  <span className="row g4">
                    <Clock style={{ width: 13, height: 13 }} />
                    {w as string}
                  </span>
                  <span>{d as string}</span>
                  <span className="row g4">
                    <Users style={{ width: 13, height: 13 }} />
                    {(reg as number).toLocaleString("en-IN")} {t("registered", "registered", "पंजीकृत")}
                  </span>
                </div>
              </div>
              <Badge tone={tone as "ai"}>{b as string}</Badge>
              {mine ? (
                <Badge tone="tick" icon={<CircleCheck />}>
                  {t("Registered", "Registered", "पंजीकृत")}
                </Badge>
              ) : (
                <button className="btn sm">{t("Register", "Register", "पंजीकरण")}</button>
              )}
              <Link to="contest-brief" className="btn sm ghost">
                {t("Rules", "Niyam", "नियम")}
                <ArrowRight />
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <Card pad={false}>
          <div className="tbl-wrap"><table className="tbl">
            <thead>
              <tr>
                <th>{t("Contest", "Contest", "प्रतियोगिता")}</th>
                <th className="r">{t("Rank", "Rank", "रैंक")}</th>
                <th className="r">{t("Solved", "Solved", "हल")}</th>
                <th className="r">{t("Rating", "Rating", "रेटिंग")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Weekly Round 12", "612 / 3,980", "3 / 4", "+43"],
                ["Weekly Round 11", "880 / 3,712", "2 / 4", "−7"],
                ["Biweekly 6", "540 / 1,904", "3 / 4", "+48"],
              ].map(([a, b, c, d]) => (
                <tr key={a}>
                  <td>{a}</td>
                  <td className="r num">{b}</td>
                  <td className="r num">{c}</td>
                  <td className={`r num ${d.startsWith("+") ? "t-tick" : "t-red"}`}>{d}</td>
                  <td className="r">
                    <Link to="contest-result" className="link small">
                      {t("Result", "Nateeja", "परिणाम")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      )}
    </div>
  );
}

export function ContestBriefBody() {
  const t = useT();
  const [left] = useCountdown(4 * 86400 + 2 * 3600 + 14 * 60);
  const days = Math.floor(left / 86400);
  return (
    <div className="col g20">
      <section className="brief-hero">
        <div className="col g10" style={{ minWidth: 0 }}>
          <span className="eyebrow">{t("Contest · Rated", "Contest · Rated", "प्रतियोगिता")}</span>
          <h1 className="display" style={{ fontSize: 43, lineHeight: 1 }}>
            Weekly Round 13
          </h1>
          <div className="row wrap g12 small muted">
            <span className="row g6">
              <Clock style={{ width: 15, height: 15 }} />
              {t("Sunday 25 Oct, 8:00–9:30 pm", "Ravivaar 25 Oct, 8:00–9:30", "रविवार 25 अक्टू")}
            </span>
            <span className="row g6">
              <FileText style={{ width: 15, height: 15 }} />4 {t("problems", "problems", "प्रश्न")}
            </span>
            <span className="row g6">
              <Users style={{ width: 15, height: 15 }} />
              4,210 {t("registered", "registered", "पंजीकृत")}
            </span>
          </div>
        </div>
        <div className="potd-count">
          <span className="tiny faint">{t("Starts in", "Shuru hone me", "शुरू होने में")}</span>
          <div className="count-boxes">
            {[String(days).padStart(2, "0"), ...hms(left % 86400).split(":").slice(0, 2)].map((x, i) => (
              <span key={i} className="cbox">
                <b className="mono">{x}</b>
                <span className="tiny">{["days", "hr", "min"][i]}</span>
              </span>
            ))}
          </div>
          <Badge tone="tick" icon={<CircleCheck />}>
            {t("You're registered", "Aap registered ho", "आप पंजीकृत हैं")}
          </Badge>
        </div>
      </section>
      <div className="grid c2">
        <Card title={t("Rules", "Niyam", "नियम")} icon={<ShieldCheck className="ic" />}>
          <ol className="rules-list">
            {[
              t("Score: points per problem, minus 5 for each wrong submission on a problem you later solve.", "Score: har problem ke points, baad me solve hue problem par har galat submission −5.", "प्रति प्रश्न अंक।"),
              t("Sahayak is off from start to end. It opens for review when the contest ends.", "Shuru se ant tak Sahayak band. Contest khatam hone par review ke liye khulega.", "सहायक बंद।"),
              t("One account per person. Code is checked for copying after the contest.", "Ek insaan, ek account. Contest ke baad copying check hoti hai.", "एक व्यक्ति, एक खाता।"),
              t("Rating changes publish 2 hours after the end, once the copy check is done.", "Copy check ke baad, khatam hone ke 2 ghante baad rating.", "2 घंटे बाद रेटिंग।"),
            ].map((r, i) => (
              <li key={i}>
                <span className="num">{i + 1}</span>
                {r}
              </li>
            ))}
          </ol>
        </Card>
        <Card title={t("Before you start", "Shuru karne se pehle", "शुरू करने से पहले")} icon={<Monitor className="ic" />}>
          <div className="col g10">
            {[
              [<Wifi key="a" />, t("Connection stable", "Connection theek", "कनेक्शन ठीक"), true],
              [<Monitor key="b" />, t("One screen, full screen allowed", "Ek screen, full screen", "एक स्क्रीन"), true],
              [<Camera key="c" />, t("Camera not needed for this round", "Is round me camera nahi chahiye", "कैमरा नहीं चाहिए"), true],
              [<Lock key="d" />, t("Sahayak paused", "Sahayak ruka", "सहायक रुका"), true],
            ].map(([ic, l], i) => (
              <div key={i} className="sys-row">
                <span className="ic-box">{ic}</span>
                <span className="grow small">{l as string}</span>
                <CircleCheck style={{ width: 18, height: 18, color: "var(--tick)" }} />
              </div>
            ))}
            <button className="btn pri lg block mt8" onClick={() => navigate("contest-live")}>
              {t("Enter the contest (demo)", "Contest me jao (demo)", "प्रवेश (डेमो)")}
              <ArrowRight />
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- live (focus) ---------------- */

const CPROBS = [
  { id: "A", n: "Balanced split", pts: 300, s: "ac" },
  { id: "B", n: "Pair with target sum", pts: 500, s: "wa" },
  { id: "C", n: "Bus stop queue", pts: 750, s: "" },
  { id: "D", n: "Tree of lamps", pts: 1000, s: "" },
];

export function ContestLiveScreen() {
  const t = useT();
  const [cur, setCur] = useState("B");
  const [left] = useCountdown(41 * 60 + 12);
  const { open, toggle } = usePanes({ list: true, stmt: true, code: true, ai: false });
  const [phoneTab, setPhoneTab] = useState("code");
  const defs = [
    { id: "list", label: t("Problems", "Problems", "प्रश्न"), icon: <FileText /> },
    { id: "stmt", label: t("Statement", "Statement", "कथन"), icon: <BookOpen /> },
    { id: "code", label: t("Code", "Code", "कोड"), icon: <CodeXml /> },
    { id: "ai", label: "Sahayak", icon: <Sparkles />, tone: "ai" as const },
  ];
  return (
    <>
      <FocusBar
        back="contests"
        title="Weekly Round 13"
        sub={t("Rank 640 of 3,980 · 300 points", "Rank 640 / 3,980 · 300 points", "रैंक 640")}
        center={
          <span className={`timer big ${left < 15 * 60 ? "warn" : ""}`}>
            <Timer style={{ width: 16, height: 16 }} />
            {hms(left)}
          </span>
        }
        right={
          <span className="hide-phone">
            <PaneToggles panes={defs} open={open} toggle={toggle} />
          </span>
        }
      />
      <Panes
        open={open}
        toggle={toggle}
        phoneTab={phoneTab}
        setPhoneTab={setPhoneTab}
        panes={[
          {
            ...defs[0],
            weight: 0.16,
            min: 210,
            content: (
              <>
                <PaneHead onClose={() => toggle("list")}>
                  <span className="h3" style={{ paddingLeft: 6 }}>
                    {t("Problems", "Problems", "प्रश्न")}
                  </span>
                </PaneHead>
                <div className="pane-body">
                  {CPROBS.map((p) => (
                    <button key={p.id} className={`cprob ${cur === p.id ? "on" : ""}`} onClick={() => setCur(p.id)}>
                      <span className={`cp-id ${p.s}`}>{p.s === "ac" ? <CircleCheck /> : p.id}</span>
                      <span className="grow" style={{ minWidth: 0 }}>
                        <b className="small ellipsis" style={{ display: "block" }}>
                          {p.n}
                        </b>
                        <span className="tiny faint">
                          {p.pts} pts{p.s === "wa" ? ` · 1 ${t("wrong", "galat", "गलत")}` : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                  <div className="mini-stand">
                    <span className="eyebrow">{t("Top now", "Abhi top", "अभी शीर्ष")}</span>
                    {["Ishita R · 2,550", "Kabir S · 2,510", "Neha G · 2,480"].map((x, i) => (
                      <div key={x} className="row g8 tiny">
                        <span className="num faint">{i + 1}</span>
                        <span className="grow">{x}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ),
          },
          {
            ...defs[1],
            weight: 0.32,
            min: 280,
            content: (
              <>
                <PaneHead onClose={() => toggle("stmt")}>
                  <span className="h3" style={{ paddingLeft: 6 }}>
                    {cur}. {CPROBS.find((p) => p.id === cur)?.n}
                  </span>
                </PaneHead>
                <div className="pane-body stmt">
                  <p className="prose" style={{ fontSize: 14 }}>
                    {t("Given a sorted array and a target, print two positions whose values add up to the target, or -1.", "Sorted array aur target diya hai; do positions print karo jinka jod target ho, warna -1.", "दो स्थान खोजें।")}
                  </p>
                  <pre className="ex-b">{"Input   6\n        1 3 4 6 8 11\n        10\nOutput  2 3"}</pre>
                  <span className="tiny faint">{t("Time 1 s · memory 256 MB", "Samay 1 s · memory 256 MB", "समय 1 s")}</span>
                </div>
              </>
            ),
          },
          {
            ...defs[2],
            weight: 0.52,
            min: 360,
            content: (
              <>
                <PaneHead onClose={() => toggle("code")}>
                  <div className="file-tabs">
                    <span className="file-tab on">
                      <CodeXml />
                      B.cpp
                    </span>
                  </div>
                </PaneHead>
                <div className="editor">
                  <Code code={BUGGY} caret={4} className="ed-code" />
                </div>
                <div className="statusbar">
                  <span className="t-red row g4">
                    <CircleX />
                    {t("Wrong on test 23 · −5", "Test 23 par galat · −5", "टेस्ट 23 पर गलत")}
                  </span>
                  <span className="grow" />
                  <button className="btn sm">
                    <Play />
                    {t("Run", "Chalao", "चलाएँ")}
                  </button>
                  <button className="btn sm pri" onClick={() => navigate("contest-result")}>
                    <Send />
                    {t("Submit", "Submit", "जमा")}
                  </button>
                </div>
              </>
            ),
          },
          { ...defs[3], weight: 0.3, min: 300, content: <SahayakPanel locked onClose={() => toggle("ai")} /> },
        ]}
      />
    </>
  );
}

/* ---------------- result ---------------- */

export function ContestResultBody() {
  const t = useT();
  return (
    <div className="col g20">
      <section className="cres-hero paper-grid">
        <div className="col g8" style={{ minWidth: 0 }}>
          <span className="eyebrow">{t("Weekly Round 13 · final", "Weekly Round 13 · final", "राउंड 13 · अंतिम")}</span>
          <div className="row wrap g24" style={{ alignItems: "flex-end" }}>
            <div>
              <span className="tiny faint">{t("Rank", "Rank", "रैंक")}</span>
              <b className="display" style={{ fontSize: 52, lineHeight: 1, display: "block" }}>
                #<CountUp to={512} />
              </b>
            </div>
            <div>
              <span className="tiny faint">{t("Rating", "Rating", "रेटिंग")}</span>
              <b className="display t-tick" style={{ fontSize: 36, lineHeight: 1, display: "block" }}>
                1,486 → 1,529
              </b>
            </div>
          </div>
          <p className="muted">{t("Your best round so far. B cost you 10 minutes of penalty; the overflow again.", "Ab tak ka sabse accha round. B par 10 minute penalty; phir se overflow.", "अब तक का सबसे अच्छा राउंड।")}</p>
          <div className="row g8">
            <button className="btn">
              <Share2 />
              {t("Share result card", "Result card share karo", "साझा करें")}
            </button>
            <Link to="editorial" className="btn pri">
              <BookOpen />
              {t("Read editorials", "Editorials padho", "हल पढ़ें")}
            </Link>
          </div>
        </div>
        <Stamp top="ROUND 13" mid="+43" bottom="RATING UP" />
      </section>
      <Card title={t("Problem by problem", "Har problem", "हर प्रश्न")} icon={<Medal className="ic" />} pad={false}>
        <div className="tbl-wrap"><table className="tbl">
          <thead>
            <tr>
              <th>{t("Problem", "Problem", "प्रश्न")}</th>
              <th className="r">{t("Points", "Points", "अंक")}</th>
              <th className="r">{t("Solved at", "Kab", "कब")}</th>
              <th className="r">{t("Wrong", "Galat", "गलत")}</th>
              <th>{t("Learn", "Seekho", "सीखें")}</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["A · Balanced split", "300", "0:09", "0", "", "ac"],
              ["B · Pair with target sum", "490", "0:31", "2", "Overflow lesson", "ac"],
              ["C · Bus stop queue", "730", "1:12", "0", "", "ac"],
              ["D · Tree of lamps", "0", "—", "3", "DP on trees", "no"],
            ].map(([a, b, c, d, e, s]) => (
              <tr key={a}>
                <td>
                  <span className="row g8">
                    {s === "ac" ? <CircleCheck style={{ width: 16, height: 16, color: "var(--tick)" }} /> : <Circle style={{ width: 16, height: 16, color: "var(--line-2)" }} />}
                    {a}
                  </span>
                </td>
                <td className="r num">{b}</td>
                <td className="r num">{c}</td>
                <td className={`r num ${d !== "0" ? "t-red" : ""}`}>{d}</td>
                <td>{e ? <Link to="lesson" className="link small">{e}</Link> : <span className="faint">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>
      <div className="banner ai">
        <Sparkles />
        <span className="grow small">{t("Sahayak is back on. Ask it to review your D attempts; it won't show the solution unless you ask.", "Sahayak wapas on hai. D ki koshishen review karwao; aap na maango to hal nahi dikhayega.", "सहायक वापस चालू है।")}</span>
        <button className="btn sm ai">{t("Review D", "D review", "D समीक्षा")}</button>
      </div>
    </div>
  );
}
