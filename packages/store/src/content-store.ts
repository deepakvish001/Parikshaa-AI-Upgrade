import type { OrgId } from "@parikshaa/core";
import type { SqlExecutor, TransactionSettings } from "./sql.js";

/**
 * Bulk content uploads (migration 0075; docs/content/CONTENT-FORMAT.md, tracker
 * plan row 141 part B).
 *
 * An upload is a bundle file and a report for each of its items. An item that
 * passes the gates is kept as a draft in `content_items`, by its namespace and
 * slug, with its version and the hash of its content; publishing writes it to
 * the practice site and marks that version published. Everything here runs as
 * the organisation's staff: no learner has a policy on these tables.
 *
 * The version rule (CONTENT-FORMAT §2a, as the owner decided it on 17 Nov
 * 2026): a new slug is a new draft; a higher version replaces the draft; the
 * same version with the same hash is skipped; the same version with another
 * hash replaces the draft if that version was never published, and is refused
 * once it was ("raise the version"); a lower version is refused.
 */

export type ContentNamespace = "problem" | "lesson";
export type ContentType = "dsa-problem" | "sql-problem" | "mcq" | "lesson" | "project" | "system-design";
export const CONTENT_TYPES: readonly ContentType[] = ["dsa-problem", "sql-problem", "mcq", "lesson", "project", "system-design"];
export const namespaceOf = (type: ContentType): ContentNamespace => (type === "lesson" ? "lesson" : "problem");

export type UploadItemStatus = "pending" | "checking" | "passed" | "failed" | "skipped";

/** One thing wrong with an item or a bundle: which gate found it, and what it is, in plain words. */
export interface GateProblem {
  readonly gate: string;
  readonly message: string;
}

export interface ContentAuthor {
  readonly id: string;
  readonly name: string;
}

export interface UploadItemDraft {
  readonly namespace: ContentNamespace;
  /** As the item gave it; "(no slug)" when it gave none. */
  readonly slug: string;
  /** As the item's `schema` named it; "(unknown)" when it named none. */
  readonly type: string;
  readonly version: number;
  /** Empty when the item could not be read. */
  readonly hash: string;
  readonly title: string;
  /** The item, for the runner's gates; null when it is not going to the runner. */
  readonly item: unknown;
  /** pending: goes to the runner. failed or skipped: its report is already final. */
  readonly status: "pending" | "failed" | "skipped";
  readonly problems: readonly GateProblem[];
  readonly warnings: readonly string[];
}

export interface UploadDraft {
  readonly bundleId: string;
  readonly bundleVersion: number;
  readonly title: string;
  readonly fileName: string;
  readonly bytes: number;
  readonly manifest: unknown;
  readonly problems: readonly GateProblem[];
  readonly createdBy: ContentAuthor;
  readonly items: readonly UploadItemDraft[];
}

export interface UploadCounts {
  readonly total: number;
  readonly pending: number;
  readonly checking: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
}

export interface UploadSummary {
  readonly id: string;
  readonly bundleId: string;
  readonly bundleVersion: number;
  readonly title: string;
  readonly fileName: string;
  readonly bytes: number;
  readonly state: "checking" | "done";
  readonly createdBy: ContentAuthor;
  readonly createdAt: string;
  readonly finishedAt: string | null;
  readonly counts: UploadCounts;
  /** Items of this upload whose version is published now. */
  readonly published: number;
}

export interface UploadItemReport {
  readonly position: number;
  readonly namespace: ContentNamespace;
  readonly slug: string;
  readonly type: string;
  readonly version: number;
  readonly hash: string;
  readonly title: string;
  readonly status: UploadItemStatus;
  readonly problems: readonly GateProblem[];
  readonly warnings: readonly string[];
  readonly checkedAt: string | null;
  /**
   * The slug's draft or published item as it stands now, if it has one: which
   * version is current and which is live. Null when nothing is kept under it.
   */
  readonly current: { readonly version: number; readonly hash: string; readonly state: "draft" | "published"; readonly publishedVersion: number | null; readonly uploadId: string } | null;
}

export interface UploadDetail extends UploadSummary {
  readonly manifest: unknown;
  readonly problems: readonly GateProblem[];
  readonly items: readonly UploadItemReport[];
}

