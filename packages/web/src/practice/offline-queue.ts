import { ApiError } from "../api.ts";

/**
 * Answers submitted with no network (Prep plan row 42): kept on this device,
 * and submitted when the network is back. Never a contest's, whose time is
 * the point. Each answer belongs to the session that made it, so on a shared
 * phone it is never sent as anyone else; one a week old is dropped.
 */

export interface QueuedAnswer {
  readonly slug: string;
  readonly answer: string;
  readonly language?: string;
  /** The end of the session that made it: only that session sends it. */
  readonly owner: string;
  readonly at: number;
}

const WEEK = 7 * 86_400_000;
const keyOf = (site: string) => `parikshaa.practice.${site}.queue`;
export const ownerOf = (token: string) => token.slice(-12);

export function queuedAnswers(site: string): QueuedAnswer[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(keyOf(site)) ?? "[]") as QueuedAnswer[];
    return Array.isArray(parsed) ? parsed.filter((q) => Date.now() - q.at < WEEK) : [];
  } catch {
    return [];
  }
}

export function keepQueued(site: string, answers: readonly QueuedAnswer[]): void {
  try {
    if (answers.length === 0) localStorage.removeItem(keyOf(site));
    else localStorage.setItem(keyOf(site), JSON.stringify(answers));
  } catch {
    // A private window: nothing can be kept.
  }
}

/** The answer kept for later; the error says so, in the page's language. */
export function queuedOffline(): ApiError {
  const hindi = typeof document !== "undefined" && document.documentElement.lang.startsWith("hi");
  const message = hindi
    ? "आप ऑफ़लाइन हैं। आपका जवाब इस डिवाइस पर रखा है, और नेट आते ही जमा हो जाएगा।"
    : "You are offline. Your answer is kept on this device and will be submitted when you are back online.";
  return new ApiError(0, "queued_offline", { message });
}
