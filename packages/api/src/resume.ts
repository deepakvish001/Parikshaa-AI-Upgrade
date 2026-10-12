import { Worker } from "node:worker_threads";

/**
 * A resume's text, for the profile and for screening (docs/HIRE-V2.md §1,
 * §10 S1, F26; H1b). PDF and Word (.docx) only, told apart by their bytes, not
 * their names. The reading happens in a worker with a small heap, stopped
 * when it takes too long (resume-worker.ts), so no file can hold or crash the
 * server.
 */

export type ResumeType = "pdf" | "docx";

/** The file itself: 2 MB, which a resume of ten pages fits in with room to spare. */
export const MAX_RESUME_BYTES = 2 * 1024 * 1024;
/** What is read of it: the first ten pages, and at most 60,000 characters. */
export const MAX_RESUME_PAGES = 10;
export const MAX_RESUME_CHARS = 60_000;

export class ResumeRefused extends Error {
  constructor(
    readonly code: "unsupported" | "too_large" | "encrypted" | "unreadable" | "timeout",
    message: string,
  ) {
    super(message);
    this.name = "ResumeRefused";
  }
}

export interface ResumeText {
  readonly type: ResumeType;
  readonly text: string;
  /** A PDF's page count, all of them (only the first ten are read). Null for Word. */
  readonly pages: number | null;
}

/** What a file is, by its first bytes: a PDF, a zip that may be a .docx, or neither. */
export function sniffResume(bytes: Uint8Array): ResumeType | null {
  const head = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  if (head.startsWith("%PDF-")) return "pdf";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "docx";
  return null;
}

/** The worker's own file: the TypeScript source under the tests, the build in production. */
const WORKER = new URL(import.meta.url.endsWith(".ts") ? "./resume-worker.ts" : "./resume-worker.js", import.meta.url);

type Outcome =
  | { readonly ok: true; readonly text: string; readonly pages: number | null }
  | { readonly ok: false; readonly code: "unsupported" | "too_large" | "encrypted" | "unreadable"; readonly message: string };

/** Tidy the text: no control characters, runs of blank space folded, and no more than the limit. */
function tidy(text: string): string {
  return text
    .replace(/[^\S\n]+/g, " ")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_RESUME_CHARS);
}

export async function readResume(bytes: Uint8Array, options: { readonly timeoutMs?: number } = {}): Promise<ResumeText> {
  if (bytes.length === 0) throw new ResumeRefused("unsupported", "The file is empty");
  if (bytes.length > MAX_RESUME_BYTES) throw new ResumeRefused("too_large", "A resume may be at most 2 MB");
  const type = sniffResume(bytes);
  if (type === null) throw new ResumeRefused("unsupported", "Only PDF and Word (.docx) files are taken");

  const worker = new Worker(WORKER, {
    workerData: { bytes, type, maxPages: MAX_RESUME_PAGES, maxChars: MAX_RESUME_CHARS },
    resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
    stdout: true,
    stderr: true,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const outcome = await new Promise<Outcome>((resolve, reject) => {
      timer = setTimeout(() => reject(new ResumeRefused("timeout", "This file took too long to read. Save it again as a simpler PDF or .docx")), options.timeoutMs ?? 10_000);
      worker.once("message", (message: Outcome) => resolve(message));
      worker.once("error", (error) =>
        reject(
          (error as { code?: string }).code === "ERR_WORKER_OUT_OF_MEMORY"
            ? new ResumeRefused("too_large", "This file is too large to read")
            : new ResumeRefused("unreadable", "This file could not be read. Save it again as PDF or .docx"),
        ),
      );
      worker.once("exit", (code) => reject(new ResumeRefused("unreadable", `This file could not be read (${code})`)));
    });
    if (!outcome.ok) throw new ResumeRefused(outcome.code, outcome.message);
    const text = tidy(outcome.text);
    if (text === "") throw new ResumeRefused("unreadable", "No text was found in this file. If it is a scan, save it as text first");
    return { type, text, pages: outcome.pages };
  } finally {
    clearTimeout(timer);
    await worker.terminate();
  }
}
