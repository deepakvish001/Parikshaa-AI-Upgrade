-- How the test went, in the candidate's words (docs/PILOT.md: what to learn
-- from a pilot). Asked once, after submitting, and optional.
--
-- Not in the ledger: it is about the experience of sitting the test, not
-- evidence of how it was answered, and it must never be read as part of the
-- attempt's record. Staff see it without the candidate's name. Erasing an
-- attempt's personal data deletes it, since a comment can say anything.

CREATE TABLE attempt_feedback (
  org_id      text        NOT NULL,
  attempt_id  text        NOT NULL,
  rating      smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text        CHECK (char_length(comment) <= 1000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, attempt_id),
  FOREIGN KEY (org_id, attempt_id) REFERENCES attempts (org_id, id)
);

ALTER TABLE attempt_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON attempt_feedback AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));

-- A candidate gives feedback on their own attempt only; staff read their
-- organisation's.
CREATE POLICY attempt_feedback_access ON attempt_feedback
  USING (
    current_setting('parikshaa.actor', true) = 'staff'
    OR attempt_id = current_setting('parikshaa.attempt_id', true)
  )
  WITH CHECK (
    current_setting('parikshaa.actor', true) = 'staff'
    OR attempt_id = current_setting('parikshaa.attempt_id', true)
  );

GRANT SELECT, INSERT, DELETE ON attempt_feedback TO parikshaa_app;
