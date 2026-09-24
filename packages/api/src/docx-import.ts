import { unzipSync } from "fflate";
import { createHash } from "node:crypto";
import type { Passage, QuestionImage } from "@parikshaa/core";
import { imageMimeOf, MAX_IMAGE_BYTES, type BankDraft } from "@parikshaa/store";
import { draftFrom, MAX_IMPORT_ROWS, split, type QuestionFields } from "./bank-import.js";

/**
 * Importing questions from a Word document (ROADMAP §3).
 *
 * Teachers write question papers in Word, not spreadsheets. This reads a
 * .docx written the way a paper is usually typed:
 *
 *   1. Which sorting algorithm is stable?
 *   a) Heap sort
 *   b) Merge sort
 *   c) Quick sort
 *   Answer: b
 *   Marks: 2
 *   Topic: Sorting
 *
 *   2. Explain why binary search terminates.
 *   Answer: the interval halves each step | it becomes empty
 *   Marks: 5
 *
 * A question starts at a numbered line ("1.", "1)", "Q1.", "Q.1", or an item
 * of Word's own numbered list); lines after it, until the options or the
 * fields, continue its text. Options are lettered ("a)", "(a)", "A.", or the
 * second level of a numbered list); the right one is named on the Answer line,
 * or marked with a leading "*". Fields — Answer (or Ans), Marks, Topic,
 * Difficulty, Tags, Type, Tolerance, Rubric — are "Name: value" lines.
 *
 * The kind is read from the shape: options make it mcq; otherwise a numeric
 * answer makes it numeric and anything else short. "Type: short" overrides
 * that, for a question whose expected answer happens to be a number. Anything
 * before the first question — a title, instructions — is not a question and is
 * skipped, as are "Section B" headings between questions; any other line after
 * a question's options and fields is reported, as it is most likely a typo. Pictures and equations are not imported; a question that had one
 * is named, so it can be finished in the console.
 *
 * All or nothing, like the CSV import: every problem is reported with which
 * question it is, counting from the top, and the number written on it.
 */

export interface DocxProblem {
  /**
   * Which question, counting from the top of the document: 1 for the first.
   * Not the number written on it, which may restart in each section of a
   * paper. 0 for the file as a whole.
   */
  readonly question: number;
  /** The number written on it, when there is one. */
  readonly written: number | null;
  readonly message: string;
}

export interface DocxPreview {
  /** Counting from the top of the document, as in {@link DocxProblem}. */
  readonly question: number;
  readonly kind: string;
  readonly stem: string;
  readonly marks: number;
  /** Pictures taken with it, from the question and its passage. */
  readonly pictures: number;
  /** The passage it is about, by its title or first words; null for none. */
  readonly passage: string | null;
  /** Something in the question that was not imported, such as an equation. */
  readonly note: string | null;
}

export type DocxImportResult =
  | {
      readonly ok: true;
      readonly drafts: readonly BankDraft[];
      readonly preview: readonly DocxPreview[];
      /** The pictures the drafts name, by SHA-256, to be stored before the drafts are. */
      readonly pictures: ReadonlyMap<string, Uint8Array>;
    }
  | { readonly ok: false; readonly problems: readonly DocxProblem[] };

/** The document XML may inflate to at most this; a real paper is a small fraction of it. */
const MAX_XML_BYTES = 30_000_000;

export interface Picture {
  readonly bytes: Uint8Array;
  /** Word's description of the picture, if its author gave one. */
  readonly alt: string | null;
}

export interface Paragraph {
  readonly text: string;
  /** The level in a Word numbered list, or null for an ordinary paragraph. */
  readonly listLevel: number | null;
  /** Pictures in it that can be taken: PNG, JPEG, GIF or WebP, embedded in the file. */
  readonly pictures: readonly Picture[];
  /** It held something that cannot be: an equation, a chart, a linked or drawn picture. */
  readonly hadObject: boolean;
}

export class NotADocx extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotADocx";
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, name: string) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });

