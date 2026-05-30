import { MaterializationService } from "./materialization.service";
import { ExternalIdMappingService } from "./external-id-mapping.service";
import { KpiMaterializationService } from "./kpi-materialization.service";
import { EmployeeMaterializationService } from "./employee-materialization.service";
import { StoreMaterializationService } from "./store-materialization.service";
import { AssignmentMaterializationService } from "./assignment-materialization.service";
import { PositionMaterializationService } from "./position-materialization.service";
import { CompanyMaterializationService } from "./company-materialization.service";
import { RegionMaterializationService } from "./region-materialization.service";
import { ExternalIdMappingCommandRepository } from "../infrastructure/external-id-mapping-command.repository";
import { KpiMaterializationRepository } from "../infrastructure/kpi-materialization.repository";
import { MaterializationBatchRepository } from "../infrastructure/materialization-batch.repository";
import { MaterializationRowStatusRepository } from "../infrastructure/materialization-row-status.repository";
import { EmployeeMaterializationRepository } from "../infrastructure/employee-materialization.repository";
import { StoreMaterializationRepository } from "../infrastructure/store-materialization.repository";
import { AssignmentMaterializationRepository } from "../infrastructure/assignment-materialization.repository";
import { PositionMaterializationRepository } from "../infrastructure/position-materialization.repository";
import { CompanyMaterializationRepository } from "../infrastructure/company-materialization.repository";
import { RegionMaterializationRepository } from "../infrastructure/region-materialization.repository";
import { muteNestLogger } from "../../../../test/jest/mute-nest-logger";

type QueryResponse<T> = {
  rowCount: number;
  rows: T[];
};

