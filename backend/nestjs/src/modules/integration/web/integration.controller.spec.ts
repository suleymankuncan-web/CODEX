import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("IntegrationController upload hardening", () => {
  it("limits Power BI multipart uploads, including nested field names", () => {
    const source = readFileSync(
      join(__dirname, "integration.controller.ts"),
      "utf8",
    );

    expect(source).toContain("fileSize: POWER_BI_EXPORT_MAX_FILE_BYTES");
    expect(source).toContain("fieldNestingDepth: 1");
  });

  it("keeps master data quality reads behind the existing admin company boundary", () => {
    const source = readFileSync(
      join(__dirname, "integration-master-data-quality.controller.ts"),
      "utf8",
    );

    expect(source).toMatch(
      /@Get\("issues"\)[\s\S]*?@RequireScope\("company"\)[\s\S]*?@RequireRoles\("HR_ADMIN", "SUPER_ADMIN", "INTEGRATION_ADMIN"\)/,
    );
    expect(source).toMatch(
      /@Get\("audit"\)[\s\S]*?@RequireScope\("company"\)[\s\S]*?@RequireRoles\("HR_ADMIN", "SUPER_ADMIN", "INTEGRATION_ADMIN"\)/,
    );
  });
});
