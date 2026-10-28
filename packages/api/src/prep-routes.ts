import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Learner, PracticeSite } from "@parikshaa/store";
import type { PracticeService } from "./practice.js";
import type { PrepService } from "./prep.js";
import { drawPlacement, markPlacement } from "./level-quiz.js";
import * as S from "./schemas.js";
import type { ExamService } from "./service.js";
import type { Actor, Permission } from "./staff-auth.js";

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface PrepRouteDeps {
  readonly practice: PracticeService;
  readonly prep: PrepService;
  readonly service: ExamService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
  readonly bearer: (request: FastifyRequest) => string | null;
}

const PREP = ["Prep"];
const ADMIN = ["Prep (staff)"];
const LEARNER = [{ learnerAuth: [] }];
const OPEN: { learnerAuth: never[] }[] = [];
const STAFF = [{ staffAuth: [] }];
const refusals = { 400: S.errorResponse, 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 422: S.errorResponse, 429: S.errorResponse } as const;

// --- schemas --------------------------------------------------------------------------

const difficulty = z.enum(["easy", "medium", "hard"]);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("A date, YYYY-MM-DD, in India Standard Time.");
const siteParams = z.object({ site: z.string().min(1).max(40) });
const slugParam = (name: string) => siteParams.extend({ [name]: z.string().min(1).max(80) });

export const reward = z.object({ coins: z.number(), reasons: z.array(z.string()).readonly() }).describe("Coins paid for what was just done; 0 when nothing new was earned.");

const itemView = z.object({
  kind: z.enum(["problem", "lesson"]),
  slug: z.string(),
  title: z.string(),
  difficulty: difficulty.nullable(),
  estMinutes: z.number(),
  status: z.enum(["done", "attempted"]).nullable(),
  locked: z.boolean().describe("A lesson that needs Plus, for a learner who does not hold it."),
});
const trackSummary = z.object({ slug: z.string(), title: z.string(), description: z.string(), modules: z.number(), items: z.number(), done: z.number() });
const trackView = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string().describe("Markdown."),
  items: z.number(),
  done: z.number(),
  modules: z.array(z.object({ title: z.string(), done: z.number(), items: z.array(itemView).readonly() })).readonly(),
});
const lessonView = z.object({
  slug: z.string(),
  title: z.string(),
  body: z.string().describe("Markdown; empty while locked."),
  videoUrl: z.string().nullable(),
  estMinutes: z.number(),
  done: z.boolean(),
  locked: z.boolean().describe("Needs Plus, which this learner does not hold."),
  quiz: z.array(z.object({ slug: z.string(), title: z.string(), question: S.candidateQuestion })).readonly().describe("The lesson's quiz, as a candidate sees questions: no answers. Empty while locked."),
});

const taskView = z.object({
  id: z.string(),
  day,
  sprint: z.number(),
  kind: z.enum(["learn", "practice", "revise", "custom"]),
  title: z.string(),
  estMinutes: z.number(),
  done: z.boolean(),
  movedFrom: day.nullable().describe("The day it was first planned for, when it has been moved on because it was not done."),
  link: z.object({ kind: z.enum(["problem", "lesson"]), slug: z.string() }).nullable(),
  difficulty: difficulty.nullable(),
});
const sprint = z.object({ sprint: z.number(), from: day, to: day, tasks: z.number(), done: z.number() });
const planView = z.object({
  track: z.object({ slug: z.string(), title: z.string() }),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  deadline: day,
  dailyMinutes: z.number(),
  weekendMinutes: z.number().nullable(),
  offDays: z.array(z.number()).readonly(),
  goal: z.string(),
  role: z.enum(["sde", "backend", "frontend", "data"]).nullable().describe("The job the plan aims at; its topics come first."),
  startedAt: z.string(),
  finishOn: day,
  onTrack: z.boolean().describe("The last task falls on or before the deadline."),
  daysLeft: z.number(),
  studyDaysLeft: z.number(),
  done: z.number(),
  total: z.number(),
  sprint: z.number(),
  sprints: z.array(sprint).readonly(),
  moved: z.number().describe("Tasks just moved on from days gone by."),
  today: z.array(taskView).readonly(),
  upcoming: z.array(taskView).readonly(),
  completed: z.array(taskView).readonly(),
});
const planInput = z.object({
  track: z.string().min(1).max(80),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  deadline: day,
  dailyMinutes: z.number().int(),
  weekendMinutes: z.number().int().nullable().optional().describe("Minutes on Saturday and Sunday, when they differ from `dailyMinutes`."),
  offDays: z.array(z.number().int()).max(7).default([]),
  goal: z.string().max(200).optional(),
  role: z
    .enum(["sde", "backend", "frontend", "data"])
    .nullable()
    .optional()
    .describe("The job aimed at: within each module its problems come first, and up to eight of the site's other problems on its topics join the plan."),
  upTo: z.number().int().optional().describe("Plan only the first this many of the track's remaining items: the one that fit by the deadline, say."),
});
const planPreview = z.object({
  track: z.object({ slug: z.string(), title: z.string() }),
  tasks: z.number(),
  totalMinutes: z.number(),
  finishOn: day,
  deadline: day,
  fits: z.boolean(),
  sprints: z.array(sprint).readonly(),
  dailyMinutesToFit: z.number().nullable().describe("When it does not fit: minutes a day that would finish by the deadline."),
  itemsThatFit: z.object({ items: z.number(), of: z.number() }).nullable().describe("When it does not fit: how many of the remaining items the deadline holds, to plan just those (`upTo`)."),
});