/** The paragraphs of a .docx, in order, as plain text. */
export function paragraphsOf(file: Uint8Array): readonly Paragraph[] {
  let files: Record<string, Uint8Array>;
  try {
    let unpacked = 0;
    files = unzipSync(file, {
      filter: (entry) => {
        const wanted = entry.name === "word/document.xml" || entry.name === "word/_rels/document.xml.rels" || entry.name.startsWith("word/media/");
        if (!wanted) return false;
        unpacked += entry.originalSize;
        if (entry.originalSize > MAX_XML_BYTES || unpacked > 2 * MAX_XML_BYTES) {
          throw new NotADocx("The document is too large to import; split it into several files.");
        }
        return true;
      },
    });
  } catch (error) {
    if (error instanceof NotADocx) throw error;
    throw new NotADocx("This is not a Word (.docx) file. Save it from Word as .docx — an older .doc file cannot be read.");
  }
  const xml = files["word/document.xml"];
  if (xml === undefined) throw new NotADocx("This is not a Word (.docx) file: it has no document inside.");
  const source = new TextDecoder().decode(xml);

  // Pictures are referred to by relationship id; the relationships say which file in word/media each is.
  const rels = new Map<string, string>();
  const relsXml = files["word/_rels/document.xml.rels"];
  if (relsXml !== undefined) {
    for (const [, id, target] of new TextDecoder().decode(relsXml).matchAll(/<Relationship\b[^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"/g)) {
      rels.set(id!, `word/${target!.replace(/^\.?\//, "")}`);
    }
  }
  const picturesIn = (xml: string): { pictures: Picture[]; unusable: boolean } => {
    const pictures: Picture[] = [];
    let unusable = false;
    for (const [drawing] of xml.matchAll(/<w:drawing\b[\s\S]*?<\/w:drawing>/g)) {
      const embed = drawing.match(/r:embed="([^"]+)"/)?.[1];
      const bytes = embed === undefined ? undefined : files[rels.get(embed) ?? ""];
      if (bytes === undefined || bytes.length > MAX_IMAGE_BYTES || imageMimeOf(bytes) === null) {
        unusable = true;
        continue;
      }
      const descr = drawing.match(/<wp:docPr\b[^>]*?descr="([^"]*)"/)?.[1];
      pictures.push({ bytes, alt: descr === undefined || descr.trim() === "" ? null : decode(descr).trim() });
    }
    return { pictures, unusable };
  };

  const paragraphs: Paragraph[] = [];
  for (const [, body = ""] of source.matchAll(/<w:p\b[^>]*?(?:\/>|>([\s\S]*?)<\/w:p>)/g)) {
    // Deleted text in tracked changes is not part of the document as it reads.
    const kept = body.replace(/<w:del\b[\s\S]*?<\/w:del>/g, "");
    let text = "";
    for (const [token, content] of kept.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\b[^>]*\/>/g)) {
      if (token.startsWith("<w:tab")) text += "\t";
      else if (token.startsWith("<w:br")) text += "\n";
      else text += decode(content ?? "");
    }
    // Numbered by the paragraph itself (Word's numbering button), or by a
    // "List Number" style, whose numbering lives in the style instead.
    const style = kept.match(/<w:pStyle w:val="ListNumber(\d)?"/);
    const level =
      kept.match(/<w:numPr>[\s\S]*?<w:ilvl w:val="(\d+)"/)?.[1] ??
      (/<w:numPr>/.test(kept) ? "0" : style === null ? null : String(Number(style[1] ?? "1") - 1));
    const { pictures, unusable } = picturesIn(kept);
    paragraphs.push({
      text: text.replace(/\u00a0/g, " "),
      listLevel: level === null ? null : Number(level),
      pictures,
      hadObject: unusable || /<w:pict\b|<m:oMath\b|<w:object\b/.test(kept),
    });
  }
  return paragraphs;
}

// "1." needs a space after it, so "3.14 is…" continuing a question is not question 3.
const QUESTION = /^\s*(?:Q(?:uestion|\.)?\s*\.?\s*)?(\d{1,4})\s*(?:[):]|\.(?=\s|$))\s*(.*)$/i;
const OPTION = /^\s*(\*?)\s*\(?([a-h])[.)]\s+(.*)$/i;
const FIELD =
  /^\s*(correct\s+answers?|answers?|ans|marks?|topic|difficulty|tags|type|kind|tolerance|rubric|negative(?:\s+marks?)?|partial(?:\s+credit)?)(?:\s*:|\s+[-–]\s)\s*(.*)$/i;
const HEADING = /^(section|part|unit|group)\s+[\w-]+\b/i;
// "Passage:", "Passage 2: The monsoon", "Comprehension:", "Read the passage below:"
const PASSAGE = /^\s*(?:passage|comprehension|read the (?:following )?passage(?: below)?)(?:\s+\d+)?\s*[:.–-]\s*(.*)$/i;
const PASSAGE_END = /^\s*end\s+(?:of\s+)?(?:the\s+)?passage\s*\.?$/i;
const FIELD_NAMES: Record<string, keyof Block["fields"]> = {
  "correct answer": "answer",
  "correct answers": "answer",
  answer: "answer",
  answers: "answer",
  ans: "answer",
  mark: "marks",
  marks: "marks",
  topic: "topic",
  difficulty: "difficulty",
  tags: "tags",
  type: "type",
  kind: "type",
  tolerance: "tolerance",
  rubric: "rubric",
  negative: "negative",
  "negative mark": "negative",
  "negative marks": "negative",
  partial: "partial",
  "partial credit": "partial",
};

