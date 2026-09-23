import { useCallback, useEffect, useState } from "react";
import { ApiError, redeemInvitation, type Notice } from "../api.ts";
import { PreferencesBar, uiLocaleOf, usePreferences } from "../i18n.tsx";
import type { ProctoringPolicy } from "@parikshaa/core/browser";
import { CameraCheck } from "./CameraCheck.tsx";

interface Props {
  readonly code: string;
  readonly onOpened: (token: string) => void;
  /** Leave the invitation and enter a code by hand instead. */
  readonly onForget: () => void;
}

type Stage =
  | { readonly kind: "opening" }
  | { readonly kind: "notice"; readonly notice: Notice }
  | { readonly kind: "camera"; readonly policy: ProctoringPolicy; readonly consent: { noticeVersion: number } | undefined }
  | { readonly kind: "early"; readonly opensAt: string }
  | { readonly kind: "closed"; readonly closesAt: string }
  | { readonly kind: "invalid" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "offline" };

/** Times as the candidate reads them: IST, spelled out. */
const ist = (iso: string, locale: "en" | "hi" = "en") =>
  `${new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" }).format(new Date(iso))} IST`;

/**
 * Opening an invitation link.
 *
 * Early, the candidate is told exactly when to come back, and the page lets
 * them in by itself at that moment. After the window, it says so plainly. An
 * invalid link says only that, and who to ask.
 */
export function InviteGate({ code, onOpened, onForget }: Props) {
  const { t, language } = usePreferences();
  const ui = uiLocaleOf(language);
  const [stage, setStage] = useState<Stage>({ kind: "opening" });

  const open = useCallback(async (consent?: { noticeVersion: number }, camera?: boolean) => {
    setStage({ kind: "opening" });
    try {
      onOpened((await redeemInvitation(code, "/api", consent, camera)).token);
    } catch (error) {
      if (!(error instanceof ApiError)) return setStage({ kind: "offline" });
      // The organisation's account, not the candidate's doing: say so without the details.
      if (error.code === "out_of_credits") return setStage({ kind: "unavailable" });
      if (error.code === "camera_required") return setStage({ kind: "camera", policy: error.detail["proctoring"] as ProctoringPolicy, consent });
      if (error.code === "consent_required") return setStage({ kind: "notice", notice: error.detail["notice"] as Notice });
      if (error.code === "not_open_yet") return setStage({ kind: "early", opensAt: String(error.detail["opensAt"]) });
      if (error.code === "window_closed") return setStage({ kind: "closed", closesAt: String(error.detail["closesAt"]) });
      setStage({ kind: "invalid" });
    }
  }, [code, onOpened]);

  useEffect(() => {
    void open();
  }, [open]);

  // Early: try again at the moment the window opens, and at most every minute.
  useEffect(() => {
    if (stage.kind !== "early") return;
    const wait = Math.max(1_000, Math.min(Date.parse(stage.opensAt) - Date.now() + 1_000, 60_000));
    const timer = setTimeout(() => void open(), wait);
    return () => clearTimeout(timer);
  }, [stage, open]);

  return (
    <main className="gate">
      <PreferencesBar />
      <h1>Parikshaa</h1>
      {stage.kind === "opening" ? <p className="notice">{t("invite.opening")}</p> : null}
      {stage.kind === "notice" ? <PrivacyNotice notice={stage.notice} onAgree={() => void open({ noticeVersion: stage.notice.version })} /> : null}
      {stage.kind === "camera" ? <CameraCheck policy={stage.policy} onReady={() => void open(stage.consent, true)} /> : null}
      {stage.kind === "early" ? (
        <section className="card" aria-label={t("invite.earlyRegion")}>
          <p style={{ marginTop: 0 }}>{t("invite.opensOn")}</p>
          <p className="when">{ist(stage.opensAt, ui)}</p>
          <p className="notice">{t("invite.earlyNote")}</p>
        </section>
      ) : null}
      {stage.kind === "closed" ? (
        <section className="card" aria-label={t("invite.closedRegion")}>
          <p style={{ marginTop: 0 }}>{t("invite.closedOn", { when: ist(stage.closesAt, ui) })}</p>
          <p className="notice">{t("invite.closedNote")}</p>
        </section>
      ) : null}
      {stage.kind === "invalid" ? (
        <section className="card" aria-label={t("invite.invalidRegion")}>
          <p style={{ marginTop: 0 }}>{t("invite.invalid")}</p>
          <p className="notice">{t("invite.invalidNote")}</p>
          <button type="button" className="secondary" onClick={onForget}>
            {t("invite.haveCode")}
          </button>
        </section>
      ) : null}
      {stage.kind === "unavailable" ? (
        <section className="card" aria-label={t("invite.unavailableRegion")}>
          <p style={{ marginTop: 0 }}>{t("invite.unavailable")}</p>
          <p className="notice">{t("invite.unavailableNote")}</p>
          <button type="button" onClick={() => void open()}>
            {t("invite.tryAgain")}
          </button>
        </section>
      ) : null}
      {stage.kind === "offline" ? (
        <section className="card" aria-label={t("invite.offlineRegion")}>
          <p style={{ marginTop: 0 }}>{t("invite.offline")}</p>
          <button type="button" onClick={() => void open()}>
            {t("invite.tryAgain")}
          </button>
        </section>
      ) : null}
    </main>
  );
}

/**
 * The organisation's privacy notice, before anything starts (DPDP Act, s.5–6).
 * Reading it costs no test time: the clock starts only once it is agreed to.
 */
function PrivacyNotice({ notice, onAgree }: { notice: Notice; onAgree: () => void }) {
  const { t, language } = usePreferences();
  const [agreed, setAgreed] = useState(false);
  // The standing parts of the notice, in the candidate's language where Parikshaa has them.
  const own = uiLocaleOf(language) === "hi" ? notice.translations?.hi : undefined;
  const collected = own?.collected ?? notice.collected;
  const rights = own?.rights ?? notice.rights;
  return (
    <section className="card notice-card" aria-labelledby="privacy-heading">
      <h2 id="privacy-heading" style={{ marginTop: 0 }}>
        {t("notice.heading")}
      </h2>
      <p>
        <strong>{notice.controllerName}</strong>
        {t("notice.responsible")}
      </p>
      <h3>{t("notice.why")}</h3>
      <p>{notice.purpose}</p>
      <h3>{t("notice.collected")}</h3>
      <ul>
        {collected.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h3>{t("notice.kept")}</h3>
      <p>{t("notice.keptFor", { days: notice.retentionDays })}</p>
      <h3>{t("notice.rights")}</h3>
      <ul>
        {rights.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>
        {t("notice.grievance")}: {notice.grievance.name}, <a href={`mailto:${notice.grievance.email}`}>{notice.grievance.email}</a>
      </p>
      <label className="inline">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /> {t("notice.agree")}
      </label>
      <div className="row">
        <button type="button" disabled={!agreed} onClick={onAgree}>
          {t("notice.start")}
        </button>
      </div>
      <p className="notice">{t("notice.version", { version: notice.version })}</p>
    </section>
  );
}
