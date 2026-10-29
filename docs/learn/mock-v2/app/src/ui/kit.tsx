import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useT } from "../lib/core";

/* ---------------- brand ---------------- */

/** The existing Parikshaa mark (packages/brand): प on an ink-indigo tile with a saffron bindu. */
export function LogoMark({ size = 28 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`pk-${id}`} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5b66f2" />
          <stop offset="1" stopColor="#1d2770" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8.5" fill={`url(#pk-${id})`} />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" stroke="#fff" strokeOpacity="0.14" />
      <path d="M7.5 11h17" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M20.5 11v13.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path
        d="M11.5 11v4.2c0 2.3 1.6 3.8 4 3.8h5"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24.6" cy="6.2" r="2.1" fill="#f5a524" />
    </svg>
  );
}

/** Mascot concept "Diya": a small clay lamp whose flame is the streak. Final art by an illustrator. */
export function Diya({
  size = 72,
  mood = "happy",
  className,
}: {
  size?: number;
  mood?: "happy" | "think" | "cheer" | "sleepy" | "peek";
  className?: string;
}) {
  const eyes =
    mood === "cheer" ? (
      <g stroke="#3b1d0c" strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path d="M27 47q3-4 6 0" />
        <path d="M39 47q3-4 6 0" />
      </g>
    ) : mood === "sleepy" ? (
      <g stroke="#3b1d0c" strokeWidth="2.4" strokeLinecap="round">
        <path d="M27 47h6" />
        <path d="M39 47h6" />
      </g>
    ) : (
      <g fill="#3b1d0c">
        <ellipse cx="30" cy={mood === "think" ? 45 : 47} rx="2.6" ry="3.2" className="diya-eye" />
        <ellipse cx="42" cy={mood === "think" ? 45 : 47} rx="2.6" ry="3.2" className="diya-eye" />
        <circle cx="31" cy={mood === "think" ? 44 : 46} r="0.9" fill="#fff" />
        <circle cx="43" cy={mood === "think" ? 44 : 46} r="0.9" fill="#fff" />
      </g>
    );
  return (
    <svg
      className={`diya ${className ?? ""}`}
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      role="img"
      aria-label="Diya, the Parikshaa mascot (concept)"
    >
      <g className="diya-flame">
        <path d="M36 6c6 8 9 13 9 18a9 9 0 0 1-18 0c0-5 3-10 9-18z" fill="#f5a524" />
        <path d="M36 14c3.5 5 5 8 5 11a5 5 0 0 1-10 0c0-3 1.5-6 5-11z" fill="#ffe08a" />
      </g>
      <path d="M8 38h56c0 15-12.5 26-28 26S8 53 8 38z" fill="#d9773b" />
      <path d="M8 38h56c0 2.4-.4 4.6-1.1 6.7H9.1C8.4 42.6 8 40.4 8 38z" fill="#b85d28" />
      <path d="M5 37.5c0-1.4 1.1-2.5 2.5-2.5h57c1.4 0 2.5 1.1 2.5 2.5S65.9 40 64.5 40h-57C6.1 40 5 38.9 5 37.5z" fill="#ef9254" />
      {eyes}
      <path
        d={mood === "think" ? "M33 55h6" : "M31.5 53.5q4.5 4 9 0"}
        stroke="#3b1d0c"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="23" cy="52" r="3" fill="#f3a07a" opacity=".7" />
      <circle cx="49" cy="52" r="3" fill="#f3a07a" opacity=".7" />
      {mood === "cheer" && (
        <g fill="#f5a524">
          <path d="M10 18l1.6 3.4L15 23l-3.4 1.6L10 28l-1.6-3.4L5 23l3.4-1.6z" />
          <path d="M60 14l1.2 2.6 2.6 1.2-2.6 1.2L60 21.6l-1.2-2.6-2.6-1.2 2.6-1.2z" />
        </g>
      )}
      {mood === "think" && (
        <g fill="var(--text-3)">
          <circle cx="56" cy="22" r="2" />
          <circle cx="62" cy="15" r="2.6" />
          <circle cx="66" cy="7" r="3.2" />
        </g>
      )}
    </svg>
  );
}

/** The heading signature: one word underlined with a hand-drawn saffron stroke. */
export function HandUnderline({ children }: { children: ReactNode }) {
  return (
    <span className="hand-underline">
      {children}
      <svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
        <path d="M2 8c40-5 90-7 140-4 20 1 38 2 56 1" />
      </svg>
    </span>
  );
}

