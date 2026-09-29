-- When a member of staff's address was shown to be theirs (pilot readiness).
-- Everyone already here was added by the operator or by an owner, who vouch
-- for the address: they count as verified. An institution that signs itself
-- up starts without it, and until its owner opens the link it can build
-- exams but not reach anyone else: no invitations, no staff, no API keys.
ALTER TABLE staff_users ADD COLUMN email_verified_at timestamptz DEFAULT now();
