SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

CREATE TABLE IF NOT EXISTS ops.store_ownership_transition (
    store_ownership_transition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    effective_on DATE NOT NULL,
    previous_type TEXT NOT NULL CHECK (previous_type IN ('company', 'franchise', 'operator')),
    new_type TEXT NOT NULL CHECK (new_type IN ('company', 'franchise', 'operator')),
    changed_by_user_id UUID REFERENCES ops.user_account(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_store_ownership_transition_date UNIQUE (store_id, effective_on),
    CONSTRAINT ck_store_ownership_transition_change CHECK (previous_type <> new_type)
);

CREATE INDEX IF NOT EXISTS idx_store_ownership_transition_lookup
    ON ops.store_ownership_transition (store_id, effective_on DESC);

CREATE OR REPLACE FUNCTION ops.store_type_as_of(p_store_id UUID, p_date DATE)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        (SELECT t.new_type FROM ops.store_ownership_transition t
         WHERE t.store_id = p_store_id AND t.effective_on <= p_date
         ORDER BY t.effective_on DESC LIMIT 1),
        (SELECT t.previous_type FROM ops.store_ownership_transition t
         WHERE t.store_id = p_store_id ORDER BY t.effective_on ASC LIMIT 1),
        (SELECT s.store_type FROM ops.store s WHERE s.store_id = p_store_id)
    )
$$;

CREATE OR REPLACE FUNCTION ops.store_was_company_during(p_store_id UUID, p_start DATE, p_end DATE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT p_start <= p_end AND (
        ops.store_type_as_of(p_store_id, p_start) = 'company'
        OR EXISTS (
            SELECT 1 FROM ops.store_ownership_transition t
            WHERE t.store_id = p_store_id
              AND t.effective_on > p_start AND t.effective_on <= p_end
              AND t.new_type = 'company'
        )
    )
$$;
