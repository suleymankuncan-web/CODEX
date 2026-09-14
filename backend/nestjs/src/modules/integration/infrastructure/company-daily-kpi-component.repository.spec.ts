import { BadRequestException } from "@nestjs/common";
import { CompanyDailyKpiComponentRepository } from "./company-daily-kpi-component.repository";

const SOURCE_ID = "00000000-0000-4000-8000-000000000001";
const STORE_A_ID = "00000000-0000-4000-8000-000000000101";
const STORE_B_ID = "00000000-0000-4000-8000-000000000102";
const EMPLOYEE_A_ID = "00000000-0000-4000-8000-000000000201";
const COMPONENT_ID = "00000000-0000-4000-8000-000000000301";

function createRepository(query: jest.Mock) {
  const withTransaction = jest.fn(async (work) => work({ query }));
  return {
    repository: new CompanyDailyKpiComponentRepository({
      withTransaction,
    } as never),
    withTransaction,
  };
}

function successfulSalesInput() {
  return {
    integrationSourceId: SOURCE_ID,
    businessDate: "2026-08-30",
    operation: "sales" as const,
    aggregateCount: 3,
    retryCount: 1,
    sanitizedSetDigest: "a".repeat(64),
    employeeSales: [
      {
        storeId: STORE_A_ID,
        employeeId: EMPLOYEE_A_ID,
        saleInvoiceCount: 2,
        returnInvoiceCount: 1,
        saleQuantity: "3.5",
        signedReturnQuantity: "-1.25",
        netQuantity: "2.25",
        saleAmountTry: "1250.40",
        signedReturnAmountTry: "-250.10",
        netAmountTry: "1000.30",
      },
    ],
    storeSales: [
      {
        storeId: STORE_A_ID,
        saleInvoiceCount: 2,
        returnInvoiceCount: 1,
        saleQuantity: "3.5",
        signedReturnQuantity: "-1.25",
        netQuantity: "2.25",
        saleAmountTry: "1250.40",
        signedReturnAmountTry: "-250.10",
        netAmountTry: "1000.30",
      },
      {
        storeId: STORE_B_ID,
        saleInvoiceCount: 1,
        returnInvoiceCount: 0,
        saleQuantity: "1",
        signedReturnQuantity: "0",
        netQuantity: "1",
        saleAmountTry: "100",
        signedReturnAmountTry: "0",
        netAmountTry: "100",
      },
    ],
  };
}

