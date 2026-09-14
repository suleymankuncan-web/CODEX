import { BadRequestException } from "@nestjs/common";
import { CompanyDailyKpiStoreRangeService } from "./company-daily-kpi-store-range.service";
import type {
  CompanyDailyKpiStoreRangeRead,
  CompanyDailyKpiStoreRangeReadInput,
} from "../infrastructure/company-daily-kpi-component-range-read.repository";

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
const OUTCOME_ID = (index: number): string => syntheticUuid(0x300 + index);

const input = (): CompanyDailyKpiStoreRangeReadInput => ({
  integrationSourceId: SOURCE_ID,
  startDate: "2026-08-30",
  endDate: "2026-08-30",
  storeIds: [STORE_A_ID],
});

const completeRead = (): CompanyDailyKpiStoreRangeRead => ({
  sourceCode: "source-A",
  stores: [{ storeId: STORE_A_ID, storeCode: "store-A" }],
  outcomes: [
    {
      componentOutcomeId: OUTCOME_ID(1),
      businessDate: "2026-08-30",
      operation: "sales",
      status: "succeeded",
      persistedAggregateCount: 3,
      fullPhysicalFactCount: 3,
      sanitizedSetDigest: "a".repeat(64),
      storeFacts: [
        {
          businessDate: "2026-08-30",
          storeId: STORE_A_ID,
          storeCode: "store-A",
          saleInvoiceCount: 2,
          returnInvoiceCount: 0,
          saleQuantity: "3.000000000000",
          signedReturnQuantity: "0.000000000000",
          netQuantity: "3.000000000000",
          saleAmountTry: "100.000000000000",
          signedReturnAmountTry: "0.000000000000",
          netAmountTry: "100.000000000000",
        },
      ],
    },
    {
      componentOutcomeId: OUTCOME_ID(2),
      businessDate: "2026-08-30",
      operation: "footfall",
      status: "succeeded",
      persistedAggregateCount: 1,
      fullPhysicalFactCount: 1,
      sanitizedSetDigest: "b".repeat(64),
      storeFacts: [
        {
          businessDate: "2026-08-30",
          storeId: STORE_A_ID,
          storeCode: "store-A",
          footfall: 10,
        },
      ],
    },
    {
      componentOutcomeId: OUTCOME_ID(3),
      businessDate: "2026-08-30",
      operation: "gsm",
      status: "succeeded",
      persistedAggregateCount: 1,
      fullPhysicalFactCount: 1,
      sanitizedSetDigest: "c".repeat(64),
      storeFacts: [
        {
          businessDate: "2026-08-30",
          storeId: STORE_A_ID,
          storeCode: "store-A",
          yesCustomerCount: 3,
          totalCustomerCount: 5,
        },
      ],
    },
  ],
});

