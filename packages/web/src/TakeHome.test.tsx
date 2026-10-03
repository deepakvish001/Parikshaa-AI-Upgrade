import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnswerInput } from "./components/AnswerInput.tsx";
import { PreferencesProvider } from "./i18n.tsx";

/** Plan row 88: a take-home is answered with a link to the work and notes on it. */

const question = { id: "th", kind: "short", stem: "Build a URL shortener.", maxScore: 20, takeHome: true } as const;

const show = (value: string, onChange = vi.fn()) => {
  render(
    <PreferencesProvider>
      <AnswerInput question={question as never} value={value} disabled={false} onChange={onChange} />
    </PreferencesProvider>,
  );
  return onChange;
};

describe("a take-home answer", () => {
  it("asks for the link and notes, and stores them together", () => {
    const onChange = show("");
    expect(screen.getByText(/A person opens it and marks it/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /Link to your work/ }), { target: { value: "https://github.com/a/b" } });
    expect(JSON.parse(onChange.mock.calls.at(-1)![0])).toEqual({ link: "https://github.com/a/b", notes: "" });
  });

  it("shows what was saved, and says when the link is not https", () => {
    show(JSON.stringify({ link: "http://github.com/a/b", notes: "Run make" }));
    expect(screen.getByRole("textbox", { name: /Link to your work/ })).toHaveValue("http://github.com/a/b");
    expect(screen.getByRole("textbox", { name: /Notes for the reviewer/ })).toHaveValue("Run make");
    expect(screen.getByRole("alert")).toHaveTextContent("Give an https address");
  });

  it("leaves an ordinary short answer a text box", () => {
    render(
      <PreferencesProvider>
        <AnswerInput question={{ ...question, takeHome: false } as never} value="" disabled={false} onChange={vi.fn()} />
      </PreferencesProvider>,
    );
    expect(screen.getByRole("textbox", { name: "Build a URL shortener." })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Link to your work/ })).toBeNull();
  });
});
