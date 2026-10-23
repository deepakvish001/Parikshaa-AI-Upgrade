import { useState } from "react";
import {
  BadgeCheck,
  Briefcase,
  Building2,
  CircleCheck,
  Circle,
  Code2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  GitBranch,
  GraduationCap,
  Link2,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Rocket,
  Share2,
  ShieldCheck,
  Trophy,
  ExternalLink,
  Info,
  Send,
  Database,
  Brain,
  Calculator,
  Layers,
} from "lucide-react";
import { Link, useT, useToast } from "../lib/core";
import { useVariant, VariantBar } from "../lib/variant";
import { ProofSheet, ProofStory } from "./profile43";
import { Avatar, Badge, Card, Donut, Heatmap, LogoMark, Meter, Modal, Moment, SampleNote, Seg, Spark, Tabs, Toggle } from "../ui/kit";

/* Sample learner. Everything a recruiter sees is either checked by Parikshaa (verified) or marked as the
   learner's own claim; numbers from other sites carry how they were checked and when. */

type Plat = { id: string; name: string; handle: string; solved: number; extra: string; how: string; synced: string; c: string; icon: typeof Code2 };
export const PLATS: Plat[] = [
  { id: "pk", name: "Parikshaa", handle: "aarav", solved: 212, extra: "rating 1,529 · top 18%", how: "judge", synced: "live", c: "var(--pen)", icon: ShieldCheck },
  { id: "lc", name: "LeetCode", handle: "aarav_s", solved: 318, extra: "contest 1,642", how: "code in bio", synced: "2 h", c: "var(--coin)", icon: Code2 },
  { id: "cf", name: "Codeforces", handle: "aarav.sh", solved: 96, extra: "rating 1,388 · Specialist", how: "official API", synced: "1 h", c: "var(--ai)", icon: Trophy },
  { id: "cc", name: "CodeChef", handle: "aarav27", solved: 14, extra: "2★", how: "code in bio", synced: "1 d", c: "var(--tick)", icon: Layers },
  { id: "gh", name: "GitHub", handle: "aarav-sharma", solved: 0, extra: "14 repos · 312 contributions this year", how: "sign-in (OAuth)", synced: "3 h", c: "var(--ink-3)", icon: GitBranch },
  { id: "kg", name: "Kaggle", handle: "aaravsharma", solved: 0, extra: "2 notebooks · 1 bronze", how: "profile link", synced: "5 d", c: "var(--teal)", icon: Brain },
];

export const SKILLS: { name: string; icon: typeof Code2; lvl: number; proof: [string, string, string]; v: boolean }[] = [
  { name: "DSA", icon: Code2, lvl: 72, v: true, proof: ["Pramaan L2 (proctored) · 212 solved on the judge", "Pramaan L2 (proctored) · judge par 212 solve", "प्रमाण L2 · 212 हल"] },
  { name: "SQL", icon: Database, lvl: 58, v: true, proof: ["Pramaan L1 · 41 SQL problems", "Pramaan L1 · 41 SQL problems", "प्रमाण L1 · 41 SQL"] },
  { name: "React", icon: Layers, lvl: 54, v: true, proof: ["Placement Tracker shipped · 18/18 tests · mentor reviewed", "Placement Tracker ship · 18/18 tests · mentor review", "प्रोजेक्ट · 18/18 टेस्ट"] },
  { name: "Aptitude", icon: Calculator, lvl: 78, v: true, proof: ["Mock test: 78th percentile (3 mocks)", "Mock test: 78th percentile (3 mocks)", "मॉक: 78वाँ पर्सेंटाइल"] },
  { name: "Machine learning", icon: Brain, lvl: 30, v: false, proof: ["Self-declared · 1 notebook in progress", "Khud bataya · 1 notebook chal rahi", "स्व-घोषित"] },
];

