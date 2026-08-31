import { existsSync, readFileSync } from "node:fs";

export type OpenApiDocument = {
  paths: Record<string, unknown>;
  components?: {
    schemas?: Record<string, unknown>;
  };
} & Record<string, unknown>;

export function readExistingOpenApiDocument(
  outputPath: string,
): OpenApiDocument | null {
  if (!existsSync(outputPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(outputPath, "utf8")) as OpenApiDocument;
  } catch {
    return null;
  }
}

export function preserveOpenApiBaselineFromFile(
  document: unknown,
  outputPath: string,
) {
  const baselineDocument = readExistingOpenApiDocument(outputPath);
  if (!baselineDocument) {
    return;
  }

  preserveOpenApiBaseline(document as OpenApiDocument, baselineDocument);
}

export function preserveOpenApiBaseline(
  document: OpenApiDocument,
  baselineDocument: OpenApiDocument,
) {
  preserveBaselineSchemaMetadata(document, baselineDocument);
  preserveBaselineOperationMetadata(document, baselineDocument);
  pruneUnreferencedGeneratedSchemas(document, baselineDocument);
  orderDocumentLikeBaseline(document, baselineDocument);
}

function preserveBaselineSchemaMetadata(
  document: OpenApiDocument,
  baselineDocument: OpenApiDocument,
) {
  const generatedSchemas = document.components?.schemas;
  const baselineSchemas = baselineDocument.components?.schemas;
  if (!generatedSchemas || !baselineSchemas) {
    return;
  }

  for (const [schemaName, baselineSchema] of Object.entries(baselineSchemas)) {
    const generatedSchema = generatedSchemas[schemaName];
    if (shouldPreserveBaselineSchema(baselineSchema, generatedSchema)) {
      generatedSchemas[schemaName] = baselineSchema;
    }
  }
}

function shouldPreserveBaselineSchema(
  baselineSchema: unknown,
  generatedSchema: unknown,
) {
  if (!isRecord(baselineSchema)) {
    return false;
  }

  if (!generatedSchema) {
    return true;
  }

  if (!isRecord(generatedSchema)) {
    return false;
  }

  const baselineProperties = getSchemaProperties(baselineSchema);
  const generatedProperties = getSchemaProperties(generatedSchema);
  if (!baselineProperties || !generatedProperties) {
    return false;
  }

  const baselinePropertyNames = Object.keys(baselineProperties);
  const generatedPropertyNames = Object.keys(generatedProperties);
  if (baselinePropertyNames.length > generatedPropertyNames.length) {
    return generatedPropertyNames.every((propertyName) =>
      Object.prototype.hasOwnProperty.call(baselineProperties, propertyName),
    );
  }

  return usesSchemaReference(baselineSchema) && !usesSchemaReference(generatedSchema);
}

function preserveBaselineOperationMetadata(
  document: OpenApiDocument,
  baselineDocument: OpenApiDocument,
) {
  for (const [path, baselinePathItem] of Object.entries(
    baselineDocument.paths,
  )) {
    const generatedPathItem = document.paths[path];
    if (!isRecord(baselinePathItem) || !isRecord(generatedPathItem)) {
      continue;
    }

    for (const [method, baselineOperation] of Object.entries(baselinePathItem)) {
      const generatedOperation = generatedPathItem[method];
      if (!isRecord(baselineOperation) || !isRecord(generatedOperation)) {
        continue;
      }

      const mergedParameters = mergeBaselineParameters(
        baselineOperation.parameters,
        generatedOperation.parameters,
      );
      if (mergedParameters) {
        generatedOperation.parameters = mergedParameters;
      }

      if (
        isGeneratedObjectDegraded(
          baselineOperation.requestBody,
          generatedOperation.requestBody,
        )
      ) {
        generatedOperation.requestBody = baselineOperation.requestBody;
      }

      preserveBaselineResponses(baselineOperation, generatedOperation);
    }
  }
}

function preserveBaselineResponses(
  baselineOperation: Record<string, unknown>,
  generatedOperation: Record<string, unknown>,
) {
  const baselineResponses = baselineOperation.responses;
  const generatedResponses = generatedOperation.responses;
  if (!isRecord(baselineResponses) || !isRecord(generatedResponses)) {
    return;
  }

  for (const [status, baselineResponse] of Object.entries(baselineResponses)) {
    const generatedResponse = generatedResponses[status];
    if (!isRecord(baselineResponse) || !isRecord(generatedResponse)) {
      continue;
    }

        if (isGeneratedObjectDegraded(baselineResponse, generatedResponse)) {
          generatedResponses[status] = baselineResponse;
        }
  }
}

function mergeBaselineParameters(
  baselineParameters: unknown,
  generatedParameters: unknown,
) {
  if (
    !Array.isArray(baselineParameters) ||
    !Array.isArray(generatedParameters)
  ) {
    return null;
  }

  const generated = generatedParameters;
  const generatedByKey = new Map<string, unknown>();
  for (const parameter of generated) {
    const key = getParameterKey(parameter);
    if (key && !generatedByKey.has(key)) {
      generatedByKey.set(key, parameter);
    }
  }

  const merged: unknown[] = [];
  const emittedKeys = new Set<string>();
  for (const parameter of baselineParameters) {
    const key = getParameterKey(parameter);
    if (!key) {
      merged.push(parameter);
      continue;
    }

    if (emittedKeys.has(key)) {
      continue;
    }
    const generatedParameter = generatedByKey.get(key);
    merged.push(
      generatedParameter === undefined
        ? parameter
        : preserveBaselineEnumOrder(parameter, generatedParameter),
    );
    emittedKeys.add(key);
  }

  for (const parameter of generated) {
    const key = getParameterKey(parameter);
    if (key) {
      if (emittedKeys.has(key)) {
        continue;
      }
      emittedKeys.add(key);
    }
    merged.push(parameter);
  }

  return merged;
}

