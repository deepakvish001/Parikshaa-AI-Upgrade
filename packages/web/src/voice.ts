/**
 * Secure mode's listening (docs/LAUNCH-PLAN.md, F1 Hire): sustained speech or
 * noise near the candidate. The microphone's loudness is measured here, in the
 * browser, a few times a second; no sound is recorded, kept or sent. What
 * leaves the page is only that something was heard, and the server times it.
 */

/** Loudness, 0 to 1, above which a moment counts as sound: a voice at a desk, not a fan or a keyboard. */
export const VOICE_LEVEL = 0.06;
/** Sound must last this long to count: a cough or a dropped pen does not. */
export const VOICE_SUSTAIN_MS = 2_500;
/** After one report, this long before another, so a conversation is one note a minute, not hundreds. */
export const VOICE_COOLDOWN_MS = 60_000;

/**
 * Turns loudness readings into reports. Feed it a reading and its time; it
 * returns true when a report is due. Pure, so the rule can be tested exactly.
 */
export function voiceDetector(options: { level?: number; sustainMs?: number; cooldownMs?: number } = {}) {
  const level = options.level ?? VOICE_LEVEL;
  const sustain = options.sustainMs ?? VOICE_SUSTAIN_MS;
  const cooldown = options.cooldownMs ?? VOICE_COOLDOWN_MS;
  let loudSince: number | null = null;
  let lastReport = -Infinity;
  return (reading: number, now: number): boolean => {
    if (reading < level) {
      loudSince = null;
      return false;
    }
    loudSince ??= now;
    if (now - loudSince >= sustain && now - lastReport >= cooldown) {
      lastReport = now;
      loudSince = null;
      return true;
    }
    return false;
  };
}

/** Root-mean-square loudness of one frame of samples, 0 to 1. */
export function loudness(samples: Float32Array): number {
  let sum = 0;
  for (const s of samples) sum += s * s;
  return samples.length === 0 ? 0 : Math.sqrt(sum / samples.length);
}

export interface Listening {
  stop(): void;
}

export class MicrophoneUnavailable extends Error {
  constructor(readonly reason: "denied" | "missing" | "unsupported") {
    super(`microphone ${reason}`);
    this.name = "MicrophoneUnavailable";
  }
}

/** Ask for the microphone, so permission is settled before the clock starts. The stream is closed at once. */
export async function checkMicrophone(): Promise<void> {
  const stream = await openMicrophone();
  stream.getTracks().forEach((t) => t.stop());
}

async function openMicrophone(): Promise<MediaStream> {
  if (typeof navigator === "undefined" || navigator.mediaDevices?.getUserMedia === undefined) throw new MicrophoneUnavailable("unsupported");
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false }, video: false });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    throw new MicrophoneUnavailable(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "missing");
  }
}

/** Listen, calling `onVoice` when sustained sound is heard. */
export async function listenForVoice(onVoice: () => void, onLost: () => void): Promise<Listening> {
  const stream = await openMicrophone();
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  context.createMediaStreamSource(stream).connect(analyser);
  const frame = new Float32Array(analyser.fftSize);
  const heard = voiceDetector();
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(frame);
    if (heard(loudness(frame), Date.now())) onVoice();
  }, 250);
  stream.getAudioTracks()[0]?.addEventListener("ended", onLost, { once: true });
  return {
    stop() {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      void context.close().catch(() => undefined);
    },
  };
}