/* ---------------- progress ---------------- */

export function Ring({
  value,
  size = 96,
  stroke = 9,
  color,
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label ?? `${value}%`}>
      <svg width={size} height={size}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle
          className="val"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown / 100)}
          style={color ? { stroke: color } : undefined}
        />
      </svg>
      <div className="center">{children}</div>
    </div>
  );
}

/** Donut with several segments (e.g. solved by level). */
export function Donut({
  parts,
  size = 150,
  stroke = 12,
  children,
}: {
  parts: { value: number; color: string; label: string }[];
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = 6;
  let offset = 0;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        {parts.map((p) => {
          const len = Math.max(0, (p.value / total) * c - gap);
          const el = (
            <circle
              key={p.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              strokeWidth={stroke}
              fill="none"
              stroke={p.color}
              strokeLinecap="round"
              strokeDasharray={`${len} ${c}`}
              strokeDashoffset={-offset}
            />
          );
          offset += (p.value / total) * c;
          return el;
        })}
      </svg>
      <div className="center">{children}</div>
    </div>
  );
}

export function Bar({ value, tone, thin }: { value: number; tone?: "ok" | "bad" | "plus"; thin?: boolean }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div className={`bar ${tone ?? ""} ${thin ? "thin" : ""}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${shown}%` }} />
    </div>
  );
}

/* ---------------- controls ---------------- */

export function Seg<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ left: 3, width: 0 });
  useLayoutEffect(() => {
    const el = wrap.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, options.length]);
  return (
    <div className="seg" role="group" aria-label={label} ref={wrap}>
      <span className="thumb" style={{ left: thumb.left, width: thumb.width }} />
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { value: T; label: ReactNode; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={t.value === value} onClick={() => onChange(t.value)}>
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" className="toggle" aria-pressed={on} aria-label={label} onClick={() => onChange(!on)} />;
}

export function Check({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="checkbox" className="checkbox" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
      {on && (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

/** Difficulty: five levels, always with a word next to the colour. */
export function Level({ lv }: { lv: 1 | 2 | 3 | 4 | 5 }) {
  const t = useT();
  const words: Record<number, [string, string, string]> = {
    1: ["Starter", "Shuruaat", "शुरुआत"],
    2: ["Easy", "Aasaan", "आसान"],
    3: ["Medium", "Medium", "मध्यम"],
    4: ["Hard", "Mushkil", "कठिन"],
    5: ["Expert", "Expert", "विशेषज्ञ"],
  };
  const [en, hg, hi] = words[lv];
  return (
    <span className={`tag lv${lv}`}>
      <span aria-hidden="true">L{lv}</span> {t(en, hg, hi)}
    </span>
  );
}

/* ---------------- overlays ---------------- */

export function Modal({
  title,
  onClose,
  children,
  foot,
  wide,
  sub,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  foot?: ReactNode;
  wide?: boolean;
  sub?: ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {sub && <p className="muted" style={{ marginTop: 4 }}>{sub}</p>}
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <>
      <div className="scrim" onMouseDown={onClose} style={{ background: "var(--scrim)" }} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="panel-head" style={{ padding: "16px 20px" }}>
          <h2 style={{ fontSize: "var(--fs-16)", fontWeight: 800 }}>{title}</h2>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>{children}</div>
      </aside>
    </>
  );
}

export function Confetti({ count = 26 }: { count?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        dx: `${((i * 53) % 140) - 70}px`,
        delay: `${(i % 7) * 40}ms`,
        color: ["#5b66f2", "#f5a524", "#3dd68c", "#c084fc", "#f6a496"][i % 5],
      })),
    [count],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <i
          key={i}
          style={{ left: b.left, background: b.color, animationDelay: b.delay, ["--dx" as string]: b.dx }}
        />
      ))}
    </div>
  );
}

/* ---------------- time ---------------- */

export function CountBoxes({ seconds, tone }: { seconds: number; tone?: "bad" }) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  const box = (v: string, lbl: string) => (
    <span className="cbox">
      <b className="num">{v}</b>
      <small>{lbl}</small>
    </span>
  );
  return (
    <span className={`cboxes ${tone ?? ""}`} role="timer" aria-label={`${h} hours ${m} minutes left`}>
      {box(p(h), "hr")}
      <i>:</i>
      {box(p(m), "min")}
      <i>:</i>
      {box(p(s), "sec")}
    </span>
  );
}

