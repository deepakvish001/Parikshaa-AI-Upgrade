-- Catching a proxy (docs/PREP-TRACKER.md, V2-12 CO30): someone sitting the
-- test for someone else. Two kinds of evidence, neither a finding by itself:
--
-- Where each attempt was opened from: a keyed hash of the network address
-- and a hash of the browser's description, never the address itself. Two
-- candidates from the same network and browser at once is worth a look.
--
-- What the model saw comparing a candidate's identity photos with the
-- photos taken while they answered: the same face throughout, someone else,
-- or another person in the frame. A person decides.

CREATE TABLE attempt_origins (
  org_id         text        NOT NULL,
  attempt_id     text        NOT NULL,
  exam_id        text        NOT NULL,
  candidate_ref  text        NOT NULL,
  network        text        NOT NULL,
  device         text        NOT NULL,
  first_at       timestamptz NOT NULL,
  last_at        timestamptz NOT NULL,
  PRIMARY KEY (org_id, attempt_id, network, device)
);
CREATE INDEX attempt_origins_exam ON attempt_origins (org_id, exam_id);

CREATE TABLE identity_checks (
  org_id      text        NOT NULL,
  attempt_id  text        NOT NULL,
  exam_id     text        NOT NULL,
  result      jsonb       NOT NULL,
  flagged     boolean     NOT NULL,
  checked_by  text        NOT NULL,
  checked_at  timestamptz NOT NULL,
  PRIMARY KEY (org_id, attempt_id)
);
CREATE INDEX identity_checks_exam ON identity_checks (org_id, exam_id);

ALTER TABLE attempt_origins ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON attempt_origins AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY attempt_origins_staff ON attempt_origins
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
GRANT SELECT, INSERT, UPDATE, DELETE ON attempt_origins TO parikshaa_app;

ALTER TABLE identity_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON identity_checks AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY identity_checks_staff ON identity_checks
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
GRANT SELECT, INSERT, UPDATE, DELETE ON identity_checks TO parikshaa_app;
