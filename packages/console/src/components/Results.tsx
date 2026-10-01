import { lazy, Suspense, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, CircleCheck, CircleX, Download, ListChecks, Mail, Printer, Search, Send, Users } from "lucide-react";
import { useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type CandidateReport, type ConsoleClient, type Outcome, type QuestionStats, type ResultRow, type Results, type SectionScore, type Similarity, type Verdict } from "../api.ts";
import { Banner, EmptyState, FigureStrip, PageActions, SkeletonRows, StateBadge } from "./kit.tsx";
import { EraseCard } from "./Privacy.tsx";
import { ReleaseDialog } from "./Release.tsx";
import { IDENTITY_LABEL } from "./Proctoring.tsx";

// Loaded when a sitting has results: most never has a recheck.
const Rechecks = lazy(() => import("./Rechecks.tsx").then((m) => ({ default: m.Rechecks })));
const Shortlists = lazy(() => import("./Shortlists.tsx").then((m) => ({ default: m.Shortlists })));
const Marking = lazy(() => import("./Marking.tsx").then((m) => ({ default: m.Marking })));

/**
 * What a recruiter takes away from a sitting (ROADMAP §6): the cohort's
 * results, the spreadsheet, and a report per candidate.
 *
 * The follow-up figures are shown as evidence for a person to weigh, and are
 * kept apart from the marks everywhere. Candidates can be sorted by what they
 * scored, never by what the follow-ups made of them.
 */

const when = (ms: number) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(ms)) + " IST";

const minutes = (ms: number | null) => (ms === null ? "—" : `${Math.round(ms / 60_000)} min`);

const STATE: Record<ResultRow["state"], string> = {
  in_progress: "In progress",
  submitted: "To grade",
  graded: "Graded",
  void: "Set aside",
};

const VERDICTS: readonly Verdict[] = ["consistent", "shallow", "inconsistent", "inconclusive"];

const OUTCOME: Record<Outcome, string> = { qualified: "Qualified", failed: "Not qualified" };

