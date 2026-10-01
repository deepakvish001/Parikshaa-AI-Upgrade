import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplyPage, ShortlistPage } from "./components/PublicPages.tsx";
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

describe("applying to a drive from its link", () => {
  const drive = { institution: "Acme College", company: "Wipro", role: "Project Engineer", ctcLpa: 3.5, location: "Pune", description: "", applyBy: "2026-10-30", eligibility: { minCgpa: 7 }, openToNew: false, closed: false };

  it("shows the drive and applies with the roll number and email", async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => (init?.method === "POST" ? json({ status: "applied" }) : json(drive)));
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(
      <PreferencesProvider>
        <ApplyPage code="org-a.abc" />
      </PreferencesProvider>,
    );
    const page = await screen.findByRole("region", { name: "Apply" });
    expect(page).toHaveTextContent("Wipro — Project Engineer");
    expect(page).toHaveTextContent("CGPA 7 or more");
    await user.type(screen.getByLabelText("Roll number"), "CS001");
    await user.type(screen.getByLabelText("Email (the one the college has)"), "a@college.test");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByRole("status")).toHaveTextContent("You have applied");
    expect(fetch).toHaveBeenCalledWith("/api/apply/org-a.abc", expect.objectContaining({ body: JSON.stringify({ ref: "CS001", email: "a@college.test" }) }));
  });

  it("says why an application was refused", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => (init?.method === "POST" ? json({ error: "invalid_state", message: "You do not meet this drive's criteria" }, 409) : json(drive))));
    const user = userEvent.setup();
    render(
      <PreferencesProvider>
        <ApplyPage code="org-a.abc" />
      </PreferencesProvider>,
    );
    await user.type(await screen.findByLabelText("Roll number"), "CS002");
    await user.type(screen.getByLabelText("Email (the one the college has)"), "r@college.test");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("criteria");
  });
});
