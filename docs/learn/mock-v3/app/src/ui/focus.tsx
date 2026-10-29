import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronsLeftRight, Keyboard, Moon, MoreHorizontal, Sun } from "lucide-react";
import { Link, useLang, useT, useTheme, type Lang } from "../lib/core";
import { LogoMark, Menu } from "./kit";

/* ---------------- focus top bar ---------------- */

export function FocusBar({
  back,
  title,
  sub,
  center,
  right,
  more,
}: {
  back: string;
  title: ReactNode;
  sub?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  /** Page actions that are useful but not needed every minute; they sit in the ⋯ menu above language and theme. */
  more?: (close: () => void) => ReactNode;
}) {
  const t = useT();
  return (
    <header className="fbar">
      <div className="fbar-l">
        <Link to={back} className="icon-btn" aria-label={t("Back", "Wapas", "वापस")}>
          <ArrowLeft />
        </Link>
        <Link to="aaj" aria-label="Parikshaa" className="hide-phone" style={{ display: "inline-flex" }}>
          <LogoMark size={26} />
        </Link>
        <div className="fbar-title">
          <b className="ellipsis">{title}</b>
          {sub && <span className="tiny faint ellipsis">{sub}</span>}
        </div>
      </div>
      {center && <div className="fbar-c">{center}</div>}
      <div className="fbar-r">
        {right}
        <MoreMenu more={more} />
      </div>
    </header>
  );
}

const LANGS: [Lang, string][] = [
  ["en", "English"],
  ["hg", "Hinglish"],
  ["hi", "हिंदी"],
];

/** One ⋯ menu instead of a row of small icons: page actions, then language, theme and the shortcut list. */
function MoreMenu({ more }: { more?: (close: () => void) => ReactNode }) {
  const t = useT();
  const { lang, setLang } = useLang();
  const { theme, setTheme } = useTheme();
  return (
    <Menu
      width={236}
      trigger={(open, toggle) => (
        <button className="icon-btn" onClick={toggle} aria-label={t("More", "Aur", "और")} aria-expanded={open} data-tip={t("More", "Aur", "और")} data-tip-pos="bottom">
          <MoreHorizontal />
        </button>
      )}
    >
      {(close) => (
        <>
          {more && (
            <>
              {more(close)}
              <div className="menu-sep" />
            </>
          )}
          <div className="menu-label">{t("Language", "Bhasha", "भाषा")}</div>
          {LANGS.map(([id, name]) => (
            <button key={id} className="menu-item" role="menuitemradio" aria-checked={lang === id} onClick={() => setLang(id)}>
              <span className="grow">{name}</span>
              {lang === id && <Check />}
            </button>
          ))}
          <div className="menu-sep" />
          <button className="menu-item" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun /> : <Moon />}
            <span className="grow">{theme === "dark" ? t("Paper (light)", "Kaagaz (light)", "काग़ज़ (लाइट)") : t("Black (dark)", "Kaala (dark)", "काला (डार्क)")}</span>
          </button>
          <button
            className="menu-item"
            onClick={() => {
              close();
              window.dispatchEvent(new Event("pk-keys"));
            }}
          >
            <Keyboard />
            <span className="grow">{t("Keyboard shortcuts", "Shortcuts", "शॉर्टकट")}</span>
            <kbd className="kbd">?</kbd>
          </button>
        </>
      )}
    </Menu>
  );
}

