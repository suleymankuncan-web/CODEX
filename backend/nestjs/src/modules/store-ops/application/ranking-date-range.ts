import { BadRequestException } from "@nestjs/common";
import { resolveMonthEnd } from "./ranking-list.helpers";

export function resolveRankingDateRange(input: {
  periodType?: string;
  periodStart?: string;
  periodEnd?: string;
}) {
  if (!input.periodEnd) return null;
  const valid = (value: string | undefined): value is string =>
    Boolean(
      value &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    );
  if (
    input.periodType !== "daily" ||
    !valid(input.periodStart) ||
    !valid(input.periodEnd)
  ) {
    throw new BadRequestException(
      "A daily range requires valid start and end dates",
    );
  }
  const days =
    (Date.parse(input.periodEnd) - Date.parse(input.periodStart)) / 86_400_000 +
    1;
  if (days < 1 || days > 366)
    throw new BadRequestException("Date range must contain 1 to 366 days");
  return {
    period_type: "daily",
    period_start: input.periodStart,
    period_end: input.periodEnd,
  };
}

/** Metadata for an empty authorized result retains the exact requested interval. */
export function resolveRequestedRankingPeriodEnd(input: {
  periodType?: string; periodStart?: string; periodEnd?: string;
}) {
  if (input.periodEnd) return input.periodEnd;
  if (!input.periodStart) return null;
  return input.periodType === "daily" ? input.periodStart : resolveMonthEnd(input.periodStart);
}
