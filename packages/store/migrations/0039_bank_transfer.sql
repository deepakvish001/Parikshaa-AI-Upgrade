-- Paying by bank transfer against a quotation (docs/PREP-TRACKER.md, V2-12
-- CL57). A quotation is a payment not yet made, numbered like a Razorpay
-- order but prefixed "neft_", with the buyer's purchase order number if they
-- gave one. When the operator records the transfer's UTR it is paid exactly as
-- a Razorpay payment is: credits and the tax invoice in one transaction.

ALTER TABLE payments ADD COLUMN po_number text CHECK (char_length(po_number) <= 60);
