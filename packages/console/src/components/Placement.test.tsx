import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ConsoleClient, Drive, DriveDetail, JobDraft, StudentRow } from "../api.ts";
import { JobTestDrawer } from "./JobTest.tsx";
import { PageFrame } from "./kit.tsx";
import { PlacementPanel } from "./Placement.tsx";

/** The placement cell and a test from a job, against a stub of the console's client. */

const student = (ref: string, patch: Partial<StudentRow> = {}): StudentRow => ({
  ref,
  name: `Student ${ref}`,
  email: null,
  phone: null,
  branch: "CSE",
  batch: 2027,
  cgpa: 8,
  backlogs: 0,
  offers: 0,
  bestOfferLpa: null,
  ...patch,
});

const drive: Drive = {
  id: "d1",
  company: "Infosys",
  role: "Systems Engineer",
  ctcLpa: 3.6,
  location: "Pune",
  description: "",
  eligibility: { minCgpa: 7, maxBacklogs: 0 },
  applyBy: "2026-10-10",
  examId: "infosys-oa",
  status: "open",
  createdAt: "2026-10-01T00:00:00Z",
  stages: { applied: 1, test: 0, interview: 0, offered: 1, joined: 0, rejected: 0, withdrawn: 0 },
};

const detail: DriveDetail = {
  drive,
  applications: [
    { ...student("CS001"), stage: "offered", offerLpa: 3.6, updatedAt: "", test: { percent: 92, outcome: "qualified" } },
    { ...student("CS002", { cgpa: 7.4 }), stage: "applied", offerLpa: null, updatedAt: "", test: null },
  ],
  eligibleNotAdded: 3,
};

function stub(patch: Record<string, unknown> = {}) {
  return {
    students: vi.fn(async () => [student("CS001", { offers: 1, bestOfferLpa: 3.6 }), student("CS002", { cgpa: 7.4 }), student("EC001", { branch: "ECE", backlogs: 2, batch: 2028 })]),
    importStudents: vi.fn(async (_csv: string, dryRun: boolean) => ({ dryRun, students: 2, added: 1, updated: 1, problems: [], preview: [] })),
    removeStudent: vi.fn(async () => undefined),
    drives: vi.fn(async () => [drive]),
    drive: vi.fn(async () => detail),
    saveDrive: vi.fn(async (_id: string | null, d: object) => ({ ...drive, ...d, id: "d2" })),
    addDriveStudents: vi.fn(async () => ({ added: 3 })),
    setDriveStage: vi.fn(async () => ({ moved: 1 })),
    sendDriveTest: vi.fn(async () => ({ invited: 1, skipped: 0 })),
    driveFile: vi.fn(async () => new Blob(["x"])),
    listExams: vi.fn(async () => [{ id: "infosys-oa", title: "Infosys online test", questionCount: 20 }]),
    readiness: vi.fn(async (_batch?: number) => ({ exams: [], topics: [] as string[], branches: [] as unknown[], atRisk: [] as unknown[] })),
    ...patch,
  };
}

function show(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PageFrame title="Placement" note="">
        {ui}
      </PageFrame>
    </QueryClientProvider>,
  );
}

