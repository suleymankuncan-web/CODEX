type MutableOperation = {
  parameters?: Array<Record<string, unknown>>;
  requestBody?: Record<string, unknown>;
  responses?: Record<string, Record<string, unknown>>;
  security?: Array<Record<string, string[]>>;
};

export type MutablePathItem = Record<string, MutableOperation | undefined>;

export function countProperties(propertyNames: string[]) {
  return Object.fromEntries(
    propertyNames.map((propertyName) => [
      propertyName,
      { type: "integer", minimum: 0 },
    ]),
  );
}

export function nullableStringProperties(propertyNames: string[]) {
  return Object.fromEntries(
    propertyNames.map((propertyName) => [
      propertyName,
      { type: "string", nullable: true },
    ]),
  );
}

export function commandResponseSchema(dataSchema: Record<string, unknown>) {
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

export function setJsonRequestSchema(
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

export function setJsonResponseSchema(
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
