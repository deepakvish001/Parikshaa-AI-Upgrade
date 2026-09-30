-- WhatsApp as a third way to reach a candidate, beside email and SMS: the
-- invitation, its reminders, a new time and the result, each as a template
-- approved in the organisation's WhatsApp Business account.

ALTER TABLE outbox DROP CONSTRAINT IF EXISTS outbox_kind_check;
ALTER TABLE outbox ADD CONSTRAINT outbox_kind_check
  CHECK (kind IN ('email', 'sms', 'whatsapp', 'webhook', 'greenhouse', 'staff_email', 'learner_email', 'ats', 'lti'));
