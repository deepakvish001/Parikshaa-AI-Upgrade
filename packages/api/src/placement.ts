import { examId as toExamId } from "@parikshaa/core";
import { eligible, staffScope, STAGES, type Application, type Drive, type DriveDraft, type LedgerStore, type PlacementStore, type Stage, type Student, type StudentRow } from "@parikshaa/store";
import type { Channel, InvitationService } from "./invitation-service.js";
import type { ResultsService } from "./results.js";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";
import { importStudents, type StudentProblem } from "./student-import.js";

/**
 * The placement cell (docs/PREP-TRACKER.md, V2-12: CL8 student master, CL52
 * drive manager). Students are entered once, with branch, batch, CGPA and
 * backlogs; a drive names a company, a role and who may apply, finds the
 * students who meet it, and follows each through the rounds to an offer.
 * A drive's test is an ordinary exam, its candidates invited under their
 * roll numbers, so its marks come from the ledger like any other.
 */

export class ImportRejected extends Error {
  constructor(readonly problems: readonly StudentProblem[]) {
    super(`${problems.length} row${problems.length === 1 ? "" : "s"} could not be read`);
    this.name = "ImportRejected";
  }
}

export interface DriveApplication extends Application {
  /** The student's result in the drive's test, once graded there. */
  readonly test: { readonly percent: number; readonly outcome: "qualified" | "failed" | null } | null;
}

export interface DriveDetail {
  readonly drive: Drive;
  readonly applications: readonly DriveApplication[];
  /** Students who meet the criteria and are not in the drive yet. */
  readonly eligibleNotAdded: number;
}

