import { useEffect, useId, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useT } from "../lib/core";

/*
  Sketch-style dry run (docs/learn/VISUAL-STYLE.md): paper, hand-drawn ink, one coral highlight per frame.
  Every frame comes from a step list computed by code, so numbers and captions always match.
*/

export type DryStep = {
  L: number;
  R: number;
  found?: boolean;
  line: number;
  caption: [string, string, string];
};

export const PAIR_ARR = [1, 3, 4, 6, 8, 11];
export const PAIR_TARGET = 10;

/** Two pointers on a sorted array, computed (not hand written). */
export function pairSteps(arr = PAIR_ARR, target = PAIR_TARGET): DryStep[] {
  const out: DryStep[] = [];
  let L = 0;
  let R = arr.length - 1;
  while (L < R) {
    const sum = arr[L] + arr[R];
    if (sum === target) {
      out.push({
        L,
        R,
        found: true,
        line: 5,
        caption: [
          `${arr[L]} + ${arr[R]} = ${sum}. Found the pair at positions ${L} and ${R}.`,
          `${arr[L]} + ${arr[R]} = ${sum}. Jodi mil gayi: position ${L} aur ${R}.`,
          `${arr[L]} + ${arr[R]} = ${sum}। जोड़ी मिल गई: स्थान ${L} और ${R}।`,
        ],
      });
      break;
    }
    if (sum < target) {
      out.push({
        L,
        R,
        line: 6,
        caption: [
          `${arr[L]} + ${arr[R]} = ${sum} is less than ${target}. Move L right to make the sum bigger.`,
          `${arr[L]} + ${arr[R]} = ${sum}, ${target} se kam. Sum badhane ke liye L ko daayein.`,
          `${arr[L]} + ${arr[R]} = ${sum}, ${target} से कम। योग बढ़ाने के लिए L को दाएँ।`,
        ],
      });
      L++;
    } else {
      out.push({
        L,
        R,
        line: 7,
        caption: [
          `${arr[L]} + ${arr[R]} = ${sum} is more than ${target}. Move R left to make the sum smaller.`,
          `${arr[L]} + ${arr[R]} = ${sum}, ${target} se zyada. Sum ghataane ke liye R ko baayein.`,
          `${arr[L]} + ${arr[R]} = ${sum}, ${target} से ज़्यादा। योग घटाने के लिए R को बाएँ।`,
        ],
      });
      R--;
    }
  }
  return out;
}

/** Deterministic wobble so the hand-drawn lines stay still while you slide. */
function wobble(seed: number) {
  let x = seed * 9301 + 49297;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280 - 0.5;
  };
}
function sketchRect(x: number, y: number, w: number, h: number, seed: number) {
  const r = wobble(seed);
  const j = () => r() * 2.2;
  const p = (a: number, b: number) => `${(a + j()).toFixed(1)} ${(b + j()).toFixed(1)}`;
  return `M${p(x, y)} L${p(x + w, y)} L${p(x + w, y + h)} L${p(x, y + h)} Z M${p(x + 2, y - 1)} L${p(x + w - 1, y + 1)}`;
}
export function DrySketch({ step, arr = PAIR_ARR, compact }: { step: DryStep; arr?: number[]; compact?: boolean }) {
  const cell = 64;
  const gap = 10;
  const w = arr.length * (cell + gap) + 40;
  const h = 200;
  const top = 46;
  const pid = `hatch-${useId().replace(/:/g, "")}`;
  return (
    <svg className="dry-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`L at ${step.L}, R at ${step.R}`}>
      <defs>
        <pattern id={pid} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" className="dry-hatch" />
        </pattern>
      </defs>
      <text x="20" y="24" className="dry-hand">
        target = {PAIR_TARGET}
      </text>
      {arr.map((v, i) => {
        const x = 20 + i * (cell + gap);
        const active = i === step.L || i === step.R;
        const out = i < step.L || i > step.R;
        return (
          <g key={i} className={`dry-cell ${active ? "on" : ""} ${out ? "out" : ""} ${step.found && active ? "found" : ""}`}>
            {active && <rect x={x + 3} y={top + 3} width={cell - 6} height={cell - 6} fill={`url(#${pid})`} />}
            <path d={sketchRect(x, top, cell, cell, i + 1)} className="dry-box" />
            <text x={x + cell / 2} y={top + cell / 2 + 8} textAnchor="middle" className="dry-num">
              {v}
            </text>
            <text x={x + cell / 2} y={top + cell + 18} textAnchor="middle" className="dry-idx">
              {i}
            </text>
          </g>
        );
      })}
      {(["L", "R"] as const).map((k) => {
        const idx = k === "L" ? step.L : step.R;
        const x = 20 + idx * (cell + gap) + cell / 2;
        return (
          <g key={k} className="dry-ptr" style={{ transform: `translateX(${x}px)` }}>
            <path d={`M0 ${top + cell + 30} q ${k === "L" ? -3 : 3} 10 0 22`} className="dry-arrow" />
            <path d={`M-5 ${top + cell + 36} L0 ${top + cell + 28} L5 ${top + cell + 36}`} className="dry-arrow" />
            <text x="0" y={top + cell + 72} textAnchor="middle" className="dry-hand dry-ptr-label">
              {k}
            </text>
          </g>
        );
      })}
      {step.found && (
        <text x={w - 20} y="24" textAnchor="end" className="dry-hand dry-done">
          ✓ {arr[step.L]} + {arr[step.R]} = {PAIR_TARGET}
        </text>
      )}
    </svg>
  );
}

