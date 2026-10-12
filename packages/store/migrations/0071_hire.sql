-- Hire (docs/HIRE-V2.md §1, §10; H2): a company's jobs, the rounds each
-- applicant goes through, and everything that happens to an application on the
-- way from applying to an offer. One migration for every slice of H2–H5, so the
-- statuses later slices need are here already (F29).

-- --- the organisation, verified (F3, S18) ---------------------------------------

-- A company Parikshaa has checked is real: until then its jobs are limited
-- (two open, a hundred applications, no AI screening, no resume downloads).
ALTER TABLE organisations ADD COLUMN verified_at timestamptz;
ALTER TABLE organisations ADD COLUMN verified_by text;
-- What was checked: the work-email domain against the website, GSTIN or CIN, LinkedIn, who checked.
ALTER TABLE organisations ADD COLUMN verification jsonb;

-- --- roles (P3, F6) ------------------------------------------------------------

-- A recruiter runs hiring; a hiring manager reviews and decides on the jobs
-- they manage, and sees nothing else of the organisation's exams.
ALTER TABLE staff_users DROP CONSTRAINT staff_users_role_check;
ALTER TABLE staff_users ADD CONSTRAINT staff_users_role_check
  CHECK (role IN ('owner', 'author', 'invigilator', 'reviewer', 'viewer', 'recruiter', 'hiring_manager'));
-- An integration may recruit; it cannot be a job's manager, which is a person.
ALTER TABLE api_keys DROP CONSTRAINT api_keys_role_check;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_role_check
  CHECK (role IN ('author', 'invigilator', 'reviewer', 'viewer', 'recruiter'));

-- --- jobs ----------------------------------------------------------------------

CREATE TABLE hire_jobs (
  org_id             text        NOT NULL REFERENCES organisations (id),
  id                 text        NOT NULL,
  title              text        NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  -- A role from the role library, when the job started from one.
  role_id            text,
  department         text        NOT NULL DEFAULT '' CHECK (length(department) <= 120),
  location           text        NOT NULL DEFAULT '' CHECK (length(location) <= 200),
  work_mode          text        NOT NULL DEFAULT 'onsite' CHECK (work_mode IN ('onsite', 'hybrid', 'remote')),
  employment         text        NOT NULL DEFAULT 'full_time' CHECK (employment IN ('full_time', 'internship', 'contract')),
  exp_min            integer     NOT NULL DEFAULT 0 CHECK (exp_min BETWEEN 0 AND 60),
  exp_max            integer     CHECK (exp_max IS NULL OR exp_max BETWEEN exp_min AND 60),
  ctc_min_lpa        numeric(8, 2) CHECK (ctc_min_lpa IS NULL OR ctc_min_lpa >= 0),
  ctc_max_lpa        numeric(8, 2) CHECK (ctc_max_lpa IS NULL OR ctc_max_lpa >= coalesce(ctc_min_lpa, 0)),
  show_ctc           boolean     NOT NULL DEFAULT false,
  openings           integer     NOT NULL DEFAULT 1 CHECK (openings BETWEEN 1 AND 10000),
  skills_must        text[]      NOT NULL DEFAULT '{}',
  skills_nice        text[]      NOT NULL DEFAULT '{}',
  description        text        NOT NULL DEFAULT '' CHECK (length(description) <= 20000),
  -- Screening questions, knockouts among them (S23: never on a protected topic).
  questions          jsonb       NOT NULL DEFAULT '[]',
  -- Shown to every applicant on the job page and in the portal (P14).
  note_to_candidates text        NOT NULL DEFAULT '' CHECK (length(note_to_candidates) <= 2000),
  contact_email      text,
  apply_by           date,
  -- held: a draft whose wording asks applicants for money, waiting for Parikshaa (S18).
  status             text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'held', 'open', 'paused', 'closed')),
  held_reason        text,
  -- The job page's address within the company's; given on first publish.
  public_code        text,
  auto_screen        boolean     NOT NULL DEFAULT false,
  screen_threshold   integer     NOT NULL DEFAULT 60 CHECK (screen_threshold BETWEEN 0 AND 100),
  screen_daily_max   integer     NOT NULL DEFAULT 200 CHECK (screen_daily_max BETWEEN 1 AND 5000),
  max_applicants     integer     CHECK (max_applicants IS NULL OR max_applicants >= 1),
  reapply_after_days integer     NOT NULL DEFAULT 90 CHECK (reapply_after_days BETWEEN 0 AND 3650),
  review_sla_days    integer     NOT NULL DEFAULT 2 CHECK (review_sla_days BETWEEN 1 AND 60),
  -- Staff user ids: the hiring managers, who review and decide on this job alone.
  managers           text[]      NOT NULL DEFAULT '{}',
  created_by         text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  published_at       timestamptz,
  closed_at          timestamptz,
  PRIMARY KEY (org_id, id)
);
CREATE UNIQUE INDEX hire_jobs_public_code_idx ON hire_jobs (org_id, public_code) WHERE public_code IS NOT NULL;
CREATE INDEX hire_jobs_status_idx ON hire_jobs (org_id, status, created_at DESC);

