import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.tsx";
import { ConsoleClient, ConsoleError, type AttemptReview, type ExamSummary, type WhoAmI } from "./api.ts";

const exams: ExamSummary[] = [{ id: "exam-1", title: "Algorithms", questionCount: 2 }];

const review: AttemptReview = {
  state: "graded",
  total: 11,
  voidReason: null,
  vivas: [
    {
      probeId: "p1",
      questionId: "q1",
      prompt: "Which quantity decreases each round?",
      rationale: "Answer scored 8/10 (0.80), at or above this exam's viva trigger ratio.",
      reply: "The potential function, bounded below by zero.",
      latencyMs: 14_000,
      verdict: "inconsistent",
      confidence: 0.9,
      reasoning: "The reply names a different quantity from the one in their answer.",
    },
  ],
};

const bankQuestion = (id: string, stem: string) => ({
  id,
  kind: "mcq" as const,
  stem,
  maxScore: 2,
  rubric: [],
  options: ["a", "b"],
  correctIndex: 0,
});
const bankEntries = [
  { id: "b1", question: bankQuestion("b1", "Train speed problem"), topic: "quant", difficulty: "easy" as const, tags: [], updatedAt: "", archived: false },
  { id: "b2", question: bankQuestion("b2", "Work and time problem"), topic: "quant", difficulty: "easy" as const, tags: [], updatedAt: "", archived: false },
];

const OWNER_PERMISSIONS = [
  "exam:read",
  "exam:read_key",
  "exam:write",
  "attempt:start",
  "attempt:read",
  "attempt:review",
  "attempt:grade",
  "attempt:assess",
  "attempt:void",
  "usage:read",
  "audit:read",
  "staff:manage",
  "apikey:manage",
  "org:manage",
];

const who = (role: WhoAmI["role"], permissions: string[]): WhoAmI => ({
  kind: "user",
  id: "u1",
  name: "Asha",
  email: "asha@acme.test",
  role,
  organisation: { id: "acme", name: "Acme" },
  permissions,
});

function stubClient(overrides: Record<string, unknown> = {}) {
  return {
    me: vi.fn(async () => who("owner", OWNER_PERMISSIONS)),
    signOut: vi.fn(async () => undefined),
    listStaff: vi.fn(async () => [
      { id: "u1", email: "asha@acme.test", name: "Asha", role: "owner", disabled: false },
    ]),
    addStaff: vi.fn(async () => ({})),
    usage: vi.fn(async () => ({
      since: "2026-09-01T00:00:00.000Z",
      totalCostMicroUsd: 22_500,
      routes: [
        {
          route: "probe",
          calls: 3,
          inputTokens: 3000,
          outputTokens: 300,
          cacheReadTokens: 0,
          cacheWrite5mTokens: 0,
          cacheWrite1hTokens: 0,
          costMicroUsd: 22_500,
        },
      ],
      perAttempt: { attempts: 3, p50MicroUsd: 7500, p90MicroUsd: 7500, maxMicroUsd: 7500 },
      inferenceGeos: [{ geo: "global", calls: 3 }],
      monthStartedAt: "2026-09-01T00:00:00.000Z",
      spentThisMonthMicroUsd: 22_500,
      monthlyCapMicroUsd: 50_000_000,
    })),
    listExams: vi.fn(async () => exams),
    loadExam: vi.fn(async () => ({
      id: "exam-1",
      title: "Algorithms",
      questions: [],
      policy: { durationMs: 1, allowRevision: true, vivaTriggerRatio: 0.5 },
    })),
    saveExam: vi.fn(async () => undefined),
    listAttempts: vi.fn(async () => [
      { id: "attempt-1", candidateId: "cand-1", entries: 7, state: "graded" as const, lastSeenAt: null },
    ]),
    extendTime: vi.fn(async () => ({ expiresAt: 1 })),
    listBank: vi.fn(async () => ({ questions: bankEntries, topics: ["quant", "verbal"] })),
    fileQuestion: vi.fn(async () => bankEntries[0]),
    editQuestion: vi.fn(async () => bankEntries[0]),
    archiveQuestion: vi.fn(async () => undefined),
    importBank: vi.fn(async () => 2),
    cloneExam: vi.fn(async () => undefined),
    startAttempt: vi.fn(async () => ({ attemptId: "attempt-2", token: "issued-token" })),
    review: vi.fn(async () => review),
    voidAttempt: vi.fn(async () => ({})),
    grade: vi.fn(async () => ({ total: 11 })),
    assess: vi.fn(async () => ({})),
    ...overrides,
  } as unknown as ConsoleClient;
}

