import { useState } from "react";

interface Props {
  readonly onToken: (token: string) => void;
}

/**
 * Entry point when no attempt token is present in the URL.
 *
 * The token is the whole of a candidate's access: it names one attempt and
 * expires with the exam window. It is held in memory for the session and is not
 * written to storage — a shared or invigilated machine should not keep it after
 * the tab closes.
 */
export function TokenGate({ onToken }: Props) {
  const [value, setValue] = useState("");

  return (
    <main className="gate">
      <h1>Parikshaa</h1>
      <p className="notice">
        Paste the access code your institution gave you for this exam.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim() !== "") onToken(value.trim());
        }}
      >
        <textarea
          aria-label="Access code"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="row">
          <button type="submit" disabled={value.trim() === ""}>
            Begin
          </button>
        </div>
      </form>
      <p className="notice" style={{ marginTop: "2rem" }}>
        This exam uses no webcam, no screen capture and no keystroke monitoring.
        You will be asked a short follow-up question about one or two of your
        answers.
      </p>
    </main>
  );
}
