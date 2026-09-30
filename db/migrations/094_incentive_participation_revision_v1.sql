CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_participation_revision (
    participation_revision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    period_key CHAR(7) NOT NULL CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    final_snapshot_id UUID NOT NULL REFERENCES rpt.sales_target_incentive_final_snapshot(sales_target_incentive_final_snapshot_id),
    revision_no INTEGER NOT NULL CHECK (revision_no > 0),
    exclusions_json JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(exclusions_json) = 'array'),
    created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, period_key, revision_no)
);

ALTER TABLE ops.sales_target_incentive_region_package_store
    ADD COLUMN IF NOT EXISTS participation_revision_no INTEGER NOT NULL DEFAULT 0 CHECK (participation_revision_no >= 0),
    ADD COLUMN IF NOT EXISTS participation_exclusions_json JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(participation_exclusions_json) = 'array');

CREATE OR REPLACE FUNCTION ops.guard_incentive_participation_revision() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'Incentive participation revisions are immutable' USING ERRCODE = '23514';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('sales-target-incentive-store-review:' || NEW.period_key::text || ':' || NEW.store_id::text)::bigint);
    PERFORM pg_advisory_xact_lock(hashtext('incentive-store-package:' || NEW.period_key::text || ':' || NEW.store_id::text)::bigint);
    IF EXISTS (
        SELECT 1 FROM ops.sales_target_incentive_region_package_store package_store
        JOIN ops.sales_target_incentive_region_package package ON package.sales_target_incentive_region_package_id=package_store.region_package_id
        WHERE package_store.store_id=NEW.store_id AND package_store.period_key=NEW.period_key
          AND package.package_status IN ('submitted','admin_approved')
    ) THEN
        RAISE EXCEPTION 'Submitted participation is frozen' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(NEW.exclusions_json) item
        WHERE jsonb_typeof(item) <> 'object'
          OR COALESCE(item->>'employeeId', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          OR jsonb_typeof(item->'reasonNote') IS DISTINCT FROM 'string'
          OR LENGTH(BTRIM(item->>'reasonNote')) < 3 OR LENGTH(item->>'reasonNote') > 1000
          OR (item->>'reasonNote') !~ '[^[:space:]]'
    ) OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(NEW.exclusions_json) item GROUP BY item->>'employeeId' HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Exclusions require unique personnel and nonblank reasons' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM rpt.sales_target_incentive_final_snapshot snapshot
        WHERE snapshot.sales_target_incentive_final_snapshot_id = NEW.final_snapshot_id
          AND snapshot.company_id = NEW.company_id AND snapshot.store_id = NEW.store_id AND snapshot.period_key = NEW.period_key
    ) THEN
        RAISE EXCEPTION 'Participation revision must match its closed source' USING ERRCODE = '23514';
    END IF;
    UPDATE ops.sales_target_incentive_store_review SET review_status='pending_review', reviewed_by_user_id=NULL,
        reviewed_at=NULL, updated_at=NOW() WHERE store_id=NEW.store_id AND period_key=NEW.period_key;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_incentive_participation_revision ON ops.sales_target_incentive_participation_revision;
CREATE TRIGGER guard_incentive_participation_revision
    BEFORE INSERT OR UPDATE OR DELETE ON ops.sales_target_incentive_participation_revision
    FOR EACH ROW EXECUTE FUNCTION ops.guard_incentive_participation_revision();

COMMENT ON TABLE ops.sales_target_incentive_participation_revision IS
    'Append-only, reasoned exclusion decisions for a closed source. Submission freezes the revision in each package store; calculated amounts and store sales remain unchanged.';

CREATE OR REPLACE FUNCTION ops.guard_incentive_package_participation_copy() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE frozen boolean;
BEGIN
    SELECT package_status IN ('submitted','admin_approved') INTO frozen
    FROM ops.sales_target_incentive_region_package WHERE sales_target_incentive_region_package_id=OLD.region_package_id;
    IF frozen THEN
        IF TG_OP='DELETE' THEN
            RAISE EXCEPTION 'Submitted participation copies are immutable' USING ERRCODE='23514';
        END IF;
        IF ROW(OLD.region_package_id,OLD.company_id,OLD.region_id,OLD.store_id,OLD.final_snapshot_id,OLD.period_key,OLD.participation_revision_no,OLD.participation_exclusions_json)
            IS DISTINCT FROM ROW(NEW.region_package_id,NEW.company_id,NEW.region_id,NEW.store_id,NEW.final_snapshot_id,NEW.period_key,NEW.participation_revision_no,NEW.participation_exclusions_json) THEN
            RAISE EXCEPTION 'Submitted participation copies are immutable' USING ERRCODE='23514';
        END IF;
    END IF;
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS guard_incentive_package_participation_copy ON ops.sales_target_incentive_region_package_store;
CREATE TRIGGER guard_incentive_package_participation_copy BEFORE UPDATE OR DELETE ON ops.sales_target_incentive_region_package_store
    FOR EACH ROW EXECUTE FUNCTION ops.guard_incentive_package_participation_copy();

CREATE OR REPLACE FUNCTION ops.guard_incentive_frozen_package_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.package_status IN ('submitted','admin_approved') THEN
        RAISE EXCEPTION 'Submitted or approved packages are immutable' USING ERRCODE='23514';
    END IF;
    RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS guard_incentive_frozen_package_delete ON ops.sales_target_incentive_region_package;
CREATE TRIGGER guard_incentive_frozen_package_delete BEFORE DELETE ON ops.sales_target_incentive_region_package
    FOR EACH ROW EXECUTE FUNCTION ops.guard_incentive_frozen_package_delete();
