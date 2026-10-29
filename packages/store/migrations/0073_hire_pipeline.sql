-- Hire: the pipeline (H2c; docs/HIRE-V2.md §5, §10 P13, P14, P15).
--
-- A company moves applications from round to round, rejects and restores
-- them, and writes to the candidates. The statuses, event kinds and outbox
-- kind it needs came with 0071 (F29); this adds three columns.

-- One line the company adds to its rejection mails for this job (P14): polite,
-- never a reason. Empty: the mail goes without it.
ALTER TABLE hire_jobs ADD COLUMN rejection_line text NOT NULL DEFAULT '' CHECK (length(rejection_line) <= 500);

-- Since when the application has been in its current round: the pipeline's
-- "in this step n days" and its "past SLA" filter (P13, P15). Applications made
-- before this migration count from when they were made.
ALTER TABLE hire_applications ADD COLUMN round_since timestamptz;
UPDATE hire_applications SET round_since = created_at;
ALTER TABLE hire_applications ALTER COLUMN round_since SET DEFAULT now();
ALTER TABLE hire_applications ALTER COLUMN round_since SET NOT NULL;

-- The order things were written in, for events at the same moment: a move and
-- its override, a bulk rejection and its notes, an application and its
-- knockout. Timelines are read by `at`, then this.
ALTER TABLE hire_events ADD COLUMN seq bigint GENERATED ALWAYS AS IDENTITY;
