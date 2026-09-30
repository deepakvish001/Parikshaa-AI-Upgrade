import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChartNoAxesColumn, Download, Search, TrendingUp } from "lucide-react";
import { TabPanel, Tabs } from "@parikshaa/brand/ui";
import type { ConsoleClient, Progress, QualityFlag } from "../api.ts";
import { EmptyState, PageActions, SkeletonRows } from "./kit.tsx";

/**
 * Insights across tests, for a placement cell: each candidate's percentage in
 * every test, lined up by roll number, and the questions worth a second look.
 * Read from the same results as each exam's own tab; nothing new is recorded.
 */
export function InsightsPanel({ client }: { client: ConsoleClient }) {
  const [tab, setTab] = useState<"candidates" | "questions">("candidates");
  return (
    <>
      <Tabs
        label="Insights"
        idBase="insights"
        items={[
          { id: "candidates", label: "Candidates across tests" },
          { id: "questions", label: "Question quality" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <TabPanel idBase="insights" id="candidates" value={tab}>
        {tab === "candidates" ? <AcrossTests client={client} /> : null}
      </TabPanel>
      <TabPanel idBase="insights" id="questions" value={tab}>
        {tab === "questions" ? <QuestionQuality client={client} /> : null}
      </TabPanel>
    </>
  );
}

const date = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" }).format(new Date(iso));

function csvOf(progress: Progress): string {
  const quote = (v: string | number | null) => (v === null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const head = ["Roll no.", "Name", ...progress.exams.map((e) => `${e.title} (%)`), "Average (%)", "Change (points)"];
  const rows = progress.candidates.map((c) => [c.ref, c.name, ...progress.exams.map((e) => c.results[e.id]?.percent ?? null), c.average, c.change]);
  return [head, ...rows].map((r) => r.map(quote).join(",")).join("\r\n");
}

function AcrossTests({ client }: { client: ConsoleClient }) {
  const [search, setSearch] = useState("");
  const progress = useQuery({ queryKey: ["progress", search], queryFn: () => client.progress(search) });
  const data = progress.data;
  const save = () => {
    if (data === undefined) return;
    const url = URL.createObjectURL(new Blob(["﻿", csvOf(data)], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "candidates-across-tests.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageActions>
        <button type="button" className="secondary" disabled={data === undefined || data.candidates.length === 0} onClick={save}>
          <Download aria-hidden="true" />
          Download CSV
        </button>
      </PageActions>
      {progress.isPending ? (
        <section className="card">
          <SkeletonRows rows={6} columns={5} label="Loading candidates across tests…" />
        </section>
      ) : data === undefined || data.exams.length === 0 ? (
        <EmptyState icon={TrendingUp}>Once a test has graded candidates, they appear here across every test they sit.</EmptyState>
      ) : (
        <>
          <section className="card" aria-label="Tests">
            <div className="scroll">
              <table className="progress-exams">
                <thead>
                  <tr>
                    <th scope="col">Test</th>
                    <th scope="col">Sat</th>
                    <th scope="col" className="num">
                      Graded
                    </th>
                    <th scope="col" className="num">
                      Mean
                    </th>
                    <th scope="col" className="num">
                      Qualified
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.exams.map((e) => (
                    <tr key={e.id}>
                      <td>{e.title}</td>
                      <td>{date(e.date)}</td>
                      <td className="num">{e.graded}</td>
                      <td className="num">{e.meanPercent === null ? "—" : `${e.meanPercent}%`}</td>
                      <td className="num">{e.qualified ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card" aria-label="Candidates across tests">
            <div className="bar filter-bar">
              <strong>Candidates</strong>
              <span className="notice">
                {data.candidates.length} across {data.exams.length} {data.exams.length === 1 ? "test" : "tests"}, by roll number
              </span>
              <span className="spacer" />
              <label className="search">
                <Search aria-hidden="true" />
                <input type="search" aria-label="Roll number or name" placeholder="Roll number or name, e.g. CS" value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
            </div>
            <div className="scroll">
              <table className="progress-table">
                <thead>
                  <tr>
                    <th scope="col">Roll no.</th>
                    <th scope="col">Name</th>
                    {data.exams.map((e) => (
                      <th key={e.id} scope="col" className="num" title={e.title}>
                        {e.title.length > 18 ? `${e.title.slice(0, 17)}…` : e.title}
                      </th>
                    ))}
                    <th scope="col" className="num">
                      Average
                    </th>
                    <th scope="col" className="num">
                      Change
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.candidates.map((c) => (
                    <tr key={c.ref}>
                      <td className="mono">{c.ref}</td>
                      <td>{c.name}</td>
                      {data.exams.map((e) => {
                        const r = c.results[e.id];
                        return (
                          <td key={e.id} className={`num${r?.outcome === "qualified" ? " qualified" : r?.outcome === "failed" ? " failed" : ""}`}>
                            {r === undefined ? <span className="notice">—</span> : `${Math.round(r.percent)}%`}
                          </td>
                        );
                      })}
                      <td className="num">
                        <strong>{c.average === null ? "—" : `${c.average}%`}</strong>
                      </td>
                      <td className={`num${c.change === null ? "" : c.change > 0 ? " up" : c.change < 0 ? " down" : ""}`}>
                        {c.change === null ? "—" : `${c.change > 0 ? "+" : ""}${c.change}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="notice">A roll number joins a student's tests: the same number in two tests is taken to be the same student. Change is from their first test here to their latest, in percentage points.</p>
          </section>
        </>
      )}
    </>
  );
}

const REASON: Record<QualityFlag["reason"], string> = {
  does_not_separate: "Strong candidates did no better on it than weak ones",
  too_hard: "Very few got it: check it is fair",
  too_easy: "Almost everyone got it",
};

function QuestionQuality({ client }: { client: ConsoleClient }) {
  const quality = useQuery({ queryKey: ["question-quality"], queryFn: () => client.questionQuality() });
  if (quality.isPending)
    return (
      <section className="card">
        <SkeletonRows rows={5} columns={4} label="Reading the questions…" />
      </section>
    );
  const data = quality.data;
  if (data === undefined || data.exams === 0) return <EmptyState icon={ChartNoAxesColumn}>Questions are read once a test has at least eight graded papers.</EmptyState>;
  return (
    <section className="card" aria-label="Questions worth a second look">
      <div className="bar">
        <strong>Questions worth a second look</strong>
        <span className="notice">
          {data.flags.length} of {data.questions} questions, across {data.exams} {data.exams === 1 ? "test" : "tests"}
        </span>
      </div>
      {data.flags.length === 0 ? (
        <p className="notice">Every question read separates strong candidates from weak ones, and none is too easy or too hard.</p>
      ) : (
        <div className="scroll">
          <table className="quality-table">
            <thead>
              <tr>
                <th scope="col">Question</th>
                <th scope="col">Test</th>
                <th scope="col" className="num">
                  Got
                </th>
                <th scope="col" className="num">
                  Separates
                </th>
                <th scope="col">Why look again</th>
              </tr>
            </thead>
            <tbody>
              {data.flags.map((f) => (
                <tr key={`${f.examId}:${f.questionId}`}>
                  <td>
                    <span className="notice">Q{f.number}</span> {f.stem.length > 90 ? `${f.stem.slice(0, 89)}…` : f.stem}
                  </td>
                  <td>{f.examTitle}</td>
                  <td className="num">{Math.round(f.facility * 100)}%</td>
                  <td className="num">{f.discrimination === null ? "—" : f.discrimination.toFixed(2)}</td>
                  <td className={`quality-reason ${f.reason}`}>{REASON[f.reason]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="notice">
        <em>Got</em> is the share of marks earned; <em>Separates</em> is how much better the top 27% did than the bottom 27%. Only questions on eight or more graded papers
        are read. Figures are a reason to look, not a verdict.
      </p>
    </section>
  );
}
