import { useEffect, useRef, useState } from "react";
import {
  Play,
  Send,
  RotateCcw,
  Sparkles,
  Lightbulb,
  Lock,
  ChevronDown,
  ChevronRight,
  ThumbsUp,
  MessageSquare,
  Bookmark,
  CircleX,
  CircleCheck,
  Clock,
  ArrowRight,
  FileText,
  History,
  Users,
  Plus,
  Copy,
  Maximize2,
  BookOpenCheck,
  X,
  Settings2,
  CloudCheck,
} from "lucide-react";
import { Link, useT, useToast } from "../lib/core";
import { Bar, Code, Confetti, Level, Tabs, Seg } from "../ui/kit";
import { FocusBar, TaskTimer } from "../ui/focus";
import { SahayakChat } from "../ui/sahayak-dock";

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
export const FIXED = BUGGY.replace("int sum = a[L] + a[R];", "long long sum = (long long)a[L] + a[R];");

type Phase = "idle" | "running" | "wa" | "ac" | "tle";

function Statement() {
  const t = useT();
  const [hint, setHint] = useState(0);
  return (
    <div className="stmt">
      <h1>Pair with target sum</h1>
      <div className="row wrap" style={{ gap: 6 }}>
        <Level lv={2} />
        <span className="tag">Two pointers</span>
        <span className="tag">Arrays</span>
        <span className="tag outline">Nimbu Labs · {t("sample", "namuna", "नमूना")}</span>
        <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
          · {t("Solved by 61% who tried", "Try karne walon me 61% ne hal kiya", "कोशिश करने वालों में 61% ने हल किया")}
        </span>
      </div>
      <p>
        {t(
          "You are given a sorted array a of n integers and a number target. Find two different positions i < j such that a[i] + a[j] = target, and print them (0-indexed).",
          "Aapko n integers ka sorted array a aur ek number target diya hai. Do alag positions i < j dhoondho jahan a[i] + a[j] = target, aur unhe print karo (0 se ginti).",
          "आपको n पूर्णांकों का क्रमबद्ध ऐरे a और एक संख्या target दी है। दो अलग स्थान i < j खोजें जहाँ a[i] + a[j] = target हो।",
        )}
      </p>
      <p>
        {t(
          "If there are many answers, print any one; the checker accepts every correct pair. If there is no pair, print -1.",
          "Kai jawab hon to koi bhi ek print karo; checker har sahi jodi maanta hai. Koi jodi na ho to -1.",
          "कई उत्तर हों तो कोई भी एक; चेकर हर सही जोड़ी मानता है। जोड़ी न हो तो -1।",
        )}
      </p>
      <div className="ex">
        <b>{t("Example 1", "Udaharan 1", "उदाहरण 1")}</b>
        <pre>
          <span className="k">Input</span>
          {"   n = 6, a = [1, 3, 4, 6, 8, 11], target = 10\n"}
          <span className="k">Output</span>
          {"  2 3\n"}
          <span className="k">Why</span>
          {"     a[2] + a[3] = 4 + 6 = 10"}
        </pre>
      </div>
      <div className="ex">
        <b>{t("Example 2", "Udaharan 2", "उदाहरण 2")}</b>
        <pre>
          <span className="k">Input</span>
          {"   n = 3, a = [2, 5, 9], target = 4\n"}
          <span className="k">Output</span>
          {"  -1"}
        </pre>
      </div>
      <div className="constraints">
        <b>{t("Constraints", "Shartein", "शर्तें")}</b>
        <ul className="mono">
          <li>2 ≤ n ≤ 2 · 10⁵</li>
          <li>0 ≤ a[i] ≤ 1.5 · 10⁹, {t("sorted", "sorted", "क्रमबद्ध")}</li>
          <li>0 ≤ target ≤ 3 · 10⁹</li>
          <li>{t("Time limit 1 s · memory 256 MB", "Time 1 s · memory 256 MB", "समय 1 s · मेमोरी 256 MB")}</li>
        </ul>
      </div>
      <div className="hints">
        <b>{t("Hints", "Hints", "संकेत")}</b>
        {[
          [t("Use that the array is sorted", "Array sorted hai, iska fayda lo", "ऐरे क्रमबद्ध है"), t("Start one pointer at each end. Compare the sum with target and move one pointer.", "Dono kinaron par ek-ek pointer. Sum ko target se milao aur ek pointer khiskao.", "दोनों सिरों पर एक-एक पॉइंटर।")],
          [t("Which pointer to move?", "Kaunsa pointer khiskayein?", "कौन-सा पॉइंटर?"), t("Sum too small → move L right. Too big → move R left.", "Sum chhota → L daayein. Bada → R baayein.", "योग छोटा → L दाएँ।")],
          [t("Check the types", "Types jaancho", "टाइप जाँचें"), t("How large can a[L] + a[R] get compared with INT_MAX?", "a[L] + a[R] INT_MAX ke mukable kitna bada ho sakta hai?", "a[L] + a[R] कितना बड़ा हो सकता है?")],
        ].map(([h, body], i) => (
          <div key={i} className={`hint ${i < hint ? "open" : ""}`}>
            <button type="button" onClick={() => i === hint && setHint(hint + 1)} disabled={i > hint} aria-expanded={i < hint}>
              {i < hint ? <Lightbulb size={14} /> : i === hint ? <ChevronRight size={14} /> : <Lock size={13} />}
              {t("Hint", "Hint", "संकेत")} {i + 1}
              {i < hint ? `: ${h}` : i === hint ? <span className="faint">· {t("click to open", "kholne ke liye click", "खोलने के लिए क्लिक")}</span> : <span className="faint">· {t("opens after hint", "pichhle hint ke baad", "पिछले के बाद")} {i}</span>}
            </button>
            {i < hint && <p>{body}</p>}
          </div>
        ))}
        <span className="faint" style={{ fontSize: "var(--fs-11)" }}>
          {t("Hints used are shown on your submission, honestly. They do not cost coins.", "Kitne hint liye, submission par dikhega. Coins nahi katenge.", "कितने संकेत लिए, यह दिखेगा।")}
        </span>
      </div>
      <div className="stmt-foot">
        <button type="button" className="btn ghost sm">
          <ThumbsUp size={14} /> 1.2k
        </button>
        <Link to="community" className="btn ghost sm">
          <MessageSquare size={14} /> 48
        </Link>
        <button type="button" className="btn ghost sm">
          <Bookmark size={14} /> {t("Save", "Save", "सहेजें")}
        </button>
      </div>
    </div>
  );
}

