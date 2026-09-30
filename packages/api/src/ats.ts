import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { attemptId as toAttemptId, orgId as toOrgId, resultOf, type OrgId } from "@parikshaa/core";
import { staffScope, type AtsCandidate, type AtsConnector, type AtsProvider, type IntegrationStore, type InvitationStore, type LedgerStore, type OutboxItem } from "@parikshaa/store";
import { indianMobile } from "./candidate-import.js";
import { PermanentFailure, type ItemHandler } from "./delivery.js";
import type { IntegrationSecrets } from "./integration-secrets.js";
import type { InvitationService } from "./invitation-service.js";
import { istStamp } from "./results.js";
import { checkUrl, safeRequest, UnsafeUrl, type SafeHttpOptions, type SafeResponse } from "./safe-http.js";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";
import type { StaffSecrets } from "./staff-secrets.js";
import { reportUrl, type EventListener } from "./webhooks.js";

/**
 * Applicant-tracking systems beyond Greenhouse (ROADMAP §7): Lever, Zoho
 * Recruit and Darwinbox.
 *
 * Each works the same way round. The ATS asks for a test by calling a hook
 * here — its URL carries a key derived from the server's secret, never stored
 * — and the candidate is invited as any other, by email and SMS from here.
 * When the attempt is graded or set aside, the result goes back to the ATS
 * through the outbox: a note on the Lever opportunity, a note on the Zoho
 * Recruit candidate, a call to Darwinbox's callback address. What the ATS
 * gave us to call it with is sealed at rest.
 *
 * The ATS acts with an author's rights, like Greenhouse: it can invite and
 * hear a result, and never sees an answer, an answer key or a follow-up.
 *
 * Not verified here: these follow each vendor's published API (Lever's v1
 * REST API and webhooks, Zoho Recruit's v2 API with OAuth refresh tokens),
 * and, for Darwinbox, whose partner API is shared only with partners, a
 * configurable callback. None has been run against a live account.
 */

export const ATS_PROVIDERS: readonly AtsProvider[] = ["lever", "zoho_recruit", "darwinbox"];

export const ATS_LABELS: Record<AtsProvider, string> = { lever: "Lever", zoho_recruit: "Zoho Recruit", darwinbox: "Darwinbox" };

/** What an ATS told us about a candidate to invite. */
interface Inbound {
  readonly externalId: string;
  readonly examId: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly detail: Record<string, unknown>;
}

/** What goes back: the result as a recruiter reads it. */
export interface AtsOutcome {
  readonly examTitle: string;
  readonly state: "graded" | "void";
  readonly total: number | null;
  readonly maxTotal: number;
  readonly percent: number | null;
  readonly reportUrl: string;
  readonly completedAt: string | null;
  readonly followUps: number;
}

export interface AtsBaseUrls {
  /** https://api.lever.co */
  readonly lever?: string;
  /** Both Zoho hosts, in a test; normally https://accounts.zoho.<dc> and https://recruit.zoho.<dc>. */
  readonly zoho?: string;
}

interface Context {
  readonly settings: Record<string, unknown>;
  readonly credentials: Record<string, string>;
  readonly http: SafeHttpOptions;
  readonly bases: AtsBaseUrls;
}

interface Provider {
  readonly settings: z.ZodType<Record<string, unknown>>;
  readonly credentials: z.ZodType<Record<string, string>>;
  /** The candidate to invite, or why this call asks for nothing. */
  inbound(body: unknown, ctx: Context): Promise<Inbound | { readonly ignore: string }>;
  report(candidate: AtsCandidate, outcome: AtsOutcome, ctx: Context): Promise<void>;
  /**
   * A call to the live account that changes nothing there, to prove the
   * credentials before a candidate depends on them. Says what it found.
   */
  check(ctx: Context): Promise<string>;
}

/** What a connection check says: whether it worked, and in words what was found or refused. */
export interface AtsCheck {
  readonly ok: boolean;
  readonly detail: string;
}

