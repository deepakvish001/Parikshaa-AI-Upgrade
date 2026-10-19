import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  House,
  BookOpenText,
  Dumbbell,
  Building2,
  Hammer,
  BriefcaseBusiness,
  Search,
  Flame,
  Coins,
  Sun,
  Moon,
  Sparkles,
  Bell,
  LayoutGrid,
  CornerDownLeft,
  Menu,
  X,
  Languages,
  Check,
} from "lucide-react";
import { Link, navigate, useLang, useRoute, useT, useTheme, type Lang } from "../lib/core";
import { LogoMark } from "./kit";
import { SCREENS, SECTIONS, type ScreenDef } from "../screens/registry";
import { SahayakDock } from "./sahayak-dock";

export const SECTION_ICONS: Record<string, typeof House> = {
  aaj: House,
  seekho: BookOpenText,
  abhyas: Dumbbell,
  companies: Building2,
  banao: Hammer,
  career: BriefcaseBusiness,
};

export function LangSwitch() {
  const { lang, setLang } = useLang();
  const opts: [Lang, string][] = [
    ["en", "EN"],
    ["hg", "Hinglish"],
    ["hi", "हिं"],
  ];
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {opts.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={lang === v} onClick={() => setLang(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Compact language picker for the top bar. */
export function LangMenu() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);
  const opts: [Lang, string, string][] = [
    ["en", "English", "EN"],
    ["hg", "Hinglish", "HG"],
    ["hi", "हिंदी", "हिं"],
  ];
  const cur = opts.find((o) => o[0] === lang)!;
  return (
    <div className="lang-menu hide-phone" ref={ref}>
      <button type="button" className="icon-btn bordered" style={{ width: "auto", padding: "0 9px", gap: 6, display: "inline-flex", fontWeight: 800, fontSize: "var(--fs-12)" }} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Languages size={15} />
        {cur[2]}
      </button>
      {open && (
        <div className="popover" role="menu">
          {opts.map(([v, label]) => (
            <button key={v} type="button" role="menuitemradio" aria-checked={lang === v} className="menu-item" onClick={() => { setLang(v); setOpen(false); }}>
              {label}
              {lang === v && <Check size={14} className="tick" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ThemeButton() {
  const { theme, setTheme } = useTheme();
  const t = useT();
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label={t("Switch theme", "Theme badlo", "थीम बदलें")}
      title={t("Switch theme", "Theme badlo", "थीम बदलें")}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

export function TopBar({ onSearch, onSahayak }: { onSearch: () => void; onSahayak: () => void }) {
  const t = useT();
  const route = useRoute();
  const current = SCREENS.find((s) => s.id === route)?.section;
  return (
    <header className="topbar">
      <Link to="aaj" className="brand" aria-label="Parikshaa home">
        <LogoMark size={28} />
        <span>
          Parikshaa <small>Learn</small>
        </span>
      </Link>
      <nav className="topnav" aria-label={t("Main", "Main", "मुख्य")}>
        {SECTIONS.map((s) => {
          const Icon = SECTION_ICONS[s.id];
          return (
            <Link key={s.id} to={s.home} current={current === s.id}>
              <Icon size={16} />
              <span>{t(...s.name)}</span>
            </Link>
          );
        })}
      </nav>
      <div className="spacer" />
      <button type="button" className="search-btn" onClick={onSearch}>
        <Search size={15} />
        <span className="label">{t("Search problems, lessons…", "Problem, lesson dhoondho…", "प्रश्न, पाठ खोजें…")}</span>
        <kbd>Ctrl K</kbd>
      </button>
      <button type="button" className="icon-btn hide-phone sahayak-top" onClick={onSahayak} aria-label="Sahayak">
        <Sparkles size={18} />
      </button>
      <Link to="aaj" className="stat-chip streak" title={t("12-day streak", "12 din ki streak", "12 दिन की लगातार पढ़ाई")}>
        <Flame size={16} />
        <span className="num">12</span>
      </Link>
      <Link to="potd" className="stat-chip coins hide-phone" title={t("Coins", "Coins", "सिक्के")}>
        <Coins size={15} />
        <span className="num">1,240</span>
      </Link>
      <Link to="plus" className="plus-btn">
        Plus
      </Link>
      <LangMenu />
      <ThemeButton />
      <button type="button" className="icon-btn hide-phone" aria-label={t("Notifications", "Notifications", "सूचनाएँ")}>
        <Bell size={18} />
      </button>
      <Link to="profile" className="avatar" aria-label={t("Your profile", "Aapki profile", "आपकी प्रोफ़ाइल")}>
        AS
      </Link>
    </header>
  );
}

function SideNav({ screen }: { screen: ScreenDef }) {
  const t = useT();
  const section = SECTIONS.find((s) => s.id === screen.section);
  if (!section) return null;
  const items = SCREENS.filter((s) => s.section === section.id && s.layout === "shell" && !s.hidden);
  return (
    <nav className="sidenav" aria-label={t(...section.name)}>
      <h2>{t(...section.name)}</h2>
      <div className="group">
        {items.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.id} to={s.id} className="side-link" current={s.id === screen.id || s.id === screen.parent}>
              <Icon size={17} />
              {t(...s.title)}
              {s.badge && <span className="count">{s.badge}</span>}
            </Link>
          );
        })}
      </div>
      <div className="group">
        <span className="eyebrow">{t("Mine", "Mera", "मेरा")}</span>
        {SCREENS.filter((s) => s.section === "mera" && !s.hidden).map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.id} to={s.id} className="side-link" current={s.id === screen.id}>
              <Icon size={17} />
              {t(...s.title)}
            </Link>
          );
        })}
      </div>
      <div className="side-foot">
        <SideFoot />
      </div>
    </nav>
  );
}

function SideFoot() {
  const t = useT();
  return (
    <Link to="plan" className="side-goal">
      <div className="row between">
        <span className="eyebrow">{t("This week", "Is hafte", "इस हफ़्ते")}</span>
        <span className="tag action">Sprint 3</span>
      </div>
      <b>{t("Linked lists, stacks & queues", "Linked lists, stacks aur queues", "लिंक्ड लिस्ट, स्टैक और क्यू")}</b>
      <div className="week-dots" aria-label="4 of 7 days done">
        {[1, 1, 0, 1, 1, 2, 0].map((d, i) => (
          <i key={i} className={d === 1 ? "done" : d === 2 ? "today" : ""} />
        ))}
      </div>
      <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
        {t("Day 6 of 7 · 2h 10m planned today", "Din 6/7 · aaj 2h 10m", "दिन 6/7 · आज 2 घंटे 10 मिनट")}
      </span>
    </Link>
  );
}

function SubnavStrip({ screen }: { screen: ScreenDef }) {
  const t = useT();
  const items = SCREENS.filter((s) => s.section === screen.section && s.layout === "shell" && !s.hidden);
  return (
    <nav className="subnav-strip" aria-label="Section">
      {items.map((s) => (
        <Link key={s.id} to={s.id} current={s.id === screen.id || s.id === screen.parent}>
          {t(...s.title)}
        </Link>
      ))}
    </nav>
  );
}

function BottomTabs({ screen, onSahayak, onMore }: { screen: ScreenDef; onSahayak: () => void; onMore: () => void }) {
  const t = useT();
  const tab = (to: string, Icon: typeof House, label: string, on: boolean) => (
    <Link to={to} current={on}>
      <Icon size={20} />
      {label}
    </Link>
  );
  return (
    <nav className="bottom-tabs" aria-label="Tabs">
      {tab("aaj", House, t("Today", "Aaj", "आज"), screen.section === "aaj")}
      {tab("seekho", BookOpenText, t("Learn", "Seekho", "सीखो"), screen.section === "seekho")}
      {tab("abhyas", Dumbbell, t("Practice", "Abhyas", "अभ्यास"), screen.section === "abhyas")}
      <a
        href="#sahayak"
        onClick={(e) => {
          e.preventDefault();
          onSahayak();
        }}
      >
        <Sparkles size={20} />
        Sahayak
      </a>
      <a
        href="#more"
        aria-current={["companies", "banao", "career", "mera"].includes(screen.section) ? "page" : undefined}
        onClick={(e) => {
          e.preventDefault();
          onMore();
        }}
      >
        <Menu size={20} />
        {t("More", "Aur", "और")}
      </a>
    </nav>
  );
}

function MoreSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()} style={{ alignItems: "end", padding: 0 }}>
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="row between" style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: "var(--fs-18)" }}>{t("Everything", "Sab kuch", "सब कुछ")}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close" type="button">
            <X size={18} />
          </button>
        </div>
        <div className="more-grid">
          {SECTIONS.filter((s) => !["aaj", "seekho", "abhyas"].includes(s.id)).map((s) => {
            const Icon = SECTION_ICONS[s.id];
            return (
              <Link key={s.id} to={s.home} className="more-tile" onClick={() => onClose()}>
                <Icon size={20} />
                {t(...s.name)}
              </Link>
            );
          })}
          {SCREENS.filter((s) => s.section === "mera" && !s.hidden).map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.id} to={s.id} className="more-tile" onClick={() => onClose()}>
                <Icon size={20} />
                {t(...s.title)}
              </Link>
            );
          })}
        </div>
        <div className="row between" style={{ marginTop: 14 }}>
          <LangSwitchVisible />
          <ThemeButton />
        </div>
      </div>
    </div>
  );
}
function LangSwitchVisible() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang-switch" style={{ display: "inline-flex" }}>
      {(["en", "hg", "hi"] as Lang[]).map((v) => (
        <button key={v} type="button" aria-pressed={lang === v} onClick={() => setLang(v)}>
          {v === "en" ? "EN" : v === "hg" ? "Hinglish" : "हिं"}
        </button>
      ))}
    </div>
  );
}