describe("MaterializationService", () => {
  const batchId = "00000000-0000-0000-0000-000000000001";
  const integrationSourceId = "00000000-0000-0000-0000-000000000002";
  let restoreLogger: (() => void) | null = null;

  beforeEach(() => {
    restoreLogger = muteNestLogger(["error", "log"]);
  });

  afterEach(() => {
    restoreLogger?.();
    restoreLogger = null;
  });

  function createDatabaseServiceMock(
    handler: (sql: string, params: unknown[]) => Promise<QueryResponse<unknown>>,
  ) {
    return {
      query: jest.fn(handler),
    };
  }

  function createService(
    handler: (sql: string, params: unknown[]) => Promise<QueryResponse<unknown>>,
  ) {
    const databaseService = createDatabaseServiceMock(handler);
    const mappingRepository = new ExternalIdMappingCommandRepository(
      databaseService as never,
    );
    const mappingService = new ExternalIdMappingService(mappingRepository);
    const kpiMaterializationRepository = new KpiMaterializationRepository(
      databaseService as never,
    );
    const kpiMaterializationService = new KpiMaterializationService(
      kpiMaterializationRepository,
      mappingService,
    );
    const materializationBatchRepository = new MaterializationBatchRepository(
      databaseService as never,
    );
    const rowStatusRepository = new MaterializationRowStatusRepository(
      databaseService as never,
    );
    const employeeMaterializationRepository = new EmployeeMaterializationRepository(
      databaseService as never,
    );
    const storeMaterializationRepository = new StoreMaterializationRepository(
      databaseService as never,
    );
    const assignmentMaterializationRepository = new AssignmentMaterializationRepository(
      databaseService as never,
    );
    const positionMaterializationRepository = new PositionMaterializationRepository(
      databaseService as never,
    );
    const companyMaterializationRepository = new CompanyMaterializationRepository(
      databaseService as never,
    );
    const regionMaterializationRepository = new RegionMaterializationRepository(
      databaseService as never,
    );
    const employeeMaterializationService = new EmployeeMaterializationService(
      employeeMaterializationRepository,
      mappingService,
      rowStatusRepository,
    );
    const storeMaterializationService = new StoreMaterializationService(
      storeMaterializationRepository,
      mappingService,
      rowStatusRepository,
    );
    const assignmentMaterializationService = new AssignmentMaterializationService(
      assignmentMaterializationRepository,
      mappingService,
      rowStatusRepository,
    );
    const positionMaterializationService = new PositionMaterializationService(
      positionMaterializationRepository,
      mappingService,
      rowStatusRepository,
    );
    const companyMaterializationService = new CompanyMaterializationService(
      companyMaterializationRepository,
      mappingService,
      rowStatusRepository,
    );
    const regionMaterializationService = new RegionMaterializationService(
      regionMaterializationRepository,
      mappingService,
      rowStatusRepository,
    );

    return {
      databaseService,
      service: new MaterializationService(
        materializationBatchRepository,
        kpiMaterializationService,
        employeeMaterializationService,
        storeMaterializationService,
        assignmentMaterializationService,
        positionMaterializationService,
        companyMaterializationService,
        regionMaterializationService,
      ),
    };
  }

  it("marks invalid employee rows as validation_failed and completes batch with errors", async () => {
    const { databaseService, service } = createService(async (sql, _params) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: batchId,
              entity_type: "employee",
              integration_source_id: integrationSourceId,
            },
          ],
        };
      }

      if (sql.includes("FROM stg.employee_raw")) {
        return {
          rowCount: 2,
          rows: [
            {
              stg_employee_raw_id: "00000000-0000-0000-0000-000000000101",
              payload_json: {
                employeeId: "00000000-0000-0000-0000-000000000201",
                companyId: "00000000-0000-0000-0000-000000000301",
                sourceEmployeeId: "EMP-1",
                firstName: "Ada",
                lastName: "Lovelace",
                hireDate: "2024-01-01",
              },
            },
            {
              stg_employee_raw_id: "00000000-0000-0000-0000-000000000102",
              payload_json: {
                employeeId: "00000000-0000-0000-0000-000000000202",
                sourceEmployeeId: "EMP-2",
                firstName: "Grace",
              },
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    await service.materializeBatch(batchId);

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("SET processed_flag = TRUE, processed_at = NOW(), normalized_status = 'validation_failed'"),
      [
        expect.stringContaining("company reference is required"),
        "00000000-0000-0000-0000-000000000102",
      ],
    );

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE stg.import_batch"),
      [batchId, "completed_with_errors", 1],
    );

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("VALUES (NULL, $1, 'stg.import_batch', $2::uuid, 'company', $3::jsonb)"),
      [
        "import_batch.started",
        batchId,
        JSON.stringify({
          correlationId: null,
          entityType: "employee",
        }),
      ],
    );

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("VALUES (NULL, $1, 'stg.import_batch', $2::uuid, 'company', $3::jsonb)"),
      [
        "import_batch.completed_with_errors",
        batchId,
        JSON.stringify({
          correlationId: null,
          entityType: "employee",
          processedCount: 1,
          errorCount: 1,
          hasRetryableFailure: false,
        }),
      ],
    );
  });

  it("materializes store rows by resolving mapped company and region ids", async () => {
    const { databaseService, service } = createService(async (sql, params) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: batchId,
              entity_type: "store",
              integration_source_id: integrationSourceId,
            },
          ],
        };
      }

      if (sql.includes("FROM stg.store_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              stg_store_raw_id: "00000000-0000-0000-0000-000000000150",
              payload_json: {
                sourceStoreId: "STORE-1",
                sourceCompanyId: "COMP-1",
                sourceRegionId: "REG-1",
                storeCode: "S001",
                storeName: "Kadikoy",
              },
            },
          ],
        };
      }

      if (sql.includes("FROM stg.external_id_map") && params[1] === "company") {
        return {
          rowCount: 1,
          rows: [{ internal_id: "00000000-0000-0000-0000-000000000151" }],
        };
      }

      if (sql.includes("FROM stg.external_id_map") && params[1] === "region") {
        return {
          rowCount: 1,
          rows: [{ internal_id: "00000000-0000-0000-0000-000000000152" }],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    await service.materializeBatch(batchId);

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO ops.store"),
      [
        expect.any(String),
        "00000000-0000-0000-0000-000000000151",
        "00000000-0000-0000-0000-000000000152",
        "STORE-1",
        "Kadikoy",
        "standard",
        "active",
        "Europe/Istanbul",
      ],
    );
  });

  it("materializes employee rows by resolving mapped company ids", async () => {
    const { databaseService, service } = createService(async (sql, params) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: batchId,
              entity_type: "employee",
              integration_source_id: integrationSourceId,
            },
          ],
        };
      }

      if (sql.includes("FROM stg.employee_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              stg_employee_raw_id: "00000000-0000-0000-0000-000000000104",
              payload_json: {
                sourceEmployeeId: "EMP-4",
                sourceCompanyId: "COMP-1",
                firstName: "Alan",
                lastName: "Turing",
                hireDate: "2024-01-01",
              },
            },
          ],
        };
      }

      if (sql.includes("FROM stg.external_id_map") && params[1] === "company") {
        return {
          rowCount: 1,
          rows: [{ internal_id: "00000000-0000-0000-0000-000000000304" }],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    await service.materializeBatch(batchId);

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO ops.employee"),
      [
        expect.any(String),
        "00000000-0000-0000-0000-000000000304",
        "EMP-4",
        "Alan",
        "Turing",
        "2024-01-01",
        "active",
        "full_time",
      ],
    );
  });

  it("materializes kpi rows by resolving mapped store and employee ids", async () => {
    const { databaseService, service } = createService(async (sql, params) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: batchId,
              entity_type: "kpi",
              integration_source_id: integrationSourceId,
              source_batch_id: null,
              source_payload_hash: null,
              source_captured_at: null,
            },
          ],
        };
      }

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
                employeeExternalRef: "EMP-4",
                periodStart: "2026-04-01",
                periodEnd: "2026-04-30",
                actualValue: 92,
              },
            },
          ],
        };
      }

      if (sql.includes("FROM stg.external_id_map") && params[1] === "store") {
        return {
          rowCount: 1,
          rows: [{ internal_id: "00000000-0000-0000-0000-000000000352" }],
        };
      }

      if (sql.includes("FROM stg.external_id_map") && params[1] === "employee") {
        return {
          rowCount: 1,
          rows: [{ internal_id: "00000000-0000-0000-0000-000000000353" }],
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

    await service.materializeBatch(batchId);

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
        null,
        null,
        null,
      ],
    );
  });

  it("inherits employee KPI company and region scope from the resolved store", async () => {
    const { databaseService, service } = createService(async (sql, params) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: batchId,
              entity_type: "kpi",
              integration_source_id: integrationSourceId,
              source_batch_id: null,
              source_payload_hash: null,
              source_captured_at: null,
            },
          ],
        };
      }

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

      if (sql.includes("FROM stg.external_id_map") && params[1] === "store") {
        return {
          rowCount: 1,
          rows: [{ internal_id: "00000000-0000-0000-0000-000000000358" }],
        };
      }

      if (sql.includes("FROM stg.external_id_map") && params[1] === "employee") {
        return {
          rowCount: 1,
          rows: [{ internal_id: "00000000-0000-0000-0000-000000000359" }],
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

    await service.materializeBatch(batchId);

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO ops.kpi_actual"),
      [
        "00000000-0000-0000-0000-000000000357",
        "00000000-0000-0000-0000-000000000360",
        "00000000-0000-0000-0000-000000000361",
        "00000000-0000-0000-0000-000000000358",
        "00000000-0000-0000-0000-000000000359",
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

  it("marks store-scope kpi rows as retryable_error when store reference cannot be resolved", async () => {
    const { databaseService, service } = createService(async (sql, params) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: batchId,
              entity_type: "kpi",
              integration_source_id: integrationSourceId,
            },
          ],
        };
      }

      if (sql.includes("FROM stg.kpi_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              stg_kpi_raw_id: "00000000-0000-0000-0000-000000000354",
              payload_json: {
                kpiId: "00000000-0000-0000-0000-000000000355",
                scopeType: "store",
                sourceStoreId: "STORE-404",
                periodStart: "2026-04-01",
                periodEnd: "2026-04-30",
                actualValue: 12,
              },
            },
          ],
        };
      }

      if (sql.includes("FROM stg.external_id_map") && params[1] === "store") {
        return { rowCount: 0, rows: [] };
      }

      return { rowCount: 1, rows: [] };
    });

    await service.materializeBatch(batchId);

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("SET processed_flag = FALSE, normalized_status = 'retryable_error'"),
      [
        expect.stringContaining("store reference could not be resolved"),
        "00000000-0000-0000-0000-000000000354",
      ],
    );
  });

  it("marks infrastructure write failures as retryable_error and fails the batch", async () => {
    const { databaseService, service } = createService(async (sql, _params) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: batchId,
              entity_type: "employee",
              integration_source_id: integrationSourceId,
            },
          ],
        };
      }

      if (sql.includes("FROM stg.employee_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              stg_employee_raw_id: "00000000-0000-0000-0000-000000000103",
              payload_json: {
                employeeId: "00000000-0000-0000-0000-000000000203",
                companyId: "00000000-0000-0000-0000-000000000303",
                sourceEmployeeId: "EMP-3",
                firstName: "Linus",
                lastName: "Torvalds",
                hireDate: "2024-01-01",
              },
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.employee")) {
        throw new Error("database unavailable password=secret token=abc123");
      }

      return { rowCount: 1, rows: [] };
    });

    await service.materializeBatch(batchId);

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("SET processed_flag = FALSE, normalized_status = 'retryable_error'"),
      [
        "database unavailable password=[redacted] token=[redacted]",
        "00000000-0000-0000-0000-000000000103",
      ],
    );

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE stg.import_batch"),
      [batchId, "failed", 1],
    );

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("VALUES (NULL, $1, 'stg.import_batch', $2::uuid, 'company', $3::jsonb)"),
      [
        "import_batch.failed",
        batchId,
        JSON.stringify({
          correlationId: null,
          entityType: "employee",
          processedCount: 0,
          errorCount: 1,
          hasRetryableFailure: true,
        }),
      ],
    );
  });

  it("materializes assignment rows by resolving mapped employee, store, and position ids", async () => {
    const { databaseService, service } = createService(async (sql, params) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: batchId,
              entity_type: "assignment",
              integration_source_id: integrationSourceId,
            },
          ],
        };
      }

      if (sql.includes("FROM stg.assignment_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              stg_assignment_raw_id: "00000000-0000-0000-0000-000000000401",
              payload_json: {
                sourceAssignmentId: "ASN-1",
                sourceEmployeeId: "EMP-1",
                sourceStoreId: "STORE-1",
                sourcePositionId: "POS-1",
                startDate: "2026-04-01",
                assignmentStatus: "active",
                fteRatio: 1,
              },
            },
          ],
        };
      }

      if (sql.includes("FROM stg.external_id_map") && params[1] === "employee") {
        return {
          rowCount: 1,
          rows: [{ internal_id: "00000000-0000-0000-0000-000000000501" }],
        };
      }

      if (sql.includes("FROM stg.external_id_map") && params[1] === "store") {
        return {
          rowCount: 1,
          rows: [{ internal_id: "00000000-0000-0000-0000-000000000502" }],
        };
      }

      if (sql.includes("FROM stg.external_id_map") && params[1] === "position") {
        return {
          rowCount: 1,
          rows: [{ internal_id: "00000000-0000-0000-0000-000000000503" }],
        };
      }

      if (sql.includes("FROM ops.store")) {
        return {
          rowCount: 1,
          rows: [{ region_id: "00000000-0000-0000-0000-000000000504" }],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    await service.materializeBatch(batchId);

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO ops.employee_assignment_history"),
      [
        expect.any(String),
        "00000000-0000-0000-0000-000000000501",
        "00000000-0000-0000-0000-000000000502",
        "00000000-0000-0000-0000-000000000504",
        "00000000-0000-0000-0000-000000000503",
        null,
        "2026-04-01",
        null,
        true,
        1,
        "active",
      ],
    );

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("VALUES ($1::uuid, $2, $3, $4::uuid, $5, TRUE)"),
      [
        integrationSourceId,
        "assignment",
        "ASN-1",
        expect.any(String),
        "ops.employee_assignment_history",
      ],
    );

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE stg.import_batch"),
      [batchId, "completed", 0],
    );
  });

  it("marks invalid assignment rows as validation_failed", async () => {
    const { databaseService, service } = createService(async (sql, _params) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: batchId,
              entity_type: "assignment",
              integration_source_id: integrationSourceId,
            },
          ],
        };
      }

      if (sql.includes("FROM stg.assignment_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              stg_assignment_raw_id: "00000000-0000-0000-0000-000000000402",
              payload_json: {
                sourceAssignmentId: "ASN-2",
                sourceEmployeeId: "EMP-2",
              },
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    await service.materializeBatch(batchId);

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("normalized_status = 'validation_failed'"),
      [
        expect.stringContaining("store reference is required"),
        "00000000-0000-0000-0000-000000000402",
      ],
    );

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE stg.import_batch"),
      [batchId, "completed_with_errors", 1],
    );
  });

  it("materializes position rows and writes position external id mappings", async () => {
    const { databaseService, service } = createService(async (sql, _params) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: batchId,
              entity_type: "position",
              integration_source_id: integrationSourceId,
            },
          ],
        };
      }

      if (sql.includes("FROM stg.position_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              stg_position_raw_id: "00000000-0000-0000-0000-000000000601",
              payload_json: {
                sourcePositionId: "POS-1",
                companyId: "00000000-0000-0000-0000-000000000602",
                positionCode: "SHIFT_LEAD",
                positionName: "Shift Lead",
                jobFamily: "Operations",
                isManagerial: true,
              },
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.position")) {
        return {
          rowCount: 1,
          rows: [{ position_id: "00000000-0000-0000-0000-000000000603" }],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    await service.materializeBatch(batchId);

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO ops.position"),
      [
        expect.any(String),
        "00000000-0000-0000-0000-000000000602",
        "SHIFT_LEAD",
        "Shift Lead",
        "Operations",
        true,
      ],
    );

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("VALUES ($1::uuid, $2, $3, $4::uuid, $5, TRUE)"),
      [
        integrationSourceId,
        "position",
        "POS-1",
        "00000000-0000-0000-0000-000000000603",
        "ops.position",
      ],
    );

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE stg.import_batch"),
      [batchId, "completed", 0],
    );
  });

  it("materializes position rows by resolving mapped company ids", async () => {
    const { databaseService, service } = createService(async (sql, params) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: batchId,
              entity_type: "position",
              integration_source_id: integrationSourceId,
            },
          ],
        };
      }

      if (sql.includes("FROM stg.position_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              stg_position_raw_id: "00000000-0000-0000-0000-000000000605",
              payload_json: {
                sourcePositionId: "POS-2",
                sourceCompanyId: "COMP-2",
                positionCode: "CASHIER",
                positionName: "Cashier",
              },
            },
          ],
        };
      }

      if (sql.includes("FROM stg.external_id_map") && params[1] === "company") {
        return {
          rowCount: 1,
          rows: [{ internal_id: "00000000-0000-0000-0000-000000000606" }],
        };
      }

      if (sql.includes("INSERT INTO ops.position")) {
        return {
          rowCount: 1,
          rows: [{ position_id: "00000000-0000-0000-0000-000000000607" }],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    await service.materializeBatch(batchId);

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO ops.position"),
      [
        expect.any(String),
        "00000000-0000-0000-0000-000000000606",
        "CASHIER",
        "Cashier",
        null,
        false,
      ],
    );
  });

  it("marks invalid position rows as validation_failed", async () => {
    const { databaseService, service } = createService(async (sql, _params) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: batchId,
              entity_type: "position",
              integration_source_id: integrationSourceId,
            },
          ],
        };
      }

      if (sql.includes("FROM stg.position_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              stg_position_raw_id: "00000000-0000-0000-0000-000000000604",
              payload_json: {
                sourcePositionId: "POS-2",
                positionName: "Cashier",
              },
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    await service.materializeBatch(batchId);

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("normalized_status = 'validation_failed'"),
      [
        expect.stringContaining("company reference is required"),
        "00000000-0000-0000-0000-000000000604",
      ],
    );

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE stg.import_batch"),
      [batchId, "completed_with_errors", 1],
    );
  });

  it("materializes company rows and writes company external id mappings", async () => {
    const { databaseService, service } = createService(async (sql) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: batchId,
              entity_type: "company",
              integration_source_id: integrationSourceId,
            },
          ],
        };
      }

      if (sql.includes("FROM stg.company_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              stg_company_raw_id: "00000000-0000-0000-0000-000000000701",
              payload_json: {
                sourceCompanyId: "COMP-1",
                companyCode: "ACME",
                companyName: "Acme Retail",
                status: "active",
              },
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.company")) {
        return {
          rowCount: 1,
          rows: [{ company_id: "00000000-0000-0000-0000-000000000702" }],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    await service.materializeBatch(batchId);

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO ops.company"),
      [expect.any(String), "ACME", "Acme Retail", "active"],
    );

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("VALUES ($1::uuid, $2, $3, $4::uuid, $5, TRUE)"),
      [
        integrationSourceId,
        "company",
        "COMP-1",
        "00000000-0000-0000-0000-000000000702",
        "ops.company",
      ],
    );
  });

  it("materializes region rows by resolving mapped company ids", async () => {
    const { databaseService, service } = createService(async (sql, params) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: batchId,
              entity_type: "region",
              integration_source_id: integrationSourceId,
            },
          ],
        };
      }

      if (sql.includes("FROM stg.region_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              stg_region_raw_id: "00000000-0000-0000-0000-000000000703",
              payload_json: {
                sourceRegionId: "REG-1",
                sourceCompanyId: "COMP-1",
                regionCode: "MARMARA",
                regionName: "Marmara",
                status: "active",
              },
            },
          ],
        };
      }

      if (sql.includes("FROM stg.external_id_map") && params[1] === "company") {
        return {
          rowCount: 1,
          rows: [{ internal_id: "00000000-0000-0000-0000-000000000704" }],
        };
      }

      if (sql.includes("INSERT INTO ops.region")) {
        return {
          rowCount: 1,
          rows: [{ region_id: "00000000-0000-0000-0000-000000000705" }],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    await service.materializeBatch(batchId);

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO ops.region"),
      [
        expect.any(String),
        "00000000-0000-0000-0000-000000000704",
        "MARMARA",
        "Marmara",
        "active",
      ],
    );

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("VALUES ($1::uuid, $2, $3, $4::uuid, $5, TRUE)"),
      [
        integrationSourceId,
        "region",
        "REG-1",
        "00000000-0000-0000-0000-000000000705",
        "ops.region",
      ],
    );
  });

  it("marks invalid region rows as validation_failed", async () => {
    const { databaseService, service } = createService(async (sql) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: batchId,
              entity_type: "region",
              integration_source_id: integrationSourceId,
            },
          ],
        };
      }

      if (sql.includes("FROM stg.region_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              stg_region_raw_id: "00000000-0000-0000-0000-000000000706",
              payload_json: {
                sourceRegionId: "REG-2",
                regionName: "Aegean",
              },
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    await service.materializeBatch(batchId);

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("normalized_status = 'validation_failed'"),
      [
        expect.stringContaining("company reference is required"),
        "00000000-0000-0000-0000-000000000706",
      ],
    );
  });
});
