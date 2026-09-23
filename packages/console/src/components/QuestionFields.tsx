import { useState } from "react";
import { CONTENT_LOCALES, type ContentLocale, type Question, type QuestionKind, type QuestionTranslation, type RubricCriterion } from "@parikshaa/core/browser";
import { CodeFields } from "./CodeFields.tsx";

/** Swap a question's kind, replacing the fields that do not carry across. */
export function changeKind(question: Question, kind: QuestionKind): Question {
  // Translated stems carry across; translated options only belong to an mcq.
  const translations = Object.fromEntries(
    Object.entries(question.translations ?? {}).map(([locale, t]) => [locale, kind === "mcq" ? { stem: t.stem, options: ["", ""] } : { stem: t.stem }]),
  );
  const base = { id: question.id, stem: question.stem, maxScore: question.maxScore, rubric: question.rubric, translations };
  switch (kind) {
    case "mcq":
      return { ...base, kind, options: ["", ""], correctIndex: 0 };
    case "numeric":
      return { ...base, kind, expected: 0, tolerance: 0 };
    case "short":
      return { ...base, kind, expectedPoints: [] };
    case "code":
      return {
        ...base,
        kind,
        language: "python",
        languages: ["python", "cpp", "java"],
        tests: [
          { id: "t1", input: "", expected: "", hidden: false, weight: 1 },
          { id: "t2", input: "", expected: "", hidden: true, weight: 1 },
        ],
      };
  }
}

export const blankQuestion = (id: string): Question => ({
  id: id as Question["id"],
  kind: "mcq",
  stem: "",
  maxScore: 1,
  rubric: [],
  options: ["", ""],
  correctIndex: 0,
});

/**
 * The fields of one question, answer key included.
 *
 * Shared by the exam editor and the question bank, so a question is written
 * the same way wherever it is written.
 */
