import { questionId, validateQuestion, type Question } from "@parikshaa/core";
import type { BankDraft, Difficulty } from "@parikshaa/store";

/**
 * Importing questions from a spreadsheet (ROADMAP §3).
 *
 * Institutions already keep their questions in Excel. CSV is what every
 * spreadsheet exports, so that is the format: one question per row, a header
 * row naming the columns, in any order and any case.
 *
 *   kind       mcq | numeric | short               (required)
 *   question   the stem                            (required)
 *   options    mcq choices, separated by |          (mcq)
 *   answer     mcq: a letter (B), a number (2) or the option's text;
 *              numeric: the value; short: expected points, separated by |
 *   tolerance  numeric only; defaults to 0
 *   marks      defaults to 1
 *   rubric     short: criteria separated by |; defaults to the expected points
 *   topic, difficulty (easy | medium | hard), tags (separated by | or ,)
 *
 * Code questions carry test cases and are written in the console instead.
 *
 * An import is all or nothing. Every row is checked first and every problem is
 * reported with its row number, so a file is fixed once rather than one error
 * per upload — and a half-imported file never leaves the bank in a state
 * nobody asked for.
 */

export interface ImportProblem {
  /** 1-based, counting the header as row 1, as a spreadsheet numbers them. */
  readonly row: number;
  readonly message: string;
}

export type ImportResult =
  | { readonly ok: true; readonly drafts: readonly BankDraft[] }
  | { readonly ok: false; readonly problems: readonly ImportProblem[] };

/** Most a single import may carry; larger banks go in several files. */
export const MAX_IMPORT_ROWS = 2000;

/**
 * Parse CSV (RFC 4180): quoted fields may contain commas, newlines and doubled
 * quotes. Accepts CRLF or LF, and a leading byte-order mark, which Excel writes.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"' && field === "") quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Blank lines, which spreadsheets leave at the end, are not questions.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export const split = (value: string, on: RegExp = /\|/): string[] =>
  value
    .split(on)
    .map((s) => s.trim())
    .filter((s) => s !== "");

const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

export function importQuestions(csv: string): ImportResult {
  const rows = parseCsv(csv);
  const [header, ...body] = rows;
  if (header === undefined) return { ok: false, problems: [{ row: 1, message: "The file is empty." }] };
  if (body.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      problems: [{ row: 1, message: `At most ${MAX_IMPORT_ROWS} questions per import; split the file.` }],
    };
  }

  const columns = header.map((h) => h.trim().toLowerCase());
  for (const required of ["kind", "question"]) {
    if (!columns.includes(required)) {
      return { ok: false, problems: [{ row: 1, message: `The header row needs a "${required}" column.` }] };
    }
  }

  const problems: ImportProblem[] = [];
  const drafts: BankDraft[] = [];

  body.forEach((cells, index) => {
    const rowNumber = index + 2;
    const cell = (name: string): string => (cells[columns.indexOf(name)] ?? "").trim();
    const built = draftFrom(
      {
        kind: cell("kind"),
        question: cell("question"),
        options: split(cell("options")),
        answer: cell("answer"),
        tolerance: cell("tolerance"),
        marks: cell("marks"),
        rubric: cell("rubric"),
        topic: cell("topic"),
        difficulty: cell("difficulty"),
        tags: cell("tags"),
      },
      `row-${rowNumber}`,
    );
    if ("problems" in built) for (const message of built.problems) problems.push({ row: rowNumber, message });
    else drafts.push(built.draft);
  });

  return problems.length > 0 ? { ok: false, problems } : { ok: true, drafts };
}

/** One question's fields as written, whatever the file they came from. */
export interface QuestionFields {
  readonly kind: string;
  readonly question: string;
  readonly options: readonly string[];
  /** mcq: a letter, number or the option's text; numeric: the value; short: expected points separated by | */
  readonly answer: string;
  readonly tolerance: string;
  readonly marks: string;
  /** short: criteria separated by | */
  readonly rubric: string;
  readonly topic: string;
  readonly difficulty: string;
  /** separated by | or , */
  readonly tags: string;
}

/** A bank draft from one question's fields, or every reason it cannot be one. */
export function draftFrom(fields: QuestionFields, idHint: string): { readonly draft: BankDraft } | { readonly problems: readonly string[] } {
  const kind = fields.kind.trim().toLowerCase();
  const stem = fields.question.trim();
  const marksText = fields.marks.trim();
  const maxScore = marksText === "" ? 1 : Number(marksText);
  const difficultyText = fields.difficulty.trim().toLowerCase();
  const difficulty = (difficultyText === "" ? "medium" : difficultyText) as Difficulty;
  const fail = (message: string) => ({ problems: [message] });

  if (!DIFFICULTIES.includes(difficulty)) return fail(`Difficulty must be easy, medium or hard, not "${fields.difficulty}".`);
  if (!Number.isFinite(maxScore)) return fail(`Marks must be a number, not "${marksText}".`);

  let question: Question;
  const id = questionId(idHint);
  const answer = fields.answer.trim();
  switch (kind) {
    case "mcq": {
      const options = fields.options.map((o) => o.trim()).filter((o) => o !== "");
      const correctIndex = mcqAnswer(answer, options);
      if (correctIndex === null) {
        return fail(`The answer "${answer}" is not one of the options; use a letter (B), a number (2) or the option's text.`);
      }
      question = { id, kind: "mcq", stem, maxScore, rubric: [], options, correctIndex };
      break;
    }
    case "numeric": {
      const expected = Number(answer);
      const toleranceText = fields.tolerance.trim();
      const tolerance = toleranceText === "" ? 0 : Number(toleranceText);
      if (answer === "" || !Number.isFinite(expected)) return fail(`A numeric question's answer must be a number, not "${answer}".`);
      if (!Number.isFinite(tolerance)) return fail(`Tolerance must be a number, not "${toleranceText}".`);
      question = { id, kind: "numeric", stem, maxScore, rubric: [], expected, tolerance };
      break;
    }
    case "short": {
      const expectedPoints = split(answer);
      const criteria = split(fields.rubric);
      const rubric = (criteria.length > 0 ? criteria : expectedPoints).map((description, i) => ({
        id: `c${i + 1}`,
        description,
        weight: 1,
      }));
      question = { id, kind: "short", stem, maxScore, rubric, expectedPoints };
      break;
    }
    case "code":
      return fail("Code questions carry test cases; write them in the console rather than a file.");
    default:
      return fail(`Kind must be mcq, numeric or short, not "${fields.kind}".`);
  }

  const invalid = validateQuestion(question, "");
  if (invalid.length > 0) return { problems: invalid.map((p) => p.message) };

  const { id: _, ...withoutId } = question;
  return { draft: { question: withoutId, topic: fields.topic.trim(), difficulty, tags: split(fields.tags, /[|,]/) } };
}

/** An mcq answer as a letter, a 1-based number, or the option's own text. */
function mcqAnswer(answer: string, options: readonly string[]): number | null {
  if (/^[A-Za-z]$/.test(answer)) {
    const index = answer.toUpperCase().charCodeAt(0) - 65;
    return index < options.length ? index : null;
  }
  if (/^\d+$/.test(answer)) {
    const index = Number(answer) - 1;
    return index >= 0 && index < options.length ? index : null;
  }
  const byText = options.findIndex((o) => o.toLowerCase() === answer.toLowerCase());
  return byText === -1 ? null : byText;
}
