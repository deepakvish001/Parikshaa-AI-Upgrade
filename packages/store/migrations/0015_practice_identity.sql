-- Practice sites, finished (ROADMAP §15): learners' email addresses verified,
-- signing in with Google, and — for staff — what practice looks like when two
-- learners hand in the same code.

-- When the learner proved the address is theirs: by the emailed link, or by
-- signing in with a provider that vouched for it.
ALTER TABLE learners ADD COLUMN email_verified_at timestamptz;

-- How a site's learners may sign in, beside the site itself and outside
-- row-level security for the same reason: a visitor's request is how the
-- organisation is found. The Google client secret is sealed by the server.
CREATE TABLE practice_sign_in (
  org_id               text        PRIMARY KEY REFERENCES organisations (id),
  -- Unverified learners can practise, but not submit or comment, until they
  -- click the emailed link.
  require_verified     boolean     NOT NULL DEFAULT false,
  google_enabled       boolean     NOT NULL DEFAULT false,
  google_client_id     text,
  google_client_secret text,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON practice_sign_in TO parikshaa_app;

-- Verification links go out through the outbox; the row names the learner only.
ALTER TABLE outbox DROP CONSTRAINT IF EXISTS outbox_kind_check;
ALTER TABLE outbox ADD CONSTRAINT outbox_kind_check
  CHECK (kind IN ('email', 'sms', 'webhook', 'greenhouse', 'staff_email', 'learner_email'));
