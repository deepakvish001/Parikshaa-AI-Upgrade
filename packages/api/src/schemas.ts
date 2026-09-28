import { z } from "zod";
import { CONTENT_LOCALES, VALUE_TYPES } from "@parikshaa/core";

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

/** Camera proctoring for an exam (ROADMAP §14). */
export const proctoringPolicy = z.object({
  identity: z.boolean().describe("A photo of the candidate and of their photo ID before they begin, checked by an invigilator."),
  snapshotEverySeconds: z.number().int().nullable().describe("A webcam photo this often while the attempt is open; null for none."),
  browserEvents: z.boolean().describe("Record leaving the tab or full screen, and copying or pasting."),
});

/** A question in other languages, by locale (ROADMAP §9): what a candidate reads, and nothing else. */
const translations = z
  .partialRecord(z.enum(CONTENT_LOCALES), z.object({ stem: z.string(), options: z.array(z.string()).readonly().optional() }))
  .describe("The question in other languages. An mcq's options come in the original's order: the answer is recorded by position.");

/** A picture with a question or passage, named by the SHA-256 it was uploaded under (`POST /media`). */
const questionImage = z.object({
  media: z.string().describe("SHA-256 of the picture, from POST /media. Served at /api/media/<sha256>."),
  alt: z.string().describe("What the picture shows, for a screen reader."),
});

const passage = z
  .object({
    id: z.string().describe("Shared by every question about this passage."),
    title: z.string().optional(),
    text: z.string(),
    images: z.array(questionImage).readonly().optional(),
  })
  .describe("A passage several questions are about: comprehension, a data set, a case.");

const valueType = z.enum(VALUE_TYPES);

const signature = z
  .object({
    name: z.string(),
    params: z.array(z.object({ name: z.string(), type: valueType })).readonly(),
    returns: valueType,
    anyOrder: z.enum(["none", "top", "deep"]).optional().describe("Whether a returned array may be in any order: not at all, at the top level, or at every level."),
    tolerance: z.number().optional().describe("How far a returned number may be from the expected one."),
  })
  .describe("The function a candidate writes. Starters and the program that calls it are generated for every language.");

const codeChecker = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("exact") }),
    z.object({ kind: z.literal("tokens") }),
    z.object({ kind: z.literal("numbers"), tolerance: z.number() }),
    z.object({ kind: z.literal("unordered") }),
    z.object({ kind: z.literal("custom"), source: z.string().describe("Python 3, run as checker.py input expected output; exit 0 accepts, 1 rejects.") }),
  ])
  .describe("How a program's output is judged, when not exactly.");

const questionBase = {
  id: z.string().min(1),
  stem: z.string(),
  maxScore: z.number(),
  rubric: z.array(rubricCriterion).readonly(),
  translations: translations.optional(),
  images: z.array(questionImage).readonly().optional().describe("Pictures shown with the stem."),
  passage: passage.optional(),
};

const negativeMarks = z.number().optional().describe("Marks taken away for a wrong answer. Leaving it unanswered costs nothing.");

