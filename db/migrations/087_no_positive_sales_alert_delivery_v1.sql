SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_company_identity
    ON ops.store (store_id, company_id);

CREATE TABLE IF NOT EXISTS ops.no_positive_sales_alert_delivery (
    delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_date DATE NOT NULL,
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    assignment_id UUID NOT NULL REFERENCES ops.employee_assignment_history(assignment_id),
    period_anchor DATE NOT NULL,
    recipient_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    claimed_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    smtp_message_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_no_positive_sales_alert_store_company
        FOREIGN KEY (store_id, company_id) REFERENCES ops.store(store_id, company_id),
    CONSTRAINT uq_no_positive_sales_alert_period_recipient
        UNIQUE (employee_id, assignment_id, period_anchor, recipient_email),
    CONSTRAINT ck_no_positive_sales_alert_status
        CHECK (status IN ('pending', 'sending', 'sent', 'uncertain')),
    CONSTRAINT ck_no_positive_sales_alert_recipient
        CHECK (length(recipient_email) BETWEEN 3 AND 320),
    CONSTRAINT ck_no_positive_sales_alert_state CHECK (
        (status = 'pending' AND claimed_at IS NULL AND sent_at IS NULL)
        OR (status = 'sending' AND claimed_at IS NOT NULL AND sent_at IS NULL)
        OR (status = 'sent' AND claimed_at IS NOT NULL AND sent_at IS NOT NULL)
        OR (status = 'uncertain' AND claimed_at IS NOT NULL AND sent_at IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_no_positive_sales_alert_pending
    ON ops.no_positive_sales_alert_delivery (recipient_email, created_at)
    WHERE status = 'pending';
