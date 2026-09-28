-- Billing, finished (ROADMAP §12): refunds with GST credit notes, TDS, and
-- e-invoicing's IRN.

-- --- refunds and credit notes ---------------------------------------------------

-- A credit note is a GST document like an invoice, issued against one, in a
-- series of its own. It sits in `invoices` beside the invoices it reduces.
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_kind_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_kind_check CHECK (kind IN ('credits', 'usage', 'credit_note'));
ALTER TABLE invoices ADD COLUMN against_invoice text;

-- Credits given back with the payment that bought them, and credits restored
-- when a refund the gateway refused is undone.
ALTER TABLE credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_reason_check;
ALTER TABLE credit_ledger ADD CONSTRAINT credit_ledger_reason_check
  CHECK (reason IN ('purchase', 'attempt', 'grant', 'refund', 'payment_refund', 'refund_reversed'));

-- A refund of unspent credits. `pending` from the moment the credits are
-- taken back until Razorpay confirms; `failed` restores them.
CREATE TABLE refunds (
  org_id             text        NOT NULL REFERENCES organisations (id),
  id                 text        NOT NULL,
  payment_id         text        NOT NULL,
  credits            integer     NOT NULL CHECK (credits > 0),
  taxable_paise      integer     NOT NULL CHECK (taxable_paise >= 0),
  tax_paise          integer     NOT NULL CHECK (tax_paise >= 0),
  amount_paise       integer     NOT NULL CHECK (amount_paise > 0),
  reason             text        NOT NULL,
  status             text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  razorpay_refund_id text        UNIQUE,
  credit_note_id     text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  processed_at       timestamptz,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, payment_id) REFERENCES payments (org_id, id)
);

-- --- TDS ------------------------------------------------------------------------

-- The rate a buyer deducts at source under section 194J, on the value before
-- GST: 2% for technical services, 10% for professional, 0 when none is
-- deducted. The operator sets it; invoices show it and the net payable.
ALTER TABLE billing_accounts ADD COLUMN tds_percent integer NOT NULL DEFAULT 0 CHECK (tds_percent IN (0, 1, 2, 10));

-- A Form 16A the buyer sent: what they deducted against which invoice.
CREATE TABLE tds_certificates (
  org_id       text        NOT NULL REFERENCES organisations (id),
  id           text        NOT NULL,
  invoice_id   text        NOT NULL,
  amount_paise integer     NOT NULL CHECK (amount_paise > 0),
  certificate  text        NOT NULL,
  quarter      text        NOT NULL CHECK (quarter ~ '^[0-9]{4}-[0-9]{2} Q[1-4]$'),
  recorded_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, certificate, invoice_id),
  FOREIGN KEY (org_id, invoice_id) REFERENCES invoices (org_id, id)
);

-- --- e-invoicing ------------------------------------------------------------------

-- The Invoice Registration Portal's answer for an invoice: its IRN, the
-- acknowledgement, and the signed QR code the printed invoice must carry.
-- Invoices themselves are append-only, so this is recorded beside them.
CREATE TABLE e_invoices (
  org_id      text        NOT NULL,
  invoice_id  text        NOT NULL,
  irn         text        NOT NULL UNIQUE CHECK (irn ~ '^[0-9a-f]{64}$'),
  ack_no      text        NOT NULL,
  ack_date    text        NOT NULL,
  signed_qr   text        NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, invoice_id),
  FOREIGN KEY (org_id, invoice_id) REFERENCES invoices (org_id, id)
);

ALTER TABLE refunds          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tds_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE e_invoices       ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON refunds AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY tenant_isolation ON tds_certificates AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY tenant_isolation ON e_invoices AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY billing_staff ON refunds
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
CREATE POLICY billing_staff ON tds_certificates
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
CREATE POLICY billing_staff ON e_invoices
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

GRANT SELECT, INSERT, UPDATE ON refunds TO parikshaa_app;
GRANT SELECT, INSERT ON tds_certificates, e_invoices TO parikshaa_app;
