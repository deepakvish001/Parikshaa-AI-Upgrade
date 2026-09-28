import { usePreferences } from "../i18n.tsx";
import { stateLabel, statusOf, type PaletteItem } from "./Paper.tsx";

export interface PaperEntry extends PaletteItem {
  /** The question as the candidate reads it: its first line, in their language. */
  readonly stem: string;
  readonly lang: string;
  readonly maxScore: number;
  readonly kind: string;
}

/**
 * The whole paper at once, read-only, as a CBT's "Question paper" button
 * shows it: every question's opening line, its marks and where it stands.
 * Choosing one goes to it; nothing here answers anything.
 */
export function QuestionPaper({ entries, current, onGo }: { readonly entries: readonly PaperEntry[]; readonly current: string | null; readonly onGo: (id: string) => void }) {
  const { t } = usePreferences();
  return (
    <div className="question-paper">
      <p className="notice">{t("paper.note")}</p>
      <ol className="paper-list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className={`paper-row${entry.id === current ? " current" : ""}`}
              aria-current={entry.id === current ? "step" : undefined}
              onClick={() => onGo(entry.id)}
            >
              <span className={`pq ${statusOf(entry)}`} aria-hidden="true">
                {entry.number}
              </span>
              <span className="paper-stem" lang={entry.lang}>
                {entry.stem}
              </span>
              <span className="paper-meta">
                <span className="kind-chip">{entry.kind}</span>
                <span className="marks">{entry.maxScore === 1 ? t("exam.mark") : t("exam.marks", { n: entry.maxScore })}</span>
                <span className="visually-hidden">{stateLabel(entry, t)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The paper's question numbers down the side of the full-screen coding
 * workspace, as a coding round's screen has them: where each stands, and a
 * way to move without leaving the editor.
 */
export function QuestionRail({ items, current, onGo }: { readonly items: readonly PaletteItem[]; readonly current: string | null; readonly onGo: (id: string) => void }) {
  const { t } = usePreferences();
  return (
    <div className="rail" role="group" aria-label={t("palette.region")}>
      {items.map((q) => (
        <button
          key={q.id}
          type="button"
          className={`pq ${statusOf(q)}`}
          aria-label={t("palette.item", { n: q.number, state: stateLabel(q, t) })}
          aria-current={q.id === current ? "step" : undefined}
          onClick={() => onGo(q.id)}
        >
          {q.number}
        </button>
      ))}
    </div>
  );
}
