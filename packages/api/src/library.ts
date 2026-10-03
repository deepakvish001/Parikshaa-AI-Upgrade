import { questionId, validateQuestion, type ExamProblem, type Question } from "@parikshaa/core";
import { LIBRARY_SECTIONS, staffScope, type LibraryDraft, type LibraryEntry, type LibraryFacets, type LibraryFilter, type LibraryStore } from "@parikshaa/store";
import { builtInLibrary } from "./library-content.js";
import { OperatorRefused, type OperatorService } from "./operator.js";
import type { ExamService } from "./service.js";
import type { Actor } from "./staff-auth.js";

/**
 * The Parikshaa Library (docs/F1-GO-LIVE-PLAN.md §4, G2). A company or a
 * college browses Parikshaa's questions and copies the ones it wants into
 * its own bank, one by one or a few at random; Parikshaa's operators file
 * the questions, and see how widely each has been taken.
 */

export class LibraryRefused extends Error {
  constructor(
    readonly code: "not_found" | "invalid",
    message: string,
    readonly problems: readonly ExamProblem[] = [],
  ) {
    super(message);
    this.name = "LibraryRefused";
  }
}

/** A library question as staff see it: how many organisations took it is the operator's to know. */
export type LibraryView = Omit<LibraryEntry, "exposure"> & { readonly exposure: number | null; readonly newerVersion: boolean };

export interface Taken {
  readonly added: number;
  readonly already: number;
  readonly bankQuestionIds: readonly string[];
}

/** At most this many in one go: a section of a test, not the whole library. */
const MAX_TAKE = 100;

export class LibraryService {
  readonly #o: { readonly library: LibraryStore; readonly operator: OperatorService; readonly exams: ExamService };

  constructor(o: { readonly library: LibraryStore; readonly operator: OperatorService; readonly exams: ExamService }) {
    this.#o = o;
  }

  #view(entry: LibraryEntry, operator: boolean): LibraryView {
    return {
      ...entry,
      exposure: operator ? entry.exposure : null,
      newerVersion: entry.adopted !== null && entry.adopted.version < entry.version,
    };
  }

  async browse(
    actor: Actor,
    filter: LibraryFilter,
    page: { readonly limit?: number; readonly offset?: number },
  ): Promise<{ readonly items: readonly LibraryView[]; readonly total: number; readonly facets: LibraryFacets }> {
    const scope = staffScope(actor.orgId);
    const operator = this.#o.operator.operators.is(actor);
    // Retired questions are for the operator to see, not to take.
    const [list, facets] = await Promise.all([
      this.#o.library.list(scope, { ...filter, includeRetired: operator && filter.includeRetired === true }, page),
      this.#o.library.facets(scope),
    ]);
    return { items: list.items.map((e) => this.#view(e, operator)), total: list.total, facets };
  }

  async item(actor: Actor, id: string): Promise<LibraryView> {
    const entry = await this.#o.library.get(staffScope(actor.orgId), id);
    const operator = this.#o.operator.operators.is(actor);
    if (entry === null || (entry.retired && !operator)) throw new LibraryRefused("not_found", "No such question in the library");
    return this.#view(entry, operator);
  }

  /** Copy these questions into the actor's bank. One taken before is not copied twice. */
  async take(actor: Actor, ids: readonly string[]): Promise<Taken> {
    if (ids.length === 0 || ids.length > MAX_TAKE) throw new LibraryRefused("invalid", `Choose from 1 to ${MAX_TAKE} questions`);
    const taken = await this.#o.library.adopt(staffScope(actor.orgId), ids);
    const added = taken.filter((t) => t.added);
    if (added.length > 0) await this.#o.exams.recordAudit(actor, "library.taken", "bank", { count: added.length, ids: added.map((t) => t.libraryId) });
    return { added: added.length, already: taken.length - added.length, bankQuestionIds: taken.map((t) => t.bankQuestionId) };
  }

  /** A few at random, matching the filter, from what the actor's organisation has not taken yet. */
  async pick(actor: Actor, filter: LibraryFilter, count: number): Promise<Taken> {
    if (!Number.isInteger(count) || count < 1 || count > 50) throw new LibraryRefused("invalid", "Pick from 1 to 50 questions at a time");
    const ids = await this.#o.library.pick(staffScope(actor.orgId), filter, count);
    if (ids.length === 0) return { added: 0, already: 0, bankQuestionIds: [] };
    return this.take(actor, ids);
  }

  /** Bring the bank's copy up to the library's current version. */
  async refresh(actor: Actor, id: string): Promise<{ readonly bankQuestionId: string; readonly version: number }> {
    const done = await this.#o.library.refresh(staffScope(actor.orgId), id);
    if (done === null) throw new LibraryRefused("not_found", "Your bank has no copy of this question");
    await this.#o.exams.recordAudit(actor, "library.refreshed", done.bankQuestionId, { libraryId: id, version: done.version });
    return done;
  }

  // --- the operator's ------------------------------------------------------------------

  /** File Parikshaa's own questions (library-content.ts): new ones added, changed ones versioned. */
  async seed(actor: Actor): Promise<{ readonly added: number; readonly updated: number; readonly unchanged: number }> {
    await this.#o.operator.check(actor);
    const counts = await this.#o.library.upsert(builtInLibrary());
    await this.#o.exams.recordAudit(actor, "operator.library_seeded", "library", counts);
    return counts;
  }

  /** File one question, written by the content team: checked as an exam would check it. */
  async file(actor: Actor, draft: LibraryDraft): Promise<LibraryView> {
    await this.#o.operator.check(actor);
    if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(draft.id)) throw new LibraryRefused("invalid", "An id is 2 to 80 lowercase letters, digits and hyphens");
    if (!LIBRARY_SECTIONS.includes(draft.section)) throw new LibraryRefused("invalid", "Choose a section");
    if (draft.topic.trim() === "") throw new LibraryRefused("invalid", "Give a topic");
    const question = { ...draft.question, id: questionId(draft.id) } as Question;
    const problems = validateQuestion(question, "question");
    if (problems.length > 0) throw new LibraryRefused("invalid", "The question has problems", problems);
    await this.#o.library.upsert([{ ...draft, question, topic: draft.topic.trim() }]);
    await this.#o.exams.recordAudit(actor, "operator.library_filed", draft.id, { section: draft.section, tier: draft.tier });
    return this.item(actor, draft.id);
  }

  async retire(actor: Actor, id: string): Promise<void> {
    await this.#o.operator.check(actor);
    if (!(await this.#o.library.retire(id))) throw new LibraryRefused("not_found", "No such question, or it is retired already");
    await this.#o.exams.recordAudit(actor, "operator.library_retired", id);
  }

  /** Parikshaa's own questions, at boot: nothing to check, nothing to audit, the same each time. */
  seedAtBoot(): Promise<{ readonly added: number; readonly updated: number; readonly unchanged: number }> {
    return this.#o.library.upsert(builtInLibrary());
  }
}

export { OperatorRefused };
