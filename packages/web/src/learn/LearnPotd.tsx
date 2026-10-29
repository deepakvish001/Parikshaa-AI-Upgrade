import { useId, useState, type ReactNode } from "react";
import { Empty } from "@parikshaa/brand/kit";
import type { Difficulty, PotdDay, PotdView } from "../practice/client.ts";
import { ScreenLink, useLearn } from "./context.tsx";
import { Failed, Loading, Offline, useHome, useLearnData, useOnline, usePotd, waitingForNetwork } from "./data.tsx";
import { ArrowRight, Flame, icon } from "./icons.tsx";
import { screenById, type Tri } from "./screens.ts";
import { A, fill, type LearnLang } from "./text.ts";
import "./learn-potd.css";

/**
 * The problem of the day (tracker row 140, K2-4; the mock's `PotdBody`,
 * docs/learn/mock-v3/app/src/screens/compete.tsx) on what the practice site's
 * API already does: `GET /potd?month=YYYY-MM` gives today's problem and the
 * month's problems up to today, each with whether the learner solved it and
 * whether on its day, today's date (India) and the learner's days off;
 * `GET /home` the streak, the longest one and the days off left this month.
 *
 * Today's problem, then the month as a calendar from Monday: solved on the
 * day, solved later, missed, a day off, today, a day still to come, and a
 * day without a problem. Each day says so in words, not colour alone, and a
 * day with a problem links to it (on the current site until K2-5). The month
 * goes back and forward, never past this one.
 *
 * Not shown (no backend yet): the mock's countdown boxes (the day ends at
 * midnight in India, said in words), how many solved it today, and the coins
 * the problem of the day has paid in all.
 */

export const PD = {
  eyebrow: ["Problem of the day", "Aaj ka problem", "आज का प्रश्न"],
  solve: ["Solve now", "Abhi solve karo", "अभी हल करें"],
  solvedToday: ["Solved today", "Aaj solve kiya", "आज हल किया"],
  solvedLater: ["Solved, not on its day", "Solve kiya, us din nahi", "हल किया, उस दिन नहीं"],
  open: ["Open it again", "Phir kholo", "फिर खोलें"],
  ends: ["A new one comes at midnight, India time.", "Naya problem raat 12 baje (IST) aata hai.", "नया प्रश्न रात 12 बजे (IST) आता है।"],
  noneToday: ["No problem of the day today", "Aaj koi problem of the day nahi", "आज कोई दिन का प्रश्न नहीं"],
  noneTodayBody: ["The site's team sets one a day. Until then, the sheet has your next problem.", "Site ki team roz ek rakhti hai. Tab tak sheet me aapka agla problem hai.", "साइट की टीम रोज़ एक रखती है। तब तक शीट में आपका अगला प्रश्न है।"],
  toSheet: ["Open the sheet", "Sheet kholo", "शीट खोलें"],
  streak: ["Current streak", "Abhi ki streak", "अभी की स्ट्रीक"],
  days: ["{n} days", "{n} din", "{n} दिन"],
  oneDay: ["1 day", "1 din", "1 दिन"],
  freezes: ["{n} days off left this month", "Is mahine {n} chhutti baaki", "इस महीने {n} छुट्टी बाकी"],
  best: ["Longest streak", "Sabse lambi streak", "सबसे लंबी स्ट्रीक"],
  month: ["This month", "Is mahine", "इस महीने"],
  monthSolved: ["{n} of {total} solved on their day", "{total} me se {n} usi din solve", "{total} में से {n} उसी दिन हल"],
  calendar: ["Calendar", "Calendar", "कैलेंडर"],
  prevMonth: ["Previous month", "Pichhla mahina", "पिछला महीना"],
  nextMonth: ["Next month", "Agla mahina", "अगला महीना"],
  dOk: ["solved on the day", "usi din solve", "उसी दिन हल"],
  dLate: ["solved later", "baad me solve", "बाद में हल"],
  dMiss: ["missed", "chhoot gaya", "छूट गया"],
  dOff: ["day off", "chhutti", "छुट्टी"],
  dToday: ["today", "aaj", "आज"],
  dFuture: ["still to come", "abhi aana hai", "अभी आना है"],
  dNone: ["no problem that day", "us din problem nahi", "उस दिन प्रश्न नहीं"],
  legend: ["What the days mean", "Dino ka matlab", "दिनों का मतलब"],
  signedOut: [
    "You are not signed in, so the calendar shows without what you solved.",
    "Aap sign in nahi hain, isliye calendar aapke solve kiye bina dikh raha hai.",
    "आप साइन इन नहीं हैं, इसलिए कैलेंडर आपके हल किए बिना दिख रहा है।",
  ],
  signIn: ["Sign in", "Sign in karo", "साइन इन करें"],
} as const satisfies Record<string, Tri>;

