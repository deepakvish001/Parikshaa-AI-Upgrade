import { useId, useState, type ReactNode } from "react";
import { Empty, Meter, Ring, Seg } from "@parikshaa/brand/kit";
import { Markdown } from "@parikshaa/brand/markdown";
import type { Difficulty, TrackItem, TrackView } from "../practice/client.ts";
import { ScreenLink, useLearn } from "./context.tsx";
import { Failed, Loading, Offline, useLearnData, useOnline, usePlan, useTrack, useTracks, waitingForNetwork } from "./data.tsx";
import { ArrowRight, BookOpen, CodeXml, icon, ListChecks, Search } from "./icons.tsx";
import { screenById, type Tri } from "./screens.ts";
import { A, fill } from "./text.ts";
import "./learn-sheet.css";

/**
 * The DSA sheet (tracker row 140, K2-4; the mock's `SheetBody`,
 * docs/learn/mock-v3/app/src/screens/practice.tsx) on what the practice
 * site's API already does: `GET /tracks` lists the site's tracks (sheets),
 * `GET /tracks/<track>` gives one module by module, each lesson and problem
 * with the learner's standing (done, tried, locked behind Plus).
 *
 * `sheet` opens the learner's plan's track (or the site's first);
 * `sheet/<track>` a chosen one. Above the modules: how much is done, by level,
 * and the next thing to do; the modules fold, the first unfinished one open;
 * a search and a filter (to do, done) open every module with a match.
 * Lessons open in Learn's reader; a problem still opens on the current site
 * until the workspace comes (K2-5). Open to anyone: signed out, the sheet
 * shows without the learner's standing, and says how to keep it.
 *
 * Not shown (no backend yet, Kadam 3/4): the mock's "your pace" forecast,
 * today's picks beside the sheet (Aaj has them), how many companies asked a
 * problem (the problems page filters by company), and starring a problem
 * for revision from here (revision takes the problems solved).
 */

export const SH = {
  eyebrow: ["Sheet", "Sheet", "शीट"],
  sub: [
    "{items} lessons and problems in {modules} modules, in the order the plan teaches them.",
    "{items} lessons aur problems, {modules} modules me, usi kram me jaise plan sikhata hai.",
    "{items} पाठ और प्रश्न, {modules} मॉड्यूल में, उसी क्रम में जैसे योजना सिखाती है।",
  ],
  sheets: ["Sheets", "Sheets", "शीट"],
  progress: ["{done} of {items} done", "{items} me se {done} ho gaye", "{items} में से {done} पूरे"],
  sheetProgress: ["Sheet progress", "Sheet ki pragati", "शीट की प्रगति"],
  byLevel: ["Problems by level", "Level ke hisaab se problems", "स्तर के हिसाब से प्रश्न"],
  lessons: ["Lessons", "Lessons", "पाठ"],
  levelProgress: ["{level}: {done} of {total} done", "{level}: {total} me se {done}", "{level}: {total} में से {done}"],
  next: ["Up next", "Agla kaam", "अगला काम"],
  nextLesson: ["Read the lesson", "Lesson padho", "पाठ पढ़ें"],
  nextProblem: ["Solve the problem", "Problem solve karo", "प्रश्न हल करें"],
  allDone: ["Every item on this sheet is done.", "Is sheet ka har kaam ho gaya.", "इस शीट का हर काम हो गया।"],
  search: ["Search this sheet", "Is sheet me khojo", "इस शीट में खोजें"],
  show: ["Show", "Dikhao", "दिखाएँ"],
  all: ["All", "Sab", "सभी"],
  todo: ["To do", "Baaki", "बाकी"],
  done: ["Done", "Ho gaye", "पूरे"],
  module: ["Module {n}", "Module {n}", "मॉड्यूल {n}"],
  moduleDone: ["Done", "Poora", "पूरा"],
  moduleProgress: ["{title}: {done} of {total} done", "{title}: {total} me se {done}", "{title}: {total} में से {done}"],
  lesson: ["Lesson", "Lesson", "पाठ"],
  problem: ["Problem", "Problem", "प्रश्न"],
  minutes: ["{n} min", "{n} min", "{n} मिनट"],
  stDone: ["Done", "Ho gaya", "पूरा"],
  stTried: ["Tried, not solved yet", "Koshish ki, abhi solve nahi", "कोशिश की, अभी हल नहीं"],
  stLocked: ["Needs Plus", "Plus chahiye", "प्लस चाहिए"],
  stOpen: ["Not started", "Shuru nahi kiya", "शुरू नहीं किया"],
  noMatch: ["Nothing on this sheet matches.", "Is sheet me kuch nahi mila.", "इस शीट में कुछ नहीं मिला।"],
  matches: ["{n} match", "{n} mile", "{n} मिले"],
  signedOut: [
    "You are not signed in, so the sheet shows without your progress.",
    "Aap sign in nahi hain, isliye sheet aapki pragati ke bina dikh rahi hai.",
    "आप साइन इन नहीं हैं, इसलिए शीट आपकी प्रगति के बिना दिख रही है।",
  ],
  signIn: ["Sign in to keep your progress", "Pragati rakhne ke liye sign in karo", "प्रगति रखने के लिए साइन इन करें"],
  noneTitle: ["No sheet here yet", "Yahan abhi koi sheet nahi", "यहाँ अभी कोई शीट नहीं"],
  noneBody: [
    "When the site's team publishes a track, its lessons and problems show here in order.",
    "Site ki team track publish karegi to uske lessons aur problems yahan kram se dikhenge.",
    "साइट की टीम ट्रैक प्रकाशित करेगी तो उसके पाठ और प्रश्न यहाँ क्रम से दिखेंगे।",
  ],
  emptyTrack: ["This track has nothing in it yet.", "Is track me abhi kuch nahi.", "इस ट्रैक में अभी कुछ नहीं।"],
  allProblems: ["All problems", "Saare problems", "सभी प्रश्न"],
  toToday: ["Back to Today", "Aaj par wapas", "आज पर वापस"],
} as const satisfies Record<string, Tri>;

