import { afterEach, describe, expect, it, vi } from "vitest";
import { currentShare, extendedDisplay, shareScreen, ScreenShareUnavailable } from "./screen.ts";

/** Secure mode's screen share: the whole screen or nothing, and nothing of it captured. */

function displayStream(surface: string | undefined) {
  const listeners: (() => void)[] = [];
  const track = {
    getSettings: () => (surface === undefined ? {} : { displaySurface: surface }),
    addEventListener: (_: string, l: () => void) => listeners.push(l),
    stop: vi.fn(),
  };
  return { stream: { getVideoTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream, track, end: () => listeners.forEach((l) => l()) };
}

const stubDisplay = (impl: () => Promise<MediaStream>) => {
  const getDisplayMedia = vi.fn(impl);
  vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia } });
  return getDisplayMedia;
};

afterEach(() => {
  currentShare()?.stop();
  vi.unstubAllGlobals();
});

describe("sharing the screen", () => {
  it("keeps a whole-screen share open, asking for the screen and not this tab, audio off", async () => {
    const { stream } = displayStream("monitor");
    const ask = stubDisplay(async () => stream);
    const share = await shareScreen();
    expect(currentShare()).toBe(share);
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ audio: false, selfBrowserSurface: "exclude", video: expect.objectContaining({ displaySurface: "monitor" }) }));
  });

  it("refuses a window or a tab, and stops it at once", async () => {
    const { stream, track } = displayStream("window");
    stubDisplay(async () => stream);
    await expect(shareScreen()).rejects.toEqual(new ScreenShareUnavailable("window"));
    expect(track.stop).toHaveBeenCalled();
    expect(currentShare()).toBeNull();
  });

  it("says when the candidate cancels or the browser cannot share", async () => {
    stubDisplay(async () => {
      throw new DOMException("no", "NotAllowedError");
    });
    await expect(shareScreen()).rejects.toMatchObject({ reason: "denied" });
    vi.stubGlobal("navigator", { mediaDevices: {} });
    await expect(shareScreen()).rejects.toMatchObject({ reason: "unsupported" });
  });

  it("tells the page when sharing stops, and forgets the share", async () => {
    const { stream, end } = displayStream("monitor");
    stubDisplay(async () => stream);
    const share = await shareScreen();
    const stopped = vi.fn();
    share.onEnded(stopped);
    end();
    expect(stopped).toHaveBeenCalledOnce();
    expect(currentShare()).toBeNull();
  });

  it("knows a second screen only where the browser says so", () => {
    vi.stubGlobal("screen", { isExtended: true });
    expect(extendedDisplay()).toBe(true);
    vi.stubGlobal("screen", {});
    expect(extendedDisplay()).toBe(false);
  });
});
