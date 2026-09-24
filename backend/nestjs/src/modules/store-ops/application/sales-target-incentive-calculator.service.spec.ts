import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SalesTargetIncentiveCalculatorService,
  canCloseSalesTargetIncentivePeriod,
  resolveSalesTargetIncentiveImportInclusion,
  resolveSalesTargetIncentivePeriod,
  truncateSalesTargetIncentivePayable,
} from "./sales-target-incentive-calculator.service";

describe("SalesTargetIncentiveCalculatorService", () => {
  const service = new SalesTargetIncentiveCalculatorService();

  describe("manager calculation", () => {
    it("calculates the confirmed manager example with decimal money math", () => {
      const result = service.calculateManager({
        storeOwnershipType: "company",
        storeTarget: "869565.217391",
        storeActualNetSales: "1000000.00",
      });

      expect(result).toEqual(
        expect.objectContaining({
          status: "projected",
          ruleVersionCode: "sales-target-incentive-v1.0.0",
          rateTableVersion: "manager-sales-target-v1.0.0",
          achievementPct: "115.0000",
          rate: "0.0100",
          rawEarnedAmount: "10000.000000",
          payableAmount: "10000.00",
        }),
      );
    });

    it.each([
      ["79.9999", "0.0000"],
      ["80.0000", "0.0020"],
      ["84.9999", "0.0020"],
      ["85.0000", "0.0030"],
      ["85.9600", "0.0030"],
      ["85.9900", "0.0030"],
      ["89.9600", "0.0030"],
      ["89.9999", "0.0030"],
      ["90.0000", "0.0040"],
      ["94.9999", "0.0040"],
      ["95.0000", "0.0050"],
      ["99.9999", "0.0050"],
      ["100.0000", "0.0070"],
      ["109.9999", "0.0070"],
      ["110.0000", "0.0100"],
      ["130.0000", "0.0100"],
    ])("selects exact manager bracket at %s percent", (actual, expectedRate) => {
      const result = service.calculateManager({
        storeOwnershipType: "company",
        storeTarget: "100.0000",
        storeActualNetSales: actual,
      });

      expect(result.achievementPct).toBe(actual);
      expect(result.rate).toBe(expectedRate);
    });

    it("does not cap manager payout above the top achievement bracket", () => {
      const result = service.calculateManager({
        storeOwnershipType: "company",
        storeTarget: "100.00",
        storeActualNetSales: "500.00",
      });

      expect(result.achievementPct).toBe("500.0000");
      expect(result.rate).toBe("0.0100");
      expect(result.payableAmount).toBe("5.00");
    });
  });

  describe("personnel calculation", () => {
    it("blocks personnel payout when the store gate fails even if personal target is exceeded", () => {
      const result = service.calculatePersonnel({
        storeOwnershipType: "company",
        positionCode: "SALES_ASSOCIATE",
        storeTarget: "6000000.00",
        storeActualNetSales: "3750000.00",
        personnelTarget: "1500000.00",
        personnelActualPositiveSales: "2000000.00",
      });

      expect(result).toEqual(
        expect.objectContaining({
          status: "projected",
          ruleVersionCode: "sales-target-incentive-v1.0.0",
          rateTableVersion: "personnel-sales-target-v1.0.0",
          storeAchievementPct: "62.5000",
          storeGatePassed: false,
          achievementPct: "133.3333",
          personalRateBeforeGate: "0.0165",
          rate: "0.0000",
          rawEarnedAmount: "0.000000",
          payableAmount: "0.00",
        }),
      );
    });

    it.each([
      ["79.9999", "0.0000"],
      ["80.0000", "0.0050"],
      ["84.9999", "0.0050"],
      ["85.0000", "0.0050"],
      ["85.9600", "0.0050"],
      ["85.9900", "0.0050"],
      ["89.9600", "0.0050"],
      ["89.9999", "0.0050"],
      ["90.0000", "0.0065"],
      ["94.9999", "0.0065"],
      ["95.0000", "0.0075"],
      ["99.9999", "0.0075"],
      ["100.0000", "0.0150"],
      ["109.9999", "0.0150"],
      ["110.0000", "0.0165"],
      ["130.0000", "0.0165"],
    ])("selects exact personnel bracket at %s percent", (actual, expectedRate) => {
      const result = service.calculatePersonnel({
        storeOwnershipType: "company",
        positionCode: "SALES_ASSOCIATE",
        storeTarget: "100.0000",
        storeActualNetSales: "100.0000",
        personnelTarget: "100.0000",
        personnelActualPositiveSales: actual,
      });

      expect(result.achievementPct).toBe(actual);
      expect(result.personalRateBeforeGate).toBe(expectedRate);
      expect(result.rate).toBe(expectedRate);
    });

    it("normalizes legacy SHIFT_LEAD to ASSISTANT_MANAGER for V1 personnel calculation", () => {
      const result = service.calculatePersonnel({
        storeOwnershipType: "company",
        positionCode: "SHIFT_LEAD",
        storeTarget: "100.00",
        storeActualNetSales: "100.00",
        personnelTarget: "100.00",
        personnelActualPositiveSales: "100.00",
      });

      expect(result.positionCode).toBe("ASSISTANT_MANAGER");
      expect(result.normalizedFromPositionCode).toBe("SHIFT_LEAD");
      expect(result.status).toBe("projected");
    });

    it("excludes cashier and non-company store rows from V1 calculation", () => {
      const cashier = service.calculatePersonnel({
        storeOwnershipType: "company",
        positionCode: "CASHIER",
        storeTarget: "100.00",
        storeActualNetSales: "100.00",
        personnelTarget: "100.00",
        personnelActualPositiveSales: "100.00",
      });
      const franchise = service.calculatePersonnel({
        storeOwnershipType: "franchise",
        positionCode: "SALES_ASSOCIATE",
        storeTarget: "100.00",
        storeActualNetSales: "100.00",
        personnelTarget: "100.00",
        personnelActualPositiveSales: "100.00",
      });

      expect(cashier).toEqual(
        expect.objectContaining({
          status: "excluded",
          excludedReason: "cashier_excluded_v1",
          payableAmount: null,
        }),
      );
      expect(franchise).toEqual(
        expect.objectContaining({
          status: "excluded",
          excludedReason: "non_company_store_excluded_v1",
          payableAmount: null,
        }),
      );
    });

    it("excludes store managers from the personnel formula to prevent double payout", () => {
      const result = service.calculatePersonnel({
        storeOwnershipType: "company",
        positionCode: "STORE_MANAGER",
        storeTarget: "100.00",
        storeActualNetSales: "100.00",
        personnelTarget: "100.00",
        personnelActualPositiveSales: "100.00",
      });

      expect(result).toEqual(
        expect.objectContaining({
          status: "excluded",
          excludedReason: "store_manager_uses_manager_formula_v1",
          payableAmount: null,
        }),
      );
    });
  });

  describe("missing source and precision policy", () => {
    it.each([
      ["manager missing target", { storeTarget: null }, "blocked", "missing_store_target"],
      ["manager zero target", { storeTarget: "0.00" }, "blocked", "invalid_store_target"],
      [
        "manager missing source",
        { storeActualNetSales: null },
        "no_source",
        "missing_store_sales_source",
      ],
    ])("%s", (_name, overrides, expectedStatus, expectedReason) => {
      const result = service.calculateManager({
        storeOwnershipType: "company",
        storeTarget: "100.00",
        storeActualNetSales: "100.00",
        ...overrides,
      });

      expect(result.status).toBe(expectedStatus);
      expect(result.blockedReason).toBe(expectedReason);
      expect(result.payableAmount).toBeNull();
    });

    it.each([
      [
        "personnel missing target",
        { personnelTarget: null },
        "blocked",
        "missing_personnel_target",
      ],
      [
        "personnel zero target",
        { personnelTarget: "0.00" },
        "blocked",
        "invalid_personnel_target",
      ],
      [
        "personnel missing source",
        { personnelActualPositiveSales: null },
        "no_source",
        "missing_personnel_sales_source",
      ],
    ])("%s", (_name, overrides, expectedStatus, expectedReason) => {
      const result = service.calculatePersonnel({
        storeOwnershipType: "company",
        positionCode: "SALES_ASSOCIATE",
        storeTarget: "100.00",
        storeActualNetSales: "100.00",
        personnelTarget: "100.00",
        personnelActualPositiveSales: "100.00",
        ...overrides,
      });

      expect(result.status).toBe(expectedStatus);
      expect(result.blockedReason).toBe(expectedReason);
      expect(result.payableAmount).toBeNull();
    });

    it("keeps zero and negative store actuals as valid projected zero payouts", () => {
      const zero = service.calculateManager({
        storeOwnershipType: "company",
        storeTarget: "100.00",
        storeActualNetSales: "0.00",
      });
      const negative = service.calculatePersonnel({
        storeOwnershipType: "company",
        positionCode: "SALES_ASSOCIATE",
        storeTarget: "100.00",
        storeActualNetSales: "-10.00",
        personnelTarget: "100.00",
        personnelActualPositiveSales: "200.00",
      });

      expect(zero).toEqual(
        expect.objectContaining({
          status: "projected",
          achievementPct: "0.0000",
          rate: "0.0000",
          payableAmount: "0.00",
        }),
      );
      expect(negative).toEqual(
        expect.objectContaining({
          status: "projected",
          storeAchievementPct: "-10.0000",
          storeGatePassed: false,
          personalRateBeforeGate: "0.0165",
          rate: "0.0000",
          payableAmount: "0.00",
        }),
      );
    });

    it("truncates sub-kurus results toward zero without JS floating point rounding", () => {
      const result = service.calculateManager({
        storeOwnershipType: "company",
        storeTarget: "100.00",
        storeActualNetSales: "123456.789999",
      });

      expect(result.rate).toBe("0.0100");
      expect(result.rawEarnedAmount).toBe("1234.56789999");
      expect(result.payableAmount).toBe("1234.56");
      expect(truncateSalesTargetIncentivePayable("0.009999")).toBe("0.00");
      expect(truncateSalesTargetIncentivePayable("-12.349999")).toBe("-12.34");
    });
  });

  describe("period, cutoff, and late import helpers", () => {
    it("assigns source timestamps to YYYY-MM in Europe/Istanbul", () => {
      expect(
        resolveSalesTargetIncentivePeriod({
          sourceSalesAt: "2026-03-31T20:59:59.999Z",
          sourcePeriodKey: null,
        }),
      ).toEqual({ status: "resolved", periodKey: "2026-03" });
      expect(
        resolveSalesTargetIncentivePeriod({
          sourceSalesAt: "2026-03-31T21:00:00.000Z",
          sourcePeriodKey: null,
        }),
      ).toEqual({ status: "resolved", periodKey: "2026-04" });
    });

    it("blocks ambiguous source period evidence instead of inferring from upload time", () => {
      expect(
        resolveSalesTargetIncentivePeriod({
          sourceSalesAt: "2026-04-15T12:00:00.000Z",
          sourcePeriodKey: "2026-05",
        }),
      ).toEqual({
        status: "blocked",
        blockedReason: "ambiguous_source_period",
      });
      expect(
        resolveSalesTargetIncentivePeriod({
          sourceSalesAt: null,
          sourcePeriodKey: null,
        }),
      ).toEqual({
        status: "blocked",
        blockedReason: "ambiguous_source_period",
      });
    });

    it("preserves the manual close cutoff for Europe/Istanbul", () => {
      expect(
        canCloseSalesTargetIncentivePeriod("2026-04", "2026-04-30T22:59:59.999Z"),
      ).toBe(false);
      expect(
        canCloseSalesTargetIncentivePeriod("2026-04", "2026-04-30T23:00:00.000Z"),
      ).toBe(true);
    });

    it("allows the daily-data close when the Istanbul calendar month has ended", () => {
      expect(canCloseSalesTargetIncentivePeriod("2026-04", "2026-04-30T20:59:59.999Z", 0)).toBe(false);
      expect(canCloseSalesTargetIncentivePeriod("2026-04", "2026-04-30T21:00:00.000Z", 0)).toBe(true);
    });

    it("excludes accepted imports after the final close cutoff", () => {
      const common = {
        expectedPeriodKey: "2026-04",
        sourceSalesAt: "2026-04-15T12:00:00.000Z",
        sourcePeriodKey: null,
        closeCutoffAt: "2026-05-01T00:00:00.000Z",
        importStatus: "accepted" as const,
      };

      expect(
        resolveSalesTargetIncentiveImportInclusion({
          ...common,
          acceptedAt: "2026-05-01T00:00:00.000Z",
        }),
      ).toEqual({ included: true });
      expect(
        resolveSalesTargetIncentiveImportInclusion({
          ...common,
          acceptedAt: "2026-05-01T00:00:00.001Z",
        }),
      ).toEqual({
        included: false,
        excludedReason: "accepted_after_close_cutoff",
      });
    });
  });

  it("keeps the calculation kernel isolated from database, Nest wiring, and UI imports", () => {
    const source = readFileSync(
      join(__dirname, "sales-target-incentive-calculator.service.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /from\s+["'](?:@nestjs|react|admin-web)|DatabaseService|Repository/i,
    );
  });
});
