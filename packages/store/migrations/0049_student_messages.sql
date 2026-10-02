-- Messages to students from the student list (docs/PREP-TRACKER.md, CO42 and
-- CL67): an offer, with its link to answer, and a new drive the student is
-- eligible for, with its link to apply. They go to the email and phone on the
-- student list, which are sealed (0048), so the outbox names the drive and the
-- roll number only.

ALTER TABLE outbox DROP CONSTRAINT IF EXISTS outbox_kind_check;
ALTER TABLE outbox ADD CONSTRAINT outbox_kind_check
  CHECK (kind IN ('email', 'sms', 'whatsapp', 'webhook', 'greenhouse', 'staff_email', 'learner_email', 'ats', 'lti', 'student'));
