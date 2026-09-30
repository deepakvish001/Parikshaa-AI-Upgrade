import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProbePanel } from "./ProbePanel.tsx";

describe("a follow-up question", () => {
  it("takes the candidate to its reply box once it is written out", () => {
    const { rerender } = render(<ProbePanel prompt="Why" streaming onReply={vi.fn()} />);
    expect(screen.getByRole("textbox")).not.toHaveFocus();
    rerender(<ProbePanel prompt="Why does it hold?" streaming={false} onReply={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("leaves focus in a window the candidate has open, such as the submit summary", () => {
    const { rerender } = render(
      <>
        <ProbePanel prompt="Why" streaming onReply={vi.fn()} />
        <div role="dialog" aria-modal="true" aria-label="Submit your attempt?">
          <button type="button">Keep working</button>
        </div>
      </>,
    );
    const keep = screen.getByRole("button", { name: "Keep working" });
    keep.focus();
    rerender(
      <>
        <ProbePanel prompt="Why does it hold?" streaming={false} onReply={vi.fn()} />
        <div role="dialog" aria-modal="true" aria-label="Submit your attempt?">
          <button type="button">Keep working</button>
        </div>
      </>,
    );
    expect(keep).toHaveFocus();
  });
});
