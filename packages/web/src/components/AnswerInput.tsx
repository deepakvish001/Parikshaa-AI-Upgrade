import type { ReactNode } from "react";
import type { CandidateQuestion } from "@parikshaa/core/browser";
import type { CodeSubmission, RunOutcome, SubmitOutcome } from "../api.ts";
import type { TimelineOp } from "../code-timeline.ts";
import { CodeAnswer } from "./CodeAnswer.tsx";
import { TakeHomeAnswer } from "./TakeHome.tsx";

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
  /** A code question opens in its full-screen workspace, as a coding round's screen does. */
  readonly startFull?: boolean;
  /** Beside the full-screen workspace: the paper's question numbers, to move without leaving it. */
  readonly rail?: ReactNode;
  /** An AI-fluency code question's assistant, beside the editor. */
  readonly assistant?: ReactNode;
  /** A code question's own submissions in this attempt (G4). */
  readonly onHistory?: () => Promise<readonly CodeSubmission[]>;
  /** Each change to a code answer, for playback (G4). */
  readonly onEdit?: (op: TimelineOp) => void;
}

/** The input for one question, chosen by its kind. */
export function AnswerInput({ question, value, disabled, onChange, onRun, onSubmit, submitLabel, number, completion, startFull, rail, assistant, onHistory, onEdit }: Props) {
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
          {...(startFull === undefined ? {} : { startFull })}
          {...(rail === undefined ? {} : { rail })}
          {...(assistant === undefined ? {} : { assistant })}
          {...(onHistory === undefined ? {} : { onHistory })}
          {...(onEdit === undefined ? {} : { onEdit })}
        />
      );

    case "short":
      if (question.takeHome) return <TakeHomeAnswer label={question.stem} value={value} disabled={disabled} onChange={onChange} />;
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
