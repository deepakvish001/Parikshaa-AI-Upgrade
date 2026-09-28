import { useCallback, useEffect, useState } from "react";
import { CircleCheck, CircleDashed, CircleX, Clock3, FileQuestionMark, Layers, TriangleAlert, Trophy } from "lucide-react";
import type { Briefing, CandidateState, PaperBrief } from "../api.ts";
import { usePreferences } from "../i18n.tsx";
import { KeyTable } from "./Tools.tsx";

type Kind = Briefing["kinds"][number];
const KIND_KEY = {
  mcq: "exam.kind.single",
  multiple: "exam.kind.multiple",
  numeric: "exam.kind.numeric",
  short: "exam.kind.short",
  code: "exam.kind.code",
} as const satisfies Record<Kind, string>;

/** The instructions of a sitting already under way, from the paper the page already has. */
export function briefingOfState(state: CandidateState): PaperBrief {
  const { exam } = state;
  const kinds = new Set<Kind>();
  for (const q of exam.questions) kinds.add(q.kind === "mcq" ? (q.multiple ? "multiple" : "mcq") : q.kind);
  const negativeOf = (q: (typeof exam.questions)[number]) => (q.kind === "mcq" || q.kind === "numeric" ? (q.negativeMarks ?? 0) : 0);
  return {
    title: exam.title,
    durationMs: exam.durationMs,
    questionCount: exam.questions.length,
    totalMarks: exam.questions.reduce((n, q) => n + q.maxScore, 0),
    sections: (state.parts ?? []).map((p) => ({ title: p.title, questionCount: p.questionIds.length, durationMs: p.durationMs })),
    kinds: (["mcq", "multiple", "numeric", "short", "code"] as const).filter((k) => kinds.has(k)),
    negativeMarks: Math.max(0, ...exam.questions.map(negativeOf)),
    allowRevision: exam.allowRevision,
    calculator: exam.calculator ?? false,
    proctored: exam.proctoring != null,
  };
}

const minutes = (ms: number) => Math.round(ms / 60_000);

/**
 * What a computer-based test tells a candidate before they begin: the paper's
 * shape and marking, what the palette's shapes mean, and how to move through
 * it. Shown before the clock on an invitation link, and on demand from the
 * exam bar at any time after.
 */
