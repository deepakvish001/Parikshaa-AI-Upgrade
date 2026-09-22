import { attemptId as toAttemptId, orgId as toOrgId, resultOf, type OrgId } from "@parikshaa/core";
import { staffScope, type IntegrationStore, type InvitationStore, type LedgerStore } from "@parikshaa/store";
import { indianMobile } from "./candidate-import.js";
import { PermanentFailure, type ItemHandler } from "./delivery.js";
import type { IntegrationSecrets } from "./integration-secrets.js";
import type { InvitationService } from "./invitation-service.js";
import { istStamp } from "./results.js";
import { safeRequest, UnsafeUrl, type SafeHttpOptions } from "./safe-http.js";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";
import { reportUrl, type EventListener } from "./webhooks.js";

/**
 * Greenhouse's Assessment Partner API (ROADMAP §7).
 *
 * Greenhouse calls four endpoints here with the organisation's key as the
 * Basic-auth username: `list_tests` (the organisation's exams), `send_test`
 * (invite a candidate — the invitation email goes out from here, as the
 * protocol expects), `test_status`, and `response_error`. When an attempt is
 * graded or set aside, the worker sends Greenhouse the `PATCH` that marks the
 * test complete, which Greenhouse requires of new integrations in place of
 * polling; Greenhouse then asks `test_status` for the score.
 *
 * The key is derived, not stored (see `IntegrationSecrets`). Greenhouse acts
 * with an author's rights and no more: it can list exams, invite, and read a
 * result, and never sees an answer key or a follow-up.
 */

export interface SendTest {
  readonly partner_test_id: string;
  readonly candidate: {
    readonly first_name: string;
    readonly last_name: string;
    readonly preferred_name?: string | null | undefined;
    readonly email: string;
    readonly phone_number?: string | null | undefined;
    readonly greenhouse_profile_url?: string | null | undefined;
    readonly id?: number | string | null | undefined;
  };
  readonly application: { readonly id: number | string };
  readonly sent_by?: string | null | undefined;
  readonly url: string;
}

export interface TestStatus {
  readonly partner_status: string;
  readonly partner_profile_url?: string;
  readonly partner_score?: number;
  readonly metadata?: Record<string, string | number>;
}

export interface GreenhouseOptions {
  readonly integrations: IntegrationStore;
  readonly invitationService: InvitationService;
  readonly invitations: InvitationStore;
  readonly store: LedgerStore;
  readonly exams: ExamService;
  readonly secrets: IntegrationSecrets;
  readonly publicUrl: string;
  readonly http?: SafeHttpOptions;
  /** Hosts the completion call may go to. Greenhouse's own, unless testing. */
  readonly hosts?: readonly string[];
}

const actorFor = (orgId: OrgId): Actor => ({ kind: "api_key", id: "greenhouse", orgId, role: "author", name: "Greenhouse" });

export class GreenhouseService {
  readonly #o: GreenhouseOptions;
  readonly #hosts: readonly string[];

  constructor(options: GreenhouseOptions) {
    this.#o = options;
    this.#hosts = options.hosts ?? ["greenhouse.io"];
  }

  // --- set-up, by the organisation's owner ------------------------------------

