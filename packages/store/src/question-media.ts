import { createHash } from "node:crypto";
import { withScope, type Scope } from "./ledger-store.js";
import type { SqlExecutor } from "./sql.js";

/**
 * Pictures in questions and passages (migration 0012), stored once by the
 * SHA-256 of their bytes. Only pictures are accepted, recognised by their
 * leading bytes rather than by what the uploader says they are; SVG is not
 * among them, since it can carry script.
 */

export type ImageMime = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

/** Largest picture accepted. A diagram or a chart is a fraction of it. */
export const MAX_IMAGE_BYTES = 2_000_000;

export class NotAnImage extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotAnImage";
  }
}

/** What the bytes are, from their signature; null when they are none of the accepted pictures. */
export function imageMimeOf(bytes: Uint8Array): ImageMime | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

const toBuffer = (value: Buffer | Uint8Array): Buffer => (Buffer.isBuffer(value) ? value : Buffer.from(value));

export class QuestionMedia {
  readonly #sql: SqlExecutor;

  constructor(sql: SqlExecutor) {
    this.#sql = sql;
  }

  /** Keep a picture; the same bytes twice are kept once. Returns its hash. */
  async add(scope: Scope, bytes: Uint8Array): Promise<{ readonly media: string; readonly mime: ImageMime }> {
    if (bytes.length === 0) throw new NotAnImage("The file is empty.");
    if (bytes.length > MAX_IMAGE_BYTES) throw new NotAnImage(`A picture can be at most ${MAX_IMAGE_BYTES / 1_000_000} MB.`);
    const mime = imageMimeOf(bytes);
    if (mime === null) throw new NotAnImage("Only PNG, JPEG, GIF and WebP pictures can be used.");
    const media = createHash("sha256").update(bytes).digest("hex");
    await withScope(this.#sql, scope, (tx) =>
      tx.query(
        `INSERT INTO question_media (org_id, sha256, mime, bytes) VALUES ($1, $2, $3, $4) ON CONFLICT (org_id, sha256) DO NOTHING`,
        [scope.orgId, media, mime, Buffer.from(bytes)],
      ),
    );
    return { media, mime };
  }

  /** A picture by its hash, whoever asks. Null when there is none. */
  async byHash(media: string): Promise<{ readonly mime: ImageMime; readonly bytes: Buffer } | null> {
    if (!/^[0-9a-f]{64}$/.test(media)) return null;
    const rows = await this.#sql.query<{ mime: ImageMime; bytes: Buffer | Uint8Array }>(`SELECT mime, bytes FROM question_media_by_hash($1)`, [media]);
    const row = rows[0];
    return row === undefined ? null : { mime: row.mime, bytes: toBuffer(row.bytes) };
  }
}
