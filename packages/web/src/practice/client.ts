import type { CandidateQuestion } from "@parikshaa/core/browser";
import { ApiError, type RunOutcome, type SubmitOutcome } from "../api.ts";
import { keepQueued, ownerOf, queuedAnswers, queuedOffline } from "./offline-queue.ts";

/**
 * A practice site's API (ROADMAP §15), as a learner uses it: `/practice/<site>`
 * on the server, under `/api` as the candidate app's calls are.
 */

export type Difficulty = "easy" | "medium" | "hard";
export type Standing = "solved" | "attempted" | null;

export interface Site {
  readonly slug: string;
  readonly title: string;
  readonly welcome: string;
}

export interface Learner {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  /** Proved by the emailed link, or by signing in with Google. */
  readonly emailVerified: boolean;
}

export interface SignInOptions {
  readonly google: boolean;
  readonly requireVerified: boolean;
}

export interface Session {
  readonly token: string;
  readonly expiresAt: string;
  readonly learner: Learner;
}

export interface ProblemSummary {
  readonly slug: string;
  readonly title: string;
  readonly difficulty: Difficulty;
  readonly tags: readonly string[];
  /** The ideas behind the tags: two pointers, sliding window… */
  readonly patterns: readonly string[];
  /** Companies that asked it lately, as far as this learner may see. */
  readonly companies: readonly { readonly slug: string; readonly name: string }[];
  readonly kind: CandidateQuestion["kind"];
  readonly acceptance: number | null;
  readonly solvedBy: number;
  readonly status: Standing;
}

export interface Problem {
  readonly slug: string;
  readonly title: string;
  readonly difficulty: Difficulty;
  readonly tags: readonly string[];
  readonly question: CandidateQuestion;
  readonly editorial: string | null;
  readonly editorialLocked: boolean;
  readonly acceptance: number | null;
  readonly solvedBy: number;
  readonly status: Standing;
  readonly contest: { readonly slug: string; readonly title: string; readonly endsAt: string } | null;
}

export interface Verdict {
  readonly status: string;
  readonly passed: number;
  readonly total: number;
  readonly compileOutput: string | null;
  readonly timeMs: number | null;
  readonly memoryKb: number | null;
  readonly cases: Extract<SubmitOutcome, { compiled: true }>["cases"];
  readonly submissionId: string;
  readonly firstSolve: boolean;
  /** Coins paid for this submission, where the site keeps them. */
  readonly reward?: Reward;
}

export interface Submission {
  readonly id: string;
  readonly language: string | null;
  readonly answer: string;
  readonly status: string;
  readonly passed: number;
  readonly total: number;
  readonly timeMs: number | null;
  readonly memoryKb: number | null;
  readonly createdAt: string;
  readonly inContest: boolean;
}

/** Beside a learner's name: their contest title, and their public profile's username. */
export interface Person {
  readonly title?: string | null;
  readonly username?: string | null;
}

export interface Comment extends Person {
  readonly id: string;
  readonly authorName: string;
  readonly fromStaff: boolean;
  readonly body: string;
  readonly createdAt: string;
}

interface Counts {
  readonly easy: number;
  readonly medium: number;
  readonly hard: number;
  readonly total: number;
}

export interface Progress {
  readonly solved: Counts;
  readonly available: Counts;
  readonly streak: number;
  readonly longestStreak: number;
  readonly activeDays: number;
  readonly days: readonly { readonly day: string; readonly accepted: number; readonly submitted: number }[];
  readonly recent: readonly { readonly slug: string; readonly title: string; readonly at: string }[];
  readonly rank: number | null;
}

export interface Leader extends Person {
  readonly rank: number;
  readonly name: string;
  readonly solved: number;
  readonly you: boolean;
}

export type ContestState = "upcoming" | "running" | "ended";

export interface ContestSummary {
  readonly slug: string;
  readonly title: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly problems: number;
  readonly state: ContestState;
}

export interface Contest {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly state: ContestState;
  readonly problems: readonly { readonly label: string; readonly slug: string; readonly title: string; readonly difficulty: Difficulty; readonly status: Standing }[];
  readonly scoreboard: readonly (Person & {
    readonly rank: number;
    readonly name: string;
    readonly solved: number;
    readonly penalty: number;
    readonly problems: readonly { readonly minutes: number | null; readonly wrong: number }[];
    readonly you: boolean;
  })[];
}

/** A learner's session on one site, kept on this device: practice is done on one's own machine, over weeks. */
const tokenKey = (site: string) => `parikshaa.practice.${site}.session`;

export function loadToken(site: string): string | null {
  try {
    return localStorage.getItem(tokenKey(site));
  } catch {
    return null;
  }
}

const refKey = (site: string) => `parikshaa.ref.${site}`;

/** A coupon a `?ref=` link brought: kept on this device for checkout, until it is used or replaced. */
export function loadRef(site: string): string | null {
  try {
    return localStorage.getItem(refKey(site));
  } catch {
    return null;
  }
}

export function saveRef(site: string, code: string | null): void {
  try {
    if (code === null) localStorage.removeItem(refKey(site));
    else localStorage.setItem(refKey(site), code);
  } catch {
    // A private window: the code is typed in by hand instead.
  }
}

export function saveToken(site: string, token: string | null): void {
  try {
    if (token === null) localStorage.removeItem(tokenKey(site));
    else localStorage.setItem(tokenKey(site), token);
  } catch {
    // A private window: the session lasts this page.
  }
}

