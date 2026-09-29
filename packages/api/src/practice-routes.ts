import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Learner, PracticeSite } from "@parikshaa/store";
import type { PracticeService } from "./practice.js";
import type { PracticeIdentity } from "./practice-identity.js";
import type { PrepService } from "./prep.js";
import { reward } from "./prep-routes.js";
import * as S from "./schemas.js";
import type { ExamService } from "./service.js";
import { RateLimiter } from "./rate-limit.js";
import type { Actor, LoginThrottle, Permission } from "./staff-auth.js";

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface PracticeRouteDeps {
  readonly practice: PracticeService;
  readonly service: ExamService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
  readonly bearer: (request: FastifyRequest) => string | null;
  /** Shared with staff sign-in: repeated failures from one address for one account are refused for a while. */
  readonly throttle: LoginThrottle;
  /** Email verification and Google sign-in. Absent: neither. */
  readonly identity?: PracticeIdentity;
  /** What a solve earns: coins, a revision card, a plan task done. Absent: nothing more. */
  readonly prep?: PrepService;
}

/** Accounts made from one address: enough for a lab full of students, not for a script. */
const SIGNUPS = { perSecond: 1 / 6, burst: 20 };

const PRACTICE = ["Practice"];
const ADMIN = ["Practice (staff)"];
const LEARNER = [{ learnerAuth: [] }];
const OPEN: { learnerAuth: never[] }[] = [];
const STAFF = [{ staffAuth: [] }];
const refusals = { 400: S.errorResponse, 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 422: S.errorResponse, 429: S.errorResponse, 503: S.errorResponse } as const;

// --- schemas ------------------------------------------------------------------------

const difficulty = z.enum(["easy", "medium", "hard"]);
const siteParams = z.object({ site: z.string().min(1).max(40) });
const problemParams = siteParams.extend({ problem: z.string().min(1).max(80) });
const contestParams = siteParams.extend({ contest: z.string().min(1).max(80) });
const contestQuery = z.object({ contest: z.string().min(1).max(80).optional() });

const learnerView = z.object({ id: z.string(), name: z.string(), email: z.string(), emailVerified: z.boolean() });
const session = z.object({ token: z.string(), expiresAt: z.string(), learner: learnerView });
const siteView = z.object({ slug: z.string(), title: z.string(), welcome: z.string().describe("Markdown.") });
const status = z.enum(["solved", "attempted"]).nullable();

const problemListItem = z.object({
  slug: z.string(),
  title: z.string(),
  difficulty,
  tags: z.array(z.string()).readonly(),
  kind: z.enum(["mcq", "short", "numeric", "code"]),
  acceptance: z.number().nullable().describe("Share of submissions accepted, 0 to 1."),
  solvedBy: z.number(),
  status,
});

const problemView = z.object({
  slug: z.string(),
  title: z.string(),
  difficulty,
  tags: z.array(z.string()).readonly(),
  question: S.candidateQuestion.describe("The question as a candidate sees it: no answer key, no hidden test."),
  editorial: z.string().nullable().describe("Markdown; null until solved, or tried enough times, and never during a contest."),
  editorialLocked: z.boolean(),
  acceptance: z.number().nullable(),
  solvedBy: z.number(),
  status,
  contest: z.object({ slug: z.string(), title: z.string(), endsAt: z.string() }).nullable(),
});

const runBody = z.object({
  language: z.string().min(1),
  source: z.string().max(256 * 1024),
  input: z.string().max(1024 * 1024).optional(),
  contest: z.string().max(80).optional(),
});

const submitBody = z.object({
  answer: z.string().max(256 * 1024).describe("The source for code; an option's position, or several comma-separated, or a number."),
  language: z.string().min(1).optional(),
  contest: z.string().max(80).optional(),
});

const testStatus = z.string().describe("passed, wrong_answer, time_limit, memory_limit, runtime_error, output_limit, checker_error or compile_error.");

