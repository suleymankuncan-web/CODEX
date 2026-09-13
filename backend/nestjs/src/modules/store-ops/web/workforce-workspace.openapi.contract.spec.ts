import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Workforce Workspace OpenAPI", () => {
  it("publishes bounded paging, entry/exit history and exact mutation capabilities", () => {
    const document = JSON.parse(readFileSync(resolve(process.cwd(), "../../docs/api/openapi.json"), "utf8")) as any;
    const operation = document.paths["/api/store/workforce/workspace"].get;
    expect(operation.responses["200"].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/WorkforceWorkspaceResponse",
    });
    expect(operation.parameters.map((parameter: { name: string }) => parameter.name).sort()).toEqual([
      "regionManagerUserId", "q", "status", "sort", "direction", "limit", "offset", "historyLimit", "historyOffset", "historyStoreId",
      "personnelStoreId", "personnelLimit", "personnelOffset",
    ].sort());
    expect(document.components.schemas.WorkforceWorkspaceCapabilities.properties).toEqual({
      canCreateSellerCodeRequest: { type: "boolean" },
      canCreateOffboardingRequest: { type: "boolean" },
    });
    expect(document.components.schemas.WorkforceWorkspacePerson.properties).not.toHaveProperty("score");
    expect(document.components.schemas.WorkforceWorkspaceStore.properties.norm).toEqual({ type: "number", nullable: true });
    expect(document.components.schemas.WorkforceWorkspaceStore.properties.averageTenureDays).toEqual({ type: "number", nullable: true });
    expect(document.components.schemas.WorkforceWorkspaceHistoryRow.properties).toEqual(expect.objectContaining({
      entryDate: { type: "string", format: "date" },
      exitDate: { type: "string", format: "date", nullable: true },
      totalWorkingDays: { type: "integer", nullable: true },
    }));
  });
});
