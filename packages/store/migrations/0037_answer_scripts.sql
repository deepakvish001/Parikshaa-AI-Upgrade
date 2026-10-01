-- Handwritten answer copies (docs/PREP-TRACKER.md, V2-12: CL24, CL25). A
-- paper exam is set in Parikshaa (its questions and marks), sat on paper,
-- and each candidate's copy is scanned in as pages. The model reads the
-- pages and suggests marks per question with its reasons; a faculty member
-- checks them and the marks they enter are the marks. A second examiner may
-- then moderate: their marks are kept beside the first, and a gap wider
-- than the exam's tolerance marks the copy disputed until it is resolved.

CREATE TABLE answer_scripts (
  org_id          text        NOT NULL,
  id              text        NOT NULL,
  exam_id         text        NOT NULL,
  candidate_ref   text        NOT NULL CHECK (char_length(candidate_ref) BETWEEN 1 AND 100),
  candidate_name  text        NOT NULL DEFAULT '' CHECK (char_length(candidate_name) <= 200),
  status          text        NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'checked', 'moderated', 'disputed')),
  suggestion      jsonb,
  marks           jsonb,
  checked_by      text,
  checked_at      timestamptz,
  moderation      jsonb,
  final_total     numeric,
  uploaded_by     text        NOT NULL,
  created_at      timestamptz NOT NULL,
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, exam_id, candidate_ref)
);

CREATE TABLE answer_script_pages (
  org_id     text    NOT NULL,
  script_id  text    NOT NULL,
  page       integer NOT NULL CHECK (page BETWEEN 1 AND 60),
  mime       text    NOT NULL CHECK (mime IN ('image/png', 'image/jpeg', 'image/gif', 'image/webp')),
  bytes      bytea   NOT NULL,
  PRIMARY KEY (org_id, script_id, page),
  FOREIGN KEY (org_id, script_id) REFERENCES answer_scripts (org_id, id) ON DELETE CASCADE
);

ALTER TABLE answer_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON answer_scripts AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY answer_scripts_staff ON answer_scripts
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
GRANT SELECT, INSERT, UPDATE, DELETE ON answer_scripts TO parikshaa_app;

ALTER TABLE answer_script_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON answer_script_pages AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY answer_script_pages_staff ON answer_script_pages
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
GRANT SELECT, INSERT, DELETE ON answer_script_pages TO parikshaa_app;
