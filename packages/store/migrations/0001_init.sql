-- Parikshaa initial schema.
--
-- The integrity properties of the ledger are enforced here, in the database,
-- not only in application code. An application bug should not be able to fork a
-- hash chain or silently rewrite history.

CREATE TABLE exams (
  id          text        PRIMARY KEY,
  title       text        NOT NULL,
  definition  jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE attempts (
  id           text        PRIMARY KEY,
  exam_id      text        NOT NULL REFERENCES exams (id),
  candidate_id text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX attempts_candidate_idx ON attempts (candidate_id);

CREATE TABLE exam_ledger (
  attempt_id text     NOT NULL REFERENCES attempts (id),
  seq        integer  NOT NULL,
  ts         bigint   NOT NULL,
  event_type text     NOT NULL,
  -- `event` is for querying and reporting only.
  event      jsonb    NOT NULL,
  -- `preimage` is the exact canonicalize() output that was hashed. Verification
  -- reads THIS, never `event`: jsonb stores numbers as numeric, so a round-trip
  -- can re-render a value and make an untouched row look tampered with.
  preimage   text     NOT NULL,
  prev_hash  char(64) NOT NULL,
  hash       char(64) NOT NULL,

  -- The most important constraint in the schema. Two concurrent appends cannot
  -- both take position `seq`; the loser fails loudly instead of forking the chain.
  PRIMARY KEY (attempt_id, seq),

  CONSTRAINT exam_ledger_hash_unique UNIQUE (hash),
  CONSTRAINT exam_ledger_seq_non_negative CHECK (seq >= 0)
);

CREATE INDEX exam_ledger_type_idx ON exam_ledger (attempt_id, event_type);

-- Append-only, enforced by the database.
--
-- Role grants are the first line of defence (see 0002_roles.sql), but a trigger
-- also holds for a superuser connection, a migration run by mistake, or an ORM
-- that decides an UPDATE is a reasonable way to express an upsert.
CREATE FUNCTION exam_ledger_reject_mutation() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'exam_ledger is append-only; % is not permitted', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER exam_ledger_append_only
  BEFORE UPDATE OR DELETE ON exam_ledger
  FOR EACH ROW EXECUTE FUNCTION exam_ledger_reject_mutation();

-- A candidate can read their own ledger (SPEC §6.2). A record kept against
-- someone that they cannot inspect is not evidence, so this is a product
-- requirement expressed as a policy rather than a handler someone can forget.
ALTER TABLE exam_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY exam_ledger_own_attempt ON exam_ledger
  FOR SELECT
  USING (attempt_id = current_setting('parikshaa.attempt_id', true));