/** An item taken off the queue for the runner's gates. `claimedAt` proves the claim when its report comes back. */
export interface ClaimedItem {
  readonly uploadId: string;
  readonly position: number;
  readonly namespace: ContentNamespace;
  readonly slug: string;
  readonly type: string;
  readonly version: number;
  readonly hash: string;
  readonly item: unknown;
  readonly claimedAt: string;
}

export interface ContentItem {
  readonly namespace: ContentNamespace;
  readonly slug: string;
  readonly type: ContentType;
  readonly title: string;
  readonly version: number;
  readonly hash: string;
  readonly item: unknown;
  readonly built: unknown;
  readonly uploadId: string;
  readonly warnings: readonly string[];
  readonly state: "draft" | "published";
  readonly publishedVersion: number | null;
  readonly publishedHash: string | null;
  readonly publishedAt: string | null;
  readonly publishedBy: ContentAuthor | null;
  readonly problemId: string | null;
  readonly lessonId: string | null;
  /** A lesson's quiz and hands-on problems: slug to problem id. */
  readonly children: Readonly<Record<string, string>>;
  readonly updatedAt: string;
}

/** The draft an item that passed its gates becomes. */
export interface ContentDraft {
  readonly namespace: ContentNamespace;
  readonly slug: string;
  readonly type: ContentType;
  readonly title: string;
  readonly version: number;
  readonly hash: string;
  readonly item: unknown;
  readonly built: unknown;
  readonly uploadId: string;
  readonly warnings: readonly string[];
}

/** What the version rule makes of an incoming item, against what is kept under its slug. */
export type VersionDecision =
  | { readonly action: "create" }
  | { readonly action: "replace" }
  | { readonly action: "skip" }
  | { readonly action: "refuse"; readonly reason: string };

export function versionDecision(
  current: { readonly version: number; readonly hash: string; readonly publishedVersion: number | null } | null,
  incoming: { readonly version: number; readonly hash: string },
): VersionDecision {
  if (current === null) return { action: "create" };
  if (incoming.version > current.version) return { action: "replace" };
  if (incoming.version < current.version) return { action: "refuse", reason: `Version ${incoming.version} is older than the version ${current.version} kept already. Upload version ${current.version + 1} or higher.` };
  if (incoming.hash === current.hash) return { action: "skip" };
  if (current.publishedVersion === current.version) {
    return { action: "refuse", reason: `Version ${incoming.version} is published, and this content differs from it. Raise the version to ${current.version + 1} to change it.` };
  }
  return { action: "replace" };
}

/** What finishing an item did: kept its draft, or refused it (the version rule, a moment later), or found its claim gone. */
export type FinishOutcome = "passed" | "failed" | "skipped" | "lost";

const iso = (value: string | Date) => new Date(value).toISOString();
const isoOrNull = (value: string | Date | null) => (value === null ? null : iso(value));
const json = (value: unknown) => JSON.stringify(value ?? null);

const staff = (orgId: OrgId): TransactionSettings => ({ "parikshaa.org_id": orgId, "parikshaa.actor": "staff", "parikshaa.attempt_id": "", "parikshaa.learner_id": "" });

interface UploadRow {
  id: string;
  bundle_id: string;
  bundle_version: number;
  title: string;
  file_name: string;
  bytes: number;
  state: "checking" | "done";
  created_by_id: string;
  created_by_name: string;
  created_at: string | Date;
  finished_at: string | Date | null;
  total: number | string;
  pending: number | string;
  checking: number | string;
  passed: number | string;
  failed: number | string;
  skipped: number | string;
  published: number | string;
  manifest?: unknown;
  problems?: GateProblem[];
}

const UPLOAD_SELECT = `
  SELECT u.id, u.bundle_id, u.bundle_version, u.title, u.file_name, u.bytes, u.state, u.created_by_id, u.created_by_name, u.created_at, u.finished_at,
         count(i.position) AS total,
         count(i.position) FILTER (WHERE i.status = 'pending') AS pending,
         count(i.position) FILTER (WHERE i.status = 'checking') AS checking,
         count(i.position) FILTER (WHERE i.status = 'passed') AS passed,
         count(i.position) FILTER (WHERE i.status = 'failed') AS failed,
         count(i.position) FILTER (WHERE i.status = 'skipped') AS skipped,
         count(c.slug) FILTER (WHERE c.published_version = i.version AND c.published_hash = i.hash) AS published`;
const UPLOAD_FROM = `
    FROM content_uploads u
    LEFT JOIN content_upload_items i ON i.org_id = u.org_id AND i.upload_id = u.id
    LEFT JOIN content_items c ON c.org_id = i.org_id AND c.namespace = i.namespace AND c.slug = i.slug`;

