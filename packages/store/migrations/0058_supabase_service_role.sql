-- Supabase's secret key acts as `service_role`, which Supabase also gives every
-- privilege on tables in `public`. Parikshaa never uses it for its tables (the
-- server connects as `parikshaa_app`; uploads will use Storage, which has its
-- own schema), so a leaked secret key opens none of them: the same lockdown as
-- 0056, for the third role. On plain Postgres this does nothing.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM service_role;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM service_role;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM service_role;
  END IF;
END
$$;
