import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ConsoleClient, PrepLesson, PrepTrack } from "../api.ts";
import { Lessons, ProblemOfTheDay, Tracks } from "./PrepAdmin.tsx";

/** Prep content in the console (ROADMAP §16), against a stub of its client. */

function stub() {
  const tracks: PrepTrack[] = [];
  const lessons: PrepLesson[] = [
    { id: "l1", slug: "what-an-array-is", title: "What an array is", body: "# Arrays", videoUrl: "", estMinutes: 15, published: true, updatedAt: "2026-10-01T00:00:00Z" },
  ];
  const days: { day: string; problemId: string }[] = [{ day: "2026-10-05", problemId: "p1" }];
  const client = {
    prepTracks: vi.fn(async () => [...tracks]),
    prepLessons: vi.fn(async () => [...lessons]),
    practiceProblems: vi.fn(async () => [
      { id: "p1", title: "Two sum", published: true },
      { id: "p2", title: "Hidden one", published: false },
    ]),
    saveTrack: vi.fn(async (id: string | null, draft: { title: string }) => {
      const saved = { id: id ?? "t1", slug: "dsa", title: draft.title, description: "", position: 0, published: true, updatedAt: "", modules: [] };
      tracks.push(saved);
      return saved;
    }),
    saveLesson: vi.fn(async (id: string | null, draft: Omit<PrepLesson, "id" | "slug" | "updatedAt">) => ({ ...draft, id: id ?? "l2", slug: "x", updatedAt: "" })),
    potdSchedule: vi.fn(async () => ({ today: "2026-10-05", days: [...days] })),
    setPotd: vi.fn(async () => undefined),
  };
  return client;
}

function show(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("tracks", () => {
  it("builds a track of modules from lessons and problems", async () => {
    const client = stub();
    const user = userEvent.setup();
    show(<Tracks client={client as unknown as ConsoleClient} canWrite />);
    await user.click(await screen.findByRole("button", { name: "New track" }));
    const form = screen.getByRole("form", { name: "New track" });
    await user.type(within(form).getByLabelText("Title", { selector: "input:not([required][value^='Module'])" }), "DSA Basics");
    const add = await within(form).findByLabelText("Add to module 1");
    await waitFor(() => expect(within(add).getByRole("option", { name: "What an array is" })).toBeTruthy());
    await user.selectOptions(add, "l:l1");
    await user.selectOptions(add, "p:p1");
    expect(within(form).getByText("Hidden one (hidden)", { exact: false })).toBeTruthy();
    await user.click(within(form).getByRole("button", { name: /Add a module/ }));
    await user.click(within(form).getByRole("button", { name: "Save track" }));
    await waitFor(() => expect(client.saveTrack).toHaveBeenCalled());
    expect(client.saveTrack.mock.calls[0]).toEqual([
      null,
      {
        title: "DSA Basics",
        description: "",
        published: true,
        modules: [
          { title: "Module 1", items: [{ lessonId: "l1" }, { problemId: "p1" }] },
          { title: "Module 2", items: [] },
        ],
      },
    ]);
  });

  it("offers no editing without the right to write", async () => {
    show(<Tracks client={stub() as unknown as ConsoleClient} canWrite={false} />);
    expect(await screen.findByText("No tracks yet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New track" })).toBeNull();
  });
});

