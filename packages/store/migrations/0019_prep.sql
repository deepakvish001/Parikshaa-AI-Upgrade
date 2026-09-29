-- Prep (ROADMAP §16): what turns a practice site into a place to prepare —
-- tracks of lessons and problems, a study plan that schedules them, revision
-- that brings solved problems back, notes, saved lists, a problem of the day,
-- and coins for keeping at it.
--
-- Everything here belongs to a practice site's organisation and sits behind the
-- same tenant row-level security. A learner reads what is published and reads
-- and writes only rows in their own name (`parikshaa.learner_id`); staff manage
-- the content. Coins are a ledger: rows are added, never changed, and each
-- carries a key so the same reward is never paid twice.

-- --- content: tracks, their modules and items, and lessons -------------------------

CREATE TABLE prep_lessons (
  org_id      text        NOT NULL REFERENCES organisations (id),
  id          text        NOT NULL,
  slug        text        NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$'),
  title       text        NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  -- Markdown.
  body        text        NOT NULL DEFAULT '' CHECK (length(body) <= 200000),
  -- A link to the lesson's video, played where it is hosted; empty for none.
  video_url   text        NOT NULL DEFAULT '' CHECK (video_url = '' OR video_url ~ '^https://'),
  est_minutes integer     NOT NULL DEFAULT 15 CHECK (est_minutes BETWEEN 1 AND 600),
  published   boolean     NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, slug)
);

CREATE TABLE prep_tracks (
  org_id      text        NOT NULL REFERENCES organisations (id),
  id          text        NOT NULL,
  slug        text        NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$'),
  title       text        NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  description text        NOT NULL DEFAULT '' CHECK (length(description) <= 20000),
  position    integer     NOT NULL DEFAULT 0,
  published   boolean     NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, slug)
);

CREATE TABLE prep_modules (
  org_id   text    NOT NULL REFERENCES organisations (id),
  id       text    NOT NULL,
  track_id text    NOT NULL,
  title    text    NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  position integer NOT NULL,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, track_id) REFERENCES prep_tracks (org_id, id) ON DELETE CASCADE
);

CREATE INDEX prep_modules_track_idx ON prep_modules (org_id, track_id, position);

-- One step of a module: a problem of the site's, or a lesson.
CREATE TABLE prep_items (
  org_id     text    NOT NULL REFERENCES organisations (id),
  id         text    NOT NULL,
  module_id  text    NOT NULL,
  position   integer NOT NULL,
  problem_id text,
  lesson_id  text,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, module_id) REFERENCES prep_modules (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, problem_id) REFERENCES practice_problems (org_id, id),
  FOREIGN KEY (org_id, lesson_id) REFERENCES prep_lessons (org_id, id),
  CHECK ((problem_id IS NULL) <> (lesson_id IS NULL))
);

CREATE INDEX prep_items_module_idx ON prep_items (org_id, module_id, position);

-- --- the problem of the day --------------------------------------------------------

CREATE TABLE prep_potd (
  org_id     text NOT NULL REFERENCES organisations (id),
  -- A day in India Standard Time.
  day        date NOT NULL,
  problem_id text NOT NULL,
  PRIMARY KEY (org_id, day),
  FOREIGN KEY (org_id, problem_id) REFERENCES practice_problems (org_id, id)
);

-- --- a learner's own ------------------------------------------------------------------

CREATE TABLE prep_lessons_done (
  org_id     text        NOT NULL REFERENCES organisations (id),
  learner_id text        NOT NULL REFERENCES learners (id),
  lesson_id  text        NOT NULL,
  done_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, learner_id, lesson_id),
  FOREIGN KEY (org_id, lesson_id) REFERENCES prep_lessons (org_id, id)
);

-- Problems a learner keeps, in lists they name; "Bookmarks" is one like any other.
CREATE TABLE prep_saved (
  org_id     text        NOT NULL REFERENCES organisations (id),
  learner_id text        NOT NULL REFERENCES learners (id),
  list       text        NOT NULL CHECK (length(list) BETWEEN 1 AND 60),
  problem_id text        NOT NULL,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, learner_id, list, problem_id),
  FOREIGN KEY (org_id, problem_id) REFERENCES practice_problems (org_id, id)
);

-- A note on a problem, a lesson, or a topic the learner names.
CREATE TABLE prep_notes (
  org_id     text        NOT NULL REFERENCES organisations (id),
  learner_id text        NOT NULL REFERENCES learners (id),
  ref_kind   text        NOT NULL CHECK (ref_kind IN ('problem', 'lesson', 'topic')),
  ref_id     text        NOT NULL CHECK (length(ref_id) BETWEEN 1 AND 120),
  title      text        NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  body       text        NOT NULL CHECK (length(body) <= 50000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, learner_id, ref_kind, ref_id)
);

-- Spaced revision: one card per solved problem.
CREATE TABLE prep_cards (
  org_id        text        NOT NULL REFERENCES organisations (id),
  learner_id    text        NOT NULL REFERENCES learners (id),
  problem_id    text        NOT NULL,
  due_on        date        NOT NULL,
  interval_days integer     NOT NULL CHECK (interval_days >= 1),
  ease          numeric(4,2) NOT NULL CHECK (ease >= 1.3),
  reps          integer     NOT NULL DEFAULT 0,
  last_grade    text        CHECK (last_grade IN ('again', 'hard', 'good', 'easy')),
  reviewed_at   timestamptz,
  PRIMARY KEY (org_id, learner_id, problem_id),
  FOREIGN KEY (org_id, problem_id) REFERENCES practice_problems (org_id, id)
);

CREATE INDEX prep_cards_due_idx ON prep_cards (org_id, learner_id, due_on);

