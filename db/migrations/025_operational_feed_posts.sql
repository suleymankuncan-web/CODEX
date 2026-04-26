CREATE TABLE IF NOT EXISTS ops.feed_post (
    feed_post_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    link_label TEXT,
    link_url TEXT,
    visibility_scope_type TEXT NOT NULL,
    visibility_scope_ids UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    publish_status TEXT NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    metric_code TEXT,
    metric_label TEXT,
    challenge_starts_on DATE,
    challenge_ends_on DATE,
    target_route TEXT,
    created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    updated_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (post_type IN ('announcement', 'challenge')),
    CHECK (visibility_scope_type IN ('company', 'region', 'store')),
    CHECK (publish_status IN ('draft', 'published', 'archived')),
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at),
    CHECK (challenge_ends_on IS NULL OR challenge_starts_on IS NULL OR challenge_ends_on >= challenge_starts_on)
);

CREATE INDEX IF NOT EXISTS feed_post_status_window_idx
    ON ops.feed_post (publish_status, is_pinned DESC, published_at DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS feed_post_scope_ids_idx
    ON ops.feed_post USING GIN (visibility_scope_ids);

COMMENT ON TABLE ops.feed_post IS 'Scoped operational announcements and challenge posts. Challenge posts announce focus windows but do not calculate scores.';
