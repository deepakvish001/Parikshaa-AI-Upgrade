import { useState } from "react";
import {
  BadgeCheck,
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
  Link2,
  Lock,
  Mail,
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
  Brain,
  Layers,
  CircleDashed,
} from "lucide-react";
import { Link, useT, useToast } from "../lib/core";
import { Avatar, Badge, Card, Heatmap, LogoMark, Modal, Moment, SampleNote, Seg, Spark, Stamp, Tabs, Toggle } from "../ui/kit";

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

/* The profile is a proof sheet: a document HR can trust at a glance, where every line says what was
   checked, how and when (chosen by the owner, 24 Oct 2026). Coding sites, projects and the card sit in tabs. */

function Actions({ onShare, onHr }: { onShare: () => void; onHr: () => void }) {
  const t = useT();
  const toast = useToast();
  return (
    <div className="row wrap g8">
      <button className="btn pri" onClick={onShare}>
        <Share2 />
        {t("Share with HR", "HR ko share karo", "HR को साझा करें")}
      </button>
      <button className="btn" onClick={() => toast(t("Resume PDF made from your verified profile", "Verified profile se resume PDF bana", "रिज़्यूमे PDF बना"))}>
        <Download />
        {t("Resume PDF", "Resume PDF", "रिज़्यूमे PDF")}
      </button>
      <button className="btn ghost" onClick={onHr}>
        <Eye />
        {t("See as HR", "HR ki nazar se", "HR की नज़र से")}
      </button>
      <Link to="settings" className="btn ghost">
        <Pencil />
        {t("Edit", "Edit", "संपादित")}
      </Link>
    </div>
  );
}

const ROWS: { what: [string, string, string]; level: string; proof: [string, string, string]; how: [string, string, string]; when: string; v: boolean }[] = [
  { what: ["Data structures and algorithms", "DSA", "डेटा संरचना और एल्गोरिदम"], level: "L2", proof: ["Pramaan exam, proctored · 212 solved on the judge", "Pramaan exam, proctored · judge par 212", "प्रमाण परीक्षा · 212 हल"], how: ["Parikshaa judge + proctoring", "Parikshaa judge + proctoring", "पारिक्षा जज"], when: "Sep 2026", v: true },
  { what: ["SQL", "SQL", "SQL"], level: "L1", proof: ["Pramaan exam · 41 SQL problems", "Pramaan exam · 41 SQL problems", "प्रमाण · 41 SQL"], how: ["Parikshaa judge", "Parikshaa judge", "पारिक्षा जज"], when: "Aug 2026", v: true },
  { what: ["React (project)", "React (project)", "React (प्रोजेक्ट)"], level: "—", proof: ["Placement Tracker · 18/18 tests · mentor review", "Placement Tracker · 18/18 tests · mentor review", "प्रोजेक्ट · 18/18 टेस्ट"], how: ["Studio tests + reviewer", "Studio tests + reviewer", "स्टूडियो टेस्ट"], when: "Oct 2026", v: true },
  { what: ["Aptitude", "Aptitude", "एप्टीट्यूड"], level: "78%ile", proof: ["3 full mocks, timed", "3 poore mocks, timed", "3 पूरे मॉक"], how: ["Parikshaa mock tests", "Parikshaa mock tests", "पारिक्षा मॉक"], when: "Oct 2026", v: true },
  { what: ["Contests", "Contests", "प्रतियोगिताएँ"], level: "1,529", proof: ["9 rated contests · top 18%", "9 rated contests · top 18%", "9 प्रतियोगिताएँ"], how: ["Parikshaa contests", "Parikshaa contests", "पारिक्षा"], when: "Oct 2026", v: true },
  { what: ["Codeforces", "Codeforces", "Codeforces"], level: "1,388", proof: ["96 solved · Specialist", "96 solve · Specialist", "96 हल"], how: ["Official API, synced 1 h ago", "Official API, 1 ghanta pehle", "आधिकारिक API"], when: "Oct 2026", v: true },
  { what: ["LeetCode", "LeetCode", "LeetCode"], level: "1,642", proof: ["318 solved", "318 solve", "318 हल"], how: ["Code in profile bio", "Bio me code", "बायो में कोड"], when: "Oct 2026", v: true },
  { what: ["Web internship, Kesar Cloud (sample)", "Web internship, Kesar Cloud (sample)", "वेब इंटर्नशिप (नमूना)"], level: "—", proof: ["May–Jul 2026 · two React dashboards", "May–Jul 2026 · do React dashboards", "मई–जुलाई 2026"], how: ["Offer letter checked", "Offer letter jaancha", "ऑफ़र लेटर जाँचा"], when: "Jul 2026", v: true },
  { what: ["Machine learning", "Machine learning", "मशीन लर्निंग"], level: "—", proof: ["1 notebook in progress", "1 notebook chal rahi", "1 नोटबुक"], how: ["Self-declared, not checked", "Khud bataya, jaancha nahi", "स्व-घोषित"], when: "—", v: false },
];

