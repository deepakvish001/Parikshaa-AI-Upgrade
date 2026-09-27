import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238), the kind Google Authenticator,
 * Microsoft Authenticator, Authy and every password manager produce: HMAC-SHA1,
 * six digits, a new code every thirty seconds.
 *
 * Written out rather than taken from a package because it is thirty lines and
 * sits on the sign-in path, where every dependency is one more thing to trust.
 */

const STEP_SECONDS = 30;
const DIGITS = 6;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32, unpadded: the form authenticator apps take a secret in. */
export function base32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function fromBase32(text: string): Buffer {
  const clean = text.replace(/[\s=]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Not base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A fresh secret: 160 bits, as RFC 4226 recommends for SHA-1. */
export const newTotpSecret = (): string => base32(randomBytes(20));

/** The 30-second step a moment falls in. */
export const stepAt = (nowMs: number): number => Math.floor(nowMs / 1000 / STEP_SECONDS);

/** The code for one step. */
export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", fromBase32(secret)).update(counter).digest();
  const offset = mac[mac.length - 1]! & 15;
  const binary = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return String(binary).padStart(DIGITS, "0");
}

/**
 * The step a code belongs to, if it is right for now or one step either side —
 * phones' clocks drift, and a code typed as it rolls over should still count.
 * The caller must refuse a step already used, or a code could be replayed.
 */
export function matchTotp(secret: string, code: string, nowMs: number): number | null {
  const given = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(given)) return null;
  const now = stepAt(nowMs);
  for (const step of [now, now - 1, now + 1]) {
    const expected = totpCode(secret, step);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(given))) return step;
  }
  return null;
}

/** The `otpauth://` URI an authenticator app scans from a QR code. */
export function otpauthUri(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Ten one-time recovery codes, `xxxxx-xxxxx`, from an alphabet with nothing to misread. */
export function newRecoveryCodes(count = 10): string[] {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: count }, () => {
    const chars = Array.from({ length: 10 }, () => alphabet[randomInt(alphabet.length)]).join("");
    return `${chars.slice(0, 5)}-${chars.slice(5)}`;
  });
}

/** Recovery codes are compared in one canonical form: lower case, no spaces or dashes. */
export const normaliseRecoveryCode = (code: string): string => code.toLowerCase().replace(/[\s-]/g, "");
