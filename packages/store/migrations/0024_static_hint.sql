-- A problem's first hint, written by its author (Prep blueprint §14, F4). The
-- tutor gives it as rung 1 without asking the model, so the most-asked hint
-- costs neither the learner's credits nor the site's model budget. Empty: the
-- tutor writes rung 1 as before.
ALTER TABLE practice_problems ADD COLUMN hint text NOT NULL DEFAULT '';
