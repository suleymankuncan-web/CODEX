import { BadRequestException } from "@nestjs/common";
import { resolveRankingDateRange } from "./ranking-date-range";

describe("ranking date range", () => {
  it("preserves requests without an end date", () => {
    expect(resolveRankingDateRange({ periodType: "monthly", periodStart: "2026-09-01" })).toBeNull();
  });
  it("accepts an inclusive single day and leap day", () => {
    expect(resolveRankingDateRange({ periodType: "daily", periodStart: "2024-02-29", periodEnd: "2024-02-29" })).toEqual({ period_type: "daily", period_start: "2024-02-29", period_end: "2024-02-29" });
  });
  it.each([
    { periodType: "monthly", periodStart: "2026-09-01", periodEnd: "2026-09-10" },
    { periodType: "daily", periodStart: "2026-02-29", periodEnd: "2026-03-01" },
    { periodType: "daily", periodStart: "2026-09-10", periodEnd: "2026-09-01" },
    { periodType: "daily", periodStart: "2024-01-01", periodEnd: "2025-01-01" },
    { periodType: "daily", periodEnd: "2026-09-10" },
  ])("rejects invalid or unbounded ranges: %j", input => {
    expect(() => resolveRankingDateRange(input)).toThrow(BadRequestException);
  });
});
