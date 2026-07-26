-- Meals, follows, blocks (reviews use existing subject_ratings)

CREATE TABLE IF NOT EXISTS meals (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          TEXT NOT NULL CHECK (status IN ('cooked', 'want_to_cook')),
    title           TEXT NOT NULL,
    story           TEXT NOT NULL DEFAULT '',
    cuisine         TEXT NOT NULL DEFAULT '',
    time_minutes    INTEGER,
    visibility      TEXT NOT NULL DEFAULT 'public'
                        CHECK (visibility IN ('public', 'private')),
    photo_url       TEXT,
    author_rating   SMALLINT CHECK (author_rating IS NULL OR (author_rating >= 1 AND author_rating <= 10)),
    macros_kcal     DOUBLE PRECISION,
    macros_protein_g DOUBLE PRECISION,
    macros_fat_g    DOUBLE PRECISION,
    macros_carbs_g  DOUBLE PRECISION,
    macros_fiber_g  DOUBLE PRECISION,
    macros_estimated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meals_user_idx ON meals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS meals_feed_public
    ON meals (created_at DESC, id DESC)
    WHERE visibility = 'public';

CREATE TABLE IF NOT EXISTS meal_ingredients (
    id              TEXT PRIMARY KEY,
    meal_id         TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    food_id         TEXT NOT NULL,
    food_name       TEXT NOT NULL DEFAULT '',
    quantity_text   TEXT NOT NULL DEFAULT '',
    quantity_g      DOUBLE PRECISION,
    sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS meal_ingredients_meal_idx ON meal_ingredients (meal_id, sort_order);

CREATE TABLE IF NOT EXISTS follows (
    follower_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS follows_following_idx ON follows (following_id);

CREATE TABLE IF NOT EXISTS blocks (
    blocker_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON blocks (blocked_id);

-- Average rating helper columns queried live; index already on subject_ratings
