type Operation = { responses?: Record<string, unknown> };
type Document = {
  components?: { schemas?: Record<string, unknown> };
  paths: unknown;
};

const reference = {
  type: "object",
  required: ["referenceSetId", "companyId", "referenceCode", "referenceName", "instructions", "status", "version", "createdAt", "updatedAt", "retiredAt"],
  properties: {
    referenceSetId: { type: "string", format: "uuid" },
    companyId: { type: "string", format: "uuid" },
    referenceCode: { type: "string" }, referenceName: { type: "string" },
    instructions: { type: "string" }, status: { type: "string", enum: ["draft", "scheduled", "open", "closed", "retired"] },
    version: { type: "integer", minimum: 0 }, createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" }, retiredAt: { type: "string", format: "date-time", nullable: true },
  },
};

const campaignItem = {
  type: "object",
  required: ["referenceItemId", "templateItemId", "expectedVisualIntent", "reviewInstructions", "requiredEvidenceCount", "referenceAssetId"],
  properties: {
    referenceItemId: { type: "string", format: "uuid" }, templateItemId: { type: "string", format: "uuid" },
    expectedVisualIntent: { type: "string" }, reviewInstructions: { type: "string" },
    requiredEvidenceCount: { type: "integer", enum: [1] }, referenceAssetId: { type: "string", format: "uuid" },
  },
};

const assignment = {
  type: "object",
  required: ["assignmentId", "storeId", "storeName", "referenceSetId", "referenceName", "deadlineStatus", "reviewStatus", "version", "startsAt", "submissionClosesAt", "items"],
  properties: {
    assignmentId: { type: "string", format: "uuid" }, storeId: { type: "string", format: "uuid" }, storeName: { type: "string" },
    referenceSetId: { type: "string", format: "uuid" }, referenceName: { type: "string" },
    deadlineStatus: { type: "string", enum: ["scheduled", "open", "on_time", "missed", "exempt", "withdrawn", "operational_hold"] },
    reviewStatus: { type: "string", enum: ["not_submitted", "review_pending", "correction_requested", "completed"] },
    version: { type: "integer", minimum: 0 }, startsAt: { type: "string", format: "date-time" },
    submissionClosesAt: { type: "string", format: "date-time" }, items: { type: "array", items: campaignItem },
  },
};

