-- Community v2 (Prep blueprint F14, S5).
--
-- Learners flag a published interview experience they think is fake, rude or
-- about the wrong company. Each learner flags one once; at three open flags
-- the write-up is held (out of sight) until staff keep or remove it.
--
-- Success stories: a learner who got placed writes how, staff publish it.
-- Company logos: an image staff upload, kept here (small, so no file store).

ALTER TABLE prep_experiences DROP CONSTRAINT IF EXISTS prep_experiences_status_check;
ALTER TABLE prep_experiences ADD CONSTRAINT prep_experiences_status_check CHECK (status IN ('pending', 'published', 'rejected', 'held'));

CREATE TABLE prep_experience_flags (
  org_id        text        NOT NULL REFERENCES organisations (id),
  experience_id text        NOT NULL,
  learner_id    text        NOT NULL REFERENCES learners (id),
  reason        text        NOT NULL CHECK (reason IN ('fake', 'offensive', 'wrong_company', 'other')),
  note          text        NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Set when staff decide the write-up: kept or removed.
  resolved_at   timestamptz,
  PRIMARY KEY (org_id, experience_id, learner_id),
  FOREIGN KEY (org_id, experience_id) REFERENCES prep_experiences (org_id, id)
);

CREATE TABLE prep_stories (
  org_id       text        NOT NULL REFERENCES organisations (id),
  id           text        NOT NULL,
  learner_id   text        NOT NULL REFERENCES learners (id),
  company      text        NOT NULL CHECK (length(company) BETWEEN 1 AND 120),
  role         text        NOT NULL CHECK (length(role) BETWEEN 1 AND 120),
  story        text        NOT NULL CHECK (length(story) BETWEEN 50 AND 3000),
  -- As the author chose to be named: their name, or 'Anonymous'.
  author_name  text        NOT NULL,
  status       text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
  reviewed_by  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  PRIMARY KEY (org_id, id)
);
CREATE INDEX prep_stories_status_idx ON prep_stories (org_id, status, published_at DESC);

CREATE TABLE prep_company_logos (
  org_id      text        NOT NULL REFERENCES organisations (id),
  company_id  text        NOT NULL,
  mime        text        NOT NULL CHECK (mime IN ('image/png', 'image/jpeg', 'image/webp')),
  bytes       bytea       NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 102400),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, company_id),
  FOREIGN KEY (org_id, company_id) REFERENCES prep_companies (org_id, id)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['prep_experience_flags', 'prep_stories', 'prep_company_logos']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I AS RESTRICTIVE
      USING (org_id = current_setting('parikshaa.org_id', true))
      WITH CHECK (org_id = current_setting('parikshaa.org_id', true))$p$, t);
    EXECUTE format($p$CREATE POLICY %s_staff ON %I
      USING (current_setting('parikshaa.actor', true) = 'staff')
      WITH CHECK (current_setting('parikshaa.actor', true) = 'staff')$p$, t, t);
  END LOOP;
  -- A learner reads their own flags and stories, and published stories and logos; the server writes, in the staff scope.
  CREATE POLICY prep_experience_flags_own ON prep_experience_flags FOR SELECT
    USING (current_setting('parikshaa.actor', true) = 'learner' AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''));
  CREATE POLICY prep_stories_learner ON prep_stories FOR SELECT
    USING (current_setting('parikshaa.actor', true) = 'learner'
           AND (status = 'published' OR learner_id = nullif(current_setting('parikshaa.learner_id', true), '')));
  CREATE POLICY prep_company_logos_learner ON prep_company_logos FOR SELECT USING (current_setting('parikshaa.actor', true) = 'learner');
END $$;

GRANT SELECT, INSERT, UPDATE ON prep_experience_flags, prep_stories TO parikshaa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON prep_company_logos TO parikshaa_app;
