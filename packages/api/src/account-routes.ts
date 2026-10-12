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
import type { IdentityStore } from "@parikshaa/store";
import * as S from "./schemas.js";
import type { ExamService } from "./service.js";
import type { Operators } from "./operator.js";
import { hashPassword, permissionsOf, type Actor, type LoginThrottle, type Permission, type StaffAuth } from "./staff-auth.js";

type Routes = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export interface AccountRouteDeps {
  readonly service: ExamService;
  readonly auth: StaffAuth;
  readonly identity: IdentityStore;
  readonly throttle: LoginThrottle;
  readonly bearer: (request: FastifyRequest) => string | null;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
  /** Parikshaa's own operators (operator.ts), named in `/auth/me`. */
  readonly operators?: Operators;
}

const ACCOUNT = ["Account"];
const SECURED = [{ staffAuth: [] }];

const refusals = {
  400: S.errorResponse,
  401: S.errorResponse,
  403: S.errorResponse,
  404: S.errorResponse,
  409: S.errorResponse,
  422: S.errorResponse,
  429: S.errorResponse,
} as const;

/**
 * Signing in, and everything an organisation's owner manages: its staff, its
 * API keys, its model budget, and the audit log of what they all did.
 *
 * Account records sit outside tenant row-level security (they are how a
 * request finds its organisation), so every query here names the actor's
 * organisation explicitly. A user id from another organisation is simply not
 * found.
 */
