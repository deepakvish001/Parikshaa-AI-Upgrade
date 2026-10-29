import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { NotebookPen, Pencil, Plus, Printer, X } from "lucide-react";
import { Empty } from "@parikshaa/brand/kit";
import { Markdown } from "@parikshaa/brand/markdown";
import { Dialog } from "@parikshaa/brand/ui";
import type { Difficulty, Note, NoteKind, ProblemList } from "../practice/client.ts";
import { ScreenLink, useLearn } from "./context.tsx";
import { Failed, Loading, Offline, SignedOut, useLearnData, useLists, useNoteBook, useNotes, useOnline, useTracks, waitingForNetwork } from "./data.tsx";
import { ArrowRight, Bookmark, icon, Search } from "./icons.tsx";
import { screenById, type Tri } from "./screens.ts";
import { A, fill, type LearnLang } from "./text.ts";
import "./learn-mine.css";

/**
 * Meri lists and Notes (tracker row 140, K2-3; the mock's `ListsBody` and
 * `NotesBody`, docs/learn/mock-v3/app/src/screens/mine.tsx), on what the
 * practice site's API already does:
 *
 * - lists (`GET /lists`): Bookmarks and the learner's own lists, each with
 *   how much of it is solved; a problem taken out (`DELETE /lists/<list>/<problem>`);
 *   a new list made from problems already saved (`PUT /lists/<list>/<problem>`),
 *   since the API keeps a list only while it holds a problem;
 * - notes (`GET /notes`): on a problem, a lesson or a topic, newest first,
 *   searched on the page; read as Markdown drawn by the brand's renderer
 *   (elements, never HTML), written and deleted (`PUT /notes/<kind>/<ref>`,
 *   an empty note is deleted); a topic note made here; a track's notes on
 *   one page to print or save as a PDF (`GET /notes/book`).
 *
 * The mock's public lists and share links, a line of the learner's own on a
 * problem in a list, an empty list, and the "drafted by Sahayak" mark have no
 * backend yet (Kadam 3/4). Sahayak's note draft (`POST /tutor/notes`, paid in
 * credits) comes with the Sahayak panel (K2-6). Notes on a problem or a lesson
 * are written on its page; those pages come to Learn in K2-4 and K2-5.
 */

