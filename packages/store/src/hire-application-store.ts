import type { OrgId } from "@parikshaa/core";
import type { BlobStore } from "./blobs.js";
import { hireApplicant, hireScoped, hireStaff } from "./candidate-store.js";
import type { RoundKind } from "./hire-store.js";
import { enqueue, type OutboxDraft } from "./outbox-store.js";
import { NO_SEAL, type RecordSeal } from "./sealing.js";
import type { SqlExecutor } from "./sql.js";

/**
 * Applications to a company's jobs (docs/HIRE-V2.md §1, §10 S2–S4, S17, S20,
 * F5; H2b, migrations 0071–0072).
 *
 * An application keeps a copy of what the candidate gave when they applied:
 * their name, address, phone, profile, answers and resume, sealed under the
 * "hire" record key and bound to the organisation, the application and the
 * field. Later changes to their account do not change what the company was
 * sent. Beside the sealed values are blind indexes of the address, phone and
 * resume, so duplicates are found without reading them.
 *
 * Everything is written in the organisation's staff scope: a candidate's own
 * scope may read their applications and the events meant for them, never
 * write. Whether they may act is the service's to check, against the
 * candidate id this store is given.
 */

export type ApplicationStatus = "invited" | "not_claimed" | "active" | "rejected" | "withdrawn" | "hired" | "joined" | "did_not_join";
export type ApplicationSource = "link" | "careers" | "referral" | "manual" | "import";
export type RoundResultStatus = "pending" | "invited" | "in_progress" | "done" | "passed" | "failed" | "skipped" | "expired" | "abandoned";

/** What the candidate gave on applying, kept as it was then. */
export interface ApplicationSnapshot {
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  /** The profile as the candidate wrote it; the store seals it whole. */
  readonly profile: unknown;
  /** Answers to the job's screening questions, by question id. */
  readonly answers: Readonly<Record<string, string | number | null>>;
  readonly resume: { readonly text: string; readonly file: Uint8Array; readonly name: string; readonly type: "pdf" | "docx" } | null;
}

/** Blind indexes in the organisation (S20): of the address, the address with plus-tags and Gmail dots taken out, the phone, the resume. */
export interface ApplicationHashes {
  readonly email: string;
  readonly emailCanonical: string;
  readonly phone: string | null;
  readonly resume: string | null;
}

export interface NewApplication {
  readonly id: string;
  readonly jobId: string;
  readonly candidateId: string;
  readonly ref: string;
  readonly snapshot: ApplicationSnapshot;
  readonly hashes: ApplicationHashes;
  readonly source: ApplicationSource;
  readonly sourceTag: string | null;
  readonly referrer: string | null;
  readonly consent: { readonly version: string; readonly noticeHash: string };
  readonly aiOptOut: boolean;
  readonly deviceReady: boolean | null;
  /** A knockout answer missed: the application is made, and ends there. */
  readonly knockedOut: readonly string[];
  readonly now: Date;
  /** Mail to send about it, written with it. */
  readonly outbox: readonly OutboxDraft[];
}

/** The rules the application is held to, checked with the job locked so two at once cannot both pass. */
export interface ApplyRules {
  /** At most this many may apply to the job; null for no limit. */
  readonly maxApplicants: number | null;
  /** After a rejection or a joining that did not happen, the same person waits this long. */
  readonly reapplyAfterDays: number;
}

export type ApplyOutcome =
  | { readonly outcome: "created"; readonly id: string; readonly status: "active" | "rejected" }
  /** The person has a live application for this job already. `candidateId`: whose it is, if anyone has claimed it. */
  | { readonly outcome: "duplicate"; readonly id: string; readonly candidateId: string | null }
  /** They were turned down for this job less than `reapplyAfterDays` ago; they may apply again from `from`. */
  | { readonly outcome: "too_soon"; readonly from: string }
  | { readonly outcome: "full" }
  | { readonly outcome: "closed" };

