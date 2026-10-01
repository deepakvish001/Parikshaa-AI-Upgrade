-- A learner's public profile (Prep blueprint S7, C6): `/u/<username>` on
-- their site, shown only when they turn it on. A profile names the learner
-- by their name and username alone, never their email.

CREATE TABLE prep_profiles (
  org_id      text        NOT NULL REFERENCES organisations (id),
  learner_id  text        NOT NULL REFERENCES learners (id),
  username    text        NOT NULL CHECK (username ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  public      boolean     NOT NULL DEFAULT false,
  bio         text        NOT NULL DEFAULT '' CHECK (length(bio) <= 200),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, learner_id)
);
CREATE UNIQUE INDEX prep_profiles_username ON prep_profiles (org_id, username);

ALTER TABLE prep_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON prep_profiles AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY prep_profiles_staff ON prep_profiles
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
-- A learner reads their own; the server writes it, and reads a public one, in the staff scope.
CREATE POLICY prep_profiles_own ON prep_profiles FOR SELECT
  USING (current_setting('parikshaa.actor', true) = 'learner'
         AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON prep_profiles TO parikshaa_app;
