import type { CandidateLedger, CandidateState } from "@parikshaa/api";
import type { ProctoringPolicy } from "@parikshaa/core/browser";

/** Something an invigilator told everyone in the sitting. */
export interface Announcement {
  readonly id: string;
  readonly message: string;
  readonly at: string;
}

export type { CandidateLedger, CandidateState };
export type CandidatePart = NonNullable<CandidateState["parts"]>[number];

export interface ProbeHandlers {
  /** A fragment of the probe as it is written. */
  readonly onToken?: (token: string) => void;
  readonly onProbe: (probe: { id: string; prompt: string }) => void;
  /** No answer currently qualifies for a probe. This is the normal case. */
  readonly onNone?: () => void;
  readonly onError?: (message: string) => void;
}

/** A run as the candidate sees it: the examples, or their own input. */
export type RunOutcome =
  | { readonly compiled: false; readonly compileOutput: string }
  | {
      readonly compiled: true;
      readonly results: readonly {
        readonly input: string;
        readonly expectedOutput: string | null;
        readonly status: string;
        readonly stdout: string;
        /** A function question's return value, as JSON. Absent from a server that predates them. */
        readonly result?: string | null;
        readonly stderr: string;
        readonly timeMs: number;
        readonly memoryKb?: number | null;
        readonly checkerMessage?: string | null;
      }[];
    };

/** What Submit found. The answer is committed either way. */
export type SubmitOutcome =
  | { readonly tested: false; readonly reason: "no_tests" | "runner_unavailable" }
  | { readonly tested: true; readonly compiled: false; readonly compileOutput: string }
  | {
      readonly tested: true;
      readonly compiled: true;
      /** Null when the exam reports only the visible tests. */
      readonly passed: number | null;
      readonly total: number | null;
      readonly cases: readonly {
        readonly number: number;
        readonly visible: boolean;
        readonly status: string;
        readonly timeMs: number;
        readonly memoryKb: number | null;
        readonly input: string | null;
        readonly expectedOutput: string | null;
        readonly stdout: string | null;
        readonly result: string | null;
        readonly stderr: string | null;
      }[];
    };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    /** The rest of the server's answer — for a window, when it opens and closes. */
    readonly detail: Readonly<Record<string, unknown>> = {},
  ) {
    super(`${code} (${status})`);
    this.name = "ApiError";
  }
}

/** What opening an invitation link gives: a token for the attempt it started or resumed. */
export interface Opened {
  readonly token: string;
  readonly attemptId: string;
  readonly resumed: boolean;
}

/** An organisation's privacy notice (DPDP Act), agreed to before the clock starts. */
export interface Notice {
  readonly version: number;
  readonly hash: string;
  readonly controllerName: string;
  readonly purpose: string;
  readonly retentionDays: number;
  readonly grievance: { readonly name: string; readonly email: string };
  readonly collected: readonly string[];
  readonly rights: readonly string[];
  /** The standing parts of the notice in other languages, hashed with the rest. */
  readonly translations?: { readonly hi?: { readonly collected: readonly string[]; readonly rights: readonly string[] } };
}

/** Everything held about the candidate for this attempt, as they may download it. */
export interface CandidateData {
  readonly generatedAt: string;
  readonly organisation: string;
  readonly exam: { readonly id: string; readonly title: string };
  readonly you: { readonly reference: string; readonly name: string; readonly email: string | null; readonly phone: string | null } | null;
  readonly consent: { readonly noticeVersion: number; readonly noticeHash: string; readonly at: number } | null;
  readonly erased: boolean;
  readonly answers: readonly { readonly questionId: string; readonly answer: string; readonly at: number }[];
  readonly followUps: readonly { readonly questionId: string; readonly question: string; readonly reply: string | null; readonly at: number }[];
  readonly timeline: readonly { readonly at: number; readonly event: string }[];
}

/**
 * Open an invitation link. Throws an {@link ApiError}: `not_open_yet` (403) and
 * `window_closed` (410) carry `opensAt` and `closesAt` in `detail`;
 * `consent_required` (428) carries the privacy notice as `detail.notice`.
 */