const kinds = {
  mcq: {
    kind: z.literal("mcq"),
    options: z.array(z.string()).readonly(),
    correctIndex: z.number().describe("The right option; with correctIndices, the first of them."),
    correctIndices: z
      .array(z.number())
      .readonly()
      .optional()
      .describe("Several right options: the candidate chooses every one, and answers with their positions, comma-separated."),
    partialCredit: z.boolean().optional().describe("With several right options: a share for each right one chosen, if no wrong one is."),
    negativeMarks,
  },
  short: { kind: z.literal("short"), expectedPoints: z.array(z.string()).readonly() },
  numeric: { kind: z.literal("numeric"), expected: z.number(), tolerance: z.number(), negativeMarks },
  code: {
    kind: z.literal("code"),
    language: z.string().describe("The default language: python, javascript, c, cpp or java."),
    languages: z.array(z.string()).readonly().optional().describe("Languages the candidate may choose between."),
    starter: z.string().optional().describe("Starter code for every language without one in `starters`."),
    starters: z.record(z.string(), z.string()).optional().describe("Starter code by language. A function question's are written from its signature."),
    signature: signature.optional().describe("A function question: the candidate writes this function, and Parikshaa calls it. Absent: a whole program reading standard input."),
    checker: codeChecker.optional().describe("How output is judged; exactly, when absent."),
    inputFormat: z.string().optional().describe("Markdown."),
    outputFormat: z.string().optional().describe("Markdown."),
    constraints: z.string().optional().describe("Markdown."),
    tests: z
      .array(
        z.object({
          id: z.string().min(1),
          input: z.string().describe("Standard input; for a function question, one JSON value per parameter, a line each."),
          expected: z.string().describe("Standard output; for a function question, the JSON value returned."),
          hidden: z.boolean().describe("Hidden tests decide the score and never reach the candidate."),
          weight: z.number(),
          explanation: z.string().optional().describe("Why, under a visible test shown as a worked example. Markdown."),
        }),
      )
      .readonly()
      .optional()
      .describe("When present, the answer is scored by running these rather than by a rubric grader."),
    limits: z.object({ timeMs: z.number().optional(), memoryMb: z.number().optional() }).optional(),
  },
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
    proctoring: proctoringPolicy.optional().describe("Camera proctoring. Absent: none."),
    testFeedback: z
      .enum(["all", "visible"])
      .optional()
      .describe("What Submit tells a candidate about their code: every test's verdict, hidden ones without their content (all, the default), or the visible tests' only."),
    codeCompletion: z.boolean().optional().describe("Offer completion in the code editor. Off by default."),
  }),
  questions: z.array(questionSchema).readonly().describe("Given to every candidate."),
  sections: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string(),
        pick: z.number().describe("How many of the pool each candidate draws."),
        pool: z.array(questionSchema).readonly(),
        durationMs: z
          .number()
          .optional()
          .describe("The section's own time. When any section has one, sections are taken in order and locked once left."),
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

export const bankDocxBody = z.object({
  file: z.string().max(14_000_000).describe("The .docx file, base64-encoded. At most 10 MB."),
  dryRun: z.boolean().default(false).describe("Check and preview the questions without adding them to the bank."),
});

export const bankDocxResponse = z.object({
  imported: z.number().describe("Questions added to the bank; 0 on a dry run."),
  preview: z
    .array(
      z.object({
        question: z.number().describe("Which question, counting from the top of the document"),
        kind: z.string(),
        stem: z.string(),
        marks: z.number(),
        pictures: z.number().describe("Pictures taken with it, from the question and its passage"),
        passage: z.string().nullable().describe("The passage it is about, by title or first words"),
        note: z.string().nullable().describe("Something in the question that was not imported, such as an equation"),
      }),
    )
    .readonly(),
});

export const bankDocxProblems = z.object({
  error: z.literal("invalid_import"),
  problems: z
    .array(
      z.object({
        question: z.number().describe("Which question, counting from the top of the document; 0 for the file as a whole"),
        written: z.number().nullable().describe("The number written on it, which may restart in each section of a paper"),
        message: z.string(),
      }),
    )
    .readonly(),
});

