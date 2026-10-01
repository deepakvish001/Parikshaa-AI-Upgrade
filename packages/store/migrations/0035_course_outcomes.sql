-- Course outcomes for accreditation (docs/PREP-TRACKER.md, V2-12 CL47): which
-- course outcomes (CO1, CO2, …) each question of an exam assesses, how
-- strongly each CO maps to each programme outcome (PO1…PO12, PSOs), and the
-- percentage of a CO's marks that counts as attaining it. Attainment itself is
-- computed from the exam's results, never stored.

CREATE TABLE exam_outcomes (
  org_id      text        NOT NULL,
  exam_id     text        NOT NULL,
  -- { "<question id>": ["CO1", "CO3"] }
  mapping     jsonb       NOT NULL DEFAULT '{}',
  -- { "CO1": { "PO1": 3, "PO2": 2 } }, strengths 1 to 3
  matrix      jsonb       NOT NULL DEFAULT '{}',
  threshold   integer     NOT NULL DEFAULT 60 CHECK (threshold BETWEEN 1 AND 100),
  updated_at  timestamptz NOT NULL,
  PRIMARY KEY (org_id, exam_id)
);

ALTER TABLE exam_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON exam_outcomes AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY exam_outcomes_staff ON exam_outcomes
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
GRANT SELECT, INSERT, UPDATE, DELETE ON exam_outcomes TO parikshaa_app;
