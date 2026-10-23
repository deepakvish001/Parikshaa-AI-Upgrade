import { useEffect, useRef, useState, type ReactNode, type PointerEvent as RPointerEvent } from "react";
import {
  Files,
  Search,
  GitBranch,
  FlaskConical,
  ListChecks,
  Sparkles,
  Settings,
  CircleUserRound,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  X,
  PanelLeft,
  PanelBottom,
  PanelRight,
  Columns2,
  Play,
  Send,
  CircleCheck,
  CircleX,
  Circle,
  TriangleAlert,
  RefreshCw,
  Bell,
  Check,
  Plus,
  Trash2,
  Maximize2,
  Atom,
  FileText,
  Braces,
  Lightbulb,
  Radio,
  RotateCw,
  ExternalLink,
  ArrowLeft,
  SquareTerminal,
  Eye,
  Code2,
  GitCompare,
} from "lucide-react";
import { Link, useT, useToast } from "../lib/core";
import { useAi } from "../lib/state";
import { PenNote, LogoMark, Kbd } from "../ui/kit";
import { ThemeButton } from "../ui/shell";
import { useMedia } from "../ui/focus";
import { SahayakPanel } from "../ui/sahayak";
import { BrowserFrame, SplitApp } from "./build";

/* ---------------- the project on disk ---------------- */

type FileId = "settle" | "room" | "test" | "types" | "pkg";
const FILES: Record<FileId, { name: string; path: string[]; kind: "ts" | "tsx" | "json" | "test"; code: string; git?: "M" | "U"; errors?: number }> = {
  settle: {
    name: "settle.ts",
    path: ["src", "api", "settle.ts"],
    kind: "ts",
    git: "M",
    errors: 1,
    code: `import { Balance, Transfer } from "../types";

// Return the fewest transfers that settle every balance.
export function settle(balances: Balance[]): Transfer[] {
  const out: Transfer[] = [];
  const owes = balances.filter((b) => b.amount < 0);
  const gets = balances.filter((b) => b.amount > 0);
  for (const o of owes) {
    for (const g of gets) {
      const pay = Math.min(-o.amount, g.amount);
      out.push({ from: o.name, to: g.name, amount: pay });
      o.amount += pay;
      g.amount -= pay;
    }
  }
  return out;
}`,
  },
  room: {
    name: "RoomPage.tsx",
    path: ["src", "ui", "RoomPage.tsx"],
    kind: "tsx",
    git: "M",
    code: `import { useRoom } from "./useRoom";
import { settle } from "../api/settle";

export function RoomPage({ id }: { id: string }) {
  const room = useRoom(id);
  const plan = settle(room.balances);
  return (
    <main className="room">
      <h1>Room {room.number}</h1>
      <Total amount={room.total} month="This month" />
      <MemberList members={room.members} />
      <h2>Settle up</h2>
      {plan.map((t) => (
        <Transfer key={t.from + t.to} {...t} />
      ))}
    </main>
  );
}`,
  },
  test: {
    name: "settle.test.ts",
    path: ["tests", "settle.test.ts"],
    kind: "test",
    git: "U",
    code: `import { describe, it, expect } from "vitest";
import { settle } from "../src/api/settle";

const room = [
  { name: "Aarav", amount: 1240 },
  { name: "Ishita", amount: 310 },
  { name: "Kabir", amount: -620 },
  { name: "Zoya", amount: -930 },
];

describe("settle", () => {
  it("uses the fewest transfers (4 members)", () => {
    expect(settle(room)).toHaveLength(3);
  });
  it("skips ₹0 transfers", () => {
    expect(settle(room).every((t) => t.amount > 0)).toBe(true);
  });
});`,
  },
  types: {
    name: "types.ts",
    path: ["src", "types.ts"],
    kind: "ts",
    code: `export type Balance = { name: string; amount: number };
export type Transfer = { from: string; to: string; amount: number };`,
  },
  pkg: {
    name: "package.json",
    path: ["package.json"],
    kind: "json",
    code: `{
  "name": "hostel-split",
  "private": true,
  "scripts": {
    "dev": "vite",
    "test": "vitest run"
  }
}`,
  },
};

// The fix Quick fix offers for line 11, and what the last commit ("settle: first pass") holds.
const FIX_LINE = "      if (pay > 0) out.push({ from: o.name, to: g.name, amount: pay });";
const HEAD: Partial<Record<FileId, string>> = {
  settle: `import { Balance, Transfer } from "../types";

// Return the fewest transfers that settle every balance.
export function settle(balances: Balance[]): Transfer[] {
  const out: Transfer[] = [];
  const owes = balances.filter((b) => b.amount < 0);
  const gets = balances.filter((b) => b.amount > 0);
  for (const o of owes) {
    for (const g of gets) {
      out.push({ from: o.name, to: g.name, amount: -o.amount });
    }
  }
  return out;
}`,
  room: `import { useRoom } from "./useRoom";

export function RoomPage({ id }: { id: string }) {
  const room = useRoom(id);
  return (
    <main className="room">
      <h1>Room {room.number}</h1>
      <Total amount={room.total} month="This month" />
      <MemberList members={room.members} />
    </main>
  );
}`,
};
const codeOf = (id: FileId, fixed: boolean) => {
  const lines = FILES[id].code.split("\n");
  if (id === "settle" && fixed) lines[10] = FIX_LINE;
  return lines;
};

type Op = { k: "same" | "del" | "add"; text: string; a?: number; b?: number };
/** Line diff by longest common subsequence; the files here are short. */
function diffLines(a: string[], b: string[]): Op[] {
  const L = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) out.push({ k: "same", text: a[i], a: ++i, b: ++j });
    else if (i < a.length && (j === b.length || L[i + 1][j] >= L[i][j + 1])) out.push({ k: "del", text: a[i], a: ++i });
    else out.push({ k: "add", text: b[j], b: ++j });
  }
  return out;
}
type Mark = "add" | "mod";
const words = (l: string) => new Set(l.match(/\w+/g) ?? []);
const likeness = (x: string, y: string) => {
  const a = words(x);
  const b = words(y);
  let both = 0;
  a.forEach((w) => b.has(w) && both++);
  return both / Math.max(1, a.size + b.size - both);
};
/** Gutter marks against HEAD. In each changed hunk, an added line that looks like a removed one is "modified". */
function gutterMarks(id: FileId, lines: string[]): Record<number, Mark> {
  const head = HEAD[id];
  const marks: Record<number, Mark> = {};
  if (head === undefined) {
    if (FILES[id].git === "U") lines.forEach((_, i) => (marks[i + 1] = "add"));
    return marks;
  }
  let dels: string[] = [];
  let adds: Op[] = [];
  const flush = () => {
    adds.forEach((o) => (marks[o.b!] = "add"));
    for (const d of dels) {
      const best = adds.reduce<[Op | null, number]>((m, o) => (marks[o.b!] === "add" && likeness(d, o.text) > m[1] ? [o, likeness(d, o.text)] : m), [null, 0.3]);
      if (best[0]) marks[best[0].b!] = "mod";
    }
    dels = [];
    adds = [];
  };
  for (const op of diffLines(head.split("\n"), lines)) {
    if (op.k === "del") dels.push(op.text);
    else if (op.k === "add") adds.push(op);
    else flush();
  }
  flush();
  return marks;
}

