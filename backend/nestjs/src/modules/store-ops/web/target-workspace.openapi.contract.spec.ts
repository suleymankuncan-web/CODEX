import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Traceability: TGT-FR-001..007, NFR-006/007, AC-TGT-001/003/006, EC-003..009.

describe("Targets Workspace OpenAPI", () => {
  it("publishes the additive hierarchy, persisted month truth and exact capabilities", () => {
    const document = JSON.parse(readFileSync(resolve(process.cwd(), "../../docs/api/openapi.json"), "utf8")) as any;
    const operation = document.paths["/api/store/targets/workspace"].get;
    expect(operation.responses["200"].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/TargetWorkspaceResponse",
    });
    expect(operation.parameters.map((parameter: { name: string }) => parameter.name).sort()).toEqual([
      "historyYear", "limit", "offset", "period", "regionManagerUserId",
    ]);
    expect(JSON.stringify(operation.parameters)).not.toMatch(/companyId|regionId|storeId/);
    expect(document.components.schemas.TargetWorkspaceCapabilities.properties).toEqual({
      canCreateRequest: { type: "boolean" }, canApproveRequest: { type: "boolean" },
    });
    expect(document.components.schemas.TargetWorkspaceMonthStatus.properties.status.enum).toEqual([
      "pending", "approved", "adjusted_approved", "returned", "unknown",
    ]);
    expect(document.components.schemas.TargetWorkspaceMonthStatus.properties.approvalStatus.enum).toEqual([
      "approved", "adjusted_approved",
    ]);
    expect(document.components.schemas.TargetWorkspaceRegionManager.properties.identityStatus.enum).toEqual([
      "resolved", "unassigned", "unavailable",
    ]);
    expect(document.components.schemas.TargetWorkspaceStore.properties.status.enum).toEqual([
      "pending", "approved", "adjusted_approved", "returned", "revision_conflict",
      "stale_reference", "missing", "unknown",
    ]);
    expect(document.components.schemas.TargetWorkspacePersonnel.required).toContain("positionLabel");
    expect(document.components.schemas.TargetWorkspace.required).toEqual(expect.arrayContaining([
      "sections", "warnings", "summary",
    ]));
    expect(document.components.schemas.TargetWorkspace.properties.summary.nullable).toBe(true);
    expect(document.components.schemas.TargetWorkspace.properties.warnings.items.enum).toEqual([
      "hierarchy_unavailable", "summary_unavailable", "personnel_unavailable",
      "month_statuses_unavailable", "approval_basis_conflict",
    ]);
    expect(document.components.schemas.TargetWorkspace.properties.companies).toEqual({
      type: "array", items: { $ref: "#/components/schemas/TargetWorkspaceCompany" },
    });
  });
});
