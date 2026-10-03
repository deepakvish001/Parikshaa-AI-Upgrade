import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Dashboard } from "../api.ts";
import { Home } from "./Home.tsx";
import { PageFrame } from "./kit.tsx";
import { SignIn } from "./SignIn.tsx";
import { consoleTour, Tour } from "./Tour.tsx";

/** A new institution's first day: making the account, the welcome, the sample exam and the tour. */

const fresh: Dashboard = {
  sittings: [],
  activity: [],
  setup: { exams: 0, bankQuestions: 0, scheduled: 0, invited: 0, staff: 1, privacyNotice: false, sampleExamId: null },
};

const sampleActions = () => ({
  onLoad: vi.fn<() => void>(),
  onTry: vi.fn<(examId: string) => void>(),
  onOpen: vi.fn<(examId: string) => void>(),
  onRemove: vi.fn<() => void>(),
  busy: false,
});

const renderHome = (dashboard: Dashboard, sample = sampleActions(), onGo = vi.fn(), onTour = vi.fn(), canWrite = true, canBuy = true) => {
  render(
    <PageFrame title="Home" note="">
      <Home dashboard={dashboard} exams={[]} name="Asha Rao" canWrite={canWrite} onExam={vi.fn()} onGo={onGo} sample={sample} onTour={onTour} canBuy={canBuy} />
    </PageFrame>,
  );
  return { sample, onGo, onTour };
};

