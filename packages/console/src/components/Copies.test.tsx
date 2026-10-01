import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@parikshaa/brand/ui";
import { describe, expect, it, vi } from "vitest";
import type { AnswerScript, ConsoleClient, ScriptBook } from "../api.ts";
import { Copies } from "./Copies.tsx";

const script: AnswerScript = {
  id: "s1",
  candidateRef: "R1",
  candidateName: "Ananya",
  status: "uploaded",
  pages: 1,
  suggestion: { at: "2026-10-05T05:00:00Z", questions: [{ questionId: "q1", score: 3.5, reason: "Misses chlorophyll.", transcript: "light and water make glucose" }] },
  marks: null,
  checkedBy: null,
  moderation: null,
  finalTotal: null,
};
const book: ScriptBook = { title: "Biology", questions: [{ id: "q1", number: 1, stem: "Explain photosynthesis.", maxScore: 5 }], total: 5, tolerancePercent: 10, scripts: [script] };

function mount(client: Partial<ConsoleClient>, canSettle = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Copies client={client as ConsoleClient} examId="bio" canSettle={canSettle} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("handwritten copies", () => {
  it("adds pages, shows the model's suggestion, and saves the examiner's marks", async () => {
    const addScriptPage = vi.fn(async () => ({ script, page: 2 }));
    const checkScript = vi.fn(async () => ({ ...script, status: "checked" as const, finalTotal: 4 }));
    URL.createObjectURL = vi.fn(() => "blob:page-1");
    URL.revokeObjectURL = vi.fn();
    mount({ scripts: async () => book, addScriptPage, checkScript, scriptPage: async () => new Blob(["x"], { type: "image/png" }) });
    const user = userEvent.setup();

    await user.type(await screen.findByRole("textbox", { name: "Roll number" }), "R2");
    await user.upload(screen.getByLabelText("Pages (photos or scans)"), new File(["png"], "p1.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Add pages" }));
    await waitFor(() => expect(addScriptPage).toHaveBeenCalledWith("bio", { ref: "R2", name: "", image: btoa("png") }));

    await user.click(screen.getByRole("button", { name: "Open" }));
    const drawer = await screen.findByRole("dialog", { name: "Copy of R1" });
    expect(within(drawer).getByText(/Suggested 3.5: Misses chlorophyll/)).toBeInTheDocument();
    expect(await within(drawer).findByRole("img", { name: "Page 1" })).toBeInTheDocument();
    const field = within(drawer).getByRole("spinbutton", { name: "Marks" });
    expect(field).toHaveValue(3.5);
    await user.clear(field);
    await user.type(field, "4");
    await user.click(within(drawer).getByRole("button", { name: "Save my marks" }));
    await waitFor(() => expect(checkScript).toHaveBeenCalledWith("s1", { q1: { score: 4, comment: "" } }));
  });

  it("asks a second examiner to mark afresh, without the first marks or the suggestion", async () => {
    const checked = { ...book, scripts: [{ ...script, status: "checked" as const, marks: { q1: { score: 4, comment: "" } }, checkedBy: "First", finalTotal: 4 }] };
    URL.createObjectURL = vi.fn(() => "blob:page-1");
    mount({ scripts: async () => checked, scriptPage: async () => new Blob(["x"]) });
    await userEvent.click(await screen.findByRole("button", { name: "Open" }));
    const drawer = await screen.findByRole("dialog", { name: "Copy of R1" });
    expect(within(drawer).getByRole("spinbutton", { name: "Marks" })).toHaveValue(null);
    expect(within(drawer).queryByText(/Suggested/)).toBeNull();
    expect(within(drawer).getByRole("button", { name: "Save as second examiner" })).toBeDisabled();
  });
});
