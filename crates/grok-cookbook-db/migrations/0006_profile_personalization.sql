-- Personal cookbook profile: title, theme, accents, cover art

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS cookbook_title TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS tagline TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS cover_style TEXT NOT NULL DEFAULT 'kitchen',
    ADD COLUMN IF NOT EXISTS accent_hex TEXT,
    ADD COLUMN IF NOT EXISTS favorite_cuisines TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS location_label TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS cover_url TEXT;

COMMENT ON COLUMN users.cookbook_title IS 'Personal cookbook title; empty uses default "{name}''s CookBook"';
COMMENT ON COLUMN users.cover_style IS 'parchment|indigo|kitchen|forest|midnight|rose|ocean|violet|linen';
