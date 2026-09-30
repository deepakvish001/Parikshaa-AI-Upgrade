/**
 * A small PDF writer: A4 pages of Helvetica text, lines and filled boxes —
 * enough for a scorecard, and nothing to install. Text is WinAnsi, which
 * covers English and the punctuation Indian institutions' names use; any
 * other character is written as "?" rather than breaking the file.
 */

export const A4 = { width: 595.28, height: 841.89 } as const;

/** Helvetica's advance widths for ASCII 32–126, in thousandths of the size (Adobe's AFM). */
const WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

/** Characters outside ASCII that WinAnsi has, by their byte. */
const WIN_ANSI: Record<string, number> = { "—": 0x97, "–": 0x96, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "…": 0x85, "₹": 0x3f, "·": 0xb7, "é": 0xe9, "ü": 0xfc, "×": 0xd7 };

const byteOf = (c: string): number => {
  const code = c.charCodeAt(0);
  if (code >= 32 && code <= 126) return code;
  return WIN_ANSI[c] ?? 0x3f;
};

/** How wide `text` is at `size`, in points; bold is about five per cent wider. */
export function textWidth(text: string, size: number, bold = false): number {
  let units = 0;
  for (const c of text) {
    const b = byteOf(c);
    units += b >= 32 && b <= 126 ? WIDTHS[b - 32]! : 556;
  }
  return (units * size * (bold ? 1.05 : 1)) / 1000;
}

/** `text` cut to fit `width`, ending in an ellipsis when cut. */
export function fit(text: string, width: number, size: number, bold = false): string {
  if (textWidth(text, size, bold) <= width) return text;
  let cut = text;
  while (cut.length > 0 && textWidth(`${cut}…`, size, bold) > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/** `text` broken into lines no wider than `width`. */
export function wrap(text: string, width: number, size: number, bold = false): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter((w) => w !== "")) {
    const next = line === "" ? word : `${line} ${word}`;
    if (line !== "" && textWidth(next, size, bold) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line !== "") lines.push(line);
  return lines;
}

const literal = (text: string): string => {
  let out = "(";
  for (const c of text) {
    const b = byteOf(c);
    if (b === 0x28 || b === 0x29 || b === 0x5c) out += `\\${String.fromCharCode(b)}`;
    else if (b < 128) out += String.fromCharCode(b);
    else out += `\\${b.toString(8).padStart(3, "0")}`;
  }
  return `${out})`;
};

const n = (value: number) => (Math.round(value * 100) / 100).toString();

export type Rgb = readonly [number, number, number];

/** One page, drawn with y measured from the top, as a layout is thought about. */
export class Page {
  readonly #ops: string[] = [];

  text(x: number, top: number, text: string, options: { size?: number; bold?: boolean; color?: Rgb; align?: "left" | "right" | "center" } = {}): this {
    const size = options.size ?? 10;
    const bold = options.bold ?? false;
    const width = textWidth(text, size, bold);
    const left = options.align === "right" ? x - width : options.align === "center" ? x - width / 2 : x;
    const [r, g, b] = options.color ?? [0.07, 0.09, 0.15];
    this.#ops.push(`BT ${n(r)} ${n(g)} ${n(b)} rg /${bold ? "F2" : "F1"} ${n(size)} Tf ${n(left)} ${n(A4.height - top - size)} Td ${literal(text)} Tj ET`);
    return this;
  }

  box(x: number, top: number, width: number, height: number, color: Rgb): this {
    this.#ops.push(`${n(color[0])} ${n(color[1])} ${n(color[2])} rg ${n(x)} ${n(A4.height - top - height)} ${n(width)} ${n(height)} re f`);
    return this;
  }

  line(x1: number, top1: number, x2: number, top2: number, color: Rgb = [0.85, 0.87, 0.9], width = 0.75): this {
    this.#ops.push(`${n(color[0])} ${n(color[1])} ${n(color[2])} RG ${n(width)} w ${n(x1)} ${n(A4.height - top1)} m ${n(x2)} ${n(A4.height - top2)} l S`);
    return this;
  }

  /** A square grid of dark modules, such as a QR code: `dark(row, column)`. */
  modules(x: number, top: number, size: number, count: number, dark: (row: number, column: number) => boolean): this {
    const cell = size / count;
    const rects: string[] = [];
    for (let row = 0; row < count; row++) {
      for (let column = 0; column < count; column++) {
        if (dark(row, column)) rects.push(`${n(x + column * cell)} ${n(A4.height - top - (row + 1) * cell)} ${n(cell)} ${n(cell)} re`);
      }
    }
    this.#ops.push(`0 0 0 rg ${rects.join(" ")} f`);
    return this;
  }

  get content(): string {
    return this.#ops.join("\n");
  }
}

/** The document: its pages, and a title for the viewer's window. */
export function pdf(pages: readonly Page[], title: string): Uint8Array {
  const objects: string[] = [];
  // An object's number is its place, from one.
  const add = (body: string) => objects.push(body);
  const catalog = add("");
  const tree = add("");
  const regular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const bold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const kids = pages.map((page) => {
    const stream = page.content;
    const content = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    return add(`<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${n(A4.width)} ${n(A4.height)}] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${content} 0 R >>`);
  });
  objects[tree - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  const info = add(`<< /Title ${literal(title)} /Producer (Parikshaa) >>`);
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R >>`;

  let body = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(body, "latin1"));
}
