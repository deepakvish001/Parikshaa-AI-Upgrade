-- Nothing a candidate does is lost (ROADMAP §2).
--
-- Drafts are the text a candidate has typed but not yet committed. They are
-- deliberately NOT in the ledger: autosave fires every few seconds, and a chain
-- of every keystroke pause would bury the record, and would lock the first
-- half-typed answer on an exam that forbids revision. The ledger records what
-- was committed; drafts are what the server holds so that a crash, a dead
-- battery or a lost connection costs nothing. On submission, and when the
-- window closes, outstanding drafts saved in time are committed to the ledger.

CREATE TABLE answer_drafts (
  org_id      text   NOT NULL,
  attempt_id  text   NOT NULL,
  question_id text   NOT NULL,
  answer      text   NOT NULL,
  -- Server clock, milliseconds, like the ledger's own timestamps. Compared
  -- against the attempt's deadline, so it is never taken from the client.
  saved_at    bigint NOT NULL,
  PRIMARY KEY (org_id, attempt_id, question_id),
  FOREIGN KEY (org_id, attempt_id) REFERENCES attempts (org_id, id)
);

ALTER TABLE answer_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON answer_drafts AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));

-- A candidate reaches only their own attempt's drafts; staff, within the
-- organisation, reach any (the server commits them on a candidate's behalf).
CREATE POLICY answer_drafts_access ON answer_drafts
  USING (
    current_setting('parikshaa.actor', true) = 'staff'
    OR attempt_id = current_setting('parikshaa.attempt_id', true)
  )
  WITH CHECK (
    current_setting('parikshaa.actor', true) = 'staff'
    OR attempt_id = current_setting('parikshaa.attempt_id', true)
  );

GRANT SELECT, INSERT, UPDATE ON answer_drafts TO parikshaa_app;

-- When the candidate's page last checked in. An invigilator's "who is actually
-- here" — operational state, not evidence, so it is a column and not a ledger
-- entry.
ALTER TABLE attempts ADD COLUMN last_seen_at timestamptz;