/** Qualified or not, as a badge; nothing for an exam without a qualifying mark or an attempt not yet graded. */
export function OutcomeBadge({ outcome }: { outcome: Outcome | null | undefined }) {
  if (outcome === null || outcome === undefined) return null;
  return (
    <span className={`pill outcome ${outcome === "qualified" ? "ok" : "bad"}`}>
      {outcome === "qualified" ? <CircleCheck aria-hidden="true" /> : <CircleX aria-hidden="true" />}
      {OUTCOME[outcome]}
    </span>
  );
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

type SortKey = "ref" | "name" | "percent" | "minutes";

export function ResultsPanel({
  client,
  examId,
  onReport,
  canGrade = false,
  canRelease = false,
}: {
  client: ConsoleClient;
  examId: string;
  onReport: (attemptId: string) => void;
  /** This account grades: the attempts waiting can be graded from here, all at once. */
  canGrade?: boolean;
  /** This account reads results, and so may send candidates theirs. */
  canRelease?: boolean;
}) {
  const results = useQuery({ queryKey: ["results", examId], queryFn: () => client.results(examId) });
  const download = useMutation({
    mutationFn: async (format: "csv" | "xlsx") => save(await client.resultsFile(examId, format), `${examId}-results.${format}`),
  });
  const toast = useToast();
  const email = useMutation({
    mutationFn: () => client.emailResults(examId),
    onSuccess: ({ to }) => toast(`The results are on their way to ${to}.`, "success"),
    onError: (error) => toast(error instanceof ConsoleError && error.detail !== undefined ? error.detail : "The email could not be sent. Download the results instead.", "error"),
  });
  const empty = results.data === undefined || results.data.rows.length === 0;
  const [releasing, setReleasing] = useState(false);
  const downloads = (
    <PageActions>
      {canRelease ? (
        <button type="button" className="secondary" disabled={empty} onClick={() => setReleasing(true)}>
          <Send aria-hidden="true" />
          Send results to candidates…
        </button>
      ) : null}
      <button type="button" className="secondary" disabled={empty || email.isPending} onClick={() => email.mutate()}>
        <Mail aria-hidden="true" />
        Email to me
      </button>
      <button type="button" className="secondary" disabled={empty || download.isPending} onClick={() => download.mutate("xlsx")}>
        <Download aria-hidden="true" />
        Download Excel
      </button>
      <button type="button" className="secondary" disabled={empty || download.isPending} onClick={() => download.mutate("csv")}>
        <Download aria-hidden="true" />
        Download CSV
      </button>
    </PageActions>
  );

  const release =
    releasing && results.data !== undefined ? (
      <ReleaseDialog client={client} examId={examId} results={results.data} onClose={() => setReleasing(false)} />
    ) : null;

  if (results.isPending)
    return (
      <>
        {downloads}
        <section className="card">
          <SkeletonRows columns={6} label="Loading the results…" />
        </section>
      </>
    );
  if (results.error !== null) return <Banner tone="danger" title="Could not load the results.">Check the connection, then reload the page.</Banner>;
  const { rows, analytics } = results.data;
  const cutoff = results.data.exam.cutoff?.percent ?? null;
  const outcomes = analytics.qualified !== null && analytics.qualified !== undefined;
  const percent = (x: number | null) => (x === null ? "—" : `${x}%`);

  return (
    <>
      {downloads}
      {release}
      {download.error === null ? null : <Banner tone="danger" title="The download failed.">Try again in a moment.</Banner>}
      {canGrade ? <GradeAll client={client} examId={examId} waiting={rows.filter((r) => r.state === "submitted").length} /> : null}
      <FigureStrip
        figures={[
          { label: "Sat", value: analytics.candidates },
          { label: "Graded", value: analytics.graded },
          { label: "Mean", value: percent(analytics.meanPercent) },
          outcomes ? { label: "Qualified", value: analytics.qualified!, tone: "ok" } : { label: "Median", value: percent(analytics.medianPercent) },
        ]}
        line={[
          ...(outcomes ? [{ label: "Median", value: percent(analytics.medianPercent) }] : []),
          { label: "Median time", value: analytics.time.medianMinutes === null ? "—" : `${analytics.time.medianMinutes} min` },
          { label: "Set aside", value: analytics.setAside },
          ...(outcomes ? [{ label: "Not qualified", value: analytics.failed ?? 0 }] : []),
        ]}
      />
      {analytics.graded > 0 ? (
        <section className="card" aria-label="How the marks fell">
          <Distribution counts={analytics.distribution} cutoff={cutoff} />
        </section>
      ) : null}

      {canGrade && analytics.graded > 0 ? (
        <Suspense fallback={null}>
          <Marking client={client} examId={examId} />
        </Suspense>
      ) : null}
      <CandidateTable rows={rows} onReport={onReport} />
      {rows.length === 0 ? null : <QuestionTable questions={analytics.questions} graded={analytics.graded} />}
      {rows.length === 0 ? null : <Integrity integrity={analytics.integrity} />}
      {rows.length === 0 ? null : (
        <Suspense fallback={null}>
          <Rechecks client={client} examId={examId} canAnswer={canGrade} />
        </Suspense>
      )}
      {analytics.graded === 0 ? null : (
        <Suspense fallback={null}>
          <Shortlists client={client} examId={examId} qualified={rows.filter((r) => r.outcome === "qualified").length} />
        </Suspense>
      )}
      {rows.length === 0 ? null : <CandidateFeedback client={client} examId={examId} />}
      <CodeSimilarity client={client} examId={examId} />
    </>
  );
}

/** Comments shown before "Show all": enough to read the mood without a wall of text. */
const FIRST_COMMENTS = 10;

/**
 * What candidates said after submitting: a rating out of five and anything
 * that got in the way. Without names, as they were told; answering was
 * optional, so the count is out of those who submitted.
 */
function CandidateFeedback({ client, examId }: { client: ConsoleClient; examId: string }) {
  const feedback = useQuery({ queryKey: ["feedback", examId], queryFn: () => client.examFeedback(examId) });
  const [all, setAll] = useState(false);
  const f = feedback.data;
  if (f === undefined) return null;
  const most = Math.max(1, ...f.counts);
  const shown = all ? f.comments : f.comments.slice(0, FIRST_COMMENTS);
  return (
    <section className="card candidate-feedback" aria-label="What candidates said">
      <h2 className="card-title">What candidates said</h2>
      {f.responses === 0 ? (
        <p className="notice">
          Nobody has said yet. After submitting, each candidate is asked how the test went; answering is optional, and you see it without their name.
        </p>
      ) : (
        <>
          <p className="feedback-lead">
            <strong>{f.average} out of 5</strong>, from {f.responses} of the {f.submitted} who submitted. Without names, as candidates were told.
          </p>
          <dl className="feedback-counts">
            {[5, 4, 3, 2, 1].map((rating) => (
              <div key={rating}>
                <dt>{rating}</dt>
                <dd>
                  <span className="feedback-bar" style={{ inlineSize: `${(f.counts[rating - 1]! / most) * 100}%` }} aria-hidden="true" />
                  <span>{f.counts[rating - 1]}</span>
                </dd>
              </div>
            ))}
          </dl>
          {f.comments.length === 0 ? null : (
            <>
              <h3>What got in the way</h3>
              <ul className="feedback-comments">
                {shown.map((c) => (
                  <li key={`${c.at}-${c.comment.slice(0, 20)}`}>
                    <span className="badge" aria-label={`Rated ${c.rating} out of 5`}>
                      {c.rating}/5
                    </span>
                    <p>{c.comment}</p>
                  </li>
                ))}
              </ul>
              {f.comments.length > FIRST_COMMENTS ? (
                <button type="button" className="link" onClick={() => setAll(!all)}>
                  {all ? "Show fewer" : `Show all ${f.comments.length}`}
                </button>
              ) : null}
            </>
          )}
        </>
      )}
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * Graded candidates by tenth of the mark range, as bars with their counts
 * written on. Bands no one reached at either end are left out; the
 * qualifying mark is a dashed line with its label.
 */
function Distribution({ counts, cutoff }: { counts: readonly number[]; cutoff: number | null }) {
  const reached = counts.flatMap((n, i) => (n > 0 ? [i] : []));
  const cutBand = cutoff === null ? null : Math.min(counts.length - 1, Math.floor(cutoff / 10));
  const first = Math.min(...reached, ...(cutBand === null ? [] : [cutBand]));
  const last = Math.max(...reached, ...(cutBand === null ? [] : [cutBand]));
  const shown = counts.slice(first, last + 1);
  const most = Math.max(1, ...shown);
  const at = cutoff === null ? null : ((cutoff - first * 10) / ((last + 1 - first) * 10)) * 100;
  return (
    <figure className="histogram" aria-label="How the marks fell">
      <figcaption>
        <strong>How the marks fell</strong> <span className="notice">graded candidates per 10% band</span>
      </figcaption>
      <div className="histogram-plot">
        <ol style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(2.5rem, 1fr))` }}>
          {shown.map((n, j) => {
            const i = first + j;
            return (
              <li key={i} aria-label={`${i * 10}–${i * 10 + 10}%: ${n}`}>
                <span className="count">{n === 0 ? "" : n}</span>
                <span className={`column${n === 0 ? " none" : ""}`} style={{ height: `${(n / most) * 100}%` }} />
                <span className="band">
                  {i * 10}–{i * 10 + 10}
                </span>
              </li>
            );
          })}
        </ol>
        {at === null ? null : (
          <div className="cutoff-line" style={{ left: `${at}%` }} aria-hidden="true">
            <span>Qualifies at {cutoff}%</span>
          </div>
        )}
      </div>
    </figure>
  );
}

function CandidateTable({ rows, onReport }: { rows: Results["rows"]; onReport: (attemptId: string) => void }) {
  const [filter, setFilter] = useState("");
  const [state, setState] = useState<ResultRow["state"] | Outcome | "all">("all");
  const cutoff = rows.some((r) => r.outcome !== undefined && r.outcome !== null);
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: "percent", descending: true });

  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const value = (r: ResultRow): string | number =>
      sort.key === "ref" ? r.ref : sort.key === "name" ? r.name.toLowerCase() : sort.key === "percent" ? (r.percent ?? -1) : (r.durationMs ?? Number.MAX_SAFE_INTEGER);
    return rows
      .filter((r) => state === "all" || r.state === state || r.outcome === state)
      .filter((r) => needle === "" || `${r.ref} ${r.name} ${r.email ?? ""}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const [x, y] = [value(a), value(b)];
        const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "en-IN", { numeric: true });
        return sort.descending ? -order : order;
      });
  }, [rows, filter, state, sort]);

  const header = (key: SortKey, label: string, numeric = false) => (
    <th scope="col" className={numeric ? "num" : undefined} aria-sort={sort.key === key ? (sort.descending ? "descending" : "ascending") : "none"}>
      <button
        type="button"
        className="crumb"
        onClick={() => setSort({ key, descending: sort.key === key ? !sort.descending : key === "percent" })}
      >
        {label}
        {sort.key === key ? (sort.descending ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );

  return (
    <section className="card" aria-label="Candidates">
      <div className="bar filter-bar">
        <strong>Candidates</strong>
        <span className="spacer" />
        <label className="search">
          <Search aria-hidden="true" />
          <input type="search" aria-label="Find a candidate" placeholder="Roll number, name or email" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </label>
        <select aria-label="Show" value={state} onChange={(e) => setState(e.target.value as typeof state)}>
          <option value="all">Everyone</option>
          {(Object.keys(STATE) as ResultRow["state"][]).map((s) => (
            <option key={s} value={s}>
              {STATE[s]}
            </option>
          ))}
          {cutoff ? (
            <>
              <option value="qualified">Qualified</option>
              <option value="failed">Not qualified</option>
            </>
          ) : null}
        </select>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Users}>Results appear here as candidates submit, with their marks and the spreadsheet to download.</EmptyState>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                {header("ref", "Roll no.")}
                {header("name", "Name")}
                {header("percent", "Marks", true)}
                {header("minutes", "Time", true)}
                <th scope="col">State</th>
                {cutoff ? <th scope="col">Outcome</th> : null}
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.attemptId}>
                  <td className="mono">{r.ref}</td>
                  <td>{r.name}</td>
                  <td className="num">{r.total === null ? "—" : `${r.total} / ${r.maxTotal} (${r.percent}%)`}</td>
                  <td className="num">{minutes(r.durationMs)}</td>
                  <td>
                    <StateBadge state={r.state} />
                  </td>
                  {cutoff ? (
                    <td>
                      <OutcomeBadge outcome={r.outcome} />
                    </td>
                  ) : null}
                  <td className="row-end">
                    <button type="button" className="quiet" onClick={() => onReport(r.attemptId)}>
                      Scorecard
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 ? (
            <EmptyState icon={Search} compact action={{ label: "Show everyone", onClick: () => { setFilter(""); setState("all"); } }}>
              No one matches.
            </EmptyState>
          ) : null}
        </div>
      )}
    </section>
  );
}

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