export const examListResponse = z.object({
  exams: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        questionCount: z.number(),
        createdAt: z.string(),
        totalMarks: z.number().nullable().describe("Marks on the paper: each section counted at its draw of its first question's marks."),
        sectionCount: z.number(),
        durationMs: z.number().nullable(),
        proctored: z.boolean(),
        attempts: z
          .object({ invited: z.number(), inProgress: z.number(), submitted: z.number(), graded: z.number(), void: z.number() })
          .describe("Invitations not revoked, and attempts by where they stand."),
      }),
    )
    .readonly(),
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
const shown = {
  images: z.array(questionImage).readonly(),
  passage: passage.nullable(),
};
export const candidateQuestion = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    kind: z.literal("mcq"),
    stem: z.string(),
    maxScore: z.number(),
    options: z.array(z.string()).readonly(),
    multiple: z.boolean().describe("Choose every right option rather than one; answer with their positions, comma-separated."),
    negativeMarks: z.number().describe("Marks lost for a wrong answer; 0 for none."),
    translations,
    ...shown,
  }),
  z.object({ id: z.string(), kind: z.literal("short"), stem: z.string(), maxScore: z.number(), translations, ...shown }),
  z.object({
    id: z.string(),
    kind: z.literal("numeric"),
    stem: z.string(),
    maxScore: z.number(),
    negativeMarks: z.number().describe("Marks lost for a wrong answer; 0 for none."),
    translations,
    ...shown,
  }),
  z.object({
    id: z.string(),
    kind: z.literal("code"),
    stem: z.string(),
    maxScore: z.number(),
    translations,
    ...shown,
    language: z.string(),
    languages: z.array(z.string()).readonly(),
    starter: z.string().nullable(),
    starters: z.record(z.string(), z.string()).describe("Starter code by language."),
    function: z
      .object({ name: z.string(), params: z.array(z.object({ name: z.string(), type: valueType })).readonly(), returns: valueType })
      .nullable()
      .describe("The function to write, for a function question. Null: write a whole program that reads standard input."),
    inputFormat: z.string().nullable(),
    outputFormat: z.string().nullable(),
    constraints: z.string().nullable(),
    samples: z
      .array(z.object({ input: z.string(), output: z.string(), explanation: z.string().nullable() }))
      .readonly()
      .describe("The visible tests, as worked examples."),
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
    proctoring: proctoringPolicy.nullable().describe("What the camera and browser are asked for. Null: nothing."),
    testFeedback: z.enum(["all", "visible"]).describe("What Submit reports about hidden tests."),
    codeCompletion: z.boolean().describe("Whether the code editor offers completion."),
  }),
  state: z.enum(["created", "in_progress", "submitted", "graded", "void"]),
  identityCaptured: z.boolean().describe("A proctored exam's identity photos have been taken; until then its questions wait."),
  parts: z
    .array(
      z.object({
        sectionId: z.string().nullable().describe("Null: the exam's fixed questions, taken first."),
        title: z.string(),
        durationMs: z.number().nullable(),
        questionIds: z.array(z.string()).readonly(),
        state: z.enum(["done", "current", "upcoming"]),
        endsAt: z.number().nullable().describe("When the current part's own time is up."),
      }),
    )
    .readonly()
    .nullable()
    .describe("A sectioned exam's parts, in order. Null: every question is open at once."),
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
  announcements: z.number().describe("How many announcements this sitting has had; fetch them when it goes up."),
});

export const extendBody = z.object({
  minutes: z.number().int().min(1).max(240),
  reason: z.string().min(1).describe("Recorded in the attempt's ledger with who granted it."),
});

export const extendResponse = z.object({ expiresAt: z.number() });

export const answerBody = z.object({ questionId: z.string().min(1), answer: z.string() });

export const runBody = z.object({
  questionId: z.string().min(1),
  language: z.string().min(1),
  source: z.string().max(256 * 1024),
  input: z
    .string()
    .max(1024 * 1024)
    .optional()
    .describe("Run on this input instead of the question's examples."),
});

const testStatus = z.enum(["passed", "wrong_answer", "time_limit", "memory_limit", "runtime_error", "output_limit", "checker_error"]);

export const runResponse = z
  .discriminatedUnion("compiled", [
    z.object({ compiled: z.literal(false), compileOutput: z.string() }),
    z.object({
      compiled: z.literal(true),
      results: z
        .array(
          z.object({
            input: z.string(),
            expectedOutput: z.string().nullable(),
            status: z.union([testStatus, z.literal("ran")]),
            stdout: z.string().describe("What the program printed. For a function question, what the candidate's code printed along the way."),
            result: z.string().nullable().describe("For a function question: what the function returned, as JSON. Null otherwise, or when it returned nothing."),
            stderr: z.string(),
            timeMs: z.number(),
            memoryKb: z.number().nullable().describe("Peak memory; null when it could not be measured."),
            checkerMessage: z.string().nullable().describe("What the question's own checker said, if it has one."),
          }),
        )
        .readonly(),
    }),
  ])
  .describe("The examples only. Hidden tests are never run on request.");

export const submitCodeBody = z.object({
  questionId: z.string().min(1),
  language: z.string().min(1),
  source: z.string().max(256 * 1024),
});

