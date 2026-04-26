CREATE TABLE IF NOT EXISTS ops.kpi_config_version (
    kpi_config_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_no INTEGER NOT NULL,
    lifecycle_state TEXT NOT NULL DEFAULT 'published',
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_by UUID REFERENCES ops.user_account(user_id),
    change_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    config_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (version_no),
    CHECK (lifecycle_state IN ('published', 'retired')),
    CHECK (effective_to IS NULL OR effective_to > effective_from)
);

WITH published_config AS (
    SELECT
        (
            SELECT config_payload
            FROM ops.kpi_score_profile_config
            WHERE config_key = 'store_profile'
            LIMIT 1
        ) AS store_profile,
        (
            SELECT config_payload
            FROM ops.kpi_score_profile_config
            WHERE config_key = 'personnel_profile'
            LIMIT 1
        ) AS personnel_profile,
        (
            SELECT config_payload
            FROM ops.kpi_score_profile_config
            WHERE config_key = 'ownership_matrix'
            LIMIT 1
        ) AS ownership_matrix,
        (
            SELECT config_payload
            FROM ops.kpi_score_profile_config
            WHERE config_key = 'grading_bands'
            LIMIT 1
        ) AS grading_bands
)
INSERT INTO ops.kpi_config_version (
    version_no,
    lifecycle_state,
    effective_from,
    published_at,
    published_by,
    change_summary,
    config_payload
)
SELECT
    1,
    'published',
    NOW(),
    NOW(),
    NULL,
    '{"seededFrom":"ops.kpi_score_profile_config"}'::jsonb,
    jsonb_build_object(
        'storeProfile', store_profile,
        'personnelProfile', personnel_profile,
        'ownershipMatrix', ownership_matrix,
        'gradingBands', grading_bands
    )
FROM published_config
WHERE store_profile IS NOT NULL
  AND personnel_profile IS NOT NULL
  AND ownership_matrix IS NOT NULL
  AND grading_bands IS NOT NULL
ON CONFLICT (version_no) DO NOTHING;

ALTER TABLE rpt.snapshot_run
ADD COLUMN IF NOT EXISTS kpi_config_version_id UUID
REFERENCES ops.kpi_config_version(kpi_config_version_id);

CREATE INDEX IF NOT EXISTS snapshot_run_kpi_config_version_idx
    ON rpt.snapshot_run (kpi_config_version_id);

COMMENT ON TABLE ops.kpi_config_version IS 'Immutable published KPI score configuration versions used to anchor reporting snapshots.';
COMMENT ON COLUMN rpt.snapshot_run.kpi_config_version_id IS 'KPI config version used to calculate this snapshot run. Null means pre-governance or no published version was available.';
