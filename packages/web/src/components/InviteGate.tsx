import { useCallback, useEffect, useState } from "react";
import { ApiError, redeemInvitation, type Notice } from "../api.ts";

interface Props {
  readonly code: string;
  readonly onOpened: (token: string) => void;
  /** Leave the invitation and enter a code by hand instead. */
  readonly onForget: () => void;
}

type Stage =
  | { readonly kind: "opening" }
  | { readonly kind: "notice"; readonly notice: Notice }
  | { readonly kind: "early"; readonly opensAt: string }
  | { readonly kind: "closed"; readonly closesAt: string }
  | { readonly kind: "invalid" }
  | { readonly kind: "offline" };

/** Times as the candidate reads them: IST, spelled out. */
const ist = (iso: string) =>
  `${new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" }).format(new Date(iso))} IST`;

/**
 * Opening an invitation link.
 *
 * Early, the candidate is told exactly when to come back, and the page lets
 * them in by itself at that moment. After the window, it says so plainly. An
 * invalid link says only that, and who to ask.
 */
export function InviteGate({ code, onOpened, onForget }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: "opening" });

  const open = useCallback(async (consent?: { noticeVersion: number }) => {
    setStage({ kind: "opening" });
    try {
      onOpened((await redeemInvitation(code, "/api", consent)).token);
    } catch (error) {
      if (!(error instanceof ApiError)) return setStage({ kind: "offline" });
      if (error.code === "consent_required") return setStage({ kind: "notice", notice: error.detail["notice"] as Notice });
      if (error.code === "not_open_yet") return setStage({ kind: "early", opensAt: String(error.detail["opensAt"]) });
      if (error.code === "window_closed") return setStage({ kind: "closed", closesAt: String(error.detail["closesAt"]) });
      setStage({ kind: "invalid" });
    }
  }, [code, onOpened]);

  useEffect(() => {
    void open();
  }, [open]);

  // Early: try again at the moment the window opens, and at most every minute.
  useEffect(() => {
    if (stage.kind !== "early") return;
    const wait = Math.max(1_000, Math.min(Date.parse(stage.opensAt) - Date.now() + 1_000, 60_000));
    const timer = setTimeout(() => void open(), wait);
    return () => clearTimeout(timer);
  }, [stage, open]);

  return (
    <main className="gate">
      <h1>Parikshaa</h1>
      {stage.kind === "opening" ? <p className="notice">Opening your test…</p> : null}
      {stage.kind === "notice" ? <PrivacyNotice notice={stage.notice} onAgree={() => void open({ noticeVersion: stage.notice.version })} /> : null}
      {stage.kind === "early" ? (
        <section className="card" aria-label="Not open yet">
          <p style={{ marginTop: 0 }}>Your test opens on</p>
          <p className="when">{ist(stage.opensAt)}</p>
          <p className="notice">
            Keep this page open and it will let you in at that time, or come back to the same link then. Nothing has
            started yet.
          </p>
        </section>
      ) : null}
      {stage.kind === "closed" ? (
        <section className="card" aria-label="Closed">
          <p style={{ marginTop: 0 }}>This test closed on {ist(stage.closesAt)}.</p>
          <p className="notice">If you think you should still be able to take it, contact whoever sent you the link.</p>
        </section>
      ) : null}
      {stage.kind === "invalid" ? (
        <section className="card" aria-label="Invalid link">
          <p style={{ marginTop: 0 }}>This link does not work.</p>
          <p className="notice">Ask whoever sent it for a new one. Links are personal and stop working if they are withdrawn.</p>
          <button type="button" className="secondary" onClick={onForget}>
            I have an access code instead
          </button>
        </section>
      ) : null}
      {stage.kind === "offline" ? (
        <section className="card" aria-label="No connection">
          <p style={{ marginTop: 0 }}>Could not reach the server.</p>
          <button type="button" onClick={() => void open()}>
            Try again
          </button>
        </section>
      ) : null}
    </main>
  );
}

/**
 * The organisation's privacy notice, before anything starts (DPDP Act, s.5–6).
 * Reading it costs no test time: the clock starts only once it is agreed to.
 */
function PrivacyNotice({ notice, onAgree }: { notice: Notice; onAgree: () => void }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <section className="card notice-card" aria-labelledby="privacy-heading">
      <h2 id="privacy-heading" style={{ marginTop: 0 }}>
        Before you start: your data
      </h2>
      <p>
        <strong>{notice.controllerName}</strong> is responsible for the data collected while you take this test. Your
        time has not started yet.
      </p>
      <h3>Why</h3>
      <p>{notice.purpose}</p>
      <h3>What is collected</h3>
      <ul>
        {notice.collected.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h3>How long it is kept</h3>
      <p>
        {notice.retentionDays} days after you finish. After that it is erased: your answers and your details can no
        longer be read by anyone.
      </p>
      <h3>Your rights</h3>
      <ul>
        {notice.rights.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>
        Grievance officer: {notice.grievance.name}, <a href={`mailto:${notice.grievance.email}`}>{notice.grievance.email}</a>
      </p>
      <label className="inline">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /> I have read this and
        agree to my data being used as it describes
      </label>
      <div className="row">
        <button type="button" disabled={!agreed} onClick={onAgree}>
          Agree and start the test
        </button>
      </div>
      <p className="notice">Notice version {notice.version}</p>
    </section>
  );
}
