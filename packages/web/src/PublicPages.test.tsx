import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplyPage, InterviewPage, OfferPage, ReportPage, ShortlistPage, StatusPage } from "./components/PublicPages.tsx";
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

describe("a candidate report from its link", () => {
  const report = {
    valid: true,
    institution: "Kiranshala Labs",
    exam: { title: "Backend intern test" },
    candidate: { name: "Arjun", ref: "K1" },
    sat: "2026-10-03T04:31:00.000Z",
    durationMs: 1_200_000,
    total: 12,
    maxTotal: 12,
    percent: 100,
    outcome: "qualified",
    standing: { percentile: null, rank: 1, graded: 3, meanPercent: 70 },
    sections: [{ title: "Coding", score: 10, max: 10 }],
    questions: [
      { number: 1, stem: "Which is O(1) on average?", kind: "mcq", score: 2, max: 2, tests: null, code: null, aiPrompts: 0 },
      { number: 2, stem: "Add two numbers.", kind: "code", score: 10, max: 10, tests: { passed: 2, total: 2 }, code: { language: "python", source: "print(1 + 2)" }, aiPrompts: 1 },
    ],
    followUps: [{ number: 2, prompt: "Why split()?", reply: "One line, two numbers", verdict: "consistent" }],
    integrity: { identity: "verified", snapshots: 4, events: [{ kind: "tab_hidden", label: "Left the tab", count: 2 }] },
    record: { head: "abc", length: 9 },
    expiresAt: "2026-10-10T00:00:00.000Z",
  };
  const open = () =>
    render(
      <PreferencesProvider>
        <ReportPage code="org-a.at1.x.mac" />
      </PreferencesProvider>,
    );

  it("shows the marks, each question, the program, the proctoring and the AI's use", async () => {
    const fetch = vi.fn(async () => json(report));
    vi.stubGlobal("fetch", fetch);
    open();
    const page = await screen.findByRole("article", { name: "Candidate report" });
    expect(fetch).toHaveBeenCalledWith("/api/reports/org-a.at1.x.mac");
    expect(within(page).getByRole("heading", { level: 1 })).toHaveTextContent("Arjun");
    expect(page).toHaveTextContent("12 / 12");
    expect(page).toHaveTextContent("1 of 3");
    expect(page).toHaveTextContent("Reached");
    expect(within(page).getByRole("meter", { name: "Coding: 10 of 10" })).toBeInTheDocument();
    expect(within(page).getByRole("row", { name: /Add two numbers\. 2 of 2 1 10 \/ 10/ })).toBeInTheDocument();
    expect(within(page).getByText("print(1 + 2)")).toBeInTheDocument();
    expect(page).toHaveTextContent("Photo ID: Matched · 4 webcam photos");
    expect(page).toHaveTextContent("Left the tab: 2");
    expect(page).toHaveTextContent("Consistent with having produced the answer");
    expect(page).toHaveTextContent("Q2: 1 prompt");
    expect(within(page).getByRole("button", { name: "Download PDF" })).toBeInTheDocument();
  });

  it("says when the link has expired, the result was withdrawn, or the link is wrong", async () => {
    for (const [reason, title] of [
      ["expired", "This report link has expired"],
      ["withdrawn", "This result was withdrawn"],
      ["unknown", "This link is not a candidate report"],
    ] as const) {
      vi.stubGlobal("fetch", vi.fn(async () => json({ valid: false, reason })));
      const { unmount } = open();
      expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
      unmount();
    }
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

describe("a candidate's interview room", () => {
  const room = {
    title: "Backend round 1",
    candidateName: "Ananya",
    interviewer: "Priya",
    scheduledAt: "2026-10-06T04:30:00.000Z",
    minutes: 45,
    meetingUrl: "https://meet.jit.si/parikshaa-x",
    problem: "Reverse a linked list",
    language: "python",
    code: "",
    status: "scheduled",
  };

  it("shows the problem and the call, and sends the code as it is typed", async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => (init?.method === "PUT" ? json({ savedAt: "2026-10-06T04:31:00.000Z" }) : json(room)));
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(
      <PreferencesProvider>
        <InterviewPage code="org-a.i1.mac" />
      </PreferencesProvider>,
    );
    const page = await screen.findByRole("region", { name: "Interview" });
    expect(page).toHaveTextContent("Reverse a linked list");
    expect(screen.getByRole("link", { name: /Join the video call/ })).toHaveAttribute("href", room.meetingUrl);
    await user.type(screen.getByRole("textbox", { name: "Code editor" }), "print(1)");
    await waitFor(
      () =>
        expect(fetch).toHaveBeenCalledWith(
          "/api/interviews/room/org-a.i1.mac/code",
          expect.objectContaining({ method: "PUT", body: JSON.stringify({ code: "print(1)", language: "python" }) }),
        ),
      { timeout: 3000 },
    );
    expect(await screen.findByText(/your interviewer can see it/)).toBeInTheDocument();
  });

  it("says when the link no longer works", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "interview_not_found" }, 404)));
    render(
      <PreferencesProvider>
        <InterviewPage code="org-a.i1.bad" />
      </PreferencesProvider>,
    );
    expect(await screen.findByRole("heading", { name: "This interview link does not work" })).toBeInTheDocument();
  });
});

