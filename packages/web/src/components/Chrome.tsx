import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Wordmark } from "@parikshaa/brand/react";
import { PreferencesBar, usePreferences, type Language } from "../i18n.tsx";

/**
 * The frame of every screen before the test: the name, what Parikshaa is for,
 * one card, and a footer that says what happens to the candidate's work.
 */
export function GateShell({ children, wide = false }: { readonly children: ReactNode; readonly wide?: boolean }) {
  const { t } = usePreferences();
  return (
    <div className="gate-screen">
      <main className={wide ? "gate wide" : "gate"}>
        <PreferencesBar />
        <h1 className="gate-title">
          <Wordmark size={36} />
        </h1>
        <p className="tagline">{t("brand.tagline")}</p>
        {children}
      </main>
      <footer className="gate-foot">{t("brand.foot")}</footer>
    </div>
  );
}

/** What the candidate is told the test does and does not do, set apart so it is read. */
export function Assurance({ children }: { readonly children: ReactNode }) {
  return (
    <div className="assurance">
      <ShieldCheck aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

/** The bar across the top of the test: the name, the test's title, its clock, and the language. */
export function TopBar({ title, offered = [], children }: { readonly title: string; readonly offered?: readonly Language[]; readonly children?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Wordmark size={26} />
        <span className="divider" aria-hidden="true" />
        <span className="exam-name">{title}</span>
        <span className="spacer" />
        {children}
        <PreferencesBar offered={offered} />
      </div>
    </header>
  );
}