function renderApp(element: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

describe("signing in", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("asks for an email and password first", () => {
    renderApp(<App />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("signs in, and says only that the pair was not accepted when it is not", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: "invalid_credentials" }), { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    renderApp(<App />);

    await userEvent.type(screen.getByLabelText("Email"), "asha@acme.test");
    await userEvent.type(screen.getByLabelText("Password"), "wrong password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That email and password were not accepted.");
    expect(fetch).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ method: "POST" }));
  });

  it("goes back to signing in when the session has ended", async () => {
    sessionStorage.setItem("parikshaa.console.session", "pks_expired");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "staff_auth_required" }), { status: 401 })));

    renderApp(<App />);

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(sessionStorage.getItem("parikshaa.console.session")).toBeNull();
  });
});

describe("console", () => {
  it("lists exams", async () => {
    renderApp(<App client={stubClient()} />);
    expect(await screen.findByRole("button", { name: "Algorithms" })).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

describe("exam editor", () => {
  const openEditor = async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));
    return client;
  };

  it("refuses to save an exam it knows is invalid, and says why", async () => {
    const client = await openEditor();

    // A blank title and a blank mcq option: invalid before it ever reaches the server.
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    const problems = await screen.findByRole("list", { name: "Problems with this exam" });
    expect(within(problems).getByText(/needs a title/i)).toBeInTheDocument();
    expect(client.saveExam).not.toHaveBeenCalled();
  });

  it("saves a well-formed exam", async () => {
    const client = await openEditor();

    await userEvent.type(screen.getByLabelText("Title"), "Mechanics");
    await userEvent.type(screen.getByLabelText("Question"), "Which is stable?");
    await userEvent.type(screen.getByLabelText("Option 1"), "quicksort");
    await userEvent.type(screen.getByLabelText("Option 2"), "mergesort");
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    await waitFor(() => expect(client.saveExam).toHaveBeenCalled());
    const saved = (client.saveExam as unknown as { mock: { calls: [unknown][] } }).mock.calls[0]![0] as {
      title: string;
      questions: { options: string[] }[];
    };
    expect(saved.title).toBe("Mechanics");
    expect(saved.questions[0]?.options).toEqual(["quicksort", "mergesort"]);
  });

  it("replaces the fields that do not carry across when the type changes", async () => {
    await openEditor();

    expect(screen.getByLabelText("Option 1")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Type"), "numeric");

    expect(screen.queryByLabelText("Option 1")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Expected value")).toBeInTheDocument();
    expect(screen.getByLabelText("Tolerance (±)")).toBeInTheDocument();
  });

  it("shows the server's objections when it disagrees with the client", async () => {
    const client = stubClient({
      saveExam: vi.fn(async () => {
        throw new ConsoleError(422, "invalid_exam", [
          { path: "questions.0.maxScore", message: "Marks must be greater than zero." },
        ]);
      }),
    });
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));

    await userEvent.type(screen.getByLabelText("Title"), "Mechanics");
    await userEvent.type(screen.getByLabelText("Question"), "Which?");
    await userEvent.type(screen.getByLabelText("Option 1"), "a");
    await userEvent.type(screen.getByLabelText("Option 2"), "b");
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    expect(await screen.findByText(/Marks must be greater than zero/)).toBeInTheDocument();
  });
});

describe("attempts", () => {
  it("issues an access code when an attempt is started", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));

    await userEvent.type(await screen.findByLabelText(/Start an attempt/), "cand-9");
    await userEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(await screen.findByLabelText("Access code")).toHaveValue("issued-token");
    expect(client.startAttempt).toHaveBeenCalledWith("exam-1", "cand-9");
  });
});

