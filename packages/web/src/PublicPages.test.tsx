import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShortlistPage } from "./components/PublicPages.tsx";
import { PreferencesProvider } from "./i18n.tsx";

/** Pages opened from a link with no account. */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("a hiring manager's shortlist", () => {
  const view = {
    institution: "Acme Hiring",
    examTitle: "Java test",
    title: "Java — round 2",
    expiresAt: "2026-10-08T00:00:00.000Z",
    candidates: [{ ref: "J1", name: "Ananya", percent: 92, outcome: "qualified", sections: [{ title: "Java", percent: 95 }], decision: null, comment: "", decidedBy: null }],
  };

  it("shows marks, and records a decision with the manager's name", async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => (init?.method === "POST" ? json({ ok: true }) : json(view)));
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(
      <PreferencesProvider>
        <ShortlistPage code="org-a.s1.mac" />
      </PreferencesProvider>,
    );
    const page = await screen.findByRole("region", { name: "Shortlist" });
    expect(page).toHaveTextContent("Java — round 2");
    expect(page).toHaveTextContent("92%");
    expect(page).toHaveTextContent("Java 95%");
    const decide = within(page).getByRole("group", { name: "Decision on J1" });
    expect(within(decide).getByRole("button", { name: "Shortlist" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: /Your name/ }), "Priya");
    await user.type(screen.getByRole("textbox", { name: "Comment on J1" }), "Strong");
    await user.click(within(decide).getByRole("button", { name: "Shortlist" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/shortlists/view/org-a.s1.mac/decisions",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ ref: "J1", decision: "shortlist", comment: "Strong", by: "Priya" }) }),
      ),
    );
  });

  it("says plainly when the link has expired", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "shortlist_expired" }, 410)));
    render(
      <PreferencesProvider>
        <ShortlistPage code="org-a.s1.mac" />
      </PreferencesProvider>,
    );
    expect(await screen.findByRole("heading", { name: "This shortlist has expired" })).toBeInTheDocument();
  });
});
