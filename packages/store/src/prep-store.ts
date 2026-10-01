import type { OrgId } from "@parikshaa/core";
import { practiceStaff, type PracticeScope } from "./practice-store.js";
import type { SqlExecutor } from "./sql.js";

/**
 * Prep (ROADMAP §16, migration 0019): tracks of lessons and problems, the study
 * plan that schedules them, revision, notes, saved lists, the problem of the
 * day and coins — everything on a practice site beyond the problem set.
 *
 * The same scopes as practice: staff manage content; a learner reads what is
 * published and reads and writes only their own rows. Coins are paid in the
 * staff scope (row-level security lets a learner read their own, never write
 * one), and a reward's key makes paying it twice a no-op.
 */

function scoped<T>(sql: SqlExecutor, scope: PracticeScope, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  return sql.transaction(fn, {
    "parikshaa.org_id": scope.orgId,
    "parikshaa.actor": scope.actor,
    "parikshaa.attempt_id": "",
    "parikshaa.learner_id": scope.actor === "learner" ? (scope.learnerId ?? "") : "",
  });
}

/** The learner a scope names; a store method on a learner's own rows refuses anyone else. */
function own(scope: PracticeScope): string {
  if (scope.actor !== "learner" || scope.learnerId === null) throw new Error("Only a signed-in learner has rows of their own");
  return scope.learnerId;
}

const iso = (value: string | Date) => new Date(value).toISOString();
const isUnique = (error: unknown) => (error as { code?: string }).code === "23505";

export class PrepSlugTaken extends Error {
  constructor(what: string) {
    super(`That ${what} address is taken`);
    this.name = "PrepSlugTaken";
  }
}

// --- content -----------------------------------------------------------------------

export interface Lesson {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly body: string;
  readonly videoUrl: string;
  readonly estMinutes: number;
  readonly published: boolean;
  readonly updatedAt: string;
}
export type LessonDraft = Omit<Lesson, "id" | "updatedAt">;

export interface TrackItem {
  readonly id: string;
  readonly position: number;
  readonly problemId: string | null;
  readonly lessonId: string | null;
}
export interface TrackModule {
  readonly id: string;
  readonly title: string;
  readonly position: number;
  readonly items: readonly TrackItem[];
}
export interface Track {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly position: number;
  readonly published: boolean;
  readonly updatedAt: string;
  readonly modules: readonly TrackModule[];
}
export interface TrackDraft {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly position: number;
  readonly published: boolean;
  readonly modules: readonly { readonly title: string; readonly items: readonly ({ readonly problemId: string } | { readonly lessonId: string })[] }[];
}

// --- a learner's own ------------------------------------------------------------------

export interface SavedProblem {
  readonly list: string;
  readonly problemId: string;
  readonly addedAt: string;
}

export type NoteKind = "problem" | "lesson" | "topic";
export interface Note {
  readonly refKind: NoteKind;
  readonly refId: string;
  readonly title: string;
  readonly body: string;
  readonly updatedAt: string;
}

/** One sitting of a sprint's quiz. */
export interface SprintQuiz {
  readonly sprint: number;
  readonly score: number;
  readonly total: number;
  /** Problem id to whether it was answered right. */
  readonly results: Readonly<Record<string, boolean>>;
  readonly takenAt: string;
}

export type Grade = "again" | "hard" | "good" | "easy";
export interface Card {
  readonly problemId: string;
  readonly dueOn: string;
  readonly intervalDays: number;
  readonly ease: number;
  readonly reps: number;
  readonly lastGrade: Grade | null;
  readonly reviewedAt: string | null;
}

export interface CoinEntry {
  readonly rule: string;
  readonly amount: number;
  readonly key: string;
  readonly createdAt: string;
}

export type PlanLevel = "beginner" | "intermediate" | "advanced";
export interface Plan {
  readonly id: string;
  readonly trackId: string;
  readonly level: PlanLevel;
  readonly deadline: string;
  readonly dailyMinutes: number;
  /** Minutes on Saturday and Sunday; null when they are like any other day. */
  readonly weekendMinutes: number | null;
  readonly offDays: readonly number[];
  readonly goal: string;
  readonly createdAt: string;
}
export type PlanDraft = Omit<Plan, "id" | "createdAt">;
/** What a learner may change in a plan already running. */
export type PlanSettings = Pick<Plan, "deadline" | "dailyMinutes" | "weekendMinutes" | "offDays">;

