-- A daily reminder for a learner with a study plan (Prep blueprint F2): an
-- email at the hour they chose (in IST) when the day's tasks are not done or
-- cards are due to revise. Off until the learner turns it on; every email
-- carries a link that turns it off.
--
-- What the console's analytics count is read from the tables that already
-- record it (sign-ups, solves, lessons, tasks, the tutor, orders, the daily
-- check-in), so nothing needs instrumenting and history counts too. The
-- reminders sent are the one thing nothing else records.

CREATE TABLE prep_reminders (
  org_id     text        NOT NULL REFERENCES organisations (id),
  learner_id text        NOT NULL REFERENCES learners (id),
  enabled    boolean     NOT NULL DEFAULT false,
  -- The hour of the day, in India, the email goes out.
  hour       integer     NOT NULL DEFAULT 19 CHECK (hour BETWEEN 0 AND 23),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, learner_id)
);

CREATE TABLE prep_reminders_sent (
  org_id     text        NOT NULL REFERENCES organisations (id),
  learner_id text        NOT NULL REFERENCES learners (id),
  day        date        NOT NULL,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, learner_id, day)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['prep_reminders', 'prep_reminders_sent']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I AS RESTRICTIVE
      USING (org_id = current_setting('parikshaa.org_id', true))
      WITH CHECK (org_id = current_setting('parikshaa.org_id', true))$p$, t);
    EXECUTE format($p$CREATE POLICY %s_staff ON %I
      USING (current_setting('parikshaa.actor', true) = 'staff')
      WITH CHECK (current_setting('parikshaa.actor', true) = 'staff')$p$, t, t);
  END LOOP;
  -- A learner sets their own reminder.
  CREATE POLICY prep_reminders_own ON prep_reminders
    USING (current_setting('parikshaa.actor', true) = 'learner'
           AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''))
    WITH CHECK (current_setting('parikshaa.actor', true) = 'learner'
           AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''));
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON prep_reminders TO parikshaa_app;
GRANT SELECT, INSERT ON prep_reminders_sent TO parikshaa_app;