describe("attempt review", () => {
  const openReview = async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await userEvent.click(await screen.findByRole("button", { name: "Review" }));
    return client;
  };

  it("shows the grade and the evidence as separate things", async () => {
    await openReview();

    expect(await screen.findByText("11")).toBeInTheDocument();

    const evidence = screen.getByRole("region", { name: "Provenance evidence" });
    expect(evidence).toHaveTextContent(/not part of the grade and has not changed it/i);
    expect(evidence).toHaveTextContent("Which quantity decreases each round?");
    expect(evidence).toHaveTextContent("14s");
    expect(evidence).toHaveTextContent(/Contradicts or misreads their own answer/);
    expect(evidence).toHaveTextContent(/names a different quantity/);
  });

  it("offers no control that turns a verdict into a mark", async () => {
    await openReview();
    const evidence = await screen.findByRole("region", { name: "Provenance evidence" });

    // SPEC §6.1: adjusting a grade is a decision a person makes and owns, not a
    // button that launders a model's reading into a number. The worst verdict in
    // the fixture must produce no such affordance.
    for (const control of within(evidence).queryAllByRole("button")) {
      expect(control.textContent ?? "").not.toMatch(/mark|score|grade|deduct|penal|adjust|fail|void/i);
    }
    expect(evidence).not.toHaveTextContent(/deduct|penalt/i);
  });

  it("keeps the decision out of the evidence section", async () => {
    await openReview();

    const evidence = await screen.findByRole("region", { name: "Provenance evidence" });
    const decision = screen.getByRole("region", { name: "Decision" });

    // Placing it in the evidence card would make setting an attempt aside look
    // like the verdict's consequence; in the grade card, like a grading action.
    // It is neither (SPEC §6.1).
    expect(within(evidence).queryByRole("button", { name: /set aside/i })).not.toBeInTheDocument();
    expect(within(decision)).toBeTruthy();
    expect(decision).toHaveTextContent(/Nothing above sets this attempt aside on its own/i);
  });

  it("takes two steps and a written reason", async () => {
    const client = await openReview();
    const decision = await screen.findByRole("region", { name: "Decision" });

    // No reason field until the reviewer has said they are deciding.
    expect(screen.queryByLabelText("Reason")).not.toBeInTheDocument();
    await userEvent.click(within(decision).getByRole("button", { name: "Set aside…" }));

    const confirm = screen.getByRole("button", { name: "Set this attempt aside" });
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Reason"), "too short");
    expect(confirm).toBeDisabled();
    expect(screen.getByText(/cannot be defended on appeal/i)).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Reason"));
    await userEvent.type(screen.getByLabelText("Reason"), "Provenance could not be established on review.");
    await userEvent.click(confirm);

    await waitFor(() =>
      expect(client.voidAttempt).toHaveBeenCalledWith(
        "attempt-1",
        "Provenance could not be established on review.",
      ),
    );
  });

  it("shows the recorded reason once an attempt is set aside", async () => {
    const client = stubClient({
      review: vi.fn(async () => ({
        ...review,
        state: "void",
        voidReason: "Could not establish that this work was the candidate's own.",
        voidedBy: { userId: "u1", name: "Asha" },
      })),
    });
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await userEvent.click(await screen.findByRole("button", { name: "Review" }));

    const aside = await screen.findByRole("region", { name: "Set aside" });
    expect(aside).toHaveTextContent(/Could not establish that this work was the candidate's own/);
    expect(aside).toHaveTextContent("set aside by Asha");
    expect(screen.queryByRole("button", { name: "Set aside…" })).not.toBeInTheDocument();
  });

  it("shows the staff-side rationale, which the candidate never sees", async () => {
    await openReview();
    const evidence = await screen.findByRole("region", { name: "Provenance evidence" });

    expect(evidence).toHaveTextContent(/Answer scored 8\/10/);
  });
});