/** A refusal from an account, in a person's words. */
const refused = (who: string, status: number) =>
  status === 401 || status === 403
    ? `${who} refused the credentials (${status}): check they are current and for this account`
    : `${who} answered ${status}`;

export class AtsError extends Error {
  constructor(
    readonly code: "invalid_request" | "unauthorised" | "not_configured" | "upstream",
    message: string,
  ) {
    super(message);
    this.name = "AtsError";
  }
}

/** One line a recruiter reads in their ATS. */
export function outcomeText(outcome: AtsOutcome): string {
  if (outcome.state === "void") return `Parikshaa — ${outcome.examTitle}: set aside by a reviewer. The reason is in the report: ${outcome.reportUrl}`;
  const marks = outcome.total === null ? "" : `${outcome.total} / ${outcome.maxTotal}`;
  const percent = outcome.percent === null ? "" : ` (${Math.round(outcome.percent)}%)`;
  const followUps = outcome.followUps > 0 ? ` ${outcome.followUps} follow-up question${outcome.followUps === 1 ? "" : "s"} asked; read them in the report.` : "";
  return `Parikshaa — ${outcome.examTitle}: ${marks}${percent}.${followUps} Report: ${outcome.reportUrl}`;
}

const splitName = (full: string) => full.trim().replace(/\s+/g, " ");

async function json(response: SafeResponse, what: string): Promise<Record<string, unknown>> {
  if (response.status < 200 || response.status >= 300) {
    const detail = `${what} answered ${response.status}`;
    if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) throw new PermanentFailure(detail);
    throw new Error(detail);
  }
  try {
    return JSON.parse(response.body === "" ? "{}" : response.body) as Record<string, unknown>;
  } catch {
    throw new Error(`${what} did not answer with JSON`);
  }
}

// --- Lever ---------------------------------------------------------------------------------

/**
 * Lever: a webhook on `candidateStageChange`, signed with the webhook's
 * signature token (HMAC-SHA256 of `token + triggeredAt`); a stage an owner
 * maps to an exam sends that exam. The candidate's name and contacts come
 * from the opportunity (`GET /v1/opportunities/:id`, the API key as the Basic
 * username); the result goes back as a note on it.
 */
