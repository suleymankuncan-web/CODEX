import { BadRequestException } from "@nestjs/common";
import { CompanyDailyKpiComponentRangeReadRepository } from "./company-daily-kpi-component-range-read.repository";

const syntheticUuid = (suffix: number): string =>
  [
    "0".repeat(8),
    "0".repeat(4),
    "4".padEnd(4, "0"),
    "8".padEnd(4, "0"),
    suffix.toString(16).padStart(12, "0"),
  ].join("-");

const SOURCE_ID = syntheticUuid(1);
const STORE_A_ID = syntheticUuid(0x101);
const OUTCOME_ID = syntheticUuid(0x301);

function marker(overrides: Record<string, unknown> = {}) {
  return {
    requested_store_id: STORE_A_ID,
    match_count: "1",
    store_id: STORE_A_ID,
    store_code: "store-A",
    ...overrides,
  };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    source_match_count: "1",
    source_id: SOURCE_ID,
    source_code: "source-A",
    store_markers: [marker()],
    component_outcome_id: OUTCOME_ID,
    business_date: "2026-08-30",
    operation: "sales",
    status: "succeeded",
    persisted_aggregate_count: "1",
    full_physical_fact_count: "1",
    sanitized_set_digest: "a".repeat(64),
    store_facts: [
      {
        store_id: STORE_A_ID,
        store_code: "store-A",
        sale_invoice_count: "2",
        return_invoice_count: "0",
      },
    ],
    ...overrides,
  };
}

function createRepository(rows: readonly Record<string, unknown>[]) {
  const query = jest.fn(async (..._args: unknown[]) => ({
    rowCount: rows.length,
    rows,
  }));
  return {
    repository: new CompanyDailyKpiComponentRangeReadRepository({
      query,
    } as never),
    query,
  };
}

