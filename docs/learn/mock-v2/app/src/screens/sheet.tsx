import { useMemo, useState } from "react";
import {
  Search,
  Shuffle,
  ChevronDown,
  ChevronRight,
  FileText,
  PlayCircle,
  NotebookPen,
  Star,
  MoreHorizontal,
  ArrowRight,
  CalendarCheck,
  ListFilter,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { Link, useT, useToast } from "../lib/core";
import { Check, Level, Ring, Spark, Bar, Toggle } from "../ui/kit";
import { PageHead } from "../ui/shell";

type P = { name: string; lv: 1 | 2 | 3 | 4 | 5; pattern: string; solved: boolean; video?: boolean; star?: boolean; rev?: boolean };
type Sec = { name: [string, string, string]; done: number; total: number; subs: { name: string; items: P[] }[] };

export const SHEET: Sec[] = [
  {
    name: ["Step 1 · Basics", "Step 1 · Basics", "चरण 1 · बुनियाद"],
    done: 31,
    total: 31,
    subs: [],
  },
  {
    name: ["Step 2 · Sorting", "Step 2 · Sorting", "चरण 2 · सॉर्टिंग"],
    done: 7,
    total: 7,
    subs: [],
  },
  {
    name: ["Step 3 · Arrays", "Step 3 · Arrays", "चरण 3 · ऐरे"],
    done: 26,
    total: 40,
    subs: [
      {
        name: "Easy",
        items: [
          { name: "Largest element", lv: 1, pattern: "Scan", solved: true },
          { name: "Second largest without sorting", lv: 1, pattern: "Scan", solved: true, video: true },
          { name: "Check if the array is sorted and rotated", lv: 2, pattern: "Scan", solved: true },
          { name: "Remove duplicates in place", lv: 2, pattern: "Two pointers", solved: true, video: true },
          { name: "Move zeroes to the end", lv: 2, pattern: "Two pointers", solved: true },
        ],
      },
      {
        name: "Medium",
        items: [
          { name: "Pair with target sum", lv: 2, pattern: "Two pointers", solved: false, video: true, rev: true },
          { name: "Sort an array of 0s, 1s and 2s", lv: 3, pattern: "Three pointers", solved: false, video: true },
          { name: "Majority element (more than n/2)", lv: 3, pattern: "Voting", solved: true, star: true },
          { name: "Maximum subarray sum", lv: 3, pattern: "Kadane", solved: true, video: true, rev: true },
          { name: "Rearrange by sign", lv: 3, pattern: "Two pointers", solved: false },
          { name: "Next permutation", lv: 4, pattern: "Greedy", solved: false, video: true },
          { name: "Longest consecutive sequence", lv: 3, pattern: "Hashing", solved: false },
        ],
      },
      {
        name: "Hard",
        items: [
          { name: "Count subarrays with a given XOR", lv: 4, pattern: "Prefix + hashing", solved: false, video: true },
          { name: "Merge overlapping intervals", lv: 4, pattern: "Sorting", solved: true },
          { name: "Count inversions", lv: 5, pattern: "Merge sort", solved: false, video: true },
        ],
      },
    ],
  },
  { name: ["Step 4 · Binary search", "Step 4 · Binary search", "चरण 4 · बाइनरी सर्च"], done: 18, total: 32, subs: [] },
  { name: ["Step 5 · Strings", "Step 5 · Strings", "चरण 5 · स्ट्रिंग"], done: 4, total: 15, subs: [] },
  { name: ["Step 6 · Linked lists", "Step 6 · Linked lists", "चरण 6 · लिंक्ड लिस्ट"], done: 9, total: 31, subs: [] },
  { name: ["Step 7 · Recursion", "Step 7 · Recursion", "चरण 7 · रिकर्शन"], done: 0, total: 25, subs: [] },
  { name: ["Step 8 · Stacks & queues", "Step 8 · Stacks & queues", "चरण 8 · स्टैक और क्यू"], done: 0, total: 30, subs: [] },
];

export function SheetBody() {
  const t = useT();
  const toast = useToast();
  const [open, setOpen] = useState<number[]>([2]);
  const [q, setQ] = useState("");
  const [onlyRev, setOnlyRev] = useState(false);
  const [solved, setSolved] = useState<Record<string, boolean>>({});
  // The mock lists 8 of the sheet's 18 steps; the totals are for the whole sheet.
  const total = 411;
  const done = 212 + Object.values(solved).filter(Boolean).length;
  const filter = (p: P) => (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.pattern.toLowerCase().includes(q.toLowerCase())) && (!onlyRev || p.rev);
  const levels = useMemo(
    () => [
      [1, 61, 64],
      [2, 80, 98],
      [3, 52, 120],
      [4, 16, 78],
      [5, 3, 51],
    ],
    [],
  );
  return (
    <div className="page">
      <div className="sheet-hero">
        <div className="stack" style={{ gap: 10 }}>
          <PageHead
            crumbs={[{ to: "abhyas", label: t("Practice", "Abhyas", "अभ्यास") }, { label: "DSA sheet" }]}
            title={t("Parikshaa DSA sheet", "Parikshaa DSA sheet", "परीक्षा DSA शीट")}
            sub={t(
              "411 problems from basics to advanced, in the order interviews expect. Each one has an editorial, a dry run and tests that catch edge cases.",
              "411 problems, basics se advanced, interview ke kram me. Har ek ke saath editorial, dry run aur edge case pakadne wale tests.",
              "411 प्रश्न, बुनियाद से उन्नत तक।",
            )}
          />
          <div className="row wrap" style={{ gap: 8 }}>
            <Link to="problem" className="btn primary">
              {t("Continue: Pair with target sum", "Jaari: Pair with target sum", "जारी रखें")} <ArrowRight size={15} />
            </Link>
            <Link to="plan" className="btn secondary">
              <CalendarCheck size={15} /> {t("Add to my plan", "Plan me jodo", "योजना में जोड़ें")}
            </Link>
          </div>
        </div>
        <div className="sheet-progress panel pad">
          <Ring value={(done / total) * 100} size={104} stroke={10} label={`${done} of ${total}`}>
            <b className="num">{done}</b>
            <small>/ {total}</small>
          </Ring>
          <div className="lv-bars">
            {levels.map(([lv, d, tot]) => (
              <div key={lv} className="lv-row">
                <Level lv={lv as 1 | 2 | 3 | 4 | 5} />
                <span className="lv-track">
                  <i style={{ width: `${(d / tot) * 100}%`, background: `var(--lv${lv})` }} />
                </span>
                <span className="faint num">
                  {d}/{tot}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sheet-tools">
        <label className="input" style={{ flex: "1 1 260px", maxWidth: 420 }}>
          <Search size={15} />
          <span className="sr-only">Search</span>
          <input id="sheet-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search problem or pattern", "Problem ya pattern dhoondho", "प्रश्न या पैटर्न खोजें")} />
        </label>
        <button type="button" className="chip">
          <ListFilter size={13} /> {t("Level", "Level", "स्तर")} <ChevronDown size={12} />
        </button>
        <button type="button" className="chip">
          {t("Pattern", "Pattern", "पैटर्न")} <ChevronDown size={12} />
        </button>
        <button type="button" className="chip">
          {t("Company", "Company", "कंपनी")} <ChevronDown size={12} />
        </button>
        <label className="row" style={{ gap: 8, fontSize: "var(--fs-13)", fontWeight: 600 }}>
          <Toggle on={onlyRev} onChange={setOnlyRev} label="Revision only" />
          {t("Revision only", "Sirf revision", "केवल दोहराई")}
        </label>
        <span className="grow" />
        <button type="button" className="btn secondary sm" onClick={() => toast(t("Picked: Rearrange by sign", "Chuna: Rearrange by sign", "चुना गया"))}>
          <Shuffle size={14} /> {t("Pick one for me", "Mere liye ek chuno", "मेरे लिए चुनें")}
        </button>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {SHEET.map((sec, i) => {
          const isOpen = open.includes(i);
          const pct = (sec.done / sec.total) * 100;
          return (
            <section key={i} className={`sheet-sec ${isOpen ? "open" : ""}`}>
              <button type="button" className="sec-head" aria-expanded={isOpen} onClick={() => setOpen((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]))}>
                {isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                <b>{t(...sec.name)}</b>
                <span className="grow" />
                <span className="sec-bar hide-phone">
                  <Bar value={pct} tone={pct === 100 ? "ok" : undefined} thin />
                </span>
                <span className={`num sec-count ${pct === 100 ? "full" : ""}`}>
                  {sec.done}/{sec.total}
                </span>
              </button>
              {isOpen && sec.subs.length > 0 && (
                <div className="sec-body">
                  {sec.subs.map((sub) => {
                    const items = sub.items.filter(filter);
                    if (!items.length) return null;
                    return (
                      <div key={sub.name} className="sub">
                        <div className="sub-head">
                          <span className="eyebrow">{sub.name}</span>
                          <span className="faint num" style={{ fontSize: "var(--fs-11)" }}>
                            {items.filter((p) => p.solved || solved[p.name]).length}/{items.length}
                          </span>
                        </div>
                        <div className="prob-rows" role="table" aria-label={sub.name}>
                          {items.map((p) => {
                            const isSolved = p.solved || solved[p.name];
                            return (
                              <div key={p.name} role="row" className={`prob-row ${isSolved ? "solved" : ""}`}>
                                <span role="cell">
                                  <Check on={!!isSolved} onChange={(v) => setSolved((s) => ({ ...s, [p.name]: v }))} label={`Mark ${p.name} solved`} />
                                </span>
                                <Link role="cell" to="problem" className="prob-name">
                                  {p.name}
                                </Link>
                                <span role="cell" className="hide-phone">
                                  <span className="tag">{p.pattern}</span>
                                </span>
                                <span role="cell">
                                  <Level lv={p.lv} />
                                </span>
                                <span role="cell" className="prob-icons">
                                  <Link to="editorial" className="icon-btn" aria-label="Editorial" title={t("Editorial", "Editorial", "हल")}>
                                    <FileText size={15} />
                                  </Link>
                                  <span className={`icon-btn hide-phone ${p.video ? "" : "dim"}`} aria-label="Video" title={t("Video", "Video", "वीडियो")}>
                                    <PlayCircle size={15} />
                                  </span>
                                  <Link to="notes" className="icon-btn hide-phone" aria-label="Notes" title={t("Notes", "Notes", "नोट्स")}>
                                    <NotebookPen size={15} />
                                  </Link>
                                  <span className={`icon-btn ${p.rev ? "on-rev" : ""}`} aria-label="Revision" title={t("Revision", "Revision", "दोहराई")}>
                                    <RotateCcw size={15} />
                                  </span>
                                  <span className={`icon-btn hide-phone ${p.star ? "on-star" : ""}`} aria-label="Star">
                                    <Star size={15} />
                                  </span>
                                  <span className="icon-btn hide-phone" aria-label="More">
                                    <MoreHorizontal size={15} />
                                  </span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {isOpen && sec.subs.length === 0 && (
                <div className="sec-body faint" style={{ padding: "8px 18px 16px" }}>
                  {t("All problems in this step follow the same layout.", "Is step ke saare problems isi tarah dikhte hain.", "इस चरण के सभी प्रश्न इसी तरह।")}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function SheetRail() {
  const t = useT();
  return (
    <>
      <div className="rail-card">
        <h3>
          <TrendingUp size={15} /> {t("Your pace", "Aapki raftaar", "आपकी रफ़्तार")}
        </h3>
        <div className="row between">
          <div className="mini-stat">
            <b>14</b>
            <span>{t("solved this week", "is hafte hal", "इस हफ़्ते हल")}</span>
          </div>
          <Spark data={[3, 5, 2, 6, 9, 7, 11, 8, 14]} />
        </div>
        <p className="faint" style={{ fontSize: "var(--fs-12)" }}>
          {t("At this pace you finish the sheet by 28 Jan.", "Isi raftaar se sheet 28 Jan tak poori.", "इसी रफ़्तार से 28 जनवरी तक।")}
        </p>
      </div>
      <div className="rail-card">
        <h3>
          <RotateCcw size={15} /> {t("Revise from this sheet", "Is sheet se revision", "इस शीट से दोहराई")}
        </h3>
        {["Maximum subarray sum", "Pair with target sum", "Kth largest element"].map((n, i) => (
          <Link key={n} to="revision" className="rev-row">
            <span className="grow">{n}</span>
            <span className={`tag ${i === 0 ? "bad" : "warn"}`}>{i === 0 ? t("due", "aaj", "आज") : t("tomorrow", "kal", "कल")}</span>
          </Link>
        ))}
      </div>
      <div className="rail-card plus-card">
        <span className="tag plus">Plus</span>
        <b>{t("Company sets for this sheet", "Is sheet ke company sets", "कंपनी सेट")}</b>
        <p className="muted" style={{ fontSize: "var(--fs-12)" }}>
          {t("Filter by the companies you target, with sources and dates.", "Apni target companies se filter, source aur date ke saath.", "स्रोत और तारीख के साथ।")}
        </p>
        <Link to="plus" className="btn plus sm">
          {t("See Plus", "Plus dekho", "प्लस देखें")}
        </Link>
      </div>
    </>
  );
}
