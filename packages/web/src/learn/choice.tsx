import { useId } from "react";
import type { CandidateQuestion } from "@parikshaa/core/browser";
import { splitStem } from "../components/code-meta.ts";
import { useLearn } from "./context.tsx";
import { icon } from "./icons.tsx";
import type { Tri } from "./screens.ts";

/**
 * A choice or number question's answer (K2-8): the workspace's answer pane
 * (K2-5) and the aptitude set both use it, so the two never answer
 * differently. Options are radios (checkboxes when several are right), each
 * named by its own text; a letter (A, B, …) sits beside each, for the eye
 * only. A number is a text field.
 *
 * After a check, `checked` marks what was checked: the chosen options right
 * or wrong, in words as well as colour. It marks only what the learner chose:
 * a wrong answer never shows which option is right (the API does not say,
 * and the explanation opens only on its own rules). Choosing again clears it.
 */

export const CHOICE = {
  right: ["Your choice: right", "Aapka chuna jawab: sahi", "आपका चुना उत्तर: सही"],
  wrong: ["Your choice: not right", "Aapka chuna jawab: sahi nahi", "आपका चुना उत्तर: सही नहीं"],
} as const satisfies Record<string, Tri>;

const CircleCheck = icon(
  "circle-check",
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </>,
);
const CircleX = icon(
  "circle-x",
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </>,
);

/** The statement without its first paragraph when that is the title, as the bank writes it ("Title\n\nWhat to do…"). */
export function statementBody(stem: string, title: string): string {
  const split = splitStem(stem);
  return split.title.trim().toLowerCase() === title.trim().toLowerCase() ? split.body : stem;
}

/** An option's letter: A for the first. */
export const letterOf = (index: number): string => (index < 26 ? String.fromCharCode(65 + index) : String(index + 1));

/** An answer as the learner reads it: a choice's letters ("A, C"), else the text as given. */
export function answerText(question: CandidateQuestion, answer: string): string {
  if (question.kind !== "mcq") return answer;
  const picks = answer.split(",").filter((x) => /^\d+$/.test(x));
  return picks.length === 0 ? answer : picks.map((x) => letterOf(Number(x))).join(", ");
}

export function ChoiceField({
  question,
  value,
  onChange,
  label,
  checked = null,
  disabled = false,
}: {
  readonly question: CandidateQuestion;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** The field's name: "Your answer". */
  readonly label: string;
  /** The answer last checked and whether it was right; marks show only while the field still holds that answer. */
  readonly checked?: { readonly answer: string; readonly right: boolean } | null;
  readonly disabled?: boolean;
}) {
  const { t } = useLearn();
  const id = useId();
  const marked = checked !== null && checked.answer === value ? checked : null;
  const mark = marked === null ? null : marked.right ? "ln-right" : "ln-wrong";
  if (question.kind === "mcq") {
    return (
      <fieldset className="ln-choice" disabled={disabled}>
        <legend className="ln-sr">{label}</legend>
        {question.options.map((option, i) => {
          const chosen = question.multiple ? value.split(",").includes(String(i)) : value === String(i);
          const flag = chosen && mark !== null ? mark : null;
          return (
            <label key={`${i}-${option}`} className={`ln-choice-opt${chosen ? " ln-on" : ""}${flag === null ? "" : ` ${flag}`}`}>
              <input
                type={question.multiple ? "checkbox" : "radio"}
                name={`${id}-opt`}
                checked={chosen}
                {...(flag === null ? {} : { "aria-describedby": `${id}-mark-${i}` })}
                onChange={() => {
                  if (!question.multiple) return onChange(String(i));
                  const now = new Set(value === "" ? [] : value.split(","));
                  if (now.has(String(i))) now.delete(String(i));
                  else now.add(String(i));
                  onChange([...now].map(Number).sort((a, b) => a - b).join(","));
                }}
              />
              <span className="ln-choice-letter" aria-hidden="true">
                {letterOf(i)}
              </span>
              <span className="ln-choice-text">{option}</span>
              {flag === null ? null : (
                <>
                  {flag === "ln-right" ? <CircleCheck aria-hidden="true" className="ln-choice-mark" /> : <CircleX aria-hidden="true" className="ln-choice-mark" />}
                  <span id={`${id}-mark-${i}`} hidden>
                    {t(flag === "ln-right" ? CHOICE.right : CHOICE.wrong)}
                  </span>
                </>
              )}
            </label>
          );
        })}
      </fieldset>
    );
  }
  return (
    <label className={`ln-field ln-choice-num${mark === null ? "" : ` ${mark}`}`}>
      <span>{label}</span>
      {question.kind === "short" ? (
        <textarea className="ln-input" rows={5} value={value} maxLength={20_000} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <span className="ln-choice-row">
          <input
            className="ln-input"
            inputMode={question.kind === "numeric" ? "decimal" : "text"}
            value={value}
            maxLength={200}
            disabled={disabled}
            {...(mark === null ? {} : { "aria-describedby": `${id}-mark` })}
            onChange={(event) => onChange(event.target.value)}
          />
          {mark === null ? null : (
            <>
              {mark === "ln-right" ? <CircleCheck aria-hidden="true" className="ln-choice-mark" /> : <CircleX aria-hidden="true" className="ln-choice-mark" />}
              <span id={`${id}-mark`} hidden>
                {t(mark === "ln-right" ? CHOICE.right : CHOICE.wrong)}
              </span>
            </>
          )}
        </span>
      )}
    </label>
  );
}
