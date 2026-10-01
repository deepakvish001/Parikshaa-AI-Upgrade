import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Armchair, Camera, CheckCircle2, Download, Plus, ScanLine, Trash2, TriangleAlert } from "lucide-react";
import { Drawer, useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type ConsoleClient, type Marked, type SeatRow } from "../api.ts";
import "./Rooms.css";

/**
 * Exam day in rooms (docs/PREP-TRACKER.md, V2-12: CL24, CL25, CL32, CL33).
 * On the Candidates tab: the rooms, seating by roll number, and admit cards to
 * print. On the Live page: every room at once, and the door — an invigilator's
 * phone scans each admit card as candidates walk in.
 */

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const failure = (error: unknown) => (error instanceof ConsoleError && error.detail !== undefined ? error.detail : "That did not work. Try again.");

interface RoomDraft {
  readonly centre: string;
  readonly room: string;
  readonly seats: string;
}

/** Rooms of the seating as it stands, in order, with their candidates. */
function roomsOf(rows: readonly SeatRow[]) {
  const rooms = new Map<string, { centre: string; room: string; rows: SeatRow[] }>();
  for (const r of rows) {
    if (r.room === "") continue;
    const key = `${r.centre}\n${r.room}`;
    const entry = rooms.get(key) ?? { centre: r.centre, room: r.room, rows: [] };
    entry.rows.push(r);
    rooms.set(key, entry);
  }
  return [...rooms.values()];
}

export function SeatingCard({ client, examId, canSeat }: { client: ConsoleClient; examId: string; canSeat: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const seats = useQuery({ queryKey: ["seats", examId], queryFn: () => client.seats(examId) });
  const [editing, setEditing] = useState(false);
  const rows = seats.data ?? [];
  const rooms = roomsOf(rows);
  const [plan, setPlan] = useState<readonly RoomDraft[]>([{ centre: "", room: "Lab 1", seats: "30" }]);
  const allocate = useMutation({
    mutationFn: () => client.allocateSeats(examId, plan.map((r) => ({ centre: r.centre, room: r.room, seats: Number(r.seats) || 0 }))),
    onSuccess: ({ seated, spare }) => {
      toast(`${seated} seated${spare > 0 ? `, ${spare} seats spare` : ""}`, "success");
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["seats", examId] });
    },
  });
  const cards = useMutation({ mutationFn: () => client.admitCards(examId), onSuccess: (blob) => save(blob, `admit-cards-${examId}.pdf`) });

  if (rows.length === 0) return null;
  const seated = rows.filter((r) => r.room !== "").length;
  const capacity = plan.reduce((n, r) => n + (Number(r.seats) || 0), 0);
  const startEditing = () => {
    if (rooms.length > 0) setPlan(rooms.map((r) => ({ centre: r.centre, room: r.room, seats: String(r.rows.length) })));
    setEditing(true);
  };

  return (
    <section className="card" aria-label="Seats and admit cards">
      <div className="bar">
        <Armchair aria-hidden="true" />
        <strong>Seats and admit cards</strong>
        <span className="notice">{seated === 0 ? "Not seated yet" : `${seated} of ${rows.length} seated in ${rooms.length} room${rooms.length === 1 ? "" : "s"}`}</span>
        <span className="spacer" />
        {seated > 0 ? (
          <button type="button" className="secondary" disabled={cards.isPending} onClick={() => cards.mutate()}>
            <Download aria-hidden="true" />
            Admit cards (PDF)
          </button>
        ) : null}
        {canSeat && !editing ? (
          <button type="button" onClick={startEditing}>
            {seated === 0 ? "Seat candidates" : "Change rooms"}
          </button>
        ) : null}
      </div>
      {seated > 0 && !editing ? (
        <p className="notice">
          {rooms.map((r) => `${r.centre === "" ? "" : `${r.centre} · `}${r.room}: ${r.rows[0]!.ref}–${r.rows.at(-1)!.ref}`).join("  ·  ")}. Each candidate can also download their own card from their link.
        </p>
      ) : null}
      {editing ? (
        <form
          aria-label="Rooms"
          onSubmit={(e) => {
            e.preventDefault();
            allocate.mutate();
          }}
        >
          <p className="notice">Candidates are seated by roll number, filling each room before the next. Seating again replaces the old seats, so print the cards after.</p>
          {plan.map((r, i) => (
            <div className="row room-row" key={i}>
              <input aria-label={`Centre ${i + 1}`} placeholder="Centre (optional)" value={r.centre} onChange={(e) => setPlan(plan.map((x, j) => (j === i ? { ...x, centre: e.target.value } : x)))} />
              <input aria-label={`Room ${i + 1}`} placeholder="Room" required value={r.room} onChange={(e) => setPlan(plan.map((x, j) => (j === i ? { ...x, room: e.target.value } : x)))} />
              <input aria-label={`Seats in room ${i + 1}`} type="number" min={1} className="minutes-input" value={r.seats} onChange={(e) => setPlan(plan.map((x, j) => (j === i ? { ...x, seats: e.target.value } : x)))} />
              <button type="button" className="quiet" aria-label={`Remove room ${i + 1}`} disabled={plan.length === 1} onClick={() => setPlan(plan.filter((_, j) => j !== i))}>
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          ))}
          <div className="row">
            <button type="button" className="quiet" onClick={() => setPlan([...plan, { centre: plan.at(-1)?.centre ?? "", room: `Lab ${plan.length + 1}`, seats: plan.at(-1)?.seats ?? "30" }])}>
              <Plus aria-hidden="true" />
              Add a room
            </button>
            <span className={`notice${capacity < rows.length ? " field-error" : ""}`} role="status">
              {capacity} seats for {rows.length} candidates
            </span>
            <span className="spacer" />
            <button type="button" className="quiet" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" disabled={allocate.isPending || capacity < rows.length}>
              Seat {rows.length} candidates
            </button>
          </div>
          {allocate.error === null ? null : (
            <p className="error" role="alert">
              {failure(allocate.error)}
            </p>
          )}
        </form>
      ) : null}
    </section>
  );
}