function ProofSheet({ hr }: { hr: boolean }) {
  const t = useT();
  return (
    <article className="ps-sheet" aria-label={t("Proof sheet", "Saboot ka kaagaz", "प्रमाण पत्र")}>
      <header className="ps-head">
        <span className="row g8">
          <LogoMark size={26} decorative />
          <b className="ps-brand">parikshaa</b>
        </span>
        <span className="ps-kind">{t("Verified profile", "Verified profile", "सत्यापित प्रोफ़ाइल")}</span>
        <span className="tiny faint num">No. PK-2027-0418</span>
      </header>
      <div className="ps-id">
        <Avatar name="Aarav Sharma" size={72} tone={0} />
        <div className="col g4 grow" style={{ minWidth: 0 }}>
          <h1 className="ps-name">Aarav Sharma</h1>
          <span className="ps-line">{t("SDE intern 2027 · DSA, SQL, React", "SDE intern 2027 · DSA, SQL, React", "SDE इंटर्न 2027")}</span>
          <span className="small muted">B.Tech CSE · {t("3rd year · class of 2027 · CGPA 8.6 (college email checked)", "3rd year · 2027 batch · CGPA 8.6 (college email jaancha)", "तीसरा वर्ष · CGPA 8.6")}</span>
          <span className="small muted">{t("Indore · open to Bengaluru and remote · joins May 2027", "Indore · Bengaluru aur remote · May 2027 se", "इंदौर · मई 2027")}</span>
          {!hr && (
            <span className="tiny faint row g4">
              <Lock style={{ width: 12, height: 12 }} />
              +91 98•••• 4410 · {t("only you see this", "sirf aap dekhte ho", "सिर्फ़ आप")}
            </span>
          )}
        </div>
        <span className="ps-stamp">
          <Stamp top="PRAMAAN" mid="Verified" bottom="DSA · L2" />
        </span>
      </div>
      <div className="ps-table-wrap">
        <table className="ps-table">
          <caption className="sr-only">{t("What is checked, and how", "Kya jaancha, kaise", "क्या जाँचा, कैसे")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("Skill or record", "Skill ya record", "कौशल")}</th>
              <th scope="col">{t("Level", "Level", "स्तर")}</th>
              <th scope="col">{t("Evidence", "Saboot", "प्रमाण")}</th>
              <th scope="col">{t("How it was checked", "Kaise jaancha", "कैसे जाँचा")}</th>
              <th scope="col">{t("When", "Kab", "कब")}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.what[0]} className={r.v ? "" : "self"}>
                <th scope="row">
                  <span className="row g6">
                    {r.v ? <BadgeCheck className="t-tick" /> : <CircleDashed className="faint" />}
                    {t(...r.what)}
                  </span>
                </th>
                <td className="num" data-label={t("Level", "Level", "स्तर")}>
                  <b>{r.level}</b>
                </td>
                <td data-label={t("Evidence", "Saboot", "प्रमाण")}>{t(...r.proof)}</td>
                <td className="muted" data-label={t("Checked", "Jaancha", "जाँचा")}>
                  {t(...r.how)}
                </td>
                <td className="num muted ps-when" data-label={t("When", "Kab", "कब")}>
                  {r.when}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="ps-practice" aria-labelledby="ps-practice-t">
        <div className="row wrap between g8">
          <b className="ps-sec" id="ps-practice-t">
            {t("Practice, last 26 weeks", "Practice, pichhle 26 hafte", "अभ्यास, पिछले 26 सप्ताह")}
          </b>
          <span className="tiny faint">{t("Days with a judged submission · best streak 46 days", "Judge wale submission ke din · sabse lambi streak 46 din", "सबसे लंबा क्रम 46 दिन")}</span>
        </div>
        <div className="ps-heat" tabIndex={0} aria-label={t("Practice heatmap, scrolls sideways", "Practice heatmap, side me scroll", "अभ्यास हीटमैप")}>
          <Heatmap weeks={26} seed={11} />
        </div>
      </section>
      <footer className="ps-foot">
        <div className="col g4 grow" style={{ minWidth: 0 }}>
          <span className="ps-sign">{t("Checked by Parikshaa", "Parikshaa ne jaancha", "पारिक्षा ने जाँचा")}</span>
          <span className="tiny faint">
            {t(
              "Ticked lines are checked by Parikshaa or the site's own API. A dashed circle means the learner said it and nobody checked it. Updated 23 Oct 2026.",
              "Tick wali lines Parikshaa ya site ke API ne jaanchi. Dashed circle matlab learner ne bataya, kisi ne jaancha nahi. 23 Oct 2026.",
              "टिक वाली पंक्तियाँ जाँची गई हैं। 23 अक्टूबर 2026।",
            )}
          </span>
        </div>
        <span className="ps-qr">
          <QrCode />
          <span className="tiny mono">parikshaa.in/u/aarav</span>
        </span>
      </footer>
    </article>
  );
}

