import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
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
}

/**
 * Every question at a glance, as exam halls in India lay them out: answered,
 * not answered, marked for review. A question's button takes the candidate to
 * it. Beside the paper on a wide screen; folded above it on a phone.
 */
export function Palette({ questions }: { readonly questions: readonly PaletteItem[] }) {
  const { t } = usePreferences();
  const [open, setOpen] = useState(false);
  const answered = questions.filter((q) => q.answered).length;
  const marked = questions.filter((q) => q.marked).length;
  const stateOf = (q: PaletteItem) =>
    [q.answered ? t("palette.answered") : q.draft ? t("palette.draft") : t("palette.notAnswered"), ...(q.marked ? [t("palette.marked")] : [])].join(", ");

  const go = (id: string) => {
    const card = document.getElementById(`q-${id}`);
    card?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    document.getElementById(`q-${id}-stem`)?.focus({ preventScroll: true });
    setOpen(false);
  };

  return (
    <nav className={`palette${open ? " open" : ""}`} aria-label={t("palette.region")}>
      <button type="button" className="palette-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{t("palette.region")}</span>
        <span className="palette-summary">{t("palette.summary", { answered, total: questions.length, marked })}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      <div className="palette-body">
        <p className="palette-title">{t("palette.region")}</p>
        <p className="palette-summary">{t("palette.summary", { answered, total: questions.length, marked })}</p>
        <ol className="palette-grid">
          {questions.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                className={`pq${q.answered ? " answered" : q.draft ? " draft" : ""}${q.marked ? " marked" : ""}`}
                aria-label={t("palette.item", { n: q.number, state: stateOf(q) })}
                onClick={() => go(q.id)}
              >
                {q.number}
              </button>
            </li>
          ))}
        </ol>
        <ul className="palette-legend">
          <li>
            <span className="pq answered" aria-hidden="true" />
            {t("palette.answered")}
          </li>
          <li>
            <span className="pq draft" aria-hidden="true" />
            {t("palette.draft")}
          </li>
          <li>
            <span className="pq" aria-hidden="true" />
            {t("palette.notAnswered")}
          </li>
          <li>
            <span className="pq marked" aria-hidden="true" />
            {t("palette.marked")}
          </li>
        </ul>
      </div>
    </nav>
  );
}
