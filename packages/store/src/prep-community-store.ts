import type { OrgId } from "@parikshaa/core";
import { practiceStaff, type PracticeScope } from "./practice-store.js";
import type { SqlExecutor } from "./sql.js";

/**
 * Companies, interview experiences, the coin store and contest ratings
 * (ROADMAP §16, migration 0021).
 *
 * Coins are spent in the staff scope, in one transaction with the order, the
 * stock and any Plus the item gives: a learner's row is locked while it runs,
 * so two redemptions at once cannot both spend the last coins.
 */

function scoped<T>(sql: SqlExecutor, scope: PracticeScope, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  return sql.transaction(fn, {
    "parikshaa.org_id": scope.orgId,
    "parikshaa.actor": scope.actor,
    "parikshaa.attempt_id": "",
    "parikshaa.learner_id": scope.actor === "learner" ? (scope.learnerId ?? "") : "",
  });
}

const iso = (value: string | Date) => new Date(value).toISOString();
const isUnique = (error: unknown) => (error as { code?: string }).code === "23505";

export class CommunitySlugTaken extends Error {
  constructor() {
    super("That company address is taken");
    this.name = "CommunitySlugTaken";
  }
}

export interface Company {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly about: string;
}

export interface CompanyReport {
  readonly id: string;
  readonly companyId: string;
  readonly problemId: string;
  readonly reportedOn: string;
  readonly source: "staff" | "experience";
  readonly experienceId: string | null;
}

export interface ExperienceRound {
  readonly kind: string;
  readonly asked: string;
  readonly problemSlugs: readonly string[];
}

export interface Experience {
  readonly id: string;
  readonly learnerId: string;
  readonly companyId: string;
  readonly role: string;
  readonly interviewed: string;
  readonly verdict: "offer" | "reject" | "waiting";
  readonly rounds: readonly ExperienceRound[];
  readonly tips: string;
  readonly authorName: string;
  readonly status: "pending" | "published" | "rejected";
  readonly createdAt: string;
  readonly publishedAt: string | null;
  readonly votes: number;
}
export type ExperienceDraft = Pick<Experience, "companyId" | "role" | "interviewed" | "verdict" | "rounds" | "tips" | "authorName">;

export interface StoreItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly kind: "plus" | "digital" | "physical";
  readonly plusDays: number;
  readonly priceCoins: number;
  readonly stock: number | null;
  readonly perLearner: number;
  readonly active: boolean;
}
export type StoreItemDraft = Omit<StoreItem, "id">;

export interface StoreOrder {
  readonly id: string;
  readonly learnerId: string;
  readonly itemId: string;
  readonly title: string;
  readonly priceCoins: number;
  readonly address: string;
  readonly status: "placed" | "fulfilled" | "cancelled";
  readonly note: string;
  readonly createdAt: string;
  readonly closedAt: string | null;
}

export type RedeemRefusal = "no_item" | "sold_out" | "limit" | "coins";

export interface Rating {
  readonly contestId: string;
  readonly learnerId: string;
  readonly rank: number;
  readonly before: number;
  readonly after: number;
  readonly ratedAt: string;
}

interface ExperienceRow {
  id: string;
  learner_id: string;
  company_id: string;
  role: string;
  interviewed: string;
  verdict: Experience["verdict"];
  rounds: ExperienceRound[];
  tips: string;
  author_name: string;
  status: Experience["status"];
  created_at: string | Date;
  published_at: string | Date | null;
  votes: string | number;
}
const EXPERIENCE_COLUMNS = `e.id, e.learner_id, e.company_id, e.role, e.interviewed, e.verdict, e.rounds, e.tips, e.author_name, e.status, e.created_at, e.published_at,
  (SELECT count(*) FROM prep_experience_votes v WHERE v.org_id = e.org_id AND v.experience_id = e.id) AS votes`;
const toExperience = (r: ExperienceRow): Experience => ({
  id: r.id,
  learnerId: r.learner_id,
  companyId: r.company_id,
  role: r.role,
  interviewed: r.interviewed,
  verdict: r.verdict,
  rounds: r.rounds,
  tips: r.tips,
  authorName: r.author_name,
  status: r.status,
  createdAt: iso(r.created_at),
  publishedAt: r.published_at === null ? null : iso(r.published_at),
  votes: Number(r.votes),
});