const LEVEL_WORD: Record<Difficulty, Tri> = { easy: A.easy, medium: A.medium, hard: A.hard };
const LOCALE: Record<LearnLang, string> = { en: "en-IN", hg: "en-IN", hi: "hi-IN" };
const WEEK: Record<LearnLang, readonly string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  hg: ["Som", "Mangal", "Budh", "Guru", "Shukra", "Shani", "Ravi"],
  hi: ["सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि", "रवि"],
};

const Check = icon("check", <path d="M20 6 9 17l-5-5" />);
const X = icon(
  "x",
  <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>,
);
const Snowflake = icon(
  "snowflake",
  <>
    <path d="m10 20-1.25-2.5L6 18" />
    <path d="M10 4 8.75 6.5 6 6" />
    <path d="m14 20 1.25-2.5L18 18" />
    <path d="m14 4 1.25 2.5L18 6" />
    <path d="m17 21-3-6h-4" />
    <path d="m17 3-3 6 1.5 3" />
    <path d="M2 12h6.5L10 9" />
    <path d="m20 10-1.5 2 1.5 2" />
    <path d="M22 12h-6.5L14 15" />
    <path d="m4 10 1.5 2L4 14" />
    <path d="m7 21 3-6-1.5-3" />
    <path d="m7 3 3 6h4" />
  </>,
);
const ChevronLeft = icon("chevron-left", <path d="m15 18-6-6 6-6" />);
const ChevronRight = icon("chevron-right", <path d="m9 18 6-6-6-6" />);

/** Today's month in India, from this device's clock: the first month to ask for. */
export const istMonth = (now = Date.now()): string => new Date(now + 5.5 * 3_600_000).toISOString().slice(0, 7);

/** A month moved by some months: "2026-01" back one is "2025-12". */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

export type DayKind = "ok" | "late" | "miss" | "off" | "today" | "future" | "none";