describe("CompanyDailyKpiComponentRepository", () => {
  it("rejects an invalid complete set before opening a transaction", async () => {
    const { repository, withTransaction } = createRepository(jest.fn());
    const input = successfulSalesInput();
    input.employeeSales[0].netAmountTry = "1000.31";

    await expect(
      repository.replaceSuccessfulComponentSet(input),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("atomically replaces the exact sales component with mapped typed facts", async () => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes("FROM stg.integration_source")) {
        return { rowCount: 1, rows: [{ integration_source_id: SOURCE_ID }] };
      }
      if (sql.includes("FROM ops.store")) {
        return {
          rowCount: 2,
          rows: [{ store_id: STORE_A_ID }, { store_id: STORE_B_ID }],
        };
      }
      if (sql.includes("FROM ops.employee")) {
        return { rowCount: 1, rows: [{ employee_id: EMPLOYEE_A_ID }] };
      }
      if (sql.includes("RETURNING component_outcome_id")) {
        return { rowCount: 1, rows: [{ component_outcome_id: COMPONENT_ID }] };
      }
      return { rowCount: 1, rows: [] };
    });
    const { repository, withTransaction } = createRepository(query);

    await expect(
      repository.replaceSuccessfulComponentSet(successfulSalesInput()),
    ).resolves.toEqual({ componentOutcomeId: COMPONENT_ID, replaced: true });

    expect(withTransaction).toHaveBeenCalledTimes(1);
    const sql = query.mock.calls.map(([statement]) => String(statement));
    expect(sql[0]).toContain("pg_advisory_xact_lock");
    expect(
      sql.some((statement) => statement.includes("status = 'active'")),
    ).toBe(true);
    expect(
      sql.some((statement) => statement.includes("kpi_import_enabled = TRUE")),
    ).toBe(true);
    const mutableScopeLocks = sql.filter(
      (statement) =>
        statement.includes("FROM stg.integration_source") ||
        statement.includes("FROM ops.store"),
    );
    expect(mutableScopeLocks).toHaveLength(2);
    for (const statement of mutableScopeLocks) {
      expect(statement).toContain("FOR SHARE");
      expect(statement).not.toContain("FOR KEY SHARE");
    }
    expect(
      sql.some((statement) =>
        statement.includes(
          "DELETE FROM ops.company_daily_kpi_component_outcome",
        ),
      ),
    ).toBe(true);
    expect(
      sql.some((statement) =>
        statement.includes("INSERT INTO ops.company_daily_kpi_employee_sales"),
      ),
    ).toBe(true);
    expect(
      sql.some((statement) =>
        statement.includes("INSERT INTO ops.company_daily_kpi_store_sales"),
      ),
    ).toBe(true);

    const deleteCall = query.mock.calls.find(([statement]) =>
      String(statement).includes(
        "DELETE FROM ops.company_daily_kpi_component_outcome",
      ),
    );
    expect(deleteCall?.[1]).toEqual([SOURCE_ID, "2026-08-30", "sales"]);

    const employeeInsert = query.mock.calls.find(([statement]) =>
      String(statement).includes(
        "INSERT INTO ops.company_daily_kpi_employee_sales",
      ),
    );
    expect(String(employeeInsert?.[1]?.[2])).not.toContain("invoice-");
    expect(String(employeeInsert?.[1]?.[2])).not.toContain("person-");
  });

  it("does not open a replacement when one mapped store is not enabled", async () => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes("FROM stg.integration_source")) {
        return { rowCount: 1, rows: [{ integration_source_id: SOURCE_ID }] };
      }
      if (sql.includes("FROM ops.store")) {
        return { rowCount: 1, rows: [{ store_id: STORE_A_ID }] };
      }
      return { rowCount: 0, rows: [] };
    });
    const { repository } = createRepository(query);

    await expect(
      repository.replaceSuccessfulComponentSet(successfulSalesInput()),
    ).rejects.toThrow("company_daily_kpi_store_not_enabled");

    const sql = query.mock.calls
      .map(([statement]) => String(statement))
      .join("\n");
    expect(sql).not.toContain(
      "DELETE FROM ops.company_daily_kpi_component_outcome",
    );
    expect(sql).not.toContain(
      "INSERT INTO ops.company_daily_kpi_component_outcome",
    );
  });

  it("keeps footfall replacement isolated from sales and GSM facts", async () => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes("FROM stg.integration_source")) {
        return { rowCount: 1, rows: [{ integration_source_id: SOURCE_ID }] };
      }
      if (sql.includes("FROM ops.store")) {
        return { rowCount: 1, rows: [{ store_id: STORE_A_ID }] };
      }
      if (sql.includes("RETURNING component_outcome_id")) {
        return { rowCount: 1, rows: [{ component_outcome_id: COMPONENT_ID }] };
      }
      return { rowCount: 1, rows: [] };
    });
    const { repository } = createRepository(query);

    await repository.replaceSuccessfulComponentSet({
      integrationSourceId: SOURCE_ID,
      businessDate: "2026-08-30",
      operation: "footfall",
      aggregateCount: 1,
      retryCount: 0,
      sanitizedSetDigest: "b".repeat(64),
      storeFootfall: [{ storeId: STORE_A_ID, footfall: 42 }],
    });

    const sql = query.mock.calls
      .map(([statement]) => String(statement))
      .join("\n");
    expect(sql).toContain("INSERT INTO ops.company_daily_kpi_store_footfall");
    expect(sql).not.toContain(
      "INSERT INTO ops.company_daily_kpi_employee_sales",
    );
    expect(sql).not.toContain("INSERT INTO ops.company_daily_kpi_store_gsm");
  });

  it("rejects invalid GSM bounds before opening a transaction", async () => {
    const { repository, withTransaction } = createRepository(jest.fn());

    await expect(
      repository.replaceSuccessfulComponentSet({
        integrationSourceId: SOURCE_ID,
        businessDate: "2026-08-30",
        operation: "gsm",
        aggregateCount: 1,
        retryCount: 0,
        sanitizedSetDigest: "c".repeat(64),
        storeGsm: [
          { storeId: STORE_A_ID, yesCustomerCount: 2, totalCustomerCount: 1 },
        ],
      }),
    ).rejects.toThrow("company_daily_kpi_invalid_gsm_bounds");
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("rejects values that cannot fit the typed PostgreSQL integer columns", async () => {
    const { repository, withTransaction } = createRepository(jest.fn());

    await expect(
      repository.replaceSuccessfulComponentSet({
        integrationSourceId: SOURCE_ID,
        businessDate: "2026-08-30",
        operation: "footfall",
        aggregateCount: 1,
        retryCount: 2_147_483_648,
        sanitizedSetDigest: "d".repeat(64),
        storeFootfall: [{ storeId: STORE_A_ID, footfall: 42 }],
      }),
    ).rejects.toThrow("company_daily_kpi_invalid_replacement");
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("propagates a write failure so DatabaseService rolls back the replacement", async () => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes("FROM stg.integration_source")) {
        return { rowCount: 1, rows: [{ integration_source_id: SOURCE_ID }] };
      }
      if (sql.includes("FROM ops.store")) {
        return {
          rowCount: 2,
          rows: [{ store_id: STORE_A_ID }, { store_id: STORE_B_ID }],
        };
      }
      if (sql.includes("FROM ops.employee")) {
        return { rowCount: 1, rows: [{ employee_id: EMPLOYEE_A_ID }] };
      }
      if (sql.includes("RETURNING component_outcome_id")) {
        return { rowCount: 1, rows: [{ component_outcome_id: COMPONENT_ID }] };
      }
      if (sql.includes("INSERT INTO ops.company_daily_kpi_employee_sales")) {
        throw new Error("synthetic_write_failure");
      }
      return { rowCount: 1, rows: [] };
    });
    const { repository } = createRepository(query);

    await expect(
      repository.replaceSuccessfulComponentSet(successfulSalesInput()),
    ).rejects.toThrow("synthetic_write_failure");
  });
});
