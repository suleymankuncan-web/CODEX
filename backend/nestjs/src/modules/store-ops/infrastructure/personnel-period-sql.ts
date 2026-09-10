/** Approved target allocated to the inclusive fact period, including single days. */
export const personnelPeriodTargetSql = `(
  ptr.target_value * (ka.period_end - ka.period_start + 1)
  / NULLIF(ptr.period_end - ptr.period_start + 1, 0)
)`;
