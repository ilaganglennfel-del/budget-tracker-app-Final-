-- ============================================================
-- Budget Tracker App — Initial Database Schema
-- Run order: users → streaks → transactions → goals → streak_metadata
-- ============================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  balance         NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ------------------------------------------------------------
-- STREAKS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS streaks (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_streak           INT NOT NULL DEFAULT 0,
  longest_streak           INT NOT NULL DEFAULT 0,
  last_active_utc_date     DATE,
  badge_level              TEXT NOT NULL DEFAULT 'seedling'
                             CHECK (badge_level IN ('seedling', 'sprout', 'plant', 'tree')),
  restore_uses_this_month  INT NOT NULL DEFAULT 0,
  restore_month_year       TEXT,          -- format: 'YYYY-MM'
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TRANSACTIONS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  receiver_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount       NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  type         TEXT NOT NULL DEFAULT 'transfer'
                 CHECK (type IN ('transfer', 'deposit')),
  status       TEXT NOT NULL DEFAULT 'completed'
                 CHECK (status IN ('completed', 'failed', 'pending')),
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_sender   ON transactions(sender_id);
CREATE INDEX IF NOT EXISTS idx_transactions_receiver ON transactions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created  ON transactions(created_at DESC);

-- ------------------------------------------------------------
-- GOALS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  target_amount   NUMERIC(15, 2) NOT NULL CHECK (target_amount > 0),
  current_amount  NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (current_amount >= 0),
  target_date     DATE NOT NULL,
  emoji           TEXT DEFAULT '🎯',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);

-- ------------------------------------------------------------
-- STREAK METADATA (audit log)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS streak_metadata (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL
                 CHECK (event_type IN ('streak_increment', 'streak_broken', 'restore_used', 'streak_started')),
  streak_value INT,
  event_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_streak_meta_user ON streak_metadata(user_id);