export function Instructions({ brief }: { readonly brief: PaperBrief }) {
  const { t } = usePreferences();
  const facts = [
    { icon: Clock3, label: t("brief.duration"), value: t("brief.minutes", { n: minutes(brief.durationMs) }) },
    { icon: FileQuestionMark, label: t("brief.questions"), value: String(brief.questionCount) },
    { icon: Trophy, label: t("brief.marks"), value: String(brief.totalMarks) },
    ...(brief.sections.length > 1 ? [{ icon: Layers, label: t("brief.sections"), value: String(brief.sections.length) }] : []),
  ];
  const timed = brief.sections.some((s) => s.durationMs !== null);
  const rules = [
    brief.negativeMarks === 1 ? t("brief.negativeOne") : brief.negativeMarks > 0 ? t("brief.negative", { n: brief.negativeMarks }) : t("brief.noNegative"),
    brief.allowRevision ? t("brief.revision") : t("brief.final"),
    brief.calculator ? t("brief.calculator") : t("brief.noCalculator"),
    ...(timed ? [t("brief.sectionsLocked")] : []),
    ...(brief.proctored ? [t("brief.cameraUsed")] : []),
  ];
  const legend: readonly [string, string][] = [
    ["not-visited", t("palette.notVisited")],
    ["not-answered", t("palette.notAnswered")],
    ["answered", t("palette.answered")],
    ["marked", t("palette.marked")],
    ["answered-marked", `${t("palette.answeredMarked")} ${t("palette.counted")}`],
  ];
  return (
    <div className="instructions">
      <dl className="brief-facts">
        {facts.map(({ icon: Icon, label, value }) => (
          <div key={label}>
            <Icon aria-hidden="true" />
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="brief-paper">
        <h3 id="brief-paper">{t("brief.paper")}</h3>
        {brief.sections.length > 1 ? (
          <table className="brief-sections">
            <thead>
              <tr>
                <th scope="col">{t("brief.section")}</th>
                <th scope="col">{t("brief.questions")}</th>
                <th scope="col">{t("brief.time")}</th>
              </tr>
            </thead>
            <tbody>
              {brief.sections.map((s) => (
                <tr key={s.title}>
                  <td>{s.title}</td>
                  <td>{s.questionCount}</td>
                  <td>{s.durationMs === null ? t("brief.testTime") : t("brief.minutes", { n: minutes(s.durationMs) })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <p className="brief-kinds">
          <span>{t("brief.kinds")}:</span>
          {brief.kinds.map((k) => (
            <span className="kind-chip" key={k}>
              {t(KIND_KEY[k])}
            </span>
          ))}
        </p>
        <ul className="brief-rules">
          {rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="brief-palette">
        <h3 id="brief-palette">{t("brief.palette")}</h3>
        <p className="notice">{t("brief.paletteNote")}</p>
        <ul className="brief-legend">
          {legend.map(([status, label], i) => (
            <li key={status}>
              <span className={`pq ${status}`} aria-hidden="true">
                {i + 1}
              </span>
              {label}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="brief-moving">
        <h3 id="brief-moving">{t("brief.moving")}</h3>
        <ol className="brief-steps">
          <li>{t("brief.move1")}</li>
          <li>{t("brief.move2")}</li>
          <li>{t("brief.move3")}</li>
          <li>{t("brief.move4")}</li>
          <li>{t("brief.move5")}</li>
        </ol>
      </section>

      <section aria-labelledby="brief-keys">
        <h3 id="brief-keys">{t("brief.keysHeading")}</h3>
        <KeyTable />
        <p className="notice">{t("keys.note")}</p>
      </section>
    </div>
  );
}

type CheckState = "checking" | "ok" | "warn" | "bad" | "later";
interface Check {
  readonly id: string;
  readonly label: string;
  readonly state: CheckState;
  readonly detail: string;
}

const ICON = { checking: CircleDashed, ok: CircleCheck, warn: TriangleAlert, bad: CircleX, later: CircleDashed } as const;

/** Where the camera stands for the system check: none, already working, or checked on a step still to come. */
export type CameraCheckState = "none" | "checked" | "next";

/**
 * Whether this machine is ready: the browser, the connection to the server,
 * saving on the device, the screen, and the camera where the test uses one.
 * Each row passes, warns, or fails, and says how to fix what it finds. A
 * problem is explained, never a reason to stop: the candidate decides. On a
 * phone the rows fold into one line while they all pass.
 */
export function SystemCheck({ camera }: { readonly camera: CameraCheckState }) {
  const { t } = usePreferences();
  const [checks, setChecks] = useState<readonly Check[]>([]);
  const [open, setOpen] = useState(false);

  const run = useCallback(async () => {
    const base: Check[] = [];
    const modern = typeof fetch === "function" && typeof Promise === "function" && typeof window.CSS?.supports === "function" && CSS.supports("display", "grid");
    base.push({ id: "browser", label: t("brief.checkBrowser"), state: modern ? "ok" : "bad", detail: modern ? t("brief.ok") : t("brief.browserOld") });
    let storage = false;
    try {
      localStorage.setItem("parikshaa.check", "1");
      localStorage.removeItem("parikshaa.check");
      storage = true;
    } catch {
      storage = false;
    }
    base.push({ id: "storage", label: t("brief.checkStorage"), state: storage ? "ok" : "warn", detail: storage ? t("brief.ok") : t("brief.storageOff") });
    const wide = window.innerWidth >= 600;
    base.push({ id: "screen", label: t("brief.checkScreen"), state: wide ? "ok" : "warn", detail: wide ? t("brief.ok") : t("brief.screenSmall") });
    if (camera === "checked") base.push({ id: "camera", label: t("brief.checkCamera"), state: "ok", detail: t("brief.cameraOk") });
    if (camera === "next") base.push({ id: "camera", label: t("brief.checkCamera"), state: "later", detail: t("brief.cameraNext") });
    const connection: Check = { id: "connection", label: t("brief.checkConnection"), state: "checking", detail: t("brief.checking") };
    setChecks([connection, ...base]);

    let measured: Check;
    try {
      const started = performance.now();
      const response = await fetch("/api/health", { cache: "no-store" });
      const ms = Math.round(performance.now() - started);
      measured = !response.ok
        ? { ...connection, state: "bad", detail: t("brief.offline") }
        : ms < 800
          ? { ...connection, state: "ok", detail: t("brief.fast", { ms }) }
          : { ...connection, state: "warn", detail: t("brief.slow", { ms }) };
    } catch {
      measured = { ...connection, state: "bad", detail: t("brief.offline") };
    }
    setChecks([measured, ...base]);
  }, [camera, t]);

  useEffect(() => {
    void run();
  }, [run]);

  const done = checks.filter((c) => c.state !== "checking" && c.state !== "later");
  const passed = done.filter((c) => c.state === "ok").length;
  const settled = checks.length > 0 && !checks.some((c) => c.state === "checking");
  const allPassed = settled && passed === done.length;

  return (
    <section className={`syscheck${allPassed && !open ? " folded" : ""}`} aria-labelledby="syscheck-title">
      <div className="syscheck-head">
        <h3 id="syscheck-title">{t("brief.check")}</h3>
        <button type="button" className="quiet" onClick={() => void run()}>
          {t("brief.again")}
        </button>
      </div>
      {allPassed ? (
        <p className="syscheck-summary">
          <CircleCheck aria-hidden="true" />
          <span>{t("brief.allPassed", { n: passed })}</span>
          <button type="button" className="link" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? t("brief.hideChecks") : t("brief.showChecks")}
          </button>
        </p>
      ) : null}
      <ul aria-live="polite">
        {checks.map((c) => {
          const Icon = ICON[c.state];
          return (
            <li key={c.id} className={`check ${c.state}`}>
              <Icon aria-hidden="true" />
              <span className="check-label">{c.label}</span>
              <span className="check-detail">{c.detail}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The last step before the clock: who is sitting it, the instructions, the
 * system check, and a declaration. Nothing here runs the clock; it starts
 * only with the last button.
 */
export function BriefingScreen({ brief, onBegin, cameraChecked = false }: { readonly brief: Briefing; readonly onBegin: () => void; readonly cameraChecked?: boolean }) {
  const { t } = usePreferences();
  const [declared, setDeclared] = useState(false);
  const initials = brief.candidate.name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <section className="briefing" aria-labelledby="briefing-title">
      <header className="briefing-head">
        <div>
          <p className="eyebrow">{t("brief.heading")}</p>
          <h1 id="briefing-title">{brief.title}</h1>
        </div>
        <div className="candidate-card" aria-label={t("brief.candidate")}>
          <span className="avatar" aria-hidden="true">
            {initials || "?"}
          </span>
          <span>
            <strong>{brief.candidate.name || brief.candidate.ref}</strong>
            <small>
              {t("brief.roll")}: {brief.candidate.ref}
            </small>
          </span>
        </div>
      </header>
      <div className="briefing-body">
        <Instructions brief={brief} />
        <aside className="briefing-side">
          <SystemCheck camera={!brief.proctored ? "none" : cameraChecked ? "checked" : "next"} />
          <div className="declare">
            <label className="inline">
              <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} /> {t("brief.declare")}
            </label>
            <button type="button" className="large block" disabled={!declared} onClick={onBegin}>
              {t("brief.begin")}
            </button>
            <p className="notice">{t("brief.clockNote")}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
