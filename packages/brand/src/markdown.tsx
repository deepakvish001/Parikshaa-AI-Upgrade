import { Fragment, type ReactNode } from "react";

/**
 * Markdown for problem statements, as React elements.
 *
 * A statement is written by an examiner and read by every candidate, so it
 * never becomes HTML: each piece is built as an element, and anything that is
 * not recognised stays text. What is recognised is what problem statements
 * use: paragraphs, headings, lists, code (inline and fenced), bold, italic,
 * links to http(s) addresses, and powers — `10^5` and `10^-9` — which every
 * constraint has.
 */

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "code"; language: string; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "rule" }
  | { kind: "paragraph"; text: string };

function blocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "") {
      i++;
      continue;
    }
    const fence = /^\s*(```|~~~)\s*([\w+-]*)\s*$/.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith(fence[1]!)) body.push(lines[i++]!);
      i++;
      out.push({ kind: "code", language: fence[2] ?? "", text: body.join("\n") });
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      out.push({ kind: "heading", level: heading[1]!.length, text: heading[2]!.trim() });
      i++;
      continue;
    }
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
      out.push({ kind: "rule" });
      i++;
      continue;
    }
    const bullet = /^\s*([-*+]|\d+[.)])\s+/;
    if (bullet.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: string[] = [];
      while (i < lines.length && bullet.test(lines[i]!)) {
        let item = lines[i]!.replace(bullet, "");
        i++;
        // Continuation lines, indented, belong to the item.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]!) && !bullet.test(lines[i]!)) item += ` ${lines[i++]!.trim()}`;
        items.push(item);
      }
      out.push({ kind: "list", ordered, items });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i]!)) quoted.push(lines[i++]!.replace(/^\s*>\s?/, ""));
      out.push({ kind: "quote", text: quoted.join(" ") });
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "" && !/^\s*(```|~~~|#{1,4}\s|>)/.test(lines[i]!) && !bullet.test(lines[i]!)) {
      paragraph.push(lines[i++]!.trim());
    }
    out.push({ kind: "paragraph", text: paragraph.join(" ") });
  }
  return out;
}

const SAFE_LINK = /^https?:\/\//i;

/**
 * Inside code, only a number to a numeric power is read — `10^4`, `2^31`,
 * `10^-9` — because that is how every constraint is written, and nothing else
 * in a code span is touched.
 */
function powers(code: string, key: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const match of code.matchAll(/(\d)\^(-?\d+)/g)) {
    const at = (match.index ?? 0) + 1;
    parts.push(code.slice(last, at));
    parts.push(<sup key={`${key}-p${n++}`}>{match[2]}</sup>);
    last = at + 1 + match[2]!.length;
  }
  parts.push(code.slice(last));
  return parts;
}

/** Inline Markdown: code first, so nothing inside a code span is read as anything else. */
export function inline(text: string, key = "i"): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`+)([\s\S]*?[^`])\1(?!`)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|(?<![\w])_([^_\s][^_]*)_(?![\w])|\[([^\]]+)\]\(([^)\s]+)\)|(\S+?)\^(\(-?[\w.]+\)|-?\w+(?:\.\d+)?)/g;
  let last = 0;
  let n = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) nodes.push(text.slice(last, at));
    const k = `${key}-${n++}`;
    const [, , code, strong1, strong2, em1, em2, label, href, base, power] = match;
    if (code !== undefined) nodes.push(<code key={k}>{powers(code.trim() === "" ? code : code.replace(/^ (.*) $/, "$1"), k)}</code>);
    else if (strong1 !== undefined || strong2 !== undefined) nodes.push(<strong key={k}>{inline(strong1 ?? strong2!, k)}</strong>);
    else if (em1 !== undefined || em2 !== undefined) nodes.push(<em key={k}>{inline(em1 ?? em2!, k)}</em>);
    else if (label !== undefined && href !== undefined) {
      nodes.push(
        SAFE_LINK.test(href) ? (
          <a key={k} href={href} target="_blank" rel="noopener noreferrer">
            {inline(label, k)}
          </a>
        ) : (
          label
        ),
      );
    } else if (base !== undefined && power !== undefined) {
      nodes.push(
        <Fragment key={k}>
          {base}
          <sup>{power.replace(/^\((.*)\)$/, "$1")}</sup>
        </Fragment>,
      );
    }
    last = at + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ source, className }: { readonly source: string; readonly className?: string }) {
  return (
    <div className={className === undefined ? "markdown" : `markdown ${className}`}>
      {blocks(source).map((block, i) => {
        const key = `b${i}`;
        switch (block.kind) {
          case "heading": {
            // Inside a question, a statement's own headings sit below the page's.
            const Tag = (["h3", "h4", "h5", "h6"] as const)[block.level - 1]!;
            return <Tag key={key}>{inline(block.text, key)}</Tag>;
          }
          case "code":
            return (
              <pre key={key} className="md-code" data-language={block.language || undefined}>
                <code>{block.text}</code>
              </pre>
            );
          case "list": {
            const items = block.items.map((item, j) => <li key={`${key}-${j}`}>{inline(item, `${key}-${j}`)}</li>);
            return block.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>;
          }
          case "quote":
            return <blockquote key={key}>{inline(block.text, key)}</blockquote>;
          case "rule":
            return <hr key={key} />;
          case "paragraph":
            return <p key={key}>{inline(block.text, key)}</p>;
        }
      })}
    </div>
  );
}
