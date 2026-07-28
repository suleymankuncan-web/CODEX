import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("VM reference management OpenAPI contract", () => {
  const document = JSON.parse(
    readFileSync(resolve(process.cwd(), "../../docs/api/openapi.json"), "utf8"),
  ) as any;

  it("[FR-08][AC-07] exposes publisher draft, immutable publish, and lifecycle commands", () => {
    expect(document.paths["/api/visual-merchandising/references"].post).toBeDefined();
    expect(document.paths["/api/visual-merchandising/references/options"].get).toBeDefined();
    expect(document.paths["/api/visual-merchandising/references/{referenceSetId}/publish"].post).toBeDefined();
    expect(document.paths["/api/visual-merchandising/references/{referenceSetId}/revisions"].post).toBeDefined();
    expect(document.paths["/api/visual-merchandising/references/{referenceSetId}/assignments/{assignmentId}/commands"].post).toBeDefined();
    expect(document.paths["/api/visual-merchandising/references/{referenceSetId}/retire"].post).toBeDefined();
    expect(document.components.schemas.VmCampaignRevisionResponse.additionalProperties).toBe(false);
    expect(document.components.schemas.VmCampaignAssignmentCommandResponse.additionalProperties).toBe(false);
    expect(document.components.schemas.VmReferenceRetireResponse.additionalProperties).toBe(false);
  });

  it("[FR-15][AC-15] exposes exact assignment-bound multi-item submission", () => {
    expect(document.paths["/api/mobile/visual-campaigns/{assignmentId}/submissions"].post).toBeDefined();
    const body = document.components.schemas.SubmitVmCampaignDto;
    expect(body.properties.items.minItems).toBe(1);
    expect(body.properties.expectedVersion.minimum).toBe(0);
    expect(document.components.schemas.VmCampaignAssignment.properties.items.type).toBe("array");
    expect(document.components.schemas.VmCampaignSubmissionResponse.additionalProperties).toBe(false);
  });

  it("[AC-02] exposes reviewer reads separately from publisher management reads", () => {
    expect(document.paths["/api/visual-merchandising/references/campaigns"].get).toBeDefined();
    expect(document.paths["/api/visual-merchandising/references/managed-campaigns"].get).toBeDefined();
  });
});
