-- Role grants.
--
-- Run separately from the schema migration: these reference deployment roles
-- that exist outside the application's own migration history.
--
--   parikshaa_owner  — owns the schema, runs migrations. Not used at runtime.
--   parikshaa_app    — the application's runtime role. Can append and read.
--                      It cannot UPDATE or DELETE ledger rows at all, so a bug
--                      in a handler cannot rewrite the record even before the
--                      append-only trigger gets a chance to object.

-- Created here if absent so a fresh cluster can be brought up from the
-- migrations alone. Roles are cluster-wide, so this is a no-op wherever a DBA
-- has already provisioned them. NOLOGIN by default: deployment grants LOGIN and
-- a credential, which do not belong in version control.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parikshaa_app') THEN
    CREATE ROLE parikshaa_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parikshaa_owner') THEN
    CREATE ROLE parikshaa_owner NOLOGIN;
  END IF;
END
$$;

GRANT SELECT, INSERT ON exam_ledger TO parikshaa_app;
REVOKE UPDATE, DELETE, TRUNCATE ON exam_ledger FROM parikshaa_app;

GRANT SELECT, INSERT, UPDATE ON exams, attempts TO parikshaa_app;

-- The runtime role is subject to row-level security; the owner bypasses it for
-- migrations and for the appeals tooling, which must read any attempt.
ALTER TABLE exam_ledger FORCE ROW LEVEL SECURITY;

CREATE POLICY exam_ledger_app_append ON exam_ledger
  FOR INSERT TO parikshaa_app
  WITH CHECK (true);
