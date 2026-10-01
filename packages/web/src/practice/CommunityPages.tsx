import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Building2, CircleCheck, Coins, Crown, Download, Lock, MessageSquareText, Plus, Share2, ShoppingBag, ThumbsUp, Trophy, UserRound } from "lucide-react";
import { Markdown } from "@parikshaa/brand/markdown";
import { usePreferences } from "../i18n.tsx";
import type { CompanyWindow, InterviewExperience, InterviewRound, PracticeClient } from "./client.ts";
import { useCommunityText, type CommunityKey } from "./community-text.ts";
import { DifficultyPill, Link, messageOf, SignInNeeded, useWhen, Who, type Context } from "./parts.tsx";
import "./prep.css";
import "./community.css";

/**
 * Companies, interview experiences, the coin store and ratings (ROADMAP §16).
 * What a company asks is counted by the server from reports; this page only
 * shows it. Nothing here is written without the server's say: an experience
 * waits for staff, and coins are spent by the server alone.
 */

const key = (site: string, ...rest: readonly unknown[]) => ["practice", site, "community", ...rest];
const WINDOWS: readonly CompanyWindow[] = ["30", "60", "180", "all"];

function Loading() {
  const c = useCommunityText();
  return <p className="notice">{c("common.loading")}</p>;
}

function Failed({ error }: { readonly error: unknown }) {
  const c = useCommunityText();
  return (
    <p className="error" role="alert">
      {messageOf(error, c("common.failed"))}
    </p>
  );
}

// --- companies -------------------------------------------------------------------------------

