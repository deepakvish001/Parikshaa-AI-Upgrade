-- Hire: erasure, retention and claiming (H2d; docs/HIRE-V2.md §10 S2, S3, S9, F4, P11).

-- How long a company keeps a decided application before it is erased (F4).
-- Null: the organisation's privacy setting, else 180 days.
ALTER TABLE organisations ADD COLUMN hire_keep_days integer CHECK (hire_keep_days IS NULL OR hire_keep_days BETWEEN 30 AND 3650);

-- Why an application's personal data went (S3): the candidate deleted their
-- account, the retention period ran out, or Parikshaa's operator erased it.
ALTER TABLE hire_applications ADD COLUMN erased_reason text
  CHECK (erased_reason IS NULL OR erased_reason IN ('account_deleted', 'retention', 'operator'));
ALTER TABLE hire_applications ADD CONSTRAINT hire_applications_erased_reason
  CHECK ((erased_at IS NULL) = (erased_reason IS NULL));

-- A company invited this person by address and they have not applied yet
-- (P11): a blind index of the canonical address, the same in every
-- organisation, so the person finds their invitations once they sign in with
-- that address (S2). Only for unclaimed invitations; cleared on claim.
ALTER TABLE hire_applications ADD COLUMN claim_hash text;
ALTER TABLE hire_applications ADD CONSTRAINT hire_applications_claim_hash
  CHECK (claim_hash IS NULL OR (candidate_id IS NULL AND status = 'invited'));
CREATE INDEX hire_applications_claim_idx ON hire_applications (claim_hash) WHERE claim_hash IS NOT NULL;

-- The timeline is append-only (0071), so erasing what an event says goes
-- through this: staff of the transaction's own organisation blank the detail
-- of one application's events. The events stay, with their kind and time.
CREATE FUNCTION hire_erase_events(p_org text, p_application text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  blanked integer;
BEGIN
  IF current_setting('parikshaa.actor', true) IS DISTINCT FROM 'staff'
     OR current_setting('parikshaa.org_id', true) IS DISTINCT FROM p_org THEN
    RAISE EXCEPTION 'hire_erase_events: only staff of %', p_org;
  END IF;
  UPDATE public.hire_events SET detail = '{}'::jsonb
   WHERE org_id = p_org AND application_id = p_application AND detail <> '{}'::jsonb;
  GET DIAGNOSTICS blanked = ROW_COUNT;
  RETURN blanked;
END $$;
REVOKE ALL ON FUNCTION hire_erase_events(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hire_erase_events(text, text) TO parikshaa_app;

-- The invitations waiting for a signed-in candidate, in every organisation:
-- ids only. The service computes the hash from the address the candidate
-- signed in with, so no one learns of an invitation to an address they do not
-- hold (S2).
CREATE FUNCTION hire_claimable(p_claim_hash text) RETURNS TABLE (org_id text, application_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF current_setting('parikshaa.actor', true) IS DISTINCT FROM 'applicant'
     OR coalesce(current_setting('parikshaa.candidate_id', true), '') = '' THEN
    RAISE EXCEPTION 'hire_claimable: only a signed-in candidate';
  END IF;
  RETURN QUERY
    SELECT a.org_id, a.id FROM public.hire_applications a
     WHERE a.claim_hash = p_claim_hash AND a.status = 'invited' AND a.candidate_id IS NULL AND a.erased_at IS NULL
     ORDER BY a.created_at DESC
     LIMIT 100;
END $$;
REVOKE ALL ON FUNCTION hire_claimable(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hire_claimable(text) TO parikshaa_app;
