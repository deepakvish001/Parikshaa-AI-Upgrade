import { useState } from "react";
import { PreferencesBar, usePreferences } from "../i18n.tsx";

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
    <main className="gate">
      <PreferencesBar />
      <h1>Parikshaa</h1>
      <p className="notice">{t("gate.prompt")}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim() !== "") onToken(value.trim());
        }}
      >
        <textarea
          aria-label={t("gate.code")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="row">
          <button type="submit" disabled={value.trim() === ""}>
            {t("gate.begin")}
          </button>
        </div>
      </form>
      <p className="notice" style={{ marginTop: "2rem" }}>
        {t("gate.noSurveillance")}
      </p>
    </main>
  );
}
