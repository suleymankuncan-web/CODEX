\set ON_ERROR_STOP on
BEGIN;

INSERT INTO ops.company (company_id, company_code, company_name)
VALUES ('10000000-0000-4000-8000-000000000001', 'VISIT_SMOKE', 'Visit Smoke');

INSERT INTO ops.region (region_id, company_id, region_code, region_name)
VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'R1', 'Region 1'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'R2', 'Region 2');

INSERT INTO ops.store (store_id, company_id, region_id, store_code, store_name, store_type)
VALUES
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'VISIT-S1', 'Store 1', 'company'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'VISIT-S2', 'Store 2', 'company');

INSERT INTO ops.user_account (user_id, username, email)
VALUES ('40000000-0000-4000-8000-000000000001', 'visit-smoke', 'visit-smoke@example.invalid');

INSERT INTO ops.region_weekly_visit_plan (
  plan_id, region_id, week_start_date, visit_type
) VALUES (
  '50000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  DATE '2026-07-13',
  'BM_STORE_VISIT'
);

INSERT INTO ops.region_weekly_visit_plan_revision (
  revision_id, plan_id, region_id, week_start_date, visit_type, revision_no,
  created_by_user_id, idempotency_key, request_sha256, is_current
) VALUES (
  '60000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  DATE '2026-07-13',
  'BM_STORE_VISIT',
  1,
  '40000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  repeat('a', 64),
  TRUE
);

-- The same store may be planned more than once in a week on different dates.
INSERT INTO ops.region_weekly_visit_plan_item (
  revision_id, plan_id, region_id, week_start_date, store_id, planned_date, visit_type
) VALUES
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', DATE '2026-07-13', '30000000-0000-4000-8000-000000000001', DATE '2026-07-14', 'BM_STORE_VISIT'),
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', DATE '2026-07-13', '30000000-0000-4000-8000-000000000001', DATE '2026-07-17', 'BM_STORE_VISIT');

DO $$
DECLARE
  violated_constraint TEXT;
  failure_message TEXT;
BEGIN
  BEGIN
    INSERT INTO ops.region_weekly_visit_plan_item (
      revision_id, plan_id, region_id, week_start_date, store_id, planned_date, visit_type
    ) VALUES (
      '60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001', DATE '2026-07-13',
      '30000000-0000-4000-8000-000000000001', DATE '2026-07-14', 'BM_STORE_VISIT'
    );
    RAISE EXCEPTION 'same-day duplicate was accepted';
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
    IF violated_constraint <> 'uq_region_weekly_visit_plan_item_day' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO ops.region_weekly_visit_plan_item (
      revision_id, plan_id, region_id, week_start_date, store_id, planned_date, visit_type
    ) VALUES (
      '60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001', DATE '2026-07-13',
      '30000000-0000-4000-8000-000000000001', DATE '2026-07-19', 'BM_STORE_VISIT'
    );
    RAISE EXCEPTION 'Sunday plan was accepted';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
    IF violated_constraint <> 'ck_region_weekly_visit_plan_item_weekday' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO ops.region_weekly_visit_plan_item (
      revision_id, plan_id, region_id, week_start_date, store_id, planned_date, visit_type
    ) VALUES (
      '60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001', DATE '2026-07-13',
      '30000000-0000-4000-8000-000000000002', DATE '2026-07-15', 'BM_STORE_VISIT'
    );
    RAISE EXCEPTION 'cross-region store was accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
    IF violated_constraint <> 'fk_region_weekly_visit_plan_item_store_region' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO ops.region_weekly_visit_plan (
      region_id, week_start_date, visit_type
    ) VALUES (
      '20000000-0000-4000-8000-000000000001', DATE '2026-07-20', 'VM_STORE_VISIT'
    );
    RAISE EXCEPTION 'VM visit type was accepted';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
    IF violated_constraint <> 'ck_region_weekly_visit_plan_bm_only' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO ops.region_weekly_visit_plan (
      region_id, week_start_date, visit_type
    ) VALUES (
      '20000000-0000-4000-8000-000000000001', DATE '2026-07-21', 'BM_STORE_VISIT'
    );
    RAISE EXCEPTION 'non-Monday week start was accepted';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
    IF violated_constraint <> 'ck_region_weekly_visit_plan_monday' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO ops.region_weekly_visit_plan_revision (
      plan_id, region_id, week_start_date, visit_type, revision_no,
      created_by_user_id, idempotency_key, request_sha256, is_current
    ) VALUES (
      '50000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      DATE '2026-07-13',
      'BM_STORE_VISIT',
      2,
      '40000000-0000-4000-8000-000000000001',
      '70000000-0000-4000-8000-000000000002',
      repeat('b', 64),
      TRUE
    );
    RAISE EXCEPTION 'second current revision was accepted';
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
    IF violated_constraint <> 'idx_region_weekly_visit_plan_revision_current' THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE ops.region_weekly_visit_plan_revision
    SET request_sha256 = repeat('c', 64)
    WHERE revision_id = '60000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'revision content update was accepted';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    GET STACKED DIAGNOSTICS failure_message = MESSAGE_TEXT;
    IF failure_message NOT LIKE 'Weekly visit plan revisions are append-only%' THEN RAISE; END IF;
  END;

  BEGIN
    DELETE FROM ops.region_weekly_visit_plan_revision
    WHERE revision_id = '60000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'revision delete was accepted';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    GET STACKED DIAGNOSTICS failure_message = MESSAGE_TEXT;
    IF failure_message NOT LIKE 'Weekly visit plan revisions are append-only%' THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE ops.region_weekly_visit_plan_item
    SET display_order = 9
    WHERE revision_id = '60000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'plan item update was accepted';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    GET STACKED DIAGNOSTICS failure_message = MESSAGE_TEXT;
    IF failure_message NOT LIKE 'Weekly visit plan revision items are immutable%' THEN RAISE; END IF;
  END;

  BEGIN
    DELETE FROM ops.region_weekly_visit_plan_item
    WHERE revision_id = '60000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'plan item delete was accepted';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    GET STACKED DIAGNOSTICS failure_message = MESSAGE_TEXT;
    IF failure_message NOT LIKE 'Weekly visit plan revision items are immutable%' THEN RAISE; END IF;
  END;

  UPDATE ops.region_weekly_visit_plan_revision
  SET is_current = FALSE
  WHERE revision_id = '60000000-0000-4000-8000-000000000001';

  BEGIN
    UPDATE ops.region_weekly_visit_plan_revision
    SET is_current = TRUE
    WHERE revision_id = '60000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'retired revision resurrection was accepted';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    GET STACKED DIAGNOSTICS failure_message = MESSAGE_TEXT;
    IF failure_message NOT LIKE 'Weekly visit plan revisions are append-only%' THEN RAISE; END IF;
  END;

  INSERT INTO ops.region_weekly_visit_plan_revision (
    plan_id, region_id, week_start_date, visit_type, revision_no,
    created_by_user_id, idempotency_key, request_sha256, is_current
  ) VALUES (
    '50000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    DATE '2026-07-13',
    'BM_STORE_VISIT',
    2,
    '40000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000002',
    repeat('b', 64),
    TRUE
  );
END;
$$;

SELECT json_build_object(
  'event', 'region_weekly_visit_plan_schema_smoke.completed',
  'different_day_repeat', (
    SELECT count(*) = 2
    FROM ops.region_weekly_visit_plan_item
    WHERE store_id = '30000000-0000-4000-8000-000000000001'
  ),
  'negative_constraints', 'passed',
  'rolled_back', true
)::text;

ROLLBACK;
