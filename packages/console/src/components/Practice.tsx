import { Fragment, lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ExternalLink, EyeOff, Eye, MessageSquare, Trophy, Users } from "lucide-react";
import {
  ConsoleError,
  type ConsoleClient,
  type Difficulty,
  type PracticeContest,
  type PracticeProblem,
  type PracticeSiteSettings,
  type PracticeSimilarity,
} from "../api.ts";
import { DifficultyBadge, KIND_NAME } from "./Bank.tsx";
import { EmptyState, SkeletonRows } from "./kit.tsx";
import { CoinStore, Companies, Experiences, StarterPacks } from "./CommunityAdmin.tsx";
import { Lessons, PlusAdmin, ProblemOfTheDay, Tracks } from "./PrepAdmin.tsx";

// Coupons and sales are a manager's, and seldom opened: a chunk of their own.
const Sales = lazy(() => import("./Sales.tsx").then((m) => ({ default: m.Sales })));
const Analytics = lazy(() => import("./PrepAnalytics.tsx").then((m) => ({ default: m.PrepAnalyticsPanel })));

/**
 * A practice site (ROADMAP §15): the organisation's problems at
 * /practice/<address>, for learners with accounts of their own. Problems are
 * copies of bank questions, as an exam's are; editing the bank later changes
 * nothing published.
 */

type Tab = "site" | "analytics" | "problems" | "tracks" | "lessons" | "potd" | "plus" | "sales" | "companies" | "experiences" | "store" | "contests" | "learners" | "discussion";

export interface PracticeCan {
  readonly manage: boolean;
  readonly write: boolean;
  readonly readLearners: boolean;
  /** Read learners' code side by side, to compare it. */
  readonly review?: boolean;
}

const failure = (error: unknown, fallback: string) =>
  error instanceof ConsoleError ? (error.detail ?? (error.problems[0]?.message ?? fallback)) : fallback;

