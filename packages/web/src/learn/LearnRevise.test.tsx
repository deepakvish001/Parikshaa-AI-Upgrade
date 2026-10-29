import { onlineManager } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi, renderLearn, REVISION, SESSION, SITE, type FakeApi } from "./fake-api.tsx";
import { R } from "./LearnRevise.tsx";

/**
 * Learn's revision (tracker row 140, K2-3) against a fake of the practice
 * site's API: one card at a time, the learner's note drawn as elements (never
 * HTML), the days each grade brings, the grade sent and the next card; Space
 * and 1 to 4; the five states; axe finding nothing in each.
 */

async function violations(container: Element): Promise<string[]> {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false }, "target-size": { enabled: false } },
    resultTypes: ["violations"],
  });
  return result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

const hg = (tri: readonly [string, string, string]) => tri[1];
const at = (path: string) => window.history.replaceState(null, "", `/practice/${SITE}${path}`);
const bodiesOf = (path: string) =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([url, init]) => new URL(url as string, "http://x").pathname === `/api${path}` && init?.method === "POST")
    .map(([, init]) => JSON.parse(String(init?.body ?? "null")) as unknown);

let api: FakeApi;
beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.matchMedia = vi.fn((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-27T06:30:00Z"));
  localStorage.setItem(SESSION, "pl_good");
  api = fakeApi();
  let graded: string[] = [];
  api.routes["GET /practice/demo/revise"] = () => ({ body: { ...REVISION, due: REVISION.due.filter((c) => !graded.includes(c.slug)) } });
  api.routes["POST /practice/demo/revise/pair-sum"] = () => {
    graded = [...graded, "pair-sum"];
    return { body: { dueOn: "2026-10-30", intervalDays: 3 } };
  };
  api.routes["POST /practice/demo/revise/valid-brackets"] = () => {
    graded = [...graded, "valid-brackets"];
    return { body: { dueOn: "2026-10-28", intervalDays: 1 } };
  };
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
  document.documentElement.removeAttribute("data-theme");
});