function Strength() {
  const t = useT();
  return (
    <div className="pf-strength">
      <div className="row between">
        <span className="small">
          <b>82%</b> {t("profile strength", "profile ki mazbooti", "प्रोफ़ाइल मज़बूती")}
        </span>
        <span className="tiny faint">{t("add a resume for 100%", "100% ke liye resume jodo", "रिज़्यूमे जोड़ें")}</span>
      </div>
      <Meter v={82} tone="tick" size="thin" />
    </div>
  );
}

/** The card a learner downloads and posts, or sends to HR. Brand colours are fixed so it looks the same everywhere. */
export function ProfileCard({ format = "wide" }: { format?: "wide" | "square" | "story" }) {
  return (
    <div className={`pcard pcard-${format}`} aria-label="Profile card preview">
      <div className="pc-top">
        <LogoMark size={26} decorative />
        <span className="pc-brand">parikshaa</span>
        <span className="pc-ver">
          <BadgeCheck /> verified profile
        </span>
      </div>
      <div className="pc-id">
        <Avatar name="Aarav Sharma" size={format === "story" ? 84 : 64} tone={0} />
        <div>
          <div className="pc-name">Aarav Sharma</div>
          <div className="pc-sub">B.Tech CSE · 2027 · Indore</div>
          <div className="pc-head">SDE intern 2027 · DSA · SQL · React</div>
        </div>
      </div>
      <div className="pc-stats">
        {[
          ["212", "solved here"],
          ["640", "across 4 sites"],
          ["1,529", "contest rating"],
          ["3", "certificates"],
        ].map(([v, k]) => (
          <div key={k}>
            <b>{v}</b>
            <span>{k}</span>
          </div>
        ))}
      </div>
      <div className="pc-foot">
        <span className="pc-badges">
          {["DSA L2", "SQL L1", "Aptitude 78%ile"].map((b) => (
            <span key={b}>
              <BadgeCheck /> {b}
            </span>
          ))}
        </span>
        <span className="pc-qr">
          <QrCode />
          <span>parikshaa.in/u/aarav</span>
        </span>
      </div>
    </div>
  );
}