export type TaskKind = "learn" | "practice" | "revise" | "custom";
export interface Task {
  readonly id: string;
  readonly day: string;
  readonly sprint: number;
  readonly position: number;
  readonly kind: TaskKind;
  /** The track item: a problem's or a lesson's id; null for revision and the learner's own. */
  readonly itemId: string | null;
  readonly title: string;
  readonly estMinutes: number;
  readonly doneAt: string | null;
  readonly rescheduledFrom: string | null;
}
export type TaskDraft = Omit<Task, "id" | "doneAt" | "rescheduledFrom">;

interface LessonRow {
  id: string;
  slug: string;
  title: string;
  body: string;
  video_url: string;
  est_minutes: number;
  published: boolean;
  updated_at: string | Date;
}
const LESSON_COLUMNS = "id, slug, title, body, video_url, est_minutes, published, updated_at";
const toLesson = (r: LessonRow): Lesson => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  body: r.body,
  videoUrl: r.video_url,
  estMinutes: Number(r.est_minutes),
  published: r.published,
  updatedAt: iso(r.updated_at),
});

interface TaskRow {
  id: string;
  day: string;
  sprint: number;
  position: number;
  kind: TaskKind;
  item_id: string | null;
  title: string;
  est_minutes: number;
  done_at: string | Date | null;
  rescheduled_from: string | null;
}
const TASK_COLUMNS = `id, to_char(day, 'YYYY-MM-DD') AS day, sprint, position, kind, item_id, title, est_minutes, done_at,
  to_char(rescheduled_from, 'YYYY-MM-DD') AS rescheduled_from`;
const toTask = (r: TaskRow): Task => ({
  id: r.id,
  day: r.day,
  sprint: Number(r.sprint),
  position: Number(r.position),
  kind: r.kind,
  itemId: r.item_id,
  title: r.title,
  estMinutes: Number(r.est_minutes),
  doneAt: r.done_at === null ? null : iso(r.done_at),
  rescheduledFrom: r.rescheduled_from,
});

interface CardRow {
  problem_id: string;
  due_on: string;
  interval_days: number;
  ease: string | number;
  reps: number;
  last_grade: Grade | null;
  reviewed_at: string | Date | null;
}
const CARD_COLUMNS = "problem_id, to_char(due_on, 'YYYY-MM-DD') AS due_on, interval_days, ease, reps, last_grade, reviewed_at";
const toCard = (r: CardRow): Card => ({
  problemId: r.problem_id,
  dueOn: r.due_on,
  intervalDays: Number(r.interval_days),
  ease: Number(r.ease),
  reps: Number(r.reps),
  lastGrade: r.last_grade,
  reviewedAt: r.reviewed_at === null ? null : iso(r.reviewed_at),
});

export class PrepStore {
  readonly #sql: SqlExecutor;
  readonly #newId: () => string;

  constructor(sql: SqlExecutor, options: { readonly newId?: () => string } = {}) {
    this.#sql = sql;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  // --- lessons -------------------------------------------------------------------------

  async lessons(scope: PracticeScope): Promise<readonly Lesson[]> {
    return scoped(this.#sql, scope, async (tx) =>
      (await tx.query<LessonRow>(`SELECT ${LESSON_COLUMNS} FROM prep_lessons WHERE org_id = $1 ORDER BY title LIMIT 5000`, [scope.orgId])).map(toLesson),
    );
  }

  async lessonBySlug(scope: PracticeScope, slug: string): Promise<Lesson | null> {
    return scoped(this.#sql, scope, async (tx) => {
      const rows = await tx.query<LessonRow>(`SELECT ${LESSON_COLUMNS} FROM prep_lessons WHERE org_id = $1 AND slug = $2`, [scope.orgId, slug]);
      return rows[0] === undefined ? null : toLesson(rows[0]);
    });
  }

