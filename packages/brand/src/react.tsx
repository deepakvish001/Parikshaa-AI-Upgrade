import { useId } from "react";

/**
 * The Parikshaa mark: प, the first letter of परीक्षा, drawn in white on an
 * ink-indigo tile, with a saffron bindu above its headline. Decorative
 * wherever it appears beside the name, so it is hidden from screen readers;
 * the name is the text next to it.
 */
export function LogoMark({ size = 28, className }: { readonly size?: number; readonly className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`pk-tile-${id}`} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4a5ce0" />
          <stop offset="1" stopColor="#1d2770" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8.5" fill={`url(#pk-tile-${id})`} />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" stroke="#fff" strokeOpacity="0.14" />
      {/* the headline (शिरोरेखा), the stem, and the bowl of प */}
      <path d="M7.5 11h17" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M20.5 11v13.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M11.5 11v4.2c0 2.3 1.6 3.8 4 3.8h5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24.6" cy="6.2" r="2.1" fill="#f28c28" />
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