-- The steps of a job, in order: at most one screen, first; the offer last.
CREATE TABLE hire_rounds (
  org_id     text        NOT NULL,
  id         text        NOT NULL,
  job_id     text        NOT NULL,
  position   integer     NOT NULL CHECK (position >= 0),
  kind       text        NOT NULL CHECK (kind IN ('screen', 'assessment', 'ai_interview', 'interview', 'review', 'offer')),
  title      text        NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  config     jsonb       NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, job_id) REFERENCES hire_jobs (org_id, id) ON DELETE CASCADE,
  -- Checked at commit, so a reorder can pass through a moment where two share a place.
  CONSTRAINT hire_rounds_position_unique UNIQUE (org_id, job_id, position) DEFERRABLE INITIALLY DEFERRED
);

-- --- applications ------------------------------------------------------------------

CREATE TABLE hire_applications (
  org_id                text        NOT NULL,
  id                    text        NOT NULL,
  job_id                text        NOT NULL,
  -- Null for one a company added or imported, until the candidate claims it (S2, P11).
  candidate_id          text        REFERENCES candidate_accounts (id),
  -- Stable for the candidate within the organisation: the test invitation's candidate ref (F5).
  ref                   text        NOT NULL,
  name                  text        NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  -- Sealed under the "hire" record key and bound to the application and field (S20).
  email                 text        NOT NULL,
  phone                 text,
  profile               text,
  answers               text,
  resume_text           text,
  resume_file           bytea,
  resume_key            text,
  resume_name           text,
  resume_type           text        CHECK (resume_type IN ('pdf', 'docx')),
  -- Blind indexes in the organisation (S17, S20, P9): duplicates found without the values.
  email_hash            text        NOT NULL,
  email_canonical_hash  text        NOT NULL,
  phone_hash            text,
  resume_hash           text,
  source                text        NOT NULL CHECK (source IN ('link', 'careers', 'referral', 'manual', 'import')),
  source_tag            text        CHECK (source_tag IS NULL OR length(source_tag) <= 40),
  referrer              text        CHECK (referrer IS NULL OR length(referrer) <= 200),
  -- What the candidate agreed to, when (S8). Null for one not claimed yet.
  consent_version       text,
  notice_hash           text,
  consented_at          timestamptz,
  ai_opt_out            boolean     NOT NULL DEFAULT false,
  device_ready          boolean,
  round_id              text,
  status                text        NOT NULL CHECK (status IN ('invited', 'not_claimed', 'active', 'rejected', 'withdrawn',
                                                               'hired', 'joined', 'did_not_join')),
  status_reason         text,
  reject_reason         text        CHECK (reject_reason IS NULL OR reject_reason IN ('skills', 'experience', 'ctc', 'notice',
                                      'location', 'integrity', 'no_show', 'candidate_declined', 'filled', 'other')),
  -- When it was rejected or withdrawn: retention counts from here (S9).
  decided_at            timestamptz,
  -- Set when its personal data was erased (S3); the row stays for the job's counts.
  erased_at             timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, job_id) REFERENCES hire_jobs (org_id, id),
  CONSTRAINT hire_applications_resume_once CHECK (resume_file IS NULL OR resume_key IS NULL)
);
-- One application per person per job (S17: the address with plus-tags and Gmail dots removed).
CREATE UNIQUE INDEX hire_applications_person_idx ON hire_applications (org_id, job_id, email_canonical_hash) WHERE erased_at IS NULL;
CREATE INDEX hire_applications_job_idx ON hire_applications (org_id, job_id, status, created_at);
CREATE INDEX hire_applications_candidate_idx ON hire_applications (candidate_id) WHERE candidate_id IS NOT NULL;
CREATE INDEX hire_applications_email_idx ON hire_applications (org_id, email_canonical_hash);
CREATE INDEX hire_applications_phone_idx ON hire_applications (org_id, phone_hash) WHERE phone_hash IS NOT NULL;

