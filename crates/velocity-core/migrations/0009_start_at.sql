-- Schema 9 (#350): a waiting download's own start time, local `YYYY-MM-DDTHH:MM`; NULL for none,
-- and for every download saved before schema 9. The manager saves it with the queue.
ALTER TABLE downloads ADD COLUMN start_at TEXT;
