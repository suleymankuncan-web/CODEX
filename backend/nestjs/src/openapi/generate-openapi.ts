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
    IntegrationLookups: integrationLookupsSchema,
    MasterDataBootstrapBatchesResponse: masterDataBootstrapBatchesResponseSchema,
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
    "/api/integrations/lookups",
    "get",
    "Integration lookup options for admin import and source management screens.",
    "IntegrationLookups",
  );

  setJsonResponseSchema(
    document.paths,
    "/api/integrations/master-data-bootstrap/batches",
    "get",
    "Paginated master data bootstrap batches with derived readiness.",
    "MasterDataBootstrapBatchesResponse",
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
