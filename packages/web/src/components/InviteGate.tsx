import { useCallback, useEffect, useState } from "react";
import { ApiError, redeemInvitation } from "../api.ts";

interface Props {
  readonly code: string;
  readonly onOpened: (token: string) => void;
  /** Leave the invitation and enter a code by hand instead. */
  readonly onForget: () => void;
}

type Stage =
  | { readonly kind: "opening" }
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

  const open = useCallback(async () => {
    setStage({ kind: "opening" });
    try {
      onOpened((await redeemInvitation(code)).token);
    } catch (error) {
      if (!(error instanceof ApiError)) return setStage({ kind: "offline" });
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
