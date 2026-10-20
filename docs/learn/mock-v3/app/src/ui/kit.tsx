import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { X, Info, Check as CheckIcon } from "lucide-react";
import { useT } from "../lib/core";

/* ---------------- brand ---------------- */

/** The mark: प whose inner stroke is a tick. Brand colours are fixed in both themes. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="Parikshaa">
      <rect width="40" height="40" rx="11" fill="#2346E8" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3">
        <path d="M9.5 11.5H30.5M26 11.5V30.5" stroke="#fff" />
        <path d="M13.5 11.5v4.6l4.8 6 7.7-4" stroke="#FFE45C" />
      </g>
    </svg>
  );
}

export function Logo({ size = 28, tag, word = true }: { size?: number; tag?: string; word?: boolean }) {
  return (
    <span className="logo" style={{ "--ls": `${size}px` } as CSSProperties}>
      <LogoMark size={size} />
      {word && <span className="logo-word">parikshaa</span>}
      {tag && <span className="logo-tag">{tag}</span>}
    </span>
  );
}

type Mood = "happy" | "think" | "cheer" | "sleepy" | "peek";
/** Diya, the mascot (concept art; final art comes from an illustrator). */
export function Diya({ size = 56, mood = "happy", className }: { size?: number; mood?: Mood; className?: string }) {
  const ink = "#2b1a10";
  const eyes =
    mood === "cheer" ? (
      <g stroke={ink} strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path d="M27 47q3-4 6 0" />
        <path d="M39 47q3-4 6 0" />
      </g>
    ) : mood === "sleepy" ? (
      <g stroke={ink} strokeWidth="2.4" strokeLinecap="round">
        <path d="M27 47h6" />
        <path d="M39 47h6" />
      </g>
    ) : (
      <g fill={ink}>
        <ellipse cx="30" cy={mood === "think" ? 45 : 47} rx="2.5" ry="3.1" className="diya-eye" />
        <ellipse cx="42" cy={mood === "think" ? 45 : 47} rx="2.5" ry="3.1" className="diya-eye" />
      </g>
    );
  return (
    <svg className={`diya ${className ?? ""}`} width={size} height={size} viewBox="0 0 72 72" fill="none" role="img" aria-label="Diya">
      <g className="diya-flame">
        <path d="M36 6c6 8 9 13 9 18a9 9 0 0 1-18 0c0-5 3-10 9-18z" fill="#F59E0B" />
        <path d="M36 14c3.5 5 5 8 5 11a5 5 0 0 1-10 0c0-3 1.5-6 5-11z" fill="#FFE45C" />
      </g>
      <path d="M8 38h56c0 15-12.5 26-28 26S8 53 8 38z" fill="#E07A3F" />
      <path d="M8 38h56c0 2.4-.4 4.6-1.1 6.7H9.1C8.4 42.6 8 40.4 8 38z" fill="#C2622C" />
      <path d="M5 37.5c0-1.4 1.1-2.5 2.5-2.5h57c1.4 0 2.5 1.1 2.5 2.5S65.9 40 64.5 40h-57C6.1 40 5 38.9 5 37.5z" fill="#F29A5E" />
      {eyes}
      <path d={mood === "think" ? "M33 55h6" : "M31.5 53.5q4.5 4 9 0"} stroke={ink} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <circle cx="23" cy="52" r="3" fill="#F7B08A" opacity=".8" />
      <circle cx="49" cy="52" r="3" fill="#F7B08A" opacity=".8" />
      {mood === "cheer" && (
        <g fill="#FFE45C">
          <path d="M10 18l1.6 3.4L15 23l-3.4 1.6L10 28l-1.6-3.4L5 23l3.4-1.6z" />
          <path d="M60 14l1.2 2.6 2.6 1.2-2.6 1.2L60 21.6l-1.2-2.6-2.6-1.2 2.6-1.2z" />
        </g>
      )}
      {mood === "think" && (
        <g fill="currentColor" opacity=".45">
          <circle cx="56" cy="22" r="2" />
          <circle cx="62" cy="15" r="2.6" />
          <circle cx="66" cy="7" r="3.2" />
        </g>
      )}
    </svg>
  );
}

