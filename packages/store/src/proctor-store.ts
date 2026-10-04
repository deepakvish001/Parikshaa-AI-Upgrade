import { createHash } from "node:crypto";
import type { BlobStore } from "./blobs.js";
import { withScope, type Scope } from "./ledger-store.js";
import { openBytes, sealBytes, type DataKeys } from "./sealing.js";
import type { SqlExecutor } from "./sql.js";

/**
 * Proctoring photos and browser events (ROADMAP §14; migration 0011).
 *
 * Every photo is sealed under its attempt's data key before it is stored,
 * bound to the attempt and to its own id, so a photo cannot be moved to
 * another attempt and read there; erasing the attempt's key makes every photo
 * unreadable, as it does the answers.
 *
 * Given a {@link BlobStore}, the sealed bytes go to it (a bucket) under
 * `<org>/<attempt>/<photo>`, and the row keeps the key (migration 0066). Rows
 * from before keep their bytes in the table, and still open.
 */

export type MediaKind = "selfie" | "id" | "snapshot";
export type ProctorEventKind =
  | "tab_hidden"
  | "fullscreen_exit"
  | "copy"
  | "paste"
  | "camera_off"
  | "camera_on"
  | "screen_share_off"
  | "screen_share_on"
  | "second_screen"
  | "voice";

export interface MediaRecord {
  readonly id: string;
  readonly kind: MediaKind;
  readonly takenAt: string;
  readonly sha256: string;
}

export interface ProctorEvent {
  readonly kind: ProctorEventKind;
  readonly at: string;
}

/** What the live view shows per attempt: no photo, just whether the camera is keeping up and what the browser said. */
export interface ProctorSummary {
  readonly snapshots: number;
  readonly lastSnapshotAt: number | null;
  readonly events: Readonly<Partial<Record<ProctorEventKind, number>>>;
}

/** The attempt's data key is gone (erased) or was never made: nothing personal may be stored for it. */
export class NoDataKey extends Error {
  constructor() {
    super("This attempt has no data key to seal photos under");
    this.name = "NoDataKey";
  }
}

const aadOf = (attemptId: string, mediaId: string) => `${attemptId}/media/${mediaId}`;
const timelineAad = (attemptId: string, questionId: string) => `${attemptId}/timeline/${questionId}`;
const objectKeyOf = (orgId: string, attemptId: string, mediaId: string) => `${orgId}/${attemptId}/${mediaId}`;
const toBuffer = (value: Buffer | Uint8Array): Buffer => (Buffer.isBuffer(value) ? value : Buffer.from(value));

export class ProctorStore {
  readonly #sql: SqlExecutor;
  readonly #keys: DataKeys | null;
  readonly #newId: () => string;
  readonly #blobs: BlobStore | null;

  constructor(sql: SqlExecutor, keys: DataKeys | null, options: { readonly newId?: () => string; readonly blobs?: BlobStore | null } = {}) {
    this.#sql = sql;
    this.#keys = keys;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
    this.#blobs = options.blobs ?? null;
  }

  async #key(tx: SqlExecutor, scope: Scope, attemptId: string): Promise<Buffer> {
    const rows = await tx.query<{ wrapped_key: string | null }>(`SELECT wrapped_key FROM attempt_keys WHERE org_id = $1 AND attempt_id = $2`, [
      scope.orgId,
      attemptId,
    ]);
    const wrapped = rows[0]?.wrapped_key;
    if (wrapped === undefined || wrapped === null || this.#keys === null) throw new NoDataKey();
    return this.#keys.unwrap(scope.orgId, attemptId, wrapped);
  }

