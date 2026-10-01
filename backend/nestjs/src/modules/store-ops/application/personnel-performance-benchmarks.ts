import type { ReportingRepository } from '../infrastructure/reporting.repository';
import { hasUsableBenchmarkRows } from './reporting-performance.helpers';

/** Actuals and benchmark references must use the same range aggregation contract. */
export async function readPersonnelPerformanceBenchmarks(repository: ReportingRepository, input: {
  isRange: boolean;
  companyId?: string;
  periodType?: string;
  periodStart: string;
  periodEnd: string;
}) {
  const primary = await repository.getEmployeeTurkeyBenchmarkValues(input);
  return hasUsableBenchmarkRows(primary) ? primary
    : repository.getEmployeeTurkeyBenchmarkValues({ ...input, companyId: undefined });
}

/** Rankings retain their company-only fallback rule; unscoped reads run once. */
export async function readRankingPersonnelBenchmarks(repository: ReportingRepository, input: {
  isRange?: boolean;
  companyId?: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
}) {
  let rows = await repository.getEmployeeTurkeyBenchmarkValues(input);
  if (input.companyId && !hasUsableBenchmarkRows(rows)) {
    rows = await repository.getEmployeeTurkeyBenchmarkValues({ ...input, companyId: undefined });
  }
  return rows;
}
