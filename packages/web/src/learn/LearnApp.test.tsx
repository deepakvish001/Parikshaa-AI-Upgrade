import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi, renderLearn, SESSION } from "./fake-api.tsx";
import { findScreens, routeOf } from "./LearnApp.tsx";
import { LEARN_GROUPS, LEARN_SCREENS } from "./screens.ts";
import { D, T, learnLangOf, pick } from "./text.ts";

/**
 * Learn v2's shell (K1-3) does what DESIGN-SYSTEM §7 and §9 ask, in the three
 * languages, and axe finds nothing in it.
 *
 * axe runs the WCAG 2.0–2.2 A and AA rules. Two need a laid-out page, which
 * jsdom does not have, so they are off here and left to the browser check
 * (e2e learn-shell.spec.ts, @axe-core/playwright): colour-contrast and
 * target-size (learn.css gives every control 40 px on a phone).
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
const wide = () => false;
const narrow = (query: string) => query === "(max-width: 1180px)";
const phone = (query: string) => query === "(max-width: 860px)" || query === "(max-width: 1180px)";

const SITE = "demo";
const at = (path: string) => window.history.replaceState(null, "", path);
const hg = (tri: readonly [string, string, string]) => tri[1];

beforeEach(() => {
  localStorage.clear();
  at(`/practice/${SITE}`);
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  mockMedia(wide);
  // A signed-in learner's day (fake-api.tsx), in their evening: only Aaj's greeting reads the clock.
  localStorage.setItem(SESSION, "pl_good");
  fakeApi();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 27, 19, 0));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  // @ts-expect-error jsdom has none; each test sets its own.
  delete window.matchMedia;
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.lang = "";
});

const sideNav = () => screen.getByRole("navigation", { name: hg(T.nav) });
const menuItems = () => [...screen.getByRole("menu").querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]')];

describe("addresses", () => {
  it("map to a screen, the site's root to Aaj, anything else to nothing", () => {
    expect(routeOf(SITE, "/practice/demo")).toBe("aaj");
    expect(routeOf(SITE, "/practice/demo/")).toBe("aaj");
    expect(routeOf(SITE, "/practice/demo/sql")).toBe("sql");
    expect(routeOf(SITE, "/practice/demo/sql/")).toBe("sql");
    // A problem opens its workspace (K2-5); a contest's own page is not in Learn yet.
    expect(routeOf(SITE, "/practice/demo/problems/two-sum")).toBe("problems/two-sum");
    expect(routeOf(SITE, "/practice/demo/contests/weekly-12")).toBeNull();
    expect(routeOf(SITE, "/practice/demo-2/sql")).toBeNull();
  });
});

describe("the words", () => {
  it("has every shell text and every screen in English, Hinglish and Hindi", () => {
    for (const tri of [...Object.values(T), ...LEARN_GROUPS.map((g) => g.name), ...LEARN_SCREENS.flatMap((s) => [s.title, s.desc])]) {
      expect(tri).toHaveLength(3);
      for (const text of tri) expect(text.trim()).not.toBe("");
    }
    // Hindi is written in Devanagari wherever it is not a name (SQL, Pramaan's own word is Hindi already).
    expect(T.search[2]).toMatch(/[ऀ-ॿ]/);
  });

  it("follows the app's language, with Hinglish as Learn's own choice", () => {
    expect(learnLangOf("hi", null)).toBe("hi");
    expect(learnLangOf("en", null)).toBe("hg");
    expect(learnLangOf("en", "1")).toBe("hg");
    expect(learnLangOf("en", "0")).toBe("en");
    expect(learnLangOf("ta", null)).toBe("en");
    expect(pick("hi", T.more)).toBe("और");
  });
});

describe("Learn v2's shell", () => {
  it("has its landmarks, a skip link, and Aaj on the learner's day at the site's root", async () => {
    renderLearn();
    expect(sideNav()).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    const main = screen.getByRole("main");
    expect(screen.getByRole("complementary", { name: hg(T.rail) })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: hg(T.breadcrumb) })).toHaveTextContent("Aaj");

    const skip = screen.getByRole("link", { name: hg(T.skip) });
    expect(skip).toHaveAttribute("href", "#ln-main");
    await userEvent.click(skip);
    expect(main).toHaveFocus();

    await screen.findByRole("region", { name: "Pair with target sum" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Shubh sandhya, Aarav.");
    expect(screen.getByRole("progressbar", { name: "Aaj ke kaam" })).toHaveAttribute("aria-valuetext", "5 me se 1 ho gaye");
    expect(await screen.findByRole("progressbar", { name: "Infosys ki taiyari" })).toHaveAttribute("aria-valuenow", "62");
    expect(document.title).toBe("Aaj · Parikshaa Learn");
  });

  it("lists every screen in its group, each a link to its own address, Aaj current", () => {
    renderLearn();
    const nav = sideNav();
    for (const group of LEARN_GROUPS) {
      const list = within(nav).getByRole("list", { name: hg(group.name) });
      const names = within(list)
        .getAllByRole("link")
        .map((link) => link.textContent);
      expect(names).toEqual(LEARN_SCREENS.filter((s) => s.group === group.id).map((s) => hg(s.title)));
    }
    for (const s of LEARN_SCREENS) {
      expect(within(nav).getByRole("link", { name: hg(s.title) })).toHaveAttribute("href", `/practice/${SITE}/${s.id}`);
    }
    expect(within(nav).getByRole("link", { name: "Aaj" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getAllByRole("link", { current: "page" })).toHaveLength(1);
  });

  it("goes to a screen in the page: its placeholder, its address, the focus on the new content; back works", async () => {
    renderLearn();
    await userEvent.click(within(sideNav()).getByRole("link", { name: "Courses" }));
    expect(window.location.pathname).toBe(`/practice/${SITE}/courses`);
    expect(screen.getByRole("heading", { level: 1, name: "Courses" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Goal aur subject se courses" })).toBeInTheDocument();
    expect(screen.getByText("Kadam 2 me asli data se judega.")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveFocus();
    expect(within(sideNav()).getByRole("link", { name: "Courses" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("complementary", { name: hg(T.rail) })).not.toBeInTheDocument();
    expect(document.title).toBe("Courses · Parikshaa Learn");

    window.history.pushState(null, "", `/practice/${SITE}/sql`);
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(screen.getByRole("heading", { level: 1, name: "SQL" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: hg(T.toToday) }));
    expect(await screen.findByRole("heading", { level: 1, name: /Shubh sandhya/ })).toBeInTheDocument();
  });

  it("says when an address is not in Learn yet, and links to it on the current site", () => {
    at(`/practice/${SITE}/contests/weekly-12`);
    renderLearn();
    expect(screen.getByRole("heading", { level: 1, name: hg(T.notHereTitle) })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hg(T.openOld) })).toHaveAttribute("href", `/practice/${SITE}/contests/weekly-12?learn_v2=0`);
  });

  it("narrows the side bar at 1180 px and below; every link keeps its name, shown as a tooltip", () => {
    const media = mockMedia(wide);
    renderLearn();
    expect(sideNav()).not.toHaveClass("ln-mini");
    media.set(narrow);
    const nav = sideNav();
    expect(nav).toHaveClass("ln-mini");
    for (const s of LEARN_SCREENS) {
      const link = within(nav).getByRole("link", { name: hg(s.title) });
      expect(link).toHaveAttribute("title", hg(s.title));
    }
    for (const group of LEARN_GROUPS) expect(within(nav).getByRole("list", { name: hg(group.name) })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: hg(T.search) })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: hg(T.askSahayak) })).toBeInTheDocument();
    // The width decides here, so there is no button to widen it.
    expect(within(nav).queryByRole("button", { name: hg(T.expand) })).not.toBeInTheDocument();
    media.set(wide);
    expect(sideNav()).not.toHaveClass("ln-mini");
  });

  it("narrows and widens the side bar by its button and by Ctrl+\\ on a wide screen", async () => {
    renderLearn();
    await userEvent.click(screen.getByRole("button", { name: hg(T.collapse) }));
    expect(sideNav()).toHaveClass("ln-mini");
    await userEvent.click(screen.getByRole("button", { name: hg(T.expand) }));
    expect(sideNav()).not.toHaveClass("ln-mini");
    fireEvent.keyDown(window, { key: "\\", ctrlKey: true });
    expect(sideNav()).toHaveClass("ln-mini");
    fireEvent.keyDown(window, { key: "\\", ctrlKey: true });
    expect(sideNav()).not.toHaveClass("ln-mini");
  });

  it("on a phone, has five tabs at the bottom instead of the side bar, and Aur lists every screen", async () => {
    mockMedia(phone);
    renderLearn();
    expect(screen.queryByRole("navigation", { name: hg(T.nav) })).not.toBeInTheDocument();
    const tabs = screen.getByRole("navigation", { name: hg(T.phoneNav) });
    const controls = within(tabs).getAllByRole("link").concat(within(tabs).getAllByRole("button"));
    expect(controls.map((c) => c.textContent)).toEqual(["Aaj", "Seekho", "Abhyas", "Sahayak", "Aur"]);
    expect(within(tabs).getByRole("link", { name: "Aaj" })).toHaveAttribute("aria-current", "page");

    await userEvent.click(within(tabs).getByRole("button", { name: "Aur" }));
    const sheet = screen.getByRole("dialog", { name: "Aur" });
    for (const s of LEARN_SCREENS) expect(within(sheet).getByRole("link", { name: hg(s.title) })).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("link", { name: "Revision" }));
    expect(screen.queryByRole("dialog", { name: "Aur" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 1, name: "Bhoolne se pehle 2 cards." })).toBeInTheDocument();
    expect(within(tabs).getByRole("link", { name: "Aaj" })).not.toHaveAttribute("aria-current");

    // Seekho stands for its whole group.
    await userEvent.click(within(tabs).getByRole("link", { name: "Seekho" }));
    expect(screen.getByRole("heading", { level: 1, name: "Courses" })).toBeInTheDocument();
    expect(within(tabs).getByRole("link", { name: "Seekho" })).toHaveClass("ln-on");

    await userEvent.click(within(tabs).getByRole("button", { name: "Sahayak" }));
    const pane = screen.getByRole("dialog", { name: "Sahayak" });
    expect(within(pane).getByRole("button", { name: hg(T.close) })).toHaveFocus();
    await userEvent.click(within(pane).getByRole("button", { name: hg(T.close) }));
    expect(screen.queryByRole("dialog", { name: "Sahayak" })).not.toBeInTheDocument();

    // The top bar's menu button opens the same sheet.
    await userEvent.click(screen.getByRole("button", { name: hg(T.menu) }));
    expect(screen.getByRole("dialog", { name: "Aur" })).toBeInTheDocument();
  });

  it("searches with Ctrl+K: the list filters as you type, arrows choose, Enter goes, Escape closes", async () => {
    renderLearn();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const dialog = screen.getByRole("dialog", { name: hg(T.searchDialog) });
    const box = within(dialog).getByRole("combobox", { name: hg(T.searchField) });
    expect(box).toHaveFocus();
    expect(within(dialog).getAllByRole("option")).toHaveLength(LEARN_SCREENS.length);

    await userEvent.type(box, "sql");
    expect(within(dialog).getAllByRole("option").map((o) => o.querySelector("b")?.textContent)).toEqual(["SQL"]);
    await userEvent.clear(box);
    await userEvent.type(box, "zzz");
    expect(within(dialog).queryByRole("listbox")).not.toBeInTheDocument();
    expect(within(dialog).getAllByText("Kuch nahi mila").length).toBeGreaterThan(0);

    // Any of the three languages finds a screen.
    await userEvent.clear(box);
    await userEvent.type(box, "दोहराई");
    expect(within(dialog).getAllByRole("option")).toHaveLength(1);

    await userEvent.clear(box);
    expect(within(dialog).getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    const third = within(dialog).getAllByRole("option")[2]!;
    expect(third).toHaveAttribute("aria-selected", "true");
    expect(box).toHaveAttribute("aria-activedescendant", third.id);
    await userEvent.keyboard("{ArrowUp}");
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe(`/practice/${SITE}/revision`);
    // Revision is a screen of its own now (K2-3), in a chunk of its own.
    expect(await screen.findByRole("heading", { level: 1, name: "Bhoolne se pehle 2 cards." })).toBeInTheDocument();

    // The side bar's button opens it too; Escape closes it and gives the focus back.
    const opener = within(sideNav()).getByRole("button", { name: hg(T.search) });
    await userEvent.click(opener);
    expect(screen.getByRole("dialog", { name: hg(T.searchDialog) })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    // Ctrl+K again closes it as well as opening it.
    fireEvent.keyDown(window, { key: "K", metaKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("finds screens by any language's name, the shown description, or the address", () => {
    const t = (tri: readonly [string, string, string]) => tri[1];
    expect(findScreens("", t)).toHaveLength(LEARN_SCREENS.length);
    expect(findScreens("ai-drill", t).map((s) => s.id)).toEqual(["ai-drill"]);
    expect(findScreens("  CONTESTS ", t).map((s) => s.id)).toEqual(["contests"]);
    expect(findScreens("प्रमाण", t).map((s) => s.id)).toEqual(["pramaan"]);
  });

  it("changes the language from the ⋯ menu, through the app's own setting, and every label follows", async () => {
    renderLearn();
    await screen.findByRole("region", { name: "Pair with target sum" });
    const more = () => screen.getByRole("button", { name: /^(Aur vikalp|More options|और विकल्प)$/ });
    await userEvent.click(more());
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitemradio", { name: "Hinglish" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(within(menu).getByRole("menuitemradio", { name: "English" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(more()).toHaveFocus();
    expect(within(screen.getByRole("navigation", { name: T.nav[0] })).getByRole("link", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Good evening, Aarav.");
    expect(localStorage.getItem("parikshaa.language")).toBe("en");
    expect(localStorage.getItem("parikshaa.learn.hinglish")).toBe("0");

    await userEvent.click(more());
    await userEvent.click(screen.getByRole("menuitemradio", { name: "हिंदी" }));
    const nav = screen.getByRole("navigation", { name: T.nav[2] });
    expect(within(nav).getByRole("link", { name: "आज" })).toBeInTheDocument();
    expect(within(nav).getByRole("list", { name: "सीखो" })).toBeInTheDocument();
    expect(localStorage.getItem("parikshaa.language")).toBe("hi");
    await waitFor(() => expect(document.documentElement.lang).toBe("hi"));

    await userEvent.click(more());
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Hinglish" }));
    expect(within(sideNav()).getByRole("link", { name: "Aaj" })).toBeInTheDocument();
    expect(localStorage.getItem("parikshaa.language")).toBe("en");
    expect(localStorage.getItem("parikshaa.learn.hinglish")).toBe("1");
  });

  it("moves through the ⋯ menu by keyboard, and Escape gives the focus back", async () => {
    renderLearn();
    const button = screen.getByRole("button", { name: "Aur vikalp" });
    button.focus();
    await userEvent.keyboard("{ArrowDown}");
    const items = menuItems();
    expect(items.map((i) => i.textContent)).toEqual(["English", "Hinglish", "हिंदी", hg(T.toLight), hg(T.oldSite), hg(D.signOut)]);
    expect(items[0]).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(items.at(-1)).toHaveFocus();
    expect(items.at(-2)).toHaveAttribute("href", `/practice/${SITE}?learn_v2=0`);
    await userEvent.keyboard("{Home}");
    expect(items[0]).toHaveFocus();
    await userEvent.keyboard("{End}{ArrowDown}");
    expect(items[0]).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(menuItems().at(-1)).toHaveFocus();
  });

  it("is dark unless the learner chooses paper, on <html data-theme>, kept on the device", async () => {
    const { unmount } = renderLearn();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    await userEvent.click(screen.getByRole("button", { name: "Aur vikalp" }));
    await userEvent.click(screen.getByRole("menuitem", { name: hg(T.toLight) }));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(localStorage.getItem("parikshaa.learn.theme")).toBe("light");
    await userEvent.click(screen.getByRole("button", { name: "Aur vikalp" }));
    expect(screen.getByRole("menuitem", { name: hg(T.toDark) })).toBeInTheDocument();
    unmount();
    expect(document.documentElement).not.toHaveAttribute("data-theme");

    renderLearn();
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("opens Sahayak beside the page, by its buttons and by Ctrl+J", async () => {
    renderLearn();
    const top = screen.getByRole("banner");
    const button = within(top).getByRole("button", { name: "Sahayak" });
    await userEvent.click(button);
    const pane = screen.getByRole("complementary", { name: "Sahayak" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(within(sideNav()).getByRole("button", { name: hg(T.askSahayak) })).toHaveAttribute("aria-pressed", "true");
    expect(within(pane).getByText("Sahayak, aapka AI tutor, yahan khulega.")).toBeInTheDocument();
    expect(within(pane).getByRole("button", { name: hg(T.close) })).toHaveFocus();
    await userEvent.click(within(pane).getByRole("button", { name: hg(T.close) }));
    expect(screen.queryByRole("complementary", { name: "Sahayak" })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "j", ctrlKey: true });
    expect(screen.getByRole("complementary", { name: "Sahayak" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "j", ctrlKey: true });
    expect(screen.queryByRole("complementary", { name: "Sahayak" })).not.toBeInTheDocument();

    // Aaj's "why it fails" asks Sahayak too.
    await userEvent.click(screen.getByRole("button", { name: "Fail kyun? Poochho" }));
    expect(screen.getByRole("complementary", { name: "Sahayak" })).toBeInTheDocument();
  });
});

describe("axe", () => {
  it("finds nothing on Aaj, a placeholder and the page that is not there, wide and narrow", async () => {
    const media = mockMedia(wide);
    const { container } = renderLearn();
    await screen.findByRole("region", { name: "Pair with target sum" });
    expect(await violations(container)).toEqual([]);
    media.set(narrow);
    expect(await violations(container)).toEqual([]);
    await userEvent.click(within(sideNav()).getByRole("link", { name: "Profile" }));
    expect(await violations(container)).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Sahayak" }));
    expect(await violations(container)).toEqual([]);
  });

  it("finds nothing with search, the ⋯ menu, in Hindi and on paper", async () => {
    const { container } = renderLearn();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(await violations(container)).toEqual([]);
    await userEvent.type(screen.getByRole("combobox"), "zzz");
    expect(await violations(container)).toEqual([]);
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Aur vikalp" }));
    expect(await violations(container)).toEqual([]);
    await userEvent.click(screen.getByRole("menuitemradio", { name: "हिंदी" }));
    await userEvent.click(screen.getByRole("button", { name: "और विकल्प" }));
    await userEvent.click(screen.getByRole("menuitem", { name: T.toLight[2] }));
    expect(await violations(container)).toEqual([]);
  });

  it("finds nothing on a phone: tabs, the Aur sheet and Sahayak's sheet", async () => {
    mockMedia(phone);
    const { container } = renderLearn();
    expect(await violations(container)).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Aur" }));
    expect(await violations(container)).toEqual([]);
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Sahayak" }));
    expect(await violations(container)).toEqual([]);
  });
});
