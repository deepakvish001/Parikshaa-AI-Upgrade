import { useEffect, useState } from "react";
import {
  FileText,
  CodeXml,
  Sparkles,
  Play,
  Send,
  RotateCcw,
  Settings2,
  Maximize2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Lock,
  Lightbulb,
  ThumbsUp,
  MessageSquare,
  Bookmark,
  Flag,
  CircleX,
  CircleCheck,
  Clock,
  Cloud,
  Pause,
  Coins,
  ArrowRight,
  Timer,
  Database,
  Table2,
  KeyRound,
  BookOpen,
} from "lucide-react";
import { Link, navigate, useT, useStopwatch, hms, useToast } from "../lib/core";
import { Badge, Level, Code, Tabs, Seg, Tick, PenNote, Menu } from "../ui/kit";
import { SahayakPanel } from "../ui/sahayak";
import { useAi } from "../lib/state";
import { FocusBar, PaneToggles, Panes, PaneHead, usePanes } from "../ui/focus";

export const BUGGY = `vector<int> pairWithSum(vector<int>& a, long long target) {
    int L = 0, R = a.size() - 1;
    while (L < R) {
        int sum = a[L] + a[R];
        if (sum == target) return {L, R};
        if (sum < target) L++;
        else R--;
    }
    return {-1};
}`;

type Verdict = "idle" | "wa" | "tle" | "ac";

/* ---------------- statement pane ---------------- */

function Statement() {
  const t = useT();
  const [hints, setHints] = useState(1);
  return (
    <div className="stmt">
      <h1 className="stmt-h">Pair with target sum</h1>
      <div className="row wrap g6">
        <Level n={2} />
        <Badge>Two pointers</Badge>
        <Badge>Arrays</Badge>
        <Badge tone="pen">Nimbu Labs · {t("sample", "sample", "नमूना")}</Badge>
        <span className="tiny faint">{t("Solved by 61% who tried", "Try karne walon me 61% ne solve kiya", "61% ने हल किया")}</span>
      </div>
      <div className="prose stmt-p">
        <p>
          {t("You are given a sorted array ", "Ek sorted array ", "एक क्रमबद्ध ऐरे ")}
          <code className="inl">a</code>
          {t(" of n integers and a number ", " (n integers) aur ek number ", " (n पूर्णांक) और संख्या ")}
          <code className="inl">target</code>.{" "}
          {t("Find two different positions i < j such that a[i] + a[j] = target and print them (0-indexed).", "Do alag positions i < j dhoondho jahan a[i] + a[j] = target, aur unhe print karo (0 se gin kar).", "दो स्थान i < j खोजें जहाँ a[i] + a[j] = target।")}
        </p>
        <p>{t("If there are many answers, print any one. If there is no pair, print -1.", "Kai jawab hon to koi ek. Koi pair na ho to -1.", "कोई जोड़ी न हो तो -1।")}</p>
      </div>
      <div className="ex">
        <div className="ex-h">{t("Example 1", "Example 1", "उदाहरण 1")}</div>
        <pre className="ex-b">
          <span className="faint">Input   </span>n = 6, a = [1, 3, 4, 6, 8, 11], target = 10{"\n"}
          <span className="faint">Output  </span>2 3{"\n"}
          <span className="faint">Why     </span>a[2] + a[3] = 4 + 6 = 10
        </pre>
      </div>
      <div className="ex">
        <div className="ex-h">{t("Example 2", "Example 2", "उदाहरण 2")}</div>
        <pre className="ex-b">
          <span className="faint">Input   </span>n = 3, a = [2, 5, 9], target = 4{"\n"}
          <span className="faint">Output  </span>-1
        </pre>
      </div>
      <div className="ex">
        <div className="ex-h">{t("Constraints", "Constraints", "सीमाएँ")}</div>
        <ul className="cons mono">
          <li>2 ≤ n ≤ 2 · 10⁵</li>
          <li>0 ≤ a[i] ≤ 1.5 · 10⁹, {t("sorted", "sorted", "क्रमबद्ध")}</li>
          <li>0 ≤ target ≤ 3 · 10⁹</li>
          <li>{t("Time 1 s · memory 256 MB", "Samay 1 s · memory 256 MB", "समय 1 s · मेमोरी 256 MB")}</li>
        </ul>
      </div>
      <div className="hints">
        <div className="ex-h">{t("Hints", "Hints", "संकेत")}</div>
        {[
          t("The array is sorted. What does that tell you when a sum is too small?", "Array sorted hai. Sum chhota ho to isse kya pata chalta hai?", "ऐरे क्रमबद्ध है।"),
          t("Start one pointer at each end and move only one of them each step.", "Dono kinaron se ek-ek pointer, har kadam ek hi hilao.", "दोनों सिरों से एक-एक पॉइंटर।"),
          t("Check the largest possible sum against the type you store it in.", "Sabse bada sum kis type me rakh rahe ho, jaancho.", "सबसे बड़ा योग किस टाइप में है?"),
        ].map((h, i) => (
          <div key={i} className={`hint ${i < hints ? "open" : i === hints ? "next" : "lock"}`}>
            <button
              onClick={() => i === hints && setHints(hints + 1)}
              disabled={i > hints}
              className="hint-h"
            >
              {i < hints ? <Lightbulb /> : i === hints ? <ChevronRight /> : <Lock />}
              <b>
                {t("Hint", "Hint", "संकेत")} {i + 1}
              </b>
              <span className="tiny faint">
                {i < hints ? "" : i === hints ? t("click to open", "kholne ke liye click", "खोलें") : t(`opens after hint ${i}`, `hint ${i} ke baad`, `संकेत ${i} के बाद`)}
              </span>
            </button>
            {i < hints && <p className="small">{h}</p>}
          </div>
        ))}
        <p className="tiny faint">{t("Hints you open show on your submission. They never cost coins.", "Khole hint submission par dikhte hain. Coins nahi katte.", "खोले संकेत सबमिशन पर दिखते हैं।")}</p>
      </div>
      <div className="stmt-foot">
        <button className="btn ghost sm">
          <ThumbsUp />
          1.2k
        </button>
        <button className="btn ghost sm">
          <MessageSquare />
          48
        </button>
        <button className="btn ghost sm">
          <Bookmark />
          {t("Save", "Save", "सहेजें")}
        </button>
        <span className="grow" />
        <button className="btn ghost sm">
          <Flag />
          {t("Report a mistake", "Galti batao", "गलती बताएँ")}
        </button>
      </div>
    </div>
  );
}

