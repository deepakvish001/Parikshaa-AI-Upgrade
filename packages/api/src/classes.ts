import { examId as toExamId } from "@parikshaa/core";
import { ClassNameTaken, practiceStaff, type ClassRecord, type ClassSession, type ClassStore, type PracticeStore, type PrepCampusStore, type PrepStore } from "@parikshaa/store";
import { PracticeError } from "./practice.js";
import type { ResultsService } from "./results.js";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";

/**
 * Classes (docs/PREP-TRACKER.md plan row 95, F2 Campus): a college's class in
 * one place. A class is a cohort of the practice site's students, the course
 * they work through (a track: modules of lessons and problems), the tests set
 * for them (exams) and the contests they enter, and the sessions they attend.
 * Its page puts each student on a line: how much of the course they have
 * done, their mark in each test, what they solved in each contest, and how
 * many sessions they were at.
 *
 * Tests are matched to students by email: the address the cohort knows them
 * by is the address their invitation went to.
 */

/** Tests or contests on one class, at most. */
export const MAX_CLASS_ITEMS = 40;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface ClassSummary {
  readonly id: string;
  readonly name: string;
  readonly cohort: { readonly id: string; readonly name: string };
  readonly track: { readonly id: string; readonly title: string } | null;
  readonly tests: number;
  readonly contests: number;
  readonly createdAt: string;
}

export interface ClassReport {
  readonly class: ClassSummary;
  readonly course: { readonly lessons: number; readonly problems: number };
  readonly tests: readonly { readonly examId: string; readonly title: string }[];
  readonly contests: readonly { readonly id: string; readonly title: string; readonly problems: number; readonly startsAt: string }[];
  readonly sessions: readonly { readonly id: string; readonly heldOn: string; readonly topic: string; readonly present: number; readonly marked: number }[];
  readonly students: readonly {
    readonly email: string;
    readonly name: string | null;
    readonly joined: boolean;
    readonly course: { readonly lessonsDone: number; readonly problemsSolved: number; readonly percent: number | null };
    /** Percent in each test, by exam; null when not sat or not graded yet. */
    readonly tests: Readonly<Record<string, number | null>>;
    readonly contests: Readonly<Record<string, number>>;
    readonly attendance: { readonly present: number; readonly of: number; readonly percent: number | null };
    readonly lastActiveAt: string | null;
  }[];
}

const percent = (part: number, whole: number) => (whole === 0 ? null : Math.round((part / whole) * 1000) / 10);

export class ClassService {
  readonly #classes: ClassStore;
  readonly #campus: PrepCampusStore;
  readonly #prep: PrepStore;
  readonly #practice: PracticeStore;
  readonly #results: ResultsService;
  readonly #exams: ExamService;
  readonly #now: () => number;

  constructor(options: {
    readonly classes: ClassStore;
    readonly campus: PrepCampusStore;
    readonly prep: PrepStore;
    readonly practice: PracticeStore;
    readonly results: ResultsService;
    readonly exams: ExamService;
    readonly now?: () => number;
  }) {
    this.#classes = options.classes;
    this.#campus = options.campus;
    this.#prep = options.prep;
    this.#practice = options.practice;
    this.#results = options.results;
    this.#exams = options.exams;
    this.#now = options.now ?? (() => Date.now());
  }

