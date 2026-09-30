-- Lab mode (docs/PILOT.md, "A sitting in a lab"): an exam taken only from
-- the college's own network, and optionally started for everyone at once by
-- the invigilator.
--
-- Not in the ledger: it is how the room is run, set and changed on the day,
-- not part of the paper or of any candidate's record. Changes are audited.

CREATE TABLE exam_lab (
  org_id          text        NOT NULL,
  exam_id         text        NOT NULL,
  -- IP addresses and CIDR ranges a candidate may take the exam from; empty
  -- means anywhere.
  networks        text[]      NOT NULL DEFAULT '{}' CHECK (cardinality(networks) <= 50),
  -- Candidates wait at the start until an invigilator starts the sitting.
  start_together  boolean     NOT NULL DEFAULT false,
  started_at      timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, exam_id)
);

ALTER TABLE exam_lab ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON exam_lab AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));

-- A candidate's requests read it, to be let in or not; only staff change it.
CREATE POLICY exam_lab_read ON exam_lab FOR SELECT USING (true);
CREATE POLICY exam_lab_write ON exam_lab FOR INSERT WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
CREATE POLICY exam_lab_change ON exam_lab FOR UPDATE
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

GRANT SELECT, INSERT, UPDATE ON exam_lab TO parikshaa_app;
