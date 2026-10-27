import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Check, CornerDownLeft, Ellipsis, House, LayoutGrid, Library, Menu as MenuIcon, Moon, PanelLeftClose, PanelLeftOpen, Sun, Undo2, UserRound, X } from "lucide-react";
import { LogoMark } from "@parikshaa/brand/react";
import { Empty, PHONE_QUERY, useMedia } from "@parikshaa/brand/kit";
import { Dialog } from "@parikshaa/brand/ui";
import { PreferencesProvider } from "../i18n.tsx";
import { AajBody, AajRail } from "./Aaj.tsx";
import { LearnProvider, ScreenLink, useLearn, type LearnState } from "./context.tsx";
import { LearnDataProvider, useLearnData, useMe } from "./data.tsx";
import { Search, Sparkles, Target } from "./icons.tsx";
import { LEARN_GROUPS, LEARN_SCREENS, screenById, tabOf, type LearnScreen } from "./screens.ts";
import { A, D, LEARN_LANGS, T, useLearnLang } from "./text.ts";
import "./learn.css";

/**
 * Learn v2's shell (tracker row 139, K1-3; DESIGN-SYSTEM §7 "Learner shell"),
 * shown on a practice site only where the flag `learn_v2` is on (flag.ts).
 * Ported from the mock's shell (docs/learn/mock-v3/app/src/ui/shell.tsx):
 *
 * - a side bar in five groups (Aaj, Seekho, Abhyas, Career, Mera), narrow
 *   (icons, each link still named) at 1180 px and below or by Ctrl+\;
 * - a top bar with where you are, the ⋯ menu (language, theme, the current
 *   site) and the Sahayak button; Sahayak opens as a pane that pushes the page;
 * - a right rail beside the page for the screens that have one (Aaj);
 * - on a phone (860 px and below) five tabs at the bottom instead of the side bar;
 * - Ctrl+K to search the screens and go to one.
 *
 * Every screen has its address (/practice/<site>/<id>). Aaj shows the mock's
 * Aaj A on the learner's own day (K2-1, through data.tsx: the practice site's
 * client and session); the others a placeholder until their Kadam 2 slice.
 * The side bar names the signed-in learner, or offers the way to sign in.
 */

const THEME_KEY = "parikshaa.learn.theme";
const NARROW_QUERY = "(max-width: 1180px)";

/** Learn is dark unless the learner chose paper (DESIGN-SYSTEM §3); the brand's tokens follow `data-theme`. */
function useLearnTheme(): ["dark" | "light", (theme: "dark" | "light") => void] {
  const [theme, setThemeState] = useState<"dark" | "light">(() => {
    try {
      return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    return () => root.removeAttribute("data-theme");
  }, [theme]);
  const setTheme = useCallback((next: "dark" | "light") => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Kept for this page only.
    }
  }, []);
  return [theme, setTheme];
}

/** The screen an address shows: "aaj" for the site's root, null for one Learn does not have. */
export function routeOf(site: string, pathname: string): string | null {
  const base = `/practice/${site}`;
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return null;
  const rest = pathname.slice(base.length).replace(/^\/+|\/+$/g, "");
  if (rest === "") return "aaj";
  return screenById(rest) === undefined ? null : rest;
}

export function LearnApp({ site }: { readonly site: string }) {
  return (
    <PreferencesProvider>
      <LearnDataProvider site={site}>
        <Shell site={site} />
      </LearnDataProvider>
    </PreferencesProvider>
  );
}

