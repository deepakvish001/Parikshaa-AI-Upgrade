import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Search,
  Sparkles,
  Bell,
  Sun,
  Moon,
  Languages,
  Flame,
  Coins,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Crown,
  LogOut,
  Settings,
  UserRound,
  House,
  Library,
  Target,
  Menu as MenuIcon,
  ArrowRight,
  Check,
  CornerDownLeft,
  LayoutGrid,
} from "lucide-react";
import { Link, navigate, useLang, useT, useTheme, type Lang } from "../lib/core";
import { useAi, useSide } from "../lib/state";
import { SCREENS, LEARN_GROUPS, byId, type ScreenDef } from "../screens/registry";
import { Logo, LogoMark, Avatar, Kbd, Menu, useOutside } from "./kit";
import { SahayakPanel } from "./sahayak";

export function useTri() {
  const { lang } = useLang();
  return (x: [string, string, string]) => (lang === "en" ? x[0] : lang === "hg" ? x[1] : x[2]);
}

/* ---------------- small top-bar controls ---------------- */

export function ThemeButton() {
  const { theme, setTheme } = useTheme();
  const t = useT();
  return (
    <button
      className="icon-btn"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      data-tip={theme === "dark" ? t("Paper (light)", "Kaagaz (light)", "काग़ज़ (लाइट)") : t("Black (dark)", "Kaala (dark)", "काला (डार्क)")}
      data-tip-pos="bottom"
      aria-label="Theme"
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </button>
  );
}

const LANGS: { id: Lang; label: string; native: string }[] = [
  { id: "en", label: "English", native: "English" },
  { id: "hg", label: "Hinglish", native: "Hinglish" },
  { id: "hi", label: "Hindi", native: "हिंदी" },
];
export function LangButton({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <Menu
      width={180}
      trigger={(_, toggle) => (
        <button className={compact ? "icon-btn" : "btn ghost sm"} onClick={toggle} aria-label="Language">
          <Languages />
          {!compact && <span>{lang === "en" ? "EN" : lang === "hg" ? "HG" : "हि"}</span>}
        </button>
      )}
    >
      {(close) =>
        LANGS.map((l) => (
          <button
            key={l.id}
            className="menu-item"
            onClick={() => {
              setLang(l.id);
              close();
            }}
          >
            <span className="grow">{l.native}</span>
            {lang === l.id && <Check />}
          </button>
        ))
      }
    </Menu>
  );
}

/* ---------------- command palette ---------------- */

export function CommandPalette({ open, onClose, admin }: { open: boolean; onClose: () => void; admin?: boolean }) {
  const t = useT();
  const tri = useTri();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, onClose, open);
  const items = useMemo(() => {
    const list = SCREENS.filter((s) => (admin ? s.layout.startsWith("admin") : !s.layout.startsWith("admin")));
    const ql = q.toLowerCase();
    return list.filter((s) => !ql || tri(s.title).toLowerCase().includes(ql) || s.id.includes(ql) || tri(s.desc).toLowerCase().includes(ql)).slice(0, 9);
  }, [q, admin, tri]);
  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    if (open) setQ("");
  }, [open]);
  if (!open) return null;
  const go = (s: ScreenDef) => {
    navigate(s.id);
    onClose();
  };
  return (
    <div className="scrim cmd-scrim">
      <div className="cmd" ref={ref} role="dialog" aria-label="Search">
        <div className="cmd-in">
          <Search />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={admin ? t("Search learners, problems, pages…", "Learners, problems, pages khojo…", "खोजें…") : t("Search problems, lessons, pages…", "Problems, lessons, pages khojo…", "प्रश्न, पाठ, पेज खोजें…")}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setSel((x) => Math.min(items.length - 1, x + 1));
              if (e.key === "ArrowUp") setSel((x) => Math.max(0, x - 1));
              if (e.key === "Enter" && items[sel]) go(items[sel]);
              if (e.key === "Escape") onClose();
            }}
          />
          <Kbd>Esc</Kbd>
        </div>
        <div className="cmd-list">
          <div className="eyebrow" style={{ padding: "8px 12px 4px" }}>
            {t("Go to", "Jaao", "जाएँ")}
          </div>
          {items.map((s, i) => {
            const I = s.icon;
            return (
              <button key={s.id} className="cmd-item" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => go(s)}>
                <span className="cmd-ic">
                  <I />
                </span>
                <span className="grow ellipsis">
                  <b>{tri(s.title)}</b>
                  <span className="faint"> · {tri(s.desc)}</span>
                </span>
                {i === sel && <CornerDownLeft className="faint" />}
              </button>
            );
          })}
          {items.length === 0 && <div className="muted small" style={{ padding: 16 }}>{t("Nothing found", "Kuch nahi mila", "कुछ नहीं मिला")}</div>}
        </div>
      </div>
    </div>
  );
}