/** Every room on one screen, refreshed as candidates arrive and begin. */
export function RoomsCard({ client, examId }: { client: ConsoleClient; examId: string }) {
  const seats = useQuery({ queryKey: ["seats", examId], queryFn: () => client.seats(examId), refetchInterval: 10_000 });
  const [door, setDoor] = useState(false);
  const rooms = roomsOf(seats.data ?? []);
  if (rooms.length === 0) return null;
  return (
    <section className="card" aria-label="Rooms">
      <div className="bar">
        <Armchair aria-hidden="true" />
        <strong>Rooms</strong>
        <span className="notice">Present means scanned at the door; started and submitted come from the test itself.</span>
        <span className="spacer" />
        <button type="button" onClick={() => setDoor(true)}>
          <ScanLine aria-hidden="true" />
          At the door
        </button>
      </div>
      <div className="room-grid">
        {rooms.map((r) => {
          const present = r.rows.filter((x) => x.present).length;
          const started = r.rows.filter((x) => x.attemptState !== "not_started").length;
          const submitted = r.rows.filter((x) => x.attemptState === "submitted" || x.attemptState === "graded").length;
          const missing = r.rows.filter((x) => !x.present && x.attemptState === "not_started");
          return (
            <article key={`${r.centre}${r.room}`} className="room-tile" aria-label={`${r.centre === "" ? "" : `${r.centre}, `}${r.room}`}>
              <h3>
                {r.room}
                {r.centre === "" ? null : <span className="notice"> · {r.centre}</span>}
              </h3>
              <dl>
                <div>
                  <dt>Seats</dt>
                  <dd>{r.rows.length}</dd>
                </div>
                <div>
                  <dt>Present</dt>
                  <dd>{present}</dd>
                </div>
                <div>
                  <dt>Started</dt>
                  <dd>{started}</dd>
                </div>
                <div>
                  <dt>Submitted</dt>
                  <dd>{submitted}</dd>
                </div>
              </dl>
              {missing.length === 0 ? null : (
                <p className="notice">
                  Not here yet: {missing.slice(0, 6).map((x) => x.ref).join(", ")}
                  {missing.length > 6 ? ` and ${missing.length - 6} more` : ""}
                </p>
              )}
            </article>
          );
        })}
      </div>
      {door ? <AtTheDoor client={client} examId={examId} onClose={() => setDoor(false)} /> : null}
    </section>
  );
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<readonly { rawValue: string }[]>;
}

