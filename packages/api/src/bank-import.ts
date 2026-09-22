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

const split = (value: string, on: RegExp = /\|/): string[] =>
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
    const fail = (message: string) => problems.push({ row: rowNumber, message });

    const kind = cell("kind").toLowerCase();
    const stem = cell("question");
    const marksText = cell("marks");
    const maxScore = marksText === "" ? 1 : Number(marksText);
    const difficultyText = cell("difficulty").toLowerCase();
    const difficulty = (difficultyText === "" ? "medium" : difficultyText) as Difficulty;

    if (!DIFFICULTIES.includes(difficulty)) {
      fail(`Difficulty must be easy, medium or hard, not "${cell("difficulty")}".`);
      return;
    }
    if (!Number.isFinite(maxScore)) {
      fail(`Marks must be a number, not "${marksText}".`);
      return;
    }

    let question: Question;
    const id = questionId(`row-${rowNumber}`);
    switch (kind) {
      case "mcq": {
        const options = split(cell("options"));
        const answer = cell("answer");
        const correctIndex = mcqAnswer(answer, options);
        if (correctIndex === null) {
          fail(`The answer "${answer}" is not one of the options; use a letter (B), a number (2) or the option's text.`);
          return;
        }
        question = { id, kind: "mcq", stem, maxScore, rubric: [], options, correctIndex };
        break;
      }
      case "numeric": {
        const expected = Number(cell("answer"));
        const toleranceText = cell("tolerance");
        const tolerance = toleranceText === "" ? 0 : Number(toleranceText);
        if (cell("answer") === "" || !Number.isFinite(expected)) {
          fail(`A numeric question's answer must be a number, not "${cell("answer")}".`);
          return;
        }
        if (!Number.isFinite(tolerance)) {
          fail(`Tolerance must be a number, not "${toleranceText}".`);
          return;
        }
        question = { id, kind: "numeric", stem, maxScore, rubric: [], expected, tolerance };
        break;
      }
      case "short": {
        const expectedPoints = split(cell("answer"));
        const criteria = split(cell("rubric"));
        const rubric = (criteria.length > 0 ? criteria : expectedPoints).map((description, i) => ({
          id: `c${i + 1}`,
          description,
          weight: 1,
        }));
        question = { id, kind: "short", stem, maxScore, rubric, expectedPoints };
        break;
      }
      case "code":
        fail("Code questions carry test cases; write them in the console rather than a spreadsheet.");
        return;
      default:
        fail(`Kind must be mcq, numeric or short, not "${cell("kind")}".`);
        return;
    }

    const invalid = validateQuestion(question, "");
    if (invalid.length > 0) {
      for (const problem of invalid) fail(problem.message);
      return;
    }

    const { id: _, ...withoutId } = question;
    drafts.push({ question: withoutId, topic: cell("topic"), difficulty, tags: split(cell("tags"), /[|,]/) });
  });

  return problems.length > 0 ? { ok: false, problems } : { ok: true, drafts };
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
