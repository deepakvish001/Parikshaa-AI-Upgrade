import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, Pause, Play, CircleCheck, Circle, Search } from "lucide-react";
import { Link, hms, useStopwatch, useT } from "../lib/core";
import { LogoMark } from "./kit";
import { LangMenu, ThemeButton, CommandPalette } from "./shell";
import { TODAY } from "../screens/aaj";

/** Top bar for full-screen work (problem, studio, tests). */
export function FocusBar({
  back,
  backLabel,
  title,
  center,
  right,
}: {
  back: string;
  backLabel: string;
  title: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}) {
  const [search, setSearch] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <header className="focusbar">
      <div className="fb-left">
        <Link to={back} className="icon-btn bordered" aria-label={backLabel} title={backLabel}>
          <ArrowLeft size={16} />
        </Link>
        <Link to="aaj" className="brand hide-phone" aria-label="Parikshaa">
          <LogoMark size={24} />
        </Link>
        <div className="fb-title">{title}</div>
      </div>
      <div className="fb-center">{center}</div>
      <div className="fb-right">
        {right}
        <button type="button" className="icon-btn hide-phone" aria-label="Search" onClick={() => setSearch(true)}>
          <Search size={16} />
        </button>
        <LangMenu />
        <ThemeButton />
      </div>
      {search && <CommandPalette onClose={() => setSearch(false)} />}
    </header>
  );
}

/** "Task 2/5" dropdown + honest day timer, from the plan. */
export function TaskTimer({ index = 1 }: { index?: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(true);
  const [secs] = useStopwatch(18 * 60 + 5, running);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div className="task-timer" ref={ref}>
      <button type="button" className="tt-task" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {t("Task", "Kaam", "काम")} {index + 1}/{TODAY.length}
        <ChevronDown size={14} />
      </button>
      <span className="tt-day hide-phone">
        {t("Today", "Aaj", "आज")} · 38m / 2h 10m
      </span>
      <span className={`tt-clock num ${running ? "" : "paused"}`} role="timer" aria-label="Time on this task">
        {hms(secs, false)}
      </span>
      <button type="button" className="icon-btn" aria-label={running ? "Pause timer" : "Resume timer"} onClick={() => setRunning((r) => !r)}>
        {running ? <Pause size={15} /> : <Play size={15} />}
      </button>
      {open && (
        <div className="popover tt-menu" role="menu">
          <span className="eyebrow" style={{ padding: "6px 10px", display: "block" }}>
            {t("Today's tasks", "Aaj ke kaam", "आज के काम")}
          </span>
          {TODAY.map((task, i) => (
            <Link key={i} to={task.to} className={`tt-item ${i === 0 ? "done" : i === index ? "now" : ""}`} onClick={() => setOpen(false)}>
              {i === 0 ? <CircleCheck size={15} /> : <Circle size={15} />}
              <span className="grow">{t(...task.name)}</span>
              {i === index && <span className="tag ok">{t("In progress", "Chal raha", "चल रहा")}</span>}
              <span className="faint num">{i === 0 ? "22m" : `${task.mins}m`}</span>
            </Link>
          ))}
          <p className="faint" style={{ fontSize: "var(--fs-11)", padding: "8px 10px 4px" }}>
            {t("The timer pauses when you switch tabs or stop typing for 5 minutes.", "Tab badalne ya 5 minute kuch na karne par timer ruk jaata hai.", "टैब बदलने पर टाइमर रुक जाता है।")}
          </p>
        </div>
      )}
    </div>
  );
}
