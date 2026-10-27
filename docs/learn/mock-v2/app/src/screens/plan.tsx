import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CalendarX2,
  Pencil,
  Flag,
  Sparkles,
  Coffee,
  Snowflake,
  ArrowRight,
  Play,
  CalendarClock,
  Shrink,
  Scissors,
} from "lucide-react";
import { Link, useT, useToast } from "../lib/core";
import { Bar, Modal } from "../ui/kit";
import { PageHead } from "../ui/shell";
import { TODAY, KIND_ICON } from "./aaj";

type Tri = [string, string, string];
const SPRINTS: { name: Tri; status: "done" | "live" | "next"; est: string; pct: number }[] = [
  { name: ["Arrays, strings & hashing", "Arrays, strings aur hashing", "ऐरे, स्ट्रिंग और हैशिंग"], status: "done", est: "12h", pct: 100 },
  { name: ["Sorting & binary search", "Sorting aur binary search", "सॉर्टिंग और बाइनरी सर्च"], status: "done", est: "13h 30m", pct: 100 },
  { name: ["Linked lists, stacks & queues", "Linked lists, stacks aur queues", "लिंक्ड लिस्ट, स्टैक और क्यू"], status: "live", est: "15h", pct: 58 },
  { name: ["Trees & binary search trees", "Trees aur BST", "ट्री और BST"], status: "next", est: "16h", pct: 0 },
  { name: ["Graphs", "Graphs", "ग्राफ़"], status: "next", est: "17h", pct: 0 },
  { name: ["Dynamic programming", "Dynamic programming", "डायनेमिक प्रोग्रामिंग"], status: "next", est: "18h", pct: 0 },
];

const DAYS: { d: Tri; est: string; st: "done" | "today" | "rest" | "next" }[] = [
  { d: ["Day 1 · Thu 15 Oct", "Din 1 · Guru 15 Oct", "दिन 1 · 15 अक्टू"], est: "2h 15m", st: "done" },
  { d: ["Day 2 · Fri 16 Oct", "Din 2 · Shukra 16 Oct", "दिन 2 · 16 अक्टू"], est: "2h", st: "done" },
  { d: ["Day 3 · Sat 17 Oct", "Din 3 · Shani 17 Oct", "दिन 3 · 17 अक्टू"], est: "", st: "rest" },
  { d: ["Day 4 · Sun 18 Oct", "Din 4 · Ravi 18 Oct", "दिन 4 · 18 अक्टू"], est: "2h 30m", st: "done" },
  { d: ["Day 5 · Mon 19 Oct", "Din 5 · Som 19 Oct", "दिन 5 · 19 अक्टू"], est: "2h", st: "done" },
  { d: ["Day 6 · Tue 20 Oct", "Din 6 · Mangal 20 Oct", "दिन 6 · 20 अक्टू"], est: "2h 10m", st: "today" },
  { d: ["Day 7 · Wed 21 Oct", "Din 7 · Budh 21 Oct", "दिन 7 · 21 अक्टू"], est: "2h 30m", st: "next" },
];

