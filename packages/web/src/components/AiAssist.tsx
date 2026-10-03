import { useState } from "react";
import { Bot, Send, UserRound } from "lucide-react";
import { usePreferences } from "../i18n.tsx";

/**
 * The AI assistant on an AI-fluency question (docs/PREP-TRACKER.md plan row
 * 87): a conversation beside the editor. The candidate's code goes with each
 * question; every question and answer is recorded for the reviewer, as the
 * intro says before anything is asked.
 */

export interface AssistTurn {
  readonly prompt: string;
  readonly reply: string;
}

const MAX = 20;

/** The source from a stored code answer (`{language, source}` JSON, or plain source from before). */
export function sourceOf(value: string): string {
  try {
    const parsed = JSON.parse(value) as { source?: unknown };
    return typeof parsed.source === "string" ? parsed.source : value;
  } catch {
    return value;
  }
}

export function AiAssist({
  initial,
  disabled,
  code,
  ask,
}: {
  readonly initial: readonly AssistTurn[];
  readonly disabled: boolean;
  /** The candidate's code as it stands now. */
  readonly code: () => string;
  readonly ask: (prompt: string, code: string | null) => Promise<{ readonly reply: string; readonly left: number }>;
}) {
  const { t } = usePreferences();
  const [turns, setTurns] = useState<readonly AssistTurn[]>(initial);
  const [left, setLeft] = useState(MAX - initial.length);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const text = prompt.trim();
    if (text === "" || busy) return;
    setBusy(true);
    setError(null);
    try {
      const source = code();
      const answer = await ask(text, source.trim() === "" ? null : source);
      setTurns((all) => [...all, { prompt: text, reply: answer.reply }]);
      setLeft(answer.left);
      setPrompt("");
    } catch (e) {
      setError(t("assist.failed", { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ai-assist">
      <p className="notice">{t("assist.intro")}</p>
      {turns.length === 0 ? null : (
        <ol className="assist-turns" aria-label={t("assist.tab")}>
          {turns.map((turn, i) => (
            <li key={i}>
              <p className="assist-you">
                <UserRound aria-hidden="true" className="inline-icon" />
                <span className="visually-hidden">{t("assist.you")}: </span>
                {turn.prompt}
              </p>
              <div className="assist-ai">
                <Bot aria-hidden="true" className="inline-icon" />
                <span className="visually-hidden">{t("assist.ai")}: </span>
                <pre>{turn.reply}</pre>
              </div>
            </li>
          ))}
        </ol>
      )}
      {disabled || left <= 0 ? null : (
        <form
          className="assist-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="field">
            <span className="visually-hidden">{t("assist.ask")}</span>
            <textarea
              rows={2}
              maxLength={2000}
              placeholder={t("assist.ask")}
              value={prompt}
              disabled={busy}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
          </label>
          <div className="assist-actions">
            <span className="notice">{t("assist.left", { n: left })}</span>
            <button type="submit" className="secondary" disabled={busy || prompt.trim() === ""}>
              <Send aria-hidden="true" />
              {busy ? t("assist.sending") : t("assist.send")}
            </button>
          </div>
        </form>
      )}
      {error === null ? null : (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
