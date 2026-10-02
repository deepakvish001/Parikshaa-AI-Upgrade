import type {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { attemptId, examId } from "@parikshaa/core";
import type { ResultsService } from "./results.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";
import { xlsx, type Cell } from "./xlsx.js";

type Routes = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export interface ResultsRouteDeps {
  readonly results: ResultsService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const RESULTS = ["Results"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse } as const;

const verdicts = z.object({
  consistent: z.number().optional(),
  shallow: z.number().optional(),
  inconsistent: z.number().optional(),
  inconclusive: z.number().optional(),
});
const result = z.object({
  attemptId: z.string(),
  candidateId: z.string(),
  state: z.string(),
  total: z.number().nullable(),
  maxTotal: z.number(),
  percent: z.number().nullable(),
  startedAt: z.number(),
  submittedAt: z.number().nullable(),
  durationMs: z.number().nullable(),
  scores: z.record(z.string(), z.object({ score: z.number(), max: z.number() })),
  probes: z.object({ asked: z.number(), replied: z.number(), verdicts }),
  voidReason: z.string().nullable(),
  sections: z
    .array(z.object({ id: z.string(), title: z.string(), score: z.number().nullable(), max: z.number(), percent: z.number().nullable() }))
    .readonly()
    .describe('Marks by part of the paper, for an exam with sections; "" is the fixed questions.'),
  outcome: z.enum(["qualified", "failed"]).nullable().describe("Against the exam's cut-off, once graded; null without one."),
  paper: z.literal(true).optional().describe("Marks from a handwritten copy checked here; its attemptId is `paper:<copy>` and it has no scorecard."),
});
const similaritySide = z.object({ attemptId: z.string(), ref: z.string(), name: z.string(), language: z.string(), source: z.string() });
const similarityResponse = z.object({
  exam: z.object({ id: z.string(), title: z.string() }),
  questions: z
    .array(
      z.object({
        id: z.string(),
        stem: z.string(),
        answered: z.number(),
        pairs: z
          .array(
            z.object({
              a: similaritySide,
              b: similaritySide,
              similarity: z.number().describe("Shared fingerprints over the shorter answer's, 0–1."),
              shared: z.number(),
            }),
          )
          .readonly(),
      }),
    )
    .readonly(),
});

/** The exam, with its qualifying mark for the charts to draw. */
const examHead = z.object({
  id: z.string(),
  title: z.string(),
  cutoff: z
    .object({ percent: z.number(), sections: z.record(z.string(), z.number()).optional() })
    .nullable()
    .describe("The qualifying mark, overall and per section, as percentages; null without one."),
});

const resultsResponse = z.object({
  exam: examHead,
  rows: z.array(result.extend({ ref: z.string(), name: z.string(), email: z.string().nullable() })).readonly(),
  analytics: z.object({
    candidates: z.number(),
    graded: z.number(),
    setAside: z.number(),
    meanPercent: z.number().nullable(),
    medianPercent: z.number().nullable(),
    qualified: z.number().nullable().describe("Graded candidates at or above the cut-off; null without one."),
    failed: z.number().nullable(),
    distribution: z.array(z.number()).readonly().describe("Graded candidates per tenth of the range, 0–10% first."),
    questions: z
      .array(
        z.object({
          questionId: z.string(),
          stem: z.string(),
          kind: z.string(),
          maxScore: z.number(),
          appeared: z.number(),
          facility: z.number().nullable().describe("Mean share of marks earned; low is hard."),
          discrimination: z
            .number()
            .nullable()
            .describe("Top 27% mean minus bottom 27% mean. Near zero or negative: the question does not separate strong from weak."),
        }),
      )
      .readonly(),
    time: z.object({ medianMinutes: z.number().nullable(), p90Minutes: z.number().nullable() }),
    integrity: z
      .object({
        candidatesProbed: z.number(),
        asked: z.number(),
        replied: z.number(),
        read: z.number(),
        verdicts: z.object({ consistent: z.number(), shallow: z.number(), inconsistent: z.number(), inconclusive: z.number() }),
      })
      .describe("The cohort's follow-ups, as evidence for a person to weigh. Attached to no one."),
  }),
});
const reportResponse = z.object({
  exam: examHead,
  candidate: z.object({ ref: z.string(), name: z.string(), email: z.string().nullable() }),
  result,
  questions: z
    .array(
      z.object({
        id: z.string(),
        stem: z.string(),
        kind: z.string(),
        maxScore: z.number(),
        score: z.number().nullable(),
        answer: z.string().nullable(),
        language: z.string().nullable(),
        tests: z
          .object({ passed: z.number().int(), total: z.number().int() })
          .nullable()
          .describe("For a code answer run against its question's tests: how many passed. Counts only, as the record keeps them."),
        firstSavedMs: z.number().nullable().describe("When the answer was first saved, in milliseconds after the attempt started."),
        lastSavedMs: z.number().nullable().describe("When it was last saved, likewise."),
        saves: z.number().int().describe("How many times an answer to it was saved."),
      }),
    )
    .readonly(),
  vivas: z
    .array(
      z.object({
        questionId: z.string(),
        prompt: z.string(),
        reply: z.string().nullable(),
        latencyMs: z.number().nullable(),
        verdict: z.string().nullable(),
        confidence: z.number().nullable(),
        reasoning: z.string().nullable(),
      }),
    )
    .readonly(),
  voidReason: z.string().nullable(),
  voidedBy: z.string().nullable(),
  standing: z
    .object({
      percentile: z.number().nullable().describe("Share of the other graded candidates this one is ahead of, ties counting half."),
      rank: z.number().int().nullable(),
      graded: z.number().int(),
      meanPercent: z.number().nullable(),
    })
    .describe("Where the candidate stands among those graded on the same exam."),
  ledger: z.object({ head: z.string(), length: z.number() }),
  proctoring: z
    .object({
      identity: z.enum(["not_taken", "pending", "verified", "rejected"]),
      identityReason: z.string().nullable(),
      identityDecidedBy: z.string().nullable(),
      snapshots: z.number(),
      events: z.record(z.string(), z.number()),
    })
    .nullable()
    .describe("For a proctored exam: observations for a person to weigh, never a finding."),
});

/** A CSV cell, quoted, and defused if a spreadsheet would run it as a formula. */
const csvCell = (value: Cell): string => {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
};

const filename = (id: string, ext: string) => `${id.replace(/[^\w.-]/g, "_")}-results.${ext}`;

export function registerResultsRoutes(routes: Routes, deps: ResultsRouteDeps): void {
  const { results, staff } = deps;

  routes.get(
    "/exams/:examId/results",
    {
      schema: {
        tags: RESULTS,
        summary: "Every candidate's result, and the cohort's analytics",
        description: "Computed from the ledgers, so every figure can be traced to the entries that produced it.",
        security: SECURED,
        params: S.examParams,
        response: { 200: resultsResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await results.results(actor, examId(request.params.examId)));
    },
  );

  routes.get(
    "/exams/:examId/similarity",
    {
      schema: {
        tags: RESULTS,
        summary: "Code answers alike enough to be worth a look",
        description:
          "For each code question, pairs of candidates whose answers in the same language share most of their fingerprints (winnowing, as MOSS does), with the starter code taken out. Evidence for a person to read side by side; it changes no marks.",
        security: SECURED,
        params: S.examParams,
        response: { 200: similarityResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await results.similarity(actor, examId(request.params.examId)));
    },
  );

  for (const format of ["csv", "xlsx"] as const) {
    routes.get(
      `/exams/:examId/results.${format}`,
      {
        schema: {
          tags: RESULTS,
          summary: format === "csv" ? "Results as CSV" : "Results as an Excel workbook",
          description:
            "One row per candidate, one column per question the exam could set; times in IST. Roll numbers and phone numbers stay text. Exporting is audited.",
          security: SECURED,
          params: S.examParams,
        },
      },
      async (request, reply) => {
        const actor = await staff(request, reply, "attempt:review");
        if (actor === null) return;
        const table = await results.table(actor, examId(request.params.examId));
        const name = filename(request.params.examId, format);
        if (format === "csv") {
          return reply
            .header("content-type", "text/csv; charset=utf-8")
            .header("content-disposition", `attachment; filename="${name}"`)
            .send(`﻿${table.rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`);
        }
        return reply
          .header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
          .header("content-disposition", `attachment; filename="${name}"`)
          .send(Buffer.from(xlsx(table.title, table.rows)));
      },
    );
  }

  routes.post(
    "/exams/:examId/results/email",
    {
      schema: {
        tags: RESULTS,
        summary: "Email the results workbook to the member of staff asking",
        description:
          "The Excel workbook `results.xlsx` would download, made when it is sent and sent only to the asker's own address. Needs email set up on the server (409 otherwise). Exporting is audited when it is made.",
        security: SECURED,
        params: S.examParams,
        response: { 202: S.emailWorkbookResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.code(202).send(await results.emailWorkbook(actor, examId(request.params.examId)));
    },
  );

  routes.post(
    "/exams/:examId/results/release",
    {
      schema: {
        tags: RESULTS,
        summary: "Send each graded candidate their result",
        description:
          "A message to each graded candidate, by email where they have an address and by WhatsApp where they have a mobile number and the server has WhatsApp: their marks and, with outcome, whether they reached the qualifying mark. Once per candidate each way, ever: calling it again sends nobody a second, so it is safe to call again after more grading. With dryRun, nothing is sent and the counts say what would be. Needs email or WhatsApp set up on the server (409 otherwise). Audited.",
        security: SECURED,
        params: S.examParams,
        body: z.object({
          outcome: z.boolean().default(true).describe("Say whether each reached the qualifying mark, where the exam has one."),
          dryRun: z.boolean().default(false).describe("Send nothing; answer with what sending would do."),
        }),
        response: {
          202: z.object({
            sent: z.number().int().describe("Candidates whose result is now on its way."),
            alreadySent: z.number().int().describe("Candidates sent their result before; not sent again."),
            notGraded: z.number().int().describe("Submitted attempts still to grade: grade them, then release again."),
            unreachable: z.number().int().describe("Graded candidates with no way set up to reach them: no email address, and no mobile number or no WhatsApp."),
            channels: z.array(z.enum(["email", "whatsapp"])).readonly().describe("The ways results go from this server."),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.code(202).send(await results.release(actor, examId(request.params.examId), { outcome: request.body.outcome, dryRun: request.body.dryRun }));
    },
  );

  routes.get(
    "/attempts/:attemptId/report",
    {
      schema: {
        tags: RESULTS,
        summary: "One candidate's report",
        description:
          "The grade and the answers, then — separately — the follow-up evidence, with the ledger head that lets anyone check the record behind it.",
        security: SECURED,
        params: S.attemptParams,
        response: { 200: reportResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await results.report(actor, attemptId(request.params.attemptId)));
    },
  );
}
