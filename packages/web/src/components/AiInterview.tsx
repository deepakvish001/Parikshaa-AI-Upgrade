import { useEffect, useRef, useState } from "react";
import { Bot, CircleX, Code2, Loader, Send, UserRound } from "lucide-react";
import { GateShell } from "./Chrome.tsx";
import "./PublicPages.css";
import "./AiInterview.css";

/**
 * The candidate's side of an AI interview (docs/PREP-TRACKER.md plan row 86):
 * a chat with the interviewer, one question at a time, with code when an
 * answer needs it. Written in English, like the other pages opened from a
 * link, and loaded only when such a link is opened.
 */

interface Turn {
  readonly speaker: "interviewer" | "candidate";
  readonly kind: "question" | "follow_up" | "answer" | "closing";
  readonly body: string;
  readonly code: string | null;
  readonly language: string | null;
  readonly at: string;
}

export interface AiRoom {
  readonly title: string;
  readonly candidateName: string;
  readonly minutes: number;
  readonly questions: number;
  readonly asked: number;
  readonly status: "invited" | "in_progress" | "done" | "cancelled";
  readonly startedAt: string | null;
  readonly endsAt: string | null;
  readonly turns: readonly Turn[];
}

const LANGUAGES = ["python", "javascript", "java", "cpp", "c", "sql", "text"] as const;

