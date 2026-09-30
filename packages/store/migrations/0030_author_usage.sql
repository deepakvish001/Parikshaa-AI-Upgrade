-- Model spend for drafting a test from a job description (docs/PREP-TRACKER.md,
-- V2-12 CO6) is counted with the rest of the organisation's, as "author".

ALTER TABLE model_usage DROP CONSTRAINT model_usage_route_check;
ALTER TABLE model_usage ADD CONSTRAINT model_usage_route_check CHECK (route IN ('probe', 'assess', 'grade', 'tutor', 'author'));
