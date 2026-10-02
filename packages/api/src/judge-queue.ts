import { RunnerUnavailable, type CodeRunner } from "@parikshaa/runner";

/**
 * The judge's queue (Prep blueprint F11, §20): what practice sends the code
 * runner waits its turn here, so a contest's rush cannot pile thousands of
 * programs onto the runner at once.
 *
 * At most `concurrency` programs run at a time. The rest wait in two lanes,
 * each in the order they came: a running contest's go first, but after
 * `CONTEST_SHARE` contest programs in a row, one waiting practice program
 * goes — so a long contest slows practice and never stops it. A program that has waited `waitMs` without a turn is turned away, and
 * so is one that finds `maxWaiting` already waiting: the learner is told the
 * judge is busy, rather than left with a spinner.
 *
 * The queue is in this process. Several API servers each keep their own, so
 * the runner sees at most `concurrency` from each.
 */

export type JudgeLane = "contest" | "practice";

export interface JudgeOptions {
  /** Programs run at once. */
  readonly concurrency?: number;
  /** Programs that may wait; one more is turned away at once. */
  readonly maxWaiting?: number;
  /** How long one may wait for its turn, in milliseconds. */
  readonly waitMs?: number;
}

/** Contest programs started in a row, while practice waits, before one of practice's. */
export const CONTEST_SHARE = 4;

export const JUDGE_DEFAULTS = { concurrency: 8, maxWaiting: 2000, waitMs: 60_000 } as const;

/** The judge had no room: the queue was full, or the wait ran out. */
export class JudgeBusy extends RunnerUnavailable {
  constructor(readonly reason: "queue_full" | "waited_too_long") {
    super(reason === "queue_full" ? "The judge is full just now" : "The judge took too long to get to it");
    this.name = "JudgeBusy";
  }
}

interface Waiting {
  readonly start: () => void;
  timer: ReturnType<typeof setTimeout> | null;
}

export class JudgeQueue {
  readonly #runner: CodeRunner;
  readonly #concurrency: number;
  readonly #maxWaiting: number;
  readonly #waitMs: number;
  readonly #lanes: Record<JudgeLane, Waiting[]> = { contest: [], practice: [] };
  #running = 0;
  #served = { contest: 0, practice: 0 };
  #refused = 0;
  #contestInRow = 0;

  constructor(runner: CodeRunner, options: JudgeOptions = {}) {
    this.#runner = runner;
    this.#concurrency = Math.max(1, Math.floor(options.concurrency ?? JUDGE_DEFAULTS.concurrency));
    this.#maxWaiting = Math.max(0, Math.floor(options.maxWaiting ?? JUDGE_DEFAULTS.maxWaiting));
    this.#waitMs = Math.max(1, options.waitMs ?? JUDGE_DEFAULTS.waitMs);
  }

  /** What is running and waiting now, and what has been served and turned away since start. */
  stats() {
    return {
      concurrency: this.#concurrency,
      running: this.#running,
      waiting: { contest: this.#lanes.contest.length, practice: this.#lanes.practice.length },
      served: { ...this.#served },
      refused: this.#refused,
    };
  }

  async run(request: Parameters<CodeRunner["run"]>[0], lane: JudgeLane): ReturnType<CodeRunner["run"]> {
    await this.#turn(lane);
    this.#served[lane] += 1;
    try {
      return await this.#runner.run(request);
    } finally {
      this.#running -= 1;
      this.#next();
    }
  }

  /** Resolves when it is this program's turn; the slot is taken by then. */
  #turn(lane: JudgeLane): Promise<void> {
    if (this.#running < this.#concurrency && this.#lanes.contest.length === 0 && this.#lanes.practice.length === 0) {
      this.#running += 1;
      return Promise.resolve();
    }
    if (this.#lanes.contest.length + this.#lanes.practice.length >= this.#maxWaiting) {
      this.#refused += 1;
      return Promise.reject(new JudgeBusy("queue_full"));
    }
    return new Promise<void>((resolve, reject) => {
      const waiting: Waiting = {
        start: () => {
          if (waiting.timer !== null) clearTimeout(waiting.timer);
          resolve();
        },
        timer: null,
      };
      waiting.timer = setTimeout(() => {
        const queue = this.#lanes[lane];
        const at = queue.indexOf(waiting);
        if (at < 0) return;
        queue.splice(at, 1);
        this.#refused += 1;
        reject(new JudgeBusy("waited_too_long"));
      }, this.#waitMs);
      this.#lanes[lane].push(waiting);
    });
  }

  #next(): void {
    while (this.#running < this.#concurrency) {
      const practiceTurn = this.#lanes.practice.length > 0 && (this.#lanes.contest.length === 0 || this.#contestInRow >= CONTEST_SHARE);
      const waiting = practiceTurn ? this.#lanes.practice.shift() : this.#lanes.contest.shift();
      if (waiting === undefined) return;
      this.#contestInRow = practiceTurn ? 0 : this.#contestInRow + 1;
      this.#running += 1;
      waiting.start();
    }
  }
}
