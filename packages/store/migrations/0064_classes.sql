-- Classes (docs/PREP-TRACKER.md plan row 95, F2 Campus): a college's class is
-- a cohort of the practice site's students, a course to work through (one of
-- the site's tracks), the tests and contests set for it, and its sessions
-- with who was present. Staff only: students see their class through the
-- practice site (row 96).
CREATE TABLE classes (
  org_id     text        NOT NULL REFERENCES organisations (id),
  id         text        NOT NULL,
  name       text        NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  cohort_id  text        NOT NULL,
  track_id   text,
  created_by text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, cohort_id) REFERENCES prep_cohorts (org_id, id),
  FOREIGN KEY (org_id, track_id) REFERENCES prep_tracks (org_id, id) ON DELETE SET NULL (track_id)
);
CREATE UNIQUE INDEX classes_name_idx ON classes (org_id, lower(name));

-- The exams set for a class, in the order given.
CREATE TABLE class_tests (
  org_id   text    NOT NULL,
  class_id text    NOT NULL,
  exam_id  text    NOT NULL,
  position integer NOT NULL,
  PRIMARY KEY (org_id, class_id, exam_id),
  FOREIGN KEY (org_id, class_id) REFERENCES classes (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, exam_id) REFERENCES exams (org_id, id)
);

CREATE TABLE class_contests (
  org_id     text    NOT NULL,
  class_id   text    NOT NULL,
  contest_id text    NOT NULL,
  position   integer NOT NULL,
  PRIMARY KEY (org_id, class_id, contest_id),
  FOREIGN KEY (org_id, class_id) REFERENCES classes (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, contest_id) REFERENCES contests (org_id, id)
);

-- A lecture or a lab, on a day, and who was there (by the address the cohort knows them by).
CREATE TABLE class_sessions (
  org_id   text NOT NULL,
  id       text NOT NULL,
  class_id text NOT NULL,
  held_on  date NOT NULL,
  topic    text NOT NULL DEFAULT '' CHECK (length(topic) <= 200),
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, class_id) REFERENCES classes (org_id, id) ON DELETE CASCADE
);
CREATE INDEX class_sessions_class_idx ON class_sessions (org_id, class_id, held_on);

CREATE TABLE class_attendance (
  org_id     text        NOT NULL,
  session_id text        NOT NULL,
  email      text        NOT NULL CHECK (email = lower(email)),
  present    boolean     NOT NULL,
  marked_by  text        NOT NULL,
  marked_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, session_id, email),
  FOREIGN KEY (org_id, session_id) REFERENCES class_sessions (org_id, id) ON DELETE CASCADE
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON classes AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY classes_staff ON classes
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

ALTER TABLE class_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON class_tests AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY class_tests_staff ON class_tests
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

ALTER TABLE class_contests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON class_contests AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY class_contests_staff ON class_contests
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON class_sessions AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY class_sessions_staff ON class_sessions
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

ALTER TABLE class_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON class_attendance AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY class_attendance_staff ON class_attendance
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

GRANT SELECT, INSERT, UPDATE ON classes TO parikshaa_app;
GRANT SELECT, INSERT, DELETE ON class_tests TO parikshaa_app;
GRANT SELECT, INSERT, DELETE ON class_contests TO parikshaa_app;
GRANT SELECT, INSERT, DELETE ON class_sessions TO parikshaa_app;
GRANT SELECT, INSERT, UPDATE ON class_attendance TO parikshaa_app;
