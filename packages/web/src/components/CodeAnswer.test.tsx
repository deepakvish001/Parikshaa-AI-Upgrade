import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidateCodeQuestion } from "@parikshaa/core/browser";
import type { SubmitOutcome } from "../api.ts";
import { useState } from "react";
import { PreferencesProvider } from "../i18n.tsx";
import type { TimelineOp } from "../code-timeline.ts";
import { replay } from "../code-timeline.ts";
import { CodeAnswer, readCodeAnswer } from "./CodeAnswer.tsx";

const question = {
  id: "sum",
  kind: "code",
  stem: "Print the sum of two integers.",
  maxScore: 10,
  language: "python",
  languages: ["python", "cpp"],
  starter: "# read two numbers\n",
  starters: { python: "# read two numbers\n", cpp: "#include <iostream>\nint main() {}\n" },
  function: null,
  inputFormat: "Two integers `a` and `b` on one line.",
  outputFormat: null,
  constraints: "- `-10^9 <= a, b <= 10^9`",
  samples: [{ input: "2 3", output: "5", explanation: "`2 + 3 = 5`" }],
} as unknown as CandidateCodeQuestion;

const twoSum = {
  id: "two-sum",
  kind: "code",
  stem: "Return the indices of the two numbers that add up to `target`.",
  maxScore: 10,
  language: "python",
  languages: ["python"],
  starter: "class Solution:\n    def twoSum(self, nums, target):\n        pass\n",
  starters: { python: "class Solution:\n    def twoSum(self, nums, target):\n        pass\n" },
  function: {
    name: "twoSum",
    params: [
      { name: "nums", type: "int[]" },
      { name: "target", type: "int" },
    ],
    returns: "int[]",
  },
  inputFormat: null,
  outputFormat: null,
  constraints: null,
  samples: [
    { input: "[2,7,11,15]\n9", output: "[0,1]", explanation: null },
    { input: "[3,2,4]\n6", output: "[1,2]", explanation: null },
  ],
} as unknown as CandidateCodeQuestion;

const answer = (source: string, language = "python") => JSON.stringify({ language, source });

beforeEach(() => localStorage.clear());

