-- The two append-only guards (0001, 0003) run with a fixed, empty search_path.
-- Neither reads a table, so nothing changes in what they do; Supabase's
-- security advisor flags any function whose search_path a caller could set
-- (lint 0011), and this keeps that report clean.
ALTER FUNCTION exam_ledger_reject_mutation() SET search_path = '';
ALTER FUNCTION audit_log_reject_mutation() SET search_path = '';
