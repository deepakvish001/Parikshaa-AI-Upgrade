import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CandidateReport, ConsoleClient, QuestionStats, ResultRow, Results, Verdict } from "../api.ts";
import { EraseCard } from "./Privacy.tsx";
import { IDENTITY_LABEL } from "./Proctoring.tsx";

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
  in_progress: "taking it",
  submitted: "to grade",
  graded: "graded",
  void: "set aside",
};

const VERDICTS: readonly Verdict[] = ["consistent", "shallow", "inconsistent", "inconclusive"];

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

type SortKey = "ref" | "name" | "percent" | "minutes";

export function ResultsPanel({ client, examId, onReport }: { client: ConsoleClient; examId: string; onReport: (attemptId: string) => void }) {
  const results = useQuery({ queryKey: ["results", examId], queryFn: () => client.results(examId) });
  const download = useMutation({
    mutationFn: async (format: "csv" | "xlsx") => save(await client.resultsFile(examId, format), `${examId}-results.${format}`),
  });

  if (results.isPending) return <p className="notice">Loading…</p>;
  if (results.error !== null) return <p className="error">Could not load the results.</p>;
  const { rows, analytics } = results.data;

  return (
    <>
      <section className="card" aria-label="Summary">
        <div className="bar" style={{ marginBottom: ".4rem" }}>
          <strong>{results.data.exam.title}</strong>
          <span className="spacer" />
          <button type="button" className="secondary" disabled={rows.length === 0 || download.isPending} onClick={() => download.mutate("xlsx")}>
            Download Excel
          </button>
          <button type="button" className="secondary" disabled={rows.length === 0 || download.isPending} onClick={() => download.mutate("csv")}>
            Download CSV
          </button>
        </div>
        {download.error !== null ? <p className="error">The download failed; try again.</p> : null}
        <dl className="figures">
          <Figure label="Sat" value={analytics.candidates} />
          <Figure label="Graded" value={analytics.graded} />
          <Figure label="Set aside" value={analytics.setAside} />
          <Figure label="Mean" value={analytics.meanPercent === null ? "—" : `${analytics.meanPercent}%`} />
          <Figure label="Median" value={analytics.medianPercent === null ? "—" : `${analytics.medianPercent}%`} />
          <Figure label="Median time" value={analytics.time.medianMinutes === null ? "—" : `${analytics.time.medianMinutes} min`} />
        </dl>
        {analytics.graded > 0 ? <Distribution counts={analytics.distribution} /> : null}
      </section>

      <CandidateTable rows={rows} onReport={onReport} />
      <QuestionTable questions={analytics.questions} graded={analytics.graded} />
      <Integrity integrity={analytics.integrity} />
    </>
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

/** Graded candidates by tenth of the mark range, as bars with their counts written on. */
function Distribution({ counts }: { counts: readonly number[] }) {
  const most = Math.max(1, ...counts);
  return (
    <figure className="histogram" aria-label="How the marks fell">
      <figcaption className="notice">How the marks fell (graded candidates per 10% band)</figcaption>
      <ol>
        {counts.map((n, i) => (
          <li key={i} aria-label={`${i * 10}–${i * 10 + 10}%: ${n}`}>
            <span className="count">{n === 0 ? "" : n}</span>
            <span className="column" style={{ height: `${(n / most) * 100}%` }} />
            <span className="band">{i * 10}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

function CandidateTable({ rows, onReport }: { rows: Results["rows"]; onReport: (attemptId: string) => void }) {
  const [filter, setFilter] = useState("");
  const [state, setState] = useState<ResultRow["state"] | "all">("all");
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: "percent", descending: true });

  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const value = (r: ResultRow): string | number =>
      sort.key === "ref" ? r.ref : sort.key === "name" ? r.name.toLowerCase() : sort.key === "percent" ? (r.percent ?? -1) : (r.durationMs ?? Number.MAX_SAFE_INTEGER);
    return rows
      .filter((r) => state === "all" || r.state === state)
      .filter((r) => needle === "" || `${r.ref} ${r.name} ${r.email ?? ""}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const [x, y] = [value(a), value(b)];
        const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "en-IN", { numeric: true });
        return sort.descending ? -order : order;
      });
  }, [rows, filter, state, sort]);

  const header = (key: SortKey, label: string) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.descending ? "descending" : "ascending") : "none"}>
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
      <div className="row" style={{ marginTop: 0 }}>
        <strong>Candidates</strong>
        <span className="spacer" style={{ flex: 1 }} />
        <input
          aria-label="Find a candidate"
          placeholder="Roll number, name or email"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ maxWidth: "16rem" }}
        />
        <select aria-label="Show" value={state} onChange={(e) => setState(e.target.value as typeof state)} style={{ width: "auto" }}>
          <option value="all">Everyone</option>
          {(Object.keys(STATE) as ResultRow["state"][]).map((s) => (
            <option key={s} value={s}>
              {STATE[s]}
            </option>
          ))}
        </select>
      </div>
      {rows.length === 0 ? (
        <p className="notice">Nobody has sat this exam yet.</p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                {header("ref", "Ref")}
                {header("name", "Name")}
                {header("percent", "Marks")}
                {header("minutes", "Time")}
                <th scope="col">State</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.attemptId}>
                  <td className="mono">{r.ref}</td>
                  <td>{r.name}</td>
                  <td>{r.total === null ? "—" : `${r.total} / ${r.maxTotal} (${r.percent}%)`}</td>
                  <td>{minutes(r.durationMs)}</td>
                  <td>
                    <span className="pill">{STATE[r.state]}</span>
                  </td>
                  <td>
                    <button type="button" className="quiet" onClick={() => onReport(r.attemptId)}>
                      Report
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 ? <p className="notice">No one matches.</p> : null}
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
              <th scope="col">#</th>
              <th scope="col">Question</th>
              <th scope="col">Set to</th>
              <th scope="col">Got</th>
              <th scope="col">Separates</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q, i) => (
              <tr key={q.questionId}>
                <td className="mono">{i + 1}</td>
                <td>
                  {q.stem}
                  {reading(q) === null ? null : <div className="notice">{reading(q)}</div>}
                </td>
                <td>{q.appeared}</td>
                <td>{pct(q.facility)}</td>
                <td>{q.discrimination === null ? "—" : q.discrimination.toFixed(2)}</td>
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
export function ReportPanel({ client, attemptId, canErase = false }: { client: ConsoleClient; attemptId: string; canErase?: boolean }) {
  const queryClient = useQueryClient();
  const report = useQuery({ queryKey: ["report", attemptId], queryFn: () => client.report(attemptId) });
  if (report.isPending) return <p className="notice">Loading…</p>;
  if (report.error !== null) return <p className="error">Could not load the report.</p>;
  const { ref } = report.data.candidate;
  const erasable = canErase && report.data.result.state !== "in_progress" && !ref.startsWith("erased-") && ref !== "[erased]";
  return (
    <>
      <Report report={report.data} />
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

export function Report({ report }: { report: CandidateReport }) {
  const { candidate, result } = report;
  return (
    <article className="report">
      <div className="row no-print" style={{ marginTop: 0, marginBottom: ".85rem" }}>
        <button type="button" className="secondary" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>

      <section className="card">
        <p className="notice">{report.exam.title}</p>
        <h2 style={{ margin: ".1rem 0" }}>
          {candidate.name === "" ? candidate.ref : candidate.name} <span className="mono notice">{candidate.ref}</span>
        </h2>
        {candidate.email === null ? null : <p className="notice">{candidate.email}</p>}
        {result.state === "void" ? (
          <p className="error">
            Set aside{report.voidedBy === null ? "" : ` by ${report.voidedBy}`}: {report.voidReason}
          </p>
        ) : (
          <p className="grade">{result.total === null ? "Not graded yet" : `${result.total} / ${result.maxTotal} · ${result.percent}%`}</p>
        )}
        <p className="notice">
          Started {when(result.startedAt)}
          {result.submittedAt === null ? "" : ` · submitted ${when(result.submittedAt)} · ${minutes(result.durationMs)}`}
        </p>
      </section>

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
            {q.answer === null ? (
              <p className="notice">Not answered.</p>
            ) : q.kind === "code" ? (
              <pre className="code" aria-label={`Code in ${q.language ?? "an unknown language"}`}>
                {q.answer}
              </pre>
            ) : (
              <p className="given">{q.answer}</p>
            )}
          </div>
        ))}
      </section>

      <section className="card evidence" aria-label="Follow-up evidence">
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
