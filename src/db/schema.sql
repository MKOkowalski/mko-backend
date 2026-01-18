-- MKO.pl backend schema (PostgreSQL)
-- Run: psql "$DATABASE_URL" -f schema.sql

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  email       TEXT UNIQUE NOT NULL,
  pass_hash   TEXT NOT NULL,
  is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  is_banned   BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('verify_email','reset_password')),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ads (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  cat         TEXT NOT NULL,
  price       INT,
  year        INT,
  city        TEXT,
  region      TEXT,
  is_premium  BOOLEAN NOT NULL DEFAULT FALSE,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden','deleted')),
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  photos      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ads_cat_idx   ON ads(cat);
CREATE INDEX IF NOT EXISTS ads_price_idx ON ads(price);
CREATE INDEX IF NOT EXISTS ads_year_idx  ON ads(year);

CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY,
  ad_id       TEXT NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  subject     TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
