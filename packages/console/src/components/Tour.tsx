import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

/**
 * A guided tour of the console for someone new: a few stops, each pointing at
 * the part of the page it is about, dimming the rest.
 *
 * It behaves as a dialog — focus moves into it, Tab stays within it, Escape
 * ends it and focus goes back to what opened it — and every stop can be read
 * without its picture: the words say where the thing is. A stop whose target
 * is not on the page (a narrow screen, a role without that page) is shown in
 * the middle, pointing at nothing.
 */

export interface TourStop {
  /** The element pointed at: `[data-tour="…"]`. None: shown in the middle. */
  readonly target?: string;
  readonly title: string;
  readonly body: string;
}

const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
/** Space between what is pointed at and its ring, and between the ring and the card. */
const PAD = 6;
const GAP = 14;
const CARD_WIDTH = 340;

type Rect = { readonly top: number; readonly left: number; readonly width: number; readonly height: number };

const rectOf = (target: string | undefined): Rect | null => {
  if (target === undefined) return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (el === null) return null;
  const r = el.getBoundingClientRect();
  // Hidden (display: none, or a sidebar folded away on a phone).
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};

/** Where the card goes: beside the ring if there is room, else below or above it, kept on screen. */
function placeCard(spot: Rect | null, card: { width: number; height: number }): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.min(Math.max(x, 12), Math.max(12, vw - card.width - 12));
  const clampY = (y: number) => Math.min(Math.max(y, 12), Math.max(12, vh - card.height - 12));
  if (spot === null) return { top: clampY((vh - card.height) / 2), left: clampX((vw - card.width) / 2) };
  const right = spot.left + spot.width + PAD + GAP;
  if (right + card.width <= vw - 12) return { top: clampY(spot.top - PAD), left: right };
  const below = spot.top + spot.height + PAD + GAP;
  if (below + card.height <= vh - 12) return { top: below, left: clampX(spot.left) };
  return { top: clampY(spot.top - PAD - GAP - card.height), left: clampX(spot.left) };
}

export function Tour({ stops, onClose }: { stops: readonly TourStop[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Rect | null>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const stop = stops[index]!;
  const last = index === stops.length - 1;

  // Focus in on opening, back to the opener on closing.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (opener?.isConnected === true) opener.focus();
    };
  }, []);

  const measure = useCallback(() => {
    const el = stop.target === undefined ? null : document.querySelector<HTMLElement>(`[data-tour="${stop.target}"]`);
    const found = rectOf(stop.target);
    if (el !== null && found !== null && (found.top < 0 || found.top + found.height > window.innerHeight)) {
      el.scrollIntoView({ block: "center" });
    }
    const now = rectOf(stop.target);
    setSpot(now);
    const box = card.current;
    setPlace(placeCard(now, { width: box?.offsetWidth ?? CARD_WIDTH, height: box?.offsetHeight ?? 200 }));
  }, [stop.target]);

  useLayoutEffect(() => {
    measure();
  }, [measure, index]);

  // Each stop's title is read out as focus lands on it.
  useEffect(() => {
    heading.current?.focus();
  }, [index]);

  useEffect(() => {
    const again = () => measure();
    window.addEventListener("resize", again);
    window.addEventListener("scroll", again, true);
    return () => {
      window.removeEventListener("resize", again);
      window.removeEventListener("scroll", again, true);
    };
  }, [measure]);

  // Escape and the arrow keys work wherever focus is while the tour is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close.current();
      } else if (event.key === "ArrowRight") {
        setIndex((i) => Math.min(i + 1, stops.length - 1));
      } else if (event.key === "ArrowLeft") {
        setIndex((i) => Math.max(i - 1, 0));
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [stops.length]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || card.current === null) return;
    const items = [...card.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0]!;
    const end = items[items.length - 1]!;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) {
      event.preventDefault();
      end.focus();
    } else if (!event.shiftKey && document.activeElement === end) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="tour" data-testid="tour">
      {spot === null ? (
        <div className="tour-scrim" aria-hidden="true" />
      ) : (
        <div
          className="tour-spot"
          aria-hidden="true"
          style={{ top: spot.top - PAD, left: spot.left - PAD, width: spot.width + 2 * PAD, height: spot.height + 2 * PAD }}
        />
      )}
      <div
        ref={card}
        className="tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        onKeyDown={onKeyDown}
        style={place === null ? { visibility: "hidden" } : { top: place.top, left: place.left }}
      >
        <div className="tour-head">
          <span className="notice small">
            {index + 1} of {stops.length}
          </span>
          <button type="button" className="quiet icon" aria-label="End the tour" onClick={() => close.current()}>
            <X aria-hidden="true" />
          </button>
        </div>
        <h2 id="tour-title" ref={heading} tabIndex={-1}>
          {stop.title}
        </h2>
        <p id="tour-body">{stop.body}</p>
        <div className="tour-steps" aria-hidden="true">
          {stops.map((s, i) => (
            <span key={s.title} className={i === index ? "on" : i < index ? "seen" : undefined} />
          ))}
        </div>
        <div className="tour-actions">
          {index === 0 ? (
            <button type="button" className="quiet" onClick={() => close.current()}>
              Skip the tour
            </button>
          ) : (
            <button type="button" className="secondary" onClick={() => setIndex(index - 1)}>
              <ArrowLeft aria-hidden="true" />
              Back
            </button>
          )}
          <span className="spacer" />
          {last ? (
            <button type="button" onClick={() => close.current()}>
              Done
            </button>
          ) : (
            <button type="button" onClick={() => setIndex(index + 1)}>
              Next
              <ArrowRight aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** The console's tour for this account: loaded when first taken, as most never take it twice. */
export default function ConsoleTour({ can, onClose }: { can: (permission: string) => boolean; onClose: () => void }) {
  return <Tour stops={consoleTour(can)} onClose={onClose} />;
}

/** The console's tour, for what this account can reach. */
export function consoleTour(can: (permission: string) => boolean): readonly TourStop[] {
  const stops: (TourStop | false)[] = [
    {
      target: "home",
      title: "Home",
      body: "What is sitting now and next, what your staff have done, and the first steps left. You start here every time.",
    },
    {
      target: "exams",
      title: "Exams",
      body: "Every exam, in the menu on the left. Write one, set when it opens, invite candidates, watch the sitting live, then read the results — each exam has a tab for each.",
    },
    can("exam:read_key") && {
      target: "bank",
      title: "Question bank",
      body: "Questions you use again and again, by topic and difficulty. Bring in a Word question paper or a spreadsheet, then build exams from it.",
    },
    can("staff:manage") && {
      target: "staff",
      title: "Staff",
      body: "Add your colleagues as authors, invigilators and reviewers. Each sees only what their role needs; an invigilator never sees the answer key.",
    },
    {
      target: "search",
      title: "Find anyone",
      body: "Search for a candidate by roll number or name from any page: press Ctrl K.",
    },
    can("exam:write") && {
      target: "welcome",
      title: "Start here",
      body: "Load the sample exam to try it as a candidate would, or write your first exam. You can take this tour again from Home.",
    },
  ];
  return stops.filter((s): s is TourStop => s !== false);
}