export const M = {
  // lists
  listsTitle: ["Your own sheets.", "Aapki apni sheets.", "आपकी अपनी शीट।"],
  listsSub: [
    "Bookmarks, and lists you make: for a company's test, a weak topic, a Sunday's revision.",
    "Bookmarks, aur aapki banayi lists: kisi company ke test ke liye, kamzor topic, Sunday ki revision.",
    "बुकमार्क, और आपकी बनाई सूचियाँ: किसी कंपनी के टेस्ट के लिए, कमज़ोर विषय, रविवार की दोहराई।",
  ],
  yourLists: ["Your lists", "Aapki lists", "आपकी सूचियाँ"],
  newList: ["New list", "Nayi list", "नई सूची"],
  bookmarks: ["Bookmarks", "Bookmarks", "बुकमार्क"],
  problems: ["{n} problems", "{n} problems", "{n} प्रश्न"],
  problemOne: ["1 problem", "1 problem", "1 प्रश्न"],
  solvedOf: ["{solved} of {n} solved", "{n} me se {solved} solve", "{n} में से {solved} हल"],
  emptyList: ["Nothing saved yet", "Abhi kuch save nahi", "अभी कुछ सहेजा नहीं"],
  emptyListBody: [
    "Save a problem from its page with the bookmark, and it shows here.",
    "Problem ke page par bookmark dabao, wo yahan dikhega.",
    "प्रश्न के पेज पर बुकमार्क दबाएँ, वह यहाँ दिखेगा।",
  ],
  solved: ["Solved", "Solve ho gaya", "हल हो गया"],
  notSolved: ["Not solved yet", "Abhi solve nahi", "अभी हल नहीं"],
  remove: ["Take {title} out of {list}", "{title} ko {list} se hatao", "{title} को {list} से हटाएँ"],
  removed: ["{title} is out of {list}.", "{title} {list} se hat gaya.", "{title} {list} से हट गया।"],
  name: ["Name", "Naam", "नाम"],
  nameHint: ["Letters, digits and spaces, up to 60.", "Akshar, ank aur space, 60 tak.", "अक्षर, अंक और स्पेस, 60 तक।"],
  taken: ["You have a list by this name.", "Is naam ki list pehle se hai.", "इस नाम की सूची पहले से है।"],
  pick: ["Problems to put in it", "Isme kaun se problems", "इसमें कौन-से प्रश्न"],
  pickHint: [
    "A list starts with at least one problem; add more from a problem's page.",
    "List kam se kam ek problem se banti hai; aur problems unke page se jodo.",
    "सूची कम से कम एक प्रश्न से बनती है; और प्रश्न उनके पेज से जोड़ें।",
  ],
  noSaved: [
    "A list starts from your saved problems: save one first, with the bookmark on its page.",
    "Nayi list aapke save kiye problems se banti hai: pehle kisi problem ke page par bookmark dabao.",
    "नई सूची आपके सहेजे प्रश्नों से बनती है: पहले किसी प्रश्न के पेज पर बुकमार्क दबाएँ।",
  ],
  create: ["Make the list", "List banao", "सूची बनाएँ"],
  cancel: ["Cancel", "Rehne do", "रद्द करें"],
  created: ["List made: {name}.", "List ban gayi: {name}.", "सूची बन गई: {name}।"],
  listsSignIn: ["Sign in to see your lists", "Apni lists dekhne ke liye sign in karo", "अपनी सूचियाँ देखने के लिए साइन इन करें"],
  // notes
  notesTitle: ["Notes in your own words.", "Apne shabdon me notes.", "अपने शब्दों में नोट्स।"],
  notesSub: [
    "On a problem, a lesson or any topic. A note on a problem also comes back with it in revision.",
    "Problem, lesson ya kisi bhi topic par. Problem ka note revision me usi ke saath aata hai.",
    "प्रश्न, पाठ या किसी भी विषय पर। प्रश्न का नोट दोहराई में उसी के साथ आता है।",
  ],
  search: ["Search notes", "Notes khojo", "नोट्स खोजें"],
  newNote: ["New note on a topic", "Kisi topic par naya note", "किसी विषय पर नया नोट"],
  topic: ["Topic", "Topic", "विषय"],
  topicHint: ["For example: Overflow checklist", "Jaise: Overflow checklist", "जैसे: Overflow checklist"],
  write: ["Write", "Likho", "लिखें"],
  kProblem: ["Problem", "Problem", "प्रश्न"],
  kLesson: ["Lesson", "Lesson", "पाठ"],
  kTopic: ["Topic", "Topic", "विषय"],
  edited: ["Edited {date}", "{date} ko badla", "{date} को बदला"],
  edit: ["Edit", "Badlo", "बदलें"],
  save: ["Save", "Save karo", "सहेजें"],
  saved: ["Note saved.", "Note save ho gaya.", "नोट सहेज लिया।"],
  body: ["Your note", "Aapka note", "आपका नोट"],
  bodyHint: [
    "Markdown works: **bold**, `code`, lists, and code blocks between ``` lines.",
    "Markdown chalta hai: **bold**, `code`, lists, aur ``` lines ke beech code.",
    "Markdown चलता है: **bold**, `code`, सूचियाँ, और ``` पंक्तियों के बीच कोड।",
  ],
  del: ["Delete note", "Note mitao", "नोट मिटाएँ"],
  delAsk: ["Delete “{title}”? It cannot be brought back.", "“{title}” mitayen? Ye wapas nahi aayega.", "“{title}” मिटाएँ? यह वापस नहीं आएगा।"],
  deleted: ["Note deleted.", "Note mit gaya.", "नोट मिट गया।"],
  linked: ["Linked", "Jude hue", "जुड़े"],
  openProblem: ["Open the problem", "Problem kholo", "प्रश्न खोलें"],
  openLesson: ["Open the lesson", "Lesson kholo", "पाठ खोलें"],
  revisionCard: ["Revision", "Revision", "दोहराई"],
  noNotes: ["No notes yet", "Abhi koi note nahi", "अभी कोई नोट नहीं"],
  noNotesBody: [
    "Write one on a topic here, or on a problem or a lesson from its page.",
    "Yahan kisi topic par likho, ya problem/lesson ke page se.",
    "यहाँ किसी विषय पर लिखें, या प्रश्न/पाठ के पेज से।",
  ],
  noMatch: ["No note has these words.", "In shabdon wala koi note nahi.", "इन शब्दों वाला कोई नोट नहीं।"],
  notesSignIn: ["Sign in to see your notes", "Apne notes dekhne ke liye sign in karo", "अपने नोट्स देखने के लिए साइन इन करें"],
  book: ["A track's notes on one page", "Track ke saare notes ek page par", "ट्रैक के सारे नोट्स एक पेज पर"],
  bookHint: ["To print, or to save as a PDF.", "Print ke liye, ya PDF save karne ke liye.", "प्रिंट के लिए, या PDF सहेजने के लिए।"],
  track: ["Track", "Track", "ट्रैक"],
  bookGo: ["Open", "Kholo", "खोलें"],
  print: ["Print or save as PDF", "Print ya PDF save karo", "प्रिंट या PDF सहेजें"],
  bookBack: ["Back to notes", "Notes par wapas", "नोट्स पर वापस"],
  bookEmpty: ["No notes on this track yet.", "Is track par abhi koi note nahi.", "इस ट्रैक पर अभी कोई नोट नहीं।"],
  topicNotes: ["Topic notes", "Topic notes", "विषय नोट्स"],
} as const satisfies Record<string, Tri>;

