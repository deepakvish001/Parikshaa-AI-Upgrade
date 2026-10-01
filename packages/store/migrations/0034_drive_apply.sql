-- Applying to a drive from a link (docs/PREP-TRACKER.md, V2-12 CO14). A drive
-- can have a public code; a student opens the link and applies with their
-- roll number. Students on the college's list apply as themselves (the email
-- on file must match); an off-campus drive may also take people not on the
-- list, who are added as self-registered, with what they declared.

ALTER TABLE drives ADD COLUMN apply_code text;
ALTER TABLE drives ADD COLUMN open_to_new boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX drives_apply_code ON drives (org_id, apply_code) WHERE apply_code IS NOT NULL;

ALTER TABLE students ADD COLUMN self_registered boolean NOT NULL DEFAULT false;
