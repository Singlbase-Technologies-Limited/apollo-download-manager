-- Schema 8 (#351, option B, PO decision 2026-11-05): the default is now 2 downloads at once. A
-- stored 3, 0.1.x's default, can't be told from a chosen 3, so it becomes 2, once: user_version
-- records this migration, and a 3 chosen afterwards is kept. Every other value is kept as it is.
UPDATE settings
SET document = json_set(document, '$.queue.maxConcurrentDownloads', 2)
WHERE json_extract(document, '$.queue.maxConcurrentDownloads') = 3;
