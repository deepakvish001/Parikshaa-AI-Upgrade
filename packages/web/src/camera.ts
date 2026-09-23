/**
 * The webcam, for a proctored exam (ROADMAP §14). Kept to this one module so
 * the rest of the page never touches `getUserMedia` or a canvas directly, and
 * tests can stand in for the camera.
 */

export interface Camera {
  /** The live picture, to show the candidate what is being seen. */
  readonly stream: MediaStream;
  /** A still, as base64 JPEG (no data: prefix), `width` pixels wide. */
  capture(width: number, quality: number): string;
  /** Called once if the camera stops: unplugged, covered by the OS, permission withdrawn. */
  onEnded(listener: () => void): void;
  stop(): void;
}

export class CameraUnavailable extends Error {
  constructor(readonly reason: "denied" | "missing" | "unsupported") {
    super(`camera ${reason}`);
    this.name = "CameraUnavailable";
  }
}

export async function openCamera(): Promise<Camera> {
  if (typeof navigator === "undefined" || navigator.mediaDevices?.getUserMedia === undefined) throw new CameraUnavailable("unsupported");
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    throw new CameraUnavailable(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "missing");
  }
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play().catch(() => undefined);
  const track = stream.getVideoTracks()[0];
  return {
    stream,
    capture(width, quality) {
      const height = Math.round((width * (video.videoHeight || 3)) / (video.videoWidth || 4));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
      return canvas.toDataURL("image/jpeg", quality).replace(/^data:image\/jpeg;base64,/, "");
    },
    onEnded(listener) {
      track?.addEventListener("ended", listener, { once: true });
    },
    stop() {
      for (const t of stream.getTracks()) t.stop();
    },
  };
}