// Today's practice pages import these two from lucide-react; drawn here, no chunk of theirs moves (icons.tsx).
const ArrowLeft = icon(
  "arrow-left",
  <>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </>,
);
const Trash2 = icon(
  "trash-2",
  <>
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </>,
);

const LEVEL_WORD: Record<Difficulty, Tri> = { easy: A.easy, medium: A.medium, hard: A.hard };
const KIND_WORD: Record<NoteKind, Tri> = { problem: M.kProblem, lesson: M.kLesson, topic: M.kTopic };
const TONES = ["pen", "red", "tick", "coin"] as const;
/** What the API takes as a list's name. */
export const LIST_NAME = /^[\p{L}\p{N} _\-'&()]{1,60}$/u;
const BOOKMARKS = "Bookmarks";

const LOCALE: Record<LearnLang, string> = { en: "en-IN", hg: "en-IN", hi: "hi-IN" };
/** A date in the learner's words, kept apart so the page's images can hold it still (`.ln-dated`). */
function Dated({ at }: { readonly at: string }) {
  const { lang } = useLearn();
  return <span className="ln-dated">{new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(at))}</span>;
}

/** The heading where the page cannot show: signed out, loading, failed. */
function Frame({ id, children }: { readonly id: "lists" | "notes"; readonly children: ReactNode }) {
  const { t } = useLearn();
  return (
    <div className="ln-stack">
      <h1 className="ln-page-h1">{t(screenById(id)?.title ?? M.yourLists)}</h1>
      {children}
    </div>
  );
}

/** The four states before a page's data is in (DESIGN-SYSTEM §9); null once it is. */
function useStates(id: "lists" | "notes", query: UseQueryResult<unknown>, signInTitle: Tri): ReactNode {
  const { t } = useLearn();
  const { signedIn } = useLearnData();
  if (!signedIn) return <Frame id={id}>{<SignedOut title={t(signInTitle)} />}</Frame>;
  if (waitingForNetwork(query)) return <Frame id={id}>{<Offline waiting />}</Frame>;
  if (query.isPending) return <Frame id={id}>{<Loading shape={id === "lists" ? "cards" : "doc"} />}</Frame>;
  if (query.isError) return <Frame id={id}>{<Failed error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />}</Frame>;
  return null;
}

/* ================= lists ================= */

export function Lists() {
  const lists = useLists();
  const online = useOnline();
  const state = useStates("lists", lists, M.listsSignIn);
  if (state !== null || lists.data === undefined) return state;
  return <ListsPage lists={lists.data} offline={!online} />;
}

