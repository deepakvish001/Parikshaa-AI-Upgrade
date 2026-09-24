import { strToU8, zipSync } from "fflate";

/**
 * A minimal, valid Word document — enough for Word and LibreOffice to open —
 * for tests and the sample paper. Each paragraph is text, optionally an item
 * of a numbered list at a level, or holding a picture.
 */
export type DocxParagraph =
  | string
  | {
      readonly text: string;
      readonly list?: number;
      /** true: a drawing with nothing embedded (a chart, a shape); bytes: an embedded picture. */
      readonly picture?: boolean | Uint8Array;
      /** The picture's description, as Word's "Alt Text" sets it. */
      readonly alt?: string;
      readonly bold?: boolean;
    };

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function docxOf(paragraphs: readonly DocxParagraph[]): Uint8Array {
  const media: Record<string, Uint8Array> = {};
  const rels: string[] = [];
  const body = paragraphs
    .map((p) => {
      const { text, list, picture, bold, alt } = typeof p === "string" ? { text: p, list: undefined, picture: false, bold: false, alt: undefined } : p;
      const numbering = list === undefined ? "" : `<w:pPr><w:numPr><w:ilvl w:val="${list}"/><w:numId w:val="1"/></w:numPr></w:pPr>`;
      // Split runs, as Word does mid-word, so the reader must join them.
      const half = Math.floor(text.length / 2);
      const run = (t: string) => `<w:r>${bold === true ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${escape(t)}</w:t></w:r>`;
      let drawing = "";
      if (picture === true) drawing = "<w:r><w:drawing><wp:inline/></w:drawing></w:r>";
      else if (picture instanceof Uint8Array) {
        const n = rels.length + 1;
        media[`word/media/image${n}.png`] = picture;
        rels.push(`<Relationship Id="rIdImg${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${n}.png"/>`);
        const descr = alt === undefined ? "" : ` descr="${escape(alt)}"`;
        drawing = `<w:r><w:drawing><wp:inline><wp:docPr id="${n}" name="Picture ${n}"${descr}/><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="rIdImg${n}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
      }
      return `<w:p>${numbering}${run(text.slice(0, half))}${drawing}${run(text.slice(half))}</w:p>`;
    })
    .join("");
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr/></w:body></w:document>`;
  return zipSync({
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    ),
    "word/document.xml": strToU8(document),
    "word/_rels/document.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`,
    ),
    ...media,
  });
}
