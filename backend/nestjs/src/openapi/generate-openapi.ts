import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "../app.module";

type MutableOperation = {
  parameters?: Array<Record<string, unknown>>;
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

function setJsonResponseSchema(
  paths: Record<string, unknown>,
  path: string,
  method: string,
  description: string,
  schemaName: string,
) {
  const operation = (paths[path] as MutablePathItem | undefined)?.[method];

  if (!operation) {
    return;
  }

  operation.responses = {
    ...(operation.responses ?? {}),
    "200": {
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
