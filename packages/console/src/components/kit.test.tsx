/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Empty,
  ErrorState,
  FirstTime,
  FocusBar,
  Meter,
  OfflineBanner,
  PaneHead,
  Panes,
  Ring,
  Seg,
  Skeleton,
  useMedia,
  usePanes,
  type PaneDef,
} from "@parikshaa/brand/kit";

/**
 * Learn's kit (packages/brand/src/kit.tsx) behaves as DESIGN-SYSTEM §6–§9
 * says, and axe finds nothing in any of it. Tested here, as the rest of the
 * brand's UI is (ui.test.tsx), with the console's jsdom set-up.
 *
 * axe runs the WCAG 2.0–2.2 A and AA rules. Two need a laid-out page, which
 * jsdom does not have, so they are off here and left to the browser checks
 * (Playwright with @axe-core/playwright): colour-contrast (tokens.test.ts
 * checks the token pairs instead) and target-size (kit.css sets the 40 px).
 */
async function violations(container: Element): Promise<string[]> {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false }, "target-size": { enabled: false } },
    resultTypes: ["violations"],
  });
  return result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

/** jsdom has no matchMedia; this one answers by a rule that a test can change. */
function mockMedia(initial: (query: string) => boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  window.matchMedia = vi.fn((query: string) => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return {
    set(next: (query: string) => boolean) {
      matches = next;
      act(() => listeners.forEach((fn) => fn()));
    },
  };
}
const phone = (query: string) => query === "(max-width: 860px)";
const wide = () => false;

afterEach(() => {
  // @ts-expect-error jsdom has none; each test that needs one sets its own.
  delete window.matchMedia;
});

describe("the axe check", () => {
  it("reports what it should, so a clean result means something", async () => {
    const { container } = render(
      <div>
        <button type="button" />
        <div role="progressbar" aria-valuenow={5} />
      </div>,
    );
    const found = (await violations(container)).map((v) => v.split(" ")[0]);
    expect(found).toEqual(expect.arrayContaining(["button-name", "aria-progressbar-name"]));
  });
});

type Id = "problem" | "code" | "sahayak";

function Workspace({ initial = { problem: true, code: true, sahayak: false } }: { initial?: Record<Id, boolean> }) {
  const { open, toggle } = usePanes<Id>(initial);
  const panes: PaneDef<Id>[] = [
    {
      id: "problem",
      label: "Problem",
      weight: 0.31,
      content: (
        <PaneHead onClose={() => toggle("problem")} closeLabel="Hide the problem">
          <b>Two sum</b>
        </PaneHead>
      ),
    },
    {
      id: "code",
      label: "Code",
      weight: 0.42,
      min: 380,
      content: (
        <>
          <PaneHead onClose={() => toggle("code")}>
            <b>main.py</b>
          </PaneHead>
          <label>
            Answer <input />
          </label>
        </>
      ),
    },
    {
      id: "sahayak",
      label: "Sahayak",
      weight: 0.3,
      tone: "ai",
      content: (
        <PaneHead onClose={() => toggle("sahayak")}>
          <b>Hints</b>
        </PaneHead>
      ),
    },
  ];
  return <Panes panes={panes} open={open} toggle={toggle} />;
}

describe("useMedia", () => {
  it("is false without matchMedia, and follows the query as it changes", () => {
    expect(renderHook(() => useMedia("(max-width: 860px)")).result.current).toBe(false);
    const media = mockMedia(wide);
    const { result } = renderHook(() => useMedia("(max-width: 860px)"));
    expect(result.current).toBe(false);
    media.set(phone);
    expect(result.current).toBe(true);
  });
});

describe("usePanes", () => {
  it("opens and closes panes, and never closes the last one", () => {
    const { result } = renderHook(() => usePanes<"a" | "b">({ a: true, b: false }));
    act(() => result.current.toggle("b"));
    expect(result.current.open).toEqual({ a: true, b: true });
    act(() => result.current.show("a", false));
    act(() => result.current.toggle("b"));
    expect(result.current.open).toEqual({ a: false, b: true });
  });
});

describe("Panes", () => {
  it("shows open panes as named regions, and a closed one as a rail that opens it", async () => {
    const { container } = render(<Workspace />);
    expect(screen.getByRole("region", { name: "Problem" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Code" })).toBeVisible();
    // Closed: still mounted (it keeps its state), but inert and hidden from screen readers.
    expect(screen.queryByRole("region", { name: "Sahayak" })).toBeNull();
    const closed = container.querySelector<HTMLElement>("section.is-closed")!;
    expect(closed).toHaveAttribute("inert");
    expect(closed).toHaveAttribute("aria-hidden", "true");
    expect(await violations(container)).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Show Sahayak" }));
    expect(screen.getByRole("region", { name: "Sahayak" })).not.toHaveAttribute("inert");
    expect(screen.queryByRole("button", { name: "Show Sahayak" })).toBeNull();
    expect(screen.getAllByRole("separator")).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Hide the problem" }));
    expect(screen.queryByRole("region", { name: "Problem" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show Problem" })).toBeInTheDocument();
    // With the problem closed, one divider is left: between code and Sahayak.
    expect(screen.getByRole("separator")).toHaveAccessibleName("Resize Code and Sahayak");
    expect(await violations(container)).toEqual([]);
  });

  it("keeps the last open pane open", async () => {
    render(<Workspace initial={{ problem: false, code: true, sahayak: false }} />);
    await userEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.getByRole("region", { name: "Code" })).not.toHaveAttribute("inert");
  });

  it("resizes with the arrow keys on the divider, Home and End to the ends", async () => {
    render(<Workspace />);
    const divider = screen.getByRole("separator", { name: "Resize Problem and Code" });
    const problem = screen.getByRole("region", { name: "Problem" });
    expect(divider).toHaveAttribute("aria-orientation", "vertical");
    expect(divider).toHaveAttribute("aria-controls", problem.id);
    // 0.31 of 0.73: the problem has 42% of the two panes.
    expect(divider).toHaveAttribute("aria-valuenow", "42");
    expect(divider).toHaveAttribute("aria-valuemin", "14");
    expect(divider).toHaveAttribute("aria-valuemax", "86");
    const grow = () => Number(problem.style.flexGrow);
    const before = grow();

    await userEvent.tab();
    await userEvent.tab();
    expect(divider).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(divider).toHaveAttribute("aria-valuenow", "47");
    expect(grow()).toBeGreaterThan(before);
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(divider).toHaveAttribute("aria-valuenow", "37");
    await userEvent.keyboard("{End}");
    expect(divider).toHaveAttribute("aria-valuenow", "86");
    await userEvent.keyboard("{ArrowRight}");
    expect(divider).toHaveAttribute("aria-valuenow", "86");
    await userEvent.keyboard("{Home}");
    expect(divider).toHaveAttribute("aria-valuenow", "14");
  });

  it("resizes when the divider is dragged", () => {
    const { container } = render(<Workspace />);
    Object.defineProperty(container.firstElementChild, "clientWidth", { configurable: true, value: 1000 });
    const divider = screen.getByRole("separator");
    fireEvent.pointerDown(divider, { button: 0, clientX: 400 });
    expect(container.firstElementChild).toHaveClass("is-resizing");
    // 100 px of 1000 is a tenth of the open weight (0.073), 10 percent of the pair.
    fireEvent.pointerMove(window, { clientX: 500 });
    expect(divider).toHaveAttribute("aria-valuenow", "52");
    fireEvent.pointerUp(window);
    expect(container.firstElementChild).not.toHaveClass("is-resizing");
    fireEvent.pointerMove(window, { clientX: 900 });
    expect(divider).toHaveAttribute("aria-valuenow", "52");
  });

  it("takes its own words for the rail and the divider", () => {
    const { open, toggle } = { open: { a: true, b: true, c: false }, toggle: () => undefined };
    render(
      <Panes
        panes={[
          { id: "a", label: "Sawaal", weight: 1, content: "A" },
          { id: "b", label: "Code", weight: 1, content: "B" },
          { id: "c", label: "Sahayak", weight: 1, content: "C" },
        ]}
        open={open}
        toggle={toggle}
        railLabel={(p) => `${p.label} kholo`}
        resizeLabel={(l, r) => `${l.label} aur ${r.label} ka size`}
      />,
    );
    expect(screen.getByRole("button", { name: "Sahayak kholo" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Sawaal aur Code ka size" })).toBeInTheDocument();
  });

  it("are tabs on a phone, one pane at a time, moved with the arrow keys", async () => {
    mockMedia(phone);
    const { container } = render(<Workspace />);
    const tabs = screen.getByRole("tablist", { name: "Panes" });
    expect(tabs).toBeInTheDocument();
    const [problem, code, sahayak] = screen.getAllByRole("tab");
    expect(problem).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Problem" })).toBeVisible();
    expect(screen.queryByRole("tabpanel", { name: "Code" })).toBeNull();
    expect(screen.queryByRole("separator")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Show/ })).toBeNull();
    expect(await violations(container)).toEqual([]);

    await userEvent.click(code!);
    expect(screen.getByRole("tabpanel", { name: "Code" })).toBeVisible();
    await userEvent.keyboard("{ArrowRight}");
    expect(sahayak).toHaveFocus();
    expect(sahayak).toHaveAttribute("aria-selected", "true");
    // Every pane is a tab on a phone, closed or not.
    expect(screen.getByRole("tabpanel", { name: "Sahayak" })).toBeVisible();
    await userEvent.keyboard("{ArrowRight}");
    expect(problem).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(sahayak).toHaveFocus();
  });

  it("keep what was typed when the screen turns from wide to phone and back", async () => {
    const media = mockMedia(wide);
    render(<Workspace />);
    await userEvent.type(screen.getByRole("textbox", { name: "Answer" }), "two pointers");
    media.set(phone);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Code" }));
    expect(screen.getByRole("textbox", { name: "Answer" })).toHaveValue("two pointers");
    media.set(wide);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Answer" })).toHaveValue("two pointers");
  });
});

describe("FocusBar", () => {
  it("has the way back, the screen's name, its slots, and routes through the app", async () => {
    const onNavigate = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const { container } = render(
      <FocusBar
        back={{ href: "/learn/practice", label: "Wapas", onNavigate }}
        home={{ href: "/learn", label: "Parikshaa" }}
        title="Two sum"
        sub="Arrays · Easy"
        center={<span>25:00</span>}
        right={<button type="button">Submit</button>}
        more={
          <button type="button" aria-label="Aur">
            ⋯
          </button>
        }
      />,
    );
    const back = screen.getByRole("link", { name: "Wapas" });
    expect(back).toHaveAttribute("href", "/learn/practice");
    expect(screen.getByRole("link", { name: "Parikshaa" })).toHaveAttribute("href", "/learn");
    expect(screen.getByRole("heading", { level: 1, name: "Two sum" })).toBeInTheDocument();
    expect(screen.getByText("Arrays · Easy")).toBeInTheDocument();
    expect(screen.getByText("25:00")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    expect(buttons).toEqual(["Submit", "⋯"]);

    await userEvent.click(back);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    // A click with a modifier opens a new tab; the app's router stays out of it.
    const noNavigation = (event: Event) => event.preventDefault(); // jsdom cannot open one
    document.addEventListener("click", noNavigation);
    fireEvent.click(back, { ctrlKey: true });
    document.removeEventListener("click", noNavigation);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(await violations(container)).toEqual([]);
  });

  it("leaves the h1 to the page when asked", () => {
    render(<FocusBar back={{ href: "/", label: "Back" }} title="Studio" titleAs="div" />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("Studio")).toBeInTheDocument();
  });
});

function SegHarness({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState<"en" | "hg" | "hi" | "ta">("hg");
  return (
    <Seg
      label="Bhasha"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      items={[
        { id: "en", label: "English" },
        { id: "hg", label: "Hinglish" },
        { id: "hi", label: "हिंदी" },
        { id: "ta", label: "தமிழ்", disabled: true },
      ]}
    />
  );
}

describe("Seg", () => {
  it("is a radio group: one checked, only it in the Tab order", async () => {
    const { container } = render(<SegHarness />);
    expect(screen.getByRole("radiogroup", { name: "Bhasha" })).toBeInTheDocument();
    const [en, hg, hi] = screen.getAllByRole("radio");
    expect(hg).toBeChecked();
    expect(en).not.toBeChecked();
    expect(hg).toHaveAttribute("tabindex", "0");
    expect(en).toHaveAttribute("tabindex", "-1");
    expect(hi).toHaveAttribute("tabindex", "-1");
    expect(await violations(container)).toEqual([]);
  });

  it("moves and chooses with the arrow keys, wraps, skips the disabled one, Home and End", async () => {
    const onChange = vi.fn();
    render(<SegHarness onChange={onChange} />);
    const [en, hg, hi] = screen.getAllByRole("radio");
    await userEvent.tab();
    expect(hg).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(hi).toHaveFocus();
    expect(hi).toBeChecked();
    expect(hi).toHaveAttribute("tabindex", "0");
    // தமிழ் is disabled: the next one round is English.
    await userEvent.keyboard("{ArrowRight}");
    expect(en).toHaveFocus();
    expect(en).toBeChecked();
    await userEvent.keyboard("{ArrowLeft}");
    expect(hi).toBeChecked();
    await userEvent.keyboard("{Home}");
    expect(en).toBeChecked();
    await userEvent.keyboard("{End}");
    expect(hi).toBeChecked();
    await userEvent.keyboard("{ArrowUp}");
    expect(hg).toBeChecked();
    expect(onChange.mock.calls.map(([v]) => v)).toEqual(["hi", "en", "hi", "en", "hi", "hg"]);
  });

  it("chooses on a click", async () => {
    render(<SegHarness />);
    await userEvent.click(screen.getByRole("radio", { name: "English" }));
    expect(screen.getByRole("radio", { name: "English" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "தமிழ்" }));
    expect(screen.getByRole("radio", { name: "English" })).toBeChecked();
  });
});

describe("Ring and Meter", () => {
  it("read out a name and a value; the text in the ring is for the eye", async () => {
    const { container } = render(
      <>
        <Ring value={7} max={10} label="Aaj ka kaam" valueText="10 me se 7">
          <b>7/10</b>
        </Ring>
        <span id="arrays">Arrays</span>
        <Meter value={64} labelledBy="arrays" kind="meter" tone="tick" />
        <Meter value={140} label="Course" size="thin" />
      </>,
    );
    const ring = screen.getByRole("progressbar", { name: "Aaj ka kaam" });
    expect(ring).toHaveAttribute("aria-valuenow", "7");
    expect(ring).toHaveAttribute("aria-valuemax", "10");
    expect(ring).toHaveAttribute("aria-valuetext", "10 me se 7");
    expect(ring.querySelector(".kit-ring-in")).toHaveAttribute("aria-hidden", "true");
    expect(ring.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    // 70% of the circle is drawn.
    const arc = ring.querySelector(".kit-ring-arc")!;
    expect(Number(arc.getAttribute("stroke-dashoffset")) / Number(arc.getAttribute("stroke-dasharray"))).toBeCloseTo(0.3);

    const meter = screen.getByRole("meter", { name: "Arrays" });
    expect(meter).toHaveAttribute("aria-valuenow", "64");
    expect(meter).toHaveClass("kit-tone-tick");
    expect(meter.style.getPropertyValue("--kit-m")).toBe("64%");
    // Past the end, it is held at the end.
    const course = screen.getByRole("progressbar", { name: "Course" });
    expect(course).toHaveAttribute("aria-valuenow", "100");
    expect(course.style.getPropertyValue("--kit-m")).toBe("100%");
    expect(await violations(container)).toEqual([]);
  });
});

describe("Screen states", () => {
  it("empty: a heading, why, and the one next step", async () => {
    const { container } = render(
      <Empty title="Aaj kuch plan nahi" body="Aaj aaram ka din hai." action={<a href="/learn/revision">6 cards dohrao</a>} icon={<svg />} headingLevel={3} />,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Aaj kuch plan nahi" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "6 cards dohrao" })).toBeInTheDocument();
    expect(container.querySelector(".kit-state-icon")).toHaveAttribute("aria-hidden", "true");
    expect(await violations(container)).toEqual([]);
  });

  it("loading: bars in the page's shape, hidden from screen readers, and the words announced", async () => {
    for (const shape of ["list", "cards", "doc", "workspace"] as const) {
      const { container, unmount } = render(<Skeleton label="Load ho raha hai: aaj ka plan…" shape={shape} />);
      expect(screen.getByRole("status")).toHaveTextContent("Load ho raha hai: aaj ka plan…");
      expect(container.querySelector(".kit-skeleton-body")).toHaveAttribute("aria-hidden", "true");
      expect(container.querySelectorAll(".kit-skel").length).toBeGreaterThan(3);
      expect(await violations(container)).toEqual([]);
      unmount();
    }
  });

  it("error: announced, says what happened, and tries again", async () => {
    const onRetry = vi.fn();
    const { container, rerender } = render(
      <ErrorState
        title="Load nahi ho paaya"
        body="Aapka kuch nahi gaya."
        retryLabel="Phir koshish"
        onRetry={onRetry}
        secondary={<a href="/status">Status page</a>}
        reference="ref 7KQ2-504 · 23 Oct, 7:41 pm"
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Load nahi ho paaya");
    expect(alert).toHaveTextContent("ref 7KQ2-504");
    await userEvent.click(screen.getByRole("button", { name: "Phir koshish" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(await violations(container)).toEqual([]);
    rerender(<ErrorState title="Load nahi ho paaya" retryLabel="Phir koshish" onRetry={onRetry} retrying />);
    expect(screen.getByRole("button", { name: "Phir koshish" })).toBeDisabled();
  });

  it("offline: a band that says so, politely", async () => {
    const { container } = render(<OfflineBanner title="Net nahi hai.">Padhte-likhte raho; net aate hi sync.</OfflineBanner>);
    expect(screen.getByRole("status")).toHaveTextContent("Net nahi hai. Padhte-likhte raho; net aate hi sync.");
    expect(await violations(container)).toEqual([]);
  });

  it("first visit: three steps, one action, skip and close", async () => {
    const skip = vi.fn();
    const close = vi.fn();
    const { container } = render(
      <FirstTime
        label="Pehli baar"
        title="Revision cards aapki galtiyon se"
        steps={["Galat jawab ek card banta hai", "1, 3, 7, 21 din baad wapas", "Roz 8 minute kaafi"]}
        action={<a href="/learn/revision">Samajh gaya</a>}
        skip={{ label: "Chhodo", onSelect: skip }}
        onClose={close}
        closeLabel="Band karo"
      />,
    );
    const card = screen.getByRole("region", { name: "Pehli baar" });
    expect(card).toHaveTextContent("Revision cards aapki galtiyon se");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: "Chhodo" }));
    await userEvent.click(screen.getByRole("button", { name: "Band karo" }));
    expect(skip).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(await violations(container)).toEqual([]);
  });

  it("first visit: the close button has an English name unless given one", () => {
    render(<FirstTime label="First visit" title="Welcome" steps={["One"]} onClose={() => undefined} floating />);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "First visit" })).toHaveClass("kit-float");
  });
});

describe("kit.css", () => {
  // A plain path: Vite rewrites `new URL(`…${x}`, import.meta.url)` into an asset lookup.
  const brandSrc = join(dirname(fileURLToPath(import.meta.url)), "../../../brand/src");
  const read = (file: string) => readFileSync(join(brandSrc, file), "utf8");
  const kit = read("kit.css");

  it("is the kit's stylesheet", () => {
    expect(kit).toContain(".kit-panes {");
    expect(read("learn.css")).toContain("--pen:");
  });
  const defined = new Set([...`${read("tokens.css")}${read("learn.css")}${kit}`.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

  it("uses only tokens that tokens.css, learn.css or itself define", () => {
    const used = new Set([...kit.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!));
    // --kit-m and --kit-c are set by kit.tsx on the element itself.
    const unknown = [...used].filter((name) => !defined.has(name) && name !== "--kit-m" && name !== "--kit-c");
    expect(unknown).toEqual([]);
  });

  it("turns animation and transition off for reduced motion", () => {
    const reduced = kit.slice(kit.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain("animation: none");
    expect(reduced).toContain("transition: none");
    const stripped = kit.replace(/\/\*[\s\S]*?\*\//g, "");
    // Innermost blocks: a selector and declarations, wherever they sit (inside @media too).
    const moving = [...stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, , body]) => /\b(animation|transition)\s*:\s*(?!none)/.test(body!))
      .flatMap(([, selector]) => selector!.split(",").map((s) => s.trim()))
      .filter((selector) => !/^(from|to|\d+%)$/.test(selector));
    expect(moving.length).toBeGreaterThan(8);
    for (const selector of moving) {
      // The element that moves (the last compound, without states) is named in the reduced-motion block.
      const element = selector.split(/\s+/).at(-1)!.replace(/:(is|not)\([^)]*\)|::?[\w-]+/g, "");
      expect(reduced, selector).toContain(element);
    }
  });
});
