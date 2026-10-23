import { useState } from "react";
import { BadgeCheck, Download, Eye, Share2, QrCode, ShieldCheck, Rocket, Trophy, GraduationCap, Briefcase, Flag, CircleDashed, ExternalLink } from "lucide-react";
import { useT, useToast } from "../lib/core";
import { Avatar, Badge, LogoMark, Stamp } from "../ui/kit";
import { PLATS, SKILLS, ShareModal } from "./profile";

/* Mock v4.3: two more directions for the profile. B reads like a document HR can trust at a glance (a proof
   sheet), C tells the same facts as a story, newest first. Every line says how it was checked. */

function Actions({ onShare, onHr, hr }: { onShare: () => void; onHr: () => void; hr: boolean }) {
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
      <button className="btn ghost" aria-pressed={hr} onClick={onHr}>
        <Eye />
        {hr ? t("Back to my view", "Apna view", "अपना दृश्य") : t("See as HR", "HR ki nazar se", "HR की नज़र से")}
      </button>
    </div>
  );
}

/* ---------------- B: the proof sheet ---------------- */

const ROWS: { what: [string, string, string]; level: string; proof: [string, string, string]; how: [string, string, string]; when: string; v: boolean }[] = [
  { what: ["Data structures and algorithms", "DSA", "डेटा संरचना और एल्गोरिदम"], level: "L2", proof: ["Pramaan exam, proctored · 212 solved on the judge", "Pramaan exam, proctored · judge par 212", "प्रमाण परीक्षा · 212 हल"], how: ["Parikshaa judge + proctoring", "Parikshaa judge + proctoring", "पारिक्षा जज"], when: "Sep 2026", v: true },
  { what: ["SQL", "SQL", "SQL"], level: "L1", proof: ["Pramaan exam · 41 SQL problems", "Pramaan exam · 41 SQL problems", "प्रमाण · 41 SQL"], how: ["Parikshaa judge", "Parikshaa judge", "पारिक्षा जज"], when: "Aug 2026", v: true },
  { what: ["React (project)", "React (project)", "React (प्रोजेक्ट)"], level: "—", proof: ["Placement Tracker · 18/18 tests · mentor review", "Placement Tracker · 18/18 tests · mentor review", "प्रोजेक्ट · 18/18 टेस्ट"], how: ["Studio tests + reviewer", "Studio tests + reviewer", "स्टूडियो टेस्ट"], when: "Oct 2026", v: true },
  { what: ["Aptitude", "Aptitude", "एप्टीट्यूड"], level: "78%ile", proof: ["3 full mocks, timed", "3 poore mocks, timed", "3 पूरे मॉक"], how: ["Parikshaa mock tests", "Parikshaa mock tests", "पारिक्षा मॉक"], when: "Oct 2026", v: true },
  { what: ["Contests", "Contests", "प्रतियोगिताएँ"], level: "1,529", proof: ["9 rated contests · top 18%", "9 rated contests · top 18%", "9 प्रतियोगिताएँ"], how: ["Parikshaa contests", "Parikshaa contests", "पारिक्षा"], when: "Oct 2026", v: true },
  { what: ["Codeforces", "Codeforces", "Codeforces"], level: "1,388", proof: ["96 solved · Specialist", "96 solve · Specialist", "96 हल"], how: ["Official API, synced 1 h ago", "Official API, 1 ghanta pehle", "आधिकारिक API"], when: "Oct 2026", v: true },
  { what: ["LeetCode", "LeetCode", "LeetCode"], level: "1,642", proof: ["318 solved", "318 solve", "318 हल"], how: ["Code in profile bio", "Bio me code", "बायो में कोड"], when: "Oct 2026", v: true },
  { what: ["Machine learning", "Machine learning", "मशीन लर्निंग"], level: "—", proof: ["1 notebook in progress", "1 notebook chal rahi", "1 नोटबुक"], how: ["Self-declared, not checked", "Khud bataya, jaancha nahi", "स्व-घोषित"], when: "—", v: false },
];

export function ProofSheet() {
  const t = useT();
  const [share, setShare] = useState(false);
  const [hr, setHr] = useState(false);
  return (
    <div className="col g16">
      <div className="row wrap between g12">
        <div className="col g4">
          <span className="eyebrow">{t("Your proof sheet", "Aapka saboot ka kaagaz", "आपका प्रमाण पत्र")}</span>
          <span className="small muted">{t("This page is what HR opens from your link.", "HR aapke link se yahi page kholta hai.", "HR यही पेज खोलता है।")}</span>
        </div>
        <Actions onShare={() => setShare(true)} onHr={() => setHr((h) => !h)} hr={hr} />
      </div>
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
            {!hr && <span className="tiny faint">+91 98•••• 4410 · {t("only you see this", "sirf aap dekhte ho", "सिर्फ़ आप")}</span>}
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
      <ShareModal open={share} onClose={() => setShare(false)} />
    </div>
  );
}

/* ---------------- C: the story, newest first ---------------- */