const lever: Provider = {
  settings: z.object({ stageExams: z.record(z.string().min(1), z.string().min(1)) }),
  credentials: z.object({ apiKey: z.string().min(1), signatureToken: z.string().min(1) }),

  async inbound(body, ctx) {
    const hook = z
      .object({
        event: z.string(),
        token: z.string(),
        triggeredAt: z.union([z.number(), z.string()]),
        signature: z.string(),
        data: z.object({ opportunityId: z.string(), toStageId: z.string().optional(), candidateId: z.string().optional() }).passthrough(),
      })
      .safeParse(body);
    if (!hook.success) throw new AtsError("invalid_request", "Not a Lever webhook");
    const { token, triggeredAt, signature, data, event } = hook.data;
    const expected = Buffer.from(createHmac("sha256", ctx.credentials["signatureToken"]!).update(`${token}${triggeredAt}`).digest("hex"));
    const given = Buffer.from(signature);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new AtsError("unauthorised", "The Lever signature does not match");
    if (event !== "candidateStageChange") return { ignore: `Lever event ${event}` };
    const examId = data.toStageId === undefined ? undefined : (ctx.settings["stageExams"] as Record<string, string>)[data.toStageId];
    if (examId === undefined) return { ignore: "No exam for that stage" };

    const base = (ctx.bases.lever ?? "https://api.lever.co").replace(/\/$/, "");
    const auth = `Basic ${Buffer.from(`${ctx.credentials["apiKey"]}:`).toString("base64")}`;
    const opportunity = await json(
      await safeRequest(`${base}/v1/opportunities/${encodeURIComponent(data.opportunityId)}`, { method: "GET", headers: { authorization: auth, accept: "application/json" } }, ctx.http),
      "Lever",
    ).catch((error: unknown) => {
      throw new AtsError("upstream", error instanceof Error ? error.message : "Lever could not be reached");
    });
    const person = (opportunity["data"] ?? {}) as { name?: string; emails?: string[]; phones?: { value?: string }[] };
    const phone = person.phones?.map((p) => (p.value === undefined ? null : indianMobile(p.value))).find((p) => p !== null) ?? null;
    return {
      externalId: data.opportunityId,
      examId,
      name: splitName(person.name ?? ""),
      email: person.emails?.[0] ?? null,
      phone,
      detail: { stageId: data.toStageId, candidateId: data.candidateId ?? null },
    };
  },

  async report(candidate, outcome, ctx) {
    const base = (ctx.bases.lever ?? "https://api.lever.co").replace(/\/$/, "");
    const response = await safeRequest(
      `${base}/v1/opportunities/${encodeURIComponent(candidate.externalId)}/notes`,
      {
        method: "POST",
        headers: { authorization: `Basic ${Buffer.from(`${ctx.credentials["apiKey"]}:`).toString("base64")}`, "content-type": "application/json" },
        body: JSON.stringify({ value: outcomeText(outcome) }),
      },
      ctx.http,
    );
    await json(response, "Lever");
  },

  async check(ctx) {
    const base = (ctx.bases.lever ?? "https://api.lever.co").replace(/\/$/, "");
    const response = await safeRequest(
      `${base}/v1/stages`,
      { method: "GET", headers: { authorization: `Basic ${Buffer.from(`${ctx.credentials["apiKey"]}:`).toString("base64")}` } },
      ctx.http,
    );
    if (response.status !== 200) throw new AtsError("upstream", refused("Lever", response.status));
    const stages = ((JSON.parse(response.body) as { data?: { id: string; text?: string }[] }).data ?? []).map((st) => st.id);
    const mapped = Object.keys((ctx.settings["stageExams"] as Record<string, string> | undefined) ?? {});
    const unknown = mapped.filter((id) => !stages.includes(id));
    if (unknown.length > 0) throw new AtsError("upstream", `The API key works, but these stages are not in this Lever account: ${unknown.join(", ")}`);
    return `The API key works; ${stages.length} stages in the account, and ${mapped.length} mapped to exams all exist`;
  },
};

// --- Zoho Recruit ------------------------------------------------------------------------------

const ZOHO_CENTRES = ["in", "com", "eu", "com.au", "jp", "com.cn"] as const;

/**
 * Zoho Recruit: a workflow rule's webhook, sending the candidate's id, name,
 * email and mobile as JSON (and, optionally, which exam). The result goes back
 * as a note on the candidate through the v2 API, with an access token the
 * stored refresh token buys from Zoho's accounts server in the organisation's
 * data centre — India's by default.
 */