const TREE: { label: string; depth: number; dir?: boolean; file?: FileId; open?: boolean }[] = [
  { label: "src", depth: 0, dir: true, open: true },
  { label: "api", depth: 1, dir: true, open: true },
  { label: "expenses.ts", depth: 2 },
  { label: "settle.ts", depth: 2, file: "settle" },
  { label: "ui", depth: 1, dir: true, open: true },
  { label: "RoomPage.tsx", depth: 2, file: "room" },
  { label: "useRoom.ts", depth: 2 },
  { label: "types.ts", depth: 1, file: "types" },
  { label: "tests", depth: 0, dir: true, open: true },
  { label: "settle.test.ts", depth: 1, file: "test" },
  { label: "package.json", depth: 0, file: "pkg" },
  { label: "README.md", depth: 0 },
];

const TESTS: [string, boolean, string?][] = [
  ["returns [] when everyone is even", true],
  ["one debtor, one creditor", true],
  ["amounts are whole rupees", true],
  ["never pays more than owed", true],
  ["handles 10 members", true],
  ["ignores zero balances", true],
  ["total paid equals total owed", true],
  ["is stable for the same input", true],
  ["uses the fewest transfers (4 members)", false, "expected length 3, received 4"],
  ["skips ₹0 transfers", false, "received Kabir → Ishita ₹0"],
  ["uses the fewest transfers (5 members)", false, "expected length 4, received 6"],
  ["largest debtor pays first", false, "first payer Kabir, expected Zoya"],
];

const FIXED_BY_QF = new Set(["uses the fewest transfers (4 members)", "skips ₹0 transfers"]);
const resultsFor = (fixed: boolean): [string, boolean, string?][] => TESTS.map(([n, ok, msg]) => (fixed && FIXED_BY_QF.has(n) ? [n, true] : [n, ok, msg]));

/* ---------------- small pieces ---------------- */

function FileIcon({ kind, name }: { kind?: string; name: string }) {
  if (kind === "tsx") return <Atom className="fi fi-tsx" />;
  if (kind === "json") return <Braces className="fi fi-json" />;
  if (name.endsWith(".md")) return <FileText className="fi fi-md" />;
  if (kind === "test" || name.includes(".test.")) return <span className="fi fi-test">TS</span>;
  return <span className="fi fi-ts">TS</span>;
}

const KW = new Set("import from export function const let return for of if else type describe it expect true false new".split(" "));
function tokens(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\/\/.*$)|("[^"]*"|`[^`]*`)|(\b\d+\b)|(<\/?[A-Z][A-Za-z]*|<\/?[a-z][a-z0-9]*(?=[\s>]))|([A-Za-z_]\w*)(?=\s*\()|([A-Za-z_]\w*)|(\s+|.)/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(line))) {
    const k = i++;
    if (m[1]) out.push(<span key={k} className="sx-com">{m[1]}</span>);
    else if (m[2]) out.push(<span key={k} className="sx-str">{m[2]}</span>);
    else if (m[3]) out.push(<span key={k} className="sx-num">{m[3]}</span>);
    else if (m[4]) out.push(<span key={k} className="sx-tag">{m[4]}</span>);
    else if (m[5]) out.push(<span key={k} className={KW.has(m[5]) ? "sx-kw" : "sx-fn"}>{m[5]}</span>);
    else if (m[6]) {
      const w = m[6];
      out.push(<span key={k} className={KW.has(w) ? "sx-kw" : /^[A-Z]/.test(w) ? "sx-ty" : "sx-var"}>{w}</span>);
    } else out.push(m[7]);
  }
  return out;
}

type EditorProps = {
  lines: string[];
  cursor: number;
  marks: Record<number, Mark>;
  err: number;
  lens?: { failing: number; stale: boolean; onRun: () => void };
  flash: number;
  qf: boolean;
  setQf: (v: boolean) => void;
  onFix: () => void;
  chat: boolean;
  setChat: (v: boolean) => void;
  fixed: boolean;
  onProblems: () => void;
};

/** The code editor: gutter with change marks, indent guides, current line, one error (squiggle, hover card, inline
    diagnostic, quick fix), Sahayak inline chat, minimap. */
