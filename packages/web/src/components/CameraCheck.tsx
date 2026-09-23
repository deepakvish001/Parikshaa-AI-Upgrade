import { useEffect, useRef, useState } from "react";
import type { ProctoringPolicy } from "@parikshaa/core/browser";
import { CameraUnavailable, openCamera, type Camera } from "../camera.ts";
import { usePreferences } from "../i18n.tsx";

/**
 * Before a proctored exam starts: say plainly what the camera and browser
 * will be asked for, get the camera working, and only then start the clock.
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

  return (
    <section className="card camera-check" aria-labelledby="camera-heading">
      <h2 id="camera-heading" style={{ marginTop: 0 }}>
        {t("camera.heading")}
      </h2>
      <p>{t("camera.intro")}</p>
      <ul>
        {policy.identity ? <li>{t("camera.identity")}</li> : null}
        {policy.snapshotEverySeconds === null ? null : (
          <li>{t("camera.snapshots", { minutes: Math.max(1, Math.round(policy.snapshotEverySeconds / 60)) })}</li>
        )}
        {policy.browserEvents ? <li>{t("camera.events")}</li> : null}
      </ul>
      <p className="notice">{t("camera.promise")}</p>
      {camera === null ? (
        <div className="row">
          <button type="button" onClick={() => void start()}>
            {t("camera.allow")}
          </button>
        </div>
      ) : (
        <>
          <video ref={video} className="preview" muted playsInline aria-label={t("camera.preview")} />
          <div className="row">
            <button type="button" onClick={onReady}>
              {t("camera.start")}
            </button>
          </div>
        </>
      )}
      {failure === null ? null : (
        <p className="error" role="alert">
          {failure === "denied" ? t("camera.denied") : failure === "unsupported" ? t("camera.unsupported") : t("camera.missing")}
        </p>
      )}
    </section>
  );
}
