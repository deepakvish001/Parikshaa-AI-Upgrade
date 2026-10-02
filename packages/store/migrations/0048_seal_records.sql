-- Sealing records outside the ledger (docs/PREP-TRACKER.md, T1). A student's
-- email and phone, an interview's candidate email, code and notes, and the
-- scanned pages of a handwritten copy (with what the model read from them)
-- are now written sealed under a key derived from PARIKSHAA_DATA_KEY. A
-- sealed value is longer than the plain one and no longer looks like a phone
-- number, so the checks on its shape move to the application; rows written
-- before this read as they were.

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_email_check;
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_phone_check;
ALTER TABLE students ADD CONSTRAINT students_email_size CHECK (char_length(email) <= 1000);
ALTER TABLE students ADD CONSTRAINT students_phone_size CHECK (char_length(phone) <= 200);

ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_candidate_email_check;
ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_code_check;
ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_notes_check;
ALTER TABLE interviews ADD CONSTRAINT interviews_candidate_email_size CHECK (char_length(candidate_email) <= 1000);
ALTER TABLE interviews ADD CONSTRAINT interviews_code_size CHECK (char_length(code) <= 140000);
ALTER TABLE interviews ADD CONSTRAINT interviews_notes_size CHECK (char_length(notes) <= 28000);

ALTER TABLE answer_script_pages ADD COLUMN sealed boolean NOT NULL DEFAULT false;

-- The retention sweep removes copies and finished interviews past the
-- organisation's retention period.
GRANT DELETE ON interviews TO parikshaa_app;
