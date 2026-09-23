-- Billing (ROADMAP §12): how an organisation pays, prepaid attempt credits,
-- Razorpay payments, and GST tax invoices.

-- One per organisation that is billed. An organisation without one is not
-- metered: every attempt it starts is allowed, as before billing existed.
CREATE TABLE billing_accounts (
  org_id             text        PRIMARY KEY REFERENCES organisations (id),
  -- prepaid: an attempt starts only against a credit, bought in advance.
  -- invoiced: attempts are counted and invoiced monthly, in arrears.
  mode               text        NOT NULL CHECK (mode IN ('prepaid', 'invoiced')),
  -- Excluding GST.
  price_paise        integer     NOT NULL CHECK (price_paise > 0),
  credits            integer     NOT NULL DEFAULT 0 CHECK (credits >= 0),
  -- The buyer, as a tax invoice names them.
  legal_name         text        NOT NULL DEFAULT '',
  gstin              text,
  -- Two-digit GST state code: decides CGST+SGST against IGST.
  state_code         char(2),
  address            text        NOT NULL DEFAULT '',
  billing_email      text,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Every change to a balance, append-only. An attempt consumes at most one
-- credit, however many times its start is retried.
CREATE TABLE credit_ledger (
  org_id      text        NOT NULL REFERENCES organisations (id),
  id          text        NOT NULL,
  delta       integer     NOT NULL CHECK (delta <> 0),
  reason      text        NOT NULL CHECK (reason IN ('purchase', 'attempt', 'grant', 'refund')),
  attempt_id  text,
  payment_id  text,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id)
);
CREATE UNIQUE INDEX credit_ledger_one_per_attempt ON credit_ledger (org_id, attempt_id) WHERE reason = 'attempt';
CREATE INDEX credit_ledger_org_idx ON credit_ledger (org_id, created_at);

CREATE TABLE payments (
  org_id               text        NOT NULL REFERENCES organisations (id),
  id                   text        NOT NULL,
  razorpay_order_id    text        NOT NULL UNIQUE,
  razorpay_payment_id  text        UNIQUE,
  credits              integer     NOT NULL CHECK (credits > 0),
  taxable_paise        integer     NOT NULL,
  tax_paise            integer     NOT NULL,
  amount_paise         integer     NOT NULL,
  -- The buyer's state when the order was priced: the invoice taxes what was charged.
  buyer_state          char(2),
  status               text        NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  paid_at              timestamptz,
  PRIMARY KEY (org_id, id)
);

-- Tax invoices. Numbered in one series per financial year across the whole
-- supplier, as GST requires: consecutive, unique, at most 16 characters.
CREATE TABLE invoice_counters (
  fy    text    PRIMARY KEY,
  last  integer NOT NULL
);

CREATE TABLE invoices (
  org_id          text        NOT NULL REFERENCES organisations (id),
  id              text        NOT NULL,
  number          text        NOT NULL UNIQUE CHECK (length(number) <= 16),
  kind            text        NOT NULL CHECK (kind IN ('credits', 'usage')),
  payment_id      text,
  period          text,
  -- Everything printed on the invoice, fixed when it was issued.
  document        jsonb       NOT NULL,
  total_paise     integer     NOT NULL,
  issued_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id)
);
-- One invoice per payment, and one usage invoice per month.
CREATE UNIQUE INDEX invoices_one_per_payment ON invoices (org_id, payment_id) WHERE payment_id IS NOT NULL;
CREATE UNIQUE INDEX invoices_one_per_period ON invoices (org_id, period) WHERE kind = 'usage';

ALTER TABLE billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices         ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON billing_accounts AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY tenant_isolation ON credit_ledger AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY tenant_isolation ON payments AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY tenant_isolation ON invoices AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));

-- Staff only: a candidate's scope never touches money.
CREATE POLICY billing_staff ON billing_accounts
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
CREATE POLICY billing_staff ON credit_ledger
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
CREATE POLICY billing_staff ON payments
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
CREATE POLICY billing_staff ON invoices
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

GRANT SELECT, INSERT, UPDATE ON billing_accounts, payments TO parikshaa_app;
-- Append-only, like the ledger and the audit log.
GRANT SELECT, INSERT ON credit_ledger, invoices TO parikshaa_app;
GRANT SELECT, INSERT, UPDATE ON invoice_counters TO parikshaa_app;