/** A class as its student sees it (plan row 96). */
export interface MyClass {
  readonly id: string;
  readonly name: string;
  readonly course: { readonly slug: string; readonly title: string } | null;
  readonly tests: readonly { readonly title: string }[];
  readonly contests: readonly { readonly slug: string; readonly title: string; readonly startsAt: string; readonly endsAt: string }[];
  readonly attendance: {
    readonly present: number;
    readonly of: number;
    readonly sessions: readonly { readonly heldOn: string; readonly topic: string; readonly present: boolean | null }[];
  };
  readonly lab: { readonly practicals: number; readonly done: number; readonly signed: number };
}

export interface LabRecord {
  readonly class: { readonly id: string; readonly name: string; readonly course: string | null };
  readonly student: { readonly email: string; readonly name: string | null };
  readonly practicals: readonly {
    readonly problemId: string;
    readonly slug: string;
    readonly title: string;
    readonly module: string;
    readonly submission: { readonly language: string | null; readonly source: string; readonly passed: number; readonly total: number; readonly at: string } | null;
    readonly signedBy: string | null;
    readonly signedAt: string | null;
  }[];
}

export class PracticeClient {
  readonly #base: string;
  readonly #token: string | null;

  constructor(
    readonly slug: string,
    token: string | null,
    baseUrl = "/api",
  ) {
    this.#base = `${baseUrl.replace(/\/$/, "")}/practice/${encodeURIComponent(slug)}`;
    this.#token = token;
  }

  get signedIn(): boolean {
    return this.#token !== null;
  }

