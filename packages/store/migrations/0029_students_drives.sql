-- A placement cell's own records (docs/PREP-TRACKER.md, V2-12: CL8, CL52).
-- Students are entered once, with what eligibility is decided on, and each
-- recruitment drive keeps who it reached and how far each student got. A
-- drive's test is an ordinary exam: its candidates are invited under their
-- roll numbers, so the ledger, results and receipts are those of any exam.

CREATE TABLE students (
  org_id      text        NOT NULL,
  ref         text        NOT NULL CHECK (char_length(ref) BETWEEN 1 AND 100),
  name        text        NOT NULL DEFAULT '' CHECK (char_length(name) <= 200),
  email       text        CHECK (char_length(email) <= 320),
  phone       text        CHECK (phone ~ '^91[6-9][0-9]{9}$'),
  branch      text        NOT NULL DEFAULT '' CHECK (char_length(branch) <= 100),
  batch       integer     CHECK (batch BETWEEN 1990 AND 2100),
  cgpa        numeric(4,2) CHECK (cgpa BETWEEN 0 AND 10),
  backlogs    integer     NOT NULL DEFAULT 0 CHECK (backlogs BETWEEN 0 AND 100),
  created_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL,
  PRIMARY KEY (org_id, ref)
);

CREATE INDEX students_branch ON students (org_id, batch, branch);

CREATE TABLE drives (
  org_id       text        NOT NULL,
  id           text        NOT NULL,
  company      text        NOT NULL CHECK (char_length(company) BETWEEN 1 AND 200),
  role         text        NOT NULL CHECK (char_length(role) BETWEEN 1 AND 200),
  ctc_lpa      numeric(6,2) CHECK (ctc_lpa >= 0),
  location     text        NOT NULL DEFAULT '' CHECK (char_length(location) <= 200),
  description  text        NOT NULL DEFAULT '' CHECK (char_length(description) <= 20000),
  -- { minCgpa, maxBacklogs, branches: [], batches: [] }; an absent key means no limit.
  eligibility  jsonb       NOT NULL DEFAULT '{}',
  apply_by     date,
  exam_id      text,
  status       text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at   timestamptz NOT NULL,
  updated_at   timestamptz NOT NULL,
  PRIMARY KEY (org_id, id)
);

CREATE TABLE drive_applications (
  org_id       text        NOT NULL,
  drive_id     text        NOT NULL,
  student_ref  text        NOT NULL,
  stage        text        NOT NULL DEFAULT 'applied'
               CHECK (stage IN ('applied', 'test', 'interview', 'offered', 'joined', 'rejected', 'withdrawn')),
  offer_lpa    numeric(6,2) CHECK (offer_lpa >= 0),
  updated_by   text        NOT NULL,
  updated_at   timestamptz NOT NULL,
  PRIMARY KEY (org_id, drive_id, student_ref),
  FOREIGN KEY (org_id, drive_id) REFERENCES drives (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, student_ref) REFERENCES students (org_id, ref) ON DELETE CASCADE
);

CREATE INDEX drive_applications_student ON drive_applications (org_id, student_ref);

-- Staff only: nothing here is read by a candidate or a learner.
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON students AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY students_staff ON students
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

ALTER TABLE drives ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON drives AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY drives_staff ON drives
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

ALTER TABLE drive_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON drive_applications AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY drive_applications_staff ON drive_applications
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

GRANT SELECT, INSERT, UPDATE, DELETE ON students, drives, drive_applications TO parikshaa_app;
