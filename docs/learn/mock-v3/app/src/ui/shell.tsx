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
  Trophy,
  MessageSquare,
  Building2,
  RotateCcw,
  BadgeCheck,
  CheckCheck,
  Keyboard,
} from "lucide-react";
import { Link, navigate, useLang, useT, useTheme, type Lang } from "../lib/core";
import { useAi, useSide } from "../lib/state";
import { SCREENS, LEARN_GROUPS, byId, type ScreenDef } from "../screens/registry";
import { Logo, LogoMark, Avatar, Kbd, Menu, useOutside, usePresence, Drawer, Modal, Tabs } from "./kit";
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
          <button className="icon-btn sm" onClick={() => setMini(true)} aria-label={t("Collapse (Ctrl \\)", "Chhota (Ctrl \\)", "छोटा (Ctrl \\)")} data-tip={t("Collapse (Ctrl \\)", "Chhota (Ctrl \\)", "छोटा (Ctrl \\)")} data-tip-pos="bottom">
            <PanelLeftClose />
          </button>
        )}
      </div>
      {mini && (
        <button className="side-item" onClick={() => setMini(false)} aria-label={t("Expand", "Bada karo", "बड़ा करें")} data-tip={t("Expand", "Bada karo", "बड़ा करें")}>
          <PanelLeftOpen />
        </button>
      )}
      <button className="side-search" onClick={onSearch} aria-label={t("Search", "Search", "खोजें")}>
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
                  <Link key={s.id} to={s.id} className="side-item" current={active === s.id} aria-label={`${tri(s.title)}${s.badge ? ` (${s.badge})` : ""}`} data-tip={mini ? tri(s.title) : undefined}>
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
        <button className={`side-ai ${ai.open ? "on" : ""}`} onClick={ai.toggle} aria-label={t("Ask Sahayak", "Sahayak kholo", "सहायक खोलें")}>
          <Sparkles />
          {!mini && (
            <>
              <span className="grow">{t("Ask Sahayak", "Sahayak kholo", "सहायक खोलें")}</span>
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
        <button className="side-user" onClick={toggle} aria-label={t("Aarav Sharma, account menu", "Aarav Sharma, account menu", "आरव शर्मा, खाता मेन्यू")}>
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

function TopBar({ route, onMenu, onBell, unread }: { route: string; onMenu: () => void; onBell: () => void; unread: number }) {
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
      <Link to="potd" className="stat-chip coin" aria-label={t("12-day streak", "12 din ki streak", "12 दिन की लगातार")} data-tip={t("12-day streak", "12 din ki streak", "12 दिन की लगातार")} data-tip-pos="bottom">
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
      <button className="icon-btn" aria-label={`Notifications, ${unread} new`} onClick={onBell} data-tip={t("Notifications", "Notifications", "सूचनाएँ")} data-tip-pos="bottom">
        <Bell />
        {unread > 0 && <span className="dot-badge" />}
      </button>
      <button className={`btn sm ai-btn ${ai.open ? "on" : ""}`} onClick={ai.toggle} aria-label="Sahayak" aria-expanded={ai.open}>
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
  const [shown, leaving] = usePresence(ai.open, 220);
  if (!shown) return null;
  return (
    <aside className={`ai-pane ${leaving ? "out" : ""}`} style={{ width: ai.width, ["--aw" as string]: `${ai.width}px` }} aria-label="Sahayak">
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

/* ---------------- notifications ---------------- */

type Note = { id: number; icon: ReactNode; tone: string; when: "today" | "week"; title: [string, string, string]; sub: [string, string, string]; ago: string; to: string; mine?: boolean };
const NOTES: Note[] = [
  { id: 1, icon: <Trophy />, tone: "coin", when: "today", title: ["Weekly contest 47 starts in 2 hours", "Weekly contest 47 do ghante me", "साप्ताहिक प्रतियोगिता 47 दो घंटे में"], sub: ["4 questions · 90 min · rated", "4 sawaal · 90 min · rated", "4 प्रश्न · 90 मिनट"], ago: "10 min", to: "contest-brief" },
  { id: 2, icon: <MessageSquare />, tone: "pen", when: "today", mine: true, title: ["Riya (mentor) answered your doubt on Two Sum", "Riya (mentor) ne Two Sum wale doubt ka jawab diya", "रिया ने आपके प्रश्न का उत्तर दिया"], sub: ["\u201cSort mat karo, hash map se O(n) ho jaayega…\u201d", "\u201cSort mat karo, hash map se O(n) ho jaayega…\u201d", "\u201cहैश मैप से O(n)…\u201d"], ago: "42 min", to: "community" },
  { id: 3, icon: <Flame />, tone: "coin", when: "today", title: ["Keep your 12-day streak: one problem left today", "12 din ki streak bachao: aaj ek problem baaki", "12 दिन की लगातार: आज एक प्रश्न बाकी"], sub: ["Today's problem takes about 15 min", "Aaj ka problem ~15 min ka", "लगभग 15 मिनट"], ago: "2 hr", to: "potd" },
  { id: 4, icon: <Building2 />, tone: "tick", when: "week", mine: true, title: ["Nimbu Labs drive: you meet the cut-off", "Nimbu Labs drive: aap eligible ho", "निम्बू लैब्स: आप योग्य हैं"], sub: ["Apply by 8 Nov · OA → 2 tech → HR", "8 Nov tak apply · OA → 2 tech → HR", "8 नवंबर तक"], ago: "Mon", to: "company" },
  { id: 5, icon: <Sparkles />, tone: "ai", when: "week", title: ["Sahayak's week: 3 topics to revise", "Sahayak ka hafta: 3 topic dohrao", "सहायक: 3 विषय दोहराएँ"], sub: ["Sliding window, joins, probability", "Sliding window, joins, probability", "स्लाइडिंग विंडो, जॉइन, प्रायिकता"], ago: "Sun", to: "revision" },
  { id: 6, icon: <RotateCcw />, tone: "", when: "week", title: ["Missed Thursday moved to Sunday", "Chhoota guruvaar ab ravivaar ko", "गुरुवार का काम रविवार को"], sub: ["Your plan still ends on 30 Nov", "Plan ab bhi 30 Nov ko poora", "योजना 30 नवंबर को पूरी"], ago: "Fri", to: "plan" },
  { id: 7, icon: <BadgeCheck />, tone: "tick", when: "week", title: ["Your Pramaan DSA L2 certificate is ready", "Pramaan DSA L2 certificate taiyaar", "प्रमाण DSA L2 तैयार"], sub: ["Share it or add it to your profile", "Share karo ya profile me jodo", "साझा करें"], ago: "Thu", to: "certificate" },
];

function NotifDrawer({ open, onClose, read, setRead }: { open: boolean; onClose: () => void; read: Set<number>; setRead: (r: Set<number>) => void }) {
  const t = useT();
  const tri = useTri();
  const [tab, setTab] = useState<"all" | "mine">("all");
  const list = NOTES.filter((n) => tab === "all" || n.mine);
  const unread = NOTES.filter((n) => !read.has(n.id)).length;
  const go = (n: Note) => {
    setRead(new Set(read).add(n.id));
    onClose();
    navigate(n.to);
  };
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <span className="row g8">
          {t("Notifications", "Notifications", "सूचनाएँ")}
          {unread > 0 && <span className="nt-count">{unread}</span>}
        </span>
      }
      footer={
        <div className="row between wrap g8">
          <span className="tiny faint">{t("Quiet hours 11 pm – 7 am", "Shaant samay raat 11 – subah 7", "शांत समय रात 11 – सुबह 7")}</span>
          <button className="btn sm ghost" onClick={() => (onClose(), navigate("settings"))}>
            <Settings /> {t("Choose what comes", "Kya aaye, tay karo", "क्या आए, तय करें")}
          </button>
        </div>
      }
    >
      <div className="nt-top">
        <Tabs
          items={[
            { id: "all", label: t("All", "Sab", "सब"), count: NOTES.length },
            { id: "mine", label: t("For you", "Aapke liye", "आपके लिए"), count: NOTES.filter((n) => n.mine).length },
          ]}
          value={tab}
          onChange={setTab}
        />
        <button className="btn sm ghost" disabled={unread === 0} onClick={() => setRead(new Set(NOTES.map((n) => n.id)))}>
          <CheckCheck /> {t("Mark all read", "Sab padh liya", "सब पढ़ लिया")}
        </button>
      </div>
      {(["today", "week"] as const).map((w) => {
        const items = list.filter((n) => n.when === w);
        if (!items.length) return null;
        return (
          <section key={w} className="nt-group">
            <h3 className="nt-h">{w === "today" ? t("Today", "Aaj", "आज") : t("This week", "Is hafte", "इस सप्ताह")}</h3>
            {items.map((n, i) => (
              <button key={n.id} className={`nt-item ${read.has(n.id) ? "" : "new"}`} style={{ ["--i" as string]: i }} onClick={() => go(n)}>
                <span className={`nt-ic ${n.tone}`}>{n.icon}</span>
                <span className="nt-body">
                  <b>{tri(n.title)}</b>
                  <span className="tiny faint">{tri(n.sub)}</span>
                </span>
                <span className="nt-side">
                  <span className="tiny faint">{n.ago}</span>
                  {!read.has(n.id) && <i className="nt-dot" aria-label="new" />}
                </span>
              </button>
            ))}
          </section>
        );
      })}
    </Drawer>
  );
}

/* ---------------- keyboard shortcuts ("?") ---------------- */

const GO: Record<string, string> = { a: "aaj", p: "practice", s: "courses", r: "revision", c: "contests", b: "build", m: "map" };

/** Press ? anywhere for the list; G then a letter jumps to a section. */
export function KeySheet() {
  const t = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let g = 0;
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable='true']") || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "?") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key.toLowerCase() === "g") g = Date.now();
      else if (g && Date.now() - g < 1200) {
        g = 0;
        const to = GO[e.key.toLowerCase()];
        if (to) {
          e.preventDefault();
          setOpen(false);
          navigate(to);
        }
      }
    };
    const flip = () => setOpen((o) => !o);
    window.addEventListener("keydown", h);
    window.addEventListener("pk-keys", flip);
    return () => {
      window.removeEventListener("keydown", h);
      window.removeEventListener("pk-keys", flip);
    };
  }, []);
  const groups: [string, [string[], string][]][] = [
    [
      t("Anywhere", "Kahin bhi", "कहीं भी"),
      [
        [["?"], t("This list", "Ye list", "यह सूची")],
        [["Ctrl", "K"], t("Search and jump", "Khojo aur jao", "खोजें")],
        [["Ctrl", "J"], t("Open or close Sahayak", "Sahayak kholo / band", "सहायक")],
        [["Ctrl", "\\"], t("Narrow or wide side bar", "Side bar chhota / bada", "साइड बार")],
        [["Esc"], t("Close what is open", "Jo khula hai band", "बंद करें")],
      ],
    ],
    [
      t("Go to (G, then…)", "Jao (G, phir…)", "जाएँ (G, फिर…)"),
      [
        [["G", "A"], t("Today", "Aaj", "आज")],
        [["G", "P"], t("Practice", "Abhyas", "अभ्यास")],
        [["G", "S"], t("Learn", "Seekho", "सीखो")],
        [["G", "R"], t("Revision", "Revision", "दोहराना")],
        [["G", "C"], t("Contests", "Contests", "प्रतियोगिता")],
        [["G", "B"], t("Build", "Banao", "बनाओ")],
        [["G", "M"], t("All screens", "Saare screens", "सभी स्क्रीन")],
      ],
    ],
    [
      "Code Studio",
      [
        [["Ctrl", "Shift", "P"], t("Command palette", "Command palette", "कमांड")],
        [["Ctrl", "B"], t("Side bar", "Side bar", "साइड बार")],
        [["Ctrl", "`"], t("Terminal and tests", "Terminal aur tests", "टर्मिनल")],
        [["Ctrl", "."], t("Quick fix", "Quick fix", "त्वरित सुधार")],
        [["Ctrl", "I"], t("Sahayak on this line", "Isi line par Sahayak", "इस पंक्ति पर सहायक")],
      ],
    ],
  ];
  return (
    <Modal open={open} onClose={() => setOpen(false)} wide icon={<Keyboard className="ks-ic" />} title={t("Keyboard shortcuts", "Keyboard shortcuts", "कीबोर्ड शॉर्टकट")} sub={t("Mac: use Cmd for Ctrl.", "Mac par Ctrl ki jagah Cmd.", "मैक पर Cmd।")}>
      <div className="ks-grid">
        {groups.map(([h, rows]) => (
          <section key={h} className="ks-group">
            <h3 className="nt-h">{h}</h3>
            {rows.map(([keys, label]) => (
              <div key={label} className="ks-row">
                <span className="grow">{label}</span>
                <span className="ks-keys">
                  {keys.map((k, i) => (
                    <Kbd key={i}>{k}</Kbd>
                  ))}
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Modal>
  );
}

/* ---------------- the shell ---------------- */

export function Shell({ route, children, rail }: { route: string; children: ReactNode; rail?: ReactNode }) {
  const { mini } = useSide();
  const ai = useAi();
  const [cmd, setCmd] = useCmdK();
  const [more, setMore] = useState(false);
  const [bell, setBell] = useState(false);
  const [read, setRead] = useState<Set<number>>(() => new Set([4, 5, 6, 7]));
  useEffect(() => setMore(false), [route]);
  return (
    <div className={`app ${mini ? "side-mini" : ""} ${ai.open ? "ai-open" : ""}`}>
      <SideNav route={route} onSearch={() => setCmd(true)} />
      <div className="main-col">
        <TopBar route={route} onMenu={() => setMore(true)} onBell={() => setBell(true)} unread={NOTES.filter((n) => !read.has(n.id)).length} />
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
      <NotifDrawer open={bell} onClose={() => setBell(false)} read={read} setRead={setRead} />
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
