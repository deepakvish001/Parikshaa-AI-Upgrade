import type { CandidateQuestion } from "@parikshaa/core/browser";
import type { RunOutcome, SubmitOutcome } from "../api.ts";
import { CodeAnswer } from "./CodeAnswer.tsx";

interface Props {
  readonly question: CandidateQuestion;
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
  /** Runs a code answer; only code questions use it. */
  readonly onRun?: (language: string, source: string, input?: string) => Promise<RunOutcome>;
  /** Commits and tests a code answer; only code questions use it. */
  readonly onSubmit?: (language: string, source: string) => Promise<SubmitOutcome>;
  readonly submitLabel?: string;
  /** The question's number on the paper. */
  readonly number?: number;
  /** Whether the exam allows completion in the code editor. */
  readonly completion?: boolean;
}

/** The input for one question, chosen by its kind. */
export function AnswerInput({ question, value, disabled, onChange, onRun, onSubmit, submitLabel, number, completion }: Props) {
  switch (question.kind) {
    case "mcq": {
      // The letter is drawn by CSS (a counter), so it is in neither the label's text nor its name.
      const letter = (_index: number) => <span className="opt-key" aria-hidden="true" />;
      if (question.multiple) {
        // Several right options: the answer is the chosen positions, in order ("0,2").
        const chosen = new Set(value === "" ? [] : value.split(",").map(Number));
        const toggle = (index: number) => {
          const next = new Set(chosen);
          if (next.has(index)) next.delete(index);
          else next.add(index);
          onChange([...next].sort((a, b) => a - b).join(","));
        };
        return (
          <div role="group" aria-label={question.stem}>
            {question.options.map((option, index) => (
              <label className="option" key={option}>
                <input type="checkbox" checked={chosen.has(index)} disabled={disabled} onChange={() => toggle(index)} />
                {letter(index)}
                <span>{option}</span>
              </label>
            ))}
          </div>
        );
      }
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
              {letter(index)}
              <span>{option}</span>
            </label>
          ))}
        </div>
      );
    }

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
        <CodeAnswer
          question={question}
          value={value}
          disabled={disabled}
          onChange={onChange}
          onRun={onRun ?? (() => Promise.reject(new Error("Running is not available here")))}
          {...(onSubmit === undefined ? {} : { onSubmit })}
          {...(submitLabel === undefined ? {} : { submitLabel })}
          {...(number === undefined ? {} : { number })}
          {...(completion === undefined ? {} : { completion })}
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
