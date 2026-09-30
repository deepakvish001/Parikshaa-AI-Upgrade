import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MyResult as Result } from "../api.ts";
import { MyResult, type ResultClient } from "./MyResult.tsx";
import { ScorecardCheck } from "./ScorecardCheck.tsx";

const released: Result = {
  released: true,
  title: "Campus drive",
  institution: "Acme Engineering",
  total: 6,
  maxTotal: 8,
  percent: 75,
  outcome: "qualified",
  questions: [
    { id: "q1", number: 1, stem: "Which sort is stable?", score: 4, max: 4 },
    { id: "q2", number: 2, stem: "Why does binary search stop?", score: 2, max: 4 },
  ],
  rechecks: [],
  recheckUntil: "2026-10-08T04:30:00.000Z",
};

const client = (result: Result, over: Partial<ResultClient> = {}): ResultClient => ({
  result: vi.fn(async () => result),
  askRecheck: vi.fn(async () => undefined),
  scorecard: vi.fn(async () => new Blob(["%PDF"])),
  ...over,
});

afterEach(() => vi.unstubAllGlobals());

describe("the candidate's result", () => {
  it("shows nothing before it is released", async () => {
    const c = client({ released: false });
    const { container } = render(<MyResult client={c} />);
    await waitFor(() => expect(c.result).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the marks by question, and asks for a recheck with a reason", async () => {
    const c = client(released);
    render(<MyResult client={c} />);
    const card = await screen.findByRole("region", { name: "Your result" });
    expect(card).toHaveTextContent("6 out of 8 (75%)");
    expect(card).toHaveTextContent("You reached the qualifying mark.");
    expect(card).toHaveTextContent(/You can ask about up to 3 questions until 8 Oct 2026/);

    // Full marks leave nothing to ask about.
    expect(within(card).queryByRole("button", { name: "Ask for question 1 to be rechecked" })).toBeNull();
    await userEvent.click(within(card).getByRole("button", { name: "Ask for question 2 to be rechecked" }));
    const send = within(card).getByRole("button", { name: "Send the request" });
    expect(send).toBeDisabled();
    await userEvent.type(within(card).getByLabelText("Why should it be looked at again?"), "I explained that the interval halves.");
    await userEvent.click(send);
    expect(c.askRecheck).toHaveBeenCalledWith("q2", "I explained that the interval halves.");
    await waitFor(() => expect(c.result).toHaveBeenCalledTimes(2));
  });

  it("says what came of a recheck, with the reply", async () => {
    render(
      <MyResult
        client={client({
          ...released,
          rechecks: [{ id: "r1", questionId: "q2", reason: "…", status: "changed", scoreBefore: 2, scoreAfter: 3, reply: "The halving earns a mark.", decidedAt: "2026-10-02T00:00:00.000Z" }],
        })}
      />,
    );
    const card = await screen.findByRole("region", { name: "Your result" });
    expect(card).toHaveTextContent("Rechecked: changed from 2 to 3");
    expect(card).toHaveTextContent("Reply: The halving earns a mark.");
    expect(within(card).queryByRole("button", { name: "Ask for question 2 to be rechecked" })).toBeNull();
  });
});

describe("checking a scorecard", () => {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

  it("shows the result as it stands", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          valid: true,
          institution: "Acme Engineering",
          candidate: { name: "Ananya Iyer", ref: "CS001" },
          title: "Campus drive",
          total: 6,
          maxTotal: 8,
          percent: 75,
          outcome: "qualified",
          sittingDate: "2026-10-01T04:30:00.000Z",
          record: "abcdef0123456789abcdef",
        }),
      ),
    );
    render(<ScorecardCheck code="org-a.att.mac" />);
    expect(await screen.findByRole("heading", { name: "This scorecard is genuine." })).toBeInTheDocument();
    expect(screen.getByText("Ananya Iyer (CS001)")).toBeInTheDocument();
    expect(screen.getByText("6 / 8 (75%)")).toBeInTheDocument();
    expect(screen.getByText("Reached")).toBeInTheDocument();
  });

  it("says when a result was withdrawn", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ valid: false, reason: "withdrawn" })));
    render(<ScorecardCheck code="org-a.att.mac" />);
    expect(await screen.findByRole("heading", { name: "This result has been withdrawn by the institution." })).toBeInTheDocument();
  });
});
