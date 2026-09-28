SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

LOCK TABLE ops.store_ownership_transition, ops.store, ops.sales_target_incentive_close_run
    IN SHARE ROW EXCLUSIVE MODE;

DO $ownership_preflight$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM ops.store_ownership_transition transition
        WHERE transition.effective_on > (NOW() AT TIME ZONE 'Europe/Istanbul')::date
    ) THEN
        RAISE EXCEPTION 'Existing ownership history contains future-dated transitions';
    END IF;

    IF EXISTS (
        WITH latest_transition AS (
            SELECT DISTINCT ON (transition.store_id)
                transition.store_id,
                transition.new_type
            FROM ops.store_ownership_transition transition
            ORDER BY transition.store_id, transition.effective_on DESC, transition.created_at DESC
        )
        SELECT 1
        FROM latest_transition latest
        JOIN ops.store store ON store.store_id = latest.store_id
        WHERE store.store_type <> latest.new_type
    ) THEN
        RAISE EXCEPTION 'Existing ownership history latest type differs from the current store type';
    END IF;

    IF EXISTS (
        WITH ordered_transition AS (
            SELECT transition.store_id,
                   transition.previous_type,
                   LAG(transition.new_type) OVER (
                       PARTITION BY transition.store_id
                       ORDER BY transition.effective_on, transition.created_at
                   ) AS prior_new_type
            FROM ops.store_ownership_transition transition
        )
        SELECT 1
        FROM ordered_transition transition
        WHERE transition.prior_new_type IS NOT NULL
          AND transition.previous_type <> transition.prior_new_type
    ) THEN
        RAISE EXCEPTION 'Existing ownership history contains a broken type chain';
    END IF;
END;
$ownership_preflight$;

CREATE OR REPLACE FUNCTION ops.store_ownership_revision_v1(target_company_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    WITH transition_summary AS (
        SELECT transition.store_id,
               COUNT(*)::bigint AS transition_count,
               MAX(transition.created_at) AS latest_transition_at
        FROM ops.store_ownership_transition transition
        JOIN ops.store store ON store.store_id = transition.store_id
        WHERE store.company_id = target_company_id
        GROUP BY transition.store_id
    )
    SELECT md5(COALESCE(string_agg(
        concat_ws(':', store.store_id::text, store.store_type, store.updated_at::text,
            COALESCE(summary.transition_count, 0)::text,
            COALESCE(summary.latest_transition_at::text, '')),
        '|' ORDER BY store.store_id
    ), ''))
    FROM ops.store store
    LEFT JOIN transition_summary summary ON summary.store_id = store.store_id
    WHERE store.company_id = target_company_id;
$$;

CREATE OR REPLACE FUNCTION ops.guard_store_ownership_transition_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    target_company_id UUID;
    current_store_type TEXT;
    latest_effective_on DATE;
    latest_new_type TEXT;
    first_incentive_date DATE;
    period_start DATE;
BEGIN
    SELECT store.company_id, store.store_type INTO target_company_id, current_store_type
    FROM ops.store store
    WHERE store.store_id = NEW.store_id;

    IF target_company_id IS NULL THEN
        RAISE EXCEPTION 'Store ownership transition references an unknown store'
            USING ERRCODE = '23503';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('sales_target_incentive_ownership:' || target_company_id::text)::bigint);

    IF NEW.effective_on > (NOW() AT TIME ZONE 'Europe/Istanbul')::date THEN
        RAISE EXCEPTION 'Store ownership transition cannot be future-dated'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_store_ownership_transition_not_future';
    END IF;
    IF NEW.previous_type <> current_store_type THEN
        RAISE EXCEPTION 'Store ownership transition must start from the current store type'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_store_ownership_transition_current_type';
    END IF;

    SELECT transition.effective_on, transition.new_type
    INTO latest_effective_on, latest_new_type
    FROM ops.store_ownership_transition transition
    WHERE transition.store_id = NEW.store_id
    ORDER BY transition.effective_on DESC
    LIMIT 1;
    IF FOUND AND (NEW.effective_on <= latest_effective_on OR latest_new_type <> NEW.previous_type) THEN
        RAISE EXCEPTION 'Store ownership transitions must form a chronological type chain'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_store_ownership_transition_chronology';
    END IF;

    SELECT COALESCE(MIN(rule.effective_from), NEW.effective_on)
    INTO first_incentive_date
    FROM ops.sales_target_incentive_rule_version rule;

    FOR period_start IN
        SELECT generated_period::date
        FROM generate_series(
            date_trunc('month', GREATEST(NEW.effective_on, first_incentive_date)),
            date_trunc('month', NOW() AT TIME ZONE 'Europe/Istanbul'),
            interval '1 month'
        ) generated_period
    LOOP
        PERFORM pg_advisory_xact_lock(hashtext(
            'sales_target_incentive_close:' || target_company_id::text || ':' || to_char(period_start, 'YYYY-MM')
        )::bigint);
    END LOOP;

    IF EXISTS (
        SELECT 1
        FROM ops.sales_target_incentive_close_run run
        WHERE run.company_id = target_company_id
          AND run.status = 'succeeded'
          AND run.period_end >= NEW.effective_on
    ) THEN
        RAISE EXCEPTION 'A closed incentive period overlaps the ownership change'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_store_ownership_transition_open_period';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_ownership_transition_close_guard ON ops.store_ownership_transition;
