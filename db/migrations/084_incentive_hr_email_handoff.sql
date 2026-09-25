CREATE TABLE IF NOT EXISTS ops.incentive_hr_delivery (
    delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    period_key CHAR(7) NOT NULL CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    preview_version TEXT NOT NULL CHECK (preview_version ~ '^[a-f0-9]{64}$'),
    recipients TEXT[] NOT NULL CHECK (cardinality(recipients) BETWEEN 1 AND 20),
    attachment_sha256 TEXT NOT NULL CHECK (attachment_sha256 ~ '^[a-f0-9]{64}$'),
    status TEXT NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'sent', 'uncertain')),
    smtp_message_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    UNIQUE (company_id, period_key),
    CHECK (status <> 'sent' OR (sent_at IS NOT NULL AND smtp_message_id IS NOT NULL))
);
COMMENT ON TABLE ops.incentive_hr_delivery IS 'One guarded HR email handoff per company and incentive period. Uncertain SMTP outcomes require operator reconciliation, never automatic replay.';
