-- Prep, together (ROADMAP §16): companies and the problems they ask, interview
-- experiences learners write, a store where coins are spent, and a rating from
-- contests.
--
-- A company's questions are reports: a problem, a company, and the day it was
-- asked, from staff or from a published interview experience. How often and
-- how lately a problem is asked is counted from the reports, not typed in.

CREATE TABLE prep_companies (
  org_id     text        NOT NULL REFERENCES organisations (id),
  id         text        NOT NULL,
  slug       text        NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$'),
  name       text        NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  about      text        NOT NULL DEFAULT '' CHECK (length(about) <= 20000),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, slug)
);

CREATE TABLE prep_experiences (
  org_id       text        NOT NULL REFERENCES organisations (id),
  id           text        NOT NULL,
  learner_id   text        NOT NULL REFERENCES learners (id),
  company_id   text        NOT NULL,
  role         text        NOT NULL CHECK (length(role) BETWEEN 1 AND 120),
  -- When the interview was, as a month: YYYY-MM.
  interviewed  text        NOT NULL CHECK (interviewed ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  verdict      text        NOT NULL CHECK (verdict IN ('offer', 'reject', 'waiting')),
  -- Each round: its kind, what was asked, and the site's problems it matched.
  rounds       jsonb       NOT NULL,
  tips         text        NOT NULL DEFAULT '' CHECK (length(tips) <= 10000),
  author_name  text        NOT NULL,
  status       text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
  reviewed_by  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, company_id) REFERENCES prep_companies (org_id, id)
);

CREATE INDEX prep_experiences_company_idx ON prep_experiences (org_id, company_id, status, published_at DESC);

CREATE TABLE prep_experience_votes (
  org_id        text        NOT NULL REFERENCES organisations (id),
  experience_id text        NOT NULL,
  learner_id    text        NOT NULL REFERENCES learners (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, experience_id, learner_id),
  FOREIGN KEY (org_id, experience_id) REFERENCES prep_experiences (org_id, id)
);

CREATE TABLE prep_company_reports (
  org_id        text        NOT NULL REFERENCES organisations (id),
  id            text        NOT NULL,
  company_id    text        NOT NULL,
  problem_id    text        NOT NULL,
  reported_on   date        NOT NULL,
  source        text        NOT NULL CHECK (source IN ('staff', 'experience')),
  experience_id text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, company_id) REFERENCES prep_companies (org_id, id),
  FOREIGN KEY (org_id, problem_id) REFERENCES practice_problems (org_id, id)
);

CREATE INDEX prep_company_reports_idx ON prep_company_reports (org_id, company_id, reported_on DESC);

-- --- the store ------------------------------------------------------------------------

CREATE TABLE prep_store_items (
  org_id       text        NOT NULL REFERENCES organisations (id),
  id           text        NOT NULL,
  title        text        NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  description  text        NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  -- 'plus' gives days of Plus at once; 'digital' and 'physical' are fulfilled by staff.
  kind         text        NOT NULL CHECK (kind IN ('plus', 'digital', 'physical')),
  plus_days    integer     NOT NULL DEFAULT 0 CHECK (plus_days BETWEEN 0 AND 400),
  price_coins  integer     NOT NULL CHECK (price_coins BETWEEN 1 AND 10000000),
  -- Null: as many as are wanted.
  stock        integer     CHECK (stock >= 0),
  per_learner  integer     NOT NULL DEFAULT 1 CHECK (per_learner BETWEEN 1 AND 100),
  active       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  CHECK ((kind = 'plus') = (plus_days > 0))
);

CREATE TABLE prep_store_orders (
  org_id       text        NOT NULL REFERENCES organisations (id),
  id           text        NOT NULL,
  learner_id   text        NOT NULL REFERENCES learners (id),
  item_id      text        NOT NULL,
  title        text        NOT NULL,
  price_coins  integer     NOT NULL,
  -- Where a physical item goes. Blanked when the account is deleted.
  address      text        NOT NULL DEFAULT '' CHECK (length(address) <= 1000),
  status       text        NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'fulfilled', 'cancelled')),
  note         text        NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
  created_at   timestamptz NOT NULL DEFAULT now(),
  closed_at    timestamptz,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, item_id) REFERENCES prep_store_items (org_id, id)
);

