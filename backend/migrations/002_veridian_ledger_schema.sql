-- ============================================================
-- Veridian Ledger — Schema Upgrade (Migration 002)
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- ------------------------------------------------------------
-- BUCKETS  ("Save It" stash buckets)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS buckets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  emoji          TEXT NOT NULL DEFAULT '🪣',
  bucket_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (bucket_balance >= 0),
  color          TEXT NOT NULL DEFAULT '#10B981',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buckets_user ON buckets(user_id);

-- ------------------------------------------------------------
-- INCOME SOURCES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS income_sources (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'other'
               CHECK (category IN ('job', 'freelance', 'business', 'investment', 'other')),
  amount     NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  frequency  TEXT NOT NULL DEFAULT 'monthly'
               CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_income_user ON income_sources(user_id);

-- ------------------------------------------------------------
-- EXPENSES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  category   TEXT NOT NULL DEFAULT 'other'
               CHECK (category IN ('food', 'transport', 'bills', 'entertainment', 'health', 'shopping', 'other')),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_user     ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created  ON expenses(created_at DESC);

-- ------------------------------------------------------------
-- GARDEN FLOWERS  (gamification rewards)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS garden_flowers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flower_type  TEXT NOT NULL
                 CHECK (flower_type IN ('rose', 'sunflower', 'tulip', 'sakura', 'hibiscus', 'daisy')),
  is_shiny     BOOLEAN NOT NULL DEFAULT true,
  earned_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  streak_value INT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_garden_user ON garden_flowers(user_id);

-- ------------------------------------------------------------
-- ALTER TRANSACTIONS — add bucket_id + expand type CHECK
-- ------------------------------------------------------------
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS bucket_id UUID REFERENCES buckets(id) ON DELETE SET NULL;

-- Drop old type constraint and add expanded one
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('transfer', 'deposit', 'bucket_deposit', 'bucket_withdrawal', 'expense'));
