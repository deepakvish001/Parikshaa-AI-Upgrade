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
import { orgId as toOrgId } from "@parikshaa/core";
import * as S from "./schemas.js";
import type { ExamService } from "./service.js";
import type { Actor, LoginThrottle, Permission } from "./staff-auth.js";
import { SecurityError, type StaffSecurity, type User } from "./staff-security.js";

type Routes = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export interface SecurityRouteDeps {
  readonly service: ExamService;
  readonly security: StaffSecurity;
  readonly throttle: LoginThrottle;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const ACCOUNT = ["Account"];
const SECURED = [{ staffAuth: [] }];

const refusals = {
  400: S.errorResponse,
  401: S.errorResponse,
  403: S.errorResponse,
  404: S.errorResponse,
  409: S.errorResponse,
  410: S.errorResponse,
  422: S.errorResponse,
  429: S.errorResponse,
} as const;

export const securityStatus: Record<SecurityError["code"], number> = {
  invalid_code: 422,
  invalid_credentials: 401,
  already_enabled: 409,
  not_enabled: 409,
  required_by_organisation: 409,
  enrol_first: 409,
  invalid_reset: 410,
  sso_not_configured: 404,
  invalid_sso: 422,
  not_staff: 403,
};

/**
 * Password reset, a second factor, and single sign-on (ROADMAP §1).
 *
 * The reset and SSO routes are open — someone who cannot sign in is exactly
 * who uses them — and so they say as little as they can: asking for a reset
 * answers the same whether or not the address has an account.
 */
export function registerSecurityRoutes(routes: Routes, deps: SecurityRouteDeps): void {
  const { service, security, throttle, staff } = deps;

  const person = async (request: FastifyRequest, reply: FastifyReply, permission: Permission | null): Promise<User | null> => {
    const actor = await staff(request, reply, permission);
    if (actor === null) return null;
    if (actor.kind !== "user") {
      await reply.code(403).send({ error: "forbidden", message: "Only a person's account has a second factor" });
      return null;
    }
    return actor;
  };

  // --- password reset -------------------------------------------------------------

  routes.post(
    "/auth/password-reset",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Email a password reset link",
        description:
          "Always answers 202, whether or not the address has an account, so it cannot be used to find out who does. The link works once, for an hour; an account gets at most three an hour.",
        body: S.resetRequestBody,
        response: { 202: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const { email } = request.body;
      // Counted like failed sign-ins, on a key of its own, so requests from one
      // address for one account cannot run on without limit.
      const key = `reset:${email}`;
      if (throttle.blocked(request.ip, key)) {
        return reply.code(429).send({ error: "too_many_attempts", message: "Try again in a few minutes" });
      }
      throttle.failed(request.ip, key);
      const requested = await security.requestReset(email);
      if (requested !== null) await service.recordAudit(requested, "auth.password_reset_requested", requested.id);
      return reply.code(202).send({ ok: true });
    },
  );

  routes.post(
    "/auth/password-reset/confirm",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Set a new password from a reset link",
        description: "Ends every session the account holds. A second factor, if set up, is still asked at the next sign-in.",
        body: S.resetConfirmBody,
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const user = await security.completeReset(request.body.token, request.body.password);
      await service.recordAudit(user, "auth.password_reset", user.id);
      return reply.send({ ok: true });
    },
  );

  // --- a second factor ----------------------------------------------------------------

  routes.get(
    "/auth/2fa",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Whether this account has a second factor",
        security: SECURED,
        response: { 200: S.twoFactorStatus, ...refusals },
      },
    },
    async (request, reply) => {
      const user = await person(request, reply, null);
      if (user === null) return;
      return reply.send(await security.twoFactorStatus(user));
    },
  );

  routes.post(
    "/auth/2fa/setup",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Start setting up an authenticator app",
        description: "Returns a new secret and the `otpauth://` URI to show as a QR code. Nothing changes until a code from it is confirmed.",
        security: SECURED,
        response: { 200: S.twoFactorSetup, ...refusals },
      },
    },
    async (request, reply) => {
      const user = await person(request, reply, null);
      if (user === null) return;
      return reply.send(await security.beginTotp(user));
    },
  );

  routes.post(
    "/auth/2fa/enable",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Turn the second factor on with a first code",
        description: "Returns ten one-time recovery codes. They are in this response and nowhere else.",
        security: SECURED,
        body: S.twoFactorCode,
        response: { 200: S.recoveryCodes, ...refusals },
      },
    },
    async (request, reply) => {
      const user = await person(request, reply, null);
      if (user === null) return;
      const codes = await security.enableTotp(user, request.body.code);
      await service.recordAudit(user, "auth.2fa_enabled", user.id);
      return reply.send({ recoveryCodes: codes });
    },
  );

  routes.post(
    "/auth/2fa/disable",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Turn the second factor off",
        description: "Needs the password and a current code or recovery code. Ends every session. Refused for an owner whose organisation requires one.",
        security: SECURED,
        body: S.twoFactorDisable,
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const user = await person(request, reply, null);
      if (user === null) return;
      await security.disableTotp(user, request.body.password, request.body.code);
      await service.recordAudit(user, "auth.2fa_disabled", user.id);
      return reply.send({ ok: true });
    },
  );

  routes.put(
    "/org/security",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Require owners to use a second factor",
        description: "An owner without one is then held to setting it up before doing anything else. Only an owner who has one can turn this on.",
        security: SECURED,
        body: S.orgSecurityBody,
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const user = await person(request, reply, "org:manage");
      if (user === null) return;
      await security.setOwnerRequirement(user, request.body.requireOwner2fa);
      await service.recordAudit(user, "org.owner_2fa_required", user.orgId, { required: request.body.requireOwner2fa });
      return reply.send({ ok: true });
    },
  );

  // --- single sign-on ----------------------------------------------------------------

  routes.get(
    "/org/sso",
    {
      schema: {
        tags: ACCOUNT,
        summary: "The organisation's sign-in provider",
        description: "Never the client secret.",
        security: SECURED,
        response: { 200: S.ssoSettings, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send(await security.ssoSettings(actor.orgId));
    },
  );

  routes.put(
    "/org/sso",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Set up single sign-on through an OpenID Connect provider",
        description:
          "Google Workspace, Microsoft Entra ID, Okta, Keycloak — any provider with a discovery document. Its discovery document is fetched to check the issuer before anything is saved. Only existing staff can sign in this way; nobody is created.",
        security: SECURED,
        body: S.ssoSettingsBody,
        response: { 200: S.ssoSettings, ...refusals },
      },
    },
    async (request, reply) => {
      const user = await person(request, reply, "org:manage");
      if (user === null) return;
      const saved = await security.saveSso(user.orgId, request.body);
      await service.recordAudit(user, "org.sso_configured", user.orgId, {
        issuer: saved.issuer,
        enforced: saved.enforced,
        enabled: saved.enabled,
      });
      return reply.send(saved);
    },
  );

  routes.get(
    "/auth/sso/:orgId/start",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Sign in through the organisation's provider",
        description: "Redirects the browser to the provider.",
        params: S.ssoStartParams,
        querystring: S.ssoStartQuery,
      },
    },
    async (request, reply) => {
      try {
        const url = await security.ssoStart(toOrgId(request.params.orgId), request.query.email);
        return reply.redirect(url, 302);
      } catch (error) {
        if (error instanceof SecurityError) return reply.redirect(`/console/?sso_error=${error.code}`, 302);
        throw error;
      }
    },
  );

  routes.get(
    "/auth/sso/callback",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Where the provider sends the browser back",
        description:
          "Signs in the member of staff the provider vouches for and returns the browser to the console with the session in the URL fragment, which never reaches a server log.",
        querystring: S.ssoCallbackQuery,
      },
    },
    async (request, reply) => {
      const { code, state, error } = request.query;
      if (error !== undefined || code === undefined || state === undefined) {
        return reply.redirect(`/console/?sso_error=${error === "access_denied" ? "cancelled" : "invalid_sso"}`, 302);
      }
      try {
        const session = await security.ssoCallback(code, state);
        await service.recordAudit({ kind: "user", ...session.user }, "auth.sso_login", session.user.id);
        return reply.redirect(`/console/#sso=${encodeURIComponent(session.token)}`, 302);
      } catch (failure) {
        if (failure instanceof SecurityError) return reply.redirect(`/console/?sso_error=${failure.code}`, 302);
        throw failure;
      }
    },
  );
}
