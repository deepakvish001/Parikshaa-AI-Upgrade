import type { Exam, ExamProblem } from "@parikshaa/core/browser";

export interface ExamSummary {
  readonly id: string;
  readonly title: string;
  readonly questionCount: number;
}

export interface AttemptSummary {
  readonly id: string;
  readonly candidateId: string;
  readonly entries: number;
  readonly state: "in_progress" | "submitted" | "graded" | "void";
}

export interface VivaReview {
  readonly probeId: string;
  readonly questionId: string;
  readonly prompt: string;
  readonly rationale: string;
  readonly reply: string | null;
  readonly latencyMs: number | null;
  readonly verdict: "consistent" | "shallow" | "inconsistent" | "inconclusive" | null;
  readonly confidence: number | null;
  readonly reasoning: string | null;
}

export interface AttemptReview {
  readonly state: string;
  readonly total: number | null;
  readonly voidReason: string | null;
  readonly vivas: readonly VivaReview[];
}

export class ConsoleError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly problems: readonly ExamProblem[] = [],
  ) {
    super(`${code} (${status})`);
    this.name = "ConsoleError";
  }
}

export class ConsoleClient {
  readonly #token: string;
  readonly #baseUrl: string;

  constructor(token: string, baseUrl = "/api") {
    this.#token = token;
    this.#baseUrl = baseUrl.replace(/\/$/, "");
  }

  async #request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.#baseUrl}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${this.#token}`, "content-type": "application/json" },
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        problems?: ExamProblem[];
      };
      throw new ConsoleError(response.status, body.error ?? "request_failed", body.problems ?? []);
    }
    return (await response.json()) as T;
  }

  async listExams(): Promise<readonly ExamSummary[]> {
    return (await this.#request<{ exams: ExamSummary[] }>("/exams")).exams;
  }

  loadExam(id: string): Promise<Exam> {
    return this.#request<Exam>(`/exams/${encodeURIComponent(id)}`);
  }

  async saveExam(exam: Exam): Promise<void> {
    await this.#request("/exams", { method: "POST", body: JSON.stringify(exam) });
  }

  async listAttempts(examId: string): Promise<readonly AttemptSummary[]> {
    return (
      await this.#request<{ attempts: AttemptSummary[] }>(
        `/exams/${encodeURIComponent(examId)}/attempts`,
      )
    ).attempts;
  }

  /** Start an attempt and return the access code to hand to the candidate. */
  startAttempt(examId: string, candidateId: string): Promise<{ attemptId: string; token: string }> {
    return this.#request(`/exams/${encodeURIComponent(examId)}/attempts`, {
      method: "POST",
      body: JSON.stringify({ candidateId }),
    });
  }

  review(attemptId: string): Promise<AttemptReview> {
    return this.#request<AttemptReview>(`/attempts/${encodeURIComponent(attemptId)}/review`);
  }

  voidAttempt(attemptId: string, reason: string): Promise<unknown> {
    return this.#request(`/attempts/${encodeURIComponent(attemptId)}/void`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  grade(attemptId: string): Promise<{ total: number }> {
    return this.#request(`/attempts/${encodeURIComponent(attemptId)}/grade`, { method: "POST" });
  }

  assess(attemptId: string, probeId: string): Promise<unknown> {
    return this.#request(
      `/attempts/${encodeURIComponent(attemptId)}/assess/${encodeURIComponent(probeId)}`,
      { method: "POST" },
    );
  }
}