interface ItemRow {
  id: string;
  title: string;
  description: string;
  kind: StoreItem["kind"];
  plus_days: number;
  price_coins: number;
  stock: number | null;
  per_learner: number;
  active: boolean;
}
const ITEM_COLUMNS = "id, title, description, kind, plus_days, price_coins, stock, per_learner, active";
const toItem = (r: ItemRow): StoreItem => ({
  id: r.id,
  title: r.title,
  description: r.description,
  kind: r.kind,
  plusDays: Number(r.plus_days),
  priceCoins: Number(r.price_coins),
  stock: r.stock === null ? null : Number(r.stock),
  perLearner: Number(r.per_learner),
  active: r.active,
});

interface OrderRow {
  id: string;
  learner_id: string;
  item_id: string;
  title: string;
  price_coins: number;
  address: string;
  status: StoreOrder["status"];
  note: string;
  created_at: string | Date;
  closed_at: string | Date | null;
}
const ORDER_COLUMNS = "id, learner_id, item_id, title, price_coins, address, status, note, created_at, closed_at";
const toOrder = (r: OrderRow): StoreOrder => ({
  id: r.id,
  learnerId: r.learner_id,
  itemId: r.item_id,
  title: r.title,
  priceCoins: Number(r.price_coins),
  address: r.address,
  status: r.status,
  note: r.note,
  createdAt: iso(r.created_at),
  closedAt: r.closed_at === null ? null : iso(r.closed_at),
});

export class PrepCommunityStore {
  readonly #sql: SqlExecutor;
  readonly #newId: () => string;

