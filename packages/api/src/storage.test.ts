import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SupabaseStorage, storageFromEnv } from "./storage.js";

/**
 * Supabase Storage for proctoring photos (docs/F1-GO-LIVE-PLAN.md §8.2),
 * against a small stand-in that answers the way Storage's REST API does,
 * "not found" as a 400 included.
 */

const SECRET = "sb_secret_test_key_000000000000_abcdefgh";

interface Seen {
  readonly method: string;
  readonly url: string;
  readonly apikey: string | undefined;
  readonly authorization: string | undefined;
}

let server: Server;
let base: string;
let seen: Seen[];
let buckets: Map<string, { public: boolean }>;
let objects: Map<string, Buffer>;

const body = async (req: IncomingMessage) => {
  const parts: Buffer[] = [];
  for await (const part of req) parts.push(part as Buffer);
  return Buffer.concat(parts);
};

beforeEach(async () => {
  seen = [];
  buckets = new Map();
  objects = new Map();
  server = createServer(async (req, res) => {
    const url = req.url ?? "";
    seen.push({ method: req.method ?? "", url, apikey: req.headers["apikey"] as string | undefined, authorization: req.headers.authorization });
    const send = (status: number, json: unknown) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(json));
    const notFound = () => send(400, { statusCode: "404", error: "not_found", message: "Object not found" });
    if (req.headers["apikey"] !== SECRET) return send(401, { message: "Invalid API key" });
    const data = await body(req);
    let m: RegExpExecArray | null;
    if (req.method === "GET" && (m = /^\/storage\/v1\/bucket\/([^/]+)$/.exec(url))) {
      const b = buckets.get(decodeURIComponent(m[1]!));
      return b === undefined ? send(400, { statusCode: "404", error: "Bucket not found" }) : send(200, { id: m[1], public: b.public });
    }
    if (req.method === "POST" && url === "/storage/v1/bucket") {
      const made = JSON.parse(data.toString()) as { id: string; public: boolean };
      buckets.set(made.id, { public: made.public });
      return send(200, { name: made.id });
    }
    if (req.method === "POST" && (m = /^\/storage\/v1\/object\/(.+)$/.exec(url))) {
      objects.set(decodeURIComponent(m[1]!), data);
      return send(200, { Key: m[1] });
    }
    if (req.method === "GET" && (m = /^\/storage\/v1\/object\/authenticated\/(.+)$/.exec(url))) {
      const o = objects.get(decodeURIComponent(m[1]!));
      return o === undefined ? notFound() : res.writeHead(200, { "content-type": "application/octet-stream" }).end(o);
    }
    if (req.method === "DELETE" && (m = /^\/storage\/v1\/object\/([^/]+)$/.exec(url))) {
      const { prefixes } = JSON.parse(data.toString()) as { prefixes: string[] };
      for (const p of prefixes) objects.delete(`${m[1]}/${p}`);
      return send(200, []);
    }
    return send(500, { message: `unexpected ${req.method} ${url}` });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("Supabase Storage", () => {
  it("makes a private bucket, keeps, fetches and deletes objects, with the secret key in apikey alone", async () => {
    const storage = new SupabaseStorage({ url: `${base}/`, secretKey: SECRET, bucket: "proctor-media" });
    await storage.ensureBucket();
    expect(buckets.get("proctor-media")).toEqual({ public: false });
    await storage.ensureBucket();
    expect(seen.filter((s) => s.method === "POST" && s.url === "/storage/v1/bucket")).toHaveLength(1);

    const bytes = Buffer.from([0, 1, 2, 255]);
    await storage.put("org-a/attempt-1/photo-1", bytes);
    expect(objects.get("proctor-media/org-a/attempt-1/photo-1")?.equals(bytes)).toBe(true);
    expect((await storage.get("org-a/attempt-1/photo-1"))?.equals(bytes)).toBe(true);
    expect(await storage.get("org-a/attempt-1/nothing")).toBeNull();

    await storage.remove(["org-a/attempt-1/photo-1", "org-a/attempt-1/nothing"]);
    expect(objects.size).toBe(0);
    expect(seen.every((s) => s.apikey === SECRET && s.authorization === undefined)).toBe(true);
  });

  it("sends a legacy service_role JWT as the bearer too", async () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.e30.sig";
    const calls: RequestInit[] = [];
    const storage = new SupabaseStorage({
      url: base,
      secretKey: jwt,
      bucket: "b",
      fetch: async (_url, init) => {
        calls.push(init ?? {});
        return new Response("{}", { status: 200 });
      },
    });
    await storage.put("k", Buffer.from("x"));
    expect(calls[0]!.headers).toMatchObject({ apikey: jwt, authorization: `Bearer ${jwt}` });
  });

  it("refuses a public bucket, and says plainly when storage refuses the key", async () => {
    buckets.set("open", { public: true });
    await expect(new SupabaseStorage({ url: base, secretKey: SECRET, bucket: "open" }).ensureBucket()).rejects.toThrow(/is public/);
    await expect(new SupabaseStorage({ url: base, secretKey: "sb_secret_wrong", bucket: "b" }).put("k", Buffer.from("x"))).rejects.toThrow(/answered 401/);
    await expect(new SupabaseStorage({ url: "http://127.0.0.1:1", secretKey: SECRET, bucket: "b" }).get("k")).rejects.toThrow(/could not be reached/);
  });

  it("is configured from the environment, both values or neither", () => {
    expect(storageFromEnv({})).toBeNull();
    expect(storageFromEnv({ SUPABASE_URL: base, SUPABASE_SECRET_KEY: SECRET })).toBeInstanceOf(SupabaseStorage);
    expect(() => storageFromEnv({ SUPABASE_URL: base })).toThrow(/both/);
  });
});