-- Where an application stands in each round. Scores are copied here when
-- known, so they outlive the interview and attempt records' retention.
CREATE TABLE hire_round_results (
  org_id          text        NOT NULL,
  application_id  text        NOT NULL,
  round_id        text        NOT NULL,
  status          text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'invited', 'in_progress', 'done',
                                'passed', 'failed', 'skipped', 'expired', 'abandoned')),
  score           numeric(5, 2) CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  detail          jsonb       NOT NULL DEFAULT '{}',
  exam_id         text,
  attempt_id      text,
  invitation_id   text,
  ai_interview_id text,
  interview_id    text,
  invited_at      timestamptz,
  completed_at    timestamptz,
  decided_by      text,
  decided_at      timestamptz,
  PRIMARY KEY (org_id, application_id, round_id),
  FOREIGN KEY (org_id, application_id) REFERENCES hire_applications (org_id, id),
  FOREIGN KEY (org_id, round_id) REFERENCES hire_rounds (org_id, id)
);

-- The AI screening's latest reading of an application (H3); a new one replaces it.
CREATE TABLE hire_screenings (
  org_id         text        NOT NULL,
  application_id text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  model          text,
  status         text        NOT NULL CHECK (status IN ('done', 'failed', 'skipped')),
  reason         text,
  score          integer     CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  -- S15: "low_match", never "reject": a person decides.
  recommendation text        CHECK (recommendation IS NULL OR recommendation IN ('advance', 'hold', 'low_match')),
  result         jsonb,
  PRIMARY KEY (org_id, application_id),
  FOREIGN KEY (org_id, application_id) REFERENCES hire_applications (org_id, id)
);

-- Whether the applicant is who they say and did their own work (H5): signs,
-- never a verdict, until a person gives one.
CREATE TABLE hire_integrity (
  org_id         text        NOT NULL,
  application_id text        NOT NULL,
  computed_at    timestamptz NOT NULL DEFAULT now(),
  level          text        NOT NULL CHECK (level IN ('not_checked', 'clear', 'review', 'high')),
  score          integer     CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  reasons        jsonb       NOT NULL DEFAULT '[]',
  coverage       jsonb       NOT NULL DEFAULT '{}',
  reviewed_by    text,
  reviewed_at    timestamptz,
  verdict        text        CHECK (verdict IS NULL OR verdict IN ('genuine', 'not_genuine')),
  note           text,
  PRIMARY KEY (org_id, application_id),
  FOREIGN KEY (org_id, application_id) REFERENCES hire_applications (org_id, id)
);

-- What happened to an application, in order. Append-only for the app; the
-- candidate sees only the events marked for them, never notes, overrides,
-- integrity reviews or screenings (S4).
CREATE TABLE hire_events (
  org_id            text        NOT NULL,
  id                text        NOT NULL,
  application_id    text        NOT NULL,
  candidate_id      text,
  at                timestamptz NOT NULL DEFAULT now(),
  kind              text        NOT NULL CHECK (kind IN ('applied', 'invited', 'claimed', 'screened', 'moved', 'rejected',
                                  'withdrawn', 'restored', 'test_sent', 'test_blocked', 'test_done', 'ai_interview_sent',
                                  'ai_interview_done', 'interview_scheduled', 'interview_done', 'integrity_reviewed',
                                  'override', 'note', 'message', 'offer_sent', 'offer_accepted', 'offer_declined',
                                  'offer_withdrawn', 'offer_expired', 'hired', 'joined', 'did_not_join', 'mail_sent')),
  round_id          text,
  by                text        NOT NULL,
  detail            jsonb       NOT NULL DEFAULT '{}',
  candidate_visible boolean     NOT NULL DEFAULT false,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, application_id) REFERENCES hire_applications (org_id, id),
  CONSTRAINT hire_events_private_kinds CHECK (NOT candidate_visible OR kind NOT IN ('note', 'override', 'integrity_reviewed', 'screened'))
);
CREATE INDEX hire_events_application_idx ON hire_events (org_id, application_id, at);

