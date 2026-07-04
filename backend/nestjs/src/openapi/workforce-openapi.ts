import { setJsonResponseSchema, setQueryParameters } from "./openapi-schema-helpers";

type MutableOpenApiDocument = {
  paths: Record<string, unknown>;
};

export function applyWorkforceOpenApi(document: MutableOpenApiDocument) {
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
  setQueryParameters(document.paths, "/api/workforce/seller-code-requests", "get", [
    workforceRequestStatusQueryParameter(),
    queryParameter("storeId", { type: "string" }),
    queryParameter("limit", { type: "integer", minimum: 1, maximum: 100 }),
    queryParameter("offset", { type: "integer", minimum: 0 }),
  ]);

  setJsonResponseSchema(
    document.paths,
    "/api/workforce/offboarding-requests",
    "get",
    "Paginated employee offboarding requests visible to workforce reviewers.",
    "WorkforceOffboardingRequestsResponse",
  );
  setQueryParameters(document.paths, "/api/workforce/offboarding-requests", "get", [
    workforceRequestStatusQueryParameter(),
    queryParameter("storeId", { type: "string" }),
    queryParameter("limit", { type: "integer", minimum: 1, maximum: 100 }),
    queryParameter("offset", { type: "integer", minimum: 0 }),
  ]);
}

function queryParameter(name: string, schema: Record<string, unknown>) {
  return {
    name,
    in: "query",
    required: false,
    schema,
  };
}

function workforceRequestStatusQueryParameter() {
  return queryParameter("status", {
    type: "string",
    enum: ["pending_hr_approval", "approved", "rejected"],
  });
}
