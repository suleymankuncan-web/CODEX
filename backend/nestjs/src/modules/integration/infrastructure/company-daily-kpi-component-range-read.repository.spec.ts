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
});
