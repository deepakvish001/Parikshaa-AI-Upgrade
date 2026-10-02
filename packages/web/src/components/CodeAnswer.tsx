import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react";
import { CircleCheck, CircleX, Lock, Maximize2, Minimize2, Minus, Moon, Play, Plus, RotateCcw, Send } from "lucide-react";
import type { CandidateCodeQuestion } from "@parikshaa/core/browser";
import { ApiError, type RunOutcome, type SubmitOutcome } from "../api.ts";
import { usePreferences, type MessageKey } from "../i18n.tsx";
import { argumentsOf, LANGUAGE_NAMES, memory, readCodeAnswer, starterIn } from "./code-meta.ts";
import { SqlResult } from "./SqlTables.tsx";
import { ArgumentList, ProblemStatement } from "./ProblemStatement.tsx";
import { SplitPane } from "./SplitPane.tsx";

export { readCodeAnswer } from "./code-meta.ts";

/**
 * The editor is loaded only for an exam that has a code question. Most papers
 * have none, and a candidate on a slow connection should not download an
 * editor and four grammars to answer multiple choice. Until it arrives, a plain
 * text area does the same job.
 */
const CodeEditor = lazy(() => import("./CodeEditor.tsx").then((m) => ({ default: m.CodeEditor })));

interface Props {
  readonly question: CandidateCodeQuestion;
  /** The question's number on the paper. */
  readonly number?: number;
  /** The stored answer: `{language, source}` as JSON, or plain source from before languages could be chosen. */
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
  readonly onRun: (language: string, source: string, input?: string) => Promise<RunOutcome>;
  /** Commit and test against every test. Absent: the page offers no Submit. */
  readonly onSubmit?: (language: string, source: string) => Promise<SubmitOutcome>;
  readonly submitLabel?: string;
  /** Whether the exam allows completion in the editor. */
  readonly completion?: boolean;
  /**
   * A page of its own, as on a practice site: this beside the editor, always,
   * in place of the statement — which it then includes, with whatever else.
   */
  readonly aside?: ReactNode;
  /** Shown in place of Run and Submit: a visitor asked to sign in first. */
  readonly blocked?: ReactNode;
  /** Open full screen from the start, as a coding round's screen does on a wide display. */
  readonly startFull?: boolean;
  /** Beside the full-screen workspace, on its left: the paper's question numbers. */
  readonly rail?: ReactNode;
}

// --- editor preferences --------------------------------------------------------

interface EditorPrefs {
  readonly dark: boolean;
  readonly fontSize: number;
}
const PREFS_KEY = "parikshaa.editor";
const DEFAULT_PREFS: EditorPrefs = { dark: false, fontSize: 14 };

/** Theme and text size, kept on this device like a reading-glasses setting. */
function useEditorPrefs(): [EditorPrefs, (next: EditorPrefs) => void] {
  const [prefs, setPrefs] = useState<EditorPrefs>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") as Partial<EditorPrefs> | null;
      return { dark: stored?.dark === true, fontSize: typeof stored?.fontSize === "number" ? stored.fontSize : DEFAULT_PREFS.fontSize };
    } catch {
      return DEFAULT_PREFS;
    }
  });
  const save = (next: EditorPrefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // Private window: the setting lasts this page.
    }
  };
  return [prefs, save];
}

// --- the workspace ---------------------------------------------------------------

type Busy = "run" | "submit" | null;
type Shown = { readonly kind: "run"; readonly outcome: RunOutcome; readonly custom: boolean } | { readonly kind: "submit"; readonly outcome: SubmitOutcome };

/**
 * Answering a code question, as on LeetCode: the problem, an editor, and a
 * console with the test cases and what running them did.
 *
 * Run tries the code on the examples, or on a case of the candidate's own, and
 * records nothing. Submit commits the answer and runs it against every test,
 * reporting as much as the exam allows. It sits in the question's card, and
 * opens full screen with the problem beside the editor.
 */
