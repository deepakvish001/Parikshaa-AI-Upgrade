/**
 * Questions a candidate has marked to come back to. A note to themselves, so
 * it stays on this device, per attempt, and is never sent anywhere.
 */
const key = (attemptId: string) => `parikshaa.review.${attemptId}`;

export function loadReview(attemptId: string): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(key(attemptId));
    const list: unknown = raw === null ? [] : JSON.parse(raw);
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveReview(attemptId: string, marked: ReadonlySet<string>): void {
  try {
    if (marked.size === 0) localStorage.removeItem(key(attemptId));
    else localStorage.setItem(key(attemptId), JSON.stringify([...marked]));
  } catch {
    // Kept for this page only.
  }
}
