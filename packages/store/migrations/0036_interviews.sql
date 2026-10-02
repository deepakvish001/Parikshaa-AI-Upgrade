-- The interview room (docs/PREP-TRACKER.md, V2-12: CO26, CO28). An interview
-- has a time, a video call link (any provider, or a generated Jitsi room),
-- the problem the interviewer sets, the candidate's code as they type it,
-- the interviewer's notes, and a structured scorecard. The candidate joins
-- by a link whose code is derived from the server's secret, not stored.

CREATE TABLE interviews (
  org_id           text        NOT NULL,
  id               text        NOT NULL,
  title            text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  candidate_ref    text        NOT NULL DEFAULT '' CHECK (char_length(candidate_ref) <= 100),
  candidate_name   text        NOT NULL CHECK (char_length(candidate_name) BETWEEN 1 AND 200),
  candidate_email  text        CHECK (char_length(candidate_email) <= 320),
  interviewer      text        NOT NULL,
  scheduled_at     timestamptz NOT NULL,
  minutes          integer     NOT NULL CHECK (minutes BETWEEN 10 AND 240),
  meeting_url      text        NOT NULL CHECK (char_length(meeting_url) <= 500),
  problem          text        NOT NULL DEFAULT '' CHECK (char_length(problem) <= 20000),
  language         text        NOT NULL DEFAULT 'python' CHECK (char_length(language) <= 20),
  code             text        NOT NULL DEFAULT '' CHECK (char_length(code) <= 100000),
  code_updated_at  timestamptz,
  notes            text        NOT NULL DEFAULT '' CHECK (char_length(notes) <= 20000),
  scorecard        jsonb,
  status           text        NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'done', 'cancelled')),
  drive_id         text,
  created_at       timestamptz NOT NULL,
  PRIMARY KEY (org_id, id)
);

CREATE INDEX interviews_when ON interviews (org_id, scheduled_at);

ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON interviews AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY interviews_staff ON interviews
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
GRANT SELECT, INSERT, UPDATE ON interviews TO parikshaa_app;
