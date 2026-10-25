import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { LogoMark } from "./react";

/**
 * Learn's kit (docs/learn/DESIGN-SYSTEM.md §6–§9), ported from the clickable
 * mock (docs/learn/mock-v3/app/src/ui/focus.tsx, kit.tsx, states.tsx): the
 * focus bar, panes that open, close and resize, a segmented control, a ring
 * and a meter, and the screen states every main screen has (empty, loading,
 * error, offline, first visit). Styles are in `kit.css`, which needs
 * `tokens.css` and `learn.css` loaded before it.
 *
 * Nothing here carries a language: every word comes from the app as a prop,
 * except a few accessible names that have an English default, and each of
 * those can be replaced. Nothing here routes either: links take an `href` and
 * an optional `onNavigate` for the app's own router.
 */

/* ---------------- small pieces ---------------- */

/** Icon paths after Lucide (ISC licence), drawn inline so the brand needs no icon package. */
function Icon({ children, size = 18 }: { readonly children: ReactNode; readonly size?: number }) {
  return (
    <svg
      className="kit-icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const ArrowLeft = () => (
  <Icon>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </Icon>
);
const ChevronLeft = () => (
  <Icon size={15}>
    <path d="m15 18-6-6 6-6" />
  </Icon>
);
const Grip = () => (
  <Icon size={12}>
    <path d="m9 7-5 5 5 5" />
    <path d="m15 7 5 5-5 5" />
  </Icon>
);
const Cross = () => (
  <Icon>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Icon>
);
const Retry = () => (
  <Icon size={16}>
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </Icon>
);
const WifiOff = () => (
  <Icon size={17}>
    <path d="M12 20h.01" />
    <path d="M8.5 16.43a5 5 0 0 1 7 0" />
    <path d="M5 12.86a10 10 0 0 1 5.17-2.69" />
    <path d="M19 12.86a10 10 0 0 0-2-1.52" />
    <path d="M2 8.82a15 15 0 0 1 4.18-2.64" />
    <path d="M22 8.82a15 15 0 0 0-11.29-3.76" />
    <path d="m2 2 20 20" />
  </Icon>
);

const cx = (...names: readonly (string | false | undefined)[]) => names.filter(Boolean).join(" ");

/** A link the app routes: `onNavigate` runs on a plain click (no modifier key), so a new tab still works. */
export interface KitLink {
  readonly href: string;
  /** Its accessible name, also shown as its tooltip. */
  readonly label: string;
  /** For the app's own router: call `event.preventDefault()` and go there. */
  readonly onNavigate?: (event: ReactMouseEvent<HTMLAnchorElement>) => void;
}

function NavAnchor({ link, className, children }: { readonly link: KitLink; readonly className: string; readonly children: ReactNode }) {
  return (
    <a
      href={link.href}
      className={className}
      aria-label={link.label}
      title={link.label}
      onClick={(event) => {
        if (link.onNavigate === undefined || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        link.onNavigate(event);
      }}
    >
      {children}
    </a>
  );
}

/* ---------------- media ---------------- */

/** Below this width the panes become tabs and the focus bar drops its centre (DESIGN-SYSTEM §7). */
export const PHONE_QUERY = "(max-width: 860px)";

const canMatch = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

/** Whether a media query matches now, following it as it changes. False where there is no `matchMedia`. */
export function useMedia(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!canMatch()) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => canMatch() && window.matchMedia(query).matches,
    () => false,
  );
}

/* ---------------- focus bar ---------------- */

export interface FocusBarProps {
  /** The way back, always first. */
  readonly back: KitLink;
  /** The mark, linking home; hidden on a phone. */
  readonly home?: KitLink;
  readonly title: ReactNode;
  readonly sub?: ReactNode;
  /** The screen's name is its main heading (default); "div" where the page has its own h1. */
  readonly titleAs?: "h1" | "div";
  /** What is needed every minute: the task and its timer, the pane toggles. Hidden on a phone. */
  readonly center?: ReactNode;
  readonly right?: ReactNode;
  /** The ⋯ menu, last: page actions, language, theme and shortcuts (the app's Menu). */
  readonly more?: ReactNode;
  readonly className?: string;
}

