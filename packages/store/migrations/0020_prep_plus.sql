-- Prep, Plus and Sahayak (ROADMAP §16): what a practice site sells, what a
-- learner has bought or been given, the credits the AI tutor spends, and a
-- record of what the tutor said.
--
-- A site that does not turn Plus on sells nothing and locks nothing. One that
-- does keeps its first modules and its problem set free, and asks for Plus for
-- the rest of its lessons and for a study plan.

-- --- what the site offers -----------------------------------------------------------

CREATE TABLE prep_settings (
  org_id          text        PRIMARY KEY REFERENCES organisations (id),
  plus_enabled    boolean     NOT NULL DEFAULT false,
  -- Of each track, how many modules' lessons are free.
  free_modules    integer     NOT NULL DEFAULT 1 CHECK (free_modules BETWEEN 0 AND 60),
  -- AI credits every signed-in learner is given each calendar month (IST).
  monthly_credits integer     NOT NULL DEFAULT 100 CHECK (monthly_credits BETWEEN 0 AND 100000),
  -- The tutor at all: off, and no learner can ask it anything.
  tutor_enabled   boolean     NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE prep_products (
  org_id      text        NOT NULL REFERENCES organisations (id),
  id          text        NOT NULL,
  title       text        NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  -- Plus for some days (and perhaps credits with it), or credits alone.
  kind        text        NOT NULL CHECK (kind IN ('plus', 'credits')),
  days        integer     NOT NULL DEFAULT 0 CHECK (days BETWEEN 0 AND 1100),
  credits     integer     NOT NULL DEFAULT 0 CHECK (credits BETWEEN 0 AND 1000000),
  -- What the learner pays, GST included, in paise.
  price_paise integer     NOT NULL CHECK (price_paise BETWEEN 100 AND 100000000),
  active      boolean     NOT NULL DEFAULT true,
  position    integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  CHECK ((kind = 'plus' AND days > 0) OR (kind = 'credits' AND credits > 0 AND days = 0))
);

-- --- what a learner buys and holds ---------------------------------------------------

CREATE TABLE prep_orders (
  org_id            text        NOT NULL REFERENCES organisations (id),
  id                text        NOT NULL,
  learner_id        text        NOT NULL REFERENCES learners (id),
  product_id        text        NOT NULL,
  -- As the product stood when bought.
  title             text        NOT NULL,
  days              integer     NOT NULL,
  credits           integer     NOT NULL,
  amount_paise      integer     NOT NULL,
  tax_paise         integer     NOT NULL,
  gateway_order_id  text        NOT NULL UNIQUE,
  payment_id        text        UNIQUE,
  status            text        NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  paid_at           timestamptz,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, product_id) REFERENCES prep_products (org_id, id)
);

CREATE INDEX prep_orders_learner_idx ON prep_orders (org_id, learner_id, created_at DESC);

-- Plus, for a span of time: bought, given by the institution, or redeemed with coins.
CREATE TABLE prep_plus (
  org_id     text        NOT NULL REFERENCES organisations (id),
  id         text        NOT NULL,
  learner_id text        NOT NULL REFERENCES learners (id),
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  source     text        NOT NULL CHECK (source IN ('payment', 'grant', 'coins')),
  -- The order, the staff member, or the coin redemption.
  ref        text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, source, ref),
  CHECK (ends_at > starts_at)
);

CREATE INDEX prep_plus_learner_idx ON prep_plus (org_id, learner_id, ends_at);

-- The AI credit ledger: rows are added, never changed. A key names what a row
-- is for, so the same grant or charge is never made twice.
CREATE TABLE prep_credits (
  org_id     text        NOT NULL REFERENCES organisations (id),
  id         text        NOT NULL,
  learner_id text        NOT NULL REFERENCES learners (id),
  delta      integer     NOT NULL CHECK (delta <> 0),
  reason     text        NOT NULL CHECK (reason IN ('monthly', 'purchase', 'grant', 'spend', 'refund')),
  key        text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, learner_id, key)
);

-- What the tutor was asked and what it said: the learner's to read back and to
-- delete, and kept 180 days at most (the privacy sweep's rule).
CREATE TABLE prep_tutor (
  org_id      text        NOT NULL REFERENCES organisations (id),
  id          text        NOT NULL,
  learner_id  text        NOT NULL REFERENCES learners (id),
  mode        text        NOT NULL CHECK (mode IN ('hint', 'review', 'doubt')),
  problem_id  text,
  lesson_id   text,
  hint_level  integer     CHECK (hint_level BETWEEN 1 AND 4),
  question    text        NOT NULL DEFAULT '' CHECK (length(question) <= 4000),
  answer      text        NOT NULL,
  credits     integer     NOT NULL,
  model       text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, id)
);

CREATE INDEX prep_tutor_learner_idx ON prep_tutor (org_id, learner_id, created_at DESC);

-- The tutor's spend counts toward the organisation's monthly model budget.
ALTER TABLE model_usage DROP CONSTRAINT IF EXISTS model_usage_route_check;
ALTER TABLE model_usage ADD CONSTRAINT model_usage_route_check CHECK (route IN ('probe', 'assess', 'grade', 'tutor'));

-- --- row-level security -----------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['prep_settings', 'prep_products', 'prep_orders', 'prep_plus', 'prep_credits', 'prep_tutor']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I AS RESTRICTIVE
      USING (org_id = current_setting('parikshaa.org_id', true))
      WITH CHECK (org_id = current_setting('parikshaa.org_id', true))$p$, t);
    EXECUTE format($p$CREATE POLICY %s_staff ON %I
      USING (current_setting('parikshaa.actor', true) = 'staff')
      WITH CHECK (current_setting('parikshaa.actor', true) = 'staff')$p$, t, t);
  END LOOP;

  -- What the site offers is public.
  CREATE POLICY prep_settings_learner ON prep_settings FOR SELECT USING (current_setting('parikshaa.actor', true) = 'learner');
  CREATE POLICY prep_products_learner ON prep_products FOR SELECT USING (current_setting('parikshaa.actor', true) = 'learner' AND active);

  -- A learner reads their own orders, Plus, credits and tutor history. Only the
  -- server, in the staff scope, writes them: a learner cannot buy themselves
  -- anything. They may delete what the tutor said to them.
  FOREACH t IN ARRAY ARRAY['prep_orders', 'prep_plus', 'prep_credits', 'prep_tutor']
  LOOP
    EXECUTE format($p$CREATE POLICY %s_own ON %I FOR SELECT
      USING (current_setting('parikshaa.actor', true) = 'learner'
             AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''))$p$, t, t);
  END LOOP;
  CREATE POLICY prep_tutor_own_delete ON prep_tutor FOR DELETE
    USING (current_setting('parikshaa.actor', true) = 'learner'
           AND learner_id = nullif(current_setting('parikshaa.learner_id', true), ''));
END $$;

GRANT SELECT, INSERT, UPDATE ON prep_settings, prep_products, prep_orders TO parikshaa_app;
GRANT SELECT, INSERT ON prep_plus, prep_credits TO parikshaa_app;
GRANT SELECT, INSERT, DELETE ON prep_tutor TO parikshaa_app;
