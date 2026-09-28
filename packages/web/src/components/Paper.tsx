import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
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

/** How long the palette's key stays open before folding to one line. */
export const LEGEND_FOLDS_AFTER_MS = 60_000;

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
  header,
  open: controlled,
  onOpenChange,
}: {
  readonly questions: readonly PaletteItem[];
  readonly current: string | null;
  readonly onGo: (id: string) => void;
  /** What sits under the grid: the way out of a section, or of the test. */
  readonly footer?: ReactNode;
  /** What sits above it: a sectioned paper's sections. */
  readonly header?: ReactNode;
  /** Open as a sheet on a phone; the page may hold this, to open it from elsewhere. */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}) {
  const { t } = usePreferences();
  const [own, setOwn] = useState(false);
  const open = controlled ?? own;
  const setOpen = (next: boolean) => {
    setOwn(next);
    onOpenChange?.(next);
  };
  // On a phone the sheet opens half way, and a drag or a tap on its handle takes it to full height.
  const [full, setFull] = useState(false);
  const drag = useRef<{ y: number; moved: number } | null>(null);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) {
      setFull(false);
      return;
    }
    // Opened as a sheet: focus goes to the question on screen, and Escape closes it.
    body.current?.querySelector<HTMLElement>('[aria-current="step"]')?.focus();
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
    // setOpen is a fresh closure each render; the listener only needs to exist while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const answered = questions.filter((q) => q.answered).length;
  const marked = questions.filter((q) => q.marked).length;
  const count = (status: Status) => questions.filter((q) => statusOf(q) === status).length;
  const stateOf = (q: PaletteItem) => stateLabel(q, t);
  // "Typed, not saved" only while something is; the rest always, so the shapes are learnt.
  const legend: readonly (readonly [Status, string])[] = [
    ["answered", t("palette.answered")],
    ["not-answered", t("palette.notAnswered")],
    ["not-visited", t("palette.notVisited")],
    ["marked", t("palette.marked")],
    ["answered-marked", t("palette.answeredMarked")],
    ...(count("draft") > 0 ? [["draft", t("palette.draft")] as const] : []),
  ];
  // After the first minute the key folds to one line of shapes and counts; the candidate can open it again.
  const [keyOpen, setKeyOpen] = useState(true);
  const [keyTouched, setKeyTouched] = useState(false);
  useEffect(() => {
    if (keyTouched) return;
    const id = setTimeout(() => setKeyOpen(false), LEGEND_FOLDS_AFTER_MS);
    return () => clearTimeout(id);
  }, [keyTouched]);
  const summary = t("palette.summary", { answered, total: questions.length, marked });

  return (
    <nav className={`palette${open ? " open" : ""}${full ? " full" : ""}`} aria-label={t("palette.region")}>
      <button type="button" className="palette-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{t("palette.region")}</span>
        <span className="palette-summary">{summary}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {/* On a phone the palette is a sheet over the paper; a tap beside it closes it. */}
      {open ? <div className="sheet-scrim" aria-hidden="true" onClick={() => setOpen(false)} /> : null}
      <div className="palette-body" ref={body}>
        <button
          type="button"
          className="sheet-handle"
          aria-label={full ? t("palette.sheetHalf") : t("palette.sheetFull")}
          onClick={() => {
            if (drag.current !== null && Math.abs(drag.current.moved) > 8) return;
            setFull(!full);
          }}
          onPointerDown={(e: PointerEvent) => {
            drag.current = { y: e.clientY, moved: 0 };
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e: PointerEvent) => {
            if (drag.current !== null) drag.current.moved = e.clientY - drag.current.y;
          }}
          onPointerUp={() => {
            const moved = drag.current?.moved ?? 0;
            // Up opens it all the way; down lowers it to half, or closes it from half.
            if (moved < -60) setFull(true);
            else if (moved > 60) {
              if (full) setFull(false);
              else setOpen(false);
            }
            setTimeout(() => (drag.current = null), 0);
          }}
        >
          <span aria-hidden="true" />
        </button>
        <div className="sheet-head">
          <strong>{t("palette.region")}</strong>
          <span className="palette-summary">{summary}</span>
          <button type="button" className="quiet sheet-close" aria-label={t("tools.close")} onClick={() => setOpen(false)}>
            <X aria-hidden="true" />
          </button>
        </div>
        {header}
        <div className="palette-head">
          <p className="palette-title">{t("palette.region")}</p>
          <p className="palette-summary">{summary}</p>
          <div className="meter" aria-hidden="true">
            <span style={{ width: `${Math.round((answered / Math.max(1, questions.length)) * 100)}%` }} />
          </div>
        </div>
        <div className={`palette-key${keyOpen ? "" : " folded"}`}>
          <ul className="palette-legend" id="palette-legend">
            {legend.map(([status, label]) => (
              <li key={status} className={`legend-${status}`} title={label}>
                <span className={`pq ${status}`} aria-hidden="true">
                  {count(status)}
                </span>
                <span className="legend-label">
                  {label}
                  {status === "answered-marked" ? <small> {t("palette.counted")}</small> : null}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="link key-toggle"
            aria-expanded={keyOpen}
            aria-controls="palette-legend"
            onClick={() => {
              setKeyTouched(true);
              setKeyOpen(!keyOpen);
            }}
          >
            {keyOpen ? t("palette.hideKey") : t("palette.showKey")}
          </button>
        </div>
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
