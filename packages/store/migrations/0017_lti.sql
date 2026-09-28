-- Moodle, and any other LMS, through LTI 1.3 (ROADMAP §7, universities).
--
-- A platform is an LMS an organisation registers: its issuer, the client id it
-- gave this tool, and where its sign-in, token and key endpoints are. Like
-- the identity tables it sits outside tenant row-level security: a launch
-- arrives from the LMS with nothing but the issuer and client id to find the
-- organisation by. It holds no personal data.
--
-- The tool's own RSA key, which signs its requests to the LMS's token
-- endpoint, is per platform and sealed by the server; its public half is
-- served as a JWKS for the LMS to fetch.
CREATE TABLE lti_platforms (
  id               text        PRIMARY KEY,
  org_id           text        NOT NULL REFERENCES organisations (id),
  name             text        NOT NULL,
  issuer           text        NOT NULL,
  client_id        text        NOT NULL,
  -- Deployments of the tool on the platform to accept. Empty: any.
  deployment_ids   jsonb       NOT NULL DEFAULT '[]',
  auth_login_url   text        NOT NULL,
  auth_token_url   text        NOT NULL,
  jwks_url         text        NOT NULL,
  tool_kid         text        NOT NULL,
  tool_private_key text        NOT NULL,
  enabled          boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issuer, client_id)
);

CREATE INDEX lti_platforms_org_idx ON lti_platforms (org_id);

-- A learner an LMS launched into an exam: which invitation they became, who
-- they are there, and the grade-book column to write their result to.
CREATE TABLE lti_launches (
  org_id        text        NOT NULL,
  invitation_id text        NOT NULL,
  platform_id   text        NOT NULL REFERENCES lti_platforms (id),
  subject       text        NOT NULL,
  resource_link text        NOT NULL,
  lineitem      text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, invitation_id),
  FOREIGN KEY (org_id, invitation_id) REFERENCES invitations (org_id, id)
);

ALTER TABLE lti_launches ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON lti_launches AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY lti_launches_staff ON lti_launches
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

GRANT SELECT, INSERT, UPDATE ON lti_platforms, lti_launches TO parikshaa_app;

ALTER TABLE outbox DROP CONSTRAINT IF EXISTS outbox_kind_check;
ALTER TABLE outbox ADD CONSTRAINT outbox_kind_check
  CHECK (kind IN ('email', 'sms', 'webhook', 'greenhouse', 'staff_email', 'learner_email', 'ats', 'lti'));
