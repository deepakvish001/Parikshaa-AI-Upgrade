import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@parikshaa/brand/ui";
import { describe, expect, it, vi } from "vitest";
import type { ConsoleClient, DriveApplication } from "../api.ts";
import { Colleges, Offers } from "./DriveNetwork.tsx";

const wrap = (node: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>{node}</ToastProvider>
    </QueryClientProvider>,
  );

const student = { email: null, phone: null, branch: "CSE", batch: 2027, cgpa: 8, backlogs: 0, offerLpa: null, updatedAt: "2026-10-01T00:00:00Z", test: null };

describe("a company's drive across colleges", () => {
  it("adds a college with its short code and lists its link and who applied", async () => {
    const addDriveCollege = vi.fn(async () => ({ id: "c1", name: "NIT Trichy", code: "NITT", applied: 0, link: "https://x/?apply=a" }));
    const onChange = vi.fn();
    wrap(<Colleges client={{ addDriveCollege } as unknown as ConsoleClient} driveId="d1" colleges={[{ id: "c0", name: "PSG Tech", code: "PSG", applied: 12, link: "https://x/?apply=b" }]} onChange={onChange} />);
    const user = userEvent.setup();
    expect(screen.getByRole("row", { name: /PSG Tech PSG 12/ })).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "College name" }), "NIT Trichy");
    await user.type(screen.getByRole("textbox", { name: "Short code" }), "nitt");
    await user.click(screen.getByRole("button", { name: "Add and copy its link" }));
    await waitFor(() => expect(addDriveCollege).toHaveBeenCalledWith("d1", { name: "NIT Trichy", code: "NITT" }));
    expect(onChange).toHaveBeenCalled();
  });
});

describe("offers", () => {
  it("makes an offer and shows each answer, and who has not joined by the date", async () => {
    const sendOffer = vi.fn(async () => ({ link: "https://x/?offer=o" }));
    const applications: DriveApplication[] = [
      { ...student, ref: "R1", name: "Ananya", stage: "offered", offerLpa: 6, offer: { link: "l1", sentAt: "", response: "accepted", respondedAt: "", joiningDate: "2020-07-01", note: "" } },
      { ...student, ref: "R2", name: "Rohan", stage: "interview" },
    ];
    wrap(<Offers client={{ sendOffer } as unknown as ConsoleClient} driveId="d1" figures={{ sent: 1, accepted: 1, declined: 0, pending: 0, joined: 0, notJoined: 1 }} applications={applications} onChange={() => undefined} />);
    const user = userEvent.setup();
    const row = screen.getByRole("row", { name: /Ananya/ });
    expect(within(row).getByText("Accepted")).toBeInTheDocument();
    expect(within(row).getByText("Not joined")).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Student" }), "R2");
    await user.type(screen.getByRole("spinbutton", { name: "Package (lakh a year)" }), "7.5");
    await user.click(screen.getByRole("button", { name: "Make the offer" }));
    await waitFor(() => expect(sendOffer).toHaveBeenCalledWith("d1", { ref: "R2", ctcLpa: 7.5, joiningDate: null, note: "" }));
  });
});
