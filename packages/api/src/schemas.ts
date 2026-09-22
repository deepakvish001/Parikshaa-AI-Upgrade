import { z } from "zod";

/**
 * The HTTP contract, as schemas.
 *
 * These do three jobs. They validate requests, they generate the OpenAPI
 * document institutions integrate against, and — the reason the response
 * schemas are here at all — they validate what goes *out*.
 *
 * That last one matters for a specific reason. The candidate-facing responses
 * must never carry an exam's answer key, and `candidateView` already makes that
 * impossible to express in the type system. A response schema enforces the same
 * boundary at runtime, on the wire, where a future change that slipped past the
 * types would still be caught.
 */

const hash = z.string().regex(/^[0-9a-f]{64}$/, "a 64-character hex hash");

// --- shared ----------------------------------------------------------------

export const errorResponse = z
  .object({
    error: z.string(),
    message: z.string().optional(),
  })
  .describe("A failed request. `error` is a stable code; `message` is for people.");

export const examProblems = z.object({
  error: z.literal("invalid_exam"),
  problems: z.array(z.object({ path: z.string(), message: z.string() })),
});

// --- exam definition (institution side) ------------------------------------

const rubricCriterion = z.object({
  id: z.string().min(1),
  description: z.string(),
  weight: z.number(),
});

const questionBase = {
  id: z.string().min(1),
  stem: z.string(),
  maxScore: z.number(),
  rubric: z.array(rubricCriterion).readonly(),
};

const kinds = {
  mcq: { kind: z.literal("mcq"), options: z.array(z.string()).readonly(), correctIndex: z.number() },
  short: { kind: z.literal("short"), expectedPoints: z.array(z.string()).readonly() },
  numeric: { kind: z.literal("numeric"), expected: z.number(), tolerance: z.number() },
  code: { kind: z.literal("code"), language: z.string(), starter: z.string().optional() },
};

/** A question, answer key included. Staff-side only. */
export const questionSchema = z.discriminatedUnion("kind", [
  z.object({ ...questionBase, ...kinds.mcq }),
  z.object({ ...questionBase, ...kinds.short }),
  z.object({ ...questionBase, ...kinds.numeric }),
  z.object({ ...questionBase, ...kinds.code }),
]);

/** The same, before the bank has given it an id. */
const { id: _unused, ...questionBody } = questionBase;
export const newQuestionSchema = z.discriminatedUnion("kind", [
  z.object({ ...questionBody, ...kinds.mcq }),
  z.object({ ...questionBody, ...kinds.short }),
  z.object({ ...questionBody, ...kinds.numeric }),
  z.object({ ...questionBody, ...kinds.code }),
]);

export const examSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  policy: z.object({
    durationMs: z.number(),
    allowRevision: z.boolean(),
    vivaTriggerRatio: z.number(),
  }),
  questions: z.array(questionSchema).readonly().describe("Given to every candidate."),
  sections: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string(),
        pick: z.number().describe("How many of the pool each candidate draws."),
        pool: z.array(questionSchema).readonly(),
      }),
    )
    .readonly()
    .optional()
    .describe(
      "Questions drawn per candidate, seeded by the attempt, so neighbours sit different papers. Each candidate's paper is recorded in their ledger.",
    ),
});

export const cloneExamBody = z.object({
  id: z.string().min(1).describe("The copy's id. Must not already exist."),
  title: z.string().optional().describe('Defaults to the original\'s title with " (copy)".'),
});

// --- the question bank -------------------------------------------------------

const difficulty = z.enum(["easy", "medium", "hard"]);

export const bankEntry = z.object({
  id: z.string(),
  question: questionSchema,
  topic: z.string(),
  difficulty,
  tags: z.array(z.string()).readonly(),
  updatedAt: z.string(),
  archived: z.boolean(),
});

export const bankQuery = z.object({
  topic: z.string().optional(),
  difficulty: difficulty.optional(),
  tag: z.string().optional(),
  q: z.string().optional().describe("Matched against the question's text."),
});

export const bankListResponse = z.object({
  questions: z.array(bankEntry).readonly(),
  topics: z.array(z.string()).readonly(),
});

export const bankDraftBody = z.object({
  question: newQuestionSchema,
  topic: z.string().default(""),
  difficulty: difficulty.default("medium"),
  tags: z.array(z.string()).readonly().default([]),
});

export const bankParams = z.object({ questionId: z.string().min(1) });

export const bankImportBody = z.object({
  csv: z.string().max(5_000_000).describe("The file's contents. See the import format in the description."),
});

export const bankImportResponse = z.object({ imported: z.number() });

export const bankImportProblems = z.object({
  error: z.literal("invalid_import"),
  problems: z.array(z.object({ row: z.number(), message: z.string() })).readonly(),
});

export const examListResponse = z.object({
  exams: z.array(z.object({ id: z.string(), title: z.string(), questionCount: z.number() })).readonly(),
});

