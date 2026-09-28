import { createContext, useContext, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CircleAlert, CircleCheck, CircleX, Info, TriangleAlert, Upload, type LucideIcon } from "lucide-react";
import { Menu, type MenuItem } from "@parikshaa/brand/ui";

/**
 * The console's own kit (the redesign plan's K-pages): the page header every
 * page shares, the figure strip, the "⋯" row menu, badges in the glossary's
 * words, empty and loading states, banners, the drop zone and the stat bar.
 * Styles are in `styles.css` under "the console kit".
 */

// --- the page header -----------------------------------------------------------

interface Slots {
  readonly status: HTMLElement | null;
  readonly meta: HTMLElement | null;
  readonly actions: HTMLElement | null;
}
const PageSlots = createContext<Slots>({ status: null, meta: null, actions: null });

/**
 * Every console page's header: its title, a status chip beside it, one meta
 * line under it, and its actions to the right. The page's own panel fills
 * the chip, the line and the actions from wherever it is, with `PageStatus`,
 * `PageMeta` and `PageActions`; the purpose line shows while no meta line does.
 */
export function PageFrame({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  const [status, setStatus] = useState<HTMLElement | null>(null);
  const [meta, setMeta] = useState<HTMLElement | null>(null);
  const [actions, setActions] = useState<HTMLElement | null>(null);
  return (
    <PageSlots.Provider value={{ status, meta, actions }}>
      <header className="page-head">
        <div className="page-head-main">
          <div className="page-title">
            <h1>{title}</h1>
            <span ref={setStatus} className="page-status" />
          </div>
          <div ref={setMeta} className="page-meta" />
          <p className="notice page-note">{note}</p>
        </div>
        <div ref={setActions} className="page-actions" />
      </header>
      {children}
    </PageSlots.Provider>
  );
}

const slot = (name: keyof Slots) =>
  function Slot({ children }: { children: ReactNode }) {
    const target = useContext(PageSlots)[name];
    return target === null ? null : createPortal(children, target);
  };

/** A chip beside the page's title: an exam's lifecycle, say. */
export const PageStatus = slot("status");
/** One line under the title: "Opens 1 Oct, 10:00 am IST · 60 min · 22 marks". */
export const PageMeta = slot("meta");
/** The page's actions, top right: downloads, Invite, New exam. */
export const PageActions = slot("actions");

// --- figures ------------------------------------------------------------------

export interface Figure {
  readonly label: string;
  readonly value: ReactNode;
  readonly icon?: LucideIcon;
  /** Coloured only when it asks something of the reader. */
  readonly tone?: "live" | "attention" | "ok" | "bad";
  /** Opens what the figure counts: "To grade 4" opens the exams to grade. */
  readonly onOpen?: () => void;
}

/**
 * Up to four headline figures, then a line of the lesser ones. Four sit in
 * one row, two by two on a narrow screen; three stay in one row, so no row
 * ever leaves a single tile on its own.
 */
export function FigureStrip({ figures, line, label = "At a glance" }: { figures: readonly Figure[]; line?: readonly { label: string; value: ReactNode }[]; label?: string }) {
  const shown = figures.slice(0, 4);
  return (
    <section className="figure-strip" aria-label={label}>
      <div className="figure-tiles" data-count={shown.length}>
        {shown.map(({ label: name, value, icon: Icon, tone, onOpen }) => {
          const body = (
            <>
              {Icon === undefined ? null : (
                <span className="figure-icon" aria-hidden="true">
                  <Icon />
                </span>
              )}
              <span className="figure-value">{value}</span>
              <span className="figure-label">{name}</span>
            </>
          );
          const className = `figure-tile${tone === undefined ? "" : ` ${tone}`}`;
          return onOpen === undefined ? (
            <div key={name} className={className}>
              {body}
            </div>
          ) : (
            <button key={name} type="button" className={`${className} opens`} onClick={onOpen}>
              {body}
            </button>
          );
        })}
      </div>
      {line === undefined || line.length === 0 ? null : (
        <dl className="figure-line">
          {line.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

// --- the row menu ----------------------------------------------------------------

/**
 * A row's other actions behind "⋯", named for the row so a screen reader
 * hears which. With nothing to offer it is left out; `keepPlace` holds its
 * width, so the visible action beside it lines up with the other rows'.
 */
export function RowMenu({ of, items, keepPlace = false }: { of: string; items: readonly (MenuItem | null | false)[]; keepPlace?: boolean }) {
  const shown = items.filter((item): item is MenuItem => item !== null && item !== false);
  if (shown.length === 0) return keepPlace ? <span className="row-menu-place" aria-hidden="true" /> : null;
  return <Menu label={`More actions for ${of}`} items={shown} className="row-menu" />;
}

// --- badges: one word per state -------------------------------------------------

export type AttemptState = "not_started" | "in_progress" | "submitted" | "graded" | "void";

/** The glossary's words for where an attempt stands. */
export const ATTEMPT_WORDS: Record<AttemptState, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "To grade",
  graded: "Graded",
  void: "Set aside",
};

export function StateBadge({ state }: { state: AttemptState }) {
  return (
    <span className="pill" data-state={state}>
      {ATTEMPT_WORDS[state]}
    </span>
  );
}

/** Qualified or not: an icon, never a dot. */
export function OutcomeBadge({ qualified }: { qualified: boolean }) {
  const Icon = qualified ? CircleCheck : CircleX;
  return (
    <span className={`pill outcome ${qualified ? "ok" : "bad"}`}>
      <Icon aria-hidden="true" />
      {qualified ? "Qualified" : "Not qualified"}
    </span>
  );
}

export type Phase = "draft" | "scheduled" | "open" | "closed";

export const PHASE_WORDS: Record<Phase, string> = { draft: "Draft", scheduled: "Scheduled", open: "Open now", closed: "Closed" };

/**
 * Where an exam is in its life. A window decides it where there is one; an
 * exam without one (sat by starting attempts directly) is open while anyone
 * is in progress, closed once it has been sat, and a draft before.
 */
export function phaseOf(
  exam: { readonly window?: { readonly opensAt: string; readonly closesAt: string } | null; readonly attempts?: { readonly inProgress: number; readonly submitted: number; readonly graded: number; readonly void: number } },
  now: number = Date.now(),
): Phase {
  const w = exam.window ?? null;
  if (w !== null) {
    if (now < Date.parse(w.opensAt)) return "scheduled";
    return now < Date.parse(w.closesAt) ? "open" : "closed";
  }
  const c = exam.attempts;
  if (c === undefined) return "draft";
  if (c.inProgress > 0) return "open";
  return c.submitted + c.graded + c.void > 0 ? "closed" : "draft";
}

export function PhaseBadge({ phase }: { phase: Phase }) {
  const tone = phase === "open" ? " live" : phase === "scheduled" ? " info" : "";
  return <span className={`pill phase${tone}`}>{PHASE_WORDS[phase]}</span>;
}

// --- empty, loading, trouble ------------------------------------------------------

/** What will appear here, and the one action that fills it. */
export function EmptyState({
  icon: Icon,
  children,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  children: ReactNode;
  action?: { readonly label: string; readonly onClick: () => void; readonly icon?: LucideIcon } | undefined;
  compact?: boolean;
}) {
  const ActionIcon = action?.icon;
  return (
    <div className={`empty-state${compact ? " compact" : ""}`}>
      <Icon aria-hidden="true" className="empty-icon" />
      <p>{children}</p>
      {action === undefined ? null : (
        <button type="button" onClick={action.onClick}>
          {ActionIcon === undefined ? null : <ActionIcon aria-hidden="true" />}
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * Rows the height of the real ones while a list loads, in place of
 * "Loading…" — which is still what a screen reader hears.
 */
export function SkeletonRows({ rows = 4, columns = 4, label = "Loading…" }: { rows?: number; columns?: number; label?: string }) {
  return (
    <div className="skeleton-rows" role="status" aria-busy="true">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="skeleton-row" aria-hidden="true" style={{ gridTemplateColumns: `2fr repeat(${Math.max(0, columns - 1)}, 1fr)` }}>
          {Array.from({ length: columns }, (_, column) => (
            <span key={column} className="skeleton" style={{ width: column === 0 ? `${60 + ((row * 17) % 30)}%` : "60%" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

const BANNER_ICON: Record<"danger" | "warning" | "info" | "success", LucideIcon> = {
  danger: CircleAlert,
  warning: TriangleAlert,
  info: Info,
  success: CircleCheck,
};

/**
 * Something the page needs to say where it happened: a failure (announced
 * at once), a warning, or a note. Failures are banners, not toasts; toasts
 * only confirm.
 */
export function Banner({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "danger" | "warning" | "info" | "success";
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = BANNER_ICON[tone];
  return (
    <div className={`banner ${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <Icon aria-hidden="true" className="banner-icon" />
      <div className="banner-body">
        {title === undefined ? null : <strong>{title}</strong>}
        {children === undefined ? null : <div>{children}</div>}
      </div>
      {action === undefined ? null : <div className="banner-action">{action}</div>}
    </div>
  );
}

// --- the drop zone ------------------------------------------------------------------

/**
 * Where a file is dropped or chosen, in place of the browser's "Choose file".
 * The file input inside stays the control, so the keyboard and screen
 * readers reach it as they would any other.
 */
export function DropZone({
  label,
  name,
  hint,
  accept,
  onFile,
  disabled,
  chosen,
}: {
  label: string;
  /** What the file is, as a screen reader names the control: "Candidate list (CSV)". */
  name?: string;
  hint?: ReactNode;
  accept?: string;
  onFile: (file: File) => void;
  /** Why a file cannot be taken now, if it cannot. */
  disabled?: string | undefined;
  /** The file taken, named once it is. */
  chosen?: string | null | undefined;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`drop-zone${over ? " over" : ""}${disabled === undefined ? "" : " disabled"}`}
      onDragOver={(event) => {
        if (disabled !== undefined) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const file = event.dataTransfer.files[0];
        if (disabled === undefined && file !== undefined) onFile(file);
      }}
    >
      <Upload aria-hidden="true" className="drop-icon" />
      <label htmlFor={id} className="drop-label">
        <span className="drop-action">{label}</span>
        <span className="drop-or"> or drop it here</span>
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        className="drop-input"
        {...(name === undefined ? {} : { "aria-label": name })}
        {...(accept === undefined ? {} : { accept })}
        disabled={disabled !== undefined}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) onFile(file);
          event.target.value = "";
        }}
      />
      {chosen === undefined || chosen === null ? null : <span className="drop-chosen">{chosen}</span>}
      {disabled !== undefined ? <span className="drop-hint">{disabled}</span> : hint === undefined ? null : <span className="drop-hint">{hint}</span>}
    </div>
  );
}

// --- the stat bar -------------------------------------------------------------------

export interface StatSegment {
  readonly id: string;
  readonly label: string;
  readonly value: number;
}

/**
 * One stacked bar of where everyone stands, with the counts beneath it: read
 * at a glance, and it never wraps. Colours come from the categorical ramp,
 * in the order given.
 */
export function StatBar({ segments, label }: { segments: readonly StatSegment[]; label: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <section className="stat-bar" aria-label={label}>
      <div className="stat-track" aria-hidden="true">
        {total === 0
          ? null
          : segments.map((s, index) =>
              s.value === 0 ? null : <span key={s.id} className={`stat-fill cat-${index + 1}`} style={{ flexGrow: s.value }} />,
            )}
      </div>
      <ul className="stat-legend">
        {segments.map((s, index) => (
          <li key={s.id} className={s.value === 0 ? "zero" : undefined}>
            <span className={`stat-swatch cat-${index + 1}`} aria-hidden="true" />
            <span className="stat-count">{s.value}</span>
            <span className="stat-name">{s.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// --- time ------------------------------------------------------------------------------

/** "just now", "2 min ago", "3 h ago", "4 days ago". */
export function ago(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

// --- settings ------------------------------------------------------------------------------

/**
 * One group of settings, as every settings page lays them out: its title and
 * a line on what it does in the left third, its controls in a card on the
 * right. A group that removes or undoes something is a Danger zone, last.
 */
export function SettingsGroup({
  id,
  title,
  description,
  children,
  danger = false,
}: {
  id: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <section id={id} className={`settings-group${danger ? " danger" : ""}`} aria-labelledby={`${id}-title`}>
      <div className="settings-explain">
        <h2 id={`${id}-title`}>{title}</h2>
        <p className="notice">{description}</p>
      </div>
      <div className="card settings-card">{children}</div>
    </section>
  );
}
