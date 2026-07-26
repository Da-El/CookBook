-- Per-user custom description + photo for catalog ingredients

CREATE TABLE IF NOT EXISTS user_food_meta (
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_id         TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    photo_url       TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, food_id)
);

CREATE INDEX IF NOT EXISTS user_food_meta_user_idx ON user_food_meta (user_id, updated_at DESC);
