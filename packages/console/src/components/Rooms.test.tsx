import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ConsoleClient, SeatRow } from "../api.ts";
import { RoomsCard, SeatingCard } from "./Rooms.tsx";

/** Seats and the door, against a stub of the console's client. */

const row = (ref: string, patch: Partial<SeatRow> = {}): SeatRow => ({ ref, name: `Name ${ref}`, centre: "", room: "", seat: "", present: false, attemptState: "not_started", ...patch });

function show(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("seating", () => {
  it("lists rooms, refuses too few seats, and seats everyone", async () => {
    const client = {
      seats: vi.fn(async () => [row("CS1"), row("CS2"), row("CS3")]),
      allocateSeats: vi.fn(async () => ({ seated: 3, spare: 1 })),
      admitCards: vi.fn(async () => new Blob(["%PDF"])),
    };
    const user = userEvent.setup();
    show(<SeatingCard client={client as unknown as ConsoleClient} examId="drive" canSeat />);
    const card = await screen.findByRole("region", { name: "Seats and admit cards" });
    expect(card).toHaveTextContent("Not seated yet");
    await user.click(within(card).getByRole("button", { name: "Seat candidates" }));
    const seats = within(card).getByRole("spinbutton", { name: "Seats in room 1" });
    await user.clear(seats);
    await user.type(seats, "2");
    expect(within(card).getByRole("status")).toHaveTextContent("2 seats for 3 candidates");
    expect(within(card).getByRole("button", { name: "Seat 3 candidates" })).toBeDisabled();
    await user.click(within(card).getByRole("button", { name: "Add a room" }));
    await user.click(within(card).getByRole("button", { name: "Seat 3 candidates" }));
    await waitFor(() =>
      expect(client.allocateSeats).toHaveBeenCalledWith("drive", [
        { centre: "", room: "Lab 1", seats: 2 },
        { centre: "", room: "Lab 2", seats: 2 },
      ]),
    );
  });
});

describe("rooms on the live page", () => {
  it("counts each room, names who is missing, and marks arrivals at the door", async () => {
    const client = {
      seats: vi.fn(async () => [
        row("CS1", { room: "Lab 1", seat: "01", present: true, attemptState: "in_progress" }),
        row("CS2", { room: "Lab 1", seat: "02" }),
        row("CS3", { room: "Lab 2", seat: "01", present: true, attemptState: "submitted" }),
      ]),
      markPresent: vi.fn(async () => ({ ref: "CS2", name: "Name CS2", room: "Lab 1", seat: "02", already: null })),
    };
    const user = userEvent.setup();
    show(<RoomsCard client={client as unknown as ConsoleClient} examId="drive" />);
    const lab1 = await screen.findByRole("article", { name: "Lab 1" });
    expect(lab1).toHaveTextContent("Seats2Present1Started1Submitted0");
    expect(lab1).toHaveTextContent("Not here yet: CS2");
    expect(screen.getByRole("article", { name: "Lab 2" })).toHaveTextContent("Submitted1");

    await user.click(screen.getByRole("button", { name: "At the door" }));
    await user.type(screen.getByRole("textbox", { name: "Roll number or card code" }), "CS2{Enter}");
    await waitFor(() => expect(client.markPresent).toHaveBeenCalledWith("drive", "CS2"));
    expect(await screen.findByRole("list", { name: "Marked" })).toHaveTextContent("CS2 Name CS2 — Lab 1 seat 02");
  });
});