function ListsPage({ lists, offline }: { readonly lists: readonly ProblemList[]; readonly offline: boolean }) {
  const { t, site, notify } = useLearn();
  const { client } = useLearnData();
  const queryClient = useQueryClient();
  const id = useId();
  const [chosen, setChosen] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const list = lists.find((l) => l.name === chosen) ?? lists[0];
  const nameOf = (name: string) => (name === BOOKMARKS ? t(M.bookmarks) : name);
  const remove = useMutation({
    mutationFn: ({ list: from, slug }: { readonly list: string; readonly slug: string; readonly title: string }) => client.removeFrom(from, slug),
    onSuccess: (_, { list: from, title }) => notify({ tone: "ok", text: fill(t(M.removed), { title, list: nameOf(from) }) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["practice", site] }),
  });
  const count = (n: number) => (n === 1 ? t(M.problemOne) : fill(t(M.problems), { n }));

  return (
    <div className="ln-stack">
      {offline ? <Offline /> : null}
      <header className="lm-head">
        <div className="ln-grow">
          <p className="ln-eyebrow">{t(screenById("lists")?.title ?? M.yourLists)}</p>
          <h1 className="ln-page-h1">{t(M.listsTitle)}</h1>
          <p className="lm-sub">{t(M.listsSub)}</p>
        </div>
        <button type="button" className="ln-btn ln-btn-pri" onClick={() => setMaking(true)} aria-haspopup="dialog" disabled={offline}>
          <Plus aria-hidden="true" />
          {t(M.newList)}
        </button>
      </header>

      <ul className="lm-lists" aria-label={t(M.yourLists)}>
        {lists.map((l, i) => (
          <li key={l.name}>
            <button type="button" className="lm-list" aria-pressed={l === list} onClick={() => setChosen(l.name)}>
              <span className={`lm-tab lm-tone-${TONES[i % TONES.length]!}`} aria-hidden="true" />
              <b className="lm-list-name">
                {l.name === BOOKMARKS ? <Bookmark aria-hidden="true" /> : null}
                {nameOf(l.name)}
              </b>
              <span className="ln-faint">{count(l.problems.length)}</span>
              <span className="lm-bar-row">
                <span className={`lm-bar lm-tone-${TONES[i % TONES.length]!}`} aria-hidden="true">
                  <i style={{ width: `${l.problems.length === 0 ? 0 : Math.round((l.solved / l.problems.length) * 100)}%` }} />
                </span>
                <span className="ln-sr">{fill(t(M.solvedOf), { solved: l.solved, n: l.problems.length })}</span>
                <span className="lm-num ln-faint" aria-hidden="true">
                  {l.solved}/{l.problems.length}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {list === undefined ? null : (
        <section className="ln-card" aria-labelledby={`${id}-list`}>
          <div className="ln-card-h">
            <h2 className="ln-h3" id={`${id}-list`}>
              {nameOf(list.name)}
            </h2>
            <span className="ln-faint lm-num">{fill(t(M.solvedOf), { solved: list.solved, n: list.problems.length })}</span>
          </div>
          {list.problems.length === 0 ? (
            <Empty icon={<Bookmark />} title={t(M.emptyList)} body={t(M.emptyListBody)} headingLevel={3} />
          ) : (
            <ul className="lm-rows">
              {list.problems.map((p) => (
                <li key={p.slug} className="lm-item">
                  <span className={`lm-check${p.solved ? " lm-solved" : ""}`}>
                    {p.solved ? (
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                        <path d="m9 12 2 2 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span className="lm-dot" aria-hidden="true" />
                    )}
                    <span className="ln-sr">{t(p.solved ? M.solved : M.notSolved)}</span>
                  </span>
                  <ScreenLink to={`problems/${encodeURIComponent(p.slug)}`} className="lm-p">
                    {p.title}
                  </ScreenLink>
                  <span className={`lm-level lm-lv-${p.difficulty}`}>{t(LEVEL_WORD[p.difficulty])}</span>
                  <button
                    type="button"
                    className="ln-icon-btn ln-sm"
                    aria-label={fill(t(M.remove), { title: p.title, list: nameOf(list.name) })}
                    title={fill(t(M.remove), { title: p.title, list: nameOf(list.name) })}
                    disabled={offline || remove.isPending}
                    onClick={() => remove.mutate({ list: list.name, slug: p.slug, title: p.title })}
                  >
                    <X aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {remove.isError ? (
            <div className="lm-pad">
              <Failed error={remove.error} onRetry={() => remove.variables === undefined ? undefined : remove.mutate(remove.variables)} headingLevel={3} />
            </div>
          ) : null}
        </section>
      )}
      {making ? <NewList lists={lists} onClose={() => setMaking(false)} onMade={setChosen} /> : null}
    </div>
  );
}

/** Every problem saved in any list, once, in the order first met. */
export function savedProblems(lists: readonly ProblemList[]): readonly { readonly slug: string; readonly title: string }[] {
  const seen = new Map<string, string>();
  for (const l of lists) for (const p of l.problems) if (!seen.has(p.slug)) seen.set(p.slug, p.title);
  return [...seen].map(([slug, title]) => ({ slug, title }));
}

/** A new list: a name and the saved problems it starts with (the API keeps a list only while it holds one). */
function NewList({ lists, onClose, onMade }: { readonly lists: readonly ProblemList[]; readonly onClose: () => void; readonly onMade: (name: string) => void }) {
  const { t, site, notify } = useLearn();
  const { client } = useLearnData();
  const queryClient = useQueryClient();
  const id = useId();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<readonly string[]>([]);
  const saved = savedProblems(lists);
  const clean = name.trim();
  const taken = clean !== "" && lists.some((l) => l.name.toLowerCase() === clean.toLowerCase());
  const ready = LIST_NAME.test(clean) && !taken && picked.length > 0;
  const make = useMutation({
    mutationFn: async () => {
      for (const slug of picked) await client.saveTo(clean, slug);
    },
    onSuccess: () => {
      onMade(clean);
      onClose();
      notify({ tone: "ok", text: fill(t(M.created), { name: clean }) });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["practice", site] }),
  });
  return (
    <Dialog label={t(M.newList)} onClose={onClose} className="lm-dialog">
      <form
        className="lm-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) make.mutate();
        }}
      >
        <h2 className="ln-h3">{t(M.newList)}</h2>
        <label className="ln-field">
          <span>{t(M.name)}</span>
          <input className="ln-input" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} aria-describedby={`${id}-hint`} aria-invalid={taken} required />
        </label>
        <p id={`${id}-hint`} className={taken ? "lm-bad" : "lm-fine ln-faint"}>
          {taken ? t(M.taken) : t(M.nameHint)}
        </p>
        {saved.length === 0 ? (
          <p className="lm-fine">{t(M.noSaved)}</p>
        ) : (
          <fieldset className="lm-pick" aria-describedby={`${id}-pick`}>
            <legend>{t(M.pick)}</legend>
            <p className="lm-fine ln-faint" id={`${id}-pick`}>
              {t(M.pickHint)}
            </p>
            {saved.map((p) => (
              <label key={p.slug} className="lm-pick-row">
                <input type="checkbox" checked={picked.includes(p.slug)} onChange={(event) => setPicked(event.target.checked ? [...picked, p.slug] : picked.filter((s) => s !== p.slug))} />
                <span>{p.title}</span>
              </label>
            ))}
          </fieldset>
        )}
        {make.isError ? <Failed error={make.error} onRetry={() => make.mutate()} headingLevel={3} /> : null}
        <div className="lm-row lm-end">
          <button type="button" className="ln-btn ln-btn-ghost" onClick={onClose}>
            {t(M.cancel)}
          </button>
          <button type="submit" className="ln-btn ln-btn-pri" disabled={!ready || make.isPending}>
            {t(M.create)}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/* ================= notes ================= */

/** A note's place: a problem's or a lesson's address; a topic by its name (the API files it under the name's slug). */
export const noteKey = (note: Pick<Note, "kind" | "ref" | "title">): string => (note.kind === "topic" ? `topic:${note.title.trim().toLowerCase()}` : `${note.kind}:${note.ref}`);
/** What the API is given for a note: a topic by its name, so the name stays its title. */
const refOf = (note: Pick<Note, "kind" | "ref" | "title">): string => (note.kind === "topic" ? note.title : note.ref);

/** The notes with every word typed, in the title or the note. */
export function findNotes(notes: readonly Note[], query: string): readonly Note[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter((w) => w !== "");
  if (words.length === 0) return notes;
  return notes.filter((n) => {
    const text = `${n.title}\n${n.body}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

export function Notes() {
  const notes = useNotes();
  const online = useOnline();
  const state = useStates("notes", notes, M.notesSignIn);
  if (state !== null || notes.data === undefined) return state;
  return <NotesPage notes={notes.data} offline={!online} />;
}

type Draft = Pick<Note, "kind" | "ref" | "title" | "body">;

function NotesPage({ notes, offline }: { readonly notes: readonly Note[]; readonly offline: boolean }) {
  const { t, site, notify } = useLearn();
  const { client } = useLearnData();
  const queryClient = useQueryClient();
  const id = useId();
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  // A topic note being written for the first time: not in the list until saved.
  const [fresh, setFresh] = useState<Draft | null>(null);
  const [editing, setEditing] = useState(false);
  const [topic, setTopic] = useState("");
  const [asking, setAsking] = useState(false);
  const [book, setBook] = useState<string | null>(null);
  const paper = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const found = findNotes(notes, query);
  const current: Draft | null = fresh ?? found.find((n) => noteKey(n) === chosen) ?? found[0] ?? null;
  const currentNote = fresh === null ? (notes.find((n) => current !== null && noteKey(n) === noteKey(current)) ?? null) : null;

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    paper.current?.focus();
  });

  const pick = (key: string) => {
    setFresh(null);
    setEditing(false);
    setChosen(key);
    moved.current = true;
  };
  const del = useMutation({
    mutationFn: (note: Draft) => client.saveNote(note.kind, refOf(note), ""),
    onSuccess: () => {
      setAsking(false);
      setChosen(null);
      notify({ tone: "ok", text: t(M.deleted) });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["practice", site] }),
  });

  if (book !== null) return <NoteBookView track={book} onBack={() => setBook(null)} />;

  return (
    <div className="ln-stack">
      {offline ? <Offline /> : null}
      <header className="lm-head">
        <div className="ln-grow">
          <p className="ln-eyebrow">{t(screenById("notes")?.title ?? M.kTopic)}</p>
          <h1 className="ln-page-h1">{t(M.notesTitle)}</h1>
          <p className="lm-sub">{t(M.notesSub)}</p>
        </div>
      </header>

      <div className="lm-notes">
        <aside className="lm-side" aria-label={t(screenById("notes")?.title ?? M.kTopic)}>
          <label className="lm-search">
            <Search aria-hidden="true" />
            <span className="ln-sr">{t(M.search)}</span>
            <input className="ln-input" type="search" value={query} placeholder={t(M.search)} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <form
            className="lm-new"
            onSubmit={(event) => {
              event.preventDefault();
              const name = topic.trim();
              if (name === "") return;
              const draft: Draft = { kind: "topic", ref: name, title: name, body: "" };
              const had = notes.find((n) => noteKey(n) === noteKey(draft));
              setQuery("");
              setTopic("");
              if (had === undefined) {
                setFresh(draft);
                setChosen(null);
              } else {
                setFresh(null);
                setChosen(noteKey(had));
              }
              setEditing(true);
            }}
          >
            <label className="ln-field">
              <span>{t(M.newNote)}</span>
              <span className="lm-new-row">
                <input className="ln-input" value={topic} maxLength={80} placeholder={t(M.topicHint)} onChange={(event) => setTopic(event.target.value)} />
                <button type="submit" className="ln-btn" disabled={topic.trim() === "" || offline}>
                  <Plus aria-hidden="true" />
                  {t(M.write)}
                </button>
              </span>
            </label>
          </form>
          {notes.length > 0 && found.length === 0 ? <p className="lm-fine ln-faint">{t(M.noMatch)}</p> : null}
          {found.length === 0 ? null : (
            <ul className="lm-note-list">
              {found.map((n) => (
                <li key={noteKey(n)}>
                  <button type="button" className="lm-note-item" aria-current={current !== null && fresh === null && noteKey(n) === noteKey(current) ? "true" : undefined} onClick={() => pick(noteKey(n))}>
                    <b>{n.title}</b>
                    <span className="ln-faint">
                      {t(KIND_WORD[n.kind])}
                      {n.updatedAt === null ? null : (
                        <>
                          {" · "}
                          <Dated at={n.updatedAt} />
                        </>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <BookPicker onOpen={setBook} />
        </aside>

        {current === null ? (
          <div className="lm-paper">
            <Empty icon={<NotebookPen />} title={t(M.noNotes)} body={t(M.noNotesBody)} />
          </div>
        ) : (
          <article className="lm-paper" aria-labelledby={`${id}-note`}>
            <div className="lm-paper-top">
              <span className="lm-kind">{t(KIND_WORD[current.kind])}</span>
              {currentNote === null || currentNote.updatedAt === null ? null : (
                <span className="ln-faint">
                  {fill(t(M.edited), { date: "\u0000" })
                    .split("\u0000")
                    .flatMap((part, i) => (i === 0 ? [part] : [<Dated key={i} at={currentNote.updatedAt!} />, part]))}
                </span>
              )}
            </div>
            <h2 className="lm-note-h" id={`${id}-note`} ref={paper} tabIndex={-1}>
              {current.title}
            </h2>
            {editing ? (
              <NoteEditor
                key={noteKey(current)}
                note={current}
                offline={offline}
                onCancel={() => {
                  setEditing(false);
                  setFresh(null);
                }}
                onSaved={(saved) => {
                  setEditing(false);
                  setFresh(null);
                  setChosen(noteKey(saved));
                  notify({ tone: "ok", text: t(M.saved) });
                }}
              />
            ) : (
              <>
                <Markdown source={current.body} className="ln-md" />
                <Linked note={current} />
                <div className="lm-row">
                  <button type="button" className="ln-btn" onClick={() => setEditing(true)} disabled={offline}>
                    <Pencil aria-hidden="true" />
                    {t(M.edit)}
                  </button>
                  <button type="button" className="ln-btn ln-btn-ghost lm-danger" onClick={() => setAsking(true)} aria-haspopup="dialog" disabled={offline}>
                    <Trash2 aria-hidden="true" />
                    {t(M.del)}
                  </button>
                </div>
              </>
            )}
          </article>
        )}
      </div>

      {asking && current !== null ? (
        <Dialog label={t(M.del)} onClose={() => setAsking(false)} className="lm-dialog">
          <h2 className="ln-h3">{t(M.del)}</h2>
          <p>{fill(t(M.delAsk), { title: current.title })}</p>
          {del.isError ? <Failed error={del.error} onRetry={() => del.mutate(current)} headingLevel={3} /> : null}
          <div className="lm-row lm-end">
            <button type="button" className="ln-btn ln-btn-ghost" onClick={() => setAsking(false)}>
              {t(M.cancel)}
            </button>
            <button type="button" className="ln-btn ln-btn-pri lm-danger-btn" disabled={del.isPending} onClick={() => del.mutate(current)}>
              <Trash2 aria-hidden="true" />
              {t(M.del)}
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

/** Where a note belongs: its problem (and that problem's revision) or its lesson, at their addresses on this site. */
function Linked({ note }: { readonly note: Draft }) {
  const { t } = useLearn();
  if (note.kind === "topic") return null;
  const to = `${note.kind === "lesson" ? "lessons" : "problems"}/${encodeURIComponent(note.ref)}`;
  return (
    <div className="lm-links">
      <span className="ln-eyebrow">{t(M.linked)}</span>
      <ScreenLink to={to} className="lm-chip">
        {t(note.kind === "lesson" ? M.openLesson : M.openProblem)}
        <ArrowRight aria-hidden="true" />
      </ScreenLink>
      {note.kind === "problem" ? (
        <ScreenLink to="revision" className="lm-chip">
          {t(M.revisionCard)}
          <ArrowRight aria-hidden="true" />
        </ScreenLink>
      ) : null}
    </div>
  );
}

function NoteEditor({ note, offline, onCancel, onSaved }: { readonly note: Draft; readonly offline: boolean; readonly onCancel: () => void; readonly onSaved: (saved: Note) => void }) {
  const { t, site } = useLearn();
  const { client } = useLearnData();
  const queryClient = useQueryClient();
  const id = useId();
  const [body, setBody] = useState(note.body);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => box.current?.focus(), []);
  const save = useMutation({
    mutationFn: () => client.saveNote(note.kind, refOf(note), body, note.kind === "topic" ? note.title : undefined),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["practice", site] });
      onSaved(saved);
    },
  });
  return (
    <form
      className="lm-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (body.trim() !== "") save.mutate();
      }}
    >
      <label className="ln-field">
        <span>{t(M.body)}</span>
        <textarea ref={box} className="ln-input lm-text" value={body} rows={12} maxLength={50_000} onChange={(event) => setBody(event.target.value)} aria-describedby={`${id}-hint`} />
      </label>
      <p className="lm-fine ln-faint" id={`${id}-hint`}>
        {t(M.bodyHint)}
      </p>
      {save.isError ? <Failed error={save.error} onRetry={() => save.mutate()} headingLevel={3} /> : null}
      <div className="lm-row">
        <button type="submit" className="ln-btn ln-btn-pri" disabled={body.trim() === "" || save.isPending || offline}>
          {t(M.save)}
        </button>
        <button type="button" className="ln-btn ln-btn-ghost" onClick={onCancel}>
          {t(M.cancel)}
        </button>
      </div>
    </form>
  );
}

/** Choose a track, to read its notes on one page. Nothing shows while the site has no track. */
function BookPicker({ onOpen }: { readonly onOpen: (track: string) => void }) {
  const { t } = useLearn();
  const tracks = useTracks();
  const [track, setTrack] = useState("");
  const all = tracks.data ?? [];
  if (all.length === 0) return null;
  const chosen = track || all[0]!.slug;
  return (
    <form
      className="lm-book ln-card ln-card-pad"
      onSubmit={(event) => {
        event.preventDefault();
        onOpen(chosen);
      }}
    >
      <b className="lm-book-h">
        <Printer aria-hidden="true" />
        {t(M.book)}
      </b>
      <p className="lm-fine ln-faint">{t(M.bookHint)}</p>
      <span className="lm-new-row">
        <label className="ln-sr" htmlFor="lm-book-track">
          {t(M.track)}
        </label>
        <select id="lm-book-track" className="ln-input" value={chosen} onChange={(event) => setTrack(event.target.value)}>
          {all.map((tr) => (
            <option key={tr.slug} value={tr.slug}>
              {tr.title}
            </option>
          ))}
        </select>
        <button type="submit" className="ln-btn">
          {t(M.bookGo)}
        </button>
      </span>
    </form>
  );
}

/** A track's notes, module by module, then the topic notes: printed, or saved as a PDF by the browser. */
function NoteBookView({ track, onBack }: { readonly track: string; readonly onBack: () => void }) {
  const { t } = useLearn();
  const book = useNoteBook(track);
  const back = (
    <button type="button" className="ln-btn ln-btn-ghost lm-noprint" onClick={onBack}>
      <ArrowLeft aria-hidden="true" />
      {t(M.bookBack)}
    </button>
  );
  if (book.isPending) {
    return (
      <div className="ln-stack">
        {back}
        <Loading shape="doc" />
      </div>
    );
  }
  if (book.isError) {
    return (
      <div className="ln-stack">
        {back}
        <Failed error={book.error} onRetry={() => void book.refetch()} retrying={book.isFetching} />
      </div>
    );
  }
  const b = book.data;
  const empty = b.modules.length === 0 && b.topics.length === 0;
  return (
    <article className="ln-stack lm-bookview" aria-labelledby="lm-book-h">
      <div className="lm-row lm-noprint">
        {back}
        <span className="ln-grow" />
        <button type="button" className="ln-btn ln-btn-pri" onClick={() => window.print()} disabled={empty}>
          <Printer aria-hidden="true" />
          {t(M.print)}
        </button>
      </div>
      <header>
        <p className="ln-eyebrow">{t(screenById("notes")?.title ?? M.kTopic)}</p>
        <h1 className="ln-page-h1" id="lm-book-h">
          {b.track.title}
        </h1>
      </header>
      {empty ? <p className="ln-faint">{t(M.bookEmpty)}</p> : null}
      {b.modules.map((m) => (
        <section key={m.title} className="lm-book-mod" aria-label={m.title}>
          <h2 className="lm-book-mh">{m.title}</h2>
          {m.notes.map((n) => (
            <div key={`${n.kind}:${n.slug}`} className="lm-book-note">
              <h3 className="ln-h3">
                <span className="lm-kind">{t(KIND_WORD[n.kind])}</span> {n.title}
              </h3>
              <Markdown source={n.body} className="ln-md" />
            </div>
          ))}
        </section>
      ))}
      {b.topics.length === 0 ? null : (
        <section className="lm-book-mod" aria-label={t(M.topicNotes)}>
          <h2 className="lm-book-mh">{t(M.topicNotes)}</h2>
          {b.topics.map((n) => (
            <div key={n.title} className="lm-book-note">
              <h3 className="ln-h3">{n.title}</h3>
              <Markdown source={n.body} className="ln-md" />
            </div>
          ))}
        </section>
      )}
    </article>
  );
}
