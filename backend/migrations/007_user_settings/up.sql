CREATE TABLE user_settings (
    user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme         TEXT NOT NULL DEFAULT 'light',
    primary_color TEXT NOT NULL DEFAULT '#4772fa'
);
