import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const uuidPathParameterMatrix = [
  ["/api/auth/role-assignments/{assignmentId}/audit", "get", "assignmentId"],
  [
    "/api/auth/action-store-assignments/{assignmentId}/audit",
    "get",
    "assignmentId",
  ],
  ["/api/auth/users/{userId}/audit", "get", "userId"],
  ["/api/integrations/sources/{sourceId}/schedule", "patch", "sourceId"],
  ["/api/integrations/sources/{sourceId}/deactivate", "patch", "sourceId"],
  ["/api/integrations/sources/{sourceId}/reactivate", "patch", "sourceId"],
  ["/api/integrations/sources/{sourceId}/audit", "get", "sourceId"],
  [
    "/api/integrations/kpi-import-store-scope/{storeId}",
    "patch",
    "storeId",
  ],
  ["/api/integrations/store-master/{storeId}", "patch", "storeId"],
  [
    "/api/integrations/master-data-bootstrap/batches/{batchId}/validate",
    "post",
    "batchId",
  ],
  [
    "/api/integrations/master-data-bootstrap/batches/{batchId}/rows",
    "get",
    "batchId",
  ],
  [
    "/api/integrations/master-data-bootstrap/batches/{batchId}/promotion-readiness",
    "get",
    "batchId",
  ],
  [
    "/api/integrations/master-data-bootstrap/batches/{batchId}/promote-stores",
    "post",
    "batchId",
  ],
  [
    "/api/integrations/master-data-bootstrap/batches/{batchId}/promote-personnel",
    "post",
    "batchId",
  ],
  [
    "/api/integrations/master-data-bootstrap/batches/{batchId}",
    "get",
    "batchId",
  ],
  [
    "/api/integrations/import-batches/{batchId}/errors",
    "get",
    "batchId",
  ],
  [
    "/api/integrations/import-batches/{batchId}/reconciliation",
    "get",
    "batchId",
  ],
  ["/api/integrations/import-batch-audit/{batchId}", "get", "batchId"],
  ["/api/integrations/import-batches/{batchId}/audit", "get", "batchId"],
  [
    "/api/integrations/import-batches/{batchId}/retry",
    "post",
    "batchId",
  ],
  ["/api/integrations/import-batches/{batchId}", "get", "batchId"],
  ["/api/integrations/personnel-master/{employeeId}", "patch", "employeeId"],
  [
    "/api/integrations/personnel-master/{employeeId}/terminate",
    "patch",
    "employeeId",
  ],
  ["/api/snapshots/runs/{snapshotRunId}/audit", "get", "snapshotRunId"],
  [
    "/api/snapshots/runs/{snapshotRunId}/dependencies",
    "get",
    "snapshotRunId",
  ],
  ["/api/snapshots/runs/{snapshotRunId}/lineage", "get", "snapshotRunId"],
  ["/api/snapshots/runs/{snapshotRunId}/rerun", "post", "snapshotRunId"],
  ["/api/snapshots/runs/{snapshotRunId}", "get", "snapshotRunId"],
] as const;

const importBatchStatusValues = [
  "pending",
  "queued",
  "processing",
  "completed",
  "completed_with_errors",
  "failed",
];

const importBatchEntityTypeValues = [
  "employee",
  "store",
  "kpi",
  "assignment",
  "position",
  "company",
  "region",
];

describe("OpenAPI UUID and pagination contracts", () => {
  const document = JSON.parse(
    readFileSync(resolve(process.cwd(), "../../docs/api/openapi.json"), "utf8"),
  ) as {
    paths: Record<
      string,
      Record<string, { parameters?: Array<Record<string, unknown>> }>
    >;
  };

  it("keeps every v4 UUID path parameter honest after baseline preservation", () => {
    for (const [path, method, name] of uuidPathParameterMatrix) {
      const operation = document.paths[path]?.[method];
      const parameters = operation?.parameters ?? [];
      const parameter = parameters.find(
        (candidate) =>
          candidate.in === "path" && candidate.name === name,
      );

      expect(parameter).toBeDefined();
      expect(parameter?.required).toBe(true);
      expect(parameter?.schema).toEqual(
        expect.objectContaining({ type: "string", format: "uuid" }),
      );
    }
  });

  it("does not emit duplicate keyed parameters on the audited operations", () => {
    for (const [path, method] of uuidPathParameterMatrix) {
      const parameters = document.paths[path]?.[method]?.parameters ?? [];
      const keys = parameters
        .filter(
          (parameter) =>
            typeof parameter.in === "string" &&
            typeof parameter.name === "string",
        )
        .map((parameter) => `${parameter.in}:${parameter.name}`);

      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("documents import-batch audit pagination and needs-action filters", () => {
    const expectedPagination = {
      limit: {
        name: "limit",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
      },
      offset: {
        name: "offset",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 0, default: 0 },
      },
    };

    for (const path of [
      "/api/integrations/import-batch-audit/{batchId}",
      "/api/integrations/import-batches/{batchId}/audit",
    ]) {
      const parameters = document.paths[path]?.get.parameters ?? [];
      expect(parameters).toEqual(
        expect.arrayContaining([
          expectedPagination.limit,
          expectedPagination.offset,
        ]),
      );
    }

    const needsActionParameters =
      document.paths["/api/integrations/import-batches/needs-action"].get
        .parameters ?? [];
    expect(needsActionParameters).toEqual(
      expect.arrayContaining([
        expectedPagination.limit,
        expectedPagination.offset,
        {
          in: "query",
          name: "status",
          required: false,
          schema: { type: "string", enum: importBatchStatusValues },
        },
        {
          in: "query",
          name: "entityType",
          required: false,
          schema: { type: "string", enum: importBatchEntityTypeValues },
        },
        {
          in: "query",
          name: "sourceCode",
          required: false,
          schema: { type: "string" },
        },
        {
          in: "query",
          name: "q",
          required: false,
          schema: { type: "string", maxLength: 128 },
        },
        {
          in: "query",
          name: "startedFrom",
          required: false,
          schema: { type: "string", format: "date-time" },
        },
        {
          in: "query",
          name: "startedTo",
          required: false,
          schema: { type: "string", format: "date-time" },
        },
      ]),
    );
  });

  it("documents required UUID companyId for VM reference list operations", () => {
    for (const path of [
      "/api/visual-merchandising/references",
      "/api/visual-merchandising/references/campaigns",
      "/api/visual-merchandising/references/managed-campaigns",
    ]) {
      const parameters = document.paths[path]?.get.parameters ?? [];
      expect(parameters).toEqual(
        expect.arrayContaining([
          {
            name: "companyId",
            in: "query",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ]),
      );
    }
  });
});