  async #request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.#base}${path}`, {
      ...init,
      headers: {
        ...(this.#token === null ? {} : { authorization: `Bearer ${this.#token}` }),
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      },
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) throw new ApiError(response.status, typeof body["error"] === "string" ? body["error"] : "request_failed", body);
    return body as T;
  }

  #post<T>(path: string, body?: object): Promise<T> {
    return this.#request<T>(path, { method: "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }

  site(): Promise<Site> {
    return this.#request("");
  }

  signInOptions(): Promise<SignInOptions> {
    return this.#request("/sign-in-options");
  }

  /** Where the browser goes to sign in with Google: a navigation, not a fetch. */
  get googleUrl(): string {
    return `${this.#base}/auth/google`;
  }

  async verify(token: string): Promise<void> {
    await this.#post("/verify", { token });
  }

  async resendVerification(): Promise<void> {
    await this.#post("/verify/resend");
  }

  signUp(name: string, email: string, password: string): Promise<Session> {
    return this.#post("/signup", { name, email, password });
  }

  signIn(email: string, password: string): Promise<Session> {
    return this.#post("/signin", { email, password });
  }

  async signOut(): Promise<void> {
    await this.#post("/signout");
  }

  /** The signed-in learner; null when the session has ended. */
  async me(): Promise<Learner | null> {
    if (this.#token === null) return null;
    try {
      return await this.#request<Learner>("/me");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  }

  async deleteAccount(): Promise<void> {
    await this.#request("/me", { method: "DELETE" });
  }

  async problems(): Promise<readonly ProblemSummary[]> {
    return (await this.#request<{ problems: ProblemSummary[] }>("/problems")).problems;
  }

  problem(slug: string, contest?: string): Promise<Problem> {
    return this.#request(`/problems/${encodeURIComponent(slug)}${contestQuery(contest)}`);
  }

  run(slug: string, language: string, source: string, input?: string, contest?: string): Promise<RunOutcome> {
    return this.#post(`/problems/${encodeURIComponent(slug)}/run`, {
      language,
      source,
      ...(input === undefined ? {} : { input }),
      ...(contest === undefined ? {} : { contest }),
    });
  }

  async submit(slug: string, answer: string, language?: string, contest?: string): Promise<Verdict> {
    try {
      return await this.#post(`/problems/${encodeURIComponent(slug)}/submit`, {
        answer,
        ...(language === undefined ? {} : { language }),
        ...(contest === undefined ? {} : { contest }),
      });
    } catch (error) {
      // No network at all (fetch itself failed): outside a contest, keep it for later.
      if (!(error instanceof TypeError) || contest !== undefined || this.#token === null) throw error;
      keepQueued(this.slug, [...queuedAnswers(this.slug), { slug, answer, ...(language === undefined ? {} : { language }), owner: ownerOf(this.#token), at: Date.now() }]);
      throw queuedOffline();
    }
  }

  /** Submit what was kept while offline, this session's only; how many went. */
  async submitQueued(): Promise<number> {
    if (this.#token === null) return 0;
    const owner = ownerOf(this.#token);
    let left = queuedAnswers(this.slug);
    let sent = 0;
    for (const q of left.filter((x) => x.owner === owner)) {
      try {
        await this.#post(`/problems/${encodeURIComponent(q.slug)}/submit`, { answer: q.answer, ...(q.language === undefined ? {} : { language: q.language }) });
        sent++;
      } catch (error) {
        // Still offline: try again later. Any answer from the server settles it.
        if (error instanceof TypeError) break;
      }
      left = left.filter((x) => x !== q);
      keepQueued(this.slug, left);
    }
    return sent;
  }

  async submissions(slug: string, contest?: string): Promise<readonly Submission[]> {
    return (await this.#request<{ submissions: Submission[] }>(`/problems/${encodeURIComponent(slug)}/submissions${contestQuery(contest)}`)).submissions;
  }

  async comments(slug: string): Promise<readonly Comment[]> {
    return (await this.#request<{ comments: Comment[] }>(`/problems/${encodeURIComponent(slug)}/comments`)).comments;
  }

  comment(slug: string, body: string): Promise<Comment> {
    return this.#post(`/problems/${encodeURIComponent(slug)}/comments`, { body });
  }

  progress(): Promise<Progress> {
    return this.#request("/progress");
  }

  async leaderboard(): Promise<readonly Leader[]> {
    return (await this.#request<{ leaders: Leader[] }>("/leaderboard")).leaders;
  }

  async contests(): Promise<readonly ContestSummary[]> {
    return (await this.#request<{ contests: ContestSummary[] }>("/contests")).contests;
  }

  contest(slug: string): Promise<Contest> {
    return this.#request(`/contests/${encodeURIComponent(slug)}`);
  }

  // --- prep (ROADMAP §16) ------------------------------------------------------------------

  home(): Promise<Home> {
    return this.#request("/home");
  }

  async tracks(): Promise<readonly TrackSummary[]> {
    return (await this.#request<{ tracks: TrackSummary[] }>("/tracks")).tracks;
  }

  track(slug: string): Promise<TrackView> {
    return this.#request(`/tracks/${encodeURIComponent(slug)}`);
  }

  lesson(slug: string): Promise<Lesson> {
    return this.#request(`/lessons/${encodeURIComponent(slug)}`);
  }

  lessonDone(slug: string): Promise<Reward> {
    return this.#post(`/lessons/${encodeURIComponent(slug)}/done`);
  }

  lessonQuiz(slug: string, answers: Readonly<Record<string, string>>): Promise<QuizResult> {
    return this.#post(`/lessons/${encodeURIComponent(slug)}/quiz`, { answers });
  }

  shareCode(slug: string, language: string, source: string): Promise<{ readonly id: string; readonly path: string }> {
    return this.#post(`/problems/${encodeURIComponent(slug)}/share`, { language, source });
  }

  async myShares(): Promise<readonly MyShare[]> {
    return (await this.#request<{ shares: MyShare[] }>("/shares")).shares;
  }

  async deleteShare(id: string): Promise<void> {
    await this.#request(`/shares/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  sharedCode(id: string): Promise<SharedCode> {
    return this.#request(`/shares/${encodeURIComponent(id)}`);
  }

  async plan(): Promise<Plan | null> {
    return (await this.#request<{ plan: Plan | null }>("/plan")).plan;
  }

  previewPlan(input: PlanInput): Promise<PlanPreview> {
    return this.#post("/plan/preview", input);
  }

  async startPlan(input: PlanInput): Promise<Plan> {
    return (await this.#post<{ plan: Plan }>("/plan", input)).plan;
  }

  async changePlan(change: PlanChange): Promise<Plan> {
    return (await this.#request<{ plan: Plan }>("/plan", { method: "PATCH", body: JSON.stringify(change) })).plan;
  }

  async stopPlan(): Promise<void> {
    await this.#request("/plan", { method: "DELETE" });
  }

  async addTask(title: string, estMinutes: number, day?: string): Promise<void> {
    await this.#post("/plan/tasks", { title, estMinutes, ...(day === undefined ? {} : { day }) });
  }

  async setTaskDone(id: string, done: boolean): Promise<void> {
    await this.#request(`/plan/tasks/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ done }) });
  }

  startFocus(taskId: string | null): Promise<{ readonly id: string; readonly startedAt: string }> {
    return this.#post("/focus", { taskId });
  }

  stopFocus(id: string): Promise<{ readonly seconds: number }> {
    return this.#post(`/focus/${encodeURIComponent(id)}/stop`);
  }

  async focusWeek(): Promise<readonly { readonly day: string; readonly minutes: number }[]> {
    return (await this.#request<{ days: { day: string; minutes: number }[] }>("/focus")).days;
  }

  revision(): Promise<Revision> {
    return this.#request("/revise");
  }

  grade(slug: string, grade: Grade): Promise<{ readonly dueOn: string; readonly intervalDays: number }> {
    return this.#post(`/revise/${encodeURIComponent(slug)}`, { grade });
  }

  async lists(): Promise<readonly ProblemList[]> {
    return (await this.#request<{ lists: ProblemList[] }>("/lists")).lists;
  }

  async saveTo(list: string, slug: string): Promise<void> {
    await this.#request(`/lists/${encodeURIComponent(list)}/${encodeURIComponent(slug)}`, { method: "PUT" });
  }

  async removeFrom(list: string, slug: string): Promise<void> {
    await this.#request(`/lists/${encodeURIComponent(list)}/${encodeURIComponent(slug)}`, { method: "DELETE" });
  }

  async notes(): Promise<readonly Note[]> {
    return (await this.#request<{ notes: Note[] }>("/notes")).notes;
  }

  note(kind: NoteKind, ref: string): Promise<Note> {
    return this.#request(`/notes/${kind}/${encodeURIComponent(ref)}`);
  }

  saveNote(kind: NoteKind, ref: string, body: string, title?: string): Promise<Note> {
    return this.#request(`/notes/${kind}/${encodeURIComponent(ref)}`, { method: "PUT", body: JSON.stringify({ body, ...(title === undefined ? {} : { title }) }) });
  }

  potd(): Promise<{ readonly today: PotdDay | null; readonly calendar: readonly PotdDay[] }> {
    return this.#request("/potd");
  }

  coins(): Promise<Coins> {
    return this.#request("/coins");
  }

  // --- Plus and the tutor ----------------------------------------------------------------------

  plus(): Promise<PlusOverview> {
    return this.#request("/plus");
  }

  checkout(productId: string, extra: Billing = {}): Promise<CheckoutOrder> {
    return this.#post("/plus/checkout", { productId, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== "")) });
  }

  freezeToday(): Promise<{ readonly day: string; readonly freezesLeft: number; readonly moved: number }> {
    return this.#post("/streak/freeze", {});
  }

  async placement(): Promise<readonly PlacementQuestion[]> {
    return (await this.#request<{ questions: PlacementQuestion[] }>("/placement")).questions;
  }

  markPlacement(answers: readonly { readonly id: string; readonly choice: number }[]): Promise<PlacementResult> {
    return this.#post("/placement", { answers });
  }

  sprintQuiz(sprint: number): Promise<SprintQuiz> {
    return this.#request(`/plan/sprints/${sprint}/quiz`);
  }

  takeSprintQuiz(sprint: number, answers: Readonly<Record<string, string>>): Promise<SprintQuizResult> {
    return this.#post(`/plan/sprints/${sprint}/quiz`, { answers });
  }

  sprintNotes(sprint: number): Promise<{ readonly sprint: number; readonly items: readonly { readonly kind: "problem" | "lesson"; readonly slug: string; readonly title: string; readonly note: string | null }[] }> {
    return this.#request(`/plan/sprints/${sprint}/notes`);
  }

  reminders(): Promise<{ readonly enabled: boolean; readonly hour: number; readonly email: boolean; readonly push: boolean; readonly devices: number }> {
    return this.#request("/reminders");
  }

  async pushKey(): Promise<string | null> {
    return (await this.#request<{ key: string | null }>("/push/key")).key;
  }

  /** A browser's push subscription, as `PushSubscription.toJSON()` gives it. */
  subscribePush(subscription: { readonly endpoint: string; readonly keys: { readonly p256dh: string; readonly auth: string } }): Promise<{ readonly devices: number }> {
    return this.#post("/push", { endpoint: subscription.endpoint, keys: subscription.keys });
  }

  unsubscribePush(endpoint: string): Promise<{ readonly devices: number }> {
    return this.#request("/push", { method: "DELETE", body: JSON.stringify({ endpoint }) });
  }

  saveReminders(prefs: { readonly enabled: boolean; readonly hour: number }): Promise<{ readonly enabled: boolean; readonly hour: number }> {
    return this.#request("/reminders", { method: "PUT", body: JSON.stringify(prefs) });
  }

  /** My classes (plan row 96): empty, with verified false, until my address is confirmed. */
  myClasses(): Promise<{ readonly verified: boolean; readonly classes: readonly MyClass[] }> {
    return this.#request("/classes");
  }

  myLab(classId: string): Promise<LabRecord> {
    return this.#request(`/classes/${encodeURIComponent(classId)}/lab`);
  }

  async myLabPdf(classId: string): Promise<Blob> {
    const response = await fetch(`${this.#base}/classes/${encodeURIComponent(classId)}/lab.pdf`, {
      headers: this.#token === null ? {} : { authorization: `Bearer ${this.#token}` },
    });
    if (!response.ok) throw new ApiError(response.status, "request_failed", {});
    return response.blob();
  }

  turnOffReminders(token: string): Promise<{ readonly off: true }> {
    return this.#post("/reminders/off", { token });
  }

  startTrial(): Promise<{ readonly active: boolean; readonly until: string | null }> {
    return this.#post("/plus/trial", {});
  }

  quote(productId: string, coupon: string): Promise<Quote> {
    return this.#post("/plus/quote", { productId, coupon });
  }

  invoice(number: string): Promise<InvoiceView> {
    return this.#request(`/invoices/${encodeURIComponent(number)}`);
  }

  confirmPayment(orderId: string, paymentId: string, signature: string): Promise<{ readonly order: PlusOrder; readonly plus: { readonly active: boolean; readonly until: string | null } }> {
    return this.#post("/plus/confirm", { orderId, paymentId, signature });
  }

  async orders(): Promise<readonly PlusOrder[]> {
    return (await this.#request<{ orders: PlusOrder[] }>("/orders")).orders;
  }

  credits(): Promise<Credits> {
    return this.#request("/credits");
  }

  tutor(slug: string): Promise<TutorHistory> {
    return this.#request(`/problems/${encodeURIComponent(slug)}/tutor`);
  }

  hint(slug: string, replyIn: "en" | "hi", code?: { readonly language: string; readonly source: string }): Promise<TutorAnswer> {
    return this.#post(`/problems/${encodeURIComponent(slug)}/tutor/hint`, { replyIn, ...(code === undefined ? {} : { code: code.source, language: code.language }) });
  }

  followups(slug: string, replyIn: "en" | "hi"): Promise<TutorAnswer> {
    return this.#post(`/problems/${encodeURIComponent(slug)}/tutor/followups`, { replyIn });
  }

  replyToFollowup(slug: string, id: string, question: number, answer: string, replyIn: "en" | "hi"): Promise<TutorAnswer> {
    return this.#post(`/problems/${encodeURIComponent(slug)}/tutor/followups/${encodeURIComponent(id)}/reply`, { question, answer, replyIn });
  }

  review(slug: string, replyIn: "en" | "hi"): Promise<TutorAnswer> {
    return this.#post(`/problems/${encodeURIComponent(slug)}/tutor/review`, { replyIn });
  }

  /** Sahayak's draft of a revision note: not saved until the learner saves it. */
  notesDraft(about: { readonly problem?: string; readonly lesson?: string }, replyIn: "en" | "hi"): Promise<TutorAnswer> {
    return this.#post("/tutor/notes", { ...about, replyIn });
  }

  noteBook(track: string): Promise<NoteBook> {
    return this.#request(`/notes/book?track=${encodeURIComponent(track)}`);
  }

  doubt(about: { readonly problem?: string; readonly lesson?: string }, question: string, replyIn: "en" | "hi"): Promise<TutorAnswer> {
    return this.#post("/tutor/doubt", { ...about, question, replyIn });
  }

  async forgetTutor(slug?: string): Promise<number> {
    return (await this.#request<{ deleted: number }>(`/tutor${slug === undefined ? "" : `?problem=${encodeURIComponent(slug)}`}`, { method: "DELETE" })).deleted;
  }

  async coinLeaders(): Promise<readonly (Person & { readonly rank: number; readonly name: string; readonly coins: number; readonly you: boolean })[]> {
    return (await this.#request<{ leaders: (Person & { rank: number; name: string; coins: number; you: boolean })[] }>("/coins/leaders")).leaders;
  }

  // --- companies, experiences, the store, ratings ------------------------------------------------

  async companies(): Promise<readonly CompanyCard[]> {
    return (await this.#request<{ companies: CompanyCard[] }>("/companies")).companies;
  }

  company(slug: string, window: CompanyWindow): Promise<CompanyPage> {
    return this.#request(`/companies/${encodeURIComponent(slug)}?window=${window}`);
  }

  async targets(): Promise<readonly CompanyTarget[]> {
    return (await this.#request<{ targets: CompanyTarget[] }>("/companies/targets")).targets;
  }

  async setTarget(slug: string, on: boolean): Promise<void> {
    await this.#request(`/companies/${encodeURIComponent(slug)}/target`, { method: "PUT", body: JSON.stringify({ on }) });
  }

  startCompanyList(slug: string): Promise<{ readonly list: string; readonly added: number; readonly locked: number }> {
    return this.#post(`/companies/${encodeURIComponent(slug)}/start`);
  }

  async experiences(company?: string): Promise<readonly InterviewExperience[]> {
    return (await this.#request<{ experiences: InterviewExperience[] }>(`/experiences${company === undefined ? "" : `?company=${encodeURIComponent(company)}`}`)).experiences;
  }

  shareExperience(draft: ExperienceDraft): Promise<InterviewExperience> {
    return this.#post("/experiences", draft);
  }

  flagExperience(id: string, reason: FlagReason, note: string): Promise<{ readonly flagged: true; readonly held: boolean }> {
    return this.#post(`/experiences/${encodeURIComponent(id)}/flag`, { reason, note });
  }

  async stories(): Promise<readonly SuccessStory[]> {
    return (await this.#request<{ stories: SuccessStory[] }>("/stories")).stories;
  }

  shareStory(story: { readonly company: string; readonly role: string; readonly story: string; readonly anonymous: boolean }): Promise<SuccessStory> {
    return this.#post("/stories", story);
  }

  async vote(id: string, on: boolean): Promise<void> {
    await this.#request(`/experiences/${encodeURIComponent(id)}/vote`, { method: on ? "PUT" : "DELETE" });
  }

  coinStore(): Promise<CoinStore> {
    return this.#request("/store");
  }

  redeem(itemId: string, address: string): Promise<{ readonly order: StoreOrder; readonly balance: number }> {
    return this.#post(`/store/${encodeURIComponent(itemId)}/redeem`, { address });
  }

  rating(): Promise<RatingView> {
    return this.#request("/rating");
  }

  profile(): Promise<MyProfile> {
    return this.#request("/profile");
  }

  saveProfile(profile: { readonly username: string; readonly public: boolean; readonly bio: string }): Promise<MyProfile> {
    return this.#request("/profile", { method: "PUT", body: JSON.stringify(profile) });
  }

  publicProfile(username: string): Promise<PublicProfile> {
    return this.#request(`/u/${encodeURIComponent(username)}`);
  }

  /** An achievement's card, as an SVG image. */
  async card(achievement: string, format: "story" | "square", lang: "en" | "hi"): Promise<Blob> {
    const response = await fetch(`${this.#base}/achievements/${encodeURIComponent(achievement)}/card?format=${format}&lang=${lang}`, {
      headers: this.#token === null ? {} : { authorization: `Bearer ${this.#token}` },
    });
    if (!response.ok) throw new ApiError(response.status, "request_failed", {});
    return response.blob();
  }
}

const contestQuery = (contest: string | undefined) => (contest === undefined ? "" : `?contest=${encodeURIComponent(contest)}`);

/** A practice verdict as the coding workspace shows a submission. */
export function asSubmitOutcome(verdict: Verdict): SubmitOutcome {
  if (verdict.status === "compile_error") return { tested: true, compiled: false, compileOutput: verdict.compileOutput ?? "" };
  return { tested: true, compiled: true, passed: verdict.passed, total: verdict.total, cases: verdict.cases };
}

// --- prep types ----------------------------------------------------------------------------

export interface Reward {
  readonly coins: number;
  readonly reasons: readonly string[];
}

export interface TrackSummary {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly modules: number;
  readonly items: number;
  readonly done: number;
}

export interface TrackItem {
  readonly kind: "problem" | "lesson";
  readonly slug: string;
  readonly title: string;
  readonly difficulty: Difficulty | null;
  readonly estMinutes: number;
  readonly status: "done" | "attempted" | null;
  /** Needs Plus, which this learner does not hold. */
  readonly locked: boolean;
}

export interface TrackView {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly items: number;
  readonly done: number;
  readonly modules: readonly { readonly title: string; readonly done: number; readonly items: readonly TrackItem[] }[];
}

export interface Lesson {
  readonly slug: string;
  readonly title: string;
  readonly body: string;
  readonly videoUrl: string | null;
  readonly estMinutes: number;
  readonly done: boolean;
  readonly locked: boolean;
  /** Questions checked at once, asked without their answers. */
  readonly quiz: readonly { readonly slug: string; readonly title: string; readonly question: CandidateQuestion }[];
}

export interface QuizResult {
  readonly score: number;
  readonly total: number;
  readonly results: readonly { readonly slug: string; readonly right: boolean; readonly answer: string; readonly explanation: string }[];
  /** Wrong answers now due for revision. */
  readonly revise: number;
}

export interface MyShare {
  readonly id: string;
  readonly path: string;
  readonly problem: { readonly slug: string; readonly title: string } | null;
  readonly language: string;
  readonly createdAt: string;
}

export interface SharedCode {
  readonly problem: { readonly slug: string; readonly title: string } | null;
  readonly author: string;
  readonly language: string;
  readonly source: string;
  readonly createdAt: string;
}

export type Level = "beginner" | "intermediate" | "advanced";

export interface PlacementQuestion {
  readonly id: string;
  readonly level: "easy" | "medium" | "hard";
  readonly topic: string;
  readonly text: string;
  readonly options: readonly string[];
}

export interface PlacementResult {
  readonly score: number;
  readonly of: number;
  readonly level: Level;
  readonly results: readonly { readonly id: string; readonly choice: number; readonly correct: number; readonly right: boolean; readonly why: string }[];
}

export type PrepRole = "sde" | "backend" | "frontend" | "data";
export const PREP_ROLES: readonly PrepRole[] = ["sde", "backend", "frontend", "data"];

export interface PlanInput {
  readonly track: string;
  readonly level: Level;
  readonly deadline: string;
  readonly dailyMinutes: number;
  /** Minutes on Saturday and Sunday, when they differ; null or absent when they do not. */
  readonly weekendMinutes?: number | null;
  readonly offDays: readonly number[];
  readonly goal?: string;
  /** The job aimed at: its topics come first. */
  readonly role?: PrepRole | null;
  /** Plan only the first this many of the track's remaining items. */
  readonly upTo?: number;
}

/** What may change in a running plan. */
export interface PlanChange {
  readonly deadline?: string;
  readonly dailyMinutes?: number;
  readonly weekendMinutes?: number | null;
  readonly offDays?: readonly number[];
}

export interface Sprint {
  readonly sprint: number;
  readonly from: string;
  readonly to: string;
  readonly tasks: number;
  readonly done: number;
}

export interface PlanPreview {
  readonly track: { readonly slug: string; readonly title: string };
  readonly tasks: number;
  readonly totalMinutes: number;
  readonly finishOn: string;
  readonly deadline: string;
  readonly fits: boolean;
  readonly sprints: readonly Sprint[];
  readonly dailyMinutesToFit: number | null;
  /** When it does not fit: how many of the remaining items the deadline holds. */
  readonly itemsThatFit: { readonly items: number; readonly of: number } | null;
}

export interface PlanTask {
  readonly id: string;
  readonly day: string;
  readonly sprint: number;
  readonly kind: "learn" | "practice" | "revise" | "custom";
  readonly title: string;
  readonly estMinutes: number;
  readonly done: boolean;
  readonly movedFrom: string | null;
  readonly link: { readonly kind: "problem" | "lesson"; readonly slug: string } | null;
  readonly difficulty: Difficulty | null;
}

export interface Plan {
  readonly track: { readonly slug: string; readonly title: string };
  readonly level: Level;
  readonly deadline: string;
  readonly dailyMinutes: number;
  readonly weekendMinutes: number | null;
  readonly offDays: readonly number[];
  readonly goal: string;
  readonly role: PrepRole | null;
  readonly startedAt: string;
  readonly finishOn: string;
  readonly onTrack: boolean;
  readonly daysLeft: number;
  readonly studyDaysLeft: number;
  readonly done: number;
  readonly total: number;
  readonly sprint: number;
  readonly sprints: readonly Sprint[];
  readonly moved: number;
  readonly today: readonly PlanTask[];
  readonly upcoming: readonly PlanTask[];
  readonly completed: readonly PlanTask[];
}

export interface PotdDay {
  readonly day: string;
  readonly slug: string;
  readonly title: string;
  readonly difficulty: Difficulty;
  readonly solved: boolean;
  readonly solvedThatDay: boolean;
}

export interface Home {
  readonly name: string;
  readonly today: string;
  readonly streak: number;
  readonly longestStreak: number;
  readonly coins: number;
  readonly checkin: number;
  readonly dueCards: number;
  readonly focusMinutesToday: number;
  readonly potd: PotdDay | null;
  readonly plan: Pick<Plan, "track" | "startedAt" | "finishOn" | "deadline" | "sprint" | "sprints" | "today" | "moved"> | null;
  readonly continue: {
    readonly slug: string;
    readonly title: string;
    readonly items: number;
    readonly done: number;
    readonly next: { readonly kind: "problem" | "lesson"; readonly slug: string; readonly title: string } | null;
  } | null;
  readonly solved: number;
  /** Today was taken off. */
  readonly frozenToday: boolean;
  /** Days off left this month. */
  readonly freezesLeft: number;
}

/** A sprint's quiz: the sprint's choice and number questions, once the sprint is done. */
export interface SprintQuiz {
  readonly sprint: number;
  readonly open: boolean;
  readonly passPercent: number;
  readonly questions: readonly { readonly slug: string; readonly title: string; readonly question: { readonly kind: string; readonly stem: string; readonly options?: readonly string[] } }[];
  readonly count: number;
  readonly sittings: readonly { readonly score: number; readonly total: number; readonly passed: boolean; readonly takenAt: string }[];
}

export interface SprintQuizResult {
  readonly score: number;
  readonly total: number;
  readonly passed: boolean;
  readonly wrong: readonly string[];
  readonly revise: number;
  readonly reward: Reward;
}

export type Grade = "again" | "hard" | "good" | "easy";

export interface Revision {
  readonly due: readonly {
    readonly slug: string;
    readonly title: string;
    readonly difficulty: Difficulty;
    readonly tags: readonly string[];
    readonly dueOn: string;
    readonly lastReviewedAt: string | null;
    readonly reps: number;
    readonly note: string | null;
  }[];
  readonly later: number;
  readonly upcoming: number;
}

export interface ProblemList {
  readonly name: string;
  readonly solved: number;
  readonly problems: readonly { readonly slug: string; readonly title: string; readonly difficulty: Difficulty; readonly solved: boolean }[];
}

export type NoteKind = "problem" | "lesson" | "topic";

export interface Note {
  readonly kind: NoteKind;
  readonly ref: string;
  readonly title: string;
  readonly body: string;
  readonly updatedAt: string | null;
}

export interface Coins {
  readonly balance: number;
  readonly dailyCap: number;
  readonly history: readonly { readonly rule: string; readonly amount: number; readonly at: string }[];
}

export interface PlusProduct {
  readonly id: string;
  readonly title: string;
  readonly kind: "plus" | "company" | "credits" | "dsa";
  readonly days: number;
  readonly credits: number;
  readonly pricePaise: number;
  /** The GST within the price. */
  readonly taxPaise: number;
}

/** Who the invoice is made out to, and a coupon. */
export interface Billing {
  readonly coupon?: string | undefined;
  readonly name?: string | undefined;
  readonly stateCode?: string | undefined;
  readonly gstin?: string | undefined;
}

export interface Quote {
  readonly productId: string;
  readonly title: string;
  readonly listPaise: number;
  readonly discountPaise: number;
  readonly pricePaise: number;
  readonly taxPaise: number;
  readonly coupon: string | null;
}

/** A tax invoice as it was issued: the document is printed as it stands. */
export interface InvoiceView {
  readonly number: string;
  readonly issuedAt: string;
  readonly document: InvoiceDocument;
}

export interface InvoiceDocument {
  readonly title: string;
  readonly number: string;
  readonly date: string;
  readonly supplier: { readonly legalName: string; readonly gstin: string; readonly address: string; readonly state: string; readonly sac: string };
  readonly buyer: { readonly legalName: string; readonly gstin: string | null; readonly state: string | null };
  readonly placeOfSupply: { readonly code: string; readonly state: string };
  readonly lines: readonly { readonly description: string; readonly quantity: number; readonly sac: string; readonly amountPaise: number }[];
  readonly taxablePaise: number;
  readonly taxes: readonly { readonly name: string; readonly ratePercent: number; readonly amountPaise: number }[];
  readonly totalPaise: number;
  readonly totalInWords: string;
  readonly note?: string;
}

export interface PlusOverview {
  readonly enabled: boolean;
  readonly active: boolean;
  readonly until: string | null;
  /** Without Plus: when the learner's DSA Pass ends, if they hold one. */
  readonly dsaUntil: string | null;
  /** Days of free Plus this learner may start now; 0 for none. */
  readonly trialDays: number;
  readonly freeModules: number;
  readonly monthlyCredits: number;
  readonly tutor: boolean;
  readonly checkout: boolean;
  /** Paid orders get a GST tax invoice. */
  readonly invoices: boolean;
  readonly products: readonly PlusProduct[];
}

export interface CheckoutOrder {
  readonly keyId: string;
  readonly orderId: string;
  readonly amountPaise: number;
  readonly title: string;
  readonly learner: { readonly name: string; readonly email: string };
}

export interface PlusOrder {
  readonly id: string;
  readonly title: string;
  readonly days: number;
  readonly credits: number;
  readonly listPaise: number;
  readonly coupon: string | null;
  readonly discountPaise: number;
  readonly amountPaise: number;
  readonly taxPaise: number;
  readonly status: "created" | "paid" | "refunded";
  readonly createdAt: string;
  readonly paidAt: string | null;
  readonly refundedAt: string | null;
  readonly invoice: string | null;
  readonly creditNote: string | null;
}

export interface Credits {
  readonly balance: number;
  readonly history: readonly { readonly delta: number; readonly reason: "monthly" | "purchase" | "grant" | "spend" | "refund" | "order_refund"; readonly at: string }[];
}

export interface TutorAnswer {
  readonly id: string;
  readonly mode: "hint" | "review" | "doubt" | "notes" | "followup" | "followup_reply";
  readonly hintLevel: number | null;
  readonly answer: string;
  readonly credits: number;
  readonly createdAt: string;
  /** A review's findings, follow-up questions ({ questions }), or a reply's verdict; null for the rest. */
  readonly data?: Record<string, unknown> | null;
}

export interface TutorHistory {
  readonly entries: readonly (TutorAnswer & { readonly question: string })[];
  readonly nextHint: { readonly level: number; readonly credits: number; readonly available: boolean } | null;
  readonly failures: number;
  readonly costs: { readonly hint1: number; readonly hint: number; readonly review: number; readonly doubt: number; readonly followup?: number; readonly followupReply?: number };
}

// --- companies, experiences, the store, ratings ------------------------------------------------

export type CompanyWindow = "30" | "60" | "180" | "all";

export interface CompanyCard {
  readonly slug: string;
  readonly name: string;
  /** Problems asked in the last 180 days. */
  readonly problems: number;
  readonly experiences: number;
  /** The company's logo's address; null without one. */
  readonly logo?: string | null;
}

export interface Readiness {
  readonly solved: number;
  readonly of: number;
  readonly percent: number;
}

/** A track's notes, module by module, to print. */
export interface NoteBook {
  readonly track: { readonly slug: string; readonly title: string };
  readonly modules: readonly { readonly title: string; readonly notes: readonly { readonly kind: "problem" | "lesson"; readonly slug: string; readonly title: string; readonly body: string }[] }[];
  readonly topics: readonly { readonly title: string; readonly body: string }[];
}

export interface CompanyTarget {
  readonly slug: string;
  readonly name: string;
  readonly readiness: Readiness;
}

export interface InterviewRound {
  readonly kind: string;
  readonly asked: string;
  readonly problemSlugs: readonly string[];
  /** The round's problems still on the site, by title: as the site sends them back. */
  readonly problems?: readonly { readonly slug: string; readonly title: string }[];
}

export interface InterviewExperience {
  readonly id: string;
  readonly company: { readonly slug: string; readonly name: string };
  readonly role: string;
  readonly interviewed: string;
  readonly verdict: "offer" | "reject" | "waiting";
  readonly rounds: readonly InterviewRound[];
  readonly tips: string;
  readonly author: string;
  readonly status: "pending" | "published" | "rejected" | "held";
  readonly votes: number;
  readonly voted: boolean;
  /** This learner has flagged it. */
  readonly flagged?: boolean;
  readonly mine: boolean;
  readonly at: string;
}

export type FlagReason = "fake" | "offensive" | "wrong_company" | "other";

export interface SuccessStory {
  readonly id: string;
  readonly company: string;
  readonly role: string;
  readonly story: string;
  readonly author: string;
  readonly status: "pending" | "published" | "rejected";
  readonly mine: boolean;
  readonly at: string;
}

export interface ExperienceDraft {
  readonly company: string;
  readonly role: string;
  readonly interviewed: string;
  readonly verdict: InterviewExperience["verdict"];
  readonly rounds: readonly InterviewRound[];
  readonly tips: string;
  readonly anonymous: boolean;
}

export interface CompanyPage {
  readonly slug: string;
  readonly name: string;
  readonly about: string;
  readonly window: string;
  readonly counts: Readonly<Record<string, number>>;
  readonly problems: readonly {
    readonly slug: string;
    readonly title: string;
    readonly difficulty: Difficulty;
    readonly tags: readonly string[];
    readonly times: number;
    readonly lastAsked: string;
    readonly solved: boolean;
  }[];
  /** More problems in the window, which come with Plus or a Company Pass. */
  readonly locked: number;
  /** Signed in: of the 50 most asked in the last 180 days, how many are solved. */
  readonly readiness: Readiness | null;
  readonly target: boolean;
  readonly topics: readonly { readonly tag: string; readonly problems: number }[];
  /** The ideas behind the tags, with how many of each the learner has solved. */
  readonly patterns?: readonly { readonly pattern: string; readonly problems: number; readonly solved: number }[];
  readonly logo?: string | null;
  readonly difficulty: { readonly easy: number; readonly medium: number; readonly hard: number };
  readonly experiences: readonly InterviewExperience[];
}

export interface StoreOrder {
  readonly id: string;
  readonly title: string;
  readonly priceCoins: number;
  readonly status: "placed" | "fulfilled" | "cancelled";
  readonly note: string;
  readonly createdAt: string;
  readonly closedAt: string | null;
}

export interface CoinStore {
  readonly balance: number;
  readonly opensAt: string | null;
  readonly items: readonly {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly kind: "plus" | "coupon" | "digital" | "physical";
    readonly plusDays: number;
    readonly couponPercent: number;
    readonly perMonth: number | null;
    readonly priceCoins: number;
    readonly soldOut: boolean;
    readonly left: number | null;
    readonly bought: number;
    readonly perLearner: number;
  }[];
  readonly orders: readonly StoreOrder[];
}

export interface Achievement {
  readonly id: string;
  readonly have: number;
  readonly need: number;
  readonly earned: boolean;
}

export interface MyProfile {
  readonly username: string | null;
  readonly public: boolean;
  readonly bio: string;
}

export interface PublicProfile {
  readonly username: string;
  readonly name: string;
  readonly bio: string;
  readonly joinedAt: string;
  readonly title: string;
  readonly rating: number | null;
  readonly contests: readonly { readonly contest: string; readonly slug: string; readonly rank: number; readonly field: number; readonly before: number; readonly after: number; readonly at: string }[];
  readonly solved: { readonly easy: number; readonly medium: number; readonly hard: number };
  readonly streak: { readonly current: number; readonly longest: number };
  readonly achievements: readonly string[];
  readonly url: string;
}

export interface RatingView {
  readonly board: readonly { readonly rank: number; readonly name: string; readonly rating: number; readonly title: string; readonly contests: number; readonly you: boolean }[];
  readonly me: {
    readonly rating: number | null;
    readonly title: string;
    readonly contests: number;
    readonly history: readonly { readonly contest: string; readonly slug: string; readonly rank: number; readonly field: number; readonly before: number; readonly after: number; readonly at: string }[];
    readonly achievements: readonly Achievement[];
  } | null;
}
