import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "../app.module";
import { applyPilotFeedbackOpenApi } from "./pilot-feedback-openapi";
import { applyStoreActionPlanOpenApi } from "./store-action-plan-openapi";
type MutableOperation = {
  parameters?: Array<Record<string, unknown>>;
  requestBody?: Record<string, unknown>;
  responses?: Record<string, Record<string, unknown>>;
  security?: Array<Record<string, string[]>>;
};

type MutablePathItem = Record<string, MutableOperation | undefined>;

const publicOperations = [
  { path: "/api/auth/bootstrap", method: "get" },
  { path: "/api/health", method: "get" },
  { path: "/api/health/live", method: "get" },
] as const;

const mobileSessionOperations = [
  { path: "/api/mobile/auth/session", method: "get" },
  { path: "/api/mobile/auth/sessions", method: "get" },
  { path: "/api/mobile/auth/logout", method: "post" },
  { path: "/api/mobile/auth/sessions/{sessionId}", method: "delete" },
] as const;
const mobileSessionHeader = {
  name: "x-mobile-session-id",
  in: "header",
  required: true,
  description: "Active mobile session id returned by POST /api/mobile/auth/sessions.",
  schema: {
    type: "string",
  },
};

const mobileChecklistTodayStoreSchema = {
  type: "object",
  required: ["storeId", "storeName"],
  properties: {
    storeId: { type: "string" },
    storeName: { type: "string" },
  },
};

const mobileChecklistTodayTemplateItemSchema = {
  type: "object",
  required: [
    "templateItemId",
    "sectionName",
    "itemNo",
    "itemText",
    "responseType",
    "weight",
    "maxScore",
  ],
  properties: {
    templateItemId: { type: "string" },
    sectionName: { type: "string" },
    itemNo: { type: "integer" },
    itemText: { type: "string" },
    responseType: { type: "string", enum: ["score", "yes_no", "partial", "text"] },
    weight: { type: "number" },
    maxScore: { type: "number" },
  },
};

const mobileChecklistTodayTemplateSchema = {
  type: "object",
  required: [
    "checklistTemplateId",
    "templateCode",
    "templateType",
    "templateName",
    "versionNo",
    "items",
  ],
  properties: {
    checklistTemplateId: { type: "string" },
    templateCode: { type: "string" },
    templateType: { type: "string" },
    templateName: { type: "string" },
    versionNo: { type: "integer" },
    items: {
      type: "array",
      items: mobileChecklistTodayTemplateItemSchema,
    },
  },
};

const mobileChecklistTodayDraftResponseSchema = {
  type: "object",
  required: ["templateItemId", "scoreValue", "commentText"],
  properties: {
    templateItemId: { type: "string" },
    scoreValue: { type: "number" },
    commentText: { type: "string", nullable: true },
  },
};

const mobileChecklistTodayActiveInstanceSchema = {
  type: "object",
  required: [
    "checklistInstanceId",
    "checklistTemplateId",
    "storeId",
    "status",
    "startedAt",
    "updatedAt",
    "responses",
  ],
  properties: {
    checklistInstanceId: { type: "string" },
    checklistTemplateId: { type: "string" },
    storeId: { type: "string" },
    status: {
      type: "string",
      enum: ["planned", "in_progress", "completed", "cancelled"],
    },
    startedAt: { type: "string", nullable: true },
    updatedAt: { type: "string", nullable: true },
    responses: {
      type: "array",
      items: mobileChecklistTodayDraftResponseSchema,
    },
  },
};

const mobileChecklistTodayCompletedItemSchema = {
  type: "object",
  required: [
    "checklistInstanceId",
    "checklistTemplateId",
    "storeId",
    "completedAt",
    "totalScore",
    "acknowledgedAt",
  ],
  properties: {
    checklistInstanceId: { type: "string" },
    checklistTemplateId: { type: "string" },
    storeId: { type: "string" },
    completedAt: { type: "string" },
    totalScore: { type: "number" },
    acknowledgedAt: { type: "string", nullable: true },
  },
};

const mobileChecklistTodayPendingAcknowledgementSchema = {
  type: "object",
  required: [
    "checklistInstanceId",
    "checklistTemplateId",
    "storeId",
    "completedAt",
    "totalScore",
  ],
  properties: {
    checklistInstanceId: { type: "string" },
    checklistTemplateId: { type: "string" },
    storeId: { type: "string" },
    completedAt: { type: "string" },
    totalScore: { type: "number" },
  },
};

const mobileChecklistTodayMonthlySummarySchema = {
  type: "object",
  required: [
    "storeId",
    "checklistTemplateId",
    "monthStart",
    "completedCount",
    "averageScore",
  ],
  properties: {
    storeId: { type: "string" },
    checklistTemplateId: { type: "string" },
    monthStart: { type: "string" },
    completedCount: { type: "integer", minimum: 0 },
    averageScore: { type: "number", nullable: true },
  },
};

const mobileChecklistTodaySchema = {
  type: "object",
  required: [
    "stores",
    "templates",
    "activeInstances",
    "completedThisMonth",
    "pendingAcknowledgements",
    "monthlySummaries",
  ],
  properties: {
    stores: {
      type: "array",
      items: mobileChecklistTodayStoreSchema,
    },
    templates: {
      type: "array",
      items: mobileChecklistTodayTemplateSchema,
    },
    activeInstances: {
      type: "array",
      items: mobileChecklistTodayActiveInstanceSchema,
    },
    completedThisMonth: {
      type: "array",
      items: mobileChecklistTodayCompletedItemSchema,
    },
    pendingAcknowledgements: {
      type: "array",
      items: mobileChecklistTodayPendingAcknowledgementSchema,
    },
    monthlySummaries: {
      type: "array",
      items: mobileChecklistTodayMonthlySummarySchema,
    },
  },
};

const mobileChecklistTodayResponseSchema = {
  type: "object",
  required: ["data"],
  properties: {
    data: mobileChecklistTodaySchema,
  },
};

const importOverviewSchema = {
  type: "object",
  required: ["totals", "healthTotals", "actionTotals", "latest"],
  properties: {
    totals: {
      type: "object",
      required: [
        "all",
        "completed",
        "failed",
        "completedWithErrors",
        "pending",
        "queued",
        "processing",
      ],
      properties: countProperties([
        "all",
        "completed",
        "failed",
        "completedWithErrors",
        "pending",
        "queued",
        "processing",
      ]),
    },
    healthTotals: {
      type: "object",
      required: [
        "healthy",
        "inProgress",
        "blocked",
        "retryReady",
        "needsAction",
        "stuck",
      ],
      properties: countProperties([
        "healthy",
        "inProgress",
        "blocked",
        "retryReady",
        "needsAction",
        "stuck",
      ]),
    },
    actionTotals: {
      type: "object",
      required: ["blocked", "retryReady", "needsAction", "stuck"],
      properties: countProperties([
        "blocked",
        "retryReady",
        "needsAction",
        "stuck",
      ]),
    },
    latest: {
      type: "object",
      required: [
        "completedBatchId",
        "failedBatchId",
        "inProgressBatchId",
        "stuckBatchId",
      ],
      properties: nullableStringProperties([
        "completedBatchId",
        "failedBatchId",
        "inProgressBatchId",
        "stuckBatchId",
      ]),
    },
  },
};

const importPayloadTemplateCanonicalContractSchema = {
  type: "object",
  required: [
    "envelopeFields",
    "canonicalKpiRowFields",
    "importedMetricCodes",
    "derivedMetricCodes",
    "checklistMetricCodes",
    "dataQualityIssueCodes",
    "rules",
  ],
  properties: {
    envelopeFields: {
      type: "array",
      items: { type: "string" },
    },
    canonicalKpiRowFields: {
      type: "array",
      items: { type: "string" },
    },
    importedMetricCodes: {
      type: "array",
      items: { type: "string" },
    },
    derivedMetricCodes: {
      type: "array",
      items: { type: "string" },
    },
    checklistMetricCodes: {
      type: "array",
      items: { type: "string" },
    },
    dataQualityIssueCodes: {
      type: "array",
      items: { type: "string" },
    },
    rules: {
      type: "array",
      items: { type: "string" },
    },
  },
};

const importPayloadTemplateSchema = {
  type: "object",
  required: ["entityType", "sourceSystem", "canonicalContract", "requestBody"],
  properties: {
    entityType: { type: "string" },
    sourceSystem: { type: "string" },
    canonicalContract: importPayloadTemplateCanonicalContractSchema,
    normalizedBehavior: {
      type: "array",
      items: { type: "string" },
    },
    note: { type: "string" },
    requestBody: {
      type: "object",
      additionalProperties: true,
    },
  },
};

const competitionSummarySchema = {
  type: "object",
  required: [
    "competitionId",
    "competitionCode",
    "competitionName",
    "description",
    "competitionType",
    "lifecycleState",
    "startsOn",
    "endsOn",
  ],
  properties: {
    competitionId: { type: "string" },
    competitionCode: { type: "string" },
    competitionName: { type: "string" },
    description: { type: "string", nullable: true },
    competitionType: {
      type: "string",
      enum: ["region_challenge", "region_league", "campaign"],
    },
    lifecycleState: {
      type: "string",
      enum: ["draft", "published", "active", "completed", "cancelled"],
    },
    startsOn: { type: "string" },
    endsOn: { type: "string" },
  },
};

const competitionStageSchema = {
  type: "object",
  required: [
    "competitionStageId",
    "competitionId",
    "stageCode",
    "stageName",
    "stageOrder",
    "stageType",
    "startsOn",
    "endsOn",
    "lifecycleState",
    "finalizationState",
  ],
  properties: {
    competitionStageId: { type: "string" },
    competitionId: { type: "string" },
    stageCode: { type: "string" },
    stageName: { type: "string" },
    stageOrder: { type: "integer" },
    stageType: {
      type: "string",
      enum: ["qualifier", "league", "quarter_final", "semi_final", "final", "custom"],
    },
    startsOn: { type: "string" },
    endsOn: { type: "string" },
    lifecycleState: {
      type: "string",
      enum: ["draft", "scheduled", "active", "awaiting_review", "finalized", "cancelled"],
    },
    finalizationState: {
      type: "string",
      nullable: true,
      enum: ["clean", "warnings_present", "overridden"],
    },
  },
};

const competitionTeamStoreSchema = {
  type: "object",
  required: ["storeId", "storeCode", "storeName", "companyId", "regionId"],
  properties: {
    storeId: { type: "string" },
    storeCode: { type: "string" },
    storeName: { type: "string" },
    companyId: { type: "string" },
    regionId: { type: "string" },
  },
};

const competitionTeamSchema = {
  type: "object",
  required: [
    "competitionTeamId",
    "teamCode",
    "teamName",
    "teamOrder",
    "stores",
  ],
  properties: {
    competitionTeamId: { type: "string" },
    teamCode: { type: "string" },
    teamName: { type: "string" },
    teamOrder: { type: "integer" },
    stores: {
      type: "array",
      items: competitionTeamStoreSchema,
    },
  },
};

const competitionTeamScoreSchema = {
  type: "object",
  required: [
    "stageId",
    "teamId",
    "teamCode",
    "teamName",
    "snapshotDate",
    "scoreValue",
    "validStoreCount",
    "totalStoreCount",
    "coverageRate",
    "rankPosition",
    "rankingPopulation",
  ],
  properties: {
    stageId: { type: "string" },
    teamId: { type: "string" },
    teamCode: { type: "string" },
    teamName: { type: "string" },
    snapshotDate: { type: "string" },
    scoreValue: { type: "number", nullable: true },
    validStoreCount: { type: "integer", minimum: 0 },
    totalStoreCount: { type: "integer", minimum: 0 },
    coverageRate: { type: "number" },
    rankPosition: { type: "integer", nullable: true },
    rankingPopulation: { type: "integer", minimum: 0 },
  },
};

const competitionWarningSchema = {
  type: "object",
  required: [
    "warningId",
    "stageId",
    "teamId",
    "storeId",
    "warningCode",
    "warningLevel",
    "periodStart",
    "periodEnd",
    "message",
    "resolvedAt",
  ],
  properties: {
    warningId: { type: "string" },
    stageId: { type: "string" },
    teamId: { type: "string", nullable: true },
    storeId: { type: "string", nullable: true },
    warningCode: {
      type: "string",
      enum: ["missing_daily_store_data", "missing_bm_checklist", "missing_vm_checklist"],
    },
    warningLevel: { type: "string", enum: ["info", "warning", "blocker"] },
    periodStart: { type: "string" },
    periodEnd: { type: "string" },
    message: { type: "string" },
    resolvedAt: { type: "string", nullable: true },
  },
};

const competitionStoreContributionSchema = {
  type: "object",
  required: [
    "stageId",
    "teamId",
    "teamCode",
    "teamName",
    "storeId",
    "storeCode",
    "storeName",
    "regionId",
    "snapshotDate",
    "scoreValue",
    "reportedWeightPercent",
    "expectedWeightPercent",
    "hasDailyData",
    "missingKpiCodes",
  ],
  properties: {
    stageId: { type: "string" },
    teamId: { type: "string" },
    teamCode: { type: "string" },
    teamName: { type: "string" },
    storeId: { type: "string" },
    storeCode: { type: "string" },
    storeName: { type: "string" },
    regionId: { type: "string" },
    snapshotDate: { type: "string" },
    scoreValue: { type: "number", nullable: true },
    reportedWeightPercent: { type: "number" },
    expectedWeightPercent: { type: "number" },
    hasDailyData: { type: "boolean" },
    missingKpiCodes: {
      type: "array",
      items: { type: "string" },
    },
  },
};

const competitionTeamTemplateStoreSchema = {
  type: "object",
  required: ["storeId", "storeCode", "storeName", "regionId"],
  properties: {
    storeId: { type: "string" },
    storeCode: { type: "string" },
    storeName: { type: "string" },
    regionId: { type: "string" },
  },
};

const competitionTeamTemplateSchema = {
  type: "object",
  required: [
    "templateId",
    "templateCode",
    "templateName",
    "description",
    "isActive",
    "stores",
  ],
  properties: {
    templateId: { type: "string" },
    templateCode: { type: "string" },
    templateName: { type: "string" },
    description: { type: "string", nullable: true },
    isActive: { type: "boolean" },
    stores: {
      type: "array",
      items: competitionTeamTemplateStoreSchema,
    },
  },
};

const competitionStagePackagePlanStageTeamDraftSchema = {
  type: "object",
  required: ["teamCode", "teamName", "storeIds"],
  properties: {
    teamCode: { type: "string" },
    teamName: { type: "string" },
    sourceTemplateId: { type: "string" },
    storeIds: {
      type: "array",
      items: { type: "string" },
    },
  },
};

const competitionStagePackagePlanStageDraftSchema = {
  type: "object",
  required: [
    "stageCode",
    "stageName",
    "stageOrder",
    "stageType",
    "startsOn",
    "endsOn",
    "teams",
  ],
  properties: {
    stagePresetCode: {
      type: "string",
      enum: ["region_league", "first_half_qualifier", "final_showdown"],
    },
    stageCode: { type: "string" },
    stageName: { type: "string" },
    stageOrder: { type: "integer" },
    stageType: {
      type: "string",
      enum: ["qualifier", "league", "quarter_final", "semi_final", "final", "custom"],
    },
    startsOn: { type: "string" },
    endsOn: { type: "string" },
    teams: {
      type: "array",
      items: competitionStagePackagePlanStageTeamDraftSchema,
    },
  },
};