const LEVEL_WORD: Record<Difficulty, Tri> = { easy: A.easy, medium: A.medium, hard: A.hard };
const LEVELS: readonly Difficulty[] = ["easy", "medium", "hard"];
type Show = "all" | "todo" | "done";

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
const Lock = icon(
  "lock",
  <>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>,
);
const ChevronRight = icon("chevron-right", <path d="m9 18 6-6-6-6" />);

/** Where an item opens: a lesson in Learn's reader (with its sheet, for the way back), a problem at its address. */
const itemPath = (item: Pick<TrackItem, "kind" | "slug">, track?: string): string =>
  item.kind === "lesson" ? `lessons/${encodeURIComponent(item.slug)}${track === undefined ? "" : `?track=${encodeURIComponent(track)}`}` : `problems/${encodeURIComponent(item.slug)}`;

/** An item's standing, as an icon with its words (never colour alone). */
function Standing({ item }: { readonly item: Pick<TrackItem, "status" | "locked"> }) {
  const { t } = useLearn();
  const [Icon, tone, word] =
    item.status === "done" ? [CircleCheck, "ls-st-done", SH.stDone]
    : item.locked ? [Lock, "ls-st-lock", SH.stLocked]
    : item.status === "attempted" ? [CircleDot, "ls-st-tried", SH.stTried]
    : [Circle, "ls-st-open", SH.stOpen];
  return (
    <span className={`ls-st ${tone}`}>
      <Icon aria-hidden="true" />
      <span className="ln-sr">{t(word)}</span>
    </span>
  );
}

function Frame({ children }: { readonly children: ReactNode }) {
  const { t } = useLearn();
  return (
    <div className="ln-stack">
      <h1 className="ln-page-h1">{t(screenById("sheet")?.title ?? SH.eyebrow)}</h1>
      {children}
    </div>
  );
}

export function Sheet({ track }: { readonly track: string | null }) {
  const { t } = useLearn();
  const { signedIn } = useLearnData();
  const tracks = useTracks();
  const plan = usePlan();
  // The address's track, or the plan's, or the site's first.
  const planned = plan.data?.track.slug ?? null;
  const waitForPlan = track === null && signedIn && plan.isPending && plan.fetchStatus !== "idle";
  const chosen = track ?? (waitForPlan ? null : (tracks.data?.find((x) => x.slug === planned)?.slug ?? tracks.data?.[0]?.slug ?? null));
  const view = useTrack(chosen);
  if (waitingForNetwork(tracks) || waitingForNetwork(view)) {
    return (
      <Frame>
        <Offline waiting />
      </Frame>
    );
  }
  if (tracks.isError || view.isError) {
    const failed = tracks.isError ? tracks : view;
    return (
      <Frame>
        <Failed error={failed.error} onRetry={() => void failed.refetch()} retrying={failed.isFetching} />
      </Frame>
    );
  }
  if (tracks.isPending || waitForPlan || (chosen !== null && view.isPending)) {
    return (
      <Frame>
        <Loading shape="list" />
      </Frame>
    );
  }
  if (chosen === null || view.data === undefined) {
    return (
      <Frame>
        <Empty
          icon={<ListChecks />}
          title={t(SH.noneTitle)}
          body={t(SH.noneBody)}
          action={
            <ScreenLink to="aaj" className="ln-btn ln-btn-ghost">
              {t(SH.toToday)}
            </ScreenLink>
          }
        />
      </Frame>
    );
  }
  return <SheetPage view={view.data} others={tracks.data} />;
}