function Shell({ site }: { readonly site: string }) {
  const { lang, setLang, t } = useLearnLang();
  const [theme, setTheme] = useLearnTheme();
  const [path, setPath] = useState(() => window.location.pathname);
  const route = routeOf(site, path);
  const { signedIn } = useLearnData();
  const phone = useMedia(PHONE_QUERY);
  const narrow = useMedia(NARROW_QUERY);
  const [chosenMini, setChosenMini] = useState(false);
  const mini = !phone && (narrow || chosenMini);
  const [ai, setAi] = useState(false);
  const [search, setSearch] = useState(false);
  const [more, setMore] = useState(false);
  const main = useRef<HTMLElement>(null);
  const moved = useRef(false);

  const go = useCallback(
    (id: string) => {
      const url = `/practice/${site}/${id}`;
      if (window.location.pathname !== url) window.history.pushState(null, "", url);
      moved.current = true;
      setMore(false);
      setPath(url);
      window.scrollTo(0, 0);
    },
    [site],
  );
  useEffect(() => {
    const back = () => setPath(window.location.pathname);
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  // After a move within the shell, the new page's content has the focus, as a page load would give it.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    main.current?.focus({ preventScroll: true });
  }, [path]);

  const screen = route === null ? undefined : screenById(route);
  useEffect(() => {
    document.title = `${screen === undefined ? t(T.notHereTitle) : t(screen.title)} · Parikshaa Learn`;
  }, [screen, t]);

  // Ctrl+K search, Ctrl+J Sahayak, Ctrl+\ the narrow side bar (DESIGN-SYSTEM §9); Cmd on a Mac.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setSearch((open) => !open);
      } else if (key === "j") {
        event.preventDefault();
        setAi((open) => !open);
      } else if (key === "\\") {
        event.preventDefault();
        setChosenMini((on) => !on);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const state = useMemo<LearnState>(
    () => ({ site, lang, setLang, t, theme, setTheme, href: (id) => `/practice/${site}/${id}`, go, openSahayak: () => setAi(true) }),
    [site, lang, setLang, t, theme, setTheme, go],
  );
  // Aaj's rail is the learner's own week; signed out there is none.
  const rail = route === "aaj" && signedIn ? <AajRail /> : null;

  return (
    <LearnProvider value={state}>
      <div className={`ln-app${mini ? " ln-is-mini" : ""}${phone ? " ln-is-phone" : ""}${ai ? " ln-ai-open" : ""}`} lang={LEARN_LANGS.find((l) => l.id === lang)?.lang}>
        <a
          className="ln-skip"
          href="#ln-main"
          onClick={(event) => {
            event.preventDefault();
            main.current?.focus();
          }}
        >
          {t(T.skip)}
        </a>
        {phone ? null : <SideNav route={route} mini={mini} narrow={narrow} setMini={setChosenMini} ai={ai} toggleAi={() => setAi((open) => !open)} openSearch={() => setSearch(true)} />}
        <div className="ln-col">
          <TopBar screen={screen} phone={phone} ai={ai} toggleAi={() => setAi((open) => !open)} openMore={() => setMore(true)} openSearch={() => setSearch(true)} />
          <main id="ln-main" ref={main} tabIndex={-1} className={`ln-main${rail === null ? "" : " ln-has-rail"}`}>
            <div className="ln-page" key={route ?? "none"}>
              <Page route={route} path={path} />
            </div>
            {rail === null ? null : (
              <aside className="ln-rail" aria-label={t(T.rail)}>
                {rail}
              </aside>
            )}
          </main>
        </div>
        {ai ? <SahayakPane phone={phone} onClose={() => setAi(false)} /> : null}
        {phone ? <BottomTabs route={route} ai={ai} toggleAi={() => setAi((open) => !open)} more={more} openMore={() => setMore(true)} /> : null}
        {more ? <MoreSheet route={route} onClose={() => setMore(false)} /> : null}
        {search ? <SearchDialog onClose={() => setSearch(false)} /> : null}
      </div>
    </LearnProvider>
  );
}

/* ---------------- side bar ---------------- */

