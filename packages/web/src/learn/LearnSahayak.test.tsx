import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Problem } from "../practice/client.ts";
import { LearnProvider, type LearnState, type Notice, type SahayakAbout } from "./context.tsx";
import { LearnDataProvider } from "./data.tsx";
import { fakeApi, PLUS, renderLearn, SESSION, SITE, type FakeApi } from "./fake-api.tsx";
import { LS, SahayakPanel } from "./LearnSahayak.tsx";
import type { LearnLang } from "./text.ts";

/**
 * Sahayak's panel (tracker row 140, K2-6) against a fake of the practice
 * site's API: Aaj's "Fail kyun? Poochho" opening it on the last verdict and a
 * review of it; what Sahayak said, drawn as elements (never HTML); a doubt
 * (Ctrl+Enter, the answer's language); the next hint with the code as it
 * stands; follow-ups answered and a note draft added to the learner's note
 * once solved; a lesson's conversation; credits read again after each ask;
 * every state: loading, failed, offline, signed out, about nothing, short of
 * credits, refused (credits, too many, out of reach, the API's own words),
 * locked (a contest, Plus, off on the site); axe finding nothing.
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
const PAIR = { slug: "pair-sum", title: "Pair with target sum", difficulty: "medium", tags: [], question: { kind: "code" }, editorial: null, editorialLocked: true, acceptance: null, solvedBy: 3, status: "attempted", contest: null } as unknown as Problem;
const HISTORY = {
  entries: [
    { id: "h1", mode: "hint", hintLevel: 1, question: "", answer: "The array is **sorted**.\n\n<img src=x onerror=alert(1)>", credits: 0, createdAt: "2026-10-27T10:00:00Z", data: null },
    { id: "d1", mode: "doubt", hintLevel: null, question: "Why does test 3 overflow?", answer: "Two `int`s can pass 2^31.\n\n```cpp\nlong long s = (long long)a + b;\n```\n\n[read more](javascript:alert(1))", credits: 15, createdAt: "2026-10-27T10:05:00Z", data: null },
  ],
  nextHint: { level: 2, credits: 20, available: true },
  failures: 1,
  costs: { hint1: 10, hint: 20, review: 40, doubt: 15, notes: 15, followup: 15, followupReply: 10 },
};
const ANSWER = { id: "a1", mode: "doubt", hintLevel: null, answer: "Cast before you add.", credits: 15, createdAt: "2026-10-27T10:10:00Z", data: null };

let api: FakeApi;
let balance: number;
beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.matchMedia = vi.fn((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  localStorage.setItem(SESSION, "pl_good");
  window.history.replaceState(null, "", `/practice/${SITE}`);
  api = fakeApi();
  balance = 85;
  api.routes["GET /practice/demo/credits"] = () => ({ body: { balance, history: [] } });
  api.routes["GET /practice/demo/problems/pair-sum"] = () => ({ body: PAIR });
  api.routes["GET /practice/demo/problems/pair-sum/tutor"] = () => ({ body: HISTORY });
});
afterEach(() => {
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
  window.dispatchEvent(new Event("online"));
});

const PROBLEM: SahayakAbout = { kind: "problem", slug: "pair-sum", title: "Pair with target sum" };

/** The panel on its own, as the shell and the workspace hold it. */
function panel(about: SahayakAbout | null, { lang = "hg" as LearnLang, code }: { lang?: LearnLang; code?: () => { language: string; source: string } } = {}) {
  const notices: Notice[] = [];
  const learn: LearnState = {
    site: SITE,
    lang,
    setLang: () => undefined,
    t: (tri) => tri[lang === "en" ? 0 : lang === "hg" ? 1 : 2],
    theme: "dark",
    setTheme: () => undefined,
    href: (id) => `/practice/${SITE}/${id}`,
    go: () => undefined,
    openSahayak: () => undefined,
    setHere: () => undefined,
    notify: (n) => void (n === null ? null : notices.push(n)),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <LearnProvider value={learn}>
        <LearnDataProvider site={SITE}>
          <SahayakPanel about={about} {...(code === undefined ? {} : { code })} />
        </LearnDataProvider>
      </LearnProvider>
    </QueryClientProvider>,
  );
  return { ...view, notices };
}

