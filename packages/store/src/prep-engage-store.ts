import type { OrgId } from "@parikshaa/core";
import { practiceStaff, type PracticeScope } from "./practice-store.js";
import type { SqlExecutor } from "./sql.js";
import { enqueue } from "./outbox-store.js";

/**
 * Bringing learners back, and knowing whether they come (Prep blueprint F2,
 * §17; migration 0030): the daily reminder each learner sets, and the
 * numbers the console reads.
 *
 * The numbers are counted from the tables that already record what learners
 * do — sign-ups, submissions, lessons done, plan tasks done, the tutor,
 * orders, and the daily check-in coin, which is paid the first time a learner
 * opens their dashboard in a day — so nothing has to be instrumented, and the
 * history before this was built counts too. Days are India's.
 */

function scoped<T>(sql: SqlExecutor, scope: PracticeScope, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  return sql.transaction(fn, {
    "parikshaa.org_id": scope.orgId,
    "parikshaa.actor": scope.actor,
    "parikshaa.attempt_id": "",
    "parikshaa.learner_id": scope.actor === "learner" ? (scope.learnerId ?? "") : "",
  });
}

export interface ReminderPrefs {
  readonly enabled: boolean;
  /** The hour of the day in India, 0 to 23. */
  readonly hour: number;
}

export const DEFAULT_REMINDER: ReminderPrefs = { enabled: false, hour: 19 };

export interface PrepAnalytics {
  readonly from: string;
  readonly to: string;
  /** Learners who signed up in the window, and what they went on to do (at any time). */
  readonly funnel: {
    readonly signedUp: number;
    readonly startedPlan: number;
    readonly solvedOne: number;
    readonly usedTutor: number;
    readonly bought: number;
  };
  /** Of those who signed up in the window at least 7 days ago: solved a problem within 7 days of signing up. */
  readonly activation: { readonly cohort: number; readonly activated: number };
  /** Of those who signed up at least 1 (or 7) days ago in the window: came back that day. */
  readonly retention: { readonly d1: { readonly cohort: number; readonly returned: number }; readonly d7: { readonly cohort: number; readonly returned: number } };
  readonly days: readonly { readonly day: string; readonly active: number; readonly signups: number; readonly solves: number }[];
  readonly reminders: { readonly enabled: number; readonly sentInWindow: number };
}

/**
 * Every day a learner did something, as one set of (learner, IST day) rows.
 * The SQL is shared by the queries below; `$1` is the organisation.
 */
const ACTIVITY = `
  SELECT learner_id, (created_at AT TIME ZONE 'Asia/Kolkata')::date AS day FROM practice_submissions WHERE org_id = $1
  UNION SELECT learner_id, (created_at AT TIME ZONE 'Asia/Kolkata')::date FROM prep_coins WHERE org_id = $1
  UNION SELECT learner_id, (done_at AT TIME ZONE 'Asia/Kolkata')::date FROM prep_lessons_done WHERE org_id = $1
  UNION SELECT learner_id, (done_at AT TIME ZONE 'Asia/Kolkata')::date FROM prep_tasks WHERE org_id = $1 AND done_at IS NOT NULL
  UNION SELECT learner_id, (created_at AT TIME ZONE 'Asia/Kolkata')::date FROM prep_tutor WHERE org_id = $1`;

export class PrepEngageStore {
  readonly #sql: SqlExecutor;

  constructor(sql: SqlExecutor) {
    this.#sql = sql;
  }

