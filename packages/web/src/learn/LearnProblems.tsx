import { useId, useState, type ReactNode } from "react";
import { Empty, Meter, Seg } from "@parikshaa/brand/kit";
import type { Difficulty, ProblemSummary, Standing } from "../practice/client.ts";
import { ScreenLink, useLearn } from "./context.tsx";
import { Failed, Loading, Offline, useLearnData, useOnline, useProblems, useTracks, waitingForNetwork } from "./data.tsx";
import { ArrowRight, icon, ListChecks, Search, Target } from "./icons.tsx";
import { screenById, type Tri } from "./screens.ts";
import { A, fill } from "./text.ts";
import "./learn-problems.css";

/**
 * Abhyas: the problems bank (tracker row 140, K2-4; the mock's `PracticeBody`
 * hub, docs/learn/mock-v3/app/src/screens/practice.tsx) on what the practice
 * site's API already does: `GET /tracks` for the sheets with the learner's
 * progress in each, and `GET /problems` for every published problem with its
 * topics (tags), patterns, the companies that asked it lately (as far as this
 * learner may see: the API decides), how many solved it, its acceptance and
 * the learner's standing.
 *
 * Search by title; filter by topic, level, standing (signed in), pattern and
 * company; the API gives the whole set at once, so the page shows 50 at a
 * time with "show more". A problem still opens on the current site until the
 * workspace comes (K2-5); "a random one" picks among those not solved.
 *
 * Not shown (no backend yet, Kadam 3/4): the mock's progress by pattern
 * rings, the "working with AI" strip (ticket labs, drills: Kadam 3), retry
 * your misses as a list of its own, and the last 30 days' chart.
 */

export const PB = {
  eyebrow: ["Practice", "Abhyas", "अभ्यास"],
  title: ["Every problem, one place.", "Har problem, ek jagah.", "हर प्रश्न, एक जगह।"],
  sub: [
    "Search, filter by topic, level and company, and pick up where you left off. Every test is checked by our runner.",
    "Khojo, topic, level aur company se chhaano, aur jahan chhoda wahin se shuru karo. Har test hamara runner jaanchta hai.",
    "खोजें, विषय, स्तर और कंपनी से छाँटें, और जहाँ छोड़ा वहीं से शुरू करें। हर टेस्ट हमारा रनर जाँचता है।",
  ],
  random: ["A random problem", "Koi bhi problem", "कोई भी प्रश्न"],
  potd: ["Problem of the day", "Aaj ka problem", "आज का प्रश्न"],
  sheets: ["Sheets", "Sheets", "शीट"],
  sheetProgress: ["{title}: {done} of {items} done", "{title}: {items} me se {done}", "{title}: {items} में से {done}"],
  problems: ["Problems", "Problems", "प्रश्न"],
  search: ["Search problems", "Problems khojo", "प्रश्न खोजें"],
  level: ["Level", "Level", "स्तर"],
  all: ["All", "Sab", "सभी"],
  status: ["Your standing", "Aapki haalat", "आपकी स्थिति"],
  anyStatus: ["Any standing", "Koi bhi haalat", "कोई भी स्थिति"],
  todo: ["Not tried", "Koshish nahi ki", "कोशिश नहीं की"],
  tried: ["Tried, not solved", "Koshish ki, solve nahi", "कोशिश की, हल नहीं"],
  solved: ["Solved", "Solve kiya", "हल किया"],
  pattern: ["Pattern", "Pattern", "पैटर्न"],
  anyPattern: ["Any pattern", "Koi bhi pattern", "कोई भी पैटर्न"],
  company: ["Company", "Company", "कंपनी"],
  anyCompany: ["Any company", "Koi bhi company", "कोई भी कंपनी"],
  topics: ["Topics", "Topics", "विषय"],
  clear: ["Clear the filters", "Filters hatao", "फ़िल्टर हटाएँ"],
  count: ["{shown} of {n} problems", "{n} me se {shown} problems", "{n} में से {shown} प्रश्न"],
  more: ["Show {n} more", "{n} aur dikhao", "{n} और दिखाएँ"],
  colStatus: ["Standing", "Haalat", "स्थिति"],
  colTitle: ["Problem", "Problem", "प्रश्न"],
  colLevel: ["Level", "Level", "स्तर"],
  colAcceptance: ["Acceptance", "Acceptance", "स्वीकृति"],
  colSolvedBy: ["Solved by", "Kitno ne solve kiya", "कितनों ने हल किया"],
  companiesAsked: ["Asked at {names}", "{names} me poocha gaya", "{names} में पूछा गया"],
  noMatch: ["No problem matches these filters.", "In filters se koi problem nahi mila.", "इन फ़िल्टर से कोई प्रश्न नहीं मिला।"],
  noneTitle: ["No problems here yet", "Yahan abhi koi problem nahi", "यहाँ अभी कोई प्रश्न नहीं"],
  noneBody: ["When the site's team publishes problems, they show here.", "Site ki team problems publish karegi to yahan dikhenge.", "साइट की टीम प्रश्न प्रकाशित करेगी तो यहाँ दिखेंगे।"],
  signedOut: [
    "You are not signed in, so the list shows without what you solved.",
    "Aap sign in nahi hain, isliye list aapke solve kiye bina dikh rahi hai.",
    "आप साइन इन नहीं हैं, इसलिए सूची आपके हल किए बिना दिख रही है।",
  ],
  signIn: ["Sign in", "Sign in karo", "साइन इन करें"],
  allSolved: ["You have solved every problem here.", "Aapne yahan ka har problem solve kar liya.", "आपने यहाँ का हर प्रश्न हल कर लिया।"],
} as const satisfies Record<string, Tri>;

