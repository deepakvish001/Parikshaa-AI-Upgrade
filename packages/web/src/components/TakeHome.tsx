import { decodeTakeHomeAnswer, encodeTakeHomeAnswer, MAX_TAKE_HOME_NOTES, validTakeHomeLink } from "@parikshaa/core/browser";
import { usePreferences } from "../i18n.tsx";

/**
 * A take-home's answer (plan row 88): the link to the candidate's work, usually
 * a repository, and their notes on it. A person opens the link and marks it.
 */
export function TakeHomeAnswer({ label, value, disabled, onChange }: { readonly label: string; readonly value: string; readonly disabled: boolean; readonly onChange: (value: string) => void }) {
  const { t } = usePreferences();
  const work = decodeTakeHomeAnswer(value) ?? { link: "", notes: "" };
  const set = (next: { link: string; notes: string }) => onChange(next.link.trim() === "" && next.notes === "" ? "" : encodeTakeHomeAnswer(next));
  const badLink = work.link.trim() !== "" && !validTakeHomeLink(work.link.trim());
  return (
    <div className="take-home" role="group" aria-label={label}>
      <p className="notice">{t("takeHome.intro")}</p>
      <label className="field">
        <span>{t("takeHome.link")}</span>
        <input
          type="url"
          inputMode="url"
          placeholder="https://github.com/…"
          value={work.link}
          disabled={disabled}
          aria-invalid={badLink}
          onChange={(e) => set({ ...work, link: e.target.value })}
        />
      </label>
      {badLink ? (
        <p className="error" role="alert">
          {t("takeHome.badLink")}
        </p>
      ) : null}
      <label className="field">
        <span>{t("takeHome.notes")}</span>
        <textarea maxLength={MAX_TAKE_HOME_NOTES} value={work.notes} disabled={disabled} onChange={(e) => set({ ...work, notes: e.target.value })} />
      </label>
    </div>
  );
}
