import { createContext, useContext, type MouseEvent, type ReactNode } from "react";
import type { Tri } from "./screens.ts";
import type { LearnLang } from "./text.ts";

/** What every part of Learn's shell shares: the language, the theme, and the site's own router. */
export interface LearnState {
  readonly site: string;
  readonly lang: LearnLang;
  readonly setLang: (lang: LearnLang) => void;
  readonly t: (tri: Tri) => string;
  readonly theme: "dark" | "light";
  readonly setTheme: (theme: "dark" | "light") => void;
  /** The address of a screen of this site (`id` may carry a query: `signin?next=plan`). */
  readonly href: (id: string) => string;
  /** Go to a screen without reloading the page; `replace` leaves no step behind in the history (a redirect). */
  readonly go: (id: string, replace?: boolean) => void;
  readonly openSahayak: () => void;
  /** Say something above the page until the learner moves on or dismisses it; null clears it. */
  readonly notify: (notice: Notice | null) => void;
}

/** A line above the page: an outcome ("ok"), something that went wrong ("error"), or a nudge ("info"). */
export interface Notice {
  readonly tone: "ok" | "error" | "info";
  readonly text: string;
}

const LearnContext = createContext<LearnState | null>(null);

export const LearnProvider = LearnContext.Provider;

export function useLearn(): LearnState {
  const state = useContext(LearnContext);
  if (state === null) throw new Error("useLearn outside LearnApp");
  return state;
}

/**
 * A link to one of this site's screens. A plain click is routed in the page;
 * with a modifier key (a new tab) the browser follows the address itself.
 */
export function ScreenLink({
  to,
  className,
  label,
  current,
  title,
  onFollow,
  children,
}: {
  readonly to: string;
  readonly className?: string;
  /** Its accessible name, when its content does not say it. */
  readonly label?: string;
  readonly current?: boolean;
  readonly title?: string;
  /** Called after a routed click, e.g. to close the sheet the link sits in. */
  readonly onFollow?: () => void;
  readonly children: ReactNode;
}) {
  const { href, go } = useLearn();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onFollow?.();
    go(to);
  };
  return (
    <a href={href(to)} className={className} aria-label={label} aria-current={current === true ? "page" : undefined} title={title} onClick={onClick}>
      {children}
    </a>
  );
}
