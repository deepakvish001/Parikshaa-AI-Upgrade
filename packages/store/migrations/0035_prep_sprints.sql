-- The end of a sprint, and a day off (Prep blueprint F7, 13.2).
--
-- A sprint's quiz asks the sprint's questions that can be checked at once
-- (choices and numbers); each sitting is kept. Below 70%, the questions got
-- wrong come back as revision. A streak freeze marks a day the learner took
-- off on purpose: it neither counts toward the streak nor breaks it.

CREATE TABLE prep_sprint_quizzes (
  org_id     text        NOT NULL REFERENCES organisations (id),
  id         text        NOT NULL,
  learner_id text        NOT NULL REFERENCES learners (id),
  plan_id    text        NOT NULL,
  sprint     integer     NOT NULL CHECK (sprint >= 1),
  score      integer     NOT NULL CHECK (score >= 0),
  total      integer     NOT NULL CHECK (total > 0 AND score <= total),
  -- Problem id to whether it was answered right.
  results    jsonb       NOT NULL,
  taken_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, plan_id) REFERENCES prep_plans (org_id, id)
);

CREATE INDEX prep_sprint_quizzes_idx ON prep_sprint_quizzes (org_id, learner_id, plan_id, sprint);

CREATE TABLE prep_freezes (
  org_id     text        NOT NULL REFERENCES organisations (id),
  learner_id text        NOT NULL REFERENCES learners (id),
  day        date        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, learner_id, day)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['prep_sprint_quizzes', 'prep_freezes']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I AS RESTRICTIVE
      USING (org_id = current_setting('parikshaa.org_id', true))
      WITH CHECK (org_id = current_setting('parikshaa.org_id', true))$p$, t);
    EXECUTE format($p$CREATE POLICY %s_staff ON %I
      USING (current_setting('parikshaa.actor', true) = 'staff')
      WITH CHECK (current_setting('parikshaa.actor', true) = 'staff')$p$, t, t);
    EXECUTE format($p$CREATE POLICY %s_own ON %I
      USING (current_setting('parikshaa.actor', true) = 'learner'
             AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''))
      WITH CHECK (current_setting('parikshaa.actor', true) = 'learner'
             AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''))$p$, t, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT ON prep_sprint_quizzes, prep_freezes TO parikshaa_app;
