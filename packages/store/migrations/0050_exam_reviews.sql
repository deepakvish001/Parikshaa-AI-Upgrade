-- A paper's review (docs/PREP-TRACKER.md, CL60): its setter sends it for
-- review; someone else — the head of department — approves it or returns it
-- with a comment; an approved paper is locked against change until an owner
-- reopens it. One row per exam, its history in the audit log.

CREATE TABLE exam_reviews (
  org_id          text        NOT NULL,
  exam_id         text        NOT NULL,
  status          text        NOT NULL CHECK (status IN ('in_review', 'approved', 'returned', 'reopened')),
  submitted_by    text        NOT NULL,
  submitted_by_id text        NOT NULL,
  submitted_at    timestamptz NOT NULL,
  note            text        NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  reviewer        text,
  decided_at      timestamptz,
  comment         text        NOT NULL DEFAULT '' CHECK (char_length(comment) <= 2000),
  PRIMARY KEY (org_id, exam_id)
);

ALTER TABLE exam_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON exam_reviews AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY exam_reviews_staff ON exam_reviews
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
GRANT SELECT, INSERT, UPDATE ON exam_reviews TO parikshaa_app;