export function CompaniesPage({ client, nav, site }: Context) {
  const c = useCommunityText();
  const companies = useQuery({ queryKey: key(site, "companies"), queryFn: () => client.companies() });
  return (
    <div className="prep-page">
      <header className="prep-head">
        <div>
          <h1>{c("companies.title")}</h1>
          <p className="notice">{c("companies.lead")}</p>
        </div>
        <Link nav={nav} to="/experiences" className="button secondary">
          <MessageSquareText aria-hidden="true" /> {c("exp.title")}
        </Link>
      </header>
      {companies.isPending ? (
        <Loading />
      ) : companies.isError ? (
        <Failed error={companies.error} />
      ) : companies.data.length === 0 ? (
        <p className="notice">{c("companies.none")}</p>
      ) : (
        <div className="track-cards">
          {companies.data.map((company) => (
            <Link key={company.slug} nav={nav} to={`/companies/${company.slug}`} className="card track-card">
              <strong className="company-name">
                <Building2 aria-hidden="true" /> {company.name}
              </strong>
              <span className="notice">{c("companies.card", { problems: company.problems, experiences: company.experiences })}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function CompanyPage({ client, nav, learner, site, slug }: Context & { readonly slug: string }) {
  const c = useCommunityText();
  const when = useWhen();
  const [span, setSpan] = useState<CompanyWindow>("60");
  const queries = useQueryClient();
  const page = useQuery({ queryKey: key(site, "company", slug, span, learner?.id ?? null), queryFn: () => client.company(slug, span) });
  const refresh = () => queries.invalidateQueries({ queryKey: key(site, "company", slug) });
  const aim = useMutation({ mutationFn: (on: boolean) => client.setTarget(slug, on), onSuccess: refresh });
  const start = useMutation({ mutationFn: () => client.startCompanyList(slug), onSuccess: refresh });
  if (page.isPending) return <Loading />;
  if (page.isError) return <Failed error={page.error} />;
  const data = page.data;
  const most = Math.max(1, ...data.topics.map((t) => t.problems));
  return (
    <div className="prep-page">
      <header className="prep-head">
        <div>
          <h1>{data.name}</h1>
          {data.about === "" ? null : <Markdown source={data.about} />}
        </div>
        <Link nav={nav} to={`/experiences?company=${encodeURIComponent(data.slug)}`} className="button secondary">
          {c("company.write")}
        </Link>
      </header>
      {learner === null || data.readiness === null ? null : (
        <section className="card company-ready" aria-label={c("company.ready.title")}>
          <p>
            <strong>{c("company.ready", { solved: data.readiness.solved, of: data.readiness.of, percent: data.readiness.percent })}</strong>
          </p>
          <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.readiness.percent} aria-label={c("company.ready.title")}>
            <span style={{ width: `${data.readiness.percent}%` }} />
          </div>
          <div className="actions">
            <button type="button" className={data.target ? "secondary" : ""} aria-pressed={data.target} disabled={aim.isPending} onClick={() => aim.mutate(!data.target)}>
              {data.target ? c("company.aiming") : c("company.aim")}
            </button>
            <button type="button" className="secondary" disabled={start.isPending} onClick={() => start.mutate()}>
              {c("company.start")}
            </button>
          </div>
          {start.data === undefined ? null : (
            <p className="notice" role="status">
              {c("company.started", { n: start.data.added, list: start.data.list })}{" "}
              {start.data.locked > 0 ? c("company.startLocked", { n: start.data.locked }) : null}{" "}
              <Link nav={nav} to="/lists">
                {c("company.openLists")}
              </Link>
            </p>
          )}
          {aim.isError || start.isError ? <Failed error={aim.error ?? start.error} /> : null}
        </section>
      )}
      <div className="window-row" role="radiogroup" aria-label={c("company.window")}>
        {WINDOWS.map((w) => (
          <button key={w} type="button" role="radio" aria-checked={span === w} className={span === w ? "chip on" : "chip"} onClick={() => setSpan(w)}>
            {c(`company.window.${w}` as CommunityKey)} <span className="count">{data.counts[w] ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="plan-layout">
        <section className="card">
          <h2>{c("company.problems")}</h2>
          {data.problems.length === 0 ? (
            <p className="notice">{c("company.none")}</p>
          ) : (
            <ul className="item-list company-problems">
              {data.problems.map((p) => (
                <li key={p.slug}>
                  <Link nav={nav} to={`/problems/${p.slug}`}>
                    {p.title}
                  </Link>
                  <DifficultyPill difficulty={p.difficulty} />
                  <span className="asked">{c("company.times", { n: p.times })}</span>
                  <span className="notice">{c("company.last", { day: when(`${p.lastAsked}T00:00:00Z`, false) })}</span>
                  {p.solved ? (
                    <span className="solved">
                      <CircleCheck aria-hidden="true" /> {c("company.solved")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {data.locked > 0 ? (
            <p className="locked-row">
              <Lock aria-hidden="true" /> {c("company.locked", { n: data.locked })}{" "}
              <Link nav={nav} to="/plus" className="button small">
                <Crown aria-hidden="true" /> {c("company.getPlus")}
              </Link>
            </p>
          ) : null}
        </section>
        <aside className="home-side">
          <section className="card">
            <h2>{c("company.difficulty")}</h2>
            <div className="difficulty-split">
              {(["easy", "medium", "hard"] as const).map((d) => (
                <span key={d}>
                  <DifficultyPill difficulty={d} /> {data.difficulty[d]}
                </span>
              ))}
            </div>
          </section>
          <section className="card">
            <h2>{c("company.topics")}</h2>
            <ul className="topic-bars">
              {data.topics.slice(0, 12).map((t) => (
                <li key={t.tag}>
                  <span>{t.tag}</span>
                  <span className="bar" aria-hidden="true">
                    <span style={{ width: `${(t.problems / most) * 100}%` }} />
                  </span>
                  <span className="count">{t.problems}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
      <section className="card">
        <h2>{c("company.experiences")}</h2>
        <ExperienceList client={client} site={site} nav={nav} learner={learner} experiences={data.experiences} />
      </section>
    </div>
  );
}

// --- experiences ---------------------------------------------------------------------------------

function ExperienceList({ client, nav, learner, site, experiences }: Context & { readonly experiences: readonly InterviewExperience[] }) {
  const c = useCommunityText();
  const queryClient = useQueryClient();
  const vote = useMutation({
    mutationFn: (e: InterviewExperience) => client.vote(e.id, !e.voted),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(site) }),
  });
  if (experiences.length === 0) return <p className="notice">{c("exp.none")}</p>;
  const month = (m: string) => new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
  return (
    <ul className="experience-list">
      {experiences.map((e) => (
        <li key={e.id}>
          <article className="experience" aria-label={`${e.company.name}, ${e.role}`}>
            <header>
              <strong>
                <Link nav={nav} to={`/companies/${e.company.slug}`}>
                  {e.company.name}
                </Link>
              </strong>
              <span className={`exp-verdict ${e.verdict}`}>{c(`exp.verdict.${e.verdict}` as CommunityKey)}</span>
              {e.status === "pending" ? <span className="stat-chip">{c("exp.pending")}</span> : e.status === "rejected" ? <span className="stat-chip">{c("exp.rejected")}</span> : null}
              <span className="notice">{c("exp.by", { author: e.author, role: e.role, month: month(e.interviewed) })}</span>
            </header>
            <ol className="rounds">
              {e.rounds.map((r, i) => (
                <li key={i}>
                  <h3>{c("exp.round", { n: i + 1, kind: r.kind })}</h3>
                  {r.asked === "" ? null : <Markdown source={r.asked} />}
                  {(r.problems ?? []).length === 0 ? null : (
                    <p className="round-problems">
                      {r.problems!.map((q) => (
                        <Link key={q.slug} nav={nav} to={`/problems/${q.slug}`} className="stat-chip">
                          {q.title}
                        </Link>
                      ))}
                    </p>
                  )}
                </li>
              ))}
            </ol>
            {e.tips === "" ? null : (
              <div className="tips">
                <h3>{c("exp.tips")}</h3>
                <Markdown source={e.tips} />
              </div>
            )}
            {e.status !== "published" ? null : (
              <button
                type="button"
                className={e.voted ? "quiet small on" : "quiet small"}
                aria-pressed={e.voted}
                disabled={learner === null || e.mine || vote.isPending}
                onClick={() => vote.mutate(e)}
              >
                <ThumbsUp aria-hidden="true" /> {c("exp.helpful", { n: e.votes })}
              </button>
            )}
          </article>
        </li>
      ))}
    </ul>
  );
}

export function ExperiencesPage({ client, nav, learner, site, company }: Context & { readonly company: string | undefined }) {
  const c = useCommunityText();
  const [writing, setWriting] = useState(company !== undefined && learner !== null);
  const list = useQuery({ queryKey: key(site, "experiences", company ?? null, learner?.id ?? null), queryFn: () => client.experiences(company) });
  const companies = useQuery({ queryKey: key(site, "companies"), queryFn: () => client.companies() });
  return (
    <div className="prep-page">
      <header className="prep-head">
        <div>
          <h1>{c("exp.title")}</h1>
          <p className="notice">{c("exp.lead")}</p>
        </div>
        {learner === null || writing ? null : (
          <button type="button" onClick={() => setWriting(true)}>
            <Plus aria-hidden="true" /> {c("exp.share")}
          </button>
        )}
      </header>
      {companies.data === undefined || companies.data.length === 0 ? null : (
        <nav className="window-row" aria-label={c("companies.title")}>
          <Link nav={nav} to="/experiences" className={company === undefined ? "chip on" : "chip"}>
            {c("exp.all")}
          </Link>
          {companies.data.map((co) => (
            <Link key={co.slug} nav={nav} to={`/experiences?company=${encodeURIComponent(co.slug)}`} className={company === co.slug ? "chip on" : "chip"}>
              {co.name}
            </Link>
          ))}
        </nav>
      )}
      {writing && learner !== null && companies.data !== undefined ? (
        <ExperienceForm client={client} site={site} companies={companies.data} company={company ?? companies.data[0]?.slug ?? ""} onDone={() => setWriting(false)} />
      ) : null}
      <section className="card">
        {list.isPending ? <Loading /> : list.isError ? <Failed error={list.error} /> : <ExperienceList client={client} nav={nav} learner={learner} site={site} experiences={list.data} />}
      </section>
    </div>
  );
}

function ExperienceForm({
  client,
  site,
  companies,
  company: initial,
  onDone,
}: {
  readonly client: Context["client"];
  readonly site: string;
  readonly companies: readonly { readonly slug: string; readonly name: string }[];
  readonly company: string;
  readonly onDone: () => void;
}) {
  const c = useCommunityText();
  const queryClient = useQueryClient();
  const [company, setCompany] = useState(initial);
  const [role, setRole] = useState("");
  const [interviewed, setInterviewed] = useState(() => new Date().toISOString().slice(0, 7));
  const [verdict, setVerdict] = useState<InterviewExperience["verdict"]>("offer");
  const [rounds, setRounds] = useState<{ kind: string; asked: string; problems: string }[]>([{ kind: "", asked: "", problems: "" }]);
  const [tips, setTips] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const send = useMutation({
    mutationFn: () =>
      client.shareExperience({
        company,
        role,
        interviewed,
        verdict,
        rounds: rounds.map(
          (r): InterviewRound => ({
            kind: r.kind,
            asked: r.asked,
            problemSlugs: r.problems
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s !== ""),
          }),
        ),
        tips,
        anonymous,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key(site) });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    send.mutate();
  };
  const setRound = (i: number, patch: Partial<(typeof rounds)[number]>) => setRounds((all) => all.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  if (send.isSuccess) {
    return (
      <section className="card" role="status">
        <p>{c("exp.form.sent")}</p>
        <button type="button" className="secondary" onClick={onDone}>
          OK
        </button>
      </section>
    );
  }
  return (
    <form className="card experience-form" aria-label={c("exp.share")} onSubmit={submit}>
      <h2>{c("exp.share")}</h2>
      <div className="form-grid">
        <label>
          {c("exp.form.company")}
          <select value={company} onChange={(e) => setCompany(e.target.value)} required>
            {companies.map((co) => (
              <option key={co.slug} value={co.slug}>
                {co.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {c("exp.form.role")}
          <input value={role} onChange={(e) => setRole(e.target.value)} required maxLength={120} />
        </label>
        <label>
          {c("exp.form.month")}
          <input type="month" value={interviewed} onChange={(e) => setInterviewed(e.target.value)} required />
        </label>
        <label>
          {c("exp.form.verdict")}
          <select value={verdict} onChange={(e) => setVerdict(e.target.value as InterviewExperience["verdict"])}>
            {(["offer", "reject", "waiting"] as const).map((v) => (
              <option key={v} value={v}>
                {c(`exp.verdict.${v}` as CommunityKey)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {rounds.map((r, i) => (
        <fieldset key={i} className="round-fields">
          <legend>{c("exp.round", { n: i + 1, kind: r.kind })}</legend>
          <label>
            {c("exp.form.kind")}
            <input value={r.kind} onChange={(e) => setRound(i, { kind: e.target.value })} required maxLength={40} placeholder="DSA" />
          </label>
          <label>
            {c("exp.form.asked")}
            <textarea value={r.asked} onChange={(e) => setRound(i, { asked: e.target.value })} rows={3} maxLength={4000} />
          </label>
          <label>
            {c("exp.form.problems")}
            <input value={r.problems} onChange={(e) => setRound(i, { problems: e.target.value })} />
          </label>
        </fieldset>
      ))}
      {rounds.length >= 10 ? null : (
        <button type="button" className="secondary" onClick={() => setRounds((all) => [...all, { kind: "", asked: "", problems: "" }])}>
          <Plus aria-hidden="true" /> {c("exp.form.addRound")}
        </button>
      )}
      <label>
        {c("exp.form.tips")}
        <textarea value={tips} onChange={(e) => setTips(e.target.value)} rows={3} maxLength={10_000} />
      </label>
      <label className="check-row">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> {c("exp.form.anonymous")}
      </label>
      {send.isError ? <Failed error={send.error} /> : null}
      <div className="row">
        <button type="submit" disabled={send.isPending}>
          {c("exp.form.send")}
        </button>
      </div>
    </form>
  );
}

// --- the store -------------------------------------------------------------------------------------

export function StorePage({ client, nav, learner, site }: Context) {
  const c = useCommunityText();
  const when = useWhen();
  const queryClient = useQueryClient();
  const store = useQuery({ queryKey: key(site, "store", learner?.id ?? null), queryFn: () => client.coinStore() });
  const [choosing, setChoosing] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const buy = useMutation({
    mutationFn: (id: string) => client.redeem(id, address),
    onSuccess: async () => {
      setChoosing(null);
      setAddress("");
      await queryClient.invalidateQueries({ queryKey: ["practice", site] });
    },
  });
  if (store.isPending) return <Loading />;
  if (store.isError) return <Failed error={store.error} />;
  const data = store.data;
  return (
    <div className="prep-page">
      <header className="prep-head">
        <div>
          <h1>{c("store.title")}</h1>
          <p className="notice">{c("store.lead")}</p>
        </div>
        {learner === null ? null : (
          <span className="coin-balance" aria-label={c("store.balance")}>
            <Coins aria-hidden="true" /> {data.balance.toLocaleString("en-IN")}
          </span>
        )}
      </header>
      {learner === null ? <SignInNeeded nav={nav} next="/store" /> : null}
      {data.opensAt === null ? null : <p className="alert store-opens">{c("store.opens", { day: when(data.opensAt, false) })}</p>}
      {buy.isSuccess ? <p role="status">{c("store.done", { balance: buy.data.balance })}</p> : null}
      {buy.isError ? <Failed error={buy.error} /> : null}
      {data.items.length === 0 ? (
        <p className="notice">{c("store.none")}</p>
      ) : (
        <div className="track-cards">
          {data.items.map((item) => {
            const done = item.bought >= item.perLearner;
            const closed = learner === null || data.opensAt !== null || item.soldOut || done;
            return (
              <article key={item.id} className="card store-item" aria-label={item.title}>
                <strong>
                  {item.kind === "plus" ? <Crown aria-hidden="true" /> : <ShoppingBag aria-hidden="true" />} {item.title}
                </strong>
                {item.kind === "plus" ? <span className="notice">{c("store.plus", { days: item.plusDays })}</span> : null}
                {item.kind === "coupon" ? <span className="notice">{c("store.coupon", { percent: item.couponPercent })}</span> : null}
                {item.perMonth === null ? null : <span className="notice">{c("store.perMonth", { n: item.perMonth })}</span>}
                {item.description === "" ? null : <p>{item.description}</p>}
                <span className="notice">{item.soldOut ? c("store.soldOut") : item.left === null ? "" : c("store.left", { n: item.left })}</span>
                {done ? <span className="stat-chip">{c("store.bought")}</span> : null}
                {choosing === item.id ? (
                  <form
                    className="inline-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      buy.mutate(item.id);
                    }}
                  >
                    {item.kind === "physical" ? (
                      <label>
                        {c("store.address")}
                        <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} required minLength={10} maxLength={1000} />
                      </label>
                    ) : null}
                    <button type="submit" disabled={buy.isPending || data.balance < item.priceCoins}>
                      {c("store.confirm", { price: item.priceCoins })}
                    </button>
                  </form>
                ) : (
                  <button type="button" disabled={closed || data.balance < item.priceCoins} onClick={() => setChoosing(item.id)}>
                    <Coins aria-hidden="true" /> {c("store.buy", { price: item.priceCoins.toLocaleString("en-IN") })}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
      {data.orders.length === 0 ? null : (
        <section className="card">
          <h2>{c("store.orders")}</h2>
          <ul className="coin-history">
            {data.orders.map((o) => (
              <li key={o.id}>
                <span>{o.title}</span>
                <span className="notice">{when(o.createdAt)}</span>
                <span className={`order-status ${o.status}`}>{c(`store.status.${o.status}` as CommunityKey)}</span>
                {o.note === "" ? null : <span className="notice">{o.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// --- rating --------------------------------------------------------------------------------------------

export function RatingPage({ client, nav, learner, site }: Context) {
  const c = useCommunityText();
  const when = useWhen();
  const rating = useQuery({ queryKey: key(site, "rating", learner?.id ?? null), queryFn: () => client.rating() });
  if (rating.isPending) return <Loading />;
  if (rating.isError) return <Failed error={rating.error} />;
  const { board, me } = rating.data;
  return (
    <div className="prep-page">
      <header className="prep-head">
        <div>
          <h1>{c("rating.title")}</h1>
          <p className="notice">{c("rating.lead")}</p>
        </div>
        {me === null ? null : (
          <span className="rating-badge" aria-label={c("rating.you")}>
            <Trophy aria-hidden="true" /> {me.rating ?? "—"} <span className="title">{me.title}</span>
          </span>
        )}
      </header>
      <div className="plan-layout">
        <div className="prep-page">
          {me === null ? (
            <SignInNeeded nav={nav} next="/rating" />
          ) : (
            <>
              <section className="card">
                <h2>{c("rating.history")}</h2>
                {me.history.length === 0 ? (
                  <p className="notice">{c("rating.unrated")}</p>
                ) : (
                  <ul className="coin-history">
                    {[...me.history].reverse().map((h) => (
                      <li key={h.slug}>
                        <Link nav={nav} to={`/contests/${h.slug}`}>
                          {h.contest}
                        </Link>
                        <span className="notice">
                          {c("rating.rank", { rank: h.rank, field: h.field })} · {when(h.at, false)}
                        </span>
                        <strong className={h.after >= h.before ? "plus" : "minus"}>
                          {h.after} ({h.after >= h.before ? "+" : ""}
                          {h.after - h.before})
                        </strong>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="card">
                <h2>{c("rating.achievements")}</h2>
                <ul className="badges">
                  {me.achievements.map((a) => (
                    <li key={a.id} className={a.earned ? "earned" : undefined}>
                      <Award aria-hidden="true" />
                      <span>{c(`badge.${a.id}` as CommunityKey)}</span>
                      {a.earned ? (
                        <CardButton client={client} achievement={a.id} />
                      ) : (
                        <span className="notice">
                          {a.have}/{a.need}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
              <ProfileSettings client={client} nav={nav} site={site} learnerId={learner!.id} />
            </>
          )}
        </div>
        <section className="card">
          <h2>{c("rating.board")}</h2>
          {board.length === 0 ? (
            <p className="notice">{c("rating.none")}</p>
          ) : (
            <ol className="coin-leaders">
              {board.map((r) => (
                <li key={r.rank} className={r.you ? "you" : undefined}>
                  <span className="rank">{r.rank}</span>
                  <span>{r.name}</span>
                  <span className="notice">
                    {r.title} · {c("rating.contests", { n: r.contests })}
                  </span>
                  <strong>{r.rating}</strong>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * An earned achievement's card (Prep blueprint C1): fetched as an image,
 * shared where the device can share a file, and downloadable everywhere.
 */
function CardButton({ client, achievement }: { readonly client: PracticeClient; readonly achievement: string }) {
  const c = useCommunityText();
  const { language } = usePreferences();
  const [card, setCard] = useState<{ url: string; file: File } | null>(null);
  const make = useMutation({
    mutationFn: async () => {
      const blob = await client.card(achievement, "story", language === "hi" ? "hi" : "en");
      const file = new File([blob], `${achievement}.svg`, { type: "image/svg+xml" });
      const shareable = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
      if (shareable) await navigator.share({ files: [file], title: c(`badge.${achievement}` as CommunityKey) }).catch(() => undefined);
      return { url: URL.createObjectURL(blob), file };
    },
    onSuccess: setCard,
  });
  if (card !== null) {
    return (
      <a className="link-button small" href={card.url} download={card.file.name}>
        <Download aria-hidden="true" /> {c("card.download")}
      </a>
    );
  }
  return (
    <button type="button" className="link-button small" disabled={make.isPending} onClick={() => make.mutate()}>
      <Share2 aria-hidden="true" /> {c("card.share")}
    </button>
  );
}

/** A learner's profile settings: a username, and whether others may see the profile. */
function ProfileSettings({ client, nav, site, learnerId }: { readonly client: PracticeClient; readonly nav: Context["nav"]; readonly site: string; readonly learnerId: string }) {
  const c = useCommunityText();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: key(site, "profile", learnerId), queryFn: () => client.profile() });
  const [draft, setDraft] = useState<{ username: string; public: boolean; bio: string } | null>(null);
  const save = useMutation({
    mutationFn: (d: { username: string; public: boolean; bio: string }) => client.saveProfile(d),
    onSuccess: (saved) => {
      setDraft(null);
      queryClient.setQueryData(key(site, "profile", learnerId), saved);
    },
  });
  if (profile.data === undefined) return null;
  const d = draft ?? { username: profile.data.username ?? "", public: profile.data.public, bio: profile.data.bio };
  return (
    <section className="card" aria-labelledby="profile-title">
      <h2 id="profile-title">
        <UserRound aria-hidden="true" /> {c("profile.title")}
      </h2>
      <p className="notice">{c("profile.lead")}</p>
      <form
        className="stack"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate(d);
        }}
      >
        <label>
          {c("profile.username")}
          <input value={d.username} required minLength={3} maxLength={30} pattern="[A-Za-z0-9][A-Za-z0-9_\-]{2,29}" onChange={(e) => setDraft({ ...d, username: e.target.value })} />
        </label>
        <label>
          {c("profile.bio")}
          <input value={d.bio} maxLength={200} onChange={(e) => setDraft({ ...d, bio: e.target.value })} />
        </label>
        <label className="check-row">
          <input type="checkbox" checked={d.public} onChange={(e) => setDraft({ ...d, public: e.target.checked })} /> {c("profile.public")}
        </label>
        <button type="submit" disabled={save.isPending}>
          {c("profile.save")}
        </button>
      </form>
      {save.isError ? <Failed error={save.error} /> : null}
      {profile.data.public && profile.data.username !== null ? (
        <p>
          <Link nav={nav} to={`/u/${profile.data.username}`}>
            {c("profile.see")}
          </Link>
        </p>
      ) : null}
    </section>
  );
}

/** A learner's public profile, as anyone sees it. */
export function ProfilePage({ client, nav, site, username }: Context & { readonly username: string }) {
  const c = useCommunityText();
  const when = useWhen();
  const profile = useQuery({ queryKey: key(site, "public-profile", username), queryFn: () => client.publicProfile(username), retry: false });
  if (profile.isPending) return <Loading />;
  if (profile.isError) return <p className="notice">{c("profile.none")}</p>;
  const p = profile.data;
  return (
    <div className="prep-page">
      <header className="prep-head">
        <div>
          <h1>
            {p.name} <span className="title-chip">{p.title}</span>
          </h1>
          <p className="notice">
            @{p.username} · {c("profile.joined", { day: when(p.joinedAt, false) })}
          </p>
          {p.bio === "" ? null : <p>{p.bio}</p>}
        </div>
        <span className="rating-badge">
          <Trophy aria-hidden="true" /> {p.rating ?? "—"}
        </span>
      </header>
      <div className="plan-layout">
        <section className="card" aria-labelledby="solved-title">
          <h2 id="solved-title">{c("profile.solved")}</h2>
          <ul className="stat-row">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <li key={d}>
                <DifficultyPill difficulty={d} /> <strong>{p.solved[d]}</strong>
              </li>
            ))}
          </ul>
          <p className="notice">{c("profile.streak", { current: p.streak.current, longest: p.streak.longest })}</p>
        </section>
        <section className="card" aria-labelledby="badges-title">
          <h2 id="badges-title">{c("rating.achievements")}</h2>
          {p.achievements.length === 0 ? (
            <p className="notice">{c("profile.noBadges")}</p>
          ) : (
            <ul className="badges">
              {p.achievements.map((a) => (
                <li key={a} className="earned">
                  <Award aria-hidden="true" /> <span>{c(`badge.${a}` as CommunityKey)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {p.contests.length === 0 ? null : (
        <section className="card" aria-labelledby="contests-title">
          <h2 id="contests-title">{c("rating.history")}</h2>
          <ul className="coin-history">
            {p.contests.map((h) => (
              <li key={h.slug}>
                <Link nav={nav} to={`/contests/${h.slug}`}>
                  {h.contest}
                </Link>
                <span className="notice">{c("rating.rank", { rank: h.rank, field: h.field })}</span>
                <strong>{h.after}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