const toSummary = (r: UploadRow): UploadSummary => ({
  id: r.id,
  bundleId: r.bundle_id,
  bundleVersion: Number(r.bundle_version),
  title: r.title,
  fileName: r.file_name,
  bytes: Number(r.bytes),
  state: r.state,
  createdBy: { id: r.created_by_id, name: r.created_by_name },
  createdAt: iso(r.created_at),
  finishedAt: isoOrNull(r.finished_at),
  counts: {
    total: Number(r.total),
    pending: Number(r.pending),
    checking: Number(r.checking),
    passed: Number(r.passed),
    failed: Number(r.failed),
    skipped: Number(r.skipped),
  },
  published: Number(r.published),
});

interface ItemRow {
  namespace: ContentNamespace;
  slug: string;
  type: ContentType;
  title: string;
  version: number;
  hash: string;
  item: unknown;
  built: unknown;
  upload_id: string;
  warnings: string[];
  state: "draft" | "published";
  published_version: number | null;
  published_hash: string | null;
  published_at: string | Date | null;
  published_by_id: string | null;
  published_by_name: string | null;
  problem_id: string | null;
  lesson_id: string | null;
  children: Record<string, string>;
  updated_at: string | Date;
}
const ITEM_COLUMNS = `namespace, slug, type, title, version, hash, item, built, upload_id, warnings, state, published_version, published_hash, published_at,
  published_by_id, published_by_name, problem_id, lesson_id, children, updated_at`;
const toItem = (r: ItemRow): ContentItem => ({
  namespace: r.namespace,
  slug: r.slug,
  type: r.type,
  title: r.title,
  version: Number(r.version),
  hash: r.hash,
  item: r.item,
  built: r.built,
  uploadId: r.upload_id,
  warnings: r.warnings,
  state: r.state,
  publishedVersion: r.published_version === null ? null : Number(r.published_version),
  publishedHash: r.published_hash,
  publishedAt: isoOrNull(r.published_at),
  publishedBy: r.published_by_id === null ? null : { id: r.published_by_id, name: r.published_by_name ?? "" },
  problemId: r.problem_id,
  lessonId: r.lesson_id,
  children: r.children,
  updatedAt: iso(r.updated_at),
});

export class ContentStore {
  readonly #sql: SqlExecutor;
  readonly #newId: () => string;

