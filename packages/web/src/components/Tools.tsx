import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AArrowDown, AArrowUp, ALargeSmall, BookOpen, Calculator as CalculatorIcon, Check, ChevronLeft, CloudOff, GripVertical, Grid3x3, Keyboard, LoaderCircle, Moon, NotebookPen, ScrollText, Sun, Wrench, X, type LucideIcon } from "lucide-react";
import { display, evaluate, type AngleUnit } from "../calc.ts";
import { LANGUAGE_NAMES, usePreferences, type Language } from "../i18n.tsx";

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
    size,
    setDark: (on: boolean) => setTheme(on ? "dark" : "light"),
    toggleTheme: () => setTheme(dark ? "light" : "dark"),
    smaller: at > 0 ? () => setSize(TEXT_SIZES[at - 1]!) : null,
    larger: at < TEXT_SIZES.length - 1 ? () => setSize(TEXT_SIZES[at + 1]!) : null,
  };
}

export type ReadingPreferences = ReturnType<typeof useReadingPreferences>;

/**
 * How the page reads, all in one place: the language, the text size, light
 * or dark, and low-bandwidth mode. None of it changes during the test, so it
 * lives behind one button and the bar keeps only what does.
 */
export function DisplayPanel({ offered, reading }: { readonly offered: readonly Language[]; readonly reading: ReadingPreferences }) {
  const { t, language, lite, setLanguage, setLite } = usePreferences();
  const choices = [...new Set<Language>(["en", "hi", ...offered, language])];
  return (
    <div className="display-panel">
      <div className="display-row">
        <label htmlFor="pref-language">{t("prefs.language")}</label>
        <select id="pref-language" value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
          {choices.map((l) => (
            <option key={l} value={l} lang={l}>
              {LANGUAGE_NAMES[l]}
            </option>
          ))}
        </select>
      </div>
      <div className="display-row">
        <span id="display-size">{t("display.size")}</span>
        <div className="segmented" role="group" aria-labelledby="display-size">
          <button type="button" aria-label={t("tools.smaller")} title={t("tools.smaller")} disabled={reading.smaller === null} onClick={() => reading.smaller?.()}>
            <AArrowDown aria-hidden="true" />
          </button>
          <output aria-live="polite">{reading.size}%</output>
          <button type="button" aria-label={t("tools.larger")} title={t("tools.larger")} disabled={reading.larger === null} onClick={() => reading.larger?.()}>
            <AArrowUp aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="display-row">
        <span id="display-theme">{t("display.theme")}</span>
        <div className="segmented" role="group" aria-labelledby="display-theme">
          <button type="button" aria-pressed={!reading.dark} aria-label={t("tools.light")} onClick={() => reading.setDark(false)}>
            <Sun aria-hidden="true" />
            <span aria-hidden="true">{t("display.light")}</span>
          </button>
          <button type="button" aria-pressed={reading.dark} aria-label={t("tools.dark")} onClick={() => reading.setDark(true)}>
            <Moon aria-hidden="true" />
            <span aria-hidden="true">{t("display.dark")}</span>
          </button>
        </div>
      </div>
      <label className="inline display-lite">
        <input type="checkbox" checked={lite} onChange={(e) => setLite(e.target.checked)} />
        <span>
          {t("prefs.lite")}
          <small>{t("prefs.liteHint")}</small>
        </span>
      </label>
    </div>
  );
}

/** The Display button in the exam bar, and its menu. Escape or a click elsewhere closes it. */
export function DisplayMenu({ offered, reading }: { readonly offered: readonly Language[]; readonly reading: ReadingPreferences }) {
  const { t } = usePreferences();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="display-menu" ref={root}>
      <button type="button" className="display-toggle" ref={toggle} aria-expanded={open} aria-controls="display-menu" title={t("display.label")} onClick={() => setOpen(!open)}>
        <ALargeSmall aria-hidden="true" />
        <span className="display-label">{t("display.label")}</span>
      </button>
      {open ? (
        <div className="display-popover" id="display-menu" role="group" aria-label={t("display.label")}>
          <DisplayPanel offered={offered} reading={reading} />
        </div>
      ) : null}
    </div>
  );
}

