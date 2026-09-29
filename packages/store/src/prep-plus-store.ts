import type { OrgId } from "@parikshaa/core";
import type { UsageRecord } from "./ledger-store.js";
import { practiceStaff, type PracticeScope } from "./practice-store.js";
import type { SqlExecutor } from "./sql.js";

/**
 * Plus and the tutor's credits (ROADMAP §16, migration 0020): what a practice
 * site sells, what a learner holds, and what the tutor said.
 *
 * Money and credits are written only in the staff scope, by the server: row-
 * level security lets a learner read their own orders, Plus and credits, and
 * never write one. The credit ledger is added to, never changed, and each row
 * carries a key so the same grant or charge is never made twice.
 */

function scoped<T>(sql: SqlExecutor, scope: PracticeScope, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  return sql.transaction(fn, {
    "parikshaa.org_id": scope.orgId,
    "parikshaa.actor": scope.actor,
    "parikshaa.attempt_id": "",
    "parikshaa.learner_id": scope.actor === "learner" ? (scope.learnerId ?? "") : "",
  });
}

function own(scope: PracticeScope): string {
  if (scope.actor !== "learner" || scope.learnerId === null) throw new Error("Only a signed-in learner has rows of their own");
  return scope.learnerId;
}

const iso = (value: string | Date) => new Date(value).toISOString();

export interface PrepSettings {
  readonly plusEnabled: boolean;
  readonly freeModules: number;
  readonly monthlyCredits: number;
  readonly tutorEnabled: boolean;
}

export const DEFAULT_PREP_SETTINGS: PrepSettings = { plusEnabled: false, freeModules: 1, monthlyCredits: 100, tutorEnabled: true };

export interface PrepProduct {
  readonly id: string;
  readonly title: string;
  readonly kind: "plus" | "credits";
  readonly days: number;
  readonly credits: number;
  readonly pricePaise: number;
  readonly active: boolean;
  readonly position: number;
}
export type PrepProductDraft = Omit<PrepProduct, "id">;

export interface PrepOrder {
  readonly id: string;
  readonly learnerId: string;
  readonly productId: string;
  readonly title: string;
  readonly days: number;
  readonly credits: number;
  readonly amountPaise: number;
  readonly taxPaise: number;
  readonly gatewayOrderId: string;
  readonly paymentId: string | null;
  readonly status: "created" | "paid";
  readonly createdAt: string;
  readonly paidAt: string | null;
}

export interface PlusSpan {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly source: "payment" | "grant" | "coins";
}

export type CreditReason = "monthly" | "purchase" | "grant" | "spend" | "refund";

export interface TutorEntry {
  readonly id: string;
  readonly mode: "hint" | "review" | "doubt";
  readonly problemId: string | null;
  readonly lessonId: string | null;
  readonly hintLevel: number | null;
  readonly question: string;
  readonly answer: string;
  readonly credits: number;
  readonly model: string;
  readonly createdAt: string;
}

interface OrderRow {
  id: string;
  learner_id: string;
  product_id: string;
  title: string;
  days: number;
  credits: number;
  amount_paise: number;
  tax_paise: number;
  gateway_order_id: string;
  payment_id: string | null;
  status: "created" | "paid";
  created_at: string | Date;
  paid_at: string | Date | null;
}
const ORDER_COLUMNS = "id, learner_id, product_id, title, days, credits, amount_paise, tax_paise, gateway_order_id, payment_id, status, created_at, paid_at";
const toOrder = (r: OrderRow): PrepOrder => ({
  id: r.id,
  learnerId: r.learner_id,
  productId: r.product_id,
  title: r.title,
  days: Number(r.days),
  credits: Number(r.credits),
  amountPaise: Number(r.amount_paise),
  taxPaise: Number(r.tax_paise),
  gatewayOrderId: r.gateway_order_id,
  paymentId: r.payment_id,
  status: r.status,
  createdAt: iso(r.created_at),
  paidAt: r.paid_at === null ? null : iso(r.paid_at),
});

interface ProductRow {
  id: string;
  title: string;
  kind: "plus" | "credits";
  days: number;
  credits: number;
  price_paise: number;
  active: boolean;
  position: number;
}
const toProduct = (r: ProductRow): PrepProduct => ({
  id: r.id,
  title: r.title,
  kind: r.kind,
  days: Number(r.days),
  credits: Number(r.credits),
  pricePaise: Number(r.price_paise),
  active: r.active,
  position: Number(r.position),
});

export class PrepPlusStore {
  readonly #sql: SqlExecutor;
  readonly #newId: () => string;

