import { useCallback, type MouseEvent, type ReactNode } from "react";
import { ApiError } from "../api.ts";
import { usePreferences, type MessageKey } from "../i18n.tsx";
import type { Difficulty, Learner, PracticeClient } from "./client.ts";

/** Pieces the practice pages and the prep pages share. */

/**
 * A learner's name as it appears to others: a link to their public profile
 * when they have one, and their contest title beside it once they are rated.
 */
export function Who({ nav, name, title, username }: { readonly nav: Nav; readonly name: string; readonly title?: string | null | undefined; readonly username?: string | null | undefined }) {
  return (
    <>
      {username === undefined || username === null ? name : (
        <Link nav={nav} to={`/u/${encodeURIComponent(username)}`}>
          {name}
        </Link>
      )}
      {title === undefined || title === null ? null : <span className="title-chip">{title}</span>}
    </>
  );
}

export interface Nav {
  readonly site: string;
  readonly href: (path: string) => string;
  readonly go: (path: string) => void;
}

export function Link({ nav, to, children, className, current }: { readonly nav: Nav; readonly to: string; readonly children: ReactNode; readonly className?: string; readonly current?: boolean }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    nav.go(to);
  };
  return (
    <a href={nav.href(to)} onClick={onClick} {...(className === undefined ? {} : { className })} {...(current ? { "aria-current": "page" as const } : {})}>
      {children}
    </a>
  );
}

export interface Context {
  readonly client: PracticeClient;
  readonly nav: Nav;
  readonly learner: Learner | null;
  readonly site: string;
}

export function DifficultyPill({ difficulty }: { readonly difficulty: Difficulty }) {
  const { t } = usePreferences();
  return <span className={`difficulty ${difficulty}`}>{t(`practice.difficulty.${difficulty}` as MessageKey)}</span>;
}

export function useWhen() {
  const { language } = usePreferences();
  return useCallback(
    (iso: string, withTime = true) =>
      new Intl.DateTimeFormat(`${language}-IN`, {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
      }).format(new Date(iso)),
    [language],
  );
}

export function SignInNeeded({ nav, next }: { readonly nav: Nav; readonly next: string }) {
  const { t } = usePreferences();
  return (
    <div className="card sign-in-needed">
      <p>{t("practice.signInToSee")}</p>
      <div className="row">
        <Link nav={nav} to={`/signin?next=${encodeURIComponent(next)}`} className="button">
          {t("practice.signIn")}
        </Link>
        <Link nav={nav} to={`/signup?next=${encodeURIComponent(next)}`} className="button secondary">
          {t("practice.signUp")}
        </Link>
      </div>
    </div>
  );
}

export const messageOf = (error: unknown, fallback: string): string =>
  error instanceof ApiError && typeof error.detail["message"] === "string" ? error.detail["message"] : fallback;
