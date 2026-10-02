-- The AI interviewer, v2 (docs/PREP-TRACKER.md plan row 93): the candidate's
-- resume, pasted by the recruiter, so the questions can start from their own
-- work. Sealed like the transcript (T1); before the model sees it, the
-- service takes out the name, email, phone and profile links.
ALTER TABLE ai_interviews ADD COLUMN resume text CHECK (char_length(resume) <= 60000);