const csvCell = (v: string | number | null) => {
  const text = v === null ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const STAGE_WORDS: Record<Stage, string> = {
  applied: "Applied",
  test: "Test",
  interview: "Interview",
  offered: "Offered",
  joined: "Joined",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

export class PlacementService {
  readonly #placement: PlacementStore;
  readonly #store: LedgerStore;
  readonly #exams: ExamService;
  readonly #invitations: InvitationService;
  readonly #results: ResultsService;
  readonly #now: () => number;
  readonly #newId: () => string;

  constructor(options: {
    readonly placement: PlacementStore;
    readonly store: LedgerStore;
    readonly exams: ExamService;
    readonly invitations: InvitationService;
    readonly results: ResultsService;
    readonly now?: () => number;
    readonly newId?: () => string;
  }) {
    this.#placement = options.placement;
    this.#store = options.store;
    this.#exams = options.exams;
    this.#invitations = options.invitations;
    this.#results = options.results;
    this.#now = options.now ?? (() => Date.now());
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  // Placement records carry marks and contact details: the same people who read results.
  #require(actor: Actor): void {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
  }

  // --- students -----------------------------------------------------------------

  async students(actor: Actor): Promise<readonly StudentRow[]> {
    this.#require(actor);
    return this.#placement.students(actor.orgId);
  }

  /** Check a sheet of students, or bring them in. A student already on file is updated to what the sheet says. */
  async importStudents(
    actor: Actor,
    csv: string,
    dryRun: boolean,
  ): Promise<{ readonly dryRun: boolean; readonly students: number; readonly added: number; readonly updated: number; readonly problems: readonly StudentProblem[]; readonly preview: readonly Student[] }> {
    this.#require(actor);
    const { students, problems } = importStudents(csv);
    if (dryRun) {
      const existing = await this.#placement.refs(actor.orgId);
      const updated = students.filter((s) => existing.has(s.ref)).length;
      return { dryRun: true, students: students.length, added: students.length - updated, updated, problems, preview: students.slice(0, 20) };
    }
    if (problems.length > 0) throw new ImportRejected(problems);
    const { added, updated } = await this.#placement.upsert(actor.orgId, students, new Date(this.#now()));
    await this.#exams.recordAudit(actor, "students.imported", "students", { added, updated });
    return { dryRun: false, students: students.length, added, updated, problems: [], preview: [] };
  }

  async removeStudent(actor: Actor, ref: string): Promise<void> {
    this.#require(actor);
    if (!(await this.#placement.remove(actor.orgId, ref))) throw new AttemptError("not_found", `No student with roll number ${ref}`);
    await this.#exams.recordAudit(actor, "student.removed", ref);
  }

  // --- drives -------------------------------------------------------------------

  async drives(actor: Actor): Promise<readonly Drive[]> {
    this.#require(actor);
    return this.#placement.drives(actor.orgId);
  }

  async #check(actor: Actor, draft: DriveDraft): Promise<DriveDraft> {
    const company = draft.company.trim();
    const role = draft.role.trim();
    if (company === "" || role === "") throw new AttemptError("invalid_state", "A drive needs a company and a role");
    const rule = draft.eligibility;
    if (rule.minCgpa !== undefined && (rule.minCgpa < 0 || rule.minCgpa > 10)) throw new AttemptError("invalid_state", "The minimum CGPA must be between 0 and 10");
    if (draft.examId !== null && (await this.#store.loadExam(staffScope(actor.orgId), toExamId(draft.examId))) === null) {
      throw new AttemptError("not_found", `No such exam: ${draft.examId}`);
    }
    const branches = [...new Set((rule.branches ?? []).map((b) => b.trim()).filter((b) => b !== ""))];
    return {
      ...draft,
      company,
      role,
      location: draft.location.trim(),
      eligibility: {
        ...(rule.minCgpa === undefined ? {} : { minCgpa: rule.minCgpa }),
        ...(rule.maxBacklogs === undefined ? {} : { maxBacklogs: rule.maxBacklogs }),
        ...(branches.length === 0 ? {} : { branches }),
        ...(rule.batches === undefined || rule.batches.length === 0 ? {} : { batches: [...new Set(rule.batches)].sort() }),
      },
    };
  }

  async createDrive(actor: Actor, draft: DriveDraft): Promise<Drive> {
    this.#require(actor);
    const checked = await this.#check(actor, draft);
    const id = this.#newId();
    await this.#placement.saveDrive(actor.orgId, id, checked, new Date(this.#now()), true);
    await this.#exams.recordAudit(actor, "drive.created", id, { company: checked.company, role: checked.role });
    return (await this.#placement.drive(actor.orgId, id))!;
  }

  async updateDrive(actor: Actor, id: string, draft: DriveDraft): Promise<Drive> {
    this.#require(actor);
    const checked = await this.#check(actor, draft);
    if (!(await this.#placement.saveDrive(actor.orgId, id, checked, new Date(this.#now()), false))) throw new AttemptError("not_found", `No such drive: ${id}`);
    await this.#exams.recordAudit(actor, "drive.saved", id, { company: checked.company, role: checked.role, status: checked.status });
    return (await this.#placement.drive(actor.orgId, id))!;
  }

  async #drive(actor: Actor, id: string): Promise<Drive> {
    const drive = await this.#placement.drive(actor.orgId, id);
    if (drive === null) throw new AttemptError("not_found", `No such drive: ${id}`);
    return drive;
  }

  /** A drive, its students with their stage and test result, and how many more meet its criteria. */
  async drive(actor: Actor, id: string): Promise<DriveDetail> {
    this.#require(actor);
    const drive = await this.#drive(actor, id);
    const [applications, students, results] = await Promise.all([
      this.#placement.applications(actor.orgId, id),
      this.#placement.students(actor.orgId),
      drive.examId === null ? null : this.#results.results(actor, toExamId(drive.examId)).catch(() => null),
    ]);
    const graded = new Map(
      (results?.rows ?? []).filter((r) => r.state === "graded" && r.percent !== null).map((r) => [r.ref, { percent: Math.round(r.percent! * 10) / 10, outcome: r.outcome }] as const),
    );
    const inDrive = new Set(applications.map((a) => a.ref));
    return {
      drive,
      applications: applications.map((a) => ({ ...a, test: graded.get(a.ref) ?? null })),
      eligibleNotAdded: students.filter((s) => !inDrive.has(s.ref) && eligible(s, drive.eligibility)).length,
    };
  }

  /** Put students in the drive: those named, or every eligible student not in it yet. Names not on file are refused. */
  async addStudents(actor: Actor, id: string, refs: readonly string[] | "eligible"): Promise<{ readonly added: number }> {
    this.#require(actor);
    const drive = await this.#drive(actor, id);
    if (drive.status === "closed") throw new AttemptError("invalid_state", "This drive is closed: open it again to add students");
    const students = await this.#placement.students(actor.orgId);
    let chosen: readonly string[];
    if (refs === "eligible") {
      chosen = students.filter((s) => eligible(s, drive.eligibility)).map((s) => s.ref);
    } else {
      const known = new Set(students.map((s) => s.ref));
      const unknown = refs.filter((r) => !known.has(r));
      if (unknown.length > 0) throw new AttemptError("not_found", `Not on the student list: ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? "…" : ""}`);
      chosen = refs;
    }
    const added = await this.#placement.addApplications(actor.orgId, id, chosen, actor.name, new Date(this.#now()));
    await this.#exams.recordAudit(actor, "drive.students_added", id, { added, eligible: refs === "eligible" });
    return { added };
  }

  /** Move students to a stage of the drive: the next round, an offer (with its amount), or out. */
  async setStage(actor: Actor, id: string, refs: readonly string[], stage: Stage, offerLpa: number | null): Promise<{ readonly moved: number }> {
    this.#require(actor);
    await this.#drive(actor, id);
    if (!STAGES.includes(stage)) throw new AttemptError("invalid_state", `No such stage: ${stage}`);
    const moved = await this.#placement.setStage(actor.orgId, id, refs, stage, stage === "offered" || stage === "joined" ? offerLpa : null, actor.name, new Date(this.#now()));
    await this.#exams.recordAudit(actor, "drive.stage_set", id, { stage, students: moved, ...(offerLpa === null ? {} : { offerLpa }) });
    return { moved };
  }

  /**
   * Send the drive's test to its students still at "applied" (or those
   * named), and move them to "test". Someone already invited to that exam
   * keeps their invitation.
   */
  async sendTest(actor: Actor, id: string, refs: readonly string[] | null, channels: readonly Channel[]): Promise<{ readonly invited: number; readonly skipped: number }> {
    this.#require(actor);
    const drive = await this.#drive(actor, id);
    if (drive.examId === null) throw new AttemptError("invalid_state", "Choose the drive's test first");
    const applications = await this.#placement.applications(actor.orgId, id);
    const chosen = applications.filter((a) => (refs === null ? a.stage === "applied" : refs.includes(a.ref)));
    if (chosen.length === 0) throw new AttemptError("invalid_state", "No students to send the test to: add students to the drive first");
    const result = await this.#invitations.inviteMany(actor, drive.examId, chosen, channels, { drive: id });
    await this.#placement.setStage(actor.orgId, id, chosen.filter((a) => a.stage === "applied").map((a) => a.ref), "test", null, actor.name, new Date(this.#now()));
    return result;
  }

  /** The drive's students as a spreadsheet, to send the company. Audited: it leaves the system. */
  async exportCsv(actor: Actor, id: string): Promise<{ readonly filename: string; readonly csv: string }> {
    const { drive, applications } = await this.drive(actor, id);
    const head = ["Roll no.", "Name", "Email", "Phone", "Branch", "Batch", "CGPA", "Backlogs", "Stage", "Test (%)", "Offer (LPA)"];
    const rows = applications.map((a) => [a.ref, a.name, a.email, a.phone === null ? null : `+${a.phone}`, a.branch, a.batch, a.cgpa, a.backlogs, STAGE_WORDS[a.stage], a.test?.percent ?? null, a.offerLpa]);
    await this.#exams.recordAudit(actor, "drive.exported", id, { students: rows.length });
    const slug = `${drive.company}-${drive.role}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    return { filename: `${slug || "drive"}.csv`, csv: `﻿${[head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n")}\r\n` };
  }
}
