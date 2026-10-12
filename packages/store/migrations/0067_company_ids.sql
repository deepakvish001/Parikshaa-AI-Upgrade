-- Company IDs and pausing an account (docs/F1-GO-LIVE-PLAN.md §3, G1).
--
-- Every organisation gets a short public ID, PKC- and six characters of
-- Crockford's base 32 (no I, L, O or U, so it reads aloud and copies without
-- mistakes): what an invoice, a support call and the operator's panel name it
-- by. The internal id stays as it is; nothing that refers to it changes.
CREATE FUNCTION parikshaa_company_id() RETURNS text
  LANGUAGE sql VOLATILE
  SET search_path = ''
AS $$
  SELECT 'PKC-' || string_agg(substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + floor(random() * 32)::int, 1), '')
    FROM generate_series(1, 6)
$$;

ALTER TABLE organisations ADD COLUMN public_id text;
UPDATE organisations SET public_id = parikshaa_company_id();
ALTER TABLE organisations ALTER COLUMN public_id SET DEFAULT parikshaa_company_id();
ALTER TABLE organisations ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX organisations_public_id ON organisations (public_id);

-- Paused by Parikshaa's operator (unpaid, misuse, or asked for): its staff
-- cannot sign in and its keys stop working. Candidates already given links are
-- not cut off mid-test. Resuming clears both.
ALTER TABLE organisations ADD COLUMN suspended_at timestamptz;
ALTER TABLE organisations ADD COLUMN suspended_reason text;
