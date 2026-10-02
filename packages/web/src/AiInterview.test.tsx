import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiInterviewPage, type AiRoom } from "./components/AiInterview.tsx";
import { PreferencesProvider } from "./i18n.tsx";

/** The candidate's side of an AI interview: start, answer by chat (with code), and the end. */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const base: AiRoom = { title: "Backend screen", candidateName: "Ananya", minutes: 30, questions: 2, asked: 0, status: "invited", startedAt: null, endsAt: null, turns: [] };
const q = (body: string, kind: "question" | "follow_up" = "question") => ({ speaker: "interviewer" as const, kind, body, code: null, language: null, at: "2026-10-05T05:00:00Z" });

afterEach(() => vi.unstubAllGlobals());

const show = () =>
  render(
    <PreferencesProvider>
      <AiInterviewPage code="org-a.ai1.mac" />
    </PreferencesProvider>,
  );

describe("an AI interview, for the candidate", () => {
  it("explains itself, starts, and sends an answer with code", async () => {
    const started: AiRoom = { ...base, status: "in_progress", asked: 1, startedAt: "2026-10-05T05:00:00Z", endsAt: new Date(Date.now() + 30 * 60_000).toISOString(), turns: [q("How would you find a duplicate?")] };
    const answered: AiRoom = {
      ...started,
      turns: [...started.turns, { speaker: "candidate", kind: "answer", body: "With a set", code: "seen = set()", language: "python", at: "2026-10-05T05:01:00Z" }, q("Why a set?", "follow_up")],
    };
    const fetch = vi.fn(async (url: string, init?: RequestInit) => (url.endsWith("/start") ? json(started) : url.endsWith("/answer") ? json(answered) : json(base)));
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    show();
    const page = await screen.findByRole("region", { name: "AI interview" });
    expect(page).toHaveTextContent("2 questions, each with one follow-up");
    expect(page).toHaveTextContent("not told your name");
    await user.click(screen.getByRole("button", { name: "Start the interview" }));
    const chat = await screen.findByRole("list", { name: "Conversation" });
    expect(chat).toHaveTextContent("How would you find a duplicate?");
    expect(screen.getByText(/Question 1 of 2/)).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "With a set");
    await user.click(screen.getByRole("button", { name: /Add code/ }));
    await user.type(screen.getByRole("textbox", { name: "Code editor" }), "seen = set()");
    await user.click(screen.getByRole("button", { name: /Send answer/ }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/ai-interviews/room/org-a.ai1.mac/answer",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ text: "With a set", code: "seen = set()", language: "python" }) }),
      ),
    );
    expect(await within(chat).findByText("Why a set?")).toBeInTheDocument();
    expect(within(chat).getByLabelText("Code (python)")).toHaveTextContent("seen = set()");
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
  });

  it("says when it has ended, and when the link does not work", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ ...base, status: "done", asked: 2, turns: [q("Q1"), { ...q("Thank you, that is the end."), kind: "closing" }] })));
    const { unmount } = show();
    expect(await screen.findByRole("status")).toHaveTextContent("The interview has ended");
    expect(screen.queryByRole("textbox", { name: "Your answer" })).toBeNull();
    unmount();

    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "interview_not_found" }, 404)));
    show();
    expect(await screen.findByText("This interview link does not work")).toBeInTheDocument();
  });

  it("shows the server's reason when an answer is refused", async () => {
    const open: AiRoom = { ...base, status: "in_progress", asked: 1, startedAt: "2026-10-05T05:00:00Z", endsAt: new Date(Date.now() + 60_000).toISOString(), turns: [q("Q1")] };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.endsWith("/answer") ? json({ error: "invalid_state", message: "That answer is too long" }, 409) : json(open))));
    const user = userEvent.setup();
    show();
    await user.type(await screen.findByRole("textbox", { name: "Your answer" }), "x");
    await user.click(screen.getByRole("button", { name: /Send answer/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That answer is too long");
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("x");
  });

  it("asks for the next question when the interviewer could not reply", async () => {
    const kept: AiRoom = {
      ...base,
      status: "in_progress",
      asked: 1,
      startedAt: "2026-10-05T05:00:00Z",
      endsAt: new Date(Date.now() + 60_000).toISOString(),
      turns: [q("Q1"), { speaker: "candidate", kind: "answer", body: "With a set", code: null, language: null, at: "2026-10-05T05:01:00Z" }],
    };
    const fetch = vi.fn(async (url: string) => (url.endsWith("/start") ? json({ ...kept, turns: [...kept.turns, q("Why?", "follow_up")] }) : json(kept)));
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    show();
    expect(await screen.findByText(/has not replied yet/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Ask the next question" }));
    expect(await screen.findByText("Why?")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/ai-interviews/room/org-a.ai1.mac/start", expect.objectContaining({ method: "POST" }));
  });
});
