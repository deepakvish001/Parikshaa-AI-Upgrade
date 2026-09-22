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
});
const resultsResponse = z.object({
  exam: z.object({ id: z.string(), title: z.string() }),
  rows: z.array(result.extend({ ref: z.string(), name: z.string(), email: z.string().nullable() })).readonly(),
  analytics: z.object({
    candidates: z.number(),
    graded: z.number(),
    setAside: z.number(),
    meanPercent: z.number().nullable(),
    medianPercent: z.number().nullable(),
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
  exam: z.object({ id: z.string(), title: z.string() }),
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
  ledger: z.object({ head: z.string(), length: z.number() }),
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
