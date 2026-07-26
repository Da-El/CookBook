-- Optional photo on fridge items
ALTER TABLE fridge_items
    ADD COLUMN IF NOT EXISTS photo_url TEXT;