describe("CompanyDailyKpiComponentRangeReadRepository", () => {
  it("reads one complete store range through one parameterized SQL statement", async () => {
    const query = jest.fn(async (..._args: unknown[]) => ({
      rowCount: 1,
      rows: [
        {
          source_match_count: "1",
          source_id: SOURCE_ID,
          source_code: "source-A",
          store_markers: [
            {
              requested_store_id: STORE_A_ID,
              match_count: "1",
              store_id: STORE_A_ID,
              store_code: "store-A",
            },
          ],
          component_outcome_id: OUTCOME_ID,
          business_date: "2026-08-30",
          operation: "sales",
          status: "succeeded",
          persisted_aggregate_count: "1",
          full_physical_fact_count: "1",
          sanitized_set_digest: "a".repeat(64),
          store_facts: [
            {
              store_id: STORE_A_ID,
              store_code: "store-A",
              sale_invoice_count: "2",
              return_invoice_count: "0",
            },
          ],
        },
      ],
    }));
    const repository = new CompanyDailyKpiComponentRangeReadRepository({
      query,
    } as never);

    await expect(
      repository.readStoreRange({
        integrationSourceId: SOURCE_ID,
        startDate: "2026-08-30",
        endDate: "2026-08-30",
        storeIds: [STORE_A_ID],
      }),
    ).resolves.toEqual({
      sourceCode: "source-A",
      stores: [{ storeId: STORE_A_ID, storeCode: "store-A" }],
      outcomes: [
        expect.objectContaining({
          componentOutcomeId: OUTCOME_ID,
          businessDate: "2026-08-30",
          operation: "sales",
          status: "succeeded",
          persistedAggregateCount: 1,
          fullPhysicalFactCount: 1,
          sanitizedSetDigest: "a".repeat(64),
          storeFacts: [
            {
              businessDate: "2026-08-30",
              storeId: STORE_A_ID,
              storeCode: "store-A",
              saleInvoiceCount: 2,
              returnInvoiceCount: 0,
            },
          ],
        }),
      ],
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]).toEqual([
      SOURCE_ID,
      "2026-08-30",
      "2026-08-30",
      [STORE_A_ID],
    ]);
    expect(String(query.mock.calls[0]?.[0])).toContain(
      "FROM ops.company_daily_kpi_component_outcome",
    );
  });

  it("rejects malformed range input before querying", async () => {
    const query = jest.fn(async (..._args: unknown[]) => ({
      rowCount: 0,
      rows: [],
    }));
    const repository = new CompanyDailyKpiComponentRangeReadRepository({
      query,
    } as never);

    await expect(
      repository.readStoreRange({
        integrationSourceId: "not-a-uuid",
        startDate: "2026-08-30",
        endDate: "2026-08-30",
        storeIds: [STORE_A_ID],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });

  it("retains succeeded-empty and missing outcome markers without fabricating storage fields", async () => {
    const { repository } = createRepository([
      row({
        component_outcome_id: null,
        status: null,
        persisted_aggregate_count: null,
        full_physical_fact_count: null,
        sanitized_set_digest: null,
        store_facts: [],
      }),
    ]);

    await expect(
      repository.readStoreRange({
        integrationSourceId: SOURCE_ID,
        startDate: "2026-08-30",
        endDate: "2026-08-30",
        storeIds: [STORE_A_ID],
      }),
    ).resolves.toMatchObject({ sourceCode: "source-A", outcomes: [] });
  });

  it("fails closed for unknown or duplicate source/store markers", async () => {
    const unknownSource = createRepository([row({ source_match_count: "0", source_id: null, source_code: null })]);
    await expect(
      unknownSource.repository.readStoreRange({
        integrationSourceId: SOURCE_ID,
        startDate: "2026-08-30",
        endDate: "2026-08-30",
        storeIds: [STORE_A_ID],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const duplicateStore = createRepository([
      row({ store_markers: [marker({ match_count: "2", store_id: null, store_code: null })] }),
    ]);
    await expect(
      duplicateStore.repository.readStoreRange({
        integrationSourceId: SOURCE_ID,
        startDate: "2026-08-30",
        endDate: "2026-08-30",
        storeIds: [STORE_A_ID],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("fails closed for duplicate outcomes, duplicate scoped facts, and unsafe BIGINT text", async () => {
    const duplicateOutcome = createRepository([row(), row()]);
    await expect(
      duplicateOutcome.repository.readStoreRange({
        integrationSourceId: SOURCE_ID,
        startDate: "2026-08-30",
        endDate: "2026-08-30",
        storeIds: [STORE_A_ID],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const duplicateFact = createRepository([
      row({ store_facts: [row().store_facts, row().store_facts].flat() }),
    ]);
    await expect(
      duplicateFact.repository.readStoreRange({
        integrationSourceId: SOURCE_ID,
        startDate: "2026-08-30",
        endDate: "2026-08-30",
        storeIds: [STORE_A_ID],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const unsafeCount = createRepository([
      row({ full_physical_fact_count: "9007199254740992" }),
    ]);
    await expect(
      unsafeCount.repository.readStoreRange({
        integrationSourceId: SOURCE_ID,
        startDate: "2026-08-30",
        endDate: "2026-08-30",
        storeIds: [STORE_A_ID],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("does not apply current lifecycle filters to historical stores", async () => {
    const { repository, query } = createRepository([row()]);
    await repository.readStoreRange({
      integrationSourceId: SOURCE_ID,
      startDate: "2026-08-30",
      endDate: "2026-08-30",
      storeIds: [STORE_A_ID],
    });
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain("entity_type = 'kpi'");
    expect(sql).not.toMatch(/kpi_import_enabled|close_date|open_date/);
    expect(sql).not.toMatch(/status\s*=\s*['"]active['"]/i);
  });

  it("accepts the 366-calendar-day and 250-store boundaries", async () => {
    const storeIds = [
      STORE_A_ID,
      ...Array.from({ length: 249 }, (_, index) => syntheticUuid(0x500 + index)),
    ];
    const { repository, query } = createRepository([
      row({
        store_markers: storeIds.map((storeId, index) => ({
          requested_store_id: storeId,
          match_count: "1",
          store_id: storeId,
          store_code: index === 0 ? "store-A" : `store-${index}`,
        })),
      }),
    ]);

    await expect(
      repository.readStoreRange({
        integrationSourceId: SOURCE_ID,
        startDate: "2026-08-30",
        endDate: "2027-08-30",
        storeIds,
      }),
    ).resolves.toMatchObject({ stores: expect.any(Array) });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("rejects ranges longer than 366 days and scopes larger than 250 before querying", async () => {
    const query = jest.fn(async (..._args: unknown[]) => ({
      rowCount: 0,
      rows: [],
    }));
    const repository = new CompanyDailyKpiComponentRangeReadRepository({
      query,
    } as never);

    await expect(
      repository.readStoreRange({
        integrationSourceId: SOURCE_ID,
        startDate: "2026-08-30",
        endDate: "2027-08-31",
        storeIds: [STORE_A_ID],
      }),
    ).rejects.toThrow("company_daily_kpi_range_too_large");

    const storeIds = Array.from({ length: 251 }, (_, index) =>
      syntheticUuid(0x700 + index),
    );
    await expect(
      repository.readStoreRange({
        integrationSourceId: SOURCE_ID,
        startDate: "2026-08-30",
        endDate: "2026-08-30",
        storeIds,
      }),
    ).rejects.toThrow("company_daily_kpi_store_scope_too_large");
    expect(query).not.toHaveBeenCalled();
  });

  describe("readDailyClosure", () => {
    const businessDate = "2026-08-30" as const;

    const closureRow = (overrides: Record<string, unknown> = {}) => ({
      source_match_count: "1",
      source_id: SOURCE_ID,
      source_code: "source-A",
      business_date: businessDate,
      operation: "sales",
      status: "succeeded",
      aggregate_count: "3",
      retry_count: "0",
      safe_reason_code: null,
      sanitized_set_digest: "a".repeat(64),
      ...overrides,
    });

    const createClosureRepository = (rows: readonly Record<string, unknown>[]) => {
      const query = jest.fn(async (..._args: unknown[]) => ({
        rowCount: rows.length,
        rows,
      }));
      return {
        repository: new CompanyDailyKpiComponentRangeReadRepository({
          query,
        } as never),
        query,
      };
    };

    it("reads only safe outcome metadata in one parameterized statement", async () => {
      const { repository, query } = createClosureRepository([
        closureRow(),
        closureRow({
          operation: "footfall",
          aggregate_count: "2",
          sanitized_set_digest: "b".repeat(64),
        }),
        closureRow({
          operation: "gsm",
          aggregate_count: "1",
          sanitized_set_digest: "c".repeat(64),
        }),
      ]);

      await expect(
        repository.readDailyClosure({
          integrationSourceId: SOURCE_ID,
          businessDate,
        }),
      ).resolves.toEqual({
        sourceCode: "source-A",
        businessDate,
        outcomes: [
          {
            operation: "sales",
            sourceCode: "source-A",
            businessDate,
            status: "succeeded",
            aggregateCount: 3,
            retryCount: 0,
            sanitizedSetDigest: "a".repeat(64),
          },
          {
            operation: "footfall",
            sourceCode: "source-A",
            businessDate,
            status: "succeeded",
            aggregateCount: 2,
            retryCount: 0,
            sanitizedSetDigest: "b".repeat(64),
          },
          {
            operation: "gsm",
            sourceCode: "source-A",
            businessDate,
            status: "succeeded",
            aggregateCount: 1,
            retryCount: 0,
            sanitizedSetDigest: "c".repeat(64),
          },
        ],
      });
      expect(query).toHaveBeenCalledTimes(1);
      expect(query.mock.calls[0]?.[1]).toEqual([SOURCE_ID, businessDate]);
      const sql = String(query.mock.calls[0]?.[0]);
      expect(sql).toContain("ops.company_daily_kpi_component_outcome");
      expect(sql).toContain(
        "LEFT JOIN ops.company_daily_kpi_component_outcome",
      );
      expect(sql).not.toMatch(/company_daily_kpi_(employee_sales|store_sales|store_footfall|store_gsm)/);
      expect(sql).not.toMatch(/kpi_import_enabled|close_date|open_date|status\s*=\s*['"]active['"]/i);
    });

    it("returns a valid KPI source with no outcomes as an empty outcome set", async () => {
      const { repository } = createClosureRepository([
        closureRow({
          operation: null,
          status: null,
          aggregate_count: null,
          retry_count: null,
          safe_reason_code: null,
          sanitized_set_digest: null,
        }),
      ]);

      await expect(
        repository.readDailyClosure({
          integrationSourceId: SOURCE_ID,
          businessDate,
        }),
      ).resolves.toEqual({
        sourceCode: "source-A",
        businessDate,
        outcomes: [],
      });
    });

    it("rejects duplicate empty outcome markers", async () => {
      const emptyMarker = closureRow({
        operation: null,
        status: null,
        aggregate_count: null,
        retry_count: null,
        safe_reason_code: null,
        sanitized_set_digest: null,
      });
      const { repository } = createClosureRepository([
        emptyMarker,
        { ...emptyMarker },
      ]);

      await expect(
        repository.readDailyClosure({
          integrationSourceId: SOURCE_ID,
          businessDate,
        }),
      ).rejects.toThrow("company_daily_kpi_missing_outcome_marker");
    });

    it("rejects strict input before querying", async () => {
      const { repository, query } = createClosureRepository([]);
      await expect(
        repository.readDailyClosure({
          integrationSourceId: "not-a-uuid",
          businessDate,
        }),
      ).rejects.toThrow("company_daily_kpi_invalid_daily_closure_source_id");
      await expect(
        repository.readDailyClosure({
          integrationSourceId: SOURCE_ID,
          businessDate: "2026-02-30",
        }),
      ).rejects.toThrow("company_daily_kpi_invalid_daily_closure_date");
      expect(query).not.toHaveBeenCalled();
    });

    it.each([
      ["unknown source", { source_match_count: "0", source_id: null, source_code: null }],
      ["wrong entity marker", { source_id: syntheticUuid(2) }],
      ["ambiguous source", { source_match_count: "2" }],
      ["inconsistent source code", { source_code: "source-B" }],
      ["out of day row", { business_date: "2026-08-29" }],
      ["unknown operation", { operation: "inventory" }],
      ["unknown status", { status: "pending" }],
      ["invalid aggregate count", { aggregate_count: "2147483648" }],
      ["invalid retry count", { retry_count: "-1" }],
      ["unsafe reason", { safe_reason_code: "Unsafe reason" }],
      ["invalid digest", { sanitized_set_digest: "not-a-digest" }],
      ["succeeded without digest", { sanitized_set_digest: null }],
      ["failed with aggregate count", { status: "failed", aggregate_count: "1", sanitized_set_digest: null }],
      ["missed with digest", { status: "missed", aggregate_count: "0", sanitized_set_digest: "d".repeat(64) }],
    ] as const)("fails closed for %s", async (label, overrides) => {
      const rows =
        label === "inconsistent source code"
          ? [closureRow(), closureRow({ operation: "footfall", source_code: "source-B" })]
          : [closureRow(overrides)];
      const { repository } = createClosureRepository(rows);
      await expect(
        repository.readDailyClosure({
          integrationSourceId: SOURCE_ID,
          businessDate,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects duplicate operation rows and does not expose raw fields", async () => {
      const { repository } = createClosureRepository([
        closureRow({ invoiceId: "invoice-A", component_outcome_id: OUTCOME_ID }),
        closureRow({ invoiceId: "invoice-B", component_outcome_id: syntheticUuid(4) }),
      ]);
      await expect(
        repository.readDailyClosure({
          integrationSourceId: SOURCE_ID,
          businessDate,
        }),
      ).rejects.toThrow("company_daily_kpi_duplicate_outcome");

      const { repository: cleanRepository } = createClosureRepository([
        closureRow({ invoiceId: "invoice-A", component_outcome_id: OUTCOME_ID }),
      ]);
      const result = await cleanRepository.readDailyClosure({
        integrationSourceId: SOURCE_ID,
        businessDate,
      });
      expect(JSON.stringify(result)).not.toMatch(/invoice-A|component_outcome_id/i);
    });

    it("retains failed and missed metadata without digest or aggregate facts", async () => {
      const { repository } = createClosureRepository([
        closureRow({
          status: "failed",
          aggregate_count: "0",
          retry_count: "2",
          safe_reason_code: "component_unavailable",
          sanitized_set_digest: null,
        }),
        closureRow({
          operation: "footfall",
          status: "missed",
          aggregate_count: "0",
          retry_count: "4",
          safe_reason_code: "provider_advanced",
          sanitized_set_digest: null,
        }),
      ]);

      await expect(
        repository.readDailyClosure({
          integrationSourceId: SOURCE_ID,
          businessDate,
        }),
      ).resolves.toMatchObject({
        outcomes: [
          expect.objectContaining({ operation: "sales", status: "failed", aggregateCount: 0, retryCount: 2 }),
          expect.objectContaining({ operation: "footfall", status: "missed", aggregateCount: 0, retryCount: 4 }),
        ],
      });
    });
  });
});
