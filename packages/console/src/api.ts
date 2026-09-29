import type { Exam, ExamProblem, Question } from "@parikshaa/core/browser";

export interface ExamSummary {
  readonly id: string;
  readonly title: string;
  readonly questionCount: number;
  /** The rest arrived later; an older server leaves them out. */
  readonly createdAt?: string;
  readonly totalMarks?: number | null;
  readonly sectionCount?: number;
  readonly durationMs?: number | null;
  readonly proctored?: boolean;
  /** The qualifying mark, as a percentage of the paper, if one is set. */
  readonly cutoffPercent?: number | null;
  readonly attempts?: {
    readonly invited: number;
    readonly inProgress: number;
    readonly submitted: number;
    readonly graded: number;
    readonly void: number;
  };
  /** When it can be sat, if a window has been set. */
  readonly window?: { readonly opensAt: string; readonly closesAt: string } | null;
  /** When it was put away, or null while it is current. */
  readonly archivedAt?: string | null;
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
  readonly state: "in_progress" | "submitted" | "graded" | "void";
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
  /** The organisation requires owners to use a second factor and this one has none yet. */
  readonly mustEnrol2fa: boolean;
}

export interface TwoFactorStatus {
  readonly enabled: boolean;
  readonly recoveryCodesLeft: number;
  readonly required: boolean;
}

