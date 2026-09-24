import type { CandidateCodeQuestion } from "@parikshaa/core/browser";
import { Markdown, inline } from "@parikshaa/brand/markdown";
import { usePreferences } from "../i18n.tsx";
import { argumentsOf, splitStem } from "./code-meta.ts";

/** A function question's arguments as LeetCode writes them: `nums = [2,7,11,15], target = 9`. */
export function ArgumentList({ question, input }: { readonly question: CandidateCodeQuestion; readonly input: string }) {
  const values = argumentsOf(input);
  const params = question.function?.params ?? [];
  return (
    <div className="args">
      {params.map((p, i) => (
        <div className="arg" key={p.name}>
          <span className="arg-name">{p.name} =</span> <code>{values[i] ?? ""}</code>
        </div>
      ))}
    </div>
  );
}

/**
 * A code question's statement: what to do, the shapes of input and output,
 * the constraints, and worked examples — the page a candidate reads before
 * writing a line. `withTitle`: the statement's first paragraph as its heading,
 * when the page around it does not already show it.
 */
export function ProblemStatement({
  question,
  number,
  withTitle,
  headingId,
}: {
  readonly question: CandidateCodeQuestion;
  readonly number: number;
  readonly withTitle: boolean;
  readonly headingId?: string;
}) {
  const { t } = usePreferences();
  const { title, body } = splitStem(question.stem);
  const sections: [string, string | null | undefined][] = [
    [t("code.inputFormat"), question.inputFormat],
    [t("code.outputFormat"), question.outputFormat],
    [t("code.constraints"), question.constraints],
  ];
  return (
    <div className="statement">
      {withTitle ? (
        <h2 id={headingId} tabIndex={-1}>
          <span className="q-num">{number}.</span> {title === "" ? t("code.problem") : inline(title)}
        </h2>
      ) : null}
      {body === "" ? null : <Markdown source={body} />}
      {sections.map(([heading, text]) =>
        text === null || text === undefined || text.trim() === "" ? null : (
          <section key={heading} className="statement-part">
            <h3>{heading}</h3>
            <Markdown source={text} />
          </section>
        ),
      )}
      {question.samples.length === 0 ? null : (
        <section className="statement-part examples" aria-label={t("code.examples")}>
          {question.samples.map((sample, i) => (
            <div className="example" key={i}>
              <h3>{t("code.example", { n: i + 1 })}</h3>
              <dl>
                <dt>{t("code.input")}</dt>
                <dd>{question.function === null || question.function === undefined ? <pre>{sample.input}</pre> : <ArgumentList question={question} input={sample.input} />}</dd>
                <dt>{t("code.output")}</dt>
                <dd>
                  <pre>{sample.output}</pre>
                </dd>
                {sample.explanation === null || sample.explanation === undefined ? null : (
                  <>
                    <dt>{t("code.explanation")}</dt>
                    <dd>
                      <Markdown source={sample.explanation} />
                    </dd>
                  </>
                )}
              </dl>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
