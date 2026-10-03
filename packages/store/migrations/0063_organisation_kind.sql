-- A startup's own way in (docs/PREP-TRACKER.md plan row 89): an organisation
-- that signs itself up says whether it is a company hiring or an institution
-- examining its students, and its home page then leads with the matching path.
-- Every existing organisation is an institution: that is all that could sign up.
ALTER TABLE organisations
  ADD COLUMN kind text NOT NULL DEFAULT 'institution' CHECK (kind IN ('institution', 'company'));