/* ---------------- command palette ---------------- */

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const extra = useMemo(
    () => [
      { id: "problem", label: "Pair with target sum", kind: t("Problem", "Problem", "प्रश्न") },
      { id: "editorial", label: "Two pointers: pair sum editorial", kind: t("Editorial", "Editorial", "हल") },
      { id: "lesson", label: "Speed, time and distance", kind: t("Lesson", "Lesson", "पाठ") },
      { id: "apt-set", label: "Successive percentage change", kind: t("Aptitude", "Aptitude", "एप्टीट्यूड") },
      { id: "company", label: "Nimbu Labs (sample company)", kind: t("Company", "Company", "कंपनी") },
    ],
    [t],
  );
  const items = useMemo(() => {
    const screens = SCREENS.filter((s) => !s.hidden).map((s) => ({ id: s.id, label: t(...s.title), kind: t(...(SECTIONS.find((x) => x.id === s.section)?.name ?? ["Mock", "Mock", "मॉक"])) }));
    const all = [...extra, ...screens];
    const n = q.trim().toLowerCase();
    return n === "" ? all : all.filter((i) => i.label.toLowerCase().includes(n) || i.kind.toLowerCase().includes(n));
  }, [q, t, extra]);
  useEffect(() => setSel(0), [q]);
  const go = (id: string) => {
    onClose();
    navigate(id);
  };
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSel((s) => Math.min(items.length - 1, s + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSel((s) => Math.max(0, s - 1));
          } else if (e.key === "Enter" && items[sel]) go(items[sel].id);
          else if (e.key === "Escape") onClose();
        }}
      >
        <div className="cmdk-input">
          <Search size={18} />
          <input
            ref={input}
            id="cmdk-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Search screens, problems, lessons…", "Screen, problem, lesson dhoondho…", "स्क्रीन, प्रश्न, पाठ खोजें…")}
            aria-label="Search"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="cmdk-list" role="listbox">
          {items.length === 0 && (
            <div style={{ padding: 20 }} className="muted">
              {t("Nothing found. Ask Sahayak instead?", "Kuch nahi mila. Sahayak se poochho?", "कुछ नहीं मिला। सहायक से पूछें?")}
            </div>
          )}
          {items.map((i, idx) => (
            <button
              key={`${i.id}-${i.label}`}
              type="button"
              role="option"
              aria-selected={idx === sel}
              className="cmdk-item"
              onMouseEnter={() => setSel(idx)}
              onClick={() => go(i.id)}
            >
              <LayoutGrid size={15} />
              {i.label}
              <small>{i.kind}</small>
              {idx === sel && <CornerDownLeft size={14} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- shell ---------------- */

export function Shell({ screen, children, rail }: { screen: ScreenDef; children: ReactNode; rail?: ReactNode }) {
  const [search, setSearch] = useState(false);
  const [dock, setDock] = useState(false);
  const [more, setMore] = useState(false);
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
  const cls = screen.layout === "shell" ? (rail ? "body with-rail" : "body") : "body no-side";
  return (
    <div className="app">
      <TopBar onSearch={() => setSearch(true)} onSahayak={() => setDock(true)} />
      <div className={cls}>
        {screen.layout === "shell" && <SideNav screen={screen} />}
        <main className="main" id="main">
          {screen.layout === "shell" && <SubnavStrip screen={screen} />}
          <div className="screen-enter" key={screen.id}>
            {children}
          </div>
        </main>
        {rail && <aside className="rail">{rail}</aside>}
      </div>
      <BottomTabs screen={screen} onSahayak={() => setDock(true)} onMore={() => setMore(true)} />
      {search && <CommandPalette onClose={() => setSearch(false)} />}
      {dock && <SahayakDock onClose={() => setDock(false)} />}
      {more && <MoreSheet onClose={() => setMore(false)} />}
    </div>
  );
}

export function PageHead({
  title,
  sub,
  crumbs,
  actions,
}: {
  title: ReactNode;
  sub?: ReactNode;
  crumbs?: { to?: string; label: string }[];
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div style={{ minWidth: 0 }}>
        {crumbs && (
          <div className="crumbs">
            {crumbs.map((c, i) => (
              <span key={i} className="row" style={{ gap: 6 }}>
                {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
                {i < crumbs.length - 1 && <span aria-hidden="true">/</span>}
              </span>
            ))}
          </div>
        )}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  );
}
