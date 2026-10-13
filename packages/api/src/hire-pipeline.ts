import {
  REJECT_REASONS,
  type ApplicationDetail,
  type HirePipelineStore,
  type HireStore,
  type IdentityStore,
  type IntegrityLevel,
  type Job,
  type Pipeline,
  type PipelineFilter,
  type PipelineRow,
  type RejectReason,
  type RoundKind,
  type ScreenRecommendation,
} from "@parikshaa/store";
import { HireRefused } from "./hire.js";
import { sniffResume } from "./resume.js";
import { Forbidden } from "./service.js";
import { can, type Actor, type Permission } from "./staff-auth.js";

/**
 * A job's pipeline for the company (docs/HIRE-V2.md §3, §5, §10 S3, S7, S15,
 * S18, S21, S22, P14, P15, P20, F6, B9; H2c): reading where every
 * application stands, and moving, rejecting and restoring them, with notes
 * for the team and messages to the candidates.
 *
 * Reading needs `hire:review`; everything else `hire:decide`, which only a
 * person holds (S7). A hiring manager sees and decides on the jobs they
 * manage alone; any other job is "not found" to them (F6).
 *
 * Contact details (address, phone, answers, profile, resume) go only to
 * those who may decide (S22): a viewer sees names, round states and scores.
 * The resume is downloaded as an attachment, by name and type taken from
 * its bytes, and each download is audited (S21); until Parikshaa verifies the
 * company its text may be read, not downloaded (S18).
 *
 * Audit entries name ids and counts, never what was written (S3).
 */

/** At most this many applications in one bulk move or reject. */
export const MAX_BULK = 200;
/** A typed reason (an override, a bulk reject on the AI's reading) is at least this long. */
export const MIN_REASON = 10;
/** A note or a message. */
export const MAX_TEXT = 2000;

export interface HirePipelineOptions {
  readonly jobs: HireStore;
  readonly pipeline: HirePipelineStore;
  readonly identity: IdentityStore;
  readonly recordAudit: (actor: Actor, action: string, target: string, detail?: Record<string, unknown>) => Promise<void>;
  readonly now?: () => number;
}

export interface MoveInput {
  readonly ids: readonly string[];
  /** A round of the job, or "next": each to the round after its own. */
  readonly to: string;
  /** Needed to move an application whose integrity is `high` and not found genuine (≥10 characters). */
  readonly overrideReason?: string | null | undefined;
}

export interface RejectInput {
  readonly ids: readonly string[];
  readonly rejectReason: RejectReason;
  /** Send the polite rejection mail, a day later (P14). */
  readonly mail: boolean;
  /** The filter the list was chosen with. On the AI's recommendation, a typed reason is needed (S15). */
  readonly filter?: { readonly recommendation?: ScreenRecommendation | null | undefined } | null | undefined;
  readonly reason?: string | null | undefined;
}

/** What a bulk action did: the ids it changed, and why each other one was not. */
export interface BulkOutcome {
  readonly done: readonly string[];
  readonly refused: readonly { readonly id: string; readonly reason: string }[];
}

export interface PipelineView extends Pipeline {
  readonly job: {
    readonly id: string;
    readonly title: string;
    readonly status: Job["status"];
    readonly reviewSlaDays: number;
    readonly rounds: readonly { readonly id: string; readonly kind: RoundKind; readonly title: string; readonly position: number }[];
  };
}

/** One application for the drawer, as this actor may see it (S22). */
export interface ApplicationView {
  readonly id: string;
  readonly jobId: string;
  readonly ref: string;
  readonly name: string;
  readonly status: ApplicationDetail["status"];
  readonly rejectReason: RejectReason | null;
  readonly roundId: string | null;
  readonly roundSince: string;
  readonly createdAt: string;
  readonly decidedAt: string | null;
  readonly source: ApplicationDetail["source"];
  readonly sourceTag: string | null;
  readonly aiOptOut: boolean;
  readonly deviceReady: boolean | null;
  readonly results: readonly (Omit<ApplicationDetail["results"][number], "decidedBy"> & { readonly decidedBy: string | null })[];
  readonly screening: PipelineRow["screening"];
  readonly integrity: { readonly level: IntegrityLevel; readonly verdict: "genuine" | "not_genuine" | null };
  /** Who did what, by name. `text` (notes, messages, override reasons) only for those who may decide. */
  readonly timeline: readonly {
    readonly id: string;
    readonly at: string;
    readonly kind: string;
    readonly roundId: string | null;
    readonly by: string;
    readonly text: string | null;
    readonly candidateVisible: boolean;
  }[];
  /** Null for those who may not decide on it (S22). */
  readonly contact: {
    readonly email: string;
    readonly phone: string | null;
    readonly referrer: string | null;
    readonly profile: unknown;
    readonly answers: Readonly<Record<string, string | number | null>>;
    readonly resume: { readonly name: string; readonly type: "pdf" | "docx"; readonly text: string } | null;
    /** False until Parikshaa verifies the company (S18). */
    readonly resumeDownload: boolean;
  } | null;
}