export function QuestionFields({ question, onChange }: { question: Question; onChange: (next: Question) => void }) {
  const setRubric = (rubric: readonly RubricCriterion[]) => onChange({ ...question, rubric } as Question);

  return (
    <>
      <div className="field">
        <label htmlFor={`stem-${question.id}`}>Question</label>
        <textarea
          id={`stem-${question.id}`}
          value={question.stem}
          onChange={(e) => onChange({ ...question, stem: e.target.value })}
        />
      </div>

      <div className="grid">
        <div className="field">
          <label htmlFor={`kind-${question.id}`}>Type</label>
          <select
            id={`kind-${question.id}`}
            value={question.kind}
            onChange={(e) => onChange(changeKind(question, e.target.value as QuestionKind))}
          >
            <option value="mcq">Multiple choice</option>
            <option value="numeric">Numeric</option>
            <option value="short">Short answer</option>
            <option value="code">Code</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor={`marks-${question.id}`}>Marks</label>
          <input
            id={`marks-${question.id}`}
            type="number"
            min={1}
            value={question.maxScore}
            onChange={(e) => onChange({ ...question, maxScore: Number(e.target.value) })}
          />
        </div>
      </div>

      {question.kind === "mcq" ? (
        <div className="field">
          <label>Options — select the correct one</label>
          {question.options.map((option, optionIndex) => (
            <div className="row" key={optionIndex} style={{ marginTop: ".35rem" }}>
              <input
                type="radio"
                name={`correct-${question.id}`}
                aria-label={`Option ${optionIndex + 1} is correct`}
                checked={question.correctIndex === optionIndex}
                onChange={() => onChange({ ...question, correctIndex: optionIndex })}
                style={{ width: "auto" }}
              />
              <input
                aria-label={`Option ${optionIndex + 1}`}
                value={option}
                onChange={(e) =>
                  onChange({
                    ...question,
                    options: question.options.map((o, i) => (i === optionIndex ? e.target.value : o)),
                  })
                }
              />
            </div>
          ))}
          <div className="row">
            <button
              type="button"
              className="secondary"
              onClick={() => onChange({ ...question, options: [...question.options, ""] })}
            >
              Add option
            </button>
          </div>
        </div>
      ) : null}

      {question.kind === "numeric" ? (
        <div className="grid">
          <div className="field">
            <label htmlFor={`exp-${question.id}`}>Expected value</label>
            <input
              id={`exp-${question.id}`}
              type="number"
              step="any"
              value={question.expected}
              onChange={(e) => onChange({ ...question, expected: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor={`tol-${question.id}`}>Tolerance (±)</label>
            <input
              id={`tol-${question.id}`}
              type="number"
              step="any"
              min={0}
              value={question.tolerance}
              onChange={(e) => onChange({ ...question, tolerance: Number(e.target.value) })}
            />
          </div>
        </div>
      ) : null}

      {question.kind === "code" ? <CodeFields question={question} onChange={onChange} /> : null}

      <Translations question={question} onChange={onChange} />

      {question.kind === "short" || question.kind === "code" ? (
        <div className="field">
          <label>Rubric — what a grader must justify against</label>
          {question.rubric.map((criterion, criterionIndex) => (
            <div className="row" key={criterion.id} style={{ marginTop: ".35rem" }}>
              <input
                aria-label={`Criterion ${criterionIndex + 1}`}
                value={criterion.description}
                onChange={(e) =>
                  setRubric(
                    question.rubric.map((c, i) =>
                      i === criterionIndex ? { ...c, description: e.target.value } : c,
                    ),
                  )
                }
              />
              <input
                aria-label={`Criterion ${criterionIndex + 1} weight`}
                type="number"
                min={1}
                style={{ width: "5rem" }}
                value={criterion.weight}
                onChange={(e) =>
                  setRubric(
                    question.rubric.map((c, i) =>
                      i === criterionIndex ? { ...c, weight: Number(e.target.value) } : c,
                    ),
                  )
                }
              />
            </div>
          ))}
          <div className="row">
            <button
              type="button"
              className="secondary"
              onClick={() =>
                setRubric([
                  ...question.rubric,
                  { id: `c${question.rubric.length + 1}`, description: "", weight: 1 },
                ])
              }
            >
              Add criterion
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Each language by its own name, as a translator looks for it. */
const LANGUAGE_NAMES: Record<ContentLocale, string> = {
  hi: "Hindi — हिन्दी",
  bn: "Bengali — বাংলা",
  ta: "Tamil — தமிழ்",
  te: "Telugu — తెలుగు",
  mr: "Marathi — मराठी",
  gu: "Gujarati — ગુજરાતી",
  kn: "Kannada — ಕನ್ನಡ",
  ml: "Malayalam — മലയാളം",
  pa: "Punjabi — ਪੰਜਾਬੀ",
  or: "Odia — ଓଡ଼ିଆ",
};

/**
 * The question in other languages (ROADMAP §9): the stem, and an mcq's options
 * in the original's order — the answer is recorded by position, so option 2
 * in Hindi must be option 2 in English. Grading always reads the original.
 */
function Translations({ question, onChange }: { question: Question; onChange: (next: Question) => void }) {
  const current = question.translations ?? {};
  const present = CONTENT_LOCALES.filter((l) => current[l] !== undefined);
  const missing = CONTENT_LOCALES.filter((l) => current[l] === undefined);
  const [adding, setAdding] = useState<ContentLocale>(missing[0] ?? "hi");

  const set = (locale: ContentLocale, next: QuestionTranslation | undefined) => {
    const translations: Partial<Record<ContentLocale, QuestionTranslation>> = { ...current };
    if (next === undefined) delete translations[locale];
    else translations[locale] = next;
    onChange({ ...question, translations });
  };
  const blank = (): QuestionTranslation => (question.kind === "mcq" ? { stem: "", options: question.options.map(() => "") } : { stem: "" });

  return (
    <details className="field" open={present.length > 0}>
      <summary>Translations{present.length > 0 ? ` (${present.length})` : ""}</summary>
      {present.map((locale) => {
        const t = current[locale]!;
        return (
          <fieldset key={locale} lang={locale} style={{ marginTop: ".5rem" }}>
            <legend>{LANGUAGE_NAMES[locale]}</legend>
            <label htmlFor={`stem-${question.id}-${locale}`}>Question in {LANGUAGE_NAMES[locale].split(" — ")[0]}</label>
            <textarea id={`stem-${question.id}-${locale}`} value={t.stem} onChange={(e) => set(locale, { ...t, stem: e.target.value })} />
            {question.kind === "mcq"
              ? question.options.map((original, i) => (
                  <input
                    key={i}
                    aria-label={`Option ${i + 1} in ${LANGUAGE_NAMES[locale].split(" — ")[0]}`}
                    placeholder={original}
                    value={t.options?.[i] ?? ""}
                    style={{ marginTop: ".35rem" }}
                    onChange={(e) => {
                      const options = question.options.map((_, j) => (j === i ? e.target.value : (t.options?.[j] ?? "")));
                      set(locale, { ...t, options });
                    }}
                  />
                ))
              : null}
            <div className="row">
              <button type="button" className="quiet" onClick={() => set(locale, undefined)}>
                Remove {LANGUAGE_NAMES[locale].split(" — ")[0]}
              </button>
            </div>
          </fieldset>
        );
      })}
      {missing.length > 0 ? (
        <div className="row">
          <select aria-label="Language to add" value={adding} onChange={(e) => setAdding(e.target.value as ContentLocale)} style={{ width: "auto" }}>
            {missing.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_NAMES[l]}
              </option>
            ))}
          </select>
          <button type="button" className="secondary" onClick={() => set(missing.includes(adding) ? adding : missing[0]!, blank())}>
            Add translation
          </button>
        </div>
      ) : null}
    </details>
  );
}
