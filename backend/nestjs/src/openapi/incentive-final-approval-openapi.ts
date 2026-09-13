import { setJsonResponseSchema, setQueryParameters } from "./openapi-schema-helpers";

type Document = { components?: { schemas?: Record<string, unknown> }; paths: Record<string, unknown> };
const nullable = { type: "string", nullable: true };
const uuid = { type: "string", format: "uuid" };
const object = (properties: Record<string, unknown>) => ({ type: "object", required: Object.keys(properties), properties });

export function applyIncentiveFinalApprovalOpenApi(document: Document) {
  const schemas = document.components!.schemas!;
  const properties = {
    regionId: uuid, regionName: nullable, regionPackageId: { ...uuid, nullable: true },
    regionManagerUserId: nullable, regionManagerName: nullable, submittedByUserId: nullable, submittedByName: nullable,
    submittedAt: { ...nullable, format: "date-time" }, reviewedByUserId: nullable, reviewedByName: nullable,
    reviewedAt: { ...nullable, format: "date-time" }, reviewNote: nullable,
    status: { type: "string", enum: ["not_submitted", "submitted", "admin_approved", "admin_returned"] },
    ...Object.fromEntries(["storeCount", "reviewedStoreCount", "submittedStoreCount", "draftCorrectionCount", "submittedCorrectionCount"].map(key => [key, { type: "integer", minimum: 0 }])),
  };
  schemas.IncentiveFinalApprovalPackages = object({ items: { type: "array", items: object(properties) } });
  schemas.IncentiveFinalApprovalResult = object({ data: object({ regionPackageId: uuid, status: { type: "string", enum: ["admin_approved"] }, reviewedAt: { type: "string", format: "date-time", nullable: true } }) });
  const path = "/api/store/incentives/final-approval";
  setJsonResponseSchema(document.paths, path, "get", "Company-scoped packages for explicitly authorized Report Viewers.", "IncentiveFinalApprovalPackages");
  setJsonResponseSchema(document.paths, path, "post", "Final approval of the exact submitted package.", "IncentiveFinalApprovalResult", "201");
  setQueryParameters(document.paths, path, "get", [{ name: "period", in: "query", required: false, schema: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" } }]);
  setJsonResponseSchema(document.paths, "/api/auth/role-assignments/{assignmentId}/incentive-approval", "patch", "Individual Report Viewer incentive approval permission updated.", "AuthRoleAssignmentCommandResponse");
  for (const name of ["AuthRoleAssignmentsResponse", "AuthRoleAssignmentCommandResponse"]) addIndividualGrant(schemas[name]);
}

function addIndividualGrant(value: unknown) {
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const properties = record.properties as Record<string, unknown> | undefined;
  if (properties?.assignmentId && properties?.roleCode) properties.incentiveApproval = { type: "boolean", default: false, description: "Individual company-scoped Report Viewer final incentive approval grant." };
  for (const child of Object.values(record)) addIndividualGrant(child);
}
