/**
 * The candidate's own notes on their paper: the questions marked to come back
 * to, and the questions opened at all. Notes to themselves, so they stay on
 * this device, per attempt, and are never sent anywhere.
 */
function noteSet(name: string) {
  const key = (attemptId: string) => `parikshaa.${name}.${attemptId}`;
  return {
    load(attemptId: string): ReadonlySet<string> {
      try {
        const raw = localStorage.getItem(key(attemptId));
        const list: unknown = raw === null ? [] : JSON.parse(raw);
        return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
      } catch {
        return new Set();
      }
    },
    save(attemptId: string, ids: ReadonlySet<string>): void {
      try {
        if (ids.size === 0) localStorage.removeItem(key(attemptId));
        else localStorage.setItem(key(attemptId), JSON.stringify([...ids]));
      } catch {
        // Kept for this page only.
      }
    },
  };
}

const review = noteSet("review");
const visited = noteSet("visited");

export const loadReview = review.load;
export const saveReview = review.save;
/** Questions the candidate has opened, which the palette tells apart from ones never seen. */
export const loadVisited = visited.load;
export const saveVisited = visited.save;
