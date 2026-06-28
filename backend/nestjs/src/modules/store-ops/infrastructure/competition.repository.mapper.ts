import {
  Competition,
  CompetitionStage,
  CompetitionStageFinalizationState,
  CompetitionStagePackagePlan,
  CompetitionStagePackagePlanAuditEvent,
  CompetitionStoreContribution,
  CompetitionTeam,
  CompetitionTeamTemplate,
  CompetitionTeamScore,
  CompetitionWarning,
} from "../application/competition.contract";

export type CompetitionRow = {
  competition_id: string;
  competition_code: string;
  competition_name: string;
  description: string | null;
  competition_type: "region_challenge" | "region_league" | "campaign";
  lifecycle_state: Competition["lifecycleState"];
  starts_on: string | Date;
  ends_on: string | Date;
};

export type CompetitionAccessContextRow = {
  competition_id: string;
  owner_user_id: string;
  store_id: string | null;
  company_id: string | null;
  region_id: string | null;
};

export type CompetitionStageRow = {
  competition_stage_id: string;
  competition_id: string;
  stage_code: string;
  stage_name: string;
  stage_order: number;
  stage_type: CompetitionStage["stageType"];
  starts_on: string | Date;
  ends_on: string | Date;
  lifecycle_state: CompetitionStage["lifecycleState"];
  finalization_state: CompetitionStageFinalizationState | null;
};

export type CompetitionStagePackagePlanRow = {
  competition_stage_package_plan_id: string;
  competition_id: string;
  package_code: CompetitionStagePackagePlan["packageCode"];
  plan_name: string;
  plan_status: CompetitionStagePackagePlan["planStatus"];
  stage_drafts_json: unknown;
  created_stage_ids: string[] | null;
  submitted_by_user_id?: string | null;
  submitted_at?: string | Date | null;
  reviewed_by_user_id?: string | null;
  reviewed_at?: string | Date | null;
  review_note?: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  executed_at: string | Date | null;
  source_plan_id?: string | null;
  source_plan_name?: string | null;
};

export type CompetitionStagePackagePlanAuditRow = {
  event_log_id: string;
  occurred_at: string | Date;
  actor_user_id: string | null;
  event_type: string;
  metadata_json: Record<string, unknown>;
};

export type CompetitionTeamStoreRow = {
  competition_team_id: string;
  team_code: string;
  team_name: string;
  team_order: number;
  store_id: string | null;
  store_code: string | null;
  store_name: string | null;
  company_id: string | null;
  region_id: string | null;
};

export type CompetitionTeamTemplateStoreRow = {
  competition_team_template_id: string;
  template_code: string;
  template_name: string;
  description: string | null;
  is_active: boolean;
  store_id: string | null;
  store_code: string | null;
  store_name: string | null;
  company_id: string | null;
  region_id: string | null;
};

export type StoreAccessContext = {
  storeId: string;
  companyId: string;
  regionId: string;
};

export type CompetitionTeamScoreRow = {
  stage_id: string;
  team_id: string;
  team_code: string;
  team_name: string;
  snapshot_date: string | Date;
  score_value: string | number | null;
  valid_store_count: string | number;
  total_store_count: string | number;
  coverage_rate: string | number;
  rank_position: string | number | null;
  ranking_population: string | number;
};

export type CompetitionWarningRow = {
  competition_stage_warning_id: string;
  competition_stage_id: string;
  competition_team_id: string | null;
  store_id: string | null;
  store_name: string | null;
  warning_code: CompetitionWarning["warningCode"];
  warning_level: CompetitionWarning["warningLevel"];
  period_start: string | Date;
  period_end: string | Date;
  message: string;
  resolved_at: string | Date | null;
};

export type CompetitionStoreContributionRow = {
  stage_id: string;
  team_id: string;
  team_code: string;
  team_name: string;
  store_id: string;
  store_code: string;
  store_name: string;
  region_id: string;
  snapshot_date: string | Date;
  score_value: string | number | null;
  reported_weight_percent: string | number;
  expected_weight_percent: string | number;
  has_daily_data: boolean;
  missing_kpi_codes: string[];
};

export function mapStoreAccessContexts(
  rows: Array<{
    store_id: string | null;
    company_id: string | null;
    region_id: string | null;
  }>,
): StoreAccessContext[] {
  const stores = new Map<string, StoreAccessContext>();

  for (const row of rows) {
    if (!row.store_id || !row.company_id || !row.region_id) {
      continue;
    }

    stores.set(row.store_id, {
      storeId: row.store_id,
      companyId: row.company_id,
      regionId: row.region_id,
    });
  }

  return [...stores.values()];
}

export function mapCompetition(row: CompetitionRow): Competition {
  return {
    competitionId: row.competition_id,
    competitionCode: row.competition_code,
    competitionName: row.competition_name,
    description: row.description,
    competitionType: row.competition_type,
    lifecycleState: row.lifecycle_state,
    startsOn: toDateString(row.starts_on),
    endsOn: toDateString(row.ends_on),
  };
}

export function mapStage(row: CompetitionStageRow): CompetitionStage {
  return {
    competitionStageId: row.competition_stage_id,
    competitionId: row.competition_id,
    stageCode: row.stage_code,
    stageName: row.stage_name,
    stageOrder: Number(row.stage_order),
    stageType: row.stage_type,
    startsOn: toDateString(row.starts_on),
    endsOn: toDateString(row.ends_on),
    lifecycleState: row.lifecycle_state,
    finalizationState: row.finalization_state,
  };
}

