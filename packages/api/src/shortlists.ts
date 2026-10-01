import { createHmac, timingSafeEqual } from "node:crypto";
import { examId as toExamId, orgId as toOrgId, type OrgId } from "@parikshaa/core";
import type { IdentityStore, Shortlist, ShortlistDecision, ShortlistStore } from "@parikshaa/store";
import type { ResultsService } from "./results.js";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";

/**
 * A shortlist for a hiring manager (docs/PREP-TRACKER.md, V2-12 CO23). The
 * recruiter picks candidates — by default everyone who qualified — and sends
 * a link that expires. The manager opens it without an account, sees each
 * candidate's marks and sections (never an answer, email or phone), and says
 * shortlist, hold or reject, with a comment. The recruiter sees the same on
 * the Results tab.
 */

export const MAX_DAYS = 30;

export interface ShortlistCandidate {
  readonly ref: string;
  readonly name: string;
  readonly percent: number | null;
  readonly outcome: "qualified" | "failed" | null;
  readonly sections: readonly { readonly title: string; readonly percent: number | null }[];
  readonly decision: ShortlistDecision | null;
  readonly comment: string;
  readonly decidedBy: string | null;
}

export interface ShortlistView {
  readonly institution: string;
  readonly examTitle: string;
  readonly title: string;
  readonly expiresAt: string;
  readonly candidates: readonly ShortlistCandidate[];
}

export class ShortlistGone extends Error {
  constructor(readonly reason: "unknown" | "expired" | "withdrawn") {
    super(reason === "expired" ? "This shortlist link has expired: ask for a new one" : reason === "withdrawn" ? "This shortlist link was withdrawn" : "This link is not a shortlist of ours");
    this.name = "ShortlistGone";
  }
}

export class ShortlistService {
  readonly #store: ShortlistStore;
  readonly #results: ResultsService;
  readonly #identity: IdentityStore;
  readonly #exams: ExamService;
  readonly #key: Buffer;
  readonly #publicUrl: string;
  readonly #now: () => number;
  readonly #newId: () => string;

  constructor(options: {
    readonly store: ShortlistStore;
    readonly results: ResultsService;
    readonly identity: IdentityStore;
    readonly exams: ExamService;
    readonly secret: string;
    readonly publicUrl: string;
    readonly now?: () => number;
    readonly newId?: () => string;
  }) {
    this.#store = options.store;
    this.#results = options.results;
    this.#identity = options.identity;
    this.#exams = options.exams;
    this.#key = createHmac("sha256", options.secret).update("parikshaa-shortlists").digest();
    this.#publicUrl = options.publicUrl.replace(/\/$/, "");
    this.#now = options.now ?? (() => Date.now());
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  #mac(orgId: string, id: string) {
    return createHmac("sha256", this.#key).update(`${orgId}.${id}`).digest("base64url").slice(0, 22);
  }

  code(orgId: string, id: string): string {
    return `${orgId}.${id}.${this.#mac(orgId, id)}`;
  }

  #link(orgId: string, id: string) {
    return `${this.#publicUrl}/?shortlist=${encodeURIComponent(this.code(orgId, id))}`;
  }

