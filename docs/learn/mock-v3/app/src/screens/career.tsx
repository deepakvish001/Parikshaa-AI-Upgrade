import { useState } from "react";
import {
  Search,
  ShieldCheck,
  Target,
  ArrowRight,
  Clock,
  ThumbsUp,
  CircleCheck,
  CircleX,
  BadgeCheck,
  Lock,
  QrCode,
  Copy,
  Download,
  Camera,
  Monitor,
  CalendarDays,
  Pencil,
  Eye,
  Briefcase,
  Send,
  FileText,
  Sparkles,
  Info,
} from "lucide-react";
import { Link, useT, useToast } from "../lib/core";
import { Badge, Level, Ring, Meter, Card, PageHead, Tabs, Stamp, SampleNote, PenNote, PenCircle, Seg, LogoMark, Moment } from "../ui/kit";

/* ---------------- companies ---------------- */

const COS = [
  { n: "Nimbu Labs", m: "NL", c: "#2346E8", type: "Product", roles: "SDE 1, SDE intern", rounds: "OA → 2 tech → HR", src: 14, ready: 58, pin: true },
  { n: "Patang Tech", m: "PT", c: "#15803D", type: "Product", roles: "SDE 1", rounds: "OA → 3 tech → HR", src: 9, ready: 41, pin: true },
  { n: "Kesar Cloud", m: "KC", c: "#A85A00", type: "Product", roles: "Backend SDE", rounds: "OA → system → tech → HR", src: 6, ready: 33, pin: false },
  { n: "Tara Fintech", m: "TF", c: "#6D4AFF", type: "Startup", roles: "Full-stack", rounds: "Take-home → 2 tech", src: 4, ready: 62, pin: true },
  { n: "Sitara Infotech", m: "SI", c: "#0E7490", type: "Service", roles: "Graduate engineer", rounds: "Aptitude → coding → HR", src: 22, ready: 74, pin: false },
  { n: "Bodhi Services", m: "BS", c: "#D93A2B", type: "Service", roles: "Systems engineer", rounds: "Aptitude → tech + HR", src: 17, ready: 69, pin: false },
  { n: "Megh Data", m: "MD", c: "#15161A", type: "Product", roles: "Data analyst", rounds: "SQL test → case → HR", src: 5, ready: 47, pin: false },
  { n: "Jugnu Apps", m: "JA", c: "#B45F00", type: "Startup", roles: "Mobile SDE", rounds: "Take-home → tech", src: 3, ready: 39, pin: false },
];

function Mono({ m, c, size = 40 }: { m: string; c: string; size?: number }) {
  return (
    <span className="co-mono" style={{ width: size, height: size, background: c, fontSize: size * 0.36 }}>
      {m}
    </span>
  );
}