  async list(actor: Actor): Promise<readonly ClassSummary[]> {
    if (!can(actor, "exam:read")) throw new Forbidden("exam:read");
    const [classes, cohorts, tracks] = await Promise.all([this.#classes.list(actor.orgId), this.#campus.cohorts(actor.orgId), this.#prep.tracks(practiceStaff(actor.orgId))]);
    return classes.map((c) => this.#summary(c, cohorts, tracks));
  }

  /** What a class can be made from: the cohorts, courses, contests and exams there are. */
  async options(actor: Actor): Promise<{
    readonly cohorts: readonly { readonly id: string; readonly name: string }[];
    readonly tracks: readonly { readonly id: string; readonly title: string }[];
    readonly contests: readonly { readonly id: string; readonly title: string; readonly startsAt: string }[];
    readonly exams: readonly { readonly id: string; readonly title: string }[];
  }> {
    if (!can(actor, "exam:read")) throw new Forbidden("exam:read");
    const scope = practiceStaff(actor.orgId);
    const [cohorts, tracks, contests, exams] = await Promise.all([
      this.#campus.cohorts(actor.orgId),
      this.#prep.tracks(scope),
      this.#practice.contests(scope),
      this.#exams.listExams(actor),
    ]);
    return {
      cohorts: cohorts.map((c) => ({ id: c.id, name: c.name })),
      tracks: tracks.map((t) => ({ id: t.id, title: t.title })),
      contests: contests.map((c) => ({ id: c.id, title: c.title, startsAt: c.startsAt })),
      exams: exams.filter((e) => (e.archivedAt ?? null) === null).map((e) => ({ id: e.id as string, title: e.title })),
    };
  }

  async create(actor: Actor, draft: { readonly name: string; readonly cohortId: string; readonly trackId: string | null }): Promise<ClassSummary> {
    if (!can(actor, "exam:write")) throw new Forbidden("exam:write");
    const name = draft.name.trim();
    if (name === "") throw new PracticeError("invalid", "Give the class a name");
    const cohorts = await this.#campus.cohorts(actor.orgId);
    if (!cohorts.some((c) => c.id === draft.cohortId)) throw new AttemptError("not_found", "No such cohort: make one under Campus first");
    const tracks = await this.#prep.tracks(practiceStaff(actor.orgId));
    if (draft.trackId !== null && !tracks.some((t) => t.id === draft.trackId)) throw new AttemptError("not_found", "No such course");
    let made: ClassRecord;
    try {
      made = await this.#classes.create(actor.orgId, { name, cohortId: draft.cohortId, trackId: draft.trackId, createdBy: actor.name }, new Date(this.#now()));
    } catch (error) {
      if (error instanceof ClassNameTaken) throw new PracticeError("slug_taken", error.message);
      throw error;
    }
    await this.#exams.recordAudit(actor, "class.created", made.id, { name, cohortId: draft.cohortId });
    return this.#summary(made, cohorts, tracks);
  }

  /** Change what a class works through: its course, its tests, its contests. Each given replaces what was there. */
  async update(
    actor: Actor,
    id: string,
    change: { readonly trackId?: string | null | undefined; readonly examIds?: readonly string[] | undefined; readonly contestIds?: readonly string[] | undefined },
  ): Promise<ClassReport> {
    if (!can(actor, "exam:write")) throw new Forbidden("exam:write");
    await this.#class(actor, id);
    if (change.trackId !== undefined) {
      if (change.trackId !== null && !(await this.#prep.tracks(practiceStaff(actor.orgId))).some((t) => t.id === change.trackId)) throw new AttemptError("not_found", "No such course");
      await this.#classes.setTrack(actor.orgId, id, change.trackId);
    }
    if (change.examIds !== undefined) {
      const ids = [...new Set(change.examIds)];
      if (ids.length > MAX_CLASS_ITEMS) throw new PracticeError("invalid", `At most ${MAX_CLASS_ITEMS} tests on a class`);
      const exams = new Set((await this.#exams.listExams(actor)).map((e) => e.id as string));
      const missing = ids.find((e) => !exams.has(e));
      if (missing !== undefined) throw new AttemptError("not_found", `No such exam: ${missing}`);
      await this.#classes.setTests(actor.orgId, id, ids);
    }
    if (change.contestIds !== undefined) {
      const ids = [...new Set(change.contestIds)];
      if (ids.length > MAX_CLASS_ITEMS) throw new PracticeError("invalid", `At most ${MAX_CLASS_ITEMS} contests on a class`);
      const contests = new Set((await this.#practice.contests(practiceStaff(actor.orgId))).map((c) => c.id));
      const missing = ids.find((c) => !contests.has(c));
      if (missing !== undefined) throw new AttemptError("not_found", `No such contest: ${missing}`);
      await this.#classes.setContests(actor.orgId, id, ids);
    }
    await this.#exams.recordAudit(actor, "class.updated", id, {
      ...(change.trackId === undefined ? {} : { trackId: change.trackId }),
      ...(change.examIds === undefined ? {} : { tests: change.examIds.length }),
      ...(change.contestIds === undefined ? {} : { contests: change.contestIds.length }),
    });
    return this.report(actor, id);
  }

  // --- sessions and attendance ----------------------------------------------------

  async addSession(actor: Actor, id: string, session: { readonly heldOn: string; readonly topic: string }): Promise<ClassSession> {
    if (!can(actor, "exam:write")) throw new Forbidden("exam:write");
    await this.#class(actor, id);
    if (!DAY.test(session.heldOn) || Number.isNaN(Date.parse(session.heldOn))) throw new PracticeError("invalid", "Give the day as YYYY-MM-DD");
    return this.#classes.addSession(actor.orgId, id, session.heldOn, session.topic.trim());
  }

  async removeSession(actor: Actor, id: string, sessionId: string): Promise<void> {
    if (!can(actor, "exam:write")) throw new Forbidden("exam:write");
    if (!(await this.#classes.removeSession(actor.orgId, id, sessionId))) throw new AttemptError("not_found", "No such session in this class");
  }

  /** Who was present at a session, by the address the cohort knows them by; only the class's students. */
  async mark(actor: Actor, id: string, sessionId: string, marks: Readonly<Record<string, boolean>>): Promise<ClassSession> {
    if (!can(actor, "exam:write")) throw new Forbidden("exam:write");
    const record = await this.#class(actor, id);
    const members = new Set((await this.#campus.members(actor.orgId, record.cohortId)).map((m) => m.email));
    const stranger = Object.keys(marks).find((email) => !members.has(email.toLowerCase()));
    if (stranger !== undefined) throw new AttemptError("not_found", `${stranger} is not in this class's cohort`);
    if (!(await this.#classes.mark(actor.orgId, id, sessionId, marks, actor.name, new Date(this.#now())))) throw new AttemptError("not_found", "No such session in this class");
    const session = (await this.#classes.sessions(actor.orgId, id)).find((s) => s.id === sessionId)!;
    return session;
  }

  async sessions(actor: Actor, id: string): Promise<readonly ClassSession[]> {
    if (!can(actor, "exam:read")) throw new Forbidden("exam:read");
    await this.#class(actor, id);
    return this.#classes.sessions(actor.orgId, id);
  }

  // --- the class's page ---------------------------------------------------------------

  /** Each student on a line: course, tests, contests and attendance. Marks need `attempt:review`. */
  async report(actor: Actor, id: string): Promise<ClassReport> {
    if (!can(actor, "exam:read")) throw new Forbidden("exam:read");
    const record = await this.#class(actor, id);
    const scope = practiceStaff(actor.orgId);
    const [cohorts, tracks, contests, progress, sessions, exams] = await Promise.all([
      this.#campus.cohorts(actor.orgId),
      this.#prep.tracks(scope),
      this.#practice.contests(scope),
      this.#classes.progress(actor.orgId, record),
      this.#classes.sessions(actor.orgId, id),
      this.#exams.listExams(actor),
    ]);
    const marks = can(actor, "attempt:review");
    const byExam = new Map<string, Map<string, number | null>>();
    if (marks) {
      for (const examId of record.testIds) {
        const results = await this.#results.results(actor, toExamId(examId));
        const best = new Map<string, number | null>();
        for (const row of results.rows) {
          if (row.email === null) continue;
          const email = row.email.toLowerCase();
          const mark = row.state === "graded" ? row.percent : null;
          const before = best.get(email);
          if (before === undefined || (mark !== null && (before === null || mark > before))) best.set(email, mark);
        }
        byExam.set(examId, best);
      }
    }
    const courseItems = progress.lessons + progress.problems;
    return {
      class: this.#summary(record, cohorts, tracks),
      course: { lessons: progress.lessons, problems: progress.problems },
      tests: record.testIds.map((examId) => ({ examId, title: exams.find((e) => e.id === examId)?.title ?? examId })),
      contests: record.contestIds.map((cid) => {
        const c = contests.find((x) => x.id === cid);
        return { id: cid, title: c?.title ?? cid, problems: c?.problemIds.length ?? 0, startsAt: c?.startsAt ?? "" };
      }),
      sessions: sessions.map((s) => ({ id: s.id, heldOn: s.heldOn, topic: s.topic, present: Object.values(s.marks).filter(Boolean).length, marked: Object.keys(s.marks).length })),
      students: progress.students.map((s) => {
        const present = sessions.filter((x) => x.marks[s.email] === true).length;
        return {
          email: s.email,
          name: s.name,
          joined: s.learnerId !== null,
          course: { lessonsDone: s.lessonsDone, problemsSolved: s.problemsSolved, percent: percent(s.lessonsDone + s.problemsSolved, courseItems) },
          tests: Object.fromEntries(record.testIds.map((examId) => [examId, marks ? (byExam.get(examId)?.get(s.email) ?? null) : null])),
          contests: s.contests,
          attendance: { present, of: sessions.length, percent: percent(present, sessions.length) },
          lastActiveAt: s.lastActiveAt,
        };
      }),
    };
  }

  async #class(actor: Actor, id: string): Promise<ClassRecord> {
    const record = await this.#classes.get(actor.orgId, id);
    if (record === null) throw new AttemptError("not_found", "No such class");
    return record;
  }

  #summary(c: ClassRecord, cohorts: readonly { id: string; name: string }[], tracks: readonly { id: string; title: string }[]): ClassSummary {
    const track = c.trackId === null ? undefined : tracks.find((t) => t.id === c.trackId);
    return {
      id: c.id,
      name: c.name,
      cohort: { id: c.cohortId, name: cohorts.find((x) => x.id === c.cohortId)?.name ?? c.cohortId },
      track: track === undefined ? null : { id: track.id, title: track.title },
      tests: c.testIds.length,
      contests: c.contestIds.length,
      createdAt: c.createdAt,
    };
  }
}
