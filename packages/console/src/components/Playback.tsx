import { useEffect, useState } from "react";
import { ClipboardPaste, Pause, Play } from "lucide-react";
import { Drawer } from "@parikshaa/brand/ui";
import { LARGE_PASTE, replay } from "@parikshaa/core/browser";
import type { CodePlayback } from "../api.ts";
import "./Playback.css";

/**
 * Watching a code answer being written (G4): the editor's changes, step by
 * step, with every paste marked. A large paste is a signal to look at, never a
 * finding: candidates paste their own code from one part of the editor to
 * another too.
 */

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function PlaybackDrawer({ playback, title, onClose }: { playback: CodePlayback; title: string; onClose: () => void }) {
  const ops = playback.ops;
  const [step, setStep] = useState(ops.length);
  const [playing, setPlaying] = useState(false);
  const start = ops[0]?.t ?? 0;

  // Playing: a step every tenth of a second, from the start if at the end.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setStep((s) => {
        if (s >= ops.length) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 100);
    return () => clearInterval(id);
  }, [playing, ops.length]);

  const at = ops[Math.max(0, step - 1)];
  const current = ops[step - 1];
  return (
    <Drawer label="Playback" onClose={onClose}>
      <h2 className="dialog-title">How this answer was written</h2>
      <p className="notice">
        {title} · {ops.length} changes over {clock((ops.at(-1)?.t ?? start) - start)}
      </p>
      <div className="playback-controls">
        <button
          type="button"
          className="secondary"
          onClick={() => {
            if (!playing && step >= ops.length) setStep(0);
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {playing ? "Pause" : "Play"}
        </button>
        <label className="playback-slider">
          <span className="visually-hidden">Step</span>
          <input type="range" min={0} max={ops.length} value={step} aria-valuetext={`Step ${step} of ${ops.length}, at ${clock((at?.t ?? start) - start)}`} onChange={(e) => setStep(Number(e.target.value))} />
        </label>
        <span className="mono notice">{clock((at?.t ?? start) - start)}</span>
      </div>
      {current?.paste === true ? (
        <p className={`notice playback-paste${current.ins.length >= LARGE_PASTE ? " large" : ""}`}>
          <ClipboardPaste aria-hidden="true" /> Pasted {current.ins.length} characters here
        </p>
      ) : null}
      <pre className="code playback-code" aria-label="The code at this step">
        {replay(ops, step)}
      </pre>
      {playback.pastes.length === 0 ? (
        <p className="notice">Nothing was pasted into the editor.</p>
      ) : (
        <>
          <h3>Pastes</h3>
          <ul className="playback-pastes">
            {playback.pastes.map((p, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="quiet"
                  onClick={() => {
                    setPlaying(false);
                    setStep(ops.findIndex((o) => o.paste === true && o.t === p.t) + 1);
                  }}
                >
                  {clock(p.t - start)}: {p.chars} characters{p.chars >= LARGE_PASTE ? " (large)" : ""}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Drawer>
  );
}
