export type CompetitionLifecycleState =
  | "draft"
  | "published"
  | "active"
  | "completed"
  | "cancelled";

export type CompetitionStageLifecycleState =
  | "draft"
  | "scheduled"
  | "active"
  | "awaiting_review"
  | "finalized"
  | "cancelled";

export type CompetitionStageFinalizationState =
  | "clean"
  | "warnings_present"
  | "overridden";

export type CompetitionStagePresetCode =
  | "region_league"
  | "first_half_qualifier"
  | "final_showdown";

export type CompetitionStagePackageCode = "league_then_final";

export type CompetitionStagePackagePlanStatus = "draft" | "executed" | "cancelled";

export type CompetitionWarningCode =
  | "missing_daily_store_data"
  | "missing_bm_checklist"
  | "missing_vm_checklist";

export type CompetitionScope = {
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
};

export type Competition = {
  competitionId: string;
  competitionCode: string;
  competitionName: string;
  description: string | null;
  competitionType: "region_challenge" | "region_league" | "campaign";
  lifecycleState: CompetitionLifecycleState;
  startsOn: string;
  endsOn: string;
};

export type CompetitionStage = {
  competitionStageId: string;
  competitionId: string;
  stageCode: string;
  stageName: string;
  stageOrder: number;
  stageType: "qualifier" | "league" | "quarter_final" | "semi_final" | "final" | "custom";
  startsOn: string;
  endsOn: string;
  lifecycleState: CompetitionStageLifecycleState;
  finalizationState: CompetitionStageFinalizationState | null;
};

export type CompetitionTeam = {
  competitionTeamId: string;
  teamCode: string;
  teamName: string;
  teamOrder: number;
  stores: Array<{
    storeId: string;
    storeCode: string;
    storeName: string;
    regionId: string;
  }>;
};

export type CompetitionTeamTemplate = {
  templateId: string;
  templateCode: string;
  templateName: string;
  description: string | null;
  isActive: boolean;
  stores: Array<{
    storeId: string;
    storeCode: string;
    storeName: string;
    regionId: string;
  }>;
};

export type CompetitionWarning = {
  warningId: string;
  stageId: string;
  teamId: string | null;
  storeId: string | null;
  warningCode: CompetitionWarningCode;
  warningLevel: "info" | "warning" | "blocker";
  periodStart: string;
  periodEnd: string;
  message: string;
  resolvedAt: string | null;
};

export type CompetitionTeamScore = {
  stageId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  snapshotDate: string;
  scoreValue: number | null;
  validStoreCount: number;
  totalStoreCount: number;
  coverageRate: number;
  rankPosition: number | null;
  rankingPopulation: number;
};

export type CompetitionStoreContribution = {
  stageId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  storeId: string;
  storeCode: string;
  storeName: string;
  regionId: string;
  snapshotDate: string;
  scoreValue: number | null;
  reportedWeightPercent: number;
  expectedWeightPercent: number;
  hasDailyData: boolean;
  missingKpiCodes: string[];
};

export type CompetitionBaseDetail = {
  competition: Competition;
  stages: CompetitionStage[];
  teams: CompetitionTeam[];
  latestScores: CompetitionTeamScore[];
  warnings: CompetitionWarning[];
};

export type CompetitionDetail = CompetitionBaseDetail & {
  storeContributions: CompetitionStoreContribution[];
};

export type CreateCompetitionInput = {
  actorUserId: string;
  competitionCode: string;
  competitionName: string;
  description?: string;
  competitionType: "region_challenge" | "region_league" | "campaign";
  startsOn: string;
  endsOn: string;
};

export type CreateCompetitionStageInput = {
  actorUserId: string;
  competitionId: string;
  stagePresetCode?: CompetitionStagePresetCode;
  stageCode: string;
  stageName: string;
  stageOrder: number;
  stageType: "qualifier" | "league" | "quarter_final" | "semi_final" | "final" | "custom";
  startsOn: string;
  endsOn: string;
  teams: Array<{
    teamCode: string;
    teamName: string;
    sourceTemplateId?: string;
    storeIds: string[];
  }>;
};

export type CreateCompetitionStagePackageStageInput = Omit<
  CreateCompetitionStageInput,
  "actorUserId" | "competitionId"
>;

export type CreateCompetitionStagePackageInput = {
  actorUserId: string;
  competitionId: string;
  packageCode: CompetitionStagePackageCode;
  stages: CreateCompetitionStagePackageStageInput[];
};

export type CompetitionStagePackagePlan = {
  planId: string;
  competitionId: string;
  packageCode: CompetitionStagePackageCode;
  planName: string;
  planStatus: CompetitionStagePackagePlanStatus;
  stageDrafts: CreateCompetitionStagePackageStageInput[];
  createdStageIds: string[];
  createdAt: string;
  updatedAt: string;
  executedAt: string | null;
};

export type CreateCompetitionStagePackagePlanInput = CreateCompetitionStagePackageInput & {
  planName: string;
};

export type ExecuteCompetitionStagePackagePlanInput = {
  actorUserId: string;
  planId: string;
};

export type CreateCompetitionTeamTemplateInput = {
  actorUserId: string;
  templateCode: string;
  templateName: string;
  description?: string;
  storeIds: string[];
};

export type UpdateCompetitionTeamTemplateInput = {
  actorUserId: string;
  templateId: string;
  templateCode: string;
  templateName: string;
  description?: string;
  storeIds: string[];
};

export type CloneCompetitionTeamTemplateInput = {
  actorUserId: string;
  sourceTemplateId: string;
  templateCode: string;
  templateName: string;
  description?: string;
};

export type DeactivateCompetitionTeamTemplateInput = {
  actorUserId: string;
  templateId: string;
};

export type RecalculateCompetitionStageInput = {
  actorUserId: string;
  stageId: string;
};

export type FinalizeCompetitionStageInput = {
  actorUserId: string;
  stageId: string;
  allowOverride: boolean;
  overrideJustification?: string;
};
