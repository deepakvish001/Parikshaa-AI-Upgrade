-- Sahayak's notes mode (Prep blueprint F15): a draft of a revision note on a
-- lesson, or on a problem the learner has solved. The draft is the tutor's
-- answer, kept with the rest of what the tutor said; it becomes a note only
-- when the learner saves it.

ALTER TABLE prep_tutor DROP CONSTRAINT prep_tutor_mode_check;
ALTER TABLE prep_tutor ADD CONSTRAINT prep_tutor_mode_check CHECK (mode IN ('hint', 'review', 'doubt', 'notes'));
