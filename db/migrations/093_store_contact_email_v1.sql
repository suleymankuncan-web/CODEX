SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

CREATE TABLE IF NOT EXISTS ops.store_contact_email (
    store_contact_email_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    email_address TEXT NOT NULL,
    normalized_email TEXT GENERATED ALWAYS AS (LOWER(BTRIM(email_address))) STORED,
    label TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ,
    UNIQUE (store_id, normalized_email),
    CHECK (normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
    CHECK (length(email_address) <= 254),
    CHECK (label IS NULL OR length(BTRIM(label)) BETWEEN 1 AND 80),
    CHECK ((is_active = TRUE AND deactivated_at IS NULL) OR (is_active = FALSE AND deactivated_at IS NOT NULL)),
    CHECK (is_active OR is_primary = FALSE)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_contact_email_primary_active
    ON ops.store_contact_email (store_id) WHERE is_active = TRUE AND is_primary = TRUE;
CREATE INDEX IF NOT EXISTS idx_store_contact_email_company_store
    ON ops.store_contact_email (company_id, store_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_external_id_map_internal_entity_active
    ON stg.external_id_map (internal_id, entity_type, integration_source_id)
    WHERE is_active = TRUE;

CREATE OR REPLACE FUNCTION ops.guard_store_contact_email_company_v1()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    target_store_id UUID;
    target_company_id UUID;
BEGIN
    target_store_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.store_id ELSE NEW.store_id END;
    target_company_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.company_id ELSE NEW.company_id END;
    PERFORM 1 FROM ops.store store
        WHERE store.store_id = target_store_id AND store.company_id = target_company_id
        FOR KEY SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Store contact email company does not match the store'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_store_contact_email_company';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('store_contact_email:' || target_store_id::text)::bigint);
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    IF TG_OP = 'UPDATE' AND (NEW.store_id IS DISTINCT FROM OLD.store_id OR NEW.company_id IS DISTINCT FROM OLD.company_id) THEN
        RAISE EXCEPTION 'Store contact email ownership is immutable'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_store_contact_email_owner_immutable';
    END IF;
    NEW.email_address := LOWER(BTRIM(NEW.email_address));
    NEW.label := NULLIF(BTRIM(NEW.label), '');
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_store_contact_email_company_guard ON ops.store_contact_email;
CREATE TRIGGER trg_store_contact_email_company_guard
BEFORE INSERT OR UPDATE OR DELETE
ON ops.store_contact_email
FOR EACH ROW EXECUTE FUNCTION ops.guard_store_contact_email_company_v1();

CREATE OR REPLACE FUNCTION ops.verify_store_contact_email_primary_v1()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    target_store_id UUID;
    active_count INTEGER;
    primary_count INTEGER;
BEGIN
    target_store_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.store_id ELSE NEW.store_id END;
    SELECT COUNT(*)::int, COUNT(*) FILTER (WHERE is_primary = TRUE)::int
    INTO active_count, primary_count
    FROM ops.store_contact_email
    WHERE store_id = target_store_id AND is_active = TRUE;
    IF active_count > 0 AND primary_count <> 1 THEN
        RAISE EXCEPTION 'Active store contact emails require exactly one primary address'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_store_contact_email_exact_primary';
    END IF;
    RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_store_contact_email_primary_guard ON ops.store_contact_email;
CREATE CONSTRAINT TRIGGER trg_store_contact_email_primary_guard
AFTER INSERT OR UPDATE OR DELETE ON ops.store_contact_email
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION ops.verify_store_contact_email_primary_v1();

COMMENT ON TABLE ops.store_contact_email IS
    'Normalized multi-address store contact directory with exactly one active primary whenever contacts exist.';
