import {
  normalizeCompanyDailyFootfall,
  normalizeCompanyDailyGsm,
  normalizeCompanyDailySales,
  sanitizeCompanyStoreDirectory,
} from "./company-daily-kpi-pure-adapter";

describe("company daily KPI pure adapter", () => {
  it("normalizes sales with exact signed decimals, scope-correct distinct counts, and no sensitive output", () => {
    const result = normalizeCompanyDailySales({
      sourceCode: "source-A",
      businessDate: "2026-08-30",
      retryCount: 0,
      rows: [
        {
          sourceDateToken: "2026-08-30",
          ephemeralInvoiceId: "invoice-A",
          personnelCode: "person-A",
          displayName: "display-A",
          storeCode: "store-A",
          isReturn: false,
          quantity: "1.10",
          amountTry: "10.10",
        },
        {
          sourceDateToken: "2026-08-30",
          ephemeralInvoiceId: "invoice-A",
          personnelCode: "person-A",
          displayName: "display-A",
          storeCode: "store-A",
          isReturn: false,
          quantity: "2.20",
          amountTry: "20.20",
        },
        {
          sourceDateToken: "2026-08-30",
          ephemeralInvoiceId: "invoice-B",
          personnelCode: "person-A",
          storeCode: "store-A",
          isReturn: true,
          quantity: "-0.30",
          amountTry: "-1.15",
        },
        {
          sourceDateToken: "2026-08-30",
          ephemeralInvoiceId: "invoice-C",
          personnelCode: "person-B",
          storeCode: "store-A",
          isReturn: false,
          quantity: "1",
          amountTry: "3.25",
        },
        {
          sourceDateToken: "2026-08-30",
          ephemeralInvoiceId: "invoice-A",
          personnelCode: "person-B",
          storeCode: "store-A",
          isReturn: false,
          quantity: "1",
          amountTry: "4.00",
        },
      ],
    });

    expect(result).toEqual({
      sourceCode: "source-A",
      operation: "sales",
      businessDate: "2026-08-30",
      status: "succeeded",
      aggregates: [
        {
          businessDate: "2026-08-30",
          storeCode: "store-A",
          personnelCode: "person-A",
          saleInvoiceCount: 1,
          returnInvoiceCount: 1,
          saleQuantity: "3.3",
          signedReturnQuantity: "-0.3",
          netQuantity: "3",
          saleAmountTry: "30.3",
          signedReturnAmountTry: "-1.15",
          netAmountTry: "29.15",
        },
        {
          businessDate: "2026-08-30",
          storeCode: "store-A",
          personnelCode: "person-B",
          saleInvoiceCount: 2,
          returnInvoiceCount: 0,
          saleQuantity: "2",
          signedReturnQuantity: "0",
          netQuantity: "2",
          saleAmountTry: "7.25",
          signedReturnAmountTry: "0",
          netAmountTry: "7.25",
        },
        {
          businessDate: "2026-08-30",
          storeCode: "store-A",
          saleInvoiceCount: 2,
          returnInvoiceCount: 1,
        },
      ],
      aggregateCount: 3,
      retryCount: 0,
      sanitizedSetDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });

    expect(JSON.stringify(result)).not.toMatch(/invoice-|display-/);
  });

  it("normalizes one footfall fact per store and rejects a duplicate store-day component", () => {
    const input = {
      sourceCode: "source-A",
      businessDate: "2026-08-30",
      retryCount: 1,
      rows: [
        {
          sourceDateToken: "2026-08-30T20:59:59Z",
          storeCode: "store-B",
          total: 12,
        },
        {
          sourceDateToken: "2026-08-30",
          storeCode: "store-A",
          total: 7,
        },
      ],
    };

    const result = normalizeCompanyDailyFootfall(input);

    expect(result).toEqual({
      sourceCode: "source-A",
      operation: "footfall",
      businessDate: "2026-08-30",
      status: "succeeded",
      aggregates: [
        { businessDate: "2026-08-30", storeCode: "store-A", footfall: 7 },
        { businessDate: "2026-08-30", storeCode: "store-B", footfall: 12 },
      ],
      aggregateCount: 2,
      retryCount: 1,
      sanitizedSetDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });

    expect(
      normalizeCompanyDailyFootfall({
        ...input,
        rows: [...input.rows, { ...input.rows[0], total: 3 }],
      }),
    ).toEqual({
      sourceCode: "source-A",
      operation: "footfall",
      businessDate: "2026-08-30",
      status: "failed",
      aggregates: [],
      aggregateCount: 0,
      retryCount: 1,
      safeReasonCode: "duplicate_store_day",
    });
  });

  it("assigns GSM observations to the target day and rejects an unknown consent value", () => {
    const input = {
      sourceCode: "source-A",
      businessDate: "2026-08-30",
      retryCount: 0,
      rows: [
        { storeCode: "store-B", consent: "no" as const },
        { storeCode: "store-A", consent: "yes" as const },
        { storeCode: "store-A", consent: "no" as const },
        { storeCode: "store-A", consent: "yes" as const },
      ],
    };

    expect(normalizeCompanyDailyGsm(input)).toEqual({
      sourceCode: "source-A",
      operation: "gsm",
      businessDate: "2026-08-30",
      status: "succeeded",
      aggregates: [
        {
          businessDate: "2026-08-30",
          storeCode: "store-A",
          yesCustomerCount: 2,
          totalCustomerCount: 3,
        },
        {
          businessDate: "2026-08-30",
          storeCode: "store-B",
          yesCustomerCount: 0,
          totalCustomerCount: 1,
        },
      ],
      aggregateCount: 2,
      retryCount: 0,
      sanitizedSetDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });

    expect(
      normalizeCompanyDailyGsm({
        ...input,
        rows: [{ storeCode: "store-A", consent: "unknown" as never }],
      }),
    ).toEqual({
      sourceCode: "source-A",
      operation: "gsm",
      businessDate: "2026-08-30",
      status: "failed",
      aggregates: [],
      aggregateCount: 0,
      retryCount: 0,
      safeReasonCode: "invalid_consent",
    });
  });

  it("excludes a missing personnel fact without name fallback while preserving store distinct sales", () => {
    const result = normalizeCompanyDailySales({
      sourceCode: "source-A",
      businessDate: "2026-08-30",
      retryCount: 0,
      rows: [
        {
          sourceDateToken: "2026-08-30",
          ephemeralInvoiceId: "invoice-A",
          personnelCode: "person-A",
          storeCode: "store-A",
          isReturn: false,
          quantity: "1",
          amountTry: "10",
        },
        {
          sourceDateToken: "2026-08-30",
          ephemeralInvoiceId: "invoice-B",
          personnelCode: "",
          displayName: "display-fallback",
          storeCode: "store-A",
          isReturn: false,
          quantity: "2",
          amountTry: "20",
        },
      ],
    });

    expect(result).toEqual({
      sourceCode: "source-A",
      operation: "sales",
      businessDate: "2026-08-30",
      status: "succeeded",
      aggregates: [
        {
          businessDate: "2026-08-30",
          storeCode: "store-A",
          personnelCode: "person-A",
          saleInvoiceCount: 1,
          returnInvoiceCount: 0,
          saleQuantity: "1",
          signedReturnQuantity: "0",
          netQuantity: "1",
          saleAmountTry: "10",
          signedReturnAmountTry: "0",
          netAmountTry: "10",
        },
        {
          businessDate: "2026-08-30",
          storeCode: "store-A",
          saleInvoiceCount: 2,
          returnInvoiceCount: 0,
        },
      ],
      aggregateCount: 2,
      retryCount: 0,
      safeReasonCode: "excluded_missing_personnel_code",
      sanitizedSetDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(result)).not.toContain("display-fallback");
  });

  it("reduces store-directory observations to deterministic unique codes", () => {
    const result = sanitizeCompanyStoreDirectory([
      { storeCode: "store-B", displayDescription: "display-B" },
      { storeCode: "store-A", displayDescription: "display-A" },
      { storeCode: "store-B", displayDescription: "display-other" },
    ]);

    expect(result).toEqual(["store-A", "store-B"]);
    expect(JSON.stringify(result)).not.toContain("display-");
  });

  it("rejects malformed or mismatched sales components with bounded safe reasons", () => {
    const baseRow = {
      sourceDateToken: "2026-08-30",
      ephemeralInvoiceId: "invoice-A",
      personnelCode: "person-A",
      storeCode: "store-A",
      isReturn: false,
      quantity: "1",
      amountTry: "10",
    };
    const normalize = (row: typeof baseRow) =>
      normalizeCompanyDailySales({
        sourceCode: "source-A",
        businessDate: "2026-08-30",
        retryCount: 2,
        rows: [row],
      });

    const failures = [
      normalize({ ...baseRow, sourceDateToken: "2026-08-29" }),
      normalize({ ...baseRow, amountTry: "" }),
      normalize({
        ...baseRow,
        isReturn: true,
        quantity: "1",
        amountTry: "10",
      }),
      normalize({ ...baseRow, isReturn: "false" as never }),
    ];

    expect(
      failures.map(({ status, aggregates, safeReasonCode }) => ({
        status,
        aggregateCount: aggregates.length,
        safeReasonCode,
      })),
    ).toEqual([
      {
        status: "failed",
        aggregateCount: 0,
        safeReasonCode: "source_date_mismatch",
      },
      {
        status: "failed",
        aggregateCount: 0,
        safeReasonCode: "invalid_decimal",
      },
      {
        status: "failed",
        aggregateCount: 0,
        safeReasonCode: "invalid_return_sign",
      },
      {
        status: "failed",
        aggregateCount: 0,
        safeReasonCode: "invalid_component_input",
      },
    ]);
  });

  it("keeps sanitized output and digest deterministic across row order and retry metadata", () => {
    const rows = [
      {
        sourceDateToken: "2026-08-30",
        ephemeralInvoiceId: "invoice-A",
        personnelCode: "person-B",
        displayName: "display-A",
        storeCode: "store-B",
        isReturn: false,
        quantity: "0.10",
        amountTry: "0.20",
      },
      {
        sourceDateToken: "2026-08-30",
        ephemeralInvoiceId: "invoice-B",
        personnelCode: "person-A",
        displayName: "display-B",
        storeCode: "store-A",
        isReturn: false,
        quantity: "0.20",
        amountTry: "0.30",
      },
    ];
    const first = normalizeCompanyDailySales({
      sourceCode: "source-A",
      businessDate: "2026-08-30",
      retryCount: 0,
      rows,
    });
    const equivalent = normalizeCompanyDailySales({
      sourceCode: "source-A",
      businessDate: "2026-08-30",
      retryCount: 4,
      rows: [...rows]
        .reverse()
        .map((row, index) => ({
          ...row,
          ephemeralInvoiceId: `invoice-retry-${index}`,
          displayName: `display-retry-${index}`,
        })),
    });
    const corrected = normalizeCompanyDailySales({
      sourceCode: "source-A",
      businessDate: "2026-08-30",
      retryCount: 5,
      rows: [{ ...rows[0], amountTry: "0.21" }, rows[1]],
    });

    expect(first.aggregates).toEqual(equivalent.aggregates);
    expect(first.sanitizedSetDigest).toBe(equivalent.sanitizedSetDigest);
    expect(corrected.sanitizedSetDigest).not.toBe(first.sanitizedSetDigest);
    expect(JSON.stringify([first, equivalent, corrected])).not.toMatch(
      /invoice-|display-/,
    );
  });
});
