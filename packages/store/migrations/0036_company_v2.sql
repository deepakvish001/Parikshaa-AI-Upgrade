-- Company prep, second part (Prep blueprint F9): the companies a learner is
-- aiming for, and a pass that opens every company's full list without Plus.
--
-- A target is a company the learner chose: its readiness is shown on the
-- dashboard, and a study plan puts its unsolved problems in the plan's last
-- days. A Company Pass is a product of its own kind; a span of it is held
-- like Plus, but opens only the company lists.

CREATE TABLE prep_targets (
  org_id     text        NOT NULL REFERENCES organisations (id),
  learner_id text        NOT NULL REFERENCES learners (id),
  company_id text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, learner_id, company_id),
  FOREIGN KEY (org_id, company_id) REFERENCES prep_companies (org_id, id)
);

ALTER TABLE prep_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON prep_targets AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY prep_targets_staff ON prep_targets
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
CREATE POLICY prep_targets_own ON prep_targets
  USING (current_setting('parikshaa.actor', true) = 'learner'
         AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''))
  WITH CHECK (current_setting('parikshaa.actor', true) = 'learner'
         AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''));
GRANT SELECT, INSERT, DELETE ON prep_targets TO parikshaa_app;

-- A third kind of product, and which pass a span of time is for.
ALTER TABLE prep_products DROP CONSTRAINT prep_products_kind_check;
ALTER TABLE prep_products DROP CONSTRAINT prep_products_check;
ALTER TABLE prep_products ADD CONSTRAINT prep_products_kind_check CHECK (kind IN ('plus', 'credits', 'company'));
ALTER TABLE prep_products ADD CONSTRAINT prep_products_check
  CHECK ((kind IN ('plus', 'company') AND days > 0) OR (kind = 'credits' AND credits > 0 AND days = 0));

ALTER TABLE prep_orders ADD COLUMN pass text NOT NULL DEFAULT 'plus' CHECK (pass IN ('plus', 'company'));
ALTER TABLE prep_plus ADD COLUMN pass text NOT NULL DEFAULT 'plus' CHECK (pass IN ('plus', 'company'));
