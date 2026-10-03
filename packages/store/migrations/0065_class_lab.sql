-- A class's lab record (docs/PREP-TRACKER.md plan row 96): each coding problem
-- of the class's course is a practical, the student's latest accepted program
-- is their write-up, and a teacher signs it off here.
CREATE TABLE class_lab_signoffs (
  org_id     text        NOT NULL,
  class_id   text        NOT NULL,
  email      text        NOT NULL CHECK (email = lower(email)),
  problem_id text        NOT NULL,
  signed_by  text        NOT NULL,
  signed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, class_id, email, problem_id),
  FOREIGN KEY (org_id, class_id) REFERENCES classes (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, problem_id) REFERENCES practice_problems (org_id, id)
);

ALTER TABLE class_lab_signoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON class_lab_signoffs AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY class_lab_signoffs_staff ON class_lab_signoffs
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

GRANT SELECT, INSERT, DELETE ON class_lab_signoffs TO parikshaa_app;
