import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The server's own secrets about staff accounts (ROADMAP §1): TOTP secrets and
 * SSO client secrets sealed for storage, password-reset links, and the state
 * carried through a single sign-on round trip.
 *
 * Every key here is derived from the server's secret for one purpose, so none
 * is usable as another, and a copy of the database holds nothing that works.
 */
export class StaffSecrets {
  readonly #root: Buffer;

  constructor(secret: string) {
    if (secret.length < 32) throw new Error("The server secret must be at least 32 characters");
    this.#root = createHmac("sha256", secret).update("parikshaa-staff-secrets").digest();
  }

  #key(purpose: string): Buffer {
    return createHmac("sha256", this.#root).update(purpose).digest();
  }

  /** Encrypt a value for storage, bound to what it belongs to: it will not open as anyone else's. */
  seal(purpose: string, owner: string, plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.#key(`seal:${purpose}`), iv);
    cipher.setAAD(Buffer.from(owner));
    const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64url");
  }

  /** Null if the value was not sealed for this owner by this server. */
  open(purpose: string, owner: string, sealed: string): string | null {
    try {
      const bytes = Buffer.from(sealed, "base64url");
      if (bytes.length < 28) return null;
      const decipher = createDecipheriv("aes-256-gcm", this.#key(`seal:${purpose}`), bytes.subarray(0, 12));
      decipher.setAAD(Buffer.from(owner));
      decipher.setAuthTag(bytes.subarray(bytes.length - 16));
      return Buffer.concat([decipher.update(bytes.subarray(12, bytes.length - 16)), decipher.final()]).toString("utf8");
    } catch {
      return null;
    }
  }

  #resetMac(id: string): string {
    return createHmac("sha256", this.#key("password-reset")).update(id).digest("base64url").slice(0, 32);
  }

  /**
   * A link that shows an address is the account's: the account's id and a MAC
   * over the id and the address. Nothing is stored, and a link for an address
   * the account no longer has stops working.
   */
  emailToken(userId: string, email: string): string {
    return `${userId}.${this.#emailMac(userId, email)}`;
  }

  /** The account an email link names, if this server made it for `email`; the caller supplies the account's current address. */
  emailTokenUser(token: string): string | null {
    const dot = token.lastIndexOf(".");
    return dot <= 0 ? null : token.slice(0, dot);
  }

  checkEmailToken(token: string, email: string): boolean {
    const id = this.emailTokenUser(token);
    if (id === null) return false;
    const expected = Buffer.from(this.#emailMac(id, email));
    const given = Buffer.from(token.slice(token.lastIndexOf(".") + 1));
    return given.length === expected.length && timingSafeEqual(given, expected);
  }

  #emailMac(userId: string, email: string): string {
    return createHmac("sha256", this.#key("staff-email")).update(`${userId}\n${email.trim().toLowerCase()}`).digest("base64url").slice(0, 32);
  }

  /** A reset link's token: the reset's id and a MAC over it. Nothing about it is stored. */
  resetToken(id: string): string {
    return `${id}.${this.#resetMac(id)}`;
  }

  /** The reset a token names, if this server issued it. Whether it is still usable is the store's to say. */
  verifyResetToken(token: string): string | null {
    const dot = token.lastIndexOf(".");
    if (dot <= 0) return null;
    const id = token.slice(0, dot);
    const expected = Buffer.from(this.#resetMac(id));
    const given = Buffer.from(token.slice(dot + 1));
    return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
  }
}
