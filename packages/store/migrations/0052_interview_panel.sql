-- An interview panel and calendar invites (docs/PREP-TRACKER.md, V2-12: CO27
-- and CO41). An interview names the staff on its panel (the one who set it up
-- first); each of them keeps a scorecard of their own, and the interview's
-- scorecard is the panel's average once every one of them has scored. The
-- calendar invite goes by email to the panel and the candidate through the
-- outbox, which names the interview and the person only.

ALTER TABLE interviews ADD COLUMN panel text[] NOT NULL DEFAULT '{}' CHECK (cardinality(panel) <= 8);

CREATE TABLE interview_scores (
  org_id        text        NOT NULL,
  interview_id  text        NOT NULL,
  user_id       text        NOT NULL,
  name          text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  scorecard     jsonb       NOT NULL,
  scored_at     timestamptz NOT NULL,
  PRIMARY KEY (org_id, interview_id, user_id),
  FOREIGN KEY (org_id, interview_id) REFERENCES interviews (org_id, id) ON DELETE CASCADE
);

ALTER TABLE interview_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON interview_scores AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY interview_scores_staff ON interview_scores
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
GRANT SELECT, INSERT, UPDATE, DELETE ON interview_scores TO parikshaa_app;

ALTER TABLE outbox DROP CONSTRAINT IF EXISTS outbox_kind_check;
ALTER TABLE outbox ADD CONSTRAINT outbox_kind_check
  CHECK (kind IN ('email', 'sms', 'whatsapp', 'webhook', 'greenhouse', 'staff_email', 'learner_email', 'ats', 'lti', 'student', 'interview'));