export interface ResumeDownload {
  readonly file: Buffer;
  readonly filename: string;
  readonly contentType: string;
}

const CONTENT_TYPES = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } as const;

/** A resume's name as a download: no path, no quotes or control characters, its extension from its bytes. */
export function resumeFilename(name: string, type: "pdf" | "docx"): string {
  const base = (name.split(/[\\/]/).pop() ?? "")
    .replace(/\.[A-Za-z0-9]{1,5}$/, "")
    .replace(/[^A-Za-z0-9 ._()-]+/g, "_")
    .replace(/^[ ._]+|[ ._]+$/g, "")
    .slice(0, 80);
  return `${base === "" ? "resume" : base}.${type}`;
}

/** The ids asked for, once each; refused when there are none or too many. */
function bulkIds(ids: readonly string[]): string[] {
  const unique = [...new Set(ids)];
  if (unique.length === 0) throw new HireRefused("invalid", "Choose at least one application", ["no_applications"]);
  if (unique.length > MAX_BULK) throw new HireRefused("invalid", `At most ${MAX_BULK} applications at a time`, ["too_many"]);
  return unique;
}

function text(value: string, what: string): string {
  const t = value.trim();
  if (t === "") throw new HireRefused("invalid", `Write the ${what} first`, ["empty"]);
  if (t.length > MAX_TEXT) throw new HireRefused("invalid", `Keep the ${what} under ${MAX_TEXT} characters`, ["too_long"]);
  return t;
}

export class HirePipeline {
  readonly #o: HirePipelineOptions;
  readonly #now: () => number;

  constructor(o: HirePipelineOptions) {
    this.#o = o;
    this.#now = o.now ?? (() => Date.now());
  }

