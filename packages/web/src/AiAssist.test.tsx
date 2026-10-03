import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AiAssist, sourceOf } from "./components/AiAssist.tsx";
import { PreferencesProvider } from "./i18n.tsx";

/** Plan row 87: the AI assistant beside the editor on an AI-fluency question. */

const show = (props: Partial<Parameters<typeof AiAssist>[0]> = {}) => {
  const ask = vi.fn(async () => ({ reply: "Use a hash set.", left: 18 }));
  render(
    <PreferencesProvider>
      <AiAssist initial={[{ prompt: "Where do I start?", reply: "Read the input." }]} disabled={false} code={() => "def dup(a): pass"} ask={ask} {...props} />
    </PreferencesProvider>,
  );
  return ask;
};

describe("the AI assistant", () => {
  it("says up front that everything is recorded, shows the conversation so far, and sends the code with each question", async () => {
    const ask = show();
    expect(screen.getByText(/recorded for the reviewer/)).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "AI assistant" });
    expect(list).toHaveTextContent("Where do I start?");
    expect(list).toHaveTextContent("Read the input.");
    expect(screen.getByText("19 questions left on this question")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Ask the AI assistant" }), "Fastest way?");
    await user.click(screen.getByRole("button", { name: /Ask/ }));
    await waitFor(() => expect(ask).toHaveBeenCalledWith("Fastest way?", "def dup(a): pass"));
    expect(await within(list).findByText("Use a hash set.")).toBeInTheDocument();
    expect(screen.getByText("18 questions left on this question")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Ask the AI assistant" })).toHaveValue("");
  });

  it("sends no code when the editor is empty, and shows a refusal", async () => {
    const ask = vi.fn(async () => {
      throw new Error("The AI assistant is not available just now: carry on without it");
    });
    show({ ask, code: () => "  ", initial: [] });
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Ask the AI assistant" }), "Hi");
    await user.click(screen.getByRole("button", { name: /Ask/ }));
    expect(ask).toHaveBeenCalledWith("Hi", null);
    expect(await screen.findByRole("alert")).toHaveTextContent("carry on without it");
  });

  it("asks nothing once the part's time is up", () => {
    show({ disabled: true });
    expect(screen.queryByRole("textbox", { name: "Ask the AI assistant" })).toBeNull();
  });

  it("reads the source out of a stored answer", () => {
    expect(sourceOf(JSON.stringify({ language: "python", source: "print(1)" }))).toBe("print(1)");
    expect(sourceOf("print(2)")).toBe("print(2)");
  });
});
