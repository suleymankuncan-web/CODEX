import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("OpenAPI revision and list metadata contracts", () => {
  const document = JSON.parse(
    readFileSync(resolve(process.cwd(), "../../docs/api/openapi.json"), "utf8"),
  ) as {
    components?: {
      schemas?: Record<
        string,
        { properties?: Record<string, unknown>; required?: string[] }
      >;
    };
  };

  it("documents fail-closed revisions for mutable paginated exports", () => {
    const revisionSchema = {
      type: "string",
      nullable: true,
      minLength: 64,
      maxLength: 64,
      pattern: "^[0-9a-f]{64}$",
    };

    for (const schemaName of [
      "ImportBatchNeedsActionResponse",
      "ImportBatchErrorsResponse",
      "SnapshotNeedsActionResponse",
    ]) {
      const metaSchema = document.components?.schemas?.[schemaName]?.properties?.meta;

      expect(metaSchema).toEqual(
        expect.objectContaining({
          required: expect.arrayContaining([
            "count",
            "total",
            "limit",
            "offset",
            "revision",
          ]),
          properties: expect.objectContaining({ revision: revisionSchema }),
        }),
      );
    }
  });
});
