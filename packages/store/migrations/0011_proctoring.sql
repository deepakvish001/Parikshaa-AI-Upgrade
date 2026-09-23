-- Camera proctoring (ROADMAP §14): the photos a proctored exam takes, and
-- what the candidate's browser reported. Kept outside the ledger — there are
-- too many to chain one by one — but the identity photos' hashes are in it.

-- Photos, sealed under the attempt's own data key (see 0009): erasing the key
-- makes them unreadable along with the answers; erasure also deletes the rows.
CREATE TABLE proctor_media (
  org_id      text        NOT NULL,
  attempt_id  text        NOT NULL,
  id          text        NOT NULL,
  kind        text        NOT NULL CHECK (kind IN ('selfie', 'id', 'snapshot')),
  taken_at    timestamptz NOT NULL,
  sha256      char(64)    NOT NULL,
  -- AES-256-GCM: iv | ciphertext | tag, bound to the attempt and the photo's id.
  sealed      bytea       NOT NULL,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, attempt_id) REFERENCES attempts (org_id, id)
);
CREATE INDEX proctor_media_attempt_idx ON proctor_media (org_id, attempt_id, taken_at);

-- What the browser said happened: the tab hidden, full screen left, a copy or
-- a paste, the camera stopping. Observations, never findings.
CREATE TABLE proctor_events (
  org_id      text        NOT NULL,
  attempt_id  text        NOT NULL,
  id          text        NOT NULL,
  kind        text        NOT NULL CHECK (kind IN ('tab_hidden', 'fullscreen_exit', 'copy', 'paste', 'camera_off', 'camera_on')),
  at          timestamptz NOT NULL,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, attempt_id) REFERENCES attempts (org_id, id)
);
CREATE INDEX proctor_events_attempt_idx ON proctor_events (org_id, attempt_id, at);

ALTER TABLE proctor_media  ENABLE ROW LEVEL SECURITY;
ALTER TABLE proctor_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON proctor_media AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY tenant_isolation ON proctor_events AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));

CREATE POLICY proctor_media_staff ON proctor_media
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
CREATE POLICY proctor_events_staff ON proctor_events
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

-- A candidate adds to their own attempt's, and reads none back.
CREATE POLICY proctor_media_candidate ON proctor_media FOR INSERT
  WITH CHECK (current_setting('parikshaa.actor', true) = 'candidate'
              AND attempt_id = current_setting('parikshaa.attempt_id', true));
CREATE POLICY proctor_events_candidate ON proctor_events FOR INSERT
  WITH CHECK (current_setting('parikshaa.actor', true) = 'candidate'
              AND attempt_id = current_setting('parikshaa.attempt_id', true));

GRANT SELECT, INSERT, DELETE ON proctor_media, proctor_events TO parikshaa_app;