interface PassageDraft {
  readonly number: number;
  readonly title: string | null;
  readonly lines: string[];
  readonly pictures: Picture[];
}

interface Block {
  /** As written; null for an item of Word's numbered list, whose number is not in the text. */
  written: number | null;
  stem: string[];
  options: { text: string; marked: boolean }[];
  fields: {
    answer: string;
    marks: string;
    topic: string;
    difficulty: string;
    tags: string;
    type: string;
    tolerance: string;
    rubric: string;
    negative: string;
    partial: string;
  };
  pictures: Picture[];
  passage: PassageDraft | null;
  hadObject: boolean;
  /** Text after the options or fields that is not one of them: most likely a typo worth reporting. */
  stray: string[];
}

const blank = (written: number | null, first: string, p: Paragraph, passage: PassageDraft | null): Block => ({
  written,
  stem: first.trim() === "" ? [] : [first.trim()],
  options: [],
  fields: { answer: "", marks: "", topic: "", difficulty: "", tags: "", type: "", tolerance: "", rubric: "", negative: "", partial: "" },
  pictures: [...p.pictures],
  passage,
  hadObject: p.hadObject,
  stray: [],
});

/** Group paragraphs into questions. */
export function blocksOf(paragraphs: readonly Paragraph[]): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  // The passage the next questions are about, and whether its text is still being read.
  let passage: PassageDraft | null = null;
  let readingPassage = false;
  let passages = 0;

  for (const p of paragraphs) {
    const lines = p.text.split("\n").map((l) => l.replace(/\t/g, " ").trim());
    // A paragraph that is only a picture belongs to what is being read.
    if (lines.every((l) => l === "") && p.pictures.length > 0) {
      if (readingPassage && passage !== null) passage.pictures.push(...p.pictures);
      else if (current !== null) current.pictures.push(...p.pictures);
    }
    for (const line of lines) {
      if (line === "") continue;

      const passageStart = line.match(PASSAGE);
      if (passageStart !== null && QUESTION.exec(line) === null) {
        passages++;
        const title = passageStart[1]!.trim();
        passage = { number: passages, title: title === "" ? null : title, lines: [], pictures: [...p.pictures] };
        readingPassage = true;
        current = null;
        continue;
      }
      if (PASSAGE_END.test(line)) {
        passage = null;
        readingPassage = false;
        current = null;
        continue;
      }
      if (readingPassage && passage !== null && QUESTION.exec(line) === null && !(p.listLevel === 0)) {
        passage.lines.push(line);
        if (p.pictures.length > 0 && !passage.pictures.includes(p.pictures[0]!)) passage.pictures.push(...p.pictures);
        continue;
      }
      if (HEADING.test(line) && (current === null || current.options.length > 0 || Object.values(current.fields).some((v) => v !== ""))) {
        // A new section of the paper: whatever passage came before is behind it.
        passage = null;
        readingPassage = false;
        if (current !== null) continue;
      }

      const field = line.match(FIELD);
      if (field !== null && current !== null) {
        current.fields[FIELD_NAMES[field[1]!.toLowerCase().replace(/\s+/g, " ")]!] = field[2]!.trim();
        continue;
      }
      // Word's own numbered list: the number is not in the text.
      if (p.listLevel === 0 && QUESTION.exec(line) === null) {
        readingPassage = false;
        current = blank(null, line, p, passage);
        blocks.push(current);
        continue;
      }
      if (p.listLevel !== null && p.listLevel > 0 && current !== null && OPTION.exec(line) === null) {
        const marked = line.startsWith("*");
        current.options.push({ text: marked ? line.slice(1).trim() : line, marked });
        continue;
      }
      const question = line.match(QUESTION);
      if (question !== null) {
        readingPassage = false;
        current = blank(Number(question[1]), question[2]!, p, passage);
        blocks.push(current);
        continue;
      }
      if (current === null) continue; // a title or instructions, before the first question
      current.hadObject ||= p.hadObject;
      for (const picture of p.pictures) if (!current.pictures.includes(picture)) current.pictures.push(picture);
      const option = line.match(OPTION);
      if (option !== null) {
        current.options.push({ text: option[3]!.trim(), marked: option[1] === "*" });
        continue;
      }
      const f = current.fields;
      const started = current.options.length > 0 || Object.values(f).some((v) => v !== "");
      if (!started) current.stem.push(line);
      // A paper's own headings between questions are not questions, and not mistakes.
      else if (!HEADING.test(line)) current.stray.push(line);
    }
  }
  return blocks;
}

