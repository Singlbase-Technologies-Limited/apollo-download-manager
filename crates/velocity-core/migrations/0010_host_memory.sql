-- Schema 10 (#325): what the transfer engine learned about each server, so later downloads from it
-- start at the right pace. The host name and port only (`host:port`, lowercase, without a login),
-- the count a download settled at and the most connections it served before it throttled, and
-- when it was last seen. No URL, path, name or login. Forgotten after 7 days (PO decision).
CREATE TABLE host_memory (
    host TEXT PRIMARY KEY NOT NULL,
    connections INTEGER CHECK (connections IS NULL OR connections > 0),
    throttled_to INTEGER CHECK (throttled_to IS NULL OR throttled_to > 0),
    seen_at_ms INTEGER NOT NULL
);
