-- After results (docs/PILOT.md, "After"): a candidate sees their marks once
-- their institution releases them, and may ask for one or more questions to
-- be looked at again. A person answers each request; a changed mark goes into
-- the attempt's ledger as `score_revised`, so the change is on the record the
-- candidate can check, and this table only keeps the conversation.

-- Which exams' results candidates may see, and whether with the outcome.
CREATE TABLE result_releases (
  org_id       text        NOT NULL,
  exam_id      text        NOT NULL,
  outcome      boolean     NOT NULL,
  released_at  timestamptz NOT NULL,
  PRIMARY KEY (org_id, exam_id)
);

ALTER TABLE result_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON result_releases AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY result_releases_read ON result_releases FOR SELECT USING (true);
CREATE POLICY result_releases_write ON result_releases FOR INSERT WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
CREATE POLICY result_releases_change ON result_releases FOR UPDATE
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
GRANT SELECT, INSERT, UPDATE ON result_releases TO parikshaa_app;

CREATE TABLE recheck_requests (
  org_id          text        NOT NULL,
  id              text        NOT NULL,
  attempt_id      text        NOT NULL,
  exam_id         text        NOT NULL,
  question_id     text        NOT NULL,
  reason          text        NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
  status          text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'changed', 'unchanged')),
  score_before    numeric,
  score_after     numeric,
  reply           text        CHECK (char_length(reply) <= 1000),
  decided_by      text,
  decided_at      timestamptz,
  created_at      timestamptz NOT NULL,
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, attempt_id, question_id),
  FOREIGN KEY (org_id, attempt_id) REFERENCES attempts (org_id, id)
);

CREATE INDEX recheck_requests_exam ON recheck_requests (org_id, exam_id, status);

ALTER TABLE recheck_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON recheck_requests AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));

-- A candidate asks about, and reads, their own attempt only; staff answer.
CREATE POLICY recheck_requests_candidate ON recheck_requests FOR SELECT
  USING (current_setting('parikshaa.actor', true) = 'staff' OR attempt_id = current_setting('parikshaa.attempt_id', true));
CREATE POLICY recheck_requests_ask ON recheck_requests FOR INSERT
  WITH CHECK (attempt_id = current_setting('parikshaa.attempt_id', true) AND status = 'open' AND decided_at IS NULL);
CREATE POLICY recheck_requests_answer ON recheck_requests FOR UPDATE
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
-- Erasing an attempt's personal data deletes its requests: a reason can say anything.
CREATE POLICY recheck_requests_erase ON recheck_requests FOR DELETE
  USING (current_setting('parikshaa.actor', true) = 'staff');

GRANT SELECT, INSERT, UPDATE, DELETE ON recheck_requests TO parikshaa_app;
