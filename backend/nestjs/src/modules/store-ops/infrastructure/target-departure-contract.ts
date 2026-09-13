import { BadRequestException } from "@nestjs/common";
import { targetPersonnelSalesSql } from "./target-personnel-sales";
export type TargetDeparture = { employee_id: string; actual_sales: string | null };
export const targetDepartureSql = `SELECT e.employee_id::text,
  ${targetPersonnelSalesSql("e", "$2::uuid", "$3")} AS actual_sales
  FROM ops.employee e WHERE e.employee_id = ANY($1::uuid[])
    AND e.termination_date <= LEAST(($3::date + INTERVAL '1 month - 1 day')::date,
      (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date)
    AND (EXISTS (SELECT 1 FROM ops.employee_assignment_history a
      WHERE a.employee_id = e.employee_id AND a.store_id = $2::uuid AND a.is_primary_assignment = TRUE
        AND a.start_date <= ($3::date + INTERVAL '1 month - 1 day')::date
        AND (a.end_date IS NULL OR a.end_date >= $3::date))
      OR EXISTS (SELECT 1 FROM ops.personnel_target_reference r
        WHERE r.employee_id = e.employee_id AND r.store_id = $2::uuid
          AND r.period_start = $3::date AND r.target_type = 'monthly_sales_target' AND r.status = 'approved'))`;
export function assertDepartureTargets(rows: TargetDeparture[], allocations: Array<{employeeId: string; targetValue: number}>) {
  const amounts = new Map(allocations.map(a => [a.employeeId, a.targetValue]));
  for (const row of rows) {
    const sales = row.actual_sales === null ? NaN : Number(row.actual_sales);
    if (!Number.isFinite(sales) || sales < 0 || Math.abs((amounts.get(row.employee_id) ?? 0) - sales) > 0.00001) {
      throw new BadRequestException({code: "target_departure_sales_mismatch", message: "İşten ayrılan personelin hedefi gerçekleşen satış tutarıyla aynı olmalıdır. Satış verilerini yenileyip yeniden gönderin."});
    }
  }
}
