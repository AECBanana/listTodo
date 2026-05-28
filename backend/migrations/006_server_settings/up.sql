CREATE TABLE server_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
INSERT INTO server_settings (key, value) VALUES ('registration_open', 'true');
