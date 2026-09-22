-- Multi-tenancy, staff identity, audit, and model usage.
--
-- Until now there was one staff token for the whole deployment and no tenant
-- column anywhere: one server per customer. Every row that belongs to a
-- customer now carries an `org_id`, and isolation is enforced twice — by every
-- query naming its organisation, and by row-level security that refuses rows
-- from any other organisation even if a query forgets to.

CREATE TABLE organisations (
  id                   text        PRIMARY KEY,
  name                 text        NOT NULL,
  -- Ceiling on model spend per calendar month, in micro-dollars so the
  -- arithmetic stays exact. NULL means no ceiling.
  monthly_spend_cap_micro_usd bigint CHECK (monthly_spend_cap_micro_usd >= 0),
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Everything written before tenancy belongs to one organisation.
INSERT INTO organisations (id, name) VALUES ('default', 'Default organisation');

-- --- tenant columns ---------------------------------------------------------

ALTER TABLE exams       ADD COLUMN org_id text NOT NULL DEFAULT 'default' REFERENCES organisations (id);
ALTER TABLE attempts    ADD COLUMN org_id text NOT NULL DEFAULT 'default' REFERENCES organisations (id);
ALTER TABLE exam_ledger ADD COLUMN org_id text NOT NULL DEFAULT 'default' REFERENCES organisations (id);

ALTER TABLE exams       ALTER COLUMN org_id DROP DEFAULT;
ALTER TABLE attempts    ALTER COLUMN org_id DROP DEFAULT;
ALTER TABLE exam_ledger ALTER COLUMN org_id DROP DEFAULT;

-- Exam ids are chosen by their authors, so two organisations will pick the same
-- one. With a global key, the second organisation's upsert would have
-- overwritten the first's exam. The key is now per organisation.
ALTER TABLE attempts DROP CONSTRAINT attempts_exam_id_fkey;
ALTER TABLE exams    DROP CONSTRAINT exams_pkey;
ALTER TABLE exams    ADD PRIMARY KEY (org_id, id);
ALTER TABLE attempts ADD CONSTRAINT attempts_exam_fkey
  FOREIGN KEY (org_id, exam_id) REFERENCES exams (org_id, id);

-- A ledger row's organisation must be its attempt's organisation. Enforced by
-- the key rather than trusted to the writer.
ALTER TABLE attempts ADD CONSTRAINT attempts_org_id_id_unique UNIQUE (org_id, id);
ALTER TABLE exam_ledger ADD CONSTRAINT exam_ledger_attempt_org_fkey
  FOREIGN KEY (org_id, attempt_id) REFERENCES attempts (org_id, id);

CREATE INDEX attempts_org_exam_idx ON attempts (org_id, exam_id);

-- --- staff identity ---------------------------------------------------------

CREATE TABLE staff_users (
  id            text        PRIMARY KEY,
  org_id        text        NOT NULL REFERENCES organisations (id),
  email         text        NOT NULL,
  name          text        NOT NULL,
  role          text        NOT NULL CHECK (role IN ('owner', 'author', 'invigilator', 'reviewer', 'viewer')),
  password_hash text        NOT NULL,
  disabled_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One account per address. Someone who works for two organisations uses two.
CREATE UNIQUE INDEX staff_users_email_idx ON staff_users (lower(email));

CREATE TABLE staff_sessions (
  -- The bearer token is never stored, only its SHA-256. A copy of this table is
  -- not a set of working sessions.
  token_hash text        PRIMARY KEY,
  user_id    text        NOT NULL REFERENCES staff_users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX staff_sessions_user_idx ON staff_sessions (user_id);

CREATE TABLE api_keys (
  id           text        PRIMARY KEY,
  org_id       text        NOT NULL REFERENCES organisations (id),
  name         text        NOT NULL,
  key_hash     text        NOT NULL UNIQUE,
  role         text        NOT NULL CHECK (role IN ('author', 'invigilator', 'reviewer', 'viewer')),
  created_by   text        REFERENCES staff_users (id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

-- --- audit ------------------------------------------------------------------

CREATE TABLE audit_log (
  id         text        PRIMARY KEY,
  org_id     text        NOT NULL REFERENCES organisations (id),
  at         timestamptz NOT NULL DEFAULT now(),
  actor_kind text        NOT NULL CHECK (actor_kind IN ('user', 'api_key', 'system')),
  actor_id   text,
  action     text        NOT NULL,
  target     text,
  detail     jsonb       NOT NULL DEFAULT '{}'
);

CREATE INDEX audit_log_org_at_idx ON audit_log (org_id, at DESC);

-- The audit log is append-only for the same reason the ledger is: a record of
-- who did what that can be edited records nothing.
CREATE FUNCTION audit_log_reject_mutation() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only; % is not permitted', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_reject_mutation();

-- --- model usage (ROADMAP §0) -------------------------------------------------

CREATE TABLE model_usage (
  id                 text        PRIMARY KEY,
  org_id             text        NOT NULL REFERENCES organisations (id),
  attempt_id         text        REFERENCES attempts (id),
  route              text        NOT NULL CHECK (route IN ('probe', 'assess', 'grade')),
  model              text        NOT NULL,
  speed              text        NOT NULL DEFAULT 'standard' CHECK (speed IN ('standard', 'fast')),
  input_tokens       integer     NOT NULL,
  output_tokens      integer     NOT NULL,
  cache_read_tokens  integer     NOT NULL DEFAULT 0,
  -- Split by TTL because they are priced differently: 1.25x for five minutes,
  -- 2x for an hour. Whether the hour is earning its premium is one of the
  -- questions this table exists to answer.
  cache_write_5m_tokens integer  NOT NULL DEFAULT 0,
  cache_write_1h_tokens integer  NOT NULL DEFAULT 0,
  cost_micro_usd     bigint      NOT NULL CHECK (cost_micro_usd >= 0),
  -- Where the provider reports the inference ran. Recorded so that a claim
  -- about data residency (STACK.md §5) can be checked against what happened,
  -- rather than asserted.
  inference_geo      text,
  at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX model_usage_org_at_idx ON model_usage (org_id, at);
CREATE INDEX model_usage_attempt_idx ON model_usage (attempt_id);

-- --- row-level security -----------------------------------------------------
--
-- A restrictive policy is ANDed with everything else: whatever else a policy
-- allows, a row from another organisation is never visible and never
-- writable. `parikshaa.org_id` is set per transaction by the store.
--
-- Identity tables (organisations, staff_users, staff_sessions, api_keys) are
-- deliberately outside this: they are read to *establish* an organisation, at
-- login, before one exists to scope by. Only the authentication layer touches
-- them.

ALTER TABLE exams       ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON exams AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY tenant_access ON exams USING (true) WITH CHECK (true);

CREATE POLICY tenant_isolation ON attempts AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY tenant_access ON attempts USING (true) WITH CHECK (true);

CREATE POLICY tenant_isolation ON audit_log AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY tenant_access ON audit_log USING (true) WITH CHECK (true);

CREATE POLICY tenant_isolation ON model_usage AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY tenant_access ON model_usage USING (true) WITH CHECK (true);

-- The ledger already has a candidate policy (their own attempt) and an append
-- policy. Tenancy is added as a restriction on top, and staff get read access
-- within their organisation.
CREATE POLICY tenant_isolation ON exam_ledger AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY exam_ledger_staff_read ON exam_ledger FOR SELECT
  USING (current_setting('parikshaa.actor', true) = 'staff');

-- --- grants -----------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON organisations, staff_users, staff_sessions, api_keys TO parikshaa_app;
GRANT SELECT, INSERT ON audit_log, model_usage TO parikshaa_app;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM parikshaa_app;
