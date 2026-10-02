import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/** Secure mode on the candidate's page (plan row 85): the whole screen shared and the room listened to, nothing captured. */

const openCamera = vi.fn();
vi.mock("./camera.ts", () => ({
  openCamera: () => openCamera(),
  CameraUnavailable: class extends Error {},
}));

let current: { onEnded: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> } | null = null;
const fakeShare = () => {
  const share = { onEnded: vi.fn(), stop: vi.fn(() => (current = null)) };
  current = share;
  return share;
};
const shareScreen = vi.fn(async () => fakeShare());
const extended = vi.fn(() => false);
vi.mock("./screen.ts", () => ({
  shareScreen: () => shareScreen(),
  currentShare: () => current,
  extendedDisplay: () => extended(),
  onDisplaysChange: () => () => undefined,
  ScreenShareUnavailable: class extends Error {
    constructor(readonly reason: string) {
      super(reason);
    }
  },
}));

let heard: (() => void) | null = null;
const checkMicrophone = vi.fn(async () => undefined);
vi.mock("./voice.ts", () => ({
  checkMicrophone: () => checkMicrophone(),
  listenForVoice: async (onVoice: () => void) => {
    heard = onVoice;
    return { stop: vi.fn() };
  },
  MicrophoneUnavailable: class extends Error {
    constructor(readonly reason: string) {
      super(reason);
    }
  },
}));

const { App } = await import("./App.tsx");
const { ScreenShareUnavailable } = await import("./screen.ts");

const SECURE = { identity: false, snapshotEverySeconds: null, browserEvents: true, screenShare: true, audio: true };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function renderApp(element: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

function stubClient() {
  const state = {
    attemptId: "a1",
    exam: {
      id: "e1",
      title: "Secure drive",
      durationMs: 3_600_000,
      allowRevision: true,
      proctoring: SECURE,
      questions: [{ id: "q1", kind: "short", stem: "Why?", maxScore: 1, translations: {} }],
    },
    state: "in_progress",
    startedAt: 1,
    expiresAt: Date.now() + 3_600_000,
    voidReason: null,
    answers: [],
    openProbe: null,
    answeredProbeCount: 0,
    drafts: [],
    identityCaptured: false,
  };
  return {
    state: vi.fn(async () => ({ ...state })),
    ledger: vi.fn(),
    heartbeat: vi.fn(async () => ({ state: "in_progress", expiresAt: state.expiresAt, announcements: 0 })),
    announcements: vi.fn(async () => []),
    saveDraft: vi.fn(async () => undefined),
    snapshot: vi.fn(async () => undefined),
    proctorEvents: vi.fn(async () => undefined),
  } as unknown as import("./api.ts").ParikshaaClient & Record<string, ReturnType<typeof vi.fn>>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  current = null;
  heard = null;
  shareScreen.mockImplementation(async () => fakeShare());
  extended.mockImplementation(() => false);
});

describe("before a secure test starts", () => {
  it("says what is watched, gets the whole screen shared and the microphone allowed, and asks for no camera", async () => {
    window.history.replaceState(null, "", "/?invite=org-a.inv-1.MAC");
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (!url.endsWith("/invitations/redeem")) return json({ error: "attempt_token_required" }, 401);
      return JSON.parse(String(init?.body)).camera === true
        ? json({ token: "eyJ.t", attemptId: "a1", resumed: false })
        : json({ error: "camera_required", proctoring: SECURE }, 428);
    });
    vi.stubGlobal("fetch", fetch);
    renderApp(<App />);

    expect(await screen.findByRole("heading", { name: "Before this test starts" })).toBeInTheDocument();
    expect(screen.getByText(/Your whole screen, shared for the whole test\. Nothing on it is recorded/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing is recorded: the browser only measures how loud it is/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Allow the camera" })).toBeNull();
    const start = screen.getByRole("button", { name: "Everything works: start" });
    expect(start).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Share my whole screen" }));
    expect(await screen.findByText("Your whole screen is shared.")).toBeInTheDocument();
    expect(start).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Allow the microphone" }));
    expect(await screen.findByText(/The microphone works/)).toBeInTheDocument();
    expect(openCamera).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Everything works: start" }));
    expect(fetch).toHaveBeenCalledWith("/api/invitations/redeem", expect.objectContaining({ body: JSON.stringify({ code: "org-a.inv-1.MAC", camera: true }) }));
  });

  it("refuses a window or a tab, and says to choose the entire screen", async () => {
    window.history.replaceState(null, "", "/?invite=org-a.inv-1.MAC");
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "camera_required", proctoring: SECURE }, 428)));
    shareScreen.mockImplementation(async () => {
      throw new ScreenShareUnavailable("window");
    });
    renderApp(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Share my whole screen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose the entire screen, not a window or a tab");
    expect(screen.getByRole("button", { name: "Everything works: start" })).toBeDisabled();
  });
});

describe("during a secure test", () => {
  it("keeps the share from before the clock, and reports a second screen and voices heard", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fakeShare();
    extended.mockImplementation(() => true);
    const client = stubClient();
    renderApp(<App client={client} />);
    expect(await screen.findByRole("heading", { name: /^1\. Why\?/ })).toBeInTheDocument();
    expect(screen.queryByText(/Your screen is no longer shared/)).toBeNull();

    await act(async () => {
      heard?.();
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(client.proctorEvents).toHaveBeenCalledWith(["second_screen", "voice"]);
  });

  it("says when sharing stops, reports it, and shares again from the page", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const share = fakeShare();
    const client = stubClient();
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: /^1\. Why\?/ });

    await act(async () => {
      (share.onEnded.mock.calls[0]![0] as () => void)();
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Your screen is no longer shared");
    expect(client.proctorEvents).toHaveBeenCalledWith(["screen_share_off"]);

    await userEvent.click(screen.getByRole("button", { name: "Share my whole screen" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(screen.queryByText(/Your screen is no longer shared/)).toBeNull();
    expect(client.proctorEvents).toHaveBeenCalledWith(["screen_share_on"]);
  });

  it("asks to share at once when the page opens without a share, as after a reload", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = stubClient();
    renderApp(<App client={client} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Your screen is no longer shared");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(client.proctorEvents).toHaveBeenCalledWith(["screen_share_off"]);
  });
});
