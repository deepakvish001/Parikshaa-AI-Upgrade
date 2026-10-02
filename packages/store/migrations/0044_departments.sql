-- Departments (docs/PREP-TRACKER.md, CL4 and CL6): a university's colleges or
-- a college's departments, as a name on staff and on exams. A member of staff
-- with a department, other than an owner, sees in the exam list only their
-- department's exams and those with none.

CREATE TABLE staff_departments (
  org_id      text NOT NULL,
  user_id     text NOT NULL,
  department  text NOT NULL CHECK (char_length(department) BETWEEN 1 AND 100),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE exam_departments (
  org_id      text NOT NULL,
  exam_id     text NOT NULL,
  department  text NOT NULL CHECK (char_length(department) BETWEEN 1 AND 100),
  PRIMARY KEY (org_id, exam_id)
);

ALTER TABLE staff_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON staff_departments AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY staff_departments_staff ON staff_departments
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
GRANT SELECT, INSERT, UPDATE, DELETE ON staff_departments TO parikshaa_app;

ALTER TABLE exam_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON exam_departments AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY exam_departments_staff ON exam_departments
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
GRANT SELECT, INSERT, UPDATE, DELETE ON exam_departments TO parikshaa_app;