describe("the welcome", () => {
  it("offers three ways to begin and the tour to a new organisation", async () => {
    const { sample, onGo, onTour } = renderHome(fresh);
    const welcome = screen.getByRole("region", { name: "Welcome to Parikshaa. Three ways to begin." });
    expect(within(welcome).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Try the sample exam",
      "Write your first exam",
      "Bring a question paper",
    ]);
    await userEvent.click(within(welcome).getByRole("button", { name: "Load the sample exam" }));
    expect(sample.onLoad).toHaveBeenCalled();
    await userEvent.click(within(welcome).getByRole("button", { name: "New exam" }));
    expect(onGo).toHaveBeenCalledWith("new-exam");
    await userEvent.click(within(welcome).getByRole("button", { name: "Import questions" }));
    expect(onGo).toHaveBeenCalledWith("bank");
    await userEvent.click(within(welcome).getByRole("button", { name: "Take the tour" }));
    expect(onTour).toHaveBeenCalled();
  });

  it("once the sample is in, offers to sit it as a candidate", async () => {
    const { sample } = renderHome({ ...fresh, setup: { ...fresh.setup, sampleExamId: "sample-aptitude" } });
    expect(screen.queryByRole("button", { name: "Load the sample exam" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Try it as a candidate" }));
    expect(sample.onTry).toHaveBeenCalledWith("sample-aptitude");
  });

  it("gives way to the first steps once the organisation has its own exam, keeping a line for the sample", async () => {
    const { sample } = renderHome({ ...fresh, setup: { ...fresh.setup, exams: 1, sampleExamId: "sample-aptitude" } });
    expect(screen.queryByRole("region", { name: /Welcome/ })).toBeNull();
    expect(screen.getByText("The sample exam is still here")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Put it away" }));
    expect(sample.onRemove).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Take the tour again" })).toBeInTheDocument();
  });

  it("is not shown to someone who cannot write exams", () => {
    renderHome(fresh, sampleActions(), vi.fn(), vi.fn(), false);
    expect(screen.queryByRole("region", { name: /Welcome/ })).toBeNull();
  });
});

describe("credits running out", () => {
  const withCredits = (n: number | null) => ({ ...fresh, setup: { ...fresh.setup, exams: 2, bankQuestions: 4, prepaidCredits: n } });

  it("warns an owner a few attempts before the last, and offers to buy", async () => {
    const onGo = vi.fn();
    renderHome(withCredits(3), sampleActions(), onGo);
    expect(screen.getByText("3 attempts left")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Buy credits" }));
    expect(onGo).toHaveBeenCalledWith("billing");
  });

  it("says plainly when none are left, and who can buy more", () => {
    renderHome(withCredits(0), sampleActions(), vi.fn(), vi.fn(), true, false);
    expect(screen.queryByRole("button", { name: "Buy credits" })).toBeNull();
    expect(screen.getByText(/Ask your organisation's owner/)).toBeInTheDocument();
    expect(screen.getByText("No attempts left")).toBeInTheDocument();
    expect(screen.getByText(/Candidates cannot start a test/)).toBeInTheDocument();
  });

  it("says nothing with plenty left, or for an organisation not prepaid", () => {
    renderHome(withCredits(40));
    expect(screen.queryByText(/attempts? left/)).toBeNull();
    renderHome(withCredits(null));
    expect(screen.queryByText(/attempts? left/)).toBeNull();
  });
});

describe("the tour", () => {
  it("steps through, one stop at a time, from the keyboard too, and ends where it began", async () => {
    const opener = document.createElement("button");
    opener.textContent = "Take the tour";
    document.body.append(opener);
    opener.focus();
    const onClose = vi.fn();
    const stops = consoleTour(() => true);
    const { unmount } = render(<Tour stops={stops} onClose={onClose} />);

    const dialog = screen.getByRole("dialog", { name: "Home" });
    expect(dialog).toHaveAccessibleDescription(/What is sitting now and next/);
    expect(screen.getByText(`1 of ${stops.length}`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Home" })).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByRole("dialog", { name: "Exams" })).toBeInTheDocument();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("dialog", { name: "Question bank" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(screen.getByRole("dialog", { name: "Exams" })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("leaves out the stops a role cannot reach", () => {
    const invigilator = consoleTour((p) => p === "exam:read");
    expect(invigilator.map((s) => s.title)).toEqual(["Home", "Exams", "Find anyone"]);
  });

  it("ends on Done at the last stop", async () => {
    const onClose = vi.fn();
    render(<Tour stops={[{ title: "Only", body: "The one stop." }]} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("a company's four steps", () => {
  const company: Dashboard = { ...fresh, setup: { ...fresh.setup, kind: "company", starterQuestions: 0, finished: 0, shortlists: 0, prepaidCredits: 10 } };
  const renderCompany = (dashboard: Dashboard) => {
    const onGo = vi.fn();
    const starter = { onLoad: vi.fn<() => void>(), busy: false };
    render(
      <PageFrame title="Home" note="">
        <Home dashboard={dashboard} exams={[]} name="Neha Iyer" canWrite onExam={vi.fn()} onGo={onGo} sample={sampleActions()} starter={starter} canBuy />
      </PageFrame>,
    );
    return { onGo, starter };
  };

  it("leads with hiring, offering starter questions to an empty bank", async () => {
    const { onGo, starter } = renderCompany(company);
    const path = screen.getByRole("region", { name: "Hire in four steps" });
    expect(within(path).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "1. Choose a role",
      "2. Invite candidates",
      "3. See the results",
      "4. Share a shortlist",
    ]);
    // Neither the institution's welcome nor its checklist.
    expect(screen.queryByRole("region", { name: "Welcome to Parikshaa. Three ways to begin." })).toBeNull();
    expect(screen.queryByRole("region", { name: "Get started" })).toBeNull();
    await userEvent.click(within(path).getByRole("button", { name: "Add starter questions" }));
    expect(starter.onLoad).toHaveBeenCalled();
    await userEvent.click(within(path).getByRole("button", { name: "Use my own" }));
    expect(onGo).toHaveBeenCalledWith("bank");
  });

  it("sends the first step to the role library once the bank has questions", async () => {
    const { onGo } = renderCompany({ ...company, setup: { ...company.setup, starterQuestions: 120 } });
    await userEvent.click(screen.getByRole("button", { name: "Choose a role" }));
    expect(onGo).toHaveBeenCalledWith("job-test");
  });

  it("marks the steps done and offers only the next", () => {
    renderCompany({ ...company, setup: { ...company.setup, starterQuestions: 120, exams: 1, invited: 3 } });
    const path = screen.getByRole("region", { name: "Hire in four steps" });
    expect(within(path).getByText("2 of 4 done. Nothing reaches a candidate until you invite one.")).toBeInTheDocument();
    expect(within(path).getAllByRole("button").map((b) => b.textContent)).toEqual(["Open the test"]);
  });

  it("is gone when the four steps are done", () => {
    renderCompany({ ...company, setup: { ...company.setup, exams: 1, invited: 3, finished: 2, shortlists: 1 } });
    expect(screen.queryByRole("region", { name: "Hire in four steps" })).toBeNull();
  });
});

describe("making an institution's account", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderSignIn = (onSignedIn = vi.fn()) => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SignIn onSignedIn={onSignedIn} />
      </QueryClientProvider>,
    );
    return onSignedIn;
  };

  it("is not offered where the server takes no sign-ups", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ open: false, trialCredits: 0 }))));
    renderSignIn();
    await screen.findByRole("heading", { name: "Sign in to the console" });
    await Promise.resolve();
    expect(screen.queryByRole("button", { name: "Make your institution's account" })).toBeNull();
  });

  it("makes the account and signs straight in, the tour to follow", async () => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? new Response(JSON.stringify({ token: "pks_new", expiresAt: "", user: { id: "u", name: "Asha Rao", email: "asha@nalanda.test", role: "owner", disabled: false } }), { status: 201 })
        : new Response(JSON.stringify({ open: true, trialCredits: 25 })),
    );
    vi.stubGlobal("fetch", fetch);
    const onSignedIn = renderSignIn();

    await userEvent.click(await screen.findByRole("button", { name: "Make your institution's account" }));
    expect(await screen.findByRole("heading", { name: "Make your institution's account" })).toBeInTheDocument();
    expect(screen.getByText(/The first 25 attempts are free/)).toBeInTheDocument();

    const create = screen.getByRole("button", { name: "Make the account" });
    expect(create).toBeDisabled();
    expect(create).toHaveAccessibleDescription("Enter your institution's name to continue.");
    await userEvent.type(screen.getByLabelText("Institution"), "Nalanda Institute of Technology");
    await userEvent.type(screen.getByLabelText("Your name"), "Asha Rao");
    await userEvent.type(screen.getByLabelText("Work email"), "asha@nalanda.test");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
    expect(create).toHaveAccessibleDescription("Choose a password of at least 12 characters to continue.");
    await userEvent.type(screen.getByLabelText("Password"), " but longer now");
    await userEvent.click(create);

    await vi.waitFor(() => expect(onSignedIn).toHaveBeenCalledWith("pks_new", true));
    const sent = fetch.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(sent[0]).toBe("/api/auth/signup");
    expect(JSON.parse(sent[1]!.body as string)).toEqual({
      organisation: "Nalanda Institute of Technology",
      name: "Asha Rao",
      email: "asha@nalanda.test",
      password: "short but longer now",
      kind: "institution",
    });
  });

  it("makes a company's account when the owner says they are hiring", async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? new Response(JSON.stringify({ token: "pks_co", expiresAt: "", user: { id: "u", name: "Neha", email: "neha@kiranshala.test", role: "owner", disabled: false } }), { status: 201 })
        : new Response(JSON.stringify({ open: true, trialCredits: 10 })),
    );
    vi.stubGlobal("fetch", fetch);
    const onSignedIn = renderSignIn();
    await userEvent.click(await screen.findByRole("button", { name: "Make your institution's account" }));
    await userEvent.click(await screen.findByRole("radio", { name: "A company, hiring" }));
    expect(screen.getByRole("heading", { name: "Make your company's account" })).toBeInTheDocument();
    expect(screen.getByText(/enough for a first round/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Company"), "Kiranshala Labs");
    await userEvent.type(screen.getByLabelText("Your name"), "Neha");
    await userEvent.type(screen.getByLabelText("Work email"), "neha@kiranshala.test");
    await userEvent.type(screen.getByLabelText("Password"), "a long startup password");
    await userEvent.click(screen.getByRole("button", { name: "Make the account" }));
    await vi.waitFor(() => expect(onSignedIn).toHaveBeenCalledWith("pks_co", true));
    const sent = fetch.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(sent[1]!.body as string)).toMatchObject({ organisation: "Kiranshala Labs", kind: "company" });
  });

  it("says so when a confirmation link has just been opened", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ open: false, trialCredits: 0 }))));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SignIn onSignedIn={vi.fn()} emailVerified="done" />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Your email address is confirmed. Sign in to carry on.");
  });

  it("says when the address already has an account, and offers to sign in instead", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === "POST"
          ? new Response(JSON.stringify({ error: "email_taken", message: "An account already uses this email address." }), { status: 409 })
          : new Response(JSON.stringify({ open: true, trialCredits: 0 })),
      ),
    );
    renderSignIn();
    await userEvent.click(await screen.findByRole("button", { name: "Make your institution's account" }));
    await userEvent.type(await screen.findByLabelText("Institution"), "Acme");
    await userEvent.type(screen.getByLabelText("Your name"), "Ravi");
    await userEvent.type(screen.getByLabelText("Work email"), "ravi@acme.test");
    await userEvent.type(screen.getByLabelText("Password"), "a long enough password");
    await userEvent.click(screen.getByRole("button", { name: "Make the account" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("An account already uses this email address.");
    await userEvent.click(within(alert).getByRole("button", { name: "Sign in instead" }));
    expect(screen.getByRole("heading", { name: "Sign in to the console" })).toBeInTheDocument();
  });
});