function SheetPage({ view, others }: { readonly view: TrackView; readonly others: readonly { readonly slug: string; readonly title: string }[] }) {
  const { t } = useLearn();
  const { signedIn } = useLearnData();
  const online = useOnline();
  const id = useId();
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<Show>("all");
  const items = view.modules.flatMap((m) => m.items);
  const problems = items.filter((x) => x.kind === "problem");
  const lessons = items.filter((x) => x.kind === "lesson");
  const next = items.find((x) => x.status !== "done" && !x.locked) ?? null;
  // The first unfinished module is open to begin with; the learner opens and folds the rest.
  const firstOpen = Math.max(0, view.modules.findIndex((m) => m.done < m.items.length));
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([firstOpen]));
  const words = query.trim().toLowerCase();
  const filtering = words !== "" || show !== "all";
  const keep = (x: TrackItem) => (words === "" || x.title.toLowerCase().includes(words)) && (show === "all" || (show === "done" ? x.status === "done" : x.status !== "done"));
  const shown = view.modules.map((m) => m.items.filter(keep));
  const matches = shown.reduce((n, m) => n + m.length, 0);
  const toggle = (i: number) =>
    setOpen((was) => {
      const now = new Set(was);
      if (now.has(i)) now.delete(i);
      else now.add(i);
      return now;
    });

  return (
    <div className="ln-stack ls-page">
      {online ? null : <Offline />}
      <header className="ls-head">
        <div className="ls-head-text">
          <p className="ln-eyebrow">{t(SH.eyebrow)}</p>
          <h1 className="ln-page-h1">{view.title}</h1>
          <p className="ls-sub">{fill(t(SH.sub), { items: view.items, modules: view.modules.length })}</p>
          {view.description.trim() === "" ? null : (
            <div className="ln-md ls-desc">
              <Markdown source={view.description} />
            </div>
          )}
        </div>
        <Ring label={t(SH.sheetProgress)} value={view.done} max={Math.max(1, view.items)} valueText={fill(t(SH.progress), { done: view.done, items: view.items })} size={96} stroke={9} tone={view.items > 0 && view.done === view.items ? "tick" : "pen"}>
          <span className="ls-ring-in">
            <b>{view.done}</b>
            <span className="ln-faint">/ {view.items}</span>
          </span>
        </Ring>
      </header>

      {others.length > 1 ? (
        <nav className="ls-tracks" aria-label={t(SH.sheets)}>
          {others.map((x) => (
            <ScreenLink key={x.slug} to={`sheet/${encodeURIComponent(x.slug)}`} className="ls-track" current={x.slug === view.slug}>
              {x.title}
            </ScreenLink>
          ))}
        </nav>
      ) : null}

      {signedIn ? null : (
        <p className="ln-notice ln-notice-info ls-signed-out">
          <span className="ln-grow">{t(SH.signedOut)}</span>
          <ScreenLink to={`signin?next=${encodeURIComponent(`sheet/${view.slug}`)}`} className="ln-btn ln-btn-sm ln-btn-pri">
            {t(SH.signIn)}
          </ScreenLink>
        </p>
      )}

      <section className="ls-levels" aria-label={t(SH.byLevel)}>
        {LEVELS.map((level) => {
          const all = problems.filter((x) => x.difficulty === level);
          if (all.length === 0) return null;
          const done = all.filter((x) => x.status === "done").length;
          return (
            <div key={level} className={`ls-level ls-lv-${level}`}>
              <span className="ls-level-name">{t(LEVEL_WORD[level])}</span>
              <span className="ls-num">
                <b>{done}</b>
                <span className="ln-faint"> / {all.length}</span>
              </span>
              <Meter label={fill(t(SH.levelProgress), { level: t(LEVEL_WORD[level]), done, total: all.length })} value={done} max={all.length} size="thin" tone={level === "easy" ? "tick" : level === "medium" ? "coin" : "red"} />
            </div>
          );
        })}
        {lessons.length === 0 ? null : (
          <div className="ls-level">
            <span className="ls-level-name">{t(SH.lessons)}</span>
            <span className="ls-num">
              <b>{lessons.filter((x) => x.status === "done").length}</b>
              <span className="ln-faint"> / {lessons.length}</span>
            </span>
            <Meter
              label={fill(t(SH.levelProgress), { level: t(SH.lessons), done: lessons.filter((x) => x.status === "done").length, total: lessons.length })}
              value={lessons.filter((x) => x.status === "done").length}
              max={lessons.length}
              size="thin"
              tone="ai"
            />
          </div>
        )}
      </section>

      {items.length === 0 ? null : next === null ? (
        <p className="ln-notice ln-notice-ok">{t(SH.allDone)}</p>
      ) : (
        <section className="ln-card ls-next" aria-labelledby={`${id}-next`}>
          <span className={`ls-next-ic ${next.kind === "lesson" ? "ls-k-lesson" : "ls-k-problem"}`} aria-hidden="true">
            {next.kind === "lesson" ? <BookOpen /> : <CodeXml />}
          </span>
          <div className="ln-grow ls-next-text">
            <p className="ln-eyebrow" id={`${id}-next`}>
              {t(SH.next)}
            </p>
            <b className="ls-next-title">{next.title}</b>
            <span className="ln-faint">
              {t(next.kind === "lesson" ? SH.lesson : SH.problem)}
              {next.difficulty === null ? "" : ` · ${t(LEVEL_WORD[next.difficulty])}`} · {fill(t(SH.minutes), { n: next.estMinutes })}
            </span>
          </div>
          <ScreenLink to={itemPath(next, view.slug)} className="ln-btn ln-btn-pri">
            {t(next.kind === "lesson" ? SH.nextLesson : SH.nextProblem)}
            <ArrowRight aria-hidden="true" />
          </ScreenLink>
        </section>
      )}

      {items.length === 0 ? (
        <Empty title={t(SH.emptyTrack)} headingLevel={2} />
      ) : (
        <>
          <div className="ls-tools" role="search">
            <label className="ls-search">
              <Search aria-hidden="true" />
              <span className="ln-sr">{t(SH.search)}</span>
              <input type="search" className="ln-input" value={query} placeholder={t(SH.search)} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <Seg<Show>
              label={t(SH.show)}
              value={show}
              onChange={setShow}
              items={[
                { id: "all", label: t(SH.all) },
                { id: "todo", label: `${t(SH.todo)} ${items.filter((x) => x.status !== "done").length}` },
                { id: "done", label: `${t(SH.done)} ${items.filter((x) => x.status === "done").length}` },
              ]}
            />
            <ScreenLink to="practice" className="ln-btn ln-btn-ghost ls-all">
              {t(SH.allProblems)}
              <ArrowRight aria-hidden="true" />
            </ScreenLink>
          </div>
          <p className="ln-sr" role="status">
            {filtering ? fill(t(SH.matches), { n: matches }) : ""}
          </p>
          {filtering && matches === 0 ? <p className="ln-faint ls-none">{t(SH.noMatch)}</p> : null}
          <div className="ls-modules">
            {view.modules.map((m, i) => {
              const rows = shown[i] ?? [];
              if (filtering && rows.length === 0) return null;
              const isOpen = filtering || open.has(i);
              const total = m.items.length;
              const complete = total > 0 && m.done === total;
              const panel = `${id}-m${i}`;
              return (
                <section key={`${i}-${m.title}`} className={`ls-mod${isOpen ? " ls-open" : ""}`} aria-labelledby={`${panel}-h`}>
                  <h2 className="ls-mod-h" id={`${panel}-h`}>
                    <button type="button" className="ls-mod-btn" aria-expanded={isOpen} aria-controls={panel} onClick={() => toggle(i)} disabled={filtering}>
                      <ChevronRight aria-hidden="true" className="ls-chev" />
                      <span className="ln-grow ls-mod-title">
                        <span className="ln-faint">{fill(t(SH.module), { n: i + 1 })} · </span>
                        {m.title}
                      </span>
                      {complete ? <span className="ln-badge ln-tone-tick">{t(SH.moduleDone)}</span> : null}
                      <span className="ls-num ln-faint">
                        {m.done} / {total}
                      </span>
                    </button>
                  </h2>
                  <Meter className="ls-mod-meter" label={fill(t(SH.moduleProgress), { title: m.title, done: m.done, total })} value={m.done} max={Math.max(1, total)} size="thin" tone={complete ? "tick" : "pen"} />
                  {isOpen ? (
                    <ul className="ls-items" id={panel}>
                      {rows.map((item) => (
                        <li key={`${item.kind}-${item.slug}`} className={`ls-item${item.status === "done" ? " ls-is-done" : ""}`}>
                          <Standing item={item} />
                          <span className={`ls-kind ${item.kind === "lesson" ? "ls-k-lesson" : "ls-k-problem"}`}>{t(item.kind === "lesson" ? SH.lesson : SH.problem)}</span>
                          <ScreenLink to={itemPath(item, view.slug)} className="ls-link ln-grow">
                            {item.title}
                          </ScreenLink>
                          {item.difficulty === null ? null : <span className={`ls-lvl ls-lv-${item.difficulty}`}>{t(LEVEL_WORD[item.difficulty])}</span>}
                          <span className="ls-min ln-faint">{fill(t(SH.minutes), { n: item.estMinutes })}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