/**
 * The door, for an invigilator's phone: scan each admit card with the
 * camera (where the browser can read QR codes), or type the roll number.
 * Each scan says where the candidate sits, or that the card was seen before.
 */
export function AtTheDoor({ client, examId, onClose }: { client: ConsoleClient; examId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [log, setLog] = useState<readonly (Marked | { error: string })[]>([]);
  const [scanning, setScanning] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const busy = useRef(false);
  const mark = useMutation({
    mutationFn: (text: string) => client.markPresent(examId, text),
    onSuccess: (m) => {
      setLog((l) => [m, ...l].slice(0, 20));
      void queryClient.invalidateQueries({ queryKey: ["seats", examId] });
    },
    onError: (error) => setLog((l) => [{ error: failure(error) }, ...l].slice(0, 20)),
  });
  const Detector = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector;

  useEffect(() => {
    if (!scanning || Detector === undefined) return;
    let stream: MediaStream | null = null;
    let timer = 0;
    const detector = new Detector({ formats: ["qr_code"] });
    let last = "";
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((s) => {
      stream = s;
      if (video.current === null) return;
      video.current.srcObject = s;
      void video.current.play();
      timer = window.setInterval(async () => {
        if (busy.current || video.current === null) return;
        busy.current = true;
        try {
          const found = (await detector.detect(video.current))[0]?.rawValue;
          // The same card held in front of the camera is read once.
          if (found !== undefined && found !== last) {
            last = found;
            mark.mutate(found);
          }
        } finally {
          busy.current = false;
        }
      }, 400);
    });
    return () => {
      window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  return (
    <Drawer label="At the door" onClose={onClose}>
      <h2 className="dialog-title">At the door</h2>
      <p className="notice">Scan each admit card, or type the roll number. Each one says where the candidate sits.</p>
      {Detector === undefined ? null : (
        <div className="door-camera">
          {scanning ? <video ref={video} muted playsInline aria-label="Camera" /> : null}
          <button type="button" className="secondary" onClick={() => setScanning(!scanning)}>
            <Camera aria-hidden="true" />
            {scanning ? "Stop the camera" : "Scan with the camera"}
          </button>
        </div>
      )}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim() === "") return;
          mark.mutate(code.trim());
          setCode("");
        }}
      >
        <input aria-label="Roll number or card code" placeholder="Roll number" autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
        <button type="submit" disabled={mark.isPending}>
          Mark present
        </button>
      </form>
      <ul className="door-log" aria-label="Marked" aria-live="polite">
        {log.map((entry, i) =>
          "error" in entry ? (
            <li key={i} className="bad">
              <TriangleAlert aria-hidden="true" /> {entry.error}
            </li>
          ) : (
            <li key={i} className={entry.already === null ? "ok" : "warn"}>
              <CheckCircle2 aria-hidden="true" /> <strong>{entry.ref}</strong> {entry.name} — {entry.room} seat {entry.seat}
              {entry.already === null ? null : <span className="notice"> · already marked by {entry.already.by}</span>}
            </li>
          ),
        )}
      </ul>
    </Drawer>
  );
}
