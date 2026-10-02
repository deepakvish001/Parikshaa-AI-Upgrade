import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { funnelOf, type Funnel } from "./funnel.js";
import { allQuestions, examId as toExamId, orgId as toOrgId } from "@parikshaa/core";
import { indianMobile } from "./candidate-import.js";
import { eligible, staffScope, STAGES, type IdentityStore, type QuestionBank, type Application, type Drive, type DriveCollege, type DriveDraft, type Offer, type LedgerStore, type PlacementStore, type Stage, type Student, type StudentRow } from "@parikshaa/store";
import type { Channel, InvitationService } from "./invitation-service.js";
import type { ResultsService } from "./results.js";
import type { StudentChannel, StudentMessages } from "./student-messages.js";
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

export interface DriveApplication extends Omit<Application, "offer"> {
  /** The student's result in the drive's test, once graded there. */
  readonly test: { readonly percent: number; readonly outcome: "qualified" | "failed" | null } | null;
  /** An offer sent with a link, and the link. */
  readonly offer?: Offer & { readonly link: string };
  /** The student's own page to follow their application (CO39). */
  readonly statusLink: string;
}

/** Below this overall percentage across recent tests, a student is listed for extra help. */
export const AT_RISK_PERCENT = 40;

export interface Readiness {
  readonly exams: readonly { readonly id: string; readonly title: string }[];
  readonly topics: readonly string[];
  readonly branches: readonly { readonly branch: string; readonly students: number; readonly cells: Readonly<Record<string, { readonly percent: number; readonly students: number }>> }[];
  readonly atRisk: readonly { readonly ref: string; readonly name: string; readonly branch: string; readonly percent: number; readonly weakest: string }[];
}

interface PlacementFigures {
  readonly students: number;
  readonly placed: number;
  readonly percent: number;
  readonly medianLpa: number | null;
  readonly highestLpa: number | null;
  readonly averageLpa: number | null;
}

export interface PlacementReport {
  readonly batches: readonly (PlacementFigures & { readonly batch: number | null; readonly branches: readonly (PlacementFigures & { readonly branch: string })[] })[];
}

export interface DriveDetail {
  readonly drive: Drive;
  readonly applications: readonly DriveApplication[];
  /** Students who meet the criteria and are not in the drive yet. */
  readonly eligibleNotAdded: number;
  /** The link students apply with; null when the drive has none. */
  readonly applyLink: string | null;
  /** For a drive across colleges: each partner college, its own link, and how many applied through it. */
  readonly colleges: readonly (DriveCollege & { readonly link: string })[];
  /** Offers sent with a link, and how they stand. */
  readonly offers: OfferFigures;
  /** How many reached each round (CO38), over all and by college for a drive across colleges. */
  readonly funnel: Funnel & { readonly colleges: readonly (Funnel & { readonly college: string })[] };
}

export interface OfferFigures {
  readonly sent: number;
  readonly accepted: number;
  readonly declined: number;
  readonly pending: number;
  readonly joined: number;
  /** Accepted, the joining date has passed, and not marked joined. */
  readonly notJoined: number;
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
  readonly #bank: QuestionBank | null;
  readonly #publicUrl: string;
  readonly #identity: IdentityStore | null;
  readonly #messages: StudentMessages | null;
  readonly #statusKey: Buffer;
  readonly #now: () => number;
  readonly #newId: () => string;

