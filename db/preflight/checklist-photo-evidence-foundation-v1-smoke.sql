BEGIN;

INSERT INTO ops.company (company_id, company_code, company_name)
VALUES
    ('10000000-0000-4000-8000-000000000001', 'PHOTO_EVIDENCE_SMOKE', 'Synthetic Photo Evidence Smoke'),
    ('10000000-0000-4000-8000-000000000002', 'PHOTO_EVIDENCE_OTHER', 'Synthetic Other Tenant');

INSERT INTO ops.region (region_id, company_id, region_code, region_name)
VALUES (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'SMOKE_REGION',
    'Synthetic Region'
);

INSERT INTO ops.store (store_id, company_id, region_id, store_code, store_name, store_type)
VALUES (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'PHOTO_EVIDENCE_SMOKE_STORE',
    'Synthetic Store',
    'company'
);

INSERT INTO ops.user_account (user_id, username, email)
VALUES (
    '40000000-0000-4000-8000-000000000001',
    'photo-evidence-smoke',
    'photo-evidence-smoke@example.invalid'
);

DO $$
BEGIN
    BEGIN
        INSERT INTO ops.media_asset (
            media_asset_id,
            company_id,
            region_id,
            store_id,
            classification,
            capture_source,
            raw_object_key,
            uploaded_by_user_id
        ) VALUES (
            '50000000-0000-4000-8000-000000000001',
            '10000000-0000-4000-8000-000000000002',
            '20000000-0000-4000-8000-000000000001',
            '30000000-0000-4000-8000-000000000001',
            'checklist_evidence',
            'camera',
            'synthetic/tenant-mismatch',
            '40000000-0000-4000-8000-000000000001'
        );
        RAISE EXCEPTION 'tenant_scope_rejected was not enforced';
    EXCEPTION
        WHEN foreign_key_violation THEN NULL;
    END;
END;
$$;

DO $$
DECLARE
    invalid_key TEXT;
BEGIN
    FOREACH invalid_key IN ARRAY ARRAY[
        'https://public.example.invalid/evidence.jpg',
        '  synthetic/leading-space',
        '//public.example.invalid/evidence.jpg',
        'synthetic/../path-traversal'
    ] LOOP
        BEGIN
            INSERT INTO ops.media_asset (
                media_asset_id,
                company_id,
                region_id,
                store_id,
                classification,
                capture_source,
                raw_object_key,
                uploaded_by_user_id
            ) VALUES (
                '50000000-0000-4000-8000-000000000002',
                '10000000-0000-4000-8000-000000000001',
                '20000000-0000-4000-8000-000000000001',
                '30000000-0000-4000-8000-000000000001',
                'checklist_evidence',
                'camera',
                invalid_key,
                '40000000-0000-4000-8000-000000000001'
            );
            RAISE EXCEPTION 'private_object_key_rejected was not enforced';
        EXCEPTION
            WHEN check_violation THEN NULL;
        END;
    END LOOP;
END;
$$;

INSERT INTO ops.evidence_retention_policy (
    retention_policy_id,
    company_id,
    version_no,
    evidence_retention_days,
    reference_retention_days,
    derived_retention_days,
    effective_from,
    created_by_user_id
) VALUES (
    '70000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    1,
    365,
    365,
    90,
    NOW(),
    '40000000-0000-4000-8000-000000000001'
);

DO $$
BEGIN
    BEGIN
        UPDATE ops.evidence_retention_policy
        SET evidence_retention_days = 180
        WHERE retention_policy_id = '70000000-0000-4000-8000-000000000001';
        RAISE EXCEPTION 'retention_history_immutable was not enforced';
    EXCEPTION
        WHEN SQLSTATE '55000' THEN NULL;
    END;
END;
$$;

INSERT INTO ops.checklist_template (
    checklist_template_id,
    company_id,
    template_code,
    template_type,
    template_name,
    category,
    version_no,
    effective_from,
    created_by
) VALUES (
    '71000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'PHOTO_SMOKE_TEMPLATE',
    'BM_STORE_VISIT',
    'Synthetic Photo Smoke',
    'synthetic',
    1,
    CURRENT_DATE,
    '40000000-0000-4000-8000-000000000001'
);

INSERT INTO ops.checklist_template_item (
    template_item_id,
    checklist_template_id,
    section_name,
    item_no,
    item_text,
    response_type
) VALUES (
    '72000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001',
    'Synthetic',
    1,
    'Synthetic evidence item',
    'boolean'
);

INSERT INTO ops.checklist_instance (
    checklist_instance_id,
    checklist_template_id,
    store_id,
    status
) VALUES (
    '73000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'in_progress'
);

INSERT INTO ops.checklist_response (
    response_id,
    checklist_instance_id,
    template_item_id,
    response_value
) VALUES (
    '74000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000001',
    '72000000-0000-4000-8000-000000000001',
    'true'
);