/**
 * The top bar of a focus screen (problem, SQL, Studio, notebook, interview):
 * back, the screen's name, what is needed every minute, and the rest behind ⋯.
 * It stays in every state of the screen, so the way back is never lost.
 */
export function FocusBar({ back, home, title, sub, titleAs = "h1", center, right, more, className }: FocusBarProps) {
  const Title = titleAs;
  return (
    <header className={cx("kit-fbar", className)}>
      <div className="kit-fbar-l">
        <NavAnchor link={back} className="kit-icon-btn">
          <ArrowLeft />
        </NavAnchor>
        {home === undefined ? null : (
          <NavAnchor link={home} className="kit-fbar-home">
            <LogoMark size={26} />
          </NavAnchor>
        )}
        <div className="kit-fbar-title">
          <Title className="kit-fbar-name">{title}</Title>
          {sub === undefined ? null : <span className="kit-fbar-sub">{sub}</span>}
        </div>
      </div>
      {center === undefined ? null : <div className="kit-fbar-c">{center}</div>}
      <div className="kit-fbar-r">
        {right}
        {more}
      </div>
    </header>
  );
}

/* ---------------- panes ---------------- */

export interface PaneDef<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly content: ReactNode;
  /** Its share of the width when open, against the other open panes (Problem 0.31, Code 0.42, Sahayak 0.3). */
  readonly weight: number;
  /** The narrowest it may be, in px (default 260). */
  readonly min?: number;
  readonly tone?: "ai";
  /** A thin rail to reopen it while it is closed (default true). */
  readonly rail?: boolean;
}

export type PaneState<Id extends string> = Readonly<Record<Id, boolean>>;

/** Which panes are open. At least one always stays open. */
export function usePanes<Id extends string>(initial: PaneState<Id>) {
  const [open, setOpen] = useState<PaneState<Id>>(initial);
  const set = useCallback((id: Id, value: (was: boolean) => boolean) => {
    setOpen((was) => {
      const next = { ...was, [id]: value(was[id]) };
      return Object.values(next).some(Boolean) ? next : was;
    });
  }, []);
  const toggle = useCallback((id: Id) => set(id, (was) => !was), [set]);
  const show = useCallback((id: Id, value = true) => set(id, () => value), [set]);
  return { open, toggle, show, setOpen };
}

export interface PanesProps<Id extends string> {
  readonly panes: readonly PaneDef<Id>[];
  readonly open: PaneState<Id>;
  /** Opens a closed pane from its rail (`usePanes().toggle`). */
  readonly toggle: (id: Id) => void;
  /** On a phone the panes are tabs, and this one is shown; leave it out and the panes keep their own. */
  readonly phoneTab?: Id;
  readonly onPhoneTab?: (id: Id) => void;
  /** Name of the tab list on a phone. Default "Panes". */
  readonly tabsLabel?: string;
  /** Name of a closed pane's rail. Default "Show <label>". */
  readonly railLabel?: (pane: PaneDef<Id>) => string;
  /** Name of the divider between two panes. Default "Resize <left> and <right>". */
  readonly resizeLabel?: (left: PaneDef<Id>, right: PaneDef<Id>) => string;
  /** When the panes become tabs. Default `PHONE_QUERY`. */
  readonly phoneQuery?: string;
  readonly className?: string;
}

/** No open pane may be narrower than this share of the open panes' weight. */
const MIN_SHARE = 0.14;
/** One arrow key press moves the divider this many percent of the two panes. */
const KEY_STEP = 5;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * Two or three panes side by side (DESIGN-SYSTEM §7, Workspace). Each can be
 * closed (from its `PaneHead`) and comes back from a thin rail; the dividers
 * between open panes drag, and move with the arrow keys (Home and End to the
 * ends), as the WAI-ARIA window splitter. Every pane stays mounted, so a
 * closed one keeps what was typed in it and opening it animates its width.
 * Below 860 px the panes are tabs, one at a time.
 */
