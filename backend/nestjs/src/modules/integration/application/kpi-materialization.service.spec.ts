import { KpiMaterializationService } from "./kpi-materialization.service";
import { KpiMaterializationRepository } from "../infrastructure/kpi-materialization.repository";

type QueryResponse<T> = {
  rowCount: number;
  rows: T[];
};

describe("KpiMaterializationService", () => {
  const batchId = "00000000-0000-0000-0000-000000000001";
  const integrationSourceId = "00000000-0000-0000-0000-000000000002";
  const batchEnvelope = {
    sourceBatchId: "PBI-2026-04",
    sourcePayloadHash: "hash-1",
    sourceCapturedAt: "2026-04-30T12:00:00.000Z",
  };

  function createService(
    handler: (sql: string, params: unknown[]) => Promise<QueryResponse<unknown>>,
    resolveOptionalInternalId = jest.fn(async (input: { entityType: string }) => {
      if (input.entityType === "store") {
        return "00000000-0000-0000-0000-000000000352";
      }
      if (input.entityType === "employee") {
        return "00000000-0000-0000-0000-000000000353";
      }
      return null;
    }),
  ) {
    const databaseService = {
      query: jest.fn(handler),
    };
    const externalIdMappingService = {
      resolveOptionalInternalId,
    };
    const kpiMaterializationRepository = new KpiMaterializationRepository(
      databaseService as never,
    );

    return {
      databaseService,
      externalIdMappingService,
      service: new KpiMaterializationService(
        kpiMaterializationRepository,
        externalIdMappingService as never,
      ),
    };
  }

  it("materializes store KPI actuals and replaces positive targets", async () => {
    const { databaseService, service } = createService(async (sql) => {
      if (sql.includes("FROM stg.kpi_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              stg_kpi_raw_id: "00000000-0000-0000-0000-000000000350",
              payload_json: {
                kpiId: "00000000-0000-0000-0000-000000000351",
                scopeType: "store",
                sourceStoreId: "STORE-1",
                periodStart: "2026-04-01",
                periodEnd: "2026-04-30",
                actualValue: 92,
                targetValue: 100,
              },
            },
          ],
        };
      }

      if (sql.includes("SELECT company_id, region_id") && sql.includes("FROM ops.store")) {
        return {
          rowCount: 1,
          rows: [
            {
              company_id: "00000000-0000-0000-0000-000000000354",
              region_id: "00000000-0000-0000-0000-000000000355",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    const stats = await service.materializeKpis({
      batchId,
      integrationSourceId,
      batchEnvelope,
    });

    expect(stats).toEqual({
      processedCount: 1,
      errorCount: 0,
      hasRetryableFailure: false,
    });
    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO ops.kpi_actual"),
      [
        "00000000-0000-0000-0000-000000000351",
        "00000000-0000-0000-0000-000000000354",
        "00000000-0000-0000-0000-000000000355",
        "00000000-0000-0000-0000-000000000352",
        "monthly",
        "2026-04-01",
        "2026-04-30",
        92,
        "PBI-2026-04",
        "hash-1",
        "2026-04-30T12:00:00.000Z",
      ],
    );
    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM ops.kpi_target"),
      [
        "00000000-0000-0000-0000-000000000351",
        "00000000-0000-0000-0000-000000000352",
        "monthly",
        "2026-04-01",
        "2026-04-30",
      ],
    );
    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO ops.kpi_target"),
      expect.arrayContaining([100, 100, 85, 75]),
    );
  });

  it("materializes employee KPI actuals with inherited store organization scope", async () => {
    const { databaseService, service } = createService(async (sql) => {
      if (sql.includes("FROM stg.kpi_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              stg_kpi_raw_id: "00000000-0000-0000-0000-000000000356",
              payload_json: {
                kpiId: "00000000-0000-0000-0000-000000000357",
                scopeType: "employee",
                sourceStoreId: "STORE-1",
                employeeExternalRef: "EMP-4",
                periodStart: "2026-04-01",
                periodEnd: "2026-04-30",
                actualValue: 1200,
              },
            },
          ],
        };
      }

      if (sql.includes("SELECT company_id, region_id") && sql.includes("FROM ops.store")) {
        return {
          rowCount: 1,
          rows: [
            {
              company_id: "00000000-0000-0000-0000-000000000360",
              region_id: "00000000-0000-0000-0000-000000000361",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    await service.materializeKpis({
      batchId,
      integrationSourceId,
      batchEnvelope: {
        sourceBatchId: null,
        sourcePayloadHash: null,
        sourceCapturedAt: null,
      },
    });

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO ops.kpi_actual"),
      [
        "00000000-0000-0000-0000-000000000357",
        "00000000-0000-0000-0000-000000000360",
        "00000000-0000-0000-0000-000000000361",
        "00000000-0000-0000-0000-000000000352",
        "00000000-0000-0000-0000-000000000353",
        "monthly",
        "2026-04-01",
        "2026-04-30",
        1200,
        null,
        null,
        null,
      ],
    );
  });

  it("marks invalid KPI rows as validation_failed", async () => {
    const { databaseService, service } = createService(async (sql) => {
      if (sql.includes("FROM stg.kpi_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              stg_kpi_raw_id: "00000000-0000-0000-0000-000000000350",
              payload_json: {
                periodStart: "2026-04-01",
                periodEnd: "2026-04-30",
              },
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    const stats = await service.materializeKpis({
      batchId,
      integrationSourceId,
      batchEnvelope,
    });

    expect(stats).toEqual({
      processedCount: 0,
      errorCount: 1,
      hasRetryableFailure: false,
    });
    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("normalized_status = 'validation_failed'"),
      [
        "kpiId, kpiCode, or sourceMetricId is required",
        "00000000-0000-0000-0000-000000000350",
      ],
    );
  });
});
