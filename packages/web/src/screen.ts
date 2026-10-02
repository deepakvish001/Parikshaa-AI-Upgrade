/**
 * Secure mode's screen share (docs/LAUNCH-PLAN.md, F1 Hire). The candidate
 * shares their whole screen for the sitting so that it is plain nothing else
 * is open beside the test. Nothing of the screen is captured, drawn or sent:
 * the share is held open, and only its stopping is reported. Kept to this one
 * module so the rest of the page never calls `getDisplayMedia`, and tests can
 * stand in for it.
 */

export interface ScreenShare {
  /** Called once if sharing stops: the browser's "Stop sharing" button, or the screen going away. */
  onEnded(listener: () => void): void;
  stop(): void;
}

export class ScreenShareUnavailable extends Error {
  constructor(readonly reason: "denied" | "window" | "unsupported") {
    super(`screen share ${reason}`);
    this.name = "ScreenShareUnavailable";
  }
}

let current: ScreenShare | null = null;

/** The share taken before the clock started, still running, or null. */
export const currentShare = (): ScreenShare | null => current;

/** Ask for the whole screen. A window or a tab is refused: it would hide what else is open. */
export async function shareScreen(): Promise<ScreenShare> {
  if (typeof navigator === "undefined" || navigator.mediaDevices?.getDisplayMedia === undefined) throw new ScreenShareUnavailable("unsupported");
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "monitor", frameRate: 1 },
      audio: false,
      // Chromium's hints: offer the whole screen first, and not this tab.
      monitorTypeSurfaces: "include",
      selfBrowserSurface: "exclude",
      surfaceSwitching: "exclude",
    } as DisplayMediaStreamOptions);
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    throw new ScreenShareUnavailable(name === "NotAllowedError" || name === "SecurityError" || name === "AbortError" ? "denied" : "unsupported");
  }
  const track = stream.getVideoTracks()[0];
  const surface = (track?.getSettings() as { displaySurface?: string } | undefined)?.displaySurface;
  const stop = () => stream.getTracks().forEach((t) => t.stop());
  // A browser that does not say what was shared is taken at its word; one that says "window" or "browser" is not.
  if (surface !== undefined && surface !== "monitor") {
    stop();
    throw new ScreenShareUnavailable("window");
  }
  const share: ScreenShare = {
    onEnded(listener) {
      track?.addEventListener(
        "ended",
        () => {
          if (current === share) current = null;
          listener();
        },
        { once: true },
      );
    },
    stop() {
      if (current === share) current = null;
      stop();
    },
  };
  current?.stop();
  current = share;
  return share;
}

/** Whether a second screen is connected, where the browser can tell (Chromium's `screen.isExtended`); false otherwise. */
export const extendedDisplay = (): boolean =>
  typeof window !== "undefined" && (window.screen as Screen & { isExtended?: boolean }).isExtended === true;

/** Calls back when the screens connected change, where the browser says so. Returns a function that stops listening. */
export function onDisplaysChange(listener: () => void): () => void {
  const screen = typeof window === "undefined" ? undefined : (window.screen as Screen & EventTarget);
  if (screen?.addEventListener === undefined) return () => undefined;
  screen.addEventListener("change", listener);
  return () => screen.removeEventListener("change", listener);
}
