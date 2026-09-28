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
