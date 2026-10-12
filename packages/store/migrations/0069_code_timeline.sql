-- Code playback (docs/F1-GO-LIVE-PLAN.md §5.4, G4): how a code answer was
-- written, as the editor's changes in order, for a reviewer to play back. Each
-- batch the browser sends is one row, sealed under the attempt's data key like
-- the photos (0011): erasing the key makes it unreadable, and erasure deletes
-- the rows. Observations for a person to weigh, never a finding.
CREATE TABLE code_timeline (
  org_id       text        NOT NULL,
  attempt_id   text        NOT NULL,
  question_id  text        NOT NULL,
  seq          bigint      GENERATED ALWAYS AS IDENTITY,
  received_at  timestamptz NOT NULL,
  -- Size of the batch before sealing, to cap what one attempt may send.
  bytes        integer     NOT NULL CHECK (bytes > 0),
  -- AES-256-GCM: iv | ciphertext | tag, bound to the attempt and the question.
  sealed       bytea       NOT NULL,
  PRIMARY KEY (org_id, seq),
  FOREIGN KEY (org_id, attempt_id) REFERENCES attempts (org_id, id)
);
CREATE INDEX code_timeline_attempt_idx ON code_timeline (org_id, attempt_id, seq);

ALTER TABLE code_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON code_timeline AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));

CREATE POLICY code_timeline_staff ON code_timeline
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

-- A candidate adds to their own attempt's, and may count what they sent (for
-- the cap); the sealed bytes are useless without the server's key.
CREATE POLICY code_timeline_candidate_insert ON code_timeline FOR INSERT
  WITH CHECK (current_setting('parikshaa.actor', true) = 'candidate'
              AND attempt_id = current_setting('parikshaa.attempt_id', true));
CREATE POLICY code_timeline_candidate_select ON code_timeline FOR SELECT
  USING (current_setting('parikshaa.actor', true) = 'candidate'
         AND attempt_id = current_setting('parikshaa.attempt_id', true));

GRANT SELECT, INSERT, DELETE ON code_timeline TO parikshaa_app;