const potdDay = z.object({ day, slug: z.string(), title: z.string(), difficulty, solved: z.boolean(), solvedThatDay: z.boolean() });
const homeView = z.object({
  name: z.string(),
  today: day,
  streak: z.number(),
  longestStreak: z.number(),
  coins: z.number(),
  checkin: z.number().describe("Coins for the day's first visit: 1 the first time today, then 0."),
  dueCards: z.number(),
  focusMinutesToday: z.number(),
  potd: potdDay.nullable(),
  plan: planView.pick({ track: true, startedAt: true, finishOn: true, deadline: true, sprint: true, sprints: true, today: true, moved: true }).nullable(),
  continue: z
    .object({ slug: z.string(), title: z.string(), items: z.number(), done: z.number(), next: z.object({ kind: z.enum(["problem", "lesson"]), slug: z.string(), title: z.string() }).nullable() })
    .nullable(),
  solved: z.number(),
  frozenToday: z.boolean().describe("Today was taken off: the streak neither grows nor breaks."),
  freezesLeft: z.number().describe("Days off left this month."),
});

const sprintParams = siteParams.extend({ sprint: z.coerce.number().int().min(1).max(1000) });
const quizView = z.object({
  sprint: z.number(),
  open: z.boolean().describe("Once the sprint's tasks are done, or its days are over."),
  passPercent: z.number(),
  questions: z.array(z.object({ slug: z.string(), title: z.string(), question: S.candidateQuestion })).readonly().describe("Empty until open."),
  count: z.number().describe("Questions in the quiz: the sprint's choice and number questions, ten at most."),
  sittings: z.array(z.object({ score: z.number(), total: z.number(), passed: z.boolean(), takenAt: z.string() })).readonly(),
});

const reviseView = z.object({
  due: z
    .array(
      z.object({
        slug: z.string(),
        title: z.string(),
        difficulty,
        tags: z.array(z.string()).readonly(),
        dueOn: day,
        lastReviewedAt: z.string().nullable(),
        reps: z.number(),
        note: z.string().nullable(),
        next: z
          .object({ again: z.number(), hard: z.number(), good: z.number(), easy: z.number() })
          .describe("Days until the card comes back for each grade: what grading it now would set."),
      }),
    )
    .readonly(),
  later: z.number(),
  upcoming: z.number(),
});

const listView = z.object({
  name: z.string(),
  solved: z.number(),
  problems: z.array(z.object({ slug: z.string(), title: z.string(), difficulty, solved: z.boolean() })).readonly(),
});
const noteKind = z.enum(["problem", "lesson", "topic"]);
const noteView = z.object({ kind: noteKind, ref: z.string(), title: z.string(), body: z.string(), updatedAt: z.string().nullable() });

// staff
const staffLesson = z.object({ id: z.string(), slug: z.string(), title: z.string(), body: z.string(), videoUrl: z.string(), estMinutes: z.number(), published: z.boolean(), updatedAt: z.string() });
const lessonBody = z.object({
  title: z.string().min(1).max(160),
  slug: z.string().optional(),
  body: z.string().max(200_000),
  videoUrl: z.string().max(500).default(""),
  estMinutes: z.number().int(),
  published: z.boolean(),
});
const staffTrack = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  position: z.number(),
  published: z.boolean(),
  updatedAt: z.string(),
  modules: z
    .array(z.object({ id: z.string(), title: z.string(), position: z.number(), items: z.array(z.object({ id: z.string(), position: z.number(), problemId: z.string().nullable(), lessonId: z.string().nullable() })).readonly() }))
    .readonly(),
});
const trackBody = z.object({
  title: z.string().min(1).max(160),
  slug: z.string().optional(),
  description: z.string().max(20_000),
  position: z.number().int().optional(),
  published: z.boolean(),
  modules: z.array(z.object({ title: z.string().max(160), items: z.array(z.object({ problemId: z.string().optional(), lessonId: z.string().optional() })).max(200) })).max(60),
});
const idParams = z.object({ id: z.string().min(1) });