  /** Seal and keep a photo. Returns its id and the SHA-256 of the image as taken. */
  async addMedia(scope: Scope, attemptId: string, kind: MediaKind, image: Buffer, takenAt: Date): Promise<MediaRecord> {
    const id = this.#newId();
    const sha256 = createHash("sha256").update(image).digest("hex");
    const record = { id, kind, takenAt: takenAt.toISOString(), sha256 };
    const insert = `INSERT INTO proctor_media (org_id, attempt_id, id, kind, taken_at, sha256, sealed, object_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
    const blobs = this.#blobs;
    if (blobs === null) {
      return withScope(this.#sql, scope, async (tx) => {
        const sealed = sealBytes(await this.#key(tx, scope, attemptId), image, aadOf(attemptId, id));
        await tx.query(insert, [scope.orgId, attemptId, id, kind, record.takenAt, sha256, sealed, null]);
        return record;
      });
    }
    // The upload happens outside a transaction, so no connection waits on the
    // bucket; the object is in place before the row that names it.
    const sealed = sealBytes(await withScope(this.#sql, scope, (tx) => this.#key(tx, scope, attemptId)), image, aadOf(attemptId, id));
    const objectKey = objectKeyOf(scope.orgId, attemptId, id);
    await blobs.put(objectKey, sealed);
    await withScope(this.#sql, scope, (tx) => tx.query(insert, [scope.orgId, attemptId, id, kind, record.takenAt, sha256, null, objectKey]));
    return record;
  }

  /** How many photos of a kind an attempt already has: a cap on what a page can send. */
  async countMedia(scope: Scope, attemptId: string, kind: MediaKind): Promise<number> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ n: number | string }>(
        `SELECT count(*) AS n FROM proctor_media WHERE org_id = $1 AND attempt_id = $2 AND kind = $3`,
        [scope.orgId, attemptId, kind],
      );
      return Number(rows[0]?.n ?? 0);
    });
  }

  /** An attempt's photos, newest first, without the images. Staff only. */
  async media(scope: Scope, attemptId: string, kind?: MediaKind, limit = 500): Promise<readonly MediaRecord[]> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ id: string; kind: MediaKind; taken_at: string | Date; sha256: string }>(
        `SELECT id, kind, taken_at, sha256 FROM proctor_media
          WHERE org_id = $1 AND attempt_id = $2 AND ($3::text IS NULL OR kind = $3)
          ORDER BY taken_at DESC, id DESC LIMIT $4`,
        [scope.orgId, attemptId, kind ?? null, limit],
      );
      return rows.map((r) => ({ id: r.id, kind: r.kind, takenAt: new Date(r.taken_at).toISOString(), sha256: r.sha256 }));
    });
  }

  /** One photo, opened. Null if there is no such photo. Throws {@link NoDataKey} once the attempt is erased. */
  async open(scope: Scope, attemptId: string, mediaId: string): Promise<{ record: MediaRecord; image: Buffer } | null> {
    const found = await withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{
        id: string;
        kind: MediaKind;
        taken_at: string | Date;
        sha256: string;
        sealed: Buffer | Uint8Array | null;
        object_key: string | null;
      }>(
        `SELECT id, kind, taken_at, sha256, sealed, object_key FROM proctor_media WHERE org_id = $1 AND attempt_id = $2 AND id = $3`,
        [scope.orgId, attemptId, mediaId],
      );
      const row = rows[0];
      if (row === undefined) return null;
      return { row, key: await this.#key(tx, scope, attemptId) };
    });
    if (found === null) return null;
    const { row, key } = found;
    let sealed: Buffer | null = row.sealed === null ? null : toBuffer(row.sealed);
    if (sealed === null && row.object_key !== null) {
      if (this.#blobs === null) throw new Error("This photo is kept in storage, and no storage is configured");
      sealed = await this.#blobs.get(row.object_key);
    }
    if (sealed === null) return null;
    return {
      record: { id: row.id, kind: row.kind, takenAt: new Date(row.taken_at).toISOString(), sha256: row.sha256 },
      image: openBytes(key, sealed, aadOf(attemptId, row.id)),
    };
  }

  /**
   * Carry up to `limit` photos kept in the table over to storage: each sealed
   * as it was, put in the bucket, then the row changed to name it. Returns
   * how many moved; run until it returns 0.
   */
  async moveToBlobs(scope: Scope, limit = 100): Promise<number> {
    const blobs = this.#blobs;
    if (blobs === null) throw new Error("No storage to move photos to");
    const rows = await withScope(this.#sql, scope, (tx) =>
      tx.query<{ attempt_id: string; id: string; sealed: Buffer | Uint8Array }>(
        `SELECT attempt_id, id, sealed FROM proctor_media WHERE org_id = $1 AND sealed IS NOT NULL ORDER BY taken_at, id LIMIT $2`,
        [scope.orgId, limit],
      ),
    );
    let moved = 0;
    for (const row of rows) {
      const objectKey = objectKeyOf(scope.orgId, row.attempt_id, row.id);
      await blobs.put(objectKey, toBuffer(row.sealed));
      const done = await withScope(this.#sql, scope, (tx) =>
        tx.query(
          `UPDATE proctor_media SET sealed = NULL, object_key = $3 WHERE org_id = $1 AND id = $2 AND sealed IS NOT NULL RETURNING id`,
          [scope.orgId, row.id, objectKey],
        ),
      );
      moved += done.length;
    }
    return moved;
  }

  /** Delete from storage the objects of erased attempts' photos (migration 0066's trash). Returns how many. */
  async emptyTrash(scope: Scope, limit = 500): Promise<number> {
    const blobs = this.#blobs;
    if (blobs === null) return 0;
    const keys = await withScope(this.#sql, scope, async (tx) =>
      (await tx.query<{ object_key: string }>(`SELECT object_key FROM media_trash WHERE org_id = $1 ORDER BY trashed_at LIMIT $2`, [scope.orgId, limit])).map(
        (r) => r.object_key,
      ),
    );
    if (keys.length === 0) return 0;
    await blobs.remove(keys);
    await withScope(this.#sql, scope, (tx) => tx.query(`DELETE FROM media_trash WHERE org_id = $1 AND object_key = ANY($2::text[])`, [scope.orgId, keys]));
    return keys.length;
  }

  async addEvent(scope: Scope, attemptId: string, kind: ProctorEventKind, at: Date): Promise<void> {
    await withScope(this.#sql, scope, (tx) =>
      tx.query(`INSERT INTO proctor_events (org_id, attempt_id, id, kind, at) VALUES ($1, $2, $3, $4, $5)`, [
        scope.orgId,
        attemptId,
        this.#newId(),
        kind,
        at.toISOString(),
      ]),
    );
  }

  async events(scope: Scope, attemptId: string, limit = 1000): Promise<readonly ProctorEvent[]> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ kind: ProctorEventKind; at: string | Date }>(
        `SELECT kind, at FROM proctor_events WHERE org_id = $1 AND attempt_id = $2 ORDER BY at ASC, seq ASC LIMIT $3`,
        [scope.orgId, attemptId, limit],
      );
      return rows.map((r) => ({ kind: r.kind, at: new Date(r.at).toISOString() }));
    });
  }

  // --- code playback (migration 0069, G4) ------------------------------------------

  /** How many bytes of editor changes this attempt has sent, for the cap. */
  async timelineBytes(scope: Scope, attemptId: string): Promise<number> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ total: string | number | null }>(`SELECT sum(bytes) AS total FROM code_timeline WHERE org_id = $1 AND attempt_id = $2`, [scope.orgId, attemptId]);
      return Number(rows[0]?.total ?? 0);
    });
  }

  /** Seal and keep one batch of a code question's editor changes, as the browser sent it (JSON). */
  async addTimeline(scope: Scope, attemptId: string, questionId: string, batch: string, receivedAt: Date): Promise<void> {
    await withScope(this.#sql, scope, async (tx) => {
      const sealed = sealBytes(await this.#key(tx, scope, attemptId), Buffer.from(batch, "utf8"), timelineAad(attemptId, questionId));
      await tx.query(`INSERT INTO code_timeline (org_id, attempt_id, question_id, received_at, bytes, sealed) VALUES ($1, $2, $3, $4, $5, $6)`, [
        scope.orgId,
        attemptId,
        questionId,
        receivedAt.toISOString(),
        Buffer.byteLength(batch, "utf8"),
        sealed,
      ]);
    });
  }

  /** Every batch of an attempt's editor changes, opened, in the order they arrived. Staff only. */
  async timeline(scope: Scope, attemptId: string): Promise<readonly { readonly questionId: string; readonly batch: string }[]> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ question_id: string; sealed: Buffer | Uint8Array }>(
        `SELECT question_id, sealed FROM code_timeline WHERE org_id = $1 AND attempt_id = $2 ORDER BY seq ASC`,
        [scope.orgId, attemptId],
      );
      if (rows.length === 0) return [];
      const key = await this.#key(tx, scope, attemptId);
      return rows.map((r) => ({ questionId: r.question_id, batch: openBytes(key, toBuffer(r.sealed), timelineAad(attemptId, r.question_id)).toString("utf8") }));
    });
  }

  /** Per attempt of an exam: snapshot count, the last one's time, and event counts. For the live view. */
  async summary(scope: Scope, examId: string): Promise<ReadonlyMap<string, ProctorSummary>> {
    return withScope(this.#sql, scope, async (tx) => {
      const [media, events] = await Promise.all([
        tx.query<{ attempt_id: string; n: number | string; last: string | Date | null }>(
          `SELECT m.attempt_id, count(*) AS n, max(m.taken_at) AS last
             FROM proctor_media m JOIN attempts a ON a.org_id = m.org_id AND a.id = m.attempt_id
            WHERE m.org_id = $1 AND a.exam_id = $2 AND m.kind = 'snapshot'
            GROUP BY m.attempt_id`,
          [scope.orgId, examId],
        ),
        tx.query<{ attempt_id: string; kind: ProctorEventKind; n: number | string }>(
          `SELECT e.attempt_id, e.kind, count(*) AS n
             FROM proctor_events e JOIN attempts a ON a.org_id = e.org_id AND a.id = e.attempt_id
            WHERE e.org_id = $1 AND a.exam_id = $2
            GROUP BY e.attempt_id, e.kind`,
          [scope.orgId, examId],
        ),
      ]);
      const out = new Map<string, { snapshots: number; lastSnapshotAt: number | null; events: Partial<Record<ProctorEventKind, number>> }>();
      const entry = (id: string) => {
        let e = out.get(id);
        if (e === undefined) {
          e = { snapshots: 0, lastSnapshotAt: null, events: {} };
          out.set(id, e);
        }
        return e;
      };
      for (const m of media) {
        const e = entry(m.attempt_id);
        e.snapshots = Number(m.n);
        e.lastSnapshotAt = m.last === null ? null : new Date(m.last).getTime();
      }
      for (const ev of events) entry(ev.attempt_id).events[ev.kind] = Number(ev.n);
      return out;
    });
  }
}
