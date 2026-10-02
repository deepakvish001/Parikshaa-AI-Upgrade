/**
 * The Android app around the practice site (Prep plan row 43), from the
 * environment: TWA_PACKAGE (e.g. in.parikshaa.practice) and TWA_SHA256, the
 * signing key's SHA-256 fingerprint as `keytool` prints it (AB:CD:…), several
 * separated by commas (an upload key and Play's app signing key, say).
 */
const PACKAGE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function androidAppFromEnv(env: Readonly<Record<string, string | undefined>>): { packageName: string; fingerprints: string[] } | null {
  const packageName = (env["TWA_PACKAGE"] ?? "").trim();
  if (packageName === "") return null;
  if (!PACKAGE.test(packageName)) throw new Error("TWA_PACKAGE is not an Android package name, like in.parikshaa.practice");
  const fingerprints = (env["TWA_SHA256"] ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => f !== "");
  if (fingerprints.length === 0 || !fingerprints.every((f) => FINGERPRINT.test(f))) {
    throw new Error("TWA_SHA256 needs the signing key's SHA-256 fingerprint, 32 pairs of hex digits separated by colons");
  }
  return { packageName, fingerprints };
}
