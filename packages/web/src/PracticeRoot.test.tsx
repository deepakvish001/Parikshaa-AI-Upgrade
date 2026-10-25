import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PracticeRoot } from "./PracticeRoot.tsx";

/**
 * With `learn_v2` off a practice site is today's practice app, as it was, and
 * Learn's chunk is never fetched; with it on, Learn's shell takes its place.
 * The two apps are stand-ins here: each has tests of its own.
 */
const loaded = vi.hoisted(() => ({ practice: 0, learn: 0 }));

vi.mock("./practice/PracticeApp.tsx", () => {
  loaded.practice += 1;
  return { PracticeApp: ({ site }: { site: string }) => <p>practice app for {site}</p> };
});
vi.mock("./learn/LearnApp.tsx", () => {
  loaded.learn += 1;
  return { LearnApp: ({ site }: { site: string }) => <p>learn shell for {site}</p> };
});

describe("a practice site's root", () => {
  it("is today's practice app with the flag off, and never loads Learn", async () => {
    render(<PracticeRoot site="demo" learnV2={false} />);
    expect(await screen.findByText("practice app for demo")).toBeInTheDocument();
    expect(screen.queryByText(/learn shell/)).not.toBeInTheDocument();
    expect(loaded.learn).toBe(0);
  });

  it("is Learn v2's shell with the flag on", async () => {
    render(<PracticeRoot site="demo" learnV2 />);
    expect(await screen.findByText("learn shell for demo")).toBeInTheDocument();
    expect(screen.queryByText(/practice app/)).not.toBeInTheDocument();
    expect(loaded.learn).toBe(1);
  });
});
