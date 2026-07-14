SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_store_region_identity
    ON ops.store (store_id, region_id);

CREATE TABLE IF NOT EXISTS ops.region_weekly_visit_plan (
    plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    week_start_date DATE NOT NULL,
    visit_type TEXT NOT NULL DEFAULT 'BM_STORE_VISIT',
    timezone_name TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_region_weekly_visit_plan_scope UNIQUE (region_id, week_start_date, visit_type),
    CONSTRAINT uq_region_weekly_visit_plan_identity UNIQUE (plan_id, region_id, week_start_date, visit_type),
    CONSTRAINT ck_region_weekly_visit_plan_monday CHECK (EXTRACT(ISODOW FROM week_start_date) = 1),
    CONSTRAINT ck_region_weekly_visit_plan_bm_only CHECK (visit_type = 'BM_STORE_VISIT'),
    CONSTRAINT ck_region_weekly_visit_plan_timezone CHECK (timezone_name = 'Europe/Istanbul')
);

CREATE TABLE IF NOT EXISTS ops.region_weekly_visit_plan_revision (
    revision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL,
    region_id UUID NOT NULL,
    week_start_date DATE NOT NULL,
    visit_type TEXT NOT NULL DEFAULT 'BM_STORE_VISIT',
    revision_no INTEGER NOT NULL,
    created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    idempotency_key UUID NOT NULL,
    request_sha256 CHAR(64) NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_region_weekly_visit_plan_revision_number UNIQUE (plan_id, revision_no),
    CONSTRAINT uq_region_weekly_visit_plan_revision_idempotency UNIQUE (plan_id, idempotency_key),
    CONSTRAINT uq_region_weekly_visit_plan_revision_identity UNIQUE (revision_id, plan_id, region_id, week_start_date, visit_type),
    CONSTRAINT fk_region_weekly_visit_plan_revision_plan FOREIGN KEY (plan_id, region_id, week_start_date, visit_type)
        REFERENCES ops.region_weekly_visit_plan(plan_id, region_id, week_start_date, visit_type),
    CONSTRAINT ck_region_weekly_visit_plan_revision_number CHECK (revision_no > 0),
    CONSTRAINT ck_region_weekly_visit_plan_revision_bm_only CHECK (visit_type = 'BM_STORE_VISIT'),
    CONSTRAINT ck_region_weekly_visit_plan_revision_digest CHECK (request_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_region_weekly_visit_plan_revision_current
    ON ops.region_weekly_visit_plan_revision (plan_id)
    WHERE is_current;

CREATE TABLE IF NOT EXISTS ops.region_weekly_visit_plan_item (
    plan_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revision_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    region_id UUID NOT NULL,
    week_start_date DATE NOT NULL,
    store_id UUID NOT NULL,
    planned_date DATE NOT NULL,
    visit_type TEXT NOT NULL DEFAULT 'BM_STORE_VISIT',
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_region_weekly_visit_plan_item_day UNIQUE (revision_id, store_id, planned_date, visit_type),
    CONSTRAINT fk_region_weekly_visit_plan_item_revision FOREIGN KEY (revision_id, plan_id, region_id, week_start_date, visit_type)
        REFERENCES ops.region_weekly_visit_plan_revision(revision_id, plan_id, region_id, week_start_date, visit_type),
    CONSTRAINT fk_region_weekly_visit_plan_item_store_region FOREIGN KEY (store_id, region_id)
        REFERENCES ops.store(store_id, region_id),
    CONSTRAINT ck_region_weekly_visit_plan_item_weekday CHECK (planned_date BETWEEN week_start_date AND week_start_date + 5),
    CONSTRAINT ck_region_weekly_visit_plan_item_bm_only CHECK (visit_type = 'BM_STORE_VISIT'),
    CONSTRAINT ck_region_weekly_visit_plan_item_display_order CHECK (display_order >= 0)
);

CREATE OR REPLACE FUNCTION ops.guard_region_weekly_visit_plan_revision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.is_current
       AND NOT NEW.is_current
       AND (to_jsonb(NEW) - 'is_current') = (to_jsonb(OLD) - 'is_current') THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Weekly visit plan revisions are append-only; operation % is not allowed.', TG_OP
        USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION ops.guard_region_weekly_visit_plan_item_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Weekly visit plan revision items are immutable; operation % is not allowed.', TG_OP
        USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_region_weekly_visit_plan_revision_append_only ON ops.region_weekly_visit_plan_revision;
CREATE TRIGGER trg_region_weekly_visit_plan_revision_append_only
    BEFORE UPDATE OR DELETE ON ops.region_weekly_visit_plan_revision
    FOR EACH ROW EXECUTE FUNCTION ops.guard_region_weekly_visit_plan_revision_mutation();

DROP TRIGGER IF EXISTS trg_region_weekly_visit_plan_item_immutable ON ops.region_weekly_visit_plan_item;
CREATE TRIGGER trg_region_weekly_visit_plan_item_immutable
    BEFORE UPDATE OR DELETE ON ops.region_weekly_visit_plan_item
    FOR EACH ROW EXECUTE FUNCTION ops.guard_region_weekly_visit_plan_item_mutation();

CREATE INDEX IF NOT EXISTS idx_region_weekly_visit_plan_item_revision_date
    ON ops.region_weekly_visit_plan_item (revision_id, planned_date, store_id);

CREATE INDEX IF NOT EXISTS idx_region_weekly_visit_plan_item_store_date
    ON ops.region_weekly_visit_plan_item (store_id, planned_date DESC, revision_id);

CREATE INDEX IF NOT EXISTS idx_checklist_instance_completed_visit_lookup
    ON ops.checklist_instance (store_id, completed_at DESC)
    INCLUDE (checklist_template_id, checklist_instance_id)
    WHERE status = 'completed' AND completed_at IS NOT NULL;

COMMENT ON TABLE ops.region_weekly_visit_plan IS 'Region-owned Monday-to-Saturday BM visit planning aggregate; ownership survives manager rotation.';
COMMENT ON TABLE ops.region_weekly_visit_plan_revision IS 'Complete versioned weekly plan snapshots with actor, idempotency, and canonical request digest evidence.';
COMMENT ON TABLE ops.region_weekly_visit_plan_item IS 'Store and local-date entries for one weekly plan revision. Operational state is derived from real checklist execution.';