CREATE TABLE hire_offers (
  org_id         text        NOT NULL,
  id             text        NOT NULL,
  application_id text        NOT NULL,
  candidate_id   text,
  ctc_lpa        numeric(8, 2) NOT NULL CHECK (ctc_lpa >= 0),
  fixed_lpa      numeric(8, 2) CHECK (fixed_lpa IS NULL OR fixed_lpa >= 0),
  variable_lpa   numeric(8, 2) CHECK (variable_lpa IS NULL OR variable_lpa >= 0),
  joining_date   date,
  location       text,
  expires_on     date        NOT NULL,
  -- Sealed under the "hire" record key.
  note           text,
  status         text        NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'accepted', 'declined', 'withdrawn', 'expired')),
  created_by     text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  responded_at   timestamptz,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, application_id) REFERENCES hire_applications (org_id, id)
);
-- At most one offer standing per application.
CREATE UNIQUE INDEX hire_offers_standing_idx ON hire_offers (org_id, application_id) WHERE status IN ('sent', 'accepted');

-- --- row-level security ----------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hire_jobs', 'hire_rounds', 'hire_applications', 'hire_round_results', 'hire_screenings',
                           'hire_integrity', 'hire_events', 'hire_offers'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I AS RESTRICTIVE
      USING (org_id = current_setting('parikshaa.org_id', true))
      WITH CHECK (org_id = current_setting('parikshaa.org_id', true))$p$, t);
    EXECUTE format($p$CREATE POLICY %s_staff ON %I
      USING (current_setting('parikshaa.actor', true) = 'staff')
      WITH CHECK (current_setting('parikshaa.actor', true) = 'staff')$p$, t, t);
  END LOOP;
END $$;

-- A candidate reads their own applications, the events meant for them, and
-- their offers; nothing else, and writes nothing: what they do goes through
-- the service, which checks it is theirs (S4).
CREATE POLICY hire_applications_applicant ON hire_applications FOR SELECT
  USING (current_setting('parikshaa.actor', true) = 'applicant'
         AND candidate_id = current_setting('parikshaa.candidate_id', true));
CREATE POLICY hire_events_applicant ON hire_events FOR SELECT
  USING (current_setting('parikshaa.actor', true) = 'applicant' AND candidate_visible
         AND candidate_id = current_setting('parikshaa.candidate_id', true));
CREATE POLICY hire_offers_applicant ON hire_offers FOR SELECT
  USING (current_setting('parikshaa.actor', true) = 'applicant'
         AND candidate_id = current_setting('parikshaa.candidate_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON hire_jobs, hire_rounds TO parikshaa_app;
GRANT SELECT, INSERT, UPDATE ON hire_applications, hire_round_results, hire_screenings, hire_integrity, hire_offers TO parikshaa_app;
-- The timeline is append-only for the app.
GRANT SELECT, INSERT ON hire_events TO parikshaa_app;

-- --- mail and the model -----------------------------------------------------------------

ALTER TABLE outbox DROP CONSTRAINT IF EXISTS outbox_kind_check;
ALTER TABLE outbox ADD CONSTRAINT outbox_kind_check
  CHECK (kind IN ('email', 'sms', 'whatsapp', 'webhook', 'greenhouse', 'staff_email', 'learner_email', 'ats', 'lti', 'student', 'interview', 'hire'));

ALTER TABLE model_usage DROP CONSTRAINT model_usage_route_check;
ALTER TABLE model_usage ADD CONSTRAINT model_usage_route_check
  CHECK (route IN ('probe', 'assess', 'grade', 'tutor', 'author', 'interview', 'assist', 'screen'));
