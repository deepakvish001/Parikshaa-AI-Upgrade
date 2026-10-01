import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ConsoleClient } from "../api.ts";
import { Campus } from "./Campus.tsx";

const show = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
const cohort = { id: "c1", name: "NIT 2027", plusDays: 180, createdBy: "s1", createdAt: "2026-10-01T00:00:00Z" };

describe("campus cohorts", () => {
  it("makes a cohort, tries a CSV as a dry run, adds it, and shows each student", async () => {
    let added = false;
    const client = {
      cohorts: vi.fn(async () => [{ ...cohort, members: added ? 2 : 0, joined: added ? 1 : 0, given: added ? 1 : 0, active7: 0, solved: 3 }]),
      createCohort: vi.fn(async () => cohort),
      importCohort: vi.fn(async (_id: string, _csv: string, dryRun: boolean) => {
        if (!dryRun) added = true;
        return { rows: 3, added: 2, invalid: [{ line: 3, value: "broken" }], duplicates: 0, already: 0, givenNow: 1, onSignup: 1, dryRun };
      }),
      cohortReport: vi.fn(async () => ({
        cohort,
        students: added
          ? [
              { email: "asha@x.in", name: "Asha", joined: true, verified: true, plusUntil: "2027-04-01T00:00:00Z", solved: 3, submissions: 5, lastActiveAt: null },
              { email: "ravi@x.in", name: null, joined: false, verified: false, plusUntil: null, solved: 0, submissions: 0, lastActiveAt: null },
            ]
          : [],
      })),
    };
    const user = userEvent.setup();
    show(<Campus client={client as unknown as ConsoleClient} canManage />);
    const form = await screen.findByRole("form", { name: "New cohort" });
    await user.type(within(form).getByLabelText("Cohort name"), "NIT 2027");
    await user.click(within(form).getByRole("button", { name: "Make cohort" }));
    await waitFor(() => expect(client.createCohort).toHaveBeenCalledWith("NIT 2027", 180));

    await user.type(await screen.findByLabelText(/Students' email addresses/), "asha@x.in\nravi@x.in\nbroken");
    await user.click(screen.getByRole("button", { name: "Dry run" }));
    expect(await screen.findByText(/A dry run: nothing was changed/)).toBeTruthy();
    expect(client.importCohort).toHaveBeenLastCalledWith("c1", "asha@x.in\nravi@x.in\nbroken", true);
    expect(screen.getByText("Line 3: “broken”")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Add students" }));
    await waitFor(() => expect(client.importCohort).toHaveBeenLastCalledWith("c1", "asha@x.in\nravi@x.in\nbroken", false));
    const students = await screen.findByRole("region", { name: "Cohort students" });
    expect(await within(students).findByText("asha@x.in")).toBeTruthy();
    expect(within(students).getByText("Not signed up")).toBeTruthy();
  });

  it("shows the dashboard without the forms to one who may not manage", async () => {
    const client = {
      cohorts: vi.fn(async () => [{ ...cohort, members: 2, joined: 1, given: 1, active7: 1, solved: 3 }]),
      cohortReport: vi.fn(async () => ({ cohort, students: [] })),
    };
    const user = userEvent.setup();
    show(<Campus client={client as unknown as ConsoleClient} canManage={false} />);
    await user.click(await screen.findByRole("button", { name: "NIT 2027" }));
    expect(await screen.findByText("No students yet.")).toBeTruthy();
    expect(screen.queryByRole("form", { name: "New cohort" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add students" })).toBeNull();
  });
});
