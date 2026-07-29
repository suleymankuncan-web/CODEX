import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Checklist acknowledgement OpenAPI", () => {
  it.each([
    "/api/checklists/instances/{checklistInstanceId}/acknowledge",
    "/api/mobile/checklists/instances/{checklistInstanceId}/acknowledge",
  ])("publishes typed acknowledgement and remediation outcomes for %s", (path) => {
    const document = JSON.parse(
      readFileSync(resolve(process.cwd(), "../../docs/api/openapi.json"), "utf8"),
    ) as any;
    const schema = document.paths[path].post.responses["201"].content["application/json"].schema;
    const data = schema.properties.data;

    expect(data.required).toEqual(expect.arrayContaining(["acknowledgement", "remediation"]));
    expect(data.properties.remediation.properties.status.enum).toEqual([
      "created", "duplicate", "zero_findings", "blocked",
    ]);
    expect(data.properties.remediation.required).toEqual([
      "status", "createdCount", "duplicateCount", "blockedCount",
    ]);
  });
});
