import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FlaskConical } from "lucide-react";
import { usePreferences } from "../i18n.tsx";
import { Link, messageOf, SignInNeeded, type Context } from "./parts.tsx";
import { usePrepText } from "./prep-text.ts";
import "./prep.css";

/**
 * A college class from its student's side (plan row 96): the classes they are
 * in, with the course, tests, contests and their attendance, and their lab
 * record for each, which a teacher signs off. Loaded only when opened.
 */

const key = (site: string, ...rest: readonly unknown[]) => ["practice", site, "prep", ...rest];

function useDay() {
  const { language } = usePreferences();
  return (day: string) => new Intl.DateTimeFormat(`${language}-IN`, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

function Loading() {
  const p = usePrepText();
  return <p className="notice">{p("common.loading")}</p>;
}

function Failed({ error }: { readonly error: unknown }) {
  const p = usePrepText();
  return (
    <p className="error" role="alert">
      {messageOf(error, p("common.failed"))}
    </p>
  );
}

const saveFile = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

/** My classes: the course, tests and contests set, my attendance, and my lab record. */
export function ClassesPage({ client, nav, learner, site }: Context) {
  const p = usePrepText();
  const day = useDay();
  const mine = useQuery({ queryKey: key(site, "classes", learner?.id ?? null), queryFn: () => client.myClasses(), enabled: learner !== null });
  if (learner === null) return <SignInNeeded nav={nav} next="/classes" />;
  if (mine.isPending) return <Loading />;
  if (mine.isError) return <Failed error={mine.error} />;
  return (
    <div className="prep-page classes-page">
      <header className="prep-head">
        <div>
          <h1>{p("class.title")}</h1>
          <p className="notice">{p("class.note")}</p>
        </div>
      </header>
      {!mine.data.verified ? <p className="notice">{p("class.unverified")}</p> : mine.data.classes.length === 0 ? <p className="notice">{p("class.none")}</p> : null}
      {mine.data.classes.map((c) => (
        <section key={c.id} className="card class-card" aria-labelledby={`class-${c.id}`}>
          <h2 id={`class-${c.id}`}>{c.name}</h2>
          <dl className="class-facts">
            <div>
              <dt>{p("class.course")}</dt>
              <dd>
                {c.course === null ? (
                  "—"
                ) : (
                  <Link nav={nav} to={`/tracks/${c.course.slug}`}>
                    {c.course.title}
                  </Link>
                )}
              </dd>
            </div>
            {c.tests.length === 0 ? null : (
              <div>
                <dt>{p("class.tests")}</dt>
                <dd>{c.tests.map((t) => t.title).join(" · ")}</dd>
              </div>
            )}
            {c.contests.length === 0 ? null : (
              <div>
                <dt>{p("class.contests")}</dt>
                <dd>
                  {c.contests.map((k, i) => (
                    <span key={k.slug}>
                      {i === 0 ? "" : " · "}
                      <Link nav={nav} to={`/contests/${k.slug}`}>
                        {k.title}
                      </Link>{" "}
                      ({day(k.startsAt.slice(0, 10))})
                    </span>
                  ))}
                </dd>
              </div>
            )}
            <div>
              <dt>{p("class.attendance")}</dt>
              <dd>{p("class.attended", { present: c.attendance.present, of: c.attendance.of })}</dd>
            </div>
          </dl>
          {c.attendance.sessions.length === 0 ? null : (
            <ul className="class-days" aria-label={p("class.attendance")}>
              {c.attendance.sessions.map((s, i) => (
                <li key={`${s.heldOn}-${i}`} className={s.present === true ? "present" : s.present === false ? "absent" : undefined}>
                  <span>{day(s.heldOn)}</span>
                  {s.topic === "" ? null : <span className="notice">{s.topic}</span>}
                  <span className="notice">{s.present === true ? p("class.present") : s.present === false ? p("class.absent") : p("class.unmarked")}</span>
                </li>
              ))}
            </ul>
          )}
          {c.lab.practicals === 0 ? null : (
            <p className="class-lab-line">
              <FlaskConical aria-hidden="true" className="inline-icon" /> {p("class.labProgress", { done: c.lab.done, total: c.lab.practicals, signed: c.lab.signed })}{" "}
              <Link nav={nav} to={`/classes/${c.id}`}>
                {p("class.openLab")}
              </Link>
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

/** My lab record for one class: each practical with my accepted program and its sign-off, and the PDF. */
export function ClassLabPage({ client, nav, learner, site, classId }: Context & { readonly classId: string }) {
  const p = usePrepText();
  const lab = useQuery({ queryKey: key(site, "class-lab", classId, learner?.id ?? null), queryFn: () => client.myLab(classId), enabled: learner !== null });
  const pdf = useMutation({ mutationFn: async () => saveFile(await client.myLabPdf(classId), "lab-record.pdf") });
  if (learner === null) return <SignInNeeded nav={nav} next={`/classes/${classId}`} />;
  if (lab.isPending) return <Loading />;
  if (lab.isError) return <Failed error={lab.error} />;
  const r = lab.data;
  return (
    <div className="prep-page lab-page">
      <header className="prep-head">
        <div>
          <Link nav={nav} to="/classes">
            {p("class.back")}
          </Link>
          <h1>
            {p("class.lab")} · {r.class.name}
          </h1>
          <p className="notice">
            {r.class.course ?? ""} · {p("class.labProgress", { done: r.practicals.filter((x) => x.submission !== null).length, total: r.practicals.length, signed: r.practicals.filter((x) => x.signedBy !== null).length })}
          </p>
        </div>
        <button type="button" className="secondary" disabled={pdf.isPending} onClick={() => pdf.mutate()}>
          <Download aria-hidden="true" /> {p("class.pdf")}
        </button>
      </header>
      <ol className="lab-practicals">
        {r.practicals.map((x) => (
          <li key={x.problemId} className="card">
            <div className="card-head">
              <h2>
                <Link nav={nav} to={`/problems/${x.slug}`}>
                  {x.title}
                </Link>
              </h2>
              <span className={x.signedBy === null ? "notice" : "lab-signed"}>{x.signedBy === null ? p("class.unsigned") : p("class.signed", { by: x.signedBy })}</span>
            </div>
            <p className="notice">
              {x.module}
              {x.submission === null ? "" : ` · ${p("class.tests_passed", { passed: x.submission.passed, total: x.submission.total })}`}
            </p>
            {x.submission === null ? <p>{p("class.notDone")}</p> : <pre className="lab-code">{x.submission.source}</pre>}
          </li>
        ))}
      </ol>
    </div>
  );
}

