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
    ImportOverview: importOverviewSchema,
    ImportBatchNeedsActionResponse: importBatchNeedsActionResponseSchema,
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
    "/api/integrations/import-batches/needs-action",
    "get",
    "Paginated import batches requiring admin action.",
    "ImportBatchNeedsActionResponse",
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
