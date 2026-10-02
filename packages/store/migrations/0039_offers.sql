-- Offers, tracked to joining (docs/PREP-TRACKER.md, V2-12 CO33). An offer
-- made in a drive gets a link for the candidate, who accepts or declines it
-- there; the hiring team sees who has answered, who has not, and who
-- accepted and then did not join by the date.

ALTER TABLE drive_applications ADD COLUMN offer_code text;
ALTER TABLE drive_applications ADD COLUMN offer_sent_at timestamptz;
ALTER TABLE drive_applications ADD COLUMN offer_response text CHECK (offer_response IN ('accepted', 'declined'));
ALTER TABLE drive_applications ADD COLUMN offer_responded_at timestamptz;
ALTER TABLE drive_applications ADD COLUMN joining_date date;
ALTER TABLE drive_applications ADD COLUMN offer_note text CHECK (char_length(offer_note) <= 2000);
CREATE UNIQUE INDEX drive_applications_offer_code ON drive_applications (org_id, offer_code) WHERE offer_code IS NOT NULL;
