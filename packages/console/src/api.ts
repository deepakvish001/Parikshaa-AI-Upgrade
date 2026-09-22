import type { Exam, ExamProblem, Question } from "@parikshaa/core/browser";

export interface ExamSummary {
  readonly id: string;
  readonly title: string;
  readonly questionCount: number;
}

export interface AttemptSummary {
  readonly id: string;
  readonly candidateId: string;
  /** When the candidate's page last checked in. */
  readonly lastSeenAt?: string | null;
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
  readonly voidedBy?: { readonly userId: string; readonly name: string } | null;
  readonly vivas: readonly VivaReview[];
}

export type StaffRole = "owner" | "author" | "invigilator" | "reviewer" | "viewer";
export type ApiKeyRole = Exclude<StaffRole, "owner">;

export interface StaffUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: StaffRole;
  readonly disabled: boolean;
}

/** Who is signed in, and what the server will let them do. */
export interface WhoAmI {
  readonly kind: "user" | "api_key";
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly role: StaffRole;
  readonly organisation: { readonly id: string; readonly name: string };
  readonly permissions: readonly string[];
}

export interface ApiKey {
  readonly id: string;
  readonly name: string;
  readonly role: ApiKeyRole;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
  readonly revoked: boolean;
}

export interface RouteUsage {
  readonly route: "probe" | "assess" | "grade";
  readonly calls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWrite5mTokens: number;
  readonly cacheWrite1hTokens: number;
  readonly costMicroUsd: number;
}

export interface Usage {
  readonly since: string;
  readonly totalCostMicroUsd: number;
  readonly routes: readonly RouteUsage[];
  readonly perAttempt: {
    readonly attempts: number;
    readonly p50MicroUsd: number | null;
    readonly p90MicroUsd: number | null;
    readonly maxMicroUsd: number | null;
  };
  readonly inferenceGeos: readonly { readonly geo: string | null; readonly calls: number }[];
  readonly monthStartedAt: string;
  readonly spentThisMonthMicroUsd: number;
  readonly monthlyCapMicroUsd: number | null;
}

export interface AuditEntry {
  readonly at: string;
  readonly actorKind: "user" | "api_key" | "system";
  readonly actorId: string | null;
  readonly action: string;
  readonly target: string | null;
  readonly detail: Record<string, unknown>;
}

export type Difficulty = "easy" | "medium" | "hard";

export interface BankEntry {
  readonly id: string;
  readonly question: Question;
  readonly topic: string;
  readonly difficulty: Difficulty;
  readonly tags: readonly string[];
  readonly updatedAt: string;
  readonly archived: boolean;
}

export interface BankDraft {
  readonly question: Omit<Question, "id">;
  readonly topic: string;
  readonly difficulty: Difficulty;
  readonly tags: readonly string[];
}

export interface BankFilter {
  readonly topic?: string;
  readonly difficulty?: Difficulty;
  readonly q?: string;
}

export type Channel = "email" | "sms";

export interface ExamWindow {
  readonly opensAt: string;
  readonly closesAt: string;
  readonly hardClose: boolean;
}

export interface Delivery {
  readonly status: string;
  readonly purpose: string;
  readonly at: string;
  readonly error: string | null;
}

export interface InvitationRow {
  readonly id: string;
  readonly candidateRef: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly attemptId: string | null;
  readonly attemptState: "not_started" | "in_progress" | "submitted" | "graded" | "void";
  readonly revoked: boolean;
  readonly delivery: { readonly email: Delivery | null; readonly sms: Delivery | null };
}

export interface RowProblem {
  readonly row: number;
  readonly message: string;
}

export type ImportResult =
  | {
      readonly dryRun: true;
      readonly candidates: number;
      readonly problems: readonly RowProblem[];
      readonly warnings: readonly RowProblem[];
      readonly preview: readonly { candidateRef: string; name: string; email: string | null; phone: string | null }[];
    }
  | { readonly dryRun: false; readonly invited: number; readonly warnings: readonly RowProblem[] };

export type Verdict = "consistent" | "shallow" | "inconsistent" | "inconclusive";

export interface ResultRow {
  readonly attemptId: string;
  readonly candidateId: string;
  readonly ref: string;
  readonly name: string;
  readonly email: string | null;
  readonly state: "in_progress" | "submitted" | "graded" | "void";
  readonly total: number | null;
  readonly maxTotal: number;
  readonly percent: number | null;
  readonly startedAt: number;
  readonly submittedAt: number | null;
  readonly durationMs: number | null;
  readonly scores: Readonly<Record<string, { readonly score: number; readonly max: number }>>;
  readonly probes: { readonly asked: number; readonly replied: number; readonly verdicts: Partial<Record<Verdict, number>> };
  readonly voidReason: string | null;
}

export interface QuestionStats {
  readonly questionId: string;
  readonly stem: string;
  readonly kind: string;
  readonly maxScore: number;
  readonly appeared: number;
  readonly facility: number | null;
  readonly discrimination: number | null;
}