/**
 * Prep (ROADMAP §16): tracks, lessons, the study plan, revision, lists, notes,
 * the problem of the day and coins — under `/practice/<site>` for learners and
 * `/practice-admin` for staff, beside the practice routes.
 */
export function registerPrepRoutes(routes: Routes, deps: PrepRouteDeps): void {
  const { practice, prep, service, staff, bearer } = deps;

  const siteOf = async (request: FastifyRequest): Promise<PracticeSite> => {
    const site = await practice.site((request.params as { site: string }).site);
    request.orgId = site.orgId;
    return site;
  };
  const learnerOf = async (site: PracticeSite, request: FastifyRequest, reply: FastifyReply): Promise<Learner | null> => {
    const learner = await practice.learner(site, bearer(request) ?? undefined);
    if (learner === null) await reply.code(401).send({ error: "sign_in_required", message: "Sign in to do that" });
    return learner;
  };
  const maybeLearner = (site: PracticeSite, request: FastifyRequest) => practice.learner(site, bearer(request) ?? undefined);
  /** A learner's route: the site, then who is signed in, or a 401 and nothing more. */
  const signedIn = async (request: FastifyRequest, reply: FastifyReply) => {
    const site = await siteOf(request);
    const learner = await learnerOf(site, request, reply);
    return learner === null ? null : { site, learner };
  };

  // --- the placement quiz ----------------------------------------------------------------

  routes.get(
    "/practice/:site/placement",
    {
      schema: {
        tags: PREP,
        summary: "Eight placement questions: three easy, three medium, two hard, without their answers",
        security: OPEN,
        params: siteParams,
        response: {
          200: z.object({
            questions: z
              .array(z.object({ id: z.string(), level: z.enum(["easy", "medium", "hard"]), topic: z.string(), text: z.string().describe("Markdown."), options: z.array(z.string()).readonly() }))
              .readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      await siteOf(request);
      return reply.send({ questions: drawPlacement() });
    },
  );

  routes.post(
    "/practice/:site/placement",
    {
      schema: {
        tags: PREP,
        summary: "Mark the placement quiz, and the level it suggests",
        description: "Nothing is kept: the level is a suggestion for planning. 7 or 8 right suggests advanced, 4 to 6 intermediate, fewer beginner.",
        security: OPEN,
        params: siteParams,
        body: z.object({ answers: z.array(z.object({ id: z.string().max(10), choice: z.number().int() })).max(20) }),
        response: {
          200: z.object({
            score: z.number(),
            of: z.number(),
            level: z.enum(["beginner", "intermediate", "advanced"]),
            results: z.array(z.object({ id: z.string(), choice: z.number(), correct: z.number(), right: z.boolean(), why: z.string() })).readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      await siteOf(request);
      return reply.send(markPlacement(request.body.answers));
    },
  );

  // --- the dashboard -------------------------------------------------------------------

  routes.get(
    "/practice/:site/home",
    {
      schema: {
        tags: PREP,
        summary: "My dashboard: today's plan, streak, coins, the problem of the day",
        description: "The day's first visit pays the check-in coin. Tasks left undone on days gone by are moved on before today's are listed.",
        security: LEARNER,
        params: siteParams,
        response: { 200: homeView, ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await prep.home(who.site, who.learner));
    },
  );

  // --- tracks and lessons ------------------------------------------------------------------

  routes.get(
    "/practice/:site/tracks",
    { schema: { tags: PREP, summary: "Tracks: sheets of lessons and problems", security: OPEN, params: siteParams, response: { 200: z.object({ tracks: z.array(trackSummary).readonly() }), ...refusals } } },
    async (request, reply) => {
      const site = await siteOf(request);
      return reply.send({ tracks: await prep.tracks(site, await maybeLearner(site, request)) });
    },
  );

  routes.get(
    "/practice/:site/tracks/:track",
    { schema: { tags: PREP, summary: "A track, module by module, with my standing on each item", security: OPEN, params: slugParam("track"), response: { 200: trackView, ...refusals } } },
    async (request, reply) => {
      const site = await siteOf(request);
      return reply.send(await prep.track(site, (request.params as { track: string }).track, await maybeLearner(site, request)));
    },
  );

  routes.get(
    "/practice/:site/lessons/:lesson",
    { schema: { tags: PREP, summary: "A lesson", security: OPEN, params: slugParam("lesson"), response: { 200: lessonView, ...refusals } } },
    async (request, reply) => {
      const site = await siteOf(request);
      return reply.send(await prep.lesson(site, (request.params as { lesson: string }).lesson, await maybeLearner(site, request)));
    },
  );

  routes.post(
    "/practice/:site/lessons/:lesson/done",
    { schema: { tags: PREP, summary: "Mark a lesson done", security: LEARNER, params: slugParam("lesson"), response: { 200: reward, ...refusals } } },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await prep.completeLesson(who.site, who.learner, (request.params as { lesson: string }).lesson));
    },
  );

  routes.post(
    "/practice/:site/lessons/:lesson/quiz",
    {
      schema: {
        tags: PREP,
        summary: "Hand in a lesson's quiz",
        description: "Each answer checked, the right answer and the explanation given back; each wrong one is due for revision today.",
        security: LEARNER,
        params: slugParam("lesson"),
        body: z.object({ answers: z.record(z.string(), z.string().max(200)).describe("By problem address: an option's position, several comma-separated, or a number.") }),
        response: {
          200: z.object({
            score: z.number(),
            total: z.number(),
            results: z.array(z.object({ slug: z.string(), right: z.boolean(), answer: z.string(), explanation: z.string() })).readonly(),
            revise: z.number().describe("Wrong answers now due for revision."),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await prep.takeLessonQuiz(who.site, who.learner, (request.params as { lesson: string }).lesson, request.body.answers));
    },
  );

  routes.post(
    "/practice/:site/problems/:problem/share",
    {
      schema: {
        tags: PREP,
        summary: "Share my solution read-only, at a link",
        description: "Only the code: never a test. Refused while a contest that includes the problem runs. Twenty a day.",
        security: LEARNER,
        params: slugParam("problem"),
        body: z.object({ language: z.string().min(1).max(40), source: z.string().max(65_536) }),
        response: { 201: z.object({ id: z.string(), path: z.string().describe("Under the site: /shares/<id>.") }), ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.code(201).send(await prep.shareCode(who.site, who.learner, (request.params as { problem: string }).problem, request.body));
    },
  );

  routes.get(
    "/practice/:site/shares",
    {
      schema: {
        tags: PREP,
        summary: "The solutions I shared",
        security: LEARNER,
        params: siteParams,
        response: {
          200: z.object({
            shares: z
              .array(
                z.object({
                  id: z.string(),
                  path: z.string(),
                  problem: z.object({ slug: z.string(), title: z.string() }).nullable(),
                  language: z.string(),
                  createdAt: z.string(),
                }),
              )
              .readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send({ shares: await prep.myShares(who.site, who.learner) });
    },
  );

  routes.delete(
    "/practice/:site/shares/:id",
    {
      schema: {
        tags: PREP,
        summary: "Take down a solution I shared",
        description: "The link stops working at once. Only the learner who shared it can.",
        security: LEARNER,
        params: siteParams.extend({ id: z.string().min(1).max(40) }),
        response: { 204: z.null(), ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      await prep.deleteShare(who.site, who.learner, request.params.id);
      return reply.code(204).send(null);
    },
  );

  routes.get(
    "/practice/:site/shares/:id",
    {
      schema: {
        tags: PREP,
        summary: "A shared solution",
        security: OPEN,
        params: siteParams.extend({ id: z.string().min(1).max(40) }),
        response: {
          200: z.object({
            problem: z.object({ slug: z.string(), title: z.string() }).nullable().describe("Null when the problem is no longer published."),
            author: z.string(),
            language: z.string(),
            source: z.string(),
            createdAt: z.string(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => reply.send(await prep.sharedCode(await siteOf(request), request.params.id)),
  );

  // --- the plan -------------------------------------------------------------------------------

  routes.get(
    "/practice/:site/plan",
    { schema: { tags: PREP, summary: "My study plan", security: LEARNER, params: siteParams, response: { 200: z.object({ plan: planView.nullable() }), ...refusals } } },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send({ plan: await prep.plan(who.site, who.learner) });
    },
  );

  routes.post(
    "/practice/:site/plan/preview",
    {
      schema: {
        tags: PREP,
        summary: "What a plan would be: its sprints, and whether it finishes by the deadline",
        security: LEARNER,
        params: siteParams,
        body: planInput,
        response: { 200: planPreview, ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await prep.previewPlan(who.site, who.learner, request.body));
    },
  );

  routes.post(
    "/practice/:site/plan",
    {
      schema: {
        tags: PREP,
        summary: "Start a study plan",
        description: "The track's remaining items are laid over study days in order. A plan already active is set aside.",
        security: LEARNER,
        params: siteParams,
        body: planInput,
        response: { 201: z.object({ plan: planView }), ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.code(201).send({ plan: await prep.startPlan(who.site, who.learner, request.body) });
    },
  );

  routes.patch(
    "/practice/:site/plan",
    {
      schema: {
        tags: PREP,
        summary: "Change my running plan: its deadline, minutes or days off",
        description: "Done tasks stay done, and so do the learner's own tasks; the track's remaining items are laid out again from today, in new sprints.",
        security: LEARNER,
        params: siteParams,
        body: z.object({
          deadline: day.optional(),
          dailyMinutes: z.number().int().optional(),
          weekendMinutes: z.number().int().nullable().optional(),
          offDays: z.array(z.number().int()).max(7).optional(),
        }),
        response: { 200: z.object({ plan: planView }), ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      const { deadline, dailyMinutes, weekendMinutes, offDays } = request.body;
      return reply.send({
        plan: await prep.changePlan(who.site, who.learner, {
          ...(deadline === undefined ? {} : { deadline }),
          ...(dailyMinutes === undefined ? {} : { dailyMinutes }),
          ...(weekendMinutes === undefined ? {} : { weekendMinutes }),
          ...(offDays === undefined ? {} : { offDays }),
        }),
      });
    },
  );

  routes.delete("/practice/:site/plan", { schema: { tags: PREP, summary: "Stop my study plan", security: LEARNER, params: siteParams, response: { 200: S.okResponse, ...refusals } } }, async (request, reply) => {
    const who = await signedIn(request, reply);
    if (who === null) return;
    await prep.archivePlan(who.site, who.learner);
    return reply.send({ ok: true });
  });

  routes.post(
    "/practice/:site/plan/tasks",
    {
      schema: {
        tags: PREP,
        summary: "Add a task of my own to the plan",
        security: LEARNER,
        params: siteParams,
        body: z.object({ title: z.string().max(200), estMinutes: z.number().int(), day: day.optional() }),
        response: { 201: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      const { title, estMinutes, day: on } = request.body;
      await prep.addTask(who.site, who.learner, { title, estMinutes, ...(on === undefined ? {} : { day: on }) });
      return reply.code(201).send({ ok: true });
    },
  );

  routes.put(
    "/practice/:site/plan/tasks/:task",
    {
      schema: {
        tags: PREP,
        summary: "Mark a task done, or not",
        description: "A lesson's or a problem's task is done by itself when the lesson is finished or the problem accepted.",
        security: LEARNER,
        params: siteParams.extend({ task: z.string().min(1).max(80) }),
        body: z.object({ done: z.boolean() }),
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      await prep.setTaskDone(who.site, who.learner, (request.params as { task: string }).task, request.body.done);
      return reply.send({ ok: true });
    },
  );

  // --- the end of a sprint, and a day off ---------------------------------------------------------

  routes.get(
    "/practice/:site/plan/sprints/:sprint/quiz",
    { schema: { tags: PREP, summary: "A sprint's quiz", security: LEARNER, params: sprintParams, response: { 200: quizView, ...refusals } } },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await prep.sprintQuiz(who.site, who.learner, request.params.sprint));
    },
  );

  routes.post(
    "/practice/:site/plan/sprints/:sprint/quiz",
    {
      schema: {
        tags: PREP,
        summary: "Hand in a sprint's quiz",
        description: "Answers by problem address: an option's index for a choice, a number for a number. Below the pass mark, each question got wrong is due for revision today and comes back as a task on the next study day. Passing pays coins once.",
        security: LEARNER,
        params: sprintParams,
        body: z.object({ answers: z.record(z.string().max(80), z.string().max(200)) }),
        response: {
          200: z.object({ score: z.number(), total: z.number(), passed: z.boolean(), wrong: z.array(z.string()).readonly(), revise: z.number().describe("Revision tasks added."), reward }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await prep.takeSprintQuiz(who.site, who.learner, request.params.sprint, request.body.answers));
    },
  );

  routes.get(
    "/practice/:site/plan/sprints/:sprint/notes",
    {
      schema: {
        tags: PREP,
        summary: "A sprint's revision notes: my notes on its lessons and problems, in order",
        security: LEARNER,
        params: sprintParams,
        response: {
          200: z.object({ sprint: z.number(), items: z.array(z.object({ kind: z.enum(["problem", "lesson"]), slug: z.string(), title: z.string(), note: z.string().nullable().describe("Markdown.") })).readonly() }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await prep.sprintNotes(who.site, who.learner, request.params.sprint));
    },
  );

  routes.post(
    "/practice/:site/streak/freeze",
    {
      schema: {
        tags: PREP,
        summary: "Take today off",
        description: "Two days a calendar month. The streak neither grows nor breaks, no reminder goes, and the day's open tasks move on.",
        security: LEARNER,
        params: siteParams,
        response: { 200: z.object({ day, freezesLeft: z.number(), moved: z.number() }), ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await prep.freeze(who.site, who.learner));
    },
  );

  // --- focus -------------------------------------------------------------------------------------

  routes.get(
    "/practice/:site/focus",
    {
      schema: {
        tags: PREP,
        summary: "Minutes of focus, day by day, this week",
        security: LEARNER,
        params: siteParams,
        response: { 200: z.object({ days: z.array(z.object({ day, minutes: z.number() })).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await prep.focusWeek(who.site, who.learner));
    },
  );

  routes.post(
    "/practice/:site/focus",
    {
      schema: {
        tags: PREP,
        summary: "Start timing a study session",
        description: "One at a time: a session left open is ended when another starts.",
        security: LEARNER,
        params: siteParams,
        body: z.object({ taskId: z.string().max(80).nullable().default(null) }),
        response: { 201: z.object({ id: z.string(), startedAt: z.string() }), ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.code(201).send(await prep.startFocus(who.site, who.learner, request.body.taskId));
    },
  );

  routes.post(
    "/practice/:site/focus/:focus/stop",
    {
      schema: {
        tags: PREP,
        summary: "Stop timing a study session",
        security: LEARNER,
        params: siteParams.extend({ focus: z.string().min(1).max(80) }),
        response: { 200: z.object({ seconds: z.number() }), ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await prep.stopFocus(who.site, who.learner, (request.params as { focus: string }).focus));
    },
  );

  // --- revision ------------------------------------------------------------------------------------

  routes.get(
    "/practice/:site/revise",
    { schema: { tags: PREP, summary: "Solved problems due for revision today", security: LEARNER, params: siteParams, response: { 200: reviseView, ...refusals } } },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await prep.revision(who.site, who.learner));
    },
  );

  routes.post(
    "/practice/:site/revise/:problem",
    {
      schema: {
        tags: PREP,
        summary: "Say how well I remembered a problem",
        description: "again, hard, good or easy: the next revision is set further off the better it went.",
        security: LEARNER,
        params: slugParam("problem"),
        body: z.object({ grade: z.enum(["again", "hard", "good", "easy"]) }),
        response: { 200: z.object({ dueOn: day, intervalDays: z.number() }), ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await prep.grade(who.site, who.learner, (request.params as { problem: string }).problem, request.body.grade));
    },
  );

  // --- lists ----------------------------------------------------------------------------------------

  routes.get(
    "/practice/:site/lists",
    { schema: { tags: PREP, summary: "My lists of problems, bookmarks first", security: LEARNER, params: siteParams, response: { 200: z.object({ lists: z.array(listView).readonly() }), ...refusals } } },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send({ lists: await prep.lists(who.site, who.learner) });
    },
  );

  const listParams = siteParams.extend({ list: z.string().min(1).max(60), problem: z.string().min(1).max(80) });
  routes.put(
    "/practice/:site/lists/:list/:problem",
    { schema: { tags: PREP, summary: "Put a problem in a list", security: LEARNER, params: listParams, response: { 200: S.okResponse, ...refusals } } },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      const { list, problem } = request.params as { list: string; problem: string };
      await prep.save(who.site, who.learner, list, problem);
      return reply.send({ ok: true });
    },
  );

  routes.delete(
    "/practice/:site/lists/:list/:problem",
    { schema: { tags: PREP, summary: "Take a problem out of a list", security: LEARNER, params: listParams, response: { 200: S.okResponse, ...refusals } } },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      const { list, problem } = request.params as { list: string; problem: string };
      await prep.unsave(who.site, who.learner, list, problem);
      return reply.send({ ok: true });
    },
  );

  // --- notes -----------------------------------------------------------------------------------------

  routes.get(
    "/practice/:site/notes",
    { schema: { tags: PREP, summary: "My notes, newest first", security: LEARNER, params: siteParams, response: { 200: z.object({ notes: z.array(noteView).readonly() }), ...refusals } } },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send({ notes: await prep.notes(who.site, who.learner) });
    },
  );

  const noteParams = siteParams.extend({ kind: noteKind, ref: z.string().min(1).max(120) });
  routes.get(
    "/practice/:site/notes/book",
    {
      schema: {
        tags: PREP,
        summary: "My notes on a track, module by module, to print or save as a PDF",
        security: LEARNER,
        params: siteParams,
        querystring: z.object({ track: z.string().min(1).max(80) }),
        response: {
          200: z.object({
            track: z.object({ slug: z.string(), title: z.string() }),
            modules: z.array(z.object({ title: z.string(), notes: z.array(z.object({ kind: z.enum(["problem", "lesson"]), slug: z.string(), title: z.string(), body: z.string() })).readonly() })).readonly(),
            topics: z.array(z.object({ title: z.string(), body: z.string() })).readonly().describe("The learner's topic notes, which belong to no track."),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await prep.noteBook(who.site, who.learner, request.query.track));
    },
  );

  routes.get(
    "/practice/:site/notes/:kind/:ref",
    { schema: { tags: PREP, summary: "My note on a problem, a lesson or a topic", security: LEARNER, params: noteParams, response: { 200: noteView, ...refusals } } },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      const { kind, ref } = request.params as { kind: string; ref: string };
      return reply.send(await prep.note(who.site, who.learner, kind, ref));
    },
  );

  routes.put(
    "/practice/:site/notes/:kind/:ref",
    {
      schema: {
        tags: PREP,
        summary: "Write my note on a problem, a lesson or a topic",
        description: "An empty body deletes the note.",
        security: LEARNER,
        params: noteParams,
        body: z.object({ title: z.string().max(160).optional(), body: z.string().max(50_000) }),
        response: { 200: noteView, ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      const { kind, ref } = request.params as { kind: string; ref: string };
      const { title, body } = request.body;
      return reply.send(await prep.saveNote(who.site, who.learner, kind, ref, { body, ...(title === undefined ? {} : { title }) }));
    },
  );

  // --- the problem of the day, and coins -------------------------------------------------------------

  routes.get(
    "/practice/:site/potd",
    {
      schema: {
        tags: PREP,
        summary: "The problem of the day, and the last 30 days'",
        security: OPEN,
        params: siteParams,
        response: { 200: z.object({ today: potdDay.nullable(), calendar: z.array(potdDay).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const site = await siteOf(request);
      return reply.send(await prep.potd(site, await maybeLearner(site, request)));
    },
  );

  routes.get(
    "/practice/:site/coins",
    {
      schema: {
        tags: PREP,
        summary: "My coins, and what they were for",
        security: LEARNER,
        params: siteParams,
        response: { 200: z.object({ balance: z.number(), dailyCap: z.number(), history: z.array(z.object({ rule: z.string(), amount: z.number(), at: z.string() })).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await prep.coins(who.site, who.learner));
    },
  );

  routes.get(
    "/practice/:site/coins/leaders",
    {
      schema: {
        tags: PREP,
        summary: "Learners by coins",
        security: OPEN,
        params: siteParams,
        response: { 200: z.object({ leaders: z.array(z.object({ rank: z.number(), name: z.string(), title: z.string().nullable(), username: z.string().nullable(), coins: z.number(), you: z.boolean() })).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const site = await siteOf(request);
      return reply.send({ leaders: await prep.coinLeaders(site, await maybeLearner(site, request)) });
    },
  );

  // --- staff -------------------------------------------------------------------------------------------

  routes.get("/practice-admin/tracks", { schema: { tags: ADMIN, summary: "Tracks", security: STAFF, response: { 200: z.object({ tracks: z.array(staffTrack).readonly() }), ...refusals } } }, async (request, reply) => {
    const actor = await staff(request, reply, "exam:read");
    if (actor === null) return;
    return reply.send({ tracks: await prep.staffTracks(actor.orgId) });
  });

  routes.post(
    "/practice-admin/tracks",
    { schema: { tags: ADMIN, summary: "Create a track", security: STAFF, body: trackBody, response: { 201: staffTrack, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      const track = await prep.saveTrack(actor.orgId, null, stripUndefined(request.body));
      await service.recordAudit(actor, "prep.track_created", track.id);
      return reply.code(201).send(track);
    },
  );

  routes.put(
    "/practice-admin/tracks/:id",
    {
      schema: {
        tags: ADMIN,
        summary: "Save a track: its modules and items are replaced by these",
        description: "A learner's progress is kept: it belongs to the problems and lessons, not to the track.",
        security: STAFF,
        params: idParams,
        body: trackBody,
        response: { 200: staffTrack, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      const track = await prep.saveTrack(actor.orgId, request.params.id, stripUndefined(request.body));
      await service.recordAudit(actor, "prep.track_changed", track.id);
      return reply.send(track);
    },
  );

  routes.get("/practice-admin/lessons", { schema: { tags: ADMIN, summary: "Lessons", security: STAFF, response: { 200: z.object({ lessons: z.array(staffLesson).readonly() }), ...refusals } } }, async (request, reply) => {
    const actor = await staff(request, reply, "exam:read");
    if (actor === null) return;
    return reply.send({ lessons: await prep.staffLessons(actor.orgId) });
  });

  routes.post("/practice-admin/lessons", { schema: { tags: ADMIN, summary: "Write a lesson", security: STAFF, body: lessonBody, response: { 201: staffLesson, ...refusals } } }, async (request, reply) => {
    const actor = await staff(request, reply, "exam:write");
    if (actor === null) return;
    const lesson = await prep.saveLesson(actor.orgId, null, stripUndefined(request.body));
    await service.recordAudit(actor, "prep.lesson_created", lesson.id);
    return reply.code(201).send(lesson);
  });

  routes.put(
    "/practice-admin/lessons/:id",
    { schema: { tags: ADMIN, summary: "Edit a lesson", security: STAFF, params: idParams, body: lessonBody, response: { 200: staffLesson, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      const lesson = await prep.saveLesson(actor.orgId, request.params.id, stripUndefined(request.body));
      await service.recordAudit(actor, "prep.lesson_changed", lesson.id);
      return reply.send(lesson);
    },
  );

  routes.get(
    "/practice-admin/lessons/:id/quiz",
    { schema: { tags: ADMIN, summary: "A lesson's quiz: its problems, in order", security: STAFF, params: idParams, response: { 200: z.object({ problemIds: z.array(z.string()).readonly() }), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read");
      if (actor === null) return;
      return reply.send({ problemIds: await prep.staffLessonQuiz(actor.orgId, request.params.id) });
    },
  );

  routes.put(
    "/practice-admin/lessons/:id/quiz",
    {
      schema: {
        tags: ADMIN,
        summary: "Set a lesson's quiz",
        description: "Up to ten of the site's multiple-choice or number problems; they may be unpublished, asked only here.",
        security: STAFF,
        params: idParams,
        body: z.object({ problemIds: z.array(z.string().min(1)).max(20) }),
        response: { 200: z.object({ problemIds: z.array(z.string()).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      const problemIds = await prep.setLessonQuiz(actor.orgId, request.params.id, request.body.problemIds);
      await service.recordAudit(actor, "prep.lesson_quiz", request.params.id, { questions: problemIds.length });
      return reply.send({ problemIds });
    },
  );

  routes.get(
    "/practice-admin/potd",
    {
      schema: {
        tags: ADMIN,
        summary: "The problem of the day, from 30 days back to 60 ahead",
        security: STAFF,
        response: { 200: z.object({ today: day, days: z.array(z.object({ day, problemId: z.string() })).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read");
      if (actor === null) return;
      return reply.send(await prep.potdSchedule(actor.orgId));
    },
  );

  routes.put(
    "/practice-admin/potd/:day",
    {
      schema: {
        tags: ADMIN,
        summary: "Set a day's problem, or clear it",
        security: STAFF,
        params: z.object({ day }),
        body: z.object({ problemId: z.string().nullable() }),
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      await prep.setPotd(actor.orgId, request.params.day, request.body.problemId);
      await service.recordAudit(actor, "prep.potd_set", request.params.day, { problemId: request.body.problemId });
      return reply.send({ ok: true });
    },
  );
}

/** Zod leaves an optional field present as undefined; the service's input types say "absent". */
function stripUndefined<T extends object>(value: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as never;
}
