type MutableOperation = {
  parameters?: Array<Record<string, unknown>>;
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
const storeActionPlanStatusEnum = ["open", "in_progress", "blocked", "solution_review_pending", "correction_required", "closed", "cancelled"];

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
    "photoEvidenceVersion",
    "currentSolutionAttemptId",
    "resolutionWorkflowVersion",
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
      enum: storeActionPlanStatusEnum,
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
    photoEvidenceVersion: { type: "integer", minimum: 0 },
    currentSolutionAttemptId: { type: "string", nullable: true },
    resolutionWorkflowVersion: { type: "integer", enum: [1, 2] },
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
    SubmitStoreActionSolutionRequest: {
      type: "object",
      required: ["resolutionNote", "mediaAssetId", "idempotencyKey", "expectedVersion"],
      properties: {
        resolutionNote: { type: "string", minLength: 1, maxLength: 500 },
        mediaAssetId: { type: "string", format: "uuid" },
        idempotencyKey: { type: "string", format: "uuid" },
        expectedVersion: { type: "integer", minimum: 0 },
      },
    },
    ReviewStoreActionSolutionRequest: {
      type: "object",
      required: ["solutionAttemptId", "decision", "idempotencyKey", "expectedVersion"],
      properties: {
        solutionAttemptId: { type: "string", format: "uuid" },
        decision: { type: "string", enum: ["approve", "reject"] },
        reason: { type: "string", maxLength: 500 },
        idempotencyKey: { type: "string", format: "uuid" },
        expectedVersion: { type: "integer", minimum: 0 },
      },
    },
    StoreActionPhotoReviewProjection: {
      type: "object",
      required: ["actionPlanId", "status", "version", "currentAttemptId", "findingMediaAssetIds", "attempts"],
      properties: {
        actionPlanId: { type: "string", format: "uuid" },
        status: { type: "string", enum: storeActionPlanStatusEnum },
        version: { type: "integer", minimum: 0 },
        currentAttemptId: { type: "string", format: "uuid", nullable: true },
        findingMediaAssetIds: { type: "array", items: { type: "string", format: "uuid" } },
        attempts: { type: "array", items: { type: "object", additionalProperties: true } },
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
  setQueryParameters(document.paths, "/api/store-actions/plans", "get", [
    queryParameter("storeId", { type: "string" }),
    queryParameter("status", { type: "string", enum: storeActionPlanStatusEnum }),
    {
      name: "statuses",
      in: "query",
      required: false,
      style: "form",
      explode: true,
      schema: {
        type: "array",
        items: { type: "string", enum: storeActionPlanStatusEnum },
      },
    },
    queryParameter("periodStart", { type: "string", format: "date" }),
    queryParameter("periodEnd", { type: "string", format: "date" }),
    queryParameter("limit", { type: "integer", minimum: 1, maximum: 100 }),
    queryParameter("offset", { type: "integer", minimum: 0 }),
  ]);
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
  setJsonResponseSchema(document.paths, "/api/store-actions/plans/{actionPlanId}/photo-review", "get",
    "Scoped Store Action solution attempt and immutable review history.", "StoreActionPhotoReviewProjection");
  setJsonRequestSchema(document.paths, "/api/store-actions/plans/{actionPlanId}/solution-attempts", "post",
    "SubmitStoreActionSolutionRequest");
  setJsonResponseSchema(document.paths, "/api/store-actions/plans/{actionPlanId}/solution-attempts", "post",
    "Solution submission awaiting Region Manager review.", "StoreActionPhotoReviewProjection", "201");
  setJsonRequestSchema(document.paths, "/api/store-actions/plans/{actionPlanId}/solution-attempts/{solutionAttemptId}/review", "post",
    "ReviewStoreActionSolutionRequest");
  setJsonResponseSchema(document.paths, "/api/store-actions/plans/{actionPlanId}/solution-attempts/{solutionAttemptId}/review", "post",
    "Region Manager solution review result.", "StoreActionPhotoReviewProjection", "201");
}

function queryParameter(name: string, schema: Record<string, unknown>) {
  return {
    name,
    in: "query",
    required: false,
    schema,
  };
}

function setQueryParameters(
  paths: Record<string, unknown>,
  path: string,
  method: string,
  parameters: Array<Record<string, unknown>>,
) {
  const operation = (paths[path] as MutablePathItem | undefined)?.[method];
  if (!operation) {
    return;
  }

  operation.parameters = [
    ...(operation.parameters ?? []).filter((parameter) => parameter.in !== "query"),
    ...parameters,
  ];
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