const competitionStagePackagePlanSourceSchema = {
  type: "object",
  nullable: true,
  required: ["planId", "planName"],
  properties: {
    planId: { type: "string" },
    planName: { type: "string" },
  },
};

const competitionStagePackagePlanSchema = {
  type: "object",
  required: [
    "planId",
    "competitionId",
    "packageCode",
    "planName",
    "planStatus",
    "sourcePlan",
    "stageDrafts",
    "createdStageIds",
    "submittedByUserId",
    "submittedAt",
    "reviewedByUserId",
    "reviewedAt",
    "reviewNote",
    "createdAt",
    "updatedAt",
    "executedAt",
  ],
  properties: {
    planId: { type: "string" },
    competitionId: { type: "string" },
    packageCode: { type: "string", enum: ["league_then_final"] },
    planName: { type: "string" },
    planStatus: {
      type: "string",
      enum: ["draft", "submitted", "approved", "rejected", "executed", "cancelled"],
    },
    sourcePlan: competitionStagePackagePlanSourceSchema,
    stageDrafts: {
      type: "array",
      items: competitionStagePackagePlanStageDraftSchema,
    },
    createdStageIds: {
      type: "array",
      items: { type: "string" },
    },
    submittedByUserId: { type: "string", nullable: true },
    submittedAt: { type: "string", nullable: true },
    reviewedByUserId: { type: "string", nullable: true },
    reviewedAt: { type: "string", nullable: true },
    reviewNote: { type: "string", nullable: true },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    executedAt: { type: "string", nullable: true },
  },
};

const competitionStagePackagePlanAuditEventSchema = {
  type: "object",
  required: [
    "eventLogId",
    "occurredAt",
    "actorUserId",
    "eventType",
    "metadata",
  ],
  properties: {
    eventLogId: { type: "string" },
    occurredAt: { type: "string" },
    actorUserId: { type: "string", nullable: true },
    eventType: { type: "string" },
    metadata: {
      type: "object",
      additionalProperties: true,
    },
  },
};

const importBatchNeedsActionItemSchema = {
  type: "object",
  required: [
    "batchId",
    "integrationSourceId",
    "sourceCode",
    "sourceName",
    "entityType",
    "startedAt",
    "finishedAt",
    "status",
    "fileReference",
    "recordCount",
    "errorCount",
    "retryCount",
    "lastRetriedAt",
    "healthState",
    "actionReason",
    "recommendedAction",
    "blockedByEntityTypes",
    "recommendedNextEntityType",
    "canRetryNow",
    "isStuck",
  ],
  properties: {
    batchId: { type: "string" },
    integrationSourceId: { type: "string" },
    sourceCode: { type: "string" },
    sourceName: { type: "string" },
    entityType: { type: "string" },
    startedAt: { type: "string" },
    finishedAt: { type: "string", nullable: true },
    status: { type: "string" },
    fileReference: { type: "string", nullable: true },
    recordCount: { type: "integer", minimum: 0 },
    errorCount: { type: "integer", minimum: 0 },
    retryCount: { type: "integer", minimum: 0 },
    lastRetriedAt: { type: "string", nullable: true },
    healthState: { type: "string" },
    actionReason: { type: "string" },
    recommendedAction: { type: "string" },
    blockedByEntityTypes: {
      type: "array",
      items: { type: "string" },
    },
    recommendedNextEntityType: { type: "string", nullable: true },
    canRetryNow: { type: "boolean" },
    isStuck: { type: "boolean" },
  },
};

const externalIdMapCandidateSchema = {
  type: "object",
  required: [
    "entityType",
    "internalId",
    "label",
    "secondaryLabel",
    "internalTableName",
  ],
  properties: {
    entityType: { type: "string", enum: ["employee", "store"] },
    internalId: { type: "string" },
    label: { type: "string" },
    secondaryLabel: { type: "string" },
    internalTableName: { type: "string" },
  },
};

const importBatchErrorMappingCandidateSchema = {
  type: "object",
  required: ["integrationSourceId", "entityType", "externalId", "internalTableName"],
  properties: {
    integrationSourceId: { type: "string" },
    entityType: { type: "string", enum: ["employee", "store"] },
    externalId: { type: "string" },
    internalTableName: { type: "string" },
  },
};

const importBatchErrorItemSchema = {
  type: "object",
  required: [
    "rowId",
    "sourceRef",
    "normalizedStatus",
    "errorCategory",
    "validationError",
    "processedAt",
  ],
  properties: {
    rowId: { type: "string" },
    sourceRef: { type: "string" },
    rowHash: { type: "string", nullable: true },
    rawRowReference: { type: "string", nullable: true },
    normalizedStatus: { type: "string" },
    errorCategory: {
      type: "string",
      enum: ["validation", "missing_dependency", "write_failure"],
    },
    qualityIssueCode: { type: "string" },
    mappingCandidate: importBatchErrorMappingCandidateSchema,
    validationError: { type: "string", nullable: true },
    processedAt: { type: "string", nullable: true },
  },
};

const importBatchDetailBatchSchema = {
  type: "object",
  required: [
    "batchId",
    "integrationSourceId",
    "sourceCode",
    "sourceName",
    "entityType",
    "sourceBatchId",
    "sourcePayloadHash",
    "sourceCapturedAt",
    "sourceWindowStartedAt",
    "sourceWindowEndedAt",
    "startedAt",
    "finishedAt",
    "status",
    "fileReference",
    "recordCount",
    "errorCount",
    "retryCount",
    "lastRetriedAt",
    "healthState",
  ],
  properties: {
    batchId: { type: "string" },
    integrationSourceId: { type: "string" },
    sourceCode: { type: "string" },
    sourceName: { type: "string" },
    entityType: { type: "string" },
    sourceBatchId: { type: "string", nullable: true },
    sourcePayloadHash: { type: "string", nullable: true },
    sourceCapturedAt: { type: "string", nullable: true },
    sourceWindowStartedAt: { type: "string", nullable: true },
    sourceWindowEndedAt: { type: "string", nullable: true },
    startedAt: { type: "string" },
    finishedAt: { type: "string", nullable: true },
    status: { type: "string" },
    fileReference: { type: "string", nullable: true },
    recordCount: { type: "integer", minimum: 0 },
    errorCount: { type: "integer", minimum: 0 },
    retryCount: { type: "integer", minimum: 0 },
    lastRetriedAt: { type: "string", nullable: true },
    healthState: { type: "string" },
  },
};

const importBatchRowStatusSummarySchema = {
  type: "object",
  required: ["processed", "validationFailed", "retryableError", "pending"],
  properties: {
    processed: { type: "integer", minimum: 0 },
    validationFailed: { type: "integer", minimum: 0 },
    retryableError: { type: "integer", minimum: 0 },
    pending: { type: "integer", minimum: 0 },
  },
};

const importBatchDependencySummarySchema = {
  type: "object",
  required: ["employee", "store", "position", "region", "company", "manager"],
  properties: countProperties([
    "employee",
    "store",
    "position",
    "region",
    "company",
    "manager",
  ]),
};

const importBatchQualityIssueItemSchema = {
  type: "object",
  required: ["code", "label", "owner", "severity", "description", "count"],
  properties: {
    code: { type: "string" },
    label: { type: "string" },
    owner: { type: "string" },
    severity: { type: "string" },
    description: { type: "string" },
    count: { type: "integer", minimum: 0 },
  },
};

const importBatchQualityIssueSummarySchema = {
  type: "object",
  required: ["totalIssueRows", "highSeverityRows", "items"],
  properties: {
    totalIssueRows: { type: "integer", minimum: 0 },
    highSeverityRows: { type: "integer", minimum: 0 },
    items: {
      type: "array",
      items: importBatchQualityIssueItemSchema,
    },
  },
};

const importBatchLineageSummarySchema = {
  type: "object",
  required: [
    "supported",
    "rowHashCount",
    "rawRowReferenceCount",
    "sampleRowHash",
    "sampleRawRowReference",
  ],
  properties: {
    supported: { type: "boolean" },
    rowHashCount: { type: "integer", minimum: 0 },
    rawRowReferenceCount: { type: "integer", minimum: 0 },
    sampleRowHash: { type: "string", nullable: true },
    sampleRawRowReference: { type: "string", nullable: true },
  },
};

const auditEventSchema = {
  type: "object",
  required: [
    "eventLogId",
    "occurredAt",
    "actorUserId",
    "correlationId",
    "eventType",
    "metadata",
  ],
  properties: {
    eventLogId: { type: "string" },
    occurredAt: { type: "string" },
    actorUserId: { type: "string", nullable: true },
    correlationId: { type: "string", nullable: true },
    eventType: { type: "string" },
    metadata: {
      type: "object",
      additionalProperties: true,
    },
  },
};

const authAuditSourceContextSchema = {
  type: "object",
  properties: {
    module: { type: "string" },
    operation: { type: "string" },
  },
};

const authAuditMetadataSchema = {
  type: "object",
  required: ["reason", "correlationId"],
  properties: {
    reason: { type: "string", nullable: true },
    correlationId: { type: "string", nullable: true },
    sourceContext: {
      ...authAuditSourceContextSchema,
      nullable: true,
    },
    changedFields: {
      type: "array",
      items: { type: "string" },
    },
    details: {
      type: "object",
      additionalProperties: true,
    },
  },
  additionalProperties: true,
};

const authAuditEventSchema = {
  type: "object",
  required: [
    "eventLogId",
    "occurredAt",
    "actorUserId",
    "correlationId",
    "eventType",
    "metadata",
  ],
  properties: {
    eventLogId: { type: "string" },
    occurredAt: { type: "string" },
    actorUserId: { type: "string", nullable: true },
    correlationId: { type: "string", nullable: true },
    eventType: { type: "string" },
    metadata: authAuditMetadataSchema,
  },
};

const authBootstrapResponseSchema = {
  type: "object",
  required: ["authMode", "provider"],
  properties: {
    authMode: { type: "string" },
    provider: {
      type: "object",
      required: [
        "configured",
        "authorizationUrl",
        "clientId",
        "scope",
        "responseType",
        "audience",
        "callbackPath",
        "tokenUrl",
        "logoutUrl",
        "postLogoutRedirectPath",
      ],
      properties: {
        configured: { type: "boolean" },
        authorizationUrl: { type: "string", nullable: true },
        clientId: { type: "string", nullable: true },
        scope: { type: "string", nullable: true },
        responseType: { type: "string", nullable: true },
        audience: { type: "string", nullable: true },
        callbackPath: { type: "string" },
        tokenUrl: { type: "string", nullable: true },
        logoutUrl: { type: "string", nullable: true },
        postLogoutRedirectPath: { type: "string" },
      },
    },
  },
};

const authScopeIdListSchema = {
  type: "object",
  required: ["companyIds", "regionIds", "storeIds"],
  properties: {
    companyIds: {
      type: "array",
      items: { type: "string" },
    },
    regionIds: {
      type: "array",
      items: { type: "string" },
    },
    storeIds: {
      type: "array",
      items: { type: "string" },
    },
  },
};

const authActionScopeSchema = {
  type: "object",
  required: ["assignedStoreIds"],
  properties: {
    assignedStoreIds: {
      type: "array",
      items: { type: "string" },
    },
  },
};

