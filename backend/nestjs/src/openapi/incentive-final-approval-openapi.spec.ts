import { applyIncentiveFinalApprovalOpenApi } from "./incentive-final-approval-openapi";

describe("individual incentive approval API contract", () => {
  it("publishes response schemas, period filtering and individual assignment permission", () => {
    const assignment = { type: "object", properties: { assignmentId: { type: "string" }, roleCode: { type: "string" } } };
    const document = { components: { schemas: { AuthRoleAssignmentsResponse: { properties: { items: { items: assignment } } }, AuthRoleAssignmentCommandResponse: { properties: { data: { properties: { assignment } } } } } }, paths: { "/api/store/incentives/final-approval": { get: {}, post: {} }, "/api/auth/role-assignments/{assignmentId}/incentive-approval": { patch: {} } } };
    applyIncentiveFinalApprovalOpenApi(document);
    expect(assignment.properties).toHaveProperty("incentiveApproval", expect.objectContaining({ type: "boolean", default: false }));
    expect(document.paths["/api/store/incentives/final-approval"].post).toHaveProperty("responses.201.content.application/json.schema.$ref", "#/components/schemas/IncentiveFinalApprovalResult");
    expect(document.paths["/api/store/incentives/final-approval"].get).toHaveProperty("parameters", [expect.objectContaining({ name: "period", schema: expect.objectContaining({ pattern: "^\\d{4}-(0[1-9]|1[0-2])$" }) })]);
  });
});