  constructor(options: {
    readonly placement: PlacementStore;
    readonly store: LedgerStore;
    readonly exams: ExamService;
    readonly invitations: InvitationService;
    readonly results: ResultsService;
    /** Where a question's topic is filed, for the readiness heatmap. */
    readonly bank?: QuestionBank;
    /** Where students open a drive's link to apply. */
    readonly publicUrl?: string;
    readonly identity?: IdentityStore;
    /** Offers and new drives sent to students by email and WhatsApp (CO42, CL67). */
    readonly messages?: StudentMessages;
    /** Signs a student's link to their own application. */
    readonly secret?: string;
    readonly now?: () => number;
    readonly newId?: () => string;
  }) {
    this.#messages = options.messages ?? null;
    this.#statusKey = createHmac("sha256", options.secret ?? "parikshaa-placement").update("parikshaa-application-status").digest();
    this.#placement = options.placement;
    this.#store = options.store;
    this.#exams = options.exams;
    this.#invitations = options.invitations;
    this.#results = options.results;
    this.#bank = options.bank ?? null;
    this.#publicUrl = (options.publicUrl ?? "").replace(/\/$/, "");
    this.#identity = options.identity ?? null;
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

  /** Every drive's funnel side by side (CO38): where students fall away, drive by drive. */
  async funnels(actor: Actor): Promise<readonly { readonly id: string; readonly company: string; readonly role: string; readonly status: Drive["status"]; readonly funnel: Funnel }[]> {
    this.#require(actor);
    const drives = await this.#placement.drives(actor.orgId);
    return Promise.all(
      drives.map(async (d) => {
        const detail = await this.drive(actor, d.id);
        const { colleges: _colleges, ...funnel } = detail.funnel;
        return { id: d.id, company: d.company, role: d.role, status: d.status, funnel };
      }),
    );
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
    const [applications, students, results, colleges] = await Promise.all([
      this.#placement.applications(actor.orgId, id),
      this.#placement.students(actor.orgId),
      drive.examId === null ? null : this.#results.results(actor, toExamId(drive.examId)).catch(() => null),
      this.#placement.colleges(actor.orgId, id),
    ]);
    const graded = new Map(
      (results?.rows ?? []).filter((r) => r.state === "graded" && r.percent !== null).map((r) => [r.ref, { percent: Math.round(r.percent! * 10) / 10, outcome: r.outcome }] as const),
    );
    const inDrive = new Set(applications.map((a) => a.ref));
    const today = this.#today();
    const sent = applications.filter((a) => a.offer !== undefined);
    const offers: OfferFigures = {
      sent: sent.length,
      accepted: sent.filter((a) => a.offer!.response === "accepted").length,
      declined: sent.filter((a) => a.offer!.response === "declined").length,
      pending: sent.filter((a) => a.offer!.response === null && a.stage === "offered").length,
      joined: sent.filter((a) => a.stage === "joined").length,
      notJoined: sent.filter((a) => a.offer!.response === "accepted" && a.stage === "offered" && a.offer!.joiningDate !== null && a.offer!.joiningDate < today).length,
    };
    const rows = applications.map((a) => ({ stage: a.stage, tested: graded.has(a.ref), college: a.college ?? null }));
    const collegeNames = [...new Set(rows.map((r) => r.college).filter((c): c is string => c !== null))].sort();
    return {
      drive,
      offers,
      funnel: { ...funnelOf(rows), colleges: collegeNames.map((college) => ({ college, ...funnelOf(rows.filter((r) => r.college === college)) })) },
      applications: applications.map(({ offer, ...a }) => ({
        ...a,
        test: graded.get(a.ref) ?? null,
        statusLink: this.statusLink(actor.orgId, drive.id, a.ref),
        ...(offer === undefined ? {} : { offer: { ...offer, link: this.offerLink(actor.orgId, offer.code) } }),
      })),
      eligibleNotAdded: students.filter((s) => !inDrive.has(s.ref) && eligible(s, drive.eligibility)).length,
      applyLink: drive.applyCode === null ? null : this.applyLink(actor.orgId, drive.applyCode),
      colleges: colleges.map((c) => ({ ...c, link: this.applyLink(actor.orgId, c.applyCode) })),
    };
  }

  /**
   * A partner college for a drive across colleges (V2-12 CO15), with its own
   * link. Who applies through it is that college's student: their roll number
   * is prefixed with its short code, so two colleges' numbers never meet.
   */
  async addCollege(actor: Actor, driveId: string, request: { readonly name: string; readonly code: string }) {
    this.#require(actor);
    await this.#drive(actor, driveId);
    const code = request.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,12}$/.test(code)) throw new AttemptError("invalid_state", "The short code is 2 to 12 letters or digits, like IITB or NITT");
    if ((await this.#placement.colleges(actor.orgId, driveId)).some((c) => c.code === code)) throw new AttemptError("invalid_state", `${code} is already a college of this drive`);
    const college = await this.#placement.addCollege(actor.orgId, {
      id: this.#newId(),
      driveId,
      name: request.name.trim().slice(0, 200),
      code,
      applyCode: `c_${randomBytes(9).toString("base64url")}`,
      createdAt: new Date(this.#now()).toISOString(),
    });
    await this.#exams.recordAudit(actor, "drive.college_added", driveId, { college: college.name, code });
    return { ...college, link: this.applyLink(actor.orgId, college.applyCode) };
  }

