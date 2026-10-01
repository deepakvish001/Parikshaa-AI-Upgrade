import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConsoleError, type CohortImport, type ConsoleClient } from "../api.ts";

/**
 * Campus licences (Prep blueprint F16): a college buys Plus for a batch. A
 * cohort names the batch and the days of Plus; its students are added from a
 * CSV of email addresses, tried first as a dry run. A verified account gets
 * Plus at once, anyone else when they verify that address. The table is the
 * college's dashboard.
 */

const failure = (error: unknown, fallback: string) =>
  error instanceof ConsoleError ? (error.detail ?? (error.problems[0]?.message ?? fallback)) : fallback;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN");

function Outcome({ result }: { result: CohortImport }) {
  return (
    <div className="notice" role="status">
      <p>
        {result.dryRun ? "A dry run: nothing was changed. " : ""}
        {result.rows} rows: {result.added} {result.dryRun ? "would be" : ""} added ({result.givenNow} {result.dryRun ? "would get" : "got"} Plus now,{" "}
        {result.onSignup} when they verify their address), {result.already} in the cohort already, {result.duplicates} repeated in the file,{" "}
        {result.invalid.length} not addresses.
      </p>
      {result.invalid.length === 0 ? null : (
        <ul>
          {result.invalid.slice(0, 20).map((i) => (
            <li key={i.line}>
              Line {i.line}: “{i.value}”
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Campus({ client, canManage }: { client: ConsoleClient; canManage: boolean }) {
  const queryClient = useQueryClient();
  const cohorts = useQuery({ queryKey: ["prep", "cohorts"], queryFn: () => client.cohorts() });
  const [draft, setDraft] = useState({ name: "", days: 180 });
  const [open, setOpen] = useState<string | null>(null);
  const [csv, setCsv] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["prep", "cohort"] }).then(() => queryClient.invalidateQueries({ queryKey: ["prep", "cohorts"] }));
  const create = useMutation({
    mutationFn: () => client.createCohort(draft.name.trim(), draft.days),
    onSuccess: (made) => {
      setDraft({ name: "", days: draft.days });
      setOpen(made.id);
      void refresh();
    },
  });
  const load = useMutation({
    mutationFn: (dryRun: boolean) => client.importCohort(open!, csv, dryRun),
    onSuccess: (result) => {
      if (!result.dryRun) {
        setCsv("");
        void refresh();
      }
    },
  });
  const report = useQuery({ queryKey: ["prep", "cohort", open], queryFn: () => client.cohortReport(open!), enabled: open !== null });

  return (
    <>
      <section className="card prep-card" aria-label="Campus cohorts">
        <div className="bar">
          <strong>Campus cohorts</strong>
        </div>
        <p className="notice">
          A cohort is a college or a batch that has bought Plus. Add its students by email: a student whose account is verified gets Plus at once, the rest when they
          sign up and verify that address. Each address gets the cohort's Plus once.
        </p>
        {cohorts.data === undefined ? (
          <p className="notice">Loading…</p>
        ) : cohorts.data.length === 0 ? (
          <p className="notice">No cohorts yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Cohort</th>
                <th scope="col">Plus</th>
                <th scope="col">Students</th>
                <th scope="col">Joined</th>
                <th scope="col">Given Plus</th>
                <th scope="col">Active this week</th>
                <th scope="col">Problems solved</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.data.map((c) => (
                <tr key={c.id}>
                  <td>
                    <button type="button" className="link-button" aria-pressed={open === c.id} onClick={() => setOpen(c.id)}>
                      {c.name}
                    </button>
                  </td>
                  <td>{c.plusDays} days</td>
                  <td>{c.members}</td>
                  <td>{c.joined}</td>
                  <td>{c.given}</td>
                  <td>{c.active7}</td>
                  <td>{c.solved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canManage ? (
          <form
            className="row"
            aria-label="New cohort"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <label className="grow">
              Cohort name
              <input value={draft.name} maxLength={120} required placeholder="NIT Trichy, 2027 batch" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label>
              Days of Plus
              <input type="number" min={1} max={1100} value={draft.days} onChange={(e) => setDraft({ ...draft, days: Number(e.target.value) })} />
            </label>
            <button type="submit" disabled={create.isPending}>
              Make cohort
            </button>
            {create.isError ? <p className="error">{failure(create.error, "The cohort was not made.")}</p> : null}
          </form>
        ) : null}
      </section>

      {open === null ? null : (
        <section className="card prep-card" aria-label="Cohort students">
          <div className="bar">
            <strong>{report.data?.cohort.name ?? "…"}</strong>
          </div>
          {canManage ? (
            <form
              aria-label="Add students"
              onSubmit={(e) => {
                e.preventDefault();
                load.mutate(false);
              }}
            >
              <label>
                Students' email addresses (CSV: the "email" column, or one address a line)
                <textarea
                  rows={6}
                  value={csv}
                  onChange={(e) => {
                    setCsv(e.target.value);
                    load.reset();
                  }}
                />
              </label>
              <div className="row">
                <label className="file-label">
                  Or choose a CSV file
                  <input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => void e.target.files?.[0]?.text().then(setCsv)} />
                </label>
                <button type="button" className="secondary" disabled={csv.trim() === "" || load.isPending} onClick={() => load.mutate(true)}>
                  Dry run
                </button>
                <button type="submit" disabled={csv.trim() === "" || load.isPending}>
                  Add students
                </button>
              </div>
              {load.data === undefined ? null : <Outcome result={load.data} />}
              {load.isError ? <p className="error">{failure(load.error, "The students were not added.")}</p> : null}
            </form>
          ) : null}
          {report.data === undefined ? (
            <p className="notice">Loading…</p>
          ) : report.data.students.length === 0 ? (
            <p className="notice">No students yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Name</th>
                  <th scope="col">Account</th>
                  <th scope="col">Plus until</th>
                  <th scope="col">Solved</th>
                  <th scope="col">Last active</th>
                </tr>
              </thead>
              <tbody>
                {report.data.students.map((s) => (
                  <tr key={s.email}>
                    <td>{s.email}</td>
                    <td>{s.name ?? "—"}</td>
                    <td>{!s.joined ? "Not signed up" : s.verified ? "Verified" : "Not verified"}</td>
                    <td>{s.plusUntil === null ? "—" : day(s.plusUntil)}</td>
                    <td>{s.solved}</td>
                    <td>{s.lastActiveAt === null ? "—" : day(s.lastActiveAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </>
  );
}