const box = () => screen.getByRole("textbox", { name: hg(LS.ask) });
const posted = (path: string) => api.calls.filter((c) => c.method === "POST" && c.path === path);

describe("on a problem", () => {
  it("opens from Aaj's Fail kyun on the last verdict, and reviews it: credits read again, nothing as HTML", async () => {
    let answer: (value: { body: unknown }) => void = () => undefined;
    api.routes["POST /practice/demo/problems/pair-sum/tutor/review"] = () => new Promise((resolve) => (answer = resolve));
    const { container } = renderLearn();
    await userEvent.click(await screen.findByRole("button", { name: "Fail kyun? Poochho" }));
    const pane = screen.getByRole("complementary", { name: "Sahayak" });
    expect(await within(pane).findByRole("heading", { name: hg(LS.whyTitle) })).toBeInTheDocument();
    expect(await within(pane).findByText("Aapka aakhri submit: Galat jawab · 30 me se 22 test")).toBeInTheDocument();
    expect(within(pane).getByText("Problem · Pair with target sum")).toBeInTheDocument();
    expect(within(pane).getByText("85 credits baaki")).toBeInTheDocument();
    // What Sahayak said: elements, never HTML; code as text; no link but http(s).
    const talk = within(pane).getByRole("log", { name: hg(LS.talk) });
    expect(within(talk).getByText("sorted").tagName).toBe("STRONG");
    expect(within(talk).getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(within(talk).getByText("long long s = (long long)a + b;")).toBeInTheDocument();
    expect(within(talk).queryByRole("link", { name: "read more" })).toBeNull();
    expect(within(talk).getByText("Why does test 3 overflow?")).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);

    balance = 45;
    await userEvent.click(within(pane).getAllByRole("button", { name: "Aakhri submission ka review · 40 credits" })[0]!);
    expect(await within(pane).findByRole("status")).toHaveTextContent(hg(LS.thinking));
    expect(posted("/practice/demo/problems/pair-sum/tutor/review")[0]?.body).toEqual({ replyIn: "en" });
    api.routes["GET /practice/demo/problems/pair-sum/tutor"] = () => ({ body: { ...HISTORY, entries: [...HISTORY.entries, { ...ANSWER, id: "r1", mode: "review", question: "", answer: "**Logic.** Prints -1 first.", credits: 40 }] } });
    await act(async () => answer({ body: { ...ANSWER, mode: "review" } }));
    expect(await within(pane).findByRole("article", { name: hg(LS.review) })).toHaveTextContent("Prints -1 first.");
    expect(within(pane).queryByRole("status")).toBeNull();
    expect(await within(pane).findByText("45 credits baaki")).toBeInTheDocument();
  });

  it("asks a doubt with Ctrl+Enter, says the answer comes in English, and in Hindi asks for Hindi", async () => {
    api.routes["POST /practice/demo/tutor/doubt"] = () => ({ body: ANSWER });
    const { unmount } = panel(PROBLEM);
    expect(await screen.findByText(/Jawab English me aata hai/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Poochho · 15 credits" })).toBeDisabled();
    await userEvent.type(box(), "Why sort first?");
    fireEvent.keyDown(box(), { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(posted("/practice/demo/tutor/doubt")[0]?.body).toEqual({ problem: "pair-sum", question: "Why sort first?", replyIn: "en" }));
    await waitFor(() => expect(box()).toHaveValue(""));
    unmount();

    panel(PROBLEM, { lang: "hi" });
    await userEvent.type(await screen.findByRole("textbox", { name: LS.ask[2] }), "पहले sort क्यों?");
    await userEvent.click(screen.getByRole("button", { name: "पूछें · 15 क्रेडिट" }));
    await waitFor(() => expect(posted("/practice/demo/tutor/doubt")[1]?.body).toMatchObject({ replyIn: "hi" }));
  });

  it("opens the next hint on the code as it stands, and shows what is shut until 3 wrong submissions", async () => {
    api.routes["POST /practice/demo/problems/pair-sum/tutor/hint"] = () => ({ body: { ...ANSWER, mode: "hint", hintLevel: 2 } });
    panel(PROBLEM, { code: () => ({ language: "cpp", source: "int main() {}" }) });
    await userEvent.click(await screen.findByRole("button", { name: "Hint 2 · 20 credits" }));
    await waitFor(() => expect(posted("/practice/demo/problems/pair-sum/tutor/hint")[0]?.body).toEqual({ replyIn: "en", code: "int main() {}", language: "cpp" }));
    // Not solved: no follow-ups or note draft yet; a review once there is a submission.
    expect(screen.queryByRole("button", { name: /Interview ke agle sawaal/ })).toBeNull();
    expect(screen.getByText(hg(LS.needSolve))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aakhri submission ka review · 40 credits" })).toBeEnabled();
  });

  it("once solved: two follow-ups answered here, and a note draft added to the learner's note", async () => {
    api.routes["GET /practice/demo/problems/pair-sum"] = () => ({ body: { ...PAIR, status: "solved" } });
    api.routes["GET /practice/demo/problems/pair-sum/tutor"] = () => ({
      body: {
        ...HISTORY,
        nextHint: null,
        entries: [
          { ...ANSWER, id: "f1", mode: "followup", question: "", answer: "", credits: 15, data: { questions: ["What if the array is not sorted?", "Every pair?"] } },
          { ...ANSWER, id: "n1", mode: "notes", question: "", answer: "## Key idea\nTwo pointers.", credits: 15 },
        ],
      },
    });
    api.routes["POST /practice/demo/problems/pair-sum/tutor/followups/f1/reply"] = () => ({ body: { ...ANSWER, mode: "followup_reply" } });
    api.routes["POST /practice/demo/problems/pair-sum/tutor/followups"] = () => ({ body: { ...ANSWER, mode: "followup" } });
    api.routes["GET /practice/demo/notes/problem/pair-sum"] = () => ({ body: { kind: "problem", ref: "pair-sum", title: "Pair with target sum", body: "Sort first.", updatedAt: null } });
    api.routes["PUT /practice/demo/notes/problem/pair-sum"] = () => ({ body: { kind: "problem", ref: "pair-sum", title: "Pair with target sum", body: "", updatedAt: null } });
    const { container, notices } = panel(PROBLEM);
    expect(await screen.findByText(hg(LS.hintsDone))).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Interview ke agle sawaal · 15 credits" }));
    await waitFor(() => expect(posted("/practice/demo/problems/pair-sum/tutor/followups")).toHaveLength(1));
    const second = screen.getByRole("textbox", { name: "Sawaal 2 ka aapka jawab" });
    await userEvent.type(second, "A set, one pass.");
    await userEvent.click(screen.getAllByRole("button", { name: "Bhejo · 10 credits" })[1]!);
    await waitFor(() => expect(posted("/practice/demo/problems/pair-sum/tutor/followups/f1/reply")[0]?.body).toEqual({ question: 1, answer: "A set, one pass.", replyIn: "en" }));

    await userEvent.click(screen.getByRole("button", { name: hg(LS.toNote) }));
    await waitFor(() => expect(api.calls.find((c) => c.method === "PUT")?.body).toEqual({ body: "Sort first.\n\n## Key idea\nTwo pointers." }));
    await waitFor(() => expect(notices).toContainEqual({ tone: "ok", text: hg(LS.toNoteDone) }));
    expect(await violations(container)).toEqual([]);
  });

  it("on a choice question's verdict: no review (there is no code to read), a doubt instead", async () => {
    api.routes["GET /practice/demo/problems/pair-sum"] = () => ({ body: { ...PAIR, question: { kind: "mcq" } } });
    api.routes["GET /practice/demo/problems/pair-sum/submissions"] = () => ({ body: { submissions: [{ id: "s1", language: null, answer: "2", status: "wrong_answer", passed: 0, total: 1, timeMs: null, memoryKb: null, createdAt: "2026-10-27T10:00:00Z", inContest: false }] } });
    panel({ ...PROBLEM, why: true } as SahayakAbout);
    expect(await screen.findByText(hg(LS.whyNoCode))).toBeInTheDocument();
    expect(screen.getByText("Aapka aakhri submit: Galat jawab · 1 me se 0 test")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /review/ })).toBeNull();
    expect(screen.queryByText(hg(LS.needSubmit))).toBeNull();
  });

  it("deletes the conversation only when asked twice", async () => {
    api.routes["DELETE /practice/demo/tutor"] = () => ({ body: { deleted: 2 } });
    panel(PROBLEM);
    await userEvent.click(await screen.findByRole("button", { name: hg(LS.forget) }));
    await userEvent.click(screen.getByRole("button", { name: hg(LS.keep) }));
    expect(api.calls.some((c) => c.method === "DELETE")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: hg(LS.forget) }));
    await userEvent.click(screen.getByRole("button", { name: hg(LS.forgetSure) }));
    await waitFor(() => expect(api.calls.find((c) => c.method === "DELETE")?.path).toBe("/practice/demo/tutor"));
    expect(screen.getByText(hg(LS.kept))).toBeInTheDocument();
  });
});