export function Panes<Id extends string>({
  panes,
  open,
  toggle,
  phoneTab,
  onPhoneTab,
  tabsLabel = "Panes",
  railLabel = (pane) => `Show ${pane.label}`,
  resizeLabel = (left, right) => `Resize ${left.label} and ${right.label}`,
  phoneQuery = PHONE_QUERY,
  className,
}: PanesProps<Id>) {
  const base = useId();
  const box = useRef<HTMLDivElement>(null);
  const [weights, setWeights] = useState<Partial<Record<Id, number>>>({});
  const [ownTab, setOwnTab] = useState<Id | undefined>(undefined);
  const [resizing, setResizing] = useState(false);
  const stopDrag = useRef<(() => void) | null>(null);
  const phone = useMedia(phoneQuery);

  useEffect(() => () => stopDrag.current?.(), []);

  const weightOf = (pane: PaneDef<Id>) => weights[pane.id] ?? pane.weight;
  const openPanes = panes.filter((pane) => open[pane.id]);
  const total = openPanes.reduce((sum, pane) => sum + weightOf(pane), 0) || 1;
  const paneId = (id: Id) => `${base}-pane-${id}`;
  const tabId = (id: Id) => `${base}-tab-${id}`;

  /** The left pane's percent of the pair, and the range it may take. */
  const split = (left: PaneDef<Id>, right: PaneDef<Id>) => {
    const pair = weightOf(left) + weightOf(right);
    const low = Math.min(50, (100 * total * MIN_SHARE) / pair);
    return { pair, now: (100 * weightOf(left)) / pair, low, high: 100 - low };
  };
  const setSplit = (left: PaneDef<Id>, right: PaneDef<Id>, percent: number) => {
    const { pair, low, high } = split(left, right);
    const share = (clamp(percent, low, high) / 100) * pair;
    setWeights((was) => ({ ...was, [left.id]: share, [right.id]: pair - share }));
  };

  const onDividerKey = (event: ReactKeyboardEvent, left: PaneDef<Id>, right: PaneDef<Id>) => {
    const { now, low, high } = split(left, right);
    const to =
      event.key === "ArrowLeft" ? now - KEY_STEP
      : event.key === "ArrowRight" ? now + KEY_STEP
      : event.key === "Home" ? low
      : event.key === "End" ? high
      : null;
    if (to === null) return;
    event.preventDefault();
    setSplit(left, right, to);
  };

  const onDividerDown = (event: ReactPointerEvent, left: PaneDef<Id>, right: PaneDef<Id>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    stopDrag.current?.();
    const width = box.current?.clientWidth || 1;
    const start = { x: event.clientX, ...split(left, right) };
    const move = (moved: PointerEvent) => {
      const shift = (((moved.clientX - start.x) / width) * total * 100) / start.pair;
      setSplit(left, right, start.now + shift);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      stopDrag.current = null;
      setResizing(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    stopDrag.current = stop;
    setResizing(true);
  };

  const current = panes.find((pane) => pane.id === (phoneTab ?? ownTab)) ?? panes[0];
  const choose = (id: Id) => {
    setOwnTab(id);
    onPhoneTab?.(id);
  };
  const onTabKey = (event: ReactKeyboardEvent, index: number) => {
    const to =
      event.key === "ArrowRight" ? (index + 1) % panes.length
      : event.key === "ArrowLeft" ? (index - 1 + panes.length) % panes.length
      : event.key === "Home" ? 0
      : event.key === "End" ? panes.length - 1
      : null;
    if (to === null) return;
    event.preventDefault();
    choose(panes[to]!.id);
    box.current?.querySelectorAll<HTMLElement>('[role="tab"]')[to]?.focus();
  };

  // One tree for both layouts, each pane's section always first in its group,
  // so a pane's content stays mounted when the screen turns from wide to phone.
  return (
    <div ref={box} className={cx("kit-panes", phone && "is-phone", resizing && "is-resizing", className)}>
      {phone ? (
        <div className="kit-pane-tabs" role="tablist" aria-label={tabsLabel}>
          {panes.map((pane, index) => (
            <button
              key={pane.id}
              type="button"
              role="tab"
              id={tabId(pane.id)}
              aria-selected={pane.id === current?.id}
              aria-controls={paneId(pane.id)}
              tabIndex={pane.id === current?.id ? 0 : -1}
              className={cx(pane.tone === "ai" && "kit-ai")}
              onClick={() => choose(pane.id)}
              onKeyDown={(event) => onTabKey(event, index)}
            >
              {pane.icon}
              {pane.label}
            </button>
          ))}
        </div>
      ) : null}
      {panes.map((pane, index) => {
        const isOpen = open[pane.id];
        const next = openPanes[openPanes.indexOf(pane) + 1];
        const min = pane.min ?? 260;
        const tone = pane.tone === "ai" && "kit-pane-ai";
        if (phone) {
          return (
            <Fragment key={pane.id}>
              <section
                id={paneId(pane.id)}
                className={cx("kit-pane", tone)}
                role="tabpanel"
                aria-labelledby={tabId(pane.id)}
                hidden={pane.id !== current?.id}
              >
                <div className="kit-pane-in">{pane.content}</div>
              </section>
              {null}
              {null}
            </Fragment>
          );
        }
        const style: CSSProperties = { flexGrow: isOpen ? Math.round((weightOf(pane) / total) * 1000) : 0, minWidth: isOpen ? min : 0 };
        const range = isOpen && next !== undefined ? split(pane, next) : null;
        return (
          <Fragment key={pane.id}>
            <section
              id={paneId(pane.id)}
              className={cx("kit-pane", tone, !isOpen && "is-closed")}
              style={style}
              aria-label={pane.label}
              aria-hidden={isOpen ? undefined : true}
              inert={!isOpen}
            >
              <div className="kit-pane-in" style={{ minWidth: min }}>
                {pane.content}
              </div>
            </section>
            {!isOpen && pane.rail !== false ? (
              <button type="button" className={cx("kit-pane-rail", pane.tone === "ai" && "kit-ai")} onClick={() => toggle(pane.id)} aria-label={railLabel(pane)} title={railLabel(pane)}>
                {pane.icon}
                <span>{pane.label}</span>
              </button>
            ) : null}
            {index === panes.length - 1 ? null : range === null || next === undefined ? (
              <div className="kit-pane-div off" aria-hidden="true" />
            ) : (
              <div
                className="kit-pane-div"
                role="separator"
                tabIndex={0}
                aria-orientation="vertical"
                aria-label={resizeLabel(pane, next)}
                aria-controls={paneId(pane.id)}
                aria-valuenow={Math.round(range.now)}
                aria-valuemin={Math.round(range.low)}
                aria-valuemax={Math.round(range.high)}
                onKeyDown={(event) => onDividerKey(event, pane, next)}
                onPointerDown={(event) => onDividerDown(event, pane, next)}
              >
                <Grip />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/** A pane's header: its title and controls, and a button that closes the pane. */
export function PaneHead({ children, onClose, closeLabel = "Hide" }: { readonly children: ReactNode; readonly onClose?: () => void; readonly closeLabel?: string }) {
  return (
    <div className="kit-pane-h">
      {children}
      {onClose === undefined ? null : (
        <button type="button" className="kit-icon-btn kit-sm kit-pane-x" onClick={onClose} aria-label={closeLabel} title={closeLabel}>
          <ChevronLeft />
        </button>
      )}
    </div>
  );
}

/* ---------------- segmented control ---------------- */

export interface SegItem<T extends string> {
  readonly id: T;
  readonly label: ReactNode;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
}

/**
 * Two to five choices of which one is on (WAI-ARIA radio group): the arrow
 * keys move and choose (Home and End to the ends, skipping disabled ones),
 * and only the chosen one is in the Tab order. A thumb slides under it.
 */
export function Seg<T extends string>({
  label,
  items,
  value,
  onChange,
  className,
}: {
  /** The group's accessible name. */
  readonly label: string;
  readonly items: readonly SegItem<T>[];
  readonly value: T;
  readonly onChange: (next: T) => void;
  readonly className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const measure = useCallback(() => {
    const on = ref.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
    const next = on && on.offsetWidth > 0 ? { left: on.offsetLeft, width: on.offsetWidth } : null;
    setThumb((was) => (was?.left === next?.left && was?.width === next?.width ? was : next));
  }, []);
  useLayoutEffect(measure, [measure, value, items.length]);
  useEffect(() => {
    if (typeof ResizeObserver === "undefined" || ref.current === null) return;
    const observer = new ResizeObserver(measure);
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [measure]);

  const usable = items.filter((item) => item.disabled !== true);
  const focusable = items.some((item) => item.id === value && item.disabled !== true) ? value : usable[0]?.id;
  const onKey = (event: ReactKeyboardEvent, id: T) => {
    const at = usable.findIndex((item) => item.id === id);
    const to =
      event.key === "ArrowRight" || event.key === "ArrowDown" ? (at + 1) % usable.length
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (at - 1 + usable.length) % usable.length
      : event.key === "Home" ? 0
      : event.key === "End" ? usable.length - 1
      : null;
    if (to === null || usable.length === 0) return;
    event.preventDefault();
    const target = usable[to]!;
    onChange(target.id);
    ref.current?.querySelectorAll<HTMLElement>('[role="radio"]')[items.indexOf(target)]?.focus();
  };

  return (
    <div ref={ref} className={cx("kit-seg", thumb !== null && "has-thumb", className)} role="radiogroup" aria-label={label}>
      {thumb === null ? null : <span className="kit-seg-thumb" style={{ left: thumb.left, width: thumb.width }} aria-hidden="true" />}
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="radio"
          aria-checked={item.id === value}
          tabIndex={item.id === focusable ? 0 : -1}
          disabled={item.disabled}
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => onKey(event, item.id)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- ring and meter ---------------- */

/** The colours a ring or meter can take (learn.css). */
export type KitTone = "pen" | "tick" | "red" | "ai" | "coin" | "teal" | "marker";

/** A value's accessible name: its own words, or the id of the text beside it that names it. */
export type Named = { readonly label: string; readonly labelledBy?: never } | { readonly labelledBy: string; readonly label?: never };

export type GaugeProps = Named & {
  readonly value: number;
  /** Default 100. */
  readonly max?: number;
  /** What a screen reader says for the value, when a bare number is not enough: "7 of 10 done". */
  readonly valueText?: string;
  /** Progress through a task (progressbar, the default), or a measure within a known range (meter). */
  readonly kind?: "progress" | "meter";
  readonly tone?: KitTone;
  readonly className?: string;
};

function gauge({ value, max = 100, valueText, kind = "progress", label, labelledBy }: GaugeProps) {
  const top = max > 0 ? max : 100;
  const now = clamp(Number.isFinite(value) ? value : 0, 0, top);
  return {
    percent: (100 * now) / top,
    aria: {
      role: kind === "meter" ? "meter" : "progressbar",
      "aria-label": label,
      "aria-labelledby": labelledBy,
      "aria-valuenow": Math.round(now * 100) / 100,
      "aria-valuemin": 0,
      "aria-valuemax": top,
      "aria-valuetext": valueText,
    } as const,
  };
}

/**
 * A progress ring. Its name and value are read out (progressbar or meter);
 * what is written inside it is for the eye, and hidden from screen readers so
 * the value is not read twice.
 */
export function Ring({
  size = 64,
  stroke = 6,
  children,
  ...props
}: GaugeProps & {
  readonly size?: number;
  readonly stroke?: number;
  /** Shown in the middle: the number, a word. */
  readonly children?: ReactNode;
}) {
  const { percent, aria } = gauge(props);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span {...aria} className={cx("kit-ring", `kit-tone-${props.tone ?? "pen"}`, props.className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle className="kit-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle
          className="kit-ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - percent / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ "--kit-c": c } as CSSProperties}
        />
      </svg>
      {children === undefined ? null : (
        <span className="kit-ring-in" aria-hidden="true">
          {children}
        </span>
      )}
    </span>
  );
}

/** A bar that fills to its value: progress (progressbar) or a measure (meter). */
export function Meter({ size, ...props }: GaugeProps & { readonly size?: "thin" | "thick" }) {
  const { percent, aria } = gauge(props);
  return (
    <div
      {...aria}
      className={cx("kit-meter", `kit-tone-${props.tone ?? "pen"}`, size !== undefined && `kit-meter-${size}`, props.className)}
      style={{ "--kit-m": `${percent}%` } as CSSProperties}
    />
  );
}

/* ---------------- screen states (DESIGN-SYSTEM §9) ---------------- */

type HeadingLevel = 2 | 3 | 4;

const Heading = ({ level, children }: { readonly level: HeadingLevel; readonly children: ReactNode }) => {
  const H = `h${level}` as const;
  return <H className="kit-state-title">{children}</H>;
};

/** Nothing here yet: what this place is for, and the one next step. */
export function Empty({
  title,
  body,
  action,
  icon,
  headingLevel = 2,
  className,
}: {
  readonly title: ReactNode;
  readonly body?: ReactNode;
  /** The one next step (the app's link or button). */
  readonly action?: ReactNode;
  /** A picture (the Diya); decorative, so hidden from screen readers. */
  readonly icon?: ReactNode;
  readonly headingLevel?: HeadingLevel;
  readonly className?: string;
}) {
  return (
    <div className={cx("kit-state", className)}>
      {icon === undefined ? null : (
        <span className="kit-state-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <Heading level={headingLevel}>{title}</Heading>
      {body === undefined ? null : <p className="kit-state-body">{body}</p>}
      {action === undefined ? null : <div className="kit-state-actions">{action}</div>}
    </div>
  );
}

/** One grey bar of a skeleton. */
export function Skel({ width = "100%", height = 14, radius }: { readonly width?: number | string; readonly height?: number; readonly radius?: number }) {
  return <span className="kit-skel" style={radius === undefined ? { width, height } : { width, height, borderRadius: radius }} />;
}

export type SkeletonShape = "list" | "cards" | "doc" | "workspace";

function SkeletonBody({ shape }: { readonly shape: SkeletonShape }) {
  if (shape === "workspace")
    return (
      <>
        <div className="kit-skel-pane">
          <Skel width="60%" height={22} />
          <Skel width="40%" height={12} />
          {[90, 96, 80, 70, 92].map((w) => (
            <Skel key={w} width={`${w}%`} height={12} />
          ))}
          <Skel height={90} radius={10} />
        </div>
        <div className="kit-skel-pane">
          {Array.from({ length: 12 }, (_, i) => (
            <Skel key={i} width={`${30 + ((i * 37) % 60)}%`} height={12} />
          ))}
        </div>
      </>
    );
  if (shape === "cards")
    return (
      <>
        <Skel width="40%" height={30} />
        <div className="kit-skel-cards">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="kit-skel-card">
              <Skel width="50%" height={14} />
              <Skel width="80%" height={28} />
              <Skel width="65%" height={12} />
            </div>
          ))}
        </div>
      </>
    );
  if (shape === "doc")
    return (
      <div className="kit-skel-doc">
        <Skel width="70%" height={30} />
        {[96, 92, 98, 60, 94, 90, 72].map((w) => (
          <Skel key={w} width={`${w}%`} height={13} />
        ))}
        <Skel height={120} radius={12} />
      </div>
    );
  return (
    <>
      <Skel width="35%" height={14} />
      <Skel width="55%" height={34} />
      <div className="kit-skel-rows">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="kit-skel-row">
            <Skel width={34} height={34} radius={10} />
            <span className="kit-skel-grow">
              <Skel width={`${50 + i * 7}%`} height={13} />
              <Skel width="30%" height={10} />
            </span>
            <Skel width={64} height={30} radius={8} />
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * Loading: grey bars in the shape of the page that is coming, and the words
 * "loading …" written out (and announced), never bars alone.
 */
export function Skeleton({
  label,
  shape = "list",
  children,
  className,
}: {
  /** Written above the bars and announced: what is loading, and that a slow connection takes a few seconds. */
  readonly label: ReactNode;
  readonly shape?: SkeletonShape;
  /** Bars of the app's own shape, in place of the standard one. */
  readonly children?: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={cx("kit-skeleton", `kit-skeleton-${shape}`, className)}>
      <p className="kit-skeleton-cap" role="status">
        {label}
      </p>
      <div className="kit-skeleton-body" aria-hidden="true">
        {children ?? <SkeletonBody shape={shape} />}
      </div>
    </div>
  );
}

/**
 * Something failed: what happened, that nothing of theirs is lost, a way to
 * try again, and a reference to quote. Announced as it appears.
 */
export function ErrorState({
  title,
  body,
  retryLabel,
  onRetry,
  retrying = false,
  secondary,
  reference,
  icon,
  headingLevel = 2,
  className,
}: {
  readonly title: ReactNode;
  /** What happened, and that their work is safe. */
  readonly body?: ReactNode;
  readonly retryLabel: string;
  readonly onRetry: () => void;
  /** While a retry is under way: the button waits. */
  readonly retrying?: boolean;
  /** Another way on: the status page, help. */
  readonly secondary?: ReactNode;
  /** A reference to quote to support, with the time. */
  readonly reference?: ReactNode;
  readonly icon?: ReactNode;
  readonly headingLevel?: HeadingLevel;
  readonly className?: string;
}) {
  return (
    <div className={cx("kit-state", "kit-error", className)} role="alert">
      {icon === undefined ? null : (
        <span className="kit-state-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <Heading level={headingLevel}>{title}</Heading>
      {body === undefined ? null : <p className="kit-state-body">{body}</p>}
      <div className="kit-state-actions">
        <button type="button" onClick={onRetry} disabled={retrying} aria-busy={retrying || undefined}>
          <Retry />
          {retryLabel}
        </button>
        {secondary}
      </div>
      {reference === undefined ? null : <span className="kit-state-ref">{reference}</span>}
    </div>
  );
}

/**
 * No network: a band above the page. Reading and writing go on (saved on the
 * device); submitting and Sahayak wait for the net.
 */
export function OfflineBanner({ title, children, className }: { readonly title: ReactNode; readonly children?: ReactNode; readonly className?: string }) {
  return (
    <div className={cx("kit-banner", "kit-offline", className)} role="status">
      <WifiOff />
      <span className="kit-banner-text">
        <b>{title}</b>
        {children === undefined ? null : <> {children}</>}
      </span>
    </div>
  );
}

/**
 * The first visit to a screen: three steps in one card, one action, and a
 * way to skip it. On top of the page (or floating at the bottom right).
 */
export function FirstTime({
  label,
  title,
  steps,
  action,
  skip,
  onClose,
  closeLabel = "Close",
  icon,
  floating = false,
  className,
}: {
  /** The card's accessible name ("First visit"). */
  readonly label: string;
  readonly title: ReactNode;
  readonly steps: readonly ReactNode[];
  /** The one thing to do (the app's link or button). */
  readonly action?: ReactNode;
  readonly skip?: { readonly label: string; readonly onSelect: () => void };
  readonly onClose?: () => void;
  readonly closeLabel?: string;
  readonly icon?: ReactNode;
  readonly floating?: boolean;
  readonly className?: string;
}) {
  return (
    <section className={cx("kit-first", floating && "kit-float", className)} aria-label={label}>
      {icon === undefined ? null : (
        <span className="kit-first-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="kit-first-main">
        <p className="kit-first-title">{title}</p>
        <ol className="kit-steps">
          {steps.map((step, index) => (
            <li key={index}>
              <span className="kit-step-n" aria-hidden="true">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {action === undefined && skip === undefined ? null : (
          <div className="kit-state-actions">
            {action}
            {skip === undefined ? null : (
              <button type="button" className="quiet" onClick={skip.onSelect}>
                {skip.label}
              </button>
            )}
          </div>
        )}
      </div>
      {onClose === undefined ? null : (
        <button type="button" className="kit-icon-btn kit-first-x" onClick={onClose} aria-label={closeLabel} title={closeLabel}>
          <Cross />
        </button>
      )}
    </section>
  );
}