  constructor(sql: SqlExecutor, options: { readonly newId?: () => string } = {}) {
    this.#sql = sql;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  // --- companies ---------------------------------------------------------------------

  async companies(scope: PracticeScope): Promise<readonly Company[]> {
    return scoped(this.#sql, scope, async (tx) =>
      (await tx.query<Company>(`SELECT id, slug, name, about FROM prep_companies WHERE org_id = $1 ORDER BY name`, [scope.orgId])).map((r) => ({ ...r })),
    );
  }

  async saveCompany(orgId: OrgId, id: string | null, draft: Omit<Company, "id">): Promise<Company | null> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      try {
        const rows =
          id === null
            ? await tx.query<Company>(`INSERT INTO prep_companies (org_id, id, slug, name, about) VALUES ($1, $2, $3, $4, $5) RETURNING id, slug, name, about`, [
                orgId,
                this.#newId(),
                draft.slug,
                draft.name,
                draft.about,
              ])
            : await tx.query<Company>(`UPDATE prep_companies SET slug = $3, name = $4, about = $5 WHERE org_id = $1 AND id = $2 RETURNING id, slug, name, about`, [
                orgId,
                id,
                draft.slug,
                draft.name,
                draft.about,
              ]);
        return rows[0] ?? null;
      } catch (error) {
        if (isUnique(error)) throw new CommunitySlugTaken();
        throw error;
      }
    });
  }

  /** The companies a learner is aiming for: their ids. */
  async targets(scope: PracticeScope & { readonly actor: "learner" }): Promise<readonly string[]> {
    if (scope.learnerId === null) return [];
    return scoped(this.#sql, scope, async (tx) =>
      (await tx.query<{ company_id: string }>(`SELECT company_id FROM prep_targets WHERE org_id = $1 AND learner_id = $2 ORDER BY created_at`, [scope.orgId, scope.learnerId])).map(
        (r) => r.company_id,
      ),
    );
  }

  async setTarget(scope: PracticeScope & { readonly actor: "learner"; readonly learnerId: string }, companyId: string, on: boolean): Promise<void> {
    await scoped(this.#sql, scope, (tx) =>
      on
        ? tx.query(`INSERT INTO prep_targets (org_id, learner_id, company_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [scope.orgId, scope.learnerId, companyId])
        : tx.query(`DELETE FROM prep_targets WHERE org_id = $1 AND learner_id = $2 AND company_id = $3`, [scope.orgId, scope.learnerId, companyId]),
    );
  }

  async reports(scope: PracticeScope, companyId?: string): Promise<readonly CompanyReport[]> {
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<{ id: string; company_id: string; problem_id: string; reported_on: string; source: CompanyReport["source"]; experience_id: string | null }>(
          `SELECT id, company_id, problem_id, to_char(reported_on, 'YYYY-MM-DD') AS reported_on, source, experience_id
             FROM prep_company_reports WHERE org_id = $1 AND ($2::text IS NULL OR company_id = $2) ORDER BY reported_on DESC LIMIT 20000`,
          [scope.orgId, companyId ?? null],
        )
      ).map((r) => ({ id: r.id, companyId: r.company_id, problemId: r.problem_id, reportedOn: r.reported_on, source: r.source, experienceId: r.experience_id })),
    );
  }

  async addReport(orgId: OrgId, report: Omit<CompanyReport, "id">): Promise<string> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const id = this.#newId();
      await tx.query(
        `INSERT INTO prep_company_reports (org_id, id, company_id, problem_id, reported_on, source, experience_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orgId, id, report.companyId, report.problemId, report.reportedOn, report.source, report.experienceId],
      );
      return id;
    });
  }

  async deleteReport(orgId: OrgId, id: string): Promise<boolean> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => (await tx.query(`DELETE FROM prep_company_reports WHERE org_id = $1 AND id = $2 RETURNING id`, [orgId, id])).length > 0);
  }

  // --- experiences -----------------------------------------------------------------------

  /** Published ones for everyone; a learner also sees their own, whatever their state; staff see all. */
  async experiences(scope: PracticeScope, filter: { companyId?: string; status?: Experience["status"] } = {}): Promise<readonly Experience[]> {
    const found = await scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<ExperienceRow>(
          `SELECT ${EXPERIENCE_COLUMNS} FROM prep_experiences e
            WHERE e.org_id = $1 AND ($2::text IS NULL OR e.company_id = $2) AND ($3::text IS NULL OR e.status = $3)
            ORDER BY coalesce(e.published_at, e.created_at) DESC LIMIT 1000`,
          [scope.orgId, filter.companyId ?? null, filter.status ?? null],
        )
      ).map(toExperience),
    );
    if (scope.actor === "staff" || found.length === 0) return found;
    // A learner sees only their own votes, so the counts are read in the staff scope: counts, never who.
    const counts = await scoped(this.#sql, practiceStaff(scope.orgId), (tx) =>
      tx.query<{ experience_id: string; n: string }>(
        `SELECT experience_id, count(*) AS n FROM prep_experience_votes WHERE org_id = $1 AND experience_id = ANY($2) GROUP BY experience_id`,
        [scope.orgId, found.map((e) => e.id)],
      ),
    );
    const byId = new Map(counts.map((c) => [c.experience_id, Number(c.n)]));
    return found.map((e) => ({ ...e, votes: byId.get(e.id) ?? 0 }));
  }

  async addExperience(scope: PracticeScope & { actor: "learner" }, draft: ExperienceDraft): Promise<Experience> {
    if (scope.learnerId === null) throw new Error("Only a signed-in learner writes an experience");
    return scoped(this.#sql, scope, async (tx) => {
      const id = this.#newId();
      await tx.query(
        `INSERT INTO prep_experiences (org_id, id, learner_id, company_id, role, interviewed, verdict, rounds, tips, author_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [scope.orgId, id, scope.learnerId, draft.companyId, draft.role, draft.interviewed, draft.verdict, JSON.stringify(draft.rounds), draft.tips, draft.authorName],
      );
      const rows = await tx.query<ExperienceRow>(`SELECT ${EXPERIENCE_COLUMNS} FROM prep_experiences e WHERE e.org_id = $1 AND e.id = $2`, [scope.orgId, id]);
      return toExperience(rows[0]!);
    });
  }

  /** Publish or reject a pending experience. Null when there is no such one, or it was decided already. */
  async decideExperience(orgId: OrgId, id: string, status: "published" | "rejected", by: string, at: Date): Promise<Experience | null> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const rows = await tx.query<{ id: string }>(
        `UPDATE prep_experiences SET status = $3, reviewed_by = $4, published_at = CASE WHEN $3 = 'published' THEN $5::timestamptz END
          WHERE org_id = $1 AND id = $2 AND status = 'pending' RETURNING id`,
        [orgId, id, status, by, at],
      );
      if (rows.length === 0) return null;
      const found = await tx.query<ExperienceRow>(`SELECT ${EXPERIENCE_COLUMNS} FROM prep_experiences e WHERE e.org_id = $1 AND e.id = $2`, [orgId, id]);
      return toExperience(found[0]!);
    });
  }

  async vote(scope: PracticeScope, experienceId: string, on: boolean): Promise<void> {
    if (scope.actor !== "learner" || scope.learnerId === null) throw new Error("Only a signed-in learner votes");
    await scoped(this.#sql, scope, (tx) =>
      on
        ? tx.query(`INSERT INTO prep_experience_votes (org_id, experience_id, learner_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [scope.orgId, experienceId, scope.learnerId])
        : tx.query(`DELETE FROM prep_experience_votes WHERE org_id = $1 AND experience_id = $2 AND learner_id = $3`, [scope.orgId, experienceId, scope.learnerId]),
    );
  }

  async myVotes(scope: PracticeScope): Promise<ReadonlySet<string>> {
    if (scope.actor !== "learner" || scope.learnerId === null) return new Set();
    return scoped(this.#sql, scope, async (tx) =>
      new Set((await tx.query<{ experience_id: string }>(`SELECT experience_id FROM prep_experience_votes WHERE org_id = $1 AND learner_id = $2`, [scope.orgId, scope.learnerId])).map((r) => r.experience_id)),
    );
  }

  // --- the store ---------------------------------------------------------------------------

  async items(scope: PracticeScope): Promise<readonly StoreItem[]> {
    return scoped(this.#sql, scope, async (tx) => (await tx.query<ItemRow>(`SELECT ${ITEM_COLUMNS} FROM prep_store_items WHERE org_id = $1 ORDER BY price_coins`, [scope.orgId])).map(toItem));
  }

  async saveItem(orgId: OrgId, id: string | null, draft: StoreItemDraft): Promise<StoreItem | null> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const params = [orgId, id ?? this.#newId(), draft.title, draft.description, draft.kind, draft.plusDays, draft.priceCoins, draft.stock, draft.perLearner, draft.active];
      const rows =
        id === null
          ? await tx.query<ItemRow>(
              `INSERT INTO prep_store_items (org_id, id, title, description, kind, plus_days, price_coins, stock, per_learner, active)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING ${ITEM_COLUMNS}`,
              params,
            )
          : await tx.query<ItemRow>(
              `UPDATE prep_store_items SET title = $3, description = $4, kind = $5, plus_days = $6, price_coins = $7, stock = $8, per_learner = $9, active = $10
                WHERE org_id = $1 AND id = $2 RETURNING ${ITEM_COLUMNS}`,
              params,
            );
      return rows[0] === undefined ? null : toItem(rows[0]);
    });
  }

  /**
   * Spend coins on an item, all at once or not at all: the coins, the order,
   * the stock, and — for Plus — the days of Plus.
   */
  async redeem(orgId: OrgId, learnerId: string, itemId: string, address: string, at: Date): Promise<StoreOrder | RedeemRefusal> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      await tx.query(`SELECT id FROM learners WHERE id = $1 FOR UPDATE`, [learnerId]);
      const items = await tx.query<ItemRow>(`SELECT ${ITEM_COLUMNS} FROM prep_store_items WHERE org_id = $1 AND id = $2 FOR UPDATE`, [orgId, itemId]);
      const item = items[0] === undefined ? undefined : toItem(items[0]);
      if (item === undefined || !item.active) return "no_item";
      if (item.stock !== null && item.stock <= 0) return "sold_out";
      const taken = await tx.query<{ n: string }>(
        `SELECT count(*) AS n FROM prep_store_orders WHERE org_id = $1 AND learner_id = $2 AND item_id = $3 AND status <> 'cancelled'`,
        [orgId, learnerId, itemId],
      );
      if (Number(taken[0]!.n) >= item.perLearner) return "limit";
      const balance = await tx.query<{ total: string | null }>(`SELECT sum(amount) AS total FROM prep_coins WHERE org_id = $1 AND learner_id = $2`, [orgId, learnerId]);
      if (Number(balance[0]?.total ?? 0) < item.priceCoins) return "coins";

      const orderId = this.#newId();
      const rows = await tx.query<OrderRow>(
        `INSERT INTO prep_store_orders (org_id, id, learner_id, item_id, title, price_coins, address, status, created_at, closed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING ${ORDER_COLUMNS}`,
        [orgId, orderId, learnerId, item.id, item.title, item.priceCoins, address, item.kind === "plus" ? "fulfilled" : "placed", at, item.kind === "plus" ? at : null],
      );
      await tx.query(`INSERT INTO prep_coins (org_id, id, learner_id, rule, amount, key, created_at) VALUES ($1, $2, $3, 'store', $4, $5, $6)`, [
        orgId,
        this.#newId(),
        learnerId,
        -item.priceCoins,
        `store:${orderId}`,
        at,
      ]);
      if (item.stock !== null) await tx.query(`UPDATE prep_store_items SET stock = stock - 1 WHERE org_id = $1 AND id = $2`, [orgId, item.id]);
      if (item.kind === "plus") {
        const held = await tx.query<{ ends_at: string | Date | null }>(`SELECT max(ends_at) AS ends_at FROM prep_plus WHERE org_id = $1 AND learner_id = $2 AND ends_at > $3`, [
          orgId,
          learnerId,
          at,
        ]);
        const from = held[0]?.ends_at === null || held[0]?.ends_at === undefined ? at : new Date(held[0].ends_at);
        await tx.query(`INSERT INTO prep_plus (org_id, id, learner_id, starts_at, ends_at, source, ref) VALUES ($1, $2, $3, $4, $5, 'coins', $6)`, [
          orgId,
          this.#newId(),
          learnerId,
          from,
          new Date(from.getTime() + item.plusDays * 86_400_000),
          orderId,
        ]);
      }
      return toOrder(rows[0]!);
    });
  }

  async storeOrders(scope: PracticeScope): Promise<readonly StoreOrder[]> {
    if (scope.actor === "learner" && scope.learnerId === null) return [];
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<OrderRow>(
          `SELECT ${ORDER_COLUMNS} FROM prep_store_orders WHERE org_id = $1 AND ($2::text IS NULL OR learner_id = $2) ORDER BY created_at DESC LIMIT 2000`,
          [scope.orgId, scope.actor === "learner" ? scope.learnerId : null],
        )
      ).map(toOrder),
    );
  }

  /** Fulfil or cancel a placed order. A cancelled one's coins and stock go back. Null when it was not placed. */
  async closeOrder(orgId: OrgId, id: string, status: "fulfilled" | "cancelled", note: string, at: Date): Promise<StoreOrder | null> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const rows = await tx.query<OrderRow>(
        `UPDATE prep_store_orders SET status = $3, note = $4, closed_at = $5 WHERE org_id = $1 AND id = $2 AND status = 'placed' RETURNING ${ORDER_COLUMNS}`,
        [orgId, id, status, note, at],
      );
      const order = rows[0] === undefined ? null : toOrder(rows[0]);
      if (order !== null && status === "cancelled") {
        await tx.query(`INSERT INTO prep_coins (org_id, id, learner_id, rule, amount, key, created_at) VALUES ($1, $2, $3, 'store_refund', $4, $5, $6) ON CONFLICT DO NOTHING`, [
          orgId,
          this.#newId(),
          order.learnerId,
          order.priceCoins,
          `store-refund:${order.id}`,
          at,
        ]);
        await tx.query(`UPDATE prep_store_items SET stock = stock + 1 WHERE org_id = $1 AND id = $2 AND stock IS NOT NULL`, [orgId, order.itemId]);
      }
      return order;
    });
  }

  // --- ratings ---------------------------------------------------------------------------------

  async ratings(scope: PracticeScope, filter: { contestId?: string; learnerId?: string } = {}): Promise<readonly Rating[]> {
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<{ contest_id: string; learner_id: string; rank: number; before: number; after: number; rated_at: string | Date }>(
          `SELECT contest_id, learner_id, rank, before, after, rated_at FROM prep_ratings
            WHERE org_id = $1 AND ($2::text IS NULL OR contest_id = $2) AND ($3::text IS NULL OR learner_id = $3) ORDER BY rated_at, rank LIMIT 20000`,
          [scope.orgId, filter.contestId ?? null, filter.learnerId ?? null],
        )
      ).map((r) => ({ contestId: r.contest_id, learnerId: r.learner_id, rank: Number(r.rank), before: Number(r.before), after: Number(r.after), ratedAt: iso(r.rated_at) })),
    );
  }

  /** Record a contest's rating changes, once: a second call finds it rated and changes nothing. */
  async rate(orgId: OrgId, contestId: string, changes: readonly Omit<Rating, "contestId" | "ratedAt">[], at: Date): Promise<boolean> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      // Contests are rated one at a time, in order, so each starts from the ratings before it.
      await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`prep-rating:${orgId}`]);
      const done = await tx.query(`SELECT 1 FROM prep_ratings WHERE org_id = $1 AND contest_id = $2 LIMIT 1`, [orgId, contestId]);
      if (done.length > 0) return false;
      for (const c of changes) {
        await tx.query(`INSERT INTO prep_ratings (org_id, contest_id, learner_id, rank, before, after, rated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
          orgId,
          contestId,
          c.learnerId,
          c.rank,
          c.before,
          c.after,
          at,
        ]);
      }
      return true;
    });
  }
}