const STORY: { when: string; icon: typeof Rocket; tone: string; title: [string, string, string]; body: [string, string, string]; proof: [string, string, string]; v: boolean }[] = [
  { when: "Oct 2026", icon: Rocket, tone: "pen", title: ["Shipped Placement Tracker", "Placement Tracker ship kiya", "प्लेसमेंट ट्रैकर बनाया"], body: ["React + an API, built in Studio over 3 weeks. Deployed; 1 mentor review.", "React + API, Studio me 3 hafte. Deploy hua; 1 mentor review.", "React + API, 3 सप्ताह में।"], proof: ["18 of 18 tests pass", "18/18 tests pass", "18/18 टेस्ट"], v: true },
  { when: "Sep 2026", icon: ShieldCheck, tone: "tick", title: ["Passed Pramaan DSA L2", "Pramaan DSA L2 pass", "प्रमाण DSA L2 पास"], body: ["90-minute proctored exam: 3 problems, timed, camera on.", "90 minute proctored exam: 3 problems, camera on.", "90 मिनट की परीक्षा।"], proof: ["Certificate PK-C-0918, verify online", "Certificate PK-C-0918, online verify", "प्रमाणपत्र PK-C-0918"], v: true },
  { when: "Aug 2026", icon: Trophy, tone: "ai", title: ["Contest rating crossed 1,500", "Contest rating 1,500 ke paar", "रेटिंग 1,500 पार"], body: ["9 rated contests; best rank 214 of 3,100.", "9 rated contests; best rank 214 / 3,100.", "9 प्रतियोगिताएँ।"], proof: ["Parikshaa contests", "Parikshaa contests", "पारिक्षा"], v: true },
  { when: "May–Jul 2026", icon: Briefcase, tone: "coin", title: ["Web intern, Kesar Cloud (sample)", "Web intern, Kesar Cloud (sample)", "वेब इंटर्न (नमूना)"], body: ["Built two internal dashboards in React.", "React me do internal dashboards banaye.", "दो डैशबोर्ड बनाए।"], proof: ["Offer letter checked", "Offer letter jaancha", "ऑफ़र लेटर जाँचा"], v: true },
  { when: "Jun 2026", icon: Flag, tone: "teal", title: ["Started on Parikshaa", "Parikshaa par shuru", "पारिक्षा पर शुरू"], body: ["Goal: product company SDE. 90-day plan, 2 hours an evening.", "Goal: product company SDE. 90 din ka plan, roz 2 ghante.", "लक्ष्य: SDE।"], proof: ["Joined with college email", "College email se joda", "कॉलेज ईमेल"], v: true },
  { when: "2025–26", icon: GraduationCap, tone: "", title: ["Design lead, coding club", "Design lead, coding club", "डिज़ाइन लीड"], body: ["Ran 6 workshops for first-years.", "First-years ke liye 6 workshops.", "6 कार्यशालाएँ।"], proof: ["Self-declared", "Khud bataya", "स्व-घोषित"], v: false },
];

export function ProofStory() {
  const t = useT();
  const [share, setShare] = useState(false);
  const [hr, setHr] = useState(false);
  const total = PLATS.reduce((n, p) => n + p.solved, 0);
  return (
    <div className="col g20">
      <section className="pst-hero">
        <Avatar name="Aarav Sharma" size={80} tone={0} />
        <div className="col g6 grow" style={{ minWidth: 0 }}>
          <div className="row wrap g8">
            <h1 className="h1">Aarav Sharma</h1>
            <Badge tone="tick" icon={<BadgeCheck size={13} />}>
              {t("Verified", "Verified", "सत्यापित")}
            </Badge>
          </div>
          <p className="pst-pitch">
            {t(
              `Third-year CSE student aiming for an SDE internship in 2027. ${total} problems across 4 sites, Pramaan DSA L2, and one shipped React project.`,
              `3rd year CSE, 2027 me SDE internship ka goal. 4 sites par ${total} problems, Pramaan DSA L2, aur ek ship hua React project.`,
              `तीसरे वर्ष का CSE छात्र। ${total} प्रश्न, प्रमाण DSA L2।`,
            )}
          </p>
          <div className="row wrap g6">
            {SKILLS.filter((s) => s.v).map((s) => (
              <Badge key={s.name} tone="pen" icon={<BadgeCheck size={13} />}>
                {s.name}
              </Badge>
            ))}
          </div>
        </div>
        <Actions onShare={() => setShare(true)} onHr={() => setHr((h) => !h)} hr={hr} />
      </section>
      <ol className="pst-line" aria-label={t("Story, newest first", "Kahani, naya pehle", "कहानी, नया पहले")}>
        {STORY.map((s) => {
          const I = s.icon;
          return (
            <li key={s.title[0]} className={s.v ? "" : "self"}>
              <span className="pst-when num">{s.when}</span>
              <span className={`pst-dot ${s.tone ? `t-${s.tone}` : ""}`}>
                <I />
              </span>
              <div className="pst-card card">
                <b>{t(...s.title)}</b>
                <span className="small muted">{t(...s.body)}</span>
                <span className={`pst-proof tiny ${s.v ? "" : "self"}`}>
                  {s.v ? <BadgeCheck /> : <CircleDashed />}
                  {t(...s.proof)}
                  {s.v && <ExternalLink className="faint" />}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <ShareModal open={share} onClose={() => setShare(false)} />
    </div>
  );
}
