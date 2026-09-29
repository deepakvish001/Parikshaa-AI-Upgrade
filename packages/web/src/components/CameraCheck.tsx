import { useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, CircleAlert, CircleCheck, Eye, ImageUp, MousePointerClick, ShieldCheck } from "lucide-react";
import type { ProctoringPolicy } from "@parikshaa/core/browser";
import { CameraUnavailable, openCamera, type Camera } from "../camera.ts";
import { usePreferences, type MessageKey } from "../i18n.tsx";

/** Where to find the camera permission, in the browser the candidate is using. */
function blockedHelp(): MessageKey {
  const agent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/Firefox\//.test(agent)) return "camera.helpFirefox";
  if (/Safari\//.test(agent) && !/Chrom(e|ium)\//.test(agent)) return "camera.helpSafari";
  return "camera.helpChrome";
}

/**
 * Before a proctored exam starts: say plainly what the camera and browser
 * will be asked for, and get the camera working — allow, then see it work.
 * Nothing starts here; the instructions come next, and the clock after them.
 */
export function CameraCheck({ policy, onReady, open = openCamera }: { policy: ProctoringPolicy; onReady: () => void; open?: () => Promise<Camera> }) {
  const { t } = usePreferences();
  const [camera, setCamera] = useState<Camera | null>(null);
  const [failure, setFailure] = useState<"denied" | "missing" | "unsupported" | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  const start = async () => {
    setFailure(null);
    try {
      setCamera(await open());
    } catch (error) {
      setFailure(error instanceof CameraUnavailable ? error.reason : "missing");
    }
  };

  useEffect(() => {
    if (camera !== null && video.current !== null) {
      video.current.srcObject = camera.stream;
      void video.current.play?.()?.catch(() => undefined);
    }
    return () => camera?.stop();
  }, [camera]);

  const taken = [
    ...(policy.identity ? [{ icon: ImageUp, text: t("camera.identity") }] : []),
    ...(policy.snapshotEverySeconds === null
      ? []
      : [{ icon: CameraIcon, text: t("camera.snapshots", { minutes: Math.max(1, Math.round(policy.snapshotEverySeconds / 60)) }) }]),
    ...(policy.browserEvents ? [{ icon: MousePointerClick, text: t("camera.events") }] : []),
  ];

  return (
    <section className="gate-card camera-check" aria-labelledby="camera-heading">
      <h1 id="camera-heading">{t("camera.heading")}</h1>
      <ol className="substeps" aria-label={t("steps.camera")}>
        <li className={camera === null ? "current" : "done"} aria-current={camera === null ? "step" : undefined}>
          {t("camera.stepAllow")}
        </li>
        <li className={camera === null ? undefined : "current"} aria-current={camera === null ? undefined : "step"}>
          {t("camera.stepCheck")}
        </li>
      </ol>
      <div className="camera-body">
        <div className="camera-what">
          <p>{t("camera.intro")}</p>
          <ul className="taken">
            {taken.map(({ icon: Icon, text }) => (
              <li key={text}>
                <Icon aria-hidden="true" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <p className="promise">
            <ShieldCheck aria-hidden="true" />
            <span>{t("camera.promise")}</span>
          </p>
        </div>
        <div className="camera-view">
          {camera === null ? (
            <div className="preview-off">
              <Eye aria-hidden="true" />
              <span>{t("camera.off")}</span>
            </div>
          ) : (
            <video ref={video} className="preview" muted playsInline aria-label={t("camera.preview")} />
          )}
          {camera === null ? null : (
            <p className="camera-ok">
              <CircleCheck aria-hidden="true" />
              {t("camera.seeYourself")}
            </p>
          )}
        </div>
      </div>
      {failure === null ? null : (
        <div className="field-error camera-error" role="alert">
          <CircleAlert aria-hidden="true" />
          <div>
            <p>{failure === "denied" ? t("camera.denied") : failure === "unsupported" ? t("camera.unsupported") : t("camera.missing")}</p>
            {failure === "denied" ? <p>{t(blockedHelp())}</p> : null}
          </div>
        </div>
      )}
      <div className="step-actions">
        {camera === null ? (
          <button type="button" className="large" onClick={() => void start()}>
            {failure === null ? t("camera.allow") : t("camera.again")}
          </button>
        ) : (
          <button type="button" className="large" onClick={onReady}>
            {t("camera.start")}
          </button>
        )}
      </div>
    </section>
  );
}
