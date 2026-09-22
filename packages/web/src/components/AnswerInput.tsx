import type { CandidateQuestion } from "@parikshaa/core/browser";
import type { RunOutcome } from "../api.ts";
import { CodeAnswer } from "./CodeAnswer.tsx";

interface Props {
  readonly question: CandidateQuestion;
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
  /** Runs a code answer; only code questions use it. */
  readonly onRun?: (language: string, source: string, input?: string) => Promise<RunOutcome>;
}

/** The input for one question, chosen by its kind. */
export function AnswerInput({ question, value, disabled, onChange, onRun }: Props) {
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
        <CodeAnswer
          question={question}
          value={value}
          disabled={disabled}
          onChange={onChange}
          onRun={onRun ?? (() => Promise.reject(new Error("Running is not available here")))}
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
