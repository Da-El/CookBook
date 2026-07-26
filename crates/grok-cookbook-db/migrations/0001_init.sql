-- CookBook initial schema (M0/M1 foundation)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Opaque text IDs (ULID strings preferred at app layer)
CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash   TEXT,
    display_name    TEXT NOT NULL,
    handle          TEXT NOT NULL UNIQUE,
    bio             TEXT NOT NULL DEFAULT '',
    avatar_url      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fridge_items (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_id         TEXT NOT NULL,
    food_name       TEXT NOT NULL DEFAULT '',
    quantity        TEXT NOT NULL DEFAULT '1',
    location        TEXT NOT NULL DEFAULT 'Fridge',
    bought_on       DATE,
    expires_on      DATE,
    notes           TEXT NOT NULL DEFAULT '',
    rating          SMALLINT CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fridge_items_user_idx ON fridge_items (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS subject_ratings (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_type    TEXT NOT NULL CHECK (subject_type IN ('ingredient', 'meal')),
    subject_id      TEXT NOT NULL,
    score           SMALLINT NOT NULL CHECK (score >= 1 AND score <= 10),
    notes           TEXT NOT NULL DEFAULT '',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS subject_ratings_subject_idx
    ON subject_ratings (subject_type, subject_id);