export function mapStagePackagePlan(
  row: CompetitionStagePackagePlanRow,
): CompetitionStagePackagePlan {
  return {
    planId: row.competition_stage_package_plan_id,
    competitionId: row.competition_id,
    packageCode: row.package_code,
    planName: row.plan_name,
    planStatus: row.plan_status,
    sourcePlan:
      row.source_plan_id && row.source_plan_name
        ? {
            planId: row.source_plan_id,
            planName: row.source_plan_name,
          }
        : null,
    stageDrafts: normalizeStageDrafts(row.stage_drafts_json),
    createdStageIds: row.created_stage_ids ?? [],
    submittedByUserId: row.submitted_by_user_id ?? null,
    submittedAt: row.submitted_at ? toDateTimeString(row.submitted_at) : null,
    reviewedByUserId: row.reviewed_by_user_id ?? null,
    reviewedAt: row.reviewed_at ? toDateTimeString(row.reviewed_at) : null,
    reviewNote: row.review_note ?? null,
    createdAt: toDateTimeString(row.created_at),
    updatedAt: toDateTimeString(row.updated_at),
    executedAt: row.executed_at ? toDateTimeString(row.executed_at) : null,
  };
}

export function mapStagePackagePlanAuditEvent(
  row: CompetitionStagePackagePlanAuditRow,
): CompetitionStagePackagePlanAuditEvent {
  return {
    eventLogId: row.event_log_id,
    occurredAt: toDateTimeString(row.occurred_at),
    actorUserId: row.actor_user_id,
    eventType: row.event_type,
    metadata: row.metadata_json,
  };
}

export function mapTeams(rows: CompetitionTeamStoreRow[]): CompetitionTeam[] {
  const teams = new Map<string, CompetitionTeam>();

  for (const row of rows) {
    const team =
      teams.get(row.competition_team_id) ??
      {
        competitionTeamId: row.competition_team_id,
        teamCode: row.team_code,
        teamName: row.team_name,
        teamOrder: Number(row.team_order),
        stores: [],
      };

    if (row.store_id && row.store_code && row.store_name && row.company_id && row.region_id) {
      team.stores.push({
        storeId: row.store_id,
        storeCode: row.store_code,
        storeName: row.store_name,
        companyId: row.company_id,
        regionId: row.region_id,
      });
    }

    teams.set(row.competition_team_id, team);
  }

  return [...teams.values()];
}

export function mapTeamTemplates(
  rows: CompetitionTeamTemplateStoreRow[],
): CompetitionTeamTemplate[] {
  const templates = new Map<string, CompetitionTeamTemplate>();

  for (const row of rows) {
    const template =
      templates.get(row.competition_team_template_id) ??
      {
        templateId: row.competition_team_template_id,
        templateCode: row.template_code,
        templateName: row.template_name,
        description: row.description,
        isActive: row.is_active,
        stores: [],
      };

    if (row.store_id && row.store_code && row.store_name && row.region_id) {
      template.stores.push({
        storeId: row.store_id,
        storeCode: row.store_code,
        storeName: row.store_name,
        regionId: row.region_id,
      });
    }

    templates.set(row.competition_team_template_id, template);
  }

  return [...templates.values()];
}

export function mapScore(row: CompetitionTeamScoreRow): CompetitionTeamScore {
  return {
    stageId: row.stage_id,
    teamId: row.team_id,
    teamCode: row.team_code,
    teamName: row.team_name,
    snapshotDate: toDateString(row.snapshot_date),
    scoreValue: row.score_value === null ? null : Number(row.score_value),
    validStoreCount: Number(row.valid_store_count),
    totalStoreCount: Number(row.total_store_count),
    coverageRate: Number(row.coverage_rate),
    rankPosition: row.rank_position === null ? null : Number(row.rank_position),
    rankingPopulation: Number(row.ranking_population),
  };
}

export function mapWarning(row: CompetitionWarningRow): CompetitionWarning {
  return {
    warningId: row.competition_stage_warning_id,
    stageId: row.competition_stage_id,
    teamId: row.competition_team_id,
    storeId: row.store_id,
    storeName: row.store_name,
    warningCode: row.warning_code,
    warningLevel: row.warning_level,
    periodStart: toDateString(row.period_start),
    periodEnd: toDateString(row.period_end),
    message: row.message,
    resolvedAt: row.resolved_at ? toDateTimeString(row.resolved_at) : null,
  };
}

export function mapStoreContribution(
  row: CompetitionStoreContributionRow,
): CompetitionStoreContribution {
  return {
    stageId: row.stage_id,
    teamId: row.team_id,
    teamCode: row.team_code,
    teamName: row.team_name,
    storeId: row.store_id,
    storeCode: row.store_code,
    storeName: row.store_name,
    regionId: row.region_id,
    snapshotDate: toDateString(row.snapshot_date),
    scoreValue: row.score_value === null ? null : Number(row.score_value),
    reportedWeightPercent: Number(row.reported_weight_percent),
    expectedWeightPercent: Number(row.expected_weight_percent),
    hasDailyData: row.has_daily_data,
    missingKpiCodes: row.missing_kpi_codes,
  };
}

function normalizeStageDrafts(value: unknown): CompetitionStagePackagePlan["stageDrafts"] {
  if (typeof value === "string") {
    return JSON.parse(value) as CompetitionStagePackagePlan["stageDrafts"];
  }

  return value as CompetitionStagePackagePlan["stageDrafts"];
}

export function buildStageAdvancementRule(stagePresetCode?: string) {
  if (stagePresetCode === "region_league") {
    return { type: "rank_all", presetCode: stagePresetCode };
  }

  if (stagePresetCode) {
    return { type: "top_n", count: 1, presetCode: stagePresetCode };
  }

  return { type: "top_n", count: 1 };
}

function toDateString(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function toDateTimeString(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}