describe("credits and refusals", () => {
  it("short of credits: asking is shut, and it says how many are left and when more come", async () => {
    balance = 5;
    const { container } = panel(PROBLEM);
    expect(await screen.findByText("5 credits baaki: poochhne ke liye kam. Har mahine 100 free credits milte hain.")).toBeInTheDocument();
    await userEvent.type(box(), "Why sort first?");
    expect(screen.getByRole("button", { name: "Poochho · 15 credits" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Hint 2 · 20 credits" })).toBeDisabled();
    expect(screen.getAllByRole("link", { name: hg(LS.getCredits) })[0]).toHaveAttribute("href", "/practice/demo/plus?learn_v2=0");
    expect(await violations(container)).toEqual([]);
  });

  it.each([
    [402, "no_credits", hg(LS.noCredits)],
    [429, "too_many_runs", hg(LS.tooMany)],
    [503, "unavailable", hg(LS.unavailable)],
    [422, "invalid", "Sahayak ye nahi le saka: Ask in 3 to 2,000 characters"],
  ])("a refusal (%i %s) is said in the learner's words", async (status, error, words) => {
    api.routes["POST /practice/demo/tutor/doubt"] = () => ({ status, body: { error, message: "Ask in 3 to 2,000 characters" } });
    panel(PROBLEM);
    await userEvent.type(await screen.findByRole("textbox", { name: hg(LS.ask) }), "Why sort first?");
    await userEvent.click(screen.getByRole("button", { name: "Poochho · 15 credits" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(words);
    // The question stays, to ask again; credits are read again (a failure gives them back).
    expect(box()).toHaveValue("Why sort first?");
    if (status === 503) {
      api.routes["POST /practice/demo/tutor/doubt"] = () => ({ body: ANSWER });
      await userEvent.click(screen.getByRole("button", { name: hg(LS.retry) }));
      await waitFor(() => expect(posted("/practice/demo/tutor/doubt")).toHaveLength(2));
    }
  });

  it("a failure it cannot name: what happened, nothing lost, try again", async () => {
    api.routes["POST /practice/demo/tutor/doubt"] = () => ({ status: 500, body: { error: "internal" } });
    panel(PROBLEM);
    await userEvent.type(await screen.findByRole("textbox", { name: hg(LS.ask) }), "Why sort first?");
    await userEvent.click(screen.getByRole("button", { name: "Poochho · 15 credits" }));
    expect(await screen.findByRole("button", { name: "Phir koshish karo" })).toBeInTheDocument();
    expect(screen.getByText("Ye load nahi hua")).toBeInTheDocument();
  });
});

describe("states", () => {
  it("loading, then a history that fails to load, with a retry", async () => {
    api.routes["GET /practice/demo/problems/pair-sum/tutor"] = () => ({ status: 500, body: { error: "internal" } });
    panel(PROBLEM);
    expect(screen.getByText(/Load ho raha hai/)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Phir koshish karo" })).toBeInTheDocument();
  });

  it("offline: says so, and asking waits for the network", async () => {
    panel(PROBLEM);
    await screen.findByRole("log", { name: hg(LS.talk) });
    act(() => {
      onlineManager.setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    await userEvent.type(box(), "Why sort first?");
    expect(screen.getByRole("button", { name: "Poochho · 15 credits" })).toBeDisabled();
    expect(screen.getByText("Aap offline ho.")).toBeInTheDocument();
  });

  it("signed out: asks to sign in, and reads nothing", async () => {
    localStorage.removeItem(SESSION);
    const { container } = panel(PROBLEM);
    expect(await screen.findByRole("heading", { name: hg(LS.signIn) })).toBeInTheDocument();
    expect(api.calls.filter((c) => c.path.includes("tutor") || c.path.endsWith("/credits"))).toEqual([]);
    expect(await violations(container)).toEqual([]);
  });

  it("about nothing in particular: what it answers on, and the credits", async () => {
    const { container } = panel(null);
    expect(await screen.findByRole("heading", { name: hg(LS.generalTitle) })).toBeInTheDocument();
    expect(await screen.findByText("85 credits baaki")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hg(LS.toPractice) })).toHaveAttribute("href", "/practice/demo/practice");
    expect(await violations(container)).toEqual([]);
  });

  it("locked: a contest running on the problem, and Sahayak off on the site", async () => {
    api.routes["GET /practice/demo/problems/pair-sum"] = () => ({ body: { ...PAIR, contest: { slug: "weekly-13", title: "Weekly Round 13", endsAt: "2026-11-01T16:00:00Z" } } });
    const { unmount, container } = panel(PROBLEM);
    expect(await screen.findByRole("heading", { name: hg(LS.contestTitle) })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(await violations(container)).toEqual([]);
    unmount();
    api.routes["GET /practice/demo/plus"] = () => ({ body: { ...PLUS, tutor: false } });
    panel(PROBLEM);
    expect(await screen.findByRole("heading", { name: hg(LS.offTitle) })).toBeInTheDocument();
  });
});

describe("on a lesson", () => {
  const LESSON: SahayakAbout = { kind: "lesson", slug: "stack-lifo", title: "Stack: the LIFO idea" };

  it("keeps the lesson's conversation, asks about the lesson, and drafts a note on it", async () => {
    api.routes["GET /practice/demo/lessons/stack-lifo/tutor"] = () => ({ body: { entries: [{ ...ANSWER, question: "What is LIFO?", answer: "Last in, first out." }], costs: HISTORY.costs } });
    api.routes["POST /practice/demo/tutor/doubt"] = () => ({ body: ANSWER });
    api.routes["POST /practice/demo/tutor/notes"] = () => ({ body: { ...ANSWER, mode: "notes" } });
    const { container } = panel(LESSON);
    expect(await screen.findByText("Last in, first out.")).toBeInTheDocument();
    expect(screen.getByText("Lesson · Stack: the LIFO idea")).toBeInTheDocument();
    expect(screen.getByText(hg(LS.lessonWrong))).toBeInTheDocument();
    // No hint, review or follow-ups on a lesson; no problem read for it.
    expect(screen.queryByRole("button", { name: /^Hint/ })).toBeNull();
    expect(api.calls.some((c) => c.path.startsWith("/practice/demo/problems/"))).toBe(false);
    await userEvent.type(box(), "Why a stack?");
    await userEvent.click(screen.getByRole("button", { name: "Poochho · 15 credits" }));
    await waitFor(() => expect(posted("/practice/demo/tutor/doubt")[0]?.body).toEqual({ lesson: "stack-lifo", question: "Why a stack?", replyIn: "en" }));
    await userEvent.click(screen.getByRole("button", { name: "Mera note draft karo · 15 credits" }));
    await waitFor(() => expect(posted("/practice/demo/tutor/notes")[0]?.body).toEqual({ lesson: "stack-lifo", replyIn: "en" }));
    expect(await violations(container)).toEqual([]);
  });

  it("a lesson behind Plus is not read to Sahayak", async () => {
    api.routes["GET /practice/demo/lessons/stack-lifo/tutor"] = () => ({ status: 402, body: { error: "plus_required" } });
    panel(LESSON);
    expect(await screen.findByRole("heading", { name: hg(LS.plusTitle) })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hg(LS.plusSee) })).toHaveAttribute("href", "/practice/demo/plus?learn_v2=0");
  });
});
