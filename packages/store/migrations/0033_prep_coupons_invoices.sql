-- Selling Plus properly (Prep blueprint §16, F12): coupons, and a tax invoice
-- for every paid order.
--
-- A coupon takes a share or a fixed sum off a plan's price. It may be for one
-- plan or all, for a number of uses, until a date, and may name the affiliate
-- who hands it out (a `?ref=` link carries the code). A learner uses a coupon
-- once. What an order was charged is fixed on the order: the list price, the
-- coupon, the discount.
--
-- Parikshaa's operator takes the payment, so it is the supplier on the
-- invoice, in a series of its own (`PKP/2627/000001`) beside the institutions'
-- invoices. The learner's state, if they give it, decides CGST and SGST
-- against IGST; a GSTIN, if they give one, is printed.

CREATE TABLE prep_coupons (
  org_id      text        NOT NULL REFERENCES organisations (id),
  code        text        NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9-]{2,29}$'),
  kind        text        NOT NULL CHECK (kind IN ('percent', 'flat')),
  -- A percentage (1 to 90), or paise off.
  value       integer     NOT NULL CHECK (value > 0),
  product_id  text,
  max_uses    integer     CHECK (max_uses IS NULL OR max_uses > 0),
  ends_at     timestamptz,
  affiliate   text        NOT NULL DEFAULT '' CHECK (length(affiliate) <= 120),
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, code),
  FOREIGN KEY (org_id, product_id) REFERENCES prep_products (org_id, id),
  CHECK (kind <> 'percent' OR value BETWEEN 1 AND 90)
);

ALTER TABLE prep_orders
  ADD COLUMN list_paise     integer,
  ADD COLUMN coupon_code    text,
  ADD COLUMN discount_paise integer NOT NULL DEFAULT 0 CHECK (discount_paise >= 0),
  ADD COLUMN buyer_name     text    NOT NULL DEFAULT '' CHECK (length(buyer_name) <= 160),
  ADD COLUMN buyer_state    char(2),
  ADD COLUMN buyer_gstin    text    CHECK (buyer_gstin IS NULL OR length(buyer_gstin) = 15);
UPDATE prep_orders SET list_paise = amount_paise WHERE list_paise IS NULL;
ALTER TABLE prep_orders ALTER COLUMN list_paise SET NOT NULL;

-- Uses of a coupon are counted on paid orders. The limits are checked when an
-- order is made, not when it is paid: once Razorpay has the money, the order
-- is honoured.
CREATE INDEX prep_orders_coupon_idx ON prep_orders (org_id, coupon_code) WHERE coupon_code IS NOT NULL;

CREATE TABLE prep_invoices (
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

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['prep_coupons', 'prep_invoices']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I AS RESTRICTIVE
      USING (org_id = current_setting('parikshaa.org_id', true))
      WITH CHECK (org_id = current_setting('parikshaa.org_id', true))$p$, t);
    EXECUTE format($p$CREATE POLICY %s_staff ON %I
      USING (current_setting('parikshaa.actor', true) = 'staff')
      WITH CHECK (current_setting('parikshaa.actor', true) = 'staff')$p$, t, t);
  END LOOP;
  -- A learner reads their own invoices; coupons are checked by the server, in the staff scope.
  CREATE POLICY prep_invoices_own ON prep_invoices FOR SELECT
    USING (current_setting('parikshaa.actor', true) = 'learner'
           AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''));
END $$;

GRANT SELECT, INSERT, UPDATE ON prep_coupons TO parikshaa_app;
GRANT SELECT, INSERT ON prep_invoices TO parikshaa_app;