CREATE INDEX prep_store_orders_learner_idx ON prep_store_orders (org_id, learner_id, created_at DESC);

-- --- contest ratings ------------------------------------------------------------------

-- A contest's rating changes, made once when it has ended. A learner's rating is
-- their latest row's; before any, 1500.
CREATE TABLE prep_ratings (
  org_id     text        NOT NULL REFERENCES organisations (id),
  contest_id text        NOT NULL,
  learner_id text        NOT NULL REFERENCES learners (id),
  rank       integer     NOT NULL,
  before     integer     NOT NULL,
  after      integer     NOT NULL,
  rated_at   timestamptz NOT NULL,
  PRIMARY KEY (org_id, contest_id, learner_id),
  FOREIGN KEY (org_id, contest_id) REFERENCES contests (org_id, id)
);

CREATE INDEX prep_ratings_learner_idx ON prep_ratings (org_id, learner_id, rated_at DESC);

-- --- row-level security -----------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['prep_companies', 'prep_experiences', 'prep_experience_votes', 'prep_company_reports', 'prep_store_items', 'prep_store_orders', 'prep_ratings']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I AS RESTRICTIVE
      USING (org_id = current_setting('parikshaa.org_id', true))
      WITH CHECK (org_id = current_setting('parikshaa.org_id', true))$p$, t);
    EXECUTE format($p$CREATE POLICY %s_staff ON %I
      USING (current_setting('parikshaa.actor', true) = 'staff')
      WITH CHECK (current_setting('parikshaa.actor', true) = 'staff')$p$, t, t);
  END LOOP;

  -- Public: companies, what they ask, published experiences, the store's items, ratings.
  CREATE POLICY prep_companies_learner ON prep_companies FOR SELECT USING (current_setting('parikshaa.actor', true) = 'learner');
  CREATE POLICY prep_company_reports_learner ON prep_company_reports FOR SELECT USING (current_setting('parikshaa.actor', true) = 'learner');
  CREATE POLICY prep_store_items_learner ON prep_store_items FOR SELECT USING (current_setting('parikshaa.actor', true) = 'learner' AND active);
  CREATE POLICY prep_ratings_learner ON prep_ratings FOR SELECT USING (current_setting('parikshaa.actor', true) = 'learner');
  CREATE POLICY prep_experiences_learner_read ON prep_experiences FOR SELECT
    USING (current_setting('parikshaa.actor', true) = 'learner'
           AND (status = 'published' OR learner_id = nullif(current_setting('parikshaa.learner_id', true), '')));

  -- A learner writes an experience in their own name, as pending; staff publish it.
  CREATE POLICY prep_experiences_learner_write ON prep_experiences FOR INSERT
    WITH CHECK (current_setting('parikshaa.actor', true) = 'learner'
                AND learner_id = nullif(current_setting('parikshaa.learner_id', true), '')
                AND status = 'pending' AND reviewed_by IS NULL AND published_at IS NULL);

  -- Votes: one's own.
  CREATE POLICY prep_experience_votes_own ON prep_experience_votes
    USING (current_setting('parikshaa.actor', true) = 'learner' AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''))
    WITH CHECK (current_setting('parikshaa.actor', true) = 'learner' AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''));

  -- Store orders: a learner reads their own; the server places them, in the staff scope.
  CREATE POLICY prep_store_orders_own ON prep_store_orders FOR SELECT
    USING (current_setting('parikshaa.actor', true) = 'learner' AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''));
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON prep_companies, prep_company_reports, prep_store_items TO parikshaa_app;
GRANT SELECT, INSERT, UPDATE ON prep_experiences, prep_store_orders TO parikshaa_app;
GRANT SELECT, INSERT, DELETE ON prep_experience_votes TO parikshaa_app;
GRANT SELECT, INSERT ON prep_ratings TO parikshaa_app;

-- A store refund puts coins back as a positive row; a purchase is a negative one.
-- Both are rows of the ledger, which is still only ever added to.
