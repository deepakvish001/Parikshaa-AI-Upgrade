-- Learn v2 (Prep blueprint S3, S4, F8).
--
-- A lesson's quiz: questions from the site's problems that can be checked at
-- once (multiple choice, a number), asked at the end of the lesson. A wrong
-- answer comes back as a revision card.
--
-- A shared solution: a learner's code for a problem, read-only, at a link
-- they hand out. Only the code: never a test.

CREATE TABLE prep_lesson_quiz (
  org_id     text    NOT NULL REFERENCES organisations (id),
  lesson_id  text    NOT NULL,
  position   integer NOT NULL CHECK (position BETWEEN 0 AND 9),
  problem_id text    NOT NULL,
  PRIMARY KEY (org_id, lesson_id, position),
  UNIQUE (org_id, lesson_id, problem_id),
  FOREIGN KEY (org_id, lesson_id) REFERENCES prep_lessons (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, problem_id) REFERENCES practice_problems (org_id, id)
);

CREATE TABLE prep_code_shares (
  org_id     text        NOT NULL REFERENCES organisations (id),
  id         text        NOT NULL CHECK (id ~ '^[A-Za-z0-9_-]{10,24}$'),
  learner_id text        NOT NULL REFERENCES learners (id),
  problem_id text        NOT NULL,
  language   text        NOT NULL CHECK (length(language) BETWEEN 1 AND 40),
  source     text        NOT NULL CHECK (length(source) BETWEEN 1 AND 65536),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, problem_id) REFERENCES practice_problems (org_id, id)
);
CREATE INDEX prep_code_shares_learner_idx ON prep_code_shares (org_id, learner_id, created_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['prep_lesson_quiz', 'prep_code_shares']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I AS RESTRICTIVE
      USING (org_id = current_setting('parikshaa.org_id', true))
      WITH CHECK (org_id = current_setting('parikshaa.org_id', true))$p$, t);
    EXECUTE format($p$CREATE POLICY %s_staff ON %I
      USING (current_setting('parikshaa.actor', true) = 'staff')
      WITH CHECK (current_setting('parikshaa.actor', true) = 'staff')$p$, t, t);
  END LOOP;
  CREATE POLICY prep_lesson_quiz_learner ON prep_lesson_quiz FOR SELECT USING (current_setting('parikshaa.actor', true) = 'learner');
  -- A learner reads their own shares; anyone with the link reads one through the server.
  CREATE POLICY prep_code_shares_own ON prep_code_shares FOR SELECT
    USING (current_setting('parikshaa.actor', true) = 'learner' AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''));
END $$;

GRANT SELECT, INSERT, DELETE ON prep_lesson_quiz TO parikshaa_app;
GRANT SELECT, INSERT ON prep_code_shares TO parikshaa_app;
