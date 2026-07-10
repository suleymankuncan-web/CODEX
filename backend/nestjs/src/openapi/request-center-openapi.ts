import { setJsonResponseSchema } from "./openapi-schema-helpers";

const requestCenterItemSchema = {
  type: "object",
  required: [
    "requestId",
    "requestType",
    "storeId",
    "storeName",
    "status",
    "updatedAt",
    "targetLabel",
    "requestMonth",
    "allocationCount",
    "approvalMode",
    "personDisplayName",
    "nationalIdLast4",
    "externalEmployeeRef",
  ],
  properties: {
    requestId: { type: "string" },
    requestType: {
      type: "string",
      enum: ["target", "sellerCode", "offboarding"],
    },
    storeId: { type: "string" },
    storeName: { type: "string", nullable: true },
    status: { type: "string" },
    updatedAt: { type: "string" },
    targetLabel: { type: "string", nullable: true },
    requestMonth: { type: "string", nullable: true },
    allocationCount: { type: "integer", minimum: 0, nullable: true },
    approvalMode: {
      type: "string",
      enum: ["direct", "adjusted"],
      nullable: true,
    },
    personDisplayName: { type: "string", nullable: true },
    nationalIdLast4: { type: "string", nullable: true },
    externalEmployeeRef: { type: "string", nullable: true },
  },
};

export function createRequestCenterResponseSchema(listResponseMetaSchema: object) {
  return {
    type: "object",
    required: ["items", "meta", "summary"],
    properties: {
      items: {
        type: "array",
        items: requestCenterItemSchema,
      },
      meta: listResponseMetaSchema,
      summary: {
        type: "object",
        required: ["open", "done", "returned"],
        properties: {
          open: { type: "integer", minimum: 0 },
          done: { type: "integer", minimum: 0 },
          returned: { type: "integer", minimum: 0 },
        },
      },
    },
  };
}

export function applyBoundedTargetQueueResponses(
  paths: Record<string, unknown>,
) {
  setJsonResponseSchema(
    paths,
    "/api/target-distributions/requests",
    "get",
    "Target distribution approval requests visible to the current actor.",
    "TargetDistributionRequestsResponse",
  );
  setJsonResponseSchema(
    paths,
    "/api/target-distributions/coverage",
    "get",
    "Target distribution coverage rows and summary visible to the current actor.",
    "TargetCoverageResponse",
  );
  setJsonResponseSchema(
    paths,
    "/api/target-distributions/store-personnel",
    "get",
    "Store personnel available for target distribution requests.",
    "StoreTargetingPersonnelResponse",
  );
  setJsonResponseSchema(
    paths,
    "/api/workflow/request-center",
    "get",
    "Bounded target and workforce request ledger visible to the current actor.",
    "RequestCenterResponse",
  );
}
