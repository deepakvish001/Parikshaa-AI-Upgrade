import { strToU8, zipSync } from "fflate";

/**
 * A minimal, valid Word document — enough for Word and LibreOffice to open —
 * for tests and the sample paper. Each paragraph is text, optionally an item
 * of a numbered list at a level, or holding a picture.
 */
export type DocxParagraph = string | { readonly text: string; readonly list?: number; readonly picture?: boolean; readonly bold?: boolean };

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function docxOf(paragraphs: readonly DocxParagraph[]): Uint8Array {
  const body = paragraphs
    .map((p) => {
      const { text, list, picture, bold } = typeof p === "string" ? { text: p, list: undefined, picture: false, bold: false } : p;
      const numbering = list === undefined ? "" : `<w:pPr><w:numPr><w:ilvl w:val="${list}"/><w:numId w:val="1"/></w:numPr></w:pPr>`;
      // Split runs, as Word does mid-word, so the reader must join them.
      const half = Math.floor(text.length / 2);
      const run = (t: string) => `<w:r>${bold === true ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${escape(t)}</w:t></w:r>`;
      const drawing = picture === true ? "<w:r><w:drawing><wp:inline/></w:drawing></w:r>" : "";
      return `<w:p>${numbering}${run(text.slice(0, half))}${drawing}${run(text.slice(half))}</w:p>`;
    })
    .join("");
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}<w:sectPr/></w:body></w:document>`;
  return zipSync({
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    ),
    "word/document.xml": strToU8(document),
  });
}
