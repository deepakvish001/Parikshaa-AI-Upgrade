import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@parikshaa/brand/ui";
import { describe, expect, it, vi } from "vitest";
import type { ClassReport, ClassSession, ConsoleClient } from "../api.ts";
import { ClassesPanel } from "./Classes.tsx";

/** Classes (plan row 95): making one, the students' page, its plan and attendance. */

const summary = { id: "c1", name: "Java A", cohort: { id: "co1", name: "CSE 2027 A" }, track: { id: "t1", title: "Java Programming" }, tests: 1, contests: 1, createdAt: "2026-10-05T04:00:00.000Z" };
const report: ClassReport = {
  class: summary,
  course: { lessons: 1, problems: 2 },
  tests: [{ examId: "java-unit-1", title: "Java unit 1" }],
  contests: [{ id: "k1", title: "Weekly 1", problems: 3, startsAt: "2026-10-05T04:00:00.000Z" }],
  sessions: [{ id: "s1", heldOn: "2026-10-05", topic: "Arrays", present: 1, marked: 2 }],
  students: [
    {
      email: "asha@college.edu",
      name: "Asha",
      joined: true,
      course: { lessonsDone: 1, problemsSolved: 1, percent: 66.7 },
      tests: { "java-unit-1": 100 },
      contests: { k1: 2 },
      attendance: { present: 1, of: 1, percent: 100 },
      lastActiveAt: null,
    },
    {
      email: "ravi@college.edu",
      name: null,
      joined: false,
      course: { lessonsDone: 0, problemsSolved: 0, percent: 0 },
      tests: { "java-unit-1": null },
      contests: { k1: 0 },
      attendance: { present: 0, of: 1, percent: 0 },
      lastActiveAt: null,
    },
  ],
};
const session: ClassSession = { id: "s1", heldOn: "2026-10-05", topic: "Arrays", marks: { "asha@college.edu": true, "ravi@college.edu": false } };

function client(overrides: Partial<ConsoleClient> = {}) {
  return {
    classes: vi.fn(async () => [summary]),
    classOptions: vi.fn(async () => ({
      cohorts: [{ id: "co1", name: "CSE 2027 A" }],
      tracks: [{ id: "t1", title: "Java Programming" }],
      contests: [{ id: "k1", title: "Weekly 1", startsAt: "2026-10-05T04:00:00.000Z" }],
      exams: [
        { id: "java-unit-1", title: "Java unit 1" },
        { id: "java-unit-2", title: "Java unit 2" },
      ],
    })),
    createClass: vi.fn(async () => ({ ...summary, id: "c2", name: "Python B" })),
    classReport: vi.fn(async () => report),
    updateClass: vi.fn(async () => report),
    classSessions: vi.fn(async () => [session]),
    addClassSession: vi.fn(async () => ({ id: "s2", heldOn: "2026-10-06", topic: "Loops", marks: {} })),
    removeClassSession: vi.fn(async () => undefined),
    markAttendance: vi.fn(async () => session),
    ...overrides,
  } as unknown as ConsoleClient & Record<string, ReturnType<typeof vi.fn>>;
}

const renderPanel = (c: ConsoleClient, canWrite = true) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <ClassesPanel client={c} canWrite={canWrite} />
      </ToastProvider>
    </QueryClientProvider>,
  );

