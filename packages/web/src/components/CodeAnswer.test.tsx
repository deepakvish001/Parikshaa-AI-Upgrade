import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CandidateCodeQuestion } from "@parikshaa/core/browser";
import { CodeAnswer, readCodeAnswer } from "./CodeAnswer.tsx";

const question = {
  id: "sum",
  kind: "code",
  stem: "Print the sum of two integers.",
  maxScore: 10,
  language: "python",
  languages: ["python", "cpp"],
  starter: "# read two numbers\n",
  samples: [{ input: "2 3", output: "5" }],
} as unknown as CandidateCodeQuestion;

describe("CodeAnswer", () => {
  it("opens with the starter code in a highlighted editor, and shows the examples", async () => {
    render(<CodeAnswer question={question} value="" disabled={false} onChange={vi.fn()} onRun={vi.fn()} />);

    // The highlighted editor arrives a moment later; the plain one stands in.
    await waitFor(() => expect(document.querySelector(".cm-content")).not.toBeNull());
    expect(screen.getByRole("textbox", { name: question.stem })).toHaveTextContent("# read two numbers");
    const examples = screen.getByText("Examples").closest("details")!;
    expect(within(examples).getByText("2 3")).toBeInTheDocument();
    expect(within(examples).getByText("5")).toBeInTheDocument();
  });

  it("keeps the language with the answer", async () => {
    const onChange = vi.fn();
    render(
      <CodeAnswer
        question={question}
        value={JSON.stringify({ language: "python", source: "print(1)" })}
        disabled={false}
        onChange={onChange}
        onRun={vi.fn()}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Language"), "cpp");

    expect(onChange).toHaveBeenCalledWith(JSON.stringify({ language: "cpp", source: "print(1)" }));
  });

  it("runs the examples and shows what came out, and what was expected when it differs", async () => {
    const onRun = vi.fn(async () => ({
      compiled: true as const,
      results: [{ input: "2 3", expectedOutput: "5", status: "wrong_answer", stdout: "6", stderr: "", timeMs: 12 }],
    }));
    render(
      <CodeAnswer
        question={question}
        value={JSON.stringify({ language: "python", source: "print(6)" })}
        disabled={false}
        onChange={vi.fn()}
        onRun={onRun}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Run examples" }));

    const results = await screen.findByRole("region", { name: "Run results" });
    expect(onRun).toHaveBeenCalledWith("python", "print(6)", undefined);
    expect(results).toHaveTextContent("Different output");
    expect(results).toHaveTextContent("6");
    expect(results).toHaveTextContent("Expected");
  });

  it("runs on the candidate's own input", async () => {
    const onRun = vi.fn(async () => ({
      compiled: true as const,
      results: [{ input: "40 2", expectedOutput: null, status: "ran", stdout: "42", stderr: "", timeMs: 9 }],
    }));
    render(
      <CodeAnswer question={question} value={JSON.stringify({ language: "python", source: "x" })} disabled={false} onChange={vi.fn()} onRun={onRun} />,
    );

    await userEvent.type(screen.getByLabelText("Your own input"), "40 2");
    await userEvent.click(screen.getByRole("button", { name: "Run on my input" }));

    await waitFor(() => expect(onRun).toHaveBeenCalledWith("python", "x", "40 2"));
    expect(await screen.findByRole("region", { name: "Run results" })).toHaveTextContent("42");
  });

  it("shows the compiler's words when it does not compile", async () => {
    const onRun = vi.fn(async () => ({ compiled: false as const, compileOutput: "main.cpp:1: error: expected ';'" }));
    render(
      <CodeAnswer question={question} value={JSON.stringify({ language: "cpp", source: "x" })} disabled={false} onChange={vi.fn()} onRun={onRun} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Run examples" }));

    expect(await screen.findByRole("region", { name: "Compiler output" })).toHaveTextContent("expected ';'");
  });

  it("says plainly when code cannot be run, and that the answer is safe", async () => {
    const onRun = vi.fn(async () => {
      throw new Error("runner_unavailable (503)");
    });
    render(
      <CodeAnswer question={question} value={JSON.stringify({ language: "python", source: "x" })} disabled={false} onChange={vi.fn()} onRun={onRun} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Run examples" }));

    expect(await screen.findByText(/cannot be run just now.*still saved/)).toBeInTheDocument();
  });

  it("reads an answer from before languages could be chosen", () => {
    expect(readCodeAnswer("print(1)", question)).toEqual({ language: "python", source: "print(1)" });
  });
});