describe("the coding workspace", () => {
  it("opens with the starter code, the statement's sections and the worked examples", async () => {
    render(<CodeAnswer question={question} value="" disabled={false} onChange={vi.fn()} onRun={vi.fn()} />);

    // The highlighted editor arrives a moment later; the plain one stands in.
    await waitFor(() => expect(document.querySelector(".cm-content")).not.toBeNull());
    expect(screen.getByRole("textbox", { name: "Code for question 1" })).toHaveTextContent("# read two numbers");
    expect(screen.getByRole("heading", { name: "Input format" })).toBeInTheDocument();
    const constraints = screen.getByRole("heading", { name: "Constraints" }).parentElement!;
    expect(constraints.innerHTML).toContain("<code>-10<sup>9</sup> &lt;= a, b &lt;= 10<sup>9</sup></code>");
    const examples = screen.getByRole("region", { name: "Examples" });
    expect(within(examples).getByText("2 3")).toBeInTheDocument();
    expect(within(examples).getByText("Explanation")).toBeInTheDocument();
  });

  it("keeps the language with the answer, and moves untouched starter code to the new language", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<CodeAnswer question={question} value={answer("print(1)")} disabled={false} onChange={onChange} onRun={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText("Language"), "cpp");
    expect(onChange).toHaveBeenLastCalledWith(answer("print(1)", "cpp"));

    rerender(<CodeAnswer question={question} value={answer("# read two numbers\n")} disabled={false} onChange={onChange} onRun={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText("Language"), "cpp");
    expect(onChange).toHaveBeenLastCalledWith(answer("#include <iostream>\nint main() {}\n", "cpp"));
  });

  it("runs the examples and shows the verdict, what came out, and what was expected", async () => {
    const onRun = vi.fn(async () => ({
      compiled: true as const,
      results: [{ input: "2 3", expectedOutput: "5", status: "wrong_answer", stdout: "6", stderr: "", timeMs: 12, memoryKb: 9216 }],
    }));
    render(<CodeAnswer question={question} value={answer("print(6)")} disabled={false} onChange={vi.fn()} onRun={onRun} />);

    await userEvent.click(screen.getByRole("button", { name: "Run" }));

    const results = await screen.findByRole("region", { name: "Run results" });
    expect(onRun).toHaveBeenCalledWith("python", "print(6)", undefined);
    expect(results).toHaveTextContent("Wrong answer");
    expect(results).toHaveTextContent("0/1 examples pass");
    expect(within(results).getByLabelText("Output")).toHaveTextContent("6");
    expect(within(results).getByLabelText("Expected")).toHaveTextContent("5");
    expect(results).toHaveTextContent("Memory: 9.0 MB");
    expect(screen.getByRole("tab", { name: "Test result" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows an SQL question's tables and what a query returned as tables", async () => {
    const setup = "CREATE TABLE World (name TEXT PRIMARY KEY, area INTEGER);\nINSERT INTO World (name, area) VALUES ('India', 3287263), ('Nepal', 147516);\n";
    const sqlQuestion = {
      ...question,
      id: "big",
      stem: "Big countries\n\nReturn the names.",
      language: "sql",
      languages: ["sql"],
      starter: "",
      starters: { sql: "" },
      inputFormat: null,
      constraints: null,
      samples: [{ input: setup, output: "India\t3287263\n", explanation: null }],
    } as unknown as CandidateCodeQuestion;
    const onRun = vi.fn(async () => ({
      compiled: true as const,
      results: [{ input: setup, expectedOutput: "India\t3287263\n", status: "wrong_answer", stdout: "India\t3287263\nNepal\t147516\n", stderr: "", timeMs: 12, memoryKb: 9216 }],
    }));
    render(<CodeAnswer question={sqlQuestion} value={answer("SELECT * FROM World;", "sql")} disabled={false} onChange={vi.fn()} onRun={onRun} />);

    const world = await screen.findByRole("table", { name: "World" });
    expect(within(world).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["name TEXT", "area INTEGER"]);
    expect(within(world).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("The SQL that makes them")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Run" }));
    const results = await screen.findByRole("region", { name: "Run results" });
    const output = within(results).getByRole("table", { name: "Output" });
    expect(within(output).getAllByRole("row").map((r) => r.textContent)).toEqual(["India3287263", "Nepal147516"]);
    expect(within(within(results).getByRole("table", { name: "Expected" })).getAllByRole("row")).toHaveLength(1);
  });

  it("runs a custom case on the candidate's own input", async () => {
    const onRun = vi.fn(async () => ({
      compiled: true as const,
      results: [{ input: "40 2", expectedOutput: null, status: "ran", stdout: "42", stderr: "", timeMs: 9 }],
    }));
    render(<CodeAnswer question={question} value={answer("x")} disabled={false} onChange={vi.fn()} onRun={onRun} />);

    await userEvent.click(screen.getByRole("button", { name: "Custom" }));
    const box = screen.getByLabelText(/standard input/);
    await userEvent.clear(box);
    await userEvent.type(box, "40 2");
    await userEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => expect(onRun).toHaveBeenCalledWith("python", "x", "40 2"));
    expect(await screen.findByRole("region", { name: "Run results" })).toHaveTextContent("42");
  });

  it("shows a function question's arguments by name, and what the function returned apart from what it printed", async () => {
    const onRun = vi.fn(async () => ({
      compiled: true as const,
      results: [
        { input: "[2,7,11,15]\n9", expectedOutput: "[0,1]", status: "passed", stdout: "debug\n", result: "[0,1]", stderr: "", timeMs: 20, memoryKb: 8000 },
        { input: "[3,2,4]\n6", expectedOutput: "[1,2]", status: "passed", stdout: "", result: "[1,2]", stderr: "", timeMs: 18, memoryKb: 8000 },
      ],
    }));
    render(<CodeAnswer question={twoSum} value={answer("class Solution: ...")} disabled={false} onChange={vi.fn()} onRun={onRun} />);

    expect(screen.getAllByText("nums =")[0]).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Run" }));
    const results = await screen.findByRole("region", { name: "Run results" });
    expect(results).toHaveTextContent("Accepted");
    expect(results).toHaveTextContent("2/2 examples pass");
    expect(within(results).getByLabelText("Output")).toHaveTextContent("[0,1]");
    expect(within(results).getByLabelText("Printed")).toHaveTextContent("debug");
  });

  it("takes a custom case for a function one argument at a time", async () => {
    const onRun = vi.fn(async () => ({ compiled: true as const, results: [] }));
    render(<CodeAnswer question={twoSum} value={answer("x")} disabled={false} onChange={vi.fn()} onRun={onRun} />);
    await userEvent.click(screen.getByRole("button", { name: "Custom" }));
    const target = screen.getByRole("textbox", { name: "target =" });
    await userEvent.clear(target);
    await userEvent.type(target, "18");
    await userEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(onRun).toHaveBeenCalledWith("python", "x", "[2,7,11,15]\n18");
  });

  it("submits, and reports every test, hidden ones by verdict alone", async () => {
    const outcome: SubmitOutcome = {
      tested: true,
      compiled: true,
      passed: 2,
      total: 3,
      cases: [
        { number: 1, visible: true, status: "passed", timeMs: 20, memoryKb: 9000, input: "[2,7,11,15]\n9", expectedOutput: "[0,1]", stdout: "", result: "[0,1]", stderr: "" },
        { number: 2, visible: false, status: "passed", timeMs: 25, memoryKb: 9100, input: null, expectedOutput: null, stdout: null, result: null, stderr: null },
        { number: 3, visible: false, status: "time_limit", timeMs: 2000, memoryKb: 9100, input: null, expectedOutput: null, stdout: null, result: null, stderr: null },
      ],
    };
    const onSubmit = vi.fn(async () => outcome);
    render(<CodeAnswer question={twoSum} value={answer("x")} disabled={false} onChange={vi.fn()} onRun={vi.fn()} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    const results = await screen.findByRole("region", { name: "Submission results" });
    expect(onSubmit).toHaveBeenCalledWith("python", "x");
    expect(results).toHaveTextContent("Time limit exceeded");
    expect(results).toHaveTextContent("2/3 tests passed");
    await userEvent.click(within(results).getByRole("button", { name: /Hidden test 3/ }));
    expect(results).toHaveTextContent("only whether it passed is shown");
  });

  it("says when the exam keeps hidden results until afterwards", async () => {
    const outcome: SubmitOutcome = {
      tested: true,
      compiled: true,
      passed: null,
      total: null,
      cases: [{ number: 1, visible: true, status: "passed", timeMs: 20, memoryKb: null, input: "1", expectedOutput: "1", stdout: "1", result: null, stderr: "" }],
    };
    render(<CodeAnswer question={question} value={answer("x")} disabled={false} onChange={vi.fn()} onRun={vi.fn()} onSubmit={async () => outcome} />);
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("region", { name: "Submission results" })).toHaveTextContent("Hidden tests are checked after the test ends");
  });

  it("shows the compiler's words when it does not compile", async () => {
    const onRun = vi.fn(async () => ({ compiled: false as const, compileOutput: "main.cpp:1: error: expected ';'" }));
    render(<CodeAnswer question={question} value={answer("x", "cpp")} disabled={false} onChange={vi.fn()} onRun={onRun} />);
    await userEvent.click(screen.getByRole("button", { name: "Run" }));

    const output = await screen.findByRole("region", { name: "Compiler output" });
    expect(output).toHaveTextContent("Compile error");
    expect(output).toHaveTextContent("expected ';'");
  });

  it("says plainly when code cannot be run, and that the answer is safe", async () => {
    const onRun = vi.fn(async () => {
      throw new Error("runner_unavailable (503)");
    });
    render(<CodeAnswer question={question} value={answer("x")} disabled={false} onChange={vi.fn()} onRun={onRun} />);
    await userEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText(/cannot be run just now.*still saved/)).toBeInTheDocument();
  });

  it("resets to the starter code only when the candidate confirms", async () => {
    const onChange = vi.fn();
    render(<CodeAnswer question={question} value={answer("print(99)")} disabled={false} onChange={onChange} onRun={vi.fn()} />);
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onChange).toHaveBeenCalledWith(answer("# read two numbers\n"));
    confirm.mockRestore();
  });

  it("remembers the dark editor and the text size on this device", async () => {
    const { unmount } = render(<CodeAnswer question={question} value={answer("x")} disabled={false} onChange={vi.fn()} onRun={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Dark editor" }));
    await userEvent.click(screen.getByRole("button", { name: "Larger text" }));
    expect(JSON.parse(localStorage.getItem("parikshaa.editor")!)).toEqual({ dark: true, fontSize: 15 });
    unmount();
    render(<CodeAnswer question={question} value={answer("x")} disabled={false} onChange={vi.fn()} onRun={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Dark editor" })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens full screen with the problem beside the editor, and returns", async () => {
    render(<CodeAnswer question={twoSum} number={3} value={answer("x")} disabled={false} onChange={vi.fn()} onRun={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Full screen" }));

    const dialog = screen.getByRole("dialog", { name: /3\. Return the indices/ });
    expect(within(dialog).getAllByRole("separator")).toHaveLength(2);
    expect(document.body).toHaveClass("workspace-open");
    await userEvent.click(within(dialog).getByRole("button", { name: "Back to the paper" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body).not.toHaveClass("workspace-open");
  });

  it("lets a divider be moved with the keyboard, and keeps where it was left", async () => {
    localStorage.removeItem("parikshaa.split.code-problem");
    const { unmount } = render(<CodeAnswer question={twoSum} value={answer("x")} disabled={false} onChange={vi.fn()} onRun={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Full screen" }));
    const [divider] = screen.getAllByRole("separator");
    divider!.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(divider).toHaveAttribute("aria-valuenow", "45");
    unmount();

    // The next time the workspace opens, the problem is as wide as it was left.
    render(<CodeAnswer question={twoSum} value={answer("x")} disabled={false} onChange={vi.fn()} onRun={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Full screen" }));
    expect(screen.getAllByRole("separator")[0]).toHaveAttribute("aria-valuenow", "45");
    localStorage.removeItem("parikshaa.split.code-problem");
  });

  it("offers no Run or Submit once the attempt is closed", () => {
    render(<CodeAnswer question={question} value={answer("x")} disabled onChange={vi.fn()} onRun={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Run" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
  });

  it("lists the candidate's submissions, refreshes after a Submit, and puts an old one back in the editor (G4)", async () => {
    const older = { number: 1, at: Date.UTC(2026, 9, 3, 4, 30), language: "python", source: "print(0)", tested: true, accepted: false, passed: 1, total: 3 };
    const newer = { ...older, number: 2, source: "print(5)", accepted: true, passed: 3, total: 3 };
    const onHistory = vi.fn().mockResolvedValueOnce([older]).mockResolvedValue([newer, older]);
    const onChange = vi.fn();
    const submitted: SubmitOutcome = { tested: true, compiled: true, passed: 3, total: 3, cases: [] };
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<CodeAnswer question={question} value={answer("print(5)")} disabled={false} onChange={onChange} onRun={vi.fn()} onSubmit={vi.fn().mockResolvedValue(submitted)} onHistory={onHistory} />);

    await userEvent.click(screen.getByRole("tab", { name: "Submissions" }));
    const list = await screen.findByRole("region", { name: "Submissions" });
    expect(within(list).getByRole("button", { name: /Submission 1.*Not accepted.*1\/3 tests passed/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await userEvent.click(screen.getByRole("tab", { name: "Submissions" }));
    expect(await screen.findByRole("button", { name: /Submission 2.*Accepted/ })).toBeInTheDocument();
    expect(onHistory).toHaveBeenCalledTimes(3);

    await userEvent.click(screen.getByRole("button", { name: /Submission 1/ }));
    expect(screen.getByLabelText("Submission 1")).toHaveTextContent("print(0)");
    await userEvent.click(screen.getByRole("button", { name: "Put this code in the editor" }));
    expect(onChange).toHaveBeenLastCalledWith(answer("print(0)"));
  });

  it("says when nothing has been submitted yet", async () => {
    render(<CodeAnswer question={question} value="" disabled onChange={vi.fn()} onRun={vi.fn()} onHistory={vi.fn().mockResolvedValue([])} />);
    await userEvent.click(screen.getByRole("tab", { name: "Submissions" }));
    expect(await screen.findByText(/Nothing submitted yet/)).toBeInTheDocument();
  });

  it("records each change for playback, a paste marked as one, and says so to the candidate (G4)", async () => {
    localStorage.setItem("parikshaa.lite", "1");
    const ops: TimelineOp[] = [];
    function Stateful() {
      const [value, setValue] = useState(answer("x = 1"));
      return <CodeAnswer question={question} value={value} disabled={false} onChange={setValue} onRun={vi.fn()} onEdit={(op) => ops.push(op)} />;
    }
    render(
      <PreferencesProvider>
        <Stateful />
      </PreferencesProvider>,
    );
    expect(screen.getByText(/How you write your code here is recorded/)).toBeInTheDocument();
    const box = screen.getByRole("textbox", { name: "Code for question 1" });
    await userEvent.click(box);
    await userEvent.type(box, "2");
    await userEvent.paste("\nprint(x)");
    expect(ops[0]).toMatchObject({ at: 0, del: 0, ins: "x = 1", reset: true });
    expect(ops.filter((o) => o.paste === true).map((o) => o.ins)).toEqual(["\nprint(x)"]);
    expect(replay(ops)).toBe("x = 12\nprint(x)");

    vi.spyOn(window, "confirm").mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(ops.at(-1)).toMatchObject({ reset: true, ins: "# read two numbers\n" });
    expect(replay(ops)).toBe("# read two numbers\n");
  });

  it("reads an answer from before languages could be chosen", () => {
    expect(readCodeAnswer("print(1)", question)).toEqual({ language: "python", source: "print(1)" });
  });
});
