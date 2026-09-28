import { describe, expect, it } from "vitest";
import { base32, fromBase32, matchTotp, newRecoveryCodes, stepAt, totpCode } from "./totp.js";
import { StaffSecrets } from "./staff-secrets.js";

describe("TOTP", () => {
  // RFC 6238 appendix B, SHA-1, cut to six digits.
  const secret = base32(Buffer.from("12345678901234567890"));

  it("matches the RFC's test vectors", () => {
    expect(secret).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(fromBase32(secret).toString()).toBe("12345678901234567890");
    expect(totpCode(secret, stepAt(59_000))).toBe("287082");
    expect(totpCode(secret, stepAt(1_111_111_109_000))).toBe("081804");
    expect(totpCode(secret, stepAt(1_234_567_890_000))).toBe("005924");
    expect(totpCode(secret, stepAt(2_000_000_000_000))).toBe("279037");
  });

  it("accepts one step of drift either way, and no more", () => {
    const now = 1_234_567_890_000;
    const step = stepAt(now);
    expect(matchTotp(secret, totpCode(secret, step - 1), now)).toBe(step - 1);
    expect(matchTotp(secret, totpCode(secret, step + 1), now)).toBe(step + 1);
    expect(matchTotp(secret, totpCode(secret, step - 2), now)).toBeNull();
    expect(matchTotp(secret, "12345", now)).toBeNull();
  });

  it("makes recovery codes nobody will misread", () => {
    const codes = newRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[a-hj-km-np-z2-9]{5}-[a-hj-km-np-z2-9]{5}$/);
  });
});

describe("staff secrets", () => {
  const secrets = new StaffSecrets("s".repeat(40));

  it("open only for the owner they were sealed for", () => {
    const sealed = secrets.seal("totp", "user-1", "SECRET");
    expect(sealed).not.toContain("SECRET");
    expect(secrets.open("totp", "user-1", sealed)).toBe("SECRET");
    expect(secrets.open("totp", "user-2", sealed)).toBeNull();
    expect(secrets.open("sso-client", "user-1", sealed)).toBeNull();
    expect(new StaffSecrets("t".repeat(40)).open("totp", "user-1", sealed)).toBeNull();
  });

  it("verify only reset tokens they issued", () => {
    const token = secrets.resetToken("reset-1");
    expect(secrets.verifyResetToken(token)).toBe("reset-1");
    expect(secrets.verifyResetToken(token.replace("reset-1", "reset-2"))).toBeNull();
    expect(new StaffSecrets("t".repeat(40)).verifyResetToken(token)).toBeNull();
  });
});
