import type { Student } from "@parikshaa/store";
import { parseCsv } from "./bank-import.js";
import { indianMobile } from "./candidate-import.js";

/**
 * A college's students from a spreadsheet (docs/PREP-TRACKER.md, V2-12 CL8),
 * with the columns placement eligibility is decided on:
 *
 *   roll_number (or ref, roll no, enrollment_no)   required, unique
 *   name, email, phone (or mobile)
 *   branch (or department, stream)
 *   batch (or passing_year, graduation_year, year)   a year like 2027
 *   cgpa                                          0 to 10
 *   backlogs (or active_backlogs, arrears)        a whole number, blank for 0
 *
 * A student already on file is brought up to date: the sheet is the truth.
 * A dry run checks everything and changes nothing; a real import is all or
 * nothing.
 */

export interface StudentProblem {
  readonly row: number;
  readonly message: string;
}

export const MAX_STUDENTS = 20_000;

const ALIASES: Readonly<Record<string, readonly string[]>> = {
  ref: ["roll_number", "ref", "roll_no", "rollno", "roll", "enrollment_no", "enrolment_no", "enrollment_number", "registration_no", "usn", "prn"],
  name: ["name", "student_name", "full_name"],
  email: ["email", "email_id", "mail"],
  phone: ["phone", "mobile", "mobile_no", "phone_no", "contact"],
  branch: ["branch", "department", "dept", "stream", "programme", "program", "course"],
  batch: ["batch", "passing_year", "graduation_year", "year_of_passing", "passout_year", "year"],
  cgpa: ["cgpa", "cgpi", "gpa"],
  backlogs: ["backlogs", "active_backlogs", "backlog", "arrears", "kt"],
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function importStudents(csv: string): { readonly students: readonly Student[]; readonly problems: readonly StudentProblem[] } {
  const [header, ...body] = parseCsv(csv).filter((cells) => cells.some((c) => c.trim() !== ""));
  if (header === undefined) return { students: [], problems: [{ row: 1, message: "The file is empty." }] };
  if (body.length > MAX_STUDENTS) return { students: [], problems: [{ row: 1, message: `At most ${MAX_STUDENTS} students per import.` }] };

  const columns = header.map((h) => h.trim().toLowerCase().replace(/[.\s-]+/g, "_").replace(/_+$/, ""));
  const index = (field: string) => columns.findIndex((c) => ALIASES[field]!.includes(c));
  const at = Object.fromEntries(Object.keys(ALIASES).map((f) => [f, index(f)])) as Record<keyof typeof ALIASES, number>;
  if (at.ref === -1) return { students: [], problems: [{ row: 1, message: "The header row needs a roll number column: roll_number, ref or enrollment_no." }] };

  const problems: StudentProblem[] = [];
  const students: Student[] = [];
  const seen = new Map<string, number>();

  body.forEach((cells, i) => {
    const row = i + 2;
    const cell = (field: string) => (at[field] === -1 ? "" : (cells[at[field]!] ?? "").trim());
    const fail = (message: string) => problems.push({ row, message });

    const ref = cell("ref");
    if (ref === "") return fail("Every student needs a roll number.");
    if (ref.length > 100) return fail(`"${ref.slice(0, 20)}…" is too long for a roll number.`);
    if (seen.has(ref)) return fail(`"${ref}" is also on row ${seen.get(ref)}.`);
    seen.set(ref, row);

    const email = cell("email");
    if (email !== "" && !EMAIL.test(email)) return fail(`"${email}" is not an email address.`);
    const phoneRaw = cell("phone");
    const phone = phoneRaw === "" ? null : indianMobile(phoneRaw);
    if (phoneRaw !== "" && phone === null) return fail(`"${phoneRaw}" is not an Indian mobile number.`);

    const batchRaw = cell("batch");
    const batch = batchRaw === "" ? null : Number(batchRaw);
    if (batch !== null && !(Number.isInteger(batch) && batch >= 1990 && batch <= 2100)) return fail(`"${batchRaw}" is not a year of passing, like 2027.`);

    const cgpaRaw = cell("cgpa");
    const cgpa = cgpaRaw === "" ? null : Number(cgpaRaw);
    if (cgpa !== null && !(Number.isFinite(cgpa) && cgpa >= 0 && cgpa <= 10)) return fail(`"${cgpaRaw}" is not a CGPA out of 10.`);

    const backlogsRaw = cell("backlogs");
    const backlogs = backlogsRaw === "" || /^(nil|none|no|-)$/i.test(backlogsRaw) ? 0 : Number(backlogsRaw);
    if (!(Number.isInteger(backlogs) && backlogs >= 0 && backlogs <= 100)) return fail(`"${backlogsRaw}" is not a number of backlogs.`);

    students.push({
      ref,
      name: cell("name").slice(0, 200),
      email: email === "" ? null : email.toLowerCase(),
      phone,
      branch: cell("branch").slice(0, 100),
      batch,
      cgpa: cgpa === null ? null : Math.round(cgpa * 100) / 100,
      backlogs,
    });
  });

  return { students: problems.length > 0 ? [] : students, problems };
}
