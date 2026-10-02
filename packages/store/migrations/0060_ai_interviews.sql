-- The AI interviewer (docs/PREP-TRACKER.md plan row 86). A first-round
-- interview the model holds by chat: questions from the role or the job
-- description, one follow-up on each answer, the candidate's code with it.
-- The transcript is a hash chain, so a turn changed afterwards shows; the
-- candidate's words are sealed (T1). The model's reading is evidence beside
-- the human scorecard, never the decision.

CREATE TABLE ai_interviews (
  org_id          text        NOT NULL REFERENCES organisations (id),
  id              text        NOT NULL,
  title           text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  role_id         text,
  job             text        NOT NULL DEFAULT '' CHECK (char_length(job) <= 12000),
  seniority       text        NOT NULL DEFAULT 'fresher' CHECK (seniority IN ('fresher', 'junior', 'mid', 'senior')),
  questions       integer     NOT NULL CHECK (questions BETWEEN 2 AND 8),
  minutes         integer     NOT NULL CHECK (minutes BETWEEN 10 AND 90),
  candidate_ref   text        NOT NULL DEFAULT '' CHECK (char_length(candidate_ref) <= 100),
  candidate_name  text        NOT NULL CHECK (char_length(candidate_name) BETWEEN 1 AND 200),
  candidate_email text        CHECK (char_length(candidate_email) <= 1000),
  status          text        NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'in_progress', 'done', 'cancelled')),
  started_at      timestamptz,
  ended_at        timestamptz,
  assessment      jsonb,
  scorecard       jsonb,
  decided_by      text,
  decided_at      timestamptz,
  created_by      text        NOT NULL,
  created_at      timestamptz NOT NULL,
  PRIMARY KEY (org_id, id),
  CHECK (role_id IS NOT NULL OR job <> '')
);
CREATE INDEX ai_interviews_created ON ai_interviews (org_id, created_at DESC);

CREATE TABLE ai_interview_turns (
  org_id       text        NOT NULL,
  interview_id text        NOT NULL,
  seq          integer     NOT NULL CHECK (seq >= 0),
  speaker      text        NOT NULL CHECK (speaker IN ('interviewer', 'candidate')),
  kind         text        NOT NULL CHECK (kind IN ('question', 'follow_up', 'answer', 'closing')),
  body         text        NOT NULL CHECK (char_length(body) <= 40000),
  code         text        CHECK (char_length(code) <= 140000),
  language     text        CHECK (char_length(language) <= 20),
  at           timestamptz NOT NULL,
  prev_hash    char(64)    NOT NULL,
  hash         char(64)    NOT NULL,
  PRIMARY KEY (org_id, interview_id, seq),
  FOREIGN KEY (org_id, interview_id) REFERENCES ai_interviews (org_id, id) ON DELETE CASCADE
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_interviews', 'ai_interview_turns']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I AS RESTRICTIVE
      USING (org_id = current_setting('parikshaa.org_id', true))
      WITH CHECK (org_id = current_setting('parikshaa.org_id', true))$p$, t);
    EXECUTE format($p$CREATE POLICY %s_staff ON %I
      USING (current_setting('parikshaa.actor', true) = 'staff')
      WITH CHECK (current_setting('parikshaa.actor', true) = 'staff')$p$, t, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_interviews TO parikshaa_app;
-- A turn, once written, is never changed: the chain would show it.
GRANT SELECT, INSERT, DELETE ON ai_interview_turns TO parikshaa_app;

ALTER TABLE model_usage DROP CONSTRAINT model_usage_route_check;
ALTER TABLE model_usage ADD CONSTRAINT model_usage_route_check CHECK (route IN ('probe', 'assess', 'grade', 'tutor', 'author', 'interview'));