export type SaveState = "idle" | "saving" | "saved" | "offline" | "back";

/**
 * Whether everything the candidate has done is safe: one answer for the whole
 * paper, always in sight, and the one place a dropped connection shows — a
 * quiet pill, never a dialog. Back online, it says how many answers went.
 */
export function SaveStatus({ state, sent = 0 }: { readonly state: SaveState; readonly sent?: number }) {
  const { t } = usePreferences();
  if (state === "idle") return null;
  const Icon = state === "saving" ? LoaderCircle : state === "offline" ? CloudOff : Check;
  // On a phone the pill shortens to its icon and one word; the whole of it is what is heard.
  const long =
    state === "saving"
      ? t("tools.saving")
      : state === "offline"
        ? t("tools.offline")
        : state === "back"
          ? sent === 1
            ? t("tools.backOnlineOne")
            : t("tools.backOnline", { n: sent })
          : t("tools.saved");
  const short = state === "saving" ? t("tools.savingShort") : state === "offline" ? t("tools.offlineShort") : t("tools.savedShort");
  return (
    <span className={`save-status ${state === "back" ? "saved back" : state}`} role="status" title={state === "offline" ? t("exam.offline") : long}>
      <Icon aria-hidden="true" />
      <span className="label-long">{long}</span>
      <span className="label-short" aria-hidden="true">
        {short}
      </span>
    </span>
  );
}

export type Panel = "calculator" | "rough" | "shortcuts" | "instructions" | "paper" | null;
/** A tool that opens in a window beside the paper. */
export type Tool = Exclude<Panel, null>;

/**
 * The strip under the exam bar: on the left whether the candidate's work is
 * saved, the one thing here that changes; on the right the tools a CBT hall
 * offers.
 */