/** One of a candidate's applications, as the portal is built from it (S4: no scores, no notes). */
export interface PortalApplication {
  readonly id: string;
  readonly orgId: string;
  readonly jobId: string;
  readonly status: ApplicationStatus;
  readonly roundId: string | null;
  readonly createdAt: string;
  readonly decidedAt: string | null;
  readonly job: { readonly title: string; readonly publicCode: string | null; readonly location: string; readonly status: string; readonly noteToCandidates: string };
  readonly rounds: readonly { readonly id: string; readonly kind: RoundKind; readonly title: string; readonly position: number; readonly status: RoundResultStatus | null }[];
  /** The timeline as the candidate may see it: only events written for them. `text`: a message's, opened (P14). */
  readonly events: readonly { readonly at: string; readonly kind: string; readonly roundId: string | null; readonly text: string | null }[];
}

/** What a mail about an application needs, read when it is sent. */
export interface ApplicationMailFacts {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly status: ApplicationStatus;
  readonly statusReason: string | null;
  /** When it was rejected or withdrawn: a rejection mail goes only for the rejection it was written for (H2c). */
  readonly decidedAt: string | null;
  /** The round it is in now. */
  readonly round: { readonly id: string; readonly kind: RoundKind; readonly title: string } | null;
  readonly job: {
    readonly title: string;
    readonly publicCode: string | null;
    readonly contactEmail: string | null;
    readonly noteToCandidates: string;
    readonly rejectionLine: string;
  };
  /** The words of the message asked for (`messageId`), opened; null if none was asked for or it is not this application's. */
  readonly message: string | null;
}

const iso = (d: string | Date) => new Date(d).toISOString();
const isoOrNull = (d: string | Date | null) => (d === null ? null : iso(d));
const isUnique = (error: unknown) => (error as { code?: string }).code === "23505";
const DAY = 86_400_000;

export class HireApplicationStore {
  readonly #sql: SqlExecutor;
  readonly #seal: RecordSeal;
  readonly #newId: () => string;
  readonly #blobs: BlobStore | null;

  /** `blobs`: where resume files go (sealed) when object storage is set up; otherwise they stay in the row. */
  constructor(sql: SqlExecutor, seal: RecordSeal = NO_SEAL, options: { readonly newId?: () => string; readonly blobs?: BlobStore | null } = {}) {
    this.#sql = sql;
    this.#seal = seal;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
    this.#blobs = options.blobs ?? null;
  }

  static aad(orgId: string, applicationId: string, field: string): string {
    return `hire/${orgId}/${applicationId}/${field}`;
  }

