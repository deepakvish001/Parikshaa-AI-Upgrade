-- Push notifications (Prep blueprint §17, A1).
--
-- A learner who installs the practice site as an app, or keeps it open in a
-- browser, may let it send the daily reminder as a notification too. Each
-- browser they allow it in is a subscription: where to send (a push service's
-- address) and the keys to encrypt for it. A subscription the push service
-- says is gone is deleted; so are a learner's when their account is.

CREATE TABLE prep_push_subscriptions (
  org_id     text        NOT NULL REFERENCES organisations (id),
  learner_id text        NOT NULL REFERENCES learners (id),
  endpoint   text        NOT NULL CHECK (endpoint ~ '^https://' AND length(endpoint) <= 1000),
  p256dh     text        NOT NULL CHECK (length(p256dh) BETWEEN 1 AND 200),
  auth       text        NOT NULL CHECK (length(auth) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, endpoint)
);
CREATE INDEX prep_push_subscriptions_learner_idx ON prep_push_subscriptions (org_id, learner_id);

ALTER TABLE prep_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON prep_push_subscriptions AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY prep_push_subscriptions_staff ON prep_push_subscriptions
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
-- A learner adds and removes their own.
CREATE POLICY prep_push_subscriptions_own ON prep_push_subscriptions
  USING (current_setting('parikshaa.actor', true) = 'learner'
         AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''))
  WITH CHECK (current_setting('parikshaa.actor', true) = 'learner'
         AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON prep_push_subscriptions TO parikshaa_app;
