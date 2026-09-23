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
import { attemptId } from "@parikshaa/core";
import type { AttemptClaims } from "./auth.js";
import type { PrivacyService } from "./privacy.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

type Routes = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export interface PrivacyRouteDeps {
  readonly privacy: PrivacyService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
  readonly candidate: (request: FastifyRequest, reply: FastifyReply) => Promise<AttemptClaims | null>;
}

const TAG = ["Privacy"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 422: S.errorResponse } as const;

export const noticeSchema = z.object({
  version: z.number(),
  hash: z.string().describe("SHA-256 of the notice's canonical form; the consent in the ledger records it."),
  controllerName: z.string(),
  purpose: z.string(),
  retentionDays: z.number(),
  grievance: z.object({ name: z.string(), email: z.string() }),
  collected: z.array(z.string()).readonly(),
  rights: z.array(z.string()).readonly(),
  translations: z.object({ hi: z.object({ collected: z.array(z.string()).readonly(), rights: z.array(z.string()).readonly() }) }),
});

const settingsBody = z.object({
  controllerName: z.string().min(1).max(200).describe("The organisation responsible for the data, as candidates should see it named."),
  grievanceName: z.string().min(1).max(200),
  grievanceEmail: z.string().min(3).max(320),
  purpose: z.string().min(1).max(1000).describe("Why the data is collected, in the organisation's words."),
  retentionDays: z.number().int().min(7).max(3650).describe("Days after an attempt closes before its personal data is erased."),
});
const settings = settingsBody.extend({ noticeVersion: z.number(), updatedAt: z.string() });

export function registerPrivacyRoutes(routes: Routes, deps: PrivacyRouteDeps): void {
  const { privacy, staff, candidate } = deps;

  routes.get(
    "/privacy",
    {
      schema: {
        tags: TAG,
        summary: "The organisation's privacy settings, and the notice candidates see",
        security: SECURED,
        response: { 200: z.object({ settings: settings.nullable(), notice: noticeSchema.nullable() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send(await privacy.settings(actor));
    },
  );

  routes.put(
    "/privacy",
    {
      schema: {
        tags: TAG,
        summary: "Set the privacy notice and the retention period",
        description:
          "Once set, every candidate agrees to the notice before their attempt starts, and closed attempts are erased when the retention period runs out. Changing the wording moves the notice version on; candidates who have already started keep the version they agreed to. Audited.",
        security: SECURED,
        body: settingsBody,
        response: { 200: z.object({ settings, notice: noticeSchema }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send(await privacy.saveSettings(actor, request.body));
    },
  );

  routes.post(
    "/attempts/:attemptId/erase",
    {
      schema: {
        tags: TAG,
        summary: "Erase an attempt's personal data, at the candidate's request",
        description:
          "Irreversible. Destroys the attempt's data key, so the answers, replies and identity sealed in its ledger can never be read again; clears the invitation's name, email, phone and reference; deletes unsent drafts. The ledger still verifies and the scores stay. Only a closed attempt, and only a signed-in person. Audited.",
        security: SECURED,
        params: S.attemptParams,
        response: { 200: z.object({ erased: z.boolean().describe("False if it had already been erased.") }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send(await privacy.erase(actor, attemptId(request.params.attemptId)));
    },
  );

  routes.get(
    "/attempts/me/data",
    {
      schema: {
        tags: ["Candidate"],
        summary: "Everything held about this candidate for this attempt",
        description: "Their details, the notice they agreed to, their answers and replies, and when things happened. No scores or verdicts.",
        security: [{ attemptToken: [] }],
        response: {
          200: z.object({
            generatedAt: z.string(),
            organisation: z.string(),
            exam: z.object({ id: z.string(), title: z.string() }),
            you: z.object({ reference: z.string(), name: z.string(), email: z.string().nullable(), phone: z.string().nullable() }).nullable(),
            consent: z.object({ noticeVersion: z.number(), noticeHash: z.string(), at: z.number() }).nullable(),
            erased: z.boolean(),
            answers: z.array(z.object({ questionId: z.string(), answer: z.string(), at: z.number() })).readonly(),
            followUps: z.array(z.object({ questionId: z.string(), question: z.string(), reply: z.string().nullable(), at: z.number() })).readonly(),
            timeline: z.array(z.object({ at: z.number(), event: z.string() })).readonly(),
            proctoring: z
              .object({
                photos: z.array(z.object({ kind: z.string(), takenAt: z.string(), sha256: z.string() })).readonly(),
                events: z.array(z.object({ kind: z.string(), at: z.string() })).readonly(),
              })
              .nullable(),
          }),
          401: S.errorResponse,
          409: S.errorResponse,
          429: S.errorResponse,
        },
      },
    },
    async (request, reply) => {
      const claims = await candidate(request, reply);
      if (claims === null) return;
      return reply.send(await privacy.candidateData(claims));
    },
  );
}
