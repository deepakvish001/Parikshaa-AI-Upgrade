-- Hire: applying (H2b; docs/HIRE-V2.md §10 S17, P9).
--
-- A person has one live application per job. After a rejection, a withdrawal
-- or a joining that did not happen they may apply again, once the job's
-- `reapply_after_days` have passed (the service holds that). 0071's index
-- kept them out until the old application was erased.
DROP INDEX hire_applications_person_idx;
CREATE UNIQUE INDEX hire_applications_person_idx ON hire_applications (org_id, job_id, email_canonical_hash)
  WHERE erased_at IS NULL AND status NOT IN ('rejected', 'withdrawn', 'did_not_join');
