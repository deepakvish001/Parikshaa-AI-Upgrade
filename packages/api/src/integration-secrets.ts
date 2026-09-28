import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Secrets for integrations, derived rather than stored.
 *
 * A webhook's signing secret and an organisation's Greenhouse key are each an
 * HMAC of what they belong to and a version number, under a key derived from
 * the server's secret. The database holds only the version, so a copy of it
 * signs nothing and authenticates as no one; rotating one is a version bump.
 * Rotating the server secret rotates them all — say so to the customer first.
 */
export class IntegrationSecrets {
  readonly #key: Buffer;

  constructor(secret: string) {
    if (secret.length < 32) throw new Error("The integration secret must be at least 32 characters");
    this.#key = createHmac("sha256", secret).update("parikshaa-integration-secrets").digest();
  }

  #derive(purpose: string, ...parts: readonly (string | number)[]): Buffer {
    return createHmac("sha256", this.#key).update([purpose, ...parts].join("\u0000")).digest();
  }

  /**
   * A webhook's signing secret, in the Standard Webhooks form: `whsec_` and the
   * base64 of the key bytes, which is what their verification libraries take.
   */
  webhookSecret(orgId: string, webhookId: string, version: number): string {
    return `whsec_${this.#derive("webhook", orgId, webhookId, version).toString("base64")}`;
  }

  /** The organisation's Greenhouse key: `ghk.<org>.<version>.<mac>`. Greenhouse requires fewer than 171 characters. */
  greenhouseKey(orgId: string, version: number): string {
    return `ghk.${orgId}.${version}.${this.#derive("greenhouse", orgId, version).toString("base64url")}`;
  }

  /**
   * An applicant-tracking system's inbound key, `atk.<org>.<provider>.<version>.<mac>`:
   * what Lever, Zoho Recruit or Darwinbox presents when it asks for a test.
   */
  atsKey(orgId: string, provider: string, version: number): string {
    return `atk.${orgId}.${provider}.${version}.${this.#derive("ats", orgId, provider, version).toString("base64url")}`;
  }

  /** The organisation, provider and version an ATS key names, if the server issued it. Whether that version is current is the caller's to check. */
  verifyAtsKey(key: string): { orgId: string; provider: string; version: number } | null {
    const parts = key.split(".");
    if (parts.length !== 5 || parts[0] !== "atk" || !/^\d{1,9}$/.test(parts[3]!)) return null;
    const [, orgId, provider, version] = parts as [string, string, string, string, string];
    const expected = Buffer.from(this.atsKey(orgId, provider, Number(version)));
    const given = Buffer.from(key);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    return { orgId, provider, version: Number(version) };
  }

  /** The organisation and version a Greenhouse key names, if the server issued it. Whether that version is current is the caller's to check. */
  verifyGreenhouseKey(key: string): { orgId: string; version: number } | null {
    const parts = key.split(".");
    if (parts.length !== 4 || parts[0] !== "ghk" || !/^\d{1,9}$/.test(parts[2]!)) return null;
    const [, orgId, version] = parts as [string, string, string, string];
    const expected = Buffer.from(this.greenhouseKey(orgId, Number(version)));
    const given = Buffer.from(key);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    return { orgId, version: Number(version) };
  }
}

/**
 * Sign a webhook as Standard Webhooks does (standardwebhooks.com): HMAC-SHA256
 * over `id.timestamp.body` with the secret's key bytes, base64, prefixed `v1,`.
 */
export function signWebhook(secret: string, id: string, timestampSeconds: number, body: string): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return `v1,${createHmac("sha256", key).update(`${id}.${timestampSeconds}.${body}`).digest("base64")}`;
}