describe("a candidate's offer", () => {
  const offer = { from: "Zoho", company: "Zoho", role: "Member Technical Staff", location: "Chennai", candidateName: "Arun", ctcLpa: 8.4, joiningDate: "2027-07-01", note: "Bring your ID", response: null, respondedAt: null, open: true };

  it("shows the offer, and records an accept only once it is confirmed", async () => {
    let answered: string | null = null;
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        answered = (JSON.parse(String(init.body)) as { response: string }).response;
        return json({ response: answered });
      }
      return json({ ...offer, response: answered });
    });
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(
      <PreferencesProvider>
        <OfferPage code="org-a.abc" />
      </PreferencesProvider>,
    );
    const page = await screen.findByRole("region", { name: "Offer" });
    expect(page).toHaveTextContent("₹8.4 lakh a year");
    expect(page).toHaveTextContent("Bring your ID");
    await user.click(screen.getByRole("button", { name: "Accept the offer" }));
    expect(fetch).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Yes, accept" }));
    expect(await screen.findByText(/You accepted this offer/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/offers/org-a.abc/response", expect.objectContaining({ method: "POST" }));
  });
});

describe("a college's link in a company's drive", () => {
  it("names the college, and asks for the roll number there", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ institution: "Zoho", company: "Zoho", role: "MTS", ctcLpa: null, location: "", description: "", applyBy: null, eligibility: {}, openToNew: true, college: "PSG Tech", closed: false })),
    );
    render(
      <PreferencesProvider>
        <ApplyPage code="org-a.c_x" />
      </PreferencesProvider>,
    );
    expect(await screen.findByText("Zoho · campus drive for PSG Tech")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Roll number at PSG Tech" })).toBeInTheDocument();
  });
});

describe("a student's own application page", () => {
  it("shows the rounds reached, and the offer waiting for an answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({ institution: "Acme College", company: "Infosys", role: "Systems Engineer", name: "Ananya", stage: "offered", updatedAt: "2026-10-05T05:00:00Z", offer: { ctcLpa: 4, joiningDate: null, response: null, link: "https://exam.test/?offer=o" } }),
      ),
    );
    render(
      <PreferencesProvider>
        <StatusPage code="org-a.d1.Q1MwMDE.mac" />
      </PreferencesProvider>,
    );
    const rounds = await screen.findByRole("list", { name: "Rounds" });
    expect(within(rounds).getByText("Offer")).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("link", { name: "See it and answer" })).toHaveAttribute("href", "https://exam.test/?offer=o");
  });

  it("says when the link opens nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "not_found" }, 404)));
    render(
      <PreferencesProvider>
        <StatusPage code="bad" />
      </PreferencesProvider>,
    );
    expect(await screen.findByRole("heading", { name: "This link does not open an application" })).toBeInTheDocument();
  });
});