  async reminder(scope: PracticeScope, learnerId: string): Promise<ReminderPrefs> {
    return scoped(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ enabled: boolean; hour: number }>(`SELECT enabled, hour FROM prep_reminders WHERE org_id = $1 AND learner_id = $2`, [scope.orgId, learnerId]);
      return rows[0] === undefined ? DEFAULT_REMINDER : { enabled: rows[0].enabled, hour: Number(rows[0].hour) };
    });
  }

  async saveReminder(scope: PracticeScope, learnerId: string, prefs: ReminderPrefs): Promise<void> {
    await scoped(this.#sql, scope, (tx) =>
      tx.query(
        `INSERT INTO prep_reminders (org_id, learner_id, enabled, hour, updated_at) VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (org_id, learner_id) DO UPDATE SET enabled = $3, hour = $4, updated_at = now()`,
        [scope.orgId, learnerId, prefs.enabled, prefs.hour],
      ),
    );
  }

  /**
   * Learners due a reminder now: theirs is on, for this hour, they have an
   * active plan with tasks left for today (or before) or cards due, and they
   * have not been sent one today. Each is marked sent, and its email queued,
   * in the same transaction, so a second run in the hour finds no one.
   */
  async takeDue(orgId: OrgId, day: string, hour: number, newId: () => string = () => crypto.randomUUID()): Promise<readonly string[]> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const rows = await tx.query<{ learner_id: string }>(
        `INSERT INTO prep_reminders_sent (org_id, learner_id, day)
         SELECT r.org_id, r.learner_id, $2::date
           FROM prep_reminders r
           JOIN learners l ON l.id = r.learner_id AND l.org_id = r.org_id AND l.erased_at IS NULL
          WHERE r.org_id = $1 AND r.enabled AND r.hour = $3
            AND (EXISTS (SELECT 1 FROM prep_tasks t JOIN prep_plans p ON p.org_id = t.org_id AND p.id = t.plan_id AND p.status = 'active'
                          WHERE t.org_id = r.org_id AND t.learner_id = r.learner_id AND t.day <= $2::date AND t.done_at IS NULL)
              OR EXISTS (SELECT 1 FROM prep_cards c WHERE c.org_id = r.org_id AND c.learner_id = r.learner_id AND c.due_on <= $2::date))
         ON CONFLICT DO NOTHING
         RETURNING learner_id`,
        [orgId, day, hour],
      );
      await enqueue(
        tx,
        orgId,
        rows.map((r) => ({ kind: "learner_email" as const, subject: { learnerId: r.learner_id, day }, purpose: "reminder", id: `reminder:${orgId}:${r.learner_id}:${day}` })),
        newId,
      );
      return rows.map((r) => r.learner_id);
    });
  }

  /** The window's numbers: `from` and `to` are IST days, inclusive; `asOf` is now, by the caller's clock. */
  async analytics(orgId: OrgId, from: string, to: string, asOf: Date): Promise<PrepAnalytics> {
    const today = new Date(asOf.getTime() + 330 * 60_000).toISOString().slice(0, 10);
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const n = (v: unknown) => Number(v ?? 0);
      const [funnel] = await tx.query<Record<string, string>>(
        `WITH joined AS (
           SELECT id, created_at FROM learners
            WHERE org_id = $1 AND erased_at IS NULL AND (created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $2::date AND $3::date)
         SELECT count(*) AS signed_up,
                count(*) FILTER (WHERE EXISTS (SELECT 1 FROM prep_plans p WHERE p.org_id = $1 AND p.learner_id = j.id)) AS started_plan,
                count(*) FILTER (WHERE EXISTS (SELECT 1 FROM practice_submissions s WHERE s.org_id = $1 AND s.learner_id = j.id AND s.status = 'passed')) AS solved_one,
                count(*) FILTER (WHERE EXISTS (SELECT 1 FROM prep_tutor t WHERE t.org_id = $1 AND t.learner_id = j.id)) AS used_tutor,
                count(*) FILTER (WHERE EXISTS (SELECT 1 FROM prep_orders o WHERE o.org_id = $1 AND o.learner_id = j.id AND o.status = 'paid')) AS bought,
                count(*) FILTER (WHERE j.created_at <= $4::timestamptz - interval '7 days') AS week_old,
                count(*) FILTER (WHERE j.created_at <= $4::timestamptz - interval '7 days' AND EXISTS (
                  SELECT 1 FROM practice_submissions s WHERE s.org_id = $1 AND s.learner_id = j.id AND s.status = 'passed' AND s.created_at < j.created_at + interval '7 days')) AS activated
           FROM joined j`,
        [orgId, from, to, asOf.toISOString()],
      );
      const [retention] = await tx.query<Record<string, string>>(
        `WITH joined AS (
           SELECT id, (created_at AT TIME ZONE 'Asia/Kolkata')::date AS day FROM learners
            WHERE org_id = $1 AND erased_at IS NULL AND (created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $2::date AND $3::date),
         active AS (${ACTIVITY})
         SELECT count(*) FILTER (WHERE j.day + 1 <= $4::date) AS d1_cohort,
                count(*) FILTER (WHERE j.day + 1 <= $4::date AND EXISTS (SELECT 1 FROM active a WHERE a.learner_id = j.id AND a.day = j.day + 1)) AS d1_returned,
                count(*) FILTER (WHERE j.day + 7 <= $4::date) AS d7_cohort,
                count(*) FILTER (WHERE j.day + 7 <= $4::date AND EXISTS (SELECT 1 FROM active a WHERE a.learner_id = j.id AND a.day = j.day + 7)) AS d7_returned
           FROM joined j`,
        [orgId, from, to, today],
      );
      const days = await tx.query<{ day: string; active: string; signups: string; solves: string }>(
        `WITH active AS (${ACTIVITY})
         SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
                (SELECT count(DISTINCT learner_id) FROM active a WHERE a.day = d::date) AS active,
                (SELECT count(*) FROM learners l WHERE l.org_id = $1 AND (l.created_at AT TIME ZONE 'Asia/Kolkata')::date = d::date) AS signups,
                (SELECT count(*) FROM practice_submissions s WHERE s.org_id = $1 AND s.status = 'passed' AND (s.created_at AT TIME ZONE 'Asia/Kolkata')::date = d::date) AS solves
           FROM generate_series($2::date, $3::date, interval '1 day') d
          ORDER BY d`,
        [orgId, from, to],
      );
      const [reminders] = await tx.query<Record<string, string>>(
        `SELECT (SELECT count(*) FROM prep_reminders WHERE org_id = $1 AND enabled) AS enabled,
                (SELECT count(*) FROM prep_reminders_sent WHERE org_id = $1 AND day BETWEEN $2::date AND $3::date) AS sent`,
        [orgId, from, to],
      );
      return {
        from,
        to,
        funnel: { signedUp: n(funnel!["signed_up"]), startedPlan: n(funnel!["started_plan"]), solvedOne: n(funnel!["solved_one"]), usedTutor: n(funnel!["used_tutor"]), bought: n(funnel!["bought"]) },
        activation: { cohort: n(funnel!["week_old"]), activated: n(funnel!["activated"]) },
        retention: {
          d1: { cohort: n(retention!["d1_cohort"]), returned: n(retention!["d1_returned"]) },
          d7: { cohort: n(retention!["d7_cohort"]), returned: n(retention!["d7_returned"]) },
        },
        days: days.map((d) => ({ day: d.day, active: n(d.active), signups: n(d.signups), solves: n(d.solves) })),
        reminders: { enabled: n(reminders!["enabled"]), sentInWindow: n(reminders!["sent"]) },
      };
    });
  }
}
