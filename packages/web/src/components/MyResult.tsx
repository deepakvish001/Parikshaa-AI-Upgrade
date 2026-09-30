import { useCallback, useEffect, useId, useState } from "react";
import { Download } from "lucide-react";
import type { MyResult as Result } from "../api.ts";
import { uiLocaleOf, usePreferences } from "../i18n.tsx";

export interface ResultClient {
  result(): Promise<Result>;
  askRecheck(questionId: string, reason: string): Promise<void>;
  scorecard(): Promise<Blob>;
}

/**
 * The candidate's own result, once their institution releases it: the marks,
 * question by question, a recheck they may ask for on up to three questions,
 * what came of it, and the scorecard to download. Before the release, nothing
 * shows: the receipt is the record until then.
 */
export function MyResult({ client }: { readonly client: ResultClient }) {
  const { t, language } = usePreferences();
  const id = useId();
  const [result, setResult] = useState<Result | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    client.result().then(setResult, () => setResult({ released: false }));
  }, [client]);
  useEffect(load, [load]);

  if (result === null || !result.released) return null;
  const ui = uiLocaleOf(language);
  const until =
    result.recheckUntil === null
      ? null
      : new Intl.DateTimeFormat(`${ui}-IN`, { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(result.recheckUntil));
  const byQuestion = new Map(result.rechecks.map((r) => [r.questionId, r]));

  const send = async (questionId: string) => {
    setSending(true);
    setFailed(false);
    try {
      await client.askRecheck(questionId, reason);
      setAsking(null);
      setReason("");
      load();
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  const download = async () => {
    const blob = await client.scorecard();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "scorecard.pdf";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="my-result" aria-labelledby={`${id}-title`}>
      <div className="my-result-head">
        <h3 id={`${id}-title`}>{t("result.title")}</h3>
        <button type="button" className="secondary" onClick={() => void download()}>
          <Download aria-hidden="true" />
          {t("result.download")}
        </button>
      </div>
      <p className="my-result-marks">{t("result.marks", { total: result.total, max: result.maxTotal, percent: result.percent })}</p>
      {result.outcome === null ? null : (
        <p className={`my-result-outcome ${result.outcome}`}>{t(result.outcome === "qualified" ? "result.qualified" : "result.failed")}</p>
      )}
      <table className="my-result-table">
        <thead>
          <tr>
            <th scope="col">{t("result.question")}</th>
            <th scope="col" className="num">
              {t("result.mark")}
            </th>
          </tr>
        </thead>
        <tbody>
          {result.questions.map((q) => {
            const recheck = byQuestion.get(q.id);
            return (
              <tr key={q.id}>
                <td>
                  <span className="q-number">{q.number}.</span> {q.stem}
                  {recheck === undefined ? null : (
                    <p className={`recheck-state ${recheck.status}`}>
                      {recheck.status === "open"
                        ? t("result.asked")
                        : recheck.status === "changed"
                          ? t("result.changed", { before: recheck.scoreBefore ?? 0, after: recheck.scoreAfter ?? 0 })
                          : t("result.unchanged", { after: recheck.scoreAfter ?? 0 })}
                      {recheck.reply === null ? null : (
                        <>
                          <br />
                          {t("result.reply", { reply: recheck.reply })}
                        </>
                      )}
                    </p>
                  )}
                  {/* Nothing to gain on full marks; one request per question. */}
                  {until === null || recheck !== undefined || q.score >= q.max ? null : asking === q.id ? (
                    <form
                      className="recheck-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void send(q.id);
                      }}
                    >
                      <label htmlFor={`${id}-${q.id}`}>{t("result.reasonLabel")}</label>
                      <p className="notice" id={`${id}-${q.id}-hint`}>
                        {t("result.reasonHint")}
                      </p>
                      <textarea
                        id={`${id}-${q.id}`}
                        aria-describedby={`${id}-${q.id}-hint`}
                        rows={3}
                        maxLength={1000}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                      {failed ? (
                        <p className="error" role="alert">
                          {t("result.failedSend")}
                        </p>
                      ) : null}
                      <div className="recheck-actions">
                        <button type="submit" disabled={sending || reason.trim().length < 10}>
                          {t("result.send")}
                        </button>
                        <button type="button" className="secondary" onClick={() => setAsking(null)}>
                          {t("result.cancel")}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="link recheck-ask"
                      aria-label={t("result.askTitle", { n: q.number })}
                      onClick={() => {
                        setAsking(q.id);
                        setReason("");
                        setFailed(false);
                      }}
                    >
                      {t("result.ask")}
                    </button>
                  )}
                </td>
                <td className="num">
                  {q.score} / {q.max}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {until === null ? null : <p className="notice">{t("result.until", { when: `${until} IST` })}</p>}
    </section>
  );
}
