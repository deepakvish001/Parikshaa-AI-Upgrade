import { describe, expect, it, vi } from "vitest";
import { TimelineSender, diffOp, replay, type TimelineOp } from "./code-timeline.ts";

/** Code playback (G4): edits that replay to the same text, sent in batches, kept when sending fails. */

describe("the editor's changes", () => {
  it("are the smallest edit between two texts, and replay to what was typed", () => {
    expect(diffOp("abc", "abc", 1)).toBeNull();
    expect(diffOp("print(1)", "print(12)", 1)).toEqual({ t: 1, at: 7, del: 0, ins: "2" });
    expect(diffOp("aXXb", "ab", 2)).toEqual({ t: 2, at: 1, del: 2, ins: "" });
    expect(diffOp("aaa", "aa", 3)).toEqual({ t: 3, at: 2, del: 1, ins: "" });

    const texts = ["", "d", "def", "def f():", "def f():\n    return 1", "def g():\n    return 1", "# gone"];
    const ops: TimelineOp[] = [{ t: 0, at: 0, del: 0, ins: texts[0]!, reset: true }];
    for (let i = 1; i < texts.length; i++) ops.push(diffOp(texts[i - 1]!, texts[i]!, i)!);
    texts.forEach((text, i) => expect(replay(ops, i + 1)).toBe(text));
    expect(replay([...ops, { t: 9, at: 0, del: 0, ins: "fresh", reset: true }])).toBe("fresh");
  });
});

describe("sending them", () => {
  it("goes per question, a thousand at a time, and keeps what failed for the next try", async () => {
    let fail = true;
    const sent: [string, number][] = [];
    const send = vi.fn(async (questionId: string, ops: readonly TimelineOp[]) => {
      if (fail) throw new Error("offline");
      sent.push([questionId, ops.length]);
    });
    const sender = new TimelineSender(send);
    for (let i = 0; i < 1500; i++) sender.record("q1", { t: i, at: 0, del: 0, ins: "x" });
    sender.record("q2", { t: 1, at: 0, del: 0, ins: "y" });
    await sender.flush();
    expect(sender.waiting).toBe(1501);
    fail = false;
    await sender.flush();
    expect(sent).toEqual([
      ["q2", 1],
      ["q1", 1000],
      ["q1", 500],
    ]);
    expect(sender.waiting).toBe(0);
  });

  it("keeps the newest when too many wait", () => {
    const sender = new TimelineSender(async () => undefined, { max: 3 });
    for (let i = 0; i < 5; i++) sender.record("q", { t: i, at: 0, del: 0, ins: String(i) });
    expect(sender.waiting).toBe(3);
  });
});