  constructor(sql: SqlExecutor, options: { readonly newId?: () => string } = {}) {
    this.#sql = sql;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  // --- uploads --------------------------------------------------------------------------------

  /** Record an upload and its items. Done at once when no item waits for the runner. */
  async createUpload(orgId: OrgId, draft: UploadDraft, at: Date = new Date()): Promise<string> {
    const id = this.#newId();
    const waiting = draft.items.some((i) => i.status === "pending");
    await this.#sql.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO content_uploads (org_id, id, bundle_id, bundle_version, title, file_name, bytes, manifest, problems, state, created_by_id, created_by_name, created_at, finished_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          orgId,
          id,
          draft.bundleId,
          draft.bundleVersion,
          draft.title,
          draft.fileName,
          draft.bytes,
          json(draft.manifest),
          json(draft.problems),
          waiting ? "checking" : "done",
          draft.createdBy.id,
          draft.createdBy.name,
          at,
          waiting ? null : at,
        ],
      );
      for (const [position, item] of draft.items.entries()) {
        const final = item.status !== "pending";
        await tx.query(
          `INSERT INTO content_upload_items (org_id, upload_id, position, namespace, slug, type, version, hash, title, item, status, problems, warnings, checked_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            orgId,
            id,
            position,
            item.namespace,
            item.slug,
            item.type,
            item.version,
            item.hash,
            item.title,
            final ? null : json(item.item),
            item.status,
            json(item.problems),
            json(item.warnings),
            final ? at : null,
          ],
        );
      }
    }, staff(orgId));
    return id;
  }

  /** The organisation's uploads, newest first. */
  async uploads(orgId: OrgId, limit = 50): Promise<readonly UploadSummary[]> {
    return this.#sql.transaction(
      async (tx) =>
        (await tx.query<UploadRow>(`${UPLOAD_SELECT} ${UPLOAD_FROM} WHERE u.org_id = $1 GROUP BY u.org_id, u.id ORDER BY u.created_at DESC, u.id LIMIT $2`, [orgId, limit])).map(
          toSummary,
        ),
      staff(orgId),
    );
  }

  /** One upload with every item's report. */
  async upload(orgId: OrgId, id: string): Promise<UploadDetail | null> {
    return this.#sql.transaction(async (tx) => {
      const rows = await tx.query<UploadRow>(`${UPLOAD_SELECT}, u.manifest, u.problems ${UPLOAD_FROM} WHERE u.org_id = $1 AND u.id = $2 GROUP BY u.org_id, u.id`, [orgId, id]);
      const row = rows[0];
      if (row === undefined) return null;
      const items = await tx.query<{
        position: number;
        namespace: ContentNamespace;
        slug: string;
        type: string;
        version: number;
        hash: string;
        title: string;
        status: UploadItemStatus;
        problems: GateProblem[];
        warnings: string[];
        checked_at: string | Date | null;
        c_version: number | null;
        c_hash: string | null;
        c_state: "draft" | "published" | null;
        c_published_version: number | null;
        c_upload_id: string | null;
      }>(
        `SELECT i.position, i.namespace, i.slug, i.type, i.version, i.hash, i.title, i.status, i.problems, i.warnings, i.checked_at,
                c.version AS c_version, c.hash AS c_hash, c.state AS c_state, c.published_version AS c_published_version, c.upload_id AS c_upload_id
           FROM content_upload_items i
           LEFT JOIN content_items c ON c.org_id = i.org_id AND c.namespace = i.namespace AND c.slug = i.slug
          WHERE i.org_id = $1 AND i.upload_id = $2
          ORDER BY i.position`,
        [orgId, id],
      );
      return {
        ...toSummary(row),
        manifest: row.manifest,
        problems: row.problems ?? [],
        items: items.map((i) => ({
          position: Number(i.position),
          namespace: i.namespace,
          slug: i.slug,
          type: i.type,
          version: Number(i.version),
          hash: i.hash,
          title: i.title,
          status: i.status,
          problems: i.problems,
          warnings: i.warnings,
          checkedAt: isoOrNull(i.checked_at),
          current:
            i.c_version === null
              ? null
              : {
                  version: Number(i.c_version),
                  hash: i.c_hash ?? "",
                  state: i.c_state ?? "draft",
                  publishedVersion: i.c_published_version === null ? null : Number(i.c_published_version),
                  uploadId: i.c_upload_id ?? "",
                },
        })),
      };
    }, staff(orgId));
  }

  /**
   * Take the next item that waits for the runner: one pending, or one whose
   * checker went quiet for `staleMs` (a server that stopped mid-item). Many
   * workers may ask at once; each item goes to one of them.
   */
  async claimNext(orgId: OrgId, staleMs: number, at: Date = new Date()): Promise<ClaimedItem | null> {
    return this.#sql.transaction(async (tx) => {
      const rows = await tx.query<{ upload_id: string; position: number; namespace: ContentNamespace; slug: string; type: string; version: number; hash: string; item: unknown; claimed_at: string | Date }>(
        `UPDATE content_upload_items SET status = 'checking', claimed_at = $2
          WHERE (org_id, upload_id, position) = (
            SELECT org_id, upload_id, position FROM content_upload_items
             WHERE org_id = $1 AND (status = 'pending' OR (status = 'checking' AND claimed_at < $3))
             ORDER BY upload_id, position
             LIMIT 1
             FOR UPDATE SKIP LOCKED)
          RETURNING upload_id, position, namespace, slug, type, version, hash, item, claimed_at`,
        [orgId, at, new Date(at.getTime() - staleMs)],
      );
      const r = rows[0];
      if (r === undefined) return null;
      return { uploadId: r.upload_id, position: Number(r.position), namespace: r.namespace, slug: r.slug, type: r.type, version: Number(r.version), hash: r.hash, item: r.item, claimedAt: iso(r.claimed_at) };
    }, staff(orgId));
  }

  /** Put a claimed item back to wait, as when the runner could not be reached. */
  async releaseItem(orgId: OrgId, claim: Pick<ClaimedItem, "uploadId" | "position" | "claimedAt">): Promise<void> {
    await this.#sql.transaction(
      (tx) =>
        tx.query(`UPDATE content_upload_items SET status = 'pending', claimed_at = NULL WHERE org_id = $1 AND upload_id = $2 AND position = $3 AND status = 'checking' AND claimed_at = $4`, [
          orgId,
          claim.uploadId,
          claim.position,
          claim.claimedAt,
        ]),
      staff(orgId),
    );
  }

  /**
   * An item's report, from the worker that claimed it. One that passed is
   * kept as a draft by the version rule, decided here again against what is
   * kept now (another upload may have changed it since this one came in).
   * The upload is done when this was its last item.
   */
  async finishItem(
    orgId: OrgId,
    claim: Pick<ClaimedItem, "uploadId" | "position" | "claimedAt">,
    result: { readonly problems: readonly GateProblem[]; readonly warnings: readonly string[]; readonly draft: ContentDraft | null },
    at: Date = new Date(),
  ): Promise<FinishOutcome> {
    return this.#sql.transaction(async (tx) => {
      const mine = await tx.query<{ position: number }>(
        `SELECT position FROM content_upload_items WHERE org_id = $1 AND upload_id = $2 AND position = $3 AND status = 'checking' AND claimed_at = $4 FOR UPDATE`,
        [orgId, claim.uploadId, claim.position, claim.claimedAt],
      );
      if (mine.length === 0) return "lost";
      const problems = [...result.problems];
      let status: "passed" | "failed" | "skipped" = problems.length === 0 ? "passed" : "failed";
      if (status === "passed" && result.draft !== null) {
        const kept = await this.#keep(tx, orgId, result.draft, at);
        if (kept.action === "refuse") {
          problems.push({ gate: "version", message: kept.reason });
          status = "failed";
        } else if (kept.action === "skip") status = "skipped";
      }
      await tx.query(
        `UPDATE content_upload_items SET status = $4, problems = $5, warnings = $6, item = NULL, checked_at = $7
          WHERE org_id = $1 AND upload_id = $2 AND position = $3`,
        [orgId, claim.uploadId, claim.position, status, json(problems), json(result.warnings), at],
      );
      await tx.query(
        `UPDATE content_uploads SET state = 'done', finished_at = $3
          WHERE org_id = $1 AND id = $2 AND state = 'checking'
            AND NOT EXISTS (SELECT 1 FROM content_upload_items WHERE org_id = $1 AND upload_id = $2 AND status IN ('pending', 'checking'))`,
        [orgId, claim.uploadId, at],
      );
      return status;
    }, staff(orgId));
  }

  async #keep(tx: SqlExecutor, orgId: OrgId, draft: ContentDraft, at: Date): Promise<VersionDecision> {
    const rows = await tx.query<{ version: number; hash: string; published_version: number | null }>(
      `SELECT version, hash, published_version FROM content_items WHERE org_id = $1 AND namespace = $2 AND slug = $3 FOR UPDATE`,
      [orgId, draft.namespace, draft.slug],
    );
    const current = rows[0] === undefined ? null : { version: Number(rows[0].version), hash: rows[0].hash, publishedVersion: rows[0].published_version === null ? null : Number(rows[0].published_version) };
    if (current === null) {
      const foreign = await this.#foreign(tx, orgId, draft.namespace, draft.slug);
      if (foreign !== null) return { action: "refuse", reason: foreign };
    }
    const decision = versionDecision(current, draft);
    if (decision.action === "create") {
      await tx.query(
        `INSERT INTO content_items (org_id, namespace, slug, type, title, version, hash, item, built, upload_id, warnings, state, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft', $12, $12)`,
        [orgId, draft.namespace, draft.slug, draft.type, draft.title, draft.version, draft.hash, json(draft.item), json(draft.built), draft.uploadId, json(draft.warnings), at],
      );
    } else if (decision.action === "replace") {
      await tx.query(
        `UPDATE content_items SET type = $4, title = $5, version = $6, hash = $7, item = $8, built = $9, upload_id = $10, warnings = $11, state = 'draft', updated_at = $12
          WHERE org_id = $1 AND namespace = $2 AND slug = $3`,
        [orgId, draft.namespace, draft.slug, draft.type, draft.title, draft.version, draft.hash, json(draft.item), json(draft.built), draft.uploadId, json(draft.warnings), at],
      );
    }
    return decision;
  }