export interface Results {
  readonly exam: { readonly id: string; readonly title: string };
  readonly rows: readonly ResultRow[];
  readonly analytics: {
    readonly candidates: number;
    readonly graded: number;
    readonly setAside: number;
    readonly meanPercent: number | null;
    readonly medianPercent: number | null;
    readonly distribution: readonly number[];
    readonly questions: readonly QuestionStats[];
    readonly time: { readonly medianMinutes: number | null; readonly p90Minutes: number | null };
    readonly integrity: {
      readonly candidatesProbed: number;
      readonly asked: number;
      readonly replied: number;
      readonly read: number;
      readonly verdicts: Readonly<Record<Verdict, number>>;
    };
  };
}

export interface CandidateReport {
  readonly exam: { readonly id: string; readonly title: string };
  readonly candidate: { readonly ref: string; readonly name: string; readonly email: string | null };
  readonly result: Omit<ResultRow, "ref" | "name" | "email">;
  readonly questions: readonly {
    readonly id: string;
    readonly stem: string;
    readonly kind: string;
    readonly maxScore: number;
    readonly score: number | null;
    readonly answer: string | null;
    readonly language: string | null;
  }[];
  readonly vivas: readonly {
    readonly questionId: string;
    readonly prompt: string;
    readonly reply: string | null;
    readonly latencyMs: number | null;
    readonly verdict: Verdict | null;
    readonly confidence: number | null;
    readonly reasoning: string | null;
  }[];
  readonly voidReason: string | null;
  readonly voidedBy: string | null;
  readonly ledger: { readonly head: string; readonly length: number };
}