export function useCmdK() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return [open, setOpen] as const;
}

/* ---------------- learner sidebar ---------------- */

function activeNav(route: string): string {
  let s = byId(route);
  while (s && !s.nav && s.parent) s = byId(s.parent);
  return s?.id ?? route;
}

function SideNav({ route, onSearch }: { route: string; onSearch: () => void }) {
  const t = useT();
  const tri = useTri();
  const { mini, setMini } = useSide();
  const ai = useAi();
  const active = activeNav(route);
  return (
    <aside className={`side ${mini ? "mini" : ""}`} aria-label="Main">
      <div className="side-top">
        <Link to="aaj" className="side-logo" aria-label="Parikshaa home">
          {mini ? <LogoMark size={28} /> : <Logo size={28} />}
        </Link>
        {!mini && (
          <button className="icon-btn sm" onClick={() => setMini(true)} data-tip={t("Collapse (Ctrl \\)", "Chhota (Ctrl \\)", "छोटा (Ctrl \\)")} data-tip-pos="bottom">
            <PanelLeftClose />
          </button>
        )}
      </div>
      {mini && (
        <button className="side-item" onClick={() => setMini(false)} data-tip={t("Expand", "Bada karo", "बड़ा करें")}>
          <PanelLeftOpen />
        </button>
      )}
      <button className="side-search" onClick={onSearch}>
        <Search />
        {!mini && (
          <>
            <span className="grow">{t("Search", "Khojo", "खोजें")}</span>
            <Kbd>Ctrl K</Kbd>
          </>
        )}
      </button>
      <nav className="side-nav">
        {LEARN_GROUPS.map((g) => {
          const items = SCREENS.filter((s) => s.group === g.id && s.nav);
          return (
            <div className="side-group" key={g.id}>
              {g.name[0] && !mini && <div className="side-label">{tri(g.name)}</div>}
              {g.name[0] && mini && <div className="side-rule" />}
              {items.map((s) => {
                const I = s.icon;
                return (
                  <Link key={s.id} to={s.id} className="side-item" current={active === s.id} data-tip={mini ? tri(s.title) : undefined}>
                    <I />
                    {!mini && <span className="grow ellipsis">{tri(s.title)}</span>}
                    {!mini && s.badge && <span className="side-count">{s.badge}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="side-foot">
        <button className={`side-ai ${ai.open ? "on" : ""}`} onClick={ai.toggle}>
          <Sparkles />
          {!mini && (
            <>
              <span className="grow">{t("Ask Sahayak", "Sahayak se poochho", "सहायक से पूछें")}</span>
              <Kbd>Ctrl J</Kbd>
            </>
          )}
        </button>
        {!mini && (
          <Link to="plus" className="side-plus">
            <Crown />
            <span className="grow">
              <b>{t("Try Plus", "Plus try karo", "प्लस आज़माएँ")}</b>
              <span className="tiny faint">{t("Unlimited Sahayak, mocks", "Zyada Sahayak, mocks", "असीमित सहायक")}</span>
            </span>
            <ChevronRight />
          </Link>
        )}
        <UserMenu mini={mini} />
      </div>
    </aside>
  );
}

function UserMenu({ mini }: { mini: boolean }) {
  const t = useT();
  return (
    <Menu
      align="left"
      up
      width={220}
      trigger={(_, toggle) => (
        <button className="side-user" onClick={toggle}>
          <Avatar name="Aarav Sharma" size={30} tone={0} />
          {!mini && (
            <span className="grow" style={{ minWidth: 0, textAlign: "left" }}>
              <b className="ellipsis" style={{ display: "block" }}>
                Aarav Sharma
              </b>
              <span className="tiny faint">{t("3rd year · Free", "3rd year · Free", "तीसरा वर्ष · फ़्री")}</span>
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div>
          <Link to="profile" className="menu-item" onClick={close}>
            <UserRound /> {t("Profile", "Profile", "प्रोफ़ाइल")}
          </Link>
          <Link to="settings" className="menu-item" onClick={close}>
            <Settings /> {t("Settings", "Settings", "सेटिंग्स")}
          </Link>
          <Link to="plus" className="menu-item" onClick={close}>
            <Crown /> Plus
          </Link>
          <div className="menu-sep" />
          <Link to="landing" className="menu-item dang" onClick={close}>
            <LogOut /> {t("Sign out", "Sign out", "साइन आउट")}
          </Link>
        </div>
      )}
    </Menu>
  );
}

/* ---------------- top bar ---------------- */

function Crumbs({ route }: { route: string }) {
  const tri = useTri();
  const chain: ScreenDef[] = [];
  let s = byId(route);
  while (s) {
    chain.unshift(s);
    s = s.parent ? byId(s.parent) : undefined;
  }
  const g = LEARN_GROUPS.find((x) => x.id === chain[0]?.group);
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {g?.name[0] && <span className="faint">{tri(g.name)}</span>}
      {chain.map((c, i) => (
        <span key={c.id} className="row g6" style={{ minWidth: 0 }}>
          {(i > 0 || g?.name[0]) && <ChevronRight className="crumb-sep" />}
          {i < chain.length - 1 ? (
            <Link to={c.id} className="crumb-link">
              {tri(c.title)}
            </Link>
          ) : (
            <span className="crumb-now ellipsis">{tri(c.title)}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function TopBar({ route, onMenu }: { route: string; onMenu: () => void }) {
  const t = useT();
  const ai = useAi();
  return (
    <header className="topbar">
      <button className="icon-btn only-phone" onClick={onMenu} aria-label="Menu">
        <MenuIcon />
      </button>
      <span className="only-phone">
        <LogoMark size={26} />
      </span>
      <Crumbs route={route} />
      <div className="grow" />
      <Link to="potd" className="stat-chip coin" data-tip={t("12-day streak", "12 din ki streak", "12 दिन की लगातार")} data-tip-pos="bottom">
        <Flame />
        <span className="num">12</span>
      </Link>
      <span className="stat-chip hide-phone" data-tip={t("Coins", "Coins", "सिक्के")} data-tip-pos="bottom">
        <Coins />
        <span className="num">340</span>
      </span>
      <span className="hide-phone">
        <LangButton compact />
      </span>
      <span className="hide-phone">
        <ThemeButton />
      </span>
      <button className="icon-btn" aria-label="Notifications" data-tip={t("Notifications", "Notifications", "सूचनाएँ")} data-tip-pos="bottom">
        <Bell />
        <span className="dot-badge" />
      </button>
      <button className={`btn sm ai-btn ${ai.open ? "on" : ""}`} onClick={ai.toggle}>
        <Sparkles />
        <span className="hide-phone">Sahayak</span>
      </button>
    </header>
  );
}

/* ---------------- right Sahayak pane (push, not overlay) ---------------- */

function AiPane() {
  const ai = useAi();
  const drag = useRef<{ x: number; w: number } | null>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      ai.setWidth(drag.current.w + (drag.current.x - e.clientX));
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
  }, [ai]);
  if (!ai.open) return null;
  return (
    <aside className="ai-pane" style={{ width: ai.width }} aria-label="Sahayak">
      <div
        className="pane-grip"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, w: ai.width };
          document.body.classList.add("resizing");
        }}
        role="separator"
        aria-orientation="vertical"
      />
      <SahayakPanel onClose={() => ai.setOpen(false)} context="general" />
    </aside>
  );
}

/* ---------------- phone navigation ---------------- */

function BottomTabs({ route, onMore }: { route: string; onMore: () => void }) {
  const t = useT();
  const ai = useAi();
  const a = activeNav(route);
  const learn = ["courses", "roadmap"].includes(a);
  const practice = ["practice", "sheet", "sql", "aptitude", "potd", "contests"].includes(a);
  return (
    <nav className="bottom-tabs" aria-label="Main">
      <Link to="aaj" current={a === "aaj"}>
        <House />
        <span>{t("Today", "Aaj", "आज")}</span>
      </Link>
      <Link to="courses" current={learn}>
        <Library />
        <span>{t("Learn", "Seekho", "सीखो")}</span>
      </Link>
      <Link to="practice" current={practice}>
        <Target />
        <span>{t("Practice", "Abhyas", "अभ्यास")}</span>
      </Link>
      <button onClick={ai.toggle} aria-pressed={ai.open}>
        <Sparkles />
        <span>Sahayak</span>
      </button>
      <button onClick={onMore}>
        <LayoutGrid />
        <span>{t("More", "Aur", "और")}</span>
      </button>
    </nav>
  );
}

function MoreSheet({ open, onClose, route }: { open: boolean; onClose: () => void; route: string }) {
  const tri = useTri();
  const t = useT();
  if (!open) return null;
  return (
    <div className="scrim sheet-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-grab" />
        <div className="row between" style={{ padding: "0 4px 8px" }}>
          <Logo size={24} />
          <div className="row g4">
            <LangButton compact />
            <ThemeButton />
          </div>
        </div>
        {LEARN_GROUPS.map((g) => (
          <div key={g.id} className="sheet-group">
            {g.name[0] && <div className="side-label">{tri(g.name)}</div>}
            <div className="sheet-grid">
              {SCREENS.filter((s) => s.group === g.id && s.nav).map((s) => {
                const I = s.icon;
                return (
                  <Link key={s.id} to={s.id} className="sheet-item" current={activeNav(route) === s.id} onClick={onClose}>
                    <I />
                    <span>{tri(s.title)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        <Link to="settings" className="btn block mt12" onClick={onClose}>
          <Settings />
          {t("Settings", "Settings", "सेटिंग्स")}
        </Link>
      </div>
    </div>
  );
}

/* ---------------- the shell ---------------- */

export function Shell({ route, children, rail }: { route: string; children: ReactNode; rail?: ReactNode }) {
  const { mini } = useSide();
  const ai = useAi();
  const [cmd, setCmd] = useCmdK();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [route]);
  return (
    <div className={`app ${mini ? "side-mini" : ""} ${ai.open ? "ai-open" : ""}`}>
      <SideNav route={route} onSearch={() => setCmd(true)} />
      <div className="main-col">
        <TopBar route={route} onMenu={() => setMore(true)} />
        <main className={`main ${rail ? "has-rail" : ""}`} id="main">
          <div className="main-in rise" key={route}>
            {children}
          </div>
          {rail && <aside className="rail rise">{rail}</aside>}
        </main>
      </div>
      <AiPane />
      <BottomTabs route={route} onMore={() => setMore(true)} />
      <MoreSheet open={more} onClose={() => setMore(false)} route={route} />
      <CommandPalette open={cmd} onClose={() => setCmd(false)} />
    </div>
  );
}

/** Simple right arrow link used across pages. */
export function GoLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="link">
      {children}
      <ArrowRight />
    </Link>
  );
}