const LEVEL_WORD: Record<Difficulty, Tri> = { easy: A.easy, medium: A.medium, hard: A.hard };
const PAGE = 50;
type Level = "all" | Difficulty;
type StatusFilter = "all" | "todo" | "attempted" | "solved";

// Drawn here: today's practice pages import these from lucide-react (icons.tsx says why).
const CircleCheck = icon(
  "circle-check",
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </>,
);
const CircleDot = icon(
  "circle-dot",
  <>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="1" />
  </>,
);
const Circle = icon("circle", <circle cx="12" cy="12" r="10" />);
const Shuffle = icon(
  "shuffle",
  <>
    <path d="m18 14 4 4-4 4" />
    <path d="m18 2 4 4-4 4" />
    <path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-7.6a4 4 0 0 1 3.3-1.7H22" />
    <path d="M2 6h1.972a4 4 0 0 1 3.6 2.2" />
    <path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" />
  </>,
);

const problemPath = (slug: string) => `problems/${encodeURIComponent(slug)}`;
const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);

function StandingIcon({ status }: { readonly status: Standing }) {
  const { t } = useLearn();
  const [Icon, tone, word] = status === "solved" ? [CircleCheck, "lp-st-done", PB.solved] : status === "attempted" ? [CircleDot, "lp-st-tried", PB.tried] : [Circle, "lp-st-open", PB.todo];
  return (
    <span className={`lp-st ${tone}`}>
      <Icon aria-hidden="true" />
      <span className="ln-sr">{t(word)}</span>
    </span>
  );
}

function Frame({ children }: { readonly children: ReactNode }) {
  const { t } = useLearn();
  return (
    <div className="ln-stack">
      <h1 className="ln-page-h1">{t(screenById("practice")?.title ?? PB.eyebrow)}</h1>
      {children}
    </div>
  );
}

export function Problems() {
  const problems = useProblems();
  const tracks = useTracks();
  if (waitingForNetwork(problems)) {
    return (
      <Frame>
        <Offline waiting />
      </Frame>
    );
  }
  if (problems.isPending) {
    return (
      <Frame>
        <Loading shape="list" />
      </Frame>
    );
  }
  if (problems.isError) {
    return (
      <Frame>
        <Failed error={problems.error} onRetry={() => void problems.refetch()} retrying={problems.isFetching} />
      </Frame>
    );
  }
  return <Bank all={problems.data} tracks={tracks.data ?? []} />;
}

/** The problems a filter keeps, in the site's order. */
export function filterProblems(
  all: readonly ProblemSummary[],
  { text, level, status, topic, pattern, company }: { readonly text: string; readonly level: Level; readonly status: StatusFilter; readonly topic: string | null; readonly pattern: string; readonly company: string },
): readonly ProblemSummary[] {
  const words = text.trim().toLowerCase();
  return all.filter(
    (p) =>
      (words === "" || p.title.toLowerCase().includes(words)) &&
      (level === "all" || p.difficulty === level) &&
      (status === "all" || (status === "todo" ? p.status === null : p.status === status)) &&
      (topic === null || p.tags.includes(topic)) &&
      (pattern === "" || p.patterns.includes(pattern)) &&
      (company === "" || p.companies.some((c) => c.slug === company)),
  );
}

