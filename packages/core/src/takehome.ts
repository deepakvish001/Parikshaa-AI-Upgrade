/**
 * A take-home answer (docs/PREP-TRACKER.md plan row 88): the link to the work
 * the candidate did on their own time, usually a repository, and their notes
 * on it. Stored as the answer's text, as JSON, like a code answer. A person
 * opens the link and marks it: no model can see what is behind it.
 */

export interface TakeHomeAnswer {
  readonly link: string;
  readonly notes: string;
}

export const MAX_TAKE_HOME_NOTES = 5_000;

/** Whether a link may be submitted: an https address, with a host. */
export function validTakeHomeLink(link: string): boolean {
  if (link.length > 500) return false;
  try {
    const url = new URL(link);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch {
    return false;
  }
}

export const encodeTakeHomeAnswer = (answer: TakeHomeAnswer): string => JSON.stringify({ link: answer.link.trim(), notes: answer.notes });

/** The answer from its stored text; null when it is not a take-home answer (blank, or text from before). */
export function decodeTakeHomeAnswer(stored: string): TakeHomeAnswer | null {
  try {
    const parsed = JSON.parse(stored) as { link?: unknown; notes?: unknown };
    if (typeof parsed.link !== "string") return null;
    return { link: parsed.link, notes: typeof parsed.notes === "string" ? parsed.notes : "" };
  } catch {
    return null;
  }
}
