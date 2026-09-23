import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.tsx";

/** Opening an invitation link, as a candidate does (ROADMAP §5). */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function renderApp(element: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

const state = {
  attemptId: "a1",
  exam: { id: "e1", title: "Campus drive", durationMs: 3_600_000, allowRevision: true, questions: [] },
  state: "in_progress",
  startedAt: 1,
  expiresAt: Date.now() + 3_600_000,
  voidReason: null,
  answers: [],
  openProbe: null,
  answeredProbeCount: 0,
  drafts: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("an invitation link", () => {
  it("opens the test, and takes the code out of the address bar", async () => {
    window.history.replaceState(null, "", "/?invite=org-a.inv-1.MAC");
    const fetch = vi.fn(async (url: string) =>
      url.endsWith("/invitations/redeem") ? json({ token: "eyJ.token", attemptId: "a1", resumed: false }) : json(state),
    );
    vi.stubGlobal("fetch", fetch);

    renderApp(<App />);

    expect(await screen.findByRole("heading", { name: "Campus drive" })).toBeInTheDocument();
    expect(window.location.search).toBe("");
    expect(sessionStorage.getItem("parikshaa.invite")).toBe("org-a.inv-1.MAC");
    expect(fetch).toHaveBeenCalledWith("/api/invitations/redeem", expect.objectContaining({ body: JSON.stringify({ code: "org-a.inv-1.MAC" }) }));
  });

  it("says when to come back if it is early, in IST, and that nothing has started", async () => {
    window.history.replaceState(null, "", "/?invite=org-a.inv-1.MAC");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: "not_open_yet", opensAt: "2026-10-01T04:30:00.000Z", closesAt: "2026-10-01T07:30:00.000Z" }, 403)),
    );

    renderApp(<App />);

    const early = await screen.findByRole("region", { name: "Not open yet" });
    expect(early).toHaveTextContent(/10:00\s?am IST/i);
    expect(early).toHaveTextContent(/Nothing has started yet/);
  });

  it("says plainly when the window has closed", async () => {
    window.history.replaceState(null, "", "/?invite=org-a.inv-1.MAC");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: "window_closed", opensAt: "2026-10-01T04:30:00.000Z", closesAt: "2026-10-01T07:30:00.000Z" }, 410)),
    );

    renderApp(<App />);

    expect(await screen.findByRole("region", { name: "Closed" })).toHaveTextContent(/1:00\s?pm IST/i);
  });

  it("offers the code box when a link does not work", async () => {
    window.history.replaceState(null, "", "/?invite=org-a.bad.MAC");
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "invalid_invitation" }, 404)));

    renderApp(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "I have an access code instead" }));
    expect(screen.getByLabelText("Access code")).toBeInTheDocument();
  });

  it("opens again by itself when its token runs out", async () => {
    sessionStorage.setItem("parikshaa.invite", "org-a.inv-1.MAC");
    sessionStorage.setItem("parikshaa.attempt-token", "eyJ.expired");
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/invitations/redeem")) return json({ token: "eyJ.fresh", attemptId: "a1", resumed: true });
      const auth = (init?.headers as Record<string, string> | undefined)?.["authorization"];
      return auth === "Bearer eyJ.fresh" ? json(state) : json({ error: "invalid_attempt_token" }, 401);
    });
    vi.stubGlobal("fetch", fetch);

    renderApp(<App />);

    expect(await screen.findByRole("heading", { name: "Campus drive" })).toBeInTheDocument();
    await waitFor(() => expect(sessionStorage.getItem("parikshaa.attempt-token")).toBe("eyJ.fresh"));
  });

  it("accepts an invitation code pasted into the code box", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/invitations/redeem") ? json({ token: "eyJ.t", attemptId: "a1", resumed: false }) : json(state),
      ),
    );
    renderApp(<App />);

    await userEvent.type(screen.getByLabelText("Access code"), "org-a.inv-1.MAC");
    await userEvent.click(screen.getByRole("button", { name: "Begin" }));

    expect(await screen.findByRole("heading", { name: "Campus drive" })).toBeInTheDocument();
  });

  it("shows the privacy notice first, and starts only once it is agreed to", async () => {
    window.history.replaceState(null, "", "/?invite=org-a.inv-1.MAC");
    const notice = {
      version: 3,
      hash: "ab".repeat(32),
      controllerName: "Acme Technologies Pvt Ltd",
      purpose: "To assess candidates for engineering roles.",
      retentionDays: 90,
      grievance: { name: "Priya Menon", email: "privacy@acme.test" },
      collected: ["Your answers."],
      rights: ["Have it erased."],
    };
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (!url.endsWith("/invitations/redeem")) return json(state);
      const body = JSON.parse(String(init?.body)) as { consent?: { noticeVersion: number } };
      return body.consent?.noticeVersion === 3
        ? json({ token: "eyJ.token", attemptId: "a1", resumed: false })
        : json({ error: "consent_required", notice }, 428);
    });
    vi.stubGlobal("fetch", fetch);

    renderApp(<App />);

    expect(await screen.findByRole("heading", { name: "Before you start: your data" })).toBeInTheDocument();
    expect(screen.getByText("Acme Technologies Pvt Ltd")).toBeInTheDocument();
    expect(screen.getByText(/90 days after you finish/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "privacy@acme.test" })).toHaveAttribute("href", "mailto:privacy@acme.test");
    const start = screen.getByRole("button", { name: "Agree and start the test" });
    expect(start).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox", { name: /agree to my data being used/ }));
    await userEvent.click(start);

    expect(await screen.findByRole("heading", { name: "Campus drive" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/invitations/redeem",
      expect.objectContaining({ body: JSON.stringify({ code: "org-a.inv-1.MAC", consent: { noticeVersion: 3 } }) }),
    );
  });
});