export function ProfileBody() {
  const t = useT();
  const toast = useToast();
  const [tab, setTab] = useState<"sheet" | "plats" | "proj" | "card">("sheet");
  const [share, setShare] = useState(false);
  const [hr, setHr] = useState(false);
  const [fmt, setFmt] = useState<"wide" | "square" | "story">("wide");
  return (
    <div className="col g16">
      {hr ? (
        <div className="banner pen pf-hr-banner">
          <Eye />
          <span className="grow">
            {t("You are seeing what HR sees on your private link. Phone is hidden; edit buttons are gone.", "Aap wahi dekh rahe ho jo HR ko private link par dikhta hai. Phone chhupa hai; edit button nahi.", "आप HR की नज़र से देख रहे हैं।")}
          </span>
          <button className="btn sm" onClick={() => setHr(false)}>
            {t("Back to my view", "Apne view par wapas", "अपने दृश्य पर")}
          </button>
        </div>
      ) : (
        <div className="row wrap between g12">
          <div className="col g4">
            <span className="eyebrow">{t("Your profile", "Aapki profile", "आपकी प्रोफ़ाइल")}</span>
            <span className="small muted">{t("This sheet is what HR opens from your link.", "HR aapke link se yahi kaagaz kholta hai.", "HR यही पत्र खोलता है।")}</span>
          </div>
          <Actions
            onShare={() => setShare(true)}
            onHr={() => {
              setHr(true);
              if (tab === "card") setTab("sheet");
            }}
          />
        </div>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "sheet", label: t("Proof sheet", "Saboot ka kaagaz", "प्रमाण पत्र") },
          { id: "plats", label: t("Coding sites", "Coding sites", "कोडिंग साइटें"), count: PLATS.length },
          { id: "proj", label: t("Projects", "Projects", "प्रोजेक्ट"), count: 3 },
          ...(hr ? [] : [{ id: "card" as const, label: t("Profile card", "Profile card", "प्रोफ़ाइल कार्ड") }]),
        ]}
      />

      {tab === "sheet" && <ProofSheet hr={hr} />}

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
            {!hr && (
              <button className="pf-plat pf-add" onClick={() => toast(t("Pick a site, then paste the code in your bio", "Site chuno, phir bio me code daalo", "साइट चुनें"))}>
                <Plus />
                <b className="small">{t("Link another site", "Aur site jodo", "और साइट जोड़ें")}</b>
                <span className="tiny faint">HackerRank, GeeksforGeeks, AtCoder…</span>
              </button>
            )}
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
