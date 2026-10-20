import { useRef, useState } from "react";
import {
  ShieldCheck,
  KeyRound,
  Smartphone,
  MapPin,
  Wifi,
  ArrowRight,
  TriangleAlert,
  Factory,
  Gauge,
  IndianRupee,
  LifeBuoy,
  Stamp as StampIcon,
  UserPlus,
  Activity,
  CodeXml,
  CircleCheck,
  Bot,
  Clock,
  Timer,
  Undo2,
  ListChecks,
  Eye,
  MessageSquare,
  Check,
  X,
} from "lucide-react";
import { Link, navigate, useT, useToast } from "../lib/core";
import { useRole, ROLES } from "../lib/state";
import { Logo, Badge, Spark, LineChart, Bars, Card, Tabs, Avatar, Level, Check as CheckBox, Modal } from "../ui/kit";
import { LangButton, ThemeButton, useTri } from "../ui/shell";
import { AdmHead, Gate, Status } from "./akit";

/* ---------------- staff sign-in ---------------- */

export function AdminLogin() {
  const t = useT();
  const [step, setStep] = useState<"id" | "otp">("id");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  return (
    <div className="adm-login paper-grid">
      <div className="row between al-top">
        <span />
        <div className="row g4">
          <LangButton compact />
          <ThemeButton />
        </div>
      </div>
      <div className="al-card">
        <Logo size={30} tag="Admin" />
        <div className="al-steps">
          <span className={step === "id" ? "on" : "done"}>{step === "id" ? "1" : <Check />}</span>
          <i />
          <span className={step === "otp" ? "on" : ""}>2</span>
          <span className="tiny faint">{step === "id" ? t("Sign in", "Sign in", "साइन इन") : t("Two-step check", "Do-kadam check", "दो-चरण जाँच")}</span>
        </div>
        {step === "id" ? (
          <>
            <h1 className="h2">{t("Staff sign-in", "Staff sign-in", "स्टाफ़ साइन इन")}</h1>
            <button className="btn lg block" onClick={() => setStep("otp")}>
              <ShieldCheck />
              {t("Continue with company SSO", "Company SSO se aage", "कंपनी SSO")}
            </button>
            <div className="or">
              <span>{t("or", "ya", "या")}</span>
            </div>
            <div className="field">
              <label>{t("Work email", "Work email", "कार्य ईमेल")}</label>
              <input className="input" defaultValue="meera@parikshaa.in" />
            </div>
            <div className="field">
              <label>{t("Password", "Password", "पासवर्ड")}</label>
              <input className="input" type="password" defaultValue="••••••••••••" />
            </div>
            <button className="btn pri lg block" onClick={() => setStep("otp")}>
              {t("Next", "Aage", "आगे")}
              <ArrowRight />
            </button>
          </>
        ) : (
          <>
            <h1 className="h2">{t("Enter the 6-digit code", "6 ank ka code daalo", "6 अंकों का कोड")}</h1>
            <p className="small muted">{t("From your authenticator app. Two-step sign-in is required for every staff account.", "Authenticator app se. Har staff account ke liye do-kadam sign-in zaroori.", "हर स्टाफ़ खाते के लिए ज़रूरी।")}</p>
            <div className="otp">
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  className={`otp-box ${d ? "on" : ""}`}
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  aria-label={`Digit ${i + 1}`}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(-1);
                    const n = [...otp];
                    n[i] = v;
                    setOtp(n);
                    if (v && i < 5) refs.current[i + 1]?.focus();
                  }}
                />
              ))}
            </div>
            <button className="btn sm ghost" style={{ alignSelf: "flex-start" }} onClick={() => setOtp(["3", "1", "9", "0", "4", "7"])}>
              {t("Fill sample code", "Sample code bharo", "नमूना कोड")}
            </button>
            <button className="btn pri lg block" onClick={() => navigate("admin")} disabled={otp.some((d) => !d)}>
              {t("Verify and open admin", "Verify karke admin kholo", "सत्यापित करें")}
            </button>
            <button className="link small" style={{ alignSelf: "center" }}>
              <KeyRound />
              {t("Use a backup code", "Backup code use karo", "बैकअप कोड")}
            </button>
          </>
        )}
        <div className="al-notes">
          <span>
            <Wifi /> {t("This network is on the allowlist", "Ye network allowlist par hai", "यह नेटवर्क अनुमति सूची में")}
          </span>
          <span>
            <Smartphone /> {t("New device: Chrome on Windows · Indore. The security team gets an email.", "Naya device: Chrome, Windows · Indore. Security team ko email.", "नया डिवाइस।")}
          </span>
          <span>
            <Clock /> {t("Signs out after 30 minutes idle", "30 minute idle par sign out", "30 मिनट निष्क्रिय पर")}
          </span>
        </div>
      </div>
      <p className="tiny faint al-foot">
        <MapPin style={{ width: 12, height: 12 }} /> {t("Every action in admin is written to an audit log with your name.", "Admin ka har kaam aapke naam se audit log me.", "हर कार्य ऑडिट लॉग में।")}
      </p>
    </div>
  );
}

