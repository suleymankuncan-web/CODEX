import { BadRequestException } from "@nestjs/common";
import { CompanyDailyKpiDailyClosureReadRepository } from "./company-daily-kpi-daily-closure-read.repository";

const syntheticUuid = (suffix: number): string =>
  [
    "0".repeat(8),
    "0".repeat(4),
    "4".padEnd(4, "0"),
    "8".padEnd(4, "0"),
    suffix.toString(16).padStart(12, "0"),
  ].join("-");

const SOURCE_ID = syntheticUuid(1);
const OUTCOME_ID = syntheticUuid(0x301);

describe("CompanyDailyKpiDailyClosureReadRepository", () => {
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

  const createRepository = (rows: readonly Record<string, unknown>[]) => {
    const query = jest.fn(async (..._args: unknown[]) => ({
      rowCount: rows.length,
      rows,
    }));
    return {
      repository: new CompanyDailyKpiDailyClosureReadRepository({
        query,
      } as never),
      query,
    };
  };

  it("reads only safe outcome metadata in one parameterized statement", async () => {
    const { repository, query } = createRepository([
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
    expect(sql).toContain("LEFT JOIN ops.company_daily_kpi_component_outcome");
    expect(sql).not.toMatch(
      /company_daily_kpi_(employee_sales|store_sales|store_footfall|store_gsm)/,
    );
    expect(sql).not.toMatch(
      /kpi_import_enabled|close_date|open_date|status\s*=\s*['"]active['"]/i,
    );
  });

  it("returns a valid KPI source with no outcomes as an empty outcome set", async () => {
    const { repository } = createRepository([
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
    const { repository } = createRepository([emptyMarker, { ...emptyMarker }]);

    await expect(
      repository.readDailyClosure({
        integrationSourceId: SOURCE_ID,
        businessDate,
      }),
    ).rejects.toThrow("company_daily_kpi_missing_outcome_marker");
  });

  it("rejects strict input before querying", async () => {
    const { repository, query } = createRepository([]);
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
    [
      "unknown source",
      { source_match_count: "0", source_id: null, source_code: null },
    ],
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
    [
      "failed with aggregate count",
      { status: "failed", aggregate_count: "1", sanitized_set_digest: null },
    ],
    [
      "missed with digest",
      {
        status: "missed",
        aggregate_count: "0",
        sanitized_set_digest: "d".repeat(64),
      },
    ],
  ] as const)("fails closed for %s", async (label, overrides) => {
    const rows =
      label === "inconsistent source code"
        ? [
            closureRow(),
            closureRow({ operation: "footfall", source_code: "source-B" }),
          ]
        : [closureRow(overrides)];
    const { repository } = createRepository(rows);
    await expect(
      repository.readDailyClosure({
        integrationSourceId: SOURCE_ID,
        businessDate,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects duplicate operation rows and does not expose raw fields", async () => {
    const { repository } = createRepository([
      closureRow({ invoiceId: "invoice-A", component_outcome_id: OUTCOME_ID }),
      closureRow({
        invoiceId: "invoice-B",
        component_outcome_id: syntheticUuid(4),
      }),
    ]);
    await expect(
      repository.readDailyClosure({
        integrationSourceId: SOURCE_ID,
        businessDate,
      }),
    ).rejects.toThrow("company_daily_kpi_duplicate_outcome");

    const { repository: cleanRepository } = createRepository([
      closureRow({ invoiceId: "invoice-A", component_outcome_id: OUTCOME_ID }),
    ]);
    const result = await cleanRepository.readDailyClosure({
      integrationSourceId: SOURCE_ID,
      businessDate,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /invoice-A|component_outcome_id/i,
    );
  });

  it("retains failed and missed metadata without digest or aggregate facts", async () => {
    const { repository } = createRepository([
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
        expect.objectContaining({
          operation: "sales",
          status: "failed",
          aggregateCount: 0,
          retryCount: 2,
        }),
        expect.objectContaining({
          operation: "footfall",
          status: "missed",
          aggregateCount: 0,
          retryCount: 4,
        }),
      ],
    });
  });
});
