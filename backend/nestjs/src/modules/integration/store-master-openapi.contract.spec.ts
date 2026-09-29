import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Schema = { required?: string[]; properties?: Record<string, unknown> };
type Document = { components?: { schemas?: Record<string, Schema> } };

describe("store master OpenAPI completion", () => {
  it("publishes optional bounded contacts and ingest evidence", () => {
    const document = JSON.parse(readFileSync(resolve(__dirname, "../../../../../docs/api/openapi.json"), "utf8")) as Document;
    const schemas = document.components?.schemas ?? {};
    const listItems = schemas.StoreMasterListResponse?.properties?.items as {
      items?: { properties?: Record<string, unknown> };
    } | undefined;
    expect(listItems?.items?.properties).toEqual(expect.objectContaining({
      contactEmails: expect.any(Object), ingestStatus: expect.any(Object),
      matchedSourceCount: expect.any(Object), activeSourceCount: expect.any(Object),
      lastSuccessfulKpiDate: expect.any(Object),
    }));
    expect(schemas.CreateStoreMasterDto?.properties?.contactEmails).toEqual(expect.objectContaining({ maxItems: 10 }));
    expect(schemas.CreateStoreMasterDto?.required).not.toContain("contactEmails");
    expect(schemas.UpdateStoreMasterDto?.properties?.contactEmails).toEqual(expect.objectContaining({ maxItems: 10 }));
  });
});