/* ---------------- dashboard ---------------- */

const KPI: { k: [string, string, string]; v: string; d: string; up?: boolean; bad?: boolean; data: number[]; mod: string }[] = [
  { k: ["Sign-ups today", "Aaj sign-ups", "आज साइन-अप"], v: "1,284", d: "+12%", up: true, data: [8, 9, 11, 10, 12, 14, 13], mod: "learners" },
  { k: ["Daily active", "Roz active", "दैनिक सक्रिय"], v: "38,410", d: "+4%", up: true, data: [30, 31, 33, 34, 36, 37, 38], mod: "analytics" },
  { k: ["Submissions", "Submissions", "सबमिशन"], v: "2.1 L", d: "+8%", up: true, data: [15, 17, 16, 19, 18, 20, 21], mod: "analytics" },
  { k: ["First-try AC", "Pehli baar AC", "पहली बार AC"], v: "41%", d: "+1 pt", up: true, data: [38, 39, 39, 40, 40, 41, 41], mod: "analytics" },
  { k: ["AI spend today", "Aaj AI kharch", "आज एआई खर्च"], v: "₹18,200", d: "82% of cap", bad: true, data: [10, 12, 11, 14, 15, 17, 18], mod: "ai" },
  { k: ["Judge p95", "Judge p95", "जज p95"], v: "5.4 s", d: "limit 5 s", bad: true, data: [3, 3, 4, 3, 4, 5, 5.4], mod: "system" },
  { k: ["Error rate", "Error rate", "त्रुटि दर"], v: "0.21%", d: "steady", data: [2, 2, 3, 2, 2, 2, 2], mod: "system" },
  { k: ["Review queue", "Review queue", "समीक्षा कतार"], v: "14", d: "3 past SLA", bad: true, data: [9, 10, 12, 11, 13, 15, 14], mod: "review" },
  { k: ["Open reports", "Khule reports", "खुली रिपोर्ट"], v: "9", d: "−4", up: true, data: [14, 13, 12, 11, 12, 10, 9], mod: "support" },
  { k: ["Revenue today", "Aaj ki kamaai", "आज की आय"], v: "₹2.4 L", d: "+6%", up: true, data: [18, 20, 19, 22, 21, 23, 24], mod: "commerce" },
];