export function PracticePanel({ client, can }: { client: ConsoleClient; can: PracticeCan }) {
  const [tab, setTab] = useState<Tab>("site");
  const tabs: [Tab, string][] = [
    ["site", "Site"],
    ["analytics", "Analytics"],
    ["problems", "Problems"],
    ["tracks", "Tracks"],
    ["lessons", "Lessons"],
    ["potd", "Problem of the day"],
    ["plus", "Plus"],
    ...(can.manage ? ([["sales", "Coupons and sales"]] as [Tab, string][]) : []),
    ["companies", "Companies"],
    ["experiences", "Experiences"],
    ["store", "Coin store"],
    ["contests", "Contests"],
    ...(can.readLearners ? ([["learners", "Learners"]] as [Tab, string][]) : []),
    ["discussion", "Discussion"],
  ];
  return (
    <>
      <div className="tabs" role="tablist" aria-label="Practice">
        {tabs.map(([name, label]) => (
          <button key={name} type="button" role="tab" aria-selected={tab === name} className={tab === name ? "tab on" : "tab"} onClick={() => setTab(name)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "site" ? (
        <>
          <SiteSettings client={client} canManage={can.manage} />
          {can.manage ? <SignInSettings client={client} /> : null}
        </>
      ) : null}
      {tab === "problems" ? <Problems client={client} canWrite={can.write} canReview={can.review === true} /> : null}
      {tab === "tracks" ? (
        <>
          <StarterPacks client={client} canWrite={can.write} />
          <Tracks client={client} canWrite={can.write} />
        </>
      ) : null}
      {tab === "lessons" ? <Lessons client={client} canWrite={can.write} /> : null}
      {tab === "potd" ? <ProblemOfTheDay client={client} canWrite={can.write} /> : null}
      {tab === "plus" ? <PlusAdmin client={client} canManage={can.manage} /> : null}
      {tab === "analytics" ? (
        <Suspense fallback={<p className="notice">Loading…</p>}>
          <Analytics client={client} />
        </Suspense>
      ) : null}
      {tab === "sales" ? (
        <Suspense fallback={<p className="notice">Loading…</p>}>
          <Sales client={client} />
        </Suspense>
      ) : null}
      {tab === "companies" ? <Companies client={client} canWrite={can.write} /> : null}
      {tab === "experiences" ? <Experiences client={client} canWrite={can.write} /> : null}
      {tab === "store" ? <CoinStore client={client} canManage={can.manage} /> : null}
      {tab === "contests" ? <Contests client={client} canWrite={can.write} /> : null}
      {tab === "learners" ? <Learners client={client} /> : null}
      {tab === "discussion" ? <Discussion client={client} canWrite={can.write} /> : null}
    </>
  );
}

// --- the site ---------------------------------------------------------------------

const EMPTY_SITE: PracticeSiteSettings = { slug: "", title: "", welcome: "", open: false };

function SiteSettings({ client, canManage }: { client: ConsoleClient; canManage: boolean }) {
  const queryClient = useQueryClient();
  const site = useQuery({ queryKey: ["practice", "site"], queryFn: () => client.practiceSite() });
  const [draft, setDraft] = useState<PracticeSiteSettings>(EMPTY_SITE);
  useEffect(() => {
    if (site.data != null) setDraft(site.data);
  }, [site.data]);
  const save = useMutation({
    mutationFn: () => client.savePracticeSite(draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["practice", "site"] }),
  });
  if (site.isPending)
    return (
      <section className="card">
        <SkeletonRows rows={3} columns={2} label="Loading the practice site…" />
      </section>
    );
  const address = `${window.location.origin}/practice/${site.data?.slug ?? draft.slug}`;
  return (
    <section className="card" aria-label="Practice site">
      <div className="bar">
        <strong>The site</strong>
        {site.data?.open === true ? (
          <a className="pill ok" href={address} target="_blank" rel="noreferrer">
            Open · {address} <ExternalLink aria-hidden="true" className="inline-icon" />
          </a>
        ) : (
          <span className="pill">{site.data == null ? "Not set up" : "Closed"}</span>
        )}
      </div>
      <p className="notice">
        Learners sign up at the site's address with an account of their own, practise the problems you publish, and take part in contests. Nothing they do there
        reaches an exam record. Closed, the site shows nobody anything.
      </p>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <fieldset disabled={!canManage}>
          <div className="grid">
            <div className="field">
              <label htmlFor="practice-slug">Address</label>
              <div className="prefixed">
                <span className="notice">/practice/</span>
                <input
                  id="practice-slug"
                  value={draft.slug}
                  placeholder="nit-practice"
                  pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase() })}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="practice-title">Title</label>
              <input id="practice-title" value={draft.title} maxLength={120} placeholder="NIT Practice Arena" onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="practice-welcome">Welcome (Markdown)</label>
            <textarea id="practice-welcome" rows={3} value={draft.welcome} onChange={(e) => setDraft({ ...draft, welcome: e.target.value })} />
          </div>
          <label className="inline">
            <input type="checkbox" checked={draft.open} onChange={(e) => setDraft({ ...draft, open: e.target.checked })} /> Open to learners
          </label>
          {save.isError ? <p className="error">{failure(save.error, "The site was not saved.")}</p> : null}
          {save.isSuccess ? (
            <p className="notice" role="status">
              Saved.
            </p>
          ) : null}
          <div className="row">
            <button type="submit" disabled={save.isPending || draft.slug === "" || draft.title.trim() === ""}>
              Save site
            </button>
          </div>
        </fieldset>
        {canManage ? null : <p className="notice">Only an owner can change the site.</p>}
      </form>
    </section>
  );
}

// --- how learners sign in -------------------------------------------------------------