describe("students", () => {
  it("lists students by batch, and checks a sheet before saving it", async () => {
    const client = stub();
    const user = userEvent.setup();
    show(<PlacementPanel client={client as unknown as ConsoleClient} canInvite />);
    await user.click(screen.getByRole("tab", { name: "Students" }));
    const table = await screen.findByRole("region", { name: "Students" });
    expect(within(table).getByText("CS001").closest("tr")).toHaveTextContent("₹3.6 LPA");
    await user.click(within(table).getByRole("button", { name: "2028" }));
    expect(within(table).queryByText("CS001")).toBeNull();
    expect(within(table).getByText("EC001")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Add students from a sheet" }));
    const file = new File(["roll_number,name\nCS003,Isha"], "students.csv", { type: "text/csv" });
    await user.upload(screen.getByLabelText("Student list (CSV)"), file);
    expect(await screen.findByText("1 new, 1 to update.")).toBeTruthy();
    expect(client.importStudents).toHaveBeenCalledWith("roll_number,name\nCS003,Isha", true);
    await user.click(screen.getByRole("button", { name: "Save 2 students" }));
    await waitFor(() => expect(client.importStudents).toHaveBeenCalledWith("roll_number,name\nCS003,Isha", false));
  });
});

describe("a drive", () => {
  it("adds the eligible students, moves the chosen ones on, and sends the test", async () => {
    const client = stub();
    const user = userEvent.setup();
    show(<PlacementPanel client={client as unknown as ConsoleClient} canInvite />);
    const list = await screen.findByRole("region", { name: "Drives" });
    expect(list).toHaveTextContent("CGPA 7+ · no backlogs");
    await user.click(within(list).getByRole("button", { name: "Infosys" }));

    const head = await screen.findByRole("region", { name: "The drive" });
    await user.click(within(head).getByRole("button", { name: "Add 3 eligible students" }));
    await waitFor(() => expect(client.addDriveStudents).toHaveBeenCalledWith("d1", "eligible"));

    const students = screen.getByRole("region", { name: "Students in the drive" });
    expect(within(students).getByText("CS001").closest("tr")).toHaveTextContent("92%");
    await user.click(within(students).getByRole("checkbox", { name: "Choose CS002" }));
    await user.selectOptions(within(students).getByRole("combobox", { name: "Stage" }), "offered");
    await user.type(within(students).getByRole("spinbutton", { name: "Offer in lakh a year" }), "4.5");
    await user.click(within(students).getByRole("button", { name: "Move 1" }));
    await waitFor(() => expect(client.setDriveStage).toHaveBeenCalledWith("d1", ["CS002"], "offered", 4.5));

    await user.click(within(head).getByRole("button", { name: "Send the test to 1" }));
    await user.click(screen.getByRole("button", { name: "Send to 1" }));
    await waitFor(() => expect(client.sendDriveTest).toHaveBeenCalledWith("d1", ["email"]));
  });

  it("makes a drive, counting who would be eligible as the rule is typed", async () => {
    const client = stub({ drives: vi.fn(async () => []) });
    const user = userEvent.setup();
    show(<PlacementPanel client={client as unknown as ConsoleClient} canInvite />);
    await user.click((await screen.findAllByRole("button", { name: "New drive" }))[0]!);
    await user.type(screen.getByLabelText("Company"), "TCS");
    await user.type(screen.getByLabelText("Role"), "Ninja");
    await waitFor(() => expect(screen.getByText(/3 of 3 students meet this now/)).toBeTruthy());
    await user.type(screen.getByLabelText("Minimum CGPA"), "7.5");
    expect(screen.getByText(/2 of 3 students meet this now/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "ECE" }));
    expect(screen.getByText(/1 of 3 students meet this now/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Make the drive" }));
    await waitFor(() =>
      expect(client.saveDrive).toHaveBeenCalledWith(null, expect.objectContaining({ company: "TCS", role: "Ninja", eligibility: { minCgpa: 7.5, branches: ["ECE"] } })),
    );
  });
});

describe("a test from a job", () => {
  const draft: JobDraft = {
    title: "Java Developer — online test",
    roleId: "java-developer",
    seniority: "junior",
    source: "model",
    skills: ["Apache Kafka"],
    sections: [
      { id: "java", title: "Java and OOP", keywords: ["java"], kinds: ["mcq"], wanted: 12, pick: 12, pool: Array.from({ length: 20 }, (_, i) => ({ id: `q${i}`, stem: "", kind: "mcq", topic: "Java", difficulty: "medium", maxScore: 1 })) },
      { id: "sql", title: "SQL and databases", keywords: ["sql"], kinds: ["mcq"], wanted: 6, pick: 0, pool: [] },
    ],
    durationMinutes: 25,
    cutoffPercent: 60,
    notes: ["SQL and databases: the bank has no objective questions filed under sql. Add some, or remove the section."],
  };

  it("reads a job description, shows where the bank is short, and makes the exam", async () => {
    const client = {
      jobRoles: vi.fn(async () => [{ id: "java-developer", family: "Software engineering", title: "Java developer", summary: "Java and OOP.", minutes: 60, cutoffPercent: 60, sections: [] }]),
      jobDraft: vi.fn(async () => draft),
      createJobTest: vi.fn(async () => ({ examId: "java-1", questions: 10 })),
    };
    const created = vi.fn();
    const user = userEvent.setup();
    show(<JobTestDrawer client={client as unknown as ConsoleClient} onClose={() => undefined} onCreated={created} />);
    await user.click(screen.getByRole("radio", { name: "A job description" }));
    await user.type(screen.getByLabelText("Paste the job description"), "Java developers with Kafka, two years.");
    await user.click(screen.getByRole("button", { name: "Draft the test" }));
    await waitFor(() => expect(client.jobDraft).toHaveBeenCalledWith({ description: "Java developers with Kafka, two years." }));

    expect(await screen.findByText(/Read from the job/)).toHaveTextContent("Apache Kafka");
    expect(screen.getByText(/the bank has no objective questions/)).toBeTruthy();
    const pick = screen.getByRole("spinbutton", { name: "Questions from Java and OOP" });
    await user.clear(pick);
    await user.type(pick, "10");
    await user.click(screen.getByRole("button", { name: "Make the test · 10 questions" }));
    await waitFor(() =>
      expect(client.createJobTest).toHaveBeenCalledWith({
        title: "Java Developer — online test",
        durationMinutes: 25,
        cutoffPercent: 60,
        sections: [{ title: "Java and OOP", questionIds: draft.sections[0]!.pool.map((q) => q.id), pick: 10 }],
      }),
    );
    expect(created).toHaveBeenCalledWith("java-1");
  });

  it("groups the roles by family and finds one by searching", async () => {
    const section = (id: string, title: string) => ({ id, title, keywords: [id], kinds: ["mcq"], count: 10 });
    const client = {
      jobRoles: vi.fn(async () => [
        { id: "java-developer", family: "Software engineering", title: "Java developer", summary: "Java and OOP.", minutes: 60, cutoffPercent: 60, sections: [section("java", "Java and OOP")] },
        { id: "data-analyst", family: "Data and AI", title: "Data analyst", summary: "SQL and statistics.", minutes: 40, cutoffPercent: 60, sections: [section("sql", "SQL and databases")] },
        { id: "aws-engineer", family: "Cloud and infrastructure", title: "AWS cloud engineer", summary: "AWS services.", minutes: 35, cutoffPercent: 60, sections: [section("aws", "AWS")] },
      ]),
      jobDraft: vi.fn(async () => draft),
    };
    const user = userEvent.setup();
    show(<JobTestDrawer client={client as unknown as ConsoleClient} onClose={() => undefined} onCreated={() => undefined} />);
    expect(await screen.findByRole("group", { name: "Data and AI" })).toBeTruthy();
    expect(screen.getAllByRole("radio", { name: /engineer|developer|analyst/ })).toHaveLength(3);

    await user.type(screen.getByRole("searchbox", { name: "Find a role" }), "sql");
    expect(screen.getByRole("radio", { name: /Data analyst/ })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /Java developer/ })).toBeNull();
    expect(screen.queryByRole("group", { name: "Cloud and infrastructure" })).toBeNull();
    await user.click(screen.getByRole("radio", { name: /Data analyst/ }));

    // A chosen role stays in view while the search changes.
    await user.clear(screen.getByRole("searchbox", { name: "Find a role" }));
    await user.type(screen.getByRole("searchbox", { name: "Find a role" }), "kubernetes zzz");
    expect(screen.getByRole("radio", { name: /Data analyst/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Draft the test" }));
    await waitFor(() => expect(client.jobDraft).toHaveBeenCalledWith({ roleId: "data-analyst" }));
  });

  it("says plainly when the month's AI spend is used up", async () => {
    const { ConsoleError } = await import("../api.ts");
    const client = {
      jobRoles: vi.fn(async () => []),
      jobDraft: vi.fn(async () => {
        throw new ConsoleError(402, "spend_cap_reached");
      }),
    };
    const user = userEvent.setup();
    show(<JobTestDrawer client={client as unknown as ConsoleClient} onClose={() => undefined} onCreated={() => undefined} />);
    await user.click(screen.getByRole("radio", { name: "A job description" }));
    await user.type(screen.getByLabelText("Paste the job description"), "Freshers for a support desk role.");
    await user.click(screen.getByRole("button", { name: "Draft the test" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("spend cap is reached: choose a role instead");
  });
});

describe("readiness", () => {
  it("shades each branch's topics and lists the students below 40%", async () => {
    const client = stub({
      readiness: vi.fn(async () => ({
        exams: [{ id: "m1", title: "Mock 1" }],
        topics: ["Aptitude", "OS"],
        branches: [{ branch: "CSE", students: 40, cells: { Aptitude: { percent: 72, students: 40 }, OS: { percent: 31, students: 40 } } }],
        atRisk: [{ ref: "CS017", name: "Kiran", branch: "CSE", percent: 28, weakest: "OS" }],
      })),
    });
    const user = userEvent.setup();
    show(<PlacementPanel client={client as unknown as ConsoleClient} canInvite />);
    await user.click(screen.getByRole("tab", { name: "Readiness" }));
    const map = await screen.findByRole("region", { name: "Readiness by branch and topic" });
    const cse = within(map).getByRole("rowheader", { name: "CSE" }).closest("tr")!;
    expect(within(cse).getByText("31%")).toHaveClass("heat-0");
    expect(within(cse).getByText("72%")).toHaveClass("heat-3");
    expect(screen.getByRole("region", { name: "Students who need help" })).toHaveTextContent("CS017Kiran CSE28%OS".replace(" ", ""));
    await user.click(within(map).getByRole("button", { name: "2028" }));
    await waitFor(() => expect(client.readiness).toHaveBeenLastCalledWith(2028));
  });
});

describe("a drive's link to apply", () => {
  it("opens the link, off-campus if asked, and shows it", async () => {
    const client = stub({ setApplyLink: vi.fn(async () => ({ link: "https://exam.test/?apply=org-a.abc" })) });
    const user = userEvent.setup();
    show(<PlacementPanel client={client as unknown as ConsoleClient} canInvite />);
    await user.click(within(await screen.findByRole("region", { name: "Drives" })).getByRole("button", { name: "Infosys" }));
    const card = await screen.findByRole("region", { name: "Link to apply" });
    await user.click(within(card).getByRole("checkbox", { name: /Off-campus/ }));
    await user.click(within(card).getByRole("button", { name: "Open the link" }));
    await waitFor(() => expect((client as unknown as { setApplyLink: ReturnType<typeof vi.fn> }).setApplyLink).toHaveBeenCalledWith("d1", true, true));
  });

  it("tells the eligible students about an open drive", async () => {
    const alertDrive = vi.fn(async () => ({ queued: 12, already: 0, unreachable: 2 }));
    const client = stub({ drive: vi.fn(async () => ({ ...detail, applyLink: "https://exam.test/?apply=org-a.abc" })), alertDrive });
    const user = userEvent.setup();
    show(<PlacementPanel client={client as unknown as ConsoleClient} canInvite />);
    await user.click(within(await screen.findByRole("region", { name: "Drives" })).getByRole("button", { name: "Infosys" }));
    const card = await screen.findByRole("region", { name: "Link to apply" });
    await user.click(within(card).getByRole("button", { name: "Tell eligible students" }));
    await waitFor(() => expect(alertDrive).toHaveBeenCalledWith("d1"));
  });
});

describe("the year-wise report", () => {
  it("shows placed, median and highest per year of passing and branch", async () => {
    const client = stub({
      placementReport: vi.fn(async () => ({
        batches: [{ batch: 2027, students: 120, placed: 96, percent: 80, medianLpa: 4.5, highestLpa: 32, averageLpa: 6.1, branches: [{ branch: "CSE", students: 60, placed: 55, percent: 91.7, medianLpa: 6, highestLpa: 32, averageLpa: 8 }] }],
      })),
    });
    const user = userEvent.setup();
    show(<PlacementPanel client={client as unknown as ConsoleClient} canInvite />);
    await user.click(screen.getByRole("tab", { name: "Year-wise report" }));
    const year = await screen.findByRole("region", { name: "Passing in 2027" });
    expect(year).toHaveTextContent("96 of 120 placed (80%) · median ₹4.5 LPA · highest ₹32 LPA");
    expect(within(year).getByRole("rowheader", { name: "CSE" }).closest("tr")).toHaveTextContent("CSE605591.76328");
  });
});