function Submissions() {
  const t = useT();
  const rows = [
    ["wa", "Wrong answer", "test 23", "46 ms", "C++17", "14 min ago", "1 hint"],
    ["tle", "Time limit", "test 17", "> 1 s", "C++17", "32 min ago", "—"],
    ["wa", "Wrong answer", "test 4", "3 ms", "C++17", "41 min ago", "—"],
    ["ce", "Compile error", "line 6", "—", "C++17", "44 min ago", "—"],
  ];
  return (
    <div className="subs">
      <table className="tbl">
        <thead>
          <tr>
            <th>{t("Result", "Nateeja", "परिणाम")}</th>
            <th>{t("Time", "Samay", "समय")}</th>
            <th>{t("Lang", "Bhasha", "भाषा")}</th>
            <th>{t("When", "Kab", "कब")}</th>
            <th>{t("Hints", "Hints", "संकेत")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>
                <span className={`status ${r[0] === "ac" ? "live" : r[0] === "tle" ? "review" : "bad"}`}>{r[1]}</span>
                <span className="tiny faint" style={{ display: "block", paddingLeft: 13 }}>
                  {r[2]}
                </span>
              </td>
              <td className="num">{r[3]}</td>
              <td>{r[4]}</td>
              <td className="faint">{r[5]}</td>
              <td>{r[6]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProblemPane({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [tab, setTab] = useState("stmt");
  return (
    <>
      <PaneHead onClose={onClose} closeLabel={t("Hide problem", "Problem chhupao", "प्रश्न छिपाएँ")}>
        <Tabs
          value={tab}
          onChange={(v) => (v === "edit" ? navigate("editorial") : setTab(v))}
          items={[
            { id: "stmt", label: t("Problem", "Problem", "प्रश्न"), icon: <FileText /> },
            { id: "edit", label: t("Editorial", "Editorial", "हल"), icon: <BookOpen /> },
            { id: "subs", label: t("Submissions", "Submissions", "सबमिशन"), count: 4 },
          ]}
        />
      </PaneHead>
      <div className="pane-body">{tab === "stmt" ? <Statement /> : <Submissions />}</div>
    </>
  );
}

/* ---------------- code pane ---------------- */

function VerdictPanel({ v, setV, openAi }: { v: Verdict; setV: (v: Verdict) => void; openAi: () => void }) {
  const t = useT();
  return (
    <div className="verdict">
      <div className="verdict-h">
        <span className="eyebrow">{t("Result", "Nateeja", "परिणाम")}</span>
        <span className="grow" />
        <span className="mock-switch">
          <span className="tiny faint hide-narrow">{t("Mock: see each state", "Mock: har haalat", "मॉक: हर स्थिति")}</span>
          <Seg
            value={v}
            onChange={setV}
            items={[
              { id: "idle", label: t("Tests", "Tests", "टेस्ट") },
              { id: "wa", label: "WA" },
              { id: "tle", label: "TLE" },
              { id: "ac", label: "AC" },
            ]}
          />
        </span>
      </div>
      {v === "idle" && (
        <div className="v-body">
          <div className="row g6">
            {[1, 2, 3].map((n) => (
              <button key={n} className={`chip ${n === 1 ? "" : ""}`} aria-pressed={n === 1}>
                Case {n}
              </button>
            ))}
            <button className="chip">+</button>
          </div>
          <div className="io">
            <span className="tiny faint">n</span>
            <code className="mono">6</code>
            <span className="tiny faint">a</span>
            <code className="mono">[1, 3, 4, 6, 8, 11]</code>
            <span className="tiny faint">target</span>
            <code className="mono">10</code>
          </div>
        </div>
      )}
      {v === "wa" && (
        <div className="v-body">
          <div className="row g10">
            <CircleX className="v-ic bad" />
            <div className="grow">
              <b className="v-title t-red">{t("Wrong answer", "Galat jawab", "गलत उत्तर")}</b>
              <div className="small muted">{t("23 of 24 tests pass. The idea is right; one input breaks it.", "24 me se 23 pass. Idea sahi; ek input todta hai.", "24 में से 23 पास।")}</div>
            </div>
            <span className="tiny faint num">46 ms · 4.1 MB</span>
          </div>
          <div className="testbar">
            {Array.from({ length: 24 }, (_, i) => (
              <i key={i} className={i === 22 ? "bad" : "ok"} title={`Test ${i + 1}`} />
            ))}
          </div>
          <div className="small-test">
            <div className="row between">
              <span className="eyebrow">{t("Smallest test you fail", "Sabse chhota fail test", "सबसे छोटा फेल टेस्ट")}</span>
              <Badge tone="pen" sq>
                {t("shrunk from test 23", "test 23 se chhota kiya", "टेस्ट 23 से")}
              </Badge>
            </div>
            <div className="st-grid mono">
              <span className="faint">Input</span>
              <span>n = 2, a = [1073741824, 1073741824], target = 2147483648</span>
              <span className="faint">{t("Yours", "Aapka", "आपका")}</span>
              <span className="t-red">-1</span>
              <span className="faint">{t("Expected", "Sahi", "सही")}</span>
              <span className="t-tick">0 1</span>
            </div>
            <PenNote>{t("1073741824 is 2³⁰. Two of them make 2³¹, one more than an int can hold.", "1073741824 = 2³⁰. Do milkar 2³¹, int ki hadd se ek zyada.", "2³⁰ + 2³⁰ = 2³¹, int से एक ज़्यादा।")}</PenNote>
          </div>
          <div className="row wrap g8">
            <button className="btn sm ai" onClick={openAi}>
              <Sparkles />
              {t("Ask Sahayak why", "Sahayak se poochho", "सहायक से पूछें")}
            </button>
            <button className="btn sm ghost">
              <Lightbulb />
              {t("Next hint", "Agla hint", "अगला संकेत")}
            </button>
            <span className="grow" />
            <button className="btn sm" onClick={() => setV("ac")}>
              {t("Apply my fix (demo)", "Mera fix lagao (demo)", "मेरा सुधार (डेमो)")}
              <ArrowRight />
            </button>
          </div>
        </div>
      )}
      {v === "tle" && (
        <div className="v-body">
          <div className="row g10">
            <Clock className="v-ic warn" />
            <div className="grow">
              <b className="v-title t-coin">{t("Time limit exceeded", "Time limit cross", "समय सीमा पार")}</b>
              <div className="small muted">{t("Test 17 has n = 200,000. Your code took over 1 second.", "Test 17 me n = 200,000. Code 1 second se zyada chala.", "टेस्ट 17 में n = 200,000।")}</div>
            </div>
          </div>
          <div className="testbar">
            {Array.from({ length: 24 }, (_, i) => (
              <i key={i} className={i < 16 ? "ok" : i === 16 ? "slow" : "skip"} />
            ))}
          </div>
          <div className="banner marker">
            <Lightbulb />
            <span>{t("Two nested loops over n = 2 · 10⁵ is about 2 · 10¹⁰ steps. The sorted order lets you do it in one pass.", "n = 2 · 10⁵ par do loops ≈ 2 · 10¹⁰ kadam. Sorted order se ek pass me ho sakta hai.", "क्रमबद्ध क्रम से एक पास में।")}</span>
          </div>
        </div>
      )}
      {v === "ac" && (
        <div className="v-body">
          <div className="row g10">
            <span className="ac-tick">
              <Tick size={26} />
            </span>
            <div className="grow">
              <b className="v-title t-tick">{t("Accepted", "Accepted", "स्वीकृत")}</b>
              <div className="small muted">{t("All 24 tests pass · 38 ms · faster than 82% of C++ submissions", "Saare 24 pass · 38 ms · 82% C++ se tez", "सभी 24 पास · 38 ms")}</div>
            </div>
            <Badge tone="coin" icon={<Coins />}>
              +10
            </Badge>
          </div>
          <div className="ac-grid">
            <div className="well">
              <span className="tiny faint">{t("Complexity", "Complexity", "जटिलता")}</span>
              <b className="mono">O(n) · O(1)</b>
            </div>
            <div className="well">
              <span className="tiny faint">{t("Hints used", "Hints liye", "संकेत")}</span>
              <b>1 / 3</b>
            </div>
            <div className="well">
              <span className="tiny faint">{t("Attempts", "Koshishen", "प्रयास")}</span>
              <b>5</b>
            </div>
          </div>
          <div className="row wrap g8">
            <Link to="editorial" className="btn sm">
              <BookOpen />
              {t("Compare with editorial", "Editorial se milao", "हल से मिलाएँ")}
            </Link>
            <span className="grow" />
            <Link to="aaj" className="btn sm pri">
              {t("Next: Valid brackets", "Agla: Valid brackets", "अगला: Valid brackets")}
              <ArrowRight />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function CodePane({ v, setV, openAi, onClose }: { v: Verdict; setV: (v: Verdict) => void; openAi: () => void; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const fixed = v === "ac";
  const code = fixed ? BUGGY.replace("int sum = a[L] + a[R];", "long long sum = (long long)a[L] + a[R];") : BUGGY;
  const run = (to: Verdict) => {
    setRunning(true);
    window.setTimeout(() => {
      setRunning(false);
      setV(to);
      if (to === "wa") toast(t("Submitted · Wrong answer on test 23", "Submit · test 23 par galat", "सबमिट · टेस्ट 23 पर गलत"));
    }, document.documentElement.classList.contains("shots") ? 0 : 900);
  };
  return (
    <>
      <PaneHead onClose={onClose} closeLabel={t("Hide code", "Code chhupao", "कोड छिपाएँ")}>
        <div className="file-tabs">
          <span className="file-tab on">
            <CodeXml />
            solution.cpp
          </span>
          <span className="file-tab">notes.md</span>
        </div>
        <span className="grow" />
        <Menu
          width={160}
          trigger={(_, toggle) => (
            <button className="btn sm ghost" onClick={toggle}>
              C++17
              <ChevronDown />
            </button>
          )}
        >
          {(close) =>
            ["C++17", "Java 21", "Python 3.12", "JavaScript"].map((l) => (
              <button key={l} className="menu-item" onClick={close}>
                {l}
              </button>
            ))
          }
        </Menu>
        <button className="icon-btn sm" data-tip={t("Reset code", "Code reset", "रीसेट")} data-tip-pos="bottom">
          <RotateCcw />
        </button>
        <button className="icon-btn sm" data-tip={t("Editor settings", "Editor settings", "सेटिंग्स")} data-tip-pos="bottom">
          <Settings2 />
        </button>
        <button className="icon-btn sm" data-tip={t("Full screen", "Full screen", "पूर्ण स्क्रीन")} data-tip-pos="bottom">
          <Maximize2 />
        </button>
      </PaneHead>
      <div className="editor">
        <Code code={code} bad={v === "wa" ? [4] : []} good={fixed ? [4] : []} caret={4} className="ed-code" />
        {v === "wa" && (
          <div className="ed-note">
            <PenNote>{t("← can this overflow?", "← overflow ho sakta hai?", "← ओवरफ़्लो?")}</PenNote>
          </div>
        )}
      </div>
      <VerdictPanel v={v} setV={setV} openAi={openAi} />
      <div className="statusbar">
        <span className="row g4 t-tick">
          <Cloud />
          {t("Saved", "Saved", "सहेजा")}
        </span>
        <span className="faint hide-narrow">Ln 4, Col 32</span>
        <span className="faint hide-narrow">UTF-8 · Spaces 4</span>
        <span className="grow" />
        <button className="btn sm" onClick={() => run("idle")} disabled={running}>
          <Play />
          {t("Run", "Chalao", "चलाएँ")}
        </button>
        <button className="btn sm pri" onClick={() => run("wa")} disabled={running}>
          {running ? <span className="spinner on-pen" /> : <Send />}
          {running ? t("Judging…", "Jaanch rahe…", "जाँच…") : t("Submit", "Submit", "जमा करें")}
        </button>
      </div>
    </>
  );
}

/* ---------------- workspace ---------------- */

export function TaskTimer({ label, total = "2h 10m" }: { label: string; total?: string }) {
  const [s] = useStopwatch(18 * 60 + 6);
  const [paused, setPaused] = useState(false);
  const t = useT();
  return (
    <div className="task-timer">
      <Menu
        align="left"
        width={260}
        trigger={(_, toggle) => (
          <button className="tt-task" onClick={toggle}>
            {label}
            <ChevronDown />
          </button>
        )}
      >
        {(close) =>
          [
            ["Stack: the LIFO idea", true],
            ["Pair with target sum", false],
            ["Valid brackets", false],
            ["6 revision cards", false],
            ["Successive percentages", false],
          ].map(([n, d], i) => (
            <button key={i} className="menu-item" onClick={close}>
              {d ? <CircleCheck style={{ color: "var(--tick)" }} /> : <span className="num tiny faint" style={{ width: 15 }}>{i + 1}</span>}
              <span className={d ? "faint" : ""}>{n as string}</span>
            </button>
          ))
        }
      </Menu>
      <span className="tiny faint hide-narrow">
        {t("Today", "Aaj", "आज")} 38m / {total}
      </span>
      <span className={`timer ${paused ? "" : ""}`}>
        <Timer className="faint" style={{ width: 14, height: 14 }} />
        {hms(paused ? 18 * 60 + 6 : s, false)}
        <button className="icon-btn sm" onClick={() => setPaused(!paused)} aria-label={paused ? "Resume timer" : "Pause timer"}>
          {paused ? <Play /> : <Pause />}
        </button>
      </span>
    </div>
  );
}

export function ProblemScreen() {
  const t = useT();
  const { open, toggle, show } = usePanes({ stmt: true, code: true, ai: false });
  const [phoneTab, setPhoneTab] = useState("code");
  const [v, setV] = useState<Verdict>("wa");
  // Sahayak follows the global Ctrl+J state, so the toggle, Ctrl+J and "Ask Sahayak" all open the same third pane.
  const ai = useAi();
  useEffect(() => show("ai", ai.open), [ai.open, show]);
  const togglePane = (id: string) => (id === "ai" ? ai.toggle() : toggle(id));
  const openAi = () => {
    ai.setOpen(true);
    setPhoneTab("ai");
  };
  const paneDefs = [
    { id: "stmt", label: t("Problem", "Problem", "प्रश्न"), icon: <FileText /> },
    { id: "code", label: t("Code", "Code", "कोड"), icon: <CodeXml /> },
    { id: "ai", label: "Sahayak", icon: <Sparkles />, tone: "ai" as const },
  ];
  return (
    <>
      <FocusBar
        back="sheet"
        title="Pair with target sum"
        sub={t("DSA sheet · Step 3 · Two pointers", "DSA sheet · Step 3 · Two pointers", "DSA शीट · चरण 3")}
        center={<TaskTimer label={t("Task 2 of 5", "Kaam 2 / 5", "काम 2 / 5")} />}
        right={
          <>
            <button className="icon-btn hide-phone" data-tip={t("Previous problem", "Pichhla", "पिछला")} data-tip-pos="bottom">
              <ChevronLeft />
            </button>
            <button className="icon-btn hide-phone" data-tip={t("Next problem", "Agla", "अगला")} data-tip-pos="bottom">
              <ChevronRight />
            </button>
            <span className="hide-phone">
              <PaneToggles panes={paneDefs} open={open} toggle={togglePane} />
            </span>
          </>
        }
      />
      <Panes
        open={open}
        toggle={togglePane}
        phoneTab={phoneTab}
        setPhoneTab={setPhoneTab}
        panes={[
          { ...paneDefs[0], weight: 0.31, min: 300, content: <ProblemPane onClose={() => toggle("stmt")} /> },
          { ...paneDefs[1], weight: 0.42, min: 380, content: <CodePane v={v} setV={setV} openAi={openAi} onClose={() => toggle("code")} /> },
          { ...paneDefs[2], weight: 0.3, min: 320, rail: false, content: <SahayakPanel context="problem" onClose={() => ai.setOpen(false)} onMinimize={() => ai.setOpen(false)} /> },
        ]}
      />
    </>
  );
}

/* ---------------- SQL workspace ---------------- */

const SCHEMA = [
  { name: "students", cols: [["id", "int", "pk"], ["name", "text"], ["branch_id", "int", "fk"], ["cgpa", "numeric"]] },
  { name: "branches", cols: [["id", "int", "pk"], ["name", "text"]] },
  { name: "offers", cols: [["student_id", "int", "fk"], ["company", "text"], ["ctc_lpa", "numeric"]] },
];
const QUERY = `SELECT b.name AS branch, s.name, s.cgpa
FROM students s
JOIN branches b ON b.id = s.branch_id
LEFT JOIN offers o ON o.student_id = s.id
WHERE o.student_id IS NULL
ORDER BY b.name, s.cgpa DESC
LIMIT 3;`;

export function SqlScreen() {
  const t = useT();
  const { open, toggle, show } = usePanes({ q: true, ed: true, ai: false });
  const [phoneTab, setPhoneTab] = useState("ed");
  const ai = useAi();
  useEffect(() => show("ai", ai.open), [ai.open, show]);
  const togglePane = (id: string) => (id === "ai" ? ai.toggle() : toggle(id));
  const [res, setRes] = useState<"yours" | "diff">("diff");
  const rows = [
    ["CSE", "Ishita Rao", "9.41", true],
    ["CSE", "Kabir Shah", "9.12", true],
    ["CSE", "Neha Gill", "8.97", true],
    ["ECE", "—", "—", false],
  ];
  const paneDefs = [
    { id: "q", label: t("Question", "Sawaal", "प्रश्न"), icon: <FileText /> },
    { id: "ed", label: "SQL", icon: <Database /> },
    { id: "ai", label: "Sahayak", icon: <Sparkles />, tone: "ai" as const },
  ];
  return (
    <>
      <FocusBar
        back="practice"
        title={t("Top 3 per branch without an offer", "Har branch ke top 3 bina offer", "हर शाखा के शीर्ष 3")}
        sub={t("SQL · Joins · L3", "SQL · Joins · L3", "SQL · जॉइन")}
        right={
          <span className="hide-phone">
            <PaneToggles panes={paneDefs} open={open} toggle={togglePane} />
          </span>
        }
      />
      <Panes
        open={open}
        toggle={togglePane}
        phoneTab={phoneTab}
        setPhoneTab={setPhoneTab}
        panes={[
          {
            ...paneDefs[0],
            weight: 0.3,
            min: 300,
            content: (
              <>
                <PaneHead onClose={() => toggle("q")}>
                  <span className="h3" style={{ paddingLeft: 6 }}>
                    {t("Question", "Sawaal", "प्रश्न")}
                  </span>
                </PaneHead>
                <div className="pane-body stmt">
                  <p className="prose" style={{ fontSize: 14 }}>
                    {t(
                      "For every branch, list the three students with the highest CGPA who do not have an offer yet. Show branch, name and CGPA, best first.",
                      "Har branch ke wo 3 students jinka CGPA sabse zyada hai aur jinke paas abhi offer nahi. Branch, naam, CGPA dikhao.",
                      "हर शाखा के शीर्ष 3 छात्र जिनके पास ऑफ़र नहीं।",
                    )}
                  </p>
                  <div className="ex-h mt16">{t("Schema", "Schema", "स्कीमा")}</div>
                  <div className="schema">
                    {SCHEMA.map((tb) => (
                      <div key={tb.name} className="sch-t">
                        <div className="sch-h">
                          <Table2 />
                          {tb.name}
                        </div>
                        {tb.cols.map((c) => (
                          <div key={c[0]} className="sch-c mono">
                            <span>
                              {c[2] === "pk" && <KeyRound className="pk" />}
                              {c[2] === "fk" && <ArrowRight className="fk" />}
                              {c[0]}
                            </span>
                            <span className="faint">{c[1]}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ),
          },
          {
            ...paneDefs[1],
            weight: 0.7,
            min: 420,
            content: (
              <>
                <PaneHead onClose={() => toggle("ed")}>
                  <div className="file-tabs">
                    <span className="file-tab on">
                      <Database />
                      query.sql
                    </span>
                  </div>
                  <span className="grow" />
                  <span className="tiny faint">PostgreSQL 16</span>
                </PaneHead>
                <div className="editor" style={{ flex: "0 0 auto" }}>
                  <Code code={QUERY} bad={[7]} className="ed-code" />
                  <div className="ed-note" style={{ top: "calc(10px + 6 * 1.7em)" }}>
                    <PenNote>{t("← LIMIT applies to all rows, not per branch", "← LIMIT poori list par, branch-war nahi", "← LIMIT पूरी सूची पर")}</PenNote>
                  </div>
                </div>
                <div className="verdict" style={{ flex: 1, maxHeight: "none" }}>
                  <div className="verdict-h">
                    <span className="eyebrow">{t("Result", "Nateeja", "परिणाम")}</span>
                    <Badge tone="red">{t("3 rows · expected 9", "3 rows · chahiye 9", "3 पंक्तियाँ · अपेक्षित 9")}</Badge>
                    <span className="grow" />
                    <Seg
                      value={res}
                      onChange={setRes}
                      items={[
                        { id: "yours", label: t("Yours", "Aapka", "आपका") },
                        { id: "diff", label: t("Diff", "Fark", "अंतर") },
                      ]}
                    />
                  </div>
                  <div className="tbl-wrap">
                    <table className="tbl dense">
                      <thead>
                        <tr>
                          <th>branch</th>
                          <th>name</th>
                          <th className="r">cgpa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) =>
                          res === "yours" && !r[3] ? null : (
                            <tr key={i} className={res === "diff" && !r[3] ? "row-miss" : ""}>
                              <td>{r[0] as string}</td>
                              <td>{res === "diff" && !r[3] ? <span className="t-red">{t("missing: 3 ECE rows, 3 ME rows", "chhoote: 3 ECE, 3 ME", "छूटे: 3 ECE, 3 ME")}</span> : (r[1] as string)}</td>
                              <td className="r mono">{r[2] as string}</td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="statusbar">
                  <span className="faint">{t("12 ms · 3 rows", "12 ms · 3 rows", "12 ms")}</span>
                  <span className="grow" />
                  <button className="btn sm ai" onClick={() => ai.setOpen(true)}>
                    <Sparkles />
                    Sahayak
                  </button>
                  <button className="btn sm">
                    <Play />
                    {t("Run", "Chalao", "चलाएँ")}
                  </button>
                  <button className="btn sm pri">
                    <Send />
                    {t("Submit", "Submit", "जमा करें")}
                  </button>
                </div>
              </>
            ),
          },
          { ...paneDefs[2], weight: 0.3, min: 320, rail: false, content: <SahayakPanel context="general" onClose={() => ai.setOpen(false)} onMinimize={() => ai.setOpen(false)} /> },
        ]}
      />
    </>
  );
}