export function applyVmReferenceManagementOpenApi(document: Document) {
  const schemas = document.components?.schemas;
  if (!schemas) return;
  schemas.VmReference = reference;
  schemas.VmReferenceListResponse = page(reference);
  schemas.VmCampaignAssignment = assignment;
  schemas.VmCampaignAssignmentListResponse = page(assignment);
  schemas.VmReferencePublishResponse = objectSchema([
    "referenceSetId", "referenceVersionId", "campaignRevisionId", "status",
    "startsAt", "submissionClosesAt", "assignedStoreCount",
  ], {
    referenceSetId: uuid(), referenceVersionId: uuid(), campaignRevisionId: uuid(),
    status: campaignStatus(), startsAt: dateTime(), submissionClosesAt: dateTime(),
    assignedStoreCount: { type: "integer", minimum: 1 },
  });
  schemas.VmCampaignRevisionResponse = objectSchema([
    "referenceSetId", "campaignRevisionId", "revision", "status", "assignedStoreCount",
  ], {
    referenceSetId: uuid(), campaignRevisionId: uuid(), revision: { type: "integer", minimum: 1 },
    status: campaignStatus(), assignedStoreCount: { type: "integer", minimum: 1 },
  });
  schemas.VmCampaignAssignmentCommandResponse = objectSchema([
    "assignmentId", "deadlineStatus", "version",
  ], {
    assignmentId: uuid(), deadlineStatus: assignment.properties.deadlineStatus,
    version: { type: "integer", minimum: 1 },
  });
  schemas.VmReferenceRetireResponse = objectSchema(["referenceSetId", "status"], {
    referenceSetId: uuid(), status: { type: "string", enum: ["retired"] },
  });
  schemas.VmCampaignSubmissionResponse = objectSchema([
    "assignmentId", "submissionId", "deadlineStatus", "reviewStatus", "version",
  ], {
    assignmentId: uuid(), submissionId: uuid(), deadlineStatus: { type: "string", enum: ["on_time"] },
    reviewStatus: { type: "string", enum: ["review_pending"] }, version: { type: "integer", minimum: 1 },
  });
  schemas.VmReferenceDraftItemResponse = { type: "object", required: ["draftItemId", "version"], properties: {
    draftItemId: { type: "string", format: "uuid" }, version: { type: "integer", minimum: 1 },
  } };
  schemas.VmReferenceSignedRead = { type: "object", required: ["url", "expiresInSeconds"], properties: {
    url: { type: "string", format: "uri" }, expiresInSeconds: { type: "integer", minimum: 1 },
  } };
  schemas.VmReferencePublisherOptions = { type: "object", required: ["stores", "templates"], properties: {
    stores: { type: "array", items: { type: "object", required: ["storeId", "storeName"], properties: {
      storeId: { type: "string", format: "uuid" }, storeName: { type: "string" },
    } } },
    templates: { type: "array", items: { type: "object", required: ["templateId", "templateName", "items"], properties: {
      templateId: { type: "string", format: "uuid" }, templateName: { type: "string" },
      items: { type: "array", items: { type: "object", required: ["templateItemId", "sectionName", "itemNo", "itemText"], properties: {
        templateItemId: { type: "string", format: "uuid" }, sectionName: { type: "string" },
        itemNo: { type: "integer" }, itemText: { type: "string" },
      } } },
    } } },
  } };
  setResponse(document, "/api/visual-merchandising/references", "get", 200, "VmReferenceListResponse");
  setResponse(document, "/api/visual-merchandising/references", "post", 201, "VmReference");
  setResponse(document, "/api/visual-merchandising/references/options", "get", 200, "VmReferencePublisherOptions");
  setResponse(document, "/api/visual-merchandising/references/{referenceSetId}/draft/items/{templateItemId}", "post", 201, "VmReferenceDraftItemResponse");
  setResponse(document, "/api/visual-merchandising/references/{referenceSetId}/publish", "post", 201, "VmReferencePublishResponse");
  setResponse(document, "/api/mobile/visual-campaigns", "get", 200, "VmCampaignAssignmentListResponse");
  setResponse(document, "/api/mobile/visual-campaigns/{assignmentId}/items/{referenceItemId}/reference-read-url", "post", 201, "VmReferenceSignedRead");
  setBinaryResponse(document, "/api/mobile/visual-campaigns/{assignmentId}/items/{referenceItemId}/reference-content/{variant}", "get", 200);
  setResponse(document, "/api/visual-merchandising/references/campaigns", "get", 200, "VmCampaignAssignmentListResponse");
  setResponse(document, "/api/visual-merchandising/references/managed-campaigns", "get", 200, "VmCampaignAssignmentListResponse");
  setResponse(document, "/api/visual-merchandising/references/{referenceSetId}/revisions", "post", 201, "VmCampaignRevisionResponse");
  setResponse(document, "/api/visual-merchandising/references/{referenceSetId}/assignments/{assignmentId}/commands", "post", 201, "VmCampaignAssignmentCommandResponse");
  setResponse(document, "/api/visual-merchandising/references/{referenceSetId}/retire", "post", 201, "VmReferenceRetireResponse");
  setResponse(document, "/api/mobile/visual-campaigns/{assignmentId}/submissions", "post", 201, "VmCampaignSubmissionResponse");
}

function objectSchema(required: string[], properties: Record<string, unknown>) {
  return { type: "object", additionalProperties: false, required, properties };
}

function uuid() { return { type: "string", format: "uuid" }; }
function dateTime() { return { type: "string", format: "date-time" }; }
function campaignStatus() { return { type: "string", enum: ["scheduled", "open", "closed"] }; }

function setBinaryResponse(document: Document, path: string, method: string, status: number) {
  const paths = document.paths as Record<string, Record<string, Operation | undefined>>;
  const operation = paths[path]?.[method];
  if (!operation) return;
  operation.responses ??= {};
  operation.responses[String(status)] = { description: "Image content", content: {
    "image/webp": { schema: { type: "string", format: "binary" } },
  } };
}

function page(item: Record<string, unknown>) {
  return { type: "object", required: ["items", "total", "limit", "offset"], properties: {
    items: { type: "array", items: item }, total: { type: "integer", minimum: 0 },
    limit: { type: "integer", minimum: 1 }, offset: { type: "integer", minimum: 0 },
  } };
}

function setResponse(document: Document, path: string, method: string, status: number, schema: string) {
  const paths = document.paths as Record<string, Record<string, Operation | undefined>>;
  const operation = paths[path]?.[method];
  if (!operation) return;
  operation.responses ??= {};
  operation.responses[String(status)] = { description: "Success", content: {
    "application/json": { schema: { $ref: `#/components/schemas/${schema}` } },
  } };
}