describe("CompanyDailyKpiStoreRangeService", () => {
  it("returns only deterministic store ratios while preserving the persisted count envelope", async () => {
    const repository = {
      readStoreRange: jest.fn(async () => completeRead()),
    };
    const service = new CompanyDailyKpiStoreRangeService(repository as never);

    await expect(service.readStoreRange(input())).resolves.toEqual([
      {
        storeCode: "store-A",
        conversion: {
          ratio: { availability: "available", numerator: "2", denominator: "10" },
          coverage: {
            expectedDays: ["2026-08-30"],
            includedDays: ["2026-08-30"],
            missingDays: [],
          },
        },
        gsmRate: {
          ratio: { availability: "available", numerator: "3", denominator: "5" },
          coverage: {
            expectedDays: ["2026-08-30"],
            includedDays: ["2026-08-30"],
            missingDays: [],
          },
        },
      },
    ]);
    expect(repository.readStoreRange).toHaveBeenCalledWith(input());
  });

  it("fails closed when a successful outcome persisted count disagrees with physical facts", async () => {
    const read = completeRead();
    read.outcomes = read.outcomes.map((outcome) =>
      outcome.operation === "sales"
        ? { ...outcome, fullPhysicalFactCount: 2 }
        : outcome,
    );
    const repository = { readStoreRange: jest.fn(async () => read) };
    const service = new CompanyDailyKpiStoreRangeService(repository as never);

    await expect(service.readStoreRange(input())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each(["failed", "missed"] as const)(
    "rejects a %s outcome that still has a typed fact",
    async (status) => {
      const read = completeRead();
      read.outcomes = read.outcomes.map((outcome) =>
        outcome.operation === "footfall"
          ? {
              ...outcome,
              status,
              persistedAggregateCount: 0,
              fullPhysicalFactCount: 1,
              sanitizedSetDigest: null,
            }
          : outcome,
      );
      const repository = { readStoreRange: jest.fn(async () => read) };
      const service = new CompanyDailyKpiStoreRangeService(repository as never);

      await expect(service.readStoreRange(input())).rejects.toThrow(
        "company_daily_kpi_storage_integrity_mismatch",
      );
    },
  );

  it("keeps succeeded-empty coverage missing and does not zero-fill an absent outcome", async () => {
    const read = completeRead();
    read.outcomes = read.outcomes
      .filter((outcome) => outcome.operation !== "gsm")
      .map((outcome) =>
        outcome.operation === "sales"
          ? {
              ...outcome,
              persistedAggregateCount: 0,
              fullPhysicalFactCount: 0,
              storeFacts: [],
            }
          : outcome,
      );
    const repository = { readStoreRange: jest.fn(async () => read) };
    const service = new CompanyDailyKpiStoreRangeService(repository as never);

    const result = await service.readStoreRange(input());
    expect(result[0]?.conversion).toEqual({
      ratio: { availability: "unavailable", reason: "no_eligible_days" },
      coverage: {
        expectedDays: ["2026-08-30"],
        includedDays: [],
        missingDays: ["2026-08-30"],
        warning: "incomplete_coverage",
      },
    });
    expect(result[0]?.gsmRate).toEqual({
      ratio: { availability: "unavailable", reason: "no_eligible_days" },
      coverage: {
        expectedDays: ["2026-08-30"],
        includedDays: [],
        missingDays: ["2026-08-30"],
        warning: "incomplete_coverage",
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /00000000|digest|retry|personnel|invoice|amount|quantity|source-A/i,
    );
  });

  it("rejects duplicate outcome identities and mismatched requested-store facts", async () => {
    const duplicate = completeRead();
    duplicate.outcomes = [...duplicate.outcomes, duplicate.outcomes[0]!];
    const duplicateRepository = {
      readStoreRange: jest.fn(async () => duplicate),
    };
    const duplicateService = new CompanyDailyKpiStoreRangeService(
      duplicateRepository as never,
    );
    await expect(duplicateService.readStoreRange(input())).rejects.toThrow(
      "company_daily_kpi_duplicate_outcome",
    );

    const mismatch = completeRead();
    mismatch.outcomes = mismatch.outcomes.map((outcome) =>
      outcome.operation === "sales"
        ? {
            ...outcome,
            storeFacts: outcome.storeFacts.map((fact) => ({
              ...fact,
              storeCode: "store-B",
            })),
          }
        : outcome,
    );
    const mismatchRepository = {
      readStoreRange: jest.fn(async () => mismatch),
    };
    const mismatchService = new CompanyDailyKpiStoreRangeService(
      mismatchRepository as never,
    );
    await expect(mismatchService.readStoreRange(input())).rejects.toThrow(
      "company_daily_kpi_store_fact_invalid",
    );
  });

  it("rejects ranges longer than 366 calendar days before repository access", async () => {
    const repository = { readStoreRange: jest.fn(async () => completeRead()) };
    const service = new CompanyDailyKpiStoreRangeService(repository as never);

    await expect(
      service.readStoreRange({
        ...input(),
        endDate: "2027-08-31",
      }),
    ).rejects.toThrow("company_daily_kpi_range_too_large");
    expect(repository.readStoreRange).not.toHaveBeenCalled();
  });

  it("accepts the 366-day and 250-store boundaries", async () => {
    const boundaryStoreIds = Array.from({ length: 250 }, (_, index) =>
      syntheticUuid(0x500 + index),
    );
    const boundaryRead: CompanyDailyKpiStoreRangeRead = {
      sourceCode: "source-A",
      stores: boundaryStoreIds.map((storeId, index) => ({
        storeId,
        storeCode: `store-${index}`,
      })),
      outcomes: [],
    };
    const repository = {
      readStoreRange: jest.fn(async () => boundaryRead),
    };
    const service = new CompanyDailyKpiStoreRangeService(repository as never);

    await expect(
      service.readStoreRange({
        integrationSourceId: SOURCE_ID,
        startDate: "2026-08-30",
        endDate: "2027-08-30",
        storeIds: boundaryStoreIds,
      }),
    ).resolves.toHaveLength(250);
    expect(repository.readStoreRange).toHaveBeenCalledTimes(1);
  });

  it("rejects more than 250 stores before repository access", async () => {
    const repository = { readStoreRange: jest.fn(async () => completeRead()) };
    const service = new CompanyDailyKpiStoreRangeService(repository as never);
    const storeIds = Array.from({ length: 251 }, (_, index) =>
      syntheticUuid(0x700 + index),
    );

    await expect(
      service.readStoreRange({ ...input(), storeIds }),
    ).rejects.toThrow("company_daily_kpi_store_scope_too_large");
    expect(repository.readStoreRange).not.toHaveBeenCalled();
  });
});
