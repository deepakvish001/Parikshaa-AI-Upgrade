-- Marking by hand (docs/PILOT.md, "After"): a person reads each written
-- answer after the model has marked it, and keeps the mark or changes it. A
-- changed mark is a `score_revised` entry in the ledger; this table records
-- only that an answer has been read, and by whom, so the queue knows where a
-- marker left off and two markers do not read the same answer twice.

CREATE TABLE mark_reviews (
  org_id       text        NOT NULL,
  attempt_id   text        NOT NULL,
  question_id  text        NOT NULL,
  exam_id      text        NOT NULL,
  reviewed_by  text        NOT NULL,
  reviewed_at  timestamptz NOT NULL,
  PRIMARY KEY (org_id, attempt_id, question_id),
  FOREIGN KEY (org_id, attempt_id) REFERENCES attempts (org_id, id)
);

CREATE INDEX mark_reviews_exam ON mark_reviews (org_id, exam_id, question_id);

ALTER TABLE mark_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON mark_reviews AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY mark_reviews_staff ON mark_reviews
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

GRANT SELECT, INSERT, UPDATE, DELETE ON mark_reviews TO parikshaa_app;
