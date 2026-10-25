import { createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { SignJWT, createLocalJWKSet, exportJWK, jwtVerify, type JSONWebKeySet, type JWK } from "jose";
import { attemptId as toAttemptId, orgId as toOrgId, resultOf, type OrgId } from "@parikshaa/core";
import { staffScope, type IntegrationStore, type InvitationStore, type LedgerStore, type LtiPlatform, type LtiStore, type OutboxItem } from "@parikshaa/store";
import { PermanentFailure, type ItemHandler } from "./delivery.js";
import type { InvitationService } from "./invitation-service.js";
import { checkUrl, safeRequest, UnsafeUrl, type SafeHttpOptions } from "./safe-http.js";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";
import type { StaffSecrets } from "./staff-secrets.js";
import type { EventListener } from "./webhooks.js";

/**
 * LTI 1.3 (ROADMAP §7, universities): Moodle — or Canvas, Blackboard, any
 * LMS that speaks it — launches an exam from a course, and receives the grade.
 *
 * The launch is an OpenID Connect third-party login: the LMS calls
 * `/lti/login`, the browser is sent back to the LMS's authorisation endpoint
 * with a nonce and sealed state, and the LMS posts a signed ID token to
 * `/lti/launch`. The token is checked against the LMS's published keys,
 * issuer, audience, deployment, nonce and expiry. The activity names its exam
 * with the custom parameter `exam=<exam id>`.
 *
 * A learner becomes an invitation like any candidate — the same one each
 * time they launch — and the browser goes to their personal link, so the
 * privacy notice, window and resume all work as they do by email. A teacher
 * is shown what the activity sets and pointed at the console.
 *
 * The grade goes back through Assignment and Grade Services: once the attempt
 * is graded, the tool signs a client assertion with its own key, buys a token
 * for the score scope, and posts the score to the activity's grade-book
 * column. A set-aside attempt sends no score.
 */

const CLAIM = "https://purl.imsglobal.org/spec/lti/claim";
const AGS = "https://purl.imsglobal.org/spec/lti-ags/claim/endpoint";
const SCORE_SCOPE = "https://purl.imsglobal.org/spec/lti-ags/scope/score";
const STATE_TTL_MS = 10 * 60 * 1000;

/** `text` without its trailing slashes. A loop, not `/\/+$/`: that regex is quadratic on a long run of slashes, and an issuer is typed in. */
function withoutTrailingSlashes(text: string): string {
  let end = text.length;
  while (end > 0 && text[end - 1] === "/") end--;
  return text.slice(0, end);
}

export class LtiError extends Error {
  constructor(
    readonly code: "unknown_platform" | "invalid_launch" | "no_exam" | "not_found",
    message: string,
  ) {
    super(message);
    this.name = "LtiError";
  }
}

export interface PlatformInput {
  readonly name: string;
  readonly issuer: string;
  readonly clientId: string;
  readonly deploymentIds: readonly string[];
  readonly authLoginUrl: string;
  readonly authTokenUrl: string;
  readonly jwksUrl: string;
  readonly enabled?: boolean | undefined;
}

export interface PlatformView extends Omit<LtiPlatform, "toolPrivateKey" | "orgId"> {
  /** What to type into the LMS's tool registration. */
  readonly tool: {
    readonly toolUrl: string;
    readonly loginUrl: string;
    readonly redirectUrl: string;
    readonly jwksUrl: string;
    readonly customParameters: string;
  };
}

/** What a launch comes to: a learner to send to their test, or a teacher to show a page. */
export type LaunchOutcome =
  | { readonly kind: "learner"; readonly redirect: string }
  | { readonly kind: "instructor"; readonly examTitle: string; readonly examId: string; readonly consoleUrl: string };

export interface LtiOptions {
  readonly lti: LtiStore;
  /** Where the score's delivery is queued. */
  readonly outbox: Pick<IntegrationStore, "enqueue">;
  readonly invitationService: InvitationService;
  readonly invitations: InvitationStore;
  readonly store: LedgerStore;
  readonly exams: ExamService;
  readonly secrets: StaffSecrets;
  readonly publicUrl: string;
  readonly http?: SafeHttpOptions;
  readonly now?: () => number;
}

export class LtiService {
  readonly #o: LtiOptions;
  readonly #now: () => number;
  readonly #base: string;

  constructor(options: LtiOptions) {
    this.#o = options;
    this.#now = options.now ?? (() => Date.now());
    this.#base = options.publicUrl.replace(/\/+$/, "");
  }

  get loginUrl(): string {
    return `${this.#base}/api/lti/login`;
  }

  get launchUrl(): string {
    return `${this.#base}/api/lti/launch`;
  }

  #view(p: LtiPlatform): PlatformView {
    const { toolPrivateKey: _, orgId: __, ...rest } = p;
    return {
      ...rest,
      tool: {
        toolUrl: this.launchUrl,
        loginUrl: this.loginUrl,
        redirectUrl: this.launchUrl,
        jwksUrl: `${this.#base}/api/lti/${p.id}/jwks`,
        customParameters: "exam=<exam id>",
      },
    };
  }

  #require(actor: Actor) {
    if (!can(actor, "org:manage")) throw new Forbidden("org:manage");
  }

  #checkUrls(input: PlatformInput) {
    for (const url of [input.authLoginUrl, input.authTokenUrl, input.jwksUrl]) checkUrl(url, this.#o.http ?? {});
  }

  // --- registering an LMS (owner) ----------------------------------------------------------

  async platforms(actor: Actor): Promise<readonly PlatformView[]> {
    this.#require(actor);
    return (await this.#o.lti.platforms(actor.orgId)).map((p) => this.#view(p));
  }

  /** Register an LMS. The tool's key pair is made here; its private half is sealed and never leaves. */
  async register(actor: Actor, input: PlatformInput): Promise<PlatformView> {
    this.#require(actor);
    this.#checkUrls(input);
    const id = randomUUID();
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const platform: LtiPlatform = {
      id,
      orgId: actor.orgId,
      name: input.name.trim(),
      issuer: withoutTrailingSlashes(input.issuer.trim()),
      clientId: input.clientId.trim(),
      deploymentIds: input.deploymentIds.map((d) => d.trim()).filter((d) => d !== ""),
      authLoginUrl: input.authLoginUrl.trim(),
      authTokenUrl: input.authTokenUrl.trim(),
      jwksUrl: input.jwksUrl.trim(),
      toolKid: randomBytes(8).toString("hex"),
      toolPrivateKey: this.#o.secrets.seal("lti-key", id, pem),
      enabled: input.enabled ?? true,
    };
    try {
      await this.#o.lti.addPlatform(platform);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new AttemptError("invalid_state", "That issuer and client ID are already registered");
      throw error;
    }
    await this.#o.exams.recordAudit(actor, "lti.platform_registered", id, { issuer: platform.issuer });
    return this.#view(platform);
  }

  async update(actor: Actor, id: string, input: PlatformInput): Promise<PlatformView> {
    this.#require(actor);
    this.#checkUrls(input);
    const saved = await this.#o.lti.updatePlatform(actor.orgId, id, {
      name: input.name.trim(),
      issuer: withoutTrailingSlashes(input.issuer.trim()),
      clientId: input.clientId.trim(),
      deploymentIds: input.deploymentIds.map((d) => d.trim()).filter((d) => d !== ""),
      authLoginUrl: input.authLoginUrl.trim(),
      authTokenUrl: input.authTokenUrl.trim(),
      jwksUrl: input.jwksUrl.trim(),
      enabled: input.enabled ?? true,
    });
    if (saved === null) throw new AttemptError("not_found", "No such platform");
    await this.#o.exams.recordAudit(actor, "lti.platform_updated", id);
    return this.#view(saved);
  }

  /** The tool's public key for one platform, as the JWKS the LMS fetches. */
  async jwks(platformId: string): Promise<{ keys: Record<string, unknown>[] }> {
    const platform = await this.#o.lti.platform(platformId);
    if (platform === null) throw new LtiError("not_found", "No such platform");
    const pem = this.#o.secrets.open("lti-key", platform.id, platform.toolPrivateKey);
    if (pem === null) throw new LtiError("not_found", "The key cannot be read");
    const jwk = await exportJWK(createPublicKey(createPrivateKey(pem)));
    const key: JWK = { ...jwk, kid: platform.toolKid, alg: "RS256", use: "sig" };
    return { keys: [{ ...key }] };
  }

  // --- the launch -------------------------------------------------------------------------

  /** Step one: the LMS starts a login. Answer with where to send the browser. */
  async login(params: Record<string, string | undefined>): Promise<string> {
    const issuer = params["iss"];
    const loginHint = params["login_hint"];
    if (issuer === undefined || loginHint === undefined) throw new LtiError("invalid_launch", "iss and login_hint are required");
    const platform = await this.#o.lti.platformFor(issuer, params["client_id"] ?? null);
    if (platform === null) throw new LtiError("unknown_platform", "This LMS is not registered here");
    const nonce = randomBytes(24).toString("base64url");
    const state = this.#o.secrets.seal("lti-state", "state", JSON.stringify({ p: platform.id, n: nonce, e: this.#now() + STATE_TTL_MS }));
    const url = new URL(platform.authLoginUrl);
    const set = (k: string, v: string) => url.searchParams.set(k, v);
    set("scope", "openid");
    set("response_type", "id_token");
    set("response_mode", "form_post");
    set("prompt", "none");
    set("client_id", platform.clientId);
    set("redirect_uri", this.launchUrl);
    set("login_hint", loginHint);
    set("state", state);
    set("nonce", nonce);
    if (params["lti_message_hint"] !== undefined) set("lti_message_hint", params["lti_message_hint"]);
    return url.toString();
  }

  /** Step two: the LMS posts the signed launch. */
  async launch(idToken: string, stateParam: string): Promise<LaunchOutcome> {
    const opened = this.#o.secrets.open("lti-state", "state", stateParam);
    if (opened === null) throw new LtiError("invalid_launch", "This launch did not start here");
    const state = JSON.parse(opened) as { p: string; n: string; e: number };
    if (state.e <= this.#now()) throw new LtiError("invalid_launch", "The launch took too long; open the activity again");
    const platform = await this.#o.lti.platform(state.p);
    if (platform === null || !platform.enabled) throw new LtiError("unknown_platform", "This LMS is not registered here");

    const jwksResponse = await safeRequest(platform.jwksUrl, { method: "GET", headers: { accept: "application/json" } }, this.#o.http ?? {});
    if (jwksResponse.status !== 200) throw new LtiError("invalid_launch", "The LMS's keys could not be fetched");
    let claims: Record<string, unknown>;
    try {
      ({ payload: claims } = await jwtVerify(idToken, createLocalJWKSet(JSON.parse(jwksResponse.body) as JSONWebKeySet), {
        issuer: platform.issuer,
        audience: platform.clientId,
        currentDate: new Date(this.#now()),
        clockTolerance: 60,
      }));
    } catch (error) {
      throw new LtiError("invalid_launch", `The launch did not verify: ${(error as Error).message}`);
    }
    if (claims["nonce"] !== state.n) throw new LtiError("invalid_launch", "The launch is for another sign-in");
    const deployment = claims[`${CLAIM}/deployment_id`];
    if (typeof deployment !== "string" || (platform.deploymentIds.length > 0 && !platform.deploymentIds.includes(deployment))) {
      throw new LtiError("invalid_launch", "This deployment of the tool is not accepted");
    }
    if (claims[`${CLAIM}/message_type`] !== "LtiResourceLinkRequest" || claims[`${CLAIM}/version`] !== "1.3.0") {
      throw new LtiError("invalid_launch", "Only resource-link launches of LTI 1.3 are handled");
    }

    const custom = (claims[`${CLAIM}/custom`] ?? {}) as Record<string, unknown>;
    const examId = typeof custom["exam"] === "string" ? custom["exam"].trim() : "";
    if (examId === "") throw new LtiError("no_exam", "The activity does not name an exam: add the custom parameter exam=<exam id>");
    const orgId = platform.orgId;
    const scope = staffScope(orgId);
    const exam = await this.#o.store.loadExam(scope, examId as never);
    if (exam === null) throw new LtiError("no_exam", `There is no exam ${examId} here`);

    const roles = Array.isArray(claims[`${CLAIM}/roles`]) ? (claims[`${CLAIM}/roles`] as string[]) : [];
    const teaching = roles.some((r) => /#(Instructor|Administrator|ContentDeveloper|TeachingAssistant)$/.test(r) || r.endsWith("/Instructor"));
    if (teaching) {
      return { kind: "instructor", examTitle: exam.title, examId, consoleUrl: `${this.#base}/console/` };
    }

    const subject = String(claims["sub"] ?? "");
    if (subject === "") throw new LtiError("invalid_launch", "The launch names no user");
    const link = (claims[`${CLAIM}/resource_link`] ?? {}) as { id?: string };
    const ags = (claims[AGS] ?? {}) as { lineitem?: string; scope?: string[] };
    const name = typeof claims["name"] === "string" ? claims["name"] : [claims["given_name"], claims["family_name"]].filter((x) => typeof x === "string").join(" ");
    const email = typeof claims["email"] === "string" ? claims["email"] : null;

    // One invitation per person per platform per exam, however often they launch.
    const ref = `LTI-${subject}`.slice(0, 120);
    const actor: Actor = { kind: "api_key", id: `lti:${platform.id}`, orgId, role: "author", name: platform.name };
    const existing = (await this.#o.invitations.list(scope, examId)).find((i) => i.candidateRef === ref);
    if (existing?.revoked === true) throw new LtiError("invalid_launch", "This test was withdrawn for you. Ask your teacher.");
    // Launched from the LMS, the learner is here now: nothing needs emailing.
    const invitation = existing ?? (await this.#o.invitationService.inviteOne(actor, examId, { candidateRef: ref, name, email, phone: null, source: { lti: { platformId: platform.id, subject } } }, []));
    const canScore = typeof ags.lineitem === "string" && (ags.scope ?? []).includes(SCORE_SCOPE);
    await this.#o.lti.recordLaunch(scope, {
      invitationId: invitation.id,
      platformId: platform.id,
      subject,
      resourceLink: link.id ?? "",
      lineitem: canScore ? ags.lineitem! : null,
    });
    return { kind: "learner", redirect: this.#o.invitationService.link(orgId, invitation.id) };
  }

  // --- the grade --------------------------------------------------------------------------

  readonly listener: EventListener = async (orgId, event, attemptId, eventItemId) => {
    if (event !== "attempt.graded") return;
    const scope = staffScope(toOrgId(orgId));
    const invitation = await this.#o.invitations.byAttempt(scope, attemptId);
    if (invitation === null) return;
    const launch = await this.#o.lti.launch(scope, invitation.id);
    if (launch === null || launch.lineitem === null) return;
    await this.#o.outbox.enqueue(scope, [{ id: `${eventItemId}:lti`, kind: "lti", purpose: "score", subject: { invitationId: invitation.id } }]);
  };

  async #token(platform: LtiPlatform): Promise<string> {
    const pem = this.#o.secrets.open("lti-key", platform.id, platform.toolPrivateKey);
    if (pem === null) throw new PermanentFailure("The tool's key cannot be read");
    const now = Math.floor(this.#now() / 1000);
    const assertion = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: platform.toolKid, typ: "JWT" })
      .setIssuer(platform.clientId)
      .setSubject(platform.clientId)
      .setAudience(platform.authTokenUrl)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .setJti(randomUUID())
      .sign(createPrivateKey(pem));
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: assertion,
      scope: SCORE_SCOPE,
    }).toString();
    const response = await safeRequest(platform.authTokenUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body }, this.#o.http ?? {});
    const parsed = (() => {
      try {
        return JSON.parse(response.body) as { access_token?: unknown };
      } catch {
        return {};
      }
    })();
    if (response.status !== 200 || typeof parsed.access_token !== "string") {
      const detail = `The LMS refused a token (${response.status})`;
      if (response.status >= 400 && response.status < 500 && response.status !== 429) throw new PermanentFailure(detail);
      throw new Error(detail);
    }
    return parsed.access_token;
  }

  readonly handle: ItemHandler = async (item: OutboxItem) => {
    const orgId: OrgId = toOrgId(item.orgId);
    const scope = staffScope(orgId);
    const invitationId = String(item.subject["invitationId"] ?? "");
    const launch = await this.#o.lti.launch(scope, invitationId);
    if (launch === null || launch.lineitem === null) return { skip: "No grade-book column to write to" };
    const platform = await this.#o.lti.platform(launch.platformId);
    if (platform === null || !platform.enabled || platform.orgId !== orgId) return { skip: "The LMS is no longer registered" };
    const invitation = await this.#o.invitations.get(scope, invitationId);
    if (invitation === null || invitation.attemptId === null) return { skip: "Not started" };
    const [entries, definition] = await Promise.all([this.#o.store.load(scope, toAttemptId(invitation.attemptId)), this.#o.store.loadExam(scope, invitation.examId as never)]);
    const result = definition === null ? null : resultOf(entries, definition);
    if (result === null || result.state !== "graded" || result.total === null) return { skip: "Not graded" };

    try {
      const token = await this.#token(platform);
      // The scores endpoint is the line item's URL with /scores before any query.
      const [path, query] = launch.lineitem.split("?");
      const scores = `${path!.replace(/\/$/, "")}/scores${query === undefined ? "" : `?${query}`}`;
      const response = await safeRequest(
        scores,
        {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/vnd.ims.lis.v1.score+json" },
          body: JSON.stringify({
            userId: launch.subject,
            // A total can be negative with negative marking; a grade book cannot take that.
            scoreGiven: Math.max(0, result.total),
            scoreMaximum: result.maxTotal,
            activityProgress: "Completed",
            gradingProgress: "FullyGraded",
            timestamp: new Date(this.#now()).toISOString(),
            comment: `Parikshaa: ${definition!.title}`,
          }),
        },
        this.#o.http ?? {},
      );
      if (response.status >= 200 && response.status < 300) return "sent";
      const detail = `The LMS answered ${response.status} to the score`;
      if (response.status >= 400 && response.status < 500 && response.status !== 429) throw new PermanentFailure(detail);
      throw new Error(detail);
    } catch (error) {
      if (error instanceof UnsafeUrl) throw new PermanentFailure(error.message);
      throw error;
    }
  };
}
