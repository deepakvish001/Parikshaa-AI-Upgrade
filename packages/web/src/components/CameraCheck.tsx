import { useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, CircleAlert, CircleCheck, Eye, ImageUp, Mic, Monitor, MousePointerClick, ShieldCheck } from "lucide-react";
import type { ProctoringPolicy } from "@parikshaa/core/browser";
import { CameraUnavailable, openCamera, type Camera } from "../camera.ts";
import { shareScreen, ScreenShareUnavailable } from "../screen.ts";
import { checkMicrophone, MicrophoneUnavailable } from "../voice.ts";
import { usePreferences, type MessageKey } from "../i18n.tsx";

/** Where to find the camera permission, in the browser the candidate is using. */
function blockedHelp(): MessageKey {
  const agent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/Firefox\//.test(agent)) return "camera.helpFirefox";
  if (/Safari\//.test(agent) && !/Chrom(e|ium)\//.test(agent)) return "camera.helpSafari";
  return "camera.helpChrome";
}

/**
 * Before a proctored exam starts: say plainly what the camera, screen,
 * microphone and browser will be asked for, and get each working — the camera
 * allowed and seen to work, the whole screen shared (secure mode), the
 * microphone allowed. Nothing starts here; the instructions come next, and
 * the clock after them. The screen share stays open into the test.
 */
export function CameraCheck({ policy, onReady, open = openCamera }: { policy: ProctoringPolicy; onReady: () => void; open?: () => Promise<Camera> }) {
  const { t } = usePreferences();
  const [camera, setCamera] = useState<Camera | null>(null);
  const [failure, setFailure] = useState<"denied" | "missing" | "unsupported" | null>(null);
  const [shared, setShared] = useState(false);
  const [screenFailure, setScreenFailure] = useState<"denied" | "window" | "unsupported" | null>(null);
  const [micOk, setMicOk] = useState(false);
  const [micFailure, setMicFailure] = useState<"denied" | "missing" | "unsupported" | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const needsCamera = policy.identity || policy.snapshotEverySeconds !== null;
  const needsScreen = policy.screenShare === true;
  const needsMic = policy.audio === true;
  const devices = needsScreen || needsMic;

  const share = async () => {
    setScreenFailure(null);
    try {
      const s = await shareScreen();
      setShared(true);
      s.onEnded(() => setShared(false));
    } catch (error) {
      setScreenFailure(error instanceof ScreenShareUnavailable ? error.reason : "unsupported");
    }
  };

  const allowMic = async () => {
    setMicFailure(null);
    try {
      await checkMicrophone();
      setMicOk(true);
    } catch (error) {
      setMicFailure(error instanceof MicrophoneUnavailable ? error.reason : "missing");
    }
  };

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
    ...(needsScreen ? [{ icon: Monitor, text: t("camera.screen") }] : []),
    ...(needsMic ? [{ icon: Mic, text: t("camera.audio") }] : []),
  ];

  const steps = [
    ...(needsCamera ? [{ key: "camera", label: t("camera.stepAllow"), done: camera !== null }] : []),
    ...(needsScreen ? [{ key: "screen", label: t("camera.stepScreen"), done: shared }] : []),
    ...(needsMic ? [{ key: "mic", label: t("camera.stepMic"), done: micOk }] : []),
    { key: "check", label: t("camera.stepCheck"), done: false },
  ];
  const current = steps.find((s) => !s.done)?.key;
  const ready = (!needsCamera || camera !== null) && (!needsScreen || shared) && (!needsMic || micOk);

  return (
    <section className="gate-card camera-check" aria-labelledby="camera-heading">
      <h1 id="camera-heading">{devices ? t("camera.headingDevices") : t("camera.heading")}</h1>
      <ol className="substeps" aria-label={t("steps.camera")}>
        {steps.map((s) => (
          <li key={s.key} className={s.key === current ? "current" : s.done ? "done" : undefined} aria-current={s.key === current ? "step" : undefined}>
            {s.label}
          </li>
        ))}
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
        {needsCamera ? (
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
        ) : null}
      </div>
      {devices ? (
        <ul className="device-checks">
          {needsScreen ? (
            <li>
              <Monitor aria-hidden="true" />
              {shared ? (
                <p className="camera-ok">
                  <CircleCheck aria-hidden="true" />
                  {t("camera.screenShared")}
                </p>
              ) : (
                <button type="button" onClick={() => void share()}>
                  {t("camera.shareScreen")}
                </button>
              )}
            </li>
          ) : null}
          {needsMic ? (
            <li>
              <Mic aria-hidden="true" />
              {micOk ? (
                <p className="camera-ok">
                  <CircleCheck aria-hidden="true" />
                  {t("camera.micOn")}
                </p>
              ) : (
                <button type="button" onClick={() => void allowMic()}>
                  {t("camera.allowMic")}
                </button>
              )}
            </li>
          ) : null}
        </ul>
      ) : null}
      {failure === null ? null : (
        <div className="field-error camera-error" role="alert">
          <CircleAlert aria-hidden="true" />
          <div>
            <p>{failure === "denied" ? t("camera.denied") : failure === "unsupported" ? t("camera.unsupported") : t("camera.missing")}</p>
            {failure === "denied" ? <p>{t(blockedHelp())}</p> : null}
          </div>
        </div>
      )}
      {screenFailure === null ? null : (
        <div className="field-error camera-error" role="alert">
          <CircleAlert aria-hidden="true" />
          <p>{screenFailure === "window" ? t("camera.screenWindow") : screenFailure === "denied" ? t("camera.screenDenied") : t("camera.screenUnsupported")}</p>
        </div>
      )}
      {micFailure === null ? null : (
        <div className="field-error camera-error" role="alert">
          <CircleAlert aria-hidden="true" />
          <p>{micFailure === "denied" ? t("camera.micDenied") : micFailure === "unsupported" ? t("camera.unsupported") : t("camera.micMissing")}</p>
        </div>
      )}
      <div className="step-actions">
        {needsCamera && camera === null ? (
          <button type="button" className="large" onClick={() => void start()}>
            {failure === null ? t("camera.allow") : t("camera.again")}
          </button>
        ) : (
          <button type="button" className="large" onClick={onReady} disabled={!ready}>
            {devices ? t("camera.ready") : t("camera.start")}
          </button>
        )}
      </div>
    </section>
  );
}