  async saveLesson(orgId: OrgId, id: string | null, draft: LessonDraft): Promise<Lesson | null> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const params = [orgId, id ?? this.#newId(), draft.slug, draft.title, draft.body, draft.videoUrl, draft.estMinutes, draft.published];
      try {
        const rows =
          id === null
            ? await tx.query<LessonRow>(
                `INSERT INTO prep_lessons (org_id, id, slug, title, body, video_url, est_minutes, published)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${LESSON_COLUMNS}`,
                params,
              )
            : await tx.query<LessonRow>(
                `UPDATE prep_lessons SET slug = $3, title = $4, body = $5, video_url = $6, est_minutes = $7, published = $8, updated_at = now()
                  WHERE org_id = $1 AND id = $2 RETURNING ${LESSON_COLUMNS}`,
                params,
              );
        return rows[0] === undefined ? null : toLesson(rows[0]);
      } catch (error) {
        if (isUnique(error)) throw new PrepSlugTaken("lesson");
        throw error;
      }
    });
  }

  // --- tracks --------------------------------------------------------------------------

  async tracks(scope: PracticeScope): Promise<readonly Track[]> {
    return scoped(this.#sql, scope, async (tx) => {
      const tracks = await tx.query<{ id: string; slug: string; title: string; description: string; position: number; published: boolean; updated_at: string | Date }>(
        `SELECT id, slug, title, description, position, published, updated_at FROM prep_tracks WHERE org_id = $1 ORDER BY position, title`,
        [scope.orgId],
      );
      if (tracks.length === 0) return [];
      const modules = await tx.query<{ id: string; track_id: string; title: string; position: number }>(
        `SELECT id, track_id, title, position FROM prep_modules WHERE org_id = $1 AND track_id = ANY($2) ORDER BY position`,
        [scope.orgId, tracks.map((t) => t.id)],
      );
      const items = await tx.query<{ id: string; module_id: string; position: number; problem_id: string | null; lesson_id: string | null }>(
        `SELECT id, module_id, position, problem_id, lesson_id FROM prep_items WHERE org_id = $1 AND module_id = ANY($2) ORDER BY position`,
        [scope.orgId, modules.map((m) => m.id)],
      );
      const itemsOf = new Map<string, TrackItem[]>();
      for (const i of items) {
        const list = itemsOf.get(i.module_id) ?? [];
        list.push({ id: i.id, position: Number(i.position), problemId: i.problem_id, lessonId: i.lesson_id });
        itemsOf.set(i.module_id, list);
      }
      const modulesOf = new Map<string, TrackModule[]>();
      for (const m of modules) {
        const list = modulesOf.get(m.track_id) ?? [];
        list.push({ id: m.id, title: m.title, position: Number(m.position), items: itemsOf.get(m.id) ?? [] });
        modulesOf.set(m.track_id, list);
      }
      return tracks.map((t) => ({
        id: t.id,
        slug: t.slug,
        title: t.title,
        description: t.description,
        position: Number(t.position),
        published: t.published,
        updatedAt: iso(t.updated_at),
        modules: modulesOf.get(t.id) ?? [],
      }));
    });
  }

  /** Save a track whole: its modules and items are replaced by the draft's. */
  async saveTrack(orgId: OrgId, id: string | null, draft: TrackDraft): Promise<string | null> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const trackId = id ?? this.#newId();
      try {
        const rows =
          id === null
            ? await tx.query<{ id: string }>(
                `INSERT INTO prep_tracks (org_id, id, slug, title, description, position, published) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                [orgId, trackId, draft.slug, draft.title, draft.description, draft.position, draft.published],
              )
            : await tx.query<{ id: string }>(
                `UPDATE prep_tracks SET slug = $3, title = $4, description = $5, position = $6, published = $7, updated_at = now()
                  WHERE org_id = $1 AND id = $2 RETURNING id`,
                [orgId, trackId, draft.slug, draft.title, draft.description, draft.position, draft.published],
              );
        if (rows[0] === undefined) return null;
      } catch (error) {
        if (isUnique(error)) throw new PrepSlugTaken("track");
        throw error;
      }
      await tx.query(`DELETE FROM prep_modules WHERE org_id = $1 AND track_id = $2`, [orgId, trackId]);
      for (const [m, module] of draft.modules.entries()) {
        const moduleId = this.#newId();
        await tx.query(`INSERT INTO prep_modules (org_id, id, track_id, title, position) VALUES ($1, $2, $3, $4, $5)`, [orgId, moduleId, trackId, module.title, m]);
        for (const [i, item] of module.items.entries()) {
          await tx.query(`INSERT INTO prep_items (org_id, id, module_id, position, problem_id, lesson_id) VALUES ($1, $2, $3, $4, $5, $6)`, [
            orgId,
            this.#newId(),
            moduleId,
            i,
            "problemId" in item ? item.problemId : null,
            "lessonId" in item ? item.lessonId : null,
          ]);
        }
      }
      return trackId;
    });
  }

  // --- the problem of the day ------------------------------------------------------------

  async potd(scope: PracticeScope, from: string, to: string): Promise<readonly { readonly day: string; readonly problemId: string }[]> {
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<{ day: string; problem_id: string }>(
          `SELECT to_char(day, 'YYYY-MM-DD') AS day, problem_id FROM prep_potd WHERE org_id = $1 AND day BETWEEN $2 AND $3 ORDER BY day`,
          [scope.orgId, from, to],
        )
      ).map((r) => ({ day: r.day, problemId: r.problem_id })),
    );
  }

  async setPotd(orgId: OrgId, day: string, problemId: string | null): Promise<void> {
    await scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      if (problemId === null) await tx.query(`DELETE FROM prep_potd WHERE org_id = $1 AND day = $2`, [orgId, day]);
      else
        await tx.query(`INSERT INTO prep_potd (org_id, day, problem_id) VALUES ($1, $2, $3) ON CONFLICT (org_id, day) DO UPDATE SET problem_id = $3`, [
          orgId,
          day,
          problemId,
        ]);
    });
  }

  // --- lessons done -----------------------------------------------------------------------

  async lessonsDone(scope: PracticeScope): Promise<readonly { readonly lessonId: string; readonly at: string }[]> {
    if (scope.actor === "learner" && scope.learnerId === null) return [];
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<{ lesson_id: string; done_at: string | Date }>(
          `SELECT lesson_id, done_at FROM prep_lessons_done WHERE org_id = $1 AND learner_id = $2 ORDER BY done_at`,
          [scope.orgId, own(scope)],
        )
      ).map((r) => ({ lessonId: r.lesson_id, at: iso(r.done_at) })),
    );
  }

  /** True when this marks it done for the first time. */
  async markLessonDone(scope: PracticeScope, lessonId: string, at: Date = new Date()): Promise<boolean> {
    return scoped(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ lesson_id: string }>(
        `INSERT INTO prep_lessons_done (org_id, learner_id, lesson_id, done_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING lesson_id`,
        [scope.orgId, own(scope), lessonId, at],
      );
      return rows.length > 0;
    });
  }

  // --- saved lists --------------------------------------------------------------------------

  async saved(scope: PracticeScope): Promise<readonly SavedProblem[]> {
    if (scope.actor === "learner" && scope.learnerId === null) return [];
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<{ list: string; problem_id: string; added_at: string | Date }>(
          `SELECT list, problem_id, added_at FROM prep_saved WHERE org_id = $1 AND learner_id = $2 ORDER BY list, added_at`,
          [scope.orgId, own(scope)],
        )
      ).map((r) => ({ list: r.list, problemId: r.problem_id, addedAt: iso(r.added_at) })),
    );
  }

  async save(scope: PracticeScope, list: string, problemId: string): Promise<void> {
    await scoped(this.#sql, scope, (tx) =>
      tx.query(`INSERT INTO prep_saved (org_id, learner_id, list, problem_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [
        scope.orgId,
        own(scope),
        list,
        problemId,
      ]),
    );
  }

  async unsave(scope: PracticeScope, list: string, problemId: string): Promise<void> {
    await scoped(this.#sql, scope, (tx) =>
      tx.query(`DELETE FROM prep_saved WHERE org_id = $1 AND learner_id = $2 AND list = $3 AND problem_id = $4`, [scope.orgId, own(scope), list, problemId]),
    );
  }

  // --- notes -----------------------------------------------------------------------------------

  async notes(scope: PracticeScope): Promise<readonly Note[]> {
    if (scope.actor === "learner" && scope.learnerId === null) return [];
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<{ ref_kind: NoteKind; ref_id: string; title: string; body: string; updated_at: string | Date }>(
          `SELECT ref_kind, ref_id, title, body, updated_at FROM prep_notes WHERE org_id = $1 AND learner_id = $2 ORDER BY updated_at DESC LIMIT 2000`,
          [scope.orgId, own(scope)],
        )
      ).map((r) => ({ refKind: r.ref_kind, refId: r.ref_id, title: r.title, body: r.body, updatedAt: iso(r.updated_at) })),
    );
  }

  async saveNote(scope: PracticeScope, note: Omit<Note, "updatedAt">): Promise<Note> {
    return scoped(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ updated_at: string | Date }>(
        `INSERT INTO prep_notes (org_id, learner_id, ref_kind, ref_id, title, body) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (org_id, learner_id, ref_kind, ref_id) DO UPDATE SET title = $5, body = $6, updated_at = now()
         RETURNING updated_at`,
        [scope.orgId, own(scope), note.refKind, note.refId, note.title, note.body],
      );
      return { ...note, updatedAt: iso(rows[0]!.updated_at) };
    });
  }

  async deleteNote(scope: PracticeScope, refKind: NoteKind, refId: string): Promise<boolean> {
    return scoped(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ ref_id: string }>(
        `DELETE FROM prep_notes WHERE org_id = $1 AND learner_id = $2 AND ref_kind = $3 AND ref_id = $4 RETURNING ref_id`,
        [scope.orgId, own(scope), refKind, refId],
      );
      return rows.length > 0;
    });
  }

  // --- sprint quizzes and days off ------------------------------------------------------------------

  async sprintQuizzes(scope: PracticeScope, planId: string): Promise<readonly SprintQuiz[]> {
    if (scope.actor === "learner" && scope.learnerId === null) return [];
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<{ sprint: number; score: number; total: number; results: Record<string, boolean>; taken_at: string | Date }>(
          `SELECT sprint, score, total, results, taken_at FROM prep_sprint_quizzes WHERE org_id = $1 AND learner_id = $2 AND plan_id = $3 ORDER BY taken_at`,
          [scope.orgId, own(scope), planId],
        )
      ).map((r) => ({ sprint: Number(r.sprint), score: Number(r.score), total: Number(r.total), results: r.results, takenAt: iso(r.taken_at) })),
    );
  }

  async addSprintQuiz(scope: PracticeScope, planId: string, quiz: Omit<SprintQuiz, "takenAt">, at: Date): Promise<void> {
    await scoped(this.#sql, scope, (tx) =>
      tx.query(`INSERT INTO prep_sprint_quizzes (org_id, id, learner_id, plan_id, sprint, score, total, results, taken_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
        scope.orgId,
        this.#newId(),
        own(scope),
        planId,
        quiz.sprint,
        quiz.score,
        quiz.total,
        JSON.stringify(quiz.results),
        at,
      ]),
    );
  }

  /** The days a learner took off on purpose, oldest first. */
  async freezes(scope: PracticeScope): Promise<readonly string[]> {
    if (scope.actor === "learner" && scope.learnerId === null) return [];
    return scoped(this.#sql, scope, async (tx) =>
      (await tx.query<{ day: string }>(`SELECT to_char(day, 'YYYY-MM-DD') AS day FROM prep_freezes WHERE org_id = $1 AND learner_id = $2 ORDER BY day`, [scope.orgId, own(scope)])).map(
        (r) => r.day,
      ),
    );
  }

  /** Take a day off. False when it was taken already. */
  async freeze(scope: PracticeScope, day: string): Promise<boolean> {
    return scoped(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ day: string }>(`INSERT INTO prep_freezes (org_id, learner_id, day) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING day`, [
        scope.orgId,
        own(scope),
        day,
      ]);
      return rows.length > 0;
    });
  }

  // --- revision cards ------------------------------------------------------------------------------

  async cards(scope: PracticeScope): Promise<readonly Card[]> {
    if (scope.actor === "learner" && scope.learnerId === null) return [];
    return scoped(this.#sql, scope, async (tx) =>
      (await tx.query<CardRow>(`SELECT ${CARD_COLUMNS} FROM prep_cards WHERE org_id = $1 AND learner_id = $2 ORDER BY due_on, problem_id`, [scope.orgId, own(scope)])).map(
        toCard,
      ),
    );
  }

  /** A card for a newly solved problem; one already there is left as it is. */
  async addCard(scope: PracticeScope, problemId: string, dueOn: string): Promise<void> {
    await scoped(this.#sql, scope, (tx) =>
      tx.query(
        `INSERT INTO prep_cards (org_id, learner_id, problem_id, due_on, interval_days, ease) VALUES ($1, $2, $3, $4, 1, 2.5) ON CONFLICT DO NOTHING`,
        [scope.orgId, own(scope), problemId, dueOn],
      ),
    );
  }

  async saveCard(scope: PracticeScope, card: Card): Promise<void> {
    await scoped(this.#sql, scope, (tx) =>
      tx.query(
        `UPDATE prep_cards SET due_on = $4, interval_days = $5, ease = $6, reps = $7, last_grade = $8, reviewed_at = $9
          WHERE org_id = $1 AND learner_id = $2 AND problem_id = $3`,
        [scope.orgId, own(scope), card.problemId, card.dueOn, card.intervalDays, card.ease, card.reps, card.lastGrade, card.reviewedAt],
      ),
    );
  }

  // --- coins ---------------------------------------------------------------------------------------

  /** Pay a reward. False when that key was paid already. */
  async award(orgId: OrgId, learnerId: string, reward: { rule: string; amount: number; key: string }, at: Date = new Date()): Promise<boolean> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const rows = await tx.query<{ id: string }>(
        `INSERT INTO prep_coins (org_id, id, learner_id, rule, amount, key, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (org_id, learner_id, key) DO NOTHING RETURNING id`,
        [orgId, this.#newId(), learnerId, reward.rule, reward.amount, reward.key, at],
      );
      return rows.length > 0;
    });
  }

  async coins(scope: PracticeScope, limit = 50): Promise<{ readonly balance: number; readonly history: readonly CoinEntry[] }> {
    if (scope.actor === "learner" && scope.learnerId === null) return { balance: 0, history: [] };
    return scoped(this.#sql, scope, async (tx) => {
      const who = own(scope);
      const total = await tx.query<{ balance: string | null }>(`SELECT sum(amount) AS balance FROM prep_coins WHERE org_id = $1 AND learner_id = $2`, [scope.orgId, who]);
      const history = await tx.query<{ rule: string; amount: number; key: string; created_at: string | Date }>(
        `SELECT rule, amount, key, created_at FROM prep_coins WHERE org_id = $1 AND learner_id = $2 ORDER BY created_at DESC, id LIMIT $3`,
        [scope.orgId, who, limit],
      );
      return {
        balance: Number(total[0]?.balance ?? 0),
        history: history.map((r) => ({ rule: r.rule, amount: Number(r.amount), key: r.key, createdAt: iso(r.created_at) })),
      };
    });
  }

  /** Coins earned since a moment, not counting the rules named: the daily cap's measure. */
  async earnedSince(orgId: OrgId, learnerId: string, since: Date, except: readonly string[]): Promise<number> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const rows = await tx.query<{ total: string | null }>(
        `SELECT sum(amount) AS total FROM prep_coins WHERE org_id = $1 AND learner_id = $2 AND created_at >= $3 AND amount > 0 AND NOT (rule = ANY($4))`,
        [orgId, learnerId, since, [...except]],
      );
      return Number(rows[0]?.total ?? 0);
    });
  }

  /** Learners by coins earned (spending in the store does not lower a place). Read in the staff scope; published as names and totals. */
  async coinLeaders(orgId: OrgId, limit = 100): Promise<readonly { readonly learnerId: string; readonly name: string; readonly coins: number }[]> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) =>
      (
        await tx.query<{ learner_id: string; name: string; coins: string }>(
          `SELECT c.learner_id, l.name, sum(c.amount) AS coins
             FROM prep_coins c JOIN learners l ON l.id = c.learner_id
            WHERE c.org_id = $1 AND l.erased_at IS NULL AND c.rule NOT IN ('store', 'store_refund')
            GROUP BY c.learner_id, l.name
           HAVING sum(c.amount) > 0
            ORDER BY coins DESC, min(c.created_at)
            LIMIT $2`,
          [orgId, limit],
        )
      ).map((r) => ({ learnerId: r.learner_id, name: r.name, coins: Number(r.coins) })),
    );
  }

  // --- the plan ---------------------------------------------------------------------------------------

  async activePlan(scope: PracticeScope): Promise<Plan | null> {
    if (scope.actor === "learner" && scope.learnerId === null) return null;
    return scoped(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{
        id: string;
        track_id: string;
        level: PlanLevel;
        deadline: string;
        daily_minutes: number;
        weekend_minutes: number | null;
        off_days: number[];
        goal: string;
        created_at: string | Date;
      }>(
        `SELECT id, track_id, level, to_char(deadline, 'YYYY-MM-DD') AS deadline, daily_minutes, weekend_minutes, off_days, goal, created_at
           FROM prep_plans WHERE org_id = $1 AND learner_id = $2 AND status = 'active'`,
        [scope.orgId, own(scope)],
      );
      const r = rows[0];
      return r === undefined
        ? null
        : {
            id: r.id,
            trackId: r.track_id,
            level: r.level,
            deadline: r.deadline,
            dailyMinutes: Number(r.daily_minutes),
            weekendMinutes: r.weekend_minutes === null ? null : Number(r.weekend_minutes),
            offDays: r.off_days.map(Number),
            goal: r.goal,
            createdAt: iso(r.created_at),
          };
    });
  }

  /** Start a plan with its tasks; a plan already active is archived, with its tasks kept. */
  async startPlan(scope: PracticeScope, plan: PlanDraft, tasks: readonly TaskDraft[]): Promise<string> {
    return scoped(this.#sql, scope, async (tx) => {
      const who = own(scope);
      await tx.query(`UPDATE prep_plans SET status = 'archived' WHERE org_id = $1 AND learner_id = $2 AND status = 'active'`, [scope.orgId, who]);
      const planId = this.#newId();
      await tx.query(
        `INSERT INTO prep_plans (org_id, id, learner_id, track_id, level, deadline, daily_minutes, weekend_minutes, off_days, goal)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [scope.orgId, planId, who, plan.trackId, plan.level, plan.deadline, plan.dailyMinutes, plan.weekendMinutes, [...plan.offDays], plan.goal],
      );
      for (const task of tasks) await this.#insertTask(tx, scope.orgId, planId, who, task);
      return planId;
    });
  }

  /**
   * Change a running plan: its settings, and its open tasks laid out again.
   * Done tasks stay as they were, and so do the learner's own tasks and the
   * revision a sprint quiz set; every other open task gives way to `tasks`.
   */
  async replan(scope: PracticeScope, planId: string, settings: PlanSettings, tasks: readonly TaskDraft[]): Promise<void> {
    await scoped(this.#sql, scope, async (tx) => {
      const who = own(scope);
      const changed = await tx.query(
        `UPDATE prep_plans SET deadline = $4, daily_minutes = $5, weekend_minutes = $6, off_days = $7, late_notified_on = NULL
          WHERE org_id = $1 AND learner_id = $2 AND id = $3 AND status = 'active' RETURNING id`,
        [scope.orgId, who, planId, settings.deadline, settings.dailyMinutes, settings.weekendMinutes, [...settings.offDays]],
      );
      if (changed.length === 0) throw new Error("No such active plan");
      await tx.query(
        `DELETE FROM prep_tasks WHERE org_id = $1 AND learner_id = $2 AND plan_id = $3 AND done_at IS NULL
            AND kind <> 'custom' AND NOT (kind = 'revise' AND item_id IS NOT NULL)`,
        [scope.orgId, who, planId],
      );
      for (const task of tasks) await this.#insertTask(tx, scope.orgId, planId, who, task);
    });
  }

  /** Record that the learner is told their plan runs late; false when they were told within the week before `today`. */
  async noteLate(scope: PracticeScope, planId: string, today: string): Promise<boolean> {
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query(
          `UPDATE prep_plans SET late_notified_on = $4::date
            WHERE org_id = $1 AND learner_id = $2 AND id = $3 AND status = 'active'
              AND (late_notified_on IS NULL OR late_notified_on <= $4::date - 7)
           RETURNING id`,
          [scope.orgId, own(scope), planId, today],
        )
      ).length > 0,
    );
  }

  async archivePlan(scope: PracticeScope): Promise<void> {
    await scoped(this.#sql, scope, (tx) =>
      tx.query(`UPDATE prep_plans SET status = 'archived' WHERE org_id = $1 AND learner_id = $2 AND status = 'active'`, [scope.orgId, own(scope)]),
    );
  }

  async #insertTask(tx: SqlExecutor, orgId: OrgId, planId: string, learnerId: string, task: TaskDraft): Promise<string> {
    const id = this.#newId();
    await tx.query(
      `INSERT INTO prep_tasks (org_id, id, plan_id, learner_id, day, sprint, position, kind, item_id, title, est_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [orgId, id, planId, learnerId, task.day, task.sprint, task.position, task.kind, task.itemId, task.title, task.estMinutes],
    );
    return id;
  }

  async addTask(scope: PracticeScope, planId: string, task: TaskDraft): Promise<string> {
    return scoped(this.#sql, scope, (tx) => this.#insertTask(tx, scope.orgId, planId, own(scope), task));
  }

  async tasks(scope: PracticeScope, planId: string): Promise<readonly Task[]> {
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<TaskRow>(`SELECT ${TASK_COLUMNS} FROM prep_tasks WHERE org_id = $1 AND plan_id = $2 AND learner_id = $3 ORDER BY day, position`, [
          scope.orgId,
          planId,
          own(scope),
        ])
      ).map(toTask),
    );
  }

  /** Move tasks to new days; the first day each was planned for is kept. */
  async moveTasks(scope: PracticeScope, moves: readonly { readonly id: string; readonly day: string; readonly position: number; readonly sprint: number }[]): Promise<void> {
    if (moves.length === 0) return;
    await scoped(this.#sql, scope, async (tx) => {
      for (const m of moves) {
        await tx.query(
          `UPDATE prep_tasks SET rescheduled_from = coalesce(rescheduled_from, day), day = $4, position = $5, sprint = $6
            WHERE org_id = $1 AND learner_id = $2 AND id = $3 AND done_at IS NULL`,
          [scope.orgId, own(scope), m.id, m.day, m.position, m.sprint],
        );
      }
    });
  }

  /** Mark a task done, or undo it. False when there is no such task. */
  async setTaskDone(scope: PracticeScope, id: string, at: Date | null): Promise<boolean> {
    return scoped(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ id: string }>(`UPDATE prep_tasks SET done_at = $4 WHERE org_id = $1 AND learner_id = $2 AND id = $3 RETURNING id`, [
        scope.orgId,
        own(scope),
        id,
        at,
      ]);
      return rows.length > 0;
    });
  }

  /** Mark done every open task of the active plan for a track item: solving a problem does its task. */
  async completeItem(scope: PracticeScope, itemId: string, at: Date): Promise<number> {
    return scoped(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ id: string }>(
        `UPDATE prep_tasks t SET done_at = $4
           FROM prep_plans p
          WHERE t.org_id = $1 AND t.learner_id = $2 AND t.item_id = $3 AND t.done_at IS NULL
            AND p.org_id = t.org_id AND p.id = t.plan_id AND p.status = 'active'
          RETURNING t.id`,
        [scope.orgId, own(scope), itemId, at],
      );
      return rows.length;
    });
  }

  // --- focus sessions ------------------------------------------------------------------------------

  async startFocus(scope: PracticeScope, taskId: string | null, at: Date): Promise<string> {
    return scoped(this.#sql, scope, async (tx) => {
      const who = own(scope);
      // One session at a time: starting another ends any left open.
      await tx.query(
        `UPDATE prep_focus SET ended_at = $3, seconds = greatest(0, extract(epoch FROM ($3 - started_at))::int)
          WHERE org_id = $1 AND learner_id = $2 AND ended_at IS NULL`,
        [scope.orgId, who, at],
      );
      const id = this.#newId();
      await tx.query(`INSERT INTO prep_focus (org_id, id, learner_id, task_id, started_at) VALUES ($1, $2, $3, $4, $5)`, [scope.orgId, id, who, taskId, at]);
      return id;
    });
  }

  /** End a session. Null when there is no such open session. */
  async stopFocus(scope: PracticeScope, id: string, at: Date): Promise<number | null> {
    return scoped(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ seconds: number }>(
        `UPDATE prep_focus SET ended_at = $4, seconds = greatest(0, least(extract(epoch FROM ($4 - started_at))::int, 43200))
          WHERE org_id = $1 AND learner_id = $2 AND id = $3 AND ended_at IS NULL RETURNING seconds`,
        [scope.orgId, own(scope), id, at],
      );
      return rows[0] === undefined ? null : Number(rows[0].seconds);
    });
  }

  /** Seconds of focus by IST day, since a day. */
  async focusByDay(scope: PracticeScope, since: string): Promise<readonly { readonly day: string; readonly seconds: number }[]> {
    if (scope.actor === "learner" && scope.learnerId === null) return [];
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<{ day: string; seconds: string }>(
          `SELECT to_char(started_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day, sum(seconds) AS seconds
             FROM prep_focus WHERE org_id = $1 AND learner_id = $2 AND seconds IS NOT NULL
              AND (started_at AT TIME ZONE 'Asia/Kolkata')::date >= $3::date
            GROUP BY 1 ORDER BY 1`,
          [scope.orgId, own(scope), since],
        )
      ).map((r) => ({ day: r.day, seconds: Number(r.seconds) })),
    );
  }
}