  /** The results as a link sees them: read with a reviewer's view, nothing more. */
  #reader(orgId: OrgId, id: string): Actor {
    return { kind: "api_key", id: `shortlist:${id}`, orgId, role: "viewer", name: "Shortlist link" };
  }

  /** Make a shortlist: the roll numbers given, or every candidate who qualified. */
  async create(actor: Actor, examId: string, request: { readonly title: string; readonly refs: readonly string[] | null; readonly days: number }) {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
    const results = await this.#results.results(actor, toExamId(examId));
    const graded = results.rows.filter((r) => r.state === "graded");
    let refs: readonly string[];
    if (request.refs === null) {
      refs = graded.filter((r) => r.outcome === "qualified").map((r) => r.ref);
      if (refs.length === 0) throw new AttemptError("invalid_state", "Nobody has qualified yet: choose the candidates yourself");
    } else {
      const known = new Set(graded.map((r) => r.ref));
      const unknown = request.refs.filter((r) => !known.has(r));
      if (unknown.length > 0) throw new AttemptError("not_found", `Not graded in this exam: ${unknown.slice(0, 5).join(", ")}`);
      refs = [...new Set(request.refs)];
    }
    if (refs.length === 0) throw new AttemptError("invalid_state", "Choose at least one candidate");
    const days = Math.min(Math.max(1, Math.round(request.days)), MAX_DAYS);
    const id = this.#newId();
    const now = this.#now();
    const shortlist = { id, examId, title: request.title.trim() || results.exam.title, refs, createdBy: actor.name, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + days * 86_400_000).toISOString() };
    await this.#store.create(actor.orgId, shortlist);
    await this.#exams.recordAudit(actor, "shortlist.created", id, { examId, candidates: refs.length, days });
    return { ...this.#summary(shortlist, []), link: this.#link(actor.orgId, id) };
  }

  #summary(s: Omit<Shortlist, "revoked"> & { revoked?: boolean }, decisions: readonly { decision: ShortlistDecision }[]) {
    const count = (d: ShortlistDecision) => decisions.filter((x) => x.decision === d).length;
    return {
      id: s.id,
      title: s.title,
      candidates: s.refs.length,
      createdBy: s.createdBy,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      revoked: s.revoked ?? false,
      decided: { shortlist: count("shortlist"), hold: count("hold"), reject: count("reject") },
    };
  }

  /** An exam's shortlists, each with its link and how the manager has decided so far. */
  async forExam(actor: Actor, examId: string) {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
    const lists = await this.#store.forExam(actor.orgId, examId);
    return Promise.all(
      lists.map(async (s) => {
        const decisions = await this.#store.decisions(actor.orgId, s.id);
        return { ...this.#summary(s, decisions), link: this.#link(actor.orgId, s.id), decisions };
      }),
    );
  }

  async revoke(actor: Actor, id: string): Promise<void> {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
    if (!(await this.#store.revoke(actor.orgId, id))) throw new AttemptError("not_found", "No such shortlist");
    await this.#exams.recordAudit(actor, "shortlist.withdrawn", id);
  }

  async #open(code: string): Promise<{ orgId: OrgId; shortlist: Shortlist }> {
    const [org, id, mac, ...rest] = code.trim().split(".");
    if (org === undefined || id === undefined || mac === undefined || rest.length > 0) throw new ShortlistGone("unknown");
    const expected = Buffer.from(this.#mac(org, id));
    const given = Buffer.from(mac);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new ShortlistGone("unknown");
    const orgId = toOrgId(org);
    const shortlist = await this.#store.get(orgId, id);
    if (shortlist === null) throw new ShortlistGone("unknown");
    if (shortlist.revoked) throw new ShortlistGone("withdrawn");
    if (Date.parse(shortlist.expiresAt) <= this.#now()) throw new ShortlistGone("expired");
    return { orgId, shortlist };
  }

  /** What the link shows: marks and sections of the chosen candidates, and the decisions so far. */
  async view(code: string): Promise<ShortlistView> {
    const { orgId, shortlist } = await this.#open(code);
    const [results, decisions, org] = await Promise.all([
      this.#results.results(this.#reader(orgId, shortlist.id), toExamId(shortlist.examId)),
      this.#store.decisions(orgId, shortlist.id),
      this.#identity.getOrganisation(orgId),
    ]);
    const byRef = new Map(results.rows.map((r) => [r.ref, r]));
    const decided = new Map(decisions.map((d) => [d.ref, d]));
    const candidates = shortlist.refs
      .map((ref): ShortlistCandidate => {
        const r = byRef.get(ref);
        const d = decided.get(ref);
        return {
          ref,
          name: r?.name ?? "",
          percent: r?.percent === null || r?.percent === undefined ? null : Math.round(r.percent * 10) / 10,
          outcome: r?.outcome ?? null,
          sections: (r?.sections ?? []).map((s) => ({ title: s.title, percent: s.percent === null ? null : Math.round(s.percent) })),
          decision: d?.decision ?? null,
          comment: d?.comment ?? "",
          decidedBy: d?.by ?? null,
        };
      })
      .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));
    return { institution: org?.name ?? "", examTitle: results.exam.title, title: shortlist.title, expiresAt: shortlist.expiresAt, candidates };
  }

  /** The manager's decision on one candidate; the latest stands. */
  async decide(code: string, ref: string, decision: ShortlistDecision, comment: string, by: string): Promise<void> {
    const { orgId, shortlist } = await this.#open(code);
    if (!shortlist.refs.includes(ref)) throw new AttemptError("not_found", `${ref} is not on this shortlist`);
    const name = by.trim();
    if (name === "") throw new AttemptError("invalid_state", "Say who is deciding");
    await this.#store.decide(orgId, shortlist.id, { ref, decision, comment: comment.trim().slice(0, 1000), by: name.slice(0, 100), at: new Date(this.#now()).toISOString() });
  }
}
