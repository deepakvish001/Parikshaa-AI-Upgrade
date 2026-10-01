import { useEffect, useRef, useState, type ReactNode } from "react";
import { Mic, MicOff } from "lucide-react";
import { usePreferences } from "../i18n.tsx";
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
  /** A code question opens in its full-screen workspace, as a coding round's screen does. */
  readonly startFull?: boolean;
  /** Beside the full-screen workspace: the paper's question numbers, to move without leaving it. */
  readonly rail?: ReactNode;
}

/** The input for one question, chosen by its kind. */
export function AnswerInput({ question, value, disabled, onChange, onRun, onSubmit, submitLabel, number, completion, startFull, rail }: Props) {
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
        />
      );

    case "short":
      return question.spoken === true ? (
        <SpokenAnswer stem={question.stem} value={value} disabled={disabled} onChange={onChange} />
      ) : (
        <textarea
          aria-label={question.stem}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

/**
 * Answering by speaking (V2-12 CO10): the browser's own speech recognition
 * writes down what the candidate says, in the language they chose, into the
 * same box they can type in. Nothing but the words leaves the page; where the
 * browser cannot listen, the box is simply typed in.
 */
function SpokenAnswer({ stem, value, disabled, onChange }: { stem: string; value: string; disabled: boolean; onChange: (value: string) => void }) {
  const { t, language } = usePreferences();
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const latest = useRef(value);
  latest.current = value;
  const Engine = (globalThis as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition ??
    (globalThis as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
  useEffect(() => () => recognition.current?.stop(), []);
  useEffect(() => {
    if (disabled) recognition.current?.stop();
  }, [disabled]);

  const start = () => {
    if (Engine === undefined) return;
    const r = new Engine();
    r.lang = `${language}-IN`;
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (event) => {
      const words: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) if (event.results[i]!.isFinal) words.push(event.results[i]![0]!.transcript.trim());
      if (words.length > 0) onChange(`${latest.current.trimEnd()}${latest.current.trim() === "" ? "" : " "}${words.join(" ")}`);
    };
    r.onend = () => setListening(false);
    recognition.current = r;
    r.start();
    setListening(true);
  };

  return (
    <div className="spoken-answer">
      <textarea aria-label={stem} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      {Engine === undefined ? (
        <p className="notice">{t("answer.noSpeech")}</p>
      ) : (
        <div className="row">
          <button type="button" className={listening ? "danger" : "secondary"} disabled={disabled} onClick={() => (listening ? recognition.current?.stop() : start())} aria-pressed={listening}>
            {listening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
            {listening ? t("answer.stopSpeaking") : t("answer.speak")}
          </button>
          {listening ? (
            <span className="notice" role="status">
              {t("answer.listening")}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
