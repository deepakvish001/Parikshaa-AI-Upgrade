import { useEffect, useRef, useState } from "react";
import type { ProctoringPolicy } from "@parikshaa/core/browser";
import type { ParikshaaClient } from "./api.ts";
import { openCamera, type Camera } from "./camera.ts";
import { currentShare, extendedDisplay, onDisplaysChange, shareScreen, ScreenShareUnavailable, type ScreenShare } from "./screen.ts";
import { listenForVoice } from "./voice.ts";

/** Why sharing the screen again did not work, for the page to say. */
export type ShareProblem = "denied" | "window" | "unsupported";

/**
 * While a proctored attempt is open (ROADMAP §14): a webcam photo at the
 * exam's interval, and what the browser reports — the tab hidden, full screen
 * left, a copy or a paste, the camera stopping — sent in small batches.
 *
 * In secure mode, the whole screen stays shared (taken before the clock
 * started), its stopping and a second screen connecting are reported, and
 * sustained speech or noise is noted; nothing of the screen or the sound
 * leaves the page.
 *
 * Low-bandwidth mode takes smaller photos, a third as often. Nothing here
 * stops the candidate answering: a camera or a share that stops is reported,
 * and the page says so and offers to start it again, but the exam carries on.
 */
export function useProctoring(
  client: ParikshaaClient,
  policy: ProctoringPolicy | null,
  active: boolean,
  lite: boolean,
  open: () => Promise<Camera> = openCamera,
): { cameraOn: boolean | null; screenShared: boolean | null; shareAgain: () => Promise<ShareProblem | null> } {
  const [cameraOn, setCameraOn] = useState<boolean | null>(null);
  const [screenShared, setScreenShared] = useState<boolean | null>(null);
  const pending = useRef<string[]>([]);
  const every = policy?.snapshotEverySeconds ?? null;
  const watchBrowser = policy?.browserEvents ?? false;
  const secure = policy?.screenShare === true;
  const listen = policy?.audio === true;

  /** Watch a share: when it stops, say so and report it. */
  const watchShare = (share: ScreenShare) => {
    setScreenShared(true);
    share.onEnded(() => {
      setScreenShared(false);
      pending.current.push("screen_share_off");
    });
  };

  // Secure mode: the share from before the clock, a second screen, and the room.
  useEffect(() => {
    if (!active || !secure) return;
    const share = currentShare();
    if (share === null) {
      // Not shared (the page was reloaded, or sharing stopped before the questions came).
      setScreenShared(false);
      pending.current.push("screen_share_off");
    } else watchShare(share);
    let extended = extendedDisplay();
    if (extended) pending.current.push("second_screen");
    const stopWatching = onDisplaysChange(() => {
      const now = extendedDisplay();
      if (now && !extended) pending.current.push("second_screen");
      extended = now;
    });
    return () => {
      stopWatching();
      currentShare()?.stop();
    };
  }, [active, secure]);

  useEffect(() => {
    if (!active || !listen) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    listenForVoice(
      () => pending.current.push("voice"),
      () => undefined,
    )
      .then((l) => (cancelled ? l.stop() : (stop = () => l.stop())))
      .catch(() => undefined);
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [active, listen]);

  const shareAgain = async (): Promise<ShareProblem | null> => {
    try {
      const share = await shareScreen();
      pending.current.push("screen_share_on");
      watchShare(share);
      return null;
    } catch (error) {
      return error instanceof ScreenShareUnavailable ? error.reason : "unsupported";
    }
  };

  // Browser events, batched every few seconds.
  useEffect(() => {
    if (!active || policy === null) return;
    const note = (kind: string) => pending.current.push(kind);
    const onVisibility = () => document.visibilityState === "hidden" && note("tab_hidden");
    const onFullscreen = () => document.fullscreenElement === null && note("fullscreen_exit");
    const onCopy = () => note("copy");
    const onPaste = () => note("paste");
    if (watchBrowser) {
      document.addEventListener("visibilitychange", onVisibility);
      document.addEventListener("fullscreenchange", onFullscreen);
      document.addEventListener("copy", onCopy);
      document.addEventListener("paste", onPaste);
    }
    const flush = setInterval(() => {
      if (pending.current.length === 0) return;
      const batch = pending.current.splice(0, 50);
      client.proctorEvents(batch).catch(() => pending.current.unshift(...batch));
    }, 5_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      clearInterval(flush);
    };
  }, [client, policy, active, watchBrowser]);

  // Webcam photos at the interval.
  useEffect(() => {
    if (!active || every === null) return;
    let camera: Camera | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    const shoot = () => {
      if (camera === null) return;
      client.snapshot(camera.capture(lite ? 160 : 320, lite ? 0.5 : 0.6)).catch(() => undefined);
    };
    open()
      .then((c) => {
        if (cancelled) return c.stop();
        camera = c;
        setCameraOn(true);
        c.onEnded(() => {
          camera = null;
          setCameraOn(false);
          pending.current.push("camera_off");
        });
        shoot();
        timer = setInterval(shoot, every * 1000 * (lite ? 3 : 1));
      })
      .catch(() => {
        setCameraOn(false);
        pending.current.push("camera_off");
      });
    return () => {
      cancelled = true;
      clearInterval(timer);
      camera?.stop();
    };
  }, [client, every, active, lite, open]);

  return { cameraOn, screenShared, shareAgain };
}