const authSessionResponseSchema = {
  type: "object",
  required: ["authMode", "authenticated", "user", "scopeSummary"],
  properties: {
    authMode: { type: "string" },
    authenticated: { type: "boolean" },
    user: {
      type: "object",
      required: [
        "userId",
        "employeeId",
        "roleCodes",
        "scope",
        "readScope",
        "actionScope",
        "assignedStoreIds",
      ],
      properties: {
        userId: { type: "string" },
        employeeId: { type: "string", nullable: true },
        roleCodes: {
          type: "array",
          items: { type: "string" },
        },
        scope: authScopeIdListSchema,
        readScope: authScopeIdListSchema,
        actionScope: authActionScopeSchema,
        assignedStoreIds: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    scopeSummary: {
      type: "object",
      required: [
        "companyCount",
        "regionCount",
        "storeCount",
        "assignedStoreCount",
      ],
      properties: countProperties([
        "companyCount",
        "regionCount",
        "storeCount",
        "assignedStoreCount",
      ]),
    },
  },
};

const authLookupOptionSchema = {
  type: "object",
  required: ["value", "label"],
  properties: {
    value: { type: "string" },
    label: { type: "string" },
  },
};

const authLookupUserSchema = {
  type: "object",
  required: ["userId", "username", "email"],
  properties: {
    userId: { type: "string" },
    username: { type: "string" },
    email: { type: "string" },
  },
};

const authLookupUserSearchResultSchema = {
  type: "object",
  required: [
    "userId",
    "username",
    "email",
    "authProvider",
    "providerSubject",
  ],
  properties: {
    ...authLookupUserSchema.properties,
    authProvider: { type: "string" },
    providerSubject: { type: "string", nullable: true },
  },
};

const authLookupRoleSchema = {
  type: "object",
  required: ["roleId", "roleCode", "roleName", "scopeType"],
  properties: {
    roleId: { type: "string" },
    roleCode: { type: "string" },
    roleName: { type: "string" },
    scopeType: { type: "string" },
  },
};

const authLookupPermissionSchema = {
  type: "object",
  required: ["permissionId", "permissionCode", "resourceName", "actionName"],
  properties: {
    permissionId: { type: "string" },
    permissionCode: { type: "string" },
    resourceName: { type: "string" },
    actionName: { type: "string" },
  },
};

const authRolePermissionSummarySchema = {
  type: "object",
  required: ["permissionCode", "resourceName", "actionName"],
  properties: {
    permissionCode: { type: "string" },
    resourceName: { type: "string" },
    actionName: { type: "string" },
  },
};

const authRoleCatalogItemSchema = {
  type: "object",
  required: [
    "roleId",
    "roleCode",
    "roleName",
    "scopeType",
    "description",
    "isSystemRole",
    "permissions",
  ],
  properties: {
    roleId: { type: "string" },
    roleCode: { type: "string" },
    roleName: { type: "string" },
    scopeType: { type: "string" },
    description: { type: "string", nullable: true },
    isSystemRole: { type: "boolean" },
    permissions: {
      type: "array",
      items: authRolePermissionSummarySchema,
    },
  },
};

const authPermissionCatalogItemSchema = {
  type: "object",
  required: [
    "permissionId",
    "permissionCode",
    "resourceName",
    "actionName",
    "description",
  ],
  properties: {
    permissionId: { type: "string" },
    permissionCode: { type: "string" },
    resourceName: { type: "string" },
    actionName: { type: "string" },
    description: { type: "string", nullable: true },
  },
};

const authRolePermissionCommandResponseSchema = commandResponseSchema({
  type: "object",
  required: ["rolePermission"],
  properties: {
    rolePermission: {
      type: "object",
      required: ["roleId", "roleCode", "permissionId", "permissionCode"],
      properties: {
        roleId: { type: "string" },
        roleCode: { type: "string" },
        permissionId: { type: "string" },
        permissionCode: { type: "string" },
        grantedAt: { type: "string", nullable: true },
      },
    },
  },
});

const authUserAccountSchema = {
  type: "object",
  required: [
    "userId",
    "employeeId",
    "username",
    "email",
    "authProvider",
    "providerSubject",
    "isActive",
    "lastLoginAt",
    "createdAt",
  ],
  properties: {
    userId: { type: "string" },
    employeeId: { type: "string", nullable: true },
    username: { type: "string" },
    email: { type: "string" },
    authProvider: { type: "string" },
    providerSubject: { type: "string", nullable: true },
    isActive: { type: "boolean" },
    lastLoginAt: { type: "string", nullable: true },
    createdAt: { type: "string" },
    deactivatedAt: { type: "string", nullable: true },
    deactivationReason: { type: "string", nullable: true },
    deactivatedByUserId: { type: "string", nullable: true },
    employeeStatus: { type: "string", nullable: true },
  },
};

const authUserAccessClosureSchema = {
  type: "object",
  required: [
    "closedRoleAssignments",
    "closedActionStoreAssignments",
    "revokedMobileSessions",
  ],
  properties: countProperties([
    "closedRoleAssignments",
    "closedActionStoreAssignments",
    "revokedMobileSessions",
  ]),
};

const authUserAccountCommandResponseSchema = commandResponseSchema({
  type: "object",
  required: ["user"],
  properties: {
    user: authUserAccountSchema,
  },
});

const authUserDeactivationCommandResponseSchema = commandResponseSchema({
  type: "object",
  required: ["user", "accessClosure"],
  properties: {
    user: authUserAccountSchema,
    accessClosure: authUserAccessClosureSchema,
  },
});

const authRoleAssignmentSchema = {
  type: "object",
  required: [
    "assignmentId",
    "userId",
    "username",
    "email",
    "roleCode",
    "roleName",
    "scopeType",
    "companyId",
    "regionId",
    "storeId",
    "effectiveFrom",
    "effectiveTo",
    "createdAt",
    "active",
  ],
  properties: {
    assignmentId: { type: "string" },
    userId: { type: "string" },
    username: { type: "string" },
    email: { type: "string" },
    roleCode: { type: "string" },
    roleName: { type: "string" },
    scopeType: { type: "string" },
    companyId: { type: "string", nullable: true },
    regionId: { type: "string", nullable: true },
    storeId: { type: "string", nullable: true },
    effectiveFrom: { type: "string", nullable: true },
    effectiveTo: { type: "string", nullable: true },
    createdAt: { type: "string" },
    active: { type: "boolean" },
  },
};

const authRoleAssignmentCommandResponseSchema = commandResponseSchema({
  type: "object",
  required: ["assignment"],
  properties: {
    assignment: authRoleAssignmentSchema,
  },
});

const authActionStoreAssignmentSchema = {
  type: "object",
  required: [
    "assignmentId",
    "userId",
    "username",
    "email",
    "storeId",
    "storeCode",
    "storeName",
    "companyId",
    "regionId",
    "regionName",
    "effectiveFrom",
    "effectiveTo",
    "createdAt",
    "active",
  ],
  properties: {
    assignmentId: { type: "string" },
    userId: { type: "string" },
    username: { type: "string" },
    email: { type: "string" },
    storeId: { type: "string" },
    storeCode: { type: "string" },
    storeName: { type: "string" },
    companyId: { type: "string" },
    regionId: { type: "string" },
    regionName: { type: "string" },
    effectiveFrom: { type: "string", nullable: true },
    effectiveTo: { type: "string", nullable: true },
    createdAt: { type: "string" },
    active: { type: "boolean" },
  },
};

const authActionStoreAssignmentCommandResponseSchema = commandResponseSchema({
  type: "object",
  required: ["assignment"],
  properties: {
    assignment: authActionStoreAssignmentSchema,
  },
});

const authPilotUserBindingEmployeeSchema = {
  type: "object",
  required: [
    "employeeId",
    "employeeCode",
    "firstName",
    "lastName",
    "storeId",
    "storeCode",
    "storeName",
  ],
  properties: {
    employeeId: { type: "string" },
    employeeCode: { type: "string", nullable: true },
    firstName: { type: "string" },
    lastName: { type: "string" },
    storeId: { type: "string" },
    storeCode: { type: "string" },
    storeName: { type: "string" },
  },
};

const authPilotUserBindingSchema = {
  type: "object",
  required: ["user", "roleAssignments", "actionStoreAssignments", "employee"],
  properties: {
    user: authUserAccountSchema,
    roleAssignments: {
      type: "array",
      items: authRoleAssignmentSchema,
    },
    actionStoreAssignments: {
      type: "array",
      items: authActionStoreAssignmentSchema,
    },
    employee: authPilotUserBindingEmployeeSchema,
  },
};

const authPilotUserBindingCommandResponseSchema = commandResponseSchema({
  type: "object",
  required: ["binding"],
  properties: {
    binding: authPilotUserBindingSchema,
  },
});

const authLookupStoreSchema = {
  type: "object",
  required: [
    "storeId",
    "storeCode",
    "storeName",
    "companyId",
    "regionId",
    "regionName",
  ],
  properties: {
    storeId: { type: "string" },
    storeCode: { type: "string" },
    storeName: { type: "string" },
    companyId: { type: "string" },
    regionId: { type: "string" },
    regionName: { type: "string" },
  },
};

const authLookupSearchMetaSchema = {
  type: "object",
  required: ["query", "count", "limit"],
  properties: {
    query: { type: "string" },
    count: { type: "integer", minimum: 0 },
    limit: { type: "integer", minimum: 1 },
  },
};

const authLookupsResponseSchema = {
  type: "object",
  required: [
    "scopeTypes",
    "authProviders",
    "users",
    "roles",
    "permissions",
    "stores",
    "optionGroups",
    "meta",
  ],
  properties: {
    scopeTypes: {
      type: "array",
      items: { type: "string" },
    },
    authProviders: {
      type: "array",
      items: { type: "string" },
    },
    users: {
      type: "array",
      items: authLookupUserSchema,
    },
    roles: {
      type: "array",
      items: authLookupRoleSchema,
    },
    permissions: {
      type: "array",
      items: authLookupPermissionSchema,
    },
    stores: {
      type: "array",
      items: authLookupStoreSchema,
    },
    optionGroups: {
      type: "object",
      required: [
        "users",
        "roles",
        "permissions",
        "stores",
        "scopeTypes",
        "authProviders",
      ],
      properties: {
        users: {
          type: "array",
          items: authLookupUserSchema,
        },
        roles: {
          type: "array",
          items: authLookupRoleSchema,
        },
        permissions: {
          type: "array",
          items: authLookupPermissionSchema,
        },
        stores: {
          type: "array",
          items: authLookupStoreSchema,
        },
        scopeTypes: {
          type: "array",
          items: authLookupOptionSchema,
        },
        authProviders: {
          type: "array",
          items: authLookupOptionSchema,
        },
      },
    },
    meta: {
      type: "object",
      required: ["totalUsers", "totalRoles", "totalPermissions", "totalStores"],
      properties: countProperties([
        "totalUsers",
        "totalRoles",
        "totalPermissions",
        "totalStores",
      ]),
    },
  },
};

const authUserLookupSearchResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: authLookupUserSearchResultSchema,
    },
    meta: authLookupSearchMetaSchema,
  },
};

const authStoreLookupSearchResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: authLookupStoreSchema,
    },
    meta: authLookupSearchMetaSchema,
  },
};

const integrationLookupSourceSchema = {
  type: "object",
  required: [
    "sourceId",
    "sourceCode",
    "sourceName",
    "entityType",
    "sourceSystem",
    "stateModel",
  ],
  properties: {
    sourceId: { type: "string" },
    sourceCode: { type: "string" },
    sourceName: { type: "string" },
    entityType: { type: "string" },
    sourceSystem: { type: "string" },
    stateModel: { type: "string" },
  },
};

const integrationLookupSourceSummarySchema = {
  type: "object",
  required: ["sourceId", "sourceCode", "sourceName"],
  properties: {
    sourceId: { type: "string" },
    sourceCode: { type: "string" },
    sourceName: { type: "string" },
  },
};

const integrationLookupOptionSchema = {
  type: "object",
  required: ["value", "label"],
  properties: {
    value: { type: "string" },
    label: { type: "string" },
  },
};

const integrationLookupSourceOptionSchema = {
  type: "object",
  required: [
    "value",
    "label",
    "entityType",
    "sourceCode",
    "sourceSystem",
    "stateModel",
  ],
  properties: {
    value: { type: "string" },
    label: { type: "string" },
    entityType: { type: "string" },
    sourceCode: { type: "string" },
    sourceSystem: { type: "string" },
    stateModel: { type: "string" },
  },
};

const integrationLookupsSchema = {
  type: "object",
  required: [
    "entityTypes",
    "sourceStats",
    "activeSources",
    "sourcesByEntityType",
    "optionGroups",
    "meta",
  ],
  properties: {
    entityTypes: {
      type: "array",
      items: { type: "string" },
    },
    sourceStats: {
      type: "object",
      required: ["totalActiveSources"],
      properties: {
        totalActiveSources: { type: "integer", minimum: 0 },
      },
    },
    activeSources: {
      type: "array",
      items: integrationLookupSourceSchema,
    },
    sourcesByEntityType: {
      type: "object",
      additionalProperties: {
        type: "array",
        items: integrationLookupSourceSummarySchema,
      },
    },
    optionGroups: {
      type: "object",
      required: ["entityTypes", "sources", "sourceSystems", "stateModels"],
      properties: {
        entityTypes: {
          type: "array",
          items: integrationLookupOptionSchema,
        },
        sources: {
          type: "array",
          items: integrationLookupSourceOptionSchema,
        },
        sourceSystems: {
          type: "array",
          items: integrationLookupOptionSchema,
        },
        stateModels: {
          type: "array",
          items: integrationLookupOptionSchema,
        },
      },
    },
    meta: {
      type: "object",
      required: ["totalEntityTypes", "totalActiveSources"],
      properties: {
        totalEntityTypes: { type: "integer", minimum: 0 },
        totalActiveSources: { type: "integer", minimum: 0 },
      },
    },
  },
};

const storeMasterLookupsSchema = {
  type: "object",
  required: ["storeTypes", "statuses", "regions"],
  properties: {
    storeTypes: {
      type: "array",
      items: {
        type: "object",
        required: ["value", "label"],
        properties: {
          value: { type: "string", enum: ["company", "franchise", "operator"] },
          label: { type: "string" },
        },
      },
    },
    statuses: {
      type: "array",
      items: {
        type: "object",
        required: ["value", "label"],
        properties: {
          value: { type: "string", enum: ["active", "inactive", "closed"] },
          label: { type: "string" },
        },
      },
    },
    regions: {
      type: "array",
      items: {
        type: "object",
        required: ["regionId", "regionCode", "regionName"],
        properties: {
          regionId: { type: "string" },
          regionCode: { type: "string" },
          regionName: { type: "string" },
        },
      },
    },
  },
};

const storeMasterItemSchema = {
  type: "object",
  required: [
    "storeId",
    "storeCode",
    "storeName",
    "storeType",
    "status",
    "kpiImportEnabled",
    "regionId",
    "regionName",
  ],
  properties: {
    storeId: { type: "string" },
    storeCode: { type: "string" },
    storeName: { type: "string" },
    storeType: { type: "string" },
    status: { type: "string" },
    kpiImportEnabled: { type: "boolean" },
    regionId: { type: "string", nullable: true },
    regionName: { type: "string", nullable: true },
  },
};

const personnelMasterLookupsSchema = {
  type: "object",
  required: ["stores", "positions", "employmentStatuses", "employmentTypes"],
  properties: {
    stores: {
      type: "array",
      items: {
        type: "object",
        required: ["storeId", "storeCode", "storeName", "regionId", "regionName"],
        properties: {
          storeId: { type: "string" },
          storeCode: { type: "string" },
          storeName: { type: "string" },
          regionId: { type: "string" },
          regionName: { type: "string" },
        },
      },
    },
    positions: {
      type: "array",
      items: {
        type: "object",
        required: ["positionId", "positionCode", "positionName", "isManagerial"],
        properties: {
          positionId: { type: "string" },
          positionCode: { type: "string" },
          positionName: { type: "string" },
          isManagerial: { type: "boolean" },
        },
      },
    },
    employmentStatuses: {
      type: "array",
      items: {
        type: "object",
        required: ["value", "label"],
        properties: {
          value: { type: "string", enum: ["active", "inactive", "terminated"] },
          label: { type: "string" },
        },
      },
    },
    employmentTypes: {
      type: "array",
      items: {
        type: "object",
        required: ["value", "label"],
        properties: {
          value: { type: "string", enum: ["full_time", "part_time", "temporary"] },
          label: { type: "string" },
        },
      },
    },
  },
};

const personnelMasterItemSchema = {
  type: "object",
  required: [
    "employeeId",
    "externalEmployeeRef",
    "firstName",
    "lastName",
    "displayName",
    "hireDate",
    "terminationDate",
    "employmentStatus",
    "employmentType",
    "assignmentId",
    "assignmentStartDate",
    "storeId",
    "storeCode",
    "storeName",
    "regionId",
    "regionName",
    "positionId",
    "positionCode",
    "positionName",
  ],
  properties: {
    employeeId: { type: "string" },
    externalEmployeeRef: { type: "string", nullable: true },
    firstName: { type: "string" },
    lastName: { type: "string" },
    displayName: { type: "string" },
    hireDate: { type: "string" },
    terminationDate: { type: "string", nullable: true },
    employmentStatus: { type: "string" },
    employmentType: { type: "string" },
    assignmentId: { type: "string", nullable: true },
    assignmentStartDate: { type: "string", nullable: true },
    storeId: { type: "string", nullable: true },
    storeCode: { type: "string", nullable: true },
    storeName: { type: "string", nullable: true },
    regionId: { type: "string", nullable: true },
    regionName: { type: "string", nullable: true },
    positionId: { type: "string", nullable: true },
    positionCode: { type: "string", nullable: true },
    positionName: { type: "string", nullable: true },
  },
};

const listResponseMetaSchema = {
  type: "object",
  required: ["count", "total", "limit", "offset"],
  properties: {
    count: { type: "integer", minimum: 0 },
    total: { type: "integer", minimum: 0 },
    limit: { type: "integer", minimum: 0 },
    offset: { type: "integer", minimum: 0 },
  },
};

const authRoleCatalogResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: authRoleCatalogItemSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const authPermissionCatalogResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: authPermissionCatalogItemSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const authUserAccountsResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: authUserAccountSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const authRoleAssignmentsResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: authRoleAssignmentSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const authActionStoreAssignmentsResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: authActionStoreAssignmentSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const authAuditResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: authAuditEventSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const competitionListResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: competitionSummarySchema,
    },
    meta: listResponseMetaSchema,
  },
};

const competitionDetailResponseSchema = {
  type: "object",
  required: [
    "competition",
    "stages",
    "teams",
    "latestScores",
    "warnings",
    "storeContributions",
  ],
  properties: {
    competition: competitionSummarySchema,
    stages: {
      type: "array",
      items: competitionStageSchema,
    },
    teams: {
      type: "array",
      items: competitionTeamSchema,
    },
    latestScores: {
      type: "array",
      items: competitionTeamScoreSchema,
    },
    warnings: {
      type: "array",
      items: competitionWarningSchema,
    },
    storeContributions: {
      type: "array",
      items: competitionStoreContributionSchema,
    },
  },
};

const competitionTeamTemplateListResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: competitionTeamTemplateSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const competitionStagePackagePlanListResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: competitionStagePackagePlanSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const competitionStagePackagePlanAuditResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: competitionStagePackagePlanAuditEventSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const targetDistributionAllocationSchema = {
  type: "object",
  required: ["employeeId", "assigneeLabel", "targetValue"],
  properties: {
    employeeId: { type: "string" },
    assigneeLabel: { type: "string" },
    targetValue: { type: "number" },
    note: { type: "string" },
  },
};