export async function redeemInvitation(
  code: string,
  baseUrl = "/api",
  consent?: { readonly noticeVersion: number },
  /** The camera is working, for a proctored exam's first opening. */
  camera?: boolean,
): Promise<Opened> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/invitations/redeem`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, ...(consent === undefined ? {} : { consent }), ...(camera === undefined ? {} : { camera }) }),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new ApiError(response.status, typeof body["error"] === "string" ? body["error"] : "request_failed", body);
  return body as unknown as Opened;
}

/** The paper as its instructions describe it, read before anything starts. */
export interface Briefing {
  readonly title: string;
  readonly candidate: { readonly name: string; readonly ref: string };
  readonly started: boolean;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly durationMs: number;
  readonly questionCount: number;
  readonly totalMarks: number;
  readonly sections: readonly { readonly title: string; readonly questionCount: number; readonly durationMs: number | null }[];
  readonly kinds: readonly ("mcq" | "multiple" | "numeric" | "short" | "code")[];
  readonly negativeMarks: number;
  readonly allowRevision: boolean;
  readonly calculator: boolean;
  readonly proctored: boolean;
  /** What the camera will do, for a proctored test; null otherwise. */
  readonly proctoring: ProctoringPolicy | null;
  /** The privacy notice opening will ask agreement to; null when there is none or the attempt has begun. */
  readonly notice: Notice | null;
  /** Where to sit, when the exam is held in rooms; absent from an older server. */
  readonly seat?: { readonly centre: string; readonly room: string; readonly seat: string } | null;
  /** Arrangements for a disability (extra minutes, a scribe, larger text); absent from an older server. */
  readonly arrangements?: { readonly extraMinutes: number; readonly scribe: boolean; readonly largeText: boolean } | null;
}

/** The paper itself, as the instructions describe it: a briefing without who, when, or what opening asks. */
export type PaperBrief = Omit<Briefing, "candidate" | "started" | "opensAt" | "closesAt" | "proctoring" | "notice">;

/** An invitation's instructions. Starts nothing; opening it is {@link redeemInvitation}. */
export async function briefInvitation(code: string, baseUrl = "/api"): Promise<Briefing> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/invitations/briefing`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new ApiError(response.status, typeof body["error"] === "string" ? body["error"] : "request_failed", body);
  return body as unknown as Briefing;
}

/** A candidate's released result, question by question, with any rechecks asked for. */
export type MyResult =
  | { readonly released: false }
  | {
      readonly released: true;
      readonly title: string;
      readonly institution: string;
      readonly total: number;
      readonly maxTotal: number;
      readonly percent: number;
      readonly outcome: "qualified" | "failed" | null;
      readonly questions: readonly { readonly id: string; readonly number: number; readonly stem: string; readonly score: number; readonly max: number }[];
      readonly rechecks: readonly {
        readonly id: string;
        readonly questionId: string;
        readonly reason: string;
        readonly status: "open" | "changed" | "unchanged";
        readonly scoreBefore: number | null;
        readonly scoreAfter: number | null;
        readonly reply: string | null;
        readonly decidedAt: string | null;
      }[];
      readonly recheckUntil: string | null;
    };

/** What a scorecard's code proves (GET /scorecards/{code}). */
export type ScorecardCheck =
  | {
      readonly valid: true;
      readonly institution: string;
      readonly candidate: { readonly name: string; readonly ref: string };
      readonly title: string;
      readonly total: number;
      readonly maxTotal: number;
      readonly percent: number;
      readonly outcome: "qualified" | "failed" | null;
      readonly sittingDate: string;
      readonly record: string;
    }
  | { readonly valid: false; readonly reason: "unknown" | "withdrawn" };

/** Check a scorecard: public, no sign-in. */
export async function checkScorecard(code: string, baseUrl = "/api"): Promise<ScorecardCheck> {
  const response = await fetch(`${baseUrl}/scorecards/${encodeURIComponent(code)}`);
  if (!response.ok) throw new ApiError(response.status, "request_failed");
  return (await response.json()) as ScorecardCheck;
}

export class ParikshaaClient {
  readonly #baseUrl: string;
  readonly #token: string;

  constructor(token: string, baseUrl = "/api") {
    this.#token = token;
    this.#baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * A JSON content type only when there is JSON. The server refuses an empty
   * body that claims to be JSON, which is what a bare `POST .../submit` was
   * sending.
   */
  #headers(hasBody: boolean): Record<string, string> {
    return {
      authorization: `Bearer ${this.#token}`,
      ...(hasBody ? { "content-type": "application/json" } : {}),
    };
  }

