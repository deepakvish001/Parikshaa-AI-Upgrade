import { useEffect, useState } from "react";
import { BadgeCheck, CircleX, Loader } from "lucide-react";
import { checkScorecard, type ScorecardCheck as Check } from "../api.ts";
import { uiLocaleOf, usePreferences } from "../i18n.tsx";
import { GateShell } from "./Chrome.tsx";

/**
 * What a scorecard's QR code opens: the result as it stands in the
 * institution's record now, for an employer or anyone else holding the paper.
 * It needs no account, and it says plainly when a result was withdrawn.
 */
export function ScorecardCheck({ code }: { readonly code: string }) {
  const { t, language } = usePreferences();
  const [check, setCheck] = useState<Check | "failed" | null>(null);
  useEffect(() => {
    checkScorecard(code).then(setCheck, () => setCheck("failed"));
  }, [code]);

  if (check === null) {
    return (
      <GateShell width="narrow">
        <section className="gate-card status-card" aria-busy="true" aria-label={t("verify.title")}>
          <Loader className="status-icon spin" aria-hidden="true" />
          <h1>{t("verify.checking")}</h1>
        </section>
      </GateShell>
    );
  }
  if (check === "failed" || !check.valid) {
    return (
      <GateShell width="narrow">
        <section className="gate-card status-card" aria-label={t("verify.title")}>
          <CircleX className="status-icon bad" aria-hidden="true" />
          <h1>{check !== "failed" && check.reason === "withdrawn" ? t("verify.withdrawn") : t("verify.unknown")}</h1>
        </section>
      </GateShell>
    );
  }
  const ui = uiLocaleOf(language);
  const rows: [string, string][] = [
    [t("verify.candidate"), `${check.candidate.name} (${check.candidate.ref})`],
    [t("verify.test"), check.title],
    [t("verify.institution"), check.institution],
    [t("verify.sat"), new Intl.DateTimeFormat(`${ui}-IN`, { timeZone: "Asia/Kolkata", dateStyle: "long" }).format(new Date(check.sittingDate))],
    [t("verify.marks"), `${check.total} / ${check.maxTotal} (${check.percent}%)`],
    ...(check.outcome === null ? [] : ([[t("verify.outcome"), t(check.outcome === "qualified" ? "verify.reached" : "verify.notReached")]] as [string, string][])),
  ];
  return (
    <GateShell width="narrow">
      <section className="gate-card scorecard-check" aria-label={t("verify.title")}>
        <BadgeCheck className="status-icon ok" aria-hidden="true" />
        <h1>{t("verify.valid")}</h1>
        <dl>
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="notice">{t("verify.note")}</p>
        <p className="notice mono">
          {t("verify.record")}: {check.record.slice(0, 16)}…
        </p>
      </section>
    </GateShell>
  );
}
