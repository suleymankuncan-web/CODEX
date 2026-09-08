import { setJsonRequestSchema, setJsonResponseSchema } from "./openapi-schema-helpers";

export function applyPersonnelCorrectionOpenApi(document: {
  components?: { schemas?: Record<string, unknown> }; paths: Record<string, unknown>;
}) {
  const text = { type: "string" };
  const uuid = { type: "string", format: "uuid" };
  const nullableText = { type: "string", nullable: true };
  const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
  const object = (properties: Record<string, unknown>) => ({ type: "object", required: Object.keys(properties), properties });
  const values = object({ firstName: text, lastName: text, phoneNumber: text,
    hireDate: { type: "string", format: "date" }, employmentType: { type: "string", enum: ["full_time", "part_time", "temporary"] }, positionId: uuid });
  const row = object({ request_id: uuid, company_id: uuid, region_id: uuid, store_id: uuid,
    employee_id: uuid, assignment_id: uuid, employee_revision: text, assignment_revision: text,
    previous_values: ref("PersonnelCorrectionValues"), proposed_values: ref("PersonnelCorrectionValues"),
    request_reason: text, request_status: { type: "string", enum: ["pending_hr_approval", "approved", "rejected"] },
    submitted_by_user_id: uuid, reviewed_by_user_id: { ...uuid, nullable: true },
    review_note: nullableText, reviewed_at: nullableText, created_at: text, updated_at: text });
  document.components ??= {};
  document.components.schemas = { ...document.components.schemas,
    PersonnelCorrectionValues: values,
    PersonnelCorrection: row,
    PersonnelCorrectionList: object({ items: { type: "array", items: {
      ...row, required: [...row.required, "store_name", "previous_position_name", "proposed_position_name"],
      properties: { ...row.properties, store_name: text, previous_position_name: nullableText, proposed_position_name: nullableText },
    } } }),
    PersonnelCorrectionPersonnel: object({ employeeId: uuid, storeId: uuid, revision: text,
      values: ref("PersonnelCorrectionValues"), positions: { type: "array", items: object({ positionId: uuid, positionName: text }) } }),
    CreatePersonnelCorrectionDto: object({ storeId: uuid, employeeId: uuid, expectedRevision: text,
      proposed: ref("PersonnelCorrectionValues"), reason: { type: "string", minLength: 1, maxLength: 500 } }),
    ReviewPersonnelCorrectionDto: object({ decision: { type: "string", enum: ["approve", "reject"] }, note: { type: "string", minLength: 1, maxLength: 500 } }),
  };
  const base = "/api/workforce/personnel-corrections";
  setJsonResponseSchema(document.paths, base, "get", "Scoped personnel corrections.", "PersonnelCorrectionList");
  setJsonResponseSchema(document.paths, `${base}/personnel/{employeeId}/stores/{storeId}`, "get", "Current editable personnel and revision.", "PersonnelCorrectionPersonnel");
  setJsonRequestSchema(document.paths, base, "post", "CreatePersonnelCorrectionDto");
  setJsonResponseSchema(document.paths, base, "post", "Staged correction; no personnel mutation.", "PersonnelCorrection", "201");
  setJsonRequestSchema(document.paths, `${base}/{requestId}/review`, "patch", "ReviewPersonnelCorrectionDto");
  setJsonResponseSchema(document.paths, `${base}/{requestId}/review`, "patch", "Atomic HR decision.", "PersonnelCorrection");
}
