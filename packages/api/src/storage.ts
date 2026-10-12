import type { BlobStore } from "@parikshaa/store";

/**
 * Supabase Storage as a {@link BlobStore} (docs/F1-GO-LIVE-PLAN.md §8.2):
 * proctoring photos in a private bucket, sealed before they are sent.
 *
 * Spoken to over its REST API with the project's secret key. A new-style key
 * (`sb_secret_…`) goes in the `apikey` header alone: it is not a JWT, and the
 * gateway refuses one in `Authorization`. A legacy `service_role` JWT goes in
 * both, as that API expects.
 */
export class SupabaseStorage implements BlobStore {
  readonly #base: string;
  readonly #bucket: string;
  readonly #headers: Record<string, string>;
  readonly #fetch: typeof fetch;

  constructor(options: { readonly url: string; readonly secretKey: string; readonly bucket: string; readonly fetch?: typeof fetch }) {
    this.#base = `${options.url.replace(/\/$/, "")}/storage/v1`;
    this.#bucket = options.bucket;
    this.#headers = options.secretKey.startsWith("eyJ")
      ? { apikey: options.secretKey, authorization: `Bearer ${options.secretKey}` }
      : { apikey: options.secretKey };
    this.#fetch = options.fetch ?? fetch;
  }

  #object(key: string): string {
    return `${this.#base}/object/${encodeURIComponent(this.#bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  async #send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.#fetch(url, { ...init, headers: { ...this.#headers, ...(init.headers as Record<string, string> | undefined) }, signal: AbortSignal.timeout(30_000) });
    } catch (error) {
      throw new Error(`Storage could not be reached: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Make the bucket if it is not there, private. Refuses to go on with a
   * public one: anyone could then list and fetch every object in it.
   */
  async ensureBucket(): Promise<void> {
    const found = await this.#send(`${this.#base}/bucket/${encodeURIComponent(this.#bucket)}`, { method: "GET" });
    if (found.ok) {
      const bucket = (await found.json()) as { public?: boolean };
      if (bucket.public === true) throw new Error(`The storage bucket "${this.#bucket}" is public; make it private before using it`);
      return;
    }
    if (!isMissing(found.status, await found.text())) throw new Error(`Storage answered ${found.status} when asked for the bucket`);
    const made = await this.#send(`${this.#base}/bucket`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: this.#bucket, name: this.#bucket, public: false }),
    });
    if (!made.ok) throw new Error(`Storage answered ${made.status} when making the bucket`);
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    const response = await this.#send(this.#object(key), {
      method: "POST",
      headers: { "content-type": "application/octet-stream", "x-upsert": "true" },
      body: new Uint8Array(bytes),
    });
    if (!response.ok) throw new Error(`Storage answered ${response.status} when keeping an object`);
  }

  async get(key: string): Promise<Buffer | null> {
    const response = await this.#send(this.#object(key).replace("/object/", "/object/authenticated/"), { method: "GET" });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (isMissing(response.status, await response.text())) return null;
    throw new Error(`Storage answered ${response.status} when fetching an object`);
  }

  async remove(keys: readonly string[]): Promise<void> {
    for (let i = 0; i < keys.length; i += 1000) {
      const response = await this.#send(`${this.#base}/object/${encodeURIComponent(this.#bucket)}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prefixes: keys.slice(i, i + 1000) }),
      });
      if (!response.ok) throw new Error(`Storage answered ${response.status} when deleting objects`);
    }
  }
}

/** Storage says "not found" as a 404, or as a 400 whose body carries 404. */
function isMissing(status: number, body: string): boolean {
  if (status === 404) return true;
  if (status !== 400) return false;
  try {
    const parsed = JSON.parse(body) as { statusCode?: string | number; error?: string };
    return String(parsed.statusCode) === "404" || parsed.error === "not_found" || parsed.error === "Not found";
  } catch {
    return false;
  }
}

/** Storage from the environment, or null when it is not configured (photos then stay in Postgres). */
export function storageFromEnv(env: NodeJS.ProcessEnv): SupabaseStorage | null {
  const url = env["SUPABASE_URL"];
  const secretKey = env["SUPABASE_SECRET_KEY"];
  if ((url ?? "") === "" && (secretKey ?? "") === "") return null;
  if ((url ?? "") === "" || (secretKey ?? "") === "") throw new Error("Set both SUPABASE_URL and SUPABASE_SECRET_KEY to keep photos in Supabase Storage, or neither");
  return new SupabaseStorage({ url: url!, secretKey: secretKey!, bucket: env["MEDIA_BUCKET"] || "proctor-media" });
}
