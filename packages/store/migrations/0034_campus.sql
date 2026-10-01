-- Campus licences (Prep blueprint F16): a college buys Plus for a batch of
-- students. Staff make a cohort (the college or batch, and how many days of
-- Plus it gives) and add its students by email, from a CSV.
--
-- A student whose verified account has that email gets Plus at once; anyone
-- else gets it when an account with that email is verified (by the link in
-- the email, or by Google). Each address is given Plus once per cohort: the
-- grant's own key, `cohort:<id>:<email>`, keeps it so.
--
-- Only staff read or write these: a learner sees the Plus, not the list.

CREATE TABLE prep_cohorts (
  org_id     text        NOT NULL REFERENCES organisations (id),
  id         text        NOT NULL,
  name       text        NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  plus_days  integer     NOT NULL CHECK (plus_days BETWEEN 1 AND 1100),
  created_by text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id)
);
CREATE UNIQUE INDEX prep_cohorts_name_idx ON prep_cohorts (org_id, lower(name));

CREATE TABLE prep_cohort_members (
  org_id     text        NOT NULL,
  cohort_id  text        NOT NULL,
  email      text        NOT NULL CHECK (email = lower(email)),
  learner_id text        REFERENCES learners (id),
  granted_at timestamptz,
  plus_until timestamptz,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, cohort_id, email),
  FOREIGN KEY (org_id, cohort_id) REFERENCES prep_cohorts (org_id, id)
);
CREATE INDEX prep_cohort_members_email_idx ON prep_cohort_members (org_id, email) WHERE granted_at IS NULL;

ALTER TABLE prep_cohorts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON prep_cohorts AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY prep_cohorts_staff ON prep_cohorts
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

ALTER TABLE prep_cohort_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON prep_cohort_members AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY prep_cohort_members_staff ON prep_cohort_members
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

GRANT SELECT, INSERT ON prep_cohorts TO parikshaa_app;
GRANT SELECT, INSERT, UPDATE ON prep_cohort_members TO parikshaa_app;