function Bank({ all, tracks }: { readonly all: readonly ProblemSummary[]; readonly tracks: readonly { readonly slug: string; readonly title: string; readonly items: number; readonly done: number }[] }) {
  const { t, go } = useLearn();
  const { signedIn } = useLearnData();
  const online = useOnline();
  const id = useId();
  const [text, setText] = useState("");
  const [level, setLevel] = useState<Level>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [topic, setTopic] = useState<string | null>(null);
  const [pattern, setPattern] = useState("");
  const [company, setCompany] = useState("");
  const [pages, setPages] = useState(1);
  const topics = [...new Set(all.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b));
  const patterns = [...new Set(all.flatMap((p) => p.patterns))].sort((a, b) => a.localeCompare(b));
  const companies = [...new Map(all.flatMap((p) => p.companies).map((c) => [c.slug, c.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const shown = filterProblems(all, { text, level, status, topic, pattern, company });
  const visible = shown.slice(0, pages * PAGE);
  const filtered = text.trim() !== "" || level !== "all" || status !== "all" || topic !== null || pattern !== "" || company !== "";
  const unsolved = all.filter((p) => p.status !== "solved");
  // Any filter starts the list again at its first page.
  const change =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPages(1);
    };
  const clear = () => {
    setText("");
    setLevel("all");
    setStatus("all");
    setTopic(null);
    setPattern("");
    setCompany("");
    setPages(1);
  };

  return (
    <div className="ln-stack lp-page">
      {online ? null : <Offline />}
      <header className="lp-head">
        <div className="lp-head-text">
          <p className="ln-eyebrow">{t(PB.eyebrow)}</p>
          <h1 className="ln-page-h1">{t(PB.title)}</h1>
          <p className="lp-sub">{t(PB.sub)}</p>
        </div>
        <div className="lp-acts">
          {unsolved.length === 0 ? null : (
            <button type="button" className="ln-btn" onClick={() => go(problemPath(unsolved[Math.floor(Math.random() * unsolved.length)]!.slug))}>
              <Shuffle aria-hidden="true" />
              {t(PB.random)}
            </button>
          )}
          <ScreenLink to="potd" className="ln-btn ln-btn-pri">
            <Target aria-hidden="true" />
            {t(PB.potd)}
          </ScreenLink>
        </div>
      </header>

      {tracks.length === 0 ? null : (
        <section aria-labelledby={`${id}-sheets`} className="lp-sheets-wrap">
          <h2 className="ln-h3" id={`${id}-sheets`}>
            {t(PB.sheets)}
          </h2>
          <ul className="lp-sheets">
            {tracks.map((x) => (
              <li key={x.slug}>
                <ScreenLink to={`sheet/${encodeURIComponent(x.slug)}`} className="ln-card lp-sheet">
                  <span className="lp-sheet-ic" aria-hidden="true">
                    <ListChecks />
                  </span>
                  <b>{x.title}</b>
                  <span className="lp-num ln-faint">
                    {x.done} / {x.items}
                  </span>
                  <Meter label={fill(t(PB.sheetProgress), { title: x.title, done: x.done, items: x.items })} value={x.done} max={Math.max(1, x.items)} size="thin" />
                </ScreenLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {signedIn ? null : (
        <p className="ln-notice ln-notice-info lp-signed-out">
          <span className="ln-grow">{t(PB.signedOut)}</span>
          <ScreenLink to="signin?next=practice" className="ln-btn ln-btn-sm ln-btn-pri">
            {t(PB.signIn)}
          </ScreenLink>
        </p>
      )}

      {all.length === 0 ? (
        <Empty title={t(PB.noneTitle)} body={t(PB.noneBody)} headingLevel={2} />
      ) : (
        <section className="ln-card lp-bank" aria-labelledby={`${id}-bank`}>
          <h2 className="ln-sr" id={`${id}-bank`}>
            {t(PB.problems)}
          </h2>
          <div className="lp-filters" role="search">
            <label className="lp-search">
              <Search aria-hidden="true" />
              <span className="ln-sr">{t(PB.search)}</span>
              <input type="search" className="ln-input" placeholder={t(PB.search)} value={text} onChange={(event) => change(setText)(event.target.value)} />
            </label>
            <Seg<Level>
              label={t(PB.level)}
              value={level}
              onChange={change(setLevel)}
              items={[
                { id: "all", label: t(PB.all) },
                { id: "easy", label: t(A.easy) },
                { id: "medium", label: t(A.medium) },
                { id: "hard", label: t(A.hard) },
              ]}
            />
            {signedIn ? (
              <label className="lp-select">
                <span className="ln-sr">{t(PB.status)}</span>
                <select className="ln-input" value={status} onChange={(event) => change(setStatus)(event.target.value as StatusFilter)}>
                  <option value="all">{t(PB.anyStatus)}</option>
                  <option value="todo">{t(PB.todo)}</option>
                  <option value="attempted">{t(PB.tried)}</option>
                  <option value="solved">{t(PB.solved)}</option>
                </select>
              </label>
            ) : null}
            {patterns.length === 0 ? null : (
              <label className="lp-select">
                <span className="ln-sr">{t(PB.pattern)}</span>
                <select className="ln-input" value={pattern} onChange={(event) => change(setPattern)(event.target.value)}>
                  <option value="">{t(PB.anyPattern)}</option>
                  {patterns.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {companies.length === 0 ? null : (
              <label className="lp-select">
                <span className="ln-sr">{t(PB.company)}</span>
                <select className="ln-input" value={company} onChange={(event) => change(setCompany)(event.target.value)}>
                  <option value="">{t(PB.anyCompany)}</option>
                  {companies.map(([slug, name]) => (
                    <option key={slug} value={slug}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {topics.length === 0 ? null : (
            <div className="lp-topics" role="group" aria-label={t(PB.topics)}>
              {topics.map((name) => (
                <button key={name} type="button" className="lp-chip" aria-pressed={topic === name} onClick={() => change(setTopic)(topic === name ? null : name)}>
                  {name}
                  <span className="lp-chip-n">{all.filter((p) => p.tags.includes(name)).length}</span>
                </button>
              ))}
            </div>
          )}
          <div className="lp-count">
            <p className="ln-faint" role="status">
              {fill(t(PB.count), { shown: shown.length, n: all.length })}
            </p>
            {filtered ? (
              <button type="button" className="ln-btn ln-btn-ghost ln-btn-sm" onClick={clear}>
                {t(PB.clear)}
              </button>
            ) : null}
          </div>
          {shown.length === 0 ? (
            <p className="lp-none">{t(PB.noMatch)}</p>
          ) : (
            <div className="lp-scroll" tabIndex={0} role="region" aria-labelledby={`${id}-bank`}>
              <table className="lp-table">
                <thead>
                  <tr>
                    <th scope="col" className="lp-c-st">
                      <span className="ln-sr">{t(PB.colStatus)}</span>
                    </th>
                    <th scope="col">{t(PB.colTitle)}</th>
                    <th scope="col">{t(PB.colLevel)}</th>
                    <th scope="col" className="lp-r">
                      {t(PB.colAcceptance)}
                    </th>
                    <th scope="col" className="lp-r">
                      {t(PB.colSolvedBy)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => (
                    <tr key={p.slug} className={p.status === "solved" ? "lp-is-done" : undefined}>
                      <td className="lp-c-st">
                        <StandingIcon status={p.status} />
                      </td>
                      <td className="lp-c-title">
                        <ScreenLink to={problemPath(p.slug)} className="lp-link">
                          {p.title}
                        </ScreenLink>
                        {p.tags.length === 0 && p.companies.length === 0 ? null : (
                          <span className="lp-meta ln-faint">
                            {p.tags.join(" · ")}
                            {p.companies.length === 0 ? null : (
                              <span className="lp-co">{fill(t(PB.companiesAsked), { names: p.companies.map((c) => c.name).join(", ") })}</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td data-label={t(PB.colLevel)}>
                        <span className={`lp-lvl lp-lv-${p.difficulty}`}>{t(LEVEL_WORD[p.difficulty])}</span>
                      </td>
                      <td className="lp-r lp-num" data-label={t(PB.colAcceptance)}>
                        {percent(p.acceptance)}
                      </td>
                      <td className="lp-r lp-num" data-label={t(PB.colSolvedBy)}>
                        {p.solvedBy}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {shown.length > visible.length ? (
            <button type="button" className="ln-btn lp-more" onClick={() => setPages((n) => n + 1)}>
              {fill(t(PB.more), { n: Math.min(PAGE, shown.length - visible.length) })}
              <ArrowRight aria-hidden="true" />
            </button>
          ) : null}
          {signedIn && unsolved.length === 0 ? <p className="ln-notice ln-notice-ok">{t(PB.allSolved)}</p> : null}
        </section>
      )}
    </div>
  );
}
