-- Selling Plus, second part (Prep blueprint §16): a free trial, refunds with
-- a GST credit note, a DSA Pass, and coupons bought with coins.
--
-- A trial is Plus for the site's trial days, once per learner. A refund
-- gives the money back through Razorpay, ends what the order gave (its span
-- of a pass is revoked, its credits taken back as far as they are unspent)
-- and is recorded on a credit note against the order's invoice, in a series
-- of its own (`PKC/2627/000001`). A DSA Pass opens the lessons and the study
-- plan, as Plus does, without the company lists. A coupon item in the coin
-- store makes a coupon for its buyer alone.

ALTER TABLE prep_settings ADD COLUMN trial_days integer NOT NULL DEFAULT 0 CHECK (trial_days BETWEEN 0 AND 60);

ALTER TABLE prep_plus DROP CONSTRAINT prep_plus_source_check;
ALTER TABLE prep_plus ADD CONSTRAINT prep_plus_source_check CHECK (source IN ('payment', 'grant', 'coins', 'trial'));
ALTER TABLE prep_plus DROP CONSTRAINT prep_plus_pass_check;
ALTER TABLE prep_plus ADD CONSTRAINT prep_plus_pass_check CHECK (pass IN ('plus', 'company', 'dsa'));
ALTER TABLE prep_plus ADD COLUMN revoked_at timestamptz;
-- A refund revokes a span: only the server, in the staff scope, and only this column.
GRANT UPDATE (revoked_at) ON prep_plus TO parikshaa_app;

ALTER TABLE prep_products DROP CONSTRAINT prep_products_kind_check;
ALTER TABLE prep_products DROP CONSTRAINT prep_products_check;
ALTER TABLE prep_products ADD CONSTRAINT prep_products_kind_check CHECK (kind IN ('plus', 'credits', 'company', 'dsa'));
ALTER TABLE prep_products ADD CONSTRAINT prep_products_check
  CHECK ((kind IN ('plus', 'company', 'dsa') AND days > 0) OR (kind = 'credits' AND credits > 0 AND days = 0));

ALTER TABLE prep_orders DROP CONSTRAINT prep_orders_pass_check;
ALTER TABLE prep_orders ADD CONSTRAINT prep_orders_pass_check CHECK (pass IN ('plus', 'company', 'dsa'));
ALTER TABLE prep_orders DROP CONSTRAINT prep_orders_status_check;
ALTER TABLE prep_orders ADD CONSTRAINT prep_orders_status_check CHECK (status IN ('created', 'paid', 'refunded'));
ALTER TABLE prep_orders
  ADD COLUMN refunded_at   timestamptz,
  ADD COLUMN refund_id     text,
  ADD COLUMN refund_reason text NOT NULL DEFAULT '' CHECK (length(refund_reason) <= 500);

ALTER TABLE prep_credits DROP CONSTRAINT prep_credits_reason_check;
ALTER TABLE prep_credits ADD CONSTRAINT prep_credits_reason_check CHECK (reason IN ('monthly', 'purchase', 'grant', 'spend', 'refund', 'order_refund'));

CREATE TABLE prep_credit_notes (
  org_id      text        NOT NULL REFERENCES organisations (id),
  id          text        NOT NULL,
  order_id    text        NOT NULL,
  learner_id  text        NOT NULL REFERENCES learners (id),
  number      text        NOT NULL UNIQUE CHECK (length(number) <= 16),
  document    jsonb       NOT NULL,
  total_paise integer     NOT NULL,
  issued_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, order_id),
  FOREIGN KEY (org_id, order_id) REFERENCES prep_orders (org_id, id)
);
ALTER TABLE prep_credit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON prep_credit_notes AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY prep_credit_notes_staff ON prep_credit_notes
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
CREATE POLICY prep_credit_notes_own ON prep_credit_notes FOR SELECT
  USING (current_setting('parikshaa.actor', true) = 'learner'
         AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''));
GRANT SELECT, INSERT ON prep_credit_notes TO parikshaa_app;

-- A coupon may be for one learner alone: the one who bought it with coins.
ALTER TABLE prep_coupons ADD COLUMN learner_id text REFERENCES learners (id);

ALTER TABLE prep_store_items DROP CONSTRAINT prep_store_items_kind_check;
ALTER TABLE prep_store_items DROP CONSTRAINT prep_store_items_check;
ALTER TABLE prep_store_items
  ADD COLUMN coupon_percent integer NOT NULL DEFAULT 0 CHECK (coupon_percent BETWEEN 0 AND 90),
  -- Null: no monthly limit, only per_learner.
  ADD COLUMN per_month      integer CHECK (per_month BETWEEN 1 AND 100);
ALTER TABLE prep_store_items ADD CONSTRAINT prep_store_items_kind_check CHECK (kind IN ('plus', 'digital', 'physical', 'coupon'));
ALTER TABLE prep_store_items ADD CONSTRAINT prep_store_items_check CHECK ((kind = 'plus') = (plus_days > 0) AND (kind = 'coupon') = (coupon_percent > 0));