function SignInSettings({ client }: { client: ConsoleClient }) {
  const queryClient = useQueryClient();
  const current = useQuery({ queryKey: ["practice", "sign-in"], queryFn: () => client.practiceSignIn() });
  const [draft, setDraft] = useState({ requireVerified: false, googleEnabled: false, clientId: "", clientSecret: "" });
  useEffect(() => {
    const c = current.data;
    if (c !== undefined) setDraft((d) => ({ ...d, requireVerified: c.requireVerified, googleEnabled: c.google.enabled, clientId: c.google.clientId ?? "" }));
  }, [current.data]);
  const save = useMutation({
    mutationFn: () =>
      client.savePracticeSignIn({
        requireVerified: draft.requireVerified,
        google: {
          enabled: draft.googleEnabled,
          clientId: draft.clientId.trim() === "" ? null : draft.clientId.trim(),
          ...(draft.clientSecret === "" ? {} : { clientSecret: draft.clientSecret }),
        },
      }),
    onSuccess: async () => {
      setDraft((d) => ({ ...d, clientSecret: "" }));
      await queryClient.invalidateQueries({ queryKey: ["practice", "sign-in"] });
    },
  });
  if (current.data === undefined) return null;
  return (
    <section className="card" aria-label="How learners sign in">
      <strong>How learners sign in</strong>
      <p className="notice">
        Every learner is sent a link to confirm their email address. You can keep submitting and discussing for those who have — reading problems stays open to
        everyone — and let learners sign in with their Google account, which confirms the address by itself.
      </p>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label className="inline">
          <input type="checkbox" checked={draft.requireVerified} onChange={(e) => setDraft({ ...draft, requireVerified: e.target.checked })} /> Only confirmed
          addresses can submit and comment
        </label>
        <label className="inline">
          <input type="checkbox" checked={draft.googleEnabled} onChange={(e) => setDraft({ ...draft, googleEnabled: e.target.checked })} /> Offer “Continue with
          Google”
        </label>
        {draft.googleEnabled ? (
          <>
            <div className="grid">
              <div className="field">
                <label htmlFor="google-client">Google OAuth client ID</label>
                <input id="google-client" value={draft.clientId} onChange={(e) => setDraft({ ...draft, clientId: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="google-secret">Client secret</label>
                <input
                  id="google-secret"
                  type="password"
                  autoComplete="off"
                  placeholder={current.data.google.secretSet ? "Unchanged" : ""}
                  value={draft.clientSecret}
                  onChange={(e) => setDraft({ ...draft, clientSecret: e.target.value })}
                />
              </div>
            </div>
            {current.data.redirectUri === null ? (
              <p className="notice">Give the site an address first: Google needs it.</p>
            ) : (
              <p className="notice">
                In Google Cloud Console, create an OAuth client (Web application) and add this authorised redirect URI: <code>{current.data.redirectUri}</code>
              </p>
            )}
          </>
        ) : null}
        {save.isError ? <p className="error">{failure(save.error, "Not saved.")}</p> : null}
        {save.isSuccess ? (
          <p className="notice" role="status">
            Saved.
          </p>
        ) : null}
        <div className="row">
          <button type="submit" disabled={save.isPending}>
            Save
          </button>
        </div>
      </form>
    </section>
  );
}

// --- similar code between learners ----------------------------------------------------

function LearnerSimilarity({ client, problemId, onClose }: { client: ConsoleClient; problemId: string; onClose: () => void }) {
  const report = useQuery({ queryKey: ["practice", "similarity", problemId], queryFn: () => client.practiceSimilarity(problemId) });
  const [open, setOpen] = useState<number | null>(null);
  const data: PracticeSimilarity | undefined = report.data;
  return (
    <div className="evidence similarity-question" aria-label="Similar code">
      <div className="bar">
        <strong>Similar code{data === undefined ? "" : ` · ${data.problem.title}`}</strong>
        <button type="button" className="quiet" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="notice">
        Each learner's latest accepted answer, compared once names, comments, layout and the starter code are set aside. Two short answers to a narrow problem can
        honestly match; this changes nothing a learner sees.
      </p>
      {report.isPending ? <p className="notice">Comparing…</p> : null}
      {report.isError ? <p className="error">{failure(report.error, "Could not compare.")}</p> : null}
      {data === undefined ? null : data.pairs.length === 0 ? (
        <p className="notice">
          {data.compared} answer{data.compared === 1 ? "" : "s"} compared · no two alike enough to look at.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Learners</th>
              <th scope="col">Alike</th>
              <th scope="col">Language</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {data.pairs.map((pair, i) => {
              const percent = Math.round(pair.similarity * 100);
              return (
                <Fragment key={`${pair.a.learnerId}:${pair.b.learnerId}`}>
                  <tr>
                    <td>
                      {pair.a.name} <span className="notice">and</span> {pair.b.name}
                    </td>
                    <td>
                      <span className={`pill ${percent >= 90 ? "bad" : "attention"}`}>{percent}%</span>
                    </td>
                    <td>{pair.a.language}</td>
                    <td>
                      <button type="button" className="quiet" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                        {open === i ? "Close" : "Compare"}
                      </button>
                    </td>
                  </tr>
                  {open === i ? (
                    <tr className="compare-row">
                      <td colSpan={4}>
                        <div className="compare" role="group" aria-label={`${pair.a.name} and ${pair.b.name}, side by side`}>
                          {[pair.a, pair.b].map((side) => (
                            <figure key={side.learnerId}>
                              <figcaption>
                                {side.name} · {side.status === "passed" ? "accepted" : side.status.replace(/_/g, " ")}
                              </figcaption>
                              <pre className="code">{side.source}</pre>
                            </figure>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// --- problems ------------------------------------------------------------------------

const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

function Problems({ client, canWrite, canReview }: { client: ConsoleClient; canWrite: boolean; canReview: boolean }) {
  const problems = useQuery({ queryKey: ["practice", "problems"], queryFn: () => client.practiceProblems() });
  const site = useQuery({ queryKey: ["practice", "site"], queryFn: () => client.practiceSite() });
  const [editing, setEditing] = useState<string | null>(null);
  const [comparing, setComparing] = useState<string | null>(null);
  const list = problems.data ?? [];
  return (
    <>
      {canWrite ? <Publish client={client} published={list} /> : null}
      <section className="card" aria-label="Published problems">
        <div className="bar">
          <strong>Problems</strong>
          <span className="notice">{list.length} published</span>
        </div>
        {problems.isPending ? (
          <SkeletonRows columns={4} label="Loading problems…" />
        ) : list.length === 0 ? (
          <EmptyState icon={BookOpen} compact>
            Problems learners can practise appear here. Publish a question from the bank to start.
          </EmptyState>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Problem</th>
                <th scope="col">Difficulty</th>
                <th scope="col">Shown</th>
                <th scope="col" className="num">
                  Submissions
                </th>
                <th scope="col" className="num">
                  Solved by
                </th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) =>
                editing === p.id ? (
                  <tr key={p.id}>
                    <td colSpan={6}>
                      <ProblemEditor client={client} problem={p} onDone={() => setEditing(null)} />
                    </td>
                  </tr>
                ) : comparing === p.id ? (
                  <tr key={p.id}>
                    <td colSpan={6}>
                      <LearnerSimilarity client={client} problemId={p.id} onClose={() => setComparing(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id}>
                    <td>
                      {site.data?.open === true ? (
                        <a href={`/practice/${site.data.slug}/problems/${p.slug}`} target="_blank" rel="noreferrer">
                          {p.title}
                        </a>
                      ) : (
                        <span>{p.title}</span>
                      )}
                      <span className="notice small">
                        {" "}
                        · {KIND_NAME[p.question.kind as keyof typeof KIND_NAME] ?? p.question.kind}
                        {p.tags.length > 0 ? ` · ${p.tags.join(", ")}` : ""}
                        {p.editorial.trim() === "" ? " · no editorial" : ""}
                      </span>
                    </td>
                    <td>
                      <DifficultyBadge difficulty={p.difficulty} />
                    </td>
                    <td>{p.published ? <span className="pill ok">Published</span> : <span className="pill">Hidden</span>}</td>
                    <td className="num">{p.submissions}</td>
                    <td className="num">{p.solvedBy}</td>
                    <td className="actions">
                      {canWrite ? (
                        <button type="button" className="secondary" onClick={() => setEditing(p.id)} aria-label={`Edit ${p.title}`}>
                          Edit
                        </button>
                      ) : null}
                      {canReview && p.question.kind === "code" ? (
                        <button type="button" className="quiet" onClick={() => setComparing(p.id)} aria-label={`Similar code for ${p.title}`}>
                          Similar code
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function Publish({ client, published }: { client: ConsoleClient; published: readonly PracticeProblem[] }) {
  const queryClient = useQueryClient();
  const bank = useQuery({ queryKey: ["bank", "for-practice"], queryFn: () => client.listBank() });
  const [questionId, setQuestionId] = useState("");
  const [editorial, setEditorial] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const publish = useMutation({
    mutationFn: () =>
      client.publishProblem({ bankQuestionId: questionId, ...(editorial.trim() === "" ? {} : { editorial }), ...(difficulty === "" ? {} : { difficulty }) }),
    onSuccess: async () => {
      setQuestionId("");
      setEditorial("");
      setDifficulty("");
      await queryClient.invalidateQueries({ queryKey: ["practice", "problems"] });
    },
  });
  const already = new Set(published.map((p) => p.fromBank));
  // A short answer needs a person or a model to mark it; practice checks by machine.
  const eligible = (bank.data?.questions ?? []).filter((q) => q.question.kind !== "short" && !(q.question.kind === "code" && (q.question.tests ?? []).length === 0));
  const label = (stem: string) => stem.split("\n")[0]!.replace(/[`*_#]/g, "").slice(0, 90);
  return (
    <section className="card" aria-label="Publish from the bank">
      <div className="bar">
        <strong>Publish from the bank</strong>
      </div>
      <p className="notice">
        Code questions with tests, multiple choice and numeric questions can be practised: each is checked by machine. The editorial opens to a learner once they
        solve the problem or have tried three times, and stays shut during a contest.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          publish.mutate();
        }}
      >
        <div className="grid">
          <div className="field">
            <label htmlFor="publish-question">Question</label>
            <select id="publish-question" value={questionId} onChange={(e) => setQuestionId(e.target.value)}>
              <option value="">Choose a question…</option>
              {eligible.map((q) => (
                <option key={q.id} value={q.id}>
                  {already.has(q.id) ? "✓ " : ""}
                  {label(q.question.stem)} ({q.question.kind}, {q.difficulty})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="publish-difficulty">Difficulty</label>
            <select id="publish-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty | "")}>
              <option value="">As in the bank</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="publish-editorial">Editorial (Markdown)</label>
          <textarea id="publish-editorial" rows={4} value={editorial} placeholder="How to solve it, and why that works." onChange={(e) => setEditorial(e.target.value)} />
        </div>
        {publish.isError ? <p className="error">{failure(publish.error, "Not published.")}</p> : null}
        <div className="row">
          <button type="submit" disabled={questionId === "" || publish.isPending}>
            Publish
          </button>
        </div>
      </form>
    </section>
  );
}

function ProblemEditor({ client, problem, onDone }: { client: ConsoleClient; problem: PracticeProblem; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(problem.title);
  const [slug, setSlug] = useState(problem.slug);
  const [difficulty, setDifficulty] = useState<Difficulty>(problem.difficulty);
  const [tags, setTags] = useState(problem.tags.join(", "));
  const [editorial, setEditorial] = useState(problem.editorial);
  const [hint, setHint] = useState(problem.hint);
  const [published, setPublished] = useState(problem.published);
  const save = useMutation({
    mutationFn: () =>
      client.updateProblem(problem.id, {
        title,
        slug,
        difficulty,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t !== ""),
        editorial,
        hint,
        published,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["practice", "problems"] });
      onDone();
    },
  });
  const id = (name: string) => `edit-${problem.id}-${name}`;
  return (
    <form
      className="inline-editor"
      aria-label={`Edit ${problem.title}`}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid">
        <div className="field">
          <label htmlFor={id("title")}>Title</label>
          <input id={id("title")} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={id("slug")}>Address</label>
          <input id={id("slug")} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
        </div>
        <div className="field">
          <label htmlFor={id("difficulty")}>Difficulty</label>
          <select id={id("difficulty")} value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={id("tags")}>Tags, comma-separated</label>
          <input id={id("tags")} value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={id("editorial")}>Editorial (Markdown)</label>
        <textarea id={id("editorial")} rows={5} value={editorial} onChange={(e) => setEditorial(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={id("hint")}>First hint</label>
        <textarea id={id("hint")} rows={2} maxLength={2000} value={hint} aria-describedby={id("hint-help")} onChange={(e) => setHint(e.target.value)} />
        <p className="notice" id={id("hint-help")}>
          One observation or the pattern's name, not the approach. Learners get it free as the tutor's first hint, and the model is not asked. Leave empty to let
          the tutor write it.
        </p>
      </div>
      <label className="inline">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Shown to learners (a hidden problem can still be set in a contest)
      </label>
      {save.isError ? <p className="error">{failure(save.error, "Not saved.")}</p> : null}
      <div className="row">
        <button type="submit" disabled={save.isPending}>
          Save
        </button>
        <button type="button" className="secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// --- contests ---------------------------------------------------------------------------

/** A time as a datetime-local input shows it, in this browser's zone. */
const localInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const when = (iso: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

function Contests({ client, canWrite }: { client: ConsoleClient; canWrite: boolean }) {
  const contests = useQuery({ queryKey: ["practice", "contests"], queryFn: () => client.practiceContests() });
  const problems = useQuery({ queryKey: ["practice", "problems"], queryFn: () => client.practiceProblems() });
  const [editing, setEditing] = useState<PracticeContest | "new" | null>(null);
  const titleOf = new Map((problems.data ?? []).map((p) => [p.id, p.title]));
  return (
    <>
      {editing !== null ? (
        <ContestForm client={client} contest={editing === "new" ? null : editing} problems={problems.data ?? []} onDone={() => setEditing(null)} />
      ) : canWrite ? (
        <div className="row">
          <button type="button" onClick={() => setEditing("new")} disabled={(problems.data ?? []).length === 0}>
            Schedule a contest
          </button>
          {(problems.data ?? []).length === 0 ? <span className="notice">Publish a problem first.</span> : null}
        </div>
      ) : null}
      <section className="card" aria-label="Contests">
        <div className="bar">
          <strong>Contests</strong>
        </div>
        <p className="notice">
          A contest's problems are shown only once it starts, and are ranked the ICPC way: problems solved, then minutes to each solve plus 20 for every wrong try
          before it. A problem hidden from the problem set can be set in a contest, to be seen there first.
        </p>
        {(contests.data ?? []).length === 0 ? (
          <EmptyState icon={Trophy} compact>
            Contests you schedule appear here, with who took part.
          </EmptyState>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Contest</th>
                <th scope="col">When</th>
                <th scope="col">Problems</th>
                <th scope="col">State</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {contests.data!.map((c) => (
                <tr key={c.id}>
                  <td>{c.title}</td>
                  <td>
                    {when(c.startsAt)} – {when(c.endsAt)}
                  </td>
                  <td>{c.problemIds.map((id, i) => `${String.fromCharCode(65 + i)}. ${titleOf.get(id) ?? id}`).join(" · ")}</td>
                  <td>
                    <span className={`pill${c.state === "running" ? " live" : c.state === "upcoming" ? " brand" : ""}`}>{c.state}</span>
                  </td>
                  <td>
                    {canWrite && c.state !== "ended" ? (
                      <button type="button" className="secondary" onClick={() => setEditing(c)}>
                        Change
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function ContestForm({
  client,
  contest,
  problems,
  onDone,
}: {
  client: ConsoleClient;
  contest: PracticeContest | null;
  problems: readonly PracticeProblem[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const inAnHour = new Date(Date.now() + 3_600_000);
  inAnHour.setMinutes(0, 0, 0);
  const [title, setTitle] = useState(contest?.title ?? "");
  const [description, setDescription] = useState(contest?.description ?? "");
  const [starts, setStarts] = useState(localInput(contest?.startsAt ?? inAnHour.toISOString()));
  const [minutes, setMinutes] = useState(contest === null ? 90 : Math.round((Date.parse(contest.endsAt) - Date.parse(contest.startsAt)) / 60_000));
  const [chosen, setChosen] = useState<readonly string[]>(contest?.problemIds ?? []);
  const save = useMutation({
    mutationFn: () => {
      const startsAt = new Date(starts).toISOString();
      return client.saveContest(contest?.id ?? null, {
        title,
        description,
        startsAt,
        endsAt: new Date(Date.parse(startsAt) + minutes * 60_000).toISOString(),
        problemIds: chosen,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["practice", "contests"] });
      onDone();
    },
  });
  const toggle = (id: string) => setChosen(chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id]);
  return (
    <section className="card" aria-label={contest === null ? "Schedule a contest" : `Change ${contest.title}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid">
          <div className="field">
            <label htmlFor="contest-title">Title</label>
            <input id="contest-title" value={title} placeholder="Weekly Contest 1" onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="contest-starts">Starts</label>
            <input id="contest-starts" type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="contest-minutes">Length (minutes)</label>
            <input id="contest-minutes" type="number" min={10} max={10_080} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="contest-description">Description (Markdown)</label>
          <textarea id="contest-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <fieldset>
          <legend>Problems, in the order chosen (A, B, C…)</legend>
          {problems.map((p) => (
            <label key={p.id} className="inline problem-pick">
              <input type="checkbox" checked={chosen.includes(p.id)} onChange={() => toggle(p.id)} />
              {chosen.includes(p.id) ? <strong>{String.fromCharCode(65 + chosen.indexOf(p.id))}.</strong> : null} {p.title}{" "}
              <span className="notice small">
                ({p.difficulty}
                {p.published ? "" : ", hidden"})
              </span>
            </label>
          ))}
        </fieldset>
        {save.isError ? <p className="error">{failure(save.error, "Not saved.")}</p> : null}
        <div className="row">
          <button type="submit" disabled={save.isPending || title.trim() === "" || chosen.length === 0}>
            {contest === null ? "Schedule" : "Save"}
          </button>
          <button type="button" className="secondary" onClick={onDone}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

// --- learners ----------------------------------------------------------------------------

function Learners({ client }: { client: ConsoleClient }) {
  const learners = useQuery({ queryKey: ["practice", "learners"], queryFn: () => client.practiceLearners() });
  const list = learners.data ?? [];
  return (
    <section className="card" aria-label="Learners">
      <div className="bar">
        <strong>Learners</strong>
        <span className="notice">{list.length} signed up</span>
      </div>
      {learners.isPending ? (
        <SkeletonRows columns={3} label="Loading learners…" />
      ) : list.length === 0 ? (
        <EmptyState icon={Users} compact>
          Learners who sign up on your practice site appear here, with what they have solved.
        </EmptyState>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Joined</th>
              <th scope="col" className="num">
                Solved
              </th>
              <th scope="col" className="num">
                Submissions
              </th>
              <th scope="col">Last active</th>
            </tr>
          </thead>
          <tbody>
            {list.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td>{l.email}</td>
                <td>{when(l.joinedAt)}</td>
                <td className="num">{l.solved}</td>
                <td className="num">{l.submissions}</td>
                <td>{l.lastActiveAt === null ? "—" : when(l.lastActiveAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// --- discussion ------------------------------------------------------------------------------

function Discussion({ client, canWrite }: { client: ConsoleClient; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const comments = useQuery({ queryKey: ["practice", "comments"], queryFn: () => client.practiceComments() });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["practice", "comments"] });
  const hide = useMutation({ mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) => client.hideComment(id, hidden), onSuccess: refresh });
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [text, setText] = useState("");
  const reply = useMutation({
    mutationFn: (problemSlug: string) => client.replyInPractice(problemSlug, text),
    onSuccess: async () => {
      setText("");
      setReplyTo(null);
      await refresh();
    },
  });
  const list = comments.data ?? [];
  return (
    <section className="card" aria-label="Discussion">
      <div className="bar">
        <strong>Discussion</strong>
      </div>
      <p className="notice">
        Every comment on every problem, newest first. Hide one that gives an answer away or does not belong; it is kept, and can be shown again. A reply from staff
        is marked as such.
      </p>
      {comments.isPending ? (
        <SkeletonRows rows={3} columns={2} label="Loading comments…" />
      ) : list.length === 0 ? (
        <EmptyState icon={MessageSquare} compact>
          Learners' comments on problems appear here, newest first.
        </EmptyState>
      ) : (
        <ul className="comment-list">
          {list.map((c) => (
            <li key={c.id} className={c.hidden ? "hidden-comment" : undefined}>
              <p className="comment-head">
                <strong>{c.authorName}</strong>
                {c.fromStaff ? <span className="pill brand">Staff</span> : null}
                {c.hidden ? <span className="pill warn">Hidden</span> : null}
                <span className="notice small">
                  on {c.problemTitle} · {when(c.createdAt)}
                </span>
              </p>
              <p className="comment-body">{c.body}</p>
              {canWrite ? (
                <div className="row">
                  <button type="button" className="secondary" onClick={() => hide.mutate({ id: c.id, hidden: !c.hidden })}>
                    {c.hidden ? <Eye aria-hidden="true" className="inline-icon" /> : <EyeOff aria-hidden="true" className="inline-icon" />}
                    {c.hidden ? "Show again" : "Hide"}
                  </button>
                  {c.fromStaff ? null : (
                    <button type="button" className="secondary" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
                      Reply
                    </button>
                  )}
                </div>
              ) : null}
              {replyTo === c.id ? (
                <form
                  className="reply-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    reply.mutate(c.problemSlug);
                  }}
                >
                  <label className="visually-hidden" htmlFor={`reply-${c.id}`}>
                    Your reply
                  </label>
                  <textarea id={`reply-${c.id}`} rows={2} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} />
                  {reply.isError ? <p className="error">{failure(reply.error, "Not posted.")}</p> : null}
                  <button type="submit" disabled={text.trim() === "" || reply.isPending}>
                    Post reply
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