/** A tick that draws itself. */
export function Tick({ size = 18, color = "var(--tick)", draw = true }: { size?: number; color?: string; draw?: boolean }) {
  return (
    <svg className={draw ? "draw-tick" : undefined} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.5 12.5l4.8 5L19.5 6.5" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Highlighter stroke behind important words. */
export function Hl({ children }: { children: ReactNode }) {
  return <span className="hl">{children}</span>;
}

/** Red pen circle around a word or value, like a teacher marking a mistake. */
export function PenCircle({ children }: { children: ReactNode }) {
  return (
    <span className="pen-circle">
      {children}
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
        <path d="M8 22C6 10 30 4 52 4s44 5 43 17-24 16-48 16S6 32 9 18" />
      </svg>
    </span>
  );
}

export function PenNote({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`pen-note ${className ?? ""}`}>{children}</span>;
}

export function Stamp({ top, mid, bottom }: { top: string; mid: string; bottom: string }) {
  return (
    <span className="stamp" aria-hidden="true">
      <span>
        <small>{top}</small>
        <b>{mid}</b>
        <small>{bottom}</small>
      </span>
    </span>
  );
}

/* ---------------- small pieces ---------------- */

type Tone = "pen" | "red" | "tick" | "ai" | "coin" | "marker" | "solid" | "";
export function Badge({ tone = "", children, icon, sq }: { tone?: Tone; children: ReactNode; icon?: ReactNode; sq?: boolean }) {
  return (
    <span className={`badge ${tone} ${sq ? "sq" : ""}`}>
      {icon}
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

const LV = ["Starter", "Easy", "Medium", "Hard", "Expert"];
const LV_HG = ["Shuruaat", "Aasaan", "Beech ka", "Mushkil", "Expert"];
const LV_HI = ["शुरुआत", "आसान", "मध्यम", "कठिन", "विशेषज्ञ"];
export function Level({ n, short }: { n: 1 | 2 | 3 | 4 | 5; short?: boolean }) {
  const t = useT();
  return (
    <span className="lvl" style={{ "--lv": `var(--lv${n})` } as CSSProperties}>
      <i aria-hidden="true">
        {[1, 2, 3, 4, 5].map((k) => (
          <b key={k} className={k <= n ? "on" : ""} />
        ))}
      </i>
      {short ? `L${n}` : t(LV[n - 1], LV_HG[n - 1], LV_HI[n - 1])}
    </span>
  );
}

const AV_TONES = ["#2346E8", "#15803D", "#C26A04", "#6D4AFF", "#D93A2B", "#0E7490"];
export function Avatar({ name, size = 32, sq, tone }: { name: string; size?: number; sq?: boolean; tone?: number }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const idx = tone ?? [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_TONES.length;
  return (
    <span className={`avatar ${sq ? "sq" : ""}`} style={{ "--av": `${size}px`, "--av-bg": AV_TONES[idx] } as CSSProperties} aria-hidden="true">
      {initials}
    </span>
  );
}

export function SampleNote({ children }: { children?: ReactNode }) {
  const t = useT();
  return (
    <span className="sample">
      <Info />
      {children ?? t("Sample data", "Sample data", "नमूना डेटा")}
    </span>
  );
}

export function Skel({ w = "100%", h = 14, r }: { w?: number | string; h?: number; r?: number }) {
  return <span className="skel" style={{ display: "block", width: w, height: h, borderRadius: r }} />;
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty paper-grid">
      {icon ?? <Diya size={52} mood="peek" />}
      <div className="h3">{title}</div>
      {body && <p className="muted small" style={{ maxWidth: 360 }}>{body}</p>}
      {action}
    </div>
  );
}

/* ---------------- controls ---------------- */

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: { id: T; label: ReactNode; icon?: ReactNode; count?: number | string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`tabs ${className ?? ""}`} role="tablist">
      {items.map((it) => (
        <button key={it.id} className="tab" role="tab" aria-selected={value === it.id} onClick={() => onChange(it.id)}>
          {it.icon}
          {it.label}
          {it.count !== undefined && <span className="count">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Seg<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: { id: T; label: ReactNode; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, items.length]);
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      const el = ref.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
    });
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div className={`seg ${className ?? ""}`} ref={ref}>
      {thumb && <span className="thumb" style={{ left: thumb.left, width: thumb.width }} />}
      {items.map((it) => (
        <button key={it.id} aria-pressed={value === it.id} onClick={() => onChange(it.id)}>
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button className="toggle" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}

export function Check({
  on,
  onChange,
  round,
  tick,
  label,
}: {
  on: boolean;
  onChange?: (v: boolean) => void;
  round?: boolean;
  tick?: boolean;
  label?: string;
}) {
  return (
    <button
      className={`check ${round ? "round" : ""} ${tick ? "tick" : ""}`}
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!on);
      }}
    >
      <CheckIcon />
    </button>
  );
}

export function useOutside(ref: React.RefObject<HTMLElement | null>, fn: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fn();
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && fn();
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [ref, fn, active]);
}

/** A button that opens a small menu. */
export function Menu({
  trigger,
  children,
  align = "right",
  width,
  up,
}: {
  trigger: (open: boolean, toggle: () => void) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  width?: number;
  up?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false), open);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div className="pop" style={{ [up ? "bottom" : "top"]: "calc(100% + 6px)", [align]: 0, width }} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
  wide,
  icon,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  icon?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true">
        <div className="modal-h">
          {icon}
          <div className="grow">
            <div className="h2">{title}</div>
            {sub && <p className="muted small mt4">{sub}</p>}
          </div>
          <button className="icon-btn sm" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        {children && <div className="modal-b">{children}</div>}
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="scrim drawer-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="row" style={{ padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
          <div className="h2 grow">{title}</div>
          <button className="icon-btn sm" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div style={{ padding: 18, flex: 1 }}>{children}</div>
        {footer && <div className="card-f">{footer}</div>}
      </aside>
    </div>
  );
}

/* ---------------- numbers & charts ---------------- */

export function CountUp({ to, dur = 900, decimals = 0, prefix = "", suffix = "" }: { to: number; dur?: number; decimals?: number; prefix?: string; suffix?: string }) {
  const [v, setV] = useState(() => (document.documentElement.classList.contains("shots") ? to : 0));
  useEffect(() => {
    if (document.documentElement.classList.contains("shots")) return setV(to);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, dur]);
  return (
    <span className="num">
      {prefix}
      {v.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

export function Meter({ v, tone = "pen", size }: { v: number; tone?: string; size?: "thin" | "thick" }) {
  return (
    <div
      className={`meter ${size ?? ""}`}
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ "--m": `${v}%`, "--mc": `var(--${tone})` } as CSSProperties}
    />
  );
}

export function Ring({
  v,
  size = 64,
  stroke = 6,
  tone = "pen",
  children,
}: {
  v: number;
  size?: number;
  stroke?: number;
  tone?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--sunk)" strokeWidth={stroke} fill="none" />
        <circle
          className="ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`var(--${tone})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ "--c": c } as CSSProperties}
        />
      </svg>
      {children && <span className="ring-in">{children}</span>}
    </span>
  );
}

export function Donut({ parts, size = 120, stroke = 14, children }: { parts: { v: number; c: string }[]; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = parts.reduce((a, p) => a + p.v, 0);
  let acc = 0;
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--sunk)" strokeWidth={stroke} fill="none" />
        {parts.map((p, i) => {
          const len = (p.v / total) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={p.c}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
              strokeDashoffset={-acc}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          acc += len;
          return el;
        })}
      </svg>
      {children && <span className="ring-in">{children}</span>}
    </span>
  );
}

