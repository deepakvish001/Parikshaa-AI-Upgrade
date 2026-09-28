import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ConsoleClient, PracticeComment, PracticeContest, PracticeProblem, PracticeSiteSettings } from "../api.ts";
import { PracticePanel, type PracticeCan } from "./Practice.tsx";

/** Running a practice site from the console (ROADMAP §15), against a stub of its client. */

const problem = (id: string, title: string, patch: Partial<PracticeProblem> = {}): PracticeProblem => ({
  id,
  slug: title.toLowerCase().replace(/\s+/g, "-"),
  title,
  question: { id: id as never, kind: "mcq", stem: title, maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 },
  difficulty: "easy",
  tags: [],
  editorial: "",
  fromBank: `bank-${id}`,
  position: 0,
  published: true,
  updatedAt: "2026-09-24T10:00:00.000Z",
  submissions: 4,
  solvedBy: 2,
  ...patch,
});

function stub() {
  let site: PracticeSiteSettings | null = null;
  const problems: PracticeProblem[] = [
    problem("p1", "Stable sort"),
    problem("p3", "Sum of a list", {
      question: { id: "p3" as never, kind: "code", stem: "Sum", maxScore: 1, rubric: [], language: "python", tests: [] } as unknown as PracticeProblem["question"],
    }),
  ];
  const contests: PracticeContest[] = [];
  const comments: PracticeComment[] = [
    {
      id: "c1",
      problemId: "p1",
      problemTitle: "Stable sort",
      problemSlug: "stable-sort",
      authorName: "Asha",
      fromStaff: false,
      body: "The answer is mergesort",
      createdAt: "2026-09-24T10:00:00.000Z",
      hidden: false,
    },
  ];
  const client = {
    practiceSite: vi.fn(async () => site),
    savePracticeSite: vi.fn(async (next: PracticeSiteSettings) => (site = next)),
    practiceProblems: vi.fn(async () => [...problems]),
    listBank: vi.fn(async () => ({
      topics: [],
      questions: [
        { id: "b-mcq", question: { kind: "mcq", stem: "Which is a heap?", options: ["x"], correctIndex: 0 }, topic: "", difficulty: "easy", tags: [], updatedAt: "", archived: false },
        { id: "b-short", question: { kind: "short", stem: "Explain recursion", rubric: [] }, topic: "", difficulty: "hard", tags: [], updatedAt: "", archived: false },
        { id: "b-code", question: { kind: "code", stem: "Sum of two", tests: [{ id: "t" }] }, topic: "", difficulty: "medium", tags: [], updatedAt: "", archived: false },
      ],
    })),
    publishProblem: vi.fn(async (input: { bankQuestionId: string }) => {
      const p = problem("p2", "Which is a heap?", { fromBank: input.bankQuestionId });
      problems.push(p);
      return p;
    }),
    updateProblem: vi.fn(async (id: string, patch: Partial<PracticeProblem>) => {
      const i = problems.findIndex((p) => p.id === id);
      problems[i] = { ...problems[i]!, ...patch };
      return problems[i]!;
    }),
    practiceContests: vi.fn(async () => [...contests]),
    saveContest: vi.fn(async (_id: string | null, draft: Omit<PracticeContest, "id" | "slug" | "state">) => {
      const c = { ...draft, id: "k1", slug: "weekly-1", state: "upcoming" as const };
      contests.push(c);
      return c;
    }),
    practiceLearners: vi.fn(async () => [
      { id: "l1", name: "Asha", email: "asha@example.com", joinedAt: "2026-09-01T10:00:00.000Z", solved: 3, submissions: 7, lastActiveAt: null },
    ]),
    practiceComments: vi.fn(async () => [...comments]),
    hideComment: vi.fn(async (id: string, hidden: boolean) => {
      const c = comments.find((x) => x.id === id)!;
      comments[comments.indexOf(c)] = { ...c, hidden };
    }),
    replyInPractice: vi.fn(async () => undefined),
    practiceSignIn: vi.fn(async () => ({
      requireVerified: false,
      google: { enabled: false, clientId: null, secretSet: false },
      redirectUri: "https://exam.test/api/practice/nit-practice/auth/google/callback",
    })),
    savePracticeSignIn: vi.fn(async () => ({
      requireVerified: true,
      google: { enabled: true, clientId: "id.apps.googleusercontent.com", secretSet: true },
      redirectUri: "https://exam.test/api/practice/nit-practice/auth/google/callback",
    })),
    practiceSimilarity: vi.fn(async () => ({
      problem: { id: "p3", title: "Sum of a list" },
      compared: 3,
      pairs: [
        {
          a: { learnerId: "l1", name: "Asha", language: "python", source: "total = 0", status: "passed", submittedAt: "2026-09-24T10:00:00.000Z" },
          b: { learnerId: "l2", name: "Bilal", language: "python", source: "acc = 0", status: "passed", submittedAt: "2026-09-24T11:00:00.000Z" },
          similarity: 0.93,
          shared: 20,
        },
      ],
    })),
  };
  return client;
}

const all: PracticeCan = { manage: true, write: true, readLearners: true };

function show(client: ReturnType<typeof stub>, can: PracticeCan = all) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PracticePanel client={client as unknown as ConsoleClient} can={can} />
    </QueryClientProvider>,
  );
}