/* ---------------- code ---------------- */

const KW = new Set(
  "int long void return for while if else auto const using namespace class public private struct vector string bool true false def in range and or not None import from while break continue new static elif pass lambda select from where group by order join on as limit having count sum".split(
    " ",
  ),
);
const TY = new Set("int long void bool string vector map unordered_map pair size_t List int64_t ll".split(" "));

function tokenize(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\/\/.*$|#.*$|--.*$)|("[^"]*"|'[^']*')|(\b\d[\d_]*(?:\.\d+)?(?:e\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)(?=\s*\()|([A-Za-z_][A-Za-z0-9_]*)|(\s+|.)/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(line))) {
    const k = i++;
    if (m[1]) out.push(<span key={k} className="tk-com">{m[1]}</span>);
    else if (m[2]) out.push(<span key={k} className="tk-str">{m[2]}</span>);
    else if (m[3]) out.push(<span key={k} className="tk-num">{m[3]}</span>);
    else if (m[4]) out.push(<span key={k} className={KW.has(m[4]) ? "tk-kw" : "tk-fn"}>{m[4]}</span>);
    else if (m[5]) {
      const w = m[5];
      out.push(
        <span key={k} className={TY.has(w) ? "tk-ty" : KW.has(w.toLowerCase()) && /^[A-Z]+$/.test(w) ? "tk-kw" : KW.has(w) ? "tk-kw" : undefined}>
          {w}
        </span>,
      );
    } else out.push(m[6]);
  }
  return out;
}

export function Code({
  code,
  hl = [],
  bad = [],
  caretLine,
  className,
}: {
  code: string;
  hl?: number[];
  bad?: number[];
  caretLine?: number;
  className?: string;
}) {
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <pre className={`code ${className ?? ""}`}>
      {lines.map((l, i) => (
        <span key={i} className={`ln ${hl.includes(i + 1) ? "hl" : ""} ${bad.includes(i + 1) ? "bad" : ""}`}>
          {tokenize(l)}
          {caretLine === i + 1 && <span className="caret" />}
          {"\n"}
        </span>
      ))}
    </pre>
  );
}

/* ---------------- misc ---------------- */

export function Skel({ w = "100%", h = 14, r }: { w?: number | string; h?: number; r?: number }) {
  return <span className="skel" style={{ display: "block", width: w, height: h, borderRadius: r }} />;
}

export function SampleNote({ children }: { children?: ReactNode }) {
  const t = useT();
  return (
    <span className="sample-note">
      <span className="dot" style={{ background: "var(--warn)" }} />
      {children ?? t("Sample data in this mock", "Mock me namune ka data", "मॉक में नमूने का डेटा")}
    </span>
  );
}

/** Small inline sparkline for trends. */
export function Spark({ data, w = 120, h = 32, color = "var(--action)" }: { data: number[]; w?: number; h?: number; color?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map((d, i) => [(i / (data.length - 1)) * (w - 4) + 2, h - 3 - ((d - min) / (max - min || 1)) * (h - 6)]);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} aria-hidden="true">
      <path d={`${path} L${last[0]} ${h} L2 ${h} Z`} fill={color} opacity="0.12" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  );
}

/** Contribution heatmap: weeks × 7 days. */
export function Heatmap({ weeks = 26, seed = 7 }: { weeks?: number; seed?: number }) {
  const cells = useMemo(() => {
    const out: number[] = [];
    let x = seed;
    for (let i = 0; i < weeks * 7; i++) {
      x = (x * 9301 + 49297) % 233280;
      const r = x / 233280;
      const recent = i / (weeks * 7);
      out.push(r < 0.28 - recent * 0.15 ? 0 : Math.min(4, Math.floor(r * 4.6 + recent * 1.2)));
    }
    return out;
  }, [weeks, seed]);
  return (
    <div className="heatmap" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }} role="img" aria-label="Activity over the last six months">
      {Array.from({ length: weeks }, (_, w) => (
        <div key={w} className="heat-col">
          {Array.from({ length: 7 }, (_, d) => (
            <i key={d} style={{ background: `var(--heat-${cells[w * 7 + d]})` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
