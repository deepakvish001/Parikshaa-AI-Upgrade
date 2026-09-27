-- More applicant-tracking systems (ROADMAP §7): Lever, Zoho Recruit and
-- Darwinbox, beside Greenhouse (0007).
--
-- Each is a connector an owner turns on. Its inbound key — what the ATS
-- presents when it asks for a test — is derived from the server's secret and
-- `key_version`, never stored. What the ATS gave us to call it back (an API
-- key, an OAuth refresh token, a signing token) must be kept to be used, so it
-- is stored sealed under a key derived from the server's secret.

CREATE TABLE ats_connectors (
  org_id      text        NOT NULL REFERENCES organisations (id),
  provider    text        NOT NULL CHECK (provider IN ('lever', 'zoho_recruit', 'darwinbox')),
  enabled     boolean     NOT NULL DEFAULT true,
  key_version integer     NOT NULL DEFAULT 1,
  -- What is not secret: which Lever stage sends which exam, Zoho's data
  -- centre, Darwinbox's callback address.
  settings    jsonb       NOT NULL DEFAULT '{}',
  credentials text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, provider)
);

-- A candidate an ATS sent: which invitation they became, and who they are there.
CREATE TABLE ats_candidates (
  org_id        text        NOT NULL,
  invitation_id text        NOT NULL,
  provider      text        NOT NULL,
  external_id   text        NOT NULL,
  detail        jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, invitation_id),
  FOREIGN KEY (org_id, invitation_id) REFERENCES invitations (org_id, id)
);

CREATE INDEX ats_candidates_external_idx ON ats_candidates (org_id, provider, external_id);

ALTER TABLE ats_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ats_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON ats_connectors AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY ats_connectors_staff ON ats_connectors
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

CREATE POLICY tenant_isolation ON ats_candidates AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY ats_candidates_staff ON ats_candidates
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

GRANT SELECT, INSERT, UPDATE ON ats_connectors, ats_candidates TO parikshaa_app;

ALTER TABLE outbox DROP CONSTRAINT IF EXISTS outbox_kind_check;
ALTER TABLE outbox ADD CONSTRAINT outbox_kind_check
  CHECK (kind IN ('email', 'sms', 'webhook', 'greenhouse', 'staff_email', 'learner_email', 'ats'));
