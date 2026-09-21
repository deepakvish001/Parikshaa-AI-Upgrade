import type { CandidateQuestion } from "@parikshaa/core";

interface Props {
  readonly question: CandidateQuestion;
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
}

/** The input for one question, chosen by its kind. */
export function AnswerInput({ question, value, disabled, onChange }: Props) {
  switch (question.kind) {
    case "mcq":
      return (
        <div role="radiogroup" aria-label={question.stem}>
          {question.options.map((option, index) => (
            <label className="option" key={option}>
              <input
                type="radio"
                name={question.id}
                value={String(index)}
                checked={value === String(index)}
                disabled={disabled}
                onChange={() => onChange(String(index))}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      );

    case "numeric":
      return (
        <input
          type="text"
          inputMode="decimal"
          aria-label={question.stem}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "code":
      return (
        <textarea
          className="code"
          aria-label={question.stem}
          spellCheck={false}
          value={value === "" ? (question.starter ?? "") : value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "short":
      return (
        <textarea
          aria-label={question.stem}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
