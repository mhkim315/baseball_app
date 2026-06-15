CREATE TABLE IF NOT EXISTS device_tokens (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
    target_team_id TEXT NOT NULL,
    app_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(token, platform)
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_platform ON device_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_device_tokens_team ON device_tokens(target_team_id);