export function registerAccountRoutes(routes: Routes, deps: AccountRouteDeps): void {
  const { service, auth, identity, throttle, bearer, staff } = deps;

  routes.post(
    "/auth/login",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Sign in with email and password",
        description:
          "Returns a session token valid for twelve hours. Any failure answers the same way, so the response does not reveal which addresses have accounts. Repeated failures from one address for one account are refused for fifteen minutes. An account with a second factor answers `second_factor_required` to the right password alone; send it again with `code` — the authenticator's six digits or a recovery code. Where the organisation signs staff in through its own provider, anyone but an owner is answered `sso_required`.",
        body: S.loginBody,
        response: { 200: S.loginResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const { email, password, code } = request.body;
      if (throttle.blocked(request.ip, email)) {
        return reply.code(429).send({ error: "too_many_attempts", message: "Try again in a few minutes" });
      }

      const outcome = await auth.login(email, password, code);
      if (!outcome.ok) {
        // Asking for the second factor is not a failure; a wrong code is.
        if (outcome.reason === "second_factor_required") {
          return reply.code(401).send({ error: "second_factor_required", message: "Enter the code from your authenticator app" });
        }
        throttle.failed(request.ip, email);
        if (outcome.reason === "sso_required") {
          return reply.code(403).send({ error: "sso_required", message: "Your organisation signs its staff in through its own provider" });
        }
        if (outcome.reason === "suspended") {
          return reply.code(403).send({ error: "suspended", message: "This organisation's account is paused. Write to Parikshaa's support." });
        }
        return reply.code(401).send({ error: "invalid_credentials" });
      }
      throttle.succeeded(request.ip, email);

      const { ok: _, ...result } = outcome;
      const actor: Actor = { kind: "user", ...result.user };
      await service.recordAudit(actor, "auth.login", result.user.id);
      return reply.send(result);
    },
  );

  routes.post(
    "/auth/logout",
    {
      schema: {
        tags: ACCOUNT,
        summary: "End this session",
        security: SECURED,
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const token = bearer(request);
      if (token !== null) await auth.logout(token);
      return reply.send({ ok: true });
    },
  );

  routes.get(
    "/auth/me",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Who this token belongs to, and what it may do",
        security: SECURED,
        response: { 200: S.whoAmIResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, null);
      if (actor === null) return;
      const org = await identity.getOrganisation(actor.orgId);
      // What the account may do changes under it (a confirmed address, a new role): never reused.
      return reply.header("cache-control", "no-store").send({
        kind: actor.kind,
        id: actor.id,
        name: actor.name,
        email: actor.kind === "user" ? actor.email : null,
        role: actor.role,
        organisation: { id: actor.orgId, publicId: org?.publicId ?? "", name: org?.name ?? actor.orgId, kind: org?.kind ?? "institution" },
        operator: deps.operators?.is(actor) ?? false,
        permissions: permissionsOf(actor),
        emailVerified: !(actor.kind === "user" && actor.emailUnverified === true),
        mustEnrol2fa: actor.kind === "user" && actor.mustEnrol2fa === true,
      });
    },
  );

  routes.post(
    "/auth/password",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Change this account's password",
        description: "Ends every session the account holds, including this one.",
        security: SECURED,
        body: S.changePasswordBody,
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, null);
      if (actor === null) return;
      if (actor.kind !== "user") {
        return reply.code(403).send({ error: "forbidden", message: "API keys have no password" });
      }
      const changed = await auth.changePassword(actor, request.body.current, request.body.next);
      if (!changed) return reply.code(401).send({ error: "invalid_credentials" });
      await service.recordAudit(actor, "auth.password_changed", actor.id);
      return reply.send({ ok: true });
    },
  );

  // --- staff ------------------------------------------------------------------

  routes.get(
    "/staff",
    {
      schema: {
        tags: ACCOUNT,
        summary: "List this organisation's staff",
        security: SECURED,
        response: { 200: S.staffListResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "staff:manage");
      if (actor === null) return;
      return reply.send({ users: await identity.listUsers(actor.orgId) });
    },
  );

  routes.post(
    "/staff",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Add a member of staff",
        description: "With an initial password, which they should change on first sign-in.",
        security: SECURED,
        body: S.createStaffBody,
        response: { 201: S.staffUser, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "staff:manage");
      if (actor === null) return;
      const { email, name, role, password } = request.body;

      if ((await identity.findUserByEmail(email)) !== null) {
        return reply.code(409).send({ error: "email_taken", message: "An account already uses that address" });
      }
      const user = await identity.createUser({
        orgId: actor.orgId,
        email,
        name,
        role,
        passwordHash: await hashPassword(password),
      });
      await service.recordAudit(actor, "staff.created", user.id, { email: user.email, role });
      return reply.code(201).send(user);
    },
  );

  routes.patch(
    "/staff/:userId",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Change a member of staff's role",
        description: "The last active owner cannot be demoted; an organisation always keeps someone who can manage it.",
        security: SECURED,
        params: S.staffParams,
        body: S.updateStaffBody,
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "staff:manage");
      if (actor === null) return;
      const { userId } = request.params;

      const target = await identity.findUser(actor.orgId, userId);
      if (target === null) return reply.code(404).send({ error: "not_found" });
      if (target.role === "owner" && request.body.role !== "owner" && !target.disabled) {
        if ((await identity.countOwners(actor.orgId)) <= 1) {
          return reply.code(409).send({ error: "last_owner", message: "Make someone else an owner first" });
        }
      }

      await identity.setRole(actor.orgId, userId, request.body.role);
      // A role change takes effect on the next request, since every request
      // resolves the session afresh; no session needs ending.
      await service.recordAudit(actor, "staff.role_changed", userId, { from: target.role, to: request.body.role });
      return reply.send({ ok: true });
    },
  );

  routes.post(
    "/staff/:userId/disable",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Disable a member of staff",
        description: "Ends their sessions at once. Their past actions stay attributed to them.",
        security: SECURED,
        params: S.staffParams,
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "staff:manage");
      if (actor === null) return;
      const { userId } = request.params;

      const target = await identity.findUser(actor.orgId, userId);
      if (target === null) return reply.code(404).send({ error: "not_found" });
      if (target.role === "owner" && !target.disabled && (await identity.countOwners(actor.orgId)) <= 1) {
        return reply.code(409).send({ error: "last_owner", message: "Make someone else an owner first" });
      }

      await identity.disableUser(actor.orgId, userId);
      await service.recordAudit(actor, "staff.disabled", userId);
      return reply.send({ ok: true });
    },
  );

  // --- API keys ---------------------------------------------------------------

  routes.get(
    "/api-keys",
    {
      schema: {
        tags: ACCOUNT,
        summary: "List API keys",
        description: "Never the keys themselves, which are stored only as digests.",
        security: SECURED,
        response: { 200: S.apiKeyListResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "apikey:manage");
      if (actor === null) return;
      return reply.send({ keys: await identity.listApiKeys(actor.orgId) });
    },
  );

  routes.post(
    "/api-keys",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Issue an API key",
        description: "For an ATS or LMS integration. The secret is in this response and nowhere else.",
        security: SECURED,
        body: S.createApiKeyBody,
        response: { 201: S.createApiKeyResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "apikey:manage");
      if (actor === null) return;
      const { name, role } = request.body;
      const issued = await auth.issueApiKey(actor.orgId, name, role, actor.kind === "user" ? actor.id : null);
      await service.recordAudit(actor, "apikey.issued", issued.id, { name, role });
      return reply.code(201).send(issued);
    },
  );

  routes.delete(
    "/api-keys/:keyId",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Revoke an API key",
        security: SECURED,
        params: S.apiKeyParams,
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "apikey:manage");
      if (actor === null) return;
      const revoked = await identity.revokeApiKey(actor.orgId, request.params.keyId);
      if (!revoked) return reply.code(404).send({ error: "not_found" });
      await service.recordAudit(actor, "apikey.revoked", request.params.keyId);
      return reply.send({ ok: true });
    },
  );

  // --- spend and audit --------------------------------------------------------

  routes.get(
    "/usage",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Model spend and token counts",
        description:
          "By route, per attempt (p50/p90/max) and by inference region, since a moment — the start of this month by default — with this month's spend against the cap.",
        security: SECURED,
        querystring: S.usageQuery,
        response: { 200: S.usageResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "usage:read");
      if (actor === null) return;
      const { since } = request.query;
      return reply.send(await service.usage(actor, since === undefined ? undefined : new Date(since)));
    },
  );

  routes.put(
    "/org/spend-cap",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Set the monthly model spend cap",
        description:
          "Once reached, probes are quietly not raised and grading and assessment answer 402 until the month turns or the cap is raised.",
        security: SECURED,
        body: S.spendCapBody,
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      await identity.setSpendCap(actor.orgId, request.body.monthlyCapMicroUsd);
      await service.recordAudit(actor, "org.spend_cap_set", actor.orgId, {
        monthlyCapMicroUsd: request.body.monthlyCapMicroUsd,
      });
      return reply.send({ ok: true });
    },
  );

  routes.get(
    "/audit",
    {
      schema: {
        tags: ACCOUNT,
        summary: "What staff and integrations did, newest first",
        description: "Append-only. Candidate actions are not here; they are in each attempt's ledger.",
        security: SECURED,
        querystring: S.auditQuery,
        response: { 200: S.auditResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "audit:read");
      if (actor === null) return;
      return reply.send({ entries: await service.audit(actor, request.query.limit) });
    },
  );
}
