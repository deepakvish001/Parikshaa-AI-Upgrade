import { useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { usePreferences } from "../i18n.tsx";

interface Props {
  readonly prompt: string;
  /** True while the prompt is still being written. */
  readonly streaming: boolean;
  readonly onReply: (reply: string) => Promise<void>;
}

/**
 * A micro-viva probe.
 *
 * Presented as what it is — a follow-up question about something the candidate
 * wrote — and nothing more. No warning colour, no countdown, no mention of
 * integrity or provenance. SPEC §4 forbids implying suspicion, and a candidate
 * who feels accused answers differently, which would corrupt the very signal
 * the probe exists to collect.
 *
 * There is no timer shown, and none sent: the server measures how long this
 * took, from when it wrote the probe to when the reply arrives.
 */
export function ProbePanel({ prompt, streaming, onReply }: Props) {
  const { t } = usePreferences();
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await onReply(reply);
    } catch {
      setError(t("probe.failed"));
      setSending(false);
    }
  };

  return (
    <section className="card probe" aria-label={t("probe.region")}>
      <p className="eyebrow">
        <MessageCircleQuestion aria-hidden="true" />
        {t("probe.eyebrow")}
      </p>
      <p className="prompt">
        {prompt}
        {streaming ? <span className="cursor" aria-hidden="true" /> : null}
      </p>

      <textarea
        aria-label={t("probe.replyLabel")}
        placeholder={t("probe.placeholder")}
        value={reply}
        disabled={sending || streaming}
        onChange={(e) => setReply(e.target.value)}
      />

      <div className="row">
        <button type="button" onClick={send} disabled={sending || streaming || reply.trim() === ""}>
          {sending ? t("probe.sending") : t("probe.send")}
        </button>
        <span className="notice">{t("probe.takeTime")}</span>
      </div>

      {error === null ? null : <p className="error">{error}</p>}
    </section>
  );
}
