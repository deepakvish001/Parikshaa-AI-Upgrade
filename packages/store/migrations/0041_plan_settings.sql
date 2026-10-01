-- Planner settings (Prep blueprint S6, F6): a weekend may hold more (or
-- fewer) minutes than a weekday, and a learner hears once when their plan's
-- finish date slips past the deadline, not every day it slips further.

ALTER TABLE prep_plans ADD COLUMN weekend_minutes integer CHECK (weekend_minutes BETWEEN 15 AND 720);
ALTER TABLE prep_plans ADD COLUMN late_notified_on date;
