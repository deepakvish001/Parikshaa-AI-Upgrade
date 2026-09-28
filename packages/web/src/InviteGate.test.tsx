import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
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

const brief = {
  title: "Campus drive",
  candidate: { name: "Ananya Iyer", ref: "CS001" },
  started: false,
  opensAt: new Date(Date.now() - 60_000).toISOString(),
  closesAt: new Date(Date.now() + 3_600_000).toISOString(),
  durationMs: 3_600_000,
  questionCount: 20,
  totalMarks: 80,
  sections: [],
  kinds: ["mcq", "numeric"],
  negativeMarks: 1,
  allowRevision: true,
  calculator: true,
  proctored: false,
  proctoring: null,
  notice: null,
};

const NOTICE = {
  version: 3,
  hash: "ab".repeat(32),
  controllerName: "Acme Technologies Pvt Ltd",
  purpose: "To assess candidates for engineering roles.",
  retentionDays: 90,
  grievance: { name: "Priya Menon", email: "privacy@acme.test" },
  collected: ["Your answers."],
  rights: ["Have it erased."],
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
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

  it("shows the instructions and a system check first, and starts the clock only at Ready to begin", async () => {
    window.history.replaceState(null, "", "/?invite=org-a.inv-1.MAC");
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/invitations/briefing")) return json(brief);
      if (url.endsWith("/invitations/redeem")) return json({ token: "eyJ.token", attemptId: "a1", resumed: false });
      if (url.endsWith("/health")) return json({ ok: true });
      return json(state);
    });
    vi.stubGlobal("fetch", fetch);

    renderApp(<App />);

    const page = await screen.findByRole("region", { name: "Campus drive" });
    // One step before the clock, and it is the last.
    const steps = screen.getByRole("list", { name: "Steps before the test" });
    expect(within(steps).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["1Instructions", "2Begin"]);
    expect(within(steps).getByText("Instructions").closest("li")).toHaveAttribute("aria-current", "step");
    expect(page).toHaveTextContent("Ananya Iyer");
    expect(page).toHaveTextContent("Roll number: CS001");
    expect(page).toHaveTextContent("60 min");
    expect(page).toHaveTextContent("A wrong answer can cost up to 1 mark.");
    // Each shortcut key a chip, beside what it does.
    expect(within(page).getByRole("heading", { name: "From the keyboard" })).toBeInTheDocument();
    expect(within(page).getByText("Esc").tagName).toBe("KBD");
    expect(page).toHaveTextContent("An on-screen calculator is in the bar under the clock.");
    expect(await screen.findByText(/^Good \(\d+ ms\)$/)).toBeInTheDocument();
    // Reading costs nothing: the link has not been opened.
    expect(fetch).not.toHaveBeenCalledWith("/api/invitations/redeem", expect.anything());

    const begin = screen.getByRole("button", { name: "I am ready to begin" });
    expect(begin).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: /I have read the instructions/ }));
    await userEvent.click(begin);

    // The exam, with its clock: only now has the link been opened.
    expect(await screen.findByRole("timer")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/invitations/redeem", expect.anything());
  });

  it("goes straight back into a test already begun", async () => {
    window.history.replaceState(null, "", "/?invite=org-a.inv-1.MAC");
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/invitations/briefing")) {
        return json({ started: true, opensAt: new Date(Date.now() - 60_000).toISOString(), closesAt: new Date(Date.now() + 60_000).toISOString() });
      }
      if (url.endsWith("/invitations/redeem")) return json({ token: "eyJ.token", attemptId: "a1", resumed: true });
      return json(state);
    });
    vi.stubGlobal("fetch", fetch);

    renderApp(<App />);

    expect(await screen.findByRole("heading", { name: "Campus drive" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "I am ready to begin" })).not.toBeInTheDocument();
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

  it("counts down to the opening, says what to get ready, and lets the candidate in by itself", async () => {
    window.history.replaceState(null, "", "/?invite=org-a.inv-1.MAC");
    const opensAt = new Date(Date.now() + 90 * 60_000).toISOString();
    const early = { ...brief, opensAt, proctored: true, proctoring: { identity: true, snapshotEverySeconds: 60, browserEvents: true } };
    const fetch = vi.fn(async (url: string) => (url.endsWith("/invitations/briefing") ? json(early) : json({ error: "not_open_yet", opensAt }, 403)));
    vi.stubGlobal("fetch", fetch);

    renderApp(<App />);

    const page = await screen.findByRole("region", { name: "Not open yet" });
    expect(within(page).getByRole("heading", { level: 1 })).toHaveTextContent("Campus drive");
    expect(within(page).getByRole("timer")).toHaveAccessibleName(/^Opens in 1:(29|30):\d\d$/);
    expect(page).toHaveTextContent("Keep your photo ID card with you.");
    // A proctored test adds the camera to what to get ready.
    expect(page).toHaveTextContent(/This test uses your camera/);
    // Waiting opens nothing.
    expect(fetch).not.toHaveBeenCalledWith("/api/invitations/redeem", expect.anything());
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

  it("shows the privacy notice first, then the instructions, and starts only at the last button", async () => {
    window.history.replaceState(null, "", "/?invite=org-a.inv-1.MAC");
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/invitations/briefing")) return json({ ...brief, notice: NOTICE });
      if (url.endsWith("/invitations/redeem")) return json({ token: "eyJ.token", attemptId: "a1", resumed: false });
      if (url.endsWith("/health")) return json({ ok: true });
      return json(state);
    });
    vi.stubGlobal("fetch", fetch);

    renderApp(<App />);

    expect(await screen.findByRole("heading", { name: "Before you start: your data" })).toBeInTheDocument();
    const steps = screen.getByRole("list", { name: "Steps before the test" });
    expect(within(steps).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["1Your data", "2Instructions", "3Begin"]);
    // The short version first: who, why, how long, and the rights.
    const glance = screen.getByLabelText("At a glance");
    expect(glance).toHaveTextContent("Acme Technologies Pvt Ltd");
    expect(glance).toHaveTextContent("90 days after you finish");
    expect(screen.getByRole("link", { name: "privacy@acme.test" })).toHaveAttribute("href", "mailto:privacy@acme.test");
    expect(screen.getByText("Notice version 3")).toBeInTheDocument();
    const agree = screen.getByRole("button", { name: "Agree and continue" });
    expect(agree).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox", { name: /agree to my data being used/ }));
    await userEvent.click(agree);

    // Agreeing opened nothing: the instructions come next, and only they start the clock.
    expect(await screen.findByRole("region", { name: "Campus drive" })).toBeInTheDocument();
    expect(within(steps).getByText("Your data").closest("li")).toHaveClass("done");
    expect(fetch).not.toHaveBeenCalledWith("/api/invitations/redeem", expect.anything());
    await userEvent.click(screen.getByRole("checkbox", { name: /I have read the instructions/ }));
    await userEvent.click(screen.getByRole("button", { name: "I am ready to begin" }));

    expect(await screen.findByRole("heading", { name: "Campus drive" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/invitations/redeem",
      expect.objectContaining({ body: JSON.stringify({ code: "org-a.inv-1.MAC", consent: { noticeVersion: 3 } }) }),
    );
  });

  it("asks for agreement when opening does, if the briefing could not say so first", async () => {
    window.history.replaceState(null, "", "/?invite=org-a.inv-1.MAC");
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (!url.endsWith("/invitations/redeem")) return json(state);
      const body = JSON.parse(String(init?.body)) as { consent?: { noticeVersion: number } };
      return body.consent?.noticeVersion === 3
        ? json({ token: "eyJ.token", attemptId: "a1", resumed: false })
        : json({ error: "consent_required", notice: NOTICE }, 428);
    });
    vi.stubGlobal("fetch", fetch);

    renderApp(<App />);

    expect(await screen.findByRole("heading", { name: "Before you start: your data" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /agree to my data being used/ }));
    await userEvent.click(screen.getByRole("button", { name: "Agree and continue" }));

    expect(await screen.findByRole("heading", { name: "Campus drive" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/invitations/redeem",
      expect.objectContaining({ body: JSON.stringify({ code: "org-a.inv-1.MAC", consent: { noticeVersion: 3 } }) }),
    );
  });

  it("shows the notice in Hindi to a candidate reading in Hindi", async () => {
    localStorage.setItem("parikshaa.language", "hi");
    window.history.replaceState(null, "", "/?invite=org-a.inv-1.MAC");
    const notice = {
      version: 1,
      hash: "ab".repeat(32),
      controllerName: "Acme",
      purpose: "Hiring.",
      retentionDays: 30,
      grievance: { name: "Priya", email: "p@acme.test" },
      collected: ["Your answers."],
      rights: ["Have it erased."],
      translations: { hi: { collected: ["आपके उत्तर।"], rights: ["इसे मिटवाएँ।"] } },
    };
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "consent_required", notice }, 428)));

    renderApp(<App />);

    expect(await screen.findByRole("heading", { name: "शुरू करने से पहले: आपका डेटा" })).toBeInTheDocument();
    expect(screen.getByText("आपके उत्तर।")).toBeInTheDocument();
    expect(screen.getByText("इसे मिटवाएँ।")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "सहमत हूँ, आगे बढ़ें" })).toBeDisabled();
  });

  it("tells a candidate the test cannot start yet when the organisation's credits have run out, without the details", async () => {
    window.history.replaceState(null, "", "/?invite=org-a.inv-1.MAC");
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "out_of_credits", message: "This organisation has no attempt credits left." }, 402)));

    renderApp(<App />);

    const card = await screen.findByRole("region", { name: "Cannot start yet" });
    expect(card).toHaveTextContent("no time has been used");
    expect(card).not.toHaveTextContent(/credit/i);
  });
});
