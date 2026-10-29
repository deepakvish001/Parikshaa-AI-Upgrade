import { useState } from "react";
import { Cpu, Globe, Zap, Server, KeyRound, Link2, Eye, Ban, Clock, ShieldAlert, BadgeCheck, CircleCheck, TriangleAlert, CircleX, Pause, RefreshCw, Building2, Flag, Mail } from "lucide-react";
import { useT, useToast } from "../lib/core";
import { Badge, Card, Meter, Tabs, Toggle } from "../ui/kit";
import { AdmHead, Gate, Toolbar, Status, FourEyes, RowMenu, Pager } from "./akit";

/* ---------------- runtimes and integrations ---------------- */

export function AdmRuntime() {
  const t = useT();
  const toast = useToast();
  const [tab, setTab] = useState("run");
  const [gpu, setGpu] = useState(false);
  const [sites, setSites] = useState<Record<string, boolean>>({ cf: true, gh: true, lc: true, cc: true, kg: true, hr: false });
  return (
    <div className="col g16">
      <AdmHead
        title={t("Runtimes & integrations", "Runtimes aur integrations", "रनटाइम और इंटीग्रेशन")}
        sub={t("Where learner code runs, what it costs, and the outside services we depend on", "Learner ka code kahan chalta, kitna kharch, aur bahar ki kin services par nirbhar", "कोड कहाँ चलता है, खर्च")}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "run", label: t("Runtimes", "Runtimes", "रनटाइम") },
          { id: "sites", label: t("Linked coding sites", "Judi coding sites", "जुड़ी साइटें"), count: 1 },
          { id: "keys", label: t("Keys & services", "Keys aur services", "कुंजियाँ") },
        ]}
      />
      {tab === "run" && (
        <>
          <div className="rt-grid">
            {[
              [<Globe key="a" />, t("Browser (Pyodide, esbuild, SQL)", "Browser (Pyodide, esbuild, SQL)", "ब्राउज़र"), "4,210", t("sessions today", "aaj sessions", "आज सत्र"), "₹0", 12, "live", t("Runs on the learner's device", "Learner ke device par", "डिवाइस पर")],
              [<Cpu key="b" />, t("CPU jobs (sandbox, no internet)", "CPU jobs (sandbox, bina internet)", "CPU जॉब"), "6 / 10", t("workers busy · queue 3", "workers busy · queue 3", "वर्कर व्यस्त"), "₹1,840", 61, "live", t("p95 start 4.2 s · cap ₹4,000/day", "p95 start 4.2 s · cap ₹4,000/din", "सीमा ₹4,000")],
              [<Zap key="c" />, t("Colab hand-off", "Colab hand-off", "Colab"), "312 → 241", t("sent → came back (77%)", "gaye → wapas aaye (77%)", "गए → लौटे"), "₹0", 77, "live", t("Google's GPU; grade stays here", "Google ka GPU; grade yahin", "ग्रेड यहीं")],
              [<Server key="d" />, t("GPU labs (paid, advanced)", "GPU labs (paid, advanced)", "GPU लैब"), gpu ? "On" : "Off", t("needs a provider and budget", "provider aur budget chahiye", "प्रदाता चाहिए"), "—", 0, gpu ? "live" : "draft", t("Turning on needs a second person", "Chalu karne ke liye doosra insaan", "दूसरी मंज़ूरी")],
            ].map(([ic, n, v, k, cost, m, st, note], i) => (
              <Card key={i} className="rt-card">
                <div className="row between">
                  <span className="rt-ic">{ic}</span>
                  <Status s={st as "live" | "draft"}>{st === "live" ? t("Running", "Chal raha", "चालू") : t("Off", "Band", "बंद")}</Status>
                </div>
                <b className="small">{n as string}</b>
                <div className="row between">
                  <b className="num rt-v">{v as string}</b>
                  <span className="tiny faint">{cost as string} {t("today", "aaj", "आज")}</span>
                </div>
                <span className="tiny faint">{k as string}</span>
                <Meter v={m as number} tone={(m as number) > 80 ? "coin" : "pen"} size="thin" />
                <span className="tiny muted">{note as string}</span>
                {i === 3 && (
                  <Gate mod="runtime" need="full" className="btn sm" onClick={() => setGpu(true)}>
                    {t("Turn on GPU labs", "GPU labs chalu karo", "GPU चालू")}
                  </Gate>
                )}
              </Card>
            ))}
          </div>
          <Card title={t("Limits per plan", "Plan-war seema", "योजना-वार सीमा")} icon={<Clock className="ic" />} actions={<Gate mod="runtime" need="edit" className="btn sm">{t("Change limits", "Seema badlo", "सीमा बदलें")}</Gate>}>
            <div className="tbl-wrap" tabIndex={0}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t("Runtime", "Runtime", "रनटाइम")}</th>
                    <th>Free</th>
                    <th>Plus</th>
                    <th>Campus</th>
                    <th>{t("Cost each", "Har ek ka kharch", "प्रति लागत")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [t("Browser runs", "Browser runs", "ब्राउज़र"), t("no limit", "koi seema nahi", "असीमित"), t("no limit", "koi seema nahi", "असीमित"), t("no limit", "koi seema nahi", "असीमित"), "₹0"],
                    [t("Judge submits", "Judge submits", "सबमिट"), "100 / day", "1,000 / day", "1,000 / day", "₹0.005–0.03"],
                    [t("ML CPU jobs", "ML CPU jobs", "ML CPU"), "10 / day", "100 / day", "100 / day", "₹0.05–0.3"],
                    [t("Shell labs (microVM)", "Shell labs (microVM)", "शेल लैब"), "5 h / month", "40 h / month", "40 h / month", "$0.10–0.17 / h"],
                  ].map((r) => (
                    <tr key={r[0]}>
                      {r.map((c, j) => (
                        <td key={j} className={j === 4 ? "mono small" : j === 0 ? "" : "small"}>
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <span className="tiny faint">{t("From the Code Studio plan; prices are estimates until providers are chosen.", "Code Studio plan se; provider chunne tak daam andaaza hain.", "अनुमानित।")}</span>
          </Card>
          <FourEyes
            open={gpu}
            onClose={() => setGpu(false)}
            title={t("Turn on GPU labs", "GPU labs chalu karo", "GPU लैब चालू")}
            what={t("GPU labs start costing money per minute for Plus learners. Cap: ₹[...] a day.", "GPU labs Plus learners ke liye har minute kharch shuru karenge. Cap: ₹[...] roz.", "हर मिनट खर्च।")}
          />
        </>
      )}
      {tab === "sites" && (
        <>
          <div className="banner pen">
            <ShieldAlert />
            <span>
              {t(
                "We never store passwords for other sites. Each site is read the way it allows: an official API, sign-in (OAuth), or the public profile with a code the learner puts in their bio. If a site objects, turn it off here.",
                "Doosri sites ke password kabhi nahi rakhte. Har site waise padhi jaati hai jaise wo ijaazat de: official API, sign-in (OAuth), ya public profile + bio me code. Site aitraaz kare to yahin band karo.",
                "पासवर्ड कभी नहीं रखते।",
              )}
            </span>
          </div>
          <div className="tbl-wrap card">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("Site", "Site", "साइट")}</th>
                  <th>{t("How we read it", "Kaise padhte hain", "कैसे पढ़ते हैं")}</th>
                  <th className="num">{t("Linked learners", "Jude learners", "जुड़े")}</th>
                  <th>{t("Last sync", "Last sync", "सिंक")}</th>
                  <th>{t("Health", "Haalat", "स्थिति")}</th>
                  <th>{t("On", "Chalu", "चालू")}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["cf", "Codeforces", t("official API", "official API", "आधिकारिक API"), "3,104", "1 h", "ok"],
                  ["gh", "GitHub", "OAuth", "5,880", "3 h", "ok"],
                  ["lc", "LeetCode", t("public profile + bio code", "public profile + bio code", "प्रोफ़ाइल + कोड"), "8,412", "2 h", "warn"],
                  ["cc", "CodeChef", t("public profile + bio code", "public profile + bio code", "प्रोफ़ाइल + कोड"), "1,207", "1 d", "ok"],
                  ["kg", "Kaggle", t("profile link", "profile link", "प्रोफ़ाइल लिंक"), "420", "5 d", "ok"],
                  ["hr", "HackerRank", t("planned", "plan me", "योजना में"), "—", "—", "off"],
                ].map(([id, n, how, num, sync, h]) => (
                  <tr key={id}>
                    <td>
                      <b className="small">{n}</b>
                    </td>
                    <td className="small">{how}</td>
                    <td className="num">{num}</td>
                    <td className="small faint">{sync}</td>
                    <td>
                      {h === "ok" ? (
                        <span className="row g4 small t-tick">
                          <CircleCheck size={14} /> {t("OK", "Theek", "ठीक")}
                        </span>
                      ) : h === "warn" ? (
                        <span className="row g4 small t-coin" data-tip={t("Page layout changed 2 days ago; 14% of syncs fail", "2 din pehle page badla; 14% sync fail", "14% विफल")}>
                          <TriangleAlert size={14} /> {t("14% failing", "14% fail", "14% विफल")}
                        </span>
                      ) : (
                        <span className="row g4 small faint">
                          <CircleX size={14} /> {t("Not built", "Bana nahi", "नहीं बना")}
                        </span>
                      )}
                    </td>
                    <td>
                      <Toggle on={sites[id]} onChange={(v) => (setSites({ ...sites, [id]: v }), toast(v ? t(`${n} sync on`, `${n} sync chalu`, "चालू") : t(`${n} sync paused`, `${n} sync ruka`, "रुका")))} label={n} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row g8">
            <button className="btn sm" onClick={() => toast(t("Re-sync queued for 1,178 LeetCode profiles", "1,178 LeetCode profiles ka re-sync queue me", "री-सिंक"))}>
              <RefreshCw /> {t("Retry failed syncs", "Fail sync dobara", "फिर सिंक")}
            </button>
            <button className="btn sm ghost">
              <Pause /> {t("Pause all syncs", "Saare sync roko", "सब रोकें")}
            </button>
          </div>
        </>
      )}
      {tab === "keys" && (
        <>
          <div className="banner marker">
            <KeyRound />
            <span>
              {t(
                "Values never show here. Each key lives in GitHub → Settings → Environments; this page only says whether it is set and when it last changed.",
                "Value yahan kabhi nahi dikhti. Har key GitHub → Settings → Environments me rehti hai; ye page sirf batata hai set hai ya nahi aur kab badli.",
                "मान कभी नहीं दिखते।",
              )}
            </span>
          </div>
          <div className="tbl-wrap card">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("Service", "Service", "सेवा")}</th>
                  <th>{t("Used for", "Kis kaam", "किस काम")}</th>
                  <th>{t("Key name", "Key ka naam", "कुंजी")}</th>
                  <th>staging</th>
                  <th>production</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Anthropic", t("Sahayak, interviews, reviews", "Sahayak, interviews, reviews", "सहायक"), "ANTHROPIC_API_KEY", "set", "missing"],
                  ["Supabase", t("Database, files", "Database, files", "डेटाबेस"), "MIGRATE_DATABASE_URL", "set", "set"],
                  ["Judge0", t("Running code", "Code chalana", "कोड चलाना"), "JUDGE0_AUTH_TOKEN", "set", "missing"],
                  ["Google OAuth", t("Sign in, Drive for Colab", "Sign in, Colab ke liye Drive", "साइन इन, Drive"), "GOOGLE_CLIENT_ID / SECRET", "missing", "missing"],
                  ["GitHub OAuth", t("Linking GitHub", "GitHub jodna", "GitHub जोड़ना"), "GITHUB_OAUTH_ID / SECRET", "missing", "missing"],
                  ["Razorpay", t("Payments", "Payments", "भुगतान"), "RAZORPAY_KEY_ID / SECRET", "set", "missing"],
                  ["Email (SES)", t("Email", "Email", "ईमेल"), "SES role", "missing", "missing"],
                  ["WhatsApp", t("Reminders", "Reminders", "रिमाइंडर"), "WHATSAPP_TOKEN", "—", "missing"],
                ].map(([sv, use, k, st, pr]) => (
                  <tr key={sv}>
                    <td>
                      <b className="small">{sv}</b>
                    </td>
                    <td className="small">{use}</td>
                    <td className="mono tiny">{k}</td>
                    {[st, pr].map((v, j) => (
                      <td key={j}>{v === "set" ? <Status s="live">{t("set", "set", "सेट")}</Status> : v === "missing" ? <Status s="bad">{t("missing", "nahi", "नहीं")}</Status> : <span className="faint">—</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="tiny faint">{t("Sample status. The real page reads it from the deploy, never the secret.", "Sample haalat. Asli page deploy se padhega, secret kabhi nahi.", "नमूना स्थिति।")}</span>
        </>
      )}
    </div>
  );
}

/* ---------------- recruiters and share links ---------------- */

export function AdmRecruiters() {
  const t = useT();
  const toast = useToast();
  const [tab, setTab] = useState("links");
  const [susp, setSusp] = useState(false);
  return (
    <div className="col g16">
      <AdmHead
        title={t("Recruiters & share links", "Recruiters aur share links", "रिक्रूटर और लिंक")}
        sub={t("Who is looking at learners' profiles, through which link, and what went wrong", "Learners ki profile kaun dekh raha, kis link se, aur kya galat hua", "कौन देख रहा है")}
      />
      <div className="stat-strip" style={{ ["--n" as string]: 4 }}>
        {[
          [t("Active links", "Chalu links", "सक्रिय लिंक"), "1,284"],
          [t("Views this week", "Is hafte views", "इस सप्ताह दृश्य"), "3,920"],
          [t("Verified companies", "Verified companies", "सत्यापित कंपनियाँ"), "86"],
          [t("Open reports", "Khuli reports", "खुली रिपोर्ट"), "3"],
        ].map(([k, v]) => (
          <div key={k} className="stat">
            <span className="k">{k}</span>
            <span className="v">{v}</span>
          </div>
        ))}
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "links", label: t("Share links", "Share links", "साझा लिंक") },
          { id: "recr", label: t("Recruiters", "Recruiters", "रिक्रूटर"), count: 4 },
          { id: "rep", label: t("Reports", "Reports", "रिपोर्ट"), count: 3 },
        ]}
      />
      {tab === "links" && (
        <>
          <Toolbar placeholder={t("Search learner or company", "Learner ya company khojo", "खोजें")} filters={[{ label: t("Active", "Chalu", "सक्रिय"), on: true }, { label: t("Expiring in 3 days", "3 din me khatam", "3 दिन") }, { label: t("Revoked", "Band kiye", "रद्द") }]} />
          <div className="tbl-wrap card">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("Learner", "Learner", "शिक्षार्थी")}</th>
                  <th>{t("For", "Kiske liye", "किसके लिए")}</th>
                  <th className="num">{t("Views", "Views", "दृश्य")}</th>
                  <th>{t("Last view", "Last view", "अंतिम")}</th>
                  <th>{t("Expires", "Khatam", "समाप्त")}</th>
                  <th>{t("Status", "Haalat", "स्थिति")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[
                  ["Aarav Sharma", "Nimbu Labs · HR", "4", "2 h", "4 Nov", "live"],
                  ["Ishita Rao", "Tara Fintech", "2", t("yesterday", "kal", "कल"), "30 Oct", "live"],
                  ["Kabir Shah", t("public link", "public link", "सार्वजनिक"), "61", "10 min", "—", "live"],
                  ["Zoya Khan", "Kesar Cloud", "0", "—", "22 Oct", "review"],
                  ["Dev Mehta", "Unverified · gmail.com", "19", "1 h", "2 Nov", "bad"],
                ].map(([l, f, v, lv, ex, st]) => (
                  <tr key={l}>
                    <td>
                      <b className="small">{l}</b>
                    </td>
                    <td className="small">{f}</td>
                    <td className="num">{v}</td>
                    <td className="small faint">{lv}</td>
                    <td className="small">{ex}</td>
                    <td>
                      <Status s={st as "live" | "review" | "bad"}>{st === "live" ? t("Active", "Chalu", "सक्रिय") : st === "review" ? t("Expiring", "Khatam hone wala", "समाप्ति") : t("Flagged", "Flag", "फ़्लैग")}</Status>
                    </td>
                    <td>
                      <RowMenu
                        items={[
                          { label: t("See view log", "View log dekho", "लॉग देखें"), icon: <Eye /> },
                          { label: t("Copy link", "Link copy", "लिंक कॉपी"), icon: <Link2 /> },
                          { label: t("Revoke link", "Link band karo", "लिंक रद्द"), icon: <Ban />, danger: true, onClick: () => toast(t("Link revoked · learner told", "Link band · learner ko bataya", "लिंक रद्द")) },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total="1,284" shown="1–5" />
        </>
      )}
      {tab === "recr" && (
        <div className="tbl-wrap card">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t("Company", "Company", "कंपनी")}</th>
                <th>{t("People", "Log", "लोग")}</th>
                <th>{t("Domain", "Domain", "डोमेन")}</th>
                <th>{t("Last active", "Last active", "अंतिम सक्रिय")}</th>
                <th>{t("Status", "Haalat", "स्थिति")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[
                ["Nimbu Labs", "3", "nimbulabs.in", "2 h", "live"],
                ["Tara Fintech", "1", "tarafin.co", t("yesterday", "kal", "कल"), "live"],
                ["Kesar Cloud", "2", "kesar.cloud", "3 d", "live"],
                ["Bright Careers (agency)", "1", t("gmail.com, not verified", "gmail.com, verify nahi", "सत्यापित नहीं"), "1 h", "review"],
              ].map(([c, p, d, a, st]) => (
                <tr key={c}>
                  <td>
                    <span className="row g8">
                      <Building2 size={15} className="faint" />
                      <b className="small">{c}</b>
                    </span>
                  </td>
                  <td className="num">{p}</td>
                  <td className="small mono">
                    {st === "live" && <BadgeCheck size={13} className="t-tick" />} {d}
                  </td>
                  <td className="small faint">{a}</td>
                  <td>
                    <Status s={st as "live" | "review"}>{st === "live" ? t("Verified", "Verified", "सत्यापित") : t("Waiting for domain proof", "Domain proof ka intezaar", "प्रमाण प्रतीक्षित")}</Status>
                  </td>
                  <td>
                    {st === "review" ? (
                      <Gate mod="recruiters" need="edit" className="btn sm" onClick={() => toast(t("Asked for a company email to verify", "Verify ke liye company email maanga", "ईमेल माँगा"))}>
                        <Mail /> {t("Ask to verify", "Verify karne ko kaho", "सत्यापन माँगें")}
                      </Gate>
                    ) : (
                      <RowMenu items={[{ label: t("See activity", "Activity dekho", "गतिविधि"), icon: <Eye /> }, { label: t("Suspend", "Suspend", "निलंबित"), icon: <Ban />, danger: true, onClick: () => setSusp(true) }]} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "rep" && (
        <div className="col g10">
          {[
            ["bad", t("Recruiter asked a learner for a ₹2,000 “registration fee”", "Recruiter ne learner se ₹2,000 “registration fee” maangi", "शुल्क माँगा"), "Bright Careers (agency) · Dev Mehta", "1 h"],
            ["review", t("Profile opened 19 times from one unverified account", "Ek unverified account se profile 19 baar khuli", "19 बार खुली"), "gmail.com · Dev Mehta", "3 h"],
            ["info", t("Learner says the HR link was shared outside the company", "Learner kehta hai HR link company ke bahar share hua", "लिंक बाहर साझा"), "Kesar Cloud · Zoya Khan", t("yesterday", "kal", "कल")],
          ].map(([s, h, who, when], i) => (
            <Card key={i} className="rep-card">
              <div className="row g12 wrap">
                <Flag className={s === "bad" ? "t-red" : s === "review" ? "t-coin" : "faint"} />
                <div className="grow col g4" style={{ minWidth: 0 }}>
                  <b className="small">{h}</b>
                  <span className="tiny faint">
                    {who} · {when}
                  </span>
                </div>
                <div className="row g8">
                  <button className="btn sm ghost" onClick={() => toast(t("Message sent to the learner", "Learner ko message gaya", "संदेश भेजा"))}>
                    {t("Contact learner", "Learner se baat", "शिक्षार्थी से बात")}
                  </button>
                  <Gate mod="recruiters" need="edit" className="btn sm dang" onClick={() => setSusp(true)}>
                    <Ban /> {t("Suspend recruiter", "Recruiter suspend", "निलंबित करें")}
                  </Gate>
                </div>
              </div>
            </Card>
          ))}
          <Badge tone="red" icon={<ShieldAlert size={13} />}>
            {t("Parikshaa never charges learners to be seen by companies. Any fee request is a scam.", "Parikshaa companies ko dikhane ke liye learner se kabhi paisa nahi leta. Fee maangna dhokha hai.", "कोई शुल्क नहीं।")}
          </Badge>
        </div>
      )}
      <FourEyes
        open={susp}
        onClose={() => setSusp(false)}
        title={t("Suspend recruiter", "Recruiter suspend karo", "रिक्रूटर निलंबित")}
        what={t("All their links stop working and their learners are told. Reversible by a super admin.", "Unke saare links band, aur learners ko bataya jaayega. Super admin wapas le sakta hai.", "सभी लिंक बंद।")}
      />
    </div>
  );
}
