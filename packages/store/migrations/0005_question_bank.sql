-- A question bank per organisation (ROADMAP §3).
--
-- The bank is an authoring convenience, not something exams point into. When a
-- question from the bank is put on an exam it is copied into the exam's own
-- definition, and the exam is frozen once sat. Editing a bank question later
-- therefore changes no exam already built from it — which is what keeps a
-- ledger's answers attached to the question the candidate actually saw.

CREATE TABLE bank_questions (
  org_id      text        NOT NULL REFERENCES organisations (id),
  id          text        NOT NULL,
  -- The question itself, answer key included; its `id` equals this row's id.
  question    jsonb       NOT NULL,
  topic       text        NOT NULL DEFAULT '',
  difficulty  text        NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  tags        text[]      NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  PRIMARY KEY (org_id, id)
);

CREATE INDEX bank_questions_topic_idx ON bank_questions (org_id, topic) WHERE archived_at IS NULL;

ALTER TABLE bank_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON bank_questions AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));

-- Staff only. The bank holds answer keys; no candidate scope reaches it.
CREATE POLICY bank_questions_staff ON bank_questions
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

GRANT SELECT, INSERT, UPDATE ON bank_questions TO parikshaa_app;
