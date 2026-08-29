import {
  commandResponseSchema,
  countProperties,
  setJsonResponseSchema,
} from "./openapi-schema-helpers";

type JsonSchema = Record<string, unknown>;

export const masterDataQualityIssueItemSchema = {
  type: "object",
  required: [
    "id",
    "issueCode",
    "severity",
    "entityType",
    "entityId",
    "entityLabel",
    "secondaryLabel",
    "problemLabel",
    "recommendedAction",
    "affectedModules",
    "lastSeenAt",
    "source",
  ],
  properties: {
    id: { type: "string" },
    issueCode: { type: "string" },
    severity: { type: "string", enum: ["critical", "warning", "info"] },
    entityType: {
      type: "string",
      enum: ["store", "personnel", "assignment", "import"],
    },
    entityId: { type: "string" },
    entityLabel: { type: "string" },
    secondaryLabel: { type: "string", nullable: true },
    problemLabel: { type: "string" },
    recommendedAction: { type: "string" },
    affectedModules: { type: "array", items: { type: "string" } },
    lastSeenAt: { type: "string" },
    source: { type: "string" },
  },
};

export const masterDataQualityIssueSeveritySummarySchema = {
  type: "object",
  required: ["critical", "warning", "info"],
  properties: countProperties(["critical", "warning", "info"]),
};

export const masterDataQualityIssueEntitySummarySchema = {
  type: "object",
  required: ["store", "personnel", "assignment", "import"],
  properties: countProperties(["store", "personnel", "assignment", "import"]),
};

export const masterDataQualityIssueSummarySchema = {
  type: "object",
  required: ["severity", "entityType"],
  properties: {
    severity: masterDataQualityIssueSeveritySummarySchema,
    entityType: masterDataQualityIssueEntitySummarySchema,
  },
};

export const masterDataQualityAuditItemSchema = {
  type: "object",
  required: [
    "eventId",
    "eventType",
    "entityType",
    "entityId",
    "entityLabel",
    "actorLabel",
    "occurredAt",
    "summary",
    "metadata",
  ],
  properties: {
    eventId: { type: "string" },
    eventType: { type: "string" },
    entityType: { type: "string", enum: ["store", "personnel", "import"] },
    entityId: { type: "string", nullable: true },
    entityLabel: { type: "string" },
    actorLabel: { type: "string" },
    occurredAt: { type: "string" },
    summary: { type: "string" },
    metadata: {
      type: "object",
      additionalProperties: true,
    },
  },
};

export function createMasterDataCommandResponseSchemas(input: {
  storeMasterItemSchema: JsonSchema;
  personnelMasterItemSchema: JsonSchema;
}) {
  return {
    storeMasterCommandResponseSchema: commandResponseSchema({
      type: "object",
      required: ["storeMaster"],
      properties: {
        storeMaster: input.storeMasterItemSchema,
      },
    }),
    personnelMasterCommandResponseSchema: commandResponseSchema({
      type: "object",
      required: ["personnelMaster"],
      properties: {
        personnelMaster: input.personnelMasterItemSchema,
      },
    }),
  };
}

export function applyMasterDataResponseSchemas(paths: Record<string, unknown>) {
  setJsonResponseSchema(
    paths,
    "/api/integrations/store-master-lookups",
    "get",
    "Store master lookup options for the admin master-data surface.",
    "StoreMasterLookups",
  );

  setJsonResponseSchema(
    paths,
    "/api/integrations/store-master",
    "get",
    "Paginated store master data for the admin master-data surface.",
    "StoreMasterListResponse",
  );

  setJsonResponseSchema(
    paths,
    "/api/integrations/store-master",
    "post",
    "Created store master data for the admin master-data surface.",
    "StoreMasterCommandResponse",
    "201",
  );

  setJsonResponseSchema(
    paths,
    "/api/integrations/store-master/{storeId}",
    "patch",
    "Updated store master data for the admin master-data surface.",
    "StoreMasterCommandResponse",
  );

  setJsonResponseSchema(
    paths,
    "/api/integrations/personnel-master-lookups",
    "get",
    "Personnel master lookup options for the admin master-data surface.",
    "PersonnelMasterLookups",
  );

  setJsonResponseSchema(
    paths,
    "/api/integrations/personnel-master",
    "get",
    "Paginated personnel master data for the admin master-data surface.",
    "PersonnelMasterListResponse",
  );

  setJsonResponseSchema(
    paths,
    "/api/integrations/personnel-master",
    "post",
    "Created personnel master data for the admin master-data surface.",
    "PersonnelMasterCommandResponse",
    "201",
  );

  setJsonResponseSchema(
    paths,
    "/api/integrations/personnel-master/{employeeId}",
    "patch",
    "Updated personnel master data for the admin master-data surface.",
    "PersonnelMasterCommandResponse",
  );

  setJsonResponseSchema(
    paths,
    "/api/integrations/personnel-master/{employeeId}/terminate",
    "patch",
    "Personnel exit result with linked access closed.",
    "PersonnelMasterCommandResponse",
  );
}
