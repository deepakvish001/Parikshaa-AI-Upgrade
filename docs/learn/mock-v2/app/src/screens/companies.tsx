import { useState } from "react";
import { Search, ShieldCheck, Info, MapPin, Users, ArrowRight, ThumbsUp, MessageSquare, Eye, PenLine, CircleCheck, CircleX, Building2 } from "lucide-react";
import { Link, useT } from "../lib/core";
import { Bar, Level, Ring, SampleNote, Seg, Tabs } from "../ui/kit";
import { PageHead } from "../ui/shell";

type Co = { n: string; c: string; kind: "product" | "service"; reports: number };
export const COMPANIES: Co[] = [
  { n: "Nimbu Labs", c: "#16a34a", kind: "product", reports: 41 },
  { n: "Patang Tech", c: "#2563eb", kind: "product", reports: 33 },
  { n: "Kesar Cloud", c: "#ea580c", kind: "product", reports: 27 },
  { n: "Tara Fintech", c: "#7c3aed", kind: "product", reports: 22 },
  { n: "Megh Data", c: "#0891b2", kind: "product", reports: 18 },
  { n: "Jugnu Apps", c: "#ca8a04", kind: "product", reports: 15 },
  { n: "Kalpa AI", c: "#db2777", kind: "product", reports: 9 },
  { n: "Vayu Mobility", c: "#0d9488", kind: "product", reports: 7 },
  { n: "Sitara Infotech", c: "#4f46e5", kind: "service", reports: 64 },
  { n: "Bodhi Services", c: "#b45309", kind: "service", reports: 52 },
  { n: "Dhruv Systems", c: "#475569", kind: "service", reports: 47 },
  { n: "Ganga Analytics", c: "#0369a1", kind: "service", reports: 31 },
  { n: "Pahadi Soft", c: "#15803d", kind: "service", reports: 12 },
  { n: "Neem Health", c: "#65a30d", kind: "product", reports: 4 },
  { n: "Sona Logistics", c: "#a16207", kind: "service", reports: 3 },
  { n: "Taal Media", c: "#be185d", kind: "product", reports: 2 },
];

