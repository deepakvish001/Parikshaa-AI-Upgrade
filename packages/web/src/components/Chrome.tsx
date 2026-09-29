import type { ReactNode } from "react";
import { Check, FileCheck2, MessageCircleQuestion, Video } from "lucide-react";
import { Wordmark } from "@parikshaa/brand/react";
import { PreferencesBar, usePreferences, type Language } from "../i18n.tsx";

/** How wide a gate page reads: a card, the privacy notice, or the instructions. */
export type GateWidth = "narrow" | "reading" | "full";

/** Where a candidate is among the steps before the clock. */
export interface Steps {
  readonly labels: readonly string[];
  readonly current: number;
}

/**
 * The frame of every screen before the test: a plain bar with the name and
 * the reading preferences, the steps still to come, one page, and a footer
 * that says what happens to the candidate's work. The bar is aligned to the
 * page under it, so the eye does not travel.
 */
export function GateShell({ children, width = "narrow", steps }: { readonly children: ReactNode; readonly width?: GateWidth; readonly steps?: Steps }) {
  const { t } = usePreferences();
  return (
    <div className="gate-screen">
      <header className="gate-bar">
        <div className={`gate-bar-inner ${width}`}>
          <Wordmark size={28} />
          <PreferencesBar />
        </div>
      </header>
      <main className={`gate ${width}`}>
        {steps === undefined ? null : <Stepper {...steps} />}
        {children}
      </main>
      <footer className="gate-foot">{t("brand.foot")}</footer>
    </div>
  );
}

/**
 * The steps before the clock, the same on every one of them, so a candidate
 * always knows how far they are from starting. The last is the test itself.
 */
export function Stepper({ labels, current }: Steps) {
  const { t } = usePreferences();
  return (
    <ol className="stepper" aria-label={t("steps.label")}>
      {labels.map((label, i) => (
        <li key={label} className={i < current ? "done" : i === current ? "current" : undefined} aria-current={i === current ? "step" : undefined}>
          <span className="step-dot" aria-hidden="true">
            {i < current ? <Check /> : i + 1}
          </span>
          <span className="step-label">
            {label}
            {i < current ? <span className="visually-hidden"> ({t("steps.done")})</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The promises made before a test, as three short items rather than a paragraph. */
export function Promises() {
  const { t } = usePreferences();
  const items = [
    { icon: FileCheck2, title: t("gate.promiseRecord"), text: t("gate.promiseRecordNote") },
    { icon: MessageCircleQuestion, title: t("gate.promiseFollowUp"), text: t("gate.promiseFollowUpNote") },
    { icon: Video, title: t("gate.promiseCamera"), text: t("gate.promiseCameraNote") },
  ];
  return (
    <ul className="promises" aria-label={t("gate.promises")}>
      {items.map(({ icon: Icon, title, text }) => (
        <li key={title}>
          <Icon aria-hidden="true" />
          <strong>{title}</strong>
          <span>{text}</span>
        </li>
      ))}
    </ul>
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
