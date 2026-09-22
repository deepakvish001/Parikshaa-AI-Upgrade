-- Inviting a cohort, scheduling it, and delivering its access (ROADMAP §5).

-- When an exam can be sat. Operational, not part of the exam definition: an
-- exam is frozen once sat, but a sitting can be rescheduled.
CREATE TABLE exam_windows (
  org_id     text        NOT NULL,
  exam_id    text        NOT NULL,
  opens_at   timestamptz NOT NULL,
  closes_at  timestamptz NOT NULL,
  -- Whether an attempt ends when the window closes, even mid-way. On by
  -- default: a campus drive publishes results the same day.
  hard_close boolean     NOT NULL DEFAULT true,
  PRIMARY KEY (org_id, exam_id),
  FOREIGN KEY (org_id, exam_id) REFERENCES exams (org_id, id),
  CHECK (closes_at > opens_at)
);

-- One candidate invited to one exam. The invitation is the durable credential
-- for the window: its code opens (or resumes) the candidate's attempt from any
-- device. Codes are signed, not stored, so nothing here would let a reader of
-- the table sit someone else's exam.
CREATE TABLE invitations (
  org_id        text        NOT NULL,
  id            text        NOT NULL,
  exam_id       text        NOT NULL,
  -- The institution's own reference: a roll number, an application id.
  candidate_ref text        NOT NULL,
  name          text        NOT NULL DEFAULT '',
  email         text,
  phone         text,
  opens_at      timestamptz NOT NULL,
  closes_at     timestamptz NOT NULL,
  hard_close    boolean     NOT NULL DEFAULT true,
  attempt_id    text,
  -- Where the invitation came from, when an integration made it.
  source        jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, exam_id, candidate_ref),
  FOREIGN KEY (org_id, exam_id) REFERENCES exams (org_id, id),
  CHECK (closes_at > opens_at)
);

CREATE INDEX invitations_exam_idx ON invitations (org_id, exam_id);

ALTER TABLE exam_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations  ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON exam_windows AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY tenant_access ON exam_windows USING (true) WITH CHECK (true);

CREATE POLICY tenant_isolation ON invitations AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
-- Holds contact details: staff, and the system acting for them, only.
CREATE POLICY invitations_staff ON invitations
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

-- Everything that must leave the system: invitations, reminders, SMS, webhook
-- calls. Written in the same transaction as the change that causes it, so
-- nothing is lost to a crash between "decided" and "sent"; claimed by a worker
-- with SKIP LOCKED, so several instances can share the work.
--
-- Deliberately outside tenant row-level security — one worker serves every
-- organisation — and therefore deliberately holding no personal data: rows
-- name what to send and about which record. The message itself is built at
-- send time, under the organisation's own scope.
CREATE TABLE outbox (
  id           text        PRIMARY KEY,
  org_id       text        NOT NULL REFERENCES organisations (id),
  kind         text        NOT NULL CHECK (kind IN ('email', 'sms', 'webhook', 'greenhouse')),
  -- What this is about: {"invitationId": …} or {"webhookId": …, "event": …, "attemptId": …}.
  subject      jsonb       NOT NULL,
  purpose      text        NOT NULL,
  send_after   timestamptz NOT NULL DEFAULT now(),
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts     integer     NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_error   text,
  sent_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outbox_due_idx ON outbox (send_after) WHERE status IN ('pending', 'sending');
CREATE INDEX outbox_org_idx ON outbox (org_id, created_at);

GRANT SELECT, INSERT, UPDATE ON exam_windows, invitations TO parikshaa_app;
GRANT SELECT, INSERT, UPDATE ON outbox TO parikshaa_app;
