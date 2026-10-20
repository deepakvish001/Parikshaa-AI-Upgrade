import { useState } from "react";
import {
  Plus,
  TicketPercent,
  Receipt,
  Undo2,
  Medal,
  Activity,
  Users,
  Copy,
  Power,
  FlaskConical,
  Bot,
  ShieldAlert,
  Lock,
  Megaphone,
  Mail,
  MessageCircle,
  Smartphone,
  Clock,
  Send,
  Filter,
  CalendarClock,
  Eye,
} from "lucide-react";
import { useT, useToast } from "../lib/core";
import { useRole } from "../lib/state";
import { Badge, Tabs, Card, LineChart, Bars, Toggle, Meter, Seg } from "../ui/kit";
import { AdmHead, Gate, Toolbar, Status, FourEyes } from "./akit";

/* ---------------- commerce ---------------- */

export function AdmCommerce() {
  const t = useT();
  const [tab, setTab] = useState("plans");
  const [ref, setRef] = useState(false);
  return (
    <div className="col g16">
      <AdmHead
        title={t("Plans & payments", "Plans aur payments", "योजनाएँ और भुगतान")}
        sub={t("Prices are placeholders until the owner sets them.", "Daam owner ke tay karne tak placeholder.", "क़ीमतें अभी तय नहीं।")}
        actions={
          <Gate mod="commerce" className="btn pri">
            <TicketPercent />
            {t("New coupon", "Naya coupon", "नया कूपन")}
          </Gate>
        }
      />
      <div className="stat-strip" style={{ ["--n" as string]: 4 }}>
        {[
          ["MRR", "₹[mrr]", t("after prices are set", "daam tay hone ke baad", "क़ीमतें तय होने पर")],
          [t("Active Plus", "Active Plus", "सक्रिय प्लस"), "6,412", "+3.1%"],
          [t("Campus seats", "Campus seats", "कैंपस सीटें"), "18,900", "14 colleges"],
          [t("Refund rate", "Refund rate", "रिफ़ंड दर"), "0.8%", t("last 30 days", "pichhle 30 din", "30 दिन")],
        ].map(([k, v, d]) => (
          <div key={k} className="stat">
            <span className="k">{k}</span>
            <span className="v">{v}</span>
            <span className="d">{d}</span>
          </div>
        ))}
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "plans", label: t("Plans & limits", "Plans aur limits", "योजनाएँ") },
          { id: "coupons", label: t("Coupons", "Coupons", "कूपन"), count: 6 },
          { id: "orders", label: t("Orders", "Orders", "ऑर्डर") },
          { id: "refunds", label: t("Refunds", "Refunds", "रिफ़ंड"), count: 2 },
          { id: "invoices", label: t("Invoices & GST", "Invoices aur GST", "चालान") },
        ]}
      />
      {tab === "plans" && (
        <div className="grid c2">
          <Card title={t("Prices", "Daam", "क़ीमतें")} icon={<Receipt className="ic" />}>
            <div className="col g10">
              {[
                ["Plus · monthly", "₹[monthly price]"],
                ["Plus · yearly", "₹[yearly price]"],
                ["Campus · per student per year", "₹[campus price]"],
                ["Pramaan test (without Plus)", "₹[test price]"],
              ].map(([k, v]) => (
                <div key={k} className="row between g12">
                  <span className="small">{k}</span>
                  <input className="input sm" style={{ width: 180 }} defaultValue={v} />
                </div>
              ))}
              <span className="tiny faint">{t("Shown with GST included. Price changes apply to new purchases only.", "GST shaamil dikhta hai. Naya daam sirf naye purchases par.", "GST सहित।")}</span>
            </div>
          </Card>
          <Card title={t("What each plan gets", "Har plan ko kya milta", "प्रत्येक योजना")} pad={false}>
            <div className="tbl-wrap">
              <table className="tbl dense">
                <thead>
                  <tr>
                    <th>{t("Feature", "Feature", "सुविधा")}</th>
                    <th className="r">Free</th>
                    <th className="r">Plus</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Sahayak messages / day", "20", "200"],
                    ["Mocks / month", "2", "∞"],
                    ["Custom roadmaps", "3", "100"],
                    ["Human project review", "—", "✓"],
                    ["Pramaan tests / month", "0", "1"],
                  ].map(([f, a, b]) => (
                    <tr key={f}>
                      <td className="small">{f}</td>
                      <td className="r">
                        <input className="input sm cell-in" defaultValue={a} />
                      </td>
                      <td className="r">
                        <input className="input sm cell-in" defaultValue={b} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
      {tab === "refunds" && (
        <Card pad={false}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("Order", "Order", "ऑर्डर")}</th>
                  <th>{t("Learner", "Learner", "शिक्षार्थी")}</th>
                  <th className="r">{t("Amount", "Rakam", "राशि")}</th>
                  <th>{t("Reason", "Wajah", "कारण")}</th>
                  <th>{t("Rule", "Niyam", "नियम")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[
                  ["7712", "Kabir Shah", "₹6,499", "Charged twice", true],
                  ["7690", "Neha Gill", "₹499", "Bought by mistake", false],
                ].map(([o, l, a, r, big]) => (
                  <tr key={o as string}>
                    <td className="mono">{o}</td>
                    <td>{l}</td>
                    <td className="r num">{a}</td>
                    <td className="small">{r}</td>
                    <td>{big ? <Badge tone="red">{t("> ₹5,000 · 4-eyes", "> ₹5,000 · 4-eyes", "दोहरी मंज़ूरी")}</Badge> : <Badge>{t("Finance alone", "Sirf Finance", "केवल वित्त")}</Badge>}</td>
                    <td>
                      <Gate mod="commerce" need="full" className="btn sm" onClick={() => setRef(true)}>
                        <Undo2 />
                        {t("Refund", "Refund", "रिफ़ंड")}
                      </Gate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {(tab === "coupons" || tab === "orders" || tab === "invoices") && (
        <Card pad={false}>
          <Toolbar placeholder={t("Search", "Khojo", "खोजें")} />
          <div className="tbl-wrap">
            <table className="tbl">
              <tbody>
                {(tab === "coupons"
                  ? [
                      ["CAMPUS2026", "20% off yearly", "412 / 1,000 used", "live"],
                      ["DIWALI", "₹[x] off", "starts 28 Oct", "draft"],
                    ]
                  : tab === "orders"
                    ? [
                        ["7712", "Plus yearly · UPI", "captured ×2", "bad"],
                        ["7711", "Pramaan test · card", "captured", "live"],
                      ]
                    : [
                        ["INV-2026-10-0412", "Plus yearly · GSTIN none", "e-invoice not needed", "live"],
                        ["INV-2026-10-0409", "Campus · 1,200 seats", "e-invoice IRN generated", "live"],
                      ]
                ).map(([a, b, c, s]) => (
                  <tr key={a}>
                    <td className="mono small">{a}</td>
                    <td className="small">{b}</td>
                    <td className="small muted">{c}</td>
                    <td>
                      <Status s={s as "live"}>{s === "live" ? "OK" : s === "bad" ? t("Check", "Jaancho", "जाँचें") : t("Draft", "Draft", "मसौदा")}</Status>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <FourEyes open={ref} onClose={() => setRef(false)} title={t("Refund ₹6,499 to Kabir Shah", "Kabir Shah ko ₹6,499 refund", "₹6,499 रिफ़ंड")} what="Order 7712 · Plus yearly · Razorpay shows two captures" needs="Finance + Super admin" />
    </div>
  );
}

/* ---------------- contests ---------------- */

export function AdmContests() {
  const t = useT();
  const toast = useToast();
  const [tab, setTab] = useState("live");
  const sec = Array.from({ length: 24 }, (_, i) => `${i * 5}m`);
  return (
    <div className="col g16">
      <AdmHead
        title={t("Contests", "Contests", "प्रतियोगिताएँ")}
        sub="Weekly Round 13 · Sun 8:00 pm · 4,210 registered"
        actions={
          <Gate mod="contests" className="btn pri">
            <Plus />
            {t("New contest", "Naya contest", "नई प्रतियोगिता")}
          </Gate>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "live", label: t("Live monitor", "Live monitor", "लाइव निगरानी") },
          { id: "setup", label: t("Setup", "Setup", "सेटअप") },
          { id: "plag", label: t("Copy check", "Copy check", "नकल जाँच"), count: 6 },
        ]}
      />
      {tab === "live" && (
        <>
          <div className="stat-strip" style={{ ["--n" as string]: 5 }}>
            {[
              [t("Live now", "Abhi live", "अभी लाइव"), "3,982", ""],
              [t("Submissions / s", "Submissions / s", "सबमिशन/से"), "41", "peak 96"],
              [t("Judge queue", "Judge queue", "जज कतार"), "128", "p95 2.1 s"],
              [t("Errors", "Errors", "त्रुटियाँ"), "0.02%", ""],
              [t("Tab-switch warnings", "Tab-switch warnings", "टैब चेतावनी"), "57", ""],
            ].map(([k, v, d]) => (
              <div key={k} className="stat">
                <span className="k">{k}</span>
                <span className="v">{v}</span>
                <span className="d">{d}</span>
              </div>
            ))}
          </div>
          <Card title={t("Submissions per second", "Submissions per second", "प्रति सेकंड")} icon={<Activity className="ic" />}>
            <LineChart h={170} labels={sec} series={[{ name: "subs", data: sec.map((_, i) => 10 + Math.round(30 * Math.sin(i / 3) ** 2 + i * 2)), c: "var(--pen)" }]} />
          </Card>
          <div className="banner pen">
            <Users />
            <span className="small grow">{t("Workers pre-warmed 15 minutes before start for 4,500 learners.", "Shuru se 15 minute pehle 4,500 learners ke liye workers taiyaar.", "15 मिनट पहले तैयार।")}</span>
          </div>
        </>
      )}
      {tab === "setup" && (
        <div className="grid c2">
          <Card title={t("Details", "Details", "विवरण")}>
            <div className="col g10">
              <div className="field">
                <label>{t("Name", "Naam", "नाम")}</label>
                <input className="input" defaultValue="Weekly Round 13" />
              </div>
              <div className="row g10">
                <div className="field grow">
                  <label>{t("Starts", "Shuru", "शुरू")}</label>
                  <input className="input" defaultValue="25 Oct 2026, 20:00 IST" />
                </div>
                <div className="field grow">
                  <label>{t("Length", "Lambai", "अवधि")}</label>
                  <input className="input" defaultValue="90 min" />
                </div>
              </div>
              <div className="row between small">
                <span>{t("Rated", "Rated", "रेटेड")}</span>
                <Toggle on onChange={() => {}} label="Rated" />
              </div>
              <div className="row between small">
                <span>{t("Allow virtual after end", "Baad me virtual", "बाद में वर्चुअल")}</span>
                <Toggle on onChange={() => {}} label="Virtual" />
              </div>
            </div>
          </Card>
          <Card title={t("Problems (private pool)", "Problems (private pool)", "प्रश्न")}>
            <div className="col g8">
              {["A · Balanced split · 300", "B · Pair with target sum · 500", "C · Bus stop queue · 750", "D · Tree of lamps · 1000"].map((p) => (
                <div key={p} className="row g8 small">
                  <Lock style={{ width: 13, height: 13 }} className="faint" />
                  <span className="grow">{p}</span>
                  <Badge tone="tick">{t("checks ✓", "checks ✓", "जाँच ✓")}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
      {tab === "plag" && (
        <Card pad={false}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("Pair", "Jodi", "जोड़ी")}</th>
                  <th>{t("Problem", "Problem", "प्रश्न")}</th>
                  <th className="r">{t("Similarity", "Similarity", "समानता")}</th>
                  <th>{t("Decision", "Faisla", "निर्णय")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[
                  ["@arjun_k ↔ @rohan_99", "C", 0.94],
                  ["@meena_s ↔ @tina_p", "B", 0.81],
                  ["@zz_top ↔ @abc_123", "D", 0.67],
                ].map(([p, q, s]) => (
                  <tr key={p as string}>
                    <td className="mono small">{p}</td>
                    <td>{q}</td>
                    <td className={`r num ${(s as number) > 0.8 ? "t-red" : ""}`}>{(s as number).toFixed(2)}</td>
                    <td>
                      <Status s="review">{t("Needs a look", "Dekhna hai", "देखना है")}</Status>
                    </td>
                    <td>
                      <span className="row g4">
                        <button className="btn sm">
                          <Copy />
                          {t("Side by side", "Saath me", "साथ में")}
                        </button>
                        <Gate mod="contests" need="full" className="btn sm dang" onClick={() => toast(t("Both submissions voided · learners told", "Dono submissions radd · learners ko bataya", "रद्द"))}>
                          {t("Void", "Radd", "रद्द")}
                        </Gate>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-f">
            <span className="tiny faint grow">{t("Ratings publish after every pair is decided.", "Har jodi ka faisla hone par rating publish.", "निर्णय के बाद रेटिंग।")}</span>
            <Gate mod="contests" need="full" className="btn sm pri">
              <Medal />
              {t("Publish ratings", "Rating publish", "रेटिंग प्रकाशित")}
            </Gate>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------------- AI ---------------- */

export function AdmAI() {
  const t = useT();
  const toast = useToast();
  const { can } = useRole();
  const [tab, setTab] = useState("usage");
  const [kill, setKill] = useState<Record<string, boolean>>({ hint: false, review: false, doubt: false, build: false, interview: true });
  const [off, setOff] = useState<string | null>(null);
  const days = Array.from({ length: 14 }, (_, i) => `${i + 7}`);
  return (
    <div className="col g16">
      <AdmHead
        title="Sahayak AI"
        sub={t("Spend, limits, prompts, evals and a kill switch for every mode", "Kharch, limits, prompts, evals aur har mode ka kill switch", "खर्च, सीमाएँ, प्रॉम्प्ट")}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "usage", label: t("Usage & spend", "Usage aur kharch", "उपयोग") },
          { id: "limits", label: t("Limits", "Limits", "सीमाएँ") },
          { id: "prompts", label: t("Prompts", "Prompts", "प्रॉम्प्ट") },
          { id: "evals", label: "Evals" },
          { id: "kill", label: t("Kill switches", "Kill switches", "किल स्विच") },
          { id: "flag", label: t("Flagged chats", "Flagged chats", "फ़्लैग चैट"), count: 2 },
        ]}
      />
      {tab === "usage" && (
        <div className="grid c3">
          <Card title={t("Spend by mode (₹ thousand / day)", "Mode-war kharch (₹ hazaar / din)", "मोड-वार खर्च")} style={{ gridColumn: "span 2" }}>
            <LineChart
              h={180}
              labels={days}
              series={[
                { name: "Hint", data: days.map((_, i) => 6 + i * 0.3), c: "var(--ai)" },
                { name: "Review", data: days.map((_, i) => 4 + ((i * 7) % 3)), c: "var(--pen)" },
                { name: "Build", data: days.map((_, i) => 2 + i * 0.2), c: "var(--tick)" },
              ]}
            />
            <div className="legend mt8">
              <span>
                <i style={{ background: "var(--ai)" }} />
                Hint
              </span>
              <span>
                <i style={{ background: "var(--pen)" }} />
                Review
              </span>
              <span>
                <i style={{ background: "var(--tick)" }} />
                Build
              </span>
            </div>
          </Card>
          <Card title={t("Today vs cap", "Aaj vs cap", "आज बनाम सीमा")} icon={<Bot className="ic" />}>
            <div className="col g10">
              <b className="display num" style={{ fontSize: 40, lineHeight: 1 }}>
                ₹18,200
              </b>
              <Meter v={82} tone="coin" />
              <span className="tiny faint">{t("Cap ₹22,000 · at 90% Free users drop to the small model", "Cap ₹22,000 · 90% par Free users chhote model par", "90% पर छोटा मॉडल")}</span>
              <div className="col g6 mt8">
                {[
                  ["Hint", 41, "var(--ai)"],
                  ["Review", 27, "var(--pen)"],
                  ["Build", 18, "var(--tick)"],
                  ["Doubt", 9, "var(--coin)"],
                  ["Interview", 5, "var(--ink-4)"],
                ].map(([m, v, c]) => (
                  <div key={m as string} className="row g8 tiny">
                    <span style={{ width: 70 }}>{m as string}</span>
                    <span className="pf-bar" style={{ flex: 1 }}>
                      <i style={{ width: `${v as number}%`, background: c as string }} />
                    </span>
                    <span className="num" style={{ width: 32, textAlign: "right" }}>
                      {v as number}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card title={t("Per mode, today", "Har mode, aaj", "प्रति मोड, आज")} pad={false} style={{ gridColumn: "1 / -1" }}>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t("Mode", "Mode", "मोड")}</th>
                    <th className="r">{t("Requests", "Requests", "अनुरोध")}</th>
                    <th className="r">{t("Avg tokens", "Avg tokens", "औसत टोकन")}</th>
                    <th className="r">{t("Cache hit", "Cache hit", "कैश")}</th>
                    <th className="r">p95</th>
                    <th className="r">₹</th>
                    <th>{t("Model", "Model", "मॉडल")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Hint", "61,204", "820", "71%", "2.1 s", "7,460", "large · small at 90%"],
                    ["Review", "18,930", "2,940", "64%", "4.8 s", "4,910", "large"],
                    ["Build", "6,112", "5,100", "58%", "6.2 s", "3,280", "large"],
                    ["Doubt", "9,874", "1,210", "69%", "2.6 s", "1,640", "small"],
                    ["Interview", "—", "—", "—", "—", "910", t("killed 12:10", "12:10 se band", "बंद")],
                  ].map(([m, ...r]) => (
                    <tr key={m}>
                      <td>{m}</td>
                      {r.slice(0, 5).map((x, i) => (
                        <td key={i} className="r num">
                          {x}
                        </td>
                      ))}
                      <td className="small muted">{r[5]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
      {tab === "limits" && (
        <Card pad={false}>
          <div className="set-rows">
            {[
              ["Free · messages a day", "20"],
              ["Plus · messages a day (fair use)", "200"],
              ["Daily spend cap (₹)", "22,000"],
              ["Switch Free to the small model at", "90% of cap"],
            ].map(([k, v]) => (
              <div key={k} className="set-row">
                <span className="small">{k}</span>
                {can("ai", "full") ? <input className="input sm" style={{ width: 160 }} defaultValue={v} /> : <span className="row g6 small faint"><Lock style={{ width: 13, height: 13 }} />{v}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}
      {tab === "prompts" && (
        <Card pad={false}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("Mode", "Mode", "मोड")}</th>
                  <th>{t("Version", "Version", "संस्करण")}</th>
                  <th className="r">{t("Eval score", "Eval score", "स्कोर")}</th>
                  <th>{t("Traffic", "Traffic", "ट्रैफ़िक")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[
                  ["Hint", "v12", "98.4%", "100%"],
                  ["Hint", "v13 (A/B)", "98.9%", "10%"],
                  ["Review", "v7", "91.2%", "100%"],
                ].map(([m, v, s, tr]) => (
                  <tr key={m + v}>
                    <td>{m}</td>
                    <td className="mono">{v}</td>
                    <td className="r num t-tick">{s}</td>
                    <td>{tr}</td>
                    <td>
                      <button className="btn sm">
                        <Eye />
                        {t("Open", "Kholo", "खोलें")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {tab === "evals" && (
        <div className="grid c3">
          {[
            [t("Hint: no code leak", "Hint: code leak nahi", "संकेत: लीक नहीं"), 98.4, 98],
            [t("Review: finds the planted bug", "Review: chhupa bug pakde", "बग पकड़े"), 91.2, 90],
            [t("Review: right complexity", "Review: sahi complexity", "सही जटिलता"), 95.6, 95],
          ].map(([n, v, tg]) => (
            <section key={n as string} className="card pad col g8">
              <span className="small">{n as string}</span>
              <b className="display num" style={{ fontSize: 40 }}>
                {v as number}%
              </b>
              <Meter v={v as number} tone={(v as number) >= (tg as number) ? "tick" : "red"} />
              <span className="tiny faint">
                {t("target", "target", "लक्ष्य")} {tg as number}% · 160 cases · {t("judge model", "judge model", "जज मॉडल")}
              </span>
              <Gate mod="ai" need="full" className="btn sm" onClick={() => toast(t("Eval run queued · cost shown before it starts", "Eval run queue me · kharch pehle dikhega", "कतार में"))}>
                <FlaskConical />
                {t("Run again", "Dobara chalao", "फिर चलाएँ")}
              </Gate>
            </section>
          ))}
        </div>
      )}
      {tab === "kill" && (
        <Card pad={false}>
          <div className="set-rows">
            {(["hint", "review", "doubt", "build", "interview"] as const).map((m) => (
              <div key={m} className="set-row">
                <div>
                  <b className="small" style={{ textTransform: "capitalize" }}>
                    {m}
                  </b>
                  <p className="tiny faint">{kill[m] ? t("Killed: learners see 'Sahayak is resting'", "Band: learners ko 'Sahayak aaram par'", "बंद") : t("Running", "Chal raha", "चालू")}</p>
                </div>
                <span className="row g8">
                  {kill[m] && <Badge tone="red">{t("Killed", "Band", "बंद")}</Badge>}
                  <button
                    className={`btn sm ${kill[m] ? "" : "dang"}`}
                    disabled={!can("ai", "full")}
                    onClick={() => {
                      if (kill[m]) setOff(m);
                      else {
                        setKill((k) => ({ ...k, [m]: true }));
                        toast(t("Killed instantly · logged", "Turant band · log", "तुरंत बंद"));
                      }
                    }}
                  >
                    <Power />
                    {kill[m] ? t("Turn back on (4-eyes)", "Wapas on (4-eyes)", "फिर चालू") : t("Kill now", "Abhi band", "अभी बंद")}
                  </button>
                </span>
              </div>
            ))}
          </div>
          <p className="tiny faint" style={{ padding: "0 18px 14px" }}>
            {t("Killing is instant and one person can do it. Turning back on needs a second person.", "Band karna turant, ek insaan kar sakta. Wapas on ke liye doosra insaan.", "बंद करना तुरंत।")}
          </p>
        </Card>
      )}
      {tab === "flag" && (
        <Card pad={false}>
          <div className="list">
            {[
              ["#c-88121", t("Learner reported: 'it gave me the full solution'", "Learner ne report kiya: 'poora hal de diya'", "पूरा हल दिया"), "Hint"],
              ["#c-88007", t("Safety filter: personal data in message", "Safety filter: message me personal data", "निजी डेटा"), "Doubt"],
            ].map(([id, r, m]) => (
              <div key={id} className="li">
                <ShieldAlert style={{ width: 18, height: 18, color: "var(--red-text)" }} />
                <span className="grow small">
                  <b className="mono">{id}</b> · {r} · <Badge>{m}</Badge>
                </span>
                <Gate mod="ai" need="full" className="btn sm">
                  <Lock />
                  {t("Open with reason", "Wajah ke saath kholo", "कारण सहित खोलें")}
                </Gate>
              </div>
            ))}
          </div>
        </Card>
      )}
      <FourEyes open={!!off} onClose={() => setOff(null)} title={t(`Turn ${off} mode back on`, `${off} mode wapas on`, `${off} फिर चालू`)} what={t("Evals must be at or above target before this is approved.", "Approve se pehle evals target par ya upar hon.", "इवैल लक्ष्य पर हों।")} />
    </div>
  );
}

/* ---------------- analytics ---------------- */

export function AdmAnalytics() {
  const t = useT();
  const funnel = [
    [t("Visited", "Visit", "आए"), 100, "2,10,000"],
    [t("Signed up", "Sign up", "साइन अप"), 18.4, "38,640"],
    [t("Finished onboarding", "Onboarding poora", "शुरुआत पूरी"), 14.9, "31,290"],
    [t("First accepted solution", "Pehla AC", "पहला AC"), 9.1, "19,110"],
    [t("Active on day 7", "Din 7 active", "दिन 7 सक्रिय"), 5.2, "10,920"],
    [t("Bought Plus", "Plus liya", "प्लस लिया"), 0.9, "1,890"],
  ];
  const cohorts = [
    ["Week 36", [100, 52, 41, 36, 33, 31]],
    ["Week 37", [100, 55, 44, 38, 35]],
    ["Week 38", [100, 58, 47, 41]],
    ["Week 39", [100, 61, 49]],
    ["Week 40", [100, 63]],
  ];
  return (
    <div className="col g16">
      <AdmHead title={t("Analytics", "Analytics", "विश्लेषण")} sub={t("Last 30 days · sample data", "Pichhle 30 din · sample data", "नमूना डेटा")} actions={<Seg value="30" onChange={() => {}} items={[{ id: "7", label: "7d" }, { id: "30", label: "30d" }, { id: "90", label: "90d" }]} />} />
      <div className="grid c2">
        <Card title={t("Funnel", "Funnel", "फ़नल")} icon={<Filter className="ic" />}>
          <div className="col g8">
            {funnel.map(([l, p, n]) => (
              <div key={l as string} className="fn-row">
                <span className="small" style={{ width: 170 }}>
                  {l as string}
                </span>
                <span className="fn-bar">
                  <i style={{ width: `${Math.max(2, p as number)}%` }} />
                </span>
                <span className="tiny num" style={{ width: 90, textAlign: "right" }}>
                  {n as string} · {p as number}%
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card title={t("Weekly retention", "Weekly retention", "साप्ताहिक प्रतिधारण")}>
          <div className="tbl-wrap">
            <table className="cohort-tbl">
              <thead>
                <tr>
                  <th />
                  {["W0", "W1", "W2", "W3", "W4", "W5"].map((w) => (
                    <th key={w} className="tiny faint">
                      {w}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.map(([c, vals]) => (
                  <tr key={c as string}>
                    <td className="tiny faint">{c as string}</td>
                    {(vals as number[]).map((v, i) => (
                      <td key={i} style={{ background: `color-mix(in srgb, var(--pen) ${v * 0.8}%, var(--panel))`, color: v > 50 ? "var(--on-pen)" : "var(--ink)" }} className="num tiny">
                        {v}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <Card title={t("Content that needs work", "Jis content par kaam chahiye", "सुधार योग्य सामग्री")} pad={false}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t("Item", "Item", "आइटम")}</th>
                <th className="r">{t("Attempts", "Attempts", "प्रयास")}</th>
                <th className="r">AC %</th>
                <th className="r">{t("Avg tries", "Avg koshish", "औसत")}</th>
                <th className="r">{t("Helped?", "Kaam aaya?", "उपयोगी?")}</th>
                <th>{t("Editorial drop-off", "Editorial chhoda", "छोड़ा")}</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Rotting oranges", "18,204", "49%", "3.8", "79%", "Step 3 · dry run"],
                ["Longest increasing subsequence", "12,110", "31%", "4.6", "74%", "Step 4 · best approach"],
                ["Seating arrangement set 3", "8,902", "29%", "—", "68%", "—"],
              ].map(([a, b, c, d, e, f]) => (
                <tr key={a}>
                  <td className="small">{a}</td>
                  <td className="r num">{b}</td>
                  <td className="r num">{c}</td>
                  <td className="r num">{d}</td>
                  <td className="r num t-red">{e}</td>
                  <td className="small muted">{f}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title={t("Searches with no result", "Bina nateeje wali searches", "बिना परिणाम खोज")}>
        <Bars h={120} data={[{ l: "segment tree", v: 412 }, { l: "kmp", v: 288 }, { l: "lld", v: 240 }, { l: "excel", v: 133 }, { l: "c#", v: 96 }]} />
      </Card>
    </div>
  );
}

/* ---------------- messages ---------------- */

export function AdmNotify() {
  const t = useT();
  const toast = useToast();
  const [ch, setCh] = useState("wa");
  return (
    <div className="col g16">
      <AdmHead title={t("Messages", "Messages", "संदेश")} sub={t("Templates and campaigns by email, WhatsApp and push, in English and Hindi", "Email, WhatsApp, push ke templates aur campaigns, English aur Hindi me", "टेम्पलेट और अभियान")} />
      <div className="notify-grid">
        <Card title={t("New campaign", "Naya campaign", "नया अभियान")} icon={<Megaphone className="ic" />}>
          <div className="col g12">
            <div className="field">
              <label>{t("Who", "Kaun", "किसे")}</label>
              <div className="row wrap g6">
                {[t("Goal: product SDE", "Goal: product SDE", "लक्ष्य"), t("3rd year", "3rd year", "तीसरा वर्ष"), t("Inactive 7 days", "7 din inactive", "7 दिन निष्क्रिय")].map((x) => (
                  <span key={x} className="filter-chip on">
                    {x}
                  </span>
                ))}
                <span className="tiny faint">≈ 4,210 {t("learners", "learners", "शिक्षार्थी")}</span>
              </div>
            </div>
            <div className="field">
              <label>{t("Channel", "Channel", "चैनल")}</label>
              <Seg
                value={ch}
                onChange={setCh}
                items={[
                  { id: "wa", label: "WhatsApp", icon: <MessageCircle /> },
                  { id: "email", label: "Email", icon: <Mail /> },
                  { id: "push", label: "Push", icon: <Smartphone /> },
                ]}
              />
            </div>
            <div className="field">
              <label>{t("Message (Hindi + English versions)", "Message (Hindi + English)", "संदेश")}</label>
              <textarea className="textarea" defaultValue={"Aarav, aapka plan 2 din se ruka hai. Aaj sirf 20 minute: ek problem aur 5 revision cards. 👉 parikshaa.in/aaj"} />
            </div>
            <div className="row wrap g12">
              <div className="field grow">
                <label>{t("Send", "Kab", "कब")}</label>
                <input className="input" defaultValue="Tomorrow 7:00 pm IST" />
              </div>
              <div className="field grow">
                <label>{t("Rules", "Niyam", "नियम")}</label>
                <span className="small muted row g6" style={{ height: 38 }}>
                  <Clock style={{ width: 14, height: 14 }} />
                  {t("Quiet 10 pm–7 am · max 2/day · unsubscribe link", "Shant 10–7 · max 2/din · unsubscribe", "शांत समय")}
                </span>
              </div>
            </div>
            <div className="row g8">
              <button className="btn">
                <CalendarClock />
                {t("Send a test to me", "Mujhe test bhejo", "मुझे टेस्ट")}
              </button>
              <span className="grow" />
              <Gate mod="notify" className="btn pri" onClick={() => toast(t("Scheduled for 4,210 learners", "4,210 learners ke liye schedule", "निर्धारित"))}>
                <Send />
                {t("Schedule", "Schedule", "शेड्यूल")}
              </Gate>
            </div>
          </div>
        </Card>
        <div className="col g12">
          <div className="wa-prev">
            <div className="wa-head">
              <b>Parikshaa</b>
              <span className="tiny">✓ {t("Business account", "Business account", "व्यवसाय खाता")}</span>
            </div>
            <div className="wa-bubble">
              Aarav, aapka plan 2 din se ruka hai. Aaj sirf 20 minute: ek problem aur 5 revision cards. 👉 parikshaa.in/aaj
              <span className="tiny">7:00 pm ✓✓</span>
            </div>
          </div>
          <Card title={t("Last campaigns", "Pichhle campaigns", "पिछले अभियान")} pad={false}>
            <div className="tbl-wrap">
              <table className="tbl dense">
                <tbody>
                  {[
                    ["Exam week is lighter", "WhatsApp", "71% read · 18% clicked"],
                    ["Weekly Round 12 reminder", "Push", "44% opened"],
                  ].map(([a, b, c]) => (
                    <tr key={a}>
                      <td className="small">{a}</td>
                      <td>
                        <Badge>{b}</Badge>
                      </td>
                      <td className="tiny faint">{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

