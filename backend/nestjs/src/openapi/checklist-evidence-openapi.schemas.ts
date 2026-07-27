export const mobileChecklistEvidenceTemplateItemProperties = {
  evidencePolicy: { type: "string", enum: ["none", "optional", "required"] },
  maxEvidenceCount: { type: "integer", minimum: 0, maximum: 10 },
};

export const mobileChecklistEvidenceActiveInstanceProperties = {
  evidenceVersion: { type: "integer", minimum: 0 },
  evidence: {
    type: "array",
    items: {
      type: "object",
      required: ["templateItemId", "mediaAssetId", "displayOrder", "captureSource", "thumbnailAvailable"],
      properties: {
        templateItemId: { type: "string" }, mediaAssetId: { type: "string" },
        displayOrder: { type: "integer", minimum: 0 },
        captureSource: { type: "string", enum: ["camera", "gallery", "system_generated"] },
        thumbnailAvailable: { type: "boolean" },
      },
    },
  },
};

export const mobileChecklistEvidenceTodayProperties = {
  evidenceCapabilities: {
    type: "object",
    required: ["captureAvailable", "syntheticFixtureOnly", "unavailableReason"],
    properties: {
      captureAvailable: { type: "boolean" }, syntheticFixtureOnly: { type: "boolean" },
      unavailableReason: {
        type: "string",
        enum: ["feature_disabled", "storage_unavailable", "synthetic_fixture_unavailable"],
        nullable: true,
      },
    },
  },
};
