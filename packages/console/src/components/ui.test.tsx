import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Dialog, TabPanel, Tabs, ToastProvider, Tooltip, useToast } from "@parikshaa/brand/ui";

/** The shared pieces behave as their WAI-ARIA patterns say, wherever they are used. */

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open ? (
        <Dialog label="Confirm" onClose={() => setOpen(false)}>
          <button type="button">First</button>
          <button type="button" onClick={() => setOpen(false)}>
            Last
          </button>
        </Dialog>
      ) : null}
    </>
  );
}

describe("Dialog", () => {
  it("takes focus, keeps Tab inside, closes on Escape and gives focus back", async () => {
    render(<DialogHarness />);
    const opener = screen.getByRole("button", { name: "Open" });
    await userEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Confirm" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });
});

function TabsHarness() {
  const [tab, setTab] = useState<"a" | "b" | "c">("a");
  return (
    <>
      <Tabs label="Example" idBase="t" value={tab} onChange={setTab} items={[{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }]} />
      <TabPanel idBase="t" id="a" value={tab}>
        Panel A
      </TabPanel>
      <TabPanel idBase="t" id="b" value={tab}>
        Panel B
      </TabPanel>
      <TabPanel idBase="t" id="c" value={tab}>
        Panel C
      </TabPanel>
    </>
  );
}

describe("Tabs", () => {
  it("move with the arrow keys, Home and End, with only the chosen tab in the Tab order", async () => {
    render(<TabsHarness />);
    const [a, b, c] = screen.getAllByRole("tab");
    expect(a).toHaveAttribute("tabindex", "0");
    expect(b).toHaveAttribute("tabindex", "-1");
    await userEvent.click(a!);
    await userEvent.keyboard("{ArrowRight}");
    expect(b).toHaveFocus();
    expect(b).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "B" })).toHaveTextContent("Panel B");
    await userEvent.keyboard("{End}");
    expect(c).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(a).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(c).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(a).toHaveAttribute("aria-selected", "true");
  });
});

describe("Tooltip", () => {
  it("describes its control, and shows on keyboard focus", async () => {
    render(
      <Tooltip text="Remove from the paper">
        <button type="button" aria-label="Remove">
          x
        </button>
      </Tooltip>,
    );
    const button = screen.getByRole("button", { name: "Remove" });
    expect(button).toHaveAccessibleDescription("Remove from the paper");
    await userEvent.tab();
    expect(screen.getByRole("tooltip")).toHaveClass("shown");
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("tooltip")).not.toHaveClass("shown");
  });
});

function ToastButton() {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast("Saved", "success")}>
      Save
    </button>
  );
}

describe("Toasts", () => {
  it("are announced without taking focus, and go on their own", async () => {
    render(
      <ToastProvider lingerMs={50}>
        <ToastButton />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    const region = screen.getByRole("region", { name: "Notifications" });
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("Saved");
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(region).not.toHaveTextContent("Saved");
  });
});