describe("lessons", () => {
  it("lists lessons and writes a new one", async () => {
    const client = stub();
    const user = userEvent.setup();
    show(<Lessons client={client as unknown as ConsoleClient} canWrite />);
    expect(await screen.findByText("What an array is")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Write a lesson" }));
    const form = screen.getByRole("form", { name: "New lesson" });
    await user.type(within(form).getByLabelText("Title"), "Binary search");
    await user.type(within(form).getByLabelText("Lesson (Markdown)"), "Halve the range.");
    await user.type(within(form).getByLabelText("Video link (https://…)"), "https://videos.example/bs");
    await user.click(within(form).getByRole("button", { name: "Save lesson" }));
    await waitFor(() =>
      expect(client.saveLesson).toHaveBeenCalledWith(null, { title: "Binary search", body: "Halve the range.", videoUrl: "https://videos.example/bs", estMinutes: 15, published: true }),
    );
  });
});

describe("the problem of the day", () => {
  it("shows three weeks from today and sets a day's problem from the published ones", async () => {
    const client = stub();
    const user = userEvent.setup();
    show(<ProblemOfTheDay client={client as unknown as ConsoleClient} canWrite />);
    const today = await screen.findByLabelText("Problem for 2026-10-05");
    expect((today as HTMLSelectElement).value).toBe("p1");
    const tomorrow = screen.getByLabelText("Problem for 2026-10-06");
    expect(within(tomorrow).queryByRole("option", { name: "Hidden one" })).toBeNull();
    await user.selectOptions(tomorrow, "p1");
    await waitFor(() => expect(client.setPotd).toHaveBeenCalledWith("2026-10-06", "p1"));
    expect(screen.getAllByRole("row")).toHaveLength(22);
  });
});

describe("Plus", () => {
  it("turns Plus on, adds a plan and gives a learner Plus", async () => {
    const saved: object[] = [];
    const client = {
      plusAdmin: vi.fn(async () => ({ settings: { plusEnabled: false, freeModules: 1, monthlyCredits: 100, tutorEnabled: true }, products: [] })),
      savePlusSettings: vi.fn(async (patch: object) => ({ plusEnabled: true, freeModules: 1, monthlyCredits: 100, tutorEnabled: true, ...patch })),
      savePlusProduct: vi.fn(async (_id: string | null, draft: object) => {
        saved.push(draft);
        return { ...draft, id: "p1", position: 0 };
      }),
      plusOrders: vi.fn(async () => []),
      practiceLearners: vi.fn(async () => [{ id: "l1", name: "Asha", email: "asha@example.com", joinedAt: "", solved: 0, submissions: 0, lastActiveAt: null }]),
      grantPlus: vi.fn(async () => ({ until: "2027-04-03T00:00:00Z" })),
    };
    const user = userEvent.setup();
    const { PlusAdmin } = await import("./PrepAdmin.tsx");
    show(<PlusAdmin client={client as unknown as ConsoleClient} canManage />);
    await user.click(await screen.findByLabelText(/Sell Plus on this site/));
    await waitFor(() => expect(client.savePlusSettings).toHaveBeenCalledWith({ plusEnabled: true }));

    const form = screen.getByRole("form", { name: "New plan" });
    await user.type(within(form).getByLabelText("Plan name"), "Plus, 3 months");
    await user.clear(within(form).getByLabelText("Price, ₹"));
    await user.type(within(form).getByLabelText("Price, ₹"), "499");
    await user.click(within(form).getByRole("button", { name: "Add plan" }));
    await waitFor(() => expect(saved).toEqual([{ title: "Plus, 3 months", kind: "plus", days: 90, credits: 1000, pricePaise: 49_900, active: true }]));
    // A Company Pass opens the company lists alone, for its days.
    await user.clear(within(form).getByLabelText("Plan name"));
    await user.type(within(form).getByLabelText("Plan name"), "Company Pass, a month");
    await user.selectOptions(within(form).getByLabelText("Kind"), "company");
    await user.clear(within(form).getByLabelText("Days"));
    await user.type(within(form).getByLabelText("Days"), "30");
    await user.clear(within(form).getByLabelText("Credits"));
    await user.type(within(form).getByLabelText("Credits"), "0");
    await user.click(within(form).getByRole("button", { name: "Add plan" }));
    await waitFor(() => expect(saved[1]).toMatchObject({ title: "Company Pass, a month", kind: "company", days: 30, credits: 0 }));

    await user.selectOptions(await screen.findByLabelText("Learner"), "l1");
    await user.click(screen.getByRole("button", { name: "Give Plus" }));
    await waitFor(() => expect(client.grantPlus).toHaveBeenCalledWith("l1", 180));
    expect(await screen.findByText(/Given, until/)).toBeTruthy();
  });
});
