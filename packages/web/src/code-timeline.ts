/**
 * Code playback (G4): the editor's changes, kept as small edits and sent in
 * batches, so a reviewer can watch how an answer was written. Only the code
 * editor's own text; nothing else on the page or the device.
 */

import type { TimelineOp } from "@parikshaa/core/browser";

export { diffOp, replay, type TimelineOp } from "@parikshaa/core/browser";

/** Edits waiting to be sent, per question; sent every few seconds, kept and tried again if sending fails. */
export class TimelineSender {
  readonly #send: (questionId: string, ops: readonly TimelineOp[]) => Promise<void>;
  readonly #waiting = new Map<string, TimelineOp[]>();
  readonly #max: number;
  #sending = false;

  constructor(send: (questionId: string, ops: readonly TimelineOp[]) => Promise<void>, options: { readonly max?: number } = {}) {
    this.#send = send;
    this.#max = options.max ?? 5000;
  }

  record(questionId: string, op: TimelineOp): void {
    const ops = this.#waiting.get(questionId) ?? [];
    // A connection gone for long: keep the newest, rather than all of the device's memory.
    if (ops.length >= this.#max) ops.shift();
    ops.push(op);
    this.#waiting.set(questionId, ops);
  }

  get waiting(): number {
    let n = 0;
    for (const ops of this.#waiting.values()) n += ops.length;
    return n;
  }

  /** Send what is waiting, at most 1,000 edits a request. A failure puts them back for next time. */
  async flush(): Promise<void> {
    if (this.#sending) return;
    this.#sending = true;
    try {
      for (const [questionId, ops] of [...this.#waiting]) {
        this.#waiting.delete(questionId);
        for (let at = 0; at < ops.length; at += 1000) {
          const chunk = ops.slice(at, at + 1000);
          try {
            await this.#send(questionId, chunk);
          } catch {
            this.#waiting.set(questionId, [...ops.slice(at), ...(this.#waiting.get(questionId) ?? [])]);
            return;
          }
        }
      }
    } finally {
      this.#sending = false;
    }
  }
}