describe("revision", () => {
  it("shows one card at a time: the problem, then the learner's note, then each grade's days; a grade is sent and the next card comes", async () => {
    at("/revision");
    const { container } = renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: "Bhoolne se pehle 2 cards." })).toBeInTheDocument();
    const progress = screen.getByRole("progressbar", { name: hg(R.progress) });
    expect(progress).toHaveAttribute("aria-valuenow", "0");
    expect(progress).toHaveAttribute("aria-valuetext", "2 me se 0 ho gaye");
    const card = screen.getByRole("article", { name: "Card 1 / 2" });
    expect(within(card).getByRole("heading", { level: 2, name: "Pair with target sum" })).toBeInTheDocument();
    expect(within(card).getByRole("list", { name: hg(R.topics) })).toHaveTextContent("two pointers");
    expect(within(card).getByText(hg(R.think))).toBeInTheDocument();
    expect(within(card).getByText(hg(R.first))).toBeInTheDocument();
    // The answer and the grades wait for the flip.
    expect(screen.queryByRole("group", { name: hg(R.howWent) })).not.toBeInTheDocument();
    expect(await violations(container)).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: /^Jawab dikhao/ }));
    const answer = within(card).getByLabelText(hg(R.answer));
    expect(answer).toHaveFocus();
    // The note is the learner's own Markdown, drawn as elements: the bold, the code, and a tag kept as text.
    expect(within(answer).getByText("two pointers").tagName).toBe("STRONG");
    expect(answer.querySelector("pre code")).toHaveTextContent("long long sum = (long long)a[L] + a[R];");
    expect(answer.querySelector("img")).toBeNull();
    expect(answer).toHaveTextContent("<img src=x onerror=alert(1)>");
    expect(within(answer).getByRole("link", { name: hg(R.openProblem) })).toHaveAttribute("href", `/practice/${SITE}/problems/pair-sum`);
    const grades = screen.getByRole("group", { name: hg(R.howWent) });
    expect(within(grades).getAllByRole("button").map((b) => b.textContent)).toEqual(["Phir se1 dinkal phir", "Mushkil1 dinkal phir", "Theek3 din3 din baad phir", "Aasaan7 din7 din baad phir"]);
    expect(await violations(container)).toEqual([]);

    await userEvent.click(within(grades).getByRole("button", { name: /^Theek/ }));
    await waitFor(() => expect(bodiesOf("/practice/demo/revise/pair-sum")).toEqual([{ grade: "good" }]));
    expect(await screen.findByRole("status")).toHaveTextContent("Pair with target sum: 3 din baad phir.");
    const second = await screen.findByRole("article", { name: "Card 2 / 2" });
    expect(within(second).getByText("2 baar revise kiya")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: hg(R.progress) })).toHaveAttribute("aria-valuenow", "1");
    // The next card's flip button has the focus: Space flips it, and 1 says "again".
    expect(screen.getByRole("button", { name: /^Jawab dikhao/ })).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(within(second).getByText(hg(R.noNote))).toBeInTheDocument();
    await userEvent.keyboard("1");
    await waitFor(() => expect(bodiesOf("/practice/demo/revise/valid-brackets")).toEqual([{ grade: "again" }]));

    // Both done: what comes next, and the way back to Aaj.
    expect(await screen.findByRole("heading", { level: 2, name: hg(R.doneTitle) })).toBeInTheDocument();
    expect(screen.getByText("Aage ke dino me 4 aur cards aayenge.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Valid brackets: kal phir.");
    expect(screen.getByRole("link", { name: hg(R.toToday) })).toHaveAttribute("href", `/practice/${SITE}/aaj`);
    expect(await violations(container)).toEqual([]);
  });

  it("is where Aaj's revision card leads", async () => {
    at("");
    renderLearn();
    const rail = await screen.findByRole("complementary", { name: "Page ke saath" });
    await userEvent.click(await within(rail).findByRole("link", { name: /Revise karo/ }));
    expect(window.location.pathname).toBe(`/practice/${SITE}/revision`);
    expect(await screen.findByRole("article", { name: "Card 1 / 2" })).toBeInTheDocument();
  });

  it("says when a grade did not go through, and keeps the card", async () => {
    api.routes["POST /practice/demo/revise/pair-sum"] = () => ({ status: 500, body: { error: "server_error" } });
    at("/revision");
    renderLearn();
    await userEvent.click(await screen.findByRole("button", { name: /^Jawab dikhao/ }));
    await userEvent.click(screen.getByRole("button", { name: /^Aasaan/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("server_error · 500");
    expect(screen.getByRole("article", { name: "Card 1 / 2" })).toBeInTheDocument();
    expect(bodiesOf("/practice/demo/revise/pair-sum")).toEqual([{ grade: "easy" }]);
  });

  it("has the five states: loading, error, offline, signed out, and nothing due", async () => {
    let answer: () => { status?: number; body: unknown } = () => ({ status: 500, body: { error: "server_error" } });
    api.routes["GET /practice/demo/revise"] = () => answer();
    at("/revision");
    const { container, unmount } = renderLearn();
    expect(await screen.findByRole("status")).toHaveTextContent("Load ho raha hai");
    const failed = await screen.findByRole("alert");
    expect(failed).toHaveTextContent("server_error · 500");
    expect(await violations(container)).toEqual([]);
    answer = () => ({ body: { due: [], later: 0, upcoming: 3 } });
    await userEvent.click(within(failed).getByRole("button", { name: "Phir koshish karo" }));
    expect(await screen.findByRole("heading", { level: 2, name: hg(R.noneTitle) })).toBeInTheDocument();
    expect(screen.getByText(/Aage ke dino me 3 aur cards aayenge/)).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
    unmount();

    act(() => onlineManager.setOnline(false));
    renderLearn();
    expect(await screen.findByText("Net aate hi ye dikhega.")).toBeInTheDocument();
    act(() => onlineManager.setOnline(true));

    localStorage.removeItem(SESSION);
    renderLearn();
    expect(await screen.findByRole("heading", { level: 2, name: hg(R.signInFirst) })).toBeInTheDocument();
    expect((await screen.findAllByRole("link", { name: "Sign in karo" })).at(-1)).toHaveAttribute("href", `/practice/${SITE}/signin?next=revision`);
  });

  it("keeps the cards on the page while offline, and grading waits for the network", async () => {
    at("/revision");
    renderLearn();
    await screen.findByRole("article", { name: "Card 1 / 2" });
    act(() => window.dispatchEvent(new Event("offline")));
    expect(await screen.findByText(/Aap offline ho/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Jawab dikhao/ }));
    expect(screen.getByRole("button", { name: /^Theek/ })).toBeDisabled();
    act(() => window.dispatchEvent(new Event("online")));
    expect(screen.getByRole("button", { name: /^Theek/ })).toBeEnabled();
  });

  it("speaks Hindi when the learner chooses it", async () => {
    localStorage.setItem("parikshaa.language", "hi");
    at("/revision");
    renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: "भूलने से पहले 2 कार्ड।" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^उत्तर दिखाएँ/ })).toBeInTheDocument();
  });
});
