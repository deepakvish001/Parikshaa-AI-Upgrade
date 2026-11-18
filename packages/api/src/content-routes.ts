import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { UploadDetail, UploadSummary } from "@parikshaa/store";
import { BUNDLE_LIMITS } from "./content-bundle.js";
import type { ContentUploads } from "./content-uploads.js";
import * as S from "./schemas.js";
import type { ExamService } from "./service.js";
import type { Actor, Permission } from "./staff-auth.js";

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface ContentRouteDeps {
  readonly uploads: ContentUploads;
  readonly service: ExamService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const ADMIN = ["Practice (staff)"];
const STAFF = [{ staffAuth: [] }];
const refusals = { 400: S.errorResponse, 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 413: S.errorResponse, 422: S.errorResponse } as const;

const gateProblem = z.object({ gate: z.string().describe("The gate that found it: schema, rules, duplicate, version, generator, reference, wrong, starter, solver, runner…"), message: z.string() });
const author = z.object({ id: z.string(), name: z.string() });
const counts = z.object({ total: z.number(), pending: z.number(), checking: z.number(), passed: z.number(), failed: z.number(), skipped: z.number() });
const summary = z.object({
  id: z.string(),
  bundleId: z.string(),
  bundleVersion: z.number(),
  title: z.string(),
  fileName: z.string(),
  bytes: z.number(),
  state: z.enum(["checking", "done"]).describe("checking: items still wait for, or are on, the code runner."),
  createdBy: author,
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
  counts,
  published: z.number().describe("Items of this upload whose version is live on Learn now."),
});
const itemReport = z.object({
  position: z.number(),
  namespace: z.enum(["problem", "lesson"]),
  slug: z.string(),
  type: z.string(),
  version: z.number(),
  hash: z.string().describe("SHA-256 of the item's canonical JSON, $file references resolved."),
  title: z.string(),
  status: z.enum(["pending", "checking", "passed", "failed", "skipped"]).describe("passed: kept as a draft. failed: not kept; problems say why. skipped: this version and content are kept already."),
  problems: z.array(gateProblem).readonly(),
  warnings: z.array(z.string()).readonly().describe("For the reviewer: what to look at, and what was not checked yet."),
  checkedAt: z.string().nullable(),
  current: z
    .object({
      version: z.number(),
      hash: z.string(),
      state: z.enum(["draft", "published"]),
      publishedVersion: z.number().nullable(),
      publishedHash: z.string().nullable().describe("The live version's hash: which content of that version learners see."),
      uploadId: z.string(),
    })
    .nullable()
    .describe("What is kept under this slug now: the current version, and which version is live."),
});
const detail = summary.extend({
  manifest: z.unknown().describe("The bundle's manifest, as uploaded."),
  problems: z.array(gateProblem).readonly().describe("What is wrong with the bundle as a whole."),
  items: z.array(itemReport).readonly(),
});
const key = z.object({ namespace: z.enum(["problem", "lesson"]), slug: z.string().min(1).max(200) });

const toSummary = (u: UploadSummary) => u;
const toDetail = (u: UploadDetail) => ({ ...u, manifest: u.manifest });

/**
 * The console's bulk content upload (tracker plan row 141, part B): a bundle
 * in, each item checked by machine and kept as a draft, then published by a
 * reviewer. Under `/practice-admin/content`.
 */
export function registerContentRoutes(routes: Routes, deps: ContentRouteDeps): void {
  const { uploads, service, staff } = deps;

  routes.post(
    "/practice-admin/content/uploads",
    {
      // A 20 MiB file, base64, in JSON.
      bodyLimit: Math.ceil((BUNDLE_LIMITS.fileBytes * 4) / 3) + 64 * 1024,
      schema: {
        tags: ADMIN,
        summary: "Upload a content bundle: each item is checked, and one that passes is kept as a draft",
        description:
          "A bundle (docs/content/CONTENT-FORMAT.md): one JSON file, or a ZIP of a folder with manifest.json at its root. The schema, rules, version and duplicate checks run at once and are in the answer; the code runner's gates run after it, one item at a time: read the upload again until its state is done. Nothing is shown on Learn until it is published.",
        security: STAFF,
        body: z.object({
          name: z.string().trim().min(1).max(200).describe("The file's name, as chosen."),
          file: z.string().min(1).describe("The file's bytes, base64. At most 20 MiB."),
        }),
        response: { 201: detail, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      const bytes = Buffer.from(request.body.file, "base64");
      const upload = await uploads.upload({ orgId: actor.orgId, id: actor.id, name: actor.name }, { name: request.body.name, bytes });
      await service.recordAudit(actor, "practice.content_uploaded", upload.id, { bundle: upload.bundleId, version: upload.bundleVersion, items: upload.counts.total, failed: upload.counts.failed });
      return reply.code(201).send(toDetail(upload));
    },
  );

  routes.get(
    "/practice-admin/content/uploads",
    { schema: { tags: ADMIN, summary: "Content uploads, newest first", security: STAFF, response: { 200: z.object({ uploads: z.array(summary).readonly() }), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read_key");
      if (actor === null) return;
      return reply.send({ uploads: (await uploads.list(actor.orgId)).map(toSummary) });
    },
  );

  routes.get(
    "/practice-admin/content/uploads/:id",
    {
      schema: {
        tags: ADMIN,
        summary: "One content upload: its progress and each item's report",
        security: STAFF,
        params: z.object({ id: z.string().min(1).max(80) }),
        response: { 200: detail, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read_key");
      if (actor === null) return;
      return reply.send(toDetail(await uploads.detail(actor.orgId, request.params.id)));
    },
  );

  routes.post(
    "/practice-admin/content/publish",
    {
      schema: {
        tags: ADMIN,
        summary: "Publish an upload's drafts to Learn",
        description:
          "The items named, or, without items, every item of the upload that passed. Each is published as the version that upload brought: written to the practice site's problems or lessons (a lesson's quiz and hands-on tasks as problems), placed in its track, and shown to learners. Projects and system design cases stay drafts: Learn has no page for them yet.",
        security: STAFF,
        body: z.object({ upload: z.string().min(1).max(80), items: z.array(key).min(1).max(600).optional() }),
        response: {
          200: z.object({
            published: z.array(key.extend({ version: z.number() })).readonly(),
            refused: z.array(key.extend({ message: z.string() })).readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      const result = await uploads.publish({ orgId: actor.orgId, id: actor.id, name: actor.name }, request.body.upload, request.body.items);
      await service.recordAudit(actor, "practice.content_published", request.body.upload, {
        published: result.published.length,
        refused: result.refused.length,
        items: result.published.map((p) => `${p.namespace}:${p.slug}@${p.version}`).slice(0, 100),
      });
      return reply.send(result);
    },
  );
}
