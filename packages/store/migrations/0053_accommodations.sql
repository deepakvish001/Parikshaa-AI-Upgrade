-- Arrangements for a candidate with a disability (docs/PREP-TRACKER.md,
-- V2-12: CL62), as the RPwD Act 2016 and the exam bodies' guidelines ask:
-- compensatory time (commonly 20 minutes an hour), a scribe, larger text. Set
-- per candidate on an exam by staff; the extra time goes into the attempt's
-- ledger when it starts, with who granted it. The note may name a condition,
-- so it is kept sealed.

CREATE TABLE accommodations (
  org_id         text        NOT NULL,
  exam_id        text        NOT NULL,
  candidate_ref  text        NOT NULL CHECK (char_length(candidate_ref) BETWEEN 1 AND 100),
  extra_percent  integer     NOT NULL DEFAULT 0 CHECK (extra_percent BETWEEN 0 AND 100),
  scribe         boolean     NOT NULL DEFAULT false,
  large_text     boolean     NOT NULL DEFAULT false,
  note           text        NOT NULL DEFAULT '' CHECK (char_length(note) <= 4000),
  set_by_id      text        NOT NULL,
  set_by_name    text        NOT NULL,
  set_at         timestamptz NOT NULL,
  PRIMARY KEY (org_id, exam_id, candidate_ref)
);

ALTER TABLE accommodations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON accommodations AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY accommodations_staff ON accommodations
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
GRANT SELECT, INSERT, UPDATE, DELETE ON accommodations TO parikshaa_app;
