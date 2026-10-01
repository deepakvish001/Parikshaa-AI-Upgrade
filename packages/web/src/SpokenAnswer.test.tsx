import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnswerInput } from "./components/AnswerInput.tsx";
import { PreferencesProvider } from "./i18n.tsx";

/** Answering a written question by speaking: the browser writes it down; only the words are kept. */

const question = { id: "q1", kind: "short", stem: "Tell us about yourself.", maxScore: 5, spoken: true } as const;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a spoken answer", () => {
  it("listens in the candidate's language and adds what was said to the box", async () => {
    let instance: { lang: string; onresult: ((e: unknown) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void } | null = null;
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = true;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      constructor() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        instance = this;
      }
      start() {}
      stop() {
        this.onend?.();
      }
    }
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    const changed = vi.fn();
    const user = userEvent.setup();
    render(
      <PreferencesProvider>
        <AnswerInput question={question as never} value="I am" disabled={false} onChange={changed} />
      </PreferencesProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Speak your answer" }));
    expect(instance!.lang).toBe("en-IN");
    expect(screen.getByRole("status")).toHaveTextContent("Listening");
    act(() => instance!.onresult!({ resultIndex: 0, results: [Object.assign([{ transcript: " a final year student " }], { isFinal: true })] }));
    expect(changed).toHaveBeenCalledWith("I am a final year student");
    await user.click(screen.getByRole("button", { name: "Stop listening" }));
    expect(screen.getByRole("button", { name: "Speak your answer" })).toBeInTheDocument();
  });

  it("falls back to typing where the browser cannot listen", () => {
    render(
      <PreferencesProvider>
        <AnswerInput question={question as never} value="" disabled={false} onChange={() => undefined} />
      </PreferencesProvider>,
    );
    expect(screen.getByText(/type your answer/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Tell us about yourself." })).toBeInTheDocument();
  });
});
