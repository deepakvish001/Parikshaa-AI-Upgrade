import { describe, expect, it } from "vitest";
import { diffOp, replay, type TimelineOp } from "./timeline.js";

/** Code playback (G4): the smallest edit between two texts, and edits that replay to what was typed. */

describe("code playback edits", () => {
  it("replay any sequence of texts exactly, through resets too", () => {
    const texts = ["", "a", "ab", "b", "bab", "", "x\ny", "x\nYy"];
    const ops: TimelineOp[] = [];
    for (let i = 1; i < texts.length; i++) {
      const op = diffOp(texts[i - 1]!, texts[i]!, i);
      if (op !== null) ops.push(op);
      expect(replay(ops)).toBe(texts[i]);
    }
    expect(replay([...ops, { t: 99, at: 0, del: 0, ins: "new", reset: true }, { t: 100, at: 3, del: 0, ins: "!" }])).toBe("new!");
  });
});