/** Group of toggles that show or hide each pane. */
export function PaneToggles({
  panes,
  open,
  toggle,
}: {
  panes: { id: string; label: string; icon: ReactNode; tone?: "ai" }[];
  open: Record<string, boolean>;
  toggle: (id: string) => void;
}) {
  return (
    <div className="pane-toggles" role="group" aria-label="Panes">
      {panes.map((p) => (
        <button key={p.id} aria-pressed={open[p.id]} className={p.tone === "ai" ? "ai" : undefined} onClick={() => toggle(p.id)} aria-label={p.label} data-tip={p.label} data-tip-pos="bottom">
          {p.icon}
          <span className="hide-narrow">{p.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------------- resizable, closable panes ---------------- */

export function useMedia(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setM(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [q]);
  return m;
}

export type PaneDef = { id: string; label: string; icon: ReactNode; content: ReactNode; weight: number; min?: number; tone?: "ai"; /** show a thin rail to reopen it when closed (default true) */ rail?: boolean };

/** Keeps which panes are open; at least one stays open. */
export function usePanes(initial: Record<string, boolean>) {
  const [open, setOpen] = useState(initial);
  const toggle = useCallback(
    (id: string) =>
      setOpen((o) => {
        const next = { ...o, [id]: !o[id] };
        return Object.values(next).some(Boolean) ? next : o;
      }),
    [],
  );
  const show = useCallback((id: string, v = true) => setOpen((o) => ({ ...o, [id]: v })), []);
  return { open, toggle, show, setOpen };
}

export function Panes({
  panes,
  open,
  toggle,
  phoneTab,
  setPhoneTab,
}: {
  panes: PaneDef[];
  open: Record<string, boolean>;
  toggle: (id: string) => void;
  phoneTab: string;
  setPhoneTab: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState<Record<string, number>>(() => Object.fromEntries(panes.map((p) => [p.id, p.weight])));
  const drag = useRef<{ a: string; b: string; x: number; wa: number; wb: number; total: number; width: number } | null>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dw = ((e.clientX - d.x) / d.width) * d.total;
      const min = d.total * 0.14;
      const wa = Math.max(min, Math.min(d.wa + d.wb - min, d.wa + dw));
      setW((cur) => ({ ...cur, [d.a]: wa, [d.b]: d.wa + d.wb - wa }));
    };
    const up = () => {
      drag.current = null;
      document.body.classList.remove("resizing");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  const openIds = panes.filter((p) => open[p.id]).map((p) => p.id);
  const total = openIds.reduce((a, id) => a + w[id], 0);
  const phone = useMedia("(max-width: 860px)");

  if (phone) {
    const cur = panes.find((p) => p.id === phoneTab) ?? panes[0];
    return (
      <div className="panes is-phone">
        <div className="pane-tabs" role="tablist">
          {panes.map((p) => (
            <button key={p.id} role="tab" aria-selected={cur.id === p.id} className={p.tone === "ai" ? "ai" : undefined} onClick={() => setPhoneTab(p.id)}>
              {p.icon}
              {p.label}
            </button>
          ))}
        </div>
        <section className={`pane ${cur.tone === "ai" ? "pane-ai" : ""}`} aria-label={cur.label}>
          {cur.content}
        </section>
      </div>
    );
  }

  // Every pane stays mounted; opening or closing animates its share of the width, so the others make room
  // (or take the space back) smoothly instead of jumping.
  return (
    <div className="panes" ref={box}>
      {panes.map((p, i) => {
        const isOpen = !!open[p.id];
        const nextOpen = openIds[openIds.indexOf(p.id) + 1];
        const showRail = !isOpen && p.rail !== false;
        return (
          <div key={p.id} style={{ display: "contents" }}>
            <section
              className={`pane ${p.tone === "ai" ? "pane-ai" : ""} ${isOpen ? "" : "is-closed"}`}
              style={{ flexGrow: isOpen ? Math.round((w[p.id] / total) * 1000) : 0, minWidth: isOpen ? (p.min ?? 260) : 0 }}
              aria-label={p.label}
              aria-hidden={!isOpen}
              inert={!isOpen}
            >
              <div className="pane-in" style={{ minWidth: p.min ?? 260 }}>
                {p.content}
              </div>
            </section>
            {showRail && (
              <button className={`pane-rail ${p.tone === "ai" ? "ai" : ""}`} onClick={() => toggle(p.id)} aria-label={`Show ${p.label}`} data-tip={p.label}>
                {p.icon}
                <span>{p.label}</span>
              </button>
            )}
            {i < panes.length - 1 && (
              <div
                className={`pane-div ${isOpen && nextOpen ? "" : "off"}`}
                role="separator"
                aria-orientation="vertical"
                aria-hidden={!(isOpen && nextOpen)}
                onPointerDown={(e) => {
                  if (!isOpen || !nextOpen) return;
                  drag.current = { a: p.id, b: nextOpen, x: e.clientX, wa: w[p.id], wb: w[nextOpen], total, width: box.current?.clientWidth ?? 1000 };
                  document.body.classList.add("resizing");
                }}
              >
                <ChevronsLeftRight />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Pane header: title, extra controls and a close button. */
export function PaneHead({ children, onClose, closeLabel }: { children: ReactNode; onClose?: () => void; closeLabel?: string }) {
  return (
    <div className="pane-h">
      {children}
      {onClose && (
        <button className="icon-btn sm pane-x" onClick={onClose} data-tip={closeLabel ?? "Hide"} data-tip-pos="bottom" aria-label={closeLabel ?? "Hide"}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
