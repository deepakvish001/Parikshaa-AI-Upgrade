import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Two panes and a divider between them that the candidate can drag — or move
 * with the arrow keys, since a divider is a control like any other. Given a
 * name to `remember` it by, the split is kept on this device for next time.
 */
export function SplitPane({
  direction,
  first,
  second,
  initial = 50,
  min = 20,
  label,
  className,
  remember,
}: {
  /** "row": side by side; "column": one above the other. */
  readonly direction: "row" | "column";
  readonly first: ReactNode;
  readonly second: ReactNode;
  /** The first pane's share, in percent. */
  readonly initial?: number;
  readonly min?: number;
  /** What the divider resizes, for a screen reader. */
  readonly label: string;
  readonly className?: string;
  readonly remember?: string;
}) {
  const key = remember === undefined ? null : `parikshaa.split.${remember}`;
  const [share, setShare] = useState(() => {
    try {
      const stored = key === null ? null : Number(localStorage.getItem(key));
      return stored !== null && Number.isFinite(stored) && stored >= min && stored <= 100 - min ? stored : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    if (key === null) return;
    try {
      localStorage.setItem(key, String(Math.round(share)));
    } catch {
      // Kept for this page only.
    }
  }, [key, share]);
  const box = useRef<HTMLDivElement>(null);
  const clamp = (value: number) => Math.min(100 - min, Math.max(min, value));

  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = box.current;
    if (container === null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const move = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const at = direction === "row" ? (e.clientX - rect.left) / rect.width : (e.clientY - rect.top) / rect.height;
      setShare(clamp(at * 100));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  const keys = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const back = direction === "row" ? "ArrowLeft" : "ArrowUp";
    const on = direction === "row" ? "ArrowRight" : "ArrowDown";
    if (event.key === back || event.key === on) {
      event.preventDefault();
      setShare((s) => clamp(s + (event.key === on ? 5 : -5)));
    } else if (event.key === "Home") {
      event.preventDefault();
      setShare(min);
    } else if (event.key === "End") {
      event.preventDefault();
      setShare(100 - min);
    }
  };

  return (
    <div ref={box} className={`split split-${direction}${className === undefined ? "" : ` ${className}`}`}>
      <div className="split-pane" style={{ flexBasis: `${share}%` }}>
        {first}
      </div>
      <div
        className="split-divider"
        role="separator"
        tabIndex={0}
        aria-label={label}
        aria-orientation={direction === "row" ? "vertical" : "horizontal"}
        aria-valuemin={min}
        aria-valuemax={100 - min}
        aria-valuenow={Math.round(share)}
        onPointerDown={drag}
        onKeyDown={keys}
      />
      <div className="split-pane" style={{ flexBasis: `${100 - share}%` }}>
        {second}
      </div>
    </div>
  );
}
