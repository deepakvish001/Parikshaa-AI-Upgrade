import { useEffect, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";
import { CameraUnavailable, openCamera, type Camera } from "../camera.ts";
import { usePreferences } from "../i18n.tsx";

/** Where to hold the face, or the card, drawn over the live picture. The same in both themes. */
function Guide({ shape }: { shape: "face" | "card" }) {
  return (
    <svg className="cam-guide" viewBox="0 0 160 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {shape === "face" ? <ellipse cx="80" cy="58" rx="30" ry="40" /> : <rect x="30" y="30" width="100" height="62" rx="6" />}
    </svg>
  );
}

/**
 * The identity check (ROADMAP §14): a photo of the candidate, then of their
 * photo ID, each shown back to them to keep or retake before it is sent. An
 * invigilator compares the two; nothing here decides anything.
 */
export function IdentityCapture({ onSubmit, open = openCamera }: { onSubmit: (selfie: string, id: string) => Promise<void>; open?: () => Promise<Camera> }) {
  const { t } = usePreferences();
  const [camera, setCamera] = useState<Camera | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // A photo taken but not yet kept, and the two kept.
  const [still, setStill] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let live: Camera | null = null;
    open()
      .then((c) => {
        live = c;
        setCamera(c);
      })
      .catch((error: unknown) => setFailed(error instanceof CameraUnavailable && error.reason === "denied" ? t("camera.denied") : t("camera.missing")));
    return () => live?.stop();
  }, [open, t]);

  useEffect(() => {
    if (camera !== null && video.current !== null && still === null) {
      video.current.srcObject = camera.stream;
      void video.current.play?.()?.catch(() => undefined);
    }
  }, [camera, still]);

  const step: "selfie" | "id" = selfie === null ? "selfie" : "id";
  const take = () => {
    if (camera !== null) setStill(camera.capture(640, 0.8));
  };

  const keep = async () => {
    if (still === null) return;
    if (step === "selfie") {
      setSelfie(still);
      setStill(null);
      return;
    }
    setSending(true);
    setFailed(null);
    try {
      await onSubmit(selfie!, still);
    } catch {
      setFailed(t("identity.failed"));
      setSending(false);
    }
  };

  const steps = [
    ["selfie", t("identity.stepSelfie")],
    ["id", t("identity.stepId")],
  ] as const;

  return (
    <section className="card identity" aria-labelledby="identity-heading">
      <h2 id="identity-heading">{t("identity.heading")}</h2>
      <ol className="substeps" aria-label={t("identity.steps")}>
        {steps.map(([key, label]) => (
          <li key={key} className={key === step ? "current" : step === "id" && key === "selfie" ? "done" : undefined} aria-current={key === step ? "step" : undefined}>
            {label}
          </li>
        ))}
      </ol>
      <p>{still !== null ? t("identity.checkHint") : step === "selfie" ? t("identity.selfieHint") : t("identity.idHint")}</p>
      <div className="identity-body">
        <div className="cam-frame">
          {still === null ? (
            <>
              <video ref={video} className="preview" muted playsInline aria-label={t("camera.preview")} />
              <Guide shape={step === "selfie" ? "face" : "card"} />
            </>
          ) : (
            <img src={`data:image/jpeg;base64,${still}`} alt={step === "selfie" ? t("identity.selfieAlt") : t("identity.idAlt")} />
          )}
        </div>
        {selfie === null ? null : (
          <figure className="kept">
            <img src={`data:image/jpeg;base64,${selfie}`} alt={t("identity.selfieAlt")} />
            <figcaption>
              <button type="button" className="quiet small" disabled={sending} onClick={() => {
                  setSelfie(null);
                  setStill(null);
                }}>
                {t("identity.retakeSelfie")}
              </button>
            </figcaption>
          </figure>
        )}
      </div>
      <div className="step-actions">
        {still === null ? (
          <button type="button" className="large" disabled={camera === null} onClick={take}>
            {step === "selfie" ? t("identity.takeSelfie") : t("identity.takeId")}
          </button>
        ) : (
          <>
            <button type="button" className="secondary large" disabled={sending} onClick={() => setStill(null)}>
              {t("identity.retake")}
            </button>
            <button type="button" className="large" disabled={sending} onClick={() => void keep()}>
              {step === "selfie" ? t("identity.use") : sending ? t("identity.sending") : t("identity.send")}
            </button>
          </>
        )}
      </div>
      <p className="notice">{t("identity.note")}</p>
      {failed === null ? null : (
        <p className="field-error" role="alert">
          <CircleAlert aria-hidden="true" />
          {failed}
        </p>
      )}
    </section>
  );
}
