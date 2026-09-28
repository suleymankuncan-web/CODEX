SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

LOCK TABLE ops.store, ops.employee, stg.external_id_map IN SHARE ROW EXCLUSIVE MODE;

CREATE OR REPLACE FUNCTION ops.normalize_master_external_code_v1(value TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
    SELECT UPPER(REGEXP_REPLACE(BTRIM(COALESCE(value, '')), '[[:space:]-]', '', 'g'));
$$;

CREATE INDEX IF NOT EXISTS idx_external_id_map_entity_normalized
    ON stg.external_id_map (
        entity_type,
        ops.normalize_master_external_code_v1(external_id),
        integration_source_id
    );

DO $master_code_shape_preflight$
BEGIN
    IF EXISTS (SELECT 1 FROM ops.store WHERE ops.normalize_master_external_code_v1(store_code) = '') THEN
        RAISE EXCEPTION 'Existing store data contains a code that normalizes to empty';
    END IF;
    IF EXISTS (
        SELECT 1 FROM ops.employee
        WHERE NULLIF(BTRIM(external_employee_ref), '') IS NOT NULL
          AND ops.normalize_master_external_code_v1(external_employee_ref) = ''
    ) THEN
        RAISE EXCEPTION 'Existing personnel data contains a code that normalizes to empty';
    END IF;
END;
$master_code_shape_preflight$;

DO $master_code_constraints$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_master_identity_store_code_nonempty') THEN
        ALTER TABLE ops.store
            ADD CONSTRAINT ck_master_identity_store_code_nonempty
            CHECK (ops.normalize_master_external_code_v1(store_code) <> '');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_master_identity_employee_code_nonempty') THEN
        ALTER TABLE ops.employee
            ADD CONSTRAINT ck_master_identity_employee_code_nonempty
            CHECK (
                NULLIF(BTRIM(external_employee_ref), '') IS NULL OR
                ops.normalize_master_external_code_v1(external_employee_ref) <> ''
            );
    END IF;
END;
$master_code_constraints$;

CREATE TABLE IF NOT EXISTS ops.master_identity_code_reservation (
    master_identity_code_reservation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('store', 'employee')),
    internal_id UUID NOT NULL,
    external_code TEXT NOT NULL,
    normalized_code TEXT NOT NULL,
    internal_table_name TEXT NOT NULL CHECK (internal_table_name IN ('ops.store', 'ops.employee')),
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    origin TEXT NOT NULL CHECK (origin IN ('migration_seed', 'runtime')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    retired_at TIMESTAMPTZ,
    UNIQUE (entity_type, normalized_code),
    CHECK (normalized_code = ops.normalize_master_external_code_v1(external_code)),
    CHECK (is_current OR retired_at IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_master_identity_code_current
    ON ops.master_identity_code_reservation (entity_type, internal_id)
    WHERE is_current = TRUE;

DO $master_identity_preflight$
BEGIN
    IF EXISTS (
        WITH candidate AS (
            SELECT store.company_id, 'store'::text AS entity_type, store.store_id AS internal_id,
                   ops.normalize_master_external_code_v1(store.store_code) AS normalized_code
            FROM ops.store store
            UNION ALL
            SELECT employee.company_id, 'employee', employee.employee_id,
                   ops.normalize_master_external_code_v1(employee.external_employee_ref)
            FROM ops.employee employee
            WHERE NULLIF(BTRIM(employee.external_employee_ref), '') IS NOT NULL
        )
        SELECT 1 FROM candidate
        WHERE normalized_code <> ''
        GROUP BY entity_type, normalized_code
        HAVING COUNT(DISTINCT internal_id) > 1
    ) THEN
        RAISE EXCEPTION 'Existing master data contains conflicting normalized store or personnel codes';
    END IF;
END;
$master_identity_preflight$;

INSERT INTO ops.master_identity_code_reservation (
    company_id, entity_type, internal_id, external_code, normalized_code,
    internal_table_name, is_current, origin
)
SELECT store.company_id, 'store', store.store_id, store.store_code,
       ops.normalize_master_external_code_v1(store.store_code), 'ops.store', TRUE, 'migration_seed'
FROM ops.store store
WHERE ops.normalize_master_external_code_v1(store.store_code) <> ''
UNION ALL
SELECT employee.company_id, 'employee', employee.employee_id, employee.external_employee_ref,
       ops.normalize_master_external_code_v1(employee.external_employee_ref), 'ops.employee', TRUE, 'migration_seed'
FROM ops.employee employee
WHERE ops.normalize_master_external_code_v1(employee.external_employee_ref) <> ''
ON CONFLICT (entity_type, normalized_code) DO NOTHING;

DO $master_mapping_preflight$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM stg.external_id_map map
        JOIN ops.master_identity_code_reservation reservation
          ON reservation.entity_type = map.entity_type
         AND reservation.normalized_code = ops.normalize_master_external_code_v1(map.external_id)
        WHERE map.internal_id <> reservation.internal_id
    ) THEN
        RAISE EXCEPTION 'Active external mappings conflict with reserved master identity codes';
    END IF;
END;
$master_mapping_preflight$;

CREATE OR REPLACE FUNCTION ops.guard_external_id_master_code_v1()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    candidate_normalized_code TEXT;
BEGIN
    IF NEW.entity_type NOT IN ('store', 'employee') THEN
        RETURN NEW;
    END IF;
    candidate_normalized_code := ops.normalize_master_external_code_v1(NEW.external_id);
    IF candidate_normalized_code <> '' THEN
        IF NOT pg_try_advisory_xact_lock(hashtext('master_identity_code:' || NEW.entity_type || ':' || candidate_normalized_code)::bigint) THEN
            RAISE EXCEPTION 'Master identity code mapping is being changed concurrently' USING ERRCODE = '40001';
        END IF;
        IF EXISTS (
            SELECT 1 FROM ops.master_identity_code_reservation reservation
            WHERE reservation.entity_type = NEW.entity_type
              AND reservation.normalized_code = candidate_normalized_code
              AND reservation.internal_id <> NEW.internal_id
        ) THEN
            RAISE EXCEPTION 'External mapping conflicts with a reserved master identity code'
                USING ERRCODE = '23514', CONSTRAINT = 'ck_external_id_master_code_owner';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_external_id_master_code_guard ON stg.external_id_map;
CREATE TRIGGER trg_external_id_master_code_guard
BEFORE INSERT OR UPDATE OF external_id, internal_id, entity_type, is_active ON stg.external_id_map
FOR EACH ROW EXECUTE FUNCTION ops.guard_external_id_master_code_v1();

CREATE OR REPLACE FUNCTION ops.sync_master_identity_code_v1(
    target_company_id UUID,
    target_entity_type TEXT,
    target_internal_id UUID,
    previous_code TEXT,
    next_code TEXT,
    target_table_name TEXT,
    source_entity_types TEXT[]
)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    previous_normalized TEXT := ops.normalize_master_external_code_v1(previous_code);
    next_normalized TEXT := ops.normalize_master_external_code_v1(next_code);
    lock_code TEXT;
    alias_code TEXT;
    alias_normalized TEXT;
    source RECORD;
    existing_mapping RECORD;
BEGIN
    FOR lock_code IN
        SELECT DISTINCT code FROM unnest(ARRAY[previous_normalized, next_normalized]) code
        WHERE code <> '' ORDER BY code
    LOOP
        PERFORM pg_advisory_xact_lock(hashtext('master_identity_code:' || target_entity_type || ':' || lock_code)::bigint);
    END LOOP;

    IF previous_normalized <> '' AND previous_normalized <> next_normalized THEN
        INSERT INTO ops.master_identity_code_reservation (
            company_id, entity_type, internal_id, external_code, normalized_code,
            internal_table_name, is_current, origin, retired_at
        ) VALUES (
            target_company_id, target_entity_type, target_internal_id, previous_code,
            previous_normalized, target_table_name, FALSE, 'runtime', NOW()
        )
        ON CONFLICT (entity_type, normalized_code) DO UPDATE
        SET external_code = EXCLUDED.external_code,
            is_current = FALSE,
            retired_at = COALESCE(ops.master_identity_code_reservation.retired_at, NOW())
        WHERE ops.master_identity_code_reservation.internal_id = EXCLUDED.internal_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Previous master identity code is reserved by another record'
                USING ERRCODE = '23514', CONSTRAINT = 'ck_master_identity_previous_code_owner';
        END IF;
    END IF;

    UPDATE ops.master_identity_code_reservation
    SET is_current = FALSE, retired_at = COALESCE(retired_at, NOW())
    WHERE entity_type = target_entity_type AND internal_id = target_internal_id
      AND normalized_code <> next_normalized AND is_current = TRUE;

    IF next_normalized <> '' THEN
        INSERT INTO ops.master_identity_code_reservation (
            company_id, entity_type, internal_id, external_code, normalized_code,
            internal_table_name, is_current, origin, retired_at
        ) VALUES (
            target_company_id, target_entity_type, target_internal_id, next_code,
            next_normalized, target_table_name, TRUE, 'runtime', NULL
        )
        ON CONFLICT (entity_type, normalized_code) DO UPDATE
        SET external_code = EXCLUDED.external_code, is_current = TRUE,
            retired_at = NULL, origin = 'runtime'
        WHERE ops.master_identity_code_reservation.internal_id = EXCLUDED.internal_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Master identity code is reserved by another record'
                USING ERRCODE = '23514', CONSTRAINT = 'ck_master_identity_code_owner';
        END IF;
    END IF;

    FOR alias_code, alias_normalized IN
        SELECT DISTINCT code, ops.normalize_master_external_code_v1(code)
        FROM unnest(ARRAY[previous_code, next_code]) code
        WHERE ops.normalize_master_external_code_v1(code) <> ''
    LOOP
        IF EXISTS (
            SELECT 1 FROM stg.external_id_map map
            WHERE map.entity_type = target_entity_type
              AND ops.normalize_master_external_code_v1(map.external_id) = alias_normalized
              AND map.internal_id <> target_internal_id
        ) THEN
            RAISE EXCEPTION 'Master identity code conflicts with an integration mapping'
                USING ERRCODE = '23514', CONSTRAINT = 'ck_master_identity_mapping_owner';
        END IF;

        FOR source IN
            SELECT integration_source_id FROM stg.integration_source
            WHERE is_active = TRUE AND entity_type = ANY(source_entity_types)
        LOOP
            SELECT map.internal_id INTO existing_mapping
            FROM stg.external_id_map map
            WHERE map.integration_source_id = source.integration_source_id
              AND map.entity_type = target_entity_type AND map.external_id = alias_code
            FOR UPDATE;
            IF FOUND AND existing_mapping.internal_id <> target_internal_id THEN
                RAISE EXCEPTION 'Master identity alias belongs to another mapped record'
                    USING ERRCODE = '23514', CONSTRAINT = 'ck_master_identity_exact_mapping_owner';
            END IF;

            INSERT INTO stg.external_id_map (
                integration_source_id, entity_type, external_id, internal_id,
                internal_table_name, is_active
            ) VALUES (
                source.integration_source_id, target_entity_type, alias_code,
                target_internal_id, target_table_name, TRUE
            )
            ON CONFLICT (integration_source_id, entity_type, external_id) DO UPDATE
            SET internal_id = EXCLUDED.internal_id,
                internal_table_name = EXCLUDED.internal_table_name,
                is_active = TRUE
            WHERE stg.external_id_map.internal_id = EXCLUDED.internal_id;
        END LOOP;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION ops.sync_store_master_identity_code_v1()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM ops.sync_master_identity_code_v1(
            NEW.company_id, 'store', NEW.store_id, NULL, NEW.store_code,
            'ops.store', ARRAY['assignment', 'kpi', 'store']::text[]
        );
    ELSIF OLD.store_code IS DISTINCT FROM NEW.store_code THEN
        PERFORM ops.sync_master_identity_code_v1(
            NEW.company_id, 'store', NEW.store_id, OLD.store_code, NEW.store_code,
            'ops.store', ARRAY['assignment', 'kpi', 'store']::text[]
        );
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_store_master_identity_code_sync ON ops.store;
CREATE TRIGGER trg_store_master_identity_code_sync
AFTER INSERT OR UPDATE OF store_code ON ops.store
FOR EACH ROW EXECUTE FUNCTION ops.sync_store_master_identity_code_v1();

CREATE OR REPLACE FUNCTION ops.sync_employee_master_identity_code_v1()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM ops.sync_master_identity_code_v1(
            NEW.company_id, 'employee', NEW.employee_id, NULL, NEW.external_employee_ref,
            'ops.employee', ARRAY['assignment', 'employee', 'kpi']::text[]
        );
    ELSIF OLD.external_employee_ref IS DISTINCT FROM NEW.external_employee_ref THEN
        PERFORM ops.sync_master_identity_code_v1(
            NEW.company_id, 'employee', NEW.employee_id, OLD.external_employee_ref, NEW.external_employee_ref,
            'ops.employee', ARRAY['assignment', 'employee', 'kpi']::text[]
        );
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_employee_master_identity_code_sync ON ops.employee;
CREATE TRIGGER trg_employee_master_identity_code_sync
AFTER INSERT OR UPDATE OF external_employee_ref ON ops.employee
FOR EACH ROW EXECUTE FUNCTION ops.sync_employee_master_identity_code_v1();

CREATE OR REPLACE FUNCTION ops.prevent_master_identity_company_change_v1()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
        RAISE EXCEPTION 'Master identity records cannot move between companies'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_master_identity_company_immutable';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_store_master_identity_company_guard ON ops.store;
CREATE TRIGGER trg_store_master_identity_company_guard
BEFORE UPDATE OF company_id ON ops.store
FOR EACH ROW EXECUTE FUNCTION ops.prevent_master_identity_company_change_v1();
DROP TRIGGER IF EXISTS trg_employee_master_identity_company_guard ON ops.employee;
CREATE TRIGGER trg_employee_master_identity_company_guard
BEFORE UPDATE OF company_id ON ops.employee
FOR EACH ROW EXECUTE FUNCTION ops.prevent_master_identity_company_change_v1();

COMMENT ON TABLE ops.master_identity_code_reservation IS
    'Globally unique, append-preserved store and personnel code aliases that prevent reuse and support historical ingestion replay.';
