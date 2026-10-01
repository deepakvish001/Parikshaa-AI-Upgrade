import { useQuery } from "@tanstack/react-query";
import type { ConsoleClient } from "../api.ts";

/**
 * How the practice site's learners are doing (Prep blueprint §17): the last
 * 30 days, counted from what they did. Activation is a first solve within a
 * week of signing up; D1 and D7 are coming back the day after, or a week
 * after. Days are India's.
 */

const pct = (part: number, whole: number) => (whole === 0 ? "—" : `${Math.round((part / whole) * 100)}%`);
const shortDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export function PrepAnalyticsPanel({ client }: { client: ConsoleClient }) {
  const data = useQuery({ queryKey: ["prep", "analytics"], queryFn: () => client.prepAnalytics() });
  if (data.isPending) return <p className="notice">Loading…</p>;
  if (data.isError) return <p className="error">The numbers could not be read.</p>;
  const a = data.data;
  const f = a.funnel;
  const peak = Math.max(1, ...a.days.map((d) => d.active));
  const steps: [string, number][] = [
    ["Signed up", f.signedUp],
    ["Started a study plan", f.startedPlan],
    ["Solved a problem", f.solvedOne],
    ["Asked the tutor", f.usedTutor],
    ["Bought a plan", f.bought],
  ];
  return (
    <>
      <section className="card prep-card" aria-label="This month">
        <div className="bar">
          <strong>
            Learners, {shortDay(a.from)} to {shortDay(a.to)}
          </strong>
        </div>
        <dl className="stat-row">
          <div>
            <dt>Activation</dt>
            <dd>{pct(a.activation.activated, a.activation.cohort)}</dd>
            <small>
              {a.activation.activated} of {a.activation.cohort} solved a problem in their first week
            </small>
          </div>
          <div>
            <dt>Back the next day (D1)</dt>
            <dd>{pct(a.retention.d1.returned, a.retention.d1.cohort)}</dd>
            <small>
              {a.retention.d1.returned} of {a.retention.d1.cohort}
            </small>
          </div>
          <div>
            <dt>Back a week later (D7)</dt>
            <dd>{pct(a.retention.d7.returned, a.retention.d7.cohort)}</dd>
            <small>
              {a.retention.d7.returned} of {a.retention.d7.cohort}
            </small>
          </div>
          <div>
            <dt>Daily reminders on</dt>
            <dd>{a.reminders.enabled}</dd>
            <small>{a.reminders.sentInWindow} sent in these days</small>
          </div>
        </dl>
      </section>
      <section className="card prep-card" aria-label="From sign-up to purchase">
        <div className="bar">
          <strong>From sign-up to purchase</strong>
        </div>
        <p className="notice">Learners who signed up in these 30 days, and what they have gone on to do.</p>
        <table>
          <tbody>
            {steps.map(([label, n]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{n}</td>
                <td>{pct(n, f.signedUp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card prep-card" aria-label="Day by day">
        <div className="bar">
          <strong>Day by day</strong>
        </div>
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Active learners</th>
              <th scope="col">Sign-ups</th>
              <th scope="col">Problems solved</th>
            </tr>
          </thead>
          <tbody>
            {[...a.days].reverse().map((d) => (
              <tr key={d.day}>
                <td>{shortDay(d.day)}</td>
                <td>
                  <span className="day-bar" aria-hidden="true" style={{ width: `${(d.active / peak) * 6}rem` }} /> {d.active}
                </td>
                <td>{d.signups}</td>
                <td>{d.solves}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
