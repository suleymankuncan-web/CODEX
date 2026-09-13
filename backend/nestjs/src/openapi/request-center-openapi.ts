import { setJsonResponseSchema } from "./openapi-schema-helpers";

export const targetRevisionBasisResponseSchema = {
  type: "object",
  required: ["storeId", "requestMonth", "periodClosed", "items"],
  properties: {
    storeId: { type: "string" },
    requestMonth: { type: "string" },
    periodClosed: { type: "boolean" },
    items: {
      type: "array",
      items: {
        type: "object",
        required: ["employeeId", "targetReferenceId", "displayName", "targetValue"],
        properties: {
          employeeId: { type: "string" },
          targetReferenceId: { type: "string" },
          displayName: { type: "string" },
          targetValue: { type: "number" },
        },
      },
    },
  },
};

const requestCenterItemSchema = {
  type: "object",
  required: [
    "requestId",
    "requestType",
    "storeId",
            "storeName",
            "regionId",
            "regionName",
            "regionManagerNames",
    "status",
    "createdAt",
    "updatedAt",
    "waitingSince",
    "nextOwner",
    "dueAt",
    "isOverdue",
            "events",
            "eventTotal",
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
      enum: ["target", "sellerCode", "offboarding", "personnelCorrection"],
    },
    storeId: { type: "string" },
            storeName: { type: "string", nullable: true },
            regionId: { type: "string", format: "uuid" },
            regionName: { type: "string", nullable: true },
            regionManagerNames: { type: "array", items: { type: "string" } },
    status: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string" },
    waitingSince: { type: "string", format: "date-time", nullable: true },
    nextOwner: {
      type: "string",
      enum: ["store", "region", "hr", "system"],
      nullable: true,
    },
    dueAt: { type: "string", format: "date-time", nullable: true },
    isOverdue: { type: "boolean", nullable: true },
            events: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        required: ["eventId", "type", "occurredAt", "actorDisplayName"],
        properties: {
          eventId: { type: "string" },
          type: { type: "string", enum: ["created", "approved", "returned", "resubmitted"] },
          occurredAt: { type: "string", format: "date-time" },
          actorDisplayName: { type: "string", nullable: true },
        },
      },
    },
    eventTotal: { type: "integer", minimum: 0 },
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
        required: ["open", "done", "returned", "overdue", "periods"],
        properties: {
          open: { type: "integer", minimum: 0 },
          done: { type: "integer", minimum: 0 },
          returned: { type: "integer", minimum: 0 },
          overdue: { type: "integer", minimum: 0 },
          periods: {
            type: "array",
            items: { type: "string", pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$" },
          },
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
    "/api/target-distributions/revision-basis",
    "get",
    "Complete active target reference basis for an exact store and month.",
    "TargetRevisionBasisResponse",
  );
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