export function CompaniesBody() {
  const t = useT();
  const [type, setType] = useState("all");
  const list = COS.filter((c) => type === "all" || c.type === type);
  return (
    <div className="col g20">
      <PageHead
        eyebrow={t("Companies", "Companies", "कंपनियाँ")}
        title={t("Prepare for the company, not just the topic.", "Topic nahi, company ke hisaab se taiyari.", "कंपनी के हिसाब से तैयारी।")}
        sub={t("Rounds, topics and problems from verified interview experiences. Every number links to where it came from.", "Verified interview experiences se rounds, topics aur problems. Har number ka source.", "सत्यापित अनुभवों से।")}
      />
      <div className="banner pen">
        <Info />
        <span className="small">{t("Company names in this mock are made up. Real company data appears only with a checked source.", "Is mock ke company naam banaye hue hain. Asli data sirf checked source ke saath.", "इस मॉक के नाम काल्पनिक हैं।")}</span>
      </div>
      <section className="col g10">
        <span className="eyebrow">{t("Your targets", "Aapke target", "आपके लक्ष्य")}</span>
        <div className="grid c3">
          {COS.filter((c) => c.pin).map((c) => (
            <Link key={c.n} to="company" className="card pad row g12 hov target-co">
              <Mono m={c.m} c={c.c} />
              <span className="grow" style={{ minWidth: 0 }}>
                <b className="h3">{c.n}</b>
                <span className="tiny faint" style={{ display: "block" }}>
                  {c.roles}
                </span>
              </span>
              <Ring v={c.ready} size={52} stroke={5} tone={c.ready > 55 ? "tick" : c.ready > 40 ? "pen" : "coin"}>
                <b className="tiny num">{c.ready}</b>
              </Ring>
            </Link>
          ))}
        </div>
      </section>
      <div className="row wrap between g12">
        <div className="input-ic" style={{ width: 320, maxWidth: "100%" }}>
          <Search />
          <input className="input" placeholder={t("Search companies or roles", "Company ya role khojo", "कंपनी खोजें")} />
        </div>
        <Seg
          value={type}
          onChange={setType}
          items={[
            { id: "all", label: t("All", "Sab", "सभी") },
            { id: "Product", label: t("Product", "Product", "प्रोडक्ट") },
            { id: "Service", label: t("Service", "Service", "सर्विस") },
            { id: "Startup", label: t("Startups", "Startups", "स्टार्टअप") },
          ]}
        />
      </div>
      <div className="co-grid">
        {list.map((c) => (
          <Link key={c.n} to="company" className="card hov co-card">
            <div className="row g12">
              <Mono m={c.m} c={c.c} size={44} />
              <span className="grow" style={{ minWidth: 0 }}>
                <b className="h3">{c.n}</b>
                <span className="tiny faint" style={{ display: "block" }}>
                  {c.type} · {c.roles}
                </span>
              </span>
            </div>
            <div className="co-rounds small">{c.rounds}</div>
            <div className="row between">
              <span className="tiny row g4 t-tick">
                <ShieldCheck style={{ width: 13, height: 13 }} />
                {c.src} {t("verified experiences", "verified experiences", "सत्यापित अनुभव")}
              </span>
              <span className="tiny faint">
                {t("Ready", "Ready", "तैयार")} <b className="num">{c.ready}%</b>
              </span>
            </div>
            <Meter v={c.ready} tone={c.ready > 55 ? "tick" : c.ready > 40 ? "pen" : "coin"} size="thin" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function CompanyBody() {
  const t = useT();
  const [tab, setTab] = useState("ov");
  const topics = [
    ["Arrays & strings", 28, 74],
    ["Graphs", 18, 31],
    ["Dynamic programming", 15, 22],
    ["Trees", 12, 55],
    ["OS & DBMS", 9, 48],
    ["Others", 18, 60],
  ];
  return (
    <div className="col g20">
      <section className="co-hero">
        <Mono m="NL" c="#2346E8" size={72} />
        <div className="col g6 grow" style={{ minWidth: 0 }}>
          <span className="eyebrow">{t("Product company · Bengaluru, remote", "Product company · Bengaluru, remote", "प्रोडक्ट कंपनी")}</span>
          <h1 className="h1">Nimbu Labs</h1>
          <div className="row wrap g8">
            <Badge>SDE 1</Badge>
            <Badge>SDE intern</Badge>
            <Badge tone="tick" icon={<ShieldCheck />}>
              {t("14 verified experiences · 2025–26", "14 verified experiences · 2025–26", "14 सत्यापित")}
            </Badge>
            <SampleNote />
          </div>
        </div>
        <div className="col g8" style={{ alignItems: "center" }}>
          <Ring v={58} size={96} stroke={9}>
            <span>
              <b className="display num" style={{ fontSize: 24 }}>
                58
              </b>
            </span>
          </Ring>
          <span className="tiny faint">{t("your readiness", "aapki readiness", "आपकी तैयारी")}</span>
        </div>
      </section>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "ov", label: t("Overview", "Overview", "सारांश") },
          { id: "q", label: t("Problems asked", "Pooche gaye problems", "पूछे गए प्रश्न"), count: 46 },
          { id: "exp", label: t("Experiences", "Experiences", "अनुभव"), count: 14 },
        ]}
      />
      {tab === "ov" ? (
        <>
          <Card title={t("Rounds", "Rounds", "राउंड")} icon={<Clock className="ic" />}>
            <div className="rounds">
              {[
                ["Online test", "90 min", "2 coding + 20 MCQ", "pen"],
                ["Technical 1", "60 min", "DSA, 2 problems", "ai"],
                ["Technical 2", "60 min", "DSA + OS / DBMS", "ai"],
                ["HR", "30 min", "Projects, fit", "tick"],
              ].map(([n, d, w, c], i) => (
                <div key={n} className="rnd-row">
                  <span className={`rn ${c}`}>{i + 1}</span>
                  <b className="small">{n}</b>
                  <span className="tiny faint">
                    {d} · {w}
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <div className="grid c2">
            <Card title={t("What they ask vs where you are", "Kya poochte hain vs aap kahan ho", "क्या पूछते हैं")} icon={<Target className="ic" />}>
              <div className="col g10">
                {topics.map(([n, share, me]) => (
                  <div key={n as string} className="topic-row">
                    <span className="small grow">{n}</span>
                    <span className="tiny faint num" style={{ width: 40 }}>
                      {share}%
                    </span>
                    <div className="tw">
                      <Meter v={me as number} tone={(me as number) > 55 ? "tick" : (me as number) > 35 ? "coin" : "red"} />
                    </div>
                  </div>
                ))}
                <span className="tiny faint">{t("Left: share of questions in verified experiences. Bar: your level.", "Baayein: verified experiences me hissa. Bar: aapka level.", "बाएँ: प्रश्नों का हिस्सा।")}</span>
              </div>
            </Card>
            <Card title={t("Your plan for Nimbu Labs", "Nimbu Labs ke liye plan", "योजना")} icon={<Sparkles className="ic" />}>
              <div className="col g10">
                <p className="small muted">{t("Adds 3 graph and 4 DP problems a week to your plan, plus two OA-style mocks before 1 December.", "Plan me har hafte 3 graph aur 4 DP problems, aur 1 December se pehle 2 OA-style mocks.", "हर सप्ताह 3 ग्राफ़ और 4 DP।")}</p>
                <button className="btn pri">
                  <Target />
                  {t("Add to my plan", "Plan me jodo", "योजना में जोड़ें")}
                </button>
                <div className="tiny faint">{t("Sources: 14 experiences (offer letters checked for 9), 2 public job posts.", "Source: 14 experiences (9 ke offer letter jaanche), 2 public job posts.", "स्रोत: 14 अनुभव।")}</div>
              </div>
            </Card>
          </div>
        </>
      ) : tab === "q" ? (
        <Card pad={false}>
          <div className="tbl-wrap" tabIndex={0}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("Problem", "Problem", "प्रश्न")}</th>
                  <th>{t("Level", "Level", "स्तर")}</th>
                  <th className="r">{t("Times asked", "Kitni baar", "कितनी बार")}</th>
                  <th>{t("Round", "Round", "राउंड")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Pair with target sum", 2, 6, "OA", "tried"],
                  ["Rotting oranges (BFS)", 3, 5, "Tech 1", "todo"],
                  ["Longest increasing subsequence", 4, 4, "Tech 2", "todo"],
                  ["Top view of a binary tree", 3, 3, "Tech 1", "done"],
                ].map(([n, l, x, r, s]) => (
                  <tr key={n as string}>
                    <td>
                      <span className="row g8">
                        {s === "done" ? <CircleCheck style={{ width: 16, height: 16, color: "var(--tick)" }} /> : s === "tried" ? <CircleX style={{ width: 16, height: 16, color: "var(--coin)" }} /> : <span style={{ width: 16 }} />}
                        <Link to="problem" className="p-link">
                          {n as string}
                        </Link>
                      </span>
                    </td>
                    <td>
                      <Level n={l as 2} />
                    </td>
                    <td className="r num">{x as number}×</td>
                    <td>{r as string}</td>
                    <td className="r">
                      <Link to="problem" className="btn sm">
                        {t("Solve", "Solve", "हल")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <ExperienceList compact />
      )}
    </div>
  );
}

function ExperienceList({ compact }: { compact?: boolean }) {
  const t = useT();
  const items = [
    { co: "Nimbu Labs", m: "NL", c: "#2346E8", role: "SDE 1 · on campus · Sep 2026", res: "sel", ver: true, rounds: [["OA", 2], ["Tech 1", 3], ["Tech 2", 4], ["HR", 1]], q: "OA had a two-pointer question with big numbers; overflow caught many. Tech 2 asked deadlocks and a graph BFS.", likes: 42 },
    { co: "Patang Tech", m: "PT", c: "#15803D", role: "SDE intern · off campus · Aug 2026", res: "rej", ver: true, rounds: [["OA", 3], ["Tech 1", 4]], q: "Tech 1 was a DP on grids. I explained brute force well but ran out of time on memoisation.", likes: 27 },
    { co: "Sitara Infotech", m: "SI", c: "#0E7490", role: "Graduate engineer · Jul 2026", res: "sel", ver: false, rounds: [["Aptitude", 2], ["Coding", 2], ["HR", 1]], q: "Aptitude: time and work, percentages, seating. Coding: string reversal and a simple SQL join.", likes: 61 },
  ];
  return (
    <div className="col g12">
      {items.slice(0, compact ? 2 : 3).map((x) => (
        <article key={x.co + x.role} className="card exp">
          <div className="row g12">
            <Mono m={x.m} c={x.c} size={40} />
            <span className="grow" style={{ minWidth: 0 }}>
              <b className="h3">{x.co}</b>
              <span className="tiny faint" style={{ display: "block" }}>
                {x.role}
              </span>
            </span>
            <Badge tone={x.res === "sel" ? "tick" : "red"}>{x.res === "sel" ? t("Selected", "Selected", "चयनित") : t("Not selected", "Select nahi", "चयन नहीं")}</Badge>
          </div>
          <div className="exp-rounds">
            {x.rounds.map(([r, d]) => (
              <span key={r as string} className="exp-r">
                {r}
                <i className="dots">
                  {[1, 2, 3, 4, 5].map((k) => (
                    <b key={k} className={k <= (d as number) ? "on" : ""} />
                  ))}
                </i>
              </span>
            ))}
          </div>
          <p className="small">{x.q}</p>
          <div className="row between">
            {x.ver ? (
              <span className="tiny t-tick row g4">
                <ShieldCheck style={{ width: 13, height: 13 }} />
                {t("Verified: offer or interview mail checked", "Verified: offer ya interview mail jaancha", "सत्यापित")}
              </span>
            ) : (
              <span className="tiny faint row g4">
                <Info style={{ width: 13, height: 13 }} />
                {t("Not verified yet", "Abhi verify nahi", "अभी सत्यापित नहीं")}
              </span>
            )}
            <button className="btn sm ghost">
              <ThumbsUp />
              {x.likes}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function ExperiencesBody() {
  const t = useT();
  return (
    <div className="col g20">
      <PageHead
        eyebrow={t("Interview experiences", "Interview experiences", "इंटरव्यू अनुभव")}
        title={t("What really happened in the room.", "Room me sach me kya hua.", "कमरे में सच में क्या हुआ।")}
        sub={t("Written by students, round by round. Verified ones had an offer or interview mail checked by our team.", "Students ne round-dar-round likha. Verified walon ka offer ya mail hamari team ne jaancha.", "छात्रों द्वारा लिखे गए।")}
        actions={
          <button className="btn pri">
            <Pencil />
            {t("Write yours · +50 coins", "Apna likho · +50 coins", "अपना लिखें · +50")}
          </button>
        }
      />
      <div className="row wrap g6">
        {[t("All", "Sab", "सभी"), "Nimbu Labs", "Patang Tech", "Sitara Infotech", t("Selected", "Selected", "चयनित"), t("2026", "2026", "2026"), t("Verified only", "Sirf verified", "केवल सत्यापित")].map((x, i) => (
          <button key={x} className="chip" aria-pressed={i === 0}>
            {x}
          </button>
        ))}
      </div>
      <ExperienceList />
      <SampleNote>{t("Sample experiences written for this mock", "Is mock ke liye likhe sample experiences", "नमूना अनुभव")}</SampleNote>
    </div>
  );
}

/* ---------------- pramaan ---------------- */

const CERTS = [
  { n: "DSA", l: "L1", s: "pass", score: 82, d: "60 min", by: "Problems" },
  { n: "DSA", l: "L2", s: "pass", score: 78, d: "90 min", by: "Problems" },
  { n: "SQL", l: "L1", s: "pass", score: 84, d: "45 min", by: "Queries" },
  { n: "Operating systems", l: "L1", s: "lock", d: "40 min", by: "MCQ + short" },
  { n: "Full-stack", l: "L1", s: "open", d: "Project + 30 min viva", by: "Project" },
  { n: "Aptitude", l: "L1", s: "open", d: "60 min", by: "MCQ" },
];

export function PramaanBody() {
  const t = useT();
  return (
    <div className="col g20">
      <section className="pramaan-hero paper-grid">
        <div className="col g10" style={{ minWidth: 0 }}>
          <span className="eyebrow">Pramaan</span>
          <h1 className="display" style={{ fontSize: 46, lineHeight: 1 }}>
            {t("Proof, not claims.", "Saboot, daave nahi.", "प्रमाण, दावे नहीं।")}
          </h1>
          <p className="muted" style={{ maxWidth: "54ch" }}>
            {t("Proctored skill tests with a certificate anyone can check by QR. Flags go to a person, never to an automatic fail.", "Proctored skill tests; certificate QR se koi bhi jaanch sake. Flag hone par insaan dekhta hai, auto-fail nahi.", "निगरानी वाले टेस्ट, QR से जाँच।")}
          </p>
          <div className="pr-steps">
            {[
              [t("Prepare", "Taiyari", "तैयारी"), t("course + mock", "course + mock", "कोर्स + मॉक")],
              [t("Book a slot", "Slot book", "स्लॉट"), t("any day, 8 am–10 pm", "roz 8–10", "रोज़")],
              [t("Take the test", "Test do", "टेस्ट दें"), t("camera + screen", "camera + screen", "कैमरा + स्क्रीन")],
              [t("Get the certificate", "Certificate lo", "प्रमाणपत्र"), t("QR + profile", "QR + profile", "QR + प्रोफ़ाइल")],
            ].map(([a, b], i) => (
              <div key={i} className="pr-step">
                <span className="num">{i + 1}</span>
                <b className="small">{a}</b>
                <span className="tiny faint">{b}</span>
              </div>
            ))}
          </div>
        </div>
        <Stamp top="PRAMAAN" mid="Verified" bottom="DSA · L2" />
      </section>
      <div className="cert-grid">
        {CERTS.map((c) => (
          <section key={c.n + c.l} className={`card cert-card ${c.s}`}>
            <div className="row between">
              <span className="cert-l">{c.l}</span>
              {c.s === "pass" ? (
                <Badge tone="tick" icon={<BadgeCheck />}>
                  {t("Passed", "Pass", "उत्तीर्ण")} · {c.score}
                </Badge>
              ) : c.s === "lock" ? (
                <Badge icon={<Lock />}>{t("Finish 80% of the course", "Course ka 80% karo", "कोर्स 80%")}</Badge>
              ) : (
                <Badge tone="pen">{t("Open", "Khula", "खुला")}</Badge>
              )}
            </div>
            <b className="display" style={{ fontSize: 22 }}>
              {c.n}
            </b>
            <div className="row wrap g10 tiny faint">
              <span className="row g4">
                <Clock style={{ width: 12, height: 12 }} />
                {c.d}
              </span>
              <span className="row g4">
                <Camera style={{ width: 12, height: 12 }} />
                <Monitor style={{ width: 12, height: 12 }} />
                {t("proctored", "proctored", "निगरानी")}
              </span>
              <span>{c.by}</span>
            </div>
            {c.s === "pass" ? (
              <Link to="certificate" className="btn sm">
                <Eye />
                {t("View certificate", "Certificate dekho", "प्रमाणपत्र देखें")}
              </Link>
            ) : c.s === "open" ? (
              <button className="btn sm pri">
                <CalendarDays />
                {t("Book a slot", "Slot book karo", "स्लॉट बुक करें")}
              </button>
            ) : (
              <Link to="course" className="btn sm ghost">
                {t("Continue the course", "Course jaari rakho", "कोर्स जारी रखें")}
                <ArrowRight />
              </Link>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

export function CertificateBody() {
  const t = useT();
  const toast = useToast();
  return (
    <div className="cert-page">
      <Moment
        tone="pen"
        title={t("You passed Pramaan DSA Level 2", "Pramaan DSA Level 2 pass!", "प्रमाण DSA लेवल 2 पास!")}
        note={t("A person checked the two flags from your test; both were fine. Your certificate is ready.", "Test ke do flag ek insaan ne dekhe; dono theek the. Certificate taiyaar hai.", "दो फ़्लैग एक व्यक्ति ने देखे; दोनों ठीक थे।")}
        stamp={{ top: "PRAMAAN", mid: "Pass", bottom: "DSA · L2" }}
      />
      <div className="cert-doc">
        <div className="cd-border">
          <div className="row between">
            <span className="logo" style={{ ["--ls" as string]: "30px" }}>
              <LogoMark size={30} decorative />
              <span className="logo-word" style={{ color: "#15161a" }}>
                parikshaa
              </span>
            </span>
            <span className="mono tiny" style={{ color: "#4b4d57" }}>
              PK-DSA2-7KQ2-91XA
            </span>
          </div>
          <span className="cd-eyebrow">Pramaan · {t("Certificate of skill", "Skill certificate", "कौशल प्रमाणपत्र")}</span>
          <span className="cd-small">{t("This certifies that", "Pramanit kiya jaata hai ki", "प्रमाणित किया जाता है कि")}</span>
          <b className="cd-name">Aarav Sharma</b>
          <span className="cd-small">{t("passed the proctored test in", "ne proctored test pass kiya", "ने उत्तीर्ण किया")}</span>
          <b className="cd-skill">Data Structures &amp; Algorithms · Level 2</b>
          <div className="cd-meta">
            <span>
              <i>{t("Score band", "Score band", "स्कोर")}</i>
              <b>75–84</b>
            </span>
            <span>
              <i>{t("Date", "Tareekh", "तारीख़")}</i>
              <b>20 Oct 2026</b>
            </span>
            <span>
              <i>{t("Proctoring", "Proctoring", "निगरानी")}</i>
              <b>{t("No flags", "Koi flag nahi", "कोई फ़्लैग नहीं")}</b>
            </span>
          </div>
          <div className="cd-foot">
            <div className="cd-sign">
              <span className="hand" style={{ fontSize: 22, color: "#1a39c4" }}>
                Parikshaa
              </span>
              <span className="cd-small">{t("Parikshaa Assessment Board", "Parikshaa Assessment Board", "मूल्यांकन बोर्ड")}</span>
            </div>
            <div className="cd-qr">
              <QrCode />
              <span className="mono">parikshaa.in/v/7KQ2-91XA</span>
            </div>
          </div>
          <div className="cd-stamp">
            <Stamp top="PRAMAAN" mid="Verified" bottom="DSA · L2" />
          </div>
        </div>
      </div>
      <aside className="col g12">
        <Card title={t("Share it", "Share karo", "साझा करें")}>
          <div className="col g8">
            <button className="btn block" onClick={() => toast(t("Opens LinkedIn's add-certification form", "LinkedIn ka form khulega", "LinkedIn खुलेगा"))}>
              <Briefcase />
              {t("Add to LinkedIn", "LinkedIn me jodo", "LinkedIn में जोड़ें")}
            </button>
            <button className="btn block" onClick={() => toast(t("Verify link copied", "Verify link copy hua", "लिंक कॉपी हुआ"))}>
              <Copy />
              {t("Copy verify link", "Verify link copy", "लिंक कॉपी")}
            </button>
            <button className="btn block" onClick={() => toast(t("PDF ready (in the real app)", "PDF taiyaar (asli app me)", "PDF तैयार"))}>
              <Download />
              PDF
            </button>
          </div>
        </Card>
        <Card title={t("What a recruiter sees", "Recruiter kya dekhta hai", "रिक्रूटर क्या देखता है")} icon={<Eye className="ic" />}>
          <div className="col g8 small">
            <span className="row g8 t-tick">
              <BadgeCheck style={{ width: 16, height: 16 }} />
              {t("Valid · issued 20 Oct 2026", "Valid · 20 Oct 2026", "मान्य")}
            </span>
            <span className="muted">{t("Identity checked by photo ID at start. Camera and screen recorded; reviewed by a person: no issues.", "Shuru me photo ID se pehchaan. Camera aur screen record; insaan ne dekha: koi dikkat nahi.", "पहचान जाँची गई।")}</span>
            <span className="tiny faint">{t("Learners can hide a certificate; it can't be edited.", "Learner certificate chhupa sakta hai; badal nahi sakta.", "छिपा सकते हैं, बदल नहीं।")}</span>
          </div>
        </Card>
      </aside>
    </div>
  );
}

/* ---------------- profile ---------------- */

/* ---------------- jobs ---------------- */

export function JobsBody() {
  const t = useT();
  const toast = useToast();
  const [tab, setTab] = useState("jobs");
  return (
    <div className="col g20">
      <PageHead
        eyebrow={t("Jobs & resume", "Jobs aur resume", "नौकरी और बायोडाटा")}
        title={t("Apply with what you've proved.", "Jo saabit kiya, usse apply karo.", "जो साबित किया, उससे आवेदन।")}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "jobs", label: t("Jobs", "Jobs", "नौकरियाँ"), count: 24 },
          { id: "apps", label: t("My applications", "Meri applications", "मेरे आवेदन"), count: 5 },
          { id: "resume", label: t("Resume check", "Resume check", "बायोडाटा जाँच") },
        ]}
      />
      {tab === "jobs" && (
        <div className="col g10">
          {[
            ["Nimbu Labs", "NL", "#2346E8", "SDE intern · summer 2027", "Bengaluru · ₹40–60k / month", 82, "8 Nov"],
            ["Tara Fintech", "TF", "#6D4AFF", "Full-stack intern", "Remote · ₹30–45k / month", 74, "15 Nov"],
            ["Sitara Infotech", "SI", "#0E7490", "Graduate engineer trainee 2027", "Pune · ₹4.5–6 LPA", 91, "30 Nov"],
          ].map(([co, m, c, role, where, match, dl]) => (
            <div key={co as string} className="card job">
              <Mono m={m as string} c={c as string} size={44} />
              <div className="grow col g4" style={{ minWidth: 0 }}>
                <b className="h3">{role as string}</b>
                <span className="small muted">
                  {co as string} · {where as string}
                </span>
                <span className="tiny faint">
                  {t("Apply by", "Last date", "अंतिम तिथि")} {dl as string} · <SampleNote />
                </span>
              </div>
              <div className="col g4" style={{ alignItems: "center" }}>
                <Ring v={match as number} size={52} stroke={5} tone={(match as number) > 80 ? "tick" : "pen"}>
                  <b className="tiny num">{match as number}%</b>
                </Ring>
                <span className="tiny faint">{t("match", "match", "मेल")}</span>
              </div>
              <button className="btn pri" onClick={() => toast(t("Applied with your Parikshaa profile", "Parikshaa profile se apply hua", "आवेदन हुआ"))}>
                <Send />
                {t("One-click apply", "Ek click apply", "एक क्लिक")}
              </button>
            </div>
          ))}
        </div>
      )}
      {tab === "apps" && (
        <div className="pipeline">
          {[
            [t("Applied", "Apply kiya", "आवेदन"), ["Patang Tech · SDE intern", "Megh Data · Analyst"]],
            [t("Online test", "Online test", "ऑनलाइन टेस्ट"), ["Nimbu Labs · SDE intern"]],
            [t("Interview", "Interview", "इंटरव्यू"), ["Tara Fintech · Full-stack"]],
            [t("Offer", "Offer", "ऑफ़र"), ["Sitara Infotech · GET"]],
          ].map(([h, items]) => (
            <div key={h as string} className="pipe-col">
              <div className="row between">
                <b className="small">{h as string}</b>
                <span className="tiny faint num">{(items as string[]).length}</span>
              </div>
              {(items as string[]).map((x) => (
                <div key={x} className="pipe-card">
                  <b className="small">{x.split(" · ")[1]}</b>
                  <span className="tiny faint">{x.split(" · ")[0]}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {tab === "resume" && (
        <div className="resume-check">
          <div className="resume-paper">
            <b className="rp-name">AARAV SHARMA</b>
            <span className="tiny">aarav@college.edu.in · +91 98765 43210 · Indore</span>
            <div className="rp-sec">
              <b>PROJECTS</b>
              <p>
                • Built a placement tracker web app using React.{" "}
                <span className="rp-mark">
                  <PenCircle>Worked on many features.</PenCircle>
                </span>
              </p>
              <PenNote className="rp-note">{t("Which ones? Add a number: users, speed, time saved.", "Kaunse? Number jodo: users, speed, samay.", "कौन-से? संख्या जोड़ें।")}</PenNote>
              <p>• Hostel Split: splits bills among roommates with fewest transfers.</p>
            </div>
            <div className="rp-sec">
              <b>SKILLS</b>
              <p>C++, Java, Python, React, SQL, Git, MS Office, Photoshop, Tally</p>
              <PenNote className="rp-note">{t("Cut the ones you can't defend in an interview.", "Jo interview me defend na kar sako, hatao.", "जिनका बचाव न कर सकें, हटाएँ।")}</PenNote>
            </div>
            <div className="rp-sec">
              <b>CERTIFICATIONS</b>
              <p>
                Pramaan DSA L2 · verify: parikshaa.in/v/7KQ2-91XA <span className="t-tick">✓</span>
              </p>
            </div>
          </div>
          <aside className="col g12">
            <section className="card pad col g10">
              <div className="row g12">
                <Ring v={72} size={72} stroke={7} tone="coin">
                  <b className="num">72</b>
                </Ring>
                <div>
                  <b>{t("Good, not great yet", "Accha, abhi behtareen nahi", "अच्छा")}</b>
                  <p className="tiny faint">{t("3 fixes would take it past 85", "3 sudhaar se 85 ke paar", "3 सुधार से 85+")}</p>
                </div>
              </div>
              {[
                ["red", t("Vague bullet: add a number", "Vague bullet: number jodo", "संख्या जोड़ें")],
                ["coin", t("Too many skills listed", "Bahut skills", "बहुत कौशल")],
                ["tick", t("Verified certificate linked", "Verified certificate link", "सत्यापित लिंक")],
                ["tick", t("One page", "Ek page", "एक पेज")],
              ].map(([c, x]) => (
                <div key={x} className="row g8 small">
                  {c === "tick" ? <CircleCheck style={{ width: 16, height: 16, color: "var(--tick)" }} /> : <CircleX style={{ width: 16, height: 16, color: `var(--${c})` }} />}
                  {x}
                </div>
              ))}
              <button className="btn ai">
                <Sparkles />
                {t("Rewrite the bullet with Sahayak", "Sahayak se bullet sudhaaro", "सहायक से सुधारें")}
              </button>
            </section>
            <button className="btn">
              <FileText />
              {t("Upload a new resume (PDF)", "Naya resume upload (PDF)", "नया बायोडाटा")}
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}