  /** Why a slug the uploads do not own yet cannot be taken: a problem or lesson made another way uses it. Null when it is free. */
  async #foreign(tx: SqlExecutor, orgId: OrgId, namespace: ContentNamespace, slug: string): Promise<string | null> {
    const table = namespace === "lesson" ? "prep_lessons" : "practice_problems";
    const rows = await tx.query<{ id: string }>(`SELECT id FROM ${table} WHERE org_id = $1 AND slug = $2`, [orgId, slug]);
    if (rows.length === 0) return null;
    return `The ${namespace} address "${slug}" is used by a ${namespace} that was not uploaded (a starter pack, or one made in the console). Choose another slug.`;
  }

  // --- what is kept -----------------------------------------------------------------------------

  /** The version rule's view of each slug asked about, and whether a problem or lesson made another way uses it. */
  async standing(orgId: OrgId, keys: readonly { readonly namespace: ContentNamespace; readonly slug: string }[]): Promise<ReadonlyMap<string, { readonly version: number; readonly hash: string; readonly publishedVersion: number | null } | { readonly foreign: string }>> {
    const out = new Map<string, { version: number; hash: string; publishedVersion: number | null } | { foreign: string }>();
    if (keys.length === 0) return out;
    return this.#sql.transaction(async (tx) => {
      const problems = keys.filter((k) => k.namespace === "problem").map((k) => k.slug);
      const lessons = keys.filter((k) => k.namespace === "lesson").map((k) => k.slug);
      const kept = await tx.query<{ namespace: ContentNamespace; slug: string; version: number; hash: string; published_version: number | null }>(
        `SELECT namespace, slug, version, hash, published_version FROM content_items
          WHERE org_id = $1 AND ((namespace = 'problem' AND slug = ANY($2)) OR (namespace = 'lesson' AND slug = ANY($3)))`,
        [orgId, problems, lessons],
      );
      for (const k of kept) out.set(`${k.namespace}:${k.slug}`, { version: Number(k.version), hash: k.hash, publishedVersion: k.published_version === null ? null : Number(k.published_version) });
      const other = [
        ...(await tx.query<{ slug: string }>(`SELECT slug FROM practice_problems WHERE org_id = $1 AND slug = ANY($2)`, [orgId, problems])).map((r) => ({ namespace: "problem" as const, slug: r.slug })),
        ...(await tx.query<{ slug: string }>(`SELECT slug FROM prep_lessons WHERE org_id = $1 AND slug = ANY($2)`, [orgId, lessons])).map((r) => ({ namespace: "lesson" as const, slug: r.slug })),
      ];
      for (const o of other) {
        const key = `${o.namespace}:${o.slug}`;
        if (!out.has(key)) out.set(key, { foreign: `The ${o.namespace} address "${o.slug}" is used by a ${o.namespace} that was not uploaded (a starter pack, or one made in the console). Choose another slug.` });
      }
      return out;
    }, staff(orgId));
  }

  async item(orgId: OrgId, namespace: ContentNamespace, slug: string): Promise<ContentItem | null> {
    return this.#sql.transaction(async (tx) => {
      const rows = await tx.query<ItemRow>(`SELECT ${ITEM_COLUMNS} FROM content_items WHERE org_id = $1 AND namespace = $2 AND slug = $3`, [orgId, namespace, slug]);
      return rows[0] === undefined ? null : toItem(rows[0]);
    }, staff(orgId));
  }

  /** Mark a version published, where it was written. Refused (false) if the draft changed meanwhile. */
  async markPublished(
    orgId: OrgId,
    key: { readonly namespace: ContentNamespace; readonly slug: string; readonly version: number; readonly hash: string },
    where: { readonly problemId?: string | null; readonly lessonId?: string | null; readonly children?: Readonly<Record<string, string>> },
    by: ContentAuthor,
    at: Date = new Date(),
  ): Promise<boolean> {
    return this.#sql.transaction(async (tx) => {
      const rows = await tx.query<{ slug: string }>(
        `UPDATE content_items
            SET state = 'published', published_version = version, published_hash = hash, published_at = $6, published_by_id = $7, published_by_name = $8,
                problem_id = coalesce($9, problem_id), lesson_id = coalesce($10, lesson_id), children = coalesce($11, children), updated_at = $6
          WHERE org_id = $1 AND namespace = $2 AND slug = $3 AND version = $4 AND hash = $5
          RETURNING slug`,
        [orgId, key.namespace, key.slug, key.version, key.hash, at, by.id, by.name, where.problemId ?? null, where.lessonId ?? null, where.children === undefined ? null : json(where.children)],
      );
      return rows.length > 0;
    }, staff(orgId));
  }
}