  constructor(sql: SqlExecutor, options: { readonly newId?: () => string } = {}) {
    this.#sql = sql;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  // --- settings and products -------------------------------------------------------------

  async settings(scope: PracticeScope): Promise<PrepSettings> {
    return scoped(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ plus_enabled: boolean; free_modules: number; monthly_credits: number; tutor_enabled: boolean }>(
        `SELECT plus_enabled, free_modules, monthly_credits, tutor_enabled FROM prep_settings WHERE org_id = $1`,
        [scope.orgId],
      );
      const r = rows[0];
      return r === undefined
        ? DEFAULT_PREP_SETTINGS
        : { plusEnabled: r.plus_enabled, freeModules: Number(r.free_modules), monthlyCredits: Number(r.monthly_credits), tutorEnabled: r.tutor_enabled };
    });
  }

  async saveSettings(orgId: OrgId, settings: PrepSettings): Promise<void> {
    await scoped(this.#sql, practiceStaff(orgId), (tx) =>
      tx.query(
        `INSERT INTO prep_settings (org_id, plus_enabled, free_modules, monthly_credits, tutor_enabled, updated_at) VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (org_id) DO UPDATE SET plus_enabled = $2, free_modules = $3, monthly_credits = $4, tutor_enabled = $5, updated_at = now()`,
        [orgId, settings.plusEnabled, settings.freeModules, settings.monthlyCredits, settings.tutorEnabled],
      ),
    );
  }

  /** A learner sees the active ones; staff, all. */
  async products(scope: PracticeScope): Promise<readonly PrepProduct[]> {
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<ProductRow>(`SELECT id, title, kind, days, credits, price_paise, active, position FROM prep_products WHERE org_id = $1 ORDER BY position, price_paise`, [
          scope.orgId,
        ])
      ).map(toProduct),
    );
  }

  async saveProduct(orgId: OrgId, id: string | null, draft: PrepProductDraft): Promise<PrepProduct | null> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const params = [orgId, id ?? this.#newId(), draft.title, draft.kind, draft.days, draft.credits, draft.pricePaise, draft.active, draft.position];
      const rows =
        id === null
          ? await tx.query<ProductRow>(
              `INSERT INTO prep_products (org_id, id, title, kind, days, credits, price_paise, active, position) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               RETURNING id, title, kind, days, credits, price_paise, active, position`,
              params,
            )
          : await tx.query<ProductRow>(
              `UPDATE prep_products SET title = $3, kind = $4, days = $5, credits = $6, price_paise = $7, active = $8, position = $9
                WHERE org_id = $1 AND id = $2 RETURNING id, title, kind, days, credits, price_paise, active, position`,
              params,
            );
      return rows[0] === undefined ? null : toProduct(rows[0]);
    });
  }

  // --- orders ---------------------------------------------------------------------------------

  async createOrder(orgId: OrgId, order: Omit<PrepOrder, "id" | "paymentId" | "status" | "createdAt" | "paidAt">): Promise<PrepOrder> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const rows = await tx.query<OrderRow>(
        `INSERT INTO prep_orders (org_id, id, learner_id, product_id, title, days, credits, amount_paise, tax_paise, gateway_order_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING ${ORDER_COLUMNS}`,
        [orgId, this.#newId(), order.learnerId, order.productId, order.title, order.days, order.credits, order.amountPaise, order.taxPaise, order.gatewayOrderId],
      );
      return toOrder(rows[0]!);
    });
  }

  async orders(scope: PracticeScope): Promise<readonly PrepOrder[]> {
    if (scope.actor === "learner" && scope.learnerId === null) return [];
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<OrderRow>(
          `SELECT ${ORDER_COLUMNS} FROM prep_orders WHERE org_id = $1 AND ($2::text IS NULL OR learner_id = $2) ORDER BY created_at DESC LIMIT 500`,
          [scope.orgId, scope.actor === "learner" ? own(scope) : null],
        )
      ).map(toOrder),
    );
  }

  /**
   * Mark an order paid, once: its Plus and its credits are given in the same
   * transaction, each under a key that makes a second confirmation a no-op.
   * Null when there is no such order.
   */
  async markPaid(orgId: OrgId, gatewayOrderId: string, paymentId: string, at: Date): Promise<{ readonly order: PrepOrder; readonly newlyPaid: boolean } | null> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const found = await tx.query<OrderRow>(`SELECT ${ORDER_COLUMNS} FROM prep_orders WHERE org_id = $1 AND gateway_order_id = $2 FOR UPDATE`, [orgId, gatewayOrderId]);
      if (found[0] === undefined) return null;
      if (found[0].status === "paid") return { order: toOrder(found[0]), newlyPaid: false };
      const rows = await tx.query<OrderRow>(
        `UPDATE prep_orders SET status = 'paid', payment_id = $3, paid_at = $4 WHERE org_id = $1 AND gateway_order_id = $2 RETURNING ${ORDER_COLUMNS}`,
        [orgId, gatewayOrderId, paymentId, at],
      );
      const order = toOrder(rows[0]!);
      if (order.days > 0) {
        // Plus bought while Plus is held runs on from the end of what is held.
        const held = await tx.query<{ ends_at: string | Date | null }>(
          `SELECT max(ends_at) AS ends_at FROM prep_plus WHERE org_id = $1 AND learner_id = $2 AND ends_at > $3`,
          [orgId, order.learnerId, at],
        );
        const from = held[0]?.ends_at === null || held[0]?.ends_at === undefined ? at : new Date(held[0].ends_at);
        await tx.query(
          `INSERT INTO prep_plus (org_id, id, learner_id, starts_at, ends_at, source, ref) VALUES ($1, $2, $3, $4, $5, 'payment', $6) ON CONFLICT DO NOTHING`,
          [orgId, this.#newId(), order.learnerId, from, new Date(from.getTime() + order.days * 86_400_000), order.id],
        );
      }
      if (order.credits > 0) {
        await tx.query(
          `INSERT INTO prep_credits (org_id, id, learner_id, delta, reason, key) VALUES ($1, $2, $3, $4, 'purchase', $5) ON CONFLICT DO NOTHING`,
          [orgId, this.#newId(), order.learnerId, order.credits, `order:${order.id}`],
        );
      }
      return { order, newlyPaid: true };
    });
  }

  // --- Plus -------------------------------------------------------------------------------------

  async plus(scope: PracticeScope, learnerId?: string): Promise<readonly PlusSpan[]> {
    const who = scope.actor === "learner" ? (scope.learnerId ?? null) : (learnerId ?? null);
    if (who === null) return [];
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<{ starts_at: string | Date; ends_at: string | Date; source: PlusSpan["source"] }>(
          `SELECT starts_at, ends_at, source FROM prep_plus WHERE org_id = $1 AND learner_id = $2 ORDER BY ends_at`,
          [scope.orgId, who],
        )
      ).map((r) => ({ startsAt: iso(r.starts_at), endsAt: iso(r.ends_at), source: r.source })),
    );
  }

  /** Give Plus. False when that grant was made already. */
  async grantPlus(orgId: OrgId, learnerId: string, span: { startsAt: Date; endsAt: Date; source: "grant" | "coins"; ref: string }): Promise<boolean> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const rows = await tx.query<{ id: string }>(
        `INSERT INTO prep_plus (org_id, id, learner_id, starts_at, ends_at, source, ref) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING RETURNING id`,
        [orgId, this.#newId(), learnerId, span.startsAt, span.endsAt, span.source, span.ref],
      );
      return rows.length > 0;
    });
  }

  // --- credits ------------------------------------------------------------------------------------

  /** Add to or take from the ledger. False when the key was used already. */
  async credit(orgId: OrgId, learnerId: string, entry: { delta: number; reason: CreditReason; key: string }, at: Date = new Date()): Promise<boolean> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const rows = await tx.query<{ id: string }>(
        `INSERT INTO prep_credits (org_id, id, learner_id, delta, reason, key, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING RETURNING id`,
        [orgId, this.#newId(), learnerId, entry.delta, entry.reason, entry.key, at],
      );
      return rows.length > 0;
    });
  }

  /**
   * Spend credits if there are enough, in one transaction so two requests at
   * once cannot both spend the last of them. False when there are not.
   */
  async spend(orgId: OrgId, learnerId: string, amount: number, key: string, at: Date): Promise<boolean> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      // One learner's spending is serialised on their row.
      await tx.query(`SELECT id FROM learners WHERE id = $1 FOR UPDATE`, [learnerId]);
      const balance = await tx.query<{ total: string | null }>(`SELECT sum(delta) AS total FROM prep_credits WHERE org_id = $1 AND learner_id = $2`, [orgId, learnerId]);
      if (Number(balance[0]?.total ?? 0) < amount) return false;
      await tx.query(`INSERT INTO prep_credits (org_id, id, learner_id, delta, reason, key, created_at) VALUES ($1, $2, $3, $4, 'spend', $5, $6)`, [
        orgId,
        this.#newId(),
        learnerId,
        -amount,
        key,
        at,
      ]);
      return true;
    });
  }

  async credits(scope: PracticeScope, limit = 50): Promise<{ readonly balance: number; readonly history: readonly { readonly delta: number; readonly reason: CreditReason; readonly at: string }[] }> {
    if (scope.actor === "learner" && scope.learnerId === null) return { balance: 0, history: [] };
    return scoped(this.#sql, scope, async (tx) => {
      const who = own(scope);
      const total = await tx.query<{ total: string | null }>(`SELECT sum(delta) AS total FROM prep_credits WHERE org_id = $1 AND learner_id = $2`, [scope.orgId, who]);
      const rows = await tx.query<{ delta: number; reason: CreditReason; created_at: string | Date }>(
        `SELECT delta, reason, created_at FROM prep_credits WHERE org_id = $1 AND learner_id = $2 ORDER BY created_at DESC, id LIMIT $3`,
        [scope.orgId, who, limit],
      );
      return { balance: Number(total[0]?.total ?? 0), history: rows.map((r) => ({ delta: Number(r.delta), reason: r.reason, at: iso(r.created_at) })) };
    });
  }

  // --- the tutor ------------------------------------------------------------------------------------

  async addTutor(orgId: OrgId, learnerId: string, entry: Omit<TutorEntry, "id" | "createdAt">, at: Date): Promise<TutorEntry> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const id = this.#newId();
      await tx.query(
        `INSERT INTO prep_tutor (org_id, id, learner_id, mode, problem_id, lesson_id, hint_level, question, answer, credits, model, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [orgId, id, learnerId, entry.mode, entry.problemId, entry.lessonId, entry.hintLevel, entry.question, entry.answer, entry.credits, entry.model, at],
      );
      return { ...entry, id, createdAt: at.toISOString() };
    });
  }

  async tutorHistory(scope: PracticeScope, filter: { problemId?: string; lessonId?: string } = {}): Promise<readonly TutorEntry[]> {
    if (scope.actor === "learner" && scope.learnerId === null) return [];
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<{
          id: string;
          mode: TutorEntry["mode"];
          problem_id: string | null;
          lesson_id: string | null;
          hint_level: number | null;
          question: string;
          answer: string;
          credits: number;
          model: string;
          created_at: string | Date;
        }>(
          `SELECT id, mode, problem_id, lesson_id, hint_level, question, answer, credits, model, created_at FROM prep_tutor
            WHERE org_id = $1 AND learner_id = $2 AND ($3::text IS NULL OR problem_id = $3) AND ($4::text IS NULL OR lesson_id = $4)
            ORDER BY created_at, hint_level NULLS LAST, id LIMIT 200`,
          [scope.orgId, own(scope), filter.problemId ?? null, filter.lessonId ?? null],
        )
      ).map((r) => ({
        id: r.id,
        mode: r.mode,
        problemId: r.problem_id,
        lessonId: r.lesson_id,
        hintLevel: r.hint_level === null ? null : Number(r.hint_level),
        question: r.question,
        answer: r.answer,
        credits: Number(r.credits),
        model: r.model,
        createdAt: iso(r.created_at),
      })),
    );
  }

  /** A learner deletes what the tutor said to them; everything, or about one problem. */
  async forgetTutor(scope: PracticeScope, problemId: string | null): Promise<number> {
    return scoped(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ id: string }>(
        `DELETE FROM prep_tutor WHERE org_id = $1 AND learner_id = $2 AND ($3::text IS NULL OR problem_id = $3) RETURNING id`,
        [scope.orgId, own(scope), problemId],
      );
      return rows.length;
    });
  }

  /** The tutor's model spend, counted with the rest of the organisation's (ROADMAP §0). */
  async recordUsage(orgId: OrgId, usage: Omit<UsageRecord, "attemptId" | "route">, at: Date = new Date()): Promise<void> {
    await scoped(this.#sql, practiceStaff(orgId), (tx) =>
      tx.query(
        `INSERT INTO model_usage (id, org_id, attempt_id, route, model, speed, input_tokens, output_tokens, cache_read_tokens,
                                  cache_write_5m_tokens, cache_write_1h_tokens, cost_micro_usd, inference_geo, at)
         VALUES ($1, $2, NULL, 'tutor', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          this.#newId(),
          orgId,
          usage.model,
          usage.speed,
          usage.inputTokens,
          usage.outputTokens,
          usage.cacheReadTokens,
          usage.cacheWrite5mTokens,
          usage.cacheWrite1hTokens,
          usage.costMicroUsd,
          usage.inferenceGeo,
          at,
        ],
      ),
    );
  }

  /** Whether the organisation's model spend this month is under its cap, if it has one. */
  async withinBudget(orgId: OrgId, monthStart: Date): Promise<boolean> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const rows = await tx.query<{ cap: string | null; spent: string | null }>(
        `SELECT o.monthly_spend_cap_micro_usd AS cap,
                (SELECT coalesce(sum(cost_micro_usd), 0) FROM model_usage WHERE org_id = $1 AND at >= $2) AS spent
           FROM organisations o WHERE o.id = $1`,
        [orgId, monthStart],
      );
      const r = rows[0];
      return r === undefined || r.cap === null || Number(r.spent) < Number(r.cap);
    });
  }
}
