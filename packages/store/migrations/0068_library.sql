-- The Parikshaa Library (docs/F1-GO-LIVE-PLAN.md §4, G2): questions written
-- by Parikshaa that every company and college can take into its own bank.
--
-- The library is Parikshaa's, not any organisation's, so it has no org_id:
-- every member of staff reads it, and only Parikshaa's operators change it
-- (the API decides who that is). Taking a question copies it into the bank,
-- with a note of which version was taken, so a company may change its copy
-- and a later fix to the library changes no exam already built.
CREATE TABLE library_questions (
  id          text        PRIMARY KEY,
  version     integer     NOT NULL DEFAULT 1 CHECK (version >= 1),
  section     text        NOT NULL CHECK (section IN ('aptitude', 'cs', 'programming', 'dsa', 'sql', 'frontend')),
  topic       text        NOT NULL,
  difficulty  text        NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  tags        text[]      NOT NULL DEFAULT '{}',
  -- The question itself, answer key included; its `id` equals this row's id.
  question    jsonb       NOT NULL,
  -- Why the answer is right, or the approaches: for the person choosing it.
  explanation text        NOT NULL DEFAULT '',
  -- open: also on practice sites, so learners may have seen it; hire: never shown to learners.
  tier        text        NOT NULL DEFAULT 'open' CHECK (tier IN ('open', 'hire')),
  source      text        NOT NULL,
  -- How many organisations have taken it: a question many have used is likely known.
  exposure    integer     NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  retired_at  timestamptz
);
CREATE INDEX library_questions_section_idx ON library_questions (section, topic) WHERE retired_at IS NULL;

-- Answer keys: staff only, never a candidate's scope.
ALTER TABLE library_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY library_questions_staff ON library_questions
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
GRANT SELECT, INSERT, UPDATE ON library_questions TO parikshaa_app;

-- What an organisation took, and into which bank question.
CREATE TABLE library_adoptions (
  org_id           text        NOT NULL REFERENCES organisations (id),
  library_id       text        NOT NULL REFERENCES library_questions (id),
  version          integer     NOT NULL,
  bank_question_id text        NOT NULL,
  added_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, library_id),
  FOREIGN KEY (org_id, bank_question_id) REFERENCES bank_questions (org_id, id)
);

ALTER TABLE library_adoptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON library_adoptions AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY library_adoptions_staff ON library_adoptions
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
GRANT SELECT, INSERT, UPDATE ON library_adoptions TO parikshaa_app;