-- The coin ledger. `key` names the reward: the same key is never paid twice.
CREATE TABLE prep_coins (
  org_id     text        NOT NULL REFERENCES organisations (id),
  id         text        NOT NULL,
  learner_id text        NOT NULL REFERENCES learners (id),
  rule       text        NOT NULL,
  amount     integer     NOT NULL CHECK (amount <> 0),
  key        text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, learner_id, key)
);

CREATE INDEX prep_coins_learner_idx ON prep_coins (org_id, learner_id, created_at DESC);

-- --- the study plan ------------------------------------------------------------------

CREATE TABLE prep_plans (
  org_id        text        NOT NULL REFERENCES organisations (id),
  id            text        NOT NULL,
  learner_id    text        NOT NULL REFERENCES learners (id),
  track_id      text        NOT NULL,
  level         text        NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  deadline      date        NOT NULL,
  daily_minutes integer     NOT NULL CHECK (daily_minutes BETWEEN 15 AND 720),
  -- Days of the week with no study: 0 is Sunday.
  off_days      integer[]   NOT NULL DEFAULT '{}',
  goal          text        NOT NULL DEFAULT '' CHECK (length(goal) <= 200),
  status        text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, track_id) REFERENCES prep_tracks (org_id, id)
);

-- One active plan per learner.
CREATE UNIQUE INDEX prep_plans_active_idx ON prep_plans (org_id, learner_id) WHERE status = 'active';

CREATE TABLE prep_tasks (
  org_id           text        NOT NULL REFERENCES organisations (id),
  id               text        NOT NULL,
  plan_id          text        NOT NULL,
  learner_id       text        NOT NULL REFERENCES learners (id),
  day              date        NOT NULL,
  sprint           integer     NOT NULL CHECK (sprint >= 1),
  position         integer     NOT NULL,
  kind             text        NOT NULL CHECK (kind IN ('learn', 'practice', 'revise', 'custom')),
  item_id          text,
  title            text        NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  est_minutes      integer     NOT NULL CHECK (est_minutes BETWEEN 1 AND 600),
  done_at          timestamptz,
  -- The day it was first planned for, when it has been moved on because it was not done.
  rescheduled_from date,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, plan_id) REFERENCES prep_plans (org_id, id)
);

CREATE INDEX prep_tasks_plan_idx ON prep_tasks (org_id, plan_id, day, position);

CREATE TABLE prep_focus (
  org_id     text        NOT NULL REFERENCES organisations (id),
  id         text        NOT NULL,
  learner_id text        NOT NULL REFERENCES learners (id),
  task_id    text,
  started_at timestamptz NOT NULL,
  ended_at   timestamptz,
  seconds    integer     CHECK (seconds >= 0),
  PRIMARY KEY (org_id, id)
);

CREATE INDEX prep_focus_learner_idx ON prep_focus (org_id, learner_id, started_at DESC);

-- --- row-level security -----------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['prep_lessons', 'prep_tracks', 'prep_modules', 'prep_items', 'prep_potd',
                           'prep_lessons_done', 'prep_saved', 'prep_notes', 'prep_cards', 'prep_coins',
                           'prep_plans', 'prep_tasks', 'prep_focus']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I AS RESTRICTIVE
      USING (org_id = current_setting('parikshaa.org_id', true))
      WITH CHECK (org_id = current_setting('parikshaa.org_id', true))$p$, t);
    EXECUTE format($p$CREATE POLICY %s_staff ON %I
      USING (current_setting('parikshaa.actor', true) = 'staff')
      WITH CHECK (current_setting('parikshaa.actor', true) = 'staff')$p$, t, t);
  END LOOP;

  -- Content: a learner, or a visitor, reads what is published.
  CREATE POLICY prep_lessons_learner ON prep_lessons FOR SELECT
    USING (current_setting('parikshaa.actor', true) = 'learner' AND published);
  CREATE POLICY prep_tracks_learner ON prep_tracks FOR SELECT
    USING (current_setting('parikshaa.actor', true) = 'learner' AND published);
  CREATE POLICY prep_modules_learner ON prep_modules FOR SELECT
    USING (current_setting('parikshaa.actor', true) = 'learner');
  CREATE POLICY prep_items_learner ON prep_items FOR SELECT
    USING (current_setting('parikshaa.actor', true) = 'learner');
  CREATE POLICY prep_potd_learner ON prep_potd FOR SELECT
    USING (current_setting('parikshaa.actor', true) = 'learner');

  -- A learner's own rows: theirs to read and write, nobody else's.
  FOREACH t IN ARRAY ARRAY['prep_lessons_done', 'prep_saved', 'prep_notes', 'prep_cards', 'prep_plans', 'prep_tasks', 'prep_focus']
  LOOP
    EXECUTE format($p$CREATE POLICY %s_own ON %I
      USING (current_setting('parikshaa.actor', true) = 'learner'
             AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''))
      WITH CHECK (current_setting('parikshaa.actor', true) = 'learner'
             AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''))$p$, t, t);
  END LOOP;

  -- Coins: a learner reads their own; only the server, in the staff scope, pays them.
  CREATE POLICY prep_coins_own ON prep_coins FOR SELECT
    USING (current_setting('parikshaa.actor', true) = 'learner'
           AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''));
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON prep_lessons, prep_tracks, prep_modules, prep_items, prep_potd,
  prep_lessons_done, prep_saved, prep_notes, prep_cards, prep_plans, prep_tasks, prep_focus TO parikshaa_app;
-- The ledger is only ever added to.
GRANT SELECT, INSERT ON prep_coins TO parikshaa_app;
