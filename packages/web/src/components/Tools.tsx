import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AArrowDown, AArrowUp, BookOpen, Calculator as CalculatorIcon, Check, CloudOff, Keyboard, LoaderCircle, Moon, NotebookPen, Sun, X } from "lucide-react";
import { display, evaluate, type AngleUnit } from "../calc.ts";
import { usePreferences } from "../i18n.tsx";

/** A setting kept on this device, read once and written as it changes. Storage may be refused; then it lasts the page. */
export function useStoredSetting<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null && (allowed as readonly string[]).includes(stored) ? (stored as T) : fallback;
    } catch {
      return fallback;
    }
  });
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // Kept for this page only.
      }
    },
    [key],
  );
  return [value, set];
}

const TEXT_SIZES = ["90", "100", "112", "125"] as const;
type TextSize = (typeof TEXT_SIZES)[number];

/** The reading size of the whole page, as the A−/A+ of a CBT sets it, and the theme. */
export function useReadingPreferences() {
  const [size, setSize] = useStoredSetting<TextSize>("parikshaa.textSize", "100", TEXT_SIZES);
  const [theme, setTheme] = useStoredSetting<"system" | "light" | "dark">("parikshaa.theme", "system", ["system", "light", "dark"]);
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = size === "100" ? "" : `${size}%`;
    return () => {
      root.style.fontSize = "";
    };
  }, [size]);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    return () => root.removeAttribute("data-theme");
  }, [theme]);
  const dark = theme === "dark" || (theme === "system" && typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches);
  const at = TEXT_SIZES.indexOf(size);
  return {
    dark,
    toggleTheme: () => setTheme(dark ? "light" : "dark"),
    smaller: at > 0 ? () => setSize(TEXT_SIZES[at - 1]!) : null,
    larger: at < TEXT_SIZES.length - 1 ? () => setSize(TEXT_SIZES[at + 1]!) : null,
  };
}

export type SaveState = "idle" | "saving" | "saved" | "offline";

/** Whether everything the candidate has done is safe: one answer for the whole paper, always in sight. */
export function SaveStatus({ state }: { readonly state: SaveState }) {
  const { t } = usePreferences();
  if (state === "idle") return null;
  const Icon = state === "saving" ? LoaderCircle :state === "offline" ? CloudOff : Check;
  return (
    <span className={`save-status ${state}`} role="status">
      <Icon aria-hidden="true" />
      {state === "saving" ? t("tools.saving") : state === "offline" ? t("tools.offline") : t("tools.saved")}
    </span>
  );
}

export type Panel = "calculator" | "rough" | "shortcuts" | "instructions" | null;

/**
 * The strip under the exam bar: where the candidate stands on the left (the
 * sections, when there are any), and on the right whether their work is
 * saved and the tools a CBT hall offers.
 */