export function importDocx(file: Uint8Array): DocxImportResult {
  let paragraphs: readonly Paragraph[];
  try {
    paragraphs = paragraphsOf(file);
  } catch (error) {
    if (error instanceof NotADocx) return { ok: false, problems: [{ question: 0, written: null, message: error.message }] };
    throw error;
  }
  const blocks = blocksOf(paragraphs);
  if (blocks.length === 0) {
    return {
      ok: false,
      problems: [{ question: 0, written: null, message: 'No questions found. Number each question ("1.", "2.") and letter its options ("a)", "b)").' }],
    };
  }
  if (blocks.length > MAX_IMPORT_ROWS) {
    return { ok: false, problems: [{ question: 0, written: null, message: `At most ${MAX_IMPORT_ROWS} questions per import; split the document.` }] };
  }

  const problems: DocxProblem[] = [];
  const drafts: BankDraft[] = [];
  const preview: DocxPreview[] = [];
  const pictures = new Map<string, Uint8Array>();
  const keep = (picture: Picture, fallbackAlt: string): QuestionImage => {
    const media = createHash("sha256").update(picture.bytes).digest("hex");
    pictures.set(media, picture.bytes);
    return { media, alt: picture.alt ?? fallbackAlt };
  };
  const passageOf = (draft: PassageDraft): Passage => ({
    id: `docx-passage-${draft.number}`,
    ...(draft.title === null ? {} : { title: draft.title }),
    text: draft.lines.join("\n"),
    ...(draft.pictures.length === 0 ? {} : { images: draft.pictures.map((p, i) => keep(p, `Figure ${i + 1} for passage ${draft.number}`)) }),
  });
  blocks.forEach((block, index) => {
    const position = index + 1;
    const fail = (message: string) => problems.push({ question: position, written: block.written, message });
    if (block.stem.length === 0) fail("The question has no text.");
    for (const line of block.stray) fail(`"${line.slice(0, 60)}" comes after the options, and is neither an option nor a field such as "Answer:".`);

    const marked = block.options.flatMap((o, i) => (o.marked ? [i] : []));
    const f = block.fields;
    // Several options marked with * are several right ones.
    const answer = f.answer !== "" ? f.answer : marked.map((i) => String(i + 1)).join(", ");
    if (answer === "") {
      fail('No answer: add an "Answer:" line' + (block.options.length > 0 ? ", or mark the right option with *." : "."));
      return;
    }
    const kind =
      f.type !== ""
        ? f.type.toLowerCase().replace(/^(multiple choice|mcq|objective)$/, "mcq").replace(/^(short answer|subjective|descriptive)$/, "short")
        : block.options.length > 0
          ? "mcq"
          : /^-?\d+(\.\d+)?$/.test(answer)
            ? "numeric"
            : "short";

    const fields: QuestionFields = {
      kind,
      question: block.stem.join("\n"),
      options: block.options.map((o) => o.text),
      answer: kind === "short" ? split(answer, /[|;]/).join("|") : answer,
      tolerance: f.tolerance,
      marks: f.marks.replace(/\s*marks?$/i, ""),
      rubric: split(f.rubric, /[|;]/).join("|"),
      topic: f.topic,
      difficulty: f.difficulty,
      tags: f.tags,
      negative: f.negative,
      partial: f.partial,
      images: block.pictures.map((p, i) => keep(p, `Figure ${i + 1} for question ${position}`)),
      ...(block.passage === null ? {} : { passage: passageOf(block.passage) }),
    };
    if (block.passage !== null && block.passage.lines.length === 0) fail("The passage before this question has no text.");
    const built = draftFrom(fields, `docx-${position}`);
    if ("problems" in built) {
      for (const message of built.problems) fail(message);
      return;
    }
    drafts.push(built.draft);
    preview.push({
      question: position,
      kind,
      stem: fields.question,
      marks: built.draft.question.maxScore,
      pictures: block.pictures.length + (block.passage?.pictures.length ?? 0),
      passage: block.passage === null ? null : (block.passage.title ?? `${block.passage.lines[0]?.slice(0, 48) ?? ""}…`),
      note: block.hadObject
        ? "Had an equation, a chart or a picture that is not PNG, JPEG, GIF or WebP, which was not imported; add it in the console."
        : null,
    });
  });
  return problems.length > 0 ? { ok: false, problems } : { ok: true, drafts, preview, pictures };
}
