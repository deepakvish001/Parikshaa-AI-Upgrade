-- Practice (ROADMAP §15): a LeetCode-style practice site per organisation.
--
-- An institution opens a site at /practice/<slug>. Its learners sign up there
-- with their own accounts — distinct from staff, and from candidates, who have
-- none — and solve problems the institution publishes from its bank, in
-- contests or on their own.
--
-- Practice is learning, not assessment: nothing here goes into the integrity
-- ledger. It is tenant data like any other, with row-level security for a
-- third kind of actor, the learner (`parikshaa.actor = 'learner'`, with
-- `parikshaa.learner_id` set once they have signed in).

-- --- the site ---------------------------------------------------------------

-- Outside tenant row-level security, like the identity tables: a request to
-- /practice/<slug> is how the organisation is found in the first place. It
-- holds nothing a visitor to the site does not see.
CREATE TABLE practice_sites (
  org_id     text        PRIMARY KEY REFERENCES organisations (id),
  slug       text        NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  title      text        NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  welcome    text        NOT NULL DEFAULT '',
  -- Closed: nobody can sign up or sign in, and nothing is listed.
  open       boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON practice_sites TO parikshaa_app;

-- --- learners -----------------------------------------------------------------

-- Outside tenant row-level security for the same reason as staff_users: signing
-- in looks a learner up before a scope exists. Only authentication reads them.
CREATE TABLE learners (
  id            text        PRIMARY KEY,
  org_id        text        NOT NULL REFERENCES organisations (id),
  email         text        NOT NULL,
  name          text        NOT NULL,
  password_hash text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Set when a learner deletes their account: the row stays, so their
  -- submissions keep a subject, but name and email are replaced.
  erased_at     timestamptz
);

-- One account per address per site.
CREATE UNIQUE INDEX learners_org_email_idx ON learners (org_id, lower(email));

CREATE TABLE learner_sessions (
  -- The bearer token is never stored, only its SHA-256.
  token_hash text        PRIMARY KEY,
  learner_id text        NOT NULL REFERENCES learners (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX learner_sessions_learner_idx ON learner_sessions (learner_id);

GRANT SELECT, INSERT, UPDATE ON learners, learner_sessions TO parikshaa_app;

-- --- problems -------------------------------------------------------------------

-- A published problem is a copy of a bank question, as an exam's question is:
-- editing the bank changes nothing already published, and the same question
-- can be set in an exam and practised without either touching the other.
CREATE TABLE practice_problems (
  org_id      text        NOT NULL REFERENCES organisations (id),
  id          text        NOT NULL,
  slug        text        NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$'),
  title       text        NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  -- The question itself, answer key included. Learners are served a projection
  -- of it without the key (see `candidateQuestion`), never this.
  question    jsonb       NOT NULL,
  difficulty  text        NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  tags        text[]      NOT NULL DEFAULT '{}',
  -- Markdown: how to solve it, shown to a learner once they have solved it.
  editorial   text        NOT NULL DEFAULT '',
  from_bank   text,
  position    integer     NOT NULL DEFAULT 0,
  published   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, slug)
);

-- --- contests --------------------------------------------------------------------

CREATE TABLE contests (
  org_id      text        NOT NULL REFERENCES organisations (id),
  id          text        NOT NULL,
  slug        text        NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$'),
  title       text        NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  description text        NOT NULL DEFAULT '',
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  problem_ids text[]      NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, slug),
  CHECK (ends_at > starts_at),
  CHECK (cardinality(problem_ids) BETWEEN 1 AND 26)
);

-- --- submissions -------------------------------------------------------------------

CREATE TABLE practice_submissions (
  org_id     text        NOT NULL REFERENCES organisations (id),
  id         text        NOT NULL,
  learner_id text        NOT NULL REFERENCES learners (id),
  problem_id text        NOT NULL,
  -- Made during a contest, and counted on its scoreboard.
  contest_id text,
  -- The language for code; null for a choice or a number.
  language   text,
  answer     text        NOT NULL CHECK (length(answer) <= 262144),
  -- 'passed' is accepted; anything else is a runner verdict, or 'wrong_answer'.
  status     text        NOT NULL,
  passed     integer     NOT NULL DEFAULT 0,
  total      integer     NOT NULL DEFAULT 0,
  time_ms    integer,
  memory_kb  integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, problem_id) REFERENCES practice_problems (org_id, id),
  FOREIGN KEY (org_id, contest_id) REFERENCES contests (org_id, id)
);