/** A month as weeks from Monday: each cell a day of the month (or null before the 1st and after the last). */
export function monthGrid(month: string): readonly (readonly (string | null)[])[] {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** What a day was for the learner. */
export function dayKind(day: string, today: string, potd: PotdDay | undefined, off: ReadonlySet<string>): DayKind {
  if (potd?.solvedThatDay) return "ok";
  if (day === today) return "today";
  if (day > today) return "future";
  if (off.has(day)) return "off";
  if (potd === undefined) return "none";
  return potd.solved ? "late" : "miss";
}

const KIND_WORD: Record<DayKind, Tri> = { ok: PD.dOk, late: PD.dLate, miss: PD.dMiss, off: PD.dOff, today: PD.dToday, future: PD.dFuture, none: PD.dNone };

function Frame({ children }: { readonly children: ReactNode }) {
  const { t } = useLearn();
  return (
    <div className="ln-stack">
      <h1 className="ln-page-h1">{t(screenById("potd")?.title ?? PD.eyebrow)}</h1>
      {children}
    </div>
  );
}

export function Potd() {
  const [month, setMonth] = useState(() => istMonth());
  const potd = usePotd(month);
  if (waitingForNetwork(potd)) {
    return (
      <Frame>
        <Offline waiting />
      </Frame>
    );
  }
  if (potd.isPending) {
    return (
      <Frame>
        <Loading shape="cards" />
      </Frame>
    );
  }
  if (potd.isError) {
    return (
      <Frame>
        <Failed error={potd.error} onRetry={() => void potd.refetch()} retrying={potd.isFetching} />
      </Frame>
    );
  }
  return <PotdPage view={potd.data} month={month} setMonth={setMonth} loading={potd.isFetching} />;
}

function PotdPage({ view, month, setMonth, loading }: { readonly view: PotdView; readonly month: string; readonly setMonth: (month: string) => void; readonly loading: boolean }) {
  const { t, lang } = useLearn();
  const { signedIn } = useLearnData();
  const online = useOnline();
  const home = useHome();
  const id = useId();
  const today = view.today;
  const thisMonth = view.date.slice(0, 7);
  const byDay = new Map(view.calendar.map((d) => [d.day, d]));
  const off = new Set(view.daysOff);
  const onDay = view.calendar.filter((d) => d.solvedThatDay).length;
  const longDate = (day: string) => new Intl.DateTimeFormat(LOCALE[lang], { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
  const monthName = new Intl.DateTimeFormat(LOCALE[lang], { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  const h = home.data;
  return (
    <div className="ln-stack lpd-page">
      {online ? null : <Offline />}
      {today === null ? (
        <section className="ln-card lpd-hero" aria-labelledby={`${id}-none`}>
          <p className="ln-eyebrow">{t(PD.eyebrow)}</p>
          <h1 className="ln-page-h1">{t(screenById("potd")?.title ?? PD.eyebrow)}</h1>
          <Empty
            title={t(PD.noneToday)}
            body={t(PD.noneTodayBody)}
            headingLevel={2}
            action={
              <ScreenLink to="sheet" className="ln-btn ln-btn-pri">
                {t(PD.toSheet)}
              </ScreenLink>
            }
          />
          <span id={`${id}-none`} className="ln-sr">
            {t(PD.noneToday)}
          </span>
        </section>
      ) : (
        <section className="ln-card lpd-hero" aria-labelledby={`${id}-title`}>
          <div className="lpd-hero-main">
            <p className="ln-eyebrow">
              {t(PD.eyebrow)} · <span className="ln-dated">{longDate(today.day)}</span>
            </p>
            <h1 className="lpd-title" id={`${id}-title`}>
              {today.title}
            </h1>
            <div className="lpd-tags">
              <span className={`lpd-lvl lpd-lv-${today.difficulty}`}>{t(LEVEL_WORD[today.difficulty])}</span>
              {today.solvedThatDay ? (
                <span className="ln-badge ln-tone-tick">
                  <Check aria-hidden="true" />
                  {t(PD.solvedToday)}
                </span>
              ) : null}
            </div>
            <p className="ln-faint">{t(PD.ends)}</p>
          </div>
          <ScreenLink to={`problems/${encodeURIComponent(today.slug)}`} className={`ln-btn ln-btn-lg${today.solvedThatDay ? "" : " ln-btn-pri"}`}>
            {t(today.solvedThatDay ? PD.open : PD.solve)}
            <ArrowRight aria-hidden="true" />
          </ScreenLink>
        </section>
      )}

      {signedIn ? (
        h === undefined ? null : (
          <div className="lpd-stats">
            <div className="ln-card lpd-stat">
              <span className="lpd-k">{t(PD.streak)}</span>
              <span className="lpd-v">
                <Flame aria-hidden="true" />
                {h.streak === 1 ? t(PD.oneDay) : fill(t(PD.days), { n: h.streak })}
              </span>
              <span className="ln-faint">{fill(t(PD.freezes), { n: h.freezesLeft })}</span>
            </div>
            <div className="ln-card lpd-stat">
              <span className="lpd-k">{t(PD.best)}</span>
              <span className="lpd-v">{h.longestStreak === 1 ? t(PD.oneDay) : fill(t(PD.days), { n: h.longestStreak })}</span>
            </div>
            <div className="ln-card lpd-stat">
              <span className="lpd-k">{t(PD.month)}</span>
              <span className="lpd-v">
                {onDay} / {view.calendar.length}
              </span>
              <span className="ln-faint">{fill(t(PD.monthSolved), { n: onDay, total: view.calendar.length })}</span>
            </div>
          </div>
        )
      ) : (
        <p className="ln-notice ln-notice-info lpd-signed-out">
          <span className="ln-grow">{t(PD.signedOut)}</span>
          <ScreenLink to="signin?next=potd" className="ln-btn ln-btn-sm ln-btn-pri">
            {t(PD.signIn)}
          </ScreenLink>
        </p>
      )}

      <section className="ln-card lpd-cal" aria-labelledby={`${id}-month`} aria-busy={loading}>
        <div className="lpd-cal-h">
          <h2 className="ln-h3 ln-grow" id={`${id}-month`}>
            <span className="ln-dated">{monthName}</span>
          </h2>
          <button type="button" className="ln-icon-btn" aria-label={t(PD.prevMonth)} title={t(PD.prevMonth)} onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" className="ln-icon-btn" aria-label={t(PD.nextMonth)} title={t(PD.nextMonth)} disabled={month >= thisMonth} onClick={() => setMonth(shiftMonth(month, 1))}>
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
        <table className="lpd-grid" aria-labelledby={`${id}-month`}>
          <thead>
            <tr>
              {WEEK[lang].map((d) => (
                <th key={d} scope="col">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthGrid(month).map((week, w) => (
              <tr key={w}>
                {week.map((day, i) => {
                  if (day === null) return <td key={`e${i}`} className="lpd-empty" />;
                  const potd = byDay.get(day);
                  const kind = dayKind(day, view.date, potd, off);
                  const n = Number(day.slice(8));
                  const inner = (
                    <>
                      <span className="lpd-n">{n}</span>
                      {kind === "ok" || kind === "late" ? <Check aria-hidden="true" /> : kind === "off" ? <Snowflake aria-hidden="true" /> : kind === "miss" ? <X aria-hidden="true" /> : null}
                      <span className="ln-sr">
                        {potd === undefined ? "" : `${potd.title}, `}
                        {t(KIND_WORD[kind])}
                      </span>
                    </>
                  );
                  return (
                    <td key={day} className={`lpd-d lpd-${kind}`} aria-current={kind === "today" ? "date" : undefined}>
                      {potd === undefined ? (
                        <span className="lpd-cell">{inner}</span>
                      ) : (
                        <ScreenLink to={`problems/${encodeURIComponent(potd.slug)}`} className="lpd-cell" title={potd.title}>
                          {inner}
                        </ScreenLink>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="lpd-legend" aria-label={t(PD.legend)}>
          {(["ok", "late", "miss", "off", "today"] as const).map((k) => (
            <li key={k}>
              <i className={`lpd-key lpd-${k}`} aria-hidden="true" />
              {t(KIND_WORD[k])}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