export function ToolStrip({
  children,
  save,
  sent = 0,
  open,
  onToggle,
  calculator,
  questions,
  display,
}: {
  readonly children?: ReactNode;
  readonly save: SaveState;
  /** How many answers went when the connection came back. */
  readonly sent?: number;
  /** The tools open now, oldest first. */
  readonly open: readonly Tool[];
  readonly onToggle: (tool: Tool) => void;
  readonly calculator: boolean;
  /** On a phone the palette opens from here: its button, with how far the candidate is. */
  readonly questions?: { readonly done: number; readonly total: number; readonly onOpen: () => void } | undefined;
  /** The Display settings, for the phone's Tools sheet. */
  readonly display?: ReactNode;
}) {
  const { t } = usePreferences();
  const [sheet, setSheet] = useState<"tools" | "display" | null>(null);
  const tool = (which: Tool, label: string, icon: ReactNode) => (
    <button type="button" className="tool" data-tool={which} aria-pressed={open.includes(which)} title={label} onClick={() => onToggle(which)}>
      {icon}
      <span className="tool-label">{label}</span>
    </button>
  );
  const tools: readonly (readonly [Tool, string, LucideIcon])[] = [
    ["paper", t("tools.paper"), ScrollText],
    ["instructions", t("brief.open"), BookOpen],
    ...(calculator ? ([["calculator", t("tools.calculator"), CalculatorIcon]] as const) : []),
    ["rough", t("tools.rough"), NotebookPen],
    ["shortcuts", t("tools.shortcuts"), Keyboard],
  ];
  return (
    <div className="toolstrip">
      <div className="toolstrip-start">
        <SaveStatus state={save} sent={sent} />
        {children}
      </div>
      <div className="toolstrip-end" role="toolbar" aria-label={t("tools.region")}>
        {tool("paper", t("tools.paper"), <ScrollText aria-hidden="true" />)}
        {tool("instructions", t("brief.open"), <BookOpen aria-hidden="true" />)}
        {calculator ? tool("calculator", t("tools.calculator"), <CalculatorIcon aria-hidden="true" />) : null}
        {tool("rough", t("tools.rough"), <NotebookPen aria-hidden="true" />)}
        <button
          type="button"
          className="tool icon"
          data-tool="shortcuts"
          title={t("tools.shortcuts")}
          aria-label={t("tools.shortcuts")}
          aria-pressed={open.includes("shortcuts")}
          onClick={() => onToggle("shortcuts")}
        >
          <Keyboard aria-hidden="true" />
        </button>
      </div>
      <div className="toolstrip-compact">
        {questions === undefined ? null : (
          <button type="button" className="tool compact questions-open" onClick={questions.onOpen}>
            <Grid3x3 aria-hidden="true" />
            <span>{t("palette.region")}</span>{" "}
            <span className="compact-count">
              {questions.done}/{questions.total}
            </span>
          </button>
        )}
        <button type="button" className="tool compact tools-open" aria-haspopup="dialog" aria-expanded={sheet !== null} onClick={() => setSheet("tools")}>
          <Wrench aria-hidden="true" />
          <span>{t("tools.region")}</span>
        </button>
      </div>
      {sheet === null ? null : (
        <BottomSheet
          label={sheet === "display" ? t("display.label") : t("tools.region")}
          onClose={() => setSheet(null)}
          onBack={sheet === "display" ? () => setSheet("tools") : undefined}
        >
          {sheet === "display" ? (
            display
          ) : (
            <div className="tools-grid">
              {tools.map(([which, label, Icon]) => (
                <button
                  key={which}
                  type="button"
                  className="tools-grid-item"
                  onClick={() => {
                    setSheet(null);
                    if (!open.includes(which)) onToggle(which);
                  }}
                >
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
              {display === undefined ? null : (
                <button type="button" className="tools-grid-item" onClick={() => setSheet("display")}>
                  <ALargeSmall aria-hidden="true" />
                  <span>{t("display.label")}</span>
                </button>
              )}
            </div>
          )}
        </BottomSheet>
      )}
    </div>
  );
}

/**
 * A sheet up from the bottom of a phone's screen, over a dimmed page: the
 * tools, the display settings. Escape, the close button or a tap on the page
 * above closes it, and focus goes back where it was.
 */
export function BottomSheet({
  label,
  onClose,
  onBack,
  children,
}: {
  readonly label: string;
  readonly onClose: () => void;
  readonly onBack?: (() => void) | undefined;
  readonly children: ReactNode;
}) {
  const { t } = usePreferences();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => before?.focus?.();
  }, []);
  return (
    <>
      <div className="bottom-sheet-scrim" aria-hidden="true" onClick={onClose} />
      <section
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
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
        <span className="bottom-sheet-grip" aria-hidden="true" />
        <header className="bottom-sheet-head">
          {onBack === undefined ? null : (
            <button type="button" className="tool icon" aria-label={t("tools.back")} title={t("tools.back")} onClick={onBack}>
              <ChevronLeft aria-hidden="true" />
            </button>
          )}
          <strong>{label}</strong>
          <button type="button" className="tool icon" aria-label={t("tools.close")} title={t("tools.close")} onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </>
  );
}

/**
 * A tool's window: a 360 px panel with a title bar, docked to the right of
 * the question and stacked under any other open one, so it helps without
 * covering the paper. Its title bar moves it; Escape or its close button
 * shuts it, and the page puts focus back on the tool's button. On a phone
 * it is a sheet the height of the screen.
 */
export function ToolWindow({
  label,
  onClose,
  className = "",
  children,
}: {
  readonly label: string;
  readonly onClose: () => void;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const { t } = usePreferences();
  const ref = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; from: { x: number; y: number } } | null>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <section
      className={`tool-window floating ${className}`}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      ref={ref}
      style={offset.x === 0 && offset.y === 0 ? undefined : { translate: `${offset.x}px ${offset.y}px` }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <header
        className="floating-head"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button") !== null || e.button !== 0) return;
          drag.current = { x: e.clientX, y: e.clientY, from: offset };
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d !== null) setOffset({ x: d.from.x + e.clientX - d.x, y: d.from.y + e.clientY - d.y });
        }}
        onPointerUp={() => (drag.current = null)}
      >
        <GripVertical className="window-grip" aria-hidden="true" />
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
  ["(", "(", "op"], [")", ")", "op"], ["Ans", "Ans", "fn"], ["⌫", "back", "act"], ["C", "clear", "act"],
  ["sin", "sin(", "fn"], ["cos", "cos(", "fn"], ["tan", "tan(", "fn"], ["√", "√(", "fn"], ["x²", "^2", "fn"],
  ["log", "log(", "fn"], ["ln", "ln(", "fn"], ["xʸ", "^", "fn"], ["π", "π", "fn"], ["e", "e", "fn"],
  ["7", "7", "num"], ["8", "8", "num"], ["9", "9", "num"], ["÷", "÷", "op"], ["n!", "!", "fn"],
  ["4", "4", "num"], ["5", "5", "num"], ["6", "6", "num"], ["×", "×", "op"], ["%", "%", "fn"],
  ["1", "1", "num"], ["2", "2", "num"], ["3", "3", "num"], ["−", "−", "op"], ["EXP", "E", "fn"],
  ["0", "0", "num"], [".", ".", "num"], ["+", "+", "op"], ["=", "equals", "act"],
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
    <ToolWindow label={t("tools.calculator")} onClose={onClose} className="calculator">
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
      <div className="calc-unit segmented" role="group" aria-label={t("tools.angle")}>
        <button type="button" aria-pressed={unit === "deg"} onClick={() => setUnit("deg")}>
          DEG
        </button>
        <button type="button" aria-pressed={unit === "rad"} onClick={() => setUnit("rad")}>
          RAD
        </button>
      </div>
      <div className="calc-keys">
        {KEYS.map(([label, value, kind]) => (
          <button
            key={label}
            type="button"
            className={`calc-key ${kind}${value === "equals" ? " equals" : ""}${value === "0" ? " wide" : ""}`}
            onClick={() => press(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </ToolWindow>
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
    <ToolWindow label={t("tools.rough")} onClose={onClose} className="rough">
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
    </ToolWindow>
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

/** Every keyboard shortcut, each key a chip beside what it does. */
export function KeyTable() {
  const { t } = usePreferences();
  const rows: readonly [readonly string[], string][] = [
    [["A", "B", "C", "D"], t("keys.choose")],
    [["S"], t("exam.saveNext")],
    [["N"], t("exam.next")],
    [["P"], t("exam.prev")],
    [["M"], t("exam.markReview")],
    [["?"], t("tools.shortcuts")],
    [["Esc"], t("tools.close")],
  ];
  return (
    <dl className="keys">
      {rows.map(([keys, what]) => (
        <div key={keys.join()}>
          <dt>
            {keys.map((k) => (
              <kbd key={k}>{k}</kbd>
            ))}
          </dt>
          <dd>{what}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Every keyboard shortcut, as `?` lists them. */
export function ShortcutsPanel({ onClose }: { readonly onClose: () => void }) {
  const { t } = usePreferences();
  return (
    <ToolWindow label={t("tools.shortcuts")} onClose={onClose} className="shortcuts">
      <KeyTable />
      <p className="notice">{t("keys.note")}</p>
    </ToolWindow>
  );
}

/** The whole paper at once, beside the question on screen. */
export function PaperPanel({ onClose, children }: { readonly onClose: () => void; readonly children: ReactNode }) {
  const { t } = usePreferences();
  return (
    <ToolWindow label={t("tools.paper")} onClose={onClose} className="paper-panel">
      {children}
    </ToolWindow>
  );
}

/** The instructions again, beside the paper, whenever the candidate wants them. */
export function InstructionsPanel({ onClose, children }: { readonly onClose: () => void; readonly children: ReactNode }) {
  const { t } = usePreferences();
  return (
    <ToolWindow label={t("brief.heading")} onClose={onClose} className="instructions-panel">
      {children}
    </ToolWindow>
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