const left = (endsAt: string | null, now: number) => {
  if (endsAt === null) return null;
  const s = Math.max(0, Math.round((Date.parse(endsAt) - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function AiInterviewPage({ code }: { readonly code: string }) {
  const [room, setRoom] = useState<AiRoom | "missing" | null>(null);
  const [text, setText] = useState("");
  const [withCode, setWithCode] = useState(false);
  const [source, setSource] = useState("");
  const [language, setLanguage] = useState<string>("python");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const url = `/api/ai-interviews/room/${encodeURIComponent(code)}`;
  const end = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const response = await fetch(url).catch(() => null);
      if (!alive) return;
      if (response === null) return setError("Could not reach the server: check your connection and reload.");
      if (!response.ok) return setRoom("missing");
      setRoom((await response.json()) as AiRoom);
    })();
    return () => {
      alive = false;
    };
  }, [url]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const turns = room !== null && room !== "missing" ? room.turns.length : 0;
  useEffect(() => end.current?.scrollIntoView?.({ block: "nearest" }), [turns]);

  const send = async (path: string, body?: object) => {
    setBusy(true);
    setError(null);
    const response = await fetch(`${url}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) }).catch(() => null);
    setBusy(false);
    if (response === null) return setError("Not sent: check your connection and try again.");
    if (response.status === 404) return setRoom("missing");
    if (!response.ok) {
      const problem = (await response.json().catch(() => null)) as { message?: string } | null;
      setError(problem?.message ?? "That did not go through. Try again in a moment.");
      // What was kept (an answer sent before the interviewer could reply) shows as it stands.
      const fresh = await fetch(url).catch(() => null);
      if (fresh?.ok === true) setRoom((await fresh.json()) as AiRoom);
      return false;
    }
    setRoom((await response.json()) as AiRoom);
    return true;
  };

  const answer = async () => {
    const sent = await send("/answer", { text, code: withCode && source.trim() !== "" ? source : null, language: withCode ? language : null });
    if (sent === true) {
      setText("");
      setSource("");
      setWithCode(false);
    }
  };

  if (room === null) {
    return (
      <GateShell width="narrow">
        <section className="gate-card status-card" aria-busy={error === null} aria-label="AI interview">
          {error === null ? <Loader className="status-icon spin" aria-hidden="true" /> : <CircleX className="status-icon bad" aria-hidden="true" />}
          <h1>{error ?? "Opening your interview…"}</h1>
        </section>
      </GateShell>
    );
  }
  if (room === "missing") {
    return (
      <GateShell width="narrow">
        <section className="gate-card status-card" aria-label="AI interview">
          <CircleX className="status-icon bad" aria-hidden="true" />
          <h1>This interview link does not work</h1>
          <p className="notice">It may have been cancelled. Ask the person who invited you for the current link.</p>
        </section>
      </GateShell>
    );
  }

  if (room.status === "invited") {
    return (
      <GateShell width="narrow">
        <section className="gate-card public-page" aria-label="AI interview">
          <p className="notice">{room.title}</p>
          <h1>Hello {room.candidateName}</h1>
          <p>This is a first-round interview by chat, held by an AI interviewer. Here is how it works:</p>
          <ul className="ai-rules">
            <li>
              {room.questions} questions, each with one follow-up on your answer, in at most {room.minutes} minutes. The clock starts when you press Start.
            </li>
            <li>Answer in your own words. Where it helps, add a short piece of code.</li>
            <li>The interviewer is not told your name or anything else about you: only the role and your answers.</li>
            <li>It does not decide anything. A person on the hiring team reads the whole conversation and decides.</li>
          </ul>
          {error === null ? null : (
            <p className="notice bad" role="alert">
              {error}
            </p>
          )}
          <button type="button" disabled={busy} onClick={() => void send("/start")}>
            {busy ? "Starting…" : "Start the interview"}
          </button>
        </section>
      </GateShell>
    );
  }

  const open = room.status === "in_progress";
  const waiting = open && room.turns.at(-1)?.speaker !== "interviewer";
  const clock = open ? left(room.endsAt, now) : null;

  return (
    <GateShell width="full">
      <section className="gate-card public-page ai-interview" aria-label="AI interview">
        <header className="ai-head">
          <div>
            <p className="notice">{room.title}</p>
            <h1>Interview</h1>
          </div>
          <p className="notice" aria-live="off">
            Question {Math.max(room.asked, 1)} of {room.questions}
            {clock === null ? null : <> · {clock} left</>}
          </p>
        </header>
        <ol className="ai-chat" aria-label="Conversation" aria-live="polite">
          {room.turns.map((t, i) => (
            <li key={i} ref={i === room.turns.length - 1 ? end : null} className={t.speaker === "interviewer" ? "from-them" : "from-you"}>
              <span className="who">
                {t.speaker === "interviewer" ? <Bot aria-hidden="true" className="inline-icon" /> : <UserRound aria-hidden="true" className="inline-icon" />}
                {t.speaker === "interviewer" ? "Interviewer" : "You"}
              </span>
              <p>{t.body}</p>
              {t.code === null ? null : (
                <pre aria-label={`Code (${t.language ?? "text"})`}>
                  <code>{t.code}</code>
                </pre>
              )}
            </li>
          ))}
          {busy ? (
            <li className="from-them thinking" aria-busy="true">
              <span className="who">
                <Bot aria-hidden="true" className="inline-icon" /> Interviewer
              </span>
              <p>…</p>
            </li>
          ) : null}
        </ol>
        {open ? (
          <form
            className="ai-answer"
            onSubmit={(e) => {
              e.preventDefault();
              void answer();
            }}
          >
            <label>
              Your answer
              <textarea value={text} maxLength={8000} rows={4} disabled={busy || waiting} onChange={(e) => setText(e.target.value)} />
            </label>
            {withCode ? (
              <>
                <div className="editor-bar">
                  <span>
                    <Code2 aria-hidden="true" className="inline-icon" /> Code
                  </span>
                  <select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {LANGUAGES.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <textarea aria-label="Code editor" className="code" spellCheck={false} value={source} maxLength={40000} disabled={busy} onChange={(e) => setSource(e.target.value)} />
              </>
            ) : null}
            {error === null ? null : (
              <p className="notice bad" role="alert">
                {error}
              </p>
            )}
            {waiting && !busy ? (
              <p className="notice">
                The interviewer has not replied yet.{" "}
                <button type="button" className="secondary" onClick={() => void send("/start")}>
                  Ask the next question
                </button>
              </p>
            ) : null}
            <div className="ai-actions">
              <button type="button" className="secondary" disabled={busy} onClick={() => setWithCode((w) => !w)}>
                <Code2 aria-hidden="true" className="inline-icon" /> {withCode ? "Remove code" : "Add code"}
              </button>
              <button type="submit" disabled={busy || waiting || (text.trim() === "" && source.trim() === "")}>
                <Send aria-hidden="true" className="inline-icon" /> {busy ? "Sending…" : "Send answer"}
              </button>
            </div>
          </form>
        ) : (
          <p className="notice" role="status">
            The interview has ended. Thank you: the hiring team will read it and be in touch.
          </p>
        )}
      </section>
    </GateShell>
  );
}
