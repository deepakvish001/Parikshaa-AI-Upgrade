import { useEffect, useId, useState } from "react";
import { usePreferences } from "../i18n.tsx";

export interface FeedbackClient {
  feedbackGiven(): Promise<boolean>;
  giveFeedback(rating: number, comment: string): Promise<void>;
}

/**
 * Two questions after submitting: a rating from one to five, and anything
 * that got in the way. Both optional, asked once, and read by the institution
 * without the candidate's name — said so, so that a candidate can be frank.
 * Nothing here touches the attempt or its record.
 */
export function Feedback({ client }: { readonly client: FeedbackClient }) {
  const { t } = usePreferences();
  const id = useId();
  const [state, setState] = useState<"checking" | "asking" | "sending" | "thanked" | "failed">("checking");
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    let live = true;
    client.feedbackGiven().then(
      (given) => live && setState(given ? "thanked" : "asking"),
      // Not knowing is no reason to ask nothing: the server refuses a second answer anyway.
      () => live && setState("asking"),
    );
    return () => {
      live = false;
    };
  }, [client]);

  if (state === "checking") return null;
  if (state === "thanked") {
    return (
      <p className="feedback-thanks" role="status">
        {t("feedback.thanks")}
      </p>
    );
  }

  const send = async () => {
    if (rating === null) return;
    setState("sending");
    try {
      await client.giveFeedback(rating, comment);
      setState("thanked");
    } catch {
      setState("failed");
    }
  };

  return (
    <section className="feedback" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{t("feedback.title")}</h3>
      <p className="notice" id={`${id}-private`}>
        {t("feedback.private")}
      </p>
      <fieldset className="feedback-rating" aria-describedby={`${id}-scale`}>
        <legend className="visually-hidden">{t("feedback.title")}</legend>
        <div className="feedback-options">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={rating === n ? "chosen" : undefined}>
              <input type="radio" name={`${id}-rating`} value={n} checked={rating === n} onChange={() => setRating(n)} aria-label={t("feedback.of", { n })} />
              <span aria-hidden="true">{n}</span>
            </label>
          ))}
        </div>
        <p className="feedback-scale" id={`${id}-scale`}>
          {t("feedback.scale")}
        </p>
      </fieldset>
      <label htmlFor={`${id}-comment`}>{t("feedback.comment")}</label>
      <textarea id={`${id}-comment`} rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="feedback-actions">
        <button type="button" className="secondary" disabled={rating === null || state === "sending"} onClick={() => void send()}>
          {t("feedback.send")}
        </button>
        {state === "failed" ? (
          <span className="error" role="alert">
            {t("feedback.failed")}
          </span>
        ) : null}
      </div>
    </section>
  );
}
