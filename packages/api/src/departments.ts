import { randomBytes } from "node:crypto";
import type { DepartmentStore, IdentityStore, StaffRole } from "@parikshaa/store";
import { parseCsv } from "./bank-import.js";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, hashPassword, type Actor } from "./staff-auth.js";

/**
 * Departments, and staff by the sheet (docs/PREP-TRACKER.md, CL4 and CL6).
 * A university's colleges, or a college's departments, are names on staff
 * and on exams. Staff with a department — other than owners — see in the
 * exam list only that department's exams and those with none. Staff come in
 * from a sheet, checked first; each new one is sent a link to set their own
 * password, so no password travels in the sheet.
 */

const IMPORTABLE: readonly StaffRole[] = ["author", "invigilator", "reviewer", "viewer"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (d: string) => d.trim().replace(/\s+/g, " ").slice(0, 100);

export interface StaffRowDraft {
  readonly row: number;
  readonly email: string;
  readonly name: string;
  readonly role: StaffRole;
  readonly department: string | null;
}

export class DepartmentService {
  readonly #departments: DepartmentStore;
  readonly #identity: IdentityStore;
  readonly #exams: ExamService;
  readonly #invite: (email: string) => Promise<unknown>;

  constructor(options: { readonly departments: DepartmentStore; readonly identity: IdentityStore; readonly exams: ExamService; readonly invite: (email: string) => Promise<unknown> }) {
    this.#departments = options.departments;
    this.#identity = options.identity;
    this.#exams = options.exams;
    this.#invite = options.invite;
  }

  /** For the exam list: what this member of staff sees, and each exam's department. */
  async scope(actor: Actor): Promise<{ readonly visible: (examId: string) => boolean; readonly of: (examId: string) => string | null }> {
    const [staff, exams] = await Promise.all([this.#departments.staff(actor.orgId), this.#departments.exams(actor.orgId)]);
    const mine = actor.kind === "user" && actor.role !== "owner" ? (staff.get(actor.id) ?? null) : null;
    return {
      visible: (id) => mine === null || (exams.get(id) ?? mine) === mine,
      of: (id) => exams.get(id) ?? null,
    };
  }

  async list(actor: Actor) {
    if (!can(actor, "exam:read")) throw new Forbidden("exam:read");
    const [staff, exams] = await Promise.all([this.#departments.staff(actor.orgId), this.#departments.exams(actor.orgId)]);
    return {
      departments: [...new Set([...staff.values(), ...exams.values()])].sort((a, b) => a.localeCompare(b)),
      staff: [...staff].map(([userId, department]) => ({ userId, department })),
      exams: [...exams].map(([examId, department]) => ({ examId, department })),
    };
  }

  async setStaff(actor: Actor, userId: string, department: string | null): Promise<void> {
    if (!can(actor, "staff:manage")) throw new Forbidden("staff:manage");
    if ((await this.#identity.findUser(actor.orgId, userId)) === null) throw new AttemptError("not_found", "No such member of staff");
    const d = department === null || clean(department) === "" ? null : clean(department);
    await this.#departments.setStaff(actor.orgId, userId, d);
    await this.#exams.recordAudit(actor, "staff.department_set", userId, { department: d });
  }

  /** An exam's department. Staff with a department of their own may only put an exam in theirs. */
  async setExam(actor: Actor, examId: string, department: string | null): Promise<void> {
    if (!can(actor, "exam:write")) throw new Forbidden("exam:write");
    const d = department === null || clean(department) === "" ? null : clean(department);
    const { visible } = await this.scope(actor);
    if (!visible(examId)) throw new AttemptError("not_found", "No such exam");
    if (actor.kind === "user" && actor.role !== "owner") {
      const mine = (await this.#departments.staff(actor.orgId)).get(actor.id) ?? null;
      if (mine !== null && d !== mine) throw new AttemptError("invalid_state", `You can put exams only in ${mine}`);
    }
    await this.#departments.setExam(actor.orgId, examId, d);
    await this.#exams.recordAudit(actor, "exam.department_set", examId, { department: d });
  }

  /**
   * Staff from a sheet: email, name, role (author, invigilator, reviewer or
   * viewer — owners are made by hand) and department. Checked first; nothing
   * is saved while any row is wrong. Each new member is sent a link to set a
   * password. Someone already on staff is skipped, not changed.
   */
  async importStaff(actor: Actor, csv: string, dryRun: boolean) {
    if (!can(actor, "staff:manage")) throw new Forbidden("staff:manage");
    const rows = parseCsv(csv).filter((r) => r.some((c) => c.trim() !== ""));
    const head = (rows[0] ?? []).map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ""));
    const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
    const [ei, ni, ri, di] = [col("email", "emailid", "mail"), col("name", "fullname"), col("role"), col("department", "dept", "college", "school")];
    if (ei < 0 || ni < 0) throw new AttemptError("invalid_state", "The sheet needs email and name columns");
    const problems: { row: number; message: string }[] = [];
    const drafts: StaffRowDraft[] = [];
    const seen = new Set<string>();
    rows.slice(1).forEach((r, i) => {
      const row = i + 2;
      const email = (r[ei] ?? "").trim().toLowerCase();
      const name = (r[ni] ?? "").trim().slice(0, 200);
      const roleText = ri < 0 ? "author" : (r[ri] ?? "").trim().toLowerCase() || "author";
      const department = di < 0 ? null : clean(r[di] ?? "") || null;
      if (!EMAIL.test(email)) return problems.push({ row, message: `"${email}" is not an email address` });
      if (name === "") return problems.push({ row, message: "No name" });
      if (!IMPORTABLE.includes(roleText as StaffRole)) return problems.push({ row, message: `Role "${roleText}": use author, invigilator, reviewer or viewer` });
      if (seen.has(email)) return problems.push({ row, message: `${email} is in the sheet twice` });
      seen.add(email);
      drafts.push({ row, email, name, role: roleText as StaffRole, department });
    });
    const existing = new Set<string>();
    for (const d of drafts) if ((await this.#identity.findUserByEmail(d.email)) !== null) existing.add(d.email);
    const fresh = drafts.filter((d) => !existing.has(d.email));
    if (dryRun || problems.length > 0) return { dryRun: true as const, added: fresh.length, skipped: existing.size, problems, preview: fresh.slice(0, 20) };
    for (const d of fresh) {
      // A password nobody knows: the member sets their own from the link sent to them.
      const user = await this.#identity.createUser({ orgId: actor.orgId, email: d.email, name: d.name, role: d.role, passwordHash: await hashPassword(randomBytes(24).toString("base64url")) });
      if (d.department !== null) await this.#departments.setStaff(actor.orgId, user.id, d.department);
      await this.#invite(d.email);
    }
    await this.#exams.recordAudit(actor, "staff.imported", "staff", { added: fresh.length, skipped: existing.size });
    return { dryRun: false as const, added: fresh.length, skipped: existing.size, problems: [], preview: [] };
  }
}
