import { setJsonResponseSchema, setQueryParameters } from "./openapi-schema-helpers";

type Document = { components?: { schemas?: Record<string, unknown> }; paths: Record<string, unknown> };
const nullable = { type: "string", nullable: true };
const uuid = { type: "string", format: "uuid" };
const object = (properties: Record<string, unknown>) => ({ type: "object", required: Object.keys(properties), properties });

export function applyIncentiveFinalApprovalOpenApi(document: Document) {
  const schemas = document.components!.schemas!;
  const properties = {
    companyId: uuid, managerUserId: uuid, managerName: { type: "string" }, regionPackageId: { ...uuid, nullable: true },
    submittedByUserId: nullable, submittedByName: nullable,
    submittedAt: { ...nullable, format: "date-time" }, reviewedByUserId: nullable, reviewedByName: nullable,
    reviewedAt: { ...nullable, format: "date-time" }, reviewNote: nullable,
    status: { type: "string", enum: ["not_submitted", "submitted", "admin_approved", "admin_returned"] },
    ...Object.fromEntries(["storeCount", "reviewedStoreCount", "submittedStoreCount", "draftCorrectionCount", "submittedCorrectionCount"].map(key => [key, { type: "integer", minimum: 0 }])),
  };
  schemas.IncentiveFinalApprovalPackages = object({ items: { type: "array", items: object(properties) } });
  schemas.IncentiveFinalApprovalResult = object({ data: object({ regionPackageId: uuid, status: { type: "string", enum: ["admin_approved", "admin_returned"] }, reviewedAt: { type: "string", format: "date-time", nullable: true } }) });
  schemas.SubmitSalesTargetIncentiveRegionPackageDto = { type: "object", required: ["period"], properties: { period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" }, companyId: uuid, submissionNote: { type: "string", minLength: 1, maxLength: 1000 } } };
  schemas.ApproveFinalIncentivePackageDto = { type: "object", required: ["period", "regionPackageId", "submittedAt"], properties: { period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" }, regionPackageId: uuid, submittedAt: { type: "string", format: "date-time" }, decision: { type: "string", enum: ["approve", "return"] }, reviewNote: { type: "string", maxLength: 1000 } } };
  const path = "/api/store/incentives/final-approval";
  setJsonResponseSchema(document.paths, path, "get", "Company-scoped packages for explicitly authorized Report Viewers.", "IncentiveFinalApprovalPackages");
  setJsonResponseSchema(document.paths, path, "post", "Approve or return the exact submitted package. Return requires a note; omitted decision preserves approval behavior.", "IncentiveFinalApprovalResult", "201");
  setQueryParameters(document.paths, path, "get", [{ name: "period", in: "query", required: false, schema: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" } }]);
  schemas.IncentiveHrHandoff = object({
    period: { type: "string" }, version: { type: "string" }, allApproved: { type: "boolean" }, mailConfigured: { type: "boolean" }, canSend: { type: "boolean" },
    companies: { type: "array", items: object({ companyId: uuid, companyName: { type: "string" }, recipients: { type: "array", items: { type: "string", format: "email" } },
      managerPackageCount: { type: "integer" }, approvedPackageCount: { type: "integer" }, storeCount: { type: "integer" }, personnelCount: { type: "integer" }, totalAmount: { type: "string" },
      status: { type: "string", enum: ["not_sent", "sending", "sent", "uncertain"] }, sentAt: { ...nullable, format: "date-time" } }) },
  });
  const hrPath = "/api/store/incentives/hr-handoff";
  setJsonResponseSchema(document.paths, hrPath, "get", "Full authorized company-period HR email preview; UI filters do not limit this scope.", "IncentiveHrHandoff");
  setJsonResponseSchema(document.paths, hrPath, "post", "Send approved packages as company-separated Excel attachments to server-configured HR recipients exactly once per period.", "IncentiveHrHandoff", "201");
  setQueryParameters(document.paths, hrPath, "get", [{ name: "period", in: "query", required: false, schema: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" } }]);
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