/** A plain-words reading of a question's figures, for someone who does not do item analysis. */
function reading(q: QuestionStats): string | null {
  if (q.facility === null) return null;
  if (q.discrimination !== null && q.discrimination <= 0) return "Strong candidates did no better on it than weak ones — worth a second look.";
  if (q.facility < 0.2) return "Very few got it; check it is fair.";
  if (q.facility > 0.95) return "Almost everyone got it.";
  return null;
}

function QuestionTable({ questions, graded }: { questions: readonly QuestionStats[]; graded: number }) {
  return (
    <section className="card" aria-label="Questions">
      <strong>Questions</strong>
      <p className="notice">
        <em>Got</em> is the share of marks candidates earned on a question. <em>Separates</em> is how much better the top 27% of candidates did on it than
        the bottom 27%; it needs at least eight graded candidates{graded < 8 ? `, and there are ${graded} so far` : ""}.
      </p>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th scope="col" className="num">
                #
              </th>
              <th scope="col">Question</th>
              <th scope="col" className="num">
                Set to
              </th>
              <th scope="col" className="num">
                Got
              </th>
              <th scope="col" className="num">
                Separates
              </th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q, i) => (
              <tr key={q.questionId}>
                <td className="num mono">{i + 1}</td>
                <td>
                  {q.stem}
                  {reading(q) === null ? null : <div className="notice">{reading(q)}</div>}
                </td>
                <td className="num">{q.appeared}</td>
                <td className="num">{pct(q.facility)}</td>
                <td className="num">{q.discrimination === null ? "—" : q.discrimination.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Integrity({ integrity }: { integrity: Results["analytics"]["integrity"] }) {
  return (
    <section className="card evidence" aria-label="Follow-up evidence">
      <p className="evidence-label">Evidence · does not change marks</p>
      <h2>Follow-up questions across the cohort</h2>
      <p className="notice">
        Evidence for a person to weigh, not a finding about anyone. A follow-up is asked when an answer is strong enough to be worth hearing
        about in the candidate's own words; being asked says nothing against them.
      </p>
      {integrity.asked === 0 ? (
        <p>No follow-ups were asked.</p>
      ) : (
        <>
          <p>
            {integrity.asked} asked of {integrity.candidatesProbed} candidate{integrity.candidatesProbed === 1 ? "" : "s"}; {integrity.replied}{" "}
            answered; {integrity.read} read by a reviewer or the model.
          </p>
          <p>{VERDICTS.map((v) => `${integrity.verdicts[v]} ${v}`).join(" · ")}</p>
        </>
      )}
    </section>
  );
}

/**
 * One candidate's report, laid out to print: the grade and answers, then —
 * separately, and marked as such — the follow-up evidence, then the record's
 * head so the paper copy can be checked against the ledger.
 */
export function ReportPanel({
  client,
  attemptId,
  canErase = false,
  organisation,
}: {
  client: ConsoleClient;
  attemptId: string;
  canErase?: boolean;
  /** Printed at the top of every page. */
  organisation?: string | undefined;
}) {
  const queryClient = useQueryClient();
  const report = useQuery({ queryKey: ["report", attemptId], queryFn: () => client.report(attemptId) });
  if (report.isPending)
    return (
      <section className="card">
        <SkeletonRows rows={5} columns={3} label="Loading the scorecard…" />
      </section>
    );
  if (report.error !== null) return <Banner tone="danger" title="Could not load the scorecard." />;
  const { ref } = report.data.candidate;
  const erasable = canErase && report.data.result.state !== "in_progress" && !ref.startsWith("erased-") && ref !== "[erased]";
  return (
    <>
      <Report
        report={report.data}
        organisation={organisation}
        {...(report.data.result.state === "graded" ? { onPdf: async () => save(await client.scorecardPdf(attemptId), `scorecard-${ref}.pdf`) } : {})}
      />
      {erasable ? (
        <EraseCard
          client={client}
          attemptId={attemptId}
          reference={report.data.candidate.ref}
          onErased={() => void queryClient.invalidateQueries({ queryKey: ["report", attemptId] })}
        />
      ) : null}
    </>
  );
}

const ordinal = (n: number) => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
};

const clockOf = (ms: number | null | undefined) => {
  if (ms === null || ms === undefined) return "—";
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * One candidate's scorecard: the verdict and the marks, how each section
 * went, where they stand among the rest, each answer with when it was saved,
 * and — apart, as evidence — the follow-ups. Laid out to print as a PDF.
 */
export function Report({
  report,
  organisation,
  onPdf,
}: {
  report: CandidateReport;
  organisation?: string | undefined;
  /** Download the candidate's scorecard, with its checking code: a graded attempt's. */
  onPdf?: () => Promise<void>;
}) {
  const { candidate, result } = report;
  const standing = report.standing;
  const sections = result.sections ?? [];
  const who = candidate.name === "" ? candidate.ref : candidate.name;
  return (
    <article className="report scorecard">
      <PageActions>
        {onPdf === undefined ? null : (
          <button type="button" className="secondary" onClick={() => void onPdf()}>
            <Download aria-hidden="true" />
            Scorecard PDF
          </button>
        )}
        <button type="button" className="secondary" onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          Print or save as PDF
        </button>
      </PageActions>
      {/* On paper only: repeated at the top and foot of every A4 page. */}
      <div className="print-head" aria-hidden="true">
        <span>{organisation ?? "Parikshaa"}</span>
        <span>Scorecard</span>
      </div>
      <div className="print-foot" aria-hidden="true">
        <span>
          {report.exam.title} · {who} ({candidate.ref})
        </span>
        <span className="mono">Record {report.ledger.head.slice(0, 16)}…</span>
      </div>

      <section className="card scorecard-head" aria-label="Scorecard">
        <div className="scorecard-who">
          <p className="notice">{report.exam.title}</p>
          <h2>
            {candidate.name === "" ? candidate.ref : candidate.name} <span className="mono notice">{candidate.ref}</span>
          </h2>
          {candidate.email === null ? null : <p className="notice">{candidate.email}</p>}
          <p className="notice">
            Started {when(result.startedAt)}
            {result.submittedAt === null ? "" : ` · submitted ${when(result.submittedAt)} · ${minutes(result.durationMs)}`}
          </p>
        </div>
        {result.state === "void" ? (
          <p className="error">
            Set aside{report.voidedBy === null ? "" : ` by ${report.voidedBy}`}: {report.voidReason}
          </p>
        ) : (
          <div className="scorecard-score">
            <Ring percent={result.percent} />
            <div>
              <p className="grade">{result.total === null ? "Not graded yet" : `${result.total} / ${result.maxTotal}`}</p>
              <OutcomeBadge outcome={result.outcome} />
            </div>
          </div>
        )}
        {standing === undefined || result.state !== "graded" ? null : (
          <dl className="figures scorecard-figures">
            <Figure label="Percentile" value={standing.percentile === null ? "—" : ordinal(Math.round(standing.percentile))} />
            <Figure label="Rank" value={standing.rank === null ? "—" : `${standing.rank} of ${standing.graded}`} />
            <Figure label="Cohort mean" value={standing.meanPercent === null ? "—" : `${standing.meanPercent}%`} />
            <Figure label="Follow-ups" value={`${result.probes.asked} asked`} />
          </dl>
        )}
      </section>

      {sections.length === 0 ? null : <SectionTable sections={sections} minimums={report.exam.cutoff?.sections ?? {}} />}

      {report.proctoring === null || report.proctoring === undefined ? null : (
        <section className="card" aria-label="Proctoring">
          <strong>Proctoring</strong>
          <p className="notice">Observations to weigh. None of this marks anyone down by itself.</p>
          <p>
            {IDENTITY_LABEL[report.proctoring.identity]}
            {report.proctoring.identityDecidedBy === null ? "" : ` by ${report.proctoring.identityDecidedBy} — ${report.proctoring.identityReason ?? ""}`}
          </p>
          <p>
            {report.proctoring.snapshots} webcam photo{report.proctoring.snapshots === 1 ? "" : "s"}
            {Object.entries(report.proctoring.events)
              .map(([kind, n]) => ` · ${kind.replace(/_/g, " ")} ×${n}`)
              .join("")}
          </p>
        </section>
      )}

      <section className="card" aria-label="Answers">
        <strong>Answers</strong>
        {report.questions.map((q, i) => (
          <div key={q.id} className="answer">
            <div className="bar" style={{ marginBottom: ".2rem" }}>
              <span>
                <span className="mono notice">{i + 1}.</span> {q.stem}
              </span>
              <span className="spacer" />
              <span className="mono">{q.score === null ? `— / ${q.maxScore}` : `${q.score} / ${q.maxScore}`}</span>
            </div>
            {q.saves === undefined ? null : (
              <p className="notice small saved-line">
                {q.saves === 0
                  ? "Never saved"
                  : `First saved at ${clockOf(q.firstSavedMs)}${q.saves > 1 ? `, last at ${clockOf(q.lastSavedMs)} · saved ${q.saves} times` : ""} (minutes into the attempt)`}
              </p>
            )}
            {q.answer === null ? (
              <p className="notice">Not answered.</p>
            ) : q.kind === "code" ? (
              <>
                <pre className="code" aria-label={`Code in ${q.language ?? "an unknown language"}`}>
                  {q.answer}
                </pre>
                <TestsLine tests={q.tests} />
              </>
            ) : (
              <p className="given">{q.answer}</p>
            )}
          </div>
        ))}
      </section>

      <section className="card evidence" aria-label="Follow-up evidence">
        <p className="evidence-label">Evidence · does not change marks</p>
        <h2>Follow-up questions</h2>
        <p className="notice">Evidence for a person to weigh. It did not change the marks above.</p>
        {report.vivas.length === 0 ? (
          <p>None were asked.</p>
        ) : (
          report.vivas.map((v, i) => (
            <dl key={i} className="viva">
              <dt>About question {report.questions.findIndex((q) => q.id === v.questionId) + 1}</dt>
              <dd>{v.prompt}</dd>
              <dt>Their reply</dt>
              <dd>{v.reply ?? "No reply."}</dd>
              {v.verdict === null ? null : (
                <>
                  <dt>Reading</dt>
                  <dd>
                    <span className="verdict" data-v={v.verdict}>
                      {v.verdict}
                    </span>
                    {v.confidence === null ? "" : ` (${Math.round(v.confidence * 100)}% confident)`}
                    {v.reasoning === null ? null : <div className="notice">{v.reasoning}</div>}
                  </dd>
                </>
              )}
            </dl>
          ))
        )}
      </section>

      <p className="notice mono">
        Record: {report.ledger.length} entries, head {report.ledger.head.slice(0, 16)}…
      </p>
    </article>
  );
}

/** How a code answer did against its question's tests, hidden ones included: counts only, as the record keeps them. */
function TestsLine({ tests }: { tests: CandidateReport["questions"][number]["tests"] }) {
  if (tests === null) return <p className="notice">No tests were run on this answer; it is graded against the rubric.</p>;
  const tone = tests.passed === tests.total ? "ok" : tests.passed === 0 ? "bad" : "warn";
  return (
    <p className="tests-line">
      <span className={`pill ${tone}`}>
        Tests passed {tests.passed} of {tests.total}
      </span>{" "}
      <span className="notice">Including the tests hidden from candidates.</span>
    </p>
  );
}

/**
 * Code answers alike enough to be worth a look (ROADMAP §4): two candidates'
 * code, in the same language, sharing most of their fingerprints once names,
 * comments, layout and the starter code are set aside. Evidence for a person,
 * who reads the two side by side; it changes no marks.
 */
function CodeSimilarity({ client, examId }: { client: ConsoleClient; examId: string }) {
  const similarity = useQuery({ queryKey: ["similarity", examId], queryFn: () => client.similarity(examId) });
  const [open, setOpen] = useState<string | null>(null);
  if (similarity.data === undefined || similarity.data.questions.length === 0) return null;
  return (
    <section className="card evidence" aria-label="Code similarity">
      <p className="evidence-label">Evidence · does not change marks</p>
      <h2>Code similarity</h2>
      <p className="notice">
        Pairs of candidates whose code for the same question is alike once names, comments, layout and the starter code are set aside.
        Two short answers to a narrow question can honestly match: read them side by side before deciding anything. Nothing here changes a mark.
      </p>
      {similarity.data.questions.map((question, qi) => (
        <div className="similarity-question" key={question.id}>
          <h3>
            {qi + 1}. {question.stem}
          </h3>
          <p className="notice">
            {question.answered} answer{question.answered === 1 ? "" : "s"} compared ·{" "}
            {question.pairs.length === 0 ? "no two alike enough to look at" : `${question.pairs.length} pair${question.pairs.length === 1 ? "" : "s"} to look at`}
          </p>
          {question.pairs.length === 0 ? null : (
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Candidates</th>
                    <th scope="col">Alike</th>
                    <th scope="col">Language</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {question.pairs.map((pair) => {
                    const key = `${question.id}:${pair.a.attemptId}:${pair.b.attemptId}`;
                    return (
                      <SimilarRow key={key} pair={pair} open={open === key} onToggle={() => setOpen(open === key ? null : key)} />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

type Pair = Similarity["questions"][number]["pairs"][number];

function SimilarRow({ pair, open, onToggle }: { pair: Pair; open: boolean; onToggle: () => void }) {
  const who = (side: Pair["a"]) => `${side.ref}${side.name === "" ? "" : ` · ${side.name}`}`;
  const percent = Math.round(pair.similarity * 100);
  return (
    <>
      <tr>
        <td>
          {who(pair.a)} <span className="notice">and</span> {who(pair.b)}
        </td>
        <td>
          <span className={`pill ${percent >= 90 ? "bad" : "attention"}`}>{percent}%</span>
        </td>
        <td>{pair.a.language}</td>
        <td>
          <button type="button" className="quiet" aria-expanded={open} onClick={onToggle}>
            {open ? "Close" : "Compare"}
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="compare-row">
          <td colSpan={4}>
            <div className="compare" aria-label={`${pair.a.ref} and ${pair.b.ref}, side by side`} role="group">
              {[pair.a, pair.b].map((side) => (
                <figure key={side.attemptId}>
                  <figcaption>{who(side)}</figcaption>
                  <pre className="code">{side.source}</pre>
                </figure>
              ))}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

/** The percentage as a ring, the way a scorecard shows it at a glance. */
function Ring({ percent }: { percent: number | null }) {
  const p = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const r = 30;
  const length = 2 * Math.PI * r;
  return (
    <svg className="ring" width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={percent === null ? "Not graded" : `${percent}%`}>
      <circle cx="38" cy="38" r={r} className="ring-track" />
      <circle cx="38" cy="38" r={r} className="ring-value" strokeDasharray={`${(p / 100) * length} ${length}`} transform="rotate(-90 38 38)" />
      <text x="38" y="43" textAnchor="middle">
        {percent === null ? "—" : `${Math.round(percent)}%`}
      </text>
    </svg>
  );
}

/**
 * Marks section by section, with a bar for each in its own colour from the
 * categorical ramp, and the section's qualifying minimum marked on it.
 */
function SectionTable({ sections, minimums }: { sections: readonly SectionScore[]; minimums: Readonly<Record<string, number>> }) {
  return (
    <section className="card" aria-label="Sections">
      <strong>
        <Award aria-hidden="true" className="inline-icon" /> By section
      </strong>
      <table className="section-scores">
        <thead>
          <tr>
            <th scope="col">Section</th>
            <th scope="col" className="num">
              Marks
            </th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section, i) => {
            const minimum = minimums[section.id];
            return (
              <tr key={section.id}>
                <td>{section.title}</td>
                <td className="num mono">{section.score === null ? `— / ${section.max}` : `${section.score} / ${section.max}`}</td>
                <td>
                  <span className="bar-track" aria-hidden="true">
                    <span className={`bar-fill series-${(i % 5) + 1}`} style={{ width: `${Math.max(0, Math.min(100, section.percent ?? 0))}%` }} />
                    {minimum === undefined ? null : <span className="bar-minimum" style={{ left: `${minimum}%` }} />}
                  </span>{" "}
                  <span className="mono">{section.percent === null ? "—" : `${section.percent}%`}</span>
                  {minimum === undefined ? null : <span className="notice small"> · needs {minimum}%</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/**
 * Every submitted attempt graded in one go, a batch at a time, saying how far
 * it has got. One that cannot be graded is named and left for a person; the
 * rest go on.
 */
function GradeAll({ client, examId, waiting }: { client: ConsoleClient; examId: string; waiting: number }) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<{ done: number; of: number } | null>(null);
  const [failed, setFailed] = useState<readonly { attemptId: string; message: string }[]>([]);
  const run = useMutation({
    mutationFn: async () => {
      const of = waiting;
      let done = 0;
      let problems: { attemptId: string; message: string }[] = [];
      setFailed([]);
      setProgress({ done, of });
      for (;;) {
        const round = await client.gradeSubmitted(examId);
        done += round.graded;
        problems = [...problems.filter((p) => !round.failed.some((f) => f.attemptId === p.attemptId)), ...round.failed];
        setProgress({ done, of: Math.max(of, done + round.remaining) });
        await queryClient.invalidateQueries({ queryKey: ["results", examId] });
        // Stop when nothing is left, or when a round could grade none of what is.
        if (round.remaining === 0 || round.graded === 0) break;
      }
      setFailed(problems);
      return done;
    },
    onSettled: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["exams"] }), queryClient.invalidateQueries({ queryKey: ["attempts"] })]);
    },
  });

  if (waiting === 0 && !run.isPending && !run.isSuccess && failed.length === 0) return null;
  const error = run.error;
  return (
    <section className="card grade-all" aria-label="Grade all">
      <div className="bar">
        <ListChecks aria-hidden="true" className="inline-icon" />
        {run.isPending && progress !== null ? (
          <strong role="status">
            Grading… {progress.done} of {progress.of} graded
          </strong>
        ) : run.isSuccess ? (
          <strong role="status">
            {run.data === 0 ? "Nothing more could be graded." : `Graded ${run.data} attempt${run.data === 1 ? "" : "s"}.`}
            {waiting > 0 ? ` ${waiting} still to grade.` : ""}
          </strong>
        ) : (
          <strong>
            {waiting} attempt{waiting === 1 ? "" : "s"} to grade
          </strong>
        )}
        <span className="spacer" />
        {waiting > 0 ? (
          <button type="button" disabled={run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? "Grading…" : `Grade all ${waiting}`}
          </button>
        ) : null}
      </div>
      {run.isPending && progress !== null ? (
        <div className="progress" role="progressbar" aria-label="Grading" aria-valuemin={0} aria-valuemax={progress.of} aria-valuenow={progress.done}>
          <span style={{ width: `${progress.of === 0 ? 0 : (progress.done / progress.of) * 100}%` }} />
        </div>
      ) : (
        <p className="notice small">
          Each is graded as it would be one at a time: choices and numbers at once, written answers by the model against their rubric, a few seconds each.
        </p>
      )}
      {error === null ? null : (
        <p className="error" role="alert">
          {error instanceof ConsoleError && error.code === "spend_cap_reached"
            ? "This month's spending limit is reached, so grading stopped. An owner can raise it on the Spend page."
            : "Grading stopped: the server could not be reached. What was graded stays graded; press again to go on."}
        </p>
      )}
      {failed.length === 0 ? null : (
        <div className="grade-all-failed">
          <p className="notice">These could not be graded and are left for you to open one by one:</p>
          <ul>
            {failed.map((f) => (
              <li key={f.attemptId}>
                <code>{f.attemptId.slice(0, 8)}</code> — {f.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
