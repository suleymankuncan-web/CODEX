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
});
