import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { IntegrationSecrets, signWebhook } from "./integration-secrets.js";
import { checkUrl, isPublicAddress, safeRequest, UnsafeUrl } from "./safe-http.js";

/** ROADMAP §7: an address a customer typed in is never a way into this server's network. */

vi.mock("node:dns", async (actual) => {
  const real = await actual<typeof import("node:dns")>();
  const fake: Record<string, { address: string; family: number }[]> = {
    "rebind.example.com": [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ],
    "metadata.example.com": [{ address: "169.254.169.254", family: 4 }],
    "v6-loopback.example.com": [{ address: "::1", family: 6 }],
  };
  return {
    ...real,
    lookup: (host: string, options: unknown, callback: (e: Error | null, a: unknown) => void) => {
      const answer = fake[host];
      if (answer !== undefined) return callback(null, answer);
      return (real.lookup as unknown as (h: string, o: unknown, c: unknown) => void)(host, options, callback);
    },
  };
});

describe("which addresses are public", () => {
  it.each([
    ["10.1.2.3"],
    ["127.0.0.1"],
    ["169.254.169.254"],
    ["172.20.0.1"],
    ["192.168.1.1"],
    ["100.64.0.1"],
    ["0.0.0.0"],
    ["224.0.0.1"],
    ["::1"],
    ["::"],
    ["fe80::1"],
    ["fd00::1"],
    ["::ffff:127.0.0.1"],
    ["::ffff:7f00:1"],
    ["64:ff9b::10.0.0.1"],
    ["2002:0a00:0001::1"],
    ["not an address"],
  ])("refuses %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each([["93.184.216.34"], ["8.8.8.8"], ["2606:4700:4700::1111"], ["::ffff:8.8.8.8"]])("allows %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });
});

describe("checking a URL someone typed", () => {
  it.each([
    ["http://hooks.example.com/x", /https/],
    ["https://user:pass@hooks.example.com/x", /credentials/],
    ["https://localhost/x", /public/],
    ["https://127.0.0.1/x", /public/],
    ["https://[::1]/x", /public/],
    ["https://169.254.169.254/latest/meta-data", /public/],
    ["https://db.internal/x", /public/],
    ["https://intranet/x", /public/],
    ["not a url", /URL/],
  ])("refuses %s", (url, why) => {
    expect(() => checkUrl(url)).toThrow(why);
  });

  it("accepts an https URL on a public name or address", () => {
    expect(checkUrl("https://hooks.example.com/parikshaa").hostname).toBe("hooks.example.com");
    expect(checkUrl("https://[2606:4700:4700::1111]/x").hostname).toBe("[2606:4700:4700::1111]");
  });
});

describe("sending", () => {
  it.each([["rebind.example.com"], ["metadata.example.com"], ["v6-loopback.example.com"]])(
    "refuses a name that resolves to a private address: %s",
    async (host) => {
      await expect(safeRequest(`https://${host}/hook`, { method: "POST", body: "{}" })).rejects.toBeInstanceOf(UnsafeUrl);
    },
  );
});

describe("integration secrets", () => {
  const secrets = new IntegrationSecrets("s".repeat(40));

  it("derives a webhook secret per hook and version, in the Standard Webhooks form", () => {
    const a1 = secrets.webhookSecret("org-a", "wh_1", 1);
    expect(a1).toMatch(/^whsec_[A-Za-z0-9+/]{43}=$/);
    expect(secrets.webhookSecret("org-a", "wh_1", 1)).toBe(a1);
    expect(secrets.webhookSecret("org-a", "wh_1", 2)).not.toBe(a1);
    expect(secrets.webhookSecret("org-b", "wh_1", 1)).not.toBe(a1);
  });

  it("signs as Standard Webhooks does", () => {
    const secret = secrets.webhookSecret("org-a", "wh_1", 1);
    const key = Buffer.from(secret.slice("whsec_".length), "base64");
    const expected = createHmac("sha256", key).update("msg_1.1700000000.{}").digest("base64");
    expect(signWebhook(secret, "msg_1", 1_700_000_000, "{}")).toBe(`v1,${expected}`);
  });

  it("issues a Greenhouse key Greenhouse will accept, and verifies only its own", () => {
    const key = secrets.greenhouseKey("org-a", 3);
    expect(key.length).toBeLessThan(171);
    expect(secrets.verifyGreenhouseKey(key)).toEqual({ orgId: "org-a", version: 3 });
    expect(secrets.verifyGreenhouseKey(key.replace("org-a", "org-b"))).toBeNull();
    expect(secrets.verifyGreenhouseKey(key.replace(".3.", ".4."))).toBeNull();
    expect(new IntegrationSecrets("t".repeat(40)).verifyGreenhouseKey(key)).toBeNull();
    expect(secrets.verifyGreenhouseKey("ghk.org-a.1")).toBeNull();
  });
});