export function PlanBody() {
  const t = useT();
  const toast = useToast();
  const [openSprint, setOpenSprint] = useState(2);
  const [openDay, setOpenDay] = useState(5);
  const [missed, setMissed] = useState(false);
  const [choice, setChoice] = useState<"push" | "fit" | "drop" | "break">("fit");

  const outcome: Record<typeof choice, { end: string; note: Tri }> = {
    push: { end: "13 Dec", note: ["Everything moves one day later.", "Sab kuch ek din aage khisak jaata hai.", "सब कुछ एक दिन आगे।"] },
    fit: { end: "12 Dec", note: ["Wed to Sun get 25 extra minutes each.", "Budh se Ravi roz 25 minute zyada.", "बुध से रवि रोज़ 25 मिनट ज़्यादा।"] },
    drop: { end: "12 Dec", note: ["Two optional tasks are removed; your revision keeps them.", "Do optional kaam hatenge; revision me rahenge.", "दो वैकल्पिक काम हटेंगे।"] },
    break: { end: "13 Dec", note: ["Uses 1 streak freeze. The plan shifts by a day.", "1 streak freeze lagega. Plan ek din khiskega.", "1 फ़्रीज़ लगेगा।"] },
  };

  return (
    <div className="page">
      <PageHead
        crumbs={[{ to: "aaj", label: t("Today", "Aaj", "आज") }, { label: t("My plan", "Mera plan", "मेरी योजना") }]}
        title={t("Product company SDE", "Product company SDE", "प्रोडक्ट कंपनी SDE")}
        sub={t(
          "1 Oct → 12 Dec 2026 · 6 sprints · 2 hours a day · Saturday off · exam week 3 Nov kept light",
          "1 Oct → 12 Dec 2026 · 6 sprints · roz 2 ghante · Shanivaar chhutti · 3 Nov ka exam hafta halka",
          "1 अक्टू → 12 दिस 2026 · 6 स्प्रिंट · रोज़ 2 घंटे · शनिवार छुट्टी",
        )}
        actions={
          <>
            <button type="button" className="btn secondary" onClick={() => setMissed(true)}>
              <CalendarX2 size={15} /> {t("Missed a day?", "Din chhoota?", "दिन छूटा?")}
            </button>
            <button type="button" className="btn ghost">
              <Pencil size={14} /> {t("Edit plan", "Plan badlo", "योजना बदलें")}
            </button>
          </>
        }
      />

      <section className="panel pad" aria-label="Sprints timeline">
        <div className="sprint-line">
          {SPRINTS.map((s, i) => (
            <div key={i} className={`seg-s ${s.status}`}>
              <i>
                <b style={{ width: `${s.pct}%` }} />
              </i>
              <span className="num">S{i + 1}</span>
              {s.status === "live" && <em>{t("You are here", "Aap yahan", "आप यहाँ")}</em>}
            </div>
          ))}
          <div className="seg-end">
            <Flag size={14} />
            <span>12 Dec</span>
          </div>
        </div>
      </section>

      <section className="stack" aria-label="Sprints">
        {SPRINTS.map((s, i) => {
          const open = openSprint === i;
          return (
            <div key={i} className={`sprint ${open ? "open" : ""}`}>
              <button type="button" className="sprint-row" aria-expanded={open} onClick={() => setOpenSprint(open ? -1 : i)}>
                <span className={`sp-dot ${s.status}`}>{s.status === "done" ? <CircleCheck size={16} /> : null}</span>
                <span className="tag outline">Sprint {i + 1}</span>
                <span className="sp-name">{t(...s.name)}</span>
                <span className={`tag ${s.status === "done" ? "ok" : s.status === "live" ? "action" : ""}`}>
                  <span className="dot" />
                  {s.status === "done" ? t("Done", "Ho gaya", "पूरा") : s.status === "live" ? t("This week", "Is hafte", "इस हफ़्ते") : t("Upcoming", "Aage", "आगे")}
                </span>
                <span className="faint num sp-est">Est. {s.est}</span>
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              {open && s.status === "live" && (
                <div className="sprint-body">
                  <div className="day-tree">
                    {DAYS.map((d, k) => {
                      const dOpen = openDay === k;
                      return (
                        <div key={k} className={`dt-day ${d.st}`}>
                          <button type="button" className="dt-row" aria-expanded={dOpen} onClick={() => d.st !== "rest" && setOpenDay(dOpen ? -1 : k)}>
                            <span className="dt-node">{d.st === "done" ? <CircleCheck size={14} /> : d.st === "rest" ? <Coffee size={12} /> : null}</span>
                            <span className="dt-name">{t(...d.d)}</span>
                            {d.st === "today" && <span className="tag dashed">{t("Today", "Aaj", "आज")}</span>}
                            <span className="grow" />
                            <span className="faint num" style={{ fontSize: "var(--fs-12)" }}>
                              {d.st === "rest" ? t("Rest day", "Chhutti", "छुट्टी") : `Est. ${d.est}`}
                            </span>
                            {d.st !== "rest" && (dOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />)}
                          </button>
                          {dOpen && (
                            <div className="dt-tasks">
                              {TODAY.slice(0, d.st === "today" ? 5 : 3).map((task, j) => {
                                const Icon = KIND_ICON[task.kind];
                                const done = d.st === "done" || (d.st === "today" && j === 0);
                                return (
                                  <div key={j} className={`task ${done ? "done" : ""}`}>
                                    <span className="kind">
                                      <Icon size={15} />
                                    </span>
                                    <div className="name">
                                      <span>{t(...task.name)}</span>
                                      <small>{task.sub}</small>
                                    </div>
                                    <span className="mins">{task.mins} min</span>
                                    {done ? (
                                      <CircleCheck size={17} style={{ color: "var(--ok)" }} />
                                    ) : (
                                      <Link to={task.to} className="btn sm secondary">
                                        <Play size={12} /> {t("Open", "Kholo", "खोलें")}
                                      </Link>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="wrap-card">
                    <span className="ico">
                      <Flag size={16} />
                    </span>
                    <div className="grow">
                      <b>{t("Wrap up sprint 3", "Sprint 3 ka wrap-up", "स्प्रिंट 3 का सार")}</b>
                      <p className="faint" style={{ fontSize: "var(--fs-12)" }}>
                        {t(
                          "After day 7: what went well, your top 3 mistakes with a drill each, and how sprint 4 starts.",
                          "Din 7 ke baad: kya achha gaya, top 3 galtiyan aur unka drill, sprint 4 kaise shuru.",
                          "दिन 7 के बाद: क्या अच्छा गया, 3 गलतियाँ, आगे क्या।",
                        )}
                      </p>
                    </div>
                    <button type="button" className="btn secondary sm" disabled>
                      <Sparkles size={13} /> {t("Unlocks tomorrow", "Kal khulega", "कल खुलेगा")}
                    </button>
                  </div>
                </div>
              )}
              {open && s.status !== "live" && (
                <div className="sprint-body">
                  <div className="row between wrap" style={{ gap: 10 }}>
                    <div className="grow" style={{ maxWidth: 360 }}>
                      <Bar value={s.pct} tone={s.status === "done" ? "ok" : undefined} />
                    </div>
                    <span className="faint" style={{ fontSize: "var(--fs-13)" }}>
                      {s.status === "done"
                        ? t("7 of 7 days · 22 problems · 4 lessons", "7/7 din · 22 problems · 4 lessons", "7/7 दिन · 22 प्रश्न")
                        : t("Starts after sprint 3. Days appear when it begins.", "Sprint 3 ke baad shuru. Din tab dikhenge.", "स्प्रिंट 3 के बाद शुरू।")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {missed && (
        <Modal
          title={t("Missed a day? That's fine.", "Din chhoota? Koi baat nahi.", "दिन छूटा? कोई बात नहीं।")}
          sub={t("Pick how to catch up. You see the new end date before anything changes.", "Kaise pakdein chuno. Kuch badalne se pehle naya end date dikhega.", "कैसे पकड़ें चुनें।")}
          onClose={() => setMissed(false)}
          foot={
            <>
              <button type="button" className="btn ghost" onClick={() => setMissed(false)}>
                {t("Cancel", "Rehne do", "रद्द करें")}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setMissed(false);
                  toast(t(`Plan updated. Ends ${outcome[choice].end}.`, `Plan badla. ${outcome[choice].end} ko khatam.`, `योजना बदली। ${outcome[choice].end} तक।`));
                }}
              >
                {t("Apply", "Lagao", "लागू करें")} <ArrowRight size={14} />
              </button>
            </>
          }
        >
          <div className="stack">
            {(
              [
                ["push", CalendarClock, ["Push everything by a day", "Sab ek din aage", "सब एक दिन आगे"]],
                ["fit", Shrink, ["Fit it into this week", "Isi hafte me samet lo", "इसी हफ़्ते में समेटें"]],
                ["drop", Scissors, ["Drop the least important", "Kam zaroori hatao", "कम ज़रूरी हटाएँ"]],
                ["break", Snowflake, ["Take a break (streak freeze)", "Break lo (streak freeze)", "ब्रेक लें (फ़्रीज़)"]],
              ] as [typeof choice, typeof CalendarClock, Tri][]
            ).map(([v, Icon, l]) => (
              <button key={v} type="button" className={`option-card ${choice === v ? "on" : ""}`} aria-pressed={choice === v} onClick={() => setChoice(v)}>
                <span className="ico">
                  <Icon size={17} />
                </span>
                <span className="grow">
                  <b>{t(...l)}</b>
                  <small>{t(...outcome[v].note)}</small>
                </span>
                <span className={`end ${outcome[v].end === "12 Dec" ? "same" : ""}`}>
                  <small>{t("Ends", "Khatam", "समाप्त")}</small>
                  {outcome[v].end}
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
