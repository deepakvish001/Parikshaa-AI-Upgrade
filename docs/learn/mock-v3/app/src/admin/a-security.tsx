import { Fragment, useState } from "react";
import {
  Plus,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  LogOut,
  RotateCcw,
  Download,
  Link2,
  ChevronDown,
  ChevronRight,
  Globe,
  Timer,
  Users,
  Fingerprint,
  FileLock2,
  Server,
  Database,
  Cpu,
  Bot,
  Mail,
  Construction,
  Copy,
  Trash2,
  UserCog,
} from "lucide-react";
import { useT, useToast } from "../lib/core";
import { useRole, ROLES, MATRIX, type Access, type Role } from "../lib/state";
import { Badge, Card, Tabs, Toggle, Avatar, Modal, Spark, Meter } from "../ui/kit";
import { useTri } from "../ui/shell";
import { AdmHead, Gate, Toolbar, Pager, RowMenu, Status, FourEyes } from "./akit";

const MODS: [string, string][] = [
  ["dashboard", "Dashboard"],
  ["content", "Content"],
  ["review", "Review & publish"],
  ["factory", "Content factory"],
  ["learners", "Learners"],
  ["recruiters", "Recruiters & links"],
  ["support", "Support"],
  ["community", "Community"],
  ["commerce", "Payments"],
  ["contests", "Contests"],
  ["ai", "Sahayak AI"],
  ["analytics", "Analytics"],
  ["notify", "Messages"],
  ["approvals", "Approvals"],
  ["audit", "Audit log"],
  ["security", "Security & staff"],
  ["system", "System"],
  ["runtime", "Runtimes & integrations"],
];
const ORDER: Access[] = ["none", "view", "own", "edit", "full"];
const ACC_LABEL: Record<Access, string> = { none: "—", view: "View", own: "Own", edit: "Edit", full: "Full" };

/* ---------------- roles ---------------- */

