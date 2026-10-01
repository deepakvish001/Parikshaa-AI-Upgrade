-- One drive across several colleges (docs/PREP-TRACKER.md, V2-12 CO15). A
-- company's drive names its partner colleges; each has its own link to
-- apply, and whoever applies through it is registered as that college's
-- student, their roll number prefixed by the college's short code so two
-- colleges' roll numbers never meet.

CREATE TABLE drive_colleges (
  org_id      text        NOT NULL,
  drive_id    text        NOT NULL,
  id          text        NOT NULL,
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  code        text        NOT NULL CHECK (code ~ '^[A-Z0-9]{2,12}$'),
  apply_code  text        NOT NULL,
  created_at  timestamptz NOT NULL,
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, drive_id, code),
  UNIQUE (org_id, apply_code),
  FOREIGN KEY (org_id, drive_id) REFERENCES drives (org_id, id) ON DELETE CASCADE
);

ALTER TABLE drive_colleges ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON drive_colleges AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY drive_colleges_staff ON drive_colleges
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
GRANT SELECT, INSERT, DELETE ON drive_colleges TO parikshaa_app;

ALTER TABLE students ADD COLUMN college text CHECK (char_length(college) <= 200);
