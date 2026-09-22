import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Invitation codes.
 *
 * A code names an organisation and an invitation and carries a MAC over both:
 * `org.invitation.mac`. Nothing about it is stored — the database keeps no
 * code, plain or hashed — so a copy of the database lets nobody sit anyone's
 * exam, and a code can be re-issued (a resend, an export) without being kept.
 * Revoking an invitation revokes its code; the MAC alone proves only that the
 * server issued it.
 */
export class InviteCodes {
  readonly #key: Buffer;

  constructor(secret: string) {
    if (secret.length < 32) throw new Error("The invitation secret must be at least 32 characters");
    // Derived, so the attempt-token secret can serve both without one being
    // usable as the other.
    this.#key = createHmac("sha256", secret).update("parikshaa-invitation-codes").digest();
  }

  #mac(orgId: string, invitationId: string): string {
    // 128 bits: past guessing, short enough for an SMS link.
    return createHmac("sha256", this.#key).update(`${orgId}.${invitationId}`).digest("base64url").slice(0, 22);
  }

  issue(orgId: string, invitationId: string): string {
    return `${orgId}.${invitationId}.${this.#mac(orgId, invitationId)}`;
  }

  /** The organisation and invitation a code names, or null if the server did not issue it. */
  verify(code: string): { orgId: string; invitationId: string } | null {
    const parts = code.trim().split(".");
    if (parts.length !== 3) return null;
    const [orgId, invitationId, mac] = parts as [string, string, string];
    const expected = Buffer.from(this.#mac(orgId, invitationId));
    const given = Buffer.from(mac);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    return { orgId, invitationId };
  }
}
