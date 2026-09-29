import { useState } from "react";
import { CircleAlert, ClipboardPaste } from "lucide-react";
import { usePreferences } from "../i18n.tsx";
import { GateShell, Promises } from "./Chrome.tsx";

interface Props {
  readonly onToken: (token: string) => void;
  /** The code last tried did not open anything. */
  readonly failed?: boolean;
}

/** A pasted code, without the spaces and line breaks a chat app or an email adds. */
const clean = (value: string) => value.replace(/\s+/g, "");

/**
 * Entry point when no attempt token is present in the URL.
 *
 * The token is the whole of a candidate's access: it names one attempt and
 * expires with the exam window. It is kept for this tab only (sessionStorage),
 * so a reload does not lock the candidate out but a shared or invigilated
 * machine does not keep it after the tab closes.
 */
export function TokenGate({ onToken, failed = false }: Props) {
  const { t } = usePreferences();
  const [value, setValue] = useState("");
  const canPaste = typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function";
  const code = clean(value);

  const paste = async () => {
    try {
      setValue(clean(await navigator.clipboard.readText()));
    } catch {
      // Refused or empty: the field is still there to paste into by hand.
    }
    document.getElementById("access-code")?.focus();
  };

  return (
    <GateShell>
      <section className="gate-card" aria-labelledby="gate-heading">
        <h1 id="gate-heading" className="gate-heading">
          {t("gate.heading")}
        </h1>
        <p className="notice">{t("gate.prompt")}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code !== "") onToken(code);
          }}
        >
          <label htmlFor="access-code">{t("gate.code")}</label>
          <div className="code-field">
            <input
              id="access-code"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => setValue(code)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              aria-invalid={failed || undefined}
              aria-describedby={failed ? "access-code-error" : code === "" ? "access-code-hint" : undefined}
            />
            {canPaste ? (
              <button type="button" className="secondary" onClick={() => void paste()}>
                <ClipboardPaste aria-hidden="true" />
                {t("gate.paste")}
              </button>
            ) : null}
          </div>
          {failed ? (
            <p id="access-code-error" className="field-error" role="alert">
              <CircleAlert aria-hidden="true" />
              {t("gate.expired")}
            </p>
          ) : null}
          <div className="gate-action">
            <button type="submit" className="large block" disabled={code === ""}>
              {t("gate.begin")}
            </button>
            {code === "" ? (
              <p id="access-code-hint" className="hint">
                {t("gate.needCode")}
              </p>
            ) : null}
          </div>
        </form>
      </section>
      <Promises />
    </GateShell>
  );
}