export function CodeAnswer({ question, number = 1, value, disabled, onChange, onRun, onSubmit, submitLabel, completion = false, aside, blocked, startFull = false, rail }: Props) {
  const { t, lite } = usePreferences();
  const { language, source } = readCodeAnswer(value, question);
  const functionMode = question.function !== null && question.function !== undefined;
  const params = question.function?.params ?? [];

  const [prefs, setPrefs] = useEditorPrefs();
  const [full, setFull] = useState(startFull);
  // On a phone the full-screen workspace shows one pane at a time, by tab.
  const [phoneTab, setPhoneTab] = useState<"problem" | "code" | "result">("code");
  const [top, setTop] = useState(0);
  const [tab, setTab] = useState<"testcase" | "result">("testcase");
  const [picked, setPicked] = useState<number | "custom">(question.samples.length > 0 ? 0 : "custom");
  const [customStdin, setCustomStdin] = useState(question.samples[0]?.input ?? "");
  const [customArgs, setCustomArgs] = useState<string[]>(() => params.map((_p, i) => argumentsOf(question.samples[0]?.input ?? "")[i] ?? ""));
  const [busy, setBusy] = useState<Busy>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const headingId = `ws-${question.id}-title`;

  const write = (next: { language: string; source: string }) => onChange(JSON.stringify(next));
  const customInput = functionMode ? customArgs.join("\n") : customStdin;
  const canAct = !disabled && busy === null && source.trim() !== "";

  const run = async () => {
    if (!canAct) return;
    const custom = picked === "custom";
    setBusy("run");
    setFailed(null);
    setTab("result");
    try {
      setShown({ kind: "run", outcome: await onRun(language, source, custom ? customInput : undefined), custom });
    } catch (error) {
      setShown(null);
      setFailed(error instanceof Error && error.message.includes("503") ? t("code.cannotRun") : t("code.runFailed"));
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!canAct || onSubmit === undefined) return;
    setBusy("submit");
    setFailed(null);
    setTab("result");
    try {
      setShown({ kind: "submit", outcome: await onSubmit(language, source) });
    } catch (error) {
      setShown(null);
      // Kept on the device for later (practice, offline): say that, not that it failed.
      const kept = error instanceof ApiError && error.code === "queued_offline" && typeof error.detail["message"] === "string" ? error.detail["message"] : null;
      setFailed(kept ?? (error instanceof Error && error.message.includes("503") ? t("code.cannotRun") : t("code.runFailed")));
    } finally {
      setBusy(null);
    }
  };

  const switchLanguage = (next: string) => {
    // Untouched starter code follows the language; anything the candidate wrote stays.
    const untouched = source.trim() === "" || source === starterIn(question, language);
    write({ language: next, source: untouched ? starterIn(question, next) : source });
  };

  const reset = () => {
    if (window.confirm(t("code.resetConfirm"))) write({ language, source: starterIn(question, language) });
  };

  // Full screen: below the page's top bar, so the clock stays in sight; the page behind does not scroll.
  useEffect(() => {
    if (!full) return;
    const place = () => setTop(document.querySelector(".exambar, .topbar")?.getBoundingClientRect().bottom ?? 0);
    place();
    window.addEventListener("resize", place);
    document.body.classList.add("workspace-open");
    document.getElementById(headingId)?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("resize", place);
      document.body.classList.remove("workspace-open");
    };
  }, [full, headingId]);

  const closeFull = () => {
    setFull(false);
    setTimeout(() => toggle.current?.focus(), 0);
  };

  const plain = (
    <textarea
      className="code"
      aria-label={t("code.editorFor", { n: number })}
      spellCheck={false}
      value={source}
      disabled={disabled}
      onChange={(e) => write({ language, source: e.target.value })}
    />
  );

  const editor = (
    <div className="ws-editor">
      {/* Low-bandwidth mode never downloads the editor: the plain text area answers just as well. */}
      {lite ? (
        plain
      ) : (
        <Suspense fallback={plain}>
          <CodeEditor
            value={source}
            language={language}
            label={t("code.editorFor", { n: number })}
            disabled={disabled}
            onChange={(next) => write({ language, source: next })}
            dark={prefs.dark}
            fontSize={prefs.fontSize}
            completion={completion}
            onRunShortcut={() => void run()}
            {...(onSubmit === undefined ? {} : { onSubmitShortcut: () => void submit() })}
          />
        </Suspense>
      )}
    </div>
  );

  const toolbar = (
    <div className="ws-bar" role="toolbar" aria-label={t("code.editor")}>
      {question.languages.length > 1 ? (
        <label className="ws-language">
          <span className="visually-hidden">{t("code.language")}</span>
          <select aria-label={t("code.language")} value={language} disabled={disabled} onChange={(e) => switchLanguage(e.target.value)}>
            {question.languages.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_NAMES[l] ?? l}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <span className="ws-language notice">{LANGUAGE_NAMES[language] ?? language}</span>
      )}
      <span className="spacer" />
      {lite ? null : (
        <>
          <button type="button" className="icon-button" aria-pressed={prefs.dark} title={t("code.dark")} onClick={() => setPrefs({ ...prefs, dark: !prefs.dark })}>
            <Moon aria-hidden="true" />
            <span className="visually-hidden">{t("code.dark")}</span>
          </button>
          <button
            type="button"
            className="icon-button"
            title={t("code.smaller")}
            disabled={prefs.fontSize <= 11}
            onClick={() => setPrefs({ ...prefs, fontSize: prefs.fontSize - 1 })}
          >
            <Minus aria-hidden="true" />
            <span className="visually-hidden">{t("code.smaller")}</span>
          </button>
          <button
            type="button"
            className="icon-button"
            title={t("code.larger")}
            disabled={prefs.fontSize >= 22}
            onClick={() => setPrefs({ ...prefs, fontSize: prefs.fontSize + 1 })}
          >
            <Plus aria-hidden="true" />
            <span className="visually-hidden">{t("code.larger")}</span>
          </button>
        </>
      )}
      <button type="button" className="icon-button" title={t("code.reset")} disabled={disabled} onClick={reset}>
        <RotateCcw aria-hidden="true" />
        <span className="visually-hidden">{t("code.reset")}</span>
      </button>
      {aside === undefined ? (
        <button
          ref={toggle}
          type="button"
          className="icon-button"
          title={full ? t("code.exitFullscreen") : t("code.fullscreen")}
          onClick={() => (full ? closeFull() : setFull(true))}
        >
          {full ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
          <span className="visually-hidden">{full ? t("code.exitFullscreen") : t("code.fullscreen")}</span>
        </button>
      ) : null}
    </div>
  );

  const actions = disabled ? null : blocked !== undefined ? (
    <div className="ws-actions">{blocked}</div>
  ) : (
    <div className="ws-actions">
      <span className="notice shortcuts">{t("code.shortcuts")}</span>
      <span className="spacer" />
      <button type="button" className="secondary" disabled={!canAct} onClick={() => void run()}>
        <Play aria-hidden="true" />
        {busy === "run" ? t("code.running") : t("code.run")}
      </button>
      {onSubmit === undefined ? null : (
        <button type="button" className="submit" disabled={!canAct} onClick={() => void submit()}>
          <Send aria-hidden="true" />
          {busy === "submit" ? t("code.submitting") : (submitLabel ?? t("code.submit"))}
        </button>
      )}
    </div>
  );

  const console_ = (
    <div className="ws-console">
      <div className="ws-tabs" role="tablist" aria-label={t("code.result")}>
        {(["testcase", "result"] as const).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`${question.id}-tab-${name}`}
            aria-selected={tab === name}
            aria-controls={`${question.id}-panel-${name}`}
            className={tab === name ? "on" : ""}
            onClick={() => setTab(name)}
          >
            {name === "testcase" ? t("code.testcase") : t("code.result")}
          </button>
        ))}
      </div>
      <div className="ws-panel" role="tabpanel" id={`${question.id}-panel-${tab}`} aria-labelledby={`${question.id}-tab-${tab}`}>
        {tab === "testcase" ? (
          <>
            <div className="case-chips">
              {question.samples.map((_s, i) => (
                <button key={i} type="button" className="chip" aria-pressed={picked === i} onClick={() => setPicked(i)}>
                  {t("code.case", { n: i + 1 })}
                </button>
              ))}
              <button type="button" className="chip" aria-pressed={picked === "custom"} onClick={() => setPicked("custom")}>
                {t("code.custom")}
              </button>
            </div>
            {picked !== "custom" ? (
              functionMode ? (
                <ArgumentList question={question} input={question.samples[picked]?.input ?? ""} />
              ) : (
                <pre className="case-input">{question.samples[picked]?.input}</pre>
              )
            ) : functionMode ? (
              <div className="custom-args">
                <p className="notice">{t("code.customArgs")}</p>
                {params.map((p, i) => (
                  <label key={p.name} className="field">
                    <span className="arg-name">{p.name} =</span>
                    <input
                      className="code"
                      spellCheck={false}
                      value={customArgs[i] ?? ""}
                      disabled={disabled}
                      onChange={(e) => setCustomArgs(customArgs.map((a, j) => (j === i ? e.target.value : a)))}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <label className="field">
                <span className="notice">{t("code.customStdin")}</span>
                <textarea className="code" spellCheck={false} value={customStdin} disabled={disabled} onChange={(e) => setCustomStdin(e.target.value)} />
              </label>
            )}
            {disabled ? null : <p className="notice run-note">{t("code.runNote")}</p>}
          </>
        ) : failed !== null ? (
          <p className="error">{failed}</p>
        ) : shown === null ? (
          <p className="notice">{t("code.nothingYet")}</p>
        ) : shown.kind === "run" ? (
          <RunView question={question} outcome={shown.outcome} custom={shown.custom} />
        ) : (
          <SubmitView question={question} outcome={shown.outcome} />
        )}
      </div>
    </div>
  );

  if (aside !== undefined) {
    return (
      <div className={`workspace standalone${prefs.dark && !lite ? " ws-dark" : ""}`} {...(prefs.dark && !lite ? { "data-theme": "dark" } : {})}>
        <SplitPane
          direction="row"
          initial={44}
          label={t("code.problem")}
          className="ws-main"
          first={<div className="ws-statement">{aside}</div>}
          second={
            <SplitPane
              direction="column"
              initial={62}
              label={t("code.result")}
              first={
                <div className="ws-code">
                  {toolbar}
                  {editor}
                </div>
              }
              second={console_}
            />
          }
        />
        {actions}
      </div>
    );
  }

  if (full) {
    return (
      <div
        className={`workspace full${prefs.dark && !lite ? " ws-dark" : ""}${rail === undefined ? "" : " with-rail"}`}
        {...(prefs.dark && !lite ? { "data-theme": "dark" } : {})}
        data-phone-tab={phoneTab}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        style={{ top }}
      >
        {rail === undefined ? null : <div className="ws-rail">{rail}</div>}
        {toolbar}
        <div className="ws-phone-tabs" role="tablist" aria-label={t("code.editor")}>
          {(["problem", "code", "result"] as const).map((tab) => (
            <button key={tab} type="button" role="tab" aria-selected={phoneTab === tab} onClick={() => setPhoneTab(tab)}>
              {tab === "problem" ? t("code.problem") : tab === "code" ? t("code.code") : t("code.result")}
            </button>
          ))}
        </div>
        <SplitPane
          direction="row"
          initial={40}
          remember="code-problem"
          label={t("code.problem")}
          className="ws-main"
          first={
            <div className="ws-statement">
              <ProblemStatement question={question} number={number} withTitle headingId={headingId} />
            </div>
          }
          second={<SplitPane direction="column" initial={60} remember="code-result" label={t("code.result")} first={editor} second={console_} />}
        />
        {actions}
      </div>
    );
  }

  return (
    <div className="workspace">
      <ProblemStatement question={question} number={number} withTitle={false} />
      {toolbar}
      {editor}
      {actions}
      {console_}
    </div>
  );
}

// --- results -----------------------------------------------------------------------

const statusKey = (status: string) => `code.status.${status}` as MessageKey;

function Meta({ timeMs, memoryKb }: { readonly timeMs: number; readonly memoryKb: number | null | undefined }) {
  const { t } = usePreferences();
  const used = memory(memoryKb);
  return (
    <p className="run-meta">
      {t("code.runtime")}: {timeMs} ms{used === null ? null : ` · ${t("code.memory")}: ${used}`}
    </p>
  );
}

function Block({ label, text, className, sql = false }: { readonly label: string; readonly text: string; readonly className?: string; readonly sql?: boolean }) {
  const { t } = usePreferences();
  return (
    <div className="run-block">
      <span className="eyebrow">{label}</span>
      {sql ? (
        <SqlResult text={text} label={label} />
      ) : (
        <pre className={className} aria-label={label}>
          {text === "" ? t("code.noOutput") : text}
        </pre>
      )}
    </div>
  );
}

function StatusIcon({ status }: { readonly status: string }) {
  return status === "passed" ? <CircleCheck aria-hidden="true" className="ok" /> : status === "ran" ? null : <CircleX aria-hidden="true" className="bad" />;
}

/** What Run did: the examples one by one, or the candidate's own case. */
function RunView({ question, outcome, custom }: { readonly question: CandidateCodeQuestion; readonly outcome: RunOutcome; readonly custom: boolean }) {
  const { t } = usePreferences();
  const [at, setAt] = useState(0);
  const functionMode = question.function !== null && question.function !== undefined;
  const sql = question.language === "sql";
  if (!outcome.compiled) {
    return (
      <section className="run-output" aria-label="Compiler output" data-status="compile_error">
        <p className="verdict bad">{t("code.compileError")}</p>
        <pre className="stderr">{outcome.compileOutput}</pre>
      </section>
    );
  }
  const results = outcome.results;
  const passed = results.filter((r) => r.status === "passed").length;
  const first = results.find((r) => r.status !== "passed" && r.status !== "ran")?.status;
  const shownResult = results[Math.min(at, results.length - 1)];
  return (
    <section className="run-output" aria-label="Run results">
      <p className={`verdict ${first === undefined ? "ok" : "bad"}`} data-status={first ?? "passed"}>
        {custom ? t("code.status.ran") : first === undefined ? t("code.status.passed") : t(statusKey(first))}
        {custom ? null : <span className="verdict-count"> · {t("code.examplesPass", { passed, total: results.length })}</span>}
      </p>
      {results.length > 1 ? (
        <div className="case-chips">
          {results.map((r, i) => (
            <button key={i} type="button" className="chip" data-status={r.status} aria-pressed={i === at} onClick={() => setAt(i)}>
              <StatusIcon status={r.status} />
              {t("code.case", { n: i + 1 })}
            </button>
          ))}
        </div>
      ) : null}
      {shownResult === undefined ? null : (
        <div className="run-result" data-status={shownResult.status}>
          {results.length === 1 && !custom ? <p className="eyebrow">{t(statusKey(shownResult.status))}</p> : null}
          {functionMode ? (
            <div className="run-block">
              <span className="eyebrow">{t("code.input")}</span>
              <ArgumentList question={question} input={shownResult.input} />
            </div>
          ) : (
            <Block label={t("code.input")} text={shownResult.input} />
          )}
          <Block label={t("code.output")} text={functionMode ? (shownResult.result ?? "null") : shownResult.stdout} sql={sql} />
          {shownResult.expectedOutput === null ? null : <Block label={t("code.expected")} text={shownResult.expectedOutput} sql={sql} />}
          {functionMode && shownResult.stdout !== "" ? <Block label={t("code.stdout")} text={shownResult.stdout} /> : null}
          {shownResult.stderr === "" ? null : <Block label="stderr" text={shownResult.stderr} className="stderr" />}
          {shownResult.checkerMessage === null || shownResult.checkerMessage === undefined ? null : (
            <Block label={t("code.checkerSays")} text={shownResult.checkerMessage} />
          )}
          <Meta timeMs={shownResult.timeMs} memoryKb={shownResult.memoryKb} />
        </div>
      )}
    </section>
  );
}

/** What Submit found: an overall verdict, the count if the exam tells it, and each test. */
function SubmitView({ question, outcome }: { readonly question: CandidateCodeQuestion; readonly outcome: SubmitOutcome }) {
  const { t } = usePreferences();
  const [at, setAt] = useState(0);
  const functionMode = question.function !== null && question.function !== undefined;
  const sql = question.language === "sql";
  if (!outcome.tested) {
    return (
      <section className="run-output" aria-label="Submission results">
        <p className="notice">{outcome.reason === "no_tests" ? t("code.noTests") : t("code.notTested")}</p>
      </section>
    );
  }
  if (!outcome.compiled) {
    return (
      <section className="run-output" aria-label="Compiler output" data-status="compile_error">
        <p className="verdict bad">{t("code.compileError")}</p>
        <pre className="stderr">{outcome.compileOutput}</pre>
      </section>
    );
  }
  const cases = outcome.cases;
  const failing = cases.find((c) => c.status !== "passed")?.status;
  const slowest = Math.max(0, ...cases.map((c) => c.timeMs));
  const heaviest = Math.max(0, ...cases.map((c) => c.memoryKb ?? 0));
  const picked = cases[Math.min(at, cases.length - 1)];
  return (
    <section className="run-output submission" aria-label="Submission results">
      <p className={`verdict ${failing === undefined ? "ok" : "bad"}`} data-status={failing ?? "passed"}>
        {failing === undefined ? t("code.status.passed") : t(statusKey(failing))}
        {outcome.passed === null || outcome.total === null ? null : (
          <span className="verdict-count"> · {t("code.passedOf", { passed: outcome.passed, total: outcome.total })}</span>
        )}
      </p>
      {outcome.passed === null ? <p className="notice">{t("code.hiddenLater")}</p> : null}
      <Meta timeMs={slowest} memoryKb={heaviest === 0 ? null : heaviest} />
      <div className="case-chips">
        {cases.map((c, i) => (
          <button key={c.number} type="button" className="chip" data-status={c.status} aria-pressed={i === at} onClick={() => setAt(i)}>
            <StatusIcon status={c.status} />
            {c.visible ? t("code.test", { n: c.number }) : t("code.hiddenTest", { n: c.number })}
            {c.visible ? null : <Lock aria-hidden="true" className="lock" />}
          </button>
        ))}
      </div>
      {picked === undefined ? null : picked.visible ? (
        <div className="run-result" data-status={picked.status}>
          <p className="eyebrow">{t(statusKey(picked.status))}</p>
          {functionMode ? (
            <div className="run-block">
              <span className="eyebrow">{t("code.input")}</span>
              <ArgumentList question={question} input={picked.input ?? ""} />
            </div>
          ) : (
            <Block label={t("code.input")} text={picked.input ?? ""} />
          )}
          <Block label={t("code.output")} text={functionMode ? (picked.result ?? "null") : (picked.stdout ?? "")} sql={sql} />
          <Block label={t("code.expected")} text={picked.expectedOutput ?? ""} sql={sql} />
          {picked.stderr === null || picked.stderr === "" ? null : <Block label="stderr" text={picked.stderr} className="stderr" />}
          <Meta timeMs={picked.timeMs} memoryKb={picked.memoryKb} />
        </div>
      ) : (
        <div className="run-result" data-status={picked.status}>
          <p className="eyebrow">{t(statusKey(picked.status))}</p>
          <p className="notice">{t("code.hiddenNote")}</p>
          <Meta timeMs={picked.timeMs} memoryKb={picked.memoryKb} />
        </div>
      )}
    </section>
  );
}