  #require(actor: Actor) {
    if (!can(actor, "org:manage")) throw new Forbidden("org:manage");
    return staffScope(actor.orgId);
  }

  async settings(actor: Actor): Promise<{ enabled: boolean; endpoints: Record<string, string> }> {
    const settings = await this.#o.integrations.greenhouse(this.#require(actor));
    return { enabled: settings?.enabled ?? false, endpoints: this.endpoints() };
  }

  /** Turn the connector on, or replace its key. The key is shown now; the previous one stops working. */
  async issueKey(actor: Actor): Promise<{ key: string; endpoints: Record<string, string> }> {
    const settings = await this.#o.integrations.issueGreenhouseKey(this.#require(actor));
    await this.#o.exams.recordAudit(actor, "greenhouse.key_issued", actor.orgId, { version: settings.keyVersion });
    return { key: this.#o.secrets.greenhouseKey(actor.orgId, settings.keyVersion), endpoints: this.endpoints() };
  }

  async disable(actor: Actor): Promise<void> {
    await this.#o.integrations.disableGreenhouse(this.#require(actor));
    await this.#o.exams.recordAudit(actor, "greenhouse.disabled", actor.orgId);
  }

  /** The four URLs to send Greenhouse's partnerships team. */
  endpoints(): Record<string, string> {
    const base = `${this.#o.publicUrl.replace(/\/$/, "")}/api/integrations/greenhouse`;
    return {
      list_tests: `${base}/list_tests`,
      send_test: `${base}/send_test`,
      test_status: `${base}/test_status`,
      response_error: `${base}/response_error`,
    };
  }

  // --- Greenhouse's side ------------------------------------------------------

  /** The organisation a request is for, from its `Authorization: Basic` header; null if the key is not current. */
  async authenticate(authorization: string | undefined): Promise<Actor | null> {
    const match = authorization?.match(/^Basic\s+([A-Za-z0-9+/=]+)$/);
    if (match === null || match === undefined) return null;
    const decoded = Buffer.from(match[1]!, "base64").toString("utf8");
    const key = decoded.includes(":") ? decoded.slice(0, decoded.indexOf(":")) : decoded;
    const claimed = this.#o.secrets.verifyGreenhouseKey(key);
    if (claimed === null) return null;
    const orgId = toOrgId(claimed.orgId);
    const settings = await this.#o.integrations.greenhouse(staffScope(orgId));
    if (settings === null || !settings.enabled || settings.keyVersion !== claimed.version) return null;
    return actorFor(orgId);
  }

  async listTests(actor: Actor): Promise<{ partner_test_id: string; partner_test_name: string }[]> {
    const exams = await this.#o.store.listExams(staffScope(actor.orgId));
    return exams.map((e) => ({ partner_test_id: e.id, partner_test_name: e.title }));
  }

  /** Invite the candidate. Sent twice — Greenhouse retries — it is the same invitation. */
  async sendTest(actor: Actor, body: SendTest): Promise<{ partner_interview_id: string }> {
    const scope = staffScope(actor.orgId);
    const ref = `GH-${body.application.id}`;
    const existing = (await this.#o.invitations.list(scope, body.partner_test_id)).find((i) => i.candidateRef === ref);
    if (existing?.revoked === true) throw new AttemptError("invalid_state", "This candidate's test was withdrawn");
    const phone = body.candidate.phone_number == null ? null : indianMobile(body.candidate.phone_number);
    const invitation =
      existing ??
      (await this.#o.invitationService.inviteOne(
        actor,
        body.partner_test_id,
        {
          candidateRef: ref,
          name: `${body.candidate.first_name} ${body.candidate.last_name}`.trim(),
          email: body.candidate.email,
          phone,
          source: {
            greenhouse: { applicationId: String(body.application.id), candidateId: body.candidate.id == null ? null : String(body.candidate.id) },
          },
        },
        phone === null ? ["email"] : ["email", "sms"],
      ));
    await this.#o.integrations.recordInterview(scope, {
      invitationId: invitation.id,
      applicationId: String(body.application.id),
      profileUrl: body.candidate.greenhouse_profile_url ?? null,
      completeUrl: body.url,
      sentBy: body.sent_by ?? null,
    });
    return { partner_interview_id: invitation.id };
  }

  async testStatus(actor: Actor, interviewId: string): Promise<TestStatus> {
    const scope = staffScope(actor.orgId);
    const invitation = await this.#o.invitations.get(scope, interviewId);
    if (invitation === null) throw new AttemptError("not_found", "No such test");
    if (invitation.attemptId === null) return { partner_status: invitation.revoked ? "withdrawn" : "sent" };

    const entries = await this.#o.store.load(scope, toAttemptId(invitation.attemptId));
    const definition = await this.#o.store.loadExam(scope, invitation.examId as never);
    const result = definition === null ? null : resultOf(entries, definition);
    if (result === null) return { partner_status: "in_progress" };
    if (result.state === "in_progress") return { partner_status: "in_progress" };
    if (result.state === "submitted") return { partner_status: "awaiting_grading" };

    const metadata: Record<string, string | number> = { "Started At": `${istStamp(result.startedAt)} IST` };
    if (result.submittedAt !== null) metadata["Completed At"] = `${istStamp(result.submittedAt)} IST`;
    const profile = reportUrl(this.#o.publicUrl, result.attemptId);
    if (result.state === "void") {
      return { partner_status: "complete", partner_profile_url: profile, metadata: { ...metadata, Outcome: "Set aside — see the report for why" } };
    }
    metadata["Marks"] = `${result.total} / ${result.maxTotal}`;
    if (result.probes.asked > 0) metadata["Follow-up questions"] = `${result.probes.asked} asked; see the report`;
    return {
      partner_status: "complete",
      partner_profile_url: profile,
      ...(result.percent === null ? {} : { partner_score: result.percent }),
      metadata,
    };
  }

  /** Greenhouse telling us a reply of ours did not validate. Kept in the audit log, without the candidate's email. */
  async responseError(
    actor: Actor,
    report: { api_call: string; errors: readonly string[]; partner_interview_id?: string | null | undefined; partner_test_id?: string | null | undefined },
  ) {
    await this.#o.exams.recordAudit(actor, "greenhouse.response_error", report.partner_interview_id ?? report.api_call, {
      apiCall: report.api_call,
      errors: report.errors.slice(0, 20),
      partnerTestId: report.partner_test_id ?? null,
    });
  }

  // --- telling Greenhouse a test is done ---------------------------------------

  /** Listens to announcements: a graded or set-aside attempt that Greenhouse sent gets its completion call queued. */
  readonly listener: EventListener = async (orgId, event, attemptId, eventItemId) => {
    if (event !== "attempt.graded" && event !== "attempt.voided") return;
    const scope = staffScope(toOrgId(orgId));
    const invitation = await this.#o.invitations.byAttempt(scope, attemptId);
    if (invitation === null) return;
    const interview = await this.#o.integrations.interview(scope, invitation.id);
    if (interview === null) return;
    await this.#o.integrations.enqueue(scope, [
      { id: `${eventItemId}:greenhouse`, kind: "greenhouse", purpose: "complete", subject: { invitationId: invitation.id } },
    ]);
  };

  readonly handle: ItemHandler = async (item) => {
    const orgId = toOrgId(item.orgId);
    const scope = staffScope(orgId);
    const settings = await this.#o.integrations.greenhouse(scope);
    if (settings === null || !settings.enabled) return { skip: "The Greenhouse connector is off" };
    const interview = await this.#o.integrations.interview(scope, String(item.subject["invitationId"]));
    if (interview === null) return { skip: "Greenhouse did not send this test" };

    let host: string;
    try {
      host = new URL(interview.completeUrl).hostname;
    } catch {
      throw new PermanentFailure("Greenhouse gave a URL that does not parse");
    }
    if (!this.#hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      throw new PermanentFailure(`${host} is not a Greenhouse address`);
    }

    const key = this.#o.secrets.greenhouseKey(orgId, settings.keyVersion);
    let response;
    try {
      response = await safeRequest(
        interview.completeUrl,
        { method: "PATCH", headers: { authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` } },
        this.#o.http,
      );
    } catch (error) {
      if (error instanceof UnsafeUrl) throw new PermanentFailure(error.message);
      throw error;
    }
    if (response.status >= 200 && response.status < 300) return "sent";
    const detail = `Greenhouse answered ${response.status}`;
    // Greenhouse refuses updates for a candidate who is hired or no longer active; that will not change.
    if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) throw new PermanentFailure(detail);
    throw new Error(detail);
  };
}
