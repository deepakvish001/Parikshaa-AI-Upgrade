-- DPDP (ROADMAP §11): per-attempt data keys, an organisation's privacy
-- settings, and the record of what has been erased.

-- One data key per attempt, wrapped with the key-encryption key held outside
-- the database. The ledger's personal fields are sealed under it; erasing an
-- attempt's personal data sets wrapped_key to NULL, after which those fields
-- cannot be read by anyone while the chain still verifies.
CREATE TABLE attempt_keys (
  org_id      text        NOT NULL,
  attempt_id  text        NOT NULL,
  wrapped_key text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  erased_at   timestamptz,
  PRIMARY KEY (org_id, attempt_id),
  FOREIGN KEY (org_id, attempt_id) REFERENCES attempts (org_id, id),
  CHECK ((wrapped_key IS NULL) = (erased_at IS NOT NULL))
);

ALTER TABLE attempt_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON attempt_keys AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY attempt_keys_staff ON attempt_keys
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
-- A candidate's own writes seal under their own attempt's key, and nothing else's.
CREATE POLICY attempt_keys_candidate ON attempt_keys FOR SELECT
  USING (current_setting('parikshaa.actor', true) = 'candidate'
         AND attempt_id = current_setting('parikshaa.attempt_id', true));

-- What a candidate is told before they start, and how long their data is kept.
CREATE TABLE privacy_settings (
  org_id          text        PRIMARY KEY REFERENCES organisations (id),
  -- The data fiduciary, as the notice names it.
  controller_name text        NOT NULL,
  grievance_name  text        NOT NULL,
  grievance_email text        NOT NULL,
  purpose         text        NOT NULL,
  retention_days  integer     NOT NULL DEFAULT 180 CHECK (retention_days BETWEEN 7 AND 3650),
  -- Moves on whenever the notice's wording changes, so a consent records which one was agreed to.
  notice_version  integer     NOT NULL DEFAULT 1,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE privacy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON privacy_settings AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY privacy_settings_staff ON privacy_settings
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

ALTER TABLE attempts ADD COLUMN erased_at timestamptz;
ALTER TABLE attempts ADD COLUMN erasure_reason text CHECK (erasure_reason IN ('retention', 'request'));

GRANT SELECT, INSERT, UPDATE ON attempt_keys, privacy_settings TO parikshaa_app;
GRANT DELETE ON answer_drafts TO parikshaa_app;
