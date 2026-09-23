import { useEffect, useRef, useState } from "react";
import { CameraUnavailable, openCamera, type Camera } from "../camera.ts";
import { usePreferences } from "../i18n.tsx";

/**
 * The identity check (ROADMAP §14): a photo of the candidate, then of their
 * photo ID, each shown back to them before it is sent. An invigilator
 * compares the two; nothing here decides anything.
 */
export function IdentityCapture({ onSubmit, open = openCamera }: { onSubmit: (selfie: string, id: string) => Promise<void>; open?: () => Promise<Camera> }) {
  const { t } = usePreferences();
  const [camera, setCamera] = useState<Camera | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(null);
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
    if (camera !== null && video.current !== null) {
      video.current.srcObject = camera.stream;
      void video.current.play?.()?.catch(() => undefined);
    }
  }, [camera]);

  const step: "selfie" | "id" | "review" = selfie === null ? "selfie" : id === null ? "id" : "review";
  const take = () => {
    if (camera === null) return;
    const shot = camera.capture(640, 0.8);
    if (step === "selfie") setSelfie(shot);
    else setId(shot);
  };

  const send = async () => {
    if (selfie === null || id === null) return;
    setSending(true);
    setFailed(null);
    try {
      await onSubmit(selfie, id);
    } catch {
      setFailed(t("identity.failed"));
      setSending(false);
    }
  };

  return (
    <section className="card identity" aria-labelledby="identity-heading">
      <h2 id="identity-heading" style={{ marginTop: 0 }}>
        {t("identity.heading")}
      </h2>
      <ol className="steps" aria-label={t("identity.steps")}>
        <li aria-current={step === "selfie" ? "step" : undefined}>{t("identity.stepSelfie")}</li>
        <li aria-current={step === "id" ? "step" : undefined}>{t("identity.stepId")}</li>
        <li aria-current={step === "review" ? "step" : undefined}>{t("identity.stepSend")}</li>
      </ol>
      <p>{step === "selfie" ? t("identity.selfieHint") : step === "id" ? t("identity.idHint") : t("identity.reviewHint")}</p>
      {step === "review" ? (
        <div className="shots">
          <figure>
            <img src={`data:image/jpeg;base64,${selfie}`} alt={t("identity.selfieAlt")} />
            <figcaption>
              <button type="button" className="quiet" onClick={() => setSelfie(null)}>
                {t("identity.retakeSelfie")}
              </button>
            </figcaption>
          </figure>
          <figure>
            <img src={`data:image/jpeg;base64,${id}`} alt={t("identity.idAlt")} />
            <figcaption>
              <button type="button" className="quiet" onClick={() => setId(null)}>
                {t("identity.retakeId")}
              </button>
            </figcaption>
          </figure>
        </div>
      ) : (
        <video ref={video} className="preview" muted playsInline aria-label={t("camera.preview")} />
      )}
      <div className="row">
        {step === "review" ? (
          <button type="button" disabled={sending} onClick={() => void send()}>
            {sending ? t("identity.sending") : t("identity.send")}
          </button>
        ) : (
          <button type="button" disabled={camera === null} onClick={take}>
            {step === "selfie" ? t("identity.takeSelfie") : t("identity.takeId")}
          </button>
        )}
      </div>
      <p className="notice">{t("identity.note")}</p>
      {failed === null ? null : (
        <p className="error" role="alert">
          {failed}
        </p>
      )}
    </section>
  );
}