const verdict = z.object({
  status: testStatus,
  passed: z.number(),
  total: z.number(),
  compileOutput: z.string().nullable(),
  timeMs: z.number().nullable(),
  memoryKb: z.number().nullable(),
  cases: z
    .array(
      z.object({
        number: z.number(),
        visible: z.boolean(),
        status: testStatus,
        timeMs: z.number(),
        memoryKb: z.number().nullable(),
        input: z.string().nullable().describe("Null for a hidden test: its content never leaves the server."),
        expectedOutput: z.string().nullable(),
        stdout: z.string().nullable(),
        result: z.string().nullable(),
        stderr: z.string().nullable(),
      }),
    )
    .readonly(),
  submissionId: z.string(),
  firstSolve: z.boolean(),
  reward: reward.optional(),
});

const submission = z.object({
  id: z.string(),
  language: z.string().nullable(),
  answer: z.string(),
  status: z.string(),
  passed: z.number(),
  total: z.number(),
  timeMs: z.number().nullable(),
  memoryKb: z.number().nullable(),
  createdAt: z.string(),
  inContest: z.boolean(),
});

const comment = z.object({ id: z.string(), authorName: z.string(), fromStaff: z.boolean(), body: z.string(), createdAt: z.string() });

const counts = z.object({ easy: z.number(), medium: z.number(), hard: z.number(), total: z.number() });
const progress = z.object({
  solved: counts,
  available: counts,
  streak: z.number().describe("Consecutive days, ending today or yesterday (IST), with an accepted submission."),
  longestStreak: z.number(),
  activeDays: z.number(),
  days: z.array(z.object({ day: z.string(), accepted: z.number(), submitted: z.number() })).readonly(),
  recent: z.array(z.object({ slug: z.string(), title: z.string(), at: z.string() })).readonly(),
  rank: z.number().nullable(),
});

const contestState = z.enum(["upcoming", "running", "ended"]);
const contestSummary = z.object({ slug: z.string(), title: z.string(), startsAt: z.string(), endsAt: z.string(), problems: z.number(), state: contestState });
const contestView = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  state: contestState,
  problems: z.array(z.object({ label: z.string(), slug: z.string(), title: z.string(), difficulty, status })).readonly().describe("Empty until the contest starts."),
  scoreboard: z
    .array(
      z.object({
        rank: z.number(),
        name: z.string(),
        solved: z.number(),
        penalty: z.number().describe("Minutes to each accepted answer, plus 20 for every wrong one before it."),
        problems: z.array(z.object({ minutes: z.number().nullable(), wrong: z.number() })).readonly(),
        you: z.boolean(),
      }),
    )
    .readonly(),
});

// staff
const siteBody = z.object({ slug: z.string(), title: z.string(), welcome: z.string().max(20_000), open: z.boolean() });
const staffSite = siteBody.nullable();
const staffProblem = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  question: S.questionSchema,
  difficulty,
  tags: z.array(z.string()).readonly(),
  editorial: z.string(),
  fromBank: z.string().nullable(),
  position: z.number(),
  published: z.boolean(),
  updatedAt: z.string(),
  submissions: z.number(),
  solvedBy: z.number(),
});
const publishBody = z.object({
  bankQuestionId: z.string().min(1),
  title: z.string().min(1).max(160).optional(),
  slug: z.string().optional(),
  difficulty: difficulty.optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  editorial: z.string().max(50_000).optional(),
  published: z.boolean().optional(),
});
const problemPatch = z.object({
  title: z.string().min(1).max(160).optional(),
  slug: z.string().optional(),
  difficulty: difficulty.optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  editorial: z.string().max(50_000).optional(),
  published: z.boolean().optional(),
  position: z.number().int().optional(),
});
const contestBody = z.object({
  title: z.string().min(1).max(160),
  slug: z.string().optional(),
  description: z.string().max(20_000),
  startsAt: z.string(),
  endsAt: z.string(),
  problemIds: z.array(z.string()).min(1).max(26),
});
const staffContest = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  problemIds: z.array(z.string()).readonly(),
  state: contestState,
});
const idParams = z.object({ id: z.string().min(1) });
const staffComment = z.object({
  id: z.string(),
  problemId: z.string(),
  problemTitle: z.string(),
  problemSlug: z.string(),
  authorName: z.string(),
  fromStaff: z.boolean(),
  body: z.string(),
  createdAt: z.string(),
  hidden: z.boolean(),
});

