-- Sahayak v2 (Prep blueprint §14, F5).
--
-- A review is answered in a fixed shape (logic, complexity, quality, edge
-- cases), kept beside its Markdown as `data`. After a problem is solved the
-- tutor asks two interview follow-up questions ('followup', the questions in
-- `data`); the learner answers each and is told how it went
-- ('followup_reply', the verdict in `data`).
--
-- What the tutor said is deleted 180 days after it was said (DPDP: kept no
-- longer than it is useful); the index serves that sweep.

ALTER TABLE prep_tutor ADD COLUMN data jsonb;
ALTER TABLE prep_tutor DROP CONSTRAINT prep_tutor_mode_check;
ALTER TABLE prep_tutor ADD CONSTRAINT prep_tutor_mode_check CHECK (mode IN ('hint', 'review', 'doubt', 'notes', 'followup', 'followup_reply'));
CREATE INDEX prep_tutor_age_idx ON prep_tutor (org_id, created_at);