  offerLink(orgId: string, code: string): string {
    return `${this.#publicUrl}/?offer=${encodeURIComponent(`${orgId}.${code}`)}`;
  }

  /**
   * An offer with a link (V2-12 CO33): the student moves to "offered" with the
   * package, and the link lets them accept or decline it. Sending it again
   * makes a new link and forgets the old answer. Audited.
   */
  async sendOffer(
    actor: Actor,
    driveId: string,
    request: { readonly ref: string; readonly ctcLpa: number; readonly joiningDate: string | null; readonly note: string },
  ): Promise<{ readonly link: string; readonly sent: readonly StudentChannel[] }> {
    this.#require(actor);
    const drive = await this.#drive(actor, driveId);
    if (drive.status === "closed") throw new AttemptError("invalid_state", "This drive is closed: open it again to make an offer");
    const code = randomBytes(12).toString("base64url");
    const made = await this.#placement.sendOffer(actor.orgId, driveId, request.ref, {
      code,
      ctcLpa: request.ctcLpa,
      joiningDate: request.joiningDate,
      note: request.note.trim().slice(0, 2000),
      by: actor.name,
      at: new Date(this.#now()),
    });
    if (!made) throw new AttemptError("not_found", `${request.ref} is not in this drive`);
    // The link goes to the student by email and WhatsApp, where the college has them.
    let sent: readonly StudentChannel[] = [];
    if (this.#messages !== null) {
      const student = (await this.#placement.applications(actor.orgId, driveId)).find((a) => a.ref === request.ref);
      if (student !== undefined) sent = await this.#messages.queueOffer(actor.orgId, driveId, student, code);
    }
    await this.#exams.recordAudit(actor, "drive.offer_sent", driveId, { ref: request.ref, ctcLpa: request.ctcLpa, sent });
    return { link: this.offerLink(actor.orgId, code), sent };
  }

  /**
   * Tell every eligible student not in the drive yet about it, with its link
   * to apply (CL67). Each student hears of a drive once. Audited.
   */
  async alertEligible(actor: Actor, driveId: string): Promise<{ readonly queued: number; readonly already: number; readonly unreachable: number }> {
    this.#require(actor);
    const drive = await this.#drive(actor, driveId);
    if (drive.status === "closed") throw new AttemptError("invalid_state", "This drive is closed");
    if (drive.applyCode === null) throw new AttemptError("invalid_state", "Open the drive's link to apply first: the message carries it");
    if (this.#messages === null || this.#messages.channels().length === 0) throw new AttemptError("invalid_state", "Neither email nor WhatsApp is set up on this server");
    const outcome = await this.#messages.queueDriveAlert(actor.orgId, drive);
    await this.#exams.recordAudit(actor, "drive.alerted", driveId, outcome);
    return outcome;
  }

  async #offer(code: string) {
    const dot = code.indexOf(".");
    if (dot < 1) throw new AttemptError("not_found", "This link is not an offer of ours");
    const orgId = toOrgId(code.slice(0, dot));
    const found = await this.#placement.offerByCode(orgId, code.slice(dot + 1));
    if (found === null || found.application.offer === undefined) throw new AttemptError("not_found", "This link is not an offer of ours, or it was replaced by a newer one");
    return { orgId, ...found, offer: found.application.offer };
  }

  /** What the candidate's offer link shows. */
  async offerView(code: string) {
    const { orgId, drive, application: a, offer } = await this.#offer(code);
    const org = this.#identity === null ? null : await this.#identity.getOrganisation(orgId);
    return {
      from: org?.name ?? "",
      company: drive.company,
      role: drive.role,
      location: drive.location,
      candidateName: a.name,
      ctcLpa: a.offerLpa,
      joiningDate: offer.joiningDate,
      note: offer.note,
      response: offer.response,
      respondedAt: offer.respondedAt,
      // Withdrawn or replaced: the offer no longer stands.
      open: a.stage === "offered" || a.stage === "joined",
    };
  }

