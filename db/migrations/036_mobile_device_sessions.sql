CREATE TABLE IF NOT EXISTS ops.mobile_device_session (
    mobile_device_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    provider_subject TEXT NOT NULL,
    device_id_hash TEXT NOT NULL,
    platform TEXT NOT NULL,
    device_name TEXT,
    app_version TEXT,
    os_version TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_by_user_id UUID REFERENCES ops.user_account(user_id),
    revocation_reason TEXT,
    CHECK (platform IN ('ios', 'android')),
    CHECK (status IN ('active', 'revoked', 'expired')),
    CHECK (status <> 'revoked' OR revoked_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_mobile_device_session_user_status
    ON ops.mobile_device_session (user_id, status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_mobile_device_session_active_lookup
    ON ops.mobile_device_session (mobile_device_session_id, user_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mobile_device_session_active_device
    ON ops.mobile_device_session (user_id, device_id_hash)
    WHERE status = 'active';

COMMENT ON TABLE ops.mobile_device_session IS 'Mobile device session registry for active/revoked app sessions. Refresh tokens remain IdP-owned in V1.';