export function ToolStrip({
  children,
  save,
  panel,
  onPanel,
  calculator,
}: {
  readonly children?: ReactNode;
  readonly save: SaveState;
  readonly panel: Panel;
  readonly onPanel: (panel: Panel) => void;
  readonly calculator: boolean;
}) {
  const { t } = usePreferences();
  const reading = useReadingPreferences();
  const toggle = (which: Exclude<Panel, null>) => onPanel(panel === which ? null : which);
  const tool = (which: Exclude<Panel, null>, label: string, icon: ReactNode) => (
    <button type="button" className="tool" aria-pressed={panel === which} title={label} onClick={() => toggle(which)}>
      {icon}
      <span className="tool-label">{label}</span>
    </button>
  );
  return (
    <div className="toolstrip">
      <div className="toolstrip-start">{children}</div>
      <div className="toolstrip-end" role="toolbar" aria-label={t("tools.region")}>
        <SaveStatus state={save} />
        {tool("instructions", t("brief.open"), <BookOpen aria-hidden="true" />)}
        {calculator ? tool("calculator", t("tools.calculator"), <CalculatorIcon aria-hidden="true" />) : null}
        {tool("rough", t("tools.rough"), <NotebookPen aria-hidden="true" />)}
        <span className="tool-group">
          <button type="button" className="tool icon" title={t("tools.smaller")} aria-label={t("tools.smaller")} disabled={reading.smaller === null} onClick={() => reading.smaller?.()}>
            <AArrowDown aria-hidden="true" />
          </button>
          <button type="button" className="tool icon" title={t("tools.larger")} aria-label={t("tools.larger")} disabled={reading.larger === null} onClick={() => reading.larger?.()}>
            <AArrowUp aria-hidden="true" />
          </button>
        </span>
        <button
          type="button"
          className="tool icon"
          title={reading.dark ? t("tools.light") : t("tools.dark")}
          aria-label={reading.dark ? t("tools.light") : t("tools.dark")}
          onClick={reading.toggleTheme}
        >
          {reading.dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </button>
        <button type="button" className="tool icon" title={t("tools.shortcuts")} aria-label={t("tools.shortcuts")} aria-pressed={panel === "shortcuts"} onClick={() => toggle("shortcuts")}>
          <Keyboard aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** A tool's floating panel: beside the paper, not over it, closed with its button or Escape. */
function Floating({ label, onClose, className = "", children }: { readonly label: string; readonly onClose: () => void; readonly className?: string; readonly children: ReactNode }) {
  const { t } = usePreferences();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <section
      className={`floating ${className}`}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="floating-head">
        <strong>{label}</strong>
        <button type="button" className="tool icon" aria-label={t("tools.close")} title={t("tools.close")} onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </header>
      {children}
    </section>
  );
}

const KEYS: readonly (readonly [string, string, "fn" | "num" | "op" | "act"])[] = [
  ["unit", "", "act"], ["(", "(", "op"], [")", ")", "op"], ["⌫", "back", "act"], ["C", "clear", "act"],
  ["sin", "sin(", "fn"], ["cos", "cos(", "fn"], ["tan", "tan(", "fn"], ["√", "√(", "fn"], ["x²", "^2", "fn"],
  ["log", "log(", "fn"], ["ln", "ln(", "fn"], ["xʸ", "^", "fn"], ["π", "π", "fn"], ["e", "e", "fn"],
  ["7", "7", "num"], ["8", "8", "num"], ["9", "9", "num"], ["÷", "÷", "op"], ["n!", "!", "fn"],
  ["4", "4", "num"], ["5", "5", "num"], ["6", "6", "num"], ["×", "×", "op"], ["%", "%", "fn"],
  ["1", "1", "num"], ["2", "2", "num"], ["3", "3", "num"], ["−", "−", "op"], ["Ans", "Ans", "fn"],
  ["0", "0", "num"], [".", ".", "num"], ["EXP", "E", "fn"], ["+", "+", "op"], ["=", "equals", "act"],
];

/**
 * A scientific calculator, as JEE Main's: typed by its keys or the keyboard,
 * in degrees or radians, with the last answer kept as Ans. Offered only where
 * the exam allows it; nothing typed here leaves the page.
 */
export function Calculator({ onClose }: { readonly onClose: () => void }) {
  const { t } = usePreferences();
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [ans, setAns] = useState(0);
  const [unit, setUnit] = useState<AngleUnit>("deg");

  const press = (value: string) => {
    if (value === "clear") {
      setExpr("");
      setResult(null);
    } else if (value === "back") setExpr((e) => e.replace(/(sin\(|cos\(|tan\(|log\(|ln\(|√\(|Ans|.)$/, ""));
    else if (value === "equals") {
      try {
        const v = evaluate(expr, unit, ans);
        setAns(v);
        setResult(display(v));
      } catch {
        setResult(t("tools.error"));
      }
    } else {
      // After a result, a number starts afresh and an operator carries the answer on.
      if (result !== null && expr !== "") {
        setExpr("+−×÷^!%".includes(value[0]!) ? `Ans${value}` : value);
        setResult(null);
        return;
      }
      setExpr((e) => e + value);
    }
  };

  return (
    <Floating label={t("tools.calculator")} onClose={onClose} className="calculator">
      <div
        className="calc-screen"
        tabIndex={0}
        aria-label={t("tools.calcScreen")}
        onKeyDown={(e) => {
          const map: Record<string, string> = { "*": "×", "/": "÷", "-": "−", Enter: "equals", "=": "equals", Backspace: "back", Delete: "clear" };
          const key = map[e.key] ?? e.key;
          if (/^[0-9.+×÷−^()!%]$/.test(key) || ["equals", "back", "clear"].includes(key)) {
            e.preventDefault();
            press(key);
          }
        }}
      >
        <output className="calc-expr" aria-live="off">
          {expr || " "}
        </output>
        <output className="calc-result" aria-live="polite">
          {result ?? " "}
        </output>
      </div>
      <div className="calc-keys">
        {KEYS.map(([label, value, kind]) =>
          label === "unit" ? (
            <button key="unit" type="button" className="calc-key act" aria-pressed={unit === "rad"} onClick={() => setUnit(unit === "deg" ? "rad" : "deg")}>
              {unit === "deg" ? "DEG" : "RAD"}
            </button>
          ) : (
            <button key={label} type="button" className={`calc-key ${kind}${value === "equals" ? " equals" : ""}`} onClick={() => press(value)}>
              {label}
            </button>
          ),
        )}
      </div>
    </Floating>
  );
}

/** Rough work: a page of the candidate's own notes, kept on this device for this attempt and never sent. */
export function RoughWork({ attemptId, onClose }: { readonly attemptId: string; readonly onClose: () => void }) {
  const { t } = usePreferences();
  const key = `parikshaa.rough.${attemptId}`;
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(key) ?? "";
    } catch {
      return "";
    }
  });
  return (
    <Floating label={t("tools.rough")} onClose={onClose} className="rough">
      <textarea
        aria-label={t("tools.rough")}
        placeholder={t("tools.roughHint")}
        value={text}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          try {
            localStorage.setItem(key, e.target.value);
          } catch {
            // Kept for this page only.
          }
        }}
      />
      <p className="notice">{t("tools.roughNote")}</p>
    </Floating>
  );
}

/** Forget a finished attempt's rough work. */
export function clearRoughWork(attemptId: string): void {
  try {
    localStorage.removeItem(`parikshaa.rough.${attemptId}`);
  } catch {
    // Nothing kept.
  }
}

/** Every keyboard shortcut, as `?` lists them. */
export function ShortcutsPanel({ onClose }: { readonly onClose: () => void }) {
  const { t } = usePreferences();
  const rows: readonly [string, string][] = [
    ["A – D", t("keys.choose")],
    ["S", t("exam.saveNext")],
    ["N", t("exam.next")],
    ["P", t("exam.prev")],
    ["M", t("exam.markReview")],
    ["?", t("tools.shortcuts")],
    ["Esc", t("tools.close")],
  ];
  return (
    <Floating label={t("tools.shortcuts")} onClose={onClose} className="shortcuts">
      <dl className="keys">
        {rows.map(([keys, what]) => (
          <div key={keys}>
            <dt>
              <kbd>{keys}</kbd>
            </dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
      <p className="notice">{t("keys.note")}</p>
    </Floating>
  );
}

/** The instructions again, beside the paper, whenever the candidate wants them. */
export function InstructionsPanel({ onClose, children }: { readonly onClose: () => void; readonly children: ReactNode }) {
  const { t } = usePreferences();
  return (
    <Floating label={t("brief.heading")} onClose={onClose} className="instructions-panel">
      {children}
    </Floating>
  );
}

const WARN_AT = [15, 5, 1] as const;

/**
 * A quiet word as the time runs down — at 15, 5 and 1 minute — announced to a
 * screen reader and gone after a few seconds. Thresholds already behind when
 * the page loaded are not announced late.
 */
export function TimeWarnings({ expiresAt }: { readonly expiresAt: number }) {
  const { t } = usePreferences();
  const [shown, setShown] = useState<number | null>(null);
  const passed = useRef(new Set<number>(WARN_AT.filter((m) => expiresAt - Date.now() <= m * 60_000)));
  // Extra time moves the end: warnings it puts back ahead are given again.
  useEffect(() => {
    passed.current = new Set(WARN_AT.filter((m) => expiresAt - Date.now() <= m * 60_000));
  }, [expiresAt]);
  useEffect(() => {
    const tick = () => {
      const left = expiresAt - Date.now();
      for (const m of WARN_AT) {
        if (left <= m * 60_000 && left > 0 && !passed.current.has(m)) {
          passed.current.add(m);
          setShown(m);
        }
      }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  useEffect(() => {
    if (shown === null) return;
    const id = setTimeout(() => setShown(null), 8000);
    return () => clearTimeout(id);
  }, [shown]);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {shown === null ? null : (
        <div className={`toast${shown <= 5 ? " urgent" : ""}`}>
          <span>{shown === 1 ? t("tools.oneMinute") : t("tools.minutesLeft", { n: shown })}</span>
          <button type="button" className="tool icon" aria-label={t("tools.close")} onClick={() => setShown(null)}>
            <X aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