function preserveBaselineEnumOrder(
  baselineParameter: unknown,
  generatedParameter: unknown,
) {
  if (!isRecord(baselineParameter) || !isRecord(generatedParameter)) {
    return generatedParameter;
  }

  const baselineSchema = baselineParameter.schema;
  const generatedSchema = generatedParameter.schema;
  if (!isRecord(baselineSchema) || !isRecord(generatedSchema)) {
    return generatedParameter;
  }

  const baselineEnum = baselineSchema.enum;
  const generatedEnum = generatedSchema.enum;
  if (
    !Array.isArray(baselineEnum) ||
    !Array.isArray(generatedEnum) ||
    !haveSameEnumMembers(baselineEnum, generatedEnum)
  ) {
    return generatedParameter;
  }

  return {
    ...generatedParameter,
    schema: {
      ...generatedSchema,
      enum: [...baselineEnum],
    },
  };
}

function haveSameEnumMembers(
  baselineEnum: unknown[],
  generatedEnum: unknown[],
) {
  if (baselineEnum.length !== generatedEnum.length) {
    return false;
  }

  const unmatchedGeneratedValues = [...generatedEnum];
  for (const baselineValue of baselineEnum) {
    const matchingIndex = unmatchedGeneratedValues.findIndex((generatedValue) =>
      areEquivalentEnumValues(baselineValue, generatedValue),
    );
    if (matchingIndex < 0) {
      return false;
    }
    unmatchedGeneratedValues.splice(matchingIndex, 1);
  }

  return true;
}

function areEquivalentEnumValues(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => areEquivalentEnumValues(value, right[index]))
    );
  }

  if (!isRecord(left) || !isRecord(right)) {
    return false;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(right, key) &&
        areEquivalentEnumValues(left[key], right[key]),
    )
  );
}

function getParameterKey(parameter: unknown): string | null {
  if (!isRecord(parameter)) {
    return null;
  }

  return typeof parameter.in === "string" && typeof parameter.name === "string"
    ? `${parameter.in}:${parameter.name}`
    : null;
}

function isGeneratedObjectDegraded(
  baselineValue: unknown,
  generatedValue: unknown,
) {
  if (!isRecord(baselineValue)) {
    return false;
  }

  if (!generatedValue) {
    return true;
  }

  if (!isRecord(generatedValue)) {
    return false;
  }

  const baselineKeys = Object.keys(baselineValue);
  const generatedKeys = Object.keys(generatedValue);
  const lostKeys = baselineKeys.some(
    (key) => !Object.prototype.hasOwnProperty.call(generatedValue, key),
  );
  const noNewKeys = generatedKeys.every((key) =>
    Object.prototype.hasOwnProperty.call(baselineValue, key),
  );

  if (lostKeys && noNewKeys) {
    return true;
  }

  return usesSchemaReference(baselineValue) && !usesSchemaReference(generatedValue);
}

function pruneUnreferencedGeneratedSchemas(
  document: OpenApiDocument,
  baselineDocument: OpenApiDocument,
) {
  const schemas = document.components?.schemas;
  if (!schemas) {
    return;
  }

  const baselineSchemas = baselineDocument.components?.schemas ?? {};
  const referencedSchemas = new Set<string>();
  collectSchemaReferences(document.paths, referencedSchemas);
  collectSchemaReferences(schemas, referencedSchemas);

  for (const [schemaName, schema] of Object.entries(schemas)) {
    if (Object.prototype.hasOwnProperty.call(baselineSchemas, schemaName)) {
      continue;
    }

    collectSchemaReferences(schema, referencedSchemas);
    if (!referencedSchemas.has(schemaName)) {
      delete schemas[schemaName];
    }
  }
}

function collectSchemaReferences(
  value: unknown,
  referencedSchemas: Set<string>,
) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSchemaReferences(item, referencedSchemas);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const reference = value.$ref;
  if (typeof reference === "string") {
    const schemaName = reference.match(/^#\/components\/schemas\/(.+)$/)?.[1];
    if (schemaName) {
      referencedSchemas.add(schemaName);
    }
  }

  for (const nestedValue of Object.values(value)) {
    collectSchemaReferences(nestedValue, referencedSchemas);
  }
}

function orderDocumentLikeBaseline(
  document: OpenApiDocument,
  baselineDocument: OpenApiDocument,
) {
  document.paths = orderRecordLikeBaseline(document.paths, baselineDocument.paths);

  if (document.components?.schemas && baselineDocument.components?.schemas) {
    document.components.schemas = orderRecordLikeBaseline(
      document.components.schemas,
      baselineDocument.components.schemas,
    );
  }
}

function orderRecordLikeBaseline<T>(
  record: Record<string, T>,
  baselineRecord: Record<string, unknown>,
) {
  const ordered: Record<string, T> = {};
  for (const key of Object.keys(baselineRecord)) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      ordered[key] = record[key];
    }
  }
  for (const key of Object.keys(record)) {
    if (!Object.prototype.hasOwnProperty.call(ordered, key)) {
      ordered[key] = record[key];
    }
  }
  return ordered;
}

function getSchemaProperties(schema: Record<string, unknown>) {
  return isRecord(schema.properties) ? schema.properties : null;
}

function usesSchemaReference(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(usesSchemaReference);
  }

  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.$ref === "string" &&
    value.$ref.startsWith("#/components/schemas/")
  ) {
    return true;
  }

  return Object.values(value).some(usesSchemaReference);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