  /**
   * Make an application, with its first round, its "applied" event and its
   * mail, in one transaction with the job locked: the job must still take
   * applications and have room, and the person must not have a live
   * application to it, nor a rejection too recent.
   */
  async apply(orgId: OrgId, a: NewApplication, rules: ApplyRules): Promise<ApplyOutcome> {
    const aad = (field: string) => HireApplicationStore.aad(orgId, a.id, field);
    const resume = a.snapshot.resume;
    const sealedFile = resume === null ? null : this.#seal.bytes(resume.file, aad("resume_file"));
    const key = sealedFile === null || this.#blobs === null ? null : `hire/${orgId}/${a.id}/resume`;
    if (key !== null) await this.#blobs!.put(key, sealedFile!);
    let outcome: ApplyOutcome;
    try {
      outcome = await hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
        const job = await tx.query<{ status: string; taken: number }>(
          `SELECT status,
                  (SELECT count(*)::int FROM hire_applications x
                    WHERE x.org_id = j.org_id AND x.job_id = j.id AND x.status NOT IN ('invited', 'not_claimed')) AS taken
             FROM hire_jobs j WHERE org_id = $1 AND id = $2 FOR UPDATE`,
          [orgId, a.jobId],
        );
        if (job[0] === undefined || job[0].status !== "open") return { outcome: "closed" } as const;
        const before = await tx.query<{ id: string; candidate_id: string | null; status: ApplicationStatus; decided_at: string | Date | null }>(
          `SELECT id, candidate_id, status, decided_at FROM hire_applications
            WHERE org_id = $1 AND job_id = $2 AND email_canonical_hash = $3 AND erased_at IS NULL
            ORDER BY created_at DESC`,
          [orgId, a.jobId, a.hashes.emailCanonical],
        );
        const live = before.find((b) => b.status !== "rejected" && b.status !== "withdrawn" && b.status !== "did_not_join");
        if (live !== undefined) return { outcome: "duplicate", id: live.id, candidateId: live.candidate_id } as const;
        const wait = rules.reapplyAfterDays * DAY;
        const turnedDown = before.find((b) => (b.status === "rejected" || b.status === "did_not_join") && b.decided_at !== null && new Date(b.decided_at).getTime() + wait > a.now.getTime());
        if (turnedDown !== undefined) return { outcome: "too_soon", from: new Date(new Date(turnedDown.decided_at!).getTime() + wait).toISOString() } as const;
        if (rules.maxApplicants !== null && job[0].taken >= rules.maxApplicants) return { outcome: "full" } as const;

        const first = await tx.query<{ id: string }>(`SELECT id FROM hire_rounds WHERE org_id = $1 AND job_id = $2 ORDER BY position LIMIT 1`, [orgId, a.jobId]);
        const roundId = first[0]?.id ?? null;
        const rejected = a.knockedOut.length > 0;
        const s = a.snapshot;
        await tx.query(
          `INSERT INTO hire_applications
             (org_id, id, job_id, candidate_id, ref, name, email, phone, profile, answers, resume_text, resume_file, resume_key,
              resume_name, resume_type, email_hash, email_canonical_hash, phone_hash, resume_hash, source, source_tag, referrer,
              consent_version, notice_hash, consented_at, ai_opt_out, device_ready, round_id, status, status_reason,
              reject_reason, decided_at, round_since, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
                   $24, $25, $26, $27, $28, $29, $30, $31, $32, $25, $25, $25)`,
          [
            orgId,
            a.id,
            a.jobId,
            a.candidateId,
            a.ref,
            s.name,
            this.#seal.text(s.email, aad("email")),
            this.#seal.text(s.phone, aad("phone")),
            this.#seal.text(JSON.stringify(s.profile ?? null), aad("profile")),
            this.#seal.text(JSON.stringify(s.answers), aad("answers")),
            this.#seal.text(resume?.text ?? null, aad("resume_text")),
            key === null ? sealedFile : null,
            key,
            resume?.name ?? null,
            resume?.type ?? null,
            a.hashes.email,
            a.hashes.emailCanonical,
            a.hashes.phone,
            a.hashes.resume,
            a.source,
            a.sourceTag,
            a.referrer,
            a.consent.version,
            a.consent.noticeHash,
            a.now,
            a.aiOptOut,
            a.deviceReady,
            roundId,
            rejected ? "rejected" : "active",
            rejected ? "knockout" : null,
            rejected ? "other" : null,
            rejected ? a.now : null,
          ],
        );
        if (roundId !== null) {
          await tx.query(`INSERT INTO hire_round_results (org_id, application_id, round_id, status) VALUES ($1, $2, $3, $4)`, [
            orgId,
            a.id,
            roundId,
            rejected ? "failed" : "pending",
          ]);
        }
        await this.#event(tx, orgId, a.id, a.candidateId, "applied", "candidate", roundId, {}, a.now);
        if (rejected) await this.#event(tx, orgId, a.id, a.candidateId, "rejected", "system", roundId, { reason: "knockout", questions: a.knockedOut }, a.now);
        await enqueue(tx, orgId, a.outbox, this.#newId);
        return { outcome: "created", id: a.id, status: rejected ? "rejected" : "active" } as const;
      });
    } catch (error) {
      if (key !== null) await this.#blobs!.remove([key]);
      // Two applications by one person at the same moment: the second is the duplicate.
      if (isUnique(error)) {
        const live = await this.live(orgId, a.jobId, a.hashes.emailCanonical);
        if (live !== null) return { outcome: "duplicate", ...live };
      }
      throw error;
    }
    if (outcome.outcome !== "created" && key !== null) await this.#blobs!.remove([key]);
    return outcome;
  }

  /** The person's live application to a job, if any. */
  async live(orgId: OrgId, jobId: string, emailCanonicalHash: string): Promise<{ readonly id: string; readonly candidateId: string | null } | null> {
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
      const rows = await tx.query<{ id: string; candidate_id: string | null }>(
        `SELECT id, candidate_id FROM hire_applications
          WHERE org_id = $1 AND job_id = $2 AND email_canonical_hash = $3 AND erased_at IS NULL
            AND status NOT IN ('rejected', 'withdrawn', 'did_not_join')`,
        [orgId, jobId, emailCanonicalHash],
      );
      return rows[0] === undefined ? null : { id: rows[0].id, candidateId: rows[0].candidate_id };
    });
  }

  async #event(
    tx: SqlExecutor,
    orgId: OrgId,
    applicationId: string,
    candidateId: string | null,
    kind: string,
    by: string,
    roundId: string | null,
    detail: Record<string, unknown>,
    at: Date,
  ): Promise<void> {
    await tx.query(
      `INSERT INTO hire_events (org_id, id, application_id, candidate_id, at, kind, round_id, by, detail, candidate_visible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
      [orgId, this.#newId(), applicationId, candidateId, at, kind, roundId, by, JSON.stringify(detail)],
    );
  }

  /**
   * A candidate's applications in one organisation, for their portal. The
   * applications and their events are read in the candidate's own scope, so
   * the database itself keeps them to theirs (S4); the job, its rounds and
   * where the application stands in each are then read for those alone.
   */
  async forCandidate(orgId: OrgId, candidateId: string, applicationIds: readonly string[]): Promise<readonly PortalApplication[]> {
    if (applicationIds.length === 0) return [];
    const own = await hireScoped(this.#sql, hireApplicant(candidateId, orgId), async (tx) => ({
      applications: await tx.query<{
        id: string;
        job_id: string;
        status: ApplicationStatus;
        round_id: string | null;
        created_at: string | Date;
        decided_at: string | Date | null;
      }>(
        `SELECT id, job_id, status, round_id, created_at, decided_at FROM hire_applications
          WHERE org_id = $1 AND id = ANY($2) AND candidate_id = $3 AND erased_at IS NULL ORDER BY created_at DESC`,
        [orgId, [...applicationIds], candidateId],
      ),
      events: await tx.query<{ id: string; application_id: string; at: string | Date; kind: string; round_id: string | null; detail: Record<string, unknown> | string }>(
        `SELECT id, application_id, at, kind, round_id, detail FROM hire_events WHERE org_id = $1 AND application_id = ANY($2) ORDER BY at, seq`,
        [orgId, [...applicationIds]],
      ),
    }));
    if (own.applications.length === 0) return [];
    const ids = own.applications.map((a) => a.id);
    const jobIds = [...new Set(own.applications.map((a) => a.job_id))];
    const theirs = await hireScoped(this.#sql, hireStaff(orgId), async (tx) => ({
      jobs: await tx.query<{ id: string; title: string; public_code: string | null; location: string; status: string; note_to_candidates: string }>(
        `SELECT id, title, public_code, location, status, note_to_candidates FROM hire_jobs WHERE org_id = $1 AND id = ANY($2)`,
        [orgId, jobIds],
      ),
      rounds: await tx.query<{ id: string; job_id: string; kind: RoundKind; title: string; position: number }>(
        `SELECT id, job_id, kind, title, position FROM hire_rounds WHERE org_id = $1 AND job_id = ANY($2) ORDER BY position`,
        [orgId, jobIds],
      ),
      results: await tx.query<{ application_id: string; round_id: string; status: RoundResultStatus }>(
        `SELECT application_id, round_id, status FROM hire_round_results WHERE org_id = $1 AND application_id = ANY($2)`,
        [orgId, ids],
      ),
    }));
    return own.applications.map((a) => {
      const job = theirs.jobs.find((j) => j.id === a.job_id)!;
      return {
        id: a.id,
        orgId,
        jobId: a.job_id,
        status: a.status,
        roundId: a.round_id,
        createdAt: iso(a.created_at),
        decidedAt: isoOrNull(a.decided_at),
        job: { title: job.title, publicCode: job.public_code, location: job.location, status: job.status, noteToCandidates: job.note_to_candidates },
        rounds: theirs.rounds
          .filter((r) => r.job_id === a.job_id)
          .map((r) => ({
            id: r.id,
            kind: r.kind,
            title: r.title,
            position: r.position,
            status: theirs.results.find((x) => x.application_id === a.id && x.round_id === r.id)?.status ?? null,
          })),
        events: own.events
          .filter((e) => e.application_id === a.id)
          .map((e) => ({ at: iso(e.at), kind: e.kind, roundId: e.round_id, text: e.kind === "message" ? this.#messageText(orgId, a.id, e.id, e.detail) : null })),
      };
    });
  }

  /** A message's text (H2c), sealed per event: `hire/{org}/{application}/event:{event}`. */
  #messageText(orgId: string, applicationId: string, eventId: string, detail: Record<string, unknown> | string): string {
    const text = (typeof detail === "string" ? (JSON.parse(detail) as Record<string, unknown>) : detail)["text"];
    return typeof text === "string" ? this.#seal.open(text, HireApplicationStore.aad(orgId, applicationId, `event:${eventId}`)) : "";
  }

  /**
   * The candidate withdraws an application of theirs that is still going.
   * False if it is not theirs, or is not going any more.
   */
  async withdraw(orgId: OrgId, candidateId: string, applicationId: string, now: Date, outbox: readonly OutboxDraft[]): Promise<boolean> {
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
      const rows = await tx.query<{ round_id: string | null }>(
        `UPDATE hire_applications SET status = 'withdrawn', status_reason = 'candidate', decided_at = $4, updated_at = $4
          WHERE org_id = $1 AND id = $2 AND candidate_id = $3 AND status = 'active' AND erased_at IS NULL
          RETURNING round_id`,
        [orgId, applicationId, candidateId, now],
      );
      if (rows[0] === undefined) return false;
      await this.#event(tx, orgId, applicationId, candidateId, "withdrawn", "candidate", rows[0].round_id, {}, now);
      await enqueue(tx, orgId, outbox, this.#newId);
      return true;
    });
  }

  /** How many applications a job has taken (not counting people a company invited who have not applied). */
  async taken(orgId: OrgId, jobId: string): Promise<number> {
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
      const rows = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM hire_applications WHERE org_id = $1 AND job_id = $2 AND status NOT IN ('invited', 'not_claimed')`,
        [orgId, jobId],
      );
      return rows[0]!.n;
    });
  }

  /** What a mail about the application needs, opened. Null if it is gone or erased. */
  async mailFacts(orgId: OrgId, applicationId: string, options: { readonly messageId?: string | undefined } = {}): Promise<ApplicationMailFacts | null> {
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
      const rows = await tx.query<{
        id: string;
        name: string;
        email: string;
        status: ApplicationStatus;
        status_reason: string | null;
        decided_at: string | Date | null;
        round_id: string | null;
        round_kind: RoundKind | null;
        round_title: string | null;
        title: string;
        public_code: string | null;
        contact_email: string | null;
        note_to_candidates: string;
        rejection_line: string;
      }>(
        `SELECT a.id, a.name, a.email, a.status, a.status_reason, a.decided_at, r.id AS round_id, r.kind AS round_kind, r.title AS round_title,
                j.title, j.public_code, j.contact_email, j.note_to_candidates, j.rejection_line
           FROM hire_applications a
           JOIN hire_jobs j ON j.org_id = a.org_id AND j.id = a.job_id
           LEFT JOIN hire_rounds r ON r.org_id = a.org_id AND r.id = a.round_id
          WHERE a.org_id = $1 AND a.id = $2 AND a.erased_at IS NULL`,
        [orgId, applicationId],
      );
      const r = rows[0];
      if (r === undefined) return null;
      const message =
        options.messageId === undefined
          ? []
          : await tx.query<{ id: string; detail: Record<string, unknown> | string }>(
              `SELECT id, detail FROM hire_events WHERE org_id = $1 AND application_id = $2 AND id = $3 AND kind = 'message'`,
              [orgId, applicationId, options.messageId],
            );
      return {
        id: r.id,
        name: r.name,
        email: this.#seal.open(r.email, HireApplicationStore.aad(orgId, r.id, "email")),
        status: r.status,
        statusReason: r.status_reason,
        decidedAt: isoOrNull(r.decided_at),
        round: r.round_id === null ? null : { id: r.round_id, kind: r.round_kind!, title: r.round_title! },
        job: { title: r.title, publicCode: r.public_code, contactEmail: r.contact_email, noteToCandidates: r.note_to_candidates, rejectionLine: r.rejection_line },
        message: message[0] === undefined ? null : this.#messageText(orgId, r.id, message[0].id, message[0].detail),
      };
    });
  }

  /** What the candidate gave, opened: for the company (H2c) and for tests. */
  async snapshot(orgId: OrgId, applicationId: string): Promise<(ApplicationSnapshot & { readonly ref: string; readonly hashes: ApplicationHashes }) | null> {
    const row = await hireScoped(this.#sql, hireStaff(orgId), async (tx) =>
      (
        await tx.query<{
          name: string;
          email: string;
          phone: string | null;
          profile: string | null;
          answers: string | null;
          resume_text: string | null;
          resume_file: Buffer | null;
          resume_key: string | null;
          resume_name: string | null;
          resume_type: "pdf" | "docx" | null;
          ref: string;
          email_hash: string;
          email_canonical_hash: string;
          phone_hash: string | null;
          resume_hash: string | null;
        }>(
          `SELECT name, email, phone, profile, answers, resume_text, resume_file, resume_key, resume_name, resume_type, ref,
                  email_hash, email_canonical_hash, phone_hash, resume_hash
             FROM hire_applications WHERE org_id = $1 AND id = $2 AND erased_at IS NULL`,
          [orgId, applicationId],
        )
      )[0],
    );
    if (row === undefined) return null;
    const aad = (field: string) => HireApplicationStore.aad(orgId, applicationId, field);
    const sealed = row.resume_key !== null ? await this.#blobs?.get(row.resume_key) : row.resume_file;
    const profile = this.#seal.open(row.profile, aad("profile"));
    const answers = this.#seal.open(row.answers, aad("answers"));
    return {
      name: row.name,
      email: this.#seal.open(row.email, aad("email")),
      phone: this.#seal.open(row.phone, aad("phone")),
      profile: profile === null ? null : JSON.parse(profile),
      answers: answers === null ? {} : JSON.parse(answers),
      resume:
        row.resume_name === null || row.resume_type === null || sealed == null
          ? null
          : {
              text: this.#seal.open(row.resume_text, aad("resume_text")) ?? "",
              file: this.#seal.openBytes(Buffer.from(sealed), aad("resume_file")),
              name: row.resume_name,
              type: row.resume_type,
            },
      ref: row.ref,
      hashes: { email: row.email_hash, emailCanonical: row.email_canonical_hash, phone: row.phone_hash, resume: row.resume_hash },
    };
  }
}
