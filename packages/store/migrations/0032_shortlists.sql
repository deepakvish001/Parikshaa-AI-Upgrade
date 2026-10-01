-- A shortlist for a hiring manager (docs/PREP-TRACKER.md, V2-12 CO23): a
-- link that expires, opened without an account, showing chosen candidates'
-- marks — never their answers or contact details — and taking the manager's
-- decision on each. The link's code is derived from the server's secret and
-- the shortlist's id; nothing secret is stored.

CREATE TABLE shortlists (
  org_id      text        NOT NULL,
  id          text        NOT NULL,
  exam_id     text        NOT NULL,
  title       text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  refs        text[]      NOT NULL,
  created_by  text        NOT NULL,
  created_at  timestamptz NOT NULL,
  expires_at  timestamptz NOT NULL,
  revoked     boolean     NOT NULL DEFAULT false,
  PRIMARY KEY (org_id, id)
);

CREATE TABLE shortlist_decisions (
  org_id         text        NOT NULL,
  shortlist_id   text        NOT NULL,
  candidate_ref  text        NOT NULL,
  decision       text        NOT NULL CHECK (decision IN ('shortlist', 'hold', 'reject')),
  comment        text        NOT NULL DEFAULT '' CHECK (char_length(comment) <= 1000),
  decided_by     text        NOT NULL CHECK (char_length(decided_by) BETWEEN 1 AND 100),
  decided_at     timestamptz NOT NULL,
  PRIMARY KEY (org_id, shortlist_id, candidate_ref),
  FOREIGN KEY (org_id, shortlist_id) REFERENCES shortlists (org_id, id) ON DELETE CASCADE
);

ALTER TABLE shortlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON shortlists AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY shortlists_staff ON shortlists
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

ALTER TABLE shortlist_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON shortlist_decisions AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY shortlist_decisions_staff ON shortlist_decisions
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

GRANT SELECT, INSERT, UPDATE, DELETE ON shortlists, shortlist_decisions TO parikshaa_app;
