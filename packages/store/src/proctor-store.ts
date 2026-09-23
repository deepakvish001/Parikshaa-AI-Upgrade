import { createHash } from "node:crypto";
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
 */

export type MediaKind = "selfie" | "id" | "snapshot";
export type ProctorEventKind = "tab_hidden" | "fullscreen_exit" | "copy" | "paste" | "camera_off" | "camera_on";

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
const toBuffer = (value: Buffer | Uint8Array): Buffer => (Buffer.isBuffer(value) ? value : Buffer.from(value));

export class ProctorStore {
  readonly #sql: SqlExecutor;
  readonly #keys: DataKeys | null;
  readonly #newId: () => string;

  constructor(sql: SqlExecutor, keys: DataKeys | null, options: { readonly newId?: () => string } = {}) {
    this.#sql = sql;
    this.#keys = keys;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
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
    return withScope(this.#sql, scope, async (tx) => {
      const key = await this.#key(tx, scope, attemptId);
      const id = this.#newId();
      const sha256 = createHash("sha256").update(image).digest("hex");
      await tx.query(
        `INSERT INTO proctor_media (org_id, attempt_id, id, kind, taken_at, sha256, sealed) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [scope.orgId, attemptId, id, kind, takenAt.toISOString(), sha256, sealBytes(key, image, aadOf(attemptId, id))],
      );
      return { id, kind, takenAt: takenAt.toISOString(), sha256 };
    });
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
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ id: string; kind: MediaKind; taken_at: string | Date; sha256: string; sealed: Buffer | Uint8Array }>(
        `SELECT id, kind, taken_at, sha256, sealed FROM proctor_media WHERE org_id = $1 AND attempt_id = $2 AND id = $3`,
        [scope.orgId, attemptId, mediaId],
      );
      const row = rows[0];
      if (row === undefined) return null;
      const key = await this.#key(tx, scope, attemptId);
      return {
        record: { id: row.id, kind: row.kind, takenAt: new Date(row.taken_at).toISOString(), sha256: row.sha256 },
        image: openBytes(key, toBuffer(row.sealed), aadOf(attemptId, row.id)),
      };
    });
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
        `SELECT kind, at FROM proctor_events WHERE org_id = $1 AND attempt_id = $2 ORDER BY at ASC, id ASC LIMIT $3`,
        [scope.orgId, attemptId, limit],
      );
      return rows.map((r) => ({ kind: r.kind, at: new Date(r.at).toISOString() }));
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