const targetDistributionRequestSchema = {
  type: "object",
  required: [
    "requestId",
    "companyId",
    "regionId",
    "storeId",
    "storeName",
    "requestMonth",
    "targetLabel",
    "totalTargetValue",
    "allocationCount",
    "status",
    "requestReason",
    "allocations",
    "submittedByUserId",
    "approvedByUserId",
    "approvedAt",
    "approvalNote",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    requestId: { type: "string" },
    companyId: { type: "string" },
    regionId: { type: "string" },
    storeId: { type: "string" },
    storeName: { type: "string" },
    requestMonth: { type: "string" },
    targetLabel: { type: "string" },
    totalTargetValue: { type: "number" },
    allocationCount: { type: "integer", minimum: 0 },
    status: { type: "string" },
    requestReason: { type: "string", nullable: true },
    allocations: {
      type: "array",
      items: targetDistributionAllocationSchema,
    },
    submittedByUserId: { type: "string" },
    approvedByUserId: { type: "string", nullable: true },
    approvedAt: { type: "string", nullable: true },
    approvalNote: { type: "string", nullable: true },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const targetDistributionRequestsResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: targetDistributionRequestSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const targetCoverageRowSchema = {
  type: "object",
  required: [
    "storeId",
    "storeName",
    "employeeId",
    "displayName",
    "externalEmployeeRef",
    "targetReferenceId",
    "targetValue",
    "pendingRequestId",
    "pendingTargetValue",
    "staleTargetReferenceId",
    "targetStatus",
  ],
  properties: {
    storeId: { type: "string" },
    storeName: { type: "string" },
    employeeId: { type: "string" },
    displayName: { type: "string" },
    externalEmployeeRef: { type: "string", nullable: true },
    targetReferenceId: { type: "string", nullable: true },
    targetValue: { type: "number", nullable: true },
    pendingRequestId: { type: "string", nullable: true },
    pendingTargetValue: { type: "number", nullable: true },
    staleTargetReferenceId: { type: "string", nullable: true },
    targetStatus: { type: "string" },
  },
};

const targetCoverageSummarySchema = {
  type: "object",
  required: [
    "requestMonth",
    "totalEmployees",
    "coveredEmployees",
    "missingEmployees",
    "pendingEmployees",
    "conflictEmployees",
    "staleEmployees",
    "uncoveredEmployees",
    "coverageRate",
  ],
  properties: {
    requestMonth: { type: "string" },
    totalEmployees: { type: "integer", minimum: 0 },
    coveredEmployees: { type: "integer", minimum: 0 },
    missingEmployees: { type: "integer", minimum: 0 },
    pendingEmployees: { type: "integer", minimum: 0 },
    conflictEmployees: { type: "integer", minimum: 0 },
    staleEmployees: { type: "integer", minimum: 0 },
    uncoveredEmployees: { type: "integer", minimum: 0 },
    coverageRate: { type: "number", minimum: 0 },
  },
};

const targetCoverageResponseSchema = {
  type: "object",
  required: ["items", "meta", "summary"],
  properties: {
    items: {
      type: "array",
      items: targetCoverageRowSchema,
    },
    meta: listResponseMetaSchema,
    summary: targetCoverageSummarySchema,
  },
};

const storeTargetingPersonSchema = {
  type: "object",
  required: [
    "employeeId",
    "displayName",
    "externalEmployeeRef",
    "periodStart",
    "periodEnd",
    "netSalesValue",
  ],
  properties: {
    employeeId: { type: "string" },
    displayName: { type: "string" },
    externalEmployeeRef: { type: "string", nullable: true },
    periodStart: { type: "string", nullable: true },
    periodEnd: { type: "string", nullable: true },
    netSalesValue: { type: "number", nullable: true },
  },
};

const storeTargetingPersonnelResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: storeTargetingPersonSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const workflowInboxItemSchema = {
  type: "object",
  required: [
    "itemType",
    "sourceType",
    "sourceId",
    "title",
    "summary",
    "storeId",
    "workflowStatus",
    "inboxStatus",
    "urgency",
    "actorRole",
    "primaryActionLabel",
    "deepLink",
  ],
  properties: {
    itemType: {
      type: "string",
      enum: ["approval", "acknowledgement", "task", "notification"],
    },
    sourceType: {
      type: "string",
      enum: ["target_distribution_request", "checklist_receipt", "kpi_exception", "store_action_plan"],
    },
    sourceId: { type: "string" },
    title: { type: "string" },
    summary: { type: "string" },
    companyId: { type: "string" },
    regionId: { type: "string" },
    storeId: { type: "string" },
    storeName: { type: "string" },
    workflowStatus: { type: "string" },
    inboxStatus: {
      type: "string",
      enum: ["needs_attention", "completed", "informational"],
    },
    urgency: {
      type: "string",
      enum: ["high", "medium", "low"],
    },
    createdAt: { type: "string", nullable: true },
    needsAttentionAt: { type: "string", nullable: true },
    actorRole: { type: "string" },
    primaryActionLabel: { type: "string" },
    secondaryActionLabel: { type: "string" },
    deepLink: { type: "string" },
    historyPreview: { type: "string" },
  },
};

const workflowInboxResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: workflowInboxItemSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const workforceSellerCodeReferenceResponseSchema = {
  type: "object",
  required: ["storeType", "prefix", "lastSellerCode", "nextSellerCodePreview"],
  properties: {
    storeType: { type: "string", enum: ["franchise"] },
    prefix: { type: "string", enum: ["FM"] },
    lastSellerCode: { type: "string", nullable: true },
    nextSellerCodePreview: { type: "string", nullable: true },
  },
};

const workforcePositionOptionSchema = {
  type: "object",
  required: [
    "positionId",
    "positionCode",
    "positionName",
    "jobFamily",
    "isManagerial",
  ],
  properties: {
    positionId: { type: "string" },
    positionCode: { type: "string" },
    positionName: { type: "string" },
    jobFamily: { type: "string", nullable: true },
    isManagerial: { type: "boolean" },
  },
};

const workforcePositionOptionsResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: workforcePositionOptionSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const workforceStoreEmployeeSchema = {
  type: "object",
  required: [
    "employeeId",
    "displayName",
    "externalEmployeeRef",
    "storeId",
    "positionId",
    "positionCode",
    "positionName",
    "assignmentStartDate",
    "employmentStatus",
  ],
  properties: {
    employeeId: { type: "string" },
    displayName: { type: "string" },
    externalEmployeeRef: { type: "string", nullable: true },
    storeId: { type: "string" },
    positionId: { type: "string" },
    positionCode: { type: "string" },
    positionName: { type: "string" },
    assignmentStartDate: { type: "string" },
    employmentStatus: { type: "string" },
  },
};

const workforceStoreEmployeesResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: workforceStoreEmployeeSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const workforceSellerCodeRequestSchema = {
  type: "object",
  required: [
    "requestId",
    "companyId",
    "regionId",
    "storeId",
    "storeCode",
    "storeName",
    "storeType",
    "requestType",
    "status",
    "firstName",
    "lastName",
    "nationalIdLast4",
    "phoneNumber",
    "hireDate",
    "requestedPositionId",
    "positionCode",
    "positionName",
    "employmentType",
    "requestedSellerCode",
    "approvedSellerCode",
    "lastReferenceSellerCode",
    "submittedByUserId",
    "reviewedByUserId",
    "reviewedAt",
    "reviewNote",
    "employeeId",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    requestId: { type: "string" },
    companyId: { type: "string" },
    regionId: { type: "string" },
    storeId: { type: "string" },
    storeCode: { type: "string" },
    storeName: { type: "string" },
    storeType: { type: "string" },
    requestType: { type: "string" },
    status: { type: "string" },
    firstName: { type: "string" },
    lastName: { type: "string" },
    nationalIdLast4: { type: "string" },
    phoneNumber: { type: "string" },
    hireDate: { type: "string" },
    requestedPositionId: { type: "string" },
    positionCode: { type: "string" },
    positionName: { type: "string" },
    employmentType: { type: "string" },
    requestedSellerCode: { type: "string", nullable: true },
    approvedSellerCode: { type: "string", nullable: true },
    lastReferenceSellerCode: { type: "string", nullable: true },
    submittedByUserId: { type: "string" },
    reviewedByUserId: { type: "string", nullable: true },
    reviewedAt: { type: "string", nullable: true },
    reviewNote: { type: "string", nullable: true },
    employeeId: { type: "string", nullable: true },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const workforceSellerCodeRequestsResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: workforceSellerCodeRequestSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const workforceOffboardingRequestSchema = {
  type: "object",
  required: [
    "requestId",
    "companyId",
    "regionId",
    "storeId",
    "storeCode",
    "storeName",
    "employeeId",
    "displayName",
    "externalEmployeeRef",
    "positionCode",
    "positionName",
    "status",
    "terminationDate",
    "terminationReason",
    "requestReason",
    "submittedByUserId",
    "reviewedByUserId",
    "reviewedAt",
    "reviewNote",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    requestId: { type: "string" },
    companyId: { type: "string" },
    regionId: { type: "string" },
    storeId: { type: "string" },
    storeCode: { type: "string" },
    storeName: { type: "string" },
    employeeId: { type: "string" },
    displayName: { type: "string" },
    externalEmployeeRef: { type: "string", nullable: true },
    positionCode: { type: "string", nullable: true },
    positionName: { type: "string", nullable: true },
    status: { type: "string" },
    terminationDate: { type: "string" },
    terminationReason: { type: "string" },
    requestReason: { type: "string", nullable: true },
    submittedByUserId: { type: "string" },
    reviewedByUserId: { type: "string", nullable: true },
    reviewedAt: { type: "string", nullable: true },
    reviewNote: { type: "string", nullable: true },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const workforceOffboardingRequestsResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: workforceOffboardingRequestSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const reportingSnapshotRunSchema = {
  type: "object",
  required: [
    "snapshotRunId",
    "snapshotDate",
    "snapshotType",
    "periodStart",
    "periodEnd",
    "runStatus",
    "generatedAt",
    "generatedBy",
  ],
  properties: {
    snapshotRunId: { type: "string" },
    snapshotDate: { type: "string" },
    snapshotType: { type: "string" },
    periodStart: { type: "string" },
    periodEnd: { type: "string" },
    runStatus: { type: "string" },
    generatedAt: { type: "string" },
    generatedBy: { type: "string" },
    kpiConfigVersion: {
      type: "object",
      nullable: true,
      required: ["kpiConfigVersionId", "versionNo", "state"],
      properties: {
        kpiConfigVersionId: { type: "string", nullable: true },
        versionNo: { type: "integer", nullable: true },
        state: { type: "string", enum: ["versioned", "pre_governance"] },
      },
    },
  },
};

const reportingSnapshotRunsResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: reportingSnapshotRunSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const reportingSummaryResponseSchema = {
  type: "object",
  required: ["latestCompletedSnapshotRun", "cards"],
  properties: {
    latestCompletedSnapshotRun: {
      ...reportingSnapshotRunSchema,
      nullable: true,
    },
    cards: {
      type: "object",
      required: ["workforceRows", "kpiRows", "checklistRows", "turnoverRows"],
      properties: {
        workforceRows: { type: "integer", minimum: 0 },
        kpiRows: { type: "integer", minimum: 0 },
        checklistRows: { type: "integer", minimum: 0 },
        turnoverRows: { type: "integer", minimum: 0 },
      },
    },
  },
};

const reportingKpiOwnerRoleSchema = {
  type: "string",
  enum: [
    "DEPUTY_GM",
    "REGION_MANAGER",
    "STORE_MANAGER",
    "STORE_PERSONNEL",
    "VISUAL_TEAM",
  ],
};

const reportingKpiScoreProfileMetricSchema = {
  type: "object",
  required: ["code", "label", "weightPercent", "ownerRole", "scoreBehavior"],
  properties: {
    code: { type: "string" },
    label: { type: "string" },
    weightPercent: { type: "number" },
    ownerRole: reportingKpiOwnerRoleSchema,
    scoreBehavior: {
      type: "string",
      enum: ["score_only", "warning_first", "task_candidate"],
    },
    direction: {
      type: "string",
      enum: ["HIGHER_IS_BETTER", "LOWER_IS_BETTER", "TARGET_BAND"],
    },
    benchmarkSource: {
      type: "string",
      enum: ["TARGET", "TURKEY_AVERAGE", "CHECKLIST_SCORE"],
    },
    capRatio: { type: "number" },
    aliases: {
      type: "array",
      items: { type: "string" },
    },
    notes: { type: "string" },
  },
};

const reportingKpiScoreProfileSchema = {
  type: "object",
  required: ["profileCode", "title", "summary", "metrics", "futureMetricRule"],
  properties: {
    profileCode: { type: "string", enum: ["store", "personnel"] },
    title: { type: "string" },
    summary: { type: "string" },
    metrics: {
      type: "array",
      items: reportingKpiScoreProfileMetricSchema,
    },
    futureMetricRule: { type: "string" },
  },
};

const reportingKpiOwnershipMatrixRowSchema = {
  type: "object",
  required: [
    "code",
    "label",
    "visibleTo",
    "operationalOwner",
    "contributesTo",
    "taskCandidate",
  ],
  properties: {
    code: { type: "string" },
    label: { type: "string" },
    visibleTo: {
      type: "array",
      items: reportingKpiOwnerRoleSchema,
    },
    operationalOwner: reportingKpiOwnerRoleSchema,
    contributesTo: {
      type: "array",
      items: { type: "string", enum: ["store", "personnel"] },
    },
    taskCandidate: { type: "boolean" },
  },
};

const reportingKpiGradingBandSchema = {
  type: "object",
  required: ["code", "label", "emoji", "tone", "minScore"],
  properties: {
    code: { type: "string" },
    label: { type: "string" },
    emoji: { type: "string" },
    tone: {
      type: "string",
      enum: ["calm", "accent", "warning", "danger", "neutral"],
    },
    minScore: { type: "number" },
  },
};

const reportingKpiConfigSchema = {
  type: "object",
  required: ["storeProfile", "personnelProfile", "ownershipMatrix", "gradingBands"],
  properties: {
    storeProfile: reportingKpiScoreProfileSchema,
    personnelProfile: reportingKpiScoreProfileSchema,
    ownershipMatrix: {
      type: "array",
      items: reportingKpiOwnershipMatrixRowSchema,
    },
    gradingBands: {
      type: "array",
      items: reportingKpiGradingBandSchema,
    },
  },
};

const reportingKpiConfigVersionMetadataSchema = {
  type: "object",
  required: [
    "kpiConfigVersionId",
    "versionNo",
    "effectiveFrom",
    "effectiveTo",
    "publishedAt",
    "publishedBy",
  ],
  properties: {
    kpiConfigVersionId: { type: "string", nullable: true },
    versionNo: { type: "integer", nullable: true },
    effectiveFrom: { type: "string", nullable: true },
    effectiveTo: { type: "string", nullable: true },
    publishedAt: { type: "string", nullable: true },
    publishedBy: { type: "string", nullable: true },
  },
};

const reportingKpiConfigResponseSchema = {
  type: "object",
  required: [...reportingKpiConfigSchema.required, "metadata"],
  properties: {
    ...reportingKpiConfigSchema.properties,
    metadata: reportingKpiConfigVersionMetadataSchema,
  },
};

const reportingKpiConfigEditorResponseSchema = {
  type: "object",
  required: [
    "draftConfig",
    "publishedConfig",
    "hasUnpublishedChanges",
    "latestPublishedVersion",
  ],
  properties: {
    draftConfig: reportingKpiConfigSchema,
    publishedConfig: reportingKpiConfigSchema,
    hasUnpublishedChanges: { type: "boolean" },
    latestPublishedVersion: reportingKpiConfigVersionMetadataSchema,
  },
};

const reportingKpiConfigAuditResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: auditEventSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const reportingWorkforceRowSchema = {
  type: "object",
  required: [
    "snapshotRunId",
    "storeId",
    "positionId",
    "activeHeadcount",
    "activeFte",
    "plannedHeadcount",
    "plannedFte",
    "gapHeadcount",
    "gapFte",
  ],
  properties: {
    snapshotRunId: { type: "string" },
    storeId: { type: "string" },
    positionId: { type: "string" },
    activeHeadcount: { type: "string" },
    activeFte: { type: "string" },
    plannedHeadcount: { type: "string" },
    plannedFte: { type: "string" },
    gapHeadcount: { type: "string" },
    gapFte: { type: "string" },
  },
};

const reportingWorkforceResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: reportingWorkforceRowSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const reportingKpiRowSchema = {
  type: "object",
  required: [
    "snapshotRunId",
    "storeId",
    "kpiId",
    "kpiCode",
    "kpiName",
    "periodStart",
    "periodEnd",
    "targetValue",
    "actualValue",
    "achievementRate",
    "statusBand",
  ],
  properties: {
    snapshotRunId: { type: "string" },
    storeId: { type: "string" },
    kpiId: { type: "string" },
    kpiCode: { type: "string" },
    kpiName: { type: "string" },
    periodStart: { type: "string" },
    periodEnd: { type: "string" },
    targetValue: { type: "string", nullable: true },
    actualValue: { type: "string", nullable: true },
    achievementRate: { type: "string", nullable: true },
    statusBand: { type: "string", nullable: true },
  },
};

const reportingKpiResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: reportingKpiRowSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const reportingPerformanceMetricSchema = {
  type: "object",
  required: ["code", "label", "weightPercent", "actualValue", "contributionValue"],
  properties: {
    code: { type: "string" },
    label: { type: "string" },
    weightPercent: { type: "number" },
    actualValue: { type: "number", nullable: true },
    targetValue: { type: "number", nullable: true },
    achievementRate: { type: "number", nullable: true },
    benchmarkValue: { type: "number", nullable: true },
    benchmarkSource: {
      type: "string",
      enum: ["TARGET", "TURKEY_AVERAGE", "CHECKLIST_SCORE"],
    },
    actualRatio: { type: "number", nullable: true },
    scoredRatio: { type: "number", nullable: true },
    capRatio: { type: "number", nullable: true },
    isCapped: { type: "boolean" },
    missingReason: { type: "string", nullable: true },
    contributionValue: { type: "number" },
    dataStatus: { type: "string", enum: ["reported", "missing"] },
    scoreStatus: {
      type: "string",
      enum: ["scored", "pending_normalization", "missing_reference", "missing"],
    },
    status: { type: "string", enum: ["reported", "missing"] },
  },
};

const reportingPerformanceResponseSchema = {
  type: "object",
  required: [
    "source",
    "employee",
    "period",
    "score",
    "rankings",
    "availablePeriods",
    "partial",
    "metrics",
  ],
  properties: {
    source: {
      type: "object",
      required: ["mode", "snapshotRunId", "snapshotDate"],
      properties: {
        mode: { type: "string", enum: ["live", "closed"] },
        snapshotRunId: { type: "string", nullable: true },
        snapshotDate: { type: "string", nullable: true },
      },
    },
    employee: {
      type: "object",
      nullable: true,
      required: ["employeeId", "displayName", "storeId", "storeName"],
      properties: {
        employeeId: { type: "string" },
        displayName: { type: "string" },
        storeId: { type: "string", nullable: true },
        storeName: { type: "string", nullable: true },
      },
    },
    period: {
      type: "object",
      nullable: true,
      required: ["periodStart", "periodEnd"],
      properties: {
        periodStart: { type: "string" },
        periodEnd: { type: "string" },
      },
    },
    score: {
      type: "object",
      required: ["value", "matchedMetrics", "totalMetrics"],
      properties: {
        value: { type: "number" },
        matchedMetrics: { type: "integer", minimum: 0 },
        totalMetrics: { type: "integer", minimum: 0 },
      },
    },
    rankings: {
      type: "object",
      required: [
        "turkeyRank",
        "turkeyPopulation",
        "storeRank",
        "storePopulation",
      ],
      properties: {
        turkeyRank: { type: "integer", nullable: true },
        turkeyPopulation: { type: "integer", minimum: 0 },
        storeRank: { type: "integer", nullable: true },
        storePopulation: { type: "integer", minimum: 0 },
      },
    },
    availablePeriods: {
      type: "array",
      items: {
        type: "object",
        required: ["periodType", "periodStart", "periodEnd"],
        properties: {
          periodType: { type: "string" },
          periodStart: { type: "string" },
          periodEnd: { type: "string" },
        },
      },
    },
    partial: {
      type: "object",
      required: ["isPartial", "missingMetricCodes", "missingMetricLabels"],
      properties: {
        isPartial: { type: "boolean" },
        missingMetricCodes: {
          type: "array",
          items: { type: "string" },
        },
        missingMetricLabels: {
          type: "array",
          items: { type: "string" },
        },
        pendingNormalizationCodes: {
          type: "array",
          items: { type: "string" },
        },
        pendingNormalizationLabels: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    supporting: {
      type: "object",
      required: ["netSalesValue", "targetEntryMode", "targetEditableByCurrentUser"],
      properties: {
        netSalesValue: { type: "number", nullable: true },
        targetEntryMode: { type: "string", enum: ["manager_assignment"] },
        targetEditableByCurrentUser: { type: "boolean" },
      },
    },
    metrics: {
      type: "array",
      items: reportingPerformanceMetricSchema,
    },
  },
};

const reportingStoreKpiHighlightMetricSchema = {
  type: "object",
  required: [
    "code",
    "label",
    "weightPercent",
    "actualValue",
    "targetValue",
    "achievementRate",
    "statusBand",
    "dataStatus",
    "scoreStatus",
  ],
  properties: {
    code: { type: "string" },
    label: { type: "string" },
    weightPercent: { type: "number" },
    actualValue: { type: "number", nullable: true },
    targetValue: { type: "number", nullable: true },
    achievementRate: { type: "number", nullable: true },
    benchmarkValue: { type: "number", nullable: true },
    benchmarkSource: {
      type: "string",
      enum: ["TARGET", "TURKEY_AVERAGE", "CHECKLIST_SCORE"],
    },
    actualRatio: { type: "number", nullable: true },
    scoredRatio: { type: "number", nullable: true },
    capRatio: { type: "number", nullable: true },
    isCapped: { type: "boolean" },
    scoreContribution: { type: "number", nullable: true },
    missingReason: { type: "string", nullable: true },
    statusBand: { type: "string", nullable: true },
    dataStatus: { type: "string", enum: ["reported", "missing"] },
    scoreStatus: {
      type: "string",
      enum: ["scored", "pending_normalization", "missing_reference", "missing"],
    },
  },
};

const reportingStoreKpiHighlightsResponseSchema = {
  type: "object",
  required: [
    "source",
    "store",
    "period",
    "score",
    "availablePeriods",
    "partial",
    "metrics",
  ],
  properties: {
    source: {
      type: "object",
      required: ["mode", "snapshotRunId", "snapshotDate", "periodType"],
      properties: {
        mode: { type: "string", enum: ["live"] },
        snapshotRunId: { type: "string", nullable: true },
        snapshotDate: { type: "string", nullable: true },
        periodType: { type: "string" },
      },
    },
    store: {
      type: "object",
      nullable: true,
      required: ["storeId", "storeName"],
      properties: {
        storeId: { type: "string" },
        storeName: { type: "string", nullable: true },
      },
    },
    period: {
      type: "object",
      nullable: true,
      required: ["periodStart", "periodEnd"],
      properties: {
        periodStart: { type: "string" },
        periodEnd: { type: "string" },
      },
    },
    score: {
      type: "object",
      required: ["value", "matchedMetrics", "totalMetrics"],
      properties: {
        value: { type: "number" },
        matchedMetrics: { type: "integer", minimum: 0 },
        totalMetrics: { type: "integer", minimum: 0 },
      },
    },
    availablePeriods: {
      type: "array",
      items: {
        type: "object",
        required: ["periodType", "periodStart", "periodEnd"],
        properties: {
          periodType: { type: "string" },
          periodStart: { type: "string" },
          periodEnd: { type: "string" },
        },
      },
    },
    partial: {
      type: "object",
      required: [
        "isPartial",
        "missingMetricCodes",
        "missingMetricLabels",
        "pendingNormalizationCodes",
        "pendingNormalizationLabels",
      ],
      properties: {
        isPartial: { type: "boolean" },
        missingMetricCodes: {
          type: "array",
          items: { type: "string" },
        },
        missingMetricLabels: {
          type: "array",
          items: { type: "string" },
        },
        pendingNormalizationCodes: {
          type: "array",
          items: { type: "string" },
        },
        pendingNormalizationLabels: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    metrics: {
      type: "array",
      items: reportingStoreKpiHighlightMetricSchema,
    },
  },
};

const reportingStoreScoreWeightsSchema = {
  type: "object",
  required: ["kpiPerformanceWeight", "bmChecklistWeight", "vmChecklistWeight"],
  properties: {
    kpiPerformanceWeight: { type: "number" },
    bmChecklistWeight: { type: "number" },
    vmChecklistWeight: { type: "number" },
  },
};

const reportingStoreScoreComponentSchema = {
  type: "object",
  required: ["included", "score", "weight", "contribution", "status"],
  properties: {
    included: { type: "boolean" },
    score: { type: "number", nullable: true },
    weight: { type: "number" },
    contribution: { type: "number", nullable: true },
    status: {
      type: "string",
      enum: ["included", "not_included", "missing_reference", "future_inactive"],
    },
    missingReason: { type: "string" },
  },
};

const reportingStoreChecklistScoreComponentSchema = {
  type: "object",
  required: [...reportingStoreScoreComponentSchema.required, "visitCount"],
  properties: {
    ...reportingStoreScoreComponentSchema.properties,
    visitCount: { type: "integer", minimum: 0 },
  },
};

const reportingStoreScoreBreakdownResponseSchema = {
  type: "object",
  required: [
    "snapshotRunId",
    "storeId",
    "scoreStatus",
    "totalScore",
    "missingWeightPolicy",
    "configuredWeights",
    "effectiveWeights",
    "components",
  ],
  properties: {
    snapshotRunId: { type: "string" },
    storeId: { type: "string" },
    scoreStatus: { type: "string", enum: ["preview", "final"] },
    totalScore: { type: "number", nullable: true },
    missingWeightPolicy: { type: "string", enum: ["return_missing_weight_to_kpi"] },
    configuredWeights: reportingStoreScoreWeightsSchema,
    effectiveWeights: reportingStoreScoreWeightsSchema,
    components: {
      type: "object",
      required: ["kpi", "bmChecklist", "vmChecklist"],
      properties: {
        kpi: reportingStoreScoreComponentSchema,
        bmChecklist: reportingStoreChecklistScoreComponentSchema,
        vmChecklist: reportingStoreChecklistScoreComponentSchema,
      },
    },
  },
};

const reportingRankingMetricValueSchema = {
  type: "object",
  required: ["code", "label", "actualValue"],
  properties: {
    code: { type: "string" },
    label: { type: "string" },
    actualValue: { type: "number", nullable: true },
    targetValue: { type: "number", nullable: true },
    benchmarkValue: { type: "number", nullable: true },
    contributionValue: { type: "number", nullable: true },
  },
};

const reportingStoreRankingRowSchema = {
  type: "object",
  required: [
    "subject",
    "storeId",
    "storeName",
    "regionId",
    "regionName",
    "regionManagerUserId",
    "regionManagerName",
    "rank",
    "population",
    "scoreValue",
    "visibility",
  ],
  properties: {
    subject: { type: "string", enum: ["store"] },
    storeId: { type: "string" },
    storeName: { type: "string", nullable: true },
    regionId: { type: "string", nullable: true },
    regionName: { type: "string", nullable: true },
    regionManagerUserId: { type: "string", nullable: true },
    regionManagerName: { type: "string", nullable: true },
    rank: { type: "integer", minimum: 1 },
    population: { type: "integer", minimum: 0 },
    scoreValue: { type: "number" },
    visibility: { type: "string", enum: ["summary", "detail"] },
    metrics: {
      type: "array",
      items: reportingRankingMetricValueSchema,
    },
  },
};

const reportingPersonnelRankingRowSchema = {
  type: "object",
  required: [
    "subject",
    "employeeId",
    "displayName",
    "storeId",
    "storeName",
    "regionId",
    "regionName",
    "regionManagerUserId",
    "regionManagerName",
    "rank",
    "population",
    "storeRank",
    "storePopulation",
    "scoreValue",
    "canOpenProfile",
    "visibility",
  ],
  properties: {
    subject: { type: "string", enum: ["personnel"] },
    employeeId: { type: "string" },
    displayName: { type: "string" },
    storeId: { type: "string", nullable: true },
    storeName: { type: "string", nullable: true },
    regionId: { type: "string", nullable: true },
    regionName: { type: "string", nullable: true },
    regionManagerUserId: { type: "string", nullable: true },
    regionManagerName: { type: "string", nullable: true },
    rank: { type: "integer", minimum: 1 },
    population: { type: "integer", minimum: 0 },
    storeRank: { type: "integer", nullable: true },
    storePopulation: { type: "integer", minimum: 0 },
    scoreValue: { type: "number" },
    canOpenProfile: { type: "boolean" },
    visibility: { type: "string", enum: ["summary", "detail"] },
    metrics: {
      type: "array",
      items: reportingRankingMetricValueSchema,
    },
  },
};

const reportingRankingFilterOptionSchema = {
  type: "object",
  required: ["id", "label"],
  properties: {
    id: { type: "string" },
    label: { type: "string" },
  },
};

const reportingRankingReferenceMetricSchema = {
  type: "object",
  required: ["code", "label", "value"],
  properties: {
    code: { type: "string" },
    label: { type: "string" },
    value: { type: "number", nullable: true },
  },
};

const reportingRankingReferenceGroupSchema = {
  type: "object",
  required: ["averageScore", "metrics"],
  properties: {
    averageScore: { type: "number", nullable: true },
    metrics: {
      type: "array",
      items: reportingRankingReferenceMetricSchema,
    },
  },
};

const reportingRankingMetaSchema = {
  type: "object",
  required: ["total", "limit", "offset"],
  properties: {
    total: { type: "integer", minimum: 0 },
    limit: { type: "integer", minimum: 1 },
    offset: { type: "integer", minimum: 0 },
  },
};

const reportingRankingsResponseSchema = {
  type: "object",
  required: [
    "source",
    "access",
    "filters",
    "reference",
    "storeLeaderboard",
    "personnelLeaderboard",
    "availablePeriods",
  ],
  properties: {
    source: {
      type: "object",
      required: ["mode", "periodType", "periodStart", "periodEnd"],
      properties: {
        mode: { type: "string", enum: ["live"] },
        periodType: { type: "string", enum: ["monthly"] },
        periodStart: { type: "string", nullable: true },
        periodEnd: { type: "string", nullable: true },
      },
    },
    access: {
      type: "object",
      required: [
        "globalMode",
        "canSeeGlobalDetails",
        "canSeeManagedStorePersonnelDetails",
      ],
      properties: {
        globalMode: { type: "string", enum: ["top100", "full"] },
        canSeeGlobalDetails: { type: "boolean" },
        canSeeManagedStorePersonnelDetails: { type: "boolean" },
      },
    },
    filters: {
      type: "object",
      required: ["regionManagers", "regions", "stores"],
      properties: {
        regionManagers: {
          type: "array",
          items: reportingRankingFilterOptionSchema,
        },
        regions: {
          type: "array",
          items: reportingRankingFilterOptionSchema,
        },
        stores: {
          type: "array",
          items: reportingRankingFilterOptionSchema,
        },
      },
    },
    reference: {
      type: "object",
      required: ["store", "personnel"],
      properties: {
        store: reportingRankingReferenceGroupSchema,
        personnel: reportingRankingReferenceGroupSchema,
      },
    },
    storeLeaderboard: {
      type: "object",
      required: ["items", "currentStore", "meta"],
      properties: {
        items: {
          type: "array",
          items: reportingStoreRankingRowSchema,
        },
        currentStore: {
          ...reportingStoreRankingRowSchema,
          nullable: true,
        },
        meta: reportingRankingMetaSchema,
      },
    },
    personnelLeaderboard: {
      type: "object",
      required: ["items", "currentEmployee", "managedStorePersonnel", "meta"],
      properties: {
        items: {
          type: "array",
          items: reportingPersonnelRankingRowSchema,
        },
        currentEmployee: {
          ...reportingPersonnelRankingRowSchema,
          nullable: true,
        },
        managedStorePersonnel: {
          type: "array",
          items: reportingPersonnelRankingRowSchema,
        },
        meta: reportingRankingMetaSchema,
      },
    },
    availablePeriods: {
      type: "array",
      items: {
        type: "object",
        required: ["periodType", "periodStart", "periodEnd"],
        properties: {
          periodType: { type: "string", enum: ["monthly"] },
          periodStart: { type: "string" },
          periodEnd: { type: "string" },
        },
      },
    },
  },
};

const reportingClosedRankingMetricRankSchema = {
  type: "object",
  required: [
    "code",
    "label",
    "actualValue",
    "storeRank",
    "storePopulation",
    "turkeyRank",
    "turkeyPopulation",
  ],
  properties: {
    code: { type: "string" },
    label: { type: "string" },
    actualValue: { type: "number", nullable: true },
    storeRank: { type: "integer", nullable: true },
    storePopulation: { type: "integer", minimum: 0 },
    turkeyRank: { type: "integer", nullable: true },
    turkeyPopulation: { type: "integer", minimum: 0 },
  },
};

const reportingClosedRankingCoverageSchema = {
  type: "object",
  required: [
    "closedDaysInPeriod",
    "daysWithPerformance",
    "minimumRequiredDays",
    "isEligibleForRanking",
  ],
  properties: {
    closedDaysInPeriod: { type: "integer", minimum: 0 },
    daysWithPerformance: { type: "integer", minimum: 0 },
    minimumRequiredDays: { type: "integer", minimum: 0 },
    isEligibleForRanking: { type: "boolean" },
  },
};

const reportingClosedRankingEmployeeSchema = {
  type: "object",
  required: [
    "employeeId",
    "displayName",
    "storeId",
    "storeName",
    "scoreValue",
    "rankingStatus",
    "eligibilityReason",
    "neededPerformanceDays",
    "rankings",
    "coverage",
    "metricRanks",
  ],
  properties: {
    employeeId: { type: "string" },
    displayName: { type: "string" },
    storeId: { type: "string", nullable: true },
    storeName: { type: "string", nullable: true },
    scoreValue: { type: "number" },
    rankingStatus: { type: "string", enum: ["official", "preview_only"] },
    eligibilityReason: {
      type: "string",
      enum: ["eligible", "needs_more_closed_days"],
    },
    neededPerformanceDays: { type: "integer", minimum: 0 },
    rankings: {
      type: "object",
      required: [
        "turkeyRank",
        "turkeyPopulation",
        "storeRank",
        "storePopulation",
      ],
      properties: {
        turkeyRank: { type: "integer", nullable: true },
        turkeyPopulation: { type: "integer", minimum: 0 },
        storeRank: { type: "integer", nullable: true },
        storePopulation: { type: "integer", minimum: 0 },
      },
    },
    coverage: reportingClosedRankingCoverageSchema,
    metricRanks: {
      type: "array",
      items: reportingClosedRankingMetricRankSchema,
    },
  },
};

const reportingClosedRankingIncludedSnapshotRunSchema = {
  type: "object",
  required: [
    "snapshotRunId",
    "snapshotDate",
    "snapshotType",
    "periodStart",
    "periodEnd",
    "runStatus",
    "generatedAt",
    "generatedBy",
  ],
  properties: {
    snapshotRunId: { type: "string" },
    snapshotDate: { type: "string" },
    snapshotType: { type: "string" },
    periodStart: { type: "string" },
    periodEnd: { type: "string" },
    runStatus: { type: "string" },
    generatedAt: { type: "string" },
    generatedBy: { type: "string" },
  },
};

const reportingClosedLeaderboardResponseSchema = {
  type: "object",
  required: [
    "source",
    "includedSnapshotRuns",
    "currentEmployee",
    "personnelTop",
  ],
  properties: {
    source: {
      type: "object",
      required: [
        "mode",
        "periodType",
        "state",
        "snapshotRunId",
        "snapshotDate",
        "periodStart",
        "periodEnd",
      ],
      properties: {
        mode: { type: "string", enum: ["closed", "live"] },
        periodType: { type: "string", enum: ["daily", "monthly"] },
        state: {
          type: "string",
          enum: ["closed", "live", "not_closed", "no_data"],
        },
        snapshotRunId: { type: "string", nullable: true },
        snapshotDate: { type: "string", nullable: true },
        periodStart: { type: "string", nullable: true },
        periodEnd: { type: "string", nullable: true },
      },
    },
    includedSnapshotRuns: {
      type: "array",
      items: reportingClosedRankingIncludedSnapshotRunSchema,
    },
    currentEmployee: {
      ...reportingClosedRankingEmployeeSchema,
      nullable: true,
    },
    personnelTop: {
      type: "array",
      items: reportingClosedRankingEmployeeSchema,
    },
    availablePeriods: {
      type: "array",
      items: {
        type: "object",
        required: ["periodType", "periodStart", "periodEnd"],
        properties: {
          periodType: { type: "string" },
          periodStart: { type: "string" },
          periodEnd: { type: "string" },
        },
      },
    },
  },
};

const reportingChecklistRowSchema = {
  type: "object",
  required: [
    "snapshotRunId",
    "storeId",
    "checklistTemplateId",
    "auditCount",
    "avgScore",
    "complianceRate",
    "criticalIssueCount",
  ],
  properties: {
    snapshotRunId: { type: "string" },
    storeId: { type: "string" },
    checklistTemplateId: { type: "string" },
    auditCount: { type: "integer", minimum: 0 },
    avgScore: { type: "string", nullable: true },
    complianceRate: { type: "string", nullable: true },
    criticalIssueCount: { type: "integer", minimum: 0 },
  },
};

const reportingChecklistResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: reportingChecklistRowSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const reportingTurnoverRowSchema = {
  type: "object",
  required: [
    "snapshotRunId",
    "scopeType",
    "companyId",
    "regionId",
    "storeId",
    "periodStart",
    "periodEnd",
    "openingHeadcount",
    "closingHeadcount",
    "avgHeadcount",
    "leaverCount",
    "turnoverRate",
  ],
  properties: {
    snapshotRunId: { type: "string" },
    scopeType: { type: "string" },
    companyId: { type: "string", nullable: true },
    regionId: { type: "string", nullable: true },
    storeId: { type: "string", nullable: true },
    periodStart: { type: "string" },
    periodEnd: { type: "string" },
    openingHeadcount: { type: "string" },
    closingHeadcount: { type: "string" },
    avgHeadcount: { type: "string" },
    leaverCount: { type: "integer", minimum: 0 },
    turnoverRate: { type: "string" },
  },
};

const reportingTurnoverResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: reportingTurnoverRowSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const snapshotStatusTotalsSchema = {
  type: "object",
  required: ["all", "queued", "running", "completed", "failed"],
  properties: {
    all: { type: "integer", minimum: 0 },
    queued: { type: "integer", minimum: 0 },
    running: { type: "integer", minimum: 0 },
    completed: { type: "integer", minimum: 0 },
    failed: { type: "integer", minimum: 0 },
  },
};

const snapshotOverviewHealthTotalsSchema = {
  type: "object",
  required: ["healthy", "inProgress", "retryReady", "needsAction", "stuck"],
  properties: {
    healthy: { type: "integer", minimum: 0 },
    inProgress: { type: "integer", minimum: 0 },
    retryReady: { type: "integer", minimum: 0 },
    needsAction: { type: "integer", minimum: 0 },
    stuck: { type: "integer", minimum: 0 },
  },
};

const snapshotOverviewActionTotalsSchema = {
  type: "object",
  required: ["retryReady", "stuck"],
  properties: {
    retryReady: { type: "integer", minimum: 0 },
    stuck: { type: "integer", minimum: 0 },
  },
};

const snapshotOverviewResponseSchema = {
  type: "object",
  required: ["totals", "healthTotals", "actionTotals", "latest"],
  properties: {
    totals: snapshotStatusTotalsSchema,
    healthTotals: snapshotOverviewHealthTotalsSchema,
    actionTotals: snapshotOverviewActionTotalsSchema,
    latest: {
      type: "object",
      required: [
        "completedSnapshotRunId",
        "failedSnapshotRunId",
        "inProgressSnapshotRunId",
        "stuckSnapshotRunId",
      ],
      properties: {
        completedSnapshotRunId: { type: "string", nullable: true },
        failedSnapshotRunId: { type: "string", nullable: true },
        inProgressSnapshotRunId: { type: "string", nullable: true },
        stuckSnapshotRunId: { type: "string", nullable: true },
      },
    },
  },
};

const dailyClosureStatusResponseSchema = {
  type: "object",
  required: [
    "automationEnabled",
    "automationPollMinutes",
    "timezone",
    "referenceAt",
    "localDate",
    "closureDate",
    "healthState",
    "dueNow",
    "canQueue",
    "canRerun",
    "recommendedAction",
    "existingSnapshotRunId",
    "existingRunStatus",
    "existingFailureReason",
    "existingGeneratedAt",
  ],
  properties: {
    automationEnabled: { type: "boolean" },
    automationPollMinutes: { type: "integer", minimum: 0 },
    timezone: { type: "string" },
    referenceAt: { type: "string" },
    localDate: { type: "string" },
    closureDate: { type: "string" },
    healthState: { type: "string" },
    dueNow: { type: "boolean" },
    canQueue: { type: "boolean" },
    canRerun: { type: "boolean" },
    recommendedAction: { type: "string" },
    existingSnapshotRunId: { type: "string", nullable: true },
    existingRunStatus: { type: "string", nullable: true },
    existingFailureReason: { type: "string", nullable: true },
    existingGeneratedAt: { type: "string", nullable: true },
  },
};

const snapshotKpiConfigVersionSchema = {
  type: "object",
  required: ["kpiConfigVersionId", "versionNo", "state"],
  properties: {
    kpiConfigVersionId: { type: "string", nullable: true },
    versionNo: { type: "integer", nullable: true },
    state: { type: "string", enum: ["versioned", "pre_governance"] },
  },
};

const snapshotRunReadModelSchema = {
  type: "object",
  required: [
    "snapshotRunId",
    "snapshotDate",
    "snapshotType",
    "periodStart",
    "periodEnd",
    "runStatus",
    "healthState",
    "generatedAt",
    "generatedBy",
    "startedAt",
    "finishedAt",
    "failureReason",
    "rerunOfSnapshotRunId",
    "kpiConfigVersion",
  ],
  properties: {
    snapshotRunId: { type: "string" },
    snapshotDate: { type: "string" },
    snapshotType: { type: "string" },
    periodStart: { type: "string" },
    periodEnd: { type: "string" },
    runStatus: { type: "string" },
    healthState: { type: "string" },
    generatedAt: { type: "string" },
    generatedBy: { type: "string" },
    startedAt: { type: "string", nullable: true },
    finishedAt: { type: "string", nullable: true },
    failureReason: { type: "string", nullable: true },
    rerunOfSnapshotRunId: { type: "string", nullable: true },
    kpiConfigVersion: snapshotKpiConfigVersionSchema,
  },
};

const snapshotNeedsActionItemSchema = {
  type: "object",
  required: [
    ...snapshotRunReadModelSchema.required,
    "actionReason",
    "recommendedAction",
    "canRerun",
    "rerunCount",
    "latestRerunSnapshotRunId",
    "isStuck",
  ],
  properties: {
    ...snapshotRunReadModelSchema.properties,
    actionReason: { type: "string" },
    recommendedAction: { type: "string" },
    canRerun: { type: "boolean" },
    rerunCount: { type: "integer", minimum: 0 },
    latestRerunSnapshotRunId: { type: "string", nullable: true },
    isStuck: { type: "boolean" },
  },
};

const snapshotRunDetailResponseSchema = {
  type: "object",
  required: [
    "snapshotRun",
    "cards",
    "canRerun",
    "rerunAllowed",
    "rerunBlockedReason",
    "rerunCount",
    "latestRerunSnapshotRunId",
    "failureReason",
  ],
  properties: {
    snapshotRun: snapshotRunReadModelSchema,
    cards: {
      type: "object",
      required: ["workforceRows", "kpiRows", "checklistRows", "turnoverRows"],
      properties: {
        workforceRows: { type: "integer", minimum: 0 },
        kpiRows: { type: "integer", minimum: 0 },
        checklistRows: { type: "integer", minimum: 0 },
        turnoverRows: { type: "integer", minimum: 0 },
      },
    },
    canRerun: { type: "boolean" },
    rerunAllowed: { type: "boolean" },
    rerunBlockedReason: { type: "string", nullable: true },
    rerunCount: { type: "integer", minimum: 0 },
    latestRerunSnapshotRunId: { type: "string", nullable: true },
    failureReason: { type: "string", nullable: true },
  },
};

const snapshotRunDependencyCheckSchema = {
  type: "object",
  required: ["code", "status", "message"],
  properties: {
    code: { type: "string" },
    status: { type: "string", enum: ["pass", "fail"] },
    message: { type: "string" },
  },
};

const snapshotRunDependenciesResponseSchema = {
  type: "object",
  required: ["snapshotRunId", "runStatus", "rerunAllowed", "rerunBlockedReason", "checks"],
  properties: {
    snapshotRunId: { type: "string" },
    runStatus: { type: "string" },
    rerunAllowed: { type: "boolean" },
    rerunBlockedReason: { type: "string", nullable: true },
    checks: {
      type: "array",
      items: snapshotRunDependencyCheckSchema,
    },
  },
};

const snapshotRunLineageNodeSchema = {
  type: "object",
  required: ["snapshotRunId", "runStatus", "snapshotType"],
  properties: {
    snapshotRunId: { type: "string" },
    runStatus: { type: "string" },
    snapshotType: { type: "string" },
  },
};

const snapshotRunLineageResponseSchema = {
  type: "object",
  required: ["snapshotRunId", "parent", "children"],
  properties: {
    snapshotRunId: { type: "string" },
    parent: {
      ...snapshotRunLineageNodeSchema,
      nullable: true,
    },
    children: {
      type: "array",
      items: snapshotRunLineageNodeSchema,
    },
  },
};

const snapshotRunAuditResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: auditEventSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const snapshotNeedsActionResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: snapshotNeedsActionItemSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const importBatchNeedsActionResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: importBatchNeedsActionItemSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const externalIdMapCandidatesResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: externalIdMapCandidateSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const importBatchErrorsResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: importBatchErrorItemSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const importBatchAuditResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: auditEventSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const importBatchReconciliationResponseSchema = {
  type: "object",
  required: ["batch", "totals", "rowStatusSummary", "rates", "reconciliation"],
  properties: {
    batch: importBatchDetailBatchSchema,
    totals: {
      type: "object",
      required: [
        "recordCount",
        "accountedRows",
        "unaccountedRows",
        "countsMatchRecordCount",
      ],
      properties: {
        recordCount: { type: "integer", minimum: 0 },
        accountedRows: { type: "integer", minimum: 0 },
        unaccountedRows: { type: "integer", minimum: 0 },
        countsMatchRecordCount: { type: "boolean" },
      },
    },
    rowStatusSummary: importBatchRowStatusSummarySchema,
    rates: {
      type: "object",
      required: [
        "processedRate",
        "validationFailureRate",
        "retryableErrorRate",
        "pendingRate",
        "accountedRate",
      ],
      properties: {
        processedRate: { type: "number", minimum: 0 },
        validationFailureRate: { type: "number", minimum: 0 },
        retryableErrorRate: { type: "number", minimum: 0 },
        pendingRate: { type: "number", minimum: 0 },
        accountedRate: { type: "number", minimum: 0 },
      },
    },
    reconciliation: {
      type: "object",
      required: [
        "hasFailures",
        "hasPendingRows",
        "hasUnaccountedRows",
        "canRetryNow",
        "blockedByEntityTypes",
        "recommendedNextEntityType",
      ],
      properties: {
        hasFailures: { type: "boolean" },
        hasPendingRows: { type: "boolean" },
        hasUnaccountedRows: { type: "boolean" },
        canRetryNow: { type: "boolean" },
        blockedByEntityTypes: {
          type: "array",
          items: { type: "string" },
        },
        recommendedNextEntityType: { type: "string", nullable: true },
      },
    },
  },
};

const importBatchDetailResponseSchema = {
  type: "object",
  required: [
    "batch",
    "rowStatusSummary",
    "dependencySummary",
    "qualityIssueSummary",
    "blockedByEntityTypes",
    "recommendedImportOrder",
    "recommendedNextEntityType",
    "canRetryNow",
    "healthState",
    "lineageSummary",
  ],
  properties: {
    batch: importBatchDetailBatchSchema,
    rowStatusSummary: importBatchRowStatusSummarySchema,
    dependencySummary: importBatchDependencySummarySchema,
    qualityIssueSummary: importBatchQualityIssueSummarySchema,
    blockedByEntityTypes: {
      type: "array",
      items: { type: "string" },
    },
    recommendedImportOrder: {
      type: "array",
      items: { type: "string" },
    },
    recommendedNextEntityType: { type: "string", nullable: true },
    canRetryNow: { type: "boolean" },
    healthState: { type: "string" },
    lineageSummary: importBatchLineageSummarySchema,
  },
};

const storeMasterListResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: storeMasterItemSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const personnelMasterListResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: personnelMasterItemSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const masterDataBootstrapBatchItemSchema = {
  type: "object",
  required: [
    "batchId",
    "companyId",
    "bootstrapEntity",
    "sourceLabel",
    "fileReference",
    "uploadedByUserId",
    "batchStatus",
    "rowCount",
    "pendingCount",
    "validCount",
    "needsReviewCount",
    "invalidCount",
    "promotedCount",
    "createdAt",
    "validatedAt",
    "promotedAt",
    "readiness",
    "nextAction",
  ],
  properties: {
    batchId: { type: "string" },
    companyId: { type: "string" },
    bootstrapEntity: { type: "string", enum: ["store", "personnel"] },
    sourceLabel: { type: "string" },
    fileReference: { type: "string", nullable: true },
    uploadedByUserId: { type: "string" },
    batchStatus: { type: "string" },
    rowCount: { type: "integer", minimum: 0 },
    pendingCount: { type: "integer", minimum: 0 },
    validCount: { type: "integer", minimum: 0 },
    needsReviewCount: { type: "integer", minimum: 0 },
    invalidCount: { type: "integer", minimum: 0 },
    promotedCount: { type: "integer", minimum: 0 },
    createdAt: { type: "string" },
    updatedAt: { type: "string", nullable: true },
    validatedAt: { type: "string", nullable: true },
    promotedAt: { type: "string", nullable: true },
    readiness: {
      type: "string",
      enum: ["needs_validation", "needs_review", "ready_to_promote", "closed"],
    },
    nextAction: { type: "string" },
  },
};

const masterDataBootstrapBatchesResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: masterDataBootstrapBatchItemSchema,
    },
    meta: listResponseMetaSchema,
  },
};

const masterDataBootstrapStatusCountsSchema = {
  type: "object",
  required: ["pending", "valid", "needs_review", "invalid", "promoted"],
  properties: {
    pending: { type: "integer", minimum: 0 },
    valid: { type: "integer", minimum: 0 },
    needs_review: { type: "integer", minimum: 0 },
    invalid: { type: "integer", minimum: 0 },
    promoted: { type: "integer", minimum: 0 },
  },
};

const masterDataBootstrapDetailSummarySchema = {
  type: "object",
  required: [
    "batchId",
    "companyId",
    "bootstrapEntity",
    "sourceLabel",
    "fileReference",
    "uploadedByUserId",
    "batchStatus",
    "rowCount",
    "validCount",
    "needsReviewCount",
    "invalidCount",
    "promotedCount",
    "createdAt",
    "validatedAt",
    "promotedAt",
    "statusCounts",
  ],
  properties: {
    batchId: { type: "string" },
    companyId: { type: "string" },
    bootstrapEntity: { type: "string", enum: ["store", "personnel"] },
    sourceLabel: { type: "string" },
    fileReference: { type: "string", nullable: true },
    uploadedByUserId: { type: "string" },
    batchStatus: { type: "string" },
    rowCount: { type: "integer", minimum: 0 },
    validCount: { type: "integer", minimum: 0 },
    needsReviewCount: { type: "integer", minimum: 0 },
    invalidCount: { type: "integer", minimum: 0 },
    promotedCount: { type: "integer", minimum: 0 },
    createdAt: { type: "string" },
    validatedAt: { type: "string", nullable: true },
    promotedAt: { type: "string", nullable: true },
    statusCounts: masterDataBootstrapStatusCountsSchema,
  },
};

const masterDataBootstrapDetailRowSchema = {
  type: "object",
  required: [
    "rowId",
    "rowNumber",
    "sourceStoreCode",
    "sourceEmployeeCode",
    "validationStatus",
    "issueCode",
    "issueMessage",
    "resolvedCompanyId",
    "resolvedRegionId",
    "resolvedStoreId",
    "resolvedEmployeeId",
    "resolvedPositionId",
    "promotedEntityId",
    "rawPayload",
    "normalizedPayload",
  ],
  properties: {
    rowId: { type: "string" },
    rowNumber: { type: "integer", minimum: 0 },
    sourceStoreCode: { type: "string", nullable: true },
    sourceEmployeeCode: { type: "string", nullable: true },
    validationStatus: { type: "string" },
    issueCode: { type: "string", nullable: true },
    issueMessage: { type: "string", nullable: true },
    resolvedCompanyId: { type: "string", nullable: true },
    resolvedRegionId: { type: "string", nullable: true },
    resolvedStoreId: { type: "string", nullable: true },
    resolvedEmployeeId: { type: "string", nullable: true },
    resolvedPositionId: { type: "string", nullable: true },
    promotedEntityId: { type: "string", nullable: true },
    rawPayload: { type: "object", additionalProperties: true },
    normalizedPayload: { type: "object", additionalProperties: true },
  },
};

const masterDataBootstrapBatchDetailResponseSchema = {
  type: "object",
  required: ["summary", "rows"],
  properties: {
    summary: masterDataBootstrapDetailSummarySchema,
    rows: {
      type: "object",
      required: ["items", "meta"],
      properties: {
        items: {
          type: "array",
          items: masterDataBootstrapDetailRowSchema,
        },
        meta: listResponseMetaSchema,
      },
    },
  },
};

const masterDataBootstrapPromotionReadinessSchema = {
  type: "string",
  enum: [
    "needs_validation",
    "needs_review",
    "blocked",
    "waiting_batch",
    "ready",
    "already_promoted",
  ],
};

const masterDataBootstrapPromotionReadinessRowSchema = {
  type: "object",
  required: [
    "rowId",
    "rowNumber",
    "validationStatus",
    "issueCode",
    "issueMessage",
    "promotionReadiness",
    "blockReason",
    "resolvedStoreId",
    "resolvedEmployeeId",
    "resolvedPositionId",
    "promotedEntityId",
  ],
  properties: {
    rowId: { type: "string" },
    rowNumber: { type: "integer", minimum: 0 },
    sourceStoreCode: { type: "string", nullable: true },
    sourceEmployeeCode: { type: "string", nullable: true },
    validationStatus: { type: "string" },
    issueCode: { type: "string", nullable: true },
    issueMessage: { type: "string", nullable: true },
    promotionReadiness: masterDataBootstrapPromotionReadinessSchema,
    blockReason: { type: "string", nullable: true },
    resolvedStoreId: { type: "string", nullable: true },
    resolvedEmployeeId: { type: "string", nullable: true },
    resolvedPositionId: { type: "string", nullable: true },
    promotedEntityId: { type: "string", nullable: true },
  },
};

const masterDataBootstrapPromotionReadinessResponseSchema = {
  type: "object",
  required: ["summary", "rows"],
  properties: {
    summary: {
      type: "object",
      required: [
        "batchId",
        "bootstrapEntity",
        "batchStatus",
        "rowCount",
        "readyCount",
        "waitingBatchCount",
        "needsValidationCount",
        "needsReviewCount",
        "blockedCount",
        "alreadyPromotedCount",
        "canPromote",
        "nextAction",
      ],
      properties: {
        batchId: { type: "string" },
        bootstrapEntity: { type: "string", enum: ["store", "personnel"] },
        batchStatus: { type: "string" },
        rowCount: { type: "integer", minimum: 0 },
        readyCount: { type: "integer", minimum: 0 },
        waitingBatchCount: { type: "integer", minimum: 0 },
        needsValidationCount: { type: "integer", minimum: 0 },
        needsReviewCount: { type: "integer", minimum: 0 },
        blockedCount: { type: "integer", minimum: 0 },
        alreadyPromotedCount: { type: "integer", minimum: 0 },
        canPromote: { type: "boolean" },
        nextAction: {
          type: "string",
          enum: [
            "already_closed",
            "validate_batch",
            "review_rows",
            "promote_ready_rows",
            "wait_for_batch_ready",
          ],
        },
      },
    },
    rows: {
      type: "object",
      required: ["items", "meta"],
      properties: {
        items: {
          type: "array",
          items: masterDataBootstrapPromotionReadinessRowSchema,
        },
        meta: listResponseMetaSchema,
      },
    },
  },
};
async function generateOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api");

  const config = new DocumentBuilder()
    .setTitle("Store Ops API")
    .setDescription("Generated OpenAPI baseline for backend/frontend contract checks.")
    .setVersion("0.1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      "bearer",
    )
    .addSecurityRequirements("bearer")
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey}_${methodKey}`,
  });

  for (const operationReference of publicOperations) {
    const operation = (document.paths[operationReference.path] as
      | MutablePathItem
      | undefined)?.[operationReference.method];

    if (operation) {
      operation.security = [];
    }
  }

  for (const operationReference of mobileSessionOperations) {
    const operation = (document.paths[operationReference.path] as
      | MutablePathItem
      | undefined)?.[operationReference.method];

    if (operation) {
      const parameters = operation.parameters ?? [];
      operation.parameters = [
        ...parameters.filter(
          (parameter) => parameter.name !== mobileSessionHeader.name,
        ),
        mobileSessionHeader,
      ];
    }
  }

  document.components = document.components ?? {};
  document.components.schemas = {
    ...(document.components.schemas ?? {}),
    CompetitionListResponse: competitionListResponseSchema,
    CompetitionDetailResponse: competitionDetailResponseSchema,
    CompetitionTeamTemplateListResponse:
      competitionTeamTemplateListResponseSchema,
    CompetitionStagePackagePlanListResponse:
      competitionStagePackagePlanListResponseSchema,
    CompetitionStagePackagePlanAuditResponse:
      competitionStagePackagePlanAuditResponseSchema,
    TargetDistributionRequestsResponse: targetDistributionRequestsResponseSchema,
    TargetCoverageResponse: targetCoverageResponseSchema,
    StoreTargetingPersonnelResponse: storeTargetingPersonnelResponseSchema,
    WorkflowInboxResponse: workflowInboxResponseSchema,
    SnapshotOverviewResponse: snapshotOverviewResponseSchema,
    DailyClosureStatusResponse: dailyClosureStatusResponseSchema,
    SnapshotNeedsActionResponse: snapshotNeedsActionResponseSchema,
    SnapshotRunDetailResponse: snapshotRunDetailResponseSchema,
    SnapshotRunDependenciesResponse: snapshotRunDependenciesResponseSchema,
    SnapshotRunLineageResponse: snapshotRunLineageResponseSchema,
    SnapshotRunAuditResponse: snapshotRunAuditResponseSchema,
    WorkforceSellerCodeReferenceResponse:
      workforceSellerCodeReferenceResponseSchema,
    WorkforcePositionOptionsResponse: workforcePositionOptionsResponseSchema,
    WorkforceStoreEmployeesResponse: workforceStoreEmployeesResponseSchema,
    WorkforceSellerCodeRequestsResponse:
      workforceSellerCodeRequestsResponseSchema,
    WorkforceOffboardingRequestsResponse:
      workforceOffboardingRequestsResponseSchema,
    ReportingSummaryResponse: reportingSummaryResponseSchema,
    ReportingSnapshotRunsResponse: reportingSnapshotRunsResponseSchema,
    ReportingKpiConfigDraftRequest: reportingKpiConfigSchema,
    ReportingKpiConfigResponse: reportingKpiConfigResponseSchema,
    ReportingKpiConfigEditorResponse: reportingKpiConfigEditorResponseSchema,
    ReportingKpiConfigAuditResponse: reportingKpiConfigAuditResponseSchema,
    ReportingWorkforceResponse: reportingWorkforceResponseSchema,
    ReportingKpiResponse: reportingKpiResponseSchema,
    ReportingPerformanceResponse: reportingPerformanceResponseSchema,
    ReportingStoreKpiHighlightsResponse:
      reportingStoreKpiHighlightsResponseSchema,
    ReportingStoreScoreBreakdownResponse:
      reportingStoreScoreBreakdownResponseSchema,
    ReportingRankingsResponse: reportingRankingsResponseSchema,
    ReportingClosedLeaderboardResponse: reportingClosedLeaderboardResponseSchema,
    ReportingChecklistResponse: reportingChecklistResponseSchema,
    ReportingTurnoverResponse: reportingTurnoverResponseSchema,
    AuthLookupsResponse: authLookupsResponseSchema,
    AuthUserLookupSearchResponse: authUserLookupSearchResponseSchema,
    AuthStoreLookupSearchResponse: authStoreLookupSearchResponseSchema,
    AuthRoleCatalogResponse: authRoleCatalogResponseSchema,
    AuthPermissionCatalogResponse: authPermissionCatalogResponseSchema,
    AuthRolePermissionCommandResponse:
      authRolePermissionCommandResponseSchema,
    AuthUserAccountCommandResponse: authUserAccountCommandResponseSchema,
    AuthUserDeactivationCommandResponse:
      authUserDeactivationCommandResponseSchema,
    AuthUserAccountsResponse: authUserAccountsResponseSchema,
    AuthRoleAssignmentCommandResponse: authRoleAssignmentCommandResponseSchema,
    AuthRoleAssignmentsResponse: authRoleAssignmentsResponseSchema,
    AuthActionStoreAssignmentCommandResponse:
      authActionStoreAssignmentCommandResponseSchema,
    AuthActionStoreAssignmentsResponse:
      authActionStoreAssignmentsResponseSchema,
    AuthPilotUserBindingCommandResponse:
      authPilotUserBindingCommandResponseSchema,
    AuthAuditResponse: authAuditResponseSchema,
    AuthBootstrapResponse: authBootstrapResponseSchema,
    AuthSessionResponse: authSessionResponseSchema,
    ImportOverview: importOverviewSchema,
    ImportPayloadTemplateResponse: importPayloadTemplateSchema,
    ImportBatchAuditResponse: importBatchAuditResponseSchema,
    ImportBatchNeedsActionResponse: importBatchNeedsActionResponseSchema,
    ImportBatchDetailResponse: importBatchDetailResponseSchema,
    ImportBatchErrorsResponse: importBatchErrorsResponseSchema,
    ImportBatchReconciliationResponse: importBatchReconciliationResponseSchema,
    ExternalIdMapCandidatesResponse: externalIdMapCandidatesResponseSchema,
    IntegrationLookups: integrationLookupsSchema,
    PersonnelMasterListResponse: personnelMasterListResponseSchema,
    PersonnelMasterLookups: personnelMasterLookupsSchema,
    StoreMasterListResponse: storeMasterListResponseSchema,
    StoreMasterLookups: storeMasterLookupsSchema,
    MasterDataBootstrapBatchesResponse: masterDataBootstrapBatchesResponseSchema,
    MasterDataBootstrapBatchDetailResponse:
      masterDataBootstrapBatchDetailResponseSchema,
    MasterDataBootstrapPromotionReadinessResponse:
      masterDataBootstrapPromotionReadinessResponseSchema,
    MobileChecklistTodayResponse: mobileChecklistTodayResponseSchema,
  };

  applyStoreActionPlanOpenApi(document);
  applyPilotFeedbackOpenApi(document);
  setJsonResponseSchema(
    document.paths,
    "/api/integrations/import-batches/overview",
    "get",
    "Import admin overview with totals and latest actionable batches.",
    "ImportOverview",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/competitions",
    "get",
    "Paginated competition summaries visible to the current actor.",
    "CompetitionListResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/competitions/{competitionId}",
    "get",
    "Competition detail visible to the current actor.",
    "CompetitionDetailResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/competitions/team-templates",
    "get",
    "Paginated competition team templates visible to competition admins.",
    "CompetitionTeamTemplateListResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/competitions/{competitionId}/stage-package-plans",
    "get",
    "Competition stage package plan list for admin review.",
    "CompetitionStagePackagePlanListResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/competitions/stage-package-plans/{planId}/audit",
    "get",
    "Competition stage package plan audit events for admin review.",
    "CompetitionStagePackagePlanAuditResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/target-distributions/requests",
    "get",
    "Target distribution approval requests visible to the current actor.",
    "TargetDistributionRequestsResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/target-distributions/coverage",
    "get",
    "Target distribution coverage rows and summary visible to the current actor.",
    "TargetCoverageResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/target-distributions/store-personnel",
    "get",
    "Store personnel available for target distribution requests.",
    "StoreTargetingPersonnelResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/workflow/inbox",
    "get",
    "Shared workflow inbox items visible to the current actor.",
    "WorkflowInboxResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/snapshots/runs/overview",
    "get",
    "Snapshot run overview totals and latest actionable run pointers.",
    "SnapshotOverviewResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/snapshots/daily-closure",
    "get",
    "Daily snapshot closure readiness for the current actor.",
    "DailyClosureStatusResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/snapshots/runs/needs-action",
    "get",
    "Paginated snapshot runs requiring operator action.",
    "SnapshotNeedsActionResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/snapshots/runs/{snapshotRunId}",
    "get",
    "Snapshot run detail with output row counts and rerun state.",
    "SnapshotRunDetailResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/snapshots/runs/{snapshotRunId}/dependencies",
    "get",
    "Snapshot run rerun dependency checks.",
    "SnapshotRunDependenciesResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/snapshots/runs/{snapshotRunId}/lineage",
    "get",
    "Snapshot run rerun parent and child lineage.",
    "SnapshotRunLineageResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/snapshots/runs/{snapshotRunId}/audit",
    "get",
    "Snapshot run audit event timeline.",
    "SnapshotRunAuditResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/workforce/seller-code-reference",
    "get",
    "Latest franchise seller code reference and next preview.",
    "WorkforceSellerCodeReferenceResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/workforce/position-options",
    "get",
    "Store position options available for workforce requests.",
    "WorkforcePositionOptionsResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/workforce/store-employees",
    "get",
    "Active store employees available for offboarding requests.",
    "WorkforceStoreEmployeesResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/workforce/seller-code-requests",
    "get",
    "Paginated seller code requests visible to workforce reviewers.",
    "WorkforceSellerCodeRequestsResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/workforce/offboarding-requests",
    "get",
    "Paginated employee offboarding requests visible to workforce reviewers.",
    "WorkforceOffboardingRequestsResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/reports/summary",
    "get",
    "Reporting summary with latest completed snapshot and row count cards.",
    "ReportingSummaryResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/reports/snapshot-runs",
    "get",
    "Paginated reporting snapshot runs available for reporting surfaces.",
    "ReportingSnapshotRunsResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/reports/kpi-config",
    "get",
    "Published KPI score profile, ownership matrix, grading bands, and version metadata.",
    "ReportingKpiConfigResponse",
  );

  setJsonRequestSchema(
    document.paths,
    "/api/reports/kpi-config",
    "patch",
    "ReportingKpiConfigDraftRequest",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/reports/kpi-config",
    "patch",
    "Draft and published KPI config editor state after saving a draft.",
    "ReportingKpiConfigEditorResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/reports/kpi-config/editor",
    "get",
    "Draft and published KPI config editor state for admin review.",
    "ReportingKpiConfigEditorResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/reports/kpi-config/audit",
    "get",
    "Paginated KPI config audit events for admin governance.",
    "ReportingKpiConfigAuditResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/reports/kpi-config/publish",
    "patch",
    "Draft and published KPI config editor state after publishing a draft.",
    "ReportingKpiConfigEditorResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/reports/workforce",
    "get",
    "Paginated workforce snapshot rows for reporting surfaces.",
    "ReportingWorkforceResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/reports/kpis",
    "get",
    "Paginated KPI snapshot rows for reporting surfaces.",
    "ReportingKpiResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/reports/my-performance",
    "get",
    "Current actor personnel performance summary for live or closed reporting.",
    "ReportingPerformanceResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/reports/personnel-performance/{employeeId}",
    "get",
    "Target personnel performance summary visible to authorized reviewers.",
    "ReportingPerformanceResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/reports/store-kpi-highlights",
    "get",
    "Store KPI highlight summary for live reporting surfaces.",
    "ReportingStoreKpiHighlightsResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/reports/store-score-breakdown",
    "get",
    "Store monthly score blend breakdown for a closed snapshot.",
    "ReportingStoreScoreBreakdownResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/reports/rankings",
    "get",
    "Live monthly store and personnel rankings visible to the current actor.",
    "ReportingRankingsResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/reports/leaderboards/closed",
    "get",
    "Closed daily or monthly personnel leaderboard for store users.",
    "ReportingClosedLeaderboardResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/reports/checklists",
    "get",
    "Paginated checklist snapshot rows for reporting surfaces.",
    "ReportingChecklistResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/reports/turnover",
    "get",
    "Paginated turnover snapshot rows for reporting surfaces.",
    "ReportingTurnoverResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/lookups",
    "get",
    "Auth admin lookup options for user, role, permission, and store forms.",
    "AuthLookupsResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/lookups/users/search",
    "get",
    "Active user lookup search results for auth admin forms.",
    "AuthUserLookupSearchResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/lookups/stores/search",
    "get",
    "Active store lookup search results for auth admin forms.",
    "AuthStoreLookupSearchResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/roles",
    "get",
    "Paginated auth role catalog with granted permissions.",
    "AuthRoleCatalogResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/permissions",
    "get",
    "Paginated auth permission catalog.",
    "AuthPermissionCatalogResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/roles/{roleId}/permissions",
    "post",
    "Command result with the granted auth role permission.",
    "AuthRolePermissionCommandResponse",
    "201",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/roles/{roleId}/permissions/{permissionCode}",
    "delete",
    "Command result with the revoked auth role permission.",
    "AuthRolePermissionCommandResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/users",
    "get",
    "Paginated auth user accounts visible to auth admins.",
    "AuthUserAccountsResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/users",
    "post",
    "Command result with the created auth user account.",
    "AuthUserAccountCommandResponse",
    "201",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/pilot-user-bindings",
    "post",
    "Command result with the created pilot user binding.",
    "AuthPilotUserBindingCommandResponse",
    "201",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/users/{userId}/deactivate",
    "patch",
    "Command result with the deactivated auth user account and closed access summary.",
    "AuthUserDeactivationCommandResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/users/{userId}/reactivate",
    "patch",
    "Command result with the reactivated auth user account.",
    "AuthUserAccountCommandResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/role-assignments",
    "get",
    "Paginated auth role assignments visible to auth admins.",
    "AuthRoleAssignmentsResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/role-assignments",
    "post",
    "Command result with the created auth role assignment.",
    "AuthRoleAssignmentCommandResponse",
    "201",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/role-assignments/{assignmentId}/deactivate",
    "patch",
    "Command result with the deactivated auth role assignment.",
    "AuthRoleAssignmentCommandResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/action-store-assignments",
    "get",
    "Paginated auth action-store assignments visible to auth admins.",
    "AuthActionStoreAssignmentsResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/action-store-assignments",
    "post",
    "Command result with the created auth action-store assignment.",
    "AuthActionStoreAssignmentCommandResponse",
    "201",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/action-store-assignments/{assignmentId}/deactivate",
    "patch",
    "Command result with the deactivated auth action-store assignment.",
    "AuthActionStoreAssignmentCommandResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/users/{userId}/audit",
    "get",
    "Paginated auth user account audit events.",
    "AuthAuditResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/role-assignments/{assignmentId}/audit",
    "get",
    "Paginated auth role assignment audit events.",
    "AuthAuditResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/action-store-assignments/{assignmentId}/audit",
    "get",
    "Paginated auth action-store assignment audit events.",
    "AuthAuditResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/bootstrap",
    "get",
    "Auth mode and provider metadata needed before login.",
    "AuthBootstrapResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/auth/session",
    "get",
    "Current authenticated admin or store session summary.",
    "AuthSessionResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/integrations/import-payload-templates",
    "get",
    "Sample import payload template and canonical KPI contract for admin imports.",
    "ImportPayloadTemplateResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/integrations/import-batches/needs-action",
    "get",
    "Paginated import batches requiring admin action.",
    "ImportBatchNeedsActionResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/integrations/external-id-map-candidates",
    "get",
    "Paginated internal entity candidates for external id mapping.",
    "ExternalIdMapCandidatesResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/integrations/import-batches/{batchId}/errors",
    "get",
    "Paginated import batch row errors for admin remediation.",
    "ImportBatchErrorsResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/integrations/import-batches/{batchId}/audit",
    "get",
    "Import batch audit events for the admin detail timeline.",
    "ImportBatchAuditResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/integrations/import-batches/{batchId}/reconciliation",
    "get",
    "Import batch reconciliation rollup for admin detail evidence.",
    "ImportBatchReconciliationResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/integrations/import-batches/{batchId}",
    "get",
    "Import batch detail with row, dependency, quality, and lineage summaries.",
    "ImportBatchDetailResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/integrations/lookups",
    "get",
    "Integration lookup options for admin import and source management screens.",
    "IntegrationLookups",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/integrations/store-master-lookups",
    "get",
    "Store master lookup options for the admin master-data surface.",
    "StoreMasterLookups",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/integrations/store-master",
    "get",
    "Paginated store master data for the admin master-data surface.",
    "StoreMasterListResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/integrations/personnel-master-lookups",
    "get",
    "Personnel master lookup options for the admin master-data surface.",
    "PersonnelMasterLookups",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/integrations/personnel-master",
    "get",
    "Paginated personnel master data for the admin master-data surface.",
    "PersonnelMasterListResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/integrations/master-data-bootstrap/batches",
    "get",
    "Paginated master data bootstrap batches with derived readiness.",
    "MasterDataBootstrapBatchesResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/integrations/master-data-bootstrap/batches/{batchId}/promotion-readiness",
    "get",
    "Master data bootstrap promotion dry-run readiness for a batch.",
    "MasterDataBootstrapPromotionReadinessResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/integrations/master-data-bootstrap/batches/{batchId}",
    "get",
    "Master data bootstrap batch detail with staged row evidence.",
    "MasterDataBootstrapBatchDetailResponse",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/mobile/checklists/today",
    "get",
    "Mobile checklist dashboard data for the current actor.",
    "MobileChecklistTodayResponse",
  );

  const outputPath = resolve(process.cwd(), "../../docs/api/openapi.json");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);

  await app.close();
}

void generateOpenApi();

function countProperties(propertyNames: string[]) {
  return Object.fromEntries(
    propertyNames.map((propertyName) => [
      propertyName,
      { type: "integer", minimum: 0 },
    ]),
  );
}

function nullableStringProperties(propertyNames: string[]) {
  return Object.fromEntries(
    propertyNames.map((propertyName) => [
      propertyName,
      { type: "string", nullable: true },
    ]),
  );
}

function commandResponseSchema(dataSchema: Record<string, unknown>) {
  return {
    type: "object",
    required: ["command", "data"],
    properties: {
      command: {
        type: "object",
        required: ["status", "message"],
        properties: {
          status: { type: "string" },
          message: { type: "string" },
        },
      },
      data: dataSchema,
    },
  };
}

function setJsonRequestSchema(
  paths: Record<string, unknown>,
  path: string,
  method: string,
  schemaName: string,
) {
  const operation = (paths[path] as MutablePathItem | undefined)?.[method];
  if (!operation) {
    return;
  }

  operation.requestBody = {
    required: true,
    content: {
      "application/json": {
        schema: {
          $ref: `#/components/schemas/${schemaName}`,
        },
      },
    },
  };
}

function setJsonResponseSchema(
  paths: Record<string, unknown>,
  path: string,
  method: string,
  description: string,
  schemaName: string,
  status = "200",
) {
  const operation = (paths[path] as MutablePathItem | undefined)?.[method];
  if (!operation) {
    return;
  }

  operation.responses = {
    ...(operation.responses ?? {}),
    [status]: {
      description,
      content: {
        "application/json": {
          schema: {
            $ref: `#/components/schemas/${schemaName}`,
          },
        },
      },
    },
  };
}
