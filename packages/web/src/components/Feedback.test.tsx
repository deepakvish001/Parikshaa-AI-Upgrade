import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Feedback, type FeedbackClient } from "./Feedback.tsx";

const client = (over: Partial<FeedbackClient> = {}): FeedbackClient => ({
  feedbackGiven: vi.fn(async () => false),
  giveFeedback: vi.fn(async () => undefined),
  ...over,
});

describe("how the test went", () => {
  it("asks for a rating, and a comment if they have one, saying who reads it", async () => {
    const c = client();
    render(<Feedback client={c} />);
    expect(await screen.findByRole("heading", { name: "How was the test?" })).toBeInTheDocument();
    expect(screen.getByText("Optional. Your institution reads your answer without your name.")).toBeInTheDocument();

    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: "2 out of 5" }));
    await userEvent.type(screen.getByLabelText("Anything that got in the way? (optional)"), "The page froze on my phone.");
    await userEvent.click(send);

    expect(c.giveFeedback).toHaveBeenCalledWith(2, "The page froze on my phone.");
    expect(await screen.findByRole("status")).toHaveTextContent("Thank you. Your institution will read what you said.");
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
  });

  it("does not ask again once answered", async () => {
    render(<Feedback client={client({ feedbackGiven: vi.fn(async () => true) })} />);
    expect(await screen.findByRole("status")).toHaveTextContent("Thank you.");
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("says so when it did not send, and can be sent again", async () => {
    const giveFeedback = vi.fn<FeedbackClient["giveFeedback"]>().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    render(<Feedback client={client({ giveFeedback })} />);
    await userEvent.click(await screen.findByRole("radio", { name: "5 out of 5" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That did not send. Please try again.");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Thank you."));
    expect(giveFeedback).toHaveBeenCalledTimes(2);
  });
});
