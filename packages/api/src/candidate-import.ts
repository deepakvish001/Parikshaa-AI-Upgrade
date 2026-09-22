import type { ExamWindow, InvitationDraft } from "@parikshaa/store";
import { parseCsv } from "./bank-import.js";

/**
 * Importing a cohort from a spreadsheet (ROADMAP §5).
 *
 *   ref (or roll_number, candidate_id, application_id)   required, unique
 *   name, email, phone
 *   opens_at, closes_at   optional; a per-candidate window inside the exam's
 *
 * Times without an offset are read as India Standard Time, which is what a
 * sheet written in India means by "10:00". Phone numbers are Indian mobiles
 * and are stored as 91XXXXXXXXXX.
 *
 * A dry run checks everything and changes nothing. Problems block an import;
 * warnings — a candidate with no way to be contacted — do not, since their
 * code can still be exported and handed over.
 */

export interface CandidateProblem {
  readonly row: number;
  readonly message: string;
}

export interface CandidateImport {
  readonly drafts: readonly InvitationDraft[];
  readonly problems: readonly CandidateProblem[];
  readonly warnings: readonly CandidateProblem[];
}

export const MAX_CANDIDATES = 20_000;

const REF_COLUMNS = ["ref", "roll_number", "roll no", "candidate_id", "application_id", "id"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An Indian mobile as 91 followed by ten digits, or null if it is not one. */
export function indianMobile(raw: string): string | null {
  const digits = raw.replace(/[\s()-]/g, "").replace(/^\+/, "");
  const national = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(national) ? `91${national}` : null;
}

/** A time from a sheet: ISO with an offset as given, or a bare date-time as IST. */
export function sheetTime(raw: string): string | null {
  const text = raw.trim().replace(" ", "T");
  if (text === "") return null;
  const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/i.test(text);
  const withSeconds = /T\d{2}:\d{2}$/.test(text) ? `${text}:00` : text;
  const parsed = new Date(hasOffset ? withSeconds : `${withSeconds}+05:30`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function importCandidates(csv: string, window: ExamWindow | null, alreadyInvited: ReadonlySet<string>): CandidateImport {
  const [header, ...body] = parseCsv(csv);
  if (header === undefined) return { drafts: [], problems: [{ row: 1, message: "The file is empty." }], warnings: [] };
  if (body.length > MAX_CANDIDATES) {
    return { drafts: [], problems: [{ row: 1, message: `At most ${MAX_CANDIDATES} candidates per import.` }], warnings: [] };
  }

  const columns = header.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const refColumn = columns.findIndex((c) => REF_COLUMNS.includes(c.replace(/_/g, " ")) || REF_COLUMNS.includes(c));
  if (refColumn === -1) {
    return {
      drafts: [],
      problems: [{ row: 1, message: "The header row needs a column naming each candidate: ref, roll_number or candidate_id." }],
      warnings: [],
    };
  }

  const problems: CandidateProblem[] = [];
  const warnings: CandidateProblem[] = [];
  const drafts: InvitationDraft[] = [];
  const seen = new Map<string, number>();

  body.forEach((cells, index) => {
    const row = index + 2;
    const cell = (name: string) => (cells[columns.indexOf(name)] ?? "").trim();
    const fail = (message: string) => problems.push({ row, message });

    const ref = (cells[refColumn] ?? "").trim();
    if (ref === "") return fail("Every candidate needs a reference.");
    if (seen.has(ref)) return fail(`"${ref}" is also on row ${seen.get(ref)}.`);
    seen.set(ref, row);
    if (alreadyInvited.has(ref)) return fail(`"${ref}" is already invited to this exam.`);

    const email = cell("email");
    if (email !== "" && !EMAIL.test(email)) return fail(`"${email}" is not an email address.`);
    const phoneRaw = cell("phone") || cell("mobile");
    const phone = phoneRaw === "" ? null : indianMobile(phoneRaw);
    if (phoneRaw !== "" && phone === null) return fail(`"${phoneRaw}" is not an Indian mobile number.`);
    if (email === "" && phone === null) warnings.push({ row, message: `"${ref}" has no email or phone; hand them their code yourself.` });

    const opensRaw = cell("opens_at");
    const closesRaw = cell("closes_at");
    const opensAt = opensRaw === "" ? window?.opensAt ?? null : sheetTime(opensRaw);
    const closesAt = closesRaw === "" ? window?.closesAt ?? null : sheetTime(closesRaw);
    if (opensRaw !== "" && opensAt === null) return fail(`"${opensRaw}" is not a date and time.`);
    if (closesRaw !== "" && closesAt === null) return fail(`"${closesRaw}" is not a date and time.`);
    if (opensAt === null || closesAt === null) return fail("No window: set the exam's window, or give opens_at and closes_at.");
    if (closesAt <= opensAt) return fail("The window closes before it opens.");
    if (window !== null && (opensAt < window.opensAt || closesAt > window.closesAt)) {
      return fail("A candidate's window must fall inside the exam's window.");
    }

    drafts.push({
      candidateRef: ref,
      name: cell("name"),
      email: email === "" ? null : email.toLowerCase(),
      phone,
      opensAt,
      closesAt,
      hardClose: window?.hardClose ?? true,
    });
  });

  return { drafts: problems.length > 0 ? [] : drafts, problems, warnings };
}