  async #request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.#baseUrl}${path}`, {
      ...init,
      headers: this.#headers(init.body !== undefined),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new ApiError(response.status, body.error ?? "request_failed");
    }
    return (await response.json()) as T;
  }

  state(): Promise<CandidateState> {
    return this.#request<CandidateState>("/attempts/me");
  }

  ledger(): Promise<CandidateLedger> {
    return this.#request<CandidateLedger>("/attempts/me/ledger");
  }

  /** The identity photos, base64 JPEG (ROADMAP §14). */
  async captureIdentity(selfie: string, id: string): Promise<void> {
    await this.#request("/attempts/me/identity", { method: "POST", body: JSON.stringify({ selfie, id }) });
  }

  async snapshot(image: string): Promise<void> {
    await this.#request("/attempts/me/snapshots", { method: "POST", body: JSON.stringify({ image }) });
  }

  async proctorEvents(events: readonly string[]): Promise<void> {
    await this.#request("/attempts/me/proctor-events", { method: "POST", body: JSON.stringify({ events }) });
  }

  /** Everything held about the candidate: details, consent, answers and replies. */
  myData(): Promise<CandidateData> {
    return this.#request<CandidateData>("/attempts/me/data");
  }

  async saveAnswer(questionId: string, answer: string): Promise<void> {
    await this.#request("/attempts/me/answers", {
      method: "POST",
      body: JSON.stringify({ questionId, answer }),
    });
  }

  /** Commit a code answer and test it against every test: the Submit of a coding test. */
  submitCode(questionId: string, language: string, source: string): Promise<SubmitOutcome> {
    return this.#request("/attempts/me/code/submit", { method: "POST", body: JSON.stringify({ questionId, language, source }) });
  }

  /** Autosave the text so far. Not an answer until committed; see the server's drafts route. */
  async saveDraft(questionId: string, answer: string): Promise<void> {
    await this.#request(`/attempts/me/drafts/${encodeURIComponent(questionId)}`, {
      method: "PUT",
      body: JSON.stringify({ answer }),
    });
  }

  /** Check in: the attempt's state and deadline as they now stand. */
  heartbeat(): Promise<{ state: string; expiresAt: number; announcements: number }> {
    return this.#request("/attempts/me/heartbeat", { method: "POST" });
  }

  /** What the invigilators have told this sitting, oldest first. */
  async announcements(): Promise<readonly Announcement[]> {
    return (await this.#request<{ announcements: Announcement[] }>("/attempts/me/announcements")).announcements;
  }

  /** Run code against the examples, or on the candidate's own input. Records nothing. */
  runCode(questionId: string, language: string, source: string, input?: string): Promise<RunOutcome> {
    return this.#request("/attempts/me/run", {
      method: "POST",
      body: JSON.stringify(input === undefined ? { questionId, language, source } : { questionId, language, source, input }),
    });
  }

  /** Leave the current part of a sectioned test and start the next section's clock (ROADMAP §3). */
  async nextSection(): Promise<void> {
    await this.#request("/attempts/me/sections/next", { method: "POST" });
  }

  async submit(): Promise<void> {
    await this.#request("/attempts/me/submit", { method: "POST" });
  }

  /** My result, once the institution releases it. */
  result(): Promise<MyResult> {
    return this.#request<MyResult>("/attempts/me/result");
  }

  /** Ask for one question to be looked at again. */
  async askRecheck(questionId: string, reason: string): Promise<void> {
    await this.#request("/attempts/me/rechecks", { method: "POST", body: JSON.stringify({ questionId, reason }) });
  }

  /** The scorecard PDF, to save. */
  async scorecard(): Promise<Blob> {
    const response = await fetch(`${this.#baseUrl}/attempts/me/scorecard.pdf`, { headers: this.#headers(false) });
    if (!response.ok) throw new ApiError(response.status, "scorecard_unavailable");
    return response.blob();
  }

  /** Whether the candidate has already said how the test went. */
  async feedbackGiven(): Promise<boolean> {
    return (await this.#request<{ given: boolean }>("/attempts/me/feedback")).given;
  }

  /** Say how the test went: once, after submitting. Already given counts as done. */
  async giveFeedback(rating: number, comment: string): Promise<void> {
    try {
      await this.#request("/attempts/me/feedback", { method: "POST", body: JSON.stringify({ rating, ...(comment.trim() === "" ? {} : { comment }) }) });
    } catch (error) {
      if (error instanceof ApiError && error.code === "already_given") return;
      throw error;
    }
  }

  /**
   * Reply to a probe.
   *
   * The body carries the reply and nothing else. How long the candidate took is
   * measured on the server, between the probe's recorded `askedAt` and the
   * arrival of this request — there is deliberately no timing for this client to
   * report, correctly or otherwise.
   */
  async replyToProbe(probeId: string, reply: string): Promise<void> {
    await this.#request(`/attempts/me/probes/${encodeURIComponent(probeId)}/reply`, {
      method: "POST",
      body: JSON.stringify({ reply }),
    });
  }

  /**
   * Ask whether a probe is due, and stream it if one is.
   *
   * Read with `fetch` rather than `EventSource`, which cannot send an
   * Authorization header — putting the attempt token in the query string
   * instead would leak it into proxy logs and browser history.
   */
  /** The next probe in one reply, for low-bandwidth mode: no stream to hold open. */
  async probeOnce(): Promise<{ readonly id: string; readonly prompt: string } | null> {
    return (await this.#request<{ probe: { id: string; prompt: string } | null }>("/attempts/me/probe?stream=0")).probe;
  }

  async streamProbe(handlers: ProbeHandlers, signal?: AbortSignal): Promise<void> {
    const response = await fetch(`${this.#baseUrl}/attempts/me/probe`, {
      headers: { authorization: `Bearer ${this.#token}` },
      ...(signal === undefined ? {} : { signal }),
    });

    if (!response.ok || response.body === null) {
      handlers.onError?.(`probe request failed (${response.status})`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        this.#dispatch(buffer.slice(0, boundary), handlers);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
    }
    if (buffer.trim() !== "") this.#dispatch(buffer, handlers);
  }

  #dispatch(frame: string, handlers: ProbeHandlers): void {
    let event = "message";
    let data = "";
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice("event:".length).trim();
      else if (line.startsWith("data:")) data += line.slice("data:".length).trim();
    }
    if (data === "") return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }

    switch (event) {
      case "token":
        handlers.onToken?.((parsed as { token: string }).token);
        break;
      case "probe":
        handlers.onProbe(parsed as { id: string; prompt: string });
        break;
      case "none":
        handlers.onNone?.();
        break;
      case "error":
        handlers.onError?.((parsed as { message: string }).message);
        break;
    }
  }
}