CREATE INDEX practice_submissions_learner_idx ON practice_submissions (org_id, learner_id, created_at DESC);
CREATE INDEX practice_submissions_problem_idx ON practice_submissions (org_id, problem_id);
CREATE INDEX practice_submissions_contest_idx ON practice_submissions (org_id, contest_id) WHERE contest_id IS NOT NULL;

-- --- discussion --------------------------------------------------------------------

CREATE TABLE practice_comments (
  org_id        text        NOT NULL REFERENCES organisations (id),
  id            text        NOT NULL,
  problem_id    text        NOT NULL,
  learner_id    text        REFERENCES learners (id),
  staff_user_id text        REFERENCES staff_users (id),
  -- As the author was named when they wrote it.
  author_name   text        NOT NULL,
  body          text        NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Hidden by a moderator; kept, so the decision can be seen and undone.
  hidden_at     timestamptz,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, problem_id) REFERENCES practice_problems (org_id, id),
  CHECK ((learner_id IS NULL) <> (staff_user_id IS NULL))
);

CREATE INDEX practice_comments_problem_idx ON practice_comments (org_id, problem_id, created_at);

-- --- row-level security ---------------------------------------------------------------

ALTER TABLE practice_problems    ENABLE ROW LEVEL SECURITY;
ALTER TABLE contests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_comments    ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON practice_problems AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY tenant_isolation ON contests AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY tenant_isolation ON practice_submissions AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY tenant_isolation ON practice_comments AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));

-- Staff manage everything in their organisation.
CREATE POLICY practice_problems_staff ON practice_problems
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
CREATE POLICY contests_staff ON contests
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
CREATE POLICY practice_submissions_staff ON practice_submissions
  USING (current_setting('parikshaa.actor', true) = 'staff');
CREATE POLICY practice_comments_staff ON practice_comments
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

-- A learner, or a visitor not yet signed in, reads what is published.
CREATE POLICY practice_problems_learner ON practice_problems FOR SELECT
  USING (current_setting('parikshaa.actor', true) = 'learner' AND published);
CREATE POLICY contests_learner ON contests FOR SELECT
  USING (current_setting('parikshaa.actor', true) = 'learner');
CREATE POLICY practice_comments_learner_read ON practice_comments FOR SELECT
  USING (current_setting('parikshaa.actor', true) = 'learner' AND hidden_at IS NULL);

-- A signed-in learner reads and writes only their own submissions and comments.
CREATE POLICY practice_submissions_learner_read ON practice_submissions FOR SELECT
  USING (current_setting('parikshaa.actor', true) = 'learner'
         AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''));
CREATE POLICY practice_submissions_learner_write ON practice_submissions FOR INSERT
  WITH CHECK (current_setting('parikshaa.actor', true) = 'learner'
              AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''));
CREATE POLICY practice_comments_learner_write ON practice_comments FOR INSERT
  WITH CHECK (current_setting('parikshaa.actor', true) = 'learner'
              AND learner_id = nullif(current_setting('parikshaa.learner_id', true), '')
              AND staff_user_id IS NULL AND hidden_at IS NULL);

GRANT SELECT, INSERT, UPDATE ON practice_problems, contests, practice_comments TO parikshaa_app;
GRANT SELECT, INSERT ON practice_submissions TO parikshaa_app;
