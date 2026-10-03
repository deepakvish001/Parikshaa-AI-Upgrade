-- The AI-fluency question (docs/PREP-TRACKER.md plan row 87): a candidate may
-- ask an AI assistant while answering. What they ask and what it answers go
-- in the ledger (`ai_assisted`, sealed like answers); here only its cost is
-- counted, under its own route, against the organisation's spend cap.
ALTER TABLE model_usage DROP CONSTRAINT model_usage_route_check;
ALTER TABLE model_usage ADD CONSTRAINT model_usage_route_check CHECK (route IN ('probe', 'assess', 'grade', 'tutor', 'author', 'interview', 'assist'));