const zoho: Provider = {
  settings: z.object({ dataCentre: z.enum(ZOHO_CENTRES), defaultExamId: z.string().min(1).nullable() }),
  credentials: z.object({ clientId: z.string().min(1), clientSecret: z.string().min(1), refreshToken: z.string().min(1) }),

  async inbound(body, ctx) {
    const hook = z
      .object({
        candidateId: z.union([z.string(), z.number()]).transform(String),
        email: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        mobile: z.string().optional(),
        examId: z.string().optional(),
      })
      .safeParse(body);
    if (!hook.success) throw new AtsError("invalid_request", "Send candidateId, and the candidate's email, firstName, lastName and mobile, as JSON");
    const h = hook.data;
    const examId = h.examId ?? (ctx.settings["defaultExamId"] as string | null) ?? undefined;
    if (examId === undefined) return { ignore: "No exam named, and no default set" };
    return {
      externalId: h.candidateId,
      examId,
      name: splitName(`${h.firstName ?? ""} ${h.lastName ?? ""}`),
      email: h.email ?? null,
      phone: h.mobile === undefined ? null : indianMobile(h.mobile),
      detail: {},
    };
  },

  async report(candidate, outcome, ctx) {
    const dc = ctx.settings["dataCentre"] as string;
    const accounts = (ctx.bases.zoho ?? `https://accounts.zoho.${dc}`).replace(/\/$/, "");
    const recruit = (ctx.bases.zoho ?? `https://recruit.zoho.${dc}`).replace(/\/$/, "");
    const form = new URLSearchParams({
      refresh_token: ctx.credentials["refreshToken"]!,
      client_id: ctx.credentials["clientId"]!,
      client_secret: ctx.credentials["clientSecret"]!,
      grant_type: "refresh_token",
    }).toString();
    const token = await json(
      await safeRequest(`${accounts}/oauth/v2/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form }, ctx.http),
      "Zoho accounts",
    );
    if (typeof token["access_token"] !== "string") throw new PermanentFailure(`Zoho refused the refresh token: ${String(token["error"] ?? "no access token")}`);
    const response = await safeRequest(
      `${recruit}/recruit/v2/Notes`,
      {
        method: "POST",
        headers: { authorization: `Zoho-oauthtoken ${token["access_token"]}`, "content-type": "application/json" },
        body: JSON.stringify({
          data: [{ Note_Title: `Parikshaa: ${outcome.examTitle}`, Note_Content: outcomeText(outcome), Parent_Id: candidate.externalId, se_module: "Candidates" }],
        }),
      },
      ctx.http,
    );
    await json(response, "Zoho Recruit");
  },

  async check(ctx) {
    const dc = ctx.settings["dataCentre"] as string;
    const accounts = (ctx.bases.zoho ?? `https://accounts.zoho.${dc}`).replace(/\/$/, "");
    const form = new URLSearchParams({
      refresh_token: ctx.credentials["refreshToken"]!,
      client_id: ctx.credentials["clientId"]!,
      client_secret: ctx.credentials["clientSecret"]!,
      grant_type: "refresh_token",
    }).toString();
    const response = await safeRequest(`${accounts}/oauth/v2/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form }, ctx.http);
    if (response.status !== 200) throw new AtsError("upstream", refused(`Zoho's accounts server (zoho.${dc})`, response.status));
    const token = JSON.parse(response.body === "" ? "{}" : response.body) as Record<string, unknown>;
    if (typeof token["access_token"] !== "string") {
      throw new AtsError("upstream", `Zoho refused the refresh token (${String(token["error"] ?? "no access token")}): is the data centre zoho.${dc} the one the client was made in?`);
    }
    return `Zoho (zoho.${dc}) accepted the client and the refresh token`;
  },
};

// --- Darwinbox ---------------------------------------------------------------------------------

/**
 * Darwinbox: its recruitment workflow calls the hook with the candidate as
 * JSON; the result is posted to the callback address Darwinbox provides,
 * with the bearer token it issued. Darwinbox's partner API is not public, so
 * the shapes are this connector's own, and are set out in the console.
 */
const darwinbox: Provider = {
  settings: z.object({ callbackUrl: z.string().url(), defaultExamId: z.string().min(1).nullable() }),
  credentials: z.object({ callbackToken: z.string().min(1) }),

  async inbound(body, ctx) {
    const hook = z
      .object({
        candidate_id: z.union([z.string(), z.number()]).transform(String),
        name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        job_id: z.union([z.string(), z.number()]).transform(String).optional(),
        test_id: z.string().optional(),
      })
      .safeParse(body);
    if (!hook.success) throw new AtsError("invalid_request", "Send candidate_id, name, email and phone as JSON, and test_id to choose the exam");
    const h = hook.data;
    const examId = h.test_id ?? (ctx.settings["defaultExamId"] as string | null) ?? undefined;
    if (examId === undefined) return { ignore: "No test_id, and no default set" };
    return {
      externalId: h.candidate_id,
      examId,
      name: splitName(h.name ?? ""),
      email: h.email ?? null,
      phone: h.phone === undefined ? null : indianMobile(h.phone),
      detail: { jobId: h.job_id ?? null },
    };
  },

  async report(candidate, outcome, ctx) {
    const response = await safeRequest(
      ctx.settings["callbackUrl"] as string,
      {
        method: "POST",
        headers: { authorization: `Bearer ${ctx.credentials["callbackToken"]}`, "content-type": "application/json" },
        body: JSON.stringify({
          candidate_id: candidate.externalId,
          job_id: candidate.detail["jobId"] ?? null,
          test_name: outcome.examTitle,
          status: outcome.state === "void" ? "set_aside" : "completed",
          score: outcome.total,
          max_score: outcome.maxTotal,
          percent: outcome.percent,
          report_url: outcome.reportUrl,
          completed_at: outcome.completedAt,
        }),
      },
      ctx.http,
    );
    await json(response, "Darwinbox");
  },

  // Darwinbox gives no call that reads without writing, so this asks the
  // callback address whether it answers at all, with the token, and posts nothing.
  async check(ctx) {
    const response = await safeRequest(ctx.settings["callbackUrl"] as string, { method: "GET", headers: { authorization: `Bearer ${ctx.credentials["callbackToken"]}` } }, ctx.http);
    if (response.status === 401 || response.status === 403) throw new AtsError("upstream", refused("Darwinbox's callback", response.status));
    if (response.status >= 500) throw new AtsError("upstream", `Darwinbox's callback answered ${response.status}`);
    return `The callback address answers (${response.status}); a result is posted there only when a candidate is graded`;
  },
};

const PROVIDERS: Record<AtsProvider, Provider> = { lever, zoho_recruit: zoho, darwinbox };

/** The prefix a candidate's reference carries, so it is plain which ATS sent them. */
const PREFIX: Record<AtsProvider, string> = { lever: "LV", zoho_recruit: "ZR", darwinbox: "DB" };

export interface AtsView {
  readonly provider: AtsProvider;
  readonly label: string;
  readonly configured: boolean;
  readonly enabled: boolean;
  readonly settings: Record<string, unknown>;
  readonly credentialsSet: boolean;
}

export interface AtsOptions {
  readonly integrations: IntegrationStore;
  readonly invitationService: InvitationService;
  readonly invitations: InvitationStore;
  readonly store: LedgerStore;
  readonly exams: ExamService;
  readonly secrets: IntegrationSecrets;
  readonly sealer: StaffSecrets;
  readonly publicUrl: string;
  readonly http?: SafeHttpOptions;
  readonly bases?: AtsBaseUrls;
}

const actorFor = (orgId: OrgId, provider: AtsProvider): Actor => ({ kind: "api_key", id: provider, orgId, role: "author", name: ATS_LABELS[provider] });

export class AtsService {
  readonly #o: AtsOptions;

  constructor(options: AtsOptions) {
    this.#o = options;
  }

  #require(actor: Actor) {
    if (!can(actor, "org:manage")) throw new Forbidden("org:manage");
    return staffScope(actor.orgId);
  }

  hookUrl(provider: AtsProvider, key: string): string {
    return `${this.#o.publicUrl.replace(/\/$/, "")}/api/integrations/ats/${provider}/hook/${encodeURIComponent(key)}`;
  }

  #view(provider: AtsProvider, connector: AtsConnector | null): AtsView {
    return {
      provider,
      label: ATS_LABELS[provider],
      configured: connector !== null,
      enabled: connector?.enabled ?? false,
      settings: connector?.settings ?? {},
      credentialsSet: connector?.credentials != null,
    };
  }

  async list(actor: Actor): Promise<readonly AtsView[]> {
    const connectors = await this.#o.integrations.atsConnectors(this.#require(actor));
    return ATS_PROVIDERS.map((p) => this.#view(p, connectors.find((c) => c.provider === p) ?? null));
  }

  /** Save and turn on. Credentials left out keep the stored ones. */
  async save(actor: Actor, provider: AtsProvider, settings: unknown, credentials: unknown): Promise<AtsView> {
    const scope = this.#require(actor);
    const def = PROVIDERS[provider];
    const parsedSettings = def.settings.safeParse(settings);
    if (!parsedSettings.success) throw new AttemptError("invalid_integration", `Settings for ${ATS_LABELS[provider]}: ${parsedSettings.error.issues[0]?.message ?? "not valid"}`);
    let sealed: string | null = null;
    if (credentials !== undefined && credentials !== null) {
      const parsed = def.credentials.safeParse(credentials);
      if (!parsed.success) throw new AttemptError("invalid_integration", `Credentials for ${ATS_LABELS[provider]}: ${parsed.error.issues[0]?.message ?? "not valid"}`);
      sealed = this.#o.sealer.seal("ats-credentials", `${actor.orgId}/${provider}`, JSON.stringify(parsed.data));
    } else if ((await this.#o.integrations.atsConnector(scope, provider))?.credentials == null) {
      throw new AttemptError("invalid_integration", `${ATS_LABELS[provider]} needs its credentials`);
    }
    if (provider === "darwinbox") checkUrl(parsedSettings.data["callbackUrl"] as string, this.#o.http ?? {});
    const saved = await this.#o.integrations.saveAtsConnector(scope, provider, parsedSettings.data, sealed);
    await this.#o.exams.recordAudit(actor, "ats.configured", provider);
    return this.#view(provider, saved);
  }

  /** A new inbound key and the hook URL that carries it. Shown once; the previous key stops working. */
  async issueKey(actor: Actor, provider: AtsProvider): Promise<{ key: string; hookUrl: string }> {
    const version = await this.#o.integrations.rotateAtsKey(this.#require(actor), provider);
    if (version === null) throw new AttemptError("not_found", `Set up ${ATS_LABELS[provider]} first`);
    await this.#o.exams.recordAudit(actor, "ats.key_issued", provider, { version });
    const key = this.#o.secrets.atsKey(actor.orgId, provider, version);
    return { key, hookUrl: this.hookUrl(provider, key) };
  }

  async disable(actor: Actor, provider: AtsProvider): Promise<void> {
    await this.#o.integrations.disableAtsConnector(this.#require(actor), provider);
    await this.#o.exams.recordAudit(actor, "ats.disabled", provider);
  }

  /** Prove a connector's credentials against the live account, changing nothing there. Audited. */
  async check(actor: Actor, provider: AtsProvider): Promise<AtsCheck> {
    const scope = this.#require(actor);
    const connector = await this.#o.integrations.atsConnector(scope, provider);
    if (connector === null) throw new AttemptError("not_found", `Set up ${ATS_LABELS[provider]} first`);
    let outcome: AtsCheck;
    try {
      outcome = { ok: true, detail: await PROVIDERS[provider].check(this.#context(actor.orgId, connector)) };
    } catch (error) {
      if (error instanceof AtsError) outcome = { ok: false, detail: error.message };
      else if (error instanceof Error && /blocked|not allowed|private/i.test(error.message)) outcome = { ok: false, detail: error.message };
      else outcome = { ok: false, detail: `${ATS_LABELS[provider]} could not be reached: ${error instanceof Error ? error.message : String(error)}` };
    }
    await this.#o.exams.recordAudit(actor, "ats.checked", provider, { ok: outcome.ok });
    return outcome;
  }

  #context(orgId: OrgId, connector: AtsConnector): Context {
    const opened = connector.credentials === null ? null : this.#o.sealer.open("ats-credentials", `${orgId}/${connector.provider}`, connector.credentials);
    if (opened === null) throw new AtsError("not_configured", `${ATS_LABELS[connector.provider]}'s credentials cannot be read; set them again`);
    return { settings: connector.settings, credentials: JSON.parse(opened) as Record<string, string>, http: this.#o.http ?? {}, bases: this.#o.bases ?? {} };
  }

  /**
   * The ATS asks for a test. Asked twice for the same candidate and exam — an
   * ATS retries — it is the same invitation.
   */
  async inbound(provider: AtsProvider, key: string, body: unknown): Promise<{ invitationId: string } | { ignored: string }> {
    const claimed = this.#o.secrets.verifyAtsKey(key);
    if (claimed === null || claimed.provider !== provider) throw new AtsError("unauthorised", "Not a key this server issued");
    const orgId = toOrgId(claimed.orgId);
    const scope = staffScope(orgId);
    const connector = await this.#o.integrations.atsConnector(scope, provider);
    if (connector === null || !connector.enabled || connector.keyVersion !== claimed.version) throw new AtsError("unauthorised", "That key is not current");

    const found = await PROVIDERS[provider].inbound(body, this.#context(orgId, connector));
    if ("ignore" in found) return { ignored: found.ignore };

    const actor = actorFor(orgId, provider);
    const ref = `${PREFIX[provider]}-${found.externalId}`;
    const existing = (await this.#o.invitations.list(scope, found.examId).catch(() => [])).find((i) => i.candidateRef === ref);
    if (existing?.revoked === true) return { ignored: "This candidate's test was withdrawn" };
    const invitation =
      existing ??
      (await this.#o.invitationService.inviteOne(
        actor,
        found.examId,
        { candidateRef: ref, name: found.name, email: found.email, phone: found.phone, source: { [provider]: { id: found.externalId } } },
        [...(found.email === null ? [] : (["email"] as const)), ...(found.phone === null ? [] : (["sms"] as const))],
      ));
    await this.#o.integrations.recordAtsCandidate(scope, { invitationId: invitation.id, provider, externalId: found.externalId, detail: found.detail });
    return { invitationId: invitation.id };
  }

  /** A graded or set-aside attempt an ATS sent: queue its result for that ATS. */
  readonly listener: EventListener = async (orgId, event, attemptId, eventItemId) => {
    if (event !== "attempt.graded" && event !== "attempt.voided") return;
    const scope = staffScope(toOrgId(orgId));
    const invitation = await this.#o.invitations.byAttempt(scope, attemptId);
    if (invitation === null) return;
    const candidate = await this.#o.integrations.atsCandidate(scope, invitation.id);
    if (candidate === null) return;
    await this.#o.integrations.enqueue(scope, [{ id: `${eventItemId}:ats`, kind: "ats", purpose: "result", subject: { invitationId: invitation.id } }]);
  };

  readonly handle: ItemHandler = async (item: OutboxItem) => {
    const orgId = toOrgId(item.orgId);
    const scope = staffScope(orgId);
    const invitationId = String(item.subject["invitationId"] ?? "");
    const candidate = await this.#o.integrations.atsCandidate(scope, invitationId);
    if (candidate === null) return { skip: "No ATS sent this candidate" };
    const connector = await this.#o.integrations.atsConnector(scope, candidate.provider);
    if (connector === null || !connector.enabled) return { skip: `The ${ATS_LABELS[candidate.provider]} connector is off` };
    const invitation = await this.#o.invitations.get(scope, invitationId);
    if (invitation === null || invitation.attemptId === null) return { skip: "Not started" };

    const [entries, definition] = await Promise.all([
      this.#o.store.load(scope, toAttemptId(invitation.attemptId)),
      this.#o.store.loadExam(scope, invitation.examId as never),
    ]);
    const result = definition === null ? null : resultOf(entries, definition);
    if (result === null || (result.state !== "graded" && result.state !== "void")) return { skip: "Not graded yet" };
    const outcome: AtsOutcome = {
      examTitle: definition!.title,
      state: result.state === "void" ? "void" : "graded",
      total: result.total,
      maxTotal: result.maxTotal,
      percent: result.percent,
      reportUrl: reportUrl(this.#o.publicUrl, result.attemptId),
      completedAt: result.submittedAt === null ? null : `${istStamp(result.submittedAt)} IST`,
      followUps: result.probes.asked,
    };
    try {
      await PROVIDERS[candidate.provider].report(candidate, outcome, this.#context(orgId, connector));
    } catch (error) {
      if (error instanceof UnsafeUrl || error instanceof AtsError) throw new PermanentFailure(error.message);
      throw error;
    }
    return "sent";
  };
}
