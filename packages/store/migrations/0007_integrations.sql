-- Integrations (ROADMAP §7): outbound webhooks, and Greenhouse's assessment
-- partner API.
--
-- No secret is stored here. A webhook's signing secret and an organisation's
-- Greenhouse key are derived on the server from its own secret and the ids
-- below, the way invitation codes are; `version` is what changes when one is
-- rotated. Deliveries are outbox rows (0006), which is also the delivery log.

CREATE TABLE webhooks (
  org_id      text        NOT NULL REFERENCES organisations (id),
  id          text        NOT NULL,
  url         text        NOT NULL CHECK (url ~ '^https?://'),
  -- Event names, e.g. 'attempt.graded'. Empty means every event.
  events      text[]      NOT NULL DEFAULT '{}',
  version     integer     NOT NULL DEFAULT 1,
  description text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  PRIMARY KEY (org_id, id)
);

CREATE TABLE greenhouse_settings (
  org_id      text        PRIMARY KEY REFERENCES organisations (id),
  key_version integer     NOT NULL DEFAULT 1,
  enabled     boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- A test Greenhouse sent: which invitation it became, and where to say it is done.
CREATE TABLE greenhouse_interviews (
  org_id         text        NOT NULL,
  invitation_id  text        NOT NULL,
  application_id text        NOT NULL,
  profile_url    text,
  complete_url   text        NOT NULL,
  sent_by        text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, invitation_id),
  FOREIGN KEY (org_id, invitation_id) REFERENCES invitations (org_id, id)
);

ALTER TABLE webhooks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE greenhouse_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE greenhouse_interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON webhooks AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY webhooks_staff ON webhooks
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

CREATE POLICY tenant_isolation ON greenhouse_settings AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY greenhouse_settings_staff ON greenhouse_settings
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

CREATE POLICY tenant_isolation ON greenhouse_interviews AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY greenhouse_interviews_staff ON greenhouse_interviews
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

GRANT SELECT, INSERT, UPDATE ON webhooks, greenhouse_settings, greenhouse_interviews TO parikshaa_app;