  #require(actor: Actor, permission: Permission): void {
    if (!can(actor, permission)) throw new Forbidden(permission);
  }

  /** The job, if this actor sees it: a hiring manager only the jobs they manage (F6). */
  async #job(actor: Actor, jobId: string): Promise<Job> {
    const job = await this.#o.jobs.job(actor.orgId, jobId);
    const manager = actor.kind === "user" && actor.role === "hiring_manager";
    if (job === null || (manager && !job.managers.includes(actor.id))) throw new HireRefused("not_found", "There is no such job");
    return job;
  }

  /** The application's job, if this actor sees it; an application they may not see is not found. */
  async #ofApplication(actor: Actor, applicationId: string): Promise<Job> {
    const jobId = await this.#o.pipeline.jobOf(actor.orgId, applicationId);
    if (jobId === null) throw new HireRefused("not_found", "There is no such application");
    try {
      return await this.#job(actor, jobId);
    } catch (error) {
      if (error instanceof HireRefused) throw new HireRefused("not_found", "There is no such application");
      throw error;
    }
  }

  // --- reading ------------------------------------------------------------------

  async pipeline(actor: Actor, jobId: string, filter: PipelineFilter): Promise<PipelineView> {
    this.#require(actor, "hire:review");
    const job = await this.#job(actor, jobId);
    const read = await this.#o.pipeline.pipeline(actor.orgId, jobId, filter, new Date(this.#now()));
    return {
      job: {
        id: job.id,
        title: job.title,
        status: job.status,
        reviewSlaDays: job.reviewSlaDays,
        rounds: job.rounds.map((r) => ({ id: r.id, kind: r.kind, title: r.title, position: r.position })),
      },
      ...read,
    };
  }

  async application(actor: Actor, applicationId: string): Promise<ApplicationView> {
    this.#require(actor, "hire:review");
    await this.#ofApplication(actor, applicationId);
    const a = await this.#o.pipeline.application(actor.orgId, applicationId);
    if (a === null) throw new HireRefused("not_found", "There is no such application");
    const decides = can(actor, "hire:decide");
    const names = new Map((await this.#o.identity.listUsers(actor.orgId)).map((u) => [u.id, u.name]));
    const who = (by: string | null) => (by === null ? null : (names.get(by) ?? (by === "candidate" || by === "system" ? by : "A former member of staff")));
    return {
      id: a.id,
      jobId: a.jobId,
      ref: a.ref,
      name: a.name,
      status: a.status,
      rejectReason: a.rejectReason,
      roundId: a.roundId,
      roundSince: a.roundSince,
      createdAt: a.createdAt,
      decidedAt: a.decidedAt,
      source: a.source,
      sourceTag: a.sourceTag,
      aiOptOut: a.aiOptOut,
      deviceReady: a.deviceReady,
      results: a.results.map((r) => ({ ...r, decidedBy: who(r.decidedBy) })),
      screening: a.screening,
      integrity: a.integrity,
      timeline: a.events.map((e) => ({ id: e.id, at: e.at, kind: e.kind, roundId: e.roundId, by: who(e.by)!, text: decides ? e.text : null, candidateVisible: e.candidateVisible })),
      contact: decides
        ? {
            email: a.email,
            phone: a.phone,
            referrer: a.referrer,
            profile: a.profile,
            answers: a.answers,
            resume: a.resume,
            resumeDownload: a.resume !== null && (await this.#verified(actor)),
          }
        : null,
    };
  }

  async #verified(actor: Actor): Promise<boolean> {
    return (await this.#o.identity.getOrganisation(actor.orgId))?.verified != null;
  }

  /** The resume file, for those who may decide on the application, once the company is verified (S18, S21, S22). */
  async resume(actor: Actor, applicationId: string): Promise<ResumeDownload> {
    this.#require(actor, "hire:decide");
    await this.#ofApplication(actor, applicationId);
    if (!(await this.#verified(actor))) {
      throw new HireRefused("limit", "Until Parikshaa verifies your company, resumes can be read here but not downloaded", ["unverified"]);
    }
    const found = await this.#o.pipeline.resumeFile(actor.orgId, applicationId);
    if (found === null) throw new HireRefused("not_found", "This application has no resume");
    const type = sniffResume(found.file);
    if (type === null) throw new HireRefused("conflict", "The file is not a PDF or a Word document", ["unreadable"]);
    await this.#o.recordAudit(actor, "hire.resume_downloaded", applicationId, {});
    return { file: found.file, filename: resumeFilename(found.name, type), contentType: CONTENT_TYPES[type] };
  }

  // --- deciding -----------------------------------------------------------------

  /**
   * Move applications of a job to a round, or each to its next. One whose
   * integrity is `high` and not found genuine moves only with a reason of
   * ten characters or more: an override, kept privately and audited.
   */
  async move(actor: Actor, jobId: string, input: MoveInput): Promise<BulkOutcome> {
    this.#require(actor, "hire:decide");
    await this.#job(actor, jobId);
    const ids = bulkIds(input.ids);
    const reason = input.overrideReason?.trim() ?? "";
    if (reason !== "" && reason.length < MIN_REASON) {
      throw new HireRefused("invalid", `Say why in at least ${MIN_REASON} characters`, ["override_needs_reason"]);
    }
    const out = await this.#o.pipeline.move(actor.orgId, jobId, ids, input.to, actor.id, new Date(this.#now()), reason === "" ? {} : { overrideReason: reason });
    if (!out.roundFound) throw new HireRefused("invalid", "That round is not one of this job's", ["no_such_round"]);
    const done = out.results.filter((r) => r.outcome === "moved").map((r) => r.id);
    const refused = out.results
      .filter((r) => r.outcome !== "moved")
      .map((r) => ({ id: r.id, reason: r.outcome === "integrity_high" ? "override_needs_reason" : r.outcome }));
    if (done.length > 0) await this.#o.recordAudit(actor, "hire.moved", jobId, { count: done.length, to: input.to, applications: done });
    const overridden = out.results.filter((r) => r.override === true).map((r) => r.id);
    if (overridden.length > 0) await this.#o.recordAudit(actor, "hire.override", jobId, { count: overridden.length, applications: overridden });
    return { done, refused };
  }

  /**
   * Reject applications of a job, with the reason the company keeps (P20)
   * and, if asked, the mail a day later (P14). Rejecting a list chosen by
   * the AI's recommendation needs a typed reason (S15), kept as a note on each.
   */
  async reject(actor: Actor, jobId: string, input: RejectInput): Promise<BulkOutcome> {
    this.#require(actor, "hire:decide");
    await this.#job(actor, jobId);
    const ids = bulkIds(input.ids);
    if (!REJECT_REASONS.includes(input.rejectReason)) throw new HireRefused("invalid", "Choose why the application is not going ahead", ["reject_reason"]);
    const onAi = input.filter?.recommendation ?? null;
    const reason = input.reason?.trim() ?? "";
    if (onAi !== null && reason.length < MIN_REASON) {
      throw new HireRefused("invalid", `These were chosen by the AI's reading: say why you reject them, in at least ${MIN_REASON} characters`, ["reason_needed"]);
    }
    if (reason.length > MAX_TEXT) throw new HireRefused("invalid", `Keep the reason under ${MAX_TEXT} characters`, ["too_long"]);
    const now = new Date(this.#now());
    const out = await this.#o.pipeline.reject(actor.orgId, jobId, ids, input.rejectReason, actor.id, now, { mail: input.mail });
    const done = out.filter((r) => r.outcome === "rejected").map((r) => r.id);
    if (onAi !== null) {
      for (const id of done) await this.#o.pipeline.note(actor.orgId, id, `Rejected with others chosen by the AI's reading (${onAi}): ${reason}`, actor.id, now);
    }
    if (done.length > 0) {
      await this.#o.recordAudit(actor, "hire.rejected", jobId, {
        count: done.length,
        rejectReason: input.rejectReason,
        mail: input.mail,
        ...(onAi === null ? {} : { filter: { recommendation: onAi } }),
        applications: done,
      });
    }
    return { done, refused: out.filter((r) => r.outcome !== "rejected").map((r) => ({ id: r.id, reason: r.outcome })) };
  }

  /** Bring a rejected application back; its rejection mail, if still waiting, is not sent. */
  async restore(actor: Actor, applicationId: string): Promise<ApplicationView> {
    this.#require(actor, "hire:decide");
    await this.#ofApplication(actor, applicationId);
    const outcome = await this.#o.pipeline.restore(actor.orgId, applicationId, actor.id, new Date(this.#now()));
    switch (outcome) {
      case "not_found":
        throw new HireRefused("not_found", "There is no such application");
      case "not_rejected":
        throw new HireRefused("conflict", "Only a rejected application can be restored; a withdrawn one never", ["not_rejected"]);
      case "newer_application":
        throw new HireRefused("conflict", "This person has applied to the job again since: that application is the one to work on", ["newer_application"]);
      case "restored":
        await this.#o.recordAudit(actor, "hire.restored", applicationId, {});
        return this.application(actor, applicationId);
    }
  }

  /** A note for the team; the candidate never sees it (S4). */
  async note(actor: Actor, applicationId: string, body: string): Promise<ApplicationView> {
    this.#require(actor, "hire:decide");
    await this.#ofApplication(actor, applicationId);
    const id = await this.#o.pipeline.note(actor.orgId, applicationId, text(body, "note"), actor.id, new Date(this.#now()));
    if (id === null) throw new HireRefused("not_found", "There is no such application");
    await this.#o.recordAudit(actor, "hire.note_added", applicationId, {});
    return this.application(actor, applicationId);
  }

  /** A message to the candidate (P14): shown in their portal and mailed. */
  async message(actor: Actor, applicationId: string, body: string): Promise<ApplicationView> {
    this.#require(actor, "hire:decide");
    await this.#ofApplication(actor, applicationId);
    const out = await this.#o.pipeline.message(actor.orgId, applicationId, text(body, "message"), actor.id, new Date(this.#now()));
    if (out.outcome === "not_found") throw new HireRefused("not_found", "There is no such application");
    if (out.outcome === "withdrawn") throw new HireRefused("conflict", "The candidate withdrew this application", ["withdrawn"]);
    await this.#o.recordAudit(actor, "hire.messaged", applicationId, {});
    return this.application(actor, applicationId);
  }
}