export function Spark({ data, w = 120, h = 32, color = "var(--pen)", fill = true }: { data: number[]; w?: number; h?: number; color?: string; fill?: boolean }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map((d, i) => [(i / (data.length - 1)) * (w - 4) + 2, h - 3 - ((d - min) / (max - min || 1)) * (h - 6)]);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} aria-hidden="true" style={{ display: "block" }}>
      {fill && <path d={`${path} L${last[0]} ${h} L2 ${h} Z`} fill={color} opacity="0.1" />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.8" fill={color} />
    </svg>
  );
}

/** Line chart that fills its container width (viewBox scaled). */
export function LineChart({
  series,
  labels,
  h = 180,
  yTicks = 4,
  fmt = (n: number) => String(Math.round(n)),
}: {
  series: { name: string; data: number[]; c: string; dash?: boolean }[];
  labels: string[];
  h?: number;
  yTicks?: number;
  fmt?: (n: number) => string;
}) {
  const W = 600;
  const pad = { l: 36, r: 8, t: 10, b: 22 };
  const all = series.flatMap((s) => s.data);
  const max = Math.max(...all) * 1.1;
  const min = 0;
  const x = (i: number) => pad.l + (i / (labels.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);
  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const v = min + ((max - min) * i) / yTicks;
        return (
          <g key={i}>
            <line className="chart-grid" x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} vectorEffect="non-scaling-stroke" />
            <text className="chart-lbl" x={pad.l - 8} y={y(v) + 3.5} textAnchor="end">
              {fmt(v)}
            </text>
          </g>
        );
      })}
      {labels.map((l, i) =>
        i % Math.ceil(labels.length / 8) === 0 || i === labels.length - 1 ? (
          <text key={i} className="chart-lbl" x={x(i)} y={h - 4} textAnchor="middle">
            {l}
          </text>
        ) : null,
      )}
      {series.map((s, si) => {
        const d = s.data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
        return (
          <g key={si}>
            {si === 0 && <path d={`${d} L${x(s.data.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={s.c} opacity="0.08" />}
            <path d={d} fill="none" stroke={s.c} strokeWidth="2" strokeDasharray={s.dash ? "4 4" : undefined} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </g>
        );
      })}
    </svg>
  );
}

export function Bars({ data, h = 140, fmt = (n: number) => String(n) }: { data: { l: string; v: number; c?: string }[]; h?: number; fmt?: (n: number) => string }) {
  const max = Math.max(...data.map((d) => d.v));
  return (
    <div className="bars" style={{ height: h }}>
      {data.map((d, i) => (
        <div className="bar-col" key={i} data-tip={`${d.l}: ${fmt(d.v)}`}>
          <div className="bar" style={{ height: `${(d.v / max) * 100}%`, background: d.c ?? "var(--pen)", animationDelay: `${i * 25}ms` }} />
          <span className="bar-l">{d.l}</span>
        </div>
      ))}
    </div>
  );
}

/** Deterministic pseudo-random numbers for sample data. */
export function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function Heatmap({ weeks = 26, seed = 7 }: { weeks?: number; seed?: number }) {
  const r = rng(seed);
  return (
    <div className="heat" aria-label="Activity heatmap">
      {Array.from({ length: weeks * 7 }, (_, i) => {
        const v = r();
        const l = v < 0.35 ? 0 : v < 0.55 ? 1 : v < 0.75 ? 2 : v < 0.9 ? 3 : 4;
        return <i key={i} data-l={l} />;
      })}
    </div>
  );
}

/* ---------------- code ---------------- */

const KW = new Set(
  "int long void return for while if else auto const using namespace class public private struct true false def in range and or not None import from break continue new static elif pass lambda select where group by order join on as limit having export default function let var await async type interface extends implements try catch throw".split(
    " ",
  ),
);
const TY = new Set("int long void bool string vector map unordered_map pair size_t List int64_t ll String number boolean".split(" "));

function tokenize(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\/\/.*$|#.*$|--.*$)|("[^"]*"|'[^']*'|`[^`]*`)|(\b\d[\d_]*(?:\.\d+)?(?:e\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)(?=\s*\()|([A-Za-z_][A-Za-z0-9_]*)|(\s+|.)/g;
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
      const up = /^[A-Z]+$/.test(w) && KW.has(w.toLowerCase());
      out.push(
        <span key={k} className={TY.has(w) ? "tk-ty" : KW.has(w) || up ? "tk-kw" : undefined}>
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
  good = [],
  caret,
  nonum,
  className,
  style,
}: {
  code: string;
  hl?: number[];
  bad?: number[];
  good?: number[];
  caret?: number;
  nonum?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <pre className={`code ${nonum ? "nonum" : ""} ${className ?? ""}`} style={style}>
      {lines.map((l, i) => (
        <span
          key={i}
          className={`ln ${hl.includes(i + 1) ? "mark" : ""} ${bad.includes(i + 1) ? "bad" : ""} ${good.includes(i + 1) ? "good" : ""} ${caret === i + 1 ? "caret" : ""}`}
        >
          {tokenize(l)}
          {l === "" ? " " : null}
        </span>
      ))}
    </pre>
  );
}

/* ---------------- layout helpers ---------------- */

export function PageHead({
  eyebrow,
  title,
  sub,
  actions,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="grow">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="h1">{title}</h1>
        {sub && <p className="muted page-sub">{sub}</p>}
        {children}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  icon,
  actions,
  children,
  footer,
  className,
  pad = true,
  style,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  pad?: boolean;
  style?: CSSProperties;
}) {
  return (
    <section className={`card ${className ?? ""}`} style={style}>
      {title && (
        <div className="card-h">
          {icon}
          <div className="h3">{title}</div>
          {actions}
        </div>
      )}
      {pad ? <div className="card-b">{children}</div> : children}
      {footer && <div className="card-f">{footer}</div>}
    </section>
  );
}

export function Stat({ k, v, d, dir, serif }: { k: ReactNode; v: ReactNode; d?: ReactNode; dir?: "up" | "down"; serif?: boolean }) {
  return (
    <div className="stat">
      <span className="k">{k}</span>
      <span className={`v ${serif ? "serif" : ""}`}>{v}</span>
      {d && <span className={`d ${dir ?? ""}`}>{d}</span>}
    </div>
  );
}
