-- ============================================================
-- Budget Tracker App — Migration 003
-- Purpose : Idempotently create all missing tables and expand
--           the transactions.type CHECK constraint to support
--           ADD_BALANCE, EXPENSE, SAVE_IT_DEPOSIT, SAVE_IT_WITHDRAWAL
-- Run AFTER : 001_initial_schema.sql, 002_veridian_ledger_schema.sql
-- Safe to re-run: all statements use IF NOT EXISTS / IF EXISTS
-- ============================================================

-- Enable pgcrypto (idempotent)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- BUCKETS  (Save It stash buckets — also called save_it_buckets)
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

CREATE INDEX IF NOT EXISTS idx_expenses_user    ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created ON expenses(created_at DESC);

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
-- ALTER TRANSACTIONS — add bucket_id column if missing
-- ------------------------------------------------------------
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS bucket_id UUID REFERENCES buckets(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- EXPAND transactions.type CHECK constraint
-- Drop the old constraint (either name) and recreate with all types.
-- Supports both original types AND new spec types.
-- ------------------------------------------------------------
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'transfer',
    'deposit',
    'bucket_deposit',
    'bucket_withdrawal',
    'expense',
    'ADD_BALANCE',
    'EXPENSE',
    'SAVE_IT_DEPOSIT',
    'SAVE_IT_WITHDRAWAL'
  ));

-- ------------------------------------------------------------
-- Confirmation message
-- ------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE 'Migration 003 complete — all tables created, transactions.type constraint expanded.';
END $$;