const PAIR_CODE = [
  "int L = 0, R = n - 1;",
  "while (L < R) {",
  "  long long s = (long long)a[L] + a[R];",
  "  // compare s with target",
  "  if (s == target) return {L, R};",
  "  if (s < target) L++;",
  "  else R--;",
  "}",
];

export function DryRunPlayer({ autoplay = false, compact = false, showCode = true }: { autoplay?: boolean; compact?: boolean; showCode?: boolean }) {
  const t = useT();
  const steps = useMemo(() => pairSteps(), []);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % steps.length), 1700);
    return () => window.clearInterval(id);
  }, [playing, steps.length]);
  const step = steps[i];
  const sum = PAIR_ARR[step.L] + PAIR_ARR[step.R];
  return (
    <div className={`dry ${compact ? "compact" : ""}`}>
      <div className="dry-stage">
        <DrySketch step={step} compact={compact} />
      </div>
      <p className="dry-caption" aria-live="polite">
        <span className="tag outline num">
          {t("Step", "Kadam", "कदम")} {i + 1}/{steps.length}
        </span>
        {t(...step.caption)}
      </p>
      {showCode && !compact && (
        <div className="dry-side">
          <pre className="code dry-code">
            {PAIR_CODE.map((l, n) => (
              <span key={n} className={`ln ${n + 1 === step.line ? "hl" : ""}`}>
                {l}
                {"\n"}
              </span>
            ))}
          </pre>
          <dl className="dry-vars">
            <div>
              <dt>L</dt>
              <dd className="num">{step.L}</dd>
            </div>
            <div>
              <dt>R</dt>
              <dd className="num">{step.R}</dd>
            </div>
            <div>
              <dt>a[L] + a[R]</dt>
              <dd className="num">{sum}</dd>
            </div>
            <div>
              <dt>target</dt>
              <dd className="num">{PAIR_TARGET}</dd>
            </div>
          </dl>
        </div>
      )}
      <div className="dry-controls">
        <button type="button" className="icon-btn bordered" onClick={() => setI((x) => Math.max(0, x - 1))} aria-label="Previous step">
          <ChevronLeft size={16} />
        </button>
        <button type="button" className="icon-btn bordered" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <input
          type="range"
          id={`dry-range-${compact ? "c" : "f"}`}
          min={0}
          max={steps.length - 1}
          value={i}
          onChange={(e) => {
            setPlaying(false);
            setI(Number(e.target.value));
          }}
          aria-label="Step"
        />
        <button type="button" className="icon-btn bordered" onClick={() => setI((x) => Math.min(steps.length - 1, x + 1))} aria-label="Next step">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