const submittedTest = z.object({
  number: z.number().describe("The test's position among the question's tests, from 1."),
  visible: z.boolean().describe("A visible test, shown in full; otherwise hidden, and reduced to its verdict."),
  status: testStatus,
  timeMs: z.number(),
  memoryKb: z.number().nullable(),
  input: z.string().nullable().describe("A visible test's input. Null for a hidden test, whose content never reaches the candidate."),
  expectedOutput: z.string().nullable(),
  stdout: z.string().nullable(),
  result: z.string().nullable(),
  stderr: z.string().nullable(),
});

export const submitCodeResponse = z
  .union([
    z.object({ tested: z.literal(false), reason: z.enum(["no_tests", "runner_unavailable"]) }),
    z.object({ tested: z.literal(true), compiled: z.literal(false), compileOutput: z.string() }),
    z.object({
      tested: z.literal(true),
      compiled: z.literal(true),
      passed: z.number().nullable().describe("Tests passed, hidden included; null when the exam reports only the visible ones."),
      total: z.number().nullable(),
      cases: z.array(submittedTest).readonly(),
    }),
  ])
  .describe("The answer is committed either way. What was found running it against the question's tests, as much as the exam tells.");

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
  code: z.string().max(32).optional().describe("The second factor, when the account has one: six digits from the authenticator app, or a recovery code."),
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
  mustEnrol2fa: z
    .boolean()
    .describe("The organisation requires owners to use a second factor and this account has none: nothing else is allowed until it does."),
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

export const mediaUploadBody = z.object({
  image: z.string().max(2_800_000).describe("The picture, base64: PNG, JPEG, GIF or WebP, at most 2 MB."),
});

export const mediaUploadResponse = z.object({
  media: z.string().describe("Its SHA-256: name it in a question's images."),
  url: z.string().describe("Where it is served, to anyone with the hash."),
});

export const mediaParams = z.object({ sha256: z.string() });

// --- password reset, a second factor, single sign-on (ROADMAP §1) --------------

export const resetRequestBody = z.object({ email: z.string().min(3).max(320) });

export const resetConfirmBody = z.object({
  token: z.string().min(10).max(200).describe("From the reset link."),
  password: z.string().min(1).describe("At least 12 characters."),
});

export const twoFactorStatus = z.object({
  enabled: z.boolean(),
  recoveryCodesLeft: z.number().int(),
  required: z.boolean().describe("This account is an owner and the organisation requires owners to use one."),
});

export const twoFactorSetup = z.object({
  secret: z.string().describe("Base32, for typing into an authenticator app."),
  uri: z.string().describe("The `otpauth://` URI, to show as a QR code."),
});

export const twoFactorCode = z.object({ code: z.string().min(6).max(32) });

export const recoveryCodes = z.object({ recoveryCodes: z.array(z.string()).readonly() });

export const twoFactorDisable = z.object({ password: z.string().min(1), code: z.string().min(6).max(32) });

export const orgSecurityBody = z.object({ requireOwner2fa: z.boolean() });

export const ssoSettings = z.object({
  configured: z.boolean(),
  issuer: z.string().nullable(),
  clientId: z.string().nullable(),
  emailDomains: z.array(z.string()).readonly(),
  enforced: z.boolean(),
  enabled: z.boolean(),
  redirectUri: z.string().describe("Register this with the provider as the redirect URI."),
});

export const ssoSettingsBody = z.object({
  issuer: z.string().url().describe("The provider's issuer, e.g. https://accounts.google.com or https://login.microsoftonline.com/<tenant>/v2.0"),
  clientId: z.string().min(1).max(500),
  clientSecret: z.string().min(1).max(2000).optional().describe("Leave out to keep the one already set."),
  emailDomains: z.array(z.string().min(1).max(253)).max(20),
  enforced: z.boolean().describe("Staff other than owners may then sign in only through the provider."),
  enabled: z.boolean(),
});

export const ssoStartParams = z.object({ orgId: z.string().min(1).max(100) });
export const ssoStartQuery = z.object({ email: z.string().max(320).optional() });
export const ssoCallbackQuery = z.object({
  code: z.string().max(4000).optional(),
  state: z.string().max(4000).optional(),
  error: z.string().max(200).optional(),
});