describe("the practice panel", () => {
  it("sets up the site, and links to it once it is open", async () => {
    const client = stub();
    show(client);
    expect(await screen.findByText("Not set up")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Address"), "nit-practice");
    await userEvent.type(screen.getByLabelText("Title"), "NIT Practice");
    await userEvent.click(screen.getByLabelText("Open to learners"));
    await userEvent.click(screen.getByRole("button", { name: "Save site" }));
    await waitFor(() => expect(client.savePracticeSite).toHaveBeenCalledWith({ slug: "nit-practice", title: "NIT Practice", welcome: "", open: true }));
    expect(await screen.findByRole("link", { name: /\/practice\/nit-practice/ })).toBeInTheDocument();
  });

  it("leaves the site's settings to an owner", async () => {
    show(stub(), { manage: false, write: true, readLearners: false });
    expect(await screen.findByText("Only an owner can change the site.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save site" })).toBeDisabled();
    expect(screen.queryByRole("tab", { name: "Learners" })).not.toBeInTheDocument();
  });

  it("publishes a bank question, offering only what can be checked by machine", async () => {
    const client = stub();
    show(client);
    await userEvent.click(screen.getByRole("tab", { name: "Problems" }));
    const select = await screen.findByLabelText("Question");
    await waitFor(() => expect(within(select).getAllByRole("option")).toHaveLength(3));
    expect(within(select).queryByText(/Explain recursion/)).not.toBeInTheDocument();

    await userEvent.selectOptions(select, "b-mcq");
    await userEvent.type(screen.getByLabelText("Editorial (Markdown)"), "A heap keeps its **smallest** on top.");
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(client.publishProblem).toHaveBeenCalledWith({ bankQuestionId: "b-mcq", editorial: "A heap keeps its **smallest** on top." }));
    const table = await screen.findByRole("region", { name: "Published problems" });
    expect(await within(table).findByText("Which is a heap?")).toBeInTheDocument();
  });

  it("edits a problem: hidden from learners, with tags", async () => {
    const client = stub();
    show(client);
    await userEvent.click(screen.getByRole("tab", { name: "Problems" }));
    await userEvent.click(await screen.findByRole("button", { name: "Edit Stable sort" }));
    const form = screen.getByRole("form", { name: "Edit Stable sort" });
    await userEvent.clear(within(form).getByLabelText("Tags, comma-separated"));
    await userEvent.type(within(form).getByLabelText("Tags, comma-separated"), "sorting, basics");
    await userEvent.click(within(form).getByRole("checkbox"));
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.updateProblem).toHaveBeenCalledWith("p1", expect.objectContaining({ tags: ["sorting", "basics"], published: false })));
    expect(await screen.findByText("Hidden")).toBeInTheDocument();
  });

  it("schedules a contest with its problems in the order chosen", async () => {
    const client = stub();
    show(client);
    await userEvent.click(screen.getByRole("tab", { name: "Contests" }));
    await userEvent.click(await screen.findByRole("button", { name: "Schedule a contest" }));
    await userEvent.type(screen.getByLabelText("Title"), "Weekly 1");
    await userEvent.clear(screen.getByLabelText("Length (minutes)"));
    await userEvent.type(screen.getByLabelText("Length (minutes)"), "60");
    await userEvent.click(screen.getByRole("checkbox", { name: /Stable sort/ }));
    await userEvent.click(screen.getByRole("button", { name: "Schedule" }));
    await waitFor(() => expect(client.saveContest).toHaveBeenCalled());
    const [id, draft] = client.saveContest.mock.calls[0]!;
    expect(id).toBeNull();
    expect(draft.problemIds).toEqual(["p1"]);
    expect(Date.parse(draft.endsAt) - Date.parse(draft.startsAt)).toBe(3_600_000);
    expect(await screen.findByText("A. Stable sort")).toBeInTheDocument();
  });

  it("lists learners, and moderates the discussion", async () => {
    const client = stub();
    show(client);
    await userEvent.click(screen.getByRole("tab", { name: "Learners" }));
    expect(await screen.findByText("asha@example.com")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Discussion" }));
    expect(await screen.findByText("The answer is mergesort")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Hide" }));
    await waitFor(() => expect(client.hideComment).toHaveBeenCalledWith("c1", true));
    expect(await screen.findByRole("button", { name: "Show again" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reply" }));
    await userEvent.type(screen.getByLabelText("Your reply"), "Please do not post answers.");
    await userEvent.click(screen.getByRole("button", { name: "Post reply" }));
    await waitFor(() => expect(client.replyInPractice).toHaveBeenCalledWith("stable-sort", "Please do not post answers."));
  });
});

describe("finishing the site (ROADMAP §15)", () => {
  it("lets an owner require confirmed addresses and offer Google sign-in", async () => {
    const client = stub();
    show(client);
    await userEvent.click(await screen.findByLabelText(/Only confirmed/));
    await userEvent.click(screen.getByLabelText(/Continue with/));
    expect(screen.getByText("https://exam.test/api/practice/nit-practice/auth/google/callback")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Google OAuth client ID"), "id.apps.googleusercontent.com");
    await userEvent.type(screen.getByLabelText("Client secret"), "shh");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(client.savePracticeSignIn).toHaveBeenCalledWith({
        requireVerified: true,
        google: { enabled: true, clientId: "id.apps.googleusercontent.com", clientSecret: "shh" },
      }),
    );
  });

  it("shows a reviewer learners whose code is alike, side by side", async () => {
    const client = stub();
    show(client, { ...all, review: true });
    await userEvent.click(screen.getByRole("tab", { name: "Problems" }));
    // Only code is compared.
    await screen.findByText("Stable sort");
    expect(screen.queryByRole("button", { name: "Similar code for Stable sort" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Similar code for Sum of a list" }));
    expect(await screen.findByText("93%")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Compare" }));
    expect(screen.getByRole("group", { name: "Asha and Bilal, side by side" })).toHaveTextContent("acc = 0");
  });

  it("does not offer the comparison without the right to review", async () => {
    show(stub());
    await userEvent.click(screen.getByRole("tab", { name: "Problems" }));
    await screen.findByText("Sum of a list");
    expect(screen.queryByRole("button", { name: /Similar code/ })).toBeNull();
  });
});
