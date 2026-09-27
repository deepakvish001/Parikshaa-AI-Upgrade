-- Staff sign-in, finished (ROADMAP §1): password reset, a second factor, and
-- single sign-on against an institution's own identity provider.

-- --- a second factor ----------------------------------------------------------

-- The TOTP secret, sealed by the server (AES-256-GCM under a key derived from
-- its secret), never in the clear: a copy of this table produces no codes.
-- `pending` holds a secret being set up until its first code proves the
-- authenticator has it; only then does it become the account's.
ALTER TABLE staff_users ADD COLUMN totp_secret         text;
ALTER TABLE staff_users ADD COLUMN totp_pending_secret text;
ALTER TABLE staff_users ADD COLUMN totp_enabled_at     timestamptz;
-- The last 30-second step a code was accepted for. A code is good for one
-- sign-in: seen twice, the second is a replay.
ALTER TABLE staff_users ADD COLUMN totp_last_step      bigint;

-- One-time recovery codes, for a lost phone. Stored as SHA-256 digests.
CREATE TABLE staff_recovery_codes (
  user_id    text        NOT NULL REFERENCES staff_users (id),
  code_hash  text        NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, code_hash)
);

-- An organisation may insist its owners use a second factor. An owner who has
-- none is then held to setting one up before anything else.
ALTER TABLE organisations ADD COLUMN require_owner_2fa boolean NOT NULL DEFAULT false;

-- --- password reset -------------------------------------------------------------

-- A request to reset a password. The link's secret is derived (an HMAC of the
-- id under the server's key), not stored, as invitation codes are. One use,
-- one hour.
CREATE TABLE password_resets (
  id         text        PRIMARY KEY,
  user_id    text        NOT NULL REFERENCES staff_users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);

CREATE INDEX password_resets_user_idx ON password_resets (user_id, created_at);

-- --- single sign-on -------------------------------------------------------------

-- One OpenID Connect provider per organisation: Google Workspace, Microsoft
-- Entra ID, Okta, Keycloak — anything that publishes a discovery document.
-- The client secret is sealed as the TOTP secrets are.
CREATE TABLE sso_configs (
  org_id          text        PRIMARY KEY REFERENCES organisations (id),
  issuer          text        NOT NULL,
  client_id       text        NOT NULL,
  client_secret   text        NOT NULL,
  -- Only addresses at these domains may sign in this way. Empty: any address
  -- that already belongs to a member of staff.
  email_domains   jsonb       NOT NULL DEFAULT '[]',
  -- When on, staff other than owners can sign in only through the provider.
  -- Owners keep their password, so a broken provider cannot lock everyone out.
  enforced        boolean     NOT NULL DEFAULT false,
  enabled         boolean     NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON staff_recovery_codes, password_resets, sso_configs TO parikshaa_app;
-- Recovery codes are replaced wholesale when a factor is set up or removed.
GRANT DELETE ON staff_recovery_codes TO parikshaa_app;

-- Reset links go out through the outbox like everything else, as staff mail:
-- the row names the reset, and the message is built at send time.
ALTER TABLE outbox DROP CONSTRAINT IF EXISTS outbox_kind_check;
ALTER TABLE outbox ADD CONSTRAINT outbox_kind_check
  CHECK (kind IN ('email', 'sms', 'webhook', 'greenhouse', 'staff_email'));
