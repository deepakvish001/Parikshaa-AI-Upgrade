import { useState } from "react";
import {
  Award,
  ShieldCheck,
  Clock,
  Lock,
  CircleCheck,
  ArrowRight,
  Share2,
  Download,
  Link2,
  MapPin,
  GraduationCap,
  Globe,
  Eye,
  ExternalLink,
  BriefcaseBusiness,
  FileText,
  Search,
  Sparkles,
  TriangleAlert,
  Rocket,
  CircleDot,
} from "lucide-react";
import { Link, useT, useToast } from "../lib/core";
import { Donut, Heatmap, LogoMark, Ring, SampleNote, Seg, Tabs } from "../ui/kit";
import { PageHead } from "../ui/shell";

export function PramaanBody() {
  const t = useT();
  const certs: [string, string, string, "earned" | "open" | "locked"][] = [
    ["Data Structures · Level 1", "45 min · 30 MCQ + 2 coding", "82 / 100 · 2 Sep", "earned"],
    ["Data Structures · Level 2", "60 min · 3 coding", t("Ready when you are", "Jab chaho", "जब चाहें"), "open"],
    ["SQL · Level 1", "40 min · 4 queries", t("Ready when you are", "Jab chaho", "जब चाहें"), "open"],
    ["Operating systems · Level 1", "45 min · 40 MCQ", t("Finish 60% of the course", "Course ka 60% poora karo", "कोर्स का 60%"), "locked"],
    ["Aptitude · Placement ready", "60 min · 3 sections", t("Ready when you are", "Jab chaho", "जब चाहें"), "open"],
    ["Web · React basics", "60 min · build a small UI", t("Finish the React lab", "React lab poora karo", "React लैब पूरा करें"), "locked"],
  ];
  return (
    <div className="page stagger">
      <PageHead
        title="Pramaan"
        sub={t(
          "Certificates that prove a skill, not attendance. Taken on the same proctored engine colleges use for exams, and verifiable by anyone with the QR.",
          "Certificate jo skill saabit kare, attendance nahi. Wahi proctored engine jo college exams me, aur QR se koi bhi verify kare.",
          "कौशल का प्रमाण, हाज़िरी नहीं।",
        )}
      />
      <div className="pramaan-how">
        {[
          [ShieldCheck, t("Proctored", "Proctored", "निगरानी में"), t("Camera, full screen and tab checks, explained before you start", "Camera, full screen, tab checks, shuru se pehle samjhaya", "कैमरा, पूरी स्क्रीन")],
          [CircleCheck, t("Graded by tests", "Tests se grade", "टेस्ट से अंक"), t("Coding answers run against hidden tests; no human guesswork", "Coding jawab hidden tests par chalte hain", "छिपे टेस्ट पर")],
          [Link2, t("Verifiable", "Verify ho sake", "जाँच योग्य"), t("A public page and QR show the score band and date", "Public page aur QR par score band aur date", "QR से जाँच")],
        ].map(([I, h, d]) => {
          const Icon = I as typeof ShieldCheck;
          return (
            <div key={h as string} className="how-step">
              <Icon size={20} />
              <b>{h as string}</b>
              <span className="muted" style={{ fontSize: "var(--fs-13)" }}>
                {d as string}
              </span>
            </div>
          );
        })}
      </div>
      <div className="grid c3">
        {certs.map(([n, f, s, st]) => (
          <div key={n} className={`panel pad stack cert-item ${st}`}>
            <div className="row between">
              <span className={`cert-badge ${st}`}>
                <Award size={20} />
              </span>
              {st === "earned" ? <span className="tag ok">{t("Earned", "Mila", "प्राप्त")}</span> : st === "locked" ? <Lock size={15} className="faint" /> : <span className="tag action">{t("Open", "Khula", "खुला")}</span>}
            </div>
            <b>{n}</b>
            <span className="muted" style={{ fontSize: "var(--fs-13)", display: "flex", gap: 6, alignItems: "center" }}>
              <Clock size={13} /> {f}
            </span>
            <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
              {s}
            </span>
            {st === "earned" ? (
              <Link to="certificate" className="btn secondary sm" style={{ alignSelf: "flex-start" }}>
                {t("View certificate", "Certificate dekho", "प्रमाणपत्र देखें")}
              </Link>
            ) : st === "open" ? (
              <Link to="contest-brief" className="btn primary sm" style={{ alignSelf: "flex-start" }}>
                {t("Book a slot", "Slot book karo", "स्लॉट बुक करें")} <ArrowRight size={13} />
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CertificateBody() {
  const t = useT();
  const toast = useToast();
  return (
    <div className="page stagger">
      <PageHead
        crumbs={[{ to: "pramaan", label: "Pramaan" }, { label: t("Certificate", "Certificate", "प्रमाणपत्र") }]}
        title={t("Your certificate", "Aapka certificate", "आपका प्रमाणपत्र")}
        actions={
          <>
            <button type="button" className="btn secondary" onClick={() => toast(t("Link copied", "Link copy hua", "लिंक कॉपी"))}>
              <Share2 size={15} /> {t("Copy verify link", "Verify link copy", "लिंक कॉपी करें")}
            </button>
            <button type="button" className="btn secondary">
              <Download size={15} /> PDF
            </button>
            <button type="button" className="btn primary">
              {t("Add to LinkedIn", "LinkedIn par jodo", "लिंक्डइन पर जोड़ें")}
            </button>
          </>
        }
      />
      <div className="cert-stage">
        <div className="certificate" role="img" aria-label="Certificate">
          <div className="cert-band" />
          <div className="cert-inner">
            <div className="row between">
              <span className="cert-brand">
                <LogoMark size={32} /> Parikshaa
              </span>
              <span className="cert-qr" aria-hidden="true" />
            </div>
            <span className="cert-kicker">PRAMAAN · {t("CERTIFICATE OF SKILL", "SKILL CERTIFICATE", "कौशल प्रमाणपत्र")}</span>
            <span className="cert-name">Aarav Sharma</span>
            <span className="cert-line">{t("has shown, in a proctored test, that they can", "ne proctored test me dikhaya ki wo", "ने निगरानी वाली परीक्षा में दिखाया")}</span>
            <span className="cert-skill">Data Structures · Level 1</span>
            <div className="cert-meta">
              <div>
                <span>{t("Score band", "Score band", "अंक बैंड")}</span>
                <b>80–89</b>
              </div>
              <div>
                <span>{t("Date", "Date", "तारीख")}</span>
                <b>2 Sep 2026</b>
              </div>
              <div>
                <span>{t("Proctoring", "Proctoring", "निगरानी")}</span>
                <b>{t("Clean", "Saaf", "साफ़")}</b>
              </div>
            </div>
            <span className="cert-id mono">PRM-7Q4K-22 · parikshaa.in/v/PRM-7Q4K-22</span>
          </div>
        </div>
        <aside className="stack">
          <div className="panel pad stack">
            <b>{t("What the verify page shows", "Verify page par kya dikhta hai", "जाँच पेज पर क्या")}</b>
            {[t("Name, skill and level", "Naam, skill, level", "नाम, कौशल"), t("Score band, not the exact score", "Score band, exact score nahi", "अंक बैंड"), t("Date and proctoring result", "Date aur proctoring", "तारीख"), t("The skills tested, as a list", "Kaunsi skills test hui", "कौन-से कौशल")].map((x) => (
              <span key={x} className="row" style={{ gap: 8, fontSize: "var(--fs-13)" }}>
                <CircleCheck size={14} style={{ color: "var(--ok)" }} /> {x}
              </span>
            ))}
          </div>
          <div className="panel pad stack">
            <b>{t("Next level", "Agla level", "अगला स्तर")}</b>
            <span className="muted" style={{ fontSize: "var(--fs-13)" }}>
              Data Structures · Level 2
            </span>
            <Link to="pramaan" className="btn secondary sm" style={{ alignSelf: "flex-start" }}>
              {t("See requirements", "Shartein dekho", "शर्तें देखें")}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function ProfileBody() {
  const t = useT();
  const [vis, setVis] = useState<"public" | "link" | "recruiters">("recruiters");
  return (
    <div className="page stagger">
      <section className="profile-head panel">
        <div className="profile-banner" aria-hidden="true" />
        <div className="profile-id">
          <span className="avatar lg">AS</span>
          <div className="grow stack sm">
            <div className="row wrap" style={{ gap: 8 }}>
              <h1 style={{ fontSize: "var(--fs-22)", fontWeight: 800 }}>Aarav Sharma</h1>
              <span className="tag plus">
                <Award size={11} /> 1 Pramaan
              </span>
            </div>
            <span className="muted">{t("Final-year B.Tech CSE · wants to build payment systems", "Final year B.Tech CSE · payment systems banana chahta hai", "अंतिम वर्ष बी.टेक")}</span>
            <div className="row wrap faint" style={{ gap: 14, fontSize: "var(--fs-12)" }}>
              <span className="row" style={{ gap: 4 }}>
                <MapPin size={13} /> Indore
              </span>
              <span className="row" style={{ gap: 4 }}>
                <GraduationCap size={13} /> [College] · 2027
              </span>
              <span className="row" style={{ gap: 4 }}>
                <Eye size={13} /> 214 {t("profile views", "profile views", "प्रोफ़ाइल देखी")}
              </span>
            </div>
          </div>
          <div className="stack sm" style={{ alignItems: "flex-end" }}>
            <Seg
              label="Who can see"
              value={vis}
              onChange={setVis}
              options={[
                { value: "public", label: <><Globe size={12} /> {t("Public", "Public", "सार्वजनिक")}</> },
                { value: "link", label: <><Link2 size={12} /> {t("Link", "Link", "लिंक")}</> },
                { value: "recruiters", label: <><BriefcaseBusiness size={12} /> {t("Recruiters", "Recruiters", "भर्तीकर्ता")}</> },
              ]}
            />
            <span className="faint" style={{ fontSize: "var(--fs-11)" }}>
              {t("Recruiters on Parikshaa Hire see it only after you apply", "Hire par recruiter tabhi dekhe jab aap apply karo", "आवेदन के बाद ही")}
            </span>
          </div>
        </div>
      </section>
      <div className="profile-grid">
        <div className="stack lg">
          <section className="panel pad-lg stack">
            <div className="row between">
              <b style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <ShieldCheck size={16} style={{ color: "var(--ok)" }} /> {t("Verified on Parikshaa", "Parikshaa par verified", "परीक्षा पर सत्यापित")}
              </b>
              <span className="faint" style={{ fontSize: "var(--fs-11)" }}>
                {t("from our judge and proctored tests", "hamare judge aur tests se", "हमारे जज से")}
              </span>
            </div>
            <div className="verified-grid">
              <div className="row" style={{ gap: 16 }}>
                <Donut
                  size={130}
                  parts={[
                    { value: 61, color: "var(--lv1)", label: "L1" },
                    { value: 80, color: "var(--lv2)", label: "L2" },
                    { value: 52, color: "var(--lv3)", label: "L3" },
                    { value: 16, color: "var(--lv4)", label: "L4" },
                    { value: 3, color: "var(--lv5)", label: "L5" },
                  ]}
                >
                  <b className="num">212</b>
                  <small>{t("solved", "hal", "हल")}</small>
                </Donut>
                <div className="stack sm" style={{ fontSize: "var(--fs-12)" }}>
                  {[
                    ["L1", 61, "var(--lv1)"],
                    ["L2", 80, "var(--lv2)"],
                    ["L3", 52, "var(--lv3)"],
                    ["L4", 16, "var(--lv4)"],
                    ["L5", 3, "var(--lv5)"],
                  ].map(([l, n, c]) => (
                    <span key={l as string} className="row" style={{ gap: 8 }}>
                      <i className="dot" style={{ color: c as string }} /> {l} <b className="num">{n}</b>
                    </span>
                  ))}
                </div>
              </div>
              <div className="stack sm">
                <div className="mini-stat">
                  <span>{t("Contest rating", "Contest rating", "रेटिंग")}</span>
                  <b>1,486</b>
                </div>
                <div className="mini-stat">
                  <span>{t("Best streak", "Best streak", "सबसे लंबी")}</span>
                  <b>31 {t("days", "din", "दिन")}</b>
                </div>
                <div className="mini-stat">
                  <span>Pramaan</span>
                  <b>DS · L1</b>
                </div>
              </div>
            </div>
            <div className="stack sm">
              <span className="eyebrow">{t("Last 6 months", "Pichhle 6 mahine", "पिछले 6 महीने")}</span>
              <Heatmap weeks={26} />
            </div>
          </section>
          <section className="panel pad-lg stack">
            <b style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Rocket size={16} /> {t("Shipped projects", "Ship kiye projects", "शिप किए प्रोजेक्ट")}
            </b>
            <div className="grid c2">
              {[
                ["Hostel expense splitter", "React · Node", "24/24 tests"],
                ["CPU scheduler simulator", "C++ · OS", "18/18 tests"],
              ].map(([n, s, tt]) => (
                <div key={n} className="proj-mini">
                  <b>{n}</b>
                  <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
                    {s}
                  </span>
                  <div className="row between">
                    <span className="tag ok">{tt}</span>
                    <a href="#profile" onClick={(e) => e.preventDefault()} className="row" style={{ gap: 4, fontSize: "var(--fs-12)" }}>
                      <ExternalLink size={12} /> {t("Live", "Live", "लाइव")}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="stack">
          <div className="panel pad stack">
            <b>{t("Skills", "Skills", "कौशल")}</b>
            <div className="row wrap" style={{ gap: 6 }}>
              {["C++", "Python", "SQL", "React", "Two pointers", "Binary search", "OS basics"].map((s) => (
                <span key={s} className="tag">
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div className="panel pad stack">
            <div className="row between">
              <b>{t("Self-declared", "Khud bataya", "स्वयं बताया")}</b>
              <span className="faint" style={{ fontSize: "var(--fs-11)" }}>
                {t("not checked by us", "humne nahi jaancha", "हमने नहीं जाँचा")}
              </span>
            </div>
            {[
              ["GitHub", "aarav-dev", t("synced via GitHub API", "GitHub API se sync", "GitHub API से")],
              ["LeetCode", "aarav_s", t("link only", "sirf link", "केवल लिंक")],
              ["LinkedIn", "aarav-sharma", t("link only", "sirf link", "केवल लिंक")],
            ].map(([n, h, s]) => (
              <div key={n} className="row between" style={{ fontSize: "var(--fs-13)" }}>
                <span>
                  <b>{n}</b> <span className="faint">{h}</span>
                </span>
                <span className="faint" style={{ fontSize: "var(--fs-11)" }}>
                  {s}
                </span>
              </div>
            ))}
          </div>
          <div className="panel pad stack">
            <b>{t("Education", "Padhai", "शिक्षा")}</b>
            <span style={{ fontSize: "var(--fs-13)" }}>B.Tech CSE · 2023–2027</span>
            <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
              CGPA 8.1 · {t("self-declared", "khud bataya", "स्वयं")}
            </span>
          </div>
        </aside>
      </div>
      <SampleNote />
    </div>
  );
}

export function JobsBody() {
  const t = useT();
  const [tab, setTab] = useState<"jobs" | "resume" | "apps">("jobs");
  return (
    <div className="page stagger">
      <PageHead
        title={t("Jobs and resume", "Jobs aur resume", "नौकरी और बायोडाटा")}
        sub={t("Jobs come from companies hiring on Parikshaa Hire. Apply with your profile; you see every stage.", "Jobs Parikshaa Hire par hire karne wali companies se. Profile se apply karo; har stage dikhega.", "हर चरण दिखेगा।")}
      />
      <Tabs
        label="Career"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "jobs", label: t("Jobs", "Jobs", "नौकरियाँ"), icon: <BriefcaseBusiness size={14} /> },
          { value: "apps", label: t("My applications (3)", "Meri applications (3)", "मेरे आवेदन (3)"), icon: <CircleDot size={14} /> },
          { value: "resume", label: t("Resume check", "Resume check", "बायोडाटा जाँच"), icon: <FileText size={14} /> },
        ]}
      />
      {tab === "jobs" && (
        <div className="stack">
          <div className="row wrap" style={{ gap: 8 }}>
            <label className="input" style={{ flex: "1 1 240px", maxWidth: 360 }}>
              <Search size={15} />
              <input id="job-q" placeholder={t("Role, skill or company", "Role, skill ya company", "भूमिका, कौशल")} />
            </label>
            {[t("Fresher", "Fresher", "फ़्रेशर"), t("Internship", "Internship", "इंटर्नशिप"), t("Remote", "Remote", "रिमोट"), "Indore", "Bengaluru"].map((c, i) => (
              <button key={c} type="button" className={`chip ${i === 0 ? "on" : ""}`}>
                {c}
              </button>
            ))}
          </div>
          <div className="panel list">
            {[
              ["Nimbu Labs", "#16a34a", "SDE 1 · payments", "Bengaluru · ₹12–16 LPA", 82, t("Pair sum, intervals, BFS asked before", "Pehle pair sum, intervals, BFS poochhe", "पहले पूछे गए")],
              ["Patang Tech", "#2563eb", "SDE intern · 6 months", "Remote · ₹40k/month", 74, t("Needs React basics", "React basics chahiye", "React चाहिए")],
              ["Sitara Infotech", "#4f46e5", "Graduate engineer trainee", "Pune, Indore · ₹4.5 LPA", 91, t("Aptitude pattern A", "Aptitude pattern A", "एप्टीट्यूड पैटर्न A")],
            ].map(([co, c, role, meta, m, why]) => (
              <div key={role as string} className="list-row job-row">
                <span className="co-logo" style={{ background: c as string }}>
                  {(co as string)[0]}
                </span>
                <span className="t">
                  {role}
                  <small>
                    {co} · {meta}
                  </small>
                </span>
                <span className="job-match">
                  <Ring value={m as number} size={40} stroke={4} color={(m as number) > 85 ? "var(--ok)" : "var(--action-solid)"}>
                    <b style={{ fontSize: 10 }} className="num">
                      {m}
                    </b>
                  </Ring>
                  <small className="faint hide-phone">{why}</small>
                </span>
                <button type="button" className="btn primary sm">
                  {t("Apply", "Apply", "आवेदन")}
                </button>
              </div>
            ))}
          </div>
          <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
            {t("Match = how many of the job's listed skills you have proven on Parikshaa. It is not a prediction.", "Match = job ki kitni skills aapne Parikshaa par saabit ki. Bhavishyavani nahi.", "मैच = कितने कौशल सिद्ध किए।")}
          </span>
        </div>
      )}
      {tab === "apps" && (
        <div className="panel list">
          {[
            ["SDE 1 · Nimbu Labs", 2, t("Online test on 28 Oct", "28 Oct ko online test", "28 अक्टू को टेस्ट")],
            ["GET · Sitara Infotech", 3, t("Interview booked: 30 Oct, 11 AM", "Interview: 30 Oct, 11 AM", "इंटरव्यू 30 अक्टू")],
            ["Intern · Kesar Cloud", 1, t("Not selected · feedback shared", "Select nahi · feedback mila", "चयन नहीं")],
          ].map(([n, s, note]) => (
            <div key={n as string} className="list-row" style={{ flexWrap: "wrap" }}>
              <span className="t">
                {n}
                <small>{note}</small>
              </span>
              <div className="stages">
                {[t("Applied", "Apply", "आवेदन"), t("Test", "Test", "टेस्ट"), t("Interview", "Interview", "इंटरव्यू"), t("Offer", "Offer", "ऑफ़र")].map((st, i) => (
                  <span key={st} className={i < (s as number) ? "done" : i === (s as number) ? "now" : ""}>
                    {st}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === "resume" && (
        <div className="resume-grid">
          <div className="resume-paper" aria-label="Resume preview">
            <b style={{ fontSize: "var(--fs-18)" }}>Aarav Sharma</b>
            <span className="faint" style={{ fontSize: "var(--fs-11)" }}>
              aarav@college.edu.in · github.com/aarav-dev · Indore
            </span>
            <span className="rs-h">{t("Projects", "Projects", "प्रोजेक्ट")}</span>
            <p className="rs-line">
              <b>Hostel expense splitter</b> — {t("React app used by 4 hostel blocks; settles a room in the fewest payments.", "4 hostel blocks use karte hain; kam se kam payments me hisaab.", "4 ब्लॉक उपयोग करते हैं।")}
            </p>
            <p className="rs-line warn">
              <b>CPU scheduler simulator</b> — {t("Worked on scheduling algorithms.", "Scheduling algorithms par kaam kiya.", "शेड्यूलिंग पर काम।")}
            </p>
            <span className="rs-h">{t("Achievements", "Uplabdhiyan", "उपलब्धियाँ")}</span>
            <p className="rs-line">Pramaan · Data Structures L1 (80–89) · {t("contest rating 1,486", "contest rating 1,486", "रेटिंग 1,486")}</p>
          </div>
          <div className="stack">
            <div className="panel pad row" style={{ gap: 16 }}>
              <Ring value={71} size={80} stroke={8} color="var(--warn)">
                <b className="num">71</b>
              </Ring>
              <div className="stack sm">
                <b>{t("Readable by hiring software", "Hiring software padh sakta hai", "भर्ती सॉफ़्टवेयर पढ़ सकता है")}</b>
                <span className="muted" style={{ fontSize: "var(--fs-13)" }}>
                  {t("3 fixes would bring it above 85.", "3 sudhaar se 85 ke upar.", "3 सुधार से 85 से ऊपर।")}
                </span>
              </div>
            </div>
            {[
              [t("Bullet 2 has no result or number", "Bullet 2 me koi nateeja ya number nahi", "बुलेट 2 में संख्या नहीं"), t("Say what it does and how well: \"Simulates FCFS, SJF and RR; draws the timeline for 1,000 processes in 0.2 s.\"", "Kya karta hai aur kitna achha: \"FCFS, SJF, RR simulate; 1,000 processes ki timeline 0.2 s me.\"", "क्या करता है, कितना अच्छा।")],
              [t("Skills section is missing", "Skills section nahi hai", "कौशल अनुभाग नहीं"), t("Add the skills your Pramaan and projects prove: C++, SQL, React.", "Wo skills jodo jo Pramaan aur projects saabit karte hain.", "सिद्ध कौशल जोड़ें।")],
              [t("Two-column layout", "Do column layout", "दो कॉलम"), t("Some hiring software reads columns out of order. Use one column.", "Kuch software columns ulte padhte hain. Ek column rakho.", "एक कॉलम रखें।")],
            ].map(([h, d], i) => (
              <div key={i} className="callout warn">
                <h3>
                  <TriangleAlert size={15} /> {h}
                </h3>
                <p>{d}</p>
                {i === 0 && (
                  <button type="button" className="btn secondary sm" style={{ alignSelf: "flex-start" }}>
                    <Sparkles size={13} /> {t("Rewrite with Sahayak (you approve)", "Sahayak se dobara likho (aap manzoor karo)", "सहायक से लिखें")}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
