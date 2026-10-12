/**
 * Where large bytes live when not in Postgres: a bucket (Supabase Storage in
 * production, docs/F1-GO-LIVE-PLAN.md §8.2). Callers seal what they put here;
 * a store sees ciphertext only.
 */
export interface BlobStore {
  /** Keep these bytes under this key, replacing what was there. */
  put(key: string, bytes: Buffer): Promise<void>;
  /** The bytes under this key, or null if there are none. */
  get(key: string): Promise<Buffer | null>;
  /** Delete these keys; a key with nothing under it is not an error. */
  remove(keys: readonly string[]): Promise<void>;
}

/** A bucket in memory, for tests and for development without storage. */
export class MemoryBlobs implements BlobStore {
  readonly objects = new Map<string, Buffer>();

  async put(key: string, bytes: Buffer): Promise<void> {
    this.objects.set(key, Buffer.from(bytes));
  }

  async get(key: string): Promise<Buffer | null> {
    const bytes = this.objects.get(key);
    return bytes === undefined ? null : Buffer.from(bytes);
  }

  async remove(keys: readonly string[]): Promise<void> {
    for (const key of keys) this.objects.delete(key);
  }
}
