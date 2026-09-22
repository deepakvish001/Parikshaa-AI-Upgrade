import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request as httpRequest, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

/**
 * Requests to addresses a customer typed in: webhook endpoints, and the URL
 * Greenhouse hands us to report a test complete.
 *
 * A URL from outside is a way in if it is fetched naively: point a webhook at
 * `http://169.254.169.254/` or `http://10.0.0.5:5432/` and the server fetches
 * its own cloud credentials or pokes its own database. So:
 *
 * - HTTPS only.
 * - Every address the name resolves to must be public; one private address
 *   refuses the lot. The check is made in the socket's own DNS lookup, so the
 *   address checked is the address connected to — a name that resolves to a
 *   public address for the check and a private one for the connection (DNS
 *   rebinding) gets nowhere.
 * - Redirects are not followed, and at most 64 KiB of the reply is read.
 */

/** Addresses that are not the public internet. */
const PRIVATE = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, and the cloud metadata service
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, and broadcast
] as const) {
  PRIVATE.addSubnet(net, bits, "ipv4");
}
for (const [net, bits] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b:1::", 48], // local-use NAT64
  ["100::", 64], // discard
  ["2001:db8::", 32], // documentation
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
] as const) {
  PRIVATE.addSubnet(net, bits, "ipv6");
}

/** Whether an address is on the public internet. IPv6 forms that carry an IPv4 address are judged by it. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !PRIVATE.check(address, "ipv4");
  if (family !== 6) return false;
  const lower = address.toLowerCase();
  // ::ffff:a.b.c.d, ::a.b.c.d, 64:ff9b::a.b.c.d (NAT64) and 2002:aabb:ccdd:: (6to4) all reach an IPv4 address.
  const embedded = embeddedIpv4(lower);
  if (embedded !== null) return isPublicAddress(embedded);
  return !PRIVATE.check(lower, "ipv6");
}

function embeddedIpv4(address: string): string | null {
  const dotted = address.match(/^(?:::ffff:|::|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted !== null) return dotted[1]!;
  const hex = address.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  const sixToFour = address.match(/^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4})(?::|$)/);
  const parts = hex ?? sixToFour;
  if (parts === null) return null;
  const [hi, lo] = [parseInt(parts[1]!, 16), parseInt(parts[2]!, 16)];
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

/** A URL that will never be fetched: raised before anything is sent. */
export class UnsafeUrl extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrl";
  }
}

export interface SafeHttpOptions {
  /** For tests against a local server only: allow http and private addresses. */
  readonly allowPrivate?: boolean;
  readonly timeoutMs?: number;
}

/** Checks a URL can be fetched at all, without resolving it. For validating what a user typed. */
export function checkUrl(raw: string, options: SafeHttpOptions = {}): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrl("Not a URL");
  }
  if (url.protocol !== "https:" && !(options.allowPrivate === true && url.protocol === "http:")) {
    throw new UnsafeUrl("Only https URLs are allowed");
  }
  if (url.username !== "" || url.password !== "") throw new UnsafeUrl("A URL may not carry credentials");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (options.allowPrivate !== true) {
    if (isIP(host) !== 0 && !isPublicAddress(host)) throw new UnsafeUrl("That address is not on the public internet");
    if (isIP(host) === 0 && (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || !host.includes("."))) {
      throw new UnsafeUrl("That address is not on the public internet");
    }
  }
  return url;
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** A DNS lookup that refuses a name if any address it resolves to is private. */
function guardedLookup(hostname: string, options: { all?: boolean }, callback: LookupCallback): void {
  dnsLookup(hostname, { all: true }, (error, addresses) => {
    if (error !== null) return callback(error, []);
    const refused = addresses.find((a) => !isPublicAddress(a.address));
    if (refused !== undefined || addresses.length === 0) {
      const denied = Object.assign(new UnsafeUrl(`${hostname} resolves to an address that is not on the public internet`), { code: "EPRIVATE" });
      return callback(denied as unknown as NodeJS.ErrnoException, []);
    }
    if (options.all === true) return callback(null, addresses);
    return callback(null, addresses[0]!.address, addresses[0]!.family);
  });
}

export interface SafeResponse {
  readonly status: number;
  readonly body: string;
}

const MAX_BODY = 64 * 1024;

/** Send one request. Throws `UnsafeUrl` for a URL it will not fetch, and ordinary errors for failures on the way. */
export function safeRequest(
  raw: string,
  init: { readonly method: "POST" | "PATCH" | "GET"; readonly headers?: Record<string, string>; readonly body?: string },
  options: SafeHttpOptions = {},
): Promise<SafeResponse> {
  const url = checkUrl(raw, options);
  const requestOptions: RequestOptions = {
    method: init.method,
    headers: {
      "user-agent": "Parikshaa-Webhooks/1",
      ...(init.body === undefined ? { "content-length": "0" } : { "content-length": String(Buffer.byteLength(init.body)) }),
      ...init.headers,
    },
    timeout: options.timeoutMs ?? 10_000,
    ...(options.allowPrivate === true ? {} : { lookup: guardedLookup as unknown as RequestOptions["lookup"] }),
  };
  const send = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const req = send(url, requestOptions, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size <= MAX_BODY) chunks.push(chunk);
        else res.destroy();
      });
      const done = () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8").slice(0, MAX_BODY) });
      res.on("end", done);
      res.on("close", done);
    });
    req.on("timeout", () => req.destroy(new Error(`No answer from ${url.host} within ${(options.timeoutMs ?? 10_000) / 1000}s`)));
    req.on("error", (error) => reject(error instanceof UnsafeUrl || (error as { code?: string }).code === "EPRIVATE" ? new UnsafeUrl(error.message) : error));
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}