  /** The candidate accepts or declines. Once: a change of mind goes through the hiring team. */
  async respondToOffer(code: string, response: "accepted" | "declined"): Promise<{ readonly response: "accepted" | "declined" }> {
    const { orgId, application: a, offer } = await this.#offer(code);
    if (a.stage !== "offered") throw new AttemptError("invalid_state", "This offer no longer stands");
    if (offer.response !== null) throw new AttemptError("invalid_state", `You have already ${offer.response} this offer: write to the hiring team to change it`);
    await this.#placement.respondToOffer(orgId, offer.code, response, new Date(this.#now()));
    return { response };
  }

  async removeCollege(actor: Actor, driveId: string, collegeId: string): Promise<void> {
    this.#require(actor);
    if (!(await this.#placement.removeCollege(actor.orgId, driveId, collegeId))) throw new AttemptError("not_found", "No such college in this drive");
    await this.#exams.recordAudit(actor, "drive.college_removed", driveId, { collegeId });
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

  /**
   * Readiness (V2-12 CL51): how each branch did in each topic, across the
   * organisation's recent graded tests, and the students well below the
   * rest. A question's topic is where it is filed in the question bank, else
   * the section it was drawn in, else "General". A roll number joins a
   * student's tests to their branch; one not on the student list is counted
   * under "Not on the list".
   */
  async readiness(actor: Actor, options: { readonly batch?: number | undefined; readonly exams?: number | undefined } = {}): Promise<Readiness> {
    this.#require(actor);
    const listed = (await this.#exams.listExams(actor)).filter((e) => e.attempts.graded > 0);
    const recent = listed.sort((a, b) => (b.window?.opensAt ?? b.createdAt).localeCompare(a.window?.opensAt ?? a.createdAt)).slice(0, options.exams ?? 6);
    const [students, bank] = await Promise.all([this.#placement.students(actor.orgId), this.#bank === null ? [] : this.#bank.list(staffScope(actor.orgId))]);
    const student = new Map(students.map((s) => [s.ref, s]));
    const filed = new Map(bank.map((e) => [e.id, e.topic.trim()]));
    // Per student and topic: marks earned and marks possible.
    const marks = new Map<string, Map<string, { got: number; max: number }>>();
    for (const summary of recent) {
      const exam = await this.#store.loadExam(staffScope(actor.orgId), toExamId(summary.id));
      if (exam === null) continue;
      const topicOf = new Map<string, string>();
      for (const q of allQuestions(exam)) topicOf.set(q.id, filed.get(q.id) || "General");
      for (const section of exam.sections ?? []) for (const q of section.pool) if (!filed.get(q.id)) topicOf.set(q.id, section.title.trim() || "General");
      const { rows } = await this.#results.results(actor, toExamId(summary.id));
      for (const row of rows) {
        if (row.state !== "graded") continue;
        const s = student.get(row.ref);
        if (options.batch !== undefined && s?.batch !== options.batch) continue;
        const mine = marks.get(row.ref) ?? new Map<string, { got: number; max: number }>();
        for (const [questionId, { score, max }] of Object.entries(row.scores)) {
          if (max <= 0) continue;
          const topic = topicOf.get(questionId) ?? "General";
          const cell = mine.get(topic) ?? { got: 0, max: 0 };
          cell.got += Math.max(0, score);
          cell.max += max;
          mine.set(topic, cell);
        }
        marks.set(row.ref, mine);
      }
    }
    const topics = [...new Set([...marks.values()].flatMap((m) => [...m.keys()]))].sort((a, b) => (a === "General" ? 1 : b === "General" ? -1 : a.localeCompare(b)));
    const percentOf = (c: { got: number; max: number }) => Math.round((c.got * 1000) / c.max) / 10;
    const branches = new Map<string, { students: Set<string>; cells: Map<string, { sum: number; n: number }> }>();
    const overall: { ref: string; name: string; branch: string; percent: number; weakest: string }[] = [];
    for (const [ref, mine] of marks) {
      const branch = student.get(ref)?.branch || (student.has(ref) ? "No branch" : "Not on the list");
      const entry = branches.get(branch) ?? { students: new Set(), cells: new Map() };
      entry.students.add(ref);
      for (const [topic, c] of mine) {
        const cell = entry.cells.get(topic) ?? { sum: 0, n: 0 };
        cell.sum += percentOf(c);
        cell.n += 1;
        entry.cells.set(topic, cell);
      }
      branches.set(branch, entry);
      const got = [...mine.values()].reduce((n, c) => n + c.got, 0);
      const max = [...mine.values()].reduce((n, c) => n + c.max, 0);
      const weakest = [...mine.entries()].sort((a, b) => percentOf(a[1]) - percentOf(b[1]) || a[0].localeCompare(b[0]))[0]?.[0] ?? "";
      overall.push({ ref, name: student.get(ref)?.name ?? "", branch, percent: max === 0 ? 0 : percentOf({ got, max }), weakest });
    }
    return {
      exams: recent.map((e) => ({ id: e.id as string, title: e.title })),
      topics,
      branches: [...branches.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([branch, e]) => ({
          branch,
          students: e.students.size,
          cells: Object.fromEntries([...e.cells.entries()].map(([t, c]) => [t, { percent: Math.round((c.sum / c.n) * 10) / 10, students: c.n }])),
        })),
      atRisk: overall.filter((o) => o.percent < AT_RISK_PERCENT).sort((a, b) => a.percent - b.percent),
    };
  }

  // --- the placement report (V2-12 CL54) ---------------------------------------------

  /**
   * What NIRF's graduation outcomes and NAAC's criterion 5.2 ask for, per year
   * of passing: students, students placed (an offer, or joined, in any drive),
   * and the median, highest and average package of their best offers; then
   * the same by branch. Higher studies are not tracked here and are left for
   * the college to add.
   */
  async placementReport(actor: Actor): Promise<PlacementReport> {
    this.#require(actor);
    const students = await this.#placement.students(actor.orgId);
    const summarise = (group: readonly StudentRow[]) => {
      const offers = group.filter((s) => s.offers > 0 && s.bestOfferLpa !== null).map((s) => s.bestOfferLpa!).sort((a, b) => a - b);
      const placed = group.filter((s) => s.offers > 0).length;
      const mid = offers.length / 2;
      const median = offers.length === 0 ? null : offers.length % 2 === 1 ? offers[Math.floor(mid)]! : (offers[mid - 1]! + offers[mid]!) / 2;
      return {
        students: group.length,
        placed,
        percent: group.length === 0 ? 0 : Math.round((placed * 1000) / group.length) / 10,
        medianLpa: median === null ? null : Math.round(median * 100) / 100,
        highestLpa: offers.at(-1) ?? null,
        averageLpa: offers.length === 0 ? null : Math.round((offers.reduce((n, o) => n + o, 0) / offers.length) * 100) / 100,
      };
    };
    const batches = [...new Set(students.map((s) => s.batch))].sort((a, b) => (b ?? 0) - (a ?? 0));
    return {
      batches: batches.map((batch) => {
        const group = students.filter((s) => s.batch === batch);
        const branches = [...new Set(group.map((s) => s.branch || "No branch"))].sort();
        return { batch, ...summarise(group), branches: branches.map((branch) => ({ branch, ...summarise(group.filter((s) => (s.branch || "No branch") === branch)) })) };
      }),
    };
  }

  async placementReportCsv(actor: Actor): Promise<string> {
    const report = await this.placementReport(actor);
    const head = ["Year of passing", "Branch", "Students", "Placed", "Placed (%)", "Median package (LPA)", "Highest (LPA)", "Average (LPA)"];
    const rows = report.batches.flatMap((b) => [
      [b.batch ?? "Not given", "All", b.students, b.placed, b.percent, b.medianLpa, b.highestLpa, b.averageLpa],
      ...b.branches.map((r) => [b.batch ?? "Not given", r.branch, r.students, r.placed, r.percent, r.medianLpa, r.highestLpa, r.averageLpa]),
    ]);
    await this.#exams.recordAudit(actor, "placement.report_exported", "placement", {});
    return `\ufeff${[head, ...rows].map((r) => r.map((v) => csvCell(v as string | number | null)).join(",")).join("\r\n")}\r\n`;
  }

  // --- applying from a link (V2-12 CO14) ------------------------------------------

  applyLink(orgId: string, code: string): string {
    return `${this.#publicUrl}/?apply=${encodeURIComponent(`${orgId}.${code}`)}`;
  }

  /** Give the drive a link students apply with, or take it away. A new link replaces the old one. */
  async setApplyLink(actor: Actor, id: string, open: boolean, openToNew: boolean): Promise<{ readonly link: string | null }> {
    this.#require(actor);
    const drive = await this.#drive(actor, id);
    const code = open ? (drive.applyCode ?? randomBytes(9).toString("base64url")) : null;
    await this.#placement.setApply(actor.orgId, id, code, open && openToNew);
    await this.#exams.recordAudit(actor, open ? "drive.apply_opened" : "drive.apply_closed", id, open ? { openToNew } : {});
    return { link: code === null ? null : this.applyLink(actor.orgId, code) };
  }

  async #byCode(code: string): Promise<{ orgId: ReturnType<typeof toOrgId>; drive: Drive; college: DriveCollege | null }> {
    const dot = code.indexOf(".");
    if (dot < 1) throw new AttemptError("not_found", "This link is not a drive of ours");
    const orgId = toOrgId(code.slice(0, dot));
    const rest = code.slice(dot + 1);
    if (rest.startsWith("c_")) {
      const found = await this.#placement.driveByCollegeCode(orgId, rest);
      if (found === null) throw new AttemptError("not_found", "This link is not a drive of ours, or it has been closed");
      // Through a college's link, anyone from that college may apply: the company has no list of them.
      return { orgId, drive: { ...found.drive, openToNew: true }, college: found.college };
    }
    const drive = await this.#placement.driveByCode(orgId, rest);
    if (drive === null) throw new AttemptError("not_found", "This link is not a drive of ours, or it has been closed");
    return { orgId, drive, college: null };
  }

  /** What the link shows before applying: the drive and who may apply. Never another student. */
  async publicDrive(code: string) {
    const { orgId, drive, college } = await this.#byCode(code);
    const org = this.#identity === null ? null : await this.#identity.getOrganisation(orgId);
    const closed = drive.status === "closed" || (drive.applyBy !== null && drive.applyBy < this.#today());
    return {
      institution: org?.name ?? "",
      company: drive.company,
      role: drive.role,
      ctcLpa: drive.ctcLpa,
      location: drive.location,
      description: drive.description,
      applyBy: drive.applyBy,
      eligibility: drive.eligibility,
      openToNew: drive.openToNew,
      college: college?.name ?? null,
      closed,
    };
  }

  #today() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(this.#now()));
  }

  /**
   * Apply to a drive from its link. A student on the list applies as
   * themselves: the email on file must match. Someone not on it may apply
   * only to an off-campus drive, and is added with what they declared.
   * Either way the drive's criteria are checked, and applying twice changes
   * nothing.
   */
  async apply(code: string, form: Student): Promise<{ readonly status: "applied" | "already"; readonly statusLink: string }> {
    const { orgId, drive, college } = await this.#byCode(code);
    if (drive.status === "closed" || (drive.applyBy !== null && drive.applyBy < this.#today())) throw new AttemptError("invalid_state", "Applications to this drive have closed");
    const given = form.ref.trim();
    const ref = college === null || given === "" || given.toUpperCase().startsWith(`${college.code}-`) ? given : `${college.code}-${given}`;
    const email = (form.email ?? "").trim().toLowerCase();
    if (ref === "" || email === "") throw new AttemptError("invalid_state", "Give your roll number and email");
    const onFile = (await this.#placement.students(orgId)).find((s) => s.ref.toLowerCase() === ref.toLowerCase());
    let student: Student;
    if (onFile !== undefined) {
      if (onFile.email !== null && onFile.email !== email) throw new AttemptError("not_found", "That roll number and email do not match the college's list: check both, or ask your placement cell");
      student = onFile;
    } else {
      if (!drive.openToNew) throw new AttemptError("not_found", "That roll number is not on the college's list: ask your placement cell to add you");
      const phone = form.phone === null || form.phone.trim() === "" ? null : indianMobile(form.phone);
      if (form.phone !== null && form.phone.trim() !== "" && phone === null) throw new AttemptError("invalid_state", "That is not an Indian mobile number");
      student = { ...form, ref, email, phone, name: form.name.trim().slice(0, 200), branch: form.branch.trim().slice(0, 100), college: college?.name ?? null };
      if (student.name === "") throw new AttemptError("invalid_state", "Give your name");
      await this.#placement.register(orgId, student, new Date(this.#now()));
    }
    if (!eligible(student, drive.eligibility)) throw new AttemptError("invalid_state", "You do not meet this drive's criteria, as the college's records have them");
    const added = await this.#placement.addApplications(orgId, drive.id, [student.ref], `${student.name || student.ref} (applied online)`, new Date(this.#now()));
    return { status: added > 0 ? "applied" : "already", statusLink: this.statusLink(orgId, drive.id, student.ref) };
  }

  // --- the student's own page (CO39) --------------------------------------------------

  #statusMac(orgId: string, driveId: string, ref: string) {
    return createHmac("sha256", this.#statusKey).update(`${orgId}\n${driveId}\n${ref}`).digest("base64url").slice(0, 22);
  }

  /** A link only this student's application opens: signed, nothing stored. */
  statusLink(orgId: string, driveId: string, ref: string): string {
    const code = `${orgId}.${driveId}.${Buffer.from(ref).toString("base64url")}.${this.#statusMac(orgId, driveId, ref)}`;
    return `${this.#publicUrl}/?status=${encodeURIComponent(code)}`;
  }

  /** Where one application stands, for the student: the rounds, and their offer if it waits for an answer. Never anyone else's. */
  async status(code: string) {
    const [org, driveId, refPart, mac, ...rest] = code.trim().split(".");
    if (org === undefined || driveId === undefined || refPart === undefined || mac === undefined || rest.length > 0) throw new AttemptError("not_found", "This link is not one of ours");
    const ref = Buffer.from(refPart, "base64url").toString("utf8");
    const expected = Buffer.from(this.#statusMac(org, driveId, ref));
    const given = Buffer.from(mac);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new AttemptError("not_found", "This link is not one of ours");
    const orgId = toOrgId(org);
    const drive = await this.#placement.drive(orgId, driveId);
    const application = drive === null ? undefined : (await this.#placement.applications(orgId, driveId)).find((a) => a.ref === ref);
    if (drive === null || application === undefined) throw new AttemptError("not_found", "This application is no longer on record");
    const institution = this.#identity === null ? "" : ((await this.#identity.getOrganisation(orgId))?.name ?? "");
    const offer = application.offer;
    return {
      institution,
      company: drive.company,
      role: drive.role,
      name: application.name,
      stage: application.stage,
      updatedAt: application.updatedAt,
      offer:
        offer === undefined || (application.stage !== "offered" && application.stage !== "joined")
          ? null
          : { ctcLpa: application.offerLpa, joiningDate: offer.joiningDate, response: offer.response, link: offer.response === null ? this.offerLink(orgId, offer.code) : null },
    };
  }

  /** The drive's students as a spreadsheet, to send the company. Audited: it leaves the system. */
  async exportCsv(actor: Actor, id: string): Promise<{ readonly filename: string; readonly csv: string }> {
    const { drive, applications } = await this.drive(actor, id);
    // A college column only for a drive across colleges.
    const across = applications.some((a) => (a.college ?? null) !== null);
    const head = ["Roll no.", "Name", ...(across ? ["College"] : []), "Email", "Phone", "Branch", "Batch", "CGPA", "Backlogs", "Stage", "Test (%)", "Offer (LPA)"];
    const rows = applications.map((a) => [
      a.ref,
      a.name,
      ...(across ? [a.college ?? null] : []),
      a.email,
      a.phone === null ? null : `+${a.phone}`,
      a.branch,
      a.batch,
      a.cgpa,
      a.backlogs,
      STAGE_WORDS[a.stage],
      a.test?.percent ?? null,
      a.offerLpa,
    ]);
    await this.#exams.recordAudit(actor, "drive.exported", id, { students: rows.length });
    const slug = `${drive.company}-${drive.role}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    return { filename: `${slug || "drive"}.csv`, csv: `﻿${[head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n")}\r\n` };
  }
}
