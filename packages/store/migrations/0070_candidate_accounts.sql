-- Candidate accounts for Hire (docs/HIRE-V2.md §1, §10 S2, S5, S19, S20, F4,
-- F22, F24; H1a). One account per person, for every company they apply to:
-- they sign in with a code mailed to them, keep a profile and see their
-- applications everywhere in one place.
--
-- Like learners (0013), accounts, sessions and sign-in codes are outside
-- tenant row-level security: signing in looks a candidate up before any scope
-- exists, and only the candidate service reads them.

CREATE TABLE candidate_accounts (
  id            text        PRIMARY KEY,
  -- Trimmed and in lower case; '' once the account is erased.
  email         text        NOT NULL CHECK (email = lower(btrim(email))),
  name          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- An account is made only when a code sent to its address is entered (S5).
  verified_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  -- Warned that a long-unused account will be erased (F22); signing in clears it.
  warned_at     timestamptz,
  -- Set on erasure: the row stays, so an application keeps its candidate id,
  -- but everything about the person is gone from it.
  erased_at     timestamptz,
  -- The candidate's own profile, each value sealed under the "candidates"
  -- record key and bound to this account and field.
  phone         text,
  profile       text,
  -- The resume (H1b): its text, and its file either here or in object
  -- storage under `resume_key`, sealed either way.
  resume_text   text,
  resume_file   bytea,
  resume_key    text,
  resume_name   text,
  resume_type   text        CHECK (resume_type IN ('pdf', 'docx')),
  resume_sha256 text,
  resume_at     timestamptz,
  CONSTRAINT candidate_accounts_resume_once CHECK (resume_file IS NULL OR resume_key IS NULL),
  CONSTRAINT candidate_accounts_erased_empty CHECK (erased_at IS NULL OR (email = '' AND name IS NULL AND phone IS NULL
    AND profile IS NULL AND resume_text IS NULL AND resume_file IS NULL AND resume_key IS NULL))
);

-- One live account per address.
CREATE UNIQUE INDEX candidate_accounts_email_idx ON candidate_accounts (email) WHERE erased_at IS NULL;
CREATE INDEX candidate_accounts_seen_idx ON candidate_accounts (last_seen_at) WHERE erased_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON candidate_accounts TO parikshaa_app;

CREATE TABLE candidate_sessions (
  -- The bearer token is never stored, only its SHA-256.
  token_hash   text        PRIMARY KEY,
  candidate_id text        NOT NULL REFERENCES candidate_accounts (id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- "Keep me signed in on this device" (S19): renewed as it is used.
  kept         boolean     NOT NULL DEFAULT false,
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz
);
CREATE INDEX candidate_sessions_candidate_idx ON candidate_sessions (candidate_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON candidate_sessions TO parikshaa_app;

-- A code mailed to sign in, or to confirm a step that cannot be undone
-- (S5, S19). Neither the address nor the code is kept: the address as a blind
-- index, the code as an HMAC of the row's id and the code. Rows go a day after
-- they are made.
CREATE TABLE candidate_codes (
  id            text        PRIMARY KEY,
  purpose       text        NOT NULL CHECK (purpose IN ('sign_in', 'step_up')),
  email_hash    text        NOT NULL,
  code_hash     text        NOT NULL,
  -- Blind index of the address the request came from, for the per-address limit.
  ip_hash       text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  attempts      integer     NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  used_at       timestamptz,
  -- A newer code for the same address ends this one.
  superseded_at timestamptz
);
CREATE INDEX candidate_codes_email_idx ON candidate_codes (email_hash, created_at);
CREATE INDEX candidate_codes_ip_idx ON candidate_codes (ip_hash, created_at);
CREATE INDEX candidate_codes_created_idx ON candidate_codes (created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON candidate_codes TO parikshaa_app;

-- Which organisations' applications are a candidate's (S2): the portal's
-- index across companies. Ids only. No tenant policy, since it spans
-- organisations: a candidate reads and adds their own links, and an
-- organisation's staff read none.
CREATE TABLE candidate_links (
  candidate_id   text        NOT NULL REFERENCES candidate_accounts (id),
  org_id         text        NOT NULL REFERENCES organisations (id),
  application_id text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (candidate_id, org_id, application_id)
);
CREATE INDEX candidate_links_org_idx ON candidate_links (org_id, application_id);

ALTER TABLE candidate_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY candidate_links_applicant_read ON candidate_links FOR SELECT
  USING (current_setting('parikshaa.actor', true) = 'applicant'
         AND candidate_id = current_setting('parikshaa.candidate_id', true));
CREATE POLICY candidate_links_applicant_add ON candidate_links FOR INSERT
  WITH CHECK (current_setting('parikshaa.actor', true) = 'applicant'
              AND candidate_id = current_setting('parikshaa.candidate_id', true));

GRANT SELECT, INSERT ON candidate_links TO parikshaa_app;

-- Staff remove their organisation's link when an application is erased. A
-- DELETE needs to see the rows it matches, and staff may not, so this does it
-- for them: only in the organisation of the transaction's staff scope.
CREATE FUNCTION candidate_unlink(p_org text, p_application text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  removed integer;
BEGIN
  IF current_setting('parikshaa.actor', true) IS DISTINCT FROM 'staff'
     OR current_setting('parikshaa.org_id', true) IS DISTINCT FROM p_org THEN
    RAISE EXCEPTION 'candidate_unlink: only staff of %', p_org;
  END IF;
  DELETE FROM public.candidate_links WHERE org_id = p_org AND application_id = p_application;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END $$;
REVOKE ALL ON FUNCTION candidate_unlink(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION candidate_unlink(text, text) TO parikshaa_app;

-- A candidate's scope (actor 'applicant', F24) reads nothing of an
-- organisation's own tables. Most policies name the actor they let in, but
-- these let any actor of the organisation in: a candidate in their attempt
-- (where `parikshaa.attempt_id` already narrows what they see) or staff.
-- Hire's code never hands an applicant scope to the stores that read them;
-- this holds even if some code did.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['attempts', 'audit_log', 'exam_lab', 'exam_ledger', 'exam_windows', 'exams', 'model_usage',
                           'recheck_requests', 'result_releases'] LOOP
    EXECUTE format($p$CREATE POLICY not_applicant ON %I AS RESTRICTIVE
      USING (current_setting('parikshaa.actor', true) IS DISTINCT FROM 'applicant')
      WITH CHECK (current_setting('parikshaa.actor', true) IS DISTINCT FROM 'applicant')$p$, t);
  END LOOP;
END $$;
