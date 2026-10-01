SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

-- Provider tokens never enter the browser or application read APIs.
CREATE TABLE IF NOT EXISTS ops.managed_browser_session (
    session_id TEXT PRIMARY KEY CHECK (session_id ~ '^[A-Za-z0-9_-]{22}$'),
    login_fingerprint TEXT NOT NULL UNIQUE CHECK (login_fingerprint ~ '^[a-f0-9]{64}$'),
    status TEXT NOT NULL CHECK (status IN ('creating', 'active', 'revoked')),
    user_id UUID REFERENCES ops.user_account(user_id) ON DELETE CASCADE,
    issuer TEXT,
    subject TEXT,
    refresh_ciphertext TEXT,
    access_expires_at TIMESTAMPTZ,
    refreshed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    CHECK (expires_at > created_at),
    CHECK (status <> 'active' OR (user_id IS NOT NULL AND issuer IS NOT NULL
        AND subject IS NOT NULL AND refresh_ciphertext IS NOT NULL AND access_expires_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ix_managed_browser_session_expiry ON ops.managed_browser_session(expires_at);
COMMENT ON TABLE ops.managed_browser_session IS
    'V2 browser sessions: fixed app maximum, verified provider binding, encrypted refresh credential, bounded login replay.';
