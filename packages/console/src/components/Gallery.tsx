import { useState } from "react";
import { CircleDot, ClipboardList, Copy, Pencil, Plus, SquareCheckBig, Trash2, Users } from "lucide-react";
import { LogoMark, Wordmark } from "@parikshaa/brand/react";
import { Dialog, Drawer, TabPanel, Tabs, Tooltip, useToast } from "@parikshaa/brand/ui";
import { Banner, DropZone, EmptyState, FigureStrip, OutcomeBadge, PhaseBadge, RowMenu, SkeletonRows, StatBar, StateBadge } from "./kit.tsx";

/**
 * The design system on one page: tokens, type, the plain components and the
 * shared interactive ones, live, so a change to any of them is seen in one
 * place before it is seen everywhere. Reached from Ctrl+K ("Design system").
 */

const COLOURS: readonly (readonly [string, string])[] = [
  ["--primary", "Primary"],
  ["--accent", "Accent"],
  ["--accent-text", "Accent text"],
  ["--chrome", "Chrome"],
  ["--text", "Text"],
  ["--text-secondary", "Secondary text"],
  ["--text-muted", "Muted text"],
  ["--success", "Success"],
  ["--warning", "Warning"],
  ["--danger", "Danger"],
  ["--review", "Review"],
  ["--info", "Info"],
  ["--bg", "Canvas"],
  ["--surface", "Surface"],
  ["--surface-2", "Surface 2"],
  ["--surface-sunken", "Sunken"],
  ["--border", "Border"],
  ["--border-strong", "Strong border"],
];

/** The exam palette's fills, from the solid tokens, as a candidate sees them. */
const PALETTE: readonly (readonly [string, string, string])[] = [
  ["Not visited", "--neutral-solid", "--on-neutral-solid"],
  ["Not answered", "--danger-solid", "--on-danger-solid"],
  ["Answered", "--success-solid", "--on-success-solid"],
  ["Marked for review", "--review-solid", "--on-review-solid"],
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

      <section className="card" aria-label="Solid fills">
        <h2 className="card-title">Solid fills</h2>
        <p className="notice">A fill carries its own text colour, so it reads in both themes: these are the exam palette's.</p>
        <ul className="swatches">
          {PALETTE.map(([name, fill, on], i) => (
            <li key={fill}>
              <span className="swatch solid" style={{ background: `var(${fill})`, color: `var(${on})` }}>
                {i + 1}
              </span>
              <span>{name}</span>
              <code className="notice small">{fill}</code>
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
          <StateBadge state="not_started" />
          <StateBadge state="in_progress" />
          <StateBadge state="submitted" />
          <StateBadge state="graded" />
          <StateBadge state="void" />
          <OutcomeBadge qualified />
          <OutcomeBadge qualified={false} />
        </div>
        <div className="row">
          <PhaseBadge phase="draft" />
          <PhaseBadge phase="scheduled" />
          <PhaseBadge phase="open" />
          <PhaseBadge phase="closed" />
          <span className="tag">Multiple choice</span>
        </div>
        <p className="notice">Sentence case, one word per state. A dot only on what is live now; an icon only on an outcome; never both.</p>
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
        <h2 className="card-title">Figures and the stat bar</h2>
        <FigureStrip
          label="Example figures"
          figures={[
            { label: "In progress", value: 12, icon: CircleDot, tone: "live" },
            { label: "To grade", value: 4, icon: SquareCheckBig, tone: "attention" },
            { label: "Exams", value: 9, icon: ClipboardList },
            { label: "Candidates invited", value: 480, icon: Users },
          ]}
          line={[
            { label: "Median", value: "62%" },
            { label: "Set aside", value: 1 },
          ]}
        />
        <StatBar
          label="Example sitting"
          segments={[
            { id: "not_started", label: "Not started", value: 6 },
            { id: "in_progress", label: "In progress", value: 31 },
            { id: "away", label: "Away", value: 2 },
            { id: "idle", label: "Idle", value: 3 },
            { id: "submitted", label: "Submitted", value: 18 },
          ]}
        />
      </section>

      <section className="card" aria-label="Lists">
        <h2 className="card-title">Rows, menus, empty and loading</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Exam</th>
              <th scope="col" className="num">
                To grade
              </th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Campus drive 2026</td>
              <td className="num">4</td>
              <td className="row-end">
                <RowMenu
                  of="Campus drive 2026"
                  items={[
                    { label: "Edit", icon: <Pencil />, onSelect: () => toast("Edit") },
                    { label: "Make a copy", icon: <Copy />, onSelect: () => toast("Copied") },
                    { label: "Archive", icon: <Trash2 />, onSelect: () => toast("Archived"), danger: true },
                  ]}
                />
              </td>
            </tr>
          </tbody>
        </table>
        <EmptyState icon={Users} compact action={{ label: "Invite candidates", onClick: () => toast("Invite") }}>
          Candidates appear here as they start.
        </EmptyState>
        <SkeletonRows rows={2} columns={3} label="Example loading" />
      </section>

      <section className="card" aria-label="Banners and the drop zone">
        <h2 className="card-title">Banners and the drop zone</h2>
        <Banner tone="danger" title="Could not load results.">
          Check the connection, then reload the page.
        </Banner>
        <Banner tone="info" title="Candidates have sat this exam, so its questions are fixed." />
        <DropZone label="Choose a spreadsheet" hint="CSV or Excel, one candidate per row." accept=".csv,.xlsx" onFile={(file) => toast(file.name)} />
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