CREATE TRIGGER trg_store_ownership_transition_close_guard
BEFORE INSERT ON ops.store_ownership_transition
FOR EACH ROW EXECUTE FUNCTION ops.guard_store_ownership_transition_v1();

CREATE OR REPLACE FUNCTION ops.verify_store_ownership_transition_commit_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    current_store_type TEXT;
    latest_transition_type TEXT;
BEGIN
    SELECT store.store_type INTO current_store_type
    FROM ops.store store
    WHERE store.store_id = NEW.store_id;

    SELECT transition.new_type INTO latest_transition_type
    FROM ops.store_ownership_transition transition
    WHERE transition.store_id = NEW.store_id
    ORDER BY transition.effective_on DESC, transition.created_at DESC
    LIMIT 1;

    IF current_store_type IS DISTINCT FROM latest_transition_type THEN
        RAISE EXCEPTION 'Store ownership transition must update the current store type before commit'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_store_ownership_transition_committed_type';
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_ownership_transition_commit_guard ON ops.store_ownership_transition;
CREATE CONSTRAINT TRIGGER trg_store_ownership_transition_commit_guard
AFTER INSERT ON ops.store_ownership_transition
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION ops.verify_store_ownership_transition_commit_v1();

CREATE OR REPLACE FUNCTION ops.prevent_store_ownership_transition_mutation_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Store ownership transition history is immutable'
        USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_store_ownership_transition_immutable ON ops.store_ownership_transition;
CREATE TRIGGER trg_store_ownership_transition_immutable
BEFORE UPDATE OR DELETE ON ops.store_ownership_transition
FOR EACH ROW EXECUTE FUNCTION ops.prevent_store_ownership_transition_mutation_v1();

DROP TRIGGER IF EXISTS trg_store_ownership_transition_truncate_guard ON ops.store_ownership_transition;
CREATE TRIGGER trg_store_ownership_transition_truncate_guard
BEFORE TRUNCATE ON ops.store_ownership_transition
FOR EACH STATEMENT EXECUTE FUNCTION ops.prevent_store_ownership_transition_mutation_v1();

CREATE OR REPLACE FUNCTION ops.guard_store_type_direct_update_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.store_type = OLD.store_type THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('sales_target_incentive_ownership:' || OLD.company_id::text)::bigint);

    IF NOT EXISTS (
        SELECT 1
        FROM ops.store_ownership_transition transition
        WHERE transition.store_id = OLD.store_id
          AND transition.previous_type = OLD.store_type
          AND transition.new_type = NEW.store_type
          AND transition.created_at = transaction_timestamp()
    ) THEN
        RAISE EXCEPTION 'Store type changes require a dated ownership transition in the same transaction'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_store_type_requires_transition';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_type_direct_update_guard ON ops.store;
CREATE TRIGGER trg_store_type_direct_update_guard
BEFORE UPDATE OF store_type ON ops.store
FOR EACH ROW EXECUTE FUNCTION ops.guard_store_type_direct_update_v1();

CREATE OR REPLACE FUNCTION ops.guard_incentive_close_ownership_revision_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    expected_revision TEXT;
    current_revision TEXT;
BEGIN
    expected_revision := NEW.source_evidence ->> 'ownershipRevision';
    IF expected_revision IS NULL OR expected_revision = '' THEN
        RAISE EXCEPTION 'Incentive close requires ownership revision evidence'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_incentive_close_ownership_revision_required';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('sales_target_incentive_ownership:' || NEW.company_id::text)::bigint);
    current_revision := ops.store_ownership_revision_v1(NEW.company_id);
    IF current_revision IS DISTINCT FROM expected_revision THEN
        RAISE EXCEPTION 'Store ownership changed while the incentive close projection was being prepared'
            USING ERRCODE = '40001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incentive_close_ownership_revision_guard ON ops.sales_target_incentive_close_run;
CREATE TRIGGER trg_incentive_close_ownership_revision_guard
BEFORE INSERT ON ops.sales_target_incentive_close_run
FOR EACH ROW EXECUTE FUNCTION ops.guard_incentive_close_ownership_revision_v1();

COMMENT ON FUNCTION ops.store_ownership_revision_v1(UUID) IS
    'Deterministic company ownership revision used to reject stale incentive close projections.';
COMMENT ON FUNCTION ops.guard_store_ownership_transition_v1() IS
    'Serializes ownership transitions against legacy and current incentive closes and rejects closed-period overlap.';
COMMENT ON FUNCTION ops.prevent_store_ownership_transition_mutation_v1() IS
    'Keeps dated store ownership history append-only after insertion.';
COMMENT ON FUNCTION ops.verify_store_ownership_transition_commit_v1() IS
    'Rejects orphan ownership transitions unless the store current type is updated in the same transaction.';
COMMENT ON FUNCTION ops.guard_store_type_direct_update_v1() IS
    'Rejects store_type updates that are not paired with a dated ownership transition in the same transaction.';
COMMENT ON FUNCTION ops.guard_incentive_close_ownership_revision_v1() IS
    'Fails closed for stale or legacy close writers that do not provide ownership revision evidence.';
