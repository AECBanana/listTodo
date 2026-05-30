CREATE TABLE IF NOT EXISTS server_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
INSERT INTO server_settings (key, value) VALUES ('registration_open', 'true') ON CONFLICT (key) DO NOTHING;
