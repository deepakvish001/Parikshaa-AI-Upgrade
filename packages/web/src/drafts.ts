/**
 * The copy of a candidate's unsent work kept on this device.
 *
 * The server keeps drafts too, and that is the copy that survives a dead
 * laptop. This one covers the other failure: the connection drops while the
 * candidate keeps typing. Anything the server has not confirmed stays here
 * until it has, and is offered back if the page is reopened.
 *
 * localStorage, not sessionStorage, because the case it exists for includes the
 * browser closing. Entries carry the attempt's deadline as this device last
 * knew it, and are removed when the attempt closes or a day after that deadline
 * — a day, not at once, because an invigilator may have extended the attempt
 * since, and unsent text must not be thrown away while it can still be sent.
 *
 * Storage can be unavailable (private windows, blocked site data); then every
 * call here quietly does nothing and the server's copy is all there is.
 */

export interface LocalDraft {
  readonly answer: string;
  /** Whether the server has confirmed this exact text. */
  readonly synced: boolean;
}

interface Stored {
  readonly expiresAt: number;
  readonly drafts: Record<string, LocalDraft>;
}

const PREFIX = "parikshaa.drafts.";

function read(attemptId: string): Stored | null {
  try {
    const raw = localStorage.getItem(PREFIX + attemptId);
    return raw === null ? null : (JSON.parse(raw) as Stored);
  } catch {
    return null;
  }
}

export function loadLocalDrafts(attemptId: string): Record<string, LocalDraft> {
  return read(attemptId)?.drafts ?? {};
}

export function saveLocalDraft(attemptId: string, expiresAt: number, questionId: string, draft: LocalDraft): void {
  try {
    const drafts = { ...loadLocalDrafts(attemptId), [questionId]: draft };
    localStorage.setItem(PREFIX + attemptId, JSON.stringify({ expiresAt, drafts } satisfies Stored));
  } catch {
    // Unavailable or full; the server's copy still stands.
  }
}

export function clearLocalDrafts(attemptId: string): void {
  try {
    localStorage.removeItem(PREFIX + attemptId);
  } catch {
    // Nothing to clear.
  }
}

/** Longer than any extension an invigilator can grant, several times over. */
const GRACE_MS = 24 * 60 * 60 * 1000;

/** Remove every attempt's drafts whose window has long passed. */
export function purgeExpiredDrafts(now = Date.now()): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key === null || !key.startsWith(PREFIX)) continue;
      const stored = read(key.slice(PREFIX.length));
      if (stored === null || stored.expiresAt + GRACE_MS < now) localStorage.removeItem(key);
    }
  } catch {
    // Nothing to purge.
  }
}
