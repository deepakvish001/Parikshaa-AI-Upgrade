import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@parikshaa/brand/ui";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ConsoleClient, StaffImport } from "../api.ts";
import { StaffDepartments, StaffSheet } from "./StaffSheet.tsx";

const wrap = (node: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>{node}</ToastProvider>
    </QueryClientProvider>,
  );

const checked: StaffImport = { dryRun: true, added: 2, skipped: 1, problems: [], preview: [] };

describe("staff from a sheet", () => {
  it("checks the sheet before adding anyone, then adds them", async () => {
    const importStaff = vi.fn(async (_csv: string, dryRun: boolean) => (dryRun ? checked : { ...checked, dryRun: false }));
    wrap(<StaffSheet client={{ importStaff } as unknown as ConsoleClient} />);
    expect(screen.queryByRole("button", { name: /Add 2/ })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: /Paste the sheet/ }), { target: { value: "email,name,role,department\na@x.in,A,author,CSE" } });
    await userEvent.click(screen.getByRole("button", { name: "Check the sheet" }));
    expect(await screen.findByText(/2 new, 1 already on staff/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add 2 and send their links" }));
    await waitFor(() => expect(importStaff).toHaveBeenLastCalledWith(expect.stringContaining("a@x.in"), false));
  });

  it("lists the rows to fix and offers no save", async () => {
    const importStaff = vi.fn(async () => ({ ...checked, problems: [{ row: 3, message: "role must be author, invigilator, reviewer or viewer" }] }));
    wrap(<StaffSheet client={{ importStaff } as unknown as ConsoleClient} />);
    fireEvent.change(screen.getByRole("textbox", { name: /Paste the sheet/ }), { target: { value: "x" } });
    await userEvent.click(screen.getByRole("button", { name: "Check the sheet" }));
    expect(await screen.findByRole("list", { name: "Rows to fix" })).toHaveTextContent("row 3");
    expect(screen.queryByRole("button", { name: /send their links/ })).toBeNull();
  });
});

describe("departments", () => {
  it("saves a member's department", async () => {
    const setStaffDepartment = vi.fn(async () => undefined);
    const client = { departments: async () => ({ departments: ["CSE"], staff: [{ userId: "u1", department: "CSE" }], exams: [] }), setStaffDepartment };
    wrap(<StaffDepartments client={client as unknown as ConsoleClient} users={[{ id: "u1", name: "Asha" }, { id: "u2", name: "Ravi" }]} />);
    expect(await screen.findByRole("combobox", { name: "Department for Asha" })).toHaveValue("CSE");
    const ravi = screen.getByRole("combobox", { name: "Department for Ravi" });
    await userEvent.type(ravi, "ECE");
    fireEvent.blur(ravi);
    await waitFor(() => expect(setStaffDepartment).toHaveBeenCalledWith("u2", "ECE"));
  });
});
