import { afterEach, describe, expect, it, vi } from "vitest";
import type { CodeRunner, RunRequest, RunResult } from "@parikshaa/runner";
import { JudgeBusy, JudgeQueue } from "./judge-queue.js";

/** The judge's queue against a runner the test finishes by hand. */

function heldRunner() {
  const started: string[] = [];
  const pending = new Map<string, { resolve: (r: RunResult) => void; reject: (e: Error) => void }>();
  const runner: CodeRunner = {
    run: (request: RunRequest) =>
      new Promise<RunResult>((resolve, reject) => {
        started.push(request.source);
        pending.set(request.source, { resolve, reject });
      }),
  };
  const finish = (source: string) => pending.get(source)!.resolve({ compiled: true, tests: [] });
  const fail = (source: string) => pending.get(source)!.reject(new Error("runner fell over"));
  return { runner, started, finish, fail };
}

const program = (source: string) => ({ language: "python", source, tests: [] }) as unknown as RunRequest;
const settle = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  vi.useRealTimers();
});

describe("the judge's queue", () => {
  it("runs no more than its limit at once, and a contest's programs before practice's, each in order", async () => {
    const { runner, started, finish } = heldRunner();
    const judge = new JudgeQueue(runner, { concurrency: 2 });
    const done: string[] = [];
    const send = (source: string, lane: "contest" | "practice") => judge.run(program(source), lane).then(() => done.push(source));
    void send("p1", "practice");
    void send("p2", "practice");
    void send("p3", "practice");
    void send("p4", "practice");
    void send("c1", "contest");
    void send("c2", "contest");
    await settle();
    expect(started).toEqual(["p1", "p2"]);
    expect(judge.stats()).toMatchObject({ running: 2, waiting: { contest: 2, practice: 2 } });

    finish("p1");
    await settle();
    expect(started).toEqual(["p1", "p2", "c1"]);
    finish("p2");
    finish("c1");
    await settle();
    expect(started).toEqual(["p1", "p2", "c1", "c2", "p3"]);
    finish("c2");
    finish("p3");
    await settle();
    finish("p4");
    await settle();
    expect(started).toEqual(["p1", "p2", "c1", "c2", "p3", "p4"]);
    expect(done).toHaveLength(6);
    expect(judge.stats()).toMatchObject({ running: 0, waiting: { contest: 0, practice: 0 }, served: { contest: 2, practice: 4 }, refused: 0 });
  });

  it("lets one practice program through after every four contest programs in a row", async () => {
    const { runner, started, finish } = heldRunner();
    const judge = new JudgeQueue(runner, { concurrency: 1 });
    const all = [judge.run(program("first"), "practice")];
    for (const n of [1, 2, 3, 4, 5, 6]) all.push(judge.run(program(`c${n}`), "contest"));
    for (const n of [1, 2]) all.push(judge.run(program(`p${n}`), "practice"));
    await settle();
    for (let i = 0; i < 9; i++) {
      finish(started.at(-1)!);
      await settle();
    }
    await Promise.all(all);
    expect(started).toEqual(["first", "c1", "c2", "c3", "c4", "p1", "c5", "c6", "p2"]);
  });

  it("turns one away at once when the queue is full", async () => {
    const { runner, started, finish } = heldRunner();
    const judge = new JudgeQueue(runner, { concurrency: 1, maxWaiting: 1 });
    const first = judge.run(program("a"), "practice");
    const second = judge.run(program("b"), "contest");
    await expect(judge.run(program("c"), "contest")).rejects.toMatchObject({ name: "JudgeBusy", reason: "queue_full" });
    finish("a");
    await first;
    await settle();
    finish("b");
    await second;
    expect(started).toEqual(["a", "b"]);
    expect(judge.stats().refused).toBe(1);
  });

  it("gives up on one that waits too long, and it never runs", async () => {
    vi.useFakeTimers();
    const { runner, started, finish } = heldRunner();
    const judge = new JudgeQueue(runner, { concurrency: 1, waitMs: 5_000 });
    const first = judge.run(program("a"), "practice");
    const late = judge.run(program("b"), "practice");
    const caught = late.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(5_001);
    const error = await caught;
    expect(error).toBeInstanceOf(JudgeBusy);
    expect((error as JudgeBusy).reason).toBe("waited_too_long");
    finish("a");
    await first;
    await vi.advanceTimersByTimeAsync(10);
    expect(started).toEqual(["a"]);
    expect(judge.stats()).toMatchObject({ running: 0, waiting: { practice: 0 }, refused: 1 });
  });

  it("frees the slot of a program whose run failed", async () => {
    const { runner, started, fail, finish } = heldRunner();
    const judge = new JudgeQueue(runner, { concurrency: 1 });
    const first = judge.run(program("a"), "practice");
    const second = judge.run(program("b"), "practice");
    await settle();
    fail("a");
    await expect(first).rejects.toThrow("runner fell over");
    await settle();
    expect(started).toEqual(["a", "b"]);
    finish("b");
    await second;
    expect(judge.stats().running).toBe(0);
  });
});
