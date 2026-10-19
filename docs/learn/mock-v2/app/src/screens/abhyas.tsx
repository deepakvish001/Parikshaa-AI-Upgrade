import { CodeXml, Database, Brain, ArrowRight, CalendarCheck, Trophy, ListChecks, Layers, Timer } from "lucide-react";
import { Link, useCountdown, useT } from "../lib/core";
import { Bar, CountBoxes, Ring, SampleNote } from "../ui/kit";
import { PageHead } from "../ui/shell";

export function AbhyasBody() {
  const t = useT();
  const [potd] = useCountdown(3 * 3600 + 57 * 60 + 39);
  const [contest] = useCountdown(4 * 86400 + 2 * 3600 + 11 * 60);
  const tracks = [
    { to: "sheet", icon: CodeXml, name: "DSA", sub: t("411 problems · C++, Java, Python, JS", "411 problems · C++, Java, Python, JS", "411 प्रश्न"), done: 212, total: 411, color: "var(--t-dsa)" },
    { to: "sql", icon: Database, name: "SQL", sub: t("120 problems · real tables", "120 problems · asli tables", "120 प्रश्न"), done: 18, total: 120, color: "var(--t-dev)" },
    { to: "aptitude", icon: Brain, name: t("Aptitude", "Aptitude", "एप्टीट्यूड"), sub: t("Quant, logical, verbal · 36 mocks", "Quant, logical, verbal · 36 mocks", "गणित, तर्क, भाषा"), done: 340, total: 1800, color: "var(--t-apt)" },
  ];
  const patterns: [string, number, number][] = [
    ["Two pointers", 8, 14],
    ["Sliding window", 5, 12],
    ["Prefix sums", 9, 10],
    ["Hashing", 11, 16],
    ["Binary search", 12, 22],
    ["Stack", 4, 15],
    ["Recursion", 2, 18],
    ["Trees: DFS/BFS", 0, 24],
    ["Graphs", 0, 26],
    ["Greedy", 3, 14],
    ["Dynamic programming", 1, 40],
    ["Bit tricks", 2, 9],
  ];
  return (
    <div className="page stagger">
      <PageHead
        title={t("Practice", "Abhyas", "अभ्यास")}
        sub={t("Pick a track, follow a sheet, or train one pattern at a time.", "Track chuno, sheet follow karo, ya ek pattern ka abhyas.", "ट्रैक चुनें, शीट पर चलें, या एक पैटर्न।")}
        actions={<SampleNote />}
      />
      <div className="grid c3">
        {tracks.map((tr) => {
          const Icon = tr.icon;
          return (
            <Link key={tr.name} to={tr.to} className="panel pad track-card hover-card">
              <div className="row between">
                <span className="track-ico" style={{ color: tr.color, background: `color-mix(in srgb, ${tr.color} 14%, transparent)` }}>
                  <Icon size={20} />
                </span>
                <Ring value={(tr.done / tr.total) * 100} size={52} stroke={5} color={tr.color}>
                  <b style={{ fontSize: "var(--fs-11)" }} className="num">
                    {Math.round((tr.done / tr.total) * 100)}%
                  </b>
                </Ring>
              </div>
              <b style={{ fontSize: "var(--fs-18)" }}>{tr.name}</b>
              <span className="muted" style={{ fontSize: "var(--fs-13)" }}>
                {tr.sub}
              </span>
              <span className="faint num" style={{ fontSize: "var(--fs-12)" }}>
                {tr.done} / {tr.total} {t("done", "hue", "पूरे")}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid c3">
        <Link to="problem" className="panel pad stack hover-card">
          <span className="eyebrow">{t("Continue", "Jaari rakho", "जारी रखें")}</span>
          <b style={{ fontSize: "var(--fs-16)" }}>Pair with target sum</b>
          <span className="tag bad" style={{ alignSelf: "flex-start" }}>
            {t("Wrong answer · 23/24", "Galat · 23/24", "गलत · 23/24")}
          </span>
          <span className="btn primary sm" style={{ alignSelf: "flex-start" }}>
            {t("Open", "Kholo", "खोलें")} <ArrowRight size={13} />
          </span>
        </Link>
        <Link to="potd" className="panel pad stack hover-card">
          <div className="row between">
            <span className="eyebrow">{t("Problem of the day", "Aaj ka problem", "आज का प्रश्न")}</span>
            <CalendarCheck size={15} className="faint" />
          </div>
          <b style={{ fontSize: "var(--fs-16)" }}>Bus stop queue</b>
          <CountBoxes seconds={potd} />
        </Link>
        <Link to="contests" className="panel pad stack hover-card">
          <div className="row between">
            <span className="eyebrow">{t("Next contest", "Agla contest", "अगली प्रतियोगिता")}</span>
            <Trophy size={15} className="faint" />
          </div>
          <b style={{ fontSize: "var(--fs-16)" }}>Weekly Round 12</b>
          <span className="muted num" style={{ fontSize: "var(--fs-13)", display: "flex", gap: 6, alignItems: "center" }}>
            <Timer size={13} /> {t("starts in", "shuru hone me", "शुरू होने में")} {Math.floor(contest / 86400)}d {Math.floor((contest % 86400) / 3600)}h
          </span>
          <span className="btn secondary sm" style={{ alignSelf: "flex-start" }}>
            {t("Register", "Register", "पंजीकरण")}
          </span>
        </Link>
      </div>

      <section className="stack">
        <div className="section-title">
          <h2>
            <ListChecks size={17} style={{ verticalAlign: -3 }} /> {t("Sheets", "Sheets", "शीट")}
          </h2>
        </div>
        <div className="panel list">
          {[
            ["Parikshaa DSA sheet", t("Basics to advanced, interview order", "Basics se advanced, interview kram", "बुनियाद से उन्नत"), 212, 411],
            ["Service company coding", t("TCS NQT, Infosys, Wipro style rounds (patterns verified)", "Service company jaise rounds (pattern verified)", "सर्विस कंपनी जैसे राउंड"), 41, 120],
            ["Interview 90", t("90 must-do problems for the last month", "Aakhri mahine ke 90 zaroori problems", "आखिरी महीने के 90"), 30, 90],
            ["SQL 50", t("Joins, windows, grouping", "Joins, windows, grouping", "जॉइन, विंडो"), 18, 50],
          ].map(([n, d, a, b]) => (
            <Link key={n as string} to="sheet" className="list-row">
              <span className="t">
                {n}
                <small>{d}</small>
              </span>
              <span style={{ width: 140 }} className="hide-phone">
                <Bar value={((a as number) / (b as number)) * 100} thin />
              </span>
              <span className="faint num" style={{ fontSize: "var(--fs-12)", minWidth: 60, textAlign: "right" }}>
                {a}/{b}
              </span>
              <ArrowRight size={15} className="faint" />
            </Link>
          ))}
        </div>
      </section>

      <section className="stack">
        <div className="section-title">
          <h2>
            <Layers size={17} style={{ verticalAlign: -3 }} /> {t("Train by pattern", "Pattern se abhyas", "पैटर्न से अभ्यास")}
          </h2>
          <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
            {t("Mastery = solved without hints, and still right a week later", "Mastery = bina hint hal, aur hafte baad bhi sahi", "बिना संकेत हल, हफ़्ते बाद भी सही")}
          </span>
        </div>
        <div className="pattern-grid">
          {patterns.map(([n, d, tot]) => (
            <Link key={n} to="sheet" className="pattern hover-card">
              <b>{n}</b>
              <Bar value={(d / tot) * 100} thin tone={d === tot ? "ok" : undefined} />
              <span className="faint num">
                {d}/{tot}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
