import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Sales Target Incentive Workspace OpenAPI", () => {
  it("publishes the additive read-only workspace and sanitized correction actor", () => {
    const document = JSON.parse(
      readFileSync(resolve(process.cwd(), "../../docs/api/openapi.json"), "utf8"),
    ) as any;
    const operation = document.paths["/api/store/incentives/workspace"].get;
    expect(operation.responses["200"].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/SalesTargetIncentiveWorkspaceResponse",
    });
    expect(operation.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "period", in: "query" }),
    ]));
    const capabilities = document.components.schemas.SalesTargetIncentiveWorkspaceCapabilities;
    expect(Object.keys(capabilities.properties)).toEqual([
      "canMarkStoreReview", "canCreateCorrection", "canVoidCorrection", "canSubmitPackage",
    ]);
    const actor = document.components.schemas.SalesTargetIncentiveWorkspaceCorrectionActor;
    expect(Object.keys(actor.properties)).toEqual(["displayName", "roleCode", "identityStatus"]);
    expect(JSON.stringify(actor)).not.toMatch(/userId|username|email/i);
    const correction = document.components.schemas.SalesTargetIncentiveWorkspaceCorrection;
    expect(correction.properties.status.enum).toEqual([
      "draft", "submitted", "admin_approved", "admin_returned", "voided",
    ]);
    const row = document.components.schemas.SalesTargetIncentiveWorkspaceRow;
    expect(row.properties.target.pattern).toBe("^-?\\d+(?:\\.\\d+)?$");
    expect(row.properties.actual.pattern).toBe("^-?\\d+(?:\\.\\d+)?$");
    expect(row.properties.calculatedAmount.pattern).toBe("^-?\\d+(?:\\.\\d{2})?$");
    expect(document.components.schemas.SalesTargetIncentiveWorkspaceStore.required).toContain("capabilities");
    expect(document.components.schemas.SalesTargetIncentiveWorkspaceRegion.required).toContain("capabilities");
    expect(document.components.schemas.SalesTargetIncentiveWorkspace.required).toContain("sections");
    expect(document.components.schemas.SalesTargetIncentiveWorkspaceSections.required).toEqual([
      "core", "storeMetadata", "rateMetadata", "correctionActors",
    ]);
  });
});
