import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const document = JSON.parse(readFileSync(
  resolve(process.cwd(), "../../docs/api/openapi.json"), "utf8",
));

describe("store master code OpenAPI contract", () => {
  it("exposes code and effective ownership date only on the store-master command", () => {
    expect(document.paths["/api/integrations/store-master/{storeId}"].patch.requestBody.content["application/json"].schema)
      .toEqual({ $ref: "#/components/schemas/UpdateStoreMasterDto" });
    expect(document.components.schemas.UpdateStoreMasterDto.properties.storeCode.pattern)
      .toBe("^[A-Z][A-Z0-9_-]{1,79}$");
    expect(document.components.schemas.UpdateStoreMasterDto.properties.storeTypeEffectiveOn)
      .toBeDefined();
    expect(document.paths["/api/integrations/kpi-import-store-scope/{storeId}"].patch.requestBody.content["application/json"].schema)
      .toEqual({ $ref: "#/components/schemas/UpdateKpiImportStoreScopeDto" });
  });
});
