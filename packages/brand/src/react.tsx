/**
 * The Parikshaa mark, logo A "Pass" (docs/learn/DESIGN-SYSTEM.md §2): a white
 * P on a pen-blue tile, whose stem runs into the long stroke of a gold tick:
 * preparation, then a pass. Its colours are the logo's own and do not change
 * with the theme. Decorative wherever it appears beside the name, so it is
 * hidden from screen readers; the name is the text next to it.
 */
export function LogoMark({ size = 28, className }: { readonly size?: number; readonly className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="11" fill="#2349E6" />
      <g strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.4">
        <path d="M16 30.5V9.5h6.2a6.1 6.1 0 0 1 0 12.2H16" stroke="#FFFFFF" />
        <path d="M10.2 25.2 16 30.5" stroke="#FFD84D" />
      </g>
    </svg>
  );
}

/** The mark and the name together, as it appears in a header. */
export function Wordmark({
  size = 28,
  product,
  className,
}: {
  readonly size?: number;
  /** A product name after the brand, such as "Console". */
  readonly product?: string;
  readonly className?: string;
}) {
  return (
    <span className={`brand-mark${className === undefined ? "" : ` ${className}`}`}>
      <LogoMark size={size} />
      <span>
        Parikshaa
        {product === undefined ? null : <span className="brand-product"> {product}</span>}
      </span>
    </span>
  );
}

/** Two letters for a person or organisation, for an avatar. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => w !== "");
  const letters = words.length > 1 ? [words[0]![0], words[words.length - 1]![0]] : [...(words[0] ?? "?").slice(0, 2)];
  return letters.join("").toUpperCase();
}

export function Avatar({ name, size = 32 }: { readonly name: string; readonly size?: number }) {
  return (
    <span className="avatar" aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initialsOf(name)}
    </span>
  );
}