export const attemptListResponse = z.object({
  attempts: z.array(
    z.object({
      id: z.string(),
      candidateId: z.string(),
      lastSeenAt: z
        .string()
        .nullable()
        .describe("When the candidate's page last checked in. Pages check in every 30 seconds while open."),
      entries: z.number(),
      state: z.enum(["in_progress", "submitted", "graded", "void"]),
    }),
  ).readonly(),
});

export const startAttemptBody = z.object({ candidateId: z.string().min(1) });

export const startAttemptResponse = z.object({
  attemptId: z.string(),
  token: z.string().describe("The candidate's access code. Grants this one attempt, and expires."),
  expiresInSeconds: z.number(),
});

export const gradeResponse = z.object({ total: z.number() });

export const voidBody = z.object({
  reason: z
    .string()
    .min(1)
    .describe("Recorded in the ledger and shown to the candidate. A short reason is rejected."),
});

const verdict = z.enum(["consistent", "shallow", "inconsistent", "inconclusive"]);

export const assessmentResponse = z.object({
  probeId: z.string(),
  verdict,
  confidence: z.number(),
  reasoning: z.string(),
});

export const reviewResponse = z
  .object({
    state: z.string(),
    total: z.number().nullable(),
    voidReason: z.string().nullable(),
    voidedBy: z
      .object({ userId: z.string(), name: z.string() })
      .nullable()
      .describe("The member of staff who set the attempt aside."),
    vivas: z.array(
      z.object({
        probeId: z.string(),
        questionId: z.string(),
        prompt: z.string(),
        rationale: z.string(),
        reply: z.string().nullable(),
        latencyMs: z.number().nullable(),
        verdict: verdict.nullable(),
        confidence: z.number().nullable(),
        reasoning: z.string().nullable(),
      }),
    ),
  })
  .describe("The grade and, separately, the provenance evidence. A verdict never moves a score.");

// --- candidate side --------------------------------------------------------

/**
 * The exam as a candidate may see it.
 *
 * Note what is absent and must stay absent: `correctIndex`, `expected`,
 * `tolerance`, `expectedPoints`, `rubric`, and the policy's
 * `vivaTriggerRatio`. Serialization strips unknown keys, so this schema is a
 * second lock on the same door `candidateView` closes.
 */
const candidateQuestion = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    kind: z.literal("mcq"),
    stem: z.string(),
    maxScore: z.number(),
    options: z.array(z.string()).readonly(),
  }),
  z.object({ id: z.string(), kind: z.literal("short"), stem: z.string(), maxScore: z.number() }),
  z.object({ id: z.string(), kind: z.literal("numeric"), stem: z.string(), maxScore: z.number() }),
  z.object({
    id: z.string(),
    kind: z.literal("code"),
    stem: z.string(),
    maxScore: z.number(),
    language: z.string(),
    starter: z.string().nullable(),
  }),
]);

export const candidateStateResponse = z.object({
  attemptId: z.string(),
  exam: z.object({
    id: z.string(),
    title: z.string(),
    durationMs: z.number(),
    allowRevision: z.boolean(),
    questions: z.array(candidateQuestion).readonly(),
  }),
  state: z.enum(["created", "in_progress", "submitted", "graded", "void"]),
  voidReason: z.string().nullable(),
  startedAt: z.number(),
  expiresAt: z.number().describe("When this attempt's window closes. Exam time, not a probe timer."),
  answers: z
    .array(z.object({ questionId: z.string(), answer: z.string(), submittedAt: z.number() }))
    .readonly(),
  openProbe: z
    .object({ id: z.string(), prompt: z.string() })
    .nullable()
    .describe("By prompt alone: a probe's rationale records the score that triggered it."),
  answeredProbeCount: z.number(),
  drafts: z
    .array(z.object({ questionId: z.string(), answer: z.string(), savedAt: z.number() }))
    .readonly()
    .describe("Typed but not yet committed, where that differs from the committed answer. Restored on resume."),
});

export const draftParams = z.object({ questionId: z.string().min(1) });

export const draftBody = z
  .object({ answer: z.string().max(100_000) })
  .describe("The text so far. Kept by the server, not written to the ledger until committed.");

export const heartbeatResponse = z.object({
  state: z.enum(["created", "in_progress", "submitted", "graded", "void"]),
  expiresAt: z.number().describe("The deadline as it now stands, extensions included."),
});

export const extendBody = z.object({
  minutes: z.number().int().min(1).max(240),
  reason: z.string().min(1).describe("Recorded in the attempt's ledger with who granted it."),
});

export const extendResponse = z.object({ expiresAt: z.number() });

export const answerBody = z.object({ questionId: z.string().min(1), answer: z.string() });

export const replyBody = z
  .object({ reply: z.string().min(1) })
  .describe("The reply alone. Latency is measured on the server and is not accepted from a client.");

