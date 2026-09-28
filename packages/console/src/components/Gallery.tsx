import { useState } from "react";
import { Hourglass, Pencil, Plus, SquareCheckBig, Trash2 } from "lucide-react";
import { LogoMark, Wordmark } from "@parikshaa/brand/react";
import { Dialog, Drawer, TabPanel, Tabs, Tooltip, useToast } from "@parikshaa/brand/ui";

/**
 * The design system on one page: tokens, type, the plain components and the
 * shared interactive ones, live, so a change to any of them is seen in one
 * place before it is seen everywhere. Reached from Ctrl+K ("Design system").
 */

const COLOURS: readonly (readonly [string, string])[] = [
  ["--primary", "Primary"],
  ["--accent", "Accent"],
  ["--text", "Text"],
  ["--text-muted", "Muted text"],
  ["--success", "Success"],
  ["--warning", "Warning"],
  ["--danger", "Danger"],
  ["--chrome", "Chrome"],
  ["--bg", "Canvas"],
  ["--surface", "Surface"],
  ["--surface-2", "Surface 2"],
  ["--border", "Border"],
];

const TYPE: readonly (readonly [string, string])[] = [
  ["--text-3xl", "36 · Page titles on the sign-in"],
  ["--text-2xl", "28 · Page titles"],
  ["--text-xl", "22 · Section titles"],
  ["--text-lg", "18 · Card titles"],
  ["--text-md", "16 · Candidate body"],
  ["--text-base", "14 · Console body"],
  ["--text-sm", "13 · Secondary"],
  ["--text-xs", "12 · Labels"],
];

export function Gallery() {
  const toast = useToast();
  const [tab, setTab] = useState<"one" | "two" | "three">("one");
  const [open, setOpen] = useState<"dialog" | "drawer" | null>(null);
  return (
    <div className="gallery">
      <section className="card" aria-label="The mark">
        <h2 className="card-title">The mark</h2>
        <div className="row" style={{ alignItems: "center", gap: "2rem" }}>
          <LogoMark size={56} />
          <Wordmark size={32} />
          <span className="gallery-chrome">
            <Wordmark size={28} product="Console" />
          </span>
        </div>
      </section>

      <section className="card" aria-label="Colour">
        <h2 className="card-title">Colour</h2>
        <ul className="swatches">
          {COLOURS.map(([token, name]) => (
            <li key={token}>
              <span className="swatch" style={{ background: `var(${token})` }} aria-hidden="true" />
              <span>{name}</span>
              <code className="notice small">{token}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-label="Type">
        <h2 className="card-title">Type</h2>
        <ul className="type-scale">
          {TYPE.map(([token, name]) => (
            <li key={token} style={{ fontSize: `var(${token})` }}>
              {name}
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-label="Buttons and badges">
        <h2 className="card-title">Buttons and badges</h2>
        <div className="row">
          <button type="button">
            <Plus aria-hidden="true" />
            Primary
          </button>
          <button type="button" className="secondary">
            Secondary
          </button>
          <button type="button" className="quiet">
            Quiet
          </button>
          <button type="button" className="danger">
            Danger
          </button>
          <button type="button" disabled>
            Disabled
          </button>
        </div>
        <div className="row">
          <span className="pill ok">Graded</span>
          <span className="pill live">Sitting</span>
          <span className="pill attention">To grade</span>
          <span className="pill bad">Set aside</span>
          <span className="pill brand">Scheduled</span>
          <span className="tag">Multiple choice</span>
        </div>
      </section>

      <section className="card" aria-label="Fields">
        <h2 className="card-title">Fields</h2>
        <div className="grid">
          <div className="field">
            <label htmlFor="g-text">Title</label>
            <input id="g-text" placeholder="Campus drive 2026" />
          </div>
          <div className="field">
            <label htmlFor="g-select">Revision</label>
            <select id="g-select">
              <option>Answers may be changed</option>
            </select>
          </div>
          <label className="inline">
            <input type="checkbox" defaultChecked style={{ width: "auto" }} /> Offer an on-screen calculator
          </label>
        </div>
        <p className="notice">A notice says what something means.</p>
        <p className="error">An error says what went wrong and what to do.</p>
      </section>

      <section className="card" aria-label="Figures">
        <h2 className="card-title">Figures</h2>
        <section className="kpis" aria-label="Example figures">
          <div className="kpi live">
            <span className="kpi-icon" aria-hidden="true">
              <Hourglass />
            </span>
            <span className="kpi-value">12</span>
            <span className="kpi-label">Sitting now</span>
          </div>
          <div className="kpi attention">
            <span className="kpi-icon" aria-hidden="true">
              <SquareCheckBig />
            </span>
            <span className="kpi-value">4</span>
            <span className="kpi-label">To grade</span>
          </div>
        </section>
      </section>

      <section className="card" aria-label="Tabs">
        <h2 className="card-title">Tabs</h2>
        <p className="notice">The arrow keys move between tabs; Home and End go to the ends.</p>
        <Tabs
          label="Example"
          idBase="gallery"
          value={tab}
          onChange={setTab}
          items={[
            { id: "one", label: "Questions" },
            { id: "two", label: "Settings" },
            { id: "three", label: "Results" },
          ]}
        />
        <TabPanel idBase="gallery" id="one" value={tab}>
          <p>The paper, question by question.</p>
        </TabPanel>
        <TabPanel idBase="gallery" id="two" value={tab}>
          <p>Time, the qualifying mark and the candidate's tools.</p>
        </TabPanel>
        <TabPanel idBase="gallery" id="three" value={tab}>
          <p>Who qualified.</p>
        </TabPanel>
      </section>

      <section className="card" aria-label="Overlays">
        <h2 className="card-title">Tooltips, dialogs, drawers and toasts</h2>
        <div className="row" style={{ alignItems: "center" }}>
          <Tooltip text="Edit the question">
            <button type="button" className="quiet icon" aria-label="Edit">
              <Pencil aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip text="Remove from the paper">
            <button type="button" className="quiet icon" aria-label="Remove">
              <Trash2 aria-hidden="true" />
            </button>
          </Tooltip>
          <button type="button" className="secondary" onClick={() => setOpen("dialog")}>
            Open a dialog
          </button>
          <button type="button" className="secondary" onClick={() => setOpen("drawer")}>
            Open a drawer
          </button>
          <button type="button" className="secondary" onClick={() => toast("Saved “Campus drive 2026”", "success")}>
            Show a toast
          </button>
          <button type="button" className="secondary" onClick={() => toast("The download failed; try again.", "error")}>
            Show an error toast
          </button>
        </div>
      </section>

      {open === "dialog" ? (
        <Dialog label="Submit your attempt?" onClose={() => setOpen(null)}>
          <h2 style={{ marginTop: 0 }}>Submit your attempt?</h2>
          <p className="notice">A dialog keeps focus inside it and gives it back when it closes. Escape closes it.</p>
          <div className="row">
            <button type="button" onClick={() => setOpen(null)}>
              Yes, submit
            </button>
            <button type="button" className="quiet" onClick={() => setOpen(null)}>
              Keep working
            </button>
          </div>
        </Dialog>
      ) : null}
      {open === "drawer" ? (
        <Drawer label="Example drawer" onClose={() => setOpen(null)}>
          <h2 style={{ marginTop: 0 }}>A drawer</h2>
          <p className="notice">For choosing from a list beside the page, as the question library does.</p>
          <div className="row">
            <button type="button" onClick={() => setOpen(null)}>
              Close
            </button>
          </div>
        </Drawer>
      ) : null}
    </div>
  );
}