export interface SsoSettings {
  readonly configured: boolean;
  readonly issuer: string | null;
  readonly clientId: string | null;
  readonly emailDomains: readonly string[];
  readonly enforced: boolean;
  readonly enabled: boolean;
  readonly redirectUri: string;
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
  readonly route: "probe" | "assess" | "grade" | "tutor";
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

/** The console's home page. */
export interface Dashboard {
  readonly sittings: readonly {
    readonly examId: string;
    readonly title: string;
    readonly opensAt: string;
    readonly closesAt: string;
    readonly invited: number;
    readonly started: number;
  }[];
  /** Null for an account that may not read the audit log. */
  readonly activity:
    | readonly {
        readonly at: string;
        readonly actor: string;
        readonly action: string;
        readonly target: string | null;
        /** The exam it concerns, if any; an older server leaves it out. */
        readonly exam?: { readonly id: string; readonly title: string } | null;
      }[]
    | null;
  readonly setup: {
    readonly exams: number;
    readonly bankQuestions: number;
    readonly scheduled: number;
    readonly invited: number;
    readonly staff: number;
    readonly privacyNotice: boolean;
  };
}

export interface CandidateHit {
  readonly invitationId: string;
  readonly examId: string;
  readonly examTitle: string;
  readonly candidateRef: string;
  readonly name: string;
  readonly email: string | null;
  readonly attemptId: string | null;
  readonly attemptState: InvitationRow["attemptState"];
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
  /** Marks by part of a sectioned paper; "" is the fixed questions. Newer servers only. */
  readonly sections?: readonly SectionScore[];
  /** Against the exam's cut-off, once graded; null without one. */
  readonly outcome?: Outcome | null;
}

export type Outcome = "qualified" | "failed";

export interface SectionScore {
  readonly id: string;
  readonly title: string;
  readonly score: number | null;
  readonly max: number;
  readonly percent: number | null;
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

/** The exam a results page is about, with its qualifying mark; an older server leaves the mark out. */
export interface ExamHead {
  readonly id: string;
  readonly title: string;
  readonly cutoff?: { readonly percent: number; readonly sections?: Readonly<Record<string, number>> } | null;
}

export interface Results {
  readonly exam: ExamHead;
  readonly rows: readonly ResultRow[];
  readonly analytics: {
    readonly candidates: number;
    readonly graded: number;
    readonly setAside: number;
    readonly meanPercent: number | null;
    readonly medianPercent: number | null;
    /** Graded candidates either side of the cut-off; null without one. */
    readonly qualified?: number | null;
    readonly failed?: number | null;
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
  readonly exam: ExamHead;
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
    readonly tests: { readonly passed: number; readonly total: number } | null;
    /** When an answer was first and last saved, after the start, and how often. */
    readonly firstSavedMs?: number | null;
    readonly lastSavedMs?: number | null;
    readonly saves?: number;
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
  /** Among the exam's graded candidates. */
  readonly standing?: { readonly percentile: number | null; readonly rank: number | null; readonly graded: number; readonly meanPercent: number | null };
  readonly ledger: { readonly head: string; readonly length: number };
  /** For a proctored exam: observations, never findings. */
  readonly proctoring?: {
    readonly identity: IdentityState;
    readonly identityReason: string | null;
    readonly identityDecidedBy: string | null;
    readonly snapshots: number;
    readonly events: Readonly<Record<string, number>>;
  } | null;
}

export interface Webhook {
  readonly id: string;
  readonly url: string;
  readonly events: readonly string[];
  readonly version: number;
  readonly description: string;
  readonly createdAt: string;
  readonly disabled: boolean;
}

export interface WebhookDelivery {
  readonly id: string;
  readonly event: string;
  readonly attemptId: string | null;
  readonly status: string;
  readonly attempts: number;
  readonly error: string | null;
  readonly createdAt: string;
  readonly sentAt: string | null;
}

export const WEBHOOK_EVENTS = ["attempt.started", "attempt.submitted", "attempt.graded", "attempt.voided"] as const;

export interface LiveRow {
  readonly invitationId: string | null;
  readonly attemptId: string | null;
  readonly ref: string;
  readonly name: string;
  readonly state: "not_started" | "in_progress" | "submitted" | "graded" | "void";
  readonly answered: number;
  readonly questions: number;
  readonly startedAt: number | null;
  readonly lastSeenAt: number | null;
  readonly lastActivityAt: number | null;
  readonly expiresAt: number | null;
  readonly extraMinutes: number;
  readonly reopened: number;
  readonly awaitingReply: boolean;
  /** For a proctored exam (ROADMAP §14). */
  readonly proctoring: LiveProctoring | null;
  readonly flags: { readonly away: boolean; readonly idle: boolean; readonly overdue: boolean; readonly cameraOff: boolean };
}

export type IdentityState = "not_taken" | "pending" | "verified" | "rejected";

export interface LiveProctoring {
  readonly identity: IdentityState;
  readonly snapshots: number;
  readonly lastSnapshotAt: number | null;
  readonly events: Readonly<Record<string, number>>;
}

export interface ProctoringMedia {
  readonly id: string;
  readonly kind: "selfie" | "id" | "snapshot";
  readonly takenAt: string;
  readonly sha256: string;
}

export interface ProctoringView {
  readonly policy: { readonly identity: boolean; readonly snapshotEverySeconds: number | null; readonly browserEvents: boolean } | null;
  readonly identity: {
    readonly selfie: ProctoringMedia | null;
    readonly id: ProctoringMedia | null;
    readonly capturedAt: number | null;
    readonly review: { readonly outcome: "verified" | "rejected"; readonly reason: string; readonly decidedBy: string; readonly at: number } | null;
    readonly matchesLedger: boolean;
  };
  readonly snapshots: readonly ProctoringMedia[];
  readonly events: readonly { readonly kind: string; readonly at: string }[];
}

export interface Announcement {
  readonly id: string;
  readonly message: string;
  readonly authorName: string;
  readonly at: string;
}

export interface LiveView {
  readonly exam: { readonly id: string; readonly title: string };
  readonly at: number;
  readonly counts: Readonly<
    Record<"invited" | "notStarted" | "inProgress" | "away" | "idle" | "cameraOff" | "identityPending" | "submitted" | "graded" | "void", number>
  >;
  readonly rows: readonly LiveRow[];
  readonly announcements: readonly Announcement[];
}

export interface SimilarSide {
  readonly attemptId: string;
  readonly ref: string;
  readonly name: string;
  readonly language: string;
  readonly source: string;
}

export interface Similarity {
  readonly exam: { readonly id: string; readonly title: string };
  readonly questions: readonly {
    readonly id: string;
    readonly stem: string;
    readonly answered: number;
    readonly pairs: readonly { readonly a: SimilarSide; readonly b: SimilarSide; readonly similarity: number; readonly shared: number }[];
  }[];
}

export interface DocxImport {
  readonly imported: number;
  readonly preview: readonly {
    readonly question: number;
    readonly kind: string;
    readonly stem: string;
    readonly marks: number;
    readonly pictures: number;
    readonly passage: string | null;
    readonly note: string | null;
  }[];
}

/** A file's bytes as base64, for a JSON body. */
export function base64Of(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error ?? new Error("The file could not be read"));
    reader.readAsDataURL(file);
  });
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
    code?: string,
    baseUrl = "/api",
  ): Promise<{ readonly token: string; readonly user: StaffUser }> {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, ...(code === undefined || code === "" ? {} : { code }) }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; token?: string; user?: StaffUser };
    if (!response.ok || body.token === undefined || body.user === undefined) {
      throw new ConsoleError(response.status, body.error ?? "sign_in_failed");
    }
    return { token: body.token, user: body.user };
  }

  /** Ask for a reset link. The server answers the same whether or not the address has an account. */
  static async requestReset(email: string, baseUrl = "/api"): Promise<void> {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/auth/password-reset`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new ConsoleError(response.status, body.error ?? "request_failed");
    }
  }

  static async completeReset(token: string, password: string, baseUrl = "/api"): Promise<void> {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/auth/password-reset/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      throw new ConsoleError(response.status, body.error ?? "request_failed", [], body.message);
    }
  }

  /** Where the browser goes to sign in through the organisation's own provider. */
  static ssoStartUrl(orgId: string, email: string, baseUrl = "/api"): string {
    const query = email.trim() === "" ? "" : `?email=${encodeURIComponent(email.trim())}`;
    return `${baseUrl.replace(/\/$/, "")}/auth/sso/${encodeURIComponent(orgId.trim())}/start${query}`;
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
        problems?: (ExamProblem | { row: number; message: string } | { question: number; written: number | null; message: string })[];
      };
      const problems = body.problems ?? [];
      throw new ConsoleError(
        response.status,
        body.error ?? "request_failed",
        [
          ...problems.filter((p): p is ExamProblem => "path" in p),
          // A Word import's problems, by which question from the top and the number written on it.
          ...problems
            .filter((p): p is { question: number; written: number | null; message: string } => "question" in p)
            .map((p) => ({
              path: p.question === 0 ? "the file" : `question ${p.question}${p.written === null || p.written === p.question ? "" : ` (numbered ${p.written})`}`,
              message: p.message,
            })),
        ],
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

  twoFactor(): Promise<TwoFactorStatus> {
    return this.#request<TwoFactorStatus>("/auth/2fa");
  }

  beginTwoFactor(): Promise<{ readonly secret: string; readonly uri: string }> {
    return this.#request("/auth/2fa/setup", { method: "POST" });
  }

  async enableTwoFactor(code: string): Promise<readonly string[]> {
    return (await this.#request<{ recoveryCodes: string[] }>("/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code }) })).recoveryCodes;
  }

  async disableTwoFactor(password: string, code: string): Promise<void> {
    await this.#request("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password, code }) });
  }

  async requireOwner2fa(required: boolean): Promise<void> {
    await this.#request("/org/security", { method: "PUT", body: JSON.stringify({ requireOwner2fa: required }) });
  }

  sso(): Promise<SsoSettings> {
    return this.#request<SsoSettings>("/org/sso");
  }

  saveSso(settings: {
    readonly issuer: string;
    readonly clientId: string;
    readonly clientSecret?: string;
    readonly emailDomains: readonly string[];
    readonly enforced: boolean;
    readonly enabled: boolean;
  }): Promise<SsoSettings> {
    return this.#request<SsoSettings>("/org/sso", { method: "PUT", body: JSON.stringify(settings) });
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

  /**
   * Read a Word (.docx) question paper. With `dryRun` nothing is added and
   * the preview shows what would be; a rejected file throws a
   * {@link ConsoleError} whose problems name the questions.
   */
  importDocx(file: string, dryRun: boolean): Promise<DocxImport> {
    return this.#request<DocxImport>("/bank/import/docx", { method: "POST", body: JSON.stringify({ file, dryRun }) });
  }

  /** Upload a picture for a question or passage; returns its SHA-256, which the question names. */
  async uploadImage(file: Blob): Promise<string> {
    const image = await base64Of(file);
    try {
      return (await this.#request<{ media: string }>("/media", { method: "POST", body: JSON.stringify({ image }) })).media;
    } catch (error) {
      if (error instanceof ConsoleError && error.code === "not_an_image") throw new Error("Only PNG, JPEG, GIF or WebP pictures, up to 2 MB.");
      throw error;
    }
  }

  /** Code answers alike enough to be worth a look (ROADMAP §4). */
  similarity(examId: string): Promise<Similarity> {
    return this.#request<Similarity>(`/exams/${encodeURIComponent(examId)}/similarity`);
  }

  async cloneExam(examId: string, id: string, title?: string): Promise<void> {
    await this.#request(`/exams/${encodeURIComponent(examId)}/clone`, {
      method: "POST",
      body: JSON.stringify(title === undefined ? { id } : { id, title }),
    });
  }

  /** Put an exam away, or bring it back: only whether it is listed among current exams changes. */
  async archiveExam(examId: string, archived: boolean): Promise<void> {
    await this.#request(`/exams/${encodeURIComponent(examId)}/archived`, { method: "PUT", body: JSON.stringify({ archived }) });
  }

  // --- practice sites (ROADMAP §15) --------------------------------------------

  async practiceSite(): Promise<PracticeSiteSettings | null> {
    return (await this.#request<{ site: PracticeSiteSettings | null }>("/practice-admin/site")).site;
  }

  savePracticeSite(site: PracticeSiteSettings): Promise<PracticeSiteSettings> {
    return this.#request("/practice-admin/site", { method: "PUT", body: JSON.stringify(site) });
  }

  async practiceProblems(): Promise<readonly PracticeProblem[]> {
    return (await this.#request<{ problems: PracticeProblem[] }>("/practice-admin/problems")).problems;
  }

  publishProblem(input: { bankQuestionId: string; editorial?: string; difficulty?: Difficulty; title?: string }): Promise<PracticeProblem> {
    return this.#request("/practice-admin/problems", { method: "POST", body: JSON.stringify(input) });
  }

  updateProblem(id: string, patch: PracticeProblemPatch): Promise<PracticeProblem> {
    return this.#request(`/practice-admin/problems/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
  }

  async practiceContests(): Promise<readonly PracticeContest[]> {
    return (await this.#request<{ contests: PracticeContest[] }>("/practice-admin/contests")).contests;
  }

  saveContest(id: string | null, draft: PracticeContestDraft): Promise<PracticeContest> {
    return id === null
      ? this.#request("/practice-admin/contests", { method: "POST", body: JSON.stringify(draft) })
      : this.#request(`/practice-admin/contests/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(draft) });
  }

  practiceSignIn(): Promise<PracticeSignIn> {
    return this.#request<PracticeSignIn>("/practice-admin/sign-in");
  }

  savePracticeSignIn(settings: {
    readonly requireVerified: boolean;
    readonly google: { readonly enabled: boolean; readonly clientId: string | null; readonly clientSecret?: string };
  }): Promise<PracticeSignIn> {
    return this.#request<PracticeSignIn>("/practice-admin/sign-in", { method: "PUT", body: JSON.stringify(settings) });
  }

  practiceSimilarity(problemId: string): Promise<PracticeSimilarity> {
    return this.#request<PracticeSimilarity>(`/practice-admin/problems/${encodeURIComponent(problemId)}/similarity`);
  }

  // --- prep (ROADMAP §16) -----------------------------------------------------------

  async prepTracks(): Promise<readonly PrepTrack[]> {
    return (await this.#request<{ tracks: PrepTrack[] }>("/practice-admin/tracks")).tracks;
  }

  saveTrack(id: string | null, draft: PrepTrackDraft): Promise<PrepTrack> {
    return id === null
      ? this.#request("/practice-admin/tracks", { method: "POST", body: JSON.stringify(draft) })
      : this.#request(`/practice-admin/tracks/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(draft) });
  }

  async prepLessons(): Promise<readonly PrepLesson[]> {
    return (await this.#request<{ lessons: PrepLesson[] }>("/practice-admin/lessons")).lessons;
  }

  saveLesson(id: string | null, draft: PrepLessonDraft): Promise<PrepLesson> {
    return id === null
      ? this.#request("/practice-admin/lessons", { method: "POST", body: JSON.stringify(draft) })
      : this.#request(`/practice-admin/lessons/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(draft) });
  }

  potdSchedule(): Promise<{ readonly today: string; readonly days: readonly { readonly day: string; readonly problemId: string }[] }> {
    return this.#request("/practice-admin/potd");
  }

  async setPotd(day: string, problemId: string | null): Promise<void> {
    await this.#request(`/practice-admin/potd/${encodeURIComponent(day)}`, { method: "PUT", body: JSON.stringify({ problemId }) });
  }

  plusAdmin(): Promise<{ readonly settings: PlusSettings; readonly products: readonly PlusProduct[] }> {
    return this.#request("/practice-admin/plus");
  }

  savePlusSettings(settings: Partial<PlusSettings>): Promise<PlusSettings> {
    return this.#request("/practice-admin/plus", { method: "PUT", body: JSON.stringify(settings) });
  }

  savePlusProduct(id: string | null, draft: Omit<PlusProduct, "id" | "position">): Promise<PlusProduct> {
    return id === null
      ? this.#request("/practice-admin/plus/products", { method: "POST", body: JSON.stringify(draft) })
      : this.#request(`/practice-admin/plus/products/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(draft) });
  }

  async plusOrders(): Promise<readonly PlusOrder[]> {
    return (await this.#request<{ orders: PlusOrder[] }>("/practice-admin/plus/orders")).orders;
  }

  grantPlus(learnerId: string, days: number): Promise<{ readonly until: string }> {
    return this.#request(`/practice-admin/learners/${encodeURIComponent(learnerId)}/plus`, { method: "POST", body: JSON.stringify({ days }) });
  }

  async starterPacks(): Promise<readonly StarterPack[]> {
    return (await this.#request<{ packs: StarterPack[] }>("/practice-admin/starter-packs")).packs;
  }

  importStarterPack(name: StarterPack["name"]): Promise<{ readonly track: string; readonly lessons: number; readonly problems: number }> {
    return this.#request(`/practice-admin/starter-packs/${encodeURIComponent(name)}`, { method: "POST" });
  }

  async companies(): Promise<readonly StaffCompany[]> {
    return (await this.#request<{ companies: StaffCompany[] }>("/practice-admin/companies")).companies;
  }

  saveCompany(id: string | null, draft: { name: string; about: string }): Promise<Omit<StaffCompany, "reports">> {
    return this.#request(id === null ? "/practice-admin/companies" : `/practice-admin/companies/${encodeURIComponent(id)}`, { method: id === null ? "POST" : "PUT", body: JSON.stringify(draft) });
  }

  async reportProblems(companyId: string, problemIds: readonly string[], reportedOn: string): Promise<number> {
    return (
      await this.#request<{ added: number }>(`/practice-admin/companies/${encodeURIComponent(companyId)}/reports`, { method: "POST", body: JSON.stringify({ problemIds, reportedOn }) })
    ).added;
  }

  async deleteReport(id: string): Promise<void> {
    await this.#request(`/practice-admin/company-reports/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async experiences(status?: StaffExperience["status"]): Promise<readonly StaffExperience[]> {
    return (await this.#request<{ experiences: StaffExperience[] }>(`/practice-admin/experiences${status === undefined ? "" : `?status=${status}`}`)).experiences;
  }

  async decideExperience(id: string, status: "published" | "rejected"): Promise<void> {
    await this.#request(`/practice-admin/experiences/${encodeURIComponent(id)}/decision`, { method: "POST", body: JSON.stringify({ status }) });
  }

  async storeItems(): Promise<readonly StoreItem[]> {
    return (await this.#request<{ items: StoreItem[] }>("/practice-admin/store/items")).items;
  }

  saveStoreItem(id: string | null, draft: Omit<StoreItem, "id">): Promise<StoreItem> {
    return this.#request(id === null ? "/practice-admin/store/items" : `/practice-admin/store/items/${encodeURIComponent(id)}`, { method: id === null ? "POST" : "PUT", body: JSON.stringify(draft) });
  }

  async storeOrders(): Promise<readonly StoreOrder[]> {
    return (await this.#request<{ orders: StoreOrder[] }>("/practice-admin/store/orders")).orders;
  }

  async closeStoreOrder(id: string, status: "fulfilled" | "cancelled", note: string): Promise<void> {
    await this.#request(`/practice-admin/store/orders/${encodeURIComponent(id)}/close`, { method: "POST", body: JSON.stringify({ status, note }) });
  }

  async practiceLearners(): Promise<readonly PracticeLearner[]> {
    return (await this.#request<{ learners: PracticeLearner[] }>("/practice-admin/learners")).learners;
  }

  async practiceComments(): Promise<readonly PracticeComment[]> {
    return (await this.#request<{ comments: PracticeComment[] }>("/practice-admin/comments")).comments;
  }

  async replyInPractice(problemSlug: string, body: string): Promise<void> {
    await this.#request("/practice-admin/comments", { method: "POST", body: JSON.stringify({ problemSlug, body }) });
  }

  async hideComment(id: string, hidden: boolean): Promise<void> {
    await this.#request(`/practice-admin/comments/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ hidden }) });
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

  dashboard(): Promise<Dashboard> {
    return this.#request<Dashboard>("/dashboard");
  }

  /** Candidates across every exam matching `q` (at least two characters). */
  async searchCandidates(q: string): Promise<readonly CandidateHit[]> {
    return (await this.#request<{ candidates: CandidateHit[] }>(`/candidates/search?q=${encodeURIComponent(q)}`)).candidates;
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

  // --- integrations -----------------------------------------------------------

  async listWebhooks(): Promise<readonly Webhook[]> {
    return (await this.#request<{ webhooks: Webhook[] }>("/webhooks")).webhooks;
  }

  addWebhook(url: string, events: readonly string[], description: string): Promise<{ webhook: Webhook; secret: string }> {
    return this.#request("/webhooks", { method: "POST", body: JSON.stringify({ url, events, description }) });
  }

  async webhookSecret(id: string): Promise<string> {
    return (await this.#request<{ secret: string }>(`/webhooks/${encodeURIComponent(id)}/secret`)).secret;
  }

  rotateWebhook(id: string): Promise<{ webhook: Webhook; secret: string }> {
    return this.#request(`/webhooks/${encodeURIComponent(id)}/rotate`, { method: "POST" });
  }

  async disableWebhook(id: string): Promise<void> {
    await this.#request(`/webhooks/${encodeURIComponent(id)}/disable`, { method: "POST" });
  }

  async testWebhook(id: string): Promise<void> {
    await this.#request(`/webhooks/${encodeURIComponent(id)}/test`, { method: "POST" });
  }

  async webhookDeliveries(id: string): Promise<readonly WebhookDelivery[]> {
    return (await this.#request<{ deliveries: WebhookDelivery[] }>(`/webhooks/${encodeURIComponent(id)}/deliveries`)).deliveries;
  }

  async ltiPlatforms(): Promise<readonly LtiPlatform[]> {
    return (await this.#request<{ platforms: LtiPlatform[] }>("/lti/platforms")).platforms;
  }

  registerLti(platform: LtiPlatformInput): Promise<LtiPlatform> {
    return this.#request("/lti/platforms", { method: "POST", body: JSON.stringify(platform) });
  }

  updateLti(id: string, platform: LtiPlatformInput): Promise<LtiPlatform> {
    return this.#request(`/lti/platforms/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(platform) });
  }

  async atsConnectors(): Promise<readonly AtsConnector[]> {
    return (await this.#request<{ connectors: AtsConnector[] }>("/integrations/ats")).connectors;
  }

  saveAts(provider: AtsProvider, settings: Record<string, unknown>, credentials?: Record<string, string>): Promise<AtsConnector> {
    return this.#request(`/integrations/ats/${provider}`, {
      method: "PUT",
      body: JSON.stringify({ settings, ...(credentials === undefined ? {} : { credentials }) }),
    });
  }

  issueAtsHook(provider: AtsProvider): Promise<{ readonly key: string; readonly hookUrl: string }> {
    return this.#request(`/integrations/ats/${provider}/key`, { method: "POST" });
  }

  async disableAts(provider: AtsProvider): Promise<void> {
    await this.#request(`/integrations/ats/${provider}/disable`, { method: "POST" });
  }

  greenhouse(): Promise<{ enabled: boolean; endpoints: Record<string, string> }> {
    return this.#request("/integrations/greenhouse");
  }

  issueGreenhouseKey(): Promise<{ key: string; endpoints: Record<string, string> }> {
    return this.#request("/integrations/greenhouse/key", { method: "POST" });
  }

  async disableGreenhouse(): Promise<void> {
    await this.#request("/integrations/greenhouse/disable", { method: "POST" });
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
  proctoring(attemptId: string): Promise<ProctoringView> {
    return this.#request(`/attempts/${encodeURIComponent(attemptId)}/proctoring`);
  }

  /**
   * One photo, as an object URL for an <img>: the image needs the session's
   * bearer token, which an <img src> cannot send. Revoke it when done.
   */
  async photoUrl(attemptId: string, mediaId: string): Promise<string> {
    const response = await fetch(`${this.#baseUrl}/attempts/${encodeURIComponent(attemptId)}/proctoring/photos/${encodeURIComponent(mediaId)}`, {
      headers: { authorization: `Bearer ${this.#token}` },
    });
    if (!response.ok) throw new ConsoleError(response.status, "photo_unavailable");
    return URL.createObjectURL(await response.blob());
  }

  reviewIdentity(attemptId: string, outcome: "verified" | "rejected", reason: string): Promise<{ ok: true }> {
    return this.#request(`/attempts/${encodeURIComponent(attemptId)}/identity/review`, {
      method: "POST",
      body: JSON.stringify({ outcome, reason }),
    });
  }

  live(examId: string, idleMinutes = 5): Promise<LiveView> {
    return this.#request(`/exams/${encodeURIComponent(examId)}/live?idleMinutes=${idleMinutes}`);
  }

  billing(): Promise<BillingSummary> {
    return this.#request("/billing");
  }

  saveBillingDetails(details: BuyerDetails): Promise<BillingAccount> {
    return this.#request("/billing/details", { method: "PUT", body: JSON.stringify(details) });
  }

  createOrder(credits: number): Promise<BillingOrder> {
    return this.#request("/billing/orders", { method: "POST", body: JSON.stringify({ credits }) });
  }

  /** Checkout's result: credited only if the server finds Razorpay's signature good. */
  verifyPayment(orderId: string, paymentId: string, signature: string): Promise<{ credits: number; invoice: TaxInvoice }> {
    return this.#request("/billing/payments/verify", { method: "POST", body: JSON.stringify({ orderId, paymentId, signature }) });
  }

  invoice(id: string): Promise<TaxInvoice> {
    return this.#request(`/billing/invoices/${encodeURIComponent(id)}`);
  }

  privacy(): Promise<{ settings: PrivacySettings | null; notice: Notice | null }> {
    return this.#request("/privacy");
  }

  savePrivacy(settings: PrivacyDraft): Promise<{ settings: PrivacySettings; notice: Notice }> {
    return this.#request("/privacy", { method: "PUT", body: JSON.stringify(settings) });
  }

  /** Irreversible: destroys the attempt's data key. */
  eraseAttempt(attemptId: string): Promise<{ erased: boolean }> {
    return this.#request(`/attempts/${encodeURIComponent(attemptId)}/erase`, { method: "POST" });
  }

  announce(examId: string, message: string): Promise<Announcement> {
    return this.#request(`/exams/${encodeURIComponent(examId)}/announcements`, { method: "POST", body: JSON.stringify({ message }) });
  }

  reopen(attemptId: string, minutes: number, reason: string): Promise<{ expiresAt: number }> {
    return this.#request(`/attempts/${encodeURIComponent(attemptId)}/reopen`, { method: "POST", body: JSON.stringify({ minutes, reason }) });
  }

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

/** What candidates are told before they start, and how long their data is kept (ROADMAP §11). */
export interface PrivacyDraft {
  readonly controllerName: string;
  readonly grievanceName: string;
  readonly grievanceEmail: string;
  readonly purpose: string;
  readonly retentionDays: number;
}

export interface PrivacySettings extends PrivacyDraft {
  readonly noticeVersion: number;
  readonly updatedAt: string;
}

export interface Notice {
  readonly version: number;
  readonly hash: string;
  readonly controllerName: string;
  readonly purpose: string;
  readonly retentionDays: number;
  readonly grievance: { readonly name: string; readonly email: string };
  readonly collected: readonly string[];
  readonly rights: readonly string[];
}

/** Billing (ROADMAP §12). Amounts are paise. */
export interface BillingAccount {
  readonly mode: "prepaid" | "invoiced";
  readonly pricePaise: number;
  readonly credits: number;
  readonly legalName: string;
  readonly gstin: string | null;
  readonly stateCode: string | null;
  readonly address: string;
  readonly billingEmail: string | null;
  readonly updatedAt: string;
}

export type BuyerDetails = Pick<BillingAccount, "legalName" | "gstin" | "stateCode" | "address" | "billingEmail">;

export interface InvoiceSummary {
  readonly id: string;
  readonly number: string;
  readonly kind: "credits" | "usage" | "credit_note";
  /** For a credit note: the invoice it reduces. */
  readonly againstInvoice?: string | null;
  readonly paymentId: string | null;
  readonly period: string | null;
  readonly totalPaise: number;
  readonly issuedAt: string;
}

export interface TaxInvoice extends InvoiceSummary {
  readonly document: InvoiceDocument;
  /** The IRN and signed QR code from the Invoice Registration Portal, once recorded. */
  readonly eInvoice?: { readonly irn: string; readonly ackNo: string; readonly ackDate: string; readonly signedQr: string } | null;
}

export interface InvoiceDocument {
  readonly title: string;
  readonly number: string;
  readonly date: string;
  readonly supplier: { readonly legalName: string; readonly gstin: string; readonly address: string; readonly state: string; readonly stateCode: string };
  readonly buyer: { readonly legalName: string; readonly gstin: string | null; readonly address: string; readonly state: string | null; readonly stateCode: string | null };
  readonly placeOfSupply: { readonly code: string; readonly state: string };
  readonly reverseCharge: boolean;
  readonly lines: readonly { readonly description: string; readonly sac: string; readonly quantity: number; readonly ratePaise: number; readonly amountPaise: number }[];
  readonly taxablePaise: number;
  readonly taxes: readonly { readonly name: string; readonly ratePercent: number; readonly amountPaise: number }[];
  readonly totalPaise: number;
  readonly totalInWords: string;
  readonly note?: string;
  /** Section 194J: what the buyer deducts at source, and what is then payable. */
  readonly tds?: { readonly section: string; readonly ratePercent: number; readonly amountPaise: number; readonly netPayablePaise: number };
  /** A credit note: the invoice it reduces, and why. */
  readonly against?: { readonly number: string; readonly date: string };
  readonly reason?: string;
}

export interface BillingSummary {
  readonly account: BillingAccount | null;
  readonly history: readonly {
    readonly id: string;
    readonly delta: number;
    readonly reason: "purchase" | "attempt" | "grant" | "refund" | "payment_refund" | "refund_reversed";
    readonly attemptId: string | null;
    readonly paymentId: string | null;
    readonly note: string | null;
    readonly at: string;
  }[];
  readonly invoices: readonly InvoiceSummary[];
  readonly checkout: { readonly available: boolean; readonly keyId: string | null };
  readonly supplier: { readonly legalName: string; readonly stateCode: string } | null;
}

export interface BillingOrder {
  readonly orderId: string;
  readonly keyId: string;
  readonly currency: "INR";
  readonly credits: number;
  readonly taxablePaise: number;
  readonly taxPaise: number;
  readonly amountPaise: number;
  readonly supplierName: string;
}

// --- practice sites (ROADMAP §15) ---------------------------------------------------

export interface PracticeSiteSettings {
  readonly slug: string;
  readonly title: string;
  readonly welcome: string;
  readonly open: boolean;
}

export interface PracticeProblem {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly question: Question;
  readonly difficulty: Difficulty;
  readonly tags: readonly string[];
  readonly editorial: string;
  readonly fromBank: string | null;
  readonly position: number;
  readonly published: boolean;
  readonly updatedAt: string;
  readonly submissions: number;
  readonly solvedBy: number;
}

export interface PracticeProblemPatch {
  readonly title?: string;
  readonly slug?: string;
  readonly difficulty?: Difficulty;
  readonly tags?: readonly string[];
  readonly editorial?: string;
  readonly published?: boolean;
}

export interface PracticeContest {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly problemIds: readonly string[];
  readonly state: "upcoming" | "running" | "ended";
}

export interface PracticeContestDraft {
  readonly title: string;
  readonly description: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly problemIds: readonly string[];
}

export interface PracticeLearner {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly joinedAt: string;
  readonly solved: number;
  readonly submissions: number;
  readonly lastActiveAt: string | null;
}

export interface PracticeComment {
  readonly id: string;
  readonly problemId: string;
  readonly problemTitle: string;
  readonly problemSlug: string;
  readonly authorName: string;
  readonly fromStaff: boolean;
  readonly body: string;
  readonly createdAt: string;
  readonly hidden: boolean;
}

export interface PracticeSignIn {
  readonly requireVerified: boolean;
  readonly google: { readonly enabled: boolean; readonly clientId: string | null; readonly secretSet: boolean };
  /** Register this with Google; null until the site has an address. */
  readonly redirectUri: string | null;
}

export interface PracticeSimilarSide {
  readonly learnerId: string;
  readonly name: string;
  readonly language: string;
  readonly source: string;
  readonly status: string;
  readonly submittedAt: string;
}

export interface PracticeSimilarity {
  readonly problem: { readonly id: string; readonly title: string };
  readonly compared: number;
  readonly pairs: readonly { readonly a: PracticeSimilarSide; readonly b: PracticeSimilarSide; readonly similarity: number; readonly shared: number }[];
}

export type AtsProvider = "lever" | "zoho_recruit" | "darwinbox";

export interface AtsConnector {
  readonly provider: AtsProvider;
  readonly label: string;
  readonly configured: boolean;
  readonly enabled: boolean;
  readonly settings: Record<string, unknown>;
  readonly credentialsSet: boolean;
}

export interface LtiPlatformInput {
  readonly name: string;
  readonly issuer: string;
  readonly clientId: string;
  readonly deploymentIds: readonly string[];
  readonly authLoginUrl: string;
  readonly authTokenUrl: string;
  readonly jwksUrl: string;
  readonly enabled?: boolean;
}

export interface LtiPlatform extends LtiPlatformInput {
  readonly id: string;
  readonly enabled: boolean;
  readonly tool: { readonly toolUrl: string; readonly loginUrl: string; readonly redirectUrl: string; readonly jwksUrl: string; readonly customParameters: string };
}

// --- prep (ROADMAP §16) ---------------------------------------------------------------

export interface PrepTrack {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly position: number;
  readonly published: boolean;
  readonly updatedAt: string;
  readonly modules: readonly {
    readonly id: string;
    readonly title: string;
    readonly position: number;
    readonly items: readonly { readonly id: string; readonly position: number; readonly problemId: string | null; readonly lessonId: string | null }[];
  }[];
}

export interface PrepTrackDraft {
  readonly title: string;
  readonly slug?: string;
  readonly description: string;
  readonly published: boolean;
  readonly modules: readonly { readonly title: string; readonly items: readonly ({ readonly problemId: string } | { readonly lessonId: string })[] }[];
}

export interface PrepLesson {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly body: string;
  readonly videoUrl: string;
  readonly estMinutes: number;
  readonly published: boolean;
  readonly updatedAt: string;
}

export type PrepLessonDraft = Omit<PrepLesson, "id" | "slug" | "updatedAt"> & { readonly slug?: string };

export interface PlusSettings {
  readonly plusEnabled: boolean;
  readonly freeModules: number;
  readonly monthlyCredits: number;
  readonly tutorEnabled: boolean;
}

export interface PlusProduct {
  readonly id: string;
  readonly title: string;
  readonly kind: "plus" | "credits";
  readonly days: number;
  readonly credits: number;
  readonly pricePaise: number;
  readonly active: boolean;
  readonly position: number;
}

export interface PlusOrder {
  readonly id: string;
  readonly learnerId: string;
  readonly title: string;
  readonly days: number;
  readonly credits: number;
  readonly amountPaise: number;
  readonly taxPaise: number;
  readonly status: "created" | "paid";
  readonly createdAt: string;
  readonly paidAt: string | null;
}

export interface StarterPack {
  readonly name: "cs-fundamentals" | "sql-starter";
  readonly title: string;
  readonly description: string;
  readonly lessons: number;
  readonly problems: number;
  readonly imported: boolean;
}

export interface StaffCompany {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly about: string;
  readonly reports: readonly {
    readonly id: string;
    readonly problemId: string;
    readonly problemTitle: string;
    readonly reportedOn: string;
    readonly source: "staff" | "experience";
    readonly experienceId: string | null;
  }[];
}

export interface StaffExperience {
  readonly id: string;
  readonly learnerId: string;
  readonly company: { readonly slug: string; readonly name: string };
  readonly role: string;
  readonly interviewed: string;
  readonly verdict: "offer" | "reject" | "waiting";
  readonly rounds: readonly { readonly kind: string; readonly asked: string; readonly problemSlugs: readonly string[]; readonly problems?: readonly { readonly slug: string; readonly title: string }[] }[];
  readonly tips: string;
  readonly author: string;
  readonly status: "pending" | "published" | "rejected";
  readonly votes: number;
  readonly at: string;
}

export interface StoreItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly kind: "plus" | "digital" | "physical";
  readonly plusDays: number;
  readonly priceCoins: number;
  /** Null: no limit. */
  readonly stock: number | null;
  readonly perLearner: number;
  readonly active: boolean;
}

export interface StoreOrder {
  readonly id: string;
  readonly itemId: string;
  readonly title: string;
  readonly priceCoins: number;
  readonly address: string;
  readonly status: "placed" | "fulfilled" | "cancelled";
  readonly note: string;
  readonly createdAt: string;
  readonly closedAt: string | null;
  readonly learnerId: string;
  readonly learnerName: string;
  readonly learnerEmail: string;
}