export function AdminDashboard() {
  const t = useT();
  const { can, role } = useRole();
  const tri = useTri();
  const days = Array.from({ length: 30 }, (_, i) => `${i + 1}`);
  return (
    <div className="col g20">
      <AdmHead
        title={t("Good morning, Meera", "Suprabhat, Meera", "सुप्रभात, मीरा")}
        sub={t("Tuesday, 20 October · numbers are sample data", "Mangal, 20 October · number sample hain", "मंगलवार, 20 अक्टूबर · नमूना")}
        actions={
          <>
            <Link to="adm-audit" className="btn">
              <Activity />
              {t("Audit log", "Audit log", "ऑडिट लॉग")}
            </Link>
            <Gate mod="content" className="btn pri" onClick={() => navigate("adm-problem")}>
              <CodeXml />
              {t("New problem", "Naya problem", "नया प्रश्न")}
            </Gate>
          </>
        }
      />
      <div className="kpis">
        {KPI.filter((k) => can(k.mod)).map((k) => (
          <div key={k.k[0]} className="kpi">
            <span className="tiny faint">{t(k.k[0], k.k[1], k.k[2])}</span>
            <b className="num">{k.v}</b>
            <div className="row between">
              <span className={`tiny ${k.bad ? "t-red" : k.up ? "t-tick" : "faint"}`}>{k.d}</span>
              <Spark data={k.data} w={70} h={22} color={k.bad ? "var(--red)" : "var(--pen)"} fill={false} />
            </div>
          </div>
        ))}
        {KPI.filter((k) => !can(k.mod)).length > 0 && (
          <div className="kpi locked">
            <span className="tiny faint">{t("Hidden for your role", "Aapke role ke liye chhupe", "आपकी भूमिका हेतु छिपे")}</span>
            <b className="num">{KPI.filter((k) => !can(k.mod)).length}</b>
            <span className="tiny faint">{tri(ROLES.find((r) => r.id === role)!.name)}</span>
          </div>
        )}
      </div>
      <div className="dash-grid">
        <Card title={t("Needs you", "Aapka dhyan chahiye", "ध्यान दें")} icon={<TriangleAlert className="ic" style={{ color: "var(--red-text)" }} />} pad={false}>
          <div className="list">
            {[
              [<Factory key="a" />, t("Factory batch 14: 12 items failed the duplicate check", "Factory batch 14: 12 items duplicate check me fail", "बैच 14: 12 विफल"), "adm-factory", "red", "factory"],
              [<Gauge key="b" />, t("Judge p95 is 5.4 s (limit 5 s) since 9:40", "Judge p95 5.4 s (limit 5 s), 9:40 se", "जज p95 5.4 s"), "adm-system", "red", "system"],
              [<Bot key="c" />, t("AI spend at 82% of today's cap", "AI kharch aaj ki cap ka 82%", "एआई खर्च 82%"), "adm-ai", "coin", "ai"],
              [<LifeBuoy key="d" />, t("3 mistake reports older than 24 hours", "3 reports 24 ghante se purane", "3 पुरानी रिपोर्ट"), "adm-support", "coin", "support"],
              [<IndianRupee key="f" />, t("Refund of ₹6,499 waits for a second approver", "₹6,499 ka refund doosre approver ka intezaar", "रिफ़ंड प्रतीक्षा में"), "adm-commerce", "coin", "commerce"],
              [<StampIcon key="e" />, t("2 approvals are waiting for you", "2 approvals aapka intezaar", "2 मंज़ूरियाँ"), "adm-approvals", "pen", "approvals"],
            ]
              .filter((x) => can(x[5] as string))
              .map(([ic, l, to, c], i) => (
              <Link key={i} to={to as string} className="li">
                <span className={`ic-box tone-${c}`}>{ic}</span>
                <span className="grow small">{l as string}</span>
                <ArrowRight className="faint" style={{ width: 15, height: 15 }} />
              </Link>
            ))}
          </div>
        </Card>
        <Card title={t("Learners, last 30 days", "Learners, pichhle 30 din", "पिछले 30 दिन")} icon={<UserPlus className="ic" />}>
          <LineChart
            h={190}
            labels={days}
            fmt={(n) => `${Math.round(n / 1000)}k`}
            series={[
              { name: "DAU", data: days.map((_, i) => 26000 + i * 420 + ((i * 7919) % 2600)), c: "var(--pen)" },
              { name: "Sign-ups ×10", data: days.map((_, i) => 9000 + i * 120 + ((i * 3571) % 3000)), c: "var(--tick)", dash: true },
            ]}
          />
          <div className="legend mt8">
            <span>
              <i style={{ background: "var(--pen)" }} />
              {t("Daily active", "Roz active", "दैनिक सक्रिय")}
            </span>
            <span>
              <i style={{ background: "var(--tick)" }} />
              {t("Sign-ups ×10", "Sign-ups ×10", "साइन-अप ×10")}
            </span>
          </div>
        </Card>
        <Card title={t("Content pipeline", "Content pipeline", "सामग्री पाइपलाइन")} icon={<ListChecks className="ic" />}>
          {can("content") ? (
            <div className="pipe-funnel">
              {[
                [t("Drafted", "Drafted", "मसौदा"), 420, "var(--ink-4)"],
                [t("Machine checks pass", "Machine checks pass", "मशीन जाँच"), 351, "var(--ai)"],
                [t("In review", "Review me", "समीक्षा में"), 64, "var(--coin)"],
                [t("Published this week", "Is hafte publish", "इस सप्ताह प्रकाशित"), 212, "var(--tick)"],
              ].map(([l, v, c]) => (
                <div key={l as string} className="pf-row">
                  <span className="small grow">{l as string}</span>
                  <span className="pf-bar">
                    <i style={{ width: `${((v as number) / 420) * 100}%`, background: c as string }} />
                  </span>
                  <b className="num small" style={{ width: 40, textAlign: "right" }}>
                    {v as number}
                  </b>
                </div>
              ))}
            </div>
          ) : (
            <div className="locked-card small faint">{t("Not in your role", "Aapke role me nahi", "आपकी भूमिका में नहीं")}</div>
          )}
        </Card>
        <Card title={t("Revenue, this week (₹ thousand)", "Kamaai, is hafte (₹ hazaar)", "आय (₹ हज़ार)")} icon={<IndianRupee className="ic" />}>
          {can("commerce") ? (
            <Bars
              h={150}
              data={[
                { l: "Mon", v: 182 },
                { l: "Tue", v: 240 },
                { l: "Wed", v: 205 },
                { l: "Thu", v: 221 },
                { l: "Fri", v: 260 },
                { l: "Sat", v: 198 },
                { l: "Sun", v: 176 },
              ]}
            />
          ) : (
            <div className="locked-card small faint">{t("Not in your role", "Aapke role me nahi", "आपकी भूमिका में नहीं")}</div>
          )}
        </Card>
      </div>
      <Card title={t("Recent changes", "Haal ke badlaav", "हाल के बदलाव")} icon={<Activity className="ic" />} actions={<Link to="adm-audit" className="link small">{t("All", "Sab", "सभी")}</Link>} pad={false}>
        <div className="list">
          {[
            ["Rohit Nair", "Support", t("asked to refund ₹6,499 to learner #48213", "learner #48213 ko ₹6,499 refund maanga", "रिफ़ंड माँगा"), "10:12"],
            ["Ananya Rao", "Reviewer", t("published 'Valid brackets' v3", "'Valid brackets' v3 publish kiya", "प्रकाशित"), "09:58"],
            ["Meera Iyer", "Super admin", t("changed AI daily cap ₹20k → ₹22k", "AI daily cap ₹20k → ₹22k", "एआई सीमा बदली"), "09:41"],
          ].map(([who, r, what, when]) => (
            <div key={what as string} className="li">
              <Avatar name={who as string} size={28} />
              <span className="grow small">
                <b>{who as string}</b> <span className="faint">({r as string})</span> {what as string}
              </span>
              <span className="tiny faint mono">{when as string}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------------- review queue ---------------- */

const QUEUE = [
  { id: "P-2231", kind: "Problem", n: "Valid brackets (v3)", by: "Kunal (Editor)", pri: "High", sla: "2 h left", warn: false },
  { id: "E-0912", kind: "Editorial", n: "Pair with target sum", by: "Factory batch 14", pri: "Normal", sla: "Past SLA 3 h", warn: true },
  { id: "L-3310", kind: "Lesson", n: "Deadlocks: the four conditions (हिंदी)", by: "Pooja (Editor)", pri: "Normal", sla: "20 h left", warn: false },
  { id: "A-5521", kind: "Aptitude", n: "Successive percentages · set 2", by: "Factory batch 13", pri: "Low", sla: "1 d left", warn: false },
];
const CHECKLIST = [
  "Statement is clear and has no hidden assumptions",
  "Constraints match the tests (max n, max value)",
  "Samples are explained, not just shown",
  "Editorial goes brute → better → best",
  "Dry run frames match the code",
  "No copied text from another site",
  "Hinglish version reads naturally",
];

export function ReviewQueue() {
  const t = useT();
  const toast = useToast();
  const [cur, setCur] = useState(0);
  const [chk, setChk] = useState<Record<number, boolean>>({ 0: true, 1: true, 2: true, 5: true });
  const [tab, setTab] = useState("mine");
  const done = Object.values(chk).filter(Boolean).length;
  return (
    <div className="col g16">
      <AdmHead
        title={t("Review queue", "Review queue", "समीक्षा कतार")}
        sub={t("Nothing reaches learners without a reviewer's tick and green machine checks.", "Reviewer ke tick aur hare machine checks ke bina kuch learners tak nahi jaata.", "बिना समीक्षा के कुछ नहीं।")}
      />
      <div className="rq-grid">
        <aside className="rq-list">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "mine", label: t("My queue", "Meri queue", "मेरी कतार"), count: 4 },
              { id: "all", label: t("All", "Sab", "सभी"), count: 14 },
            ]}
          />
          {QUEUE.map((q, i) => (
            <button key={q.id} className={`rq-item ${cur === i ? "on" : ""}`} onClick={() => setCur(i)}>
              <div className="row between">
                <span className="tiny mono faint">{q.id}</span>
                <Badge tone={q.kind === "Problem" ? "pen" : q.kind === "Lesson" ? "tick" : q.kind === "Editorial" ? "ai" : "coin"}>{q.kind}</Badge>
              </div>
              <b className="small">{q.n}</b>
              <div className="row between tiny">
                <span className="faint">{q.by}</span>
                <span className={q.warn ? "t-red" : "faint"}>
                  <Timer style={{ width: 11, height: 11, verticalAlign: -1 }} /> {q.sla}
                </span>
              </div>
            </button>
          ))}
        </aside>
        <section className="rq-preview card">
          <div className="card-h">
            <Eye className="ic" />
            <span className="h3">{t("Learner preview", "Learner jaisa", "शिक्षार्थी दृश्य")}</span>
            <Badge>v3 · {t("diff vs v2: +2 tests, statement edited", "v2 se fark: +2 tests, statement badla", "अंतर")}</Badge>
          </div>
          <div className="card-b col g12">
            <h2 className="display" style={{ fontSize: 26 }}>
              Valid brackets
            </h2>
            <div className="row g6">
              <Level n={2} />
              <Badge>Stack</Badge>
            </div>
            <p className="prose small">
              Given a string of <code className="inl">()[]{"{}"}</code>, say whether every opening bracket is closed by the same type in the right order.
              <span className="diff-add"> An empty string counts as valid.</span>
            </p>
            <pre className="ex-b">{"Input   ([]{})\nOutput  true\n\nInput   ([)]\nOutput  false"}</pre>
            <div className="checks-mini">
              {[
                ["Reference solution passes 31/31", true],
                ["Wrong solutions fail as expected (3/3)", true],
                ["Second model agrees on all samples", true],
                ["Duplicate check: 0.12 similarity", true],
                ["Style critic: 1 note (long sentence)", false],
              ].map(([l, ok]) => (
                <span key={l as string} className={ok ? "ok" : "warn"}>
                  {ok ? <CircleCheck /> : <TriangleAlert />}
                  {l as string}
                </span>
              ))}
            </div>
          </div>
        </section>
        <aside className="rq-side">
          <section className="card">
            <div className="card-h">
              <span className="h3">{t("Checklist", "Checklist", "जाँच सूची")}</span>
              <span className="tiny num faint">
                {done}/{CHECKLIST.length}
              </span>
            </div>
            <div className="card-b col g8">
              {CHECKLIST.map((c, i) => (
                <label key={c} className="row top g8 small">
                  <CheckBox on={!!chk[i]} onChange={(v) => setChk((x) => ({ ...x, [i]: v }))} label={c} />
                  <span className={chk[i] ? "" : "muted"}>{c}</span>
                </label>
              ))}
            </div>
          </section>
          <section className="card pad col g8">
            <span className="h3 row g6">
              <MessageSquare style={{ width: 15, height: 15 }} />
              {t("Comment", "Comment", "टिप्पणी")}
            </span>
            <textarea className="textarea" defaultValue="Line 2: 'say whether' → 'print true or false'." />
          </section>
          <div className="decide">
            {done < CHECKLIST.length ? (
              <button className="btn ok block" disabled data-tip={t(`${CHECKLIST.length - done} checklist items left`, `Checklist ke ${CHECKLIST.length - done} item baaki`, "जाँच सूची बाकी")}>
                <Check />
                {t("Approve and publish", "Approve aur publish", "स्वीकृत व प्रकाशित")}
              </button>
            ) : (
              <Gate mod="review" need="full" className="btn ok block" onClick={() => toast(t("Approved · published at 10:30", "Approve · 10:30 par publish", "स्वीकृत"))}>
                <Check />
                {t("Approve and publish", "Approve aur publish", "स्वीकृत व प्रकाशित")}
              </Gate>
            )}
            {done < CHECKLIST.length && <span className="tiny faint">{t(`Tick all ${CHECKLIST.length} checklist items to approve.`, `Approve ke liye checklist ke saare ${CHECKLIST.length} item tick karo.`, "सभी जाँच पूरी करें।")}</span>}
            <div className="row g8">
              <Gate mod="review" className="btn grow" onClick={() => toast(t("Sent back to the editor", "Editor ko wapas bheja", "संपादक को लौटाया"))}>
                <Undo2 />
                {t("Request changes", "Badlaav maango", "बदलाव माँगें")}
              </Gate>
              <Gate mod="review" need="full" className="btn dang" onClick={() => toast(t("Rejected with reason", "Wajah ke saath reject", "अस्वीकृत"))}>
                <X />
                {t("Reject", "Reject", "अस्वीकार")}
              </Gate>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- approvals (4-eyes) ---------------- */

export function Approvals() {
  const t = useT();
  const toast = useToast();
  const [tab, setTab] = useState("wait");
  const [decline, setDecline] = useState<string | null>(null);
  const items = [
    { id: "AP-118", what: t("Refund ₹6,499 to learner #48213 (Plus yearly, charged twice)", "Learner #48213 ko ₹6,499 refund (Plus yearly, do baar kata)", "₹6,499 रिफ़ंड"), who: "Rohit Nair", role: "Support", rule: t("Refund over ₹5,000", "₹5,000 se bada refund", "₹5,000+ रिफ़ंड"), when: "10:12", mine: false },
    { id: "AP-117", what: t("Change role: Anil Gupta Editor → Content admin", "Role badlo: Anil Gupta Editor → Content admin", "भूमिका बदलें"), who: "Sana Qureshi", role: "Super admin", rule: t("Role change", "Role badlaav", "भूमिका बदलाव"), when: "09:20", mine: false },
    { id: "AP-116", what: t("Turn the AI kill switch OFF for Hint mode", "Hint mode ka AI kill switch OFF", "किल स्विच बंद"), who: "Meera Iyer", role: "Super admin", rule: t("AI kill switch off", "AI kill switch off", "किल स्विच"), when: "08:55", mine: true },
  ];
  return (
    <div className="col g16">
      <AdmHead
        title={t("Approvals (4-eyes)", "Approvals (4-eyes)", "दोहरी मंज़ूरी")}
        sub={t("Risky actions wait here until a second person approves. You can't approve your own request.", "Risky kaam yahan doosre insaan ki manzoori tak rukte hain. Apni request khud approve nahi kar sakte.", "जोखिम वाले कार्य।")}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "wait", label: t("Waiting", "Baaki", "प्रतीक्षा"), count: 3 },
          { id: "done", label: t("Decided", "Faisla hua", "निर्णीत") },
        ]}
      />
      {tab === "wait" ? (
        <div className="col g10">
          {items.map((a) => (
            <section key={a.id} className="card appr">
              <div className="appr-ic">
                <StampIcon />
              </div>
              <div className="grow col g6" style={{ minWidth: 0 }}>
                <div className="row wrap g8">
                  <span className="tiny mono faint">{a.id}</span>
                  <Badge tone="red">{a.rule}</Badge>
                  {a.mine && <Badge>{t("Your request", "Aapki request", "आपका अनुरोध")}</Badge>}
                </div>
                <b className="h3">{a.what}</b>
                <span className="small muted">
                  {t("Asked by", "Maanga", "द्वारा")} {a.who} ({a.role}) · {a.when} · {t("reason", "wajah", "कारण")}: “
                  {a.id === "AP-118" ? "Razorpay shows two captures for order 7712" : a.id === "AP-117" ? "Anil leads the DP content sprint" : "Evals back above target after prompt v12"}”
                </span>
              </div>
              <div className="row g8">
                <button className="btn" disabled={a.mine} onClick={() => setDecline(a.id)}>
                  <X />
                  {t("Decline", "Mana", "अस्वीकार")}
                </button>
                <Gate mod="approvals" need="full" className={`btn ok ${a.mine ? "gated" : ""}`} onClick={() => (a.mine ? undefined : toast(t("Approved · action ran · logged", "Approve · kaam chala · log", "स्वीकृत")))}>
                  <Check />
                  {a.mine ? t("Can't approve own", "Apna nahi", "अपना नहीं") : t("Approve", "Approve", "स्वीकृत")}
                </Gate>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Card pad={false}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{t("Action", "Kaam", "कार्य")}</th>
                  <th>{t("Asked", "Maanga", "माँगा")}</th>
                  <th>{t("Decided", "Faisla", "निर्णय")}</th>
                  <th>{t("Result", "Nateeja", "परिणाम")}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["AP-115", "Delete problem P-1990 (duplicate of P-1201)", "Kunal", "Meera", "ok"],
                  ["AP-114", "Refund ₹7,999 (campus seat)", "Rohit", "Farah (Finance)", "ok"],
                  ["AP-113", "Ban user @spam_bot_22", "Vikram (Mod)", "Sana", "no"],
                ].map(([id, a, b, c, r]) => (
                  <tr key={id}>
                    <td className="mono tiny">{id}</td>
                    <td>{a}</td>
                    <td>{b}</td>
                    <td>{c}</td>
                    <td>{r === "ok" ? <Status s="live">{t("Approved", "Approved", "स्वीकृत")}</Status> : <Status s="bad">{t("Declined", "Declined", "अस्वीकृत")}</Status>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Modal
        open={!!decline}
        onClose={() => setDecline(null)}
        title={t("Decline this request?", "Ye request mana karein?", "अस्वीकार करें?")}
        footer={
          <>
            <button className="btn ghost" onClick={() => setDecline(null)}>
              {t("Back", "Wapas", "वापस")}
            </button>
            <button
              className="btn dang"
              onClick={() => {
                setDecline(null);
                toast(t("Declined · requester notified", "Mana · requester ko bataya", "अस्वीकृत"));
              }}
            >
              {t("Decline", "Mana karo", "अस्वीकार")}
            </button>
          </>
        }
      >
        <div className="field">
          <label>{t("Reason", "Wajah", "कारण")}</label>
          <textarea className="textarea" />
        </div>
      </Modal>
    </div>
  );
}