export function CompaniesBody() {
  const t = useT();
  const [kind, setKind] = useState<"all" | "product" | "service">("all");
  const [q, setQ] = useState("");
  const list = COMPANIES.filter((c) => (kind === "all" || c.kind === kind) && c.n.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="page stagger">
      <PageHead
        title={t("Companies", "Companies", "कंपनियाँ")}
        sub={t(
          "What each company asks, from verified interview reports. A company with too few reports says so.",
          "Har company kya poochhti hai, verified interview reports se. Kam reports ho to saaf likha hota hai.",
          "हर कंपनी क्या पूछती है, जाँची रिपोर्ट से।",
        )}
        actions={<SampleNote>{t("All company names here are made up", "Yahan saare company naam nakli hain", "यहाँ सभी नाम काल्पनिक")}</SampleNote>}
      />
      <div className="row wrap" style={{ gap: 10 }}>
        <Seg
          label="Kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: t("All", "Sab", "सभी") },
            { value: "product", label: t("Product", "Product", "प्रोडक्ट") },
            { value: "service", label: t("Service", "Service", "सर्विस") },
          ]}
        />
        <label className="input" style={{ flex: "1 1 220px", maxWidth: 360 }}>
          <Search size={15} />
          <input id="co-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Find a company", "Company dhoondho", "कंपनी खोजें")} />
        </label>
      </div>
      <div className="co-cloud">
        {list.map((c) => (
          <Link key={c.n} to="company" className={`co-chip ${c.reports < 5 ? "thin" : ""}`}>
            <span className="co-logo" style={{ background: c.c }}>
              {c.n[0]}
            </span>
            {c.n}
            <span className="n num">{c.reports}</span>
          </Link>
        ))}
      </div>
      <p className="faint" style={{ fontSize: "var(--fs-12)", display: "flex", gap: 6, alignItems: "center" }}>
        <Info size={13} /> {t("The number is verified interview reports. Faded chips have under 5 reports, so their pages show only rounds, not topic charts.", "Number = verified reports. Fike chips me 5 se kam, unke page par sirf rounds, topic chart nahi.", "5 से कम रिपोर्ट वाली कंपनियों में चार्ट नहीं।")}
      </p>
      <section className="stack">
        <div className="section-title">
          <h2>{t("Service company patterns", "Service company patterns", "सर्विस कंपनी पैटर्न")}</h2>
        </div>
        <div className="grid c3">
          {COMPANIES.filter((c) => c.kind === "service")
            .slice(0, 3)
            .map((c) => (
              <Link key={c.n} to="company" className="panel pad stack hover-card">
                <div className="row" style={{ gap: 10 }}>
                  <span className="co-logo" style={{ background: c.c }}>
                    {c.n[0]}
                  </span>
                  <b>{c.n}</b>
                </div>
                <span className="muted" style={{ fontSize: "var(--fs-13)" }}>
                  {t("Aptitude 60 min → coding 45 min → technical → HR", "Aptitude 60 min → coding 45 min → technical → HR", "एप्टीट्यूड → कोडिंग → तकनीकी → HR")}
                </span>
                <span className="faint" style={{ fontSize: "var(--fs-11)", display: "flex", gap: 6, alignItems: "center" }}>
                  <ShieldCheck size={12} /> {c.reports} {t("reports · last 2 Oct", "reports · aakhri 2 Oct", "रिपोर्ट")}
                </span>
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}

const TOPICS: [string, number][] = [
  ["Arrays & hashing", 34],
  ["Two pointers", 22],
  ["Trees", 18],
  ["Graphs", 14],
  ["Dynamic programming", 14],
  ["Sliding window", 12],
  ["Stacks", 9],
  ["SQL", 7],
];

export function CompanyBody() {
  const t = useT();
  const [tab, setTab] = useState<"over" | "probs" | "exp">("over");
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...TOPICS.map((x) => x[1]));
  return (
    <div className="page">
      <div className="co-hero panel">
        <span className="co-logo lg" style={{ background: "#16a34a" }}>
          N
        </span>
        <div className="grow stack sm">
          <div className="crumbs">
            <Link to="companies">{t("Companies", "Companies", "कंपनियाँ")}</Link> / Nimbu Labs
          </div>
          <h1 style={{ fontSize: "var(--fs-28)", fontWeight: 800 }}>Nimbu Labs</h1>
          <div className="row wrap muted" style={{ gap: 14, fontSize: "var(--fs-13)" }}>
            <span className="row" style={{ gap: 6 }}>
              <Building2 size={14} /> {t("Product · fintech", "Product · fintech", "प्रोडक्ट · फिनटेक")}
            </span>
            <span className="row" style={{ gap: 6 }}>
              <MapPin size={14} /> Bengaluru, Pune
            </span>
            <span className="row" style={{ gap: 6 }}>
              <Users size={14} /> {t("Hires freshers: SDE 1, SDE intern", "Freshers: SDE 1, intern", "फ़्रेशर: SDE 1")}
            </span>
          </div>
          <span className="source-line">
            <ShieldCheck size={13} /> {t("From 41 verified interview reports · latest 9 Oct 2026 · how we verify", "41 verified reports se · aakhri 9 Oct 2026 · kaise verify karte hain", "41 जाँची रिपोर्ट से")}
          </span>
        </div>
        <div className="co-ready">
          <Ring value={64} size={92} stroke={9} color="var(--plus)">
            <b className="num">64</b>
            <small>{t("ready", "taiyaar", "तैयार")}</small>
          </Ring>
          <span className="faint" style={{ fontSize: "var(--fs-11)", textAlign: "center" }}>
            {t("Your readiness for this company", "Is company ke liye taiyaari", "इस कंपनी के लिए तैयारी")}
          </span>
        </div>
      </div>
      <Tabs
        label="Company"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "over", label: t("Overview", "Overview", "सारांश") },
          { value: "probs", label: t("Problems (58)", "Problems (58)", "प्रश्न (58)") },
          { value: "exp", label: t("Experiences (41)", "Experiences (41)", "अनुभव (41)") },
        ]}
      />
      {tab === "over" && (
        <div className="stack lg">
          <section className="panel pad-lg stack">
            <b>{t("Rounds for SDE 1 (2026)", "SDE 1 ke rounds (2026)", "SDE 1 के राउंड")}</b>
            <div className="rounds">
              {[
                ["Online test", "90 min · 2 coding + 15 MCQ", "38/41"],
                ["Technical 1", "45 min · DSA, one problem live", "35/41"],
                ["Technical 2", "60 min · DSA + OOP or LLD", "29/41"],
                ["Hiring manager", "30 min · projects, why us", "24/41"],
              ].map(([n, d, c], i) => (
                <div key={n} className="round">
                  <span className="round-n">{i + 1}</span>
                  <b>{n}</b>
                  <span className="muted" style={{ fontSize: "var(--fs-12)" }}>
                    {d}
                  </span>
                  <span className="faint num" style={{ fontSize: "var(--fs-11)" }}>
                    {t("in", "", "")} {c} {t("reports", "reports me", "रिपोर्ट")}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <div className="grid c2">
            <section className="panel pad-lg stack">
              <div className="row between">
                <b>{t("Topics in coding rounds", "Coding rounds ke topics", "कोडिंग राउंड के विषय")}</b>
                <span className="faint" style={{ fontSize: "var(--fs-11)" }}>
                  % {t("of reports", "reports ka", "रिपोर्ट का")}
                </span>
              </div>
              <div className="topic-bars" role="list">
                {TOPICS.map(([n, v], i) => (
                  <div key={n} role="listitem" className={`topic-bar ${hover === i ? "on" : ""}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                    <span className="tb-name">{n}</span>
                    <span className="tb-track">
                      <i style={{ width: `${(v / max) * 100}%` }} />
                    </span>
                    <b className="num">{v}%</b>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel pad-lg stack">
              <b>{t("Your gaps for Nimbu Labs", "Nimbu Labs ke liye aapki kamiyan", "आपकी कमियाँ")}</b>
              {[
                ["Graphs", 0, 26],
                ["Dynamic programming", 1, 40],
                ["Sliding window", 5, 12],
              ].map(([n, d, tot]) => (
                <div key={n as string} className="weak-row" style={{ gridTemplateColumns: "minmax(0,1fr) 120px 50px" }}>
                  <span>{n}</span>
                  <Bar value={((d as number) / (tot as number)) * 100} tone="plus" thin />
                  <span>
                    {d}/{tot}
                  </span>
                </div>
              ))}
              <Link to="plan" className="btn primary sm" style={{ alignSelf: "flex-start" }}>
                {t("Add a 2-week Nimbu sprint to my plan", "Plan me 2 hafte ka Nimbu sprint jodo", "योजना में 2 हफ़्ते का स्प्रिंट")} <ArrowRight size={13} />
              </Link>
            </section>
          </div>
        </div>
      )}
      {tab === "probs" && (
        <div className="panel table-wrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>{t("Problem", "Problem", "प्रश्न")}</th>
                <th>{t("Level", "Level", "स्तर")}</th>
                <th>{t("How often", "Kitni baar", "कितनी बार")}</th>
                <th>{t("Last seen", "Aakhri baar", "आखिरी बार")}</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Pair with target sum", 2, "High", "Sep 2026"],
                ["Merge overlapping intervals", 4, "High", "Oct 2026"],
                ["Rotten oranges (BFS)", 3, "Medium", "Aug 2026"],
                ["Longest substring without repeats", 3, "Medium", "Jul 2026"],
                ["Coin change", 4, "Low", "Mar 2026"],
              ].map(([n, lv, f, d]) => (
                <tr key={n as string}>
                  <td>
                    <Link to="problem">{n}</Link>
                  </td>
                  <td>
                    <Level lv={lv as 2 | 3 | 4} />
                  </td>
                  <td>
                    <span className={`tag ${f === "High" ? "bad" : f === "Medium" ? "warn" : ""}`}>{f}</span>
                  </td>
                  <td className="muted">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "exp" && <ExperienceList compact />}
    </div>
  );
}

function ExperienceList({ compact }: { compact?: boolean }) {
  const t = useT();
  const items = [
    {
      title: "SDE 1 at Nimbu Labs: online test to offer",
      who: "Final-year student · Pune",
      when: "9 Oct 2026",
      result: "offer",
      rounds: ["OA", "Tech 1", "Tech 2", "HM"],
      body: "Two coding questions in the test: pair sum on a sorted array and merging intervals. Tech 1 was a BFS on a grid, and they cared about edge cases more than speed.",
      top: "The tip about saying your complexity before coding helped me a lot.",
      likes: 84,
      comments: 12,
      views: "2.1k",
    },
    {
      title: "Patang Tech intern: cleared the test, lost in round 2",
      who: "3rd year · Indore",
      when: "2 Oct 2026",
      result: "no",
      rounds: ["OA", "Tech 1", "Tech 2"],
      body: "Round 2 was an LLD of a parking lot. I jumped into classes without asking about the rules; the interviewer wanted questions first.",
      top: "",
      likes: 51,
      comments: 9,
      views: "1.4k",
    },
    {
      title: "Sitara Infotech: aptitude pattern and the coding round",
      who: "Graduate · Lucknow",
      when: "28 Sep 2026",
      result: "offer",
      rounds: ["Aptitude", "Coding", "Technical", "HR"],
      body: "Aptitude had 3 sections with negative marking. The coding round was two easy array questions; most people lost marks on input reading.",
      top: "Same pattern for us at another campus.",
      likes: 112,
      comments: 23,
      views: "4.8k",
    },
  ];
  return (
    <div className={compact ? "stack" : "exp-grid"}>
      {items.map((e) => (
        <article key={e.title} className="panel pad stack exp-card">
          <div className="row between wrap" style={{ gap: 8 }}>
            <b style={{ fontSize: "var(--fs-15, 0.95rem)" }}>{e.title}</b>
            {e.result === "offer" ? (
              <span className="tag ok">
                <CircleCheck size={12} /> {t("Offer", "Offer mila", "ऑफ़र")}
              </span>
            ) : (
              <span className="tag">
                <CircleX size={12} /> {t("No offer", "Offer nahi", "ऑफ़र नहीं")}
              </span>
            )}
          </div>
          <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
            {e.who} · {e.when}
          </span>
          <div className="row wrap" style={{ gap: 4 }}>
            {e.rounds.map((r, i) => (
              <span key={r} className="round-chip">
                {i + 1}. {r}
              </span>
            ))}
          </div>
          <p className="muted" style={{ fontSize: "var(--fs-13)" }}>
            {e.body}
          </p>
          {e.top && (
            <div className="top-comment">
              <span className="tag outline">{t("Most helpful reply", "Sabse kaam ka jawab", "सबसे उपयोगी")}</span>
              <span>{e.top}</span>
            </div>
          )}
          <div className="row faint" style={{ gap: 16, fontSize: "var(--fs-12)" }}>
            <span className="row" style={{ gap: 4 }}>
              <ThumbsUp size={13} /> {e.likes}
            </span>
            <span className="row" style={{ gap: 4 }}>
              <MessageSquare size={13} /> {e.comments}
            </span>
            <span className="row" style={{ gap: 4 }}>
              <Eye size={13} /> {e.views}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

export function ExperiencesBody() {
  const t = useT();
  return (
    <div className="page stagger">
      <PageHead
        title={t("Interview experiences", "Interview experiences", "इंटरव्यू अनुभव")}
        sub={t("Round by round, written by students and checked by moderators. Names can stay hidden.", "Round-wise, students ne likhe, moderators ne jaanche. Naam chhupa sakte ho.", "राउंड-वार, जाँचे हुए।")}
        actions={
          <button type="button" className="btn primary">
            <PenLine size={15} /> {t("Write yours", "Apna likho", "अपना लिखें")}
          </button>
        }
      />
      <div className="row wrap" style={{ gap: 8 }}>
        {[t("All companies", "Sab companies", "सभी"), t("Offer", "Offer", "ऑफ़र"), t("No offer", "Offer nahi", "ऑफ़र नहीं"), "2026", t("Service", "Service", "सर्विस"), t("Product", "Product", "प्रोडक्ट"), t("In Hindi", "Hindi me", "हिंदी में")].map((c, i) => (
          <button key={c} type="button" className={`chip ${i === 0 ? "on" : ""}`}>
            {c}
          </button>
        ))}
      </div>
      <ExperienceList />
      <SampleNote>{t("Experiences written for the mock", "Mock ke liye likhe experiences", "मॉक के लिए लिखे")}</SampleNote>
    </div>
  );
}