function SideNav({
  route,
  mini,
  narrow,
  setMini,
  ai,
  toggleAi,
  openSearch,
}: {
  readonly route: string | null;
  readonly mini: boolean;
  readonly narrow: boolean;
  readonly setMini: (mini: boolean) => void;
  readonly ai: boolean;
  readonly toggleAi: () => void;
  readonly openSearch: () => void;
}) {
  const { t } = useLearn();
  const id = useId();
  // In the narrow side bar each name is hidden from the eye, not from a screen reader, and shown as a tooltip.
  const name = (text: string) => <span className={mini ? "ln-sr" : "ln-grow"}>{text}</span>;
  return (
    <nav className={`ln-side${mini ? " ln-mini" : ""}`} aria-label={t(T.nav)}>
      <div className="ln-side-top">
        <ScreenLink to="aaj" className="ln-side-logo" label={t(T.home)} {...(mini ? { title: t(T.home) } : {})}>
          <LogoMark size={28} />
          {mini ? null : <span className="ln-word">Parikshaa</span>}
        </ScreenLink>
        {mini || narrow ? null : (
          <button type="button" className="ln-icon-btn ln-sm" onClick={() => setMini(true)} aria-label={t(T.collapse)} title={t(T.collapse)} aria-keyshortcuts="Control+\">
            <PanelLeftClose aria-hidden="true" />
          </button>
        )}
      </div>
      {mini && !narrow ? (
        <button type="button" className="ln-side-item" onClick={() => setMini(false)} aria-label={t(T.expand)} title={t(T.expand)} aria-keyshortcuts="Control+\">
          <PanelLeftOpen aria-hidden="true" />
        </button>
      ) : null}
      <button type="button" className="ln-side-search" onClick={openSearch} aria-keyshortcuts="Control+K" {...(mini ? { title: t(T.search) } : {})}>
        <Search aria-hidden="true" />
        {name(t(T.search))}
        {mini ? null : (
          <kbd className="ln-kbd" aria-hidden="true">
            Ctrl K
          </kbd>
        )}
      </button>
      <div className="ln-side-nav">
        {LEARN_GROUPS.map((group) => {
          const labelId = `${id}-${group.id}`;
          return (
            <div className="ln-side-group" key={group.id}>
              {group.id === "today" ? null : mini ? (
                <>
                  <div className="ln-side-rule" aria-hidden="true" />
                  <span className="ln-sr" id={labelId}>
                    {t(group.name)}
                  </span>
                </>
              ) : (
                <div className="ln-side-label" id={labelId}>
                  {t(group.name)}
                </div>
              )}
              <ul {...(group.id === "today" ? { "aria-label": t(group.name) } : { "aria-labelledby": labelId })}>
                {LEARN_SCREENS.filter((screen) => screen.group === group.id).map((screen) => (
                  <li key={screen.id}>
                    <ScreenLink to={screen.id} className="ln-side-item" current={route === screen.id} {...(mini ? { title: t(screen.title) } : {})}>
                      <screen.icon aria-hidden="true" />
                      {name(t(screen.title))}
                    </ScreenLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="ln-side-foot">
        <button type="button" className={`ln-side-ai${ai ? " ln-on" : ""}`} onClick={toggleAi} aria-pressed={ai} aria-keyshortcuts="Control+J" {...(mini ? { title: t(T.askSahayak) } : {})}>
          <Sparkles aria-hidden="true" />
          {name(t(T.askSahayak))}
          {mini ? null : (
            <kbd className="ln-kbd" aria-hidden="true">
              Ctrl J
            </kbd>
          )}
        </button>
        <Account mini={mini} />
      </div>
    </nav>
  );
}

/** The signed-in learner, a link to their profile; signed out, the way to sign in (the practice site's, until K2-2). */
function Account({ mini }: { readonly mini: boolean }) {
  const { t, site } = useLearn();
  const { signedIn } = useLearnData();
  const me = useMe();
  const inner = (title: string, sub: string) => (
    <>
      <span className="ln-avatar" aria-hidden="true">
        <UserRound />
      </span>
      <span className={mini ? "ln-sr" : "ln-grow ln-user-text"}>
        <b>{title}</b>
        <span className="ln-faint">{sub}</span>
      </span>
    </>
  );
  if (!signedIn) {
    return (
      <a className="ln-side-user" href={`/practice/${site}/signin?learn_v2=0`} {...(mini ? { title: t(D.signIn) } : {})}>
        {inner(t(D.signIn), t(A.signInSub))}
      </a>
    );
  }
  const name = me.data?.name ?? t(T.account);
  return (
    <ScreenLink to="profile" className="ln-side-user" {...(mini ? { title: name } : {})}>
      {inner(name, t(A.profile))}
    </ScreenLink>
  );
}

/* ---------------- top bar ---------------- */

function Crumbs({ screen }: { readonly screen: LearnScreen | undefined }) {
  const { t } = useLearn();
  const group = LEARN_GROUPS.find((g) => g.id === screen?.group);
  return (
    <nav className="ln-crumbs" aria-label={t(T.breadcrumb)}>
      <ol>
        {group === undefined || group.id === "today" ? null : <li className="ln-faint">{t(group.name)}</li>}
        <li aria-current="page">{screen === undefined ? t(T.notHereTitle) : t(screen.title)}</li>
      </ol>
    </nav>
  );
}

function TopBar({
  screen,
  phone,
  ai,
  toggleAi,
  openMore,
  openSearch,
}: {
  readonly screen: LearnScreen | undefined;
  readonly phone: boolean;
  readonly ai: boolean;
  readonly toggleAi: () => void;
  readonly openMore: () => void;
  readonly openSearch: () => void;
}) {
  const { t } = useLearn();
  return (
    <header className="ln-top">
      {phone ? (
        <>
          <button type="button" className="ln-icon-btn" onClick={openMore} aria-label={t(T.menu)} title={t(T.menu)} aria-haspopup="dialog">
            <MenuIcon aria-hidden="true" />
          </button>
          <ScreenLink to="aaj" className="ln-top-logo" label={t(T.home)}>
            <LogoMark size={26} />
          </ScreenLink>
        </>
      ) : (
        <Crumbs screen={screen} />
      )}
      <span className="ln-grow" />
      {phone ? (
        <button type="button" className="ln-icon-btn" onClick={openSearch} aria-label={t(T.search)} title={t(T.search)} aria-haspopup="dialog">
          <Search aria-hidden="true" />
        </button>
      ) : null}
      <MoreMenu />
      {phone ? null : (
        <button type="button" className={`ln-btn ln-btn-ai${ai ? " ln-on" : ""}`} onClick={toggleAi} aria-pressed={ai} aria-keyshortcuts="Control+J">
          <Sparkles aria-hidden="true" />
          {t(T.sahayak)}
        </button>
      )}
    </header>
  );
}

/** One ⋯ menu for what is not needed every minute: the language, the theme, and the way back to the current site. */
function MoreMenu() {
  const { t, lang, setLang, theme, setTheme, site } = useLearn();
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const start = useRef<"first" | "last">("first");
  const entries = () => [...(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]') ?? [])];

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);
  useEffect(() => {
    if (!open) return;
    const all = entries();
    (start.current === "last" ? all.at(-1) : all[0])?.focus();
    const away = (event: Event) => {
      if (!(event.target instanceof Node) || !wrap.current?.contains(event.target)) close(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
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
      all[to]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      close(false);
    }
  };

  return (
    <div className="ln-menu" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="ln-icon-btn"
        aria-label={t(T.options)}
        title={t(T.options)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          start.current = "first";
          setOpen((was) => !was);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            start.current = event.key === "ArrowUp" ? "last" : "first";
            setOpen(true);
          }
        }}
      >
        <Ellipsis aria-hidden="true" />
      </button>
      {open ? (
        <div ref={list} id={id} role="menu" aria-label={t(T.options)} className="ln-menu-list" onKeyDown={onListKey}>
          <div role="group" aria-label={t(T.language)}>
            <div className="ln-menu-label" aria-hidden="true">
              {t(T.language)}
            </div>
            {LEARN_LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="menuitemradio"
                aria-checked={lang === l.id}
                tabIndex={-1}
                lang={l.lang}
                className="ln-menu-item"
                onClick={() => {
                  setLang(l.id);
                  close(true);
                }}
              >
                <span className="ln-grow">{l.name}</span>
                {lang === l.id ? <Check aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
          <div role="separator" className="ln-menu-sep" />
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="ln-menu-item"
            onClick={() => {
              setTheme(theme === "dark" ? "light" : "dark");
              close(true);
            }}
          >
            {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            <span className="ln-grow">{theme === "dark" ? t(T.toLight) : t(T.toDark)}</span>
          </button>
          <a role="menuitem" tabIndex={-1} className="ln-menu-item" href={`/practice/${site}?learn_v2=0`}>
            <Undo2 aria-hidden="true" />
            <span className="ln-grow">{t(T.oldSite)}</span>
          </a>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- pages ---------------- */

function Page({ route, path }: { readonly route: string | null; readonly path: string }) {
  const { t } = useLearn();
  if (route === "aaj") return <AajBody />;
  const screen = route === null ? undefined : screenById(route);
  if (screen === undefined) {
    return (
      <div className="ln-placeholder">
        <h1 className="ln-page-h1">{t(T.notHereTitle)}</h1>
        <Empty
          title={t(T.notHereBody)}
          action={
            <a className="ln-btn ln-btn-pri" href={`${path}?learn_v2=0`}>
              {t(T.openOld)}
            </a>
          }
        />
      </div>
    );
  }
  const group = LEARN_GROUPS.find((g) => g.id === screen.group);
  return (
    <div className="ln-placeholder">
      {group === undefined ? null : <p className="ln-eyebrow">{t(group.name)}</p>}
      <h1 className="ln-page-h1">{t(screen.title)}</h1>
      <Empty
        icon={<screen.icon />}
        title={t(screen.desc)}
        body={t(T.step2)}
        action={
          <ScreenLink to="aaj" className="ln-btn ln-btn-ghost">
            {t(T.toToday)}
          </ScreenLink>
        }
      />
    </div>
  );
}

/* ---------------- Sahayak ---------------- */

function SahayakPane({ phone, onClose }: { readonly phone: boolean; readonly onClose: () => void }) {
  const { t } = useLearn();
  const closer = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!phone) closer.current?.focus();
  }, [phone]);
  const body = (
    <div className="ln-ai-in">
      <div className="ln-ai-head">
        <Sparkles aria-hidden="true" />
        <h2 className="ln-h3 ln-grow">{t(T.sahayak)}</h2>
        <button ref={closer} type="button" className="ln-icon-btn" onClick={onClose} aria-label={t(T.close)} title={t(T.close)}>
          <X aria-hidden="true" />
        </button>
      </div>
      <Empty icon={<Sparkles />} title={t(T.sahayakSoon)} body={t(T.step2)} headingLevel={3} />
    </div>
  );
  if (phone) {
    return (
      <Dialog label={t(T.sahayak)} onClose={onClose} variant="full" className="ln-ai-sheet" initialFocus={closer}>
        {body}
      </Dialog>
    );
  }
  return (
    <aside className="ln-ai" aria-label={t(T.sahayak)}>
      {body}
    </aside>
  );
}

/* ---------------- phone ---------------- */

function BottomTabs({
  route,
  ai,
  toggleAi,
  more,
  openMore,
}: {
  readonly route: string | null;
  readonly ai: boolean;
  readonly toggleAi: () => void;
  readonly more: boolean;
  readonly openMore: () => void;
}) {
  const { t } = useLearn();
  const tab = route === null ? null : tabOf(route);
  const item = (to: string, on: boolean, icon: ReactNode, label: string) => (
    <ScreenLink to={to} className={`ln-tab${on ? " ln-on" : ""}`} current={route === to}>
      {icon}
      <span>{label}</span>
    </ScreenLink>
  );
  return (
    <nav className="ln-tabs" aria-label={t(T.phoneNav)}>
      {item("aaj", tab === "aaj", <House aria-hidden="true" />, t(T.tabToday))}
      {item("courses", tab === "learn", <Library aria-hidden="true" />, t(T.tabLearn))}
      {item("practice", tab === "practice", <Target aria-hidden="true" />, t(T.tabPractice))}
      <button type="button" className={`ln-tab${ai ? " ln-on" : ""}`} onClick={toggleAi} aria-pressed={ai}>
        <Sparkles aria-hidden="true" />
        <span>{t(T.sahayak)}</span>
      </button>
      <button type="button" className={`ln-tab${more ? " ln-on" : ""}`} onClick={openMore} aria-haspopup="dialog" aria-expanded={more}>
        <LayoutGrid aria-hidden="true" />
        <span>{t(T.more)}</span>
      </button>
    </nav>
  );
}

/** "Aur" on a phone: every screen, by group. */
function MoreSheet({ route, onClose }: { readonly route: string | null; readonly onClose: () => void }) {
  const { t } = useLearn();
  const id = useId();
  return (
    <Dialog label={t(T.more)} onClose={onClose} variant="side" className="ln-sheet">
      <div className="ln-sheet-head">
        <LogoMark size={24} />
        <span className="ln-word ln-grow">Parikshaa</span>
        <button type="button" className="ln-icon-btn" onClick={onClose} aria-label={t(T.close)} title={t(T.close)}>
          <X aria-hidden="true" />
        </button>
      </div>
      {LEARN_GROUPS.map((group) => (
        <section key={group.id} className="ln-sheet-group" aria-labelledby={`${id}-${group.id}`}>
          <h2 className="ln-side-label" id={`${id}-${group.id}`}>
            {t(group.name)}
          </h2>
          <ul className="ln-sheet-grid">
            {LEARN_SCREENS.filter((screen) => screen.group === group.id).map((screen) => (
              <li key={screen.id}>
                <ScreenLink to={screen.id} className="ln-sheet-item" current={route === screen.id} onFollow={onClose}>
                  <screen.icon aria-hidden="true" />
                  <span>{t(screen.title)}</span>
                </ScreenLink>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Dialog>
  );
}

/* ---------------- search (Ctrl+K) ---------------- */

/** The screens whose name (in any of the three languages), description or address has the words typed. */
export function findScreens(query: string, t: (tri: LearnScreen["title"]) => string): readonly LearnScreen[] {
  const q = query.trim().toLowerCase();
  if (q === "") return LEARN_SCREENS;
  return LEARN_SCREENS.filter((screen) => [...screen.title, t(screen.desc), screen.id].some((text) => text.toLowerCase().includes(q)));
}

function SearchDialog({ onClose }: { readonly onClose: () => void }) {
  const { t, go } = useLearn();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const items = findScreens(query, t);
  const chosen = items[Math.min(active, items.length - 1)];
  const choose = (screen: LearnScreen) => {
    onClose();
    go(screen.id);
  };
  const onKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (items.length === 0) return;
      setActive((at) => (event.key === "ArrowDown" ? (at + 1) % items.length : (at - 1 + items.length) % items.length));
    } else if (event.key === "Enter" && chosen !== undefined) {
      event.preventDefault();
      choose(chosen);
    }
  };
  return (
    <Dialog label={t(T.searchDialog)} onClose={onClose} variant="top" className="ln-cmd" initialFocus={input}>
      <div className="ln-cmd-in">
        <Search aria-hidden="true" />
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-label={t(T.searchField)}
          aria-expanded={items.length > 0}
          aria-controls={items.length > 0 ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={chosen === undefined ? undefined : `${listId}-${chosen.id}`}
          placeholder={t(T.searchHint)}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
        />
        <kbd className="ln-kbd" aria-hidden="true">
          Esc
        </kbd>
      </div>
      <div className="ln-cmd-label" aria-hidden="true">
        {t(T.goTo)}
      </div>
      {items.length === 0 ? (
        <p className="ln-cmd-none">{t(T.nothing)}</p>
      ) : (
        <ul className="ln-cmd-list" id={listId} role="listbox" aria-label={t(T.goTo)}>
          {items.map((screen) => (
            <li
              key={screen.id}
              id={`${listId}-${screen.id}`}
              role="option"
              aria-selected={screen === chosen}
              className="ln-cmd-item"
              onMouseEnter={() => setActive(items.indexOf(screen))}
              onClick={() => choose(screen)}
            >
              <span className="ln-cmd-ic" aria-hidden="true">
                <screen.icon />
              </span>
              <span className="ln-grow">
                <b>{t(screen.title)}</b>
                <span className="ln-faint"> · {t(screen.desc)}</span>
              </span>
              {screen === chosen ? <CornerDownLeft aria-hidden="true" className="ln-faint" /> : null}
            </li>
          ))}
        </ul>
      )}
      <p className="ln-sr" aria-live="polite">
        {items.length === 0 ? t(T.nothing) : t(T.found).replace("{n}", String(items.length))}
      </p>
    </Dialog>
  );
}
