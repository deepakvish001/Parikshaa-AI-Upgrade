import { useState, type ReactNode } from "react";
import { ChevronDown, FileText, X } from "lucide-react";
import { usePreferences } from "../i18n.tsx";

/** A question's or passage's pictures, served by their hash. */
export function Figures({ images }: { readonly images: readonly { readonly media: string; readonly alt: string }[] }) {
  if (images.length === 0) return null;
  return (
    <div className="figures-row">
      {images.map((image) => (
        <figure className="figure" key={image.media}>
          <img src={`/api/media/${image.media}`} alt={image.alt} loading="lazy" decoding="async" />
        </figure>
      ))}
    </div>
  );
}

/** A passage, once, above the questions about it. */
export function PassageCard({
  passage,
  from,
  to,
}: {
  readonly passage: { readonly id: string; readonly title?: string; readonly text: string; readonly images: readonly { readonly media: string; readonly alt: string }[] };
  readonly from: number;
  readonly to: number;
}) {
  const { t } = usePreferences();
  return (
    <section className="card passage" aria-labelledby={`passage-${passage.id}`}>
      <p className="eyebrow">
        <FileText aria-hidden="true" />
        {t("passage.eyebrow")} · {from === to ? t("passage.forOne", { n: from }) : t("passage.for", { from, to })}
      </p>
      <h2 id={`passage-${passage.id}`}>{passage.title ?? t("passage.eyebrow")}</h2>
      {passage.text.split(/\n+/).map((para, i) => (
        <p key={i}>{para}</p>
      ))}
      <Figures images={passage.images} />
    </section>
  );
}

export interface PaletteItem {
  readonly id: string;
  readonly number: number;
  readonly answered: boolean;
  /** Typed but not yet saved as an answer. */
  readonly draft: boolean;
  readonly marked: boolean;
  /** Opened at least once. */
  readonly visited: boolean;
}

export type Status = "not-visited" | "not-answered" | "draft" | "answered" | "marked" | "answered-marked";

/** Where a question stands, in words: what a screen reader says for its palette number. */
export function stateLabel(q: PaletteItem, t: ReturnType<typeof usePreferences>["t"]): string {
  return [
    q.answered ? t("palette.answered") : q.draft ? t("palette.draft") : q.visited ? t("palette.notAnswered") : t("palette.notVisited"),
    ...(q.marked ? [t("palette.marked")] : []),
  ].join(", ");
}

/** Where a question stands, as the palette's shapes show it. */
export const statusOf = (q: PaletteItem): Status =>
  q.answered ? (q.marked ? "answered-marked" : "answered") : q.marked ? "marked" : q.draft ? "draft" : q.visited ? "not-answered" : "not-visited";

/**
 * Every question at a glance, as exam halls in India lay them out: not
 * visited, not answered, answered, marked for review, and answered and marked
 * — each with how many, and each in the shape a JEE or NEET candidate already
 * reads without thinking. A number takes the candidate to that question.
 * Beside the paper on a wide screen; a drawer on a phone.
 */
export function Palette({
  questions,
  current,
  onGo,
  footer,
}: {
  readonly questions: readonly PaletteItem[];
  readonly current: string | null;
  readonly onGo: (id: string) => void;
  /** What sits under the grid: the way out of a section, or of the test. */
  readonly footer?: ReactNode;
}) {
  const { t } = usePreferences();
  const [open, setOpen] = useState(false);
  const answered = questions.filter((q) => q.answered).length;
  const marked = questions.filter((q) => q.marked).length;
  const count = (status: Status) => questions.filter((q) => statusOf(q) === status).length;
  const stateOf = (q: PaletteItem) => stateLabel(q, t);
  const legend: readonly [Status, string][] = [
    ["answered", t("palette.answered")],
    ["not-answered", t("palette.notAnswered")],
    ["not-visited", t("palette.notVisited")],
    ["marked", t("palette.marked")],
    ["answered-marked", t("palette.answeredMarked")],
    ["draft", t("palette.draft")],
  ];
  const summary = t("palette.summary", { answered, total: questions.length, marked });

  return (
    <nav className={`palette${open ? " open" : ""}`} aria-label={t("palette.region")}>
      <button type="button" className="palette-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{t("palette.region")}</span>
        <span className="palette-summary">{summary}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {/* On a phone the palette is a sheet over the paper; a tap beside it closes it. */}
      {open ? <div className="sheet-scrim" aria-hidden="true" onClick={() => setOpen(false)} /> : null}
      <div className="palette-body">
        <div className="sheet-head">
          <strong>{t("palette.region")}</strong>
          <span className="palette-summary">{summary}</span>
          <button type="button" className="quiet sheet-close" aria-label={t("tools.close")} onClick={() => setOpen(false)}>
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="palette-head">
          <p className="palette-title">{t("palette.region")}</p>
          <p className="palette-summary">{summary}</p>
          <div className="meter" aria-hidden="true">
            <span style={{ width: `${Math.round((answered / Math.max(1, questions.length)) * 100)}%` }} />
          </div>
        </div>
        <ul className="palette-legend">
          {legend.map(([status, label]) => (
            <li key={status}>
              <span className={`pq ${status}`} aria-hidden="true">
                {count(status)}
              </span>
              <span>
                {label}
                {status === "answered-marked" ? <small> {t("palette.counted")}</small> : null}
              </span>
            </li>
          ))}
        </ul>
        <ol className="palette-grid">
          {questions.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                className={`pq ${statusOf(q)}${q.answered ? " answered" : ""}${q.marked ? " marked" : ""}`}
                aria-label={t("palette.item", { n: q.number, state: stateOf(q) })}
                aria-current={q.id === current ? "step" : undefined}
                onClick={() => {
                  onGo(q.id);
                  setOpen(false);
                }}
              >
                {q.number}
              </button>
            </li>
          ))}
        </ol>
        {footer === undefined ? null : <div className="palette-foot">{footer}</div>}
      </div>
    </nav>
  );
}
