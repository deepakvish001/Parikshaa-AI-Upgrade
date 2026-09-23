import { useState } from "react";
import { usePreferences } from "../i18n.tsx";
import { Assurance, GateShell } from "./Chrome.tsx";

interface Props {
  readonly onToken: (token: string) => void;
}

/**
 * Entry point when no attempt token is present in the URL.
 *
 * The token is the whole of a candidate's access: it names one attempt and
 * expires with the exam window. It is kept for this tab only (sessionStorage),
 * so a reload does not lock the candidate out but a shared or invigilated
 * machine does not keep it after the tab closes.
 */
export function TokenGate({ onToken }: Props) {
  const { t } = usePreferences();
  const [value, setValue] = useState("");

  return (
    <GateShell>
      <div className="gate-card">
        <p className="notice">{t("gate.prompt")}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim() !== "") onToken(value.trim());
          }}
        >
          <label htmlFor="access-code">{t("gate.code")}</label>
          <textarea id="access-code" value={value} onChange={(e) => setValue(e.target.value)} />
          <div className="row">
            <button type="submit" disabled={value.trim() === ""}>
              {t("gate.begin")}
            </button>
          </div>
        </form>
      </div>
      <Assurance>{t("gate.noSurveillance")}</Assurance>
    </GateShell>
  );
}