export function ShareModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const [mode, setMode] = useState<"public" | "private">("private");
  const [show, setShow] = useState<Record<string, boolean>>({ email: true, phone: false, cgpa: true, rating: true, plats: true, projects: true, activity: true });
  const [made, setMade] = useState(false);
  const copy = (s: string) => {
    navigator.clipboard?.writeText(s).catch(() => {});
    toast(t("Link copied", "Link copy hua", "लिंक कॉपी हुआ"));
  };
  const link = mode === "public" ? "parikshaa.in/u/aarav" : made ? "parikshaa.in/s/7KQ2-nimbu" : "";
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<Share2 className="pf-modal-ic" />}
      title={t("Share your profile with HR", "HR ke saath profile share karo", "HR के साथ प्रोफ़ाइल साझा करें")}
      sub={t("Every company view is logged. Turn a link off any time.", "Har company ka dekhna log hota hai. Link kabhi bhi band karo.", "हर दृश्य दर्ज होता है।")}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            {t("Done", "Ho gaya", "हो गया")}
          </button>
        </>
      }
    >
      <div className="pf-share">
        <Seg
          value={mode}
          onChange={setMode}
          items={[
            { id: "private", label: t("Link for one company", "Ek company ke liye link", "एक कंपनी के लिए") },
            { id: "public", label: t("Public link", "Public link", "सार्वजनिक लिंक") },
          ]}
        />
        {mode === "private" ? (
          <div className="pf-make">
            <label className="field">
              <span className="tiny faint">{t("Company or recruiter", "Company ya recruiter", "कंपनी या रिक्रूटर")}</span>
              <input className="input" defaultValue="Nimbu Labs · HR (Priya)" />
            </label>
            <label className="field">
              <span className="tiny faint">{t("Link stops working after", "Link kab tak chalega", "लिंक कब तक")}</span>
              <select className="input" defaultValue="14">
                <option value="7">7 {t("days", "din", "दिन")}</option>
                <option value="14">14 {t("days", "din", "दिन")}</option>
                <option value="30">30 {t("days", "din", "दिन")}</option>
              </select>
            </label>
            <button className="btn pri" onClick={() => setMade(true)}>
              <Link2 /> {made ? t("Link ready", "Link taiyaar", "लिंक तैयार") : t("Make link", "Link banao", "लिंक बनाएँ")}
            </button>
          </div>
        ) : (
          <p className="small muted">{t("Anyone with this link sees what you allow below. Search engines do not list it.", "Is link wala koi bhi wahi dekhega jo neeche chuna. Google par nahi aata.", "नीचे चुनी चीज़ें दिखेंगी।")}</p>
        )}
        {link && (
          <div className="pf-link">
            <Link2 />
            <span className="mono grow ellipsis">{link}</span>
            <button className="btn sm" onClick={() => copy(`https://${link}`)}>
              <Copy /> {t("Copy", "Copy", "कॉपी")}
            </button>
          </div>
        )}
        <div className="pf-allow">
          <span className="eyebrow">{t("What HR can see", "HR kya dekh sakta hai", "HR क्या देखे")}</span>
          {(
            [
              ["email", t("Email", "Email", "ईमेल")],
              ["phone", t("Phone number", "Phone number", "फ़ोन")],
              ["cgpa", "CGPA"],
              ["rating", t("Contest rating", "Contest rating", "रेटिंग")],
              ["plats", t("Other coding sites", "Doosri coding sites", "अन्य साइटें")],
              ["projects", t("Projects and code", "Projects aur code", "प्रोजेक्ट")],
              ["activity", t("Practice heatmap", "Practice heatmap", "अभ्यास")],
            ] as [string, string][]
          ).map(([k, l]) => (
            <div key={k} className="pf-allow-row">
              {show[k] ? <Eye /> : <EyeOff />}
              <span className="grow">{l}</span>
              <Toggle on={show[k]} onChange={(v) => setShow({ ...show, [k]: v })} label={l} />
            </div>
          ))}
          <span className="tiny faint">{t("Certificates and verified skills are always shown; they are the point of the link.", "Certificates aur verified skills hamesha dikhte hain; link ka matlab wahi hai.", "प्रमाणपत्र हमेशा दिखते हैं।")}</span>
        </div>
        <div className="pf-chan">
          {[
            [<MessageCircle key="w" />, "WhatsApp"],
            [<Send key="l" />, "LinkedIn"],
            [<Mail key="m" />, "Email"],
            [<QrCode key="q" />, "QR"],
            [<FileText key="p" />, t("Resume PDF", "Resume PDF", "रिज़्यूमे PDF")],
          ].map(([ic, l]) => (
            <button key={l as string} className="pf-ch" onClick={() => toast(t(`${l}: opens with your link`, `${l}: aapke link ke saath khulega`, `${l}`))}>
              {ic}
              <span>{l as string}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export function ProfileBody() {
  const t = useT();
  const [v] = useVariant("profile");
  return (
    <>
      <VariantBar
        id="profile"
        items={[
          { id: "a", label: t("Summary first", "Saar pehle", "सार पहले"), hint: t("The v4.2 profile with three numbers instead of six boxes; skills with proof lead.", "v4.2 wali profile, chhe dabbon ki jagah teen number; saboot wali skills pehle.", "छह डिब्बों की जगह तीन संख्याएँ।") },
          { id: "b", label: t("Proof sheet", "Saboot ka kaagaz", "प्रमाण पत्र"), hint: t("A document HR can trust at a glance: every line says what was checked, how and when.", "HR ek nazar me bharosa kare: har line batati hai kya, kaise aur kab jaancha.", "हर पंक्ति बताती है क्या जाँचा।") },
          { id: "c", label: t("Story", "Kahani", "कहानी"), hint: t("The same facts as a story, newest first, each with its proof.", "Wahi baatein kahani ki tarah, naya pehle, har ek ke saath saboot.", "वही बातें कहानी की तरह।") },
          { id: "z", label: "v4.2", hint: t("The v4.2 profile, for comparison.", "v4.2 wali profile, tulna ke liye.", "v4.2, तुलना के लिए।") },
        ]}
      />
      {v === "b" ? <ProofSheet /> : v === "c" ? <ProofStory /> : <ProfileDash v42={v === "z"} />}
    </>
  );
}

function ProfileDash({ v42 }: { v42: boolean }) {
  const t = useT();
  const toast = useToast();
  const [tab, setTab] = useState<"over" | "plats" | "proj" | "card">("over");
  const [share, setShare] = useState(false);
  const [asHr, setAsHr] = useState(false);
  const [fmt, setFmt] = useState<"wide" | "square" | "story">("wide");
  const total = PLATS.reduce((n, p) => n + p.solved, 0);
  return (
    <div className="col g20">
      {asHr && (
        <div className="banner pen pf-hr-banner">
          <Eye />
          <span className="grow">
            {t("You are seeing what HR sees on your private link. Phone is hidden; edit buttons are gone.", "Aap wahi dekh rahe ho jo HR ko private link par dikhta hai. Phone chhupa hai; edit button nahi.", "आप HR की नज़र से देख रहे हैं।")}
          </span>
          <button className="btn sm" onClick={() => setAsHr(false)}>
            {t("Back to my view", "Apne view par wapas", "अपने दृश्य पर")}
          </button>
        </div>
      )}
      <section className="prof-hero pf-hero">
        <Avatar name="Aarav Sharma" size={92} tone={0} />
        <div className="col g6 grow" style={{ minWidth: 0 }}>
          <div className="row wrap g8">
            <h1 className="h1">Aarav Sharma</h1>
            <Badge tone="tick" icon={<BadgeCheck size={13} />}>
              {t("Verified", "Verified", "सत्यापित")}
            </Badge>
          </div>
          <span className="pf-headline">{t("SDE intern 2027 · DSA, SQL, React", "SDE intern 2027 · DSA, SQL, React", "SDE इंटर्न 2027")}</span>
          <span className="muted small">B.Tech CSE · 3rd year · {t("Class of 2027", "2027 batch", "2027 बैच")} · CGPA 8.6</span>
          <div className="row wrap g12 tiny faint">
            <span className="row g4">
              <MapPin style={{ width: 13, height: 13 }} />
              Indore · {t("open to Bengaluru, remote", "Bengaluru, remote bhi", "बेंगलुरु, रिमोट")}
            </span>
            <span className="row g4">
              <Link2 style={{ width: 13, height: 13 }} />
              parikshaa.in/u/aarav
            </span>
            {!asHr && (
              <span className="row g4">
                <Lock style={{ width: 13, height: 13 }} />
                +91 98•••• 4410 · {t("only you", "sirf aap", "सिर्फ़ आप")}
              </span>
            )}
          </div>
          <div className="row wrap g6 mt4">
            <Badge tone="pen" icon={<Briefcase size={13} />}>
              {t("Open to: internships 2027", "Open: internships 2027", "इंटर्नशिप 2027")}
            </Badge>
            <Badge>{t("Joins in: May 2027", "Join: May 2027", "मई 2027")}</Badge>
          </div>
        </div>
        <div className="col g10 pf-hero-r">
          {!asHr && (
            <div className="row wrap g8">
              <button className="btn pri" onClick={() => setShare(true)}>
                <Share2 />
                {t("Share with HR", "HR ko share karo", "HR को साझा करें")}
              </button>
              <button className="btn" onClick={() => toast(t("Resume PDF made from your verified profile", "Verified profile se resume PDF bana", "रिज़्यूमे PDF बना"))}>
                <Download />
                {t("Resume PDF", "Resume PDF", "रिज़्यूमे PDF")}
              </button>
              <button className="btn ghost" onClick={() => setAsHr(true)}>
                <Eye />
                {t("See as HR", "HR ki nazar se", "HR की नज़र से")}
              </button>
              <Link to="settings" className="btn ghost">
                <Pencil />
                {t("Edit", "Edit", "संपादित")}
              </Link>
            </div>
          )}
          {!asHr && <Strength />}
        </div>
      </section>

      {!v42 && (
        <div className="pf-stats">
          {[
            [String(total), t("problems, 4 sites", "problems, 4 sites", "प्रश्न, 4 साइटें"), t("212 checked by our judge", "212 hamare judge ne jaanche", "212 हमारे जज ने")],
            ["1,529", t("contest rating", "contest rating", "रेटिंग"), t("top 18% · 9 contests", "top 18% · 9 contests", "शीर्ष 18%")],
            ["3", t("Pramaan certificates", "Pramaan certificates", "प्रमाणपत्र"), "DSA L2 · DSA L1 · SQL L1"],
          ].map(([v, k, d]) => (
            <div key={k} className="pf-stat">
              <b className="num">{v}</b>
              <span className="col">
                <span className="small">{k}</span>
                <span className="tiny faint">{d}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      {v42 && <div className="pf-kpis">
        {[
          [String(total), t("problems across 4 sites", "4 sites par problems", "4 साइटों पर"), t("212 on Parikshaa's judge", "212 Parikshaa judge par", "212 यहाँ")],
          ["1,529", t("contest rating", "contest rating", "रेटिंग"), t("top 18% · 9 contests", "top 18% · 9 contests", "शीर्ष 18%")],
          ["3", t("Pramaan certificates", "Pramaan certificates", "प्रमाणपत्र"), "DSA L2 · DSA L1 · SQL L1"],
          ["2", t("projects shipped", "projects ship", "प्रोजेक्ट"), t("tests pass, reviewed", "tests pass, review hue", "टेस्ट पास")],
          ["78%ile", t("aptitude mocks", "aptitude mocks", "एप्टीट्यूड"), t("3 full mocks", "3 poore mocks", "3 मॉक")],
          ["46", t("days best streak", "din sabse lambi streak", "दिन लगातार"), t("now 12", "abhi 12", "अभी 12")],
        ].map(([v, k, d]) => (
          <div key={k} className="pf-kpi">
            <b className="num">{v}</b>
            <span>{k}</span>
            <span className="tiny faint">{d}</span>
          </div>
        ))}
      </div>}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "over", label: t("Summary", "Saar", "सार") },
          { id: "plats", label: t("Coding sites", "Coding sites", "कोडिंग साइटें"), count: PLATS.length },
          { id: "proj", label: t("Projects", "Projects", "प्रोजेक्ट"), count: 3 },
          { id: "card", label: t("Profile card", "Profile card", "प्रोफ़ाइल कार्ड") },
        ]}
      />

      {tab === "over" && (
        <div className="pf-grid">
          <Card title={t("Skills, with proof", "Skills, saboot ke saath", "कौशल, प्रमाण सहित")} icon={<ShieldCheck className="ic" />}>
            <div className="pf-skills">
              {SKILLS.map((s) => {
                const I = s.icon;
                return (
                  <div key={s.name} className={`pf-skill ${s.v ? "" : "self"}`}>
                    <span className="pf-sk-ic">
                      <I />
                    </span>
                    <div className="grow col g4" style={{ minWidth: 0 }}>
                      <div className="row between g8">
                        <b className="small">{s.name}</b>
                        {s.v ? (
                          <Badge tone="tick" sq>
                            {t("verified", "verified", "सत्यापित")}
                          </Badge>
                        ) : (
                          <Badge sq>{t("self-declared", "khud bataya", "स्व-घोषित")}</Badge>
                        )}
                      </div>
                      <Meter v={s.lvl} tone={s.v ? "pen" : "ink-3"} size="thin" />
                      <span className="tiny faint">{t(...s.proof)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          <div className="col g16">
            <Card title={t("All coding sites together", "Saari coding sites ek saath", "सभी साइटें")} icon={<Layers className="ic" />}>
              <div className="pf-donut">
                <Donut parts={PLATS.filter((p) => p.solved).map((p) => ({ v: p.solved, c: p.c }))} size={132} stroke={16}>
                  <span className="pf-donut-c">
                    <b className="num">{total}</b>
                    <span className="tiny faint">{t("solved", "solve", "हल")}</span>
                  </span>
                </Donut>
                <div className="col g6 grow">
                  {PLATS.filter((p) => p.solved).map((p) => (
                    <div key={p.id} className="pf-leg">
                      <i style={{ background: p.c }} />
                      <span className="grow small">{p.name}</span>
                      <b className="num small">{p.solved}</b>
                    </div>
                  ))}
                  <button className="link tiny" onClick={() => setTab("plats")}>
                    {t("How each number is checked", "Har number kaise jaancha", "कैसे जाँचा")} →
                  </button>
                </div>
              </div>
            </Card>
            <Card title={t("Education and experience", "Padhai aur anubhav", "शिक्षा और अनुभव")} icon={<GraduationCap className="ic" />}>
              <div className="pf-tl">
                {[
                  [t("B.Tech CSE · SGSITS Indore (sample)", "B.Tech CSE · SGSITS Indore (sample)", "बी.टेक"), "2023 – 2027 · CGPA 8.6", true],
                  [t("Web intern · Kesar Cloud (sample)", "Web intern · Kesar Cloud (sample)", "वेब इंटर्न"), t("May – Jul 2026 · offer letter checked", "May – Jul 2026 · offer letter jaancha", "जाँचा गया"), true],
                  [t("Design lead · Coding club", "Design lead · Coding club", "डिज़ाइन लीड"), t("2025 – 26 · self-declared", "2025 – 26 · khud bataya", "स्व-घोषित"), false],
                ].map(([a, b, v], i) => (
                  <div key={i} className="pf-tl-row">
                    {v ? <CircleCheck className="t-tick" /> : <Circle className="faint" />}
                    <div className="col">
                      <b className="small">{a as string}</b>
                      <span className="tiny faint">{b as string}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <Card title={t("Practice, last 26 weeks", "Practice, pichhle 26 hafte", "अभ्यास, 26 सप्ताह")} icon={<Trophy className="ic" />} className="pf-wide">
            <div style={{ overflowX: "auto" }}>
              <Heatmap weeks={26} seed={11} />
            </div>
          </Card>
        </div>
      )}

      {tab === "plats" && (
        <div className="col g12">
          <div className="banner pen">
            <Info />
            <span>
              {t(
                "Numbers from other sites are shown with how they were checked. A code in your bio proves the account is yours; we never ask for your password.",
                "Doosri sites ke number ke saath likha hai kaise jaanche gaye. Bio me code se pata chalta hai account aapka hai; password kabhi nahi maangte.",
                "हम कभी पासवर्ड नहीं माँगते।",
              )}
            </span>
          </div>
          <div className="pf-plats">
            {PLATS.map((p) => {
              const I = p.icon;
              return (
                <div key={p.id} className="pf-plat">
                  <div className="row g10">
                    <span className="pf-pl-ic" style={{ color: p.c }}>
                      <I />
                    </span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <b className="small">{p.name}</b>
                      <span className="tiny faint mono" style={{ display: "block" }}>
                        @{p.handle}
                      </span>
                    </div>
                    <Badge tone={p.how === "judge" || p.how === "official API" || p.how.startsWith("sign-in") ? "tick" : "pen"} sq>
                      {p.how}
                    </Badge>
                  </div>
                  <div className="pf-pl-num">
                    {p.solved > 0 && (
                      <b className="num">
                        {p.solved} <span className="tiny faint">{t("solved", "solve", "हल")}</span>
                      </b>
                    )}
                    <span className="small muted">{p.extra}</span>
                  </div>
                  <div className="row between tiny faint">
                    <span className="row g4">
                      <RefreshCw style={{ width: 12, height: 12 }} />
                      {p.synced === "live" ? t("live", "live", "लाइव") : t(`synced ${p.synced} ago`, `${p.synced} pehle sync`, `${p.synced} पहले`)}
                    </span>
                    <Spark data={[3, 4, 3, 6, 5, 7, 6, 8, 9, 7, 10, 12].map((x) => x * (p.solved ? 1 : 0.6))} w={70} h={18} color={p.c} fill={false} />
                  </div>
                </div>
              );
            })}
            <button className="pf-plat pf-add" onClick={() => toast(t("Pick a site, then paste the code in your bio", "Site chuno, phir bio me code daalo", "साइट चुनें"))}>
              <Plus />
              <b className="small">{t("Link another site", "Aur site jodo", "और साइट जोड़ें")}</b>
              <span className="tiny faint">HackerRank, GeeksforGeeks, AtCoder…</span>
            </button>
          </div>
          <SampleNote>{t("Sample numbers. Sites without an official API are checked from the public profile page you link.", "Sample number. Jin sites ka official API nahi, unhe aapke diye public profile se jaancha jaata hai.", "नमूना संख्याएँ।")}</SampleNote>
        </div>
      )}

      {tab === "proj" && (
        <div className="pf-projs">
          {[
            [t("Placement Tracker", "Placement Tracker", "प्लेसमेंट ट्रैकर"), "React · TypeScript · Supabase", t("Shipped 2 Oct · 18/18 tests · mentor reviewed", "2 Oct ship · 18/18 tests · mentor review", "18/18 टेस्ट"), "tracker.parikshaa.app", true],
            [t("Hostel Split", "Hostel Split", "हॉस्टल स्प्लिट"), "Node · Postgres", t("In progress · milestone 3 of 5 · 10/12 tests", "Chal raha · milestone 3 / 5 · 10/12 tests", "माइलस्टोन 3 / 5"), "", false],
            [t("Crop price forecast", "Mandi bhav forecast", "मंडी भाव"), "Python · pandas · scikit-learn", t("Notebook · RMSE 3.1 on hidden data", "Notebook · chhupe data par RMSE 3.1", "नोटबुक"), "", false],
          ].map(([n, st, m, l, done]) => (
            <div key={n as string} className="pf-proj">
              <span className="ic-box">
                <Rocket />
              </span>
              <div className="grow col g4" style={{ minWidth: 0 }}>
                <div className="row wrap g8">
                  <b>{n as string}</b>
                  {done ? (
                    <Badge tone="tick" sq>
                      {t("verified", "verified", "सत्यापित")}
                    </Badge>
                  ) : (
                    <Badge sq>{t("in progress", "chal raha", "जारी")}</Badge>
                  )}
                </div>
                <span className="tiny mono faint">{st as string}</span>
                <span className="small muted">{m as string}</span>
              </div>
              {l ? (
                <a className="btn sm" href="#profile">
                  <ExternalLink /> {t("Live", "Live", "लाइव")}
                </a>
              ) : (
                <Link to={n === t("Crop price forecast", "Mandi bhav forecast", "मंडी भाव") ? "notebook" : "studio"} className="btn sm ghost">
                  <Code2 /> {t("Open", "Kholo", "खोलें")}
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "card" && (
        <div className="pf-card-wrap">
          <div className="col g12">
            <Seg
              value={fmt}
              onChange={setFmt}
              items={[
                { id: "wide", label: t("LinkedIn / email", "LinkedIn / email", "लिंक्डइन") },
                { id: "square", label: t("Square", "Square", "वर्ग") },
                { id: "story", label: t("Story", "Story", "स्टोरी") },
              ]}
            />
            <ProfileCard format={fmt} />
          </div>
          <div className="col g10 pf-card-side">
            <b>{t("Post it, or send it to HR", "Post karo ya HR ko bhejo", "पोस्ट करें या HR को भेजें")}</b>
            <p className="small muted">
              {t(
                "The card shows only verified numbers. Its QR opens your profile, so anyone can check them.",
                "Card par sirf verified number. QR se profile khulti hai, koi bhi jaanch sakta hai.",
                "कार्ड पर सिर्फ़ सत्यापित संख्याएँ।",
              )}
            </p>
            <button className="btn pri" onClick={() => toast(t("Card saved as PNG", "Card PNG me save", "PNG सहेजा"))}>
              <Download /> {t("Download PNG", "PNG download", "PNG डाउनलोड")}
            </button>
            <button className="btn" onClick={() => setShare(true)}>
              <Share2 /> {t("Share with HR", "HR ko share karo", "HR को साझा")}
            </button>
            <button className="btn ghost" onClick={() => toast(t("Copied for LinkedIn", "LinkedIn ke liye copy", "कॉपी हुआ"))}>
              <Copy /> {t("Copy post text", "Post ka text copy", "टेक्स्ट कॉपी")}
            </button>
          </div>
        </div>
      )}

      <ShareModal open={share} onClose={() => setShare(false)} />
    </div>
  );
}

export function ProfileRail() {
  const t = useT();
  return (
    <>
      <Moment
        mood="peek"
        tone="pen"
        title={t("Nimbu Labs HR opened your profile", "Nimbu Labs HR ne profile kholi", "निम्बू लैब्स HR ने प्रोफ़ाइल खोली")}
        note={t("2 hours ago, for 4 minutes. They read the DSA proof.", "2 ghante pehle, 4 minute. DSA ka saboot padha.", "2 घंटे पहले, 4 मिनट।")}
      />
      <Card title={t("Who looked", "Kisne dekha", "किसने देखा")} icon={<Building2 className="ic" />}>
        <div className="col g10">
          <div className="row between">
            <b className="num" style={{ fontSize: 24 }}>
              7
            </b>
            <Spark data={[0, 1, 0, 2, 1, 3, 2]} w={90} h={28} />
          </div>
          <span className="tiny faint">{t("views this week, 3 from companies", "is hafte views, 3 companies se", "इस सप्ताह 7 दृश्य")}</span>
          {[
            ["Nimbu Labs · HR", t("private link · 2 h ago", "private link · 2 ghante", "2 घंटे"), true],
            ["Tara Fintech", t("public link · yesterday", "public link · kal", "कल"), true],
            [t("A company (hidden)", "Ek company (chhupi)", "एक कंपनी"), t("search · Mon", "search · Som", "सोम"), false],
          ].map(([n, w, seen]) => (
            <div key={n as string} className="pf-view">
              <span className="pf-view-ic">{seen ? <Eye /> : <EyeOff />}</span>
              <div className="col">
                <b className="small">{n as string}</b>
                <span className="tiny faint">{w as string}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card title={t("Reach 100%", "100% tak pahuncho", "100% तक")} icon={<CircleCheck className="ic" />}>
        <div className="col g8">
          {[
            [t("Verify your college email", "College email verify", "कॉलेज ईमेल"), true],
            [t("Link a coding site", "Coding site jodo", "साइट जोड़ें"), true],
            [t("Ship one project", "Ek project ship karo", "एक प्रोजेक्ट"), true],
            [t("Upload a resume", "Resume upload karo", "रिज़्यूमे"), false],
            [t("Take Pramaan for React", "React ka Pramaan do", "React प्रमाण"), false],
          ].map(([l, d]) => (
            <div key={l as string} className={`pf-check ${d ? "done" : ""}`}>
              {d ? <CircleCheck /> : <Circle />}
              <span>{l as string}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