export class ConsoleError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly problems: readonly ExamProblem[] = [],
    readonly detail?: string,
    readonly rows: readonly { readonly row: number; readonly message: string }[] = [],
  ) {
    super(detail ?? `${code} (${status})`);
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

  /**
   * Exchange an email and password for a session.
   *
   * Every failure reads the same from the server, so there is nothing more
   * specific to say than that the pair was not accepted.
   */
  static async signIn(
    email: string,
    password: string,
    baseUrl = "/api",
  ): Promise<{ readonly token: string; readonly user: StaffUser }> {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; token?: string; user?: StaffUser };
    if (!response.ok || body.token === undefined || body.user === undefined) {
      throw new ConsoleError(response.status, body.error ?? "sign_in_failed");
    }
    return { token: body.token, user: body.user };
  }

  async #request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.#baseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.#token}`,
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      },
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        problems?: (ExamProblem | { row: number; message: string })[];
      };
      const problems = body.problems ?? [];
      throw new ConsoleError(
        response.status,
        body.error ?? "request_failed",
        problems.filter((p): p is ExamProblem => "path" in p),
        body.message,
        problems.filter((p): p is { row: number; message: string } => "row" in p),
      );
    }
    return (await response.json()) as T;
  }

  // --- the session ------------------------------------------------------------

  me(): Promise<WhoAmI> {
    return this.#request<WhoAmI>("/auth/me");
  }

  async signOut(): Promise<void> {
    await this.#request("/auth/logout", { method: "POST" });
  }

  async changePassword(current: string, next: string): Promise<void> {
    await this.#request("/auth/password", { method: "POST", body: JSON.stringify({ current, next }) });
  }

  // --- administration ---------------------------------------------------------

  async listStaff(): Promise<readonly StaffUser[]> {
    return (await this.#request<{ users: StaffUser[] }>("/staff")).users;
  }

  addStaff(member: { email: string; name: string; role: StaffRole; password: string }): Promise<StaffUser> {
    return this.#request<StaffUser>("/staff", { method: "POST", body: JSON.stringify(member) });
  }

  async setRole(userId: string, role: StaffRole): Promise<void> {
    await this.#request(`/staff/${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify({ role }) });
  }

  async disableStaff(userId: string): Promise<void> {
    await this.#request(`/staff/${encodeURIComponent(userId)}/disable`, { method: "POST" });
  }

  async listApiKeys(): Promise<readonly ApiKey[]> {
    return (await this.#request<{ keys: ApiKey[] }>("/api-keys")).keys;
  }

  issueApiKey(name: string, role: ApiKeyRole): Promise<{ readonly id: string; readonly secret: string }> {
    return this.#request("/api-keys", { method: "POST", body: JSON.stringify({ name, role }) });
  }

  async revokeApiKey(id: string): Promise<void> {
    await this.#request(`/api-keys/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  usage(): Promise<Usage> {
    return this.#request<Usage>("/usage");
  }

  async setSpendCap(monthlyCapMicroUsd: number | null): Promise<void> {
    await this.#request("/org/spend-cap", { method: "PUT", body: JSON.stringify({ monthlyCapMicroUsd }) });
  }

  async audit(): Promise<readonly AuditEntry[]> {
    return (await this.#request<{ entries: AuditEntry[] }>("/audit")).entries;
  }

  // --- the question bank -------------------------------------------------------

  listBank(filter: BankFilter = {}): Promise<{ questions: readonly BankEntry[]; topics: readonly string[] }> {
    const query = new URLSearchParams(
      Object.entries(filter).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== ""),
    ).toString();
    return this.#request(`/bank${query === "" ? "" : `?${query}`}`);
  }

  fileQuestion(draft: BankDraft): Promise<BankEntry> {
    return this.#request("/bank", { method: "POST", body: JSON.stringify(draft) });
  }

  editQuestion(id: string, draft: BankDraft): Promise<BankEntry> {
    return this.#request(`/bank/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(draft) });
  }

  async archiveQuestion(id: string): Promise<void> {
    await this.#request(`/bank/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  /**
   * Import a CSV file. A rejected file throws a {@link ConsoleError} whose
   * problems name the rows, as `row 7`.
   */
  async importBank(csv: string): Promise<number> {
    try {
      return (await this.#request<{ imported: number }>("/bank/import", { method: "POST", body: JSON.stringify({ csv }) }))
        .imported;
    } catch (error) {
      if (error instanceof ConsoleError && error.rows.length > 0) {
        throw new ConsoleError(
          error.status,
          error.code,
          error.rows.map((r) => ({ path: `row ${r.row}`, message: r.message })),
        );
      }
      throw error;
    }
  }

  async cloneExam(examId: string, id: string, title?: string): Promise<void> {
    await this.#request(`/exams/${encodeURIComponent(examId)}/clone`, {
      method: "POST",
      body: JSON.stringify(title === undefined ? { id } : { id, title }),
    });
  }

  // --- scheduling and inviting -------------------------------------------------

  getWindow(examId: string): Promise<ExamWindow | null> {
    return this.#request(`/exams/${encodeURIComponent(examId)}/window`);
  }

  async setWindow(examId: string, window: ExamWindow): Promise<void> {
    await this.#request(`/exams/${encodeURIComponent(examId)}/window`, { method: "PUT", body: JSON.stringify(window) });
  }

  /**
   * Check a candidate list (dry run) or import it. A rejected import throws a
   * {@link ConsoleError} whose problems name the rows.
   */
  async importCandidates(examId: string, csv: string, dryRun: boolean, channels: readonly Channel[]): Promise<ImportResult> {
    try {
      return await this.#request(`/exams/${encodeURIComponent(examId)}/invitations/import`, {
        method: "POST",
        body: JSON.stringify({ csv, dryRun, channels }),
      });
    } catch (error) {
      if (error instanceof ConsoleError && error.rows.length > 0) {
        throw new ConsoleError(error.status, error.code, error.rows.map((r) => ({ path: `row ${r.row}`, message: r.message })));
      }
      throw error;
    }
  }

  async listInvitations(examId: string): Promise<readonly InvitationRow[]> {
    return (await this.#request<{ invitations: InvitationRow[] }>(`/exams/${encodeURIComponent(examId)}/invitations`)).invitations;
  }

  async resendInvitation(id: string, channels: readonly Channel[]): Promise<void> {
    await this.#request(`/invitations/${encodeURIComponent(id)}/resend`, { method: "POST", body: JSON.stringify({ channels }) });
  }

  async revokeInvitation(id: string): Promise<void> {
    await this.#request(`/invitations/${encodeURIComponent(id)}/revoke`, { method: "POST" });
  }

  /** Every candidate's link, as a CSV file's contents. */
  async invitationLinks(examId: string): Promise<Blob> {
    const response = await fetch(`${this.#baseUrl}/exams/${encodeURIComponent(examId)}/invitations/links.csv`, {
      headers: { authorization: `Bearer ${this.#token}` },
    });
    if (!response.ok) throw new ConsoleError(response.status, "request_failed");
    return response.blob();
  }

  // --- results ----------------------------------------------------------------

  results(examId: string): Promise<Results> {
    return this.#request<Results>(`/exams/${encodeURIComponent(examId)}/results`);
  }

  /** The results as a file to save: CSV or an Excel workbook. */
  async resultsFile(examId: string, format: "csv" | "xlsx"): Promise<Blob> {
    const response = await fetch(`${this.#baseUrl}/exams/${encodeURIComponent(examId)}/results.${format}`, {
      headers: { authorization: `Bearer ${this.#token}` },
    });
    if (!response.ok) throw new ConsoleError(response.status, "request_failed");
    return response.blob();
  }

  report(attemptId: string): Promise<CandidateReport> {
    return this.#request<CandidateReport>(`/attempts/${encodeURIComponent(attemptId)}/report`);
  }

  // --- exams and attempts -----------------------------------------------------

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

  /** More time for an open attempt, with a reason that goes into its ledger. */
  extendTime(attemptId: string, minutes: number, reason: string): Promise<{ expiresAt: number }> {
    return this.#request(`/attempts/${encodeURIComponent(attemptId)}/extend`, {
      method: "POST",
      body: JSON.stringify({ minutes, reason }),
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
