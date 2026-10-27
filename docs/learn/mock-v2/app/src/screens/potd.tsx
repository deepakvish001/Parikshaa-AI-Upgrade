import { useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Snowflake, Coins, ArrowRight, Trophy, CalendarCheck } from "lucide-react";
import { Link, useCountdown, useT } from "../lib/core";
import { Bar, CountBoxes, Diya, Level } from "../ui/kit";
import { PageHead } from "../ui/shell";

export function PotdBody() {
  const t = useT();
  const [left] = useCountdown(3 * 3600 + 57 * 60 + 39);
  const [coinAnim, setCoinAnim] = useState(false);
  // October 2026 starts on a Thursday. Today is the 20th.
  const first = 3; // Mon = 0
  const days = 31;
  const state = (d: number) => {
    if (d > 20) return "future";
    if (d === 20) return "today";
    if ([3, 10, 17].includes(d)) return "freeze";
    if ([4, 5].includes(d)) return "missed";
    if (d === 8) return "late";
    return "solved";
  };
  return (
    <div className="page stagger">
      <PageHead
        title={t("Problem of the day", "Aaj ka problem", "आज का प्रश्न")}
        sub={t("One problem a day, chosen for your level. It resets at midnight IST.", "Roz ek problem, aapke level ka. IST raat 12 baje badalta hai.", "रोज़ एक प्रश्न, रात 12 बजे बदलता है।")}
      />
      <div className="potd-top">
        <section className="panel featured potd-card" style={{ position: "relative" }}>
          <div className="row between wrap" style={{ gap: 10 }}>
            <span className="eyebrow">{t("Tuesday, 20 October", "Mangalvaar, 20 October", "मंगलवार, 20 अक्टूबर")}</span>
            <span className={`tag plus coin-tag ${coinAnim ? "go" : ""}`}>
              <Coins size={12} /> +20
            </span>
          </div>
          <h2>Bus stop queue</h2>
          <div className="row wrap" style={{ gap: 6 }}>
            <Level lv={3} />
            <span className="tag">Queue</span>
            <span className="tag">Simulation</span>
          </div>
          <p className="muted">
            {t(
              "People arrive at a bus stop at given times and a bus leaves every k minutes with room for c people. Who waits the longest?",
              "Log diye gaye samay par bus stop aate hain, har k minute me bus c logon ke saath jaati hai. Sabse zyada kaun intezaar karta hai?",
              "सबसे ज़्यादा कौन इंतज़ार करता है?",
            )}
          </p>
          <div className="row between wrap" style={{ gap: 12 }}>
            <div className="stack sm">
              <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
                {t("Ends in", "Khatam hone me", "समाप्त होने में")}
              </span>
              <CountBoxes seconds={left} />
            </div>
            <Link to="problem" className="btn primary lg" onClick={() => setCoinAnim(true)}>
              {t("Solve problem", "Hal karo", "हल करें")} <ArrowRight size={16} />
            </Link>
          </div>
          <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
            {t("4,812 people solved it so far · median time 22 min", "Ab tak 4,812 ne hal kiya · beech ka samay 22 min", "अब तक 4,812 ने हल किया")}
          </span>
        </section>
        <section className="panel pad streak-panel">
          <div className="streak-big">
            <Flame size={40} />
            <div>
              <b className="num">12</b>
              <span>{t("day streak", "din ki streak", "दिन लगातार")}</span>
            </div>
          </div>
          <dl className="kv">
            <dt>{t("Longest", "Sabse lambi", "सबसे लंबी")}</dt>
            <dd>31 {t("days", "din", "दिन")}</dd>
            <dt>{t("This month", "Is mahine", "इस महीने")}</dt>
            <dd>13 / 19</dd>
            <dt>{t("Freezes left", "Freeze baaki", "फ़्रीज़ बाकी")}</dt>
            <dd>1</dd>
          </dl>
          <Diya size={54} mood="happy" className="bob" />
          <div className="stack sm" style={{ marginTop: "auto" }}>
            <div className="row between" style={{ fontSize: "var(--fs-12)" }}>
              <span className="faint">{t("Next badge: 15-day lamp", "Agla badge: 15 din ka diya", "अगला बैज: 15 दिन")}</span>
              <b className="num">12 / 15</b>
            </div>
            <Bar value={80} tone="plus" />
          </div>
        </section>
      </div>

      <section className="panel pad-lg stack">
        <div className="row between">
          <b style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <CalendarCheck size={16} /> October 2026
          </b>
          <div className="row" style={{ gap: 4 }}>
            <button type="button" className="icon-btn bordered" aria-label="Previous month">
              <ChevronLeft size={15} />
            </button>
            <button type="button" className="icon-btn bordered" aria-label="Next month" disabled>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
        <div className="cal">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <span key={d} className="cal-dow">
              {d}
            </span>
          ))}
          {Array.from({ length: first }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const d = i + 1;
            const s = state(d);
            return (
              <Link key={d} to={s === "future" ? "potd" : "problem"} className={`cal-day ${s}`} aria-label={`${d} October: ${s}`}>
                <span className="num">{d}</span>
                {s === "freeze" && <Snowflake size={12} />}
                {s === "solved" || s === "late" ? <i className="ribbon" /> : null}
              </Link>
            );
          })}
        </div>
        <div className="legend" style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          <span>
            <i className="cal-key solved" /> {t("Solved that day", "Usi din hal", "उसी दिन हल")}
          </span>
          <span>
            <i className="cal-key late" /> {t("Solved later (no streak)", "Baad me hal (streak nahi)", "बाद में हल")}
          </span>
          <span>
            <Snowflake size={12} /> {t("Freeze used", "Freeze laga", "फ़्रीज़")}
          </span>
          <span>
            <i className="cal-key missed" /> {t("Not solved", "Hal nahi", "हल नहीं")}
          </span>
        </div>
        <p className="faint" style={{ fontSize: "var(--fs-12)" }}>
          {t("Rest days from your plan count as frozen automatically.", "Plan ki chhutti apne aap freeze maani jaati hai.", "योजना की छुट्टी अपने आप फ़्रीज़।")}
        </p>
      </section>

      <section className="panel list">
        {[
          ["19 Oct", "Rotate the matrix", 3, true],
          ["18 Oct", "Longest balanced prefix", 2, true],
          ["17 Oct", "Two trains meet", 2, false],
          ["16 Oct", "K closest numbers", 3, true],
        ].map(([d, n, lv, ok]) => (
          <Link key={d as string} to="problem" className="list-row">
            <span className="faint num" style={{ width: 54, fontSize: "var(--fs-12)" }}>
              {d}
            </span>
            <span className="t">{n}</span>
            <Level lv={lv as 2 | 3} />
            {ok ? <span className="tag ok">{t("Solved", "Hal", "हल")}</span> : <span className="tag">{t("Try now", "Ab try karo", "अब करें")}</span>}
          </Link>
        ))}
        <div className="list-row faint" style={{ fontSize: "var(--fs-12)" }}>
          <Trophy size={14} /> {t("Past problems still count for practice, not for the streak.", "Purane problems practice me ginte hain, streak me nahi.", "पुराने प्रश्न अभ्यास में गिने जाते हैं।")}
        </div>
      </section>
    </div>
  );
}
