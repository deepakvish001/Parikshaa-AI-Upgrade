-- Supabase lockdown (docs/LAUNCH-PLAN.md §4, F0).
--
-- Supabase gives its public API roles, `anon` and `authenticated`, every
-- privilege on tables created in `public`, and serves them over its Data API
-- to anyone holding the project's publishable key. Parikshaa never uses that
-- API: the server connects as `parikshaa_app` and does its own auth. So both
-- roles lose every privilege here, and on whatever later migrations create.
-- Row-level security would already refuse them most rows; this makes the
-- answer "no table at all" rather than "no rows".
--
-- On plain Postgres (no such roles) this does nothing.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END
$$;
