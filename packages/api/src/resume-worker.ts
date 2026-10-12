import { parentPort, workerData } from "node:worker_threads";
import { Unzip, UnzipInflate } from "fflate";
import { getDocumentProxy } from "unpdf";

/**
 * Reading a resume's text, in a worker of its own (docs/HIRE-V2.md §10 S1,
 * F26). A file from the internet may be built to hurt whoever opens it: a zip
 * that inflates to gigabytes, a PDF of five thousand pages. Here it can only
 * hurt this worker, which has a small heap and is stopped from outside when it
 * takes too long. Only packages are imported, so the worker runs from the
 * TypeScript source in tests and from the build in production.
 */

interface Job {
  readonly bytes: Uint8Array;
  readonly type: "pdf" | "docx";
  readonly maxPages: number;
  readonly maxChars: number;
}

type Outcome =
  | { readonly ok: true; readonly text: string; readonly pages: number | null }
  | { readonly ok: false; readonly code: "unsupported" | "too_large" | "encrypted" | "unreadable"; readonly message: string };

// No parameter properties here: Node runs this file under the tests by stripping its types, and they are not just types.
class Refused extends Error {
  readonly code: "unsupported" | "too_large" | "encrypted" | "unreadable";

  constructor(code: "unsupported" | "too_large" | "encrypted" | "unreadable", message: string) {
    super(message);
    this.code = code;
  }
}

/** Only what Word keeps the text in, and its declared type: everything else in the zip is skipped unread. */
const DOCX_LIMITS = { entries: 200, documentBytes: 5_000_000, typesBytes: 200_000 } as const;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, name: string) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });

/**
 * The text of a .docx. The zip is read as a stream and every inflated byte is
 * counted, so a file that lies about its sizes is stopped as soon as it passes
 * the limit, not after it has filled the memory.
 */
function docxText(bytes: Uint8Array, maxChars: number): string {
  const parts: Record<string, Uint8Array[]> = {};
  let entries = 0;
  let refused: Refused | null = null;
  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.onfile = (file) => {
    entries++;
    if (entries > DOCX_LIMITS.entries) refused ??= new Refused("too_large", "This Word file has too many parts to be a resume");
    const limit = file.name === "word/document.xml" ? DOCX_LIMITS.documentBytes : file.name === "[Content_Types].xml" ? DOCX_LIMITS.typesBytes : 0;
    if (limit === 0 || refused !== null) return;
    const chunks: Uint8Array[] = [];
    let size = 0;
    file.ondata = (error, chunk, final) => {
      if (refused !== null) return;
      if (error !== null) {
        refused = new Refused("unreadable", "This Word file is damaged");
        return;
      }
      size += chunk.length;
      if (size > limit) {
        refused = new Refused("too_large", "This Word file is too large to be a resume");
        file.terminate();
        return;
      }
      chunks.push(chunk);
      if (final) parts[file.name] = chunks;
    };
    file.start();
  };
  try {
    unzip.push(bytes, true);
  } catch {
    refused ??= new Refused("unsupported", "This is not a Word (.docx) file");
  }
  if (refused !== null) throw refused;

  const join = (chunks: Uint8Array[] | undefined) => (chunks === undefined ? null : new TextDecoder().decode(Buffer.concat(chunks)));
  const types = join(parts["[Content_Types].xml"]);
  const document = join(parts["word/document.xml"]);
  if (types === null || document === null || !types.includes("wordprocessingml.document.main+xml")) {
    throw new Refused("unsupported", "This is not a Word (.docx) file. Save it as .docx or PDF");
  }
  if (/macroEnabled/i.test(types)) throw new Refused("unsupported", "Word files with macros (.docm) are not taken. Save it as .docx or PDF");

  let text = "";
  for (const [, body = ""] of document.matchAll(/<w:p\b[^>]*?(?:\/>|>([\s\S]*?)<\/w:p>)/g)) {
    let line = "";
    for (const [token, content] of body.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\b[^>]*\/>/g)) {
      line += token.startsWith("<w:tab") ? "\t" : token.startsWith("<w:br") ? "\n" : decode(content ?? "");
    }
    text += `${line}\n`;
    if (text.length > maxChars) break;
  }
  return text;
}

/** The text of the first pages of a PDF. One that needs a password, or is encrypted at all, is refused. */
async function pdfText(bytes: Uint8Array, maxPages: number, maxChars: number): Promise<{ text: string; pages: number }> {
  let doc: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    // unpdf's build of PDF.js has no eval path to turn off (S1's isEvalSupported): fonts are never compiled to code.
    doc = await getDocumentProxy(bytes, { stopAtErrors: false });
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException") throw new Refused("encrypted", "This PDF has a password. Save it without one");
    throw new Refused("unreadable", "This PDF could not be read. Save it again, or as .docx");
  }
  // No doc.destroy(): this build has none, and the worker is stopped as soon as it answers.
  const { info } = await doc.getMetadata();
  if ((info as { EncryptFilterName?: unknown } | undefined)?.EncryptFilterName != null) {
    throw new Refused("encrypted", "This PDF is encrypted. Save it without protection");
  }
  const pages = Math.min(doc.numPages, maxPages);
  let text = "";
  for (let n = 1; n <= pages && text.length <= maxChars; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    for (const item of content.items) {
      if ("str" in item) text += item.str + (item.hasEOL ? "\n" : "");
    }
    text += "\n";
  }
  return { text, pages: doc.numPages };
}

async function run(job: Job): Promise<Outcome> {
  try {
    if (job.type === "pdf") {
      const { text, pages } = await pdfText(job.bytes, job.maxPages, job.maxChars);
      return { ok: true, text, pages };
    }
    return { ok: true, text: docxText(job.bytes, job.maxChars), pages: null };
  } catch (error) {
    if (error instanceof Refused) return { ok: false, code: error.code, message: error.message };
    return { ok: false, code: "unreadable", message: "This file could not be read. Save it again as PDF or .docx" };
  }
}

parentPort?.postMessage(await run(workerData as Job));
