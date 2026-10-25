/**
 * The feature flag `learn_v2`: whether a practice site shows Learn v2's shell
 * (docs/LEARN-V2.md, tracker row 139 K1-3) instead of today's practice pages.
 *
 * The repository had no flag system, so this is the smallest one that is safe:
 *
 * - Off unless something turns it on. The build can turn it on for everyone
 *   with `VITE_LEARN_V2=on`; nothing sets that yet.
 * - One browser can opt in for testing with `?learn_v2=1` on a practice
 *   site's address, and back out with `?learn_v2=0`. The choice is kept on
 *   that device (localStorage), so the shell's own links keep it on.
 *
 * Nothing about it reaches the server, and the shell makes no API calls yet,
 * so turning it on shows a learner nothing of anyone else's.
 */

export const LEARN_V2_FLAG = "learn_v2";
export const LEARN_V2_KEY = "parikshaa.flag.learn_v2";

/** Where the choice is kept; storage may be missing or refuse (private mode). */
export type FlagStore = Pick<Storage, "getItem" | "setItem">;

function read(store: FlagStore | null): string | null {
  try {
    return store?.getItem(LEARN_V2_KEY) ?? null;
  } catch {
    return null;
  }
}

function keep(store: FlagStore | null, value: "1" | "0"): void {
  try {
    store?.setItem(LEARN_V2_KEY, value);
  } catch {
    // Kept for this page only.
  }
}

/**
 * Whether `learn_v2` is on for this page: the address first (and remembered),
 * then this device's earlier choice, then the build's default.
 */
export function learnV2On(search: string, build: string | undefined, store: FlagStore | null): boolean {
  const asked = new URLSearchParams(search).get(LEARN_V2_FLAG);
  if (asked === "1" || asked === "0") {
    keep(store, asked);
    return asked === "1";
  }
  const kept = read(store);
  if (kept === "1" || kept === "0") return kept === "1";
  return build === "on";
}

/** This browser's storage, where it may be used. */
export function deviceStore(): FlagStore | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
