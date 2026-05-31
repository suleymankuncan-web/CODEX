type MutableOperation = {
  parameters?: Array<Record<string, unknown>>;
  requestBody?: Record<string, unknown>;
  responses?: Record<string, Record<string, unknown>>;
};

type MutablePathItem = Record<string, MutableOperation | undefined>;

type MutableOpenApiDocument = {
  components?: {
    schemas?: Record<string, unknown>;
  };
  paths: Record<string, unknown>;
};

const pilotFeedbackSchema = {
  type: "object",
  required: [
    "feedbackId",
    "actorUserId",
    "actorRoleCodes",
    "feedbackType",
    "severitySuggestion",
    "routePath",
    "pageTitle",
    "title",
    "description",
    "status",
    "classification",
    "classifiedByUserId",
    "classifiedAt",
    "classificationNote",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    feedbackId: { type: "string" },
    actorUserId: { type: "string" },
    actorRoleCodes: {
      type: "array",
      items: { type: "string" },
    },
    feedbackType: {
      type: "string",
      enum: ["bug", "friction", "idea", "data_quality", "other"],
    },
    severitySuggestion: { type: "string", enum: ["p0", "p1", "p2", "p3"] },
    routePath: { type: "string" },
    pageTitle: { type: "string", nullable: true },
    title: { type: "string" },
    description: { type: "string" },
    status: { type: "string", enum: ["new", "triaged", "parked", "resolved"] },
    classification: {
      type: "string",
      enum: ["p0_stop", "p1_pilot_blocker", "p2_pilot_friction", "p3_backlog"],
      nullable: true,
    },
    classifiedByUserId: { type: "string", nullable: true },
    classifiedAt: { type: "string", nullable: true },
    classificationNote: { type: "string", nullable: true },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const pilotFeedbackCommandResponseSchema = commandResponseSchema({
  type: "object",
  required: ["feedback"],
  properties: {
    feedback: { $ref: "#/components/schemas/PilotFeedback" },
  },
});

const pilotFeedbackListResponseSchema = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: { $ref: "#/components/schemas/PilotFeedback" },
    },
    meta: {
      type: "object",
      required: ["count", "total", "limit", "offset"],
      properties: {
        count: { type: "integer", minimum: 0 },
        total: { type: "integer", minimum: 0 },
        limit: { type: "integer", minimum: 0 },
        offset: { type: "integer", minimum: 0 },
      },
    },
  },
};

export function applyPilotFeedbackOpenApi(document: MutableOpenApiDocument) {
  document.components = document.components ?? {};
  document.components.schemas = {
    ...(document.components.schemas ?? {}),
    PilotFeedback: pilotFeedbackSchema,
    PilotFeedbackCommandResponse: pilotFeedbackCommandResponseSchema,
    PilotFeedbackListResponse: pilotFeedbackListResponseSchema,
    CreatePilotFeedbackRequest: {
      type: "object",
      required: [
        "feedbackType",
        "severitySuggestion",
        "routePath",
        "title",
        "description",
      ],
      properties: {
        feedbackType: {
          type: "string",
          enum: ["bug", "friction", "idea", "data_quality", "other"],
        },
        severitySuggestion: {
          type: "string",
          enum: ["p0", "p1", "p2", "p3"],
        },
        routePath: { type: "string", maxLength: 300 },
        pageTitle: { type: "string", maxLength: 160 },
        title: { type: "string", maxLength: 160 },
        description: { type: "string", maxLength: 4000 },
      },
    },
    ClassifyPilotFeedbackRequest: {
      type: "object",
      required: ["classification"],
      properties: {
        classification: {
          type: "string",
          enum: ["p0_stop", "p1_pilot_blocker", "p2_pilot_friction", "p3_backlog"],
        },
        note: { type: "string", maxLength: 2000 },
      },
    },
  };

  setJsonRequestSchema(document.paths, "/api/pilot-feedback", "post", "CreatePilotFeedbackRequest");
  setJsonResponseSchema(
    document.paths,
    "/api/pilot-feedback",
    "post",
    "Command result with the recorded pilot feedback.",
    "PilotFeedbackCommandResponse",
    "201",
  );
  setJsonResponseSchema(
    document.paths,
    "/api/admin/pilot-feedback",
    "get",
    "Paginated pilot feedback items for controlled pilot triage.",
    "PilotFeedbackListResponse",
  );
  setJsonQueryParameters(document.paths, "/api/admin/pilot-feedback", "get", [
    {
      name: "status",
      schema: { type: "string", enum: ["new", "triaged", "parked", "resolved"] },
    },
    {
      name: "classification",
      schema: {
        type: "string",
        enum: ["p0_stop", "p1_pilot_blocker", "p2_pilot_friction", "p3_backlog"],
      },
    },
    {
      name: "limit",
      schema: { type: "integer", minimum: 1, maximum: 100 },
    },
    {
      name: "offset",
      schema: { type: "integer", minimum: 0 },
    },
  ]);
  setJsonRequestSchema(
    document.paths,
    "/api/admin/pilot-feedback/{feedbackId}/classification",
    "patch",
    "ClassifyPilotFeedbackRequest",
  );
  setJsonResponseSchema(
    document.paths,
    "/api/admin/pilot-feedback/{feedbackId}/classification",
    "patch",
    "Command result with the classified pilot feedback.",
    "PilotFeedbackCommandResponse",
  );
}

function commandResponseSchema(dataSchema: Record<string, unknown>) {
  return {
    type: "object",
    required: ["command", "data"],
    properties: {
      command: {
        type: "object",
        required: ["status", "message"],
        properties: {
          status: { type: "string" },
          message: { type: "string" },
        },
      },
      data: dataSchema,
    },
  };
}

function setJsonQueryParameters(
  paths: Record<string, unknown>,
  path: string,
  method: string,
  parameters: Array<{ name: string; schema: Record<string, unknown> }>,
) {
  const operation = (paths[path] as MutablePathItem | undefined)?.[method];
  if (!operation) {
    return;
  }

  const existingParameters = operation.parameters ?? [];
  const queryParameterNames = new Set(parameters.map((parameter) => parameter.name));
  operation.parameters = [
    ...existingParameters.filter(
      (parameter) => !queryParameterNames.has(String(parameter.name)),
    ),
    ...parameters.map((parameter) => ({
      name: parameter.name,
      required: false,
      in: "query",
      schema: parameter.schema,
    })),
  ];
}

function setJsonRequestSchema(
  paths: Record<string, unknown>,
  path: string,
  method: string,
  schemaName: string,
) {
  const operation = (paths[path] as MutablePathItem | undefined)?.[method];
  if (!operation) {
    return;
  }

  operation.requestBody = {
    required: true,
    content: {
      "application/json": {
        schema: {
          $ref: `#/components/schemas/${schemaName}`,
        },
      },
    },
  };
}

function setJsonResponseSchema(
  paths: Record<string, unknown>,
  path: string,
  method: string,
  description: string,
  schemaName: string,
  status = "200",
) {
  const operation = (paths[path] as MutablePathItem | undefined)?.[method];
  if (!operation) {
    return;
  }

  operation.responses = {
    ...(operation.responses ?? {}),
    [status]: {
      description,
      content: {
        "application/json": {
          schema: {
            $ref: `#/components/schemas/${schemaName}`,
          },
        },
      },
    },
  };
}