export const replyResponse = z.object({ ok: z.boolean(), latencyMs: z.number() });

export const okResponse = z.object({ ok: z.boolean() });

export const ledgerResponse = z
  .object({
    head: hash.nullable(),
    length: z.number(),
    sealed: z.boolean().describe("False while the attempt is open, when only the head hash is released."),
    entries: z
      .array(
        z.object({
          seq: z.number(),
          timestamp: z.number(),
          type: z.string(),
          event: z.unknown(),
          prevHash: z.string(),
          hash,
        }),
      )
      .nullable(),
  })
  .describe(
    "The candidate's own record. While the attempt is open this is the head hash alone — pin it now, verify the chain once the attempt closes.",
  );

// --- path parameters -------------------------------------------------------

export const examParams = z.object({ examId: z.string().min(1) });
export const attemptParams = z.object({ attemptId: z.string().min(1) });
export const probeParams = z.object({ attemptId: z.string().min(1), probeId: z.string().min(1) });
export const candidateProbeParams = z.object({ probeId: z.string().min(1) });

// --- accounts and administration --------------------------------------------

const staffRole = z.enum(["owner", "author", "invigilator", "reviewer", "viewer"]);
const apiKeyRole = z.enum(["author", "invigilator", "reviewer", "viewer"]);

export const staffUser = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: staffRole,
  disabled: z.boolean(),
});

export const loginBody = z.object({
  email: z.string().min(3),
  password: z.string().min(1),
});

export const loginResponse = z.object({
  token: z.string().describe("A staff session token. Send as `Authorization: Bearer`; shown once."),
  expiresAt: z.string(),
  user: staffUser,
});

export const whoAmIResponse = z.object({
  kind: z.enum(["user", "api_key"]),
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  role: staffRole,
  organisation: z.object({ id: z.string(), name: z.string() }),
  permissions: z.array(z.string()).readonly(),
});

export const changePasswordBody = z.object({
  current: z.string().min(1),
  next: z.string().min(1).describe("At least 12 characters. Every session, this one included, ends."),
});

export const staffListResponse = z.object({ users: z.array(staffUser).readonly() });

export const createStaffBody = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: staffRole,
  password: z.string().min(1).describe("An initial password for the person to change on first sign-in."),
});

export const staffParams = z.object({ userId: z.string().min(1) });

export const updateStaffBody = z.object({ role: staffRole });

export const apiKey = z.object({
  id: z.string(),
  name: z.string(),
  role: apiKeyRole,
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  revoked: z.boolean(),
});

export const apiKeyListResponse = z.object({ keys: z.array(apiKey).readonly() });

export const createApiKeyBody = z.object({
  name: z.string().min(1),
  role: apiKeyRole.describe("An API key cannot be an owner, and cannot void an attempt whatever its role."),
});

export const createApiKeyResponse = z.object({
  id: z.string(),
  secret: z.string().describe("The key itself. Shown once and stored only as a digest."),
});

export const apiKeyParams = z.object({ keyId: z.string().min(1) });

const routeUsage = z.object({
  route: z.enum(["probe", "assess", "grade"]),
  calls: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  cacheReadTokens: z.number(),
  cacheWrite5mTokens: z.number(),
  cacheWrite1hTokens: z.number(),
  costMicroUsd: z.number(),
});

export const usageQuery = z.object({
  since: z.iso.datetime().optional().describe("Defaults to the start of this calendar month (UTC)."),
});

export const usageResponse = z
  .object({
    since: z.string(),
    totalCostMicroUsd: z.number(),
    routes: z.array(routeUsage).readonly(),
    perAttempt: z.object({
      attempts: z.number(),
      p50MicroUsd: z.number().nullable(),
      p90MicroUsd: z.number().nullable(),
      maxMicroUsd: z.number().nullable(),
    }),
    inferenceGeos: z.array(z.object({ geo: z.string().nullable(), calls: z.number() })).readonly(),
    monthStartedAt: z.string(),
    spentThisMonthMicroUsd: z.number(),
    monthlyCapMicroUsd: z.number().nullable(),
  })
  .describe("Model spend, in micro-dollars (1,000,000 = US$1). Per-attempt percentiles are what pricing is built on.");

export const spendCapBody = z.object({
  monthlyCapMicroUsd: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe("A soft monthly ceiling on model spend, in micro-dollars. Null removes it."),
});

export const auditQuery = z.object({ limit: z.coerce.number().int().min(1).max(500).optional() });

export const auditResponse = z.object({
  entries: z
    .array(
      z.object({
        at: z.string(),
        actorKind: z.enum(["user", "api_key", "system"]),
        actorId: z.string().nullable(),
        action: z.string(),
        target: z.string().nullable(),
        detail: z.record(z.string(), z.unknown()),
      }),
    )
    .readonly(),
});
