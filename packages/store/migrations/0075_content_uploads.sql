-- Bulk content upload (tracker plan row 141, part B; docs/content/CONTENT-FORMAT.md).
--
-- The owner's team writes launch content (DSA, SQL, MCQs, lessons, projects,
-- system design) with an AI and uploads it in bundles from the console. Every
-- item is checked by machine; one that passes is kept here as a draft, with
-- its version and the hash of its content. Only when a reviewer presses
-- Publish is it written to practice_problems / prep_lessons (published), where
-- Learn shows it. A later version stays a draft beside the published one
-- until it is published in turn.
--
-- Staff only: a learner has no policy on any of these tables, so a learner's
-- scope reads nothing here, drafts and answer keys included.

-- One upload: a bundle file and what came of it.
CREATE TABLE content_uploads (
  org_id          text        NOT NULL REFERENCES organisations (id),
  id              text        NOT NULL,
  bundle_id       text        NOT NULL CHECK (length(bundle_id) BETWEEN 1 AND 80),
  bundle_version  integer     NOT NULL CHECK (bundle_version >= 1),
  title           text        NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  file_name       text        NOT NULL CHECK (length(file_name) BETWEEN 1 AND 200),
  bytes           integer     NOT NULL CHECK (bytes >= 0),
  -- The bundle's manifest (tracks included: publishing places items by them).
  manifest        jsonb       NOT NULL DEFAULT '{}',
  -- What is wrong with the bundle as a whole: [{gate, message}].
  problems        jsonb       NOT NULL DEFAULT '[]',
  -- checking: items are still waiting for or on the runner. done: every item has its report.
  state           text        NOT NULL DEFAULT 'checking' CHECK (state IN ('checking', 'done')),
  created_by_id   text        NOT NULL,
  created_by_name text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  PRIMARY KEY (org_id, id)
);
CREATE INDEX content_uploads_recent_idx ON content_uploads (org_id, created_at DESC);

-- Each item of an upload, in the bundle's order, and its report.
CREATE TABLE content_upload_items (
  org_id     text        NOT NULL REFERENCES organisations (id),
  upload_id  text        NOT NULL,
  position   integer     NOT NULL CHECK (position >= 0),
  -- Problems (DSA, SQL, MCQ, project, system design) share one namespace; lessons have their own.
  namespace  text        NOT NULL CHECK (namespace IN ('problem', 'lesson')),
  slug       text        NOT NULL CHECK (length(slug) BETWEEN 1 AND 200),
  type       text        NOT NULL CHECK (length(type) BETWEEN 1 AND 40),
  version    integer     NOT NULL DEFAULT 0 CHECK (version >= 0),
  -- SHA-256 of the item's canonical JSON, $file references resolved; empty when it could not be read.
  hash       text        NOT NULL DEFAULT '',
  title      text        NOT NULL DEFAULT '',
  -- The item while it waits to be checked; cleared once it has its report (a draft keeps its own copy).
  item       jsonb,
  -- pending: waits for the runner. checking: on it (claimed_at says since when).
  -- passed: kept as a draft. failed: not kept. skipped: the same version and content are kept already.
  status     text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'checking', 'passed', 'failed', 'skipped')),
  -- [{gate, message}]: why it failed. warnings: what a reviewer should look at, and what was not checked.
  problems   jsonb       NOT NULL DEFAULT '[]',
  warnings   jsonb       NOT NULL DEFAULT '[]',
  claimed_at timestamptz,
  checked_at timestamptz,
  PRIMARY KEY (org_id, upload_id, position),
  FOREIGN KEY (org_id, upload_id) REFERENCES content_uploads (org_id, id) ON DELETE CASCADE
);
CREATE INDEX content_upload_items_waiting_idx ON content_upload_items (org_id, status, claimed_at) WHERE status IN ('pending', 'checking');

-- An item's current version: a draft, or published. What Learn shows is the
-- projection in practice_problems / prep_lessons, written at publish.
CREATE TABLE content_items (
  org_id            text        NOT NULL REFERENCES organisations (id),
  namespace         text        NOT NULL CHECK (namespace IN ('problem', 'lesson')),
  slug              text        NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$'),
  type              text        NOT NULL CHECK (type IN ('dsa-problem', 'sql-problem', 'mcq', 'lesson', 'project', 'system-design')),
  title             text        NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  version           integer     NOT NULL CHECK (version >= 1),
  hash              text        NOT NULL CHECK (hash ~ '^[0-9a-f]{64}$'),
  -- The item as uploaded, $file references resolved.
  item              jsonb       NOT NULL,
  -- What the gates made from it that publishing needs: tests with their expected outputs.
  built             jsonb       NOT NULL DEFAULT '{}',
  -- The upload this version came from; its report says what was checked.
  upload_id         text        NOT NULL,
  warnings          jsonb       NOT NULL DEFAULT '[]',
  -- draft: this version is not published (an earlier one may be). published: this version is live.
  state             text        NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'published')),
  published_version integer,
  published_hash    text,
  published_at      timestamptz,
  published_by_id   text,
  published_by_name text,
  -- Where it is published, once it is: one of the two, by namespace.
  problem_id        text,
  lesson_id         text,
  -- A lesson's quiz and hands-on problems, by their slugs: {"<slug>": "<problem id>"}.
  children          jsonb       NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, namespace, slug),
  FOREIGN KEY (org_id, upload_id) REFERENCES content_uploads (org_id, id),
  FOREIGN KEY (org_id, problem_id) REFERENCES practice_problems (org_id, id),
  FOREIGN KEY (org_id, lesson_id) REFERENCES prep_lessons (org_id, id),
  CHECK ((state = 'published') = (published_version IS NOT NULL AND published_version = version)),
  CHECK (published_version IS NULL OR published_version <= version)
);
CREATE INDEX content_items_upload_idx ON content_items (org_id, upload_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['content_uploads', 'content_upload_items', 'content_items']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I AS RESTRICTIVE
      USING (org_id = current_setting('parikshaa.org_id', true))
      WITH CHECK (org_id = current_setting('parikshaa.org_id', true))$p$, t);
    EXECUTE format($p$CREATE POLICY %s_staff ON %I
      USING (current_setting('parikshaa.actor', true) = 'staff')
      WITH CHECK (current_setting('parikshaa.actor', true) = 'staff')$p$, t, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON content_uploads TO parikshaa_app;
GRANT SELECT, INSERT, UPDATE ON content_upload_items TO parikshaa_app;
GRANT SELECT, INSERT, UPDATE ON content_items TO parikshaa_app;
