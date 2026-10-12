import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { MAX_RESUME_BYTES, MAX_RESUME_CHARS, ResumeRefused, readResume, sniffResume } from "./resume.js";

/**
 * Reading resumes (docs/HIRE-V2.md §10 S1, F26; H1b): PDF and .docx, told
 * apart by their bytes; files built to hurt are refused or cut short, never
 * allowed to hold the server.
 */

const WORD_TYPES =
  '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';

const docx = (paragraphs: readonly string[], types = WORD_TYPES, extra: Record<string, Uint8Array> = {}) =>
  zipSync({
    "[Content_Types].xml": strToU8(types),
    "word/document.xml": strToU8(`<w:document><w:body>${paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`),
    ...extra,
  });

/** A small, valid PDF with one line of text on each page; optionally under a password. */
function pdf(pages: readonly string[], options: { readonly password?: boolean } = {}): Uint8Array {
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  const kids: string[] = [];
  let id = 4;
  for (const text of pages) {
    const page = id++;
    const content = id++;
    const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
    kids.push(`${page} 0 R`);
    objects[page] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${content} 0 R >>`;
    objects[content] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  }
  objects[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;
  let encrypt = "";
  if (options.password === true) {
    const hex = (byte: string, bytes: number) => `<${byte.repeat(bytes)}>`;
    objects[id] = `<< /Filter /Standard /V 1 /R 2 /O ${hex("ab", 32)} /U ${hex("cd", 32)} /P -4 >>`;
    encrypt = ` /Encrypt ${id} 0 R /ID [${hex("01", 16)} ${hex("01", 16)}]`;
    id++;
  }
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let n = 1; n < id; n++) {
    offsets[n] = body.length;
    body += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }
  const xref = body.length;
  body += `xref\n0 ${id}\n0000000000 65535 f \n`;
  for (let n = 1; n < id; n++) body += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${id} /Root 1 0 R${encrypt} >>\nstartxref\n${xref}\n%%EOF\n`;
  return strToU8(body, true);
}

const refusal = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (error) {
    if (error instanceof ResumeRefused) return error.code;
    throw error;
  }
  return "none";
};

describe("reading a resume", () => {
  it("takes a PDF's text, page by page", async () => {
    const read = await readResume(pdf(["Asha Rao", "Backend engineer, Go and SQL"]));
    expect(read).toEqual({ type: "pdf", text: "Asha Rao\nBackend engineer, Go and SQL", pages: 2 });
  });

  it("takes a Word file's text, paragraph by paragraph", async () => {
    const read = await readResume(docx(["Asha Rao", "Go &amp; SQL", "Pune"]));
    expect(read).toEqual({ type: "docx", text: "Asha Rao\nGo & SQL\nPune", pages: null });
  });

  it("knows a file by its bytes, not its name", () => {
    expect(sniffResume(pdf(["x"]))).toBe("pdf");
    expect(sniffResume(docx(["x"]))).toBe("docx");
    expect(sniffResume(Buffer.from("MZ\x90\x00\x03\x00\x00\x00 a Windows program renamed resume.pdf", "latin1"))).toBeNull();
  });

  it("refuses a program, a Word file with macros, and a zip that is not Word", async () => {
    expect(await refusal(readResume(Buffer.from("MZ\x90\x00\x03\x00 renamed .exe", "latin1")))).toBe("unsupported");
    expect(await refusal(readResume(docx(["x"], WORD_TYPES.replace("document.main+xml", "document.macroEnabled.main+xml"))))).toBe("unsupported");
    expect(await refusal(readResume(zipSync({ "notes.txt": strToU8("hello") })))).toBe("unsupported");
    expect(await refusal(readResume(new Uint8Array()))).toBe("unsupported");
  });

  it("refuses a file over 2 MB before reading it", async () => {
    expect(await refusal(readResume(new Uint8Array(MAX_RESUME_BYTES + 1).fill(0x25)))).toBe("too_large");
  });

  it("stops a zip bomb while it inflates", async () => {
    const bomb = docx([`${"a".repeat(60_000_000)}`]);
    expect(bomb.length).toBeLessThan(MAX_RESUME_BYTES);
    expect(await refusal(readResume(bomb))).toBe("too_large");
  });

  it("stops a zip bomb that lies about its size", async () => {
    const bomb = docx([`${"b".repeat(60_000_000)}`]);
    // Claim 1,000 bytes for every file, in each local header and in the central directory.
    const view = new DataView(bomb.buffer, bomb.byteOffset, bomb.byteLength);
    const end = bomb.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    const count = view.getUint16(end + 10, true);
    let central = view.getUint32(end + 16, true);
    for (let n = 0; n < count; n++) {
      expect(view.getUint32(central, true)).toBe(0x02014b50);
      const local = view.getUint32(central + 42, true);
      expect(view.getUint32(local, true)).toBe(0x04034b50);
      view.setUint32(local + 22, 1000, true);
      view.setUint32(central + 24, 1000, true);
      central += 46 + view.getUint16(central + 28, true) + view.getUint16(central + 30, true) + view.getUint16(central + 32, true);
    }
    expect(await refusal(readResume(bomb))).toBe("too_large");
  });

  it("reads only the first ten pages of a five-thousand-page PDF", async () => {
    const pages = Array.from({ length: 5000 }, (_, i) => `Page ${i + 1}`);
    const started = Date.now();
    const read = await readResume(pdf(pages));
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(read.pages).toBe(5000);
    expect(read.text.split("\n")).toEqual(pages.slice(0, 10));
  });

  it("refuses a PDF with a password", async () => {
    expect(await refusal(readResume(pdf(["Secret"], { password: true })))).toBe("encrypted");
  });

  it("keeps at most 60,000 characters", async () => {
    const read = await readResume(docx(Array.from({ length: 2000 }, (_, i) => `Line ${i} ${"x".repeat(60)}`)));
    expect(read.text.length).toBe(MAX_RESUME_CHARS);
  });

  it("stops reading when it takes too long", async () => {
    expect(await refusal(readResume(pdf(["Asha Rao"]), { timeoutMs: 1 }))).toBe("timeout");
  });

  it("says so when there is no text at all, as in a scan", async () => {
    expect(await refusal(readResume(pdf([""])))).toBe("unreadable");
  });
});
