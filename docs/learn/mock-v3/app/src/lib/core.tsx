import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type AnchorHTMLAttributes,
} from "react";
import { CircleCheck } from "lucide-react";

/* ---------------- language ---------------- */

export type Lang = "en" | "hg" | "hi";
type LangCtx = { lang: Lang; setLang: (l: Lang) => void };
const LangContext = createContext<LangCtx>({ lang: "en", setLang: () => {} });

export function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writeStore(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage can be blocked; the mock still works */
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = readStore("pk3-lang");
    return saved === "hg" || saved === "hi" || saved === "en" ? saved : "en";
  });
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writeStore("pk3-lang", l);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang === "hi" ? "hi" : "en-IN";
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
export const useLang = () => useContext(LangContext);

/** Pick the string for the current language: English, Hinglish, Hindi (falls back to Hinglish). */
export function useT() {
  const { lang } = useLang();
  return useCallback(
    (en: string, hg?: string, hi?: string) => (lang === "en" ? en : lang === "hg" ? (hg ?? en) : (hi ?? hg ?? en)),
    [lang],
  );
}

/* ---------------- theme ---------------- */

export type Theme = "dark" | "light";
type ThemeCtx = { theme: Theme; setTheme: (t: Theme) => void };
const ThemeContext = createContext<ThemeCtx>({ theme: "dark", setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // v4: black is the default for everyone; light only when the learner picks it.
    const saved = readStore("pk4-theme");
    if (saved === "light" || saved === "dark") return saved;
    return "dark";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    writeStore("pk4-theme", t);
  }, []);
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);

/* ---------------- router (hash, plain tokens only) ---------------- */

function currentRoute(): string {
  const h = window.location.hash.replace(/^#/, "");
  return h === "" ? "map" : h;
}
const listeners = new Set<() => void>();
window.addEventListener("hashchange", () => listeners.forEach((l) => l()));

export function navigate(route: string) {
  if (currentRoute() === route) {
    window.scrollTo({ top: 0 });
    return;
  }
  window.location.hash = route;
  window.scrollTo({ top: 0 });
}
export function useRoute(): string {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const l = () => setRoute(currentRoute());
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return route;
}
export function Link({
  to,
  children,
  current,
  ...rest
}: { to: string; current?: boolean } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={`#${to}`}
      aria-current={current ? "page" : undefined}
      {...rest}
      onClick={(e) => {
        rest.onClick?.(e);
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

/* ---------------- toasts ---------------- */

type Toast = { id: number; text: string };
const ToastContext = createContext<(text: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((text: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <CircleCheck size={16} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);

/* ---------------- time helpers ---------------- */

export function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (ms === null) return;
    const id = window.setInterval(() => ref.current(), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

/** Seconds counting down from `start`, ticking once a second while `running`. */
export function useCountdown(start: number, running = true) {
  const [left, setLeft] = useState(start);
  useInterval(() => setLeft((s) => Math.max(0, s - 1)), running && left > 0 ? 1000 : null);
  return [left, setLeft] as const;
}
/** Seconds counting up from `start`. */
export function useStopwatch(start: number, running = true) {
  const [s, setS] = useState(start);
  useInterval(() => setS((x) => x + 1), running ? 1000 : null);
  return [s, setS] as const;
}
export function hms(total: number, withHours = true) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return withHours ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m + h * 60)}:${p(s)}`;
}

/** True after `ms`; used to show a skeleton for a moment so loading states are visible. */
export function useLoaded(ms = 450) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setDone(true), ms);
    return () => window.clearTimeout(id);
  }, [ms]);
  return done;
}

export function useKey(key: string, fn: (e: KeyboardEvent) => void, deps: unknown[] = []) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === key.toLowerCase()) fn(e);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