describe("what a role is shown", () => {
  it("shows an invigilator no authoring, no evidence and no administration", async () => {
    const client = stubClient({ me: vi.fn(async () => who("invigilator", ["exam:read", "attempt:start", "attempt:read"])) });
    renderApp(<App client={client} />);

    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    expect(await screen.findByLabelText(/Start an attempt/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();

    const nav = screen.getByRole("navigation", { name: "Account" });
    for (const tab of ["Staff", "API keys", "Spend", "Audit log"]) {
      expect(within(nav).queryByRole("button", { name: tab })).not.toBeInTheDocument();
    }
    await userEvent.click(within(nav).getByRole("button", { name: "Exams" }));
    expect(screen.queryByRole("button", { name: "New exam" })).not.toBeInTheDocument();
  });

  it("offers a viewer the evidence but no decision", async () => {
    const client = stubClient({
      me: vi.fn(async () => who("viewer", ["exam:read", "attempt:read", "attempt:review"])),
      review: vi.fn(async () => ({ ...review, state: "submitted" })),
    });
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await userEvent.click(await screen.findByRole("button", { name: "Review" }));

    expect(await screen.findByRole("region", { name: "Provenance evidence" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Decision" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Grade attempt" })).not.toBeInTheDocument();
  });

  it("shows the reason a grade was refused", async () => {
    const client = stubClient({
      review: vi.fn(async () => ({ ...review, state: "submitted" })),
      grade: vi.fn(async () => {
        throw new ConsoleError(402, "spend_cap_reached", [], "This organisation's monthly model spend cap has been reached");
      }),
    });
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await userEvent.click(await screen.findByRole("button", { name: "Review" }));
    await userEvent.click(await screen.findByRole("button", { name: "Grade attempt" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/spend cap has been reached/);
  });
});

describe("administration", () => {
  const open = async (tab: string) => {
    const client = stubClient();
    renderApp(<App client={client} />);
    const nav = await screen.findByRole("navigation", { name: "Account" });
    await userEvent.click(await within(nav).findByRole("button", { name: tab }));
    return client;
  };

  it("adds a member of staff", async () => {
    const client = await open("Staff");

    await userEvent.type(await screen.findByLabelText("Name"), "Neha");
    await userEvent.type(screen.getByLabelText("Email"), "neha@acme.test");
    await userEvent.selectOptions(screen.getByLabelText("Role"), "reviewer");
    await userEvent.type(screen.getByLabelText("Initial password"), "an initial passphrase");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(client.addStaff).toHaveBeenCalledWith({
        name: "Neha",
        email: "neha@acme.test",
        role: "reviewer",
        password: "an initial passphrase",
      }),
    );
  });

  it("shows model spend per attempt, which is what pricing is built on", async () => {
    await open("Spend");

    const spend = await screen.findByRole("region", { name: "Model spend" });
    expect(spend).toHaveTextContent("$0.02");
    expect(spend).toHaveTextContent("$0.0075");
    expect(spend).toHaveTextContent(/Cap \$50\.00/);
  });
});

describe("the room, for an invigilator", () => {
  const sitting = vi.fn(async () => [
    { id: "attempt-1", candidateId: "cand-1", entries: 7, state: "graded" as const, lastSeenAt: null },
    {
      id: "attempt-3",
      candidateId: "cand-3",
      entries: 2,
      state: "in_progress" as const,
      lastSeenAt: new Date(Date.now() - 20_000).toISOString(),
    },
  ]);
  const invigilator = () =>
    stubClient({
      listAttempts: sitting,
      me: vi.fn(async () => who("invigilator", ["exam:read", "attempt:start", "attempt:read", "attempt:extend"])),
    });

  it("shows who is here", async () => {
    renderApp(<App client={invigilator()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));

    const row = (await screen.findByText("cand-3")).closest("tr")!;
    expect(row).toHaveTextContent("here");
  });

  it("grants extra time with a reason", async () => {
    const client = invigilator();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await userEvent.click(await screen.findByRole("button", { name: "Extra time…" }));

    const form = screen.getByRole("form", { name: "Extra time for cand-3" });
    const grant = within(form).getByRole("button", { name: "Grant extra time" });
    await userEvent.clear(within(form).getByLabelText("Minutes"));
    await userEvent.type(within(form).getByLabelText("Minutes"), "15");
    await userEvent.type(within(form).getByLabelText("Reason"), "short");
    expect(grant).toBeDisabled();

    await userEvent.type(within(form).getByLabelText("Reason"), " — power cut in hall B");
    await userEvent.click(grant);

    await waitFor(() =>
      expect(client.extendTime).toHaveBeenCalledWith("attempt-3", 15, "short — power cut in hall B"),
    );
  });

  it("offers extra time only to those who may grant it, and only on open attempts", async () => {
    renderApp(
      <App
        client={stubClient({
          listAttempts: sitting,
          me: vi.fn(async () => who("viewer", ["exam:read", "attempt:read", "attempt:review"])),
        })}
      />,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await screen.findByText("cand-3");

    expect(screen.queryByRole("button", { name: "Extra time…" })).not.toBeInTheDocument();
  });
});

describe("the question bank", () => {
  const openBank = async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    const nav = await screen.findByRole("navigation", { name: "Account" });
    await userEvent.click(await within(nav).findByRole("button", { name: "Question bank" }));
    return client;
  };

  it("lists questions with their topic and difficulty", async () => {
    await openBank();
    const bank = await screen.findByRole("region", { name: "Question bank" });

    expect(await within(bank).findByText("Train speed problem")).toBeInTheDocument();
    expect(within(bank).getAllByText("quant")).not.toHaveLength(0);
  });

  it("imports a CSV file and lists every rejected row", async () => {
    const client = await openBank();
    (client.importBank as unknown as { mockRejectedValueOnce: (e: unknown) => void }).mockRejectedValueOnce(
      new ConsoleError(422, "invalid_import", [{ path: "row 3", message: "The answer \"Z\" is not one of the options." }]),
    );

    const file = new File(["kind,question\nmcq,x"], "bank.csv", { type: "text/csv" });
    await userEvent.upload(await screen.findByLabelText("CSV file"), file);

    const problems = await screen.findByRole("list", { name: "Problems with this file" });
    expect(problems).toHaveTextContent("row 3");
    expect(client.importBank).toHaveBeenCalledWith("kind,question\nmcq,x");
  });

  it("files a new question with its topic and tags", async () => {
    const client = await openBank();
    await userEvent.click(await screen.findByRole("button", { name: "New question" }));

    await userEvent.type(screen.getByLabelText("Question"), "Which is stable?");
    await userEvent.type(screen.getByLabelText("Option 1"), "quicksort");
    await userEvent.type(screen.getByLabelText("Option 2"), "mergesort");
    await userEvent.type(screen.getByLabelText("Topic"), "sorting");
    await userEvent.type(screen.getByLabelText("Tags, comma separated"), "dsa, campus");
    await userEvent.click(screen.getByRole("button", { name: "Save to bank" }));

    await waitFor(() =>
      expect(client.fileQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          question: expect.objectContaining({ stem: "Which is stable?", options: ["quicksort", "mergesort"] }),
          topic: "sorting",
          tags: ["dsa", "campus"],
        }),
      ),
    );
  });
});

describe("exams drawn from the bank", () => {
  it("builds a section that draws per candidate from questions picked in the bank", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));
    await userEvent.type(screen.getByLabelText("Title"), "Aptitude");
    await userEvent.type(screen.getByLabelText("Question"), "Fixed question");
    await userEvent.type(screen.getByLabelText("Option 1"), "a");
    await userEvent.type(screen.getByLabelText("Option 2"), "b");

    await userEvent.click(screen.getByRole("button", { name: "Add a section drawn per candidate" }));
    const section = screen.getByRole("region", { name: "Section 1" });
    await userEvent.type(within(section).getByLabelText("Section title"), "Quant");
    await userEvent.click(within(section).getByRole("button", { name: "Add from bank" }));

    const picker = await screen.findByRole("dialog", { name: "Add from the question bank" });
    await userEvent.click(await within(picker).findByRole("button", { name: "Select all 2" }));
    await userEvent.click(within(picker).getByRole("button", { name: "Add 2 questions" }));
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    await waitFor(() => expect(client.saveExam).toHaveBeenCalled());
    const saved = (client.saveExam as unknown as { mock: { calls: [{ sections: unknown[] }][] } }).mock.calls[0]![0];
    expect(saved.sections).toEqual([
      { id: "s1", title: "Quant", pick: 1, pool: [bankEntries[0]!.question, bankEntries[1]!.question] },
    ]);
  });

  it("copies an exam, which is how a sat exam is changed", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Copy" }));

    await waitFor(() => expect(client.cloneExam).toHaveBeenCalledWith("exam-1", expect.stringMatching(/^exam-1-copy-/)));
  });

  it("says plainly that a sat exam cannot be edited", async () => {
    const client = stubClient({
      loadExam: vi.fn(async () => ({
        id: "exam-1",
        title: "Algorithms",
        questions: [],
        policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.5 },
      })),
      saveExam: vi.fn(async () => {
        throw new ConsoleError(409, "exam_frozen");
      }),
    });
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.click(await screen.findByRole("button", { name: "Add question" }));
    await userEvent.type(screen.getAllByLabelText("Question").at(-1)!, "One more");
    await userEvent.type(screen.getAllByLabelText("Option 1").at(-1)!, "a");
    await userEvent.type(screen.getAllByLabelText("Option 2").at(-1)!, "b");
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    expect(await screen.findByRole("list", { name: "Problems with this exam" })).toHaveTextContent(
      /has been sat.*Make a copy/,
    );
  });
});

