import { orgId as toOrgId, type OrgId } from "@parikshaa/core";
import { lifecycleSql, SAMPLE_EXAM_ID, staffScope, withScope } from "./ledger-store.js";
import type { SqlExecutor } from "./sql.js";

/**
 * What the operator of a pilot needs to know about each organisation, in one
 * place: who signed up, whether they are using it, and whether anything is
 * about to go wrong for them. Read one organisation at a time, each under its
 * own scope, as everything else is; there are few enough for that.
 */

export interface OrganisationFacts {
  readonly id: OrgId;
  readonly name: string;
  readonly createdAt: string;
  /** The first owner, and whether they have confirmed their address; null if it has none. */
  readonly owner: { readonly name: string; readonly email: string; readonly verified: boolean } | null;
  readonly staff: number;
  /** Exams of its own: the sample exam is not counted. */
  readonly exams: number;
  readonly sampleLoaded: boolean;
  readonly invited: number;
  readonly started: number;
  readonly awaitingGrading: number;
  readonly graded: number;
  /** Credits left on a prepaid plan; null for an invoiced organisation or one not billed. */
  readonly credits: number | null;
  readonly attemptsCharged: number;
  /** Messages to candidates or staff that were given up on. */
  readonly failedMessages: number;
  /** Messages that should have gone more than a quarter of an hour ago and have not: the worker is stuck. */
  readonly overdueMessages: number;
  /** When anyone last did anything the audit log records; null if nothing yet. */
  readonly lastActivity: string | null;
  /** The next window still to close, and how many candidates in it have not begun. */
  readonly nextSitting: {
    readonly examId: string;
    readonly title: string;
    readonly opensAt: string;
    readonly closesAt: string;
    readonly waiting: number;
  } | null;
}

export class ReportStore {
  readonly #sql: SqlExecutor;

  constructor(sql: SqlExecutor) {
    this.#sql = sql;
  }

  async organisations(now: Date): Promise<readonly OrganisationFacts[]> {
    const orgs = await this.#sql.query<{ id: string; name: string; created_at: string | Date }>(
      `SELECT id, name, created_at FROM organisations ORDER BY created_at, id`,
    );
    const facts: OrganisationFacts[] = [];
    for (const org of orgs) facts.push(await this.#organisation(toOrgId(org.id), org.name, new Date(org.created_at).toISOString(), now));
    return facts;
  }

  async #organisation(id: OrgId, name: string, createdAt: string, now: Date): Promise<OrganisationFacts> {
    return withScope(this.#sql, staffScope(id), async (tx) => {
      const [row] = await tx.query<{
        owner_name: string | null;
        owner_email: string | null;
        owner_verified: boolean | null;
        staff: string;
        exams: string;
        sample: boolean;
        invited: string;
        started: string;
        awaiting: string;
        graded: string;
        credits: number | null;
        charged: string;
        failed: string;
        overdue: string;
        last_activity: string | Date | null;
      }>(
        `WITH states AS (
           SELECT ${lifecycleSql("a.org_id", "a.id")} AS state FROM attempts a WHERE a.org_id = $1 AND a.exam_id <> $2
         ), owner AS (
           SELECT name, email, email_verified_at IS NOT NULL AS verified FROM staff_users
            WHERE org_id = $1 AND role = 'owner' AND disabled_at IS NULL ORDER BY created_at LIMIT 1
         )
         SELECT (SELECT name FROM owner) AS owner_name,
                (SELECT email FROM owner) AS owner_email,
                (SELECT verified FROM owner) AS owner_verified,
                (SELECT count(*) FROM staff_users WHERE org_id = $1 AND disabled_at IS NULL) AS staff,
                (SELECT count(*) FROM exams WHERE org_id = $1 AND id <> $2) AS exams,
                EXISTS (SELECT 1 FROM exams WHERE org_id = $1 AND id = $2 AND archived_at IS NULL) AS sample,
                (SELECT count(*) FROM invitations WHERE org_id = $1 AND revoked_at IS NULL) AS invited,
                (SELECT count(*) FROM invitations WHERE org_id = $1 AND attempt_id IS NOT NULL) AS started,
                (SELECT count(*) FROM states WHERE state = 'attempt_submitted') AS awaiting,
                (SELECT count(*) FROM states WHERE state = 'attempt_graded') AS graded,
                (SELECT credits FROM billing_accounts WHERE org_id = $1 AND mode = 'prepaid') AS credits,
                (SELECT count(*) FROM credit_ledger WHERE org_id = $1 AND reason = 'attempt') AS charged,
                (SELECT count(*) FROM outbox WHERE org_id = $1 AND status = 'failed') AS failed,
                (SELECT count(*) FROM outbox WHERE org_id = $1 AND status IN ('pending', 'sending')
                    AND send_after < $3::timestamptz - interval '15 minutes') AS overdue,
                (SELECT max(at) FROM audit_log WHERE org_id = $1) AS last_activity`,
        [id, SAMPLE_EXAM_ID, now.toISOString()],
      );
      const [next] = await tx.query<{ exam_id: string; title: string | null; opens_at: string | Date; closes_at: string | Date; waiting: string }>(
        `SELECT w.exam_id, e.definition ->> 'title' AS title, w.opens_at, w.closes_at,
                (SELECT count(*) FROM invitations i WHERE i.org_id = w.org_id AND i.exam_id = w.exam_id
                    AND i.revoked_at IS NULL AND i.attempt_id IS NULL) AS waiting
           FROM exam_windows w JOIN exams e ON e.org_id = w.org_id AND e.id = w.exam_id
          WHERE w.org_id = $1 AND w.closes_at > $2::timestamptz AND w.exam_id <> $3
          ORDER BY w.opens_at LIMIT 1`,
        [id, now.toISOString(), SAMPLE_EXAM_ID],
      );
      const r = row!;
      return {
        id,
        name,
        createdAt,
        owner: r.owner_email === null ? null : { name: r.owner_name ?? "", email: r.owner_email, verified: r.owner_verified === true },
        staff: Number(r.staff),
        exams: Number(r.exams),
        sampleLoaded: r.sample,
        invited: Number(r.invited),
        started: Number(r.started),
        awaitingGrading: Number(r.awaiting),
        graded: Number(r.graded),
        credits: r.credits === null ? null : Number(r.credits),
        attemptsCharged: Number(r.charged),
        failedMessages: Number(r.failed),
        overdueMessages: Number(r.overdue),
        lastActivity: r.last_activity === null ? null : new Date(r.last_activity).toISOString(),
        nextSitting:
          next === undefined
            ? null
            : {
                examId: next.exam_id,
                title: next.title ?? next.exam_id,
                opensAt: new Date(next.opens_at).toISOString(),
                closesAt: new Date(next.closes_at).toISOString(),
                waiting: Number(next.waiting),
              },
      };
    });
  }
}
