-- An exam put away (the console's redesign, K3): no longer shown among the
-- organisation's current exams, and nothing else about it changes. Its
-- window, invitations, attempts and results stay exactly as they were, and it
-- can be brought back.
ALTER TABLE exams ADD COLUMN archived_at timestamptz;
