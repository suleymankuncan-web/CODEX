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

      if (
        shouldPreserveBaselineParameters(
          baselineOperation.parameters,
          generatedOperation.parameters,
        )
      ) {
        generatedOperation.parameters = baselineOperation.parameters;
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

function shouldPreserveBaselineParameters(
  baselineParameters: unknown,
  generatedParameters: unknown,
) {
  if (!Array.isArray(baselineParameters) || !Array.isArray(generatedParameters)) {
    return false;
  }

  if (baselineParameters.length < generatedParameters.length) {
    return false;
  }

  const baselineNames = new Set(
    baselineParameters
      .filter(isRecord)
      .map((parameter) => `${String(parameter.in)}:${String(parameter.name)}`),
  );

  const generatedNames = generatedParameters
    .filter(isRecord)
    .map((parameter) => `${String(parameter.in)}:${String(parameter.name)}`);

  return generatedNames.every((parameterName) =>
    baselineNames.has(parameterName),
  );
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