describe("classes", () => {
  it("makes a class from a cohort and a course, then opens it", async () => {
    const c = client();
    renderPanel(c);
    await userEvent.click(await screen.findByRole("button", { name: "New class" }));
    const form = screen.getByRole("form", { name: "New class" });
    const make = within(form).getByRole("button", { name: "Make the class" });
    expect(make).toBeDisabled();
    await userEvent.type(within(form).getByLabelText("Name"), "Python B");
    await userEvent.selectOptions(within(form).getByLabelText("Students (cohort)"), "co1");
    await userEvent.selectOptions(within(form).getByLabelText("Course"), "t1");
    await userEvent.click(make);
    expect(c.createClass).toHaveBeenCalledWith({ name: "Python B", cohortId: "co1", trackId: "t1" });
    await waitFor(() => expect(c.classReport).toHaveBeenCalledWith("c2"));
  });

  it("puts each student on a line: course, test, contest and attendance", async () => {
    renderPanel(client());
    await userEvent.click(await screen.findByRole("button", { name: "Java A" }));
    const page = await screen.findByRole("region", { name: "Java A" });
    expect(page).toHaveTextContent("CSE 2027 A · 2 students · course: Java Programming (1 lessons, 2 problems) · 1 sessions");
    const rows = within(page).getAllByRole("row");
    expect(within(rows[0]!).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Student", "Course", "Java unit 1", "Weekly 1", "Attendance"]);
    expect(within(rows[1]!).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Ashaasha@college.edu", "66.7%", "100%", "2 / 3", "1 of 1"]);
    expect(within(rows[2]!).getAllByRole("cell").map((c) => c.textContent)).toEqual(["ravi@college.eduravi@college.edu · no account yet", "0%", "—", "0 / 3", "0 of 1"]);
  });

  it("sets the class's tests and contests", async () => {
    const c = client();
    renderPanel(c);
    await userEvent.click(await screen.findByRole("button", { name: "Java A" }));
    const plan = await screen.findByRole("region", { name: "Course, tests and contests" });
    await userEvent.click(await within(plan).findByRole("checkbox", { name: "Java unit 2" }));
    await userEvent.click(within(plan).getByRole("checkbox", { name: "Weekly 1" }));
    await userEvent.click(within(plan).getByRole("button", { name: "Save" }));
    expect(c.updateClass).toHaveBeenCalledWith("c1", { trackId: "t1", examIds: ["java-unit-1", "java-unit-2"], contestIds: [] });
  });

  it("adds a session and marks who was present, everyone ticked to start", async () => {
    const c = client({ classSessions: vi.fn(async () => [session, { id: "s2", heldOn: "2026-10-06", topic: "Loops", marks: {} }]) } as Partial<ConsoleClient>);
    renderPanel(c);
    await userEvent.click(await screen.findByRole("button", { name: "Java A" }));
    const attendance = await screen.findByRole("region", { name: "Attendance" });
    const add = within(attendance).getByRole("form", { name: "Add a session" });
    await userEvent.clear(within(add).getByLabelText("Day"));
    await userEvent.type(within(add).getByLabelText("Day"), "2026-10-06");
    await userEvent.type(within(add).getByLabelText("Topic"), "Loops");
    await userEvent.click(within(add).getByRole("button", { name: "Add session" }));
    expect(c.addClassSession).toHaveBeenCalledWith("c1", { heldOn: "2026-10-06", topic: "Loops" });

    const register = await within(attendance).findByRole("group", { name: /Who was present on Tue, 6 Oct/ });
    expect(within(register).getByRole("checkbox", { name: "Asha" })).toBeChecked();
    expect(within(register).getByRole("checkbox", { name: "ravi@college.edu" })).toBeChecked();
    await userEvent.click(within(register).getByRole("checkbox", { name: "ravi@college.edu" }));
    await userEvent.click(within(register).getByRole("button", { name: "Save attendance" }));
    expect(c.markAttendance).toHaveBeenCalledWith("c1", "s2", { "asha@college.edu": true, "ravi@college.edu": false });
  });

  it("shows the page without editing to someone who may only read", async () => {
    renderPanel(client(), false);
    expect(screen.queryByRole("button", { name: "New class" })).toBeNull();
    await userEvent.click(await screen.findByRole("button", { name: "Java A" }));
    await screen.findByRole("region", { name: "Java A" });
    expect(screen.queryByRole("region", { name: "Course, tests and contests" })).toBeNull();
    expect(screen.queryByRole("form", { name: "Add a session" })).toBeNull();
  });
});
