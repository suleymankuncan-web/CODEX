type MutableOperation = {
  requestBody?: Record<string, unknown>;
  responses?: Record<string, Record<string, unknown>>;
};

type MutablePathItem = Record<string, MutableOperation | undefined>;

type MutableOpenApiDocument = {
  components?: {
    schemas?: Record<string, unknown>;
  };
  paths: Record<string, unknown>;
};

const storeActionPlanSourceTypeEnum = ["kpi_exception", "checklist_remediation"];

const storeActionPlanSchema = {
  type: "object",
  required: [
    "actionPlanId",
    "companyId",
    "regionId",
    "storeId",
    "storeName",
    "ownerUserId",
    "ownerDisplayName",
    "createdByUserId",
    "sourceType",
    "sourceId",
    "sourceDeepLink",
    "sourceSnapshotRunId",
    "sourceKpiId",
    "title",
    "summary",
    "priority",
    "status",
    "dueOn",
    "resolutionNote",
    "closedByUserId",
    "closedAt",
    "cancelReason",
    "cancelledByUserId",
    "cancelledAt",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    actionPlanId: { type: "string" },
    companyId: { type: "string" },
    regionId: { type: "string" },
    storeId: { type: "string" },
    storeName: { type: "string", nullable: true },
    ownerUserId: { type: "string" },
    ownerDisplayName: { type: "string", nullable: true },
    createdByUserId: { type: "string" },
    sourceType: { type: "string", enum: storeActionPlanSourceTypeEnum },
    sourceId: { type: "string" },
    sourceDeepLink: { type: "string", nullable: true },
    sourceSnapshotRunId: { type: "string", nullable: true },
    sourceKpiId: { type: "string", nullable: true },
    title: { type: "string" },
    summary: { type: "string", nullable: true },
    priority: { type: "string", enum: ["high", "medium", "low"] },
    status: {
      type: "string",
      enum: ["open", "in_progress", "blocked", "closed", "cancelled"],
    },
    dueOn: { type: "string" },
    resolutionNote: { type: "string", nullable: true },
    closedByUserId: { type: "string", nullable: true },
    closedAt: { type: "string", nullable: true },
    cancelReason: { type: "string", nullable: true },
    cancelledByUserId: { type: "string", nullable: true },
    cancelledAt: { type: "string", nullable: true },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const storeActionPlanListResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: storeActionPlanSchema,
    },
    meta: {
      type: "object",
      required: ["count", "total", "limit", "offset"],
      properties: {
        count: { type: "integer", minimum: 0 },
        total: { type: "integer", minimum: 0 },
        limit: { type: "integer", minimum: 0 },
        offset: { type: "integer", minimum: 0 },
      },
    },
  },
};

const storeActionPlanDetailResponseSchema = {
  type: "object",
  required: ["data"],
  properties: {
    data: {
      type: "object",
      required: ["plan"],
      properties: {
        plan: storeActionPlanSchema,
      },
    },
  },
};

const storeActionPlanCommandResponseSchema = commandResponseSchema({
  type: "object",
  required: ["plan"],
  properties: {
    plan: storeActionPlanSchema,
  },
});

export function applyStoreActionPlanOpenApi(document: MutableOpenApiDocument) {
  document.components = document.components ?? {};
  document.components.schemas = {
    ...(document.components.schemas ?? {}),
    StoreActionPlan: storeActionPlanSchema,
    StoreActionPlanListResponse: storeActionPlanListResponseSchema,
    StoreActionPlanDetailResponse: storeActionPlanDetailResponseSchema,
    StoreActionPlanCommandResponse: storeActionPlanCommandResponseSchema,
    CreateStoreActionPlanRequest: {
      type: "object",
      required: ["storeId", "sourceType", "sourceId", "title", "priority", "dueOn"],
      properties: {
        storeId: { type: "string" },
        sourceType: { type: "string", enum: storeActionPlanSourceTypeEnum },
        sourceId: { type: "string" },
        sourceDeepLink: { type: "string" },
        sourceSnapshotRunId: { type: "string" },
        sourceKpiId: { type: "string" },
        title: { type: "string" },
        summary: { type: "string" },
        priority: { type: "string", enum: ["high", "medium", "low"] },
        dueOn: { type: "string" },
      },
    },
    UpdateStoreActionPlanStatusRequest: {
      type: "object",
      required: ["status"],
      properties: {
        status: { type: "string", enum: ["open", "in_progress", "blocked"] },
        note: { type: "string" },
      },
    },
    CloseStoreActionPlanRequest: {
      type: "object",
      required: ["resolutionNote"],
      properties: {
        resolutionNote: { type: "string" },
      },
    },
    CancelStoreActionPlanRequest: {
      type: "object",
      required: ["cancelReason"],
      properties: {
        cancelReason: { type: "string" },
      },
    },
  };

  setJsonResponseSchema(
    document.paths,
    "/api/store-actions/plans",
    "get",
    "Paginated store action plans visible inside the current actor action-store assignments.",
    "StoreActionPlanListResponse",
  );
  setJsonResponseSchema(
    document.paths,
    "/api/store-actions/plans/{actionPlanId}",
    "get",
    "Store action plan detail visible inside the current actor action-store assignments.",
    "StoreActionPlanDetailResponse",
  );
  setJsonRequestSchema(
    document.paths,
    "/api/store-actions/plans",
    "post",
    "CreateStoreActionPlanRequest",
  );
  setJsonResponseSchema(
    document.paths,
    "/api/store-actions/plans",
    "post",
    "Command result with the created store action plan.",
    "StoreActionPlanCommandResponse",
    "201",
  );
  setJsonRequestSchema(
    document.paths,
    "/api/store-actions/plans/{actionPlanId}/status",
    "patch",
    "UpdateStoreActionPlanStatusRequest",
  );
  setJsonResponseSchema(
    document.paths,
    "/api/store-actions/plans/{actionPlanId}/status",
    "patch",
    "Command result with the updated store action plan status.",
    "StoreActionPlanCommandResponse",
  );
  setJsonRequestSchema(
    document.paths,
    "/api/store-actions/plans/{actionPlanId}/close",
    "patch",
    "CloseStoreActionPlanRequest",
  );
  setJsonResponseSchema(
    document.paths,
    "/api/store-actions/plans/{actionPlanId}/close",
    "patch",
    "Command result with the closed store action plan.",
    "StoreActionPlanCommandResponse",
  );
  setJsonRequestSchema(
    document.paths,
    "/api/store-actions/plans/{actionPlanId}/cancel",
    "patch",
    "CancelStoreActionPlanRequest",
  );
  setJsonResponseSchema(
    document.paths,
    "/api/store-actions/plans/{actionPlanId}/cancel",
    "patch",
    "Command result with the cancelled store action plan.",
    "StoreActionPlanCommandResponse",
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