export function AdmRoles() {
  const t = useT();
  const tri = useTri();
  const { can } = useRole();
  const [m, setM] = useState(() => JSON.parse(JSON.stringify(MATRIX)) as typeof MATRIX);
  const [focus, setFocus] = useState<Role>("editor");
  const [dirty, setDirty] = useState(0);
  const [save, setSave] = useState(false);
  const [custom, setCustom] = useState(false);
  const edit = can("security", "full");
  const cycle = (mod: string, r: Role) => {
    if (!edit || r === "super") return;
    setM((x) => {
      const cur = x[mod][r];
      const nx = ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length];
      return { ...x, [mod]: { ...x[mod], [r]: nx } };
    });
    setDirty((d) => d + 1);
  };
  return (
    <div className="col g16">
      <AdmHead
        title={t("Roles & permissions", "Roles aur permissions", "भूमिकाएँ और अनुमतियाँ")}
        sub={t("Least access by default. Click a cell to change it; changes need a second super admin.", "Kam se kam access. Cell dabao to badlo; badlav ke liye doosra super admin.", "सेल दबाकर बदलें; दूसरी मंज़ूरी चाहिए।")}
        actions={
          <Gate mod="security" need="full" className="btn pri" onClick={() => setCustom(true)}>
            <Plus />
            {t("Custom role", "Custom role", "कस्टम भूमिका")}
          </Gate>
        }
      />
      <div className="roles-grid">
        <div className="role-list">
          {ROLES.map((r) => (
            <button key={r.id} className={`role-card ${focus === r.id ? "on" : ""}`} onClick={() => setFocus(r.id)}>
              <span className="row between">
                <b className="small">{tri(r.name)}</b>
                <span className="tiny faint num">
                  <Users style={{ width: 12, height: 12, verticalAlign: -2 }} /> {r.people}
                </span>
              </span>
              <span className="tiny muted">{r.desc}</span>
            </button>
          ))}
        </div>
        <Card pad={false}>
          <div className="tbl-wrap" tabIndex={0}>
            <table className="tbl perm-matrix">
              <thead>
                <tr>
                  <th>{t("Module", "Module", "मॉड्यूल")}</th>
                  {ROLES.map((r) => (
                    <th key={r.id} className={focus === r.id ? "focus" : ""} onClick={() => setFocus(r.id)}>
                      {tri(r.name).split(" ")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODS.map(([id, label]) => (
                  <tr key={id}>
                    <td className="small">{label}</td>
                    {ROLES.map((r) => {
                      const a = m[id]?.[r.id] ?? "none";
                      const changed = a !== MATRIX[id]?.[r.id];
                      return (
                        <td key={r.id} className={focus === r.id ? "focus" : ""}>
                          <button className={`perm ${a} ${changed ? "changed" : ""}`} onClick={() => cycle(id, r.id)} disabled={!edit || r.id === "super"} aria-label={`${label} · ${r.id}: ${a}`}>
                            {ACC_LABEL[a]}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-f wrap">
            <span className="perm-legend">
              {(["full", "edit", "own", "view", "none"] as Access[]).map((a) => (
                <span key={a}>
                  <i className={`perm ${a}`}>{ACC_LABEL[a]}</i>
                  <span className="tiny faint">
                    {
                      {
                        full: t("everything incl. delete", "sab kuch, delete bhi", "सब कुछ"),
                        edit: t("create & change", "banao aur badlo", "बनाएँ, बदलें"),
                        own: t("only their own items", "sirf apne items", "केवल अपने"),
                        view: t("read only", "sirf padhna", "केवल पढ़ें"),
                        none: t("hidden", "chhupa", "छिपा"),
                      }[a]
                    }
                  </span>
                </span>
              ))}
            </span>
            <span className="grow" />
            {dirty > 0 && (
              <>
                <span className="tiny t-coin">
                  {dirty} {t("unsaved changes", "badlav save nahi", "बदलाव")}
                </span>
                <button
                  className="btn sm ghost"
                  onClick={() => {
                    setM(JSON.parse(JSON.stringify(MATRIX)));
                    setDirty(0);
                  }}
                >
                  {t("Undo", "Wapas", "वापस")}
                </button>
                <button className="btn sm pri" onClick={() => setSave(true)}>
                  {t("Send for approval", "Approval ke liye", "मंज़ूरी हेतु")}
                </button>
              </>
            )}
          </div>
        </Card>
      </div>
      <FourEyes open={save} onClose={() => setSave(false)} title={t("Change role permissions", "Role permissions badlo", "अनुमतियाँ बदलें")} what={`${dirty} cell(s) changed · takes effect on next sign-in of affected staff`} needs="Super admin" />
      <Modal
        open={custom}
        onClose={() => setCustom(false)}
        title={t("New custom role", "Naya custom role", "नई भूमिका")}
        sub={t("Starts with no access. Add only what the job needs.", "Shuru me koi access nahi. Sirf kaam jitna jodo.", "शुरुआत बिना पहुँच के।")}
        footer={
          <>
            <button className="btn ghost" onClick={() => setCustom(false)}>
              {t("Cancel", "Raho", "रद्द")}
            </button>
            <button className="btn pri" onClick={() => setCustom(false)}>
              {t("Create role", "Role banao", "बनाएँ")}
            </button>
          </>
        }
      >
        <div className="col g12">
          <div className="field">
            <label>{t("Name", "Naam", "नाम")}</label>
            <input aria-label={t("Name", "Naam", "नाम")} className="input" defaultValue="Campus success" />
          </div>
          <div className="field">
            <label>{t("Copy access from", "Access kahan se copy", "से कॉपी करें")}</label>
            <select aria-label={t("Copy access from", "Access kahan se copy", "से कॉपी करें")} className="select" defaultValue="support">
              {ROLES.filter((r) => r.id !== "super").map((r) => (
                <option key={r.id} value={r.id}>
                  {tri(r.name)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------- staff ---------------- */

const STAFF: { n: string; e: string; r: Role; tfa: "app" | "key" | "none"; last: string; ses: number; where: string }[] = [
  { n: "Shailesh M.", e: "s•••@parikshaa.in", r: "super", tfa: "key", last: "now", ses: 2, where: "Bengaluru · Chrome" },
  { n: "Ritu Verma", e: "r•••@parikshaa.in", r: "content", tfa: "app", last: "12 min", ses: 1, where: "Delhi · Firefox" },
  { n: "Irfan Ali", e: "i•••@parikshaa.in", r: "editor", tfa: "app", last: "1 h", ses: 1, where: "Lucknow · Chrome" },
  { n: "Megha Rao", e: "m•••@parikshaa.in", r: "reviewer", tfa: "app", last: "3 h", ses: 1, where: "Hyderabad · Edge" },
  { n: "Pooja Nair", e: "p•••@parikshaa.in", r: "support", tfa: "none", last: "invited", ses: 0, where: "—" },
  { n: "Dev Khanna", e: "d•••@parikshaa.in", r: "finance", tfa: "key", last: "yesterday", ses: 1, where: "Mumbai · Safari" },
  { n: "Sana Qureshi", e: "s•••@parikshaa.in", r: "moderator", tfa: "app", last: "2 d", ses: 0, where: "Pune · Chrome" },
  { n: "Arjun Bose", e: "a•••@parikshaa.in", r: "analyst", tfa: "app", last: "5 d", ses: 0, where: "Kolkata · Chrome" },
];

export function AdmStaff() {
  const t = useT();
  const tri = useTri();
  const toast = useToast();
  const [inv, setInv] = useState(false);
  const [risk, setRisk] = useState<{ title: string; what: string } | null>(null);
  const roleName = (r: Role) => tri(ROLES.find((x) => x.id === r)!.name);
  return (
    <div className="col g16">
      <AdmHead
        title={t("Staff", "Staff", "स्टाफ़")}
        sub={t("36 people · 2FA is required, there is no way to turn it off", "36 log · 2FA zaroori, band nahi ho sakta", "2FA अनिवार्य")}
        actions={
          <Gate mod="security" need="full" className="btn pri" onClick={() => setInv(true)}>
            <UserPlus />
            {t("Invite", "Invite karo", "आमंत्रित करें")}
          </Gate>
        }
      />
      <div className="banner coin">
        <ShieldAlert />
        <span className="small grow">{t("Pooja Nair has not set up 2FA. She cannot open anything until she does; the invite ends in 46 hours.", "Pooja Nair ne 2FA set nahi kiya. Jab tak nahi karti, kuch nahi khulega; invite 46 ghante me khatam.", "2FA बाकी है।")}</span>
        <button className="btn sm" onClick={() => toast(t("Invite sent again", "Invite dobara bheja", "फिर भेजा"))}>
          {t("Resend", "Dobara bhejo", "फिर भेजें")}
        </button>
      </div>
      <Card pad={false}>
        <Toolbar placeholder={t("Search staff", "Staff khojo", "स्टाफ़ खोजें")} filters={[{ label: "2FA missing" }, { label: "Inactive 30 d" }]} />
        <div className="tbl-wrap" tabIndex={0}>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t("Person", "Insaan", "व्यक्ति")}</th>
                <th>{t("Role", "Role", "भूमिका")}</th>
                <th>2FA</th>
                <th>{t("Last active", "Aakhri baar", "अंतिम सक्रिय")}</th>
                <th>{t("Sessions", "Sessions", "सत्र")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {STAFF.map((s, i) => (
                <tr key={s.n}>
                  <td>
                    <span className="row g10">
                      <Avatar name={s.n} size={30} tone={i} />
                      <span className="col">
                        <b className="small">{s.n}</b>
                        <span className="tiny faint mono">{s.e}</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <Badge tone={s.r === "super" ? "red" : ""}>{roleName(s.r)}</Badge>
                  </td>
                  <td>
                    {s.tfa === "none" ? (
                      <Status s="bad">{t("Not set", "Set nahi", "नहीं")}</Status>
                    ) : (
                      <Status s="live">{s.tfa === "key" ? t("Security key", "Security key", "सुरक्षा कुंजी") : t("Authenticator", "Authenticator", "ऑथेंटिकेटर")}</Status>
                    )}
                  </td>
                  <td className="small muted">{s.last}</td>
                  <td>
                    <span className="col">
                      <span className="small num">{s.ses}</span>
                      <span className="tiny faint">{s.where}</span>
                    </span>
                  </td>
                  <td>
                    <RowMenu
                      items={[
                        { label: t("Change role", "Role badlo", "भूमिका बदलें"), icon: <UserCog />, onClick: () => setRisk({ title: `${t("Change role of", "Role badlo:", "भूमिका बदलें:")} ${s.n}`, what: `${roleName(s.r)} → ?` }) },
                        { label: t("Sign out everywhere", "Har jagah se sign out", "सब जगह साइन आउट"), icon: <LogOut />, onClick: () => toast(t("All sessions ended · logged", "Saare sessions band · log", "सत्र समाप्त")) },
                        { label: t("Reset 2FA", "2FA reset", "2FA रीसेट"), icon: <RotateCcw />, onClick: () => setRisk({ title: `${t("Reset 2FA for", "2FA reset:", "2FA रीसेट:")} ${s.n}`, what: t("They must set it up again on next sign-in. Confirm their identity on a video call first.", "Agli baar dobara set karna hoga. Pehle video call par pehchaan pakki karo.", "पहचान पक्की करें।") }) },
                        { label: t("Remove from staff", "Staff se hatao", "हटाएँ"), icon: <Trash2 />, danger: true, onClick: () => setRisk({ title: `${t("Remove", "Hatao", "हटाएँ")} ${s.n}`, what: t("Access ends at once. Their past actions stay in the audit log.", "Access turant khatam. Purane kaam audit log me rahenge.", "पहुँच तुरंत समाप्त।") }) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager shown="8" total="36" />
      </Card>
      <FourEyes open={!!risk} onClose={() => setRisk(null)} title={risk?.title ?? ""} what={risk?.what ?? ""} />
      <Modal
        open={inv}
        onClose={() => setInv(false)}
        title={t("Invite a staff member", "Staff ko invite karo", "स्टाफ़ आमंत्रण")}
        sub={t("Only @parikshaa.in addresses. The link works once and ends in 48 hours.", "Sirf @parikshaa.in pate. Link ek baar chalega, 48 ghante me khatam.", "केवल @parikshaa.in")}
        footer={
          <>
            <button className="btn ghost" onClick={() => setInv(false)}>
              {t("Cancel", "Raho", "रद्द")}
            </button>
            <button
              className="btn pri"
              onClick={() => {
                setInv(false);
                toast(t("Invite sent · logged", "Invite gaya · log", "भेजा गया"));
              }}
            >
              {t("Send invite", "Invite bhejo", "भेजें")}
            </button>
          </>
        }
      >
        <div className="col g12">
          <div className="field">
            <label>Email</label>
            <input aria-label="Email" className="input" defaultValue="neha@parikshaa.in" />
          </div>
          <div className="field">
            <label>{t("Role", "Role", "भूमिका")}</label>
            <select aria-label={t("Role", "Role", "भूमिका")} className="select" defaultValue="editor">
              {ROLES.filter((r) => r.id !== "super").map((r) => (
                <option key={r.id} value={r.id}>
                  {tri(r.name)} · {r.desc}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t("Access ends", "Access kab tak", "पहुँच समाप्ति")}</label>
            <select aria-label={t("Access ends", "Access kab tak", "पहुँच समाप्ति")} className="select" defaultValue="never">
              <option value="never">{t("No end date", "Koi end nahi", "कोई अंत नहीं")}</option>
              <option value="30">{t("30 days (contractor)", "30 din (contractor)", "30 दिन")}</option>
              <option value="90">{t("90 days", "90 din", "90 दिन")}</option>
            </select>
          </div>
          <span className="tiny faint">{t("Super admin can only be given by two super admins together.", "Super admin sirf do super admin milkar de sakte.", "सुपर एडमिन के लिए दो मंज़ूरी।")}</span>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------- audit ---------------- */

const LOG: { at: string; who: string; role: string; act: string; obj: string; why?: string; ip: string; tone: "live" | "review" | "bad" | "info"; before?: string; after?: string }[] = [
  { at: "20 Oct · 14:32:08", who: "Ritu Verma", role: "Content admin", act: "Published", obj: "Problem · Rotting oranges v4", ip: "103.21.x.x", tone: "live", before: '"status": "in_review",\n"tests": 38', after: '"status": "live",\n"tests": 41' },
  { at: "20 Oct · 14:05:51", who: "Dev Khanna", role: "Finance", act: "Asked refund", obj: "Order 7712 · ₹6,499", why: "Charged twice by Razorpay", ip: "49.36.x.x", tone: "review" },
  { at: "20 Oct · 13:48:19", who: "Pooja Nair", role: "Support", act: "Revealed email", obj: "Learner #48213", why: "Ticket #T-5512: login issue", ip: "157.48.x.x", tone: "info" },
  { at: "20 Oct · 12:10:44", who: "Shailesh M.", role: "Super admin", act: "Killed AI mode", obj: "Sahayak · interview", why: "Eval fell to 88%", ip: "106.51.x.x", tone: "bad", before: '"interview": "on"', after: '"interview": "off"' },
  { at: "20 Oct · 11:02:37", who: "Sana Qureshi", role: "Moderator", act: "Muted 7 days", obj: "@zz_top", why: "Spam links ×4", ip: "117.99.x.x", tone: "review" },
  { at: "20 Oct · 10:15:02", who: "system", role: "—", act: "Failed sign-in ×5", obj: "unknown@gmail.com", ip: "185.220.x.x", tone: "bad" },
  { at: "19 Oct · 22:41:10", who: "Irfan Ali", role: "Editor", act: "Edited", obj: "Lesson · Two pointers · block 4", ip: "152.58.x.x", tone: "info", before: "“move both pointers”", after: "“move the pointer at the smaller value”" },
];

export function AdmAudit() {
  const t = useT();
  const toast = useToast();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="col g16">
      <AdmHead
        title={t("Audit log", "Audit log", "ऑडिट लॉग")}
        sub={t("Every change and every reveal of learner data. Nobody can edit or delete a row, not even a super admin.", "Har badlav aur learner data ka har reveal. Koi row badal ya mita nahi sakta, super admin bhi nahi.", "कोई पंक्ति बदली नहीं जा सकती।")}
        actions={
          <Gate mod="audit" need="view" className="btn" onClick={() => toast(t("Export prepared · download link valid 10 min · logged", "Export taiyaar · link 10 min · log", "निर्यात तैयार"))}>
            <Download />
            {t("Export CSV", "CSV export", "CSV निर्यात")}
          </Gate>
        }
      />
      <div className="banner tick">
        <Link2 />
        <span className="small grow">
          {t("Chain verified: each row carries the hash of the one before it. Last check 14:35, 1,20,418 rows, no gaps.", "Chain sahi: har row me pichhli row ka hash. Aakhri jaanch 14:35, 1,20,418 rows, koi gap nahi.", "श्रृंखला सत्यापित।")}
        </span>
        <Badge tone="tick" icon={<ShieldCheck />}>
          {t("Tamper-evident", "Chhedchhad dikhegi", "छेड़छाड़-प्रकट")}
        </Badge>
      </div>
      <Card pad={false}>
        <Toolbar
          placeholder={t("Person, object or IP", "Insaan, object ya IP", "व्यक्ति, वस्तु, IP")}
          filters={[{ label: t("Learner data", "Learner data", "शिक्षार्थी डेटा") }, { label: t("Money", "Paisa", "पैसा") }, { label: t("Failed sign-ins", "Galat sign-in", "विफल साइन इन") }, { label: t("Today", "Aaj", "आज"), on: true }]}
        />
        <div className="tbl-wrap" tabIndex={0}>
          <table className="tbl audit-tbl">
            <thead>
              <tr>
                <th />
                <th>{t("When (IST)", "Kab (IST)", "कब")}</th>
                <th>{t("Who", "Kaun", "कौन")}</th>
                <th>{t("Did", "Kya kiya", "क्या किया")}</th>
                <th>{t("On", "Kis par", "किस पर")}</th>
                <th>{t("Reason", "Wajah", "कारण")}</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {LOG.map((l, i) => (
                <Fragment key={i}>
                  <tr className={open === i ? "open" : ""} onClick={() => l.before && setOpen(open === i ? null : i)} style={{ cursor: l.before ? "pointer" : "default" }}>
                    <td style={{ width: 28 }}>{l.before ? open === i ? <ChevronDown className="faint" style={{ width: 14, height: 14 }} /> : <ChevronRight className="faint" style={{ width: 14, height: 14 }} /> : null}</td>
                    <td className="mono tiny nowrap">{l.at}</td>
                    <td>
                      <span className="col">
                        <span className="small">{l.who}</span>
                        <span className="tiny faint">{l.role}</span>
                      </span>
                    </td>
                    <td>
                      <Status s={l.tone}>{l.act}</Status>
                    </td>
                    <td className="small">{l.obj}</td>
                    <td className="small muted">{l.why ?? "—"}</td>
                    <td className="mono tiny faint">{l.ip}</td>
                  </tr>
                  {open === i && l.before && (
                    <tr className="diff-row">
                      <td />
                      <td colSpan={6}>
                        <div className="before-after">
                          <div>
                            <span className="tiny faint">{t("Before", "Pehle", "पहले")}</span>
                            <pre className="diff-del">{l.before}</pre>
                          </div>
                          <div>
                            <span className="tiny faint">{t("After", "Baad", "बाद")}</span>
                            <pre className="diff-add">{l.after}</pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <Pager shown="7" total="1,20,418" />
      </Card>
      <p className="tiny faint">{t("Kept for 3 years. Learner data inside log rows is masked; the reveal itself is logged.", "3 saal rakha jata. Log me learner data masked; reveal bhi log hota.", "3 वर्ष तक रखा जाता है।")}</p>
    </div>
  );
}

/* ---------------- security settings ---------------- */

export function AdmSecurity() {
  const t = useT();
  const toast = useToast();
  const { can } = useRole();
  const full = can("security", "full");
  const [sso, setSso] = useState(true);
  const [ips, setIps] = useState(["103.21.244.0/22 · Office Bengaluru", "49.36.0.0/16 · Office VPN"]);
  const [ask, setAsk] = useState<{ title: string; what: string } | null>(null);
  const [tab, setTab] = useState("signin");
  return (
    <div className="col g16">
      <AdmHead title={t("Security settings", "Security settings", "सुरक्षा सेटिंग")} sub={t("Changes here need a second super admin and are logged.", "Yahan badlav ke liye doosra super admin, aur log hota hai.", "दूसरी मंज़ूरी चाहिए।")} />
      <div className="sec-score">
        {[
          [t("2FA on all staff", "Sab staff par 2FA", "सभी पर 2FA"), "35/36", "coin"],
          [t("SSO", "SSO", "SSO"), "Google Workspace", "tick"],
          [t("IP allowlist", "IP allowlist", "IP सूची"), t("2 ranges", "2 range", "2 रेंज"), "tick"],
          [t("Idle sign-out", "Idle sign-out", "निष्क्रिय साइन आउट"), "30 min", "tick"],
          [t("Open DPDP requests", "Khuli DPDP requests", "DPDP अनुरोध"), "3", "coin"],
        ].map(([k, v, tone]) => (
          <div key={k} className={`sec-tile ${tone}`}>
            <span className="tiny">{k}</span>
            <b>{v}</b>
          </div>
        ))}
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "signin", label: t("Sign-in", "Sign-in", "साइन इन") },
          { id: "net", label: t("Network & sessions", "Network aur sessions", "नेटवर्क") },
          { id: "rules", label: t("4-eyes rules", "4-eyes niyam", "दोहरी मंज़ूरी") },
          { id: "data", label: t("Learner data", "Learner data", "शिक्षार्थी डेटा") },
          { id: "keys", label: t("API keys", "API keys", "API कुंजियाँ") },
          { id: "dpdp", label: "DPDP", count: 3 },
        ]}
      />
      {tab === "signin" && (
        <Card pad={false}>
          <div className="set-rows">
            <div className="set-row">
              <div>
                <b className="small row g6">
                  <Fingerprint style={{ width: 15, height: 15 }} /> {t("Two-factor sign-in", "Two-factor sign-in", "दो-चरण साइन इन")}
                </b>
                <p className="tiny faint">{t("Always on for staff. Security key or authenticator app; SMS is not allowed.", "Staff ke liye hamesha on. Security key ya authenticator; SMS nahi.", "हमेशा चालू।")}</p>
              </div>
              <Badge tone="tick">{t("Required · locked", "Zaroori · locked", "अनिवार्य")}</Badge>
            </div>
            <div className="set-row">
              <div>
                <b className="small">{t("Sign in with Google Workspace (SSO)", "Google Workspace se sign in (SSO)", "SSO")}</b>
                <p className="tiny faint">{t("Only @parikshaa.in. Leaving the company ends access everywhere.", "Sirf @parikshaa.in. Company chhodte hi access khatam.", "केवल @parikshaa.in")}</p>
              </div>
              <Toggle
                on={sso}
                onChange={(v) => {
                  if (!full) return;
                  if (!v) setAsk({ title: t("Turn off SSO", "SSO band karo", "SSO बंद"), what: t("Staff will sign in with email + 2FA only.", "Staff sirf email + 2FA se aayenge.", "केवल ईमेल + 2FA") });
                  else setSso(true);
                }}
                label="SSO"
              />
            </div>
            <div className="set-row">
              <div>
                <b className="small">{t("New device check", "Naya device check", "नया डिवाइस")}</b>
                <p className="tiny faint">{t("Email to the person and to security when someone signs in from a new device or city.", "Naye device ya shehar se sign-in par email.", "नए डिवाइस पर ईमेल।")}</p>
              </div>
              <Toggle on onChange={() => {}} label="New device check" />
            </div>
            <div className="set-row">
              <div>
                <b className="small">{t("Lock after failed tries", "Galat koshish par lock", "विफल प्रयास पर लॉक")}</b>
                <p className="tiny faint">{t("5 wrong tries → 15 minute lock, and an alert", "5 galat → 15 minute lock, alert", "5 गलत → 15 मिनट")}</p>
              </div>
              <input className="input sm" style={{ width: 90 }} defaultValue="5" disabled={!full} aria-label={t("Wrong tries before lock", "Lock se pehle galat koshish", "लॉक से पहले गलत प्रयास")} />
            </div>
          </div>
        </Card>
      )}
      {tab === "net" && (
        <div className="grid c2">
          <Card title={t("IP allowlist", "IP allowlist", "IP सूची")} icon={<Globe className="ic" />}>
            <div className="col g8">
              {ips.map((ip) => (
                <div key={ip} className="row g8 ip-row">
                  <span className="mono small grow">{ip}</span>
                  <button className="icon-btn sm" disabled={!full} aria-label="Remove range" onClick={() => setIps((x) => x.filter((y) => y !== ip))}>
                    <Trash2 />
                  </button>
                </div>
              ))}
              <div className="row g8">
                <input className="input sm grow" placeholder="CIDR, e.g. 152.58.0.0/16" disabled={!full} aria-label={t("Add an IP range", "IP range jodo", "IP रेंज जोड़ें")} />
                <button className="btn sm" disabled={!full} onClick={() => setAsk({ title: t("Add IP range", "IP range jodo", "IP जोड़ें"), what: "152.58.0.0/16 · Home VPN" })}>
                  <Plus />
                  {t("Add", "Jodo", "जोड़ें")}
                </button>
              </div>
              <span className="tiny faint">{t("Learner-data pages and payments open only from these ranges.", "Learner data aur payments sirf in range se khulte.", "केवल इन रेंज से।")}</span>
            </div>
          </Card>
          <Card title={t("Sessions", "Sessions", "सत्र")} icon={<Timer className="ic" />}>
            <div className="col g12">
              {[
                [t("Sign out when idle", "Idle par sign out", "निष्क्रिय होने पर"), "30 min"],
                [t("Longest session", "Sabse lamba session", "सबसे लंबा सत्र"), "12 h"],
                [t("Ask 2FA again for risky actions", "Risky kaam par dobara 2FA", "जोखिम पर फिर 2FA"), t("after 15 min", "15 min baad", "15 मिनट बाद")],
              ].map(([k, v]) => (
                <div key={k} className="row between g12">
                  <span className="small">{k}</span>
                  <input className="input sm" style={{ width: 120 }} defaultValue={v} disabled={!full} aria-label={k} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
      {tab === "rules" && (
        <Card pad={false}>
          <div className="tbl-wrap" tabIndex={0}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("Action", "Kaam", "कार्य")}</th>
                  <th>{t("Second person", "Doosra insaan", "दूसरा व्यक्ति")}</th>
                  <th>{t("Expires", "Kab tak", "समाप्ति")}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Refund above ₹5,000", "Finance + Super admin", "24 h"],
                  ["Delete published content", "Content admin", "48 h"],
                  ["Change a role or give super admin", "Super admin (2)", "24 h"],
                  ["Export learner data", "Super admin", "24 h"],
                  ["Turn an AI mode back on", "Super admin", "12 h"],
                  ["Ban a learner", "Super admin or 2nd moderator", "48 h"],
                  ["Maintenance mode", "Super admin", "1 h"],
                ].map(([a, b, c]) => (
                  <tr key={a}>
                    <td className="small">{a}</td>
                    <td>
                      <Badge>{b}</Badge>
                    </td>
                    <td className="small muted">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-f">
            <span className="tiny faint">{t("Nobody can approve their own request.", "Koi apni request khud approve nahi kar sakta.", "अपना अनुरोध स्वयं मंज़ूर नहीं।")}</span>
          </div>
        </Card>
      )}
      {tab === "data" && (
        <Card pad={false}>
          <div className="set-rows">
            {[
              [t("Mask email and phone", "Email aur phone masked", "ईमेल, फ़ोन छिपाएँ"), t("Reveal needs a reason, logged with your name", "Reveal ke liye wajah, naam ke saath log", "कारण सहित")],
              [t("Hide AI chat text", "AI chat text chhupao", "AI चैट छिपाएँ"), t("Only flagged chats can be opened, with a reason", "Sirf flagged chat, wajah ke saath", "केवल फ़्लैग चैट")],
              [t("'View as learner' needs approval", "'Learner ki tarah dekho' par approval", "दूसरी मंज़ूरी"), t("Read-only, 30 minutes, learner is told", "Read-only, 30 min, learner ko bataya", "30 मिनट")],
              [t("Data stays in India", "Data India me", "डेटा भारत में"), t("Mumbai region; AI calls send no name or email", "Mumbai region; AI ko naam/email nahi", "मुंबई क्षेत्र")],
            ].map(([k, v]) => (
              <div key={k} className="set-row">
                <div>
                  <b className="small">{k}</b>
                  <p className="tiny faint">{v}</p>
                </div>
                <Toggle on onChange={() => {}} label={k} />
              </div>
            ))}
          </div>
        </Card>
      )}
      {tab === "keys" && (
        <Card pad={false}>
          <div className="tbl-wrap" tabIndex={0}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("Key", "Key", "कुंजी")}</th>
                  <th>{t("Can", "Kya kar sakti", "क्या कर सकती")}</th>
                  <th>{t("Last used", "Aakhri use", "अंतिम उपयोग")}</th>
                  <th>{t("Expires", "Khatam", "समाप्ति")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[
                  ["pk_live_campus_•••• 8f2a", "campus:read, seats:write", "2 min ago", "12 Jan 2027"],
                  ["pk_live_webhook_•••• 19cd", "webhooks:send", "now", "30 Nov 2026"],
                ].map(([k, s, u, e]) => (
                  <tr key={k}>
                    <td className="mono small">
                      <KeyRound style={{ width: 13, height: 13, verticalAlign: -2 }} /> {k}
                    </td>
                    <td className="tiny mono muted">{s}</td>
                    <td className="small muted">{u}</td>
                    <td className="small">{e}</td>
                    <td>
                      <span className="row g4">
                        <button className="btn sm" disabled={!full} onClick={() => toast(t("New key shown once · old key works 24 h more", "Nayi key ek baar dikhegi · purani 24 h aur", "नई कुंजी"))}>
                          <RotateCcw />
                          {t("Rotate", "Badlo", "बदलें")}
                        </button>
                        <button className="btn sm dang" disabled={!full}>
                          {t("Revoke", "Radd", "रद्द")}
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-f">
            <span className="tiny faint grow">{t("Full keys are shown once at creation and never again.", "Poori key sirf banate waqt ek baar dikhti.", "कुंजी एक बार दिखती है।")}</span>
            <button className="btn sm" disabled={!full}>
              <Plus />
              {t("New key", "Nayi key", "नई कुंजी")}
            </button>
          </div>
        </Card>
      )}
      {tab === "dpdp" && (
        <Card pad={false}>
          <div className="list">
            {[
              ["Export my data", "Learner #51022", "21 days left", "info"],
              ["Delete my account", "Learner #48890", "4 days left", "review"],
              ["Correct my name", "Learner #50117", "28 days left", "info"],
            ].map(([k, w, d, s]) => (
              <div key={w} className="li">
                <FileLock2 style={{ width: 18, height: 18, color: "var(--ink-3)" }} />
                <span className="grow col">
                  <b className="small">{k}</b>
                  <span className="tiny faint">
                    {w} · {t("verified by OTP", "OTP se pakka", "OTP से सत्यापित")}
                  </span>
                </span>
                <Status s={s as "info"}>{d}</Status>
                <Gate mod="security" need="full" className="btn sm" onClick={() => setAsk({ title: `${k} · ${w}`, what: t("We reply within 30 days as DPDP Act 2023 asks. Payment records we must keep by law are kept.", "DPDP Act 2023 ke mutabik 30 din me jawab. Kanooni payment record rakhe jaate.", "30 दिन में उत्तर।") })}>
                  {t("Handle", "Karo", "करें")}
                </Gate>
              </div>
            ))}
          </div>
        </Card>
      )}
      <FourEyes open={!!ask} onClose={() => setAsk(null)} title={ask?.title ?? ""} what={ask?.what ?? ""} />
    </div>
  );
}

/* ---------------- system ---------------- */

export function AdmSystem() {
  const t = useT();
  const toast = useToast();
  const [maint, setMaint] = useState(false);
  const [flags, setFlags] = useState<Record<string, number>>({ "studio-v2": 25, "hindi-editorials": 100, "voice-interview": 0, "new-sheet-order": 10 });
  const svc: [string, typeof Server, string, number[], "live" | "review"][] = [
    ["API", Server, "99.98% · p95 180 ms", [3, 4, 3, 5, 4, 3, 4, 3, 5, 4, 3, 4], "live"],
    [t("Code judge", "Code judge", "कोड जज"), Cpu, "99.95% · queue 12", [6, 8, 7, 9, 12, 8, 7, 6, 9, 8, 12, 10], "live"],
    [t("Database", "Database", "डेटाबेस"), Database, "99.99% · 41% CPU", [40, 38, 42, 41, 44, 39, 41, 40, 43, 41, 42, 41], "live"],
    [t("AI provider", "AI provider", "एआई प्रदाता"), Bot, t("slow · p95 6.2 s", "dheema · p95 6.2 s", "धीमा"), [2, 2, 3, 3, 4, 5, 6, 6, 5, 6, 7, 6], "review"],
    [t("Email & WhatsApp", "Email aur WhatsApp", "ईमेल, व्हाट्सऐप"), Mail, "99.9% · 0 bounced", [1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 1], "live"],
  ];
  return (
    <div className="col g16">
      <AdmHead
        title={t("System", "System", "सिस्टम")}
        sub={t("Health, feature flags, maintenance and site settings", "Health, feature flags, maintenance, settings", "स्वास्थ्य, फ़्लैग, सेटिंग")}
        actions={
          <button className={`btn ${maint ? "pri" : ""}`} onClick={() => (maint ? setMaint(false) : toast(t("Sent for approval · maintenance starts after a second super admin agrees", "Approval ke liye · doosre super admin ke baad", "मंज़ूरी हेतु")))}>
            <Construction />
            {t("Maintenance mode", "Maintenance mode", "रखरखाव मोड")}
          </button>
        }
      />
      <div className="health-grid">
        {svc.map(([n, Ic, d, data, s]) => (
          <section key={n} className={`card pad h-tile ${s}`}>
            <span className="row g8">
              <Ic style={{ width: 16, height: 16 }} />
              <b className="small grow">{n}</b>
              <Status s={s}>{s === "live" ? "OK" : t("Slow", "Dheema", "धीमा")}</Status>
            </span>
            <Spark data={data} w={200} h={36} color={s === "live" ? "var(--tick)" : "var(--coin)"} />
            <span className="tiny faint num">{d}</span>
          </section>
        ))}
      </div>
      <div className="grid c2">
        <Card title={t("Feature flags", "Feature flags", "फ़ीचर फ़्लैग")} pad={false}>
          <div className="set-rows">
            {Object.entries(flags).map(([k, v]) => (
              <div key={k} className="set-row">
                <div className="grow" style={{ minWidth: 0 }}>
                  <b className="small mono">{k}</b>
                  <div className="row g8 mt4">
                    <Meter v={v} tone={v === 100 ? "tick" : v === 0 ? "ink-4" : "pen"} />
                    <span className="tiny num" style={{ width: 36 }}>
                      {v}%
                    </span>
                  </div>
                </div>
                <select className="select sm" value={v} onChange={(e) => setFlags((f) => ({ ...f, [k]: Number(e.target.value) }))} style={{ width: 92 }} aria-label={`${k}: ${t("share of learners", "learners ka hissa", "शिक्षार्थियों का हिस्सा")}`}>
                  {[0, 10, 25, 50, 100].map((p) => (
                    <option key={p} value={p}>
                      {p}%
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </Card>
        <Card title={t("Site settings", "Site settings", "साइट सेटिंग")}>
          <div className="col g12">
            {[
              [t("Support email", "Support email", "सहायता ईमेल"), "help@parikshaa.in"],
              [t("Default language", "Default bhasha", "डिफ़ॉल्ट भाषा"), "Hinglish"],
              [t("Time zone", "Time zone", "समय क्षेत्र"), "Asia/Kolkata (IST)"],
              [t("Banner message", "Banner sandesh", "बैनर संदेश"), ""],
            ].map(([k, v]) => (
              <div key={k} className="field">
                <label>{k}</label>
                <input aria-label={k} className="input" defaultValue={v} placeholder={t("Empty: no banner", "Khaali: koi banner nahi", "खाली")} />
              </div>
            ))}
            <div className="row g8">
              <button className="btn sm">
                <Copy />
                {t("Copy config as JSON", "Config JSON copy", "JSON कॉपी")}
              </button>
              <span className="grow" />
              <button className="btn sm pri" onClick={() => toast(t("Saved · logged", "Save · log", "सहेजा"))}>
                {t("Save", "Save", "सहेजें")}
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