function Editor({ lines, cursor, marks, err, lens, flash, qf, setQf, onFix, chat, setChat, fixed, onProblems }: EditorProps) {
  const t = useT();
  const ai = useAi();
  const [hover, setHover] = useState(false);
  const [asked, setAsked] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const askPanel = () => document.dispatchEvent(new CustomEvent("pk-ask-sahayak"));
  const closeChat = () => {
    setChat(false);
    setAsked(null);
    setDraft("");
  };
  const SUGG = fixed
    ? [t("Why do 2 tests still fail?", "2 tests ab bhi kyun fail?", "2 टेस्ट क्यों विफल?"), t("Is my loop O(n²)?", "Kya mera loop O(n²) hai?", "क्या लूप O(n²) है?")]
    : [t("What is wrong on this line?", "Is line me galti kya hai?", "इस पंक्ति में गलती?"), t("Give me a hint, not code", "Hint do, code nahi", "संकेत दो, कोड नहीं")];
  const hint = fixed
    ? t(
        "₹0 transfers are gone. The last two tests want the biggest debtor to pay first. Look at the order of owes before the loop. Which sort gives the biggest first?",
        "₹0 wale transfer chale gaye. Bache do tests chahte hain ki sabse bada karzdar pehle pay kare. Loop se pehle owes ka kram dekho. Kaunsa sort sabse bada pehle laayega?",
        "₹0 वाले ट्रांसफ़र गए। बचे दो टेस्ट चाहते हैं कि सबसे बड़ा कर्ज़दार पहले चुकाए। लूप से पहले owes का क्रम देखो।",
      )
    : t(
        "When o and g are already even, pay is 0 but push still runs. Put one condition before push. Which one? Write it yourself, then press Check my work.",
        "Jab o aur g pehle se barabar hain, pay 0 hai par push phir bhi chalta hai. Push se pehle ek shart lagao. Kaunsi? Khud likho, phir Kaam jaancho dabao.",
        "जब pay 0 हो, तब भी push चलता है। push से पहले एक शर्त लगाओ। कौन सी? खुद लिखो।",
      );
  return (
    <div className="ed-wrap">
      <div className="ed-scroll">
        {lens && (
          <div className="ed-lens" style={{ top: `calc(6px + 3 * var(--lh))` }}>
            <span onClick={lens.onRun} role="button">
              <Play /> {t("Run 12 tests", "12 tests chalao", "12 टेस्ट चलाएँ")}
            </span>
            {lens.stale ? (
              <span className="t-coin">{t("results are from before your change", "nateeje badlav se pehle ke", "नतीजे पुराने")}</span>
            ) : lens.failing ? (
              <span className="t-red">
                {lens.failing} {t("failing", "fail", "विफल")}
              </span>
            ) : (
              <span className="t-tick">{t("all pass", "sab pass", "सब पास")}</span>
            )}
            <span>{t("2 references", "2 references", "2 संदर्भ")}</span>
          </div>
        )}
        <pre className="vs-lines">
          {lines.map((l, i) => {
            const n = i + 1;
            const indent = (l.match(/^ */)?.[0].length ?? 0) / 2;
            const mk = marks[n];
            return (
              <div key={i} className={`ed-ln ${n === cursor ? "cur" : ""} ${n === err ? "err" : ""} ${lens && n === 4 ? "lens-gap" : ""} ${mk ? `g-${mk}` : ""} ${n === flash ? "ed-flash" : ""}`}>
                <span className="ed-num">{n}</span>
                <span className="ed-txt">
                  {Array.from({ length: indent }, (_, g) => (
                    <i key={g} className="ed-guide" style={{ left: `${g * 2}ch` }} />
                  ))}
                  {n === err ? (
                    <span className="sq-wrap" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
                      <span className="squiggle">{tokens(l)}</span>
                      {hover && (
                        <span className="ed-hover" role="tooltip">
                          <span className="eh-msg">
                            <CircleX />
                            <span>
                              {t("A transfer of ₹0 is pushed when pay is 0.", "pay 0 hone par ₹0 ka transfer jud jaata hai.", "pay 0 पर ₹0 का ट्रांसफ़र जुड़ता है।")}{" "}
                              <span className="faint mono">parikshaa-check(zero-transfer)</span>
                            </span>
                          </span>
                          <span className="eh-code mono">
                            <span className="sx-kw">const</span> <span className="sx-var">pay</span>: <span className="sx-ty">number</span>
                          </span>
                          <span className="eh-acts">
                            <button className="link tiny" onClick={onProblems}>
                              {t("View problem", "Problem dekho", "समस्या देखें")} <Kbd>Alt F8</Kbd>
                            </button>
                            <button className="link tiny" onClick={() => (setHover(false), setQf(true))}>
                              {t("Quick fix…", "Quick fix…", "त्वरित सुधार…")} <Kbd>Ctrl .</Kbd>
                            </button>
                          </span>
                        </span>
                      )}
                    </span>
                  ) : (
                    tokens(l)
                  )}
                  {l === "" ? " " : null}
                  {n === cursor && <span className="ed-caret" />}
                </span>
                {(n === err || (n === cursor && chat)) && <i className="ed-break" />}
                {n === err && (
                  <div className="ed-peek">
                    <CircleX />
                    <span>
                      {t("A transfer of ₹0 is pushed when pay is 0.", "pay 0 hone par ₹0 ka transfer jud jaata hai.", "pay 0 पर ₹0 का ट्रांसफ़र जुड़ता है।")} <span className="faint">parikshaa-check</span>
                    </span>
                    <button className="link tiny" onClick={() => setQf(true)}>
                      {t("Quick fix (Ctrl+.)", "Quick fix (Ctrl+.)", "त्वरित सुधार")}
                    </button>
                    <button className="link tiny" onClick={() => setChat(true)}>
                      {t("Ask Sahayak here (Ctrl+I)", "Yahin Sahayak (Ctrl+I)", "यहीं सहायक")}
                    </button>
                  </div>
                )}
                {n === cursor && chat && (
                  <form
                    className="ed-chat"
                    role="dialog"
                    aria-label="Sahayak inline chat"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (draft.trim()) setAsked(draft.trim());
                    }}
                    onKeyDown={(e) => e.key === "Escape" && closeChat()}
                  >
                    <div className="ec-row">
                      <Sparkles className="ec-ic" />
                      <input
                        ref={(el) => el?.focus({ preventScroll: true })}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={t("Ask about this line (you get a hint, not the answer)", "Is line ke baare me poochho (hint milega, jawab nahi)", "इस पंक्ति के बारे में पूछो")}
                        aria-label="Ask Sahayak"
                      />
                      <button type="submit" className="ib" aria-label="Send">
                        <Send />
                      </button>
                      <button type="button" className="ib" aria-label="Close" onClick={closeChat}>
                        <X />
                      </button>
                    </div>
                    {asked ? (
                      <div className="ec-ans">
                        <span className="tiny faint">
                          {t("You asked", "Tumne poochha", "तुमने पूछा")}: {asked}
                        </span>
                        <p>{hint}</p>
                        <div className="row g8 wrap">
                          <button type="button" className="btn sm" onClick={closeChat}>
                            <Check /> {t("Got it", "Samajh gaya", "समझ गया")}
                          </button>
                          <button type="button" className="btn sm ghost" onClick={() => (closeChat(), ai.open ? null : askPanel())}>
                            {t("Continue in side panel", "Side panel me aage", "साइड पैनल में")}
                          </button>
                          <span className="tiny faint">{t("Hint 1 of 3 for this milestone", "Is milestone ka hint 1 / 3", "संकेत 1 / 3")}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="ec-chips">
                        {SUGG.map((q) => (
                          <button type="button" key={q} className="chip" onClick={() => setAsked(q)}>
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </form>
                )}
              </div>
            );
          })}
        </pre>
        {err > 0 && (
          <button className="ed-bulb" style={{ top: `calc(6px + ${err} * var(--lh))` }} aria-label="Quick fix" onClick={() => setQf(!qf)}>
            <Lightbulb />
          </button>
        )}
        {err > 0 && qf && (
          <div className="qf-menu" role="menu" style={{ top: `calc(6px + ${err + 1} * var(--lh))` }} onKeyDown={(e) => e.key === "Escape" && setQf(false)}>
            <span className="qf-h">{t("Quick fix", "Quick fix", "त्वरित सुधार")}</span>
            <button role="menuitem" className="on" ref={(el) => el?.focus({ preventScroll: true })} onClick={onFix}>
              <Lightbulb className="t-coin" />
              <span className="grow">{t("Skip the transfer when pay is 0", "pay 0 ho to transfer chhodo", "pay 0 पर ट्रांसफ़र छोड़ो")}</span>
              <span className="qf-pref">{t("preferred", "behtar", "बेहतर")}</span>
            </button>
            <div className="qf-prev mono" aria-hidden="true">
              <div className="d-del">- {lines[err - 1].trim()}</div>
              <div className="d-add">+ {FIX_LINE.trim()}</div>
            </div>
            <button role="menuitem" onClick={() => (setQf(false), setChat(true))}>
              <Sparkles className="t-ai" />
              <span className="grow">{t("Explain it with Sahayak first", "Pehle Sahayak se samjho", "पहले सहायक से समझो")}</span>
              <Kbd>Ctrl I</Kbd>
            </button>
            <button role="menuitem" disabled>
              <X />
              <span className="grow">{t("Ignore this check on this line", "Is line par check band", "यह जाँच बंद")}</span>
              <span className="tiny faint">{t("off in this course", "is course me band", "बंद")}</span>
            </button>
            <span className="qf-note">
              {t("Using a quick fix is noted on the milestone as help taken.", "Quick fix lagane par milestone me 'madad li' likha jaata hai.", "क्विक फ़िक्स पर 'मदद ली' लिखा जाता है।")}
            </span>
          </div>
        )}
      </div>
      <div className="minimap" aria-hidden="true">
        {lines.map((l, i) => (
          <i
            key={i}
            className={i + 1 === err ? "err" : marks[i + 1] ? `m-${marks[i + 1]}` : ""}
            style={{ marginLeft: `${(l.match(/^ */)?.[0].length ?? 0) * 1.4}px`, width: `${Math.min(92, l.trim().length * 1.3)}px` }}
          />
        ))}
        <span className="mm-view" />
      </div>
    </div>
  );
}

/** Inline diff of the working tree against HEAD, as VS Code opens it from Source control. */
function DiffView({ id, fixed, onStage }: { id: FileId; fixed: boolean; onStage: () => void }) {
  const t = useT();
  const now = codeOf(id, fixed);
  const ops = diffLines(HEAD[id]?.split("\n") ?? [], now);
  const plus = ops.filter((o) => o.k === "add").length;
  const minus = ops.filter((o) => o.k === "del").length;
  return (
    <div className="ed-wrap">
      <div className="ed-scroll diff-scroll">
        <div className="diff-head">
          <GitCompare />
          <span className="mono small">
            {HEAD[id] ? "HEAD · settle: first pass" : t("new file", "nayi file", "नई फ़ाइल")} ↔ {t("Working tree", "Working tree", "वर्किंग ट्री")}
          </span>
          <span className="t-tick mono small">+{plus}</span>
          <span className="t-red mono small">−{minus}</span>
          <span className="grow" />
          <button className="btn sm ghost" onClick={onStage}>
            <Plus /> {t("Stage", "Stage", "स्टेज")}
          </button>
        </div>
        <pre className="vs-lines diff">
          {ops.map((o, i) => (
            <div key={i} className={`ed-ln d-${o.k}`}>
              <span className="ed-num">{o.a ?? ""}</span>
              <span className="ed-num">{o.b ?? ""}</span>
              <span className="d-sign">{o.k === "add" ? "+" : o.k === "del" ? "−" : ""}</span>
              <span className="ed-txt">
                {tokens(o.text)}
                {o.text === "" ? " " : null}
              </span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

function Section({ title, open: start = true, actions, children }: { title: string; open?: boolean; actions?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(start);
  return (
    <section className={`sb-sec ${open ? "open" : ""}`}>
      <div className="sb-sec-h">
        <button onClick={() => setOpen(!open)}>
          {open ? <ChevronDown /> : <ChevronRight />}
          {title}
        </button>
        {open && <span className="sb-acts">{actions}</span>}
      </div>
      {open && children}
    </section>
  );
}

/* ---------------- the IDE ---------------- */

type View = "explorer" | "search" | "scm" | "test" | "steps";
type Tab = FileId | `diff:${FileId}`;
const fileOf = (tab: Tab) => tab.replace("diff:", "") as FileId;
const isDiff = (tab: Tab) => tab.startsWith("diff:");
type PanelTab = "problems" | "output" | "terminal" | "tests" | "ports";

export function StudioScreen() {
  const t = useT();
  const toast = useToast();
  const ai = useAi();
  const phone = useMedia("(max-width: 760px)");
  const [view, setView] = useState<View>("explorer");
  const [side, setSide] = useState(true);
  const [panel, setPanel] = useState(true);
  const [ptab, setPtab] = useState<PanelTab>("tests");
  const [split, setSplit] = useState(true);
  const [tabs, setTabs] = useState<Tab[]>(["settle", "room", "test"]);
  const [cur, setCur] = useState<Tab>("settle");
  const [fixed, setFixed] = useState(false); // the quick fix on line 11 is applied
  const [ranFixed, setRanFixed] = useState(false); // which version the last test run checked
  const [runFor, setRunFor] = useState(false);
  const [step, setStep] = useState(-1); // tests done in the current run; -1 when idle
  const [qf, setQf] = useState(false);
  const [chat, setChat] = useState(false);
  const [flash, setFlash] = useState(0);
  const timer = useRef(0);
  const [palette, setPalette] = useState(false);
  const [q, setQ] = useState("");
  const [sideW, setSideW] = useState(260);
  const [panelH, setPanelH] = useState(230);
  const [phoneView, setPhoneView] = useState<"files" | "code" | "prev" | "tests" | "ai">("code");
  const ideRef = useRef<HTMLDivElement>(null);
  const running = step >= 0;
  const results = resultsFor(ranFixed);
  const passed = results.filter((x) => x[1]).length;
  const stale = fixed !== ranFixed;
  const errs = (id: FileId) => (id === "settle" && !fixed ? 1 : 0);
  const cf = fileOf(cur);

  // Tests report one by one, like vitest in watch mode; screenshots skip straight to the result.
  const run = () => {
    if (running) return;
    setPanel(true);
    setPtab("tests");
    const target = fixed;
    const done = () => {
      window.clearInterval(timer.current);
      setStep(-1);
      setRanFixed(target);
      const p = resultsFor(target).filter((x) => x[1]).length;
      toast(t(`${p} of 12 tests pass · ${12 - p} to go`, `12 me se ${p} pass · ${12 - p} baaki`, `12 में से ${p} पास`));
    };
    setRunFor(target);
    if (document.documentElement.classList.contains("shots")) return done();
    setStep(0);
    let i = 0;
    timer.current = window.setInterval(() => {
      i += 1;
      if (i > TESTS.length) done();
      else setStep(i);
    }, 110);
  };
  useEffect(() => () => window.clearInterval(timer.current), []);
  const applyFix = () => {
    setFixed(true);
    setQf(false);
    setCur("settle");
    setFlash(11);
    window.setTimeout(() => setFlash(0), 1400);
    toast(t("Line 11 changed. Run the tests again.", "Line 11 badli. Tests dobara chalao.", "पंक्ति 11 बदली। टेस्ट फिर चलाओ।"));
  };
  const open = (id: Tab) => {
    setTabs((x) => (x.includes(id) ? x : [...x, id]));
    setCur(id);
    if (phone) setPhoneView("code");
  };
  const close = (id: Tab) => {
    setTabs((x) => {
      const next = x.filter((y) => y !== id);
      if (id === cur && next.length) setCur(next[next.length - 1]);
      return next.length ? next : x;
    });
  };

  useEffect(() => {
    const ask = () => ai.setOpen(true);
    document.addEventListener("pk-ask-sahayak", ask);
    return () => document.removeEventListener("pk-ask-sahayak", ask);
  }, [ai]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPalette(true);
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSide((s) => !s);
      } else if (mod && e.key === "`") {
        e.preventDefault();
        setPanel((p) => !p);
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setChat(true);
      } else if (mod && e.key === ".") {
        e.preventDefault();
        if (!fixed) setQf(true);
      } else if (e.key === "Escape") {
        setPalette(false);
        setQf(false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [fixed]);

  const drag = (axis: "x" | "y") => (e: RPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const box = ideRef.current?.getBoundingClientRect();
    if (!box) return;
    const move = (ev: PointerEvent) => {
      if (axis === "x") setSideW(Math.max(180, Math.min(480, ev.clientX - box.left - 48)));
      else setPanelH(Math.max(120, Math.min(box.height - 220, box.bottom - 24 - ev.clientY)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("dragging");
    };
    document.body.classList.add("dragging");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const pickView = (v: View) => {
    if (v === view && side) setSide(false);
    else {
      setView(v);
      setSide(true);
    }
  };

  const ACT: [View, ReactNode, string, string?][] = [
    ["explorer", <Files key="e" />, t("Explorer", "Explorer", "एक्सप्लोरर") + " (Ctrl+Shift+E)"],
    ["search", <Search key="s" />, t("Search", "Search", "खोज") + " (Ctrl+Shift+F)"],
    ["scm", <GitBranch key="g" />, t("Source control", "Source control", "सोर्स कंट्रोल"), "3"],
    ["test", <FlaskConical key="t" />, t("Testing", "Testing", "टेस्टिंग"), passed < 12 ? String(12 - passed) : undefined],
    ["steps", <ListChecks key="m" />, t("Milestone steps", "Milestone ke kadam", "माइलस्टोन")],
  ];

  /* ----- side bar views ----- */
  const sidebar = (
    <aside className="ide-side" style={{ width: phone ? undefined : sideW }}>
      <div className="sb-title">
        <span>{{ explorer: t("Explorer", "Explorer", "एक्सप्लोरर"), search: t("Search", "Search", "खोज"), scm: t("Source control", "Source control", "सोर्स कंट्रोल"), test: t("Testing", "Testing", "टेस्टिंग"), steps: t("Milestone 3", "Milestone 3", "माइलस्टोन 3") }[view]}</span>
        <span className="grow" />
        {view === "test" && (
          <button className="ib" onClick={run} aria-label="Run all tests" data-tip-pos="bottom">
            <Play />
          </button>
        )}
        <button className="ib" aria-label="More">
          ···
        </button>
      </div>
      <div className="sb-body">
        {view === "explorer" && (
          <>
            <Section title={t("Open editors", "Open editors", "खुले एडिटर")} open={false}>
              {tabs.map((id) => (
                <button key={id} className={`tr ${cur === id ? "on" : ""}`} style={{ paddingLeft: 22 }} onClick={() => setCur(id)}>
                  {isDiff(id) ? <GitCompare className="fi" /> : <FileIcon kind={FILES[fileOf(id)].kind} name={FILES[fileOf(id)].name} />}
                  <span className="ellipsis">
                    {FILES[fileOf(id)].name}
                    {isDiff(id) ? ` (${t("Working Tree", "Working Tree", "वर्किंग ट्री")})` : ""}
                  </span>
                </button>
              ))}
            </Section>
            <Section
              title="HOSTEL-SPLIT"
              actions={
                <>
                  <button className="ib" aria-label="New file">
                    <Plus />
                  </button>
                  <button className="ib" aria-label="Refresh">
                    <RefreshCw />
                  </button>
                </>
              }
            >
              <div className="tree">
                {TREE.map((n) => {
                  const f = n.file ? FILES[n.file] : undefined;
                  const e = n.file ? errs(n.file) : 0;
                  return (
                    <button
                      key={n.label + n.depth}
                      className={`tr ${n.file && n.file === cur ? "on" : ""} ${e ? "has-err" : ""} ${f?.git === "M" ? "git-m" : f?.git === "U" ? "git-u" : ""}`}
                      style={{ paddingLeft: 8 + n.depth * 14 }}
                      onClick={() => n.file && open(n.file)}
                    >
                      {n.dir ? <ChevronDown className="chev" /> : <span className="chev" />}
                      {n.dir ? null : <FileIcon kind={f?.kind} name={n.label} />}
                      <span className="ellipsis grow">{n.label}</span>
                      {e ? <span className="deco err">{e}</span> : null}
                      {f?.git && <span className="deco">{f.git}</span>}
                      {n.dir && n.label === "src" && <span className="deco dot" />}
                    </button>
                  );
                })}
              </div>
            </Section>
            <Section title={t("Outline", "Outline", "रूपरेखा")} open={false}>
              {cf === "settle" ? (
                <div className="tree">
                  {[
                    ["settle", 0, "fn"],
                    ["out", 1, "var"],
                    ["owes", 1, "var"],
                    ["gets", 1, "var"],
                    ["pay", 2, "var"],
                  ].map(([l, d, k]) => (
                    <button key={l as string} className="tr" style={{ paddingLeft: 22 + (d as number) * 14 }} onClick={() => setCur("settle")}>
                      {k === "fn" ? <Braces className="fi" style={{ color: "var(--code-fn)" }} /> : <span className="fi ol-var">x</span>}
                      <span className="ellipsis">{l as string}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <span className="sb-empty tiny faint">{t("No symbols in this file.", "Is file me koi symbol nahi.", "कोई प्रतीक नहीं।")}</span>
              )}
            </Section>
            <Section title={t("Timeline", "Timeline", "समयरेखा")} open={false}>
              <div className="tl-list">
                {(
                  [
                    [t("File saved", "File save hui", "फ़ाइल सेव"), t("now", "abhi", "अभी")],
                    [t("Sahayak hint 1", "Sahayak hint 1", "सहायक संकेत 1"), "12 min"],
                    ["settle: first pass", t("2 hrs", "2 ghante", "2 घंटे")],
                    ["m2: room page", t("yesterday", "kal", "कल")],
                  ] as [string, string][]
                ).map(([l, w], i) => (
                  <div key={l} className="tl-row">
                    {i === 0 ? <Circle /> : i === 1 ? <Sparkles className="t-ai" /> : <GitBranch />}
                    <span className="ellipsis grow">{l}</span>
                    <span className="tiny faint">{w}</span>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}
        {view === "search" && (
          <div className="sb-pad col g8">
            <div className="sb-input">
              <input defaultValue="amount" aria-label="Search" />
              <span className="tiny faint">Aa ab .*</span>
            </div>
            <span className="tiny faint">{t("9 results in 3 files", "3 files me 9 nateeje", "3 फ़ाइलों में 9")}</span>
            {(
              [
                ["settle", ["const owes = balances.filter((b) => b.amount < 0);", "const pay = Math.min(-o.amount, g.amount);", "o.amount += pay;"]],
                ["test", ['{ name: "Aarav", amount: 1240 },', "expect(settle(room).every((t) => t.amount > 0))"]],
                ["types", ["export type Balance = { name: string; amount: number };"]],
              ] as [FileId, string[]][]
            ).map(([id, hits]) => (
              <div key={id} className="col">
                <button className="tr" onClick={() => open(id)}>
                  <ChevronDown className="chev" />
                  <FileIcon kind={FILES[id].kind} name={FILES[id].name} />
                  <b className="ellipsis grow">{FILES[id].name}</b>
                  <span className="deco cnt">{hits.length}</span>
                </button>
                {hits.map((h) => (
                  <button key={h} className="hit" onClick={() => open(id)}>
                    {h.split("amount").map((p, i, a) => (
                      <span key={i}>
                        {p}
                        {i < a.length - 1 && <mark>amount</mark>}
                      </span>
                    ))}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        {view === "scm" && (
          <div className="sb-pad col g10">
            <textarea className="sb-commit" placeholder={t("Message (Ctrl+Enter to commit on 'm3-settle')", "Message (Ctrl+Enter se commit)", "संदेश")} defaultValue="settle: skip zero transfers" />
            <button className="btn sm pri block" onClick={() => toast(t("Committed on m3-settle", "m3-settle par commit", "कमिट"))}>
              <Check />
              {t("Commit", "Commit", "कमिट")}
            </button>
            <Section title={t("Changes", "Changes", "बदलाव")} actions={<span className="deco cnt">3</span>}>
              {(["settle", "room", "test"] as FileId[]).map((id) => (
                <button key={id} className={`tr ${FILES[id].git === "U" ? "git-u" : "git-m"} ${cur === `diff:${id}` ? "on" : ""}`} style={{ paddingLeft: 22 }} onClick={() => open(`diff:${id}`)} title={t("Open changes", "Badlav dekho", "बदलाव देखें")}>
                  <FileIcon kind={FILES[id].kind} name={FILES[id].name} />
                  <span className="ellipsis grow">
                    {FILES[id].name} <span className="faint tiny">{FILES[id].path.slice(0, -1).join("/")}</span>
                  </span>
                  <span className="deco">{FILES[id].git}</span>
                </button>
              ))}
            </Section>
          </div>
        )}
        {view === "test" && (
          <div className="sb-pad col g6">
            <div className="test-sum">
              <span className="t-tick">
                <CircleCheck /> {passed}
              </span>
              <span className="t-red">
                <CircleX /> {12 - passed}
              </span>
              <span className="faint">{running ? `· ${step}/12` : "· 46 ms"}</span>
            </div>
            <button className="tr">
              <ChevronDown className="chev" />
              {running ? <span className="spinner ti" /> : passed === 12 ? <CircleCheck className="t-tick ti" /> : <CircleX className="t-red ti" />}
              <b className="grow">settle.test.ts</b>
            </button>
            {(running ? resultsFor(runFor) : results).map(([n, ok, msg], i) => {
              const pending = running && i >= step;
              return (
                <div key={n} className={`col ${pending ? "t-pend" : ""}`}>
                  <button className="tr" style={{ paddingLeft: 30 }} onClick={() => open("test")}>
                    {pending ? i === step ? <span className="spinner ti" /> : <Circle className="ti faint" /> : ok ? <CircleCheck className="ti t-tick" /> : <CircleX className="ti t-red" />}
                    <span className="ellipsis grow">{n}</span>
                  </button>
                  {msg && !pending && <span className="test-msg mono">{msg}</span>}
                </div>
              );
            })}
          </div>
        )}
        {view === "steps" && (
          <div className="sb-pad col g12">
            <div className="col g4">
              <b className="small">{t("Settle up", "Settle up", "हिसाब बराबर")}</b>
              <span className="tiny faint">{t("Show the fewest transfers that clear every balance.", "Sabse kam transfers jo har hisaab barabar kar dein.", "सबसे कम ट्रांसफ़र।")}</span>
              <div className="ms-bar">
                <i style={{ width: `${(passed / 12) * 100}%` }} />
              </div>
              <span className="tiny faint num">{passed} / 12 {t("tests", "tests", "टेस्ट")}</span>
            </div>
            {[
              [t("Write settle() that pays debts", "Karz chukane wala settle() likho", "settle() लिखो"), true],
              [t("Pair the biggest debtor with the biggest creditor", "Sabse bada dena + sabse bada lena jodo", "सबसे बड़े को जोड़ो"), false],
              [t("Skip zero-rupee transfers", "₹0 wale transfer chhodo", "₹0 छोड़ो"), ranFixed],
              [t("Show the plan on RoomPage", "RoomPage par plan dikhao", "RoomPage पर दिखाओ"), false],
            ].map(([s, d], i) => (
              <div key={i} className={`g-step ${d ? "done" : i === 1 ? "now" : ""}`}>
                {d ? <CircleCheck /> : <Circle />}
                <span>{s as string}</span>
              </div>
            ))}
            <button className="btn sm ai" onClick={() => ai.setOpen(true)}>
              <Sparkles />
              {t("Ask Sahayak for a hint", "Sahayak se hint", "सहायक से संकेत")}
            </button>
          </div>
        )}
      </div>
    </aside>
  );

  /* ----- editor group ----- */
  const editorGroup = (
    <section className="ide-group">
      <div className="ide-tabs">
        <div className="ide-tablist" role="group" aria-label={t("Open files", "Khuli files", "खुली फ़ाइलें")}>
        {tabs.map((id) => {
          const f = fileOf(id);
          const e = isDiff(id) ? 0 : errs(f);
          return (
          <div key={id} className={`ide-tab ${cur === id ? "on" : ""} ${id === "test" ? "preview" : ""}`} onClick={() => setCur(id)}>
            <button aria-current={cur === id ? "true" : undefined} className="ide-tab-b" onClick={() => setCur(id)}>
              {isDiff(id) ? <GitCompare className="fi" /> : <FileIcon kind={FILES[f].kind} name={FILES[f].name} />}
              <span className={e ? "t-red" : ""}>
                {FILES[f].name}
                {isDiff(id) ? <span className="faint"> ({t("Working Tree", "Working Tree", "वर्किंग ट्री")})</span> : null}
              </span>
              {e ? <span className="tab-err">{e}</span> : null}
            </button>
            <button
              className="tab-x"
              aria-label={`Close ${FILES[f].name}`}
              onClick={(e) => {
                e.stopPropagation();
                close(id);
              }}
            >
              <X />
            </button>
          </div>
          );
        })}
        </div>
        <span className="grow" />
        <span className="tab-acts">
          <button className="ib" onClick={run} aria-label="Run tests" data-tip={t("Run tests", "Tests chalao", "टेस्ट चलाएँ")} data-tip-pos="bottom">
            <Play />
          </button>
          <button className={`ib ${split ? "on" : ""}`} onClick={() => setSplit(!split)} aria-label="Split editor" data-tip={t("Split with preview", "Preview ke saath", "प्रीव्यू के साथ")} data-tip-pos="bottom">
            <Columns2 />
          </button>
        </span>
      </div>
      <div className="crumbs-ide">
        {FILES[cf].path.map((p, i) => (
          <span key={p}>
            {i > 0 && <ChevronRight />}
            {i === FILES[cf].path.length - 1 && <FileIcon kind={FILES[cf].kind} name={p} />}
            {p}
            {i === FILES[cf].path.length - 1 && isDiff(cur) ? ` (${t("Working Tree", "Working Tree", "वर्किंग ट्री")})` : ""}
          </span>
        ))}
        {cur === "settle" && (
          <span>
            <ChevronRight />
            <Braces className="fi" style={{ color: "var(--code-fn)" }} />
            settle
          </span>
        )}
      </div>
      {isDiff(cur) ? (
        <DiffView id={cf} fixed={fixed} onStage={() => toast(t(`${FILES[cf].name} staged`, `${FILES[cf].name} stage hui`, "स्टेज हुई"))} />
      ) : (
        (() => {
          const lines = codeOf(cf, fixed);
          return (
            <Editor
              key={cf}
              lines={lines}
              cursor={cf === "settle" ? 11 : 1}
              marks={gutterMarks(cf, lines)}
              err={errs(cf) ? 11 : -1}
              lens={cf === "settle" ? { failing: 12 - passed, stale, onRun: run } : undefined}
              flash={cf === "settle" ? flash : 0}
              qf={qf}
              setQf={setQf}
              onFix={applyFix}
              chat={chat}
              setChat={setChat}
              fixed={fixed}
              onProblems={() => (setPanel(true), setPtab("problems"))}
            />
          );
        })()
      )}
    </section>
  );

  const previewGroup = (
    <section className="ide-group prev">
      <div className="ide-tabs">
        <div className="ide-tab on">
          <Radio className="fi" style={{ color: "var(--tick)" }} />
          <span>{t("Preview", "Preview", "प्रीव्यू")}</span>
          <span className="tiny faint">localhost:5173</span>
        </div>
        <span className="grow" />
        <span className="tab-acts">
          <button className="ib" aria-label="Reload">
            <RotateCw />
          </button>
          <button className="ib" aria-label="Open in browser">
            <ExternalLink />
          </button>
          <button className="ib" aria-label="Close preview" onClick={() => setSplit(false)}>
            <X />
          </button>
        </span>
      </div>
      <div className="prev-wrap">
        <BrowserFrame url="localhost:5173/rooms/214">
          <SplitApp big settled={false} noZero={fixed} />
        </BrowserFrame>
        <PenNote className="prev-note" key={String(fixed)}>
          {fixed
            ? t("3 transfers now. Next: biggest debtor first.", "Ab 3 transfers. Agla: sabse bada karzdar pehle.", "अब 3 ट्रांसफ़र। अगला: सबसे बड़ा पहले।")
            : t("4 transfers, one of ₹0. Should be 3.", "4 transfers, ek ₹0 ka. 3 hone chahiye.", "4 ट्रांसफ़र, 3 होने चाहिए।")}
        </PenNote>
      </div>
    </section>
  );

  /* ----- bottom panel ----- */
  const PT: [PanelTab, string, string?][] = [
    ["problems", t("Problems", "Problems", "समस्याएँ"), fixed ? "1" : "2"],
    ["output", t("Output", "Output", "आउटपुट")],
    ["terminal", t("Terminal", "Terminal", "टर्मिनल")],
    ["tests", t("Test results", "Test results", "टेस्ट नतीजे"), passed < 12 ? String(12 - passed) : undefined],
    ["ports", t("Ports", "Ports", "पोर्ट"), "2"],
  ];
  const shownTests = running ? resultsFor(runFor) : results;
  const fail = results.find((r) => !r[1]);
  const want = fail?.[2]?.match(/expected length (\d+), received (\d+)/);
  const panelBody =
    ptab === "tests" ? (
    <div className="pn-pad mono pn-tests">
      {running && (
        <div className="pn-prog" aria-hidden="true">
          <i style={{ width: `${(step / 12) * 100}%` }} />
        </div>
      )}
      <div className="faint"> RUN v2.1.4 /hostel-split</div>
      {shownTests.map(([n, ok], i) =>
        running && i > step ? null : running && i === step ? (
          <div key={n} className="faint">
            {" "}
            <span className="spinner sm" /> settle › {n}
          </div>
        ) : (
          <div key={n} className={running ? "ln-new" : ""}>
            {ok ? <span className="t-tick"> ✓</span> : <span className="t-red"> ×</span>} settle › {n}
          </div>
        ),
      )}
      {!running && fail && (
        <div className="pn-fail">
          <div className="t-red">FAIL tests/settle.test.ts › {fail[0]}</div>
          <div>AssertionError: {fail[2]}</div>
          {want && (
            <>
              <div className="t-tick">- Expected {want[1]}</div>
              <div className="t-red">+ Received {want[2]}</div>
            </>
          )}
          <div className="faint"> ❯ tests/settle.test.ts:13:26</div>
        </div>
      )}
      {!running && (
        <div>
          {" "}
          Tests <span className="t-red">{12 - passed} failed</span> | <span className="t-tick">{passed} passed</span> (12)
        </div>
      )}
    </div>
  ) : ptab === "terminal" ? (
    <div className="pn-term">
      <pre className="pn-pad mono">
        <span className="t-tick">aarav</span>
        <span className="faint">@sandbox</span> <span className="t-pen">~/hostel-split</span> <span className="faint">(m3-settle)</span> $ npm run dev{"\n"}
        {"\n"}
        {"  "}VITE v6.0.7 ready in 412 ms{"\n"}
        {"  "}➜ Local: <span className="t-pen">http://localhost:5173/</span>
        {"\n"}
        <span className="faint">[api]</span> GET /rooms/214 <span className="t-tick">200</span> 12ms{"\n"}
        <span className="faint">[api]</span> POST /settle <span className="t-tick">200</span> 4ms{"\n"}
        <span className="t-tick">aarav</span>
        <span className="faint">@sandbox</span> <span className="t-pen">~/hostel-split</span> $ <span className="type-caret" />
      </pre>
      <div className="term-list">
        <span className="on">
          <SquareTerminal /> node
        </span>
        <span>
          <SquareTerminal /> bash
        </span>
      </div>
    </div>
  ) : ptab === "problems" ? (
    <div className="pn-pad">
      <button className="tr" onClick={() => setCur("settle")}>
        <ChevronDown className="chev" />
        <FileIcon kind="ts" name="settle.ts" />
        <b>settle.ts</b>
        <span className="faint tiny">src/api</span>
        <span className="deco cnt">{fixed ? 1 : 2}</span>
      </button>
      {!fixed && (
        <button className="tr" style={{ paddingLeft: 30 }} onClick={() => setCur("settle")}>
          <CircleX className="ti t-red" />
          <span className="grow">{t("A transfer of ₹0 is pushed when pay is 0", "pay 0 hone par ₹0 ka transfer jud jaata hai", "₹0 का ट्रांसफ़र")}</span>
          <span className="faint tiny mono">parikshaa-check [Ln 11, Col 7]</span>
        </button>
      )}
      <button className="tr" style={{ paddingLeft: 30 }}>
        <TriangleAlert className="ti t-coin" />
        <span className="grow">{t("Inner loop mutates o.amount while iterating gets", "Andar ka loop o.amount badal raha", "o.amount बदल रहा")}</span>
        <span className="faint tiny mono">eslint [Ln 12, Col 7]</span>
      </button>
    </div>
  ) : ptab === "ports" ? (
    <div className="pn-pad">
      <table className="tbl dense">
        <thead>
          <tr>
            <th>Port</th>
            <th>{t("Forwarded address", "Address", "पता")}</th>
            <th>{t("Process", "Process", "प्रोसेस")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="mono">5173</td>
            <td className="mono t-pen">hostel-split-aarav.preview.parikshaa.in</td>
            <td className="small">vite</td>
          </tr>
          <tr>
            <td className="mono">8787</td>
            <td className="mono t-pen">localhost:8787</td>
            <td className="small">api</td>
          </tr>
        </tbody>
      </table>
    </div>
  ) : (
    <pre className="pn-pad mono faint">
      [checker] 12 tests found in tests/settle.test.ts{"\n"}
      [checker] sandbox node 22.11 · 512 MB · network off{"\n"}
      [preview] rebuilt in 38 ms
    </pre>
  );
  const bottomPanel = (
    <section className="ide-panel" style={{ height: phone ? undefined : panelH }}>
      <div className="pn-tabs">
        {PT.map(([id, l, c]) => (
          <button key={id} className={ptab === id ? "on" : ""} onClick={() => setPtab(id)}>
            {l}
            {c && <span className={`pn-c ${id === "problems" || id === "tests" ? "bad" : ""}`}>{c}</span>}
          </button>
        ))}
        <span className="grow" />
        <button className="ib" aria-label="New terminal">
          <Plus />
        </button>
        <button className="ib" aria-label="Clear">
          <Trash2 />
        </button>
        <button className="ib" aria-label="Maximise panel" onClick={() => setPanelH(520)}>
          <Maximize2 />
        </button>
        <button className="ib" aria-label="Close panel" onClick={() => setPanel(false)}>
          <X />
        </button>
      </div>
      <div className="pn-body" tabIndex={0} role="region" aria-label={t("Panel output", "Panel ka output", "पैनल आउटपुट")}>
        {panelBody}
      </div>
    </section>
  );

  /* ----- palette ----- */
  const CMDS: [string, string, () => void][] = [
    ["Parikshaa: Check my work", "Ctrl+Enter", run],
    ["Parikshaa: Submit milestone 3", "", () => toast(t("Milestone opens when all 12 tests pass", "12 tests pass hone par submit", "सभी टेस्ट पास होने पर"))],
    ["Testing: Run all tests", "", run],
    ["View: Toggle terminal", "Ctrl+`", () => setPanel((p) => !p)],
    ["View: Toggle primary side bar", "Ctrl+B", () => setSide((s) => !s)],
    ["Sahayak: Explain the error on this line", "Ctrl+J", () => ai.setOpen(true)],
    ["Sahayak: Inline chat on this line", "Ctrl+I", () => setChat(true)],
    ["Quick fix", "Ctrl+.", () => (fixed ? toast(t("No quick fixes here", "Yahan koi quick fix nahi", "कोई सुधार नहीं")) : (setCur("settle"), setQf(true)))],
    ["Git: Open changes (settle.ts)", "", () => open("diff:settle")],
    ["Preview: Open live preview to the side", "", () => setSplit(true)],
    ["Git: Commit", "", () => toast(t("Committed on m3-settle", "m3-settle par commit", "कमिट"))],
    ["Format document", "Shift+Alt+F", () => toast(t("Formatted with Prettier", "Prettier se format", "फ़ॉर्मैट"))],
  ];
  const shown = CMDS.filter((c) => c[0].toLowerCase().includes(q.toLowerCase()));

  /* ----- phone ----- */
  if (phone) {
    return (
      <div className="ide is-phone" ref={ideRef}>
        <header className="ide-title">
          <Link to="project" className="ib" aria-label="Back to project">
            <ArrowLeft />
          </Link>
          <span className="ellipsis grow small">
            <b>hostel-split</b> · {FILES[cf].name}
          </span>
          <button className="btn sm" onClick={run} disabled={running} aria-label={t("Run tests", "Tests chalao", "टेस्ट चलाएँ")}>
            {running ? <span className="spinner" /> : <Play />}
          </button>
          <button className="btn sm pri" onClick={() => toast(t("Milestone opens when all 12 tests pass", "12 tests pass hone par submit", "सभी टेस्ट पास होने पर"))} aria-label={t("Submit milestone", "Milestone submit", "पड़ाव जमा करें")}>
            <Send />
          </button>
        </header>
        <div className="ide-phone-body">
          {phoneView === "files" && sidebar}
          {phoneView === "code" && editorGroup}
          {phoneView === "prev" && previewGroup}
          {phoneView === "tests" && bottomPanel}
          {phoneView === "ai" && <SahayakPanel context="studio" onClose={() => setPhoneView("code")} />}
        </div>
        <nav className="ide-phone-tabs">
          {(
            [
              ["files", <Files key="f" />, t("Files", "Files", "फ़ाइलें")],
              ["code", <Code2 key="c" />, t("Code", "Code", "कोड")],
              ["prev", <Eye key="p" />, t("Preview", "Preview", "प्रीव्यू")],
              ["tests", <FlaskConical key="t" />, `${passed}/12`],
              ["ai", <Sparkles key="a" />, "Sahayak"],
            ] as [typeof phoneView, ReactNode, string][]
          ).map(([id, ic, l]) => (
            <button key={id} className={phoneView === id ? "on" : ""} onClick={() => setPhoneView(id)}>
              {ic}
              <span>{l}</span>
            </button>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div className="ide" ref={ideRef}>
      <header className="ide-title">
        <Link to="project" className="ide-brand" aria-label="Back to project">
          <LogoMark size={18} />
        </Link>
        <nav className="ide-menu hide-narrow">
          {["File", "Edit", "Selection", "View", "Go", "Run", "Terminal", "Help"].map((m) => (
            <button key={m}>{m}</button>
          ))}
        </nav>
        <span className="grow" />
        <div className="ide-nav">
          <button className="ib" aria-label="Back">
            <ChevronLeft />
          </button>
          <button className="ib" aria-label="Forward">
            <ChevronRight />
          </button>
          <button className="cmd-center" onClick={() => setPalette(true)}>
            <Search />
            <span className="ellipsis">hostel-split · {t("Milestone 3", "Milestone 3", "माइलस्टोन 3")}</span>
            <Kbd>Ctrl ⇧ P</Kbd>
          </button>
        </div>
        <span className="grow" />
        <div className="row g4">
          <button className={`ib ${side ? "on" : ""}`} onClick={() => setSide(!side)} aria-label="Toggle primary side bar" data-tip="Ctrl+B" data-tip-pos="bottom">
            <PanelLeft />
          </button>
          <button className={`ib ${panel ? "on" : ""}`} onClick={() => setPanel(!panel)} aria-label="Toggle panel" data-tip="Ctrl+`" data-tip-pos="bottom">
            <PanelBottom />
          </button>
          <button className={`ib ${ai.open ? "on" : ""}`} onClick={ai.toggle} aria-label="Toggle Sahayak" data-tip="Ctrl+J" data-tip-pos="bottom">
            <PanelRight />
          </button>
          <span className="vsep" />
          <button className="btn sm" onClick={run} disabled={running}>
            {running ? <span className="spinner" /> : <Play />}
            {t("Check my work", "Kaam jaancho", "जाँचें")}
          </button>
          <button className="btn sm pri" onClick={() => toast(t("Milestone opens when all 12 tests pass", "12 tests pass hone par submit", "सभी टेस्ट पास होने पर"))}>
            <Send />
            {t("Submit M3", "M3 submit", "M3 जमा")}
          </button>
          <ThemeButton />
        </div>
      </header>

      <div className="ide-main">
        <nav className="ide-act" aria-label="Activity bar">
          {ACT.map(([id, ic, label, badge]) => (
            <button key={id} className={side && view === id ? "on" : ""} onClick={() => pickView(id)} aria-label={label} data-tip={label}>
              {ic}
              {badge && <span className={`act-badge ${id === "test" ? "bad" : ""}`}>{badge}</span>}
            </button>
          ))}
          <button className={ai.open ? "on ai" : "ai"} onClick={ai.toggle} aria-label="Sahayak (Ctrl+J)" data-tip="Sahayak (Ctrl+J)">
            <Sparkles />
          </button>
          <span className="grow" />
          <button aria-label="Account" data-tip="Aarav Sharma">
            <CircleUserRound />
          </button>
          <button aria-label="Manage" data-tip={t("Settings", "Settings", "सेटिंग")}>
            <Settings />
          </button>
        </nav>

        {side && sidebar}
        {side && <div className="sash x" onPointerDown={drag("x")} />}

        <div className="ide-center">
          <div className="ide-groups">
            {editorGroup}
            {split && previewGroup}
          </div>
          {panel && <div className="sash y" onPointerDown={drag("y")} />}
          {panel && bottomPanel}
        </div>

        {ai.open && (
          <aside className="ide-aux">
            <SahayakPanel context="studio" onClose={() => ai.setOpen(false)} onMinimize={() => ai.setOpen(false)} />
          </aside>
        )}
      </div>

      <footer className="ide-status">
        <span className="st-remote">
          <LogoMark size={12} /> {t("Parikshaa sandbox", "Parikshaa sandbox", "सैंडबॉक्स")}
        </span>
        <button>
          <GitBranch /> m3-settle*
        </button>
        <button>
          <RefreshCw /> 0↓ 2↑
        </button>
        <button onClick={() => (setPanel(true), setPtab("problems"))}>
          <CircleX /> {fixed ? 0 : 1} <TriangleAlert /> 1
        </button>
        <button onClick={() => (setPanel(true), setPtab("tests"))}>
          {running ? <span className="spinner sm" /> : <FlaskConical />} {running ? `${step}/12` : `${passed}/12`}
        </button>
        <span className="grow" />
        <span className="hide-narrow">{t("Ln 11, Col 7", "Ln 11, Col 7", "पंक्ति 11")}</span>
        <span className="hide-narrow">{t("Spaces: 2", "Spaces: 2", "स्पेस: 2")}</span>
        <span className="hide-narrow">UTF-8</span>
        <span className="hide-narrow">LF</span>
        <span>
          <Braces /> TypeScript
        </span>
        <span className="hide-narrow">
          <Check /> Prettier
        </span>
        <button aria-label="Notifications">
          <Bell />
        </button>
      </footer>

      {palette && (
        <div className="pal-scrim" onClick={() => setPalette(false)}>
          <div className="pal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("> Type a command", "> Command likho", "> कमांड")} />
            <div className="pal-list">
              {shown.map(([l, k, fn], i) => (
                <button
                  key={l}
                  className={i === 0 ? "on" : ""}
                  onClick={() => {
                    setPalette(false);
                    setQ("");
                    fn();
                  }}
                >
                  <span className="grow">
                    <b>{l.split(":")[0]}</b>
                    {l.includes(":") ? ":" + l.split(":").slice(1).join(":") : ""}
                  </span>
                  {k && <span className="tiny faint mono">{k}</span>}
                </button>
              ))}
              {shown.length === 0 && <span className="tiny faint" style={{ padding: 10 }}>{t("No matching commands", "Koi command nahi mili", "कोई कमांड नहीं")}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
