import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/** ROADMAP §14 on the candidate's page: camera first, identity photos, then photos and events while answering. */

let shots = 0;
const fakeCamera = () => ({
  stream: {} as MediaStream,
  capture: vi.fn(() => `c2hvdC${++shots}`),
  onEnded: vi.fn(),
  stop: vi.fn(),
});
const openCamera = vi.fn(async () => fakeCamera());
vi.mock("./camera.ts", () => ({
  openCamera: () => openCamera(),
  CameraUnavailable: class extends Error {
    constructor(readonly reason: string) {
      super(reason);
    }
  },
}));

const { App } = await import("./App.tsx");
const { CameraUnavailable } = await import("./camera.ts");

const POLICY = { identity: true, snapshotEverySeconds: 60, browserEvents: true };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function renderApp(element: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

function stubClient(identityCaptured: boolean) {
  const state = {
    attemptId: "a1",
    exam: {
      id: "e1",
      title: "Watched drive",
      durationMs: 3_600_000,
      allowRevision: true,
      proctoring: POLICY,
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
    identityCaptured,
  };
  return {
    state: vi.fn(async () => ({ ...state })),
    ledger: vi.fn(),
    heartbeat: vi.fn(async () => ({ state: "in_progress", expiresAt: state.expiresAt, announcements: 0 })),
    announcements: vi.fn(async () => []),
    saveDraft: vi.fn(async () => undefined),
    captureIdentity: vi.fn(async () => {
      state.identityCaptured = true;
    }),
    snapshot: vi.fn(async () => undefined),
    proctorEvents: vi.fn(async () => undefined),
  } as unknown as import("./api.ts").ParikshaaClient & Record<string, ReturnType<typeof vi.fn>>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  openCamera.mockImplementation(async () => fakeCamera());
});

describe("opening a proctored test", () => {
  it("says what the camera will take, gets it working, and only then starts the clock", async () => {
    window.history.replaceState(null, "", "/?invite=org-a.inv-1.MAC");
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (!url.endsWith("/invitations/redeem")) return json({ error: "attempt_token_required" }, 401);
      return JSON.parse(String(init?.body)).camera === true
        ? json({ token: "eyJ.t", attemptId: "a1", resumed: false })
        : json({ error: "camera_required", proctoring: POLICY }, 428);
    });
    vi.stubGlobal("fetch", fetch);
    renderApp(<App />);

    expect(await screen.findByRole("heading", { name: "This test uses your camera" })).toBeInTheDocument();
    expect(screen.getByText(/one of your photo ID/)).toBeInTheDocument();
    expect(screen.getByText(/about every 1 min/)).toBeInTheDocument();
    expect(screen.getByText(/leave this tab or full screen/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Allow the camera" }));
    await userEvent.click(await screen.findByRole("button", { name: "My camera works — start the test" }));
    expect(fetch).toHaveBeenCalledWith("/api/invitations/redeem", expect.objectContaining({ body: JSON.stringify({ code: "org-a.inv-1.MAC", camera: true }) }));
  });

  it("says how to fix a blocked camera", async () => {
    window.history.replaceState(null, "", "/?invite=org-a.inv-1.MAC");
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "camera_required", proctoring: POLICY }, 428)));
    openCamera.mockImplementation(async () => {
      throw new CameraUnavailable("denied");
    });
    renderApp(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Allow the camera" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The camera was blocked");
  });
});

describe("the identity step", () => {
  it("takes the candidate's photo, then their ID's, shows both back, and sends them before the questions", async () => {
    const client = stubClient(false);
    renderApp(<App client={client} />);

    expect(await screen.findByRole("heading", { name: "Confirm who you are" })).toBeInTheDocument();
    expect(screen.queryByText("1. Why?")).toBeNull();
    await userEvent.click(await screen.findByRole("button", { name: "Take my photo" }));
    await userEvent.click(screen.getByRole("button", { name: "Take a photo of my ID" }));
    expect(screen.getByRole("img", { name: "Your photo" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Your photo ID" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Send and start answering" }));

    expect(client.captureIdentity).toHaveBeenCalledWith(expect.stringMatching(/^c2hvdC/), expect.stringMatching(/^c2hvdC/));
    expect(await screen.findByText(/1\. Why\?/)).toBeInTheDocument();
  });
});

describe("while answering", () => {
  it("sends a photo at the interval and what the browser reported, and shows the camera is on", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = stubClient(true);
    renderApp(<App client={client} />);
    expect(await screen.findByText("Camera on")).toBeInTheDocument();
    expect(client.snapshot).toHaveBeenCalledTimes(1);

    await act(async () => {
      document.dispatchEvent(new Event("paste"));
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(client.snapshot).toHaveBeenCalledTimes(2);
    expect(client.proctorEvents).toHaveBeenCalledWith(["paste"]);
  });

  it("tells the candidate when the camera stops, and reports it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const camera = fakeCamera();
    openCamera.mockImplementation(async () => camera);
    const client = stubClient(true);
    renderApp(<App client={client} />);
    await screen.findByText("Camera on");

    await act(async () => {
      (camera.onEnded.mock.calls[0]![0] as () => void)();
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Your camera has stopped");
    expect(client.proctorEvents).toHaveBeenCalledWith(["camera_off"]);
  });
});