describe("writing a code question", () => {
  it("sets languages, a visible example and a hidden test, and saves them", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));
    await userEvent.type(screen.getByLabelText("Title"), "Coding round");
    await userEvent.type(screen.getByLabelText("Question"), "Print the sum of two integers.");
    await userEvent.selectOptions(screen.getByLabelText("Type"), "code");

    await userEvent.click(screen.getByLabelText("Java")); // offered by default; take it away
    await userEvent.click(screen.getByLabelText("C"));
    const [example, hidden] = screen.getAllByRole("group", { name: /^Test \d$/ });
    await userEvent.type(within(example!).getByLabelText("Input"), "2 3");
    await userEvent.type(within(example!).getByLabelText("Expected output"), "5");
    await userEvent.type(within(hidden!).getByLabelText("Input"), "-7 2");
    await userEvent.type(within(hidden!).getByLabelText("Expected output"), "-5");
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    await waitFor(() => expect(client.saveExam).toHaveBeenCalled());
    const saved = (client.saveExam as unknown as { mock: { calls: [{ questions: unknown[] }][] } }).mock.calls[0]![0];
    expect(saved.questions[0]).toMatchObject({
      kind: "code",
      language: "python",
      languages: ["python", "c", "cpp"],
      tests: [
        { input: "2 3", expected: "5", hidden: false, weight: 1 },
        { input: "-7 2", expected: "-5", hidden: true, weight: 1 },
      ],
    });
  });

  it("will not save a question whose every test is visible", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));
    await userEvent.type(screen.getByLabelText("Title"), "Coding round");
    await userEvent.type(screen.getByLabelText("Question"), "Anything.");
    await userEvent.selectOptions(screen.getByLabelText("Type"), "code");
    // The new question's second test starts hidden; make it visible too.
    await userEvent.click(screen.getAllByLabelText("Hidden from candidates")[1]!);
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    expect(await screen.findByRole("list", { name: "Problems with this exam" })).toHaveTextContent(/print the answers/);
    expect(client.saveExam).not.toHaveBeenCalled();
  });
});
