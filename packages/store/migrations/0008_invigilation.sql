-- Live invigilation (ROADMAP §8): announcements to a whole sitting.
--
-- Not in any attempt's ledger — an announcement is said to everyone at once,
-- not something that happened to one candidate — but audited, and kept, so
-- what the room was told can be shown later.

CREATE TABLE announcements (
  org_id      text        NOT NULL,
  id          text        NOT NULL,
  exam_id     text        NOT NULL,
  message     text        NOT NULL CHECK (length(message) BETWEEN 1 AND 500),
  -- The staff member, as named at the time.
  author_name text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, exam_id) REFERENCES exams (org_id, id)
);

CREATE INDEX announcements_exam_idx ON announcements (org_id, exam_id, created_at);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON announcements AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));

-- Staff read and write; a candidate reads those for the exam they are sitting.
CREATE POLICY announcements_staff ON announcements
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
CREATE POLICY announcements_candidate_read ON announcements FOR SELECT
  USING (
    current_setting('parikshaa.actor', true) = 'candidate'
    AND EXISTS (
      SELECT 1 FROM attempts a
       WHERE a.org_id = announcements.org_id
         AND a.id = current_setting('parikshaa.attempt_id', true)
         AND a.exam_id = announcements.exam_id
    )
  );

GRANT SELECT, INSERT ON announcements TO parikshaa_app;
