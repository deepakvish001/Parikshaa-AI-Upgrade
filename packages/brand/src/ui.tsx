import {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * The interactive pieces every screen shares, built once so each behaves the
 * same everywhere: a dialog (and its side-sheet form, the drawer), tabs,
 * a tooltip, toasts and the "⋯" menu. Styles are in `ui.css`.
 *
 * Each follows the WAI-ARIA Authoring Practices pattern of its name: a dialog
 * keeps focus inside it and gives it back on closing; tabs move with the
 * arrow keys; a tooltip describes its control, and shows on focus as well as
 * on hover; a toast is announced without taking focus.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type DialogVariant = "center" | "side" | "full" | "top";

export interface DialogProps {
  /** The dialog's accessible name. */
  readonly label: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  /** Centred (the default), a sheet from the right, all but the screen's edge, or a search box near the top. */
  readonly variant?: DialogVariant;
  readonly className?: string;
  /** Focus this on opening, rather than the dialog itself. */
  readonly initialFocus?: RefObject<HTMLElement | null>;
  /** Escape and a click outside close it; set false when closing would lose work. */
  readonly dismissable?: boolean;
}

/**
 * A modal dialog. Focus moves in when it opens, Tab cycles within it,
 * Escape or a click outside closes it, the page behind does not scroll, and
 * focus returns to whatever opened it.
 */
export function Dialog({ label, onClose, children, variant = "center", className, initialFocus, dismissable = true }: DialogProps) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (initialFocus?.current ?? box.current)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (opener?.isConnected === true) opener.focus();
    };
    // Once per opening: later renders must not steal focus back.
  }, []);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && dismissable) {
      event.stopPropagation();
      close.current();
      return;
    }
    if (event.key !== "Tab" || box.current === null) return;
    const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.closest("[hidden]") === null);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === box.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className={`ui-scrim ui-scrim-${variant}`} onMouseDown={(event) => dismissable && event.target === event.currentTarget && close.current()}>
      <div
        ref={box}
        className={`ui-dialog ui-dialog-${variant}${className === undefined ? "" : ` ${className}`}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}

/** A dialog that slides in from the right: for choosing from a list beside the page. */
export function Drawer(props: Omit<DialogProps, "variant">) {
  return <Dialog {...props} variant="side" />;
}

export interface TabItem<T extends string> {
  readonly id: T;
  readonly label: ReactNode;
}

/**
 * Tabs: the arrow keys move between them (Home and End to the ends), and
 * only the chosen one is in the Tab order. Pair with `TabPanel`s sharing
 * the same `idBase`.
 */
export function Tabs<T extends string>({
  label,
  idBase,
  items,
  value,
  onChange,
  className,
}: {
  label: string;
  idBase: string;
  items: readonly TabItem<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const move = (event: ReactKeyboardEvent, index: number) => {
    const to =
      event.key === "ArrowRight" ? (index + 1) % items.length
      : event.key === "ArrowLeft" ? (index - 1 + items.length) % items.length
      : event.key === "Home" ? 0
      : event.key === "End" ? items.length - 1
      : null;
    if (to === null) return;
    event.preventDefault();
    onChange(items[to]!.id);
    list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[to]?.focus();
  };
  return (
    <div ref={list} className={`tabs${className === undefined ? "" : ` ${className}`}`} role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={`${idBase}-tab-${item.id}`}
          aria-selected={value === item.id}
          aria-controls={`${idBase}-panel-${item.id}`}
          tabIndex={value === item.id ? 0 : -1}
          className={`tab${value === item.id ? " on" : ""}`}
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => move(event, index)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** A tab's panel. Hidden, not unmounted, when another tab is chosen, so what is typed in it stays. */
export function TabPanel<T extends string>({ idBase, id, value, children }: { idBase: string; id: T; value: T; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`${idBase}-panel-${id}`} aria-labelledby={`${idBase}-tab-${id}`} hidden={value !== id} tabIndex={0} className="ui-tabpanel">
      {children}
    </div>
  );
}

/**
 * A short description of a control, shown above it on hover and on keyboard
 * focus, and read as its description. For an icon-only button, give the
 * button its own accessible name too: a tooltip describes, it does not name.
 */
export function Tooltip({ text, children }: { text: string; children: ReactElement<Record<string, unknown>> }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!shown) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setShown(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown]);
  return (
    <span
      className="ui-tooltip-anchor"
      onMouseEnter={() => setShown(true)}
      onMouseLeave={() => setShown(false)}
      onFocus={() => setShown(true)}
      onBlur={() => setShown(false)}
    >
      {cloneElement(children, { "aria-describedby": id })}
      <span role="tooltip" id={id} className={`ui-tooltip${shown ? " shown" : ""}`}>
        {text}
      </span>
    </span>
  );
}

export interface MenuItem {
  readonly label: string;
  readonly icon?: ReactNode;
  readonly onSelect: () => void;
  /** Why it cannot be chosen now, shown under it. The item stays in the list, and is skipped by nothing. */
  readonly disabled?: string;
  /** Undoes or removes something: kept last, after a rule, in the danger colour. */
  readonly danger?: boolean;
}

const Ellipsis = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">
    <circle cx="5" cy="12" r="1.75" />
    <circle cx="12" cy="12" r="1.75" />
    <circle cx="19" cy="12" r="1.75" />
  </svg>
);

/**
 * A row's other actions behind "⋯" (the WAI-ARIA menu button). The arrow
 * keys move through it, Home and End go to the ends, Escape closes it and
 * gives focus back, Tab or a click elsewhere closes it. It is placed against
 * the viewport, so a table that scrolls sideways never clips it, and opens
 * upwards when there is no room below.
 */
export function Menu({ label, items, className }: { label: string; items: readonly MenuItem[]; className?: string }) {
  const id = useId();
  const [open, setOpen] = useState<false | "first" | "last">(false);
  const [place, setPlace] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  // Focus moves in once the list is placed: while it is still hidden, measuring, nothing in it can take focus.
  const toFocus = useRef<false | "first" | "last">(false);
  const ordered = [...items.filter((item) => item.danger !== true), ...items.filter((item) => item.danger === true)];

  const entries = () => [...(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    setPlace(null);
    if (refocus) button.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (open === false || button.current === null || list.current === null) return;
    const at = button.current.getBoundingClientRect();
    const height = list.current.offsetHeight;
    const right = Math.max(8, window.innerWidth - at.right);
    setPlace(at.bottom + 4 + height > window.innerHeight && at.top - 4 - height > 0 ? { bottom: window.innerHeight - at.top + 4, right } : { top: at.bottom + 4, right });
    toFocus.current = open;
  }, [open]);

  useLayoutEffect(() => {
    if (place === null || toFocus.current === false) return;
    const all = entries();
    // Without scrolling: the list is already placed beside its button, and a
    // scroll from the focus would read as the page moving, and close the menu
    // (WebKit scrolls on focus where Chromium does not).
    (toFocus.current === "last" ? all.at(-1) : all[0])?.focus({ preventScroll: true });
    toFocus.current = false;
  }, [place]);

  useEffect(() => {
    if (open === false) return;
    const away = (event: Event) => {
      if (!(event.target instanceof Node) || !wrap.current?.contains(event.target)) close(false);
    };
    const moved = (event: Event) => {
      if (!(event.target instanceof Node) || !list.current?.contains(event.target)) close(false);
    };
    document.addEventListener("pointerdown", away);
    window.addEventListener("scroll", moved, true);
    window.addEventListener("resize", moved);
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("scroll", moved, true);
      window.removeEventListener("resize", moved);
    };
  }, [open, close]);

  const onListKey = (event: ReactKeyboardEvent) => {
    const all = entries();
    const at = all.indexOf(document.activeElement as HTMLElement);
    const to =
      event.key === "ArrowDown" ? (at + 1) % all.length
      : event.key === "ArrowUp" ? (at - 1 + all.length) % all.length
      : event.key === "Home" ? 0
      : event.key === "End" ? all.length - 1
      : null;
    if (to !== null) {
      event.preventDefault();
      all[to]?.focus({ preventScroll: true });
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      close(false);
    }
  };

  return (
    <span ref={wrap} className={`ui-menu${className === undefined ? "" : ` ${className}`}`}>
      <button
        ref={button}
        type="button"
        className="ui-menu-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open !== false}
        aria-controls={open === false ? undefined : id}
        onClick={() => (open === false ? setOpen("first") : close(false))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(event.key === "ArrowUp" ? "last" : "first");
          }
        }}
      >
        <Ellipsis />
      </button>
      {open === false ? null : (
        <div
          ref={list}
          id={id}
          role="menu"
          aria-label={label}
          className="ui-menu-list"
          style={place === null ? { visibility: "hidden", top: 0, right: 0 } : place}
          onKeyDown={onListKey}
        >
          {ordered.map((item, index) => [
            item.danger === true && index > 0 && ordered[index - 1]!.danger !== true ? <div key="rule" role="separator" className="ui-menu-rule" /> : null,
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={`ui-menu-item${item.danger === true ? " destructive" : ""}`}
              aria-disabled={item.disabled === undefined ? undefined : true}
              onClick={() => {
                if (item.disabled !== undefined) return;
                close(true);
                item.onSelect();
              }}
            >
              {item.icon === undefined ? null : <span className="ui-menu-icon" aria-hidden="true">{item.icon}</span>}
              <span className="ui-menu-text">
                {item.label}
                {item.disabled === undefined ? null : <span className="ui-menu-reason">{item.disabled}</span>}
              </span>
            </button>,
          ])}
        </div>
      )}
    </span>
  );
}

export type ToastTone = "info" | "success" | "error";
interface Toast {
  readonly id: number;
  readonly message: string;
  readonly tone: ToastTone;
}

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => undefined);

/** Say something briefly — "Saved", "Copied" — without moving focus. Does nothing outside a `ToastProvider`. */
export const useToast = () => useContext(ToastContext);

/**
 * Where toasts appear: bottom right, announced politely, each gone after a
 * few seconds (errors stay until closed, so none is missed).
 */
export function ToastProvider({ children, lingerMs = 4000 }: { children: ReactNode; lingerMs?: number }) {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const next = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = next.current++;
      setToasts((all) => [...all.slice(-3), { id, message, tone }]);
      if (tone !== "error") window.setTimeout(() => dismiss(id), lingerMs);
    },
    [dismiss, lingerMs],
  );
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="ui-toasts" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((toast) => (
          <div key={toast.id} className={`ui-toast ${toast.tone}`}>
            <span>{toast.message}</span>
            <button type="button" className="ui-toast-close" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