/**
 * Practice sites (ROADMAP §15): the learner's routes under `/practice/<site>`,
 * and the staff's under `/practice-admin`.
 */
export function registerPracticeRoutes(routes: Routes, deps: PracticeRouteDeps): void {
  const { practice, service, staff, bearer, throttle, identity, prep } = deps;
  const signups = new RateLimiter(SIGNUPS);
  const tooMany = (reply: FastifyReply) => reply.code(429).send({ error: "too_many_attempts", message: "Try again in a few minutes" });

  const siteOf = async (request: FastifyRequest): Promise<PracticeSite> => {
    const site = await practice.site((request.params as { site: string }).site);
    request.orgId = site.orgId;
    return site;
  };

  /** The signed-in learner, or a 401 sent and null. */
  const learnerOf = async (site: PracticeSite, request: FastifyRequest, reply: FastifyReply): Promise<Learner | null> => {
    const learner = await practice.learner(site, bearer(request) ?? undefined);
    if (learner === null) await reply.code(401).send({ error: "sign_in_required", message: "Sign in to do that" });
    return learner;
  };
  const maybeLearner = (site: PracticeSite, request: FastifyRequest) => practice.learner(site, bearer(request) ?? undefined);

  // --- the learner ----------------------------------------------------------------------

  routes.get("/practice/:site", { schema: { tags: PRACTICE, summary: "A practice site", security: OPEN, params: siteParams, response: { 200: siteView, ...refusals } } }, async (request, reply) => {
    const site = await siteOf(request);
    return reply.send({ slug: site.slug, title: site.title, welcome: site.welcome });
  });

  routes.post(
    "/practice/:site/signup",
    {
      schema: {
        tags: PRACTICE,
        summary: "Create a learner account on this site",
        security: OPEN,
        params: siteParams,
        body: z.object({ name: z.string().max(80), email: z.string().max(200), password: z.string().max(200) }),
        response: { 201: session, ...refusals },
      },
    },
    async (request, reply) => {
      await siteOf(request);
      if (!signups.take(request.ip).ok) return tooMany(reply);
      const created = await practice.signUp(request.params.site, request.body);
      await identity?.sendVerification(created.learner);
      return reply.code(201).send(created);
    },
  );

  routes.post(
    "/practice/:site/signin",
    {
      schema: {
        tags: PRACTICE,
        summary: "Sign in",
        security: OPEN,
        params: siteParams,
        body: z.object({ email: z.string().max(200), password: z.string().max(200) }),
        response: { 200: session, ...refusals },
      },
    },
    async (request, reply) => {
      await siteOf(request);
      const account = `practice:${request.params.site}:${request.body.email}`;
      if (throttle.blocked(request.ip, account)) return tooMany(reply);
      const result = await practice.signIn(request.params.site, request.body.email, request.body.password);
      if (result === null) {
        throttle.failed(request.ip, account);
        return reply.code(401).send({ error: "sign_in_failed", message: "That email and password do not match an account here" });
      }
      return reply.send(result);
    },
  );

  routes.post("/practice/:site/signout", { schema: { tags: PRACTICE, summary: "Sign out", security: LEARNER, params: siteParams, response: { 200: S.okResponse, ...refusals } } }, async (request, reply) => {
    const token = bearer(request);
    if (token !== null) await practice.signOut(token);
    return reply.send({ ok: true });
  });

  routes.get("/practice/:site/me", { schema: { tags: PRACTICE, summary: "Who is signed in", security: LEARNER, params: siteParams, response: { 200: learnerView, ...refusals } } }, async (request, reply) => {
    const site = await siteOf(request);
    const learner = await learnerOf(site, request, reply);
    if (learner === null) return;
    return reply.send({ id: learner.id, name: learner.name, email: learner.email, emailVerified: learner.emailVerified });
  });

  routes.delete(
    "/practice/:site/me",
    {
      schema: {
        tags: PRACTICE,
        summary: "Delete my account",
        description: "Name and email are removed and every session ends. Submissions stay, attributed to no one, so the site's counts do not change.",
        security: LEARNER,
        params: siteParams,
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const site = await siteOf(request);
      const learner = await learnerOf(site, request, reply);
      if (learner === null) return;
      await practice.deleteAccount(learner);
      return reply.send({ ok: true });
    },
  );

  routes.get(
    "/practice/:site/problems",
    { schema: { tags: PRACTICE, summary: "The problem set", security: OPEN, params: siteParams, response: { 200: z.object({ problems: z.array(problemListItem).readonly() }), ...refusals } } },
    async (request, reply) => {
      const site = await siteOf(request);
      return reply.send({ problems: await practice.problems(site, await maybeLearner(site, request)) });
    },
  );

  routes.get(
    "/practice/:site/problems/:problem",
    { schema: { tags: PRACTICE, summary: "One problem", security: OPEN, params: problemParams, querystring: contestQuery, response: { 200: problemView, ...refusals } } },
    async (request, reply) => {
      const site = await siteOf(request);
      return reply.send(await practice.problem(site, request.params.problem, await maybeLearner(site, request), request.query.contest));
    },
  );

  routes.post(
    "/practice/:site/problems/:problem/run",
    {
      schema: {
        tags: PRACTICE,
        summary: "Run code on the examples, or on input of the learner's own",
        description: "Hidden tests are never run on request. Nothing is recorded.",
        security: LEARNER,
        params: problemParams,
        body: runBody,
        response: { 200: S.runResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const site = await siteOf(request);
      const learner = await learnerOf(site, request, reply);
      if (learner === null) return;
      const { language, source, input, contest } = request.body;
      return reply.send(await practice.run(site, learner, request.params.problem, { language, source }, input, contest));
    },
  );

  routes.post(
    "/practice/:site/problems/:problem/submit",
    {
      schema: {
        tags: PRACTICE,
        summary: "Submit an answer: judged against every test, and recorded",
        description: "A hidden test comes back as its verdict alone. During a contest that includes the problem, the submission counts on its scoreboard.",
        security: LEARNER,
        params: problemParams,
        body: submitBody,
        response: { 200: verdict, ...refusals },
      },
    },
    async (request, reply) => {
      const site = await siteOf(request);
      const learner = await learnerOf(site, request, reply);
      if (learner === null) return;
      await identity?.assertMayContribute(site, learner);
      const { answer, language, contest } = request.body;
      const judged = await practice.submit(site, learner, request.params.problem, answer, language ?? null, contest);
      if (prep === undefined) return reply.send(judged);
      return reply.send({ ...judged, reward: await prep.afterSubmit(site, learner, request.params.problem, judged) });
    },
  );

  routes.get(
    "/practice/:site/problems/:problem/submissions",
    {
      schema: {
        tags: PRACTICE,
        summary: "My submissions of a problem, newest first",
        security: LEARNER,
        params: problemParams,
        querystring: contestQuery,
        response: { 200: z.object({ submissions: z.array(submission).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const site = await siteOf(request);
      const learner = await learnerOf(site, request, reply);
      if (learner === null) return;
      const list = await practice.submissions(site, learner, request.params.problem, request.query.contest);
      return reply.send({ submissions: list.map((s) => ({ ...s, inContest: s.contestId !== null })) });
    },
  );

  routes.get(
    "/practice/:site/problems/:problem/comments",
    { schema: { tags: PRACTICE, summary: "A problem's discussion", security: OPEN, params: problemParams, response: { 200: z.object({ comments: z.array(comment).readonly() }), ...refusals } } },
    async (request, reply) => {
      const site = await siteOf(request);
      return reply.send({ comments: await practice.comments(site, request.params.problem) });
    },
  );

  routes.post(
    "/practice/:site/problems/:problem/comments",
    {
      schema: {
        tags: PRACTICE,
        summary: "Add to a problem's discussion",
        security: LEARNER,
        params: problemParams,
        body: z.object({ body: z.string().max(4000) }),
        response: { 201: comment, ...refusals },
      },
    },
    async (request, reply) => {
      const site = await siteOf(request);
      const learner = await learnerOf(site, request, reply);
      if (learner === null) return;
      await identity?.assertMayContribute(site, learner);
      return reply.code(201).send(await practice.comment(site, learner, request.params.problem, request.body.body));
    },
  );

  routes.get("/practice/:site/progress", { schema: { tags: PRACTICE, summary: "My progress: solved, streak, activity", security: LEARNER, params: siteParams, response: { 200: progress, ...refusals } } }, async (request, reply) => {
    const site = await siteOf(request);
    const learner = await learnerOf(site, request, reply);
    if (learner === null) return;
    return reply.send(await practice.progress(site, learner));
  });

  routes.get(
    "/practice/:site/leaderboard",
    {
      schema: {
        tags: PRACTICE,
        summary: "Learners by problems solved",
        security: OPEN,
        params: siteParams,
        response: { 200: z.object({ leaders: z.array(z.object({ rank: z.number(), name: z.string(), solved: z.number(), you: z.boolean() })).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const site = await siteOf(request);
      return reply.send({ leaders: await practice.leaderboard(site, await maybeLearner(site, request)) });
    },
  );

  routes.get(
    "/practice/:site/contests",
    { schema: { tags: PRACTICE, summary: "Contests: upcoming, running and past", security: OPEN, params: siteParams, response: { 200: z.object({ contests: z.array(contestSummary).readonly() }), ...refusals } } },
    async (request, reply) => {
      const site = await siteOf(request);
      return reply.send({ contests: await practice.contests(site) });
    },
  );

  routes.get(
    "/practice/:site/contests/:contest",
    { schema: { tags: PRACTICE, summary: "A contest: its problems once it starts, and its scoreboard", security: OPEN, params: contestParams, response: { 200: contestView, ...refusals } } },
    async (request, reply) => {
      const site = await siteOf(request);
      return reply.send(await practice.contest(site, request.params.contest, await maybeLearner(site, request)));
    },
  );

  // --- staff ------------------------------------------------------------------------------

  routes.get("/practice-admin/site", { schema: { tags: ADMIN, summary: "This organisation's practice site", security: STAFF, response: { 200: z.object({ site: staffSite }), ...refusals } } }, async (request, reply) => {
    const actor = await staff(request, reply, "exam:read");
    if (actor === null) return;
    const site = await practice.siteFor(actor.orgId);
    return reply.send({ site: site === null ? null : { slug: site.slug, title: site.title, welcome: site.welcome, open: site.open } });
  });

  routes.put(
    "/practice-admin/site",
    { schema: { tags: ADMIN, summary: "Open, close or rename the practice site", security: STAFF, body: siteBody, response: { 200: siteBody, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      const site = await practice.saveSite(actor.orgId, request.body);
      await service.recordAudit(actor, site.open ? "practice.site_opened" : "practice.site_saved", site.slug);
      return reply.send({ slug: site.slug, title: site.title, welcome: site.welcome, open: site.open });
    },
  );

  routes.get(
    "/practice-admin/problems",
    { schema: { tags: ADMIN, summary: "Every practice problem, answer keys included", security: STAFF, response: { 200: z.object({ problems: z.array(staffProblem).readonly() }), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read_key");
      if (actor === null) return;
      return reply.send({ problems: await practice.staffProblems(actor.orgId) });
    },
  );

  routes.post(
    "/practice-admin/problems",
    {
      schema: {
        tags: ADMIN,
        summary: "Publish a bank question as a practice problem",
        description: "The question is copied: editing the bank later changes nothing published.",
        security: STAFF,
        body: publishBody,
        response: { 201: staffProblem.omit({ submissions: true, solvedBy: true }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      const { bankQuestionId, ...rest } = request.body;
      const problem = await practice.publish(actor.orgId, {
        bankQuestionId,
        ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)),
      });
      await service.recordAudit(actor, "practice.problem_published", problem.id);
      return reply.code(201).send(problem);
    },
  );

  routes.patch(
    "/practice-admin/problems/:id",
    {
      schema: {
        tags: ADMIN,
        summary: "Edit a practice problem's title, address, difficulty, tags, editorial or visibility",
        security: STAFF,
        params: idParams,
        body: problemPatch,
        response: { 200: staffProblem.omit({ submissions: true, solvedBy: true }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      const patch = Object.fromEntries(Object.entries(request.body).filter(([, v]) => v !== undefined));
      const problem = await practice.updateProblem(actor.orgId, request.params.id, patch);
      await service.recordAudit(actor, "practice.problem_edited", problem.id);
      return reply.send(problem);
    },
  );

  routes.get(
    "/practice-admin/contests",
    { schema: { tags: ADMIN, summary: "Contests", security: STAFF, response: { 200: z.object({ contests: z.array(staffContest).readonly() }), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read");
      if (actor === null) return;
      return reply.send({ contests: await practice.staffContests(actor.orgId) });
    },
  );

  routes.post(
    "/practice-admin/contests",
    { schema: { tags: ADMIN, summary: "Schedule a contest", security: STAFF, body: contestBody, response: { 201: staffContest.omit({ state: true }), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      const { slug, ...rest } = request.body;
      const contest = await practice.saveContest(actor.orgId, null, { ...rest, ...(slug === undefined ? {} : { slug }) });
      await service.recordAudit(actor, "practice.contest_scheduled", contest.id);
      return reply.code(201).send(contest);
    },
  );

  routes.put(
    "/practice-admin/contests/:id",
    { schema: { tags: ADMIN, summary: "Change a contest", security: STAFF, params: idParams, body: contestBody, response: { 200: staffContest.omit({ state: true }), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      const { slug, ...rest } = request.body;
      const contest = await practice.saveContest(actor.orgId, request.params.id, { ...rest, ...(slug === undefined ? {} : { slug }) });
      await service.recordAudit(actor, "practice.contest_changed", contest.id);
      return reply.send(contest);
    },
  );

  routes.get(
    "/practice-admin/learners",
    {
      schema: {
        tags: ADMIN,
        summary: "The site's learners and how much each has done",
        security: STAFF,
        response: {
          200: z.object({
            learners: z
              .array(z.object({ id: z.string(), name: z.string(), email: z.string(), joinedAt: z.string(), solved: z.number(), submissions: z.number(), lastActiveAt: z.string().nullable() }))
              .readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:read");
      if (actor === null) return;
      return reply.send({ learners: await practice.learners(actor.orgId) });
    },
  );

  routes.get(
    "/practice-admin/comments",
    { schema: { tags: ADMIN, summary: "Discussion across every problem, newest first, hidden ones included", security: STAFF, response: { 200: z.object({ comments: z.array(staffComment).readonly() }), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read");
      if (actor === null) return;
      return reply.send({ comments: await practice.staffComments(actor.orgId) });
    },
  );

  routes.post(
    "/practice-admin/comments",
    {
      schema: {
        tags: ADMIN,
        summary: "Reply in a problem's discussion, as a member of staff",
        security: STAFF,
        body: z.object({ problemSlug: z.string().min(1), body: z.string().max(4000) }),
        response: { 201: z.object({ id: z.string() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      if (actor.kind !== "user") return reply.code(403).send({ error: "forbidden", message: "Replies are written by people, not API keys" });
      const c = await practice.replyAsStaff(actor.orgId, { id: actor.id, name: actor.name }, request.body.problemSlug, request.body.body);
      return reply.code(201).send({ id: c.id });
    },
  );

  routes.put(
    "/practice-admin/comments/:id",
    {
      schema: {
        tags: ADMIN,
        summary: "Hide a comment from learners, or show it again",
        security: STAFF,
        params: idParams,
        body: z.object({ hidden: z.boolean() }),
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      await practice.hideComment(actor.orgId, request.params.id, request.body.hidden);
      await service.recordAudit(actor, request.body.hidden ? "practice.comment_hidden" : "practice.comment_shown", request.params.id);
      return reply.send({ ok: true });
    },
  );
}
