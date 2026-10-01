import type { CandidateState, ParikshaaClient } from "./api.ts";

/**
 * The practice test (docs/PREP-TRACKER.md, CL26): the real exam screen —
 * the palette, Save & Next, the timer, the calculator, submitting — on a
 * short sample paper, for someone about to sit their first computer-based
 * test. It runs in the browser alone: nothing is sent, marked or kept, and
 * no organisation's credits are spent. Opened at `/?demo`.
 */

const MINUTES = 15;

const base = { translations: {}, images: [], passage: null };

export const DEMO_TITLE = "Practice test — nothing is recorded";

const QUESTIONS = [
  { ...base, id: "d1", kind: "mcq", stem: "A train travels 180 km in 3 hours. What is its average speed?", maxScore: 1, options: ["50 km/h", "60 km/h", "90 km/h", "540 km/h"], multiple: false, negativeMarks: 0 },
  { ...base, id: "d2", kind: "mcq", stem: "Which number comes next: 2, 6, 12, 20, 30, …?", maxScore: 1, options: ["40", "42", "44", "36"], multiple: false, negativeMarks: 0.25 },
  { ...base, id: "d3", kind: "numeric", stem: "What is 15% of 240?", maxScore: 1, negativeMarks: 0 },
  { ...base, id: "d4", kind: "mcq", stem: "Choose every word that means the same as 'rapid'.", maxScore: 2, options: ["quick", "slow", "swift", "steady"], multiple: true, negativeMarks: 0 },
  { ...base, id: "d5", kind: "short", stem: "In two or three lines, say why you want this job. (Practice only: nobody reads it.)", maxScore: 3, spoken: true },
] as const;

type Answer = { questionId: string; answer: string; submittedAt: number };

export class DemoClient {
  #state: CandidateState;

  constructor(now = Date.now()) {
    this.#state = {
      attemptId: "practice",
      exam: { id: "practice", title: DEMO_TITLE, durationMs: MINUTES * 60_000, allowRevision: true, questions: QUESTIONS, proctoring: null, testFeedback: "visible", codeCompletion: false, calculator: true },
      state: "in_progress",
      voidReason: null,
      startedAt: now,
      expiresAt: now + MINUTES * 60_000,
      answers: [],
      openProbe: null,
      answeredProbeCount: 0,
      drafts: [],
      identityCaptured: false,
      parts: null,
    } as unknown as CandidateState;
  }

  /** The client the exam screen talks to: the same calls, answered here. */
  asClient(): ParikshaaClient {
    return this as unknown as ParikshaaClient;
  }

  async state(): Promise<CandidateState> {
    if (this.#state.state === "in_progress" && Date.now() > this.#state.expiresAt) this.#state = { ...this.#state, state: "submitted" } as CandidateState;
    return this.#state;
  }

  async ledger() {
    return { head: null, length: 0, sealed: false, entries: null };
  }

  async saveAnswer(questionId: string, answer: string): Promise<void> {
    const answers = [...(this.#state.answers as readonly Answer[]).filter((a) => a.questionId !== questionId), { questionId, answer, submittedAt: Date.now() }];
    this.#state = { ...this.#state, answers } as unknown as CandidateState;
  }

  async saveDraft(): Promise<void> {}
  async captureIdentity(): Promise<void> {}
  async snapshot(): Promise<void> {}
  async proctorEvents(): Promise<void> {}
  async nextSection(): Promise<void> {}

  async submit(): Promise<void> {
    this.#state = { ...this.#state, state: "submitted" } as CandidateState;
  }

  async heartbeat() {
    return { state: this.#state.state, expiresAt: this.#state.expiresAt, announcements: 0 };
  }

  async announcements() {
    return [];
  }

  async result() {
    return { released: false };
  }

  async feedbackGiven(): Promise<boolean> {
    // A practice run asks for no feedback.
    return true;
  }

  async giveFeedback(): Promise<void> {}

  async replyToProbe(): Promise<void> {}

  async probeOnce() {
    return null;
  }

  async streamProbe(handlers: { readonly onNone?: () => void }): Promise<void> {
    handlers.onNone?.();
  }
}
