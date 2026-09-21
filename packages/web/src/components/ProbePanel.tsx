import { useState } from "react";

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
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await onReply(reply);
    } catch {
      setError("Could not send that reply. Try again.");
      setSending(false);
    }
  };

  return (
    <section className="card probe" aria-label="Follow-up question">
      <p className="eyebrow">A follow-up on your answer</p>
      <p className="prompt">
        {prompt}
        {streaming ? <span className="cursor" aria-hidden="true" /> : null}
      </p>

      <textarea
        aria-label="Your reply to the follow-up"
        placeholder="In your own words."
        value={reply}
        disabled={sending || streaming}
        onChange={(e) => setReply(e.target.value)}
      />

      <div className="row">
        <button type="button" onClick={send} disabled={sending || streaming || reply.trim() === ""}>
          {sending ? "Sending…" : "Send reply"}
        </button>
        <span className="notice">Take the time you need.</span>
      </div>

      {error === null ? null : <p className="error">{error}</p>}
    </section>
  );
}
