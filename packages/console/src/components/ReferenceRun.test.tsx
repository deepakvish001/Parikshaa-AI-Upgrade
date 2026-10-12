import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CodeQuestion } from "@parikshaa/core/browser";
import { ConsoleError, type ReferenceChecker, type ReferenceRun } from "../api.ts";
import { ReferenceRunner } from "./ReferenceRun.tsx";

/** An author's reference program (G4): run on every test, its outputs taken as the expected ones. */

const question = {
  id: "q1",
  kind: "code",
  stem: "Sum",
  maxScore: 10,
  rubric: [],
  language: "python",
  languages: ["python", "cpp"],
  tests: [
    { id: "a", input: "2 3\n", expected: "", hidden: false, weight: 1 },
    { id: "b", input: "-7 2\n", expected: "wrong\n", hidden: true, weight: 1 },
    { id: "c", input: "x\n", expected: "", hidden: true, weight: 1 },
  ],
} as unknown as CodeQuestion;

const ran: ReferenceRun = {
  compiled: true,
  tests: [
    { id: "a", status: "wrong_answer", output: "5\n", stderr: "", timeMs: 12, memoryKb: 900 },
    { id: "b", status: "wrong_answer", output: "-5\n", stderr: "", timeMs: 11, memoryKb: 900 },
    { id: "c", status: "runtime_error", output: "", stderr: "ValueError", timeMs: 9, memoryKb: 900 },
  ],
};

function Harness({ check, seen }: { check: ReferenceChecker; seen: (q: CodeQuestion) => void }) {
  const [q, setQ] = useState(question);
  return <ReferenceRunner question={q} check={check} onChange={(next) => (setQ(next), seen(next))} />;
}

describe("the reference program", () => {
  it("runs on every test and fills the expected outputs from the tests it ran cleanly", async () => {
    const check = vi.fn(async () => ran);
    const seen = vi.fn();
    render(<Harness check={check} seen={seen} />);
    await userEvent.click(screen.getByText(/Reference program: check the tests/));
    await userEvent.selectOptions(screen.getByLabelText("Language"), "cpp");
    fireEvent.change(screen.getByLabelText("Reference program"), { target: { value: "int main(){}" } });
    await userEvent.click(screen.getByRole("button", { name: "Run on all 3 tests" }));
    expect(check).toHaveBeenCalledWith(question, "cpp", "int main(){}");

    const table = screen.getByRole("table", { name: "What the reference program did on each test" });
    expect(within(table).getByText("2 (hidden)")).toBeInTheDocument();
    expect(within(table).getByText("Crashed")).toBeInTheDocument();
    expect(within(table).getByText("ValueError")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Use its outputs as the expected ones (2)" }));
    expect(seen.mock.lastCall![0].tests.map((t: { expected: string }) => t.expected)).toEqual(["5\n", "-5\n", ""]);
  });

  it("shows a compile error, and the server's reason when it refuses", async () => {
    const check = vi.fn().mockResolvedValueOnce({ compiled: false, compileOutput: "error: expected ';'" }).mockRejectedValueOnce(new ConsoleError(422, "no_tests", [], "Add a test first"));
    render(<Harness check={check} seen={vi.fn()} />);
    await userEvent.click(screen.getByText(/Reference program: check the tests/));
    fireEvent.change(screen.getByLabelText("Reference program"), { target: { value: "x" } });
    await userEvent.click(screen.getByRole("button", { name: "Run on all 3 tests" }));
    expect(screen.getByText("error: expected ';'")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Run on all 3 tests" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Add a test first");
  });
});