INSERT INTO ops.media_asset (
    media_asset_id,
    company_id,
    region_id,
    store_id,
    classification,
    capture_source,
    raw_object_key,
    uploaded_by_user_id
) VALUES
    (
        '75000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '30000000-0000-4000-8000-000000000001',
        'checklist_evidence',
        'camera',
        'synthetic/unlink-before-completion',
        '40000000-0000-4000-8000-000000000001'
    ),
    (
        '75000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '30000000-0000-4000-8000-000000000001',
        'checklist_evidence',
        'camera',
        'synthetic/lock-on-completion',
        '40000000-0000-4000-8000-000000000001'
    );

INSERT INTO ops.checklist_response_media (
    checklist_response_media_id,
    company_id,
    region_id,
    store_id,
    checklist_instance_id,
    response_id,
    template_item_id,
    media_asset_id,
    display_order,
    linked_by_user_id
) VALUES
    (
        '76000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '30000000-0000-4000-8000-000000000001',
        '73000000-0000-4000-8000-000000000001',
        '74000000-0000-4000-8000-000000000001',
        '72000000-0000-4000-8000-000000000001',
        '75000000-0000-4000-8000-000000000001',
        0,
        '40000000-0000-4000-8000-000000000001'
    ),
    (
        '76000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '30000000-0000-4000-8000-000000000001',
        '73000000-0000-4000-8000-000000000001',
        '74000000-0000-4000-8000-000000000001',
        '72000000-0000-4000-8000-000000000001',
        '75000000-0000-4000-8000-000000000002',
        1,
        '40000000-0000-4000-8000-000000000001'
    );

UPDATE ops.checklist_response_media
SET
    unlinked_at = NOW(),
    unlinked_by_user_id = '40000000-0000-4000-8000-000000000001',
    unlink_reason = 'user_requested'
WHERE checklist_response_media_id = '76000000-0000-4000-8000-000000000001';

UPDATE ops.checklist_instance
SET status = 'completed', completed_at = NOW(), locked_at = NOW()
WHERE checklist_instance_id = '73000000-0000-4000-8000-000000000001';

UPDATE ops.checklist_response_media
SET locked_at = NOW()
WHERE checklist_response_media_id = '76000000-0000-4000-8000-000000000002';

DO $$
BEGIN
    BEGIN
        UPDATE ops.checklist_response_media
        SET
            unlinked_at = NOW(),
            unlinked_by_user_id = '40000000-0000-4000-8000-000000000001',
            unlink_reason = 'user_requested'
        WHERE checklist_response_media_id = '76000000-0000-4000-8000-000000000002';
        RAISE EXCEPTION 'post_completion_unlink_rejected was not enforced';
    EXCEPTION
        WHEN SQLSTATE '55000' THEN NULL;
    END;
END;
$$;

DO $$
DECLARE
    expected_constraints TEXT[] := ARRAY[
        'fk_media_asset_store_scope',
        'fk_checklist_response_media_store',
        'fk_store_action_solution_attempt_plan',
        'fk_store_action_plan_evidence_plan',
        'fk_store_action_solution_review_attempt',
        'fk_visual_campaign_assignment_store',
        'fk_visual_campaign_outcome_assignment',
        'fk_visual_campaign_submission_assignment',
        'fk_visual_campaign_submission_media_submission',
        'fk_visual_comparison_run_assignment',
        'fk_photo_evidence_event_store'
    ];
    actual_count INTEGER;
BEGIN
    SELECT count(*)
    INTO actual_count
    FROM pg_constraint
    WHERE conname = ANY(expected_constraints);

    IF actual_count <> cardinality(expected_constraints) THEN
        RAISE EXCEPTION 'tenant_constraint_catalog_complete was not enforced';
    END IF;
END;
$$;

INSERT INTO audit.photo_evidence_event (
    photo_evidence_event_id,
    actor_user_id,
    event_type,
    entity_name,
    entity_id,
    company_id,
    region_id,
    store_id,
    correlation_id,
    state_after
) VALUES (
    '60000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'checklist_photo_evidence.media.upload_initiated',
    'media_asset',
    '50000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'synthetic-smoke-correlation',
    'initiated'
);

DO $$
BEGIN
    BEGIN
        UPDATE audit.photo_evidence_event
        SET state_after = 'tampered'
        WHERE photo_evidence_event_id = '60000000-0000-4000-8000-000000000001';
        RAISE EXCEPTION 'immutable_history_rejected was not enforced';
    EXCEPTION
        WHEN SQLSTATE '55000' THEN NULL;
    END;
END;
$$;

SELECT json_build_object(
    'event', 'checklist_photo_evidence_schema_smoke.completed',
    'tenant_scope_rejected', true,
    'private_object_key_rejected', true,
    'tenant_constraint_catalog_complete', true,
    'immutable_history_rejected', true,
    'retention_history_immutable', true,
    'pre_completion_unlink_allowed', true,
    'completion_lock_enforced', true,
    'post_completion_unlink_rejected', true,
    'residual_marker', 'PHOTO_EVIDENCE_SMOKE',
    'rolled_back', true
)::text;

ROLLBACK;