function Submissions() {
  const t = useT();
  const rows: [string, string, string, string, string][] = [
    ["2 min ago", "Wrong answer", "23/24", "—", "bad"],
    ["11 min ago", "Wrong answer", "23/24", "—", "bad"],
    ["14 min ago", "Compile error", "—", "—", "warn"],
  ];
  return (
    <div className="table-wrap">
      <table className="dtable">
        <thead>
          <tr>
            <th>{t("When", "Kab", "कब")}</th>
            <th>{t("Verdict", "Nateeja", "नतीजा")}</th>
            <th className="r">{t("Tests", "Tests", "टेस्ट")}</th>
            <th className="r">{t("Time", "Samay", "समय")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="muted">{r[0]}</td>
              <td>
                <span className={`tag ${r[4]}`}>{r[1]}</span>
              </td>
              <td className="r num">{r[2]}</td>
              <td className="r num">{r[3]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Verdict({ phase, onFix, onSahayak }: { phase: Phase; onFix: () => void; onSahayak: () => void }) {
  const t = useT();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (phase !== "running") return;
    setN(0);
    const id = window.setInterval(() => setN((x) => Math.min(24, x + 2)), 70);
    return () => window.clearInterval(id);
  }, [phase]);
  if (phase === "idle")
    return (
      <div className="vd-idle">
        <div className="ex" style={{ margin: 0 }}>
          <b>{t("Custom input", "Apna input", "अपना इनपुट")}</b>
          <textarea id="custom-input" className="mono" defaultValue={"6 10\n1 3 4 6 8 11"} rows={3} />
        </div>
        <p className="faint" style={{ fontSize: "var(--fs-12)" }}>
          {t("Run checks the 2 examples and your input. Submit runs all 24 tests.", "Run 2 udaharan aur aapka input chalata hai. Submit saare 24 tests.", "रन 2 उदाहरण चलाता है। सबमिट सभी 24 टेस्ट।")}
        </p>
      </div>
    );
  if (phase === "running")
    return (
      <div className="vd-running">
        <div className="row between">
          <b>
            {t("Running tests", "Tests chal rahe hain", "टेस्ट चल रहे हैं")} <span className="num">{n}/24</span>
          </b>
          <span className="faint">{t("in the sandbox", "sandbox me", "सैंडबॉक्स में")}</span>
        </div>
        <Bar value={(n / 24) * 100} />
        <div className="test-dots">
          {Array.from({ length: 24 }, (_, i) => (
            <i key={i} className={i < n ? (i === 21 && n > 21 ? "bad" : "ok") : ""} />
          ))}
        </div>
      </div>
    );
  if (phase === "wa")
    return (
      <div className="vd vd-wa">
        <div className="vd-head">
          <CircleX size={22} />
          <div className="grow">
            <b>{t("Wrong answer", "Galat jawab", "गलत उत्तर")}</b>
            <span>{t("Passed 23 of 24 tests. The idea is right; one input breaks it.", "24 me se 23 pass. Idea sahi; ek input todta hai.", "24 में से 23 पास।")}</span>
          </div>
          <span className="faint num" style={{ fontSize: "var(--fs-12)" }}>
            {t("Runtime", "Runtime", "समय")} 46 ms · 4.1 MB
          </span>
        </div>
        <div className="test-dots">
          {Array.from({ length: 24 }, (_, i) => (
            <i key={i} className={i === 21 ? "bad" : "ok"} title={`Test ${i + 1}`} />
          ))}
        </div>
        <div className="sft big">
          <div className="row between">
            <span className="eyebrow">{t("Smallest test you fail", "Sabse chhota galat test", "सबसे छोटा गलत टेस्ट")}</span>
            <span className="tag info">{t("shrunk from test 22", "test 22 se chhota kiya", "टेस्ट 22 से छोटा")}</span>
          </div>
          <dl>
            <dt>{t("Input", "Input", "इनपुट")}</dt>
            <dd className="mono">n = 2, a = [1073741824, 1073741824], target = 2147483648</dd>
            <dt>{t("Your output", "Aapka output", "आपका आउटपुट")}</dt>
            <dd className="mono bad">-1</dd>
            <dt>{t("Expected", "Sahi", "सही")}</dt>
            <dd className="mono ok">0 1</dd>
          </dl>
          <p className="faint" style={{ fontSize: "var(--fs-12)" }}>
            {t("1073741824 is 2³⁰. The hidden test itself stays hidden.", "1073741824 = 2³⁰. Asli hidden test chhupa hi rehta hai.", "1073741824 = 2³⁰।")}
          </p>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button type="button" className="btn secondary sm" onClick={onSahayak}>
            <Sparkles size={14} /> {t("Ask Sahayak why", "Sahayak se kyun poochho", "सहायक से पूछें")}
          </button>
          <button type="button" className="btn ghost sm">
            <Lightbulb size={14} /> {t("Next hint", "Agla hint", "अगला संकेत")}
          </button>
          <span className="grow" />
          <button type="button" className="btn ok sm" onClick={onFix}>
            {t("Apply my fix (demo)", "Mera fix lagao (demo)", "मेरा सुधार लगाएँ (डेमो)")} <ArrowRight size={13} />
          </button>
        </div>
      </div>
    );
  if (phase === "tle")
    return (
      <div className="vd vd-tle">
        <div className="vd-head">
          <Clock size={22} />
          <div className="grow">
            <b>{t("Time limit exceeded", "Samay seema paar", "समय सीमा पार")}</b>
            <span>{t("Stopped at test 19 (n = 200,000) after 1 s.", "Test 19 (n = 200,000) par 1 s ke baad ruka.", "टेस्ट 19 पर रुका।")}</span>
          </div>
        </div>
        <div className="tle-chart" aria-label="Time against input size">
          {[1, 10, 100, 1000, 10000, 100000, 200000].map((n, i) => (
            <div key={n} className="tle-col">
              <i style={{ height: `${Math.min(100, (i * i * 2.4) + 4)}%` }} className={i === 6 ? "bad" : ""} />
              <span className="num">{n >= 1000 ? `${n / 1000}k` : n}</span>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: "var(--fs-13)" }}>
          {t(
            "Time grows like n². Two nested loops over 200,000 items is 4 · 10¹⁰ steps. Two pointers needs n steps.",
            "Samay n² ki tarah badhta hai. 200,000 par do loop = 4 · 10¹⁰ steps. Two pointers ko sirf n steps.",
            "समय n² की तरह बढ़ता है।",
          )}
        </p>
      </div>
    );
  return (
    <div className="vd vd-ac" style={{ position: "relative", overflow: "hidden" }}>
      <Confetti count={18} />
      <div className="vd-head">
        <CircleCheck size={22} />
        <div className="grow">
          <b>{t("Accepted", "Sahi jawab", "स्वीकृत")}</b>
          <span>{t("All 24 tests passed. 2 hints used, 3 tries.", "Saare 24 tests pass. 2 hint, 3 koshish.", "सभी 24 टेस्ट पास।")}</span>
        </div>
        <span className="tag plus">+15 {t("coins", "coins", "सिक्के")}</span>
      </div>
      <div className="ac-stats">
        <div>
          <span>{t("Runtime", "Runtime", "समय")}</span>
          <b className="num">44 ms</b>
          <small>{t("faster than 72%", "72% se tez", "72% से तेज़")}</small>
        </div>
        <div>
          <span>{t("Memory", "Memory", "मेमोरी")}</span>
          <b className="num">4.1 MB</b>
          <small>{t("less than 64%", "64% se kam", "64% से कम")}</small>
        </div>
        <div>
          <span>{t("Your time", "Aapka samay", "आपका समय")}</span>
          <b className="num">27 min</b>
          <small>{t("plan said 30", "plan me 30", "योजना में 30")}</small>
        </div>
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        <Link to="editorial" className="btn secondary sm">
          <BookOpenCheck size={14} /> {t("Read the editorial", "Editorial padho", "हल पढ़ें")}
        </Link>
        <button type="button" className="btn ghost sm">
          <Users size={14} /> {t("Share your solution", "Apna hal share karo", "अपना हल साझा करें")}
        </button>
        <span className="grow" />
        <Link to="problem" className="btn primary sm">
          {t("Next task: Valid brackets", "Agla kaam: Valid brackets", "अगला काम")} <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}

export function ProblemScreen() {
  const t = useT();
  const toast = useToast();
  const [left, setLeft] = useState<"problem" | "editorial" | "subs" | "discuss">("problem");
  const [phase, setPhase] = useState<Phase>("wa");
  const [fixed, setFixed] = useState(false);
  const [dock, setDock] = useState(false);
  const [mobileTab, setMobileTab] = useState<"problem" | "code" | "result">("problem");
  const [split, setSplit] = useState(44);
  const drag = useRef(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!drag.current || !wrap.current) return;
      const r = wrap.current.getBoundingClientRect();
      setSplit(Math.min(70, Math.max(28, ((e.clientX - r.left) / r.width) * 100)));
    };
    const up = () => (drag.current = false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  const run = (final: Phase) => {
    setPhase("running");
    setMobileTab("result");
    window.setTimeout(() => setPhase(final), 1100);
  };

  return (
    <div className={`work ${dock ? "with-dock" : ""}`}>
      <FocusBar
        back="sheet"
        backLabel={t("Back to the sheet", "Sheet par wapas", "शीट पर वापस")}
        title={
          <>
            <b>Pair with target sum</b>
            <span className="faint hide-phone">· DSA sheet · Step 3</span>
          </>
        }
        center={<TaskTimer index={1} />}
        right={
          <button type="button" className={`btn sm ${dock ? "secondary" : "ghost"}`} onClick={() => setDock((d) => !d)} aria-pressed={dock}>
            <Sparkles size={14} /> <span className="hide-phone">Sahayak</span>
          </button>
        }
      />
      <div className="mtabs" role="tablist" aria-label="Panels">
        {(
          [
            ["problem", t("Problem", "Problem", "प्रश्न")],
            ["code", t("Code", "Code", "कोड")],
            ["result", t("Result", "Nateeja", "नतीजा")],
          ] as const
        ).map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={mobileTab === v} onClick={() => setMobileTab(v)}>
            {l}
            {v === "result" && phase === "wa" && <span className="dot" style={{ color: "var(--bad)" }} />}
          </button>
        ))}
      </div>
      <div className="work-body" ref={wrap} style={{ ["--split" as string]: `${split}%` }}>
        <section className={`pane pane-left ${mobileTab === "problem" ? "m-on" : ""}`} aria-label="Problem">
          <Tabs
            label="Problem tabs"
            value={left}
            onChange={setLeft}
            tabs={[
              { value: "problem", label: t("Problem", "Problem", "प्रश्न"), icon: <FileText size={14} /> },
              { value: "editorial", label: t("Editorial", "Editorial", "हल"), icon: <BookOpenCheck size={14} /> },
              { value: "subs", label: t("Submissions", "Submissions", "सबमिशन"), icon: <History size={14} /> },
              { value: "discuss", label: t("Discuss", "Charcha", "चर्चा"), icon: <MessageSquare size={14} /> },
            ]}
          />
          <div className="pane-scroll">
            {left === "problem" && <Statement />}
            {left === "subs" && <Submissions />}
            {left === "editorial" && (
              <div className="locked">
                <Lock size={22} />
                <b>{t("Editorial opens after you solve it or try 3 times", "Hal ya 3 koshish ke baad editorial khulega", "हल या 3 कोशिश के बाद खुलेगा")}</b>
                <p className="muted">{t("You have tried 2 times. Hints are open now.", "Aapne 2 baar try kiya. Hints abhi khule hain.", "आपने 2 बार कोशिश की।")}</p>
                <Link to="editorial" className="btn secondary sm">
                  {t("Open anyway (mock)", "Phir bhi kholo (mock)", "फिर भी खोलें")}
                </Link>
              </div>
            )}
            {left === "discuss" && (
              <div className="stack" style={{ padding: 16 }}>
                {[
                  ["Riya K", t("Why does sorting matter here? Hashing also works in O(n).", "Sorting yahan kyun zaroori? Hashing bhi O(n) me chalta hai.", "हैशिंग भी O(n) में चलती है।"), 12],
                  ["Kabir R", t("Got WA on test 22 too. Spoiler: check your int.", "Mujhe bhi test 22 par WA. Spoiler: int jaancho.", "टेस्ट 22 पर WA।"), 31],
                ].map(([n, m, v]) => (
                  <div key={n as string} className="post">
                    <span className="avatar sm">{(n as string)[0]}</span>
                    <div className="grow">
                      <b>{n}</b>
                      <p className={(m as string).includes("Spoiler") ? "spoiler" : ""}>{m}</p>
                    </div>
                    <span className="faint num">▲ {v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div
          className="split-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels"
          onPointerDown={() => (drag.current = true)}
          onDoubleClick={() => setSplit(44)}
        />

        <section className={`pane pane-right ${mobileTab !== "problem" ? "m-on" : ""} ${mobileTab === "result" ? "m-result" : ""}`} aria-label="Code">
          <div className="editor-top">
            <div className="file-tabs">
              <span className="file-tab on">solution.cpp</span>
              <span className="file-tab">notes.md</span>
              <button type="button" className="icon-btn" aria-label="New file">
                <Plus size={14} />
              </button>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="chip">
                C++ 17 <ChevronDown size={13} />
              </button>
              <button type="button" className="icon-btn" aria-label="Reset code" onClick={() => toast(t("Code reset to the template", "Code template par wapas", "कोड टेम्पलेट पर वापस"))}>
                <RotateCcw size={15} />
              </button>
              <button type="button" className="icon-btn hide-phone" aria-label="Copy">
                <Copy size={15} />
              </button>
              <button type="button" className="icon-btn hide-phone" aria-label="Editor settings">
                <Settings2 size={15} />
              </button>
              <button type="button" className="icon-btn hide-phone" aria-label="Full screen">
                <Maximize2 size={15} />
              </button>
            </div>
          </div>
          <div className="editor">
            <Code code={fixed ? FIXED : BUGGY} bad={phase === "wa" && !fixed ? [4] : []} hl={fixed ? [4] : []} caretLine={4} />
          </div>
          <div className="editor-status">
            <span>
              <CloudCheck size={13} /> {t("Saved", "Saved", "सहेजा")}
            </span>
            <span>Ln 4, Col 32</span>
            <span className="hide-phone">UTF-8 · {t("Spaces", "Spaces", "स्पेस")} 4</span>
            <span className="grow" />
            <button type="button" className="btn secondary sm" onClick={() => run("idle")}>
              <Play size={13} /> {t("Run", "Run", "चलाएँ")}
            </button>
            <button type="button" className="btn primary sm" onClick={() => run(fixed ? "ac" : "wa")}>
              <Send size={13} /> {t("Submit", "Submit", "जमा करें")}
            </button>
          </div>
          <div className="console">
            <div className="console-head">
              <span className="eyebrow">{t("Result", "Nateeja", "नतीजा")}</span>
              <div className="row" style={{ gap: 6 }}>
                <span className="faint hide-phone" style={{ fontSize: "var(--fs-11)" }}>
                  {t("Mock: see each state", "Mock: har state dekho", "मॉक: हर स्थिति")}
                </span>
                <Seg<Phase>
                  label="Verdict state"
                  value={phase === "running" ? "wa" : phase}
                  onChange={(v) => {
                    if (v === "ac") setFixed(true);
                    if (v === "wa") setFixed(false);
                    setPhase(v);
                  }}
                  options={[
                    { value: "idle", label: t("Input", "Input", "इनपुट") },
                    { value: "wa", label: "WA" },
                    { value: "tle", label: "TLE" },
                    { value: "ac", label: "AC" },
                  ]}
                />
              </div>
            </div>
            <div className="console-body" key={phase}>
              <Verdict
                phase={phase}
                onFix={() => {
                  setFixed(true);
                  toast(t("Line 4 now uses long long. Submit again.", "Line 4 ab long long. Dobara submit karo.", "पंक्ति 4 अब long long।"));
                  setMobileTab("code");
                }}
                onSahayak={() => setDock(true)}
              />
            </div>
          </div>
        </section>

        {dock && (
          <aside className="pane pane-dock" aria-label="Sahayak">
            <div className="panel-head" style={{ padding: "10px 14px" }}>
              <b style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Sparkles size={15} style={{ color: "var(--action)" }} /> Sahayak
              </b>
              <button type="button" className="icon-btn" onClick={() => setDock(false)} aria-label="Close Sahayak">
                <X size={16} />
              </button>
            </div>
            <SahayakChat compact />
          </aside>
        )}
      </div>
    </div>
  );
}
