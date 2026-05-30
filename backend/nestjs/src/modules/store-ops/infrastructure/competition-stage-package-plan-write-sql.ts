export const stagePackagePlanReturningClause = `
  RETURNING
    competition_stage_package_plan_id,
    competition_id,
    package_code,
    plan_name,
    plan_status,
    stage_drafts_json,
    created_stage_ids,
    submitted_by_user_id,
    submitted_at,
    reviewed_by_user_id,
    reviewed_at,
    review_note,
    created_at,
    updated_at,
    executed_at
`;
