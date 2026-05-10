import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

@Injectable()
export class ReportingRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private hasStoreAccessScope(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
  }) {
    return (
      input.companyIds.length > 0 ||
      input.regionIds.length > 0 ||
      input.storeIds.length > 0
    );
  }

  private applyStoreAccessScope(
    clauses: string[],
    params: unknown[],
    input: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    },
    storeAlias: string,
  ) {
    if (input.storeIds.length > 0) {
      params.push(input.storeIds);
      clauses.push(`${storeAlias}.store_id = ANY($${params.length}::uuid[])`);
      return;
    }

    if (input.regionIds.length > 0) {
      params.push(input.regionIds);
      clauses.push(`${storeAlias}.region_id = ANY($${params.length}::uuid[])`);
      return;
    }

    if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`${storeAlias}.company_id = ANY($${params.length}::uuid[])`);
      return;
    }

    clauses.push("FALSE");
  }

  private applyTurnoverAccessScope(
    clauses: string[],
    params: unknown[],
    input: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    },
    turnoverAlias: string,
  ) {
    if (input.storeIds.length > 0) {
      params.push(input.storeIds);
      clauses.push(`${turnoverAlias}.store_id = ANY($${params.length}::uuid[])`);
      return;
    }

    if (input.regionIds.length > 0) {
      params.push(input.regionIds);
      clauses.push(`${turnoverAlias}.region_id = ANY($${params.length}::uuid[])`);
      return;
    }

    if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`${turnoverAlias}.company_id = ANY($${params.length}::uuid[])`);
      return;
    }

    clauses.push("FALSE");
  }

  private async countRows(
    fromClause: string,
    whereClause: string,
    params: unknown[],
  ): Promise<number> {
    const result = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        ${fromClause}
        ${whereClause}
      `,
      params,
    );

    return Number(result.rows[0]?.total_count ?? 0);
  }

  async getLatestCompletedSnapshotRun() {
    const result = await this.databaseService.query<{
      snapshot_run_id: string;
      snapshot_date: string;
      snapshot_type: string;
      period_start: string;
      period_end: string;
      run_status: string;
      generated_at: string;
      generated_by: string;
    }>(
      `
        SELECT
          sr.snapshot_run_id,
          sr.snapshot_date::text AS snapshot_date,
          sr.snapshot_type,
          sr.period_start::text AS period_start,
          sr.period_end::text AS period_end,
          sr.run_status,
          sr.generated_at,
          sr.generated_by
        FROM rpt.snapshot_run sr
        WHERE sr.run_status = 'completed'
        ORDER BY sr.generated_at DESC
        LIMIT 1
      `,
    );

    return result.rows[0] ?? null;
  }

  async getLatestCompletedSnapshotRunByType(snapshotType: string) {
    const result = await this.databaseService.query<{
      snapshot_run_id: string;
      snapshot_date: string;
      snapshot_type: string;
      period_start: string;
      period_end: string;
      run_status: string;
      generated_at: string;
      generated_by: string;
    }>(
      `
        SELECT
          sr.snapshot_run_id,
          sr.snapshot_date::text AS snapshot_date,
          sr.snapshot_type,
          sr.period_start::text AS period_start,
          sr.period_end::text AS period_end,
          sr.run_status,
          sr.generated_at,
          sr.generated_by
        FROM rpt.snapshot_run sr
        WHERE sr.run_status = 'completed'
          AND sr.snapshot_type = $1
          AND ($1 <> 'daily' OR sr.period_start = sr.period_end)
        ORDER BY sr.generated_at DESC
        LIMIT 1
      `,
      [snapshotType],
    );

    return result.rows[0] ?? null;
  }

  async getCompletedSnapshotRunByTypeAndDate(input: {
    snapshotType: string;
    periodStart: string;
    periodEnd: string;
  }) {
    const result = await this.databaseService.query<{
      snapshot_run_id: string;
      snapshot_date: string;
      snapshot_type: string;
      period_start: string;
      period_end: string;
      run_status: string;
      generated_at: string;
      generated_by: string;
    }>(
      `
        SELECT
          sr.snapshot_run_id,
          sr.snapshot_date::text AS snapshot_date,
          sr.snapshot_type,
          sr.period_start::text AS period_start,
          sr.period_end::text AS period_end,
          sr.run_status,
          sr.generated_at,
          sr.generated_by
        FROM rpt.snapshot_run sr
        WHERE sr.run_status = 'completed'
          AND sr.snapshot_type = $1
          AND sr.period_start = $2::date
          AND sr.period_end = $3::date
        ORDER BY sr.generated_at DESC
        LIMIT 1
      `,
      [input.snapshotType, input.periodStart, input.periodEnd],
    );

    return result.rows[0] ?? null;
  }

  async getCompletedDailySnapshotByDate(input: { periodStart: string }) {
    const result = await this.databaseService.query<{
      snapshot_run_id: string;
      snapshot_date: string;
      snapshot_type: string;
      period_start: string;
      period_end: string;
      run_status: string;
      generated_at: string;
      generated_by: string;
    }>(
      `
        SELECT
          sr.snapshot_run_id,
          sr.snapshot_date::text AS snapshot_date,
          sr.snapshot_type,
          sr.period_start::text AS period_start,
          sr.period_end::text AS period_end,
          sr.run_status,
          sr.generated_at,
          sr.generated_by
        FROM rpt.snapshot_run sr
        WHERE sr.run_status = 'completed'
          AND sr.snapshot_type = $1
          AND sr.period_start = $2::date
          AND sr.period_end = $2::date
        ORDER BY sr.generated_at DESC
        LIMIT 1
      `,
      ["daily", input.periodStart],
    );

    return result.rows[0] ?? null;
  }

  async getSnapshotRowCounts(snapshotRunId: string) {
    const workforceResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM rpt.store_workforce_snapshot
        WHERE snapshot_run_id = $1::uuid
      `,
      [snapshotRunId],
    );
    const kpiResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM rpt.store_kpi_snapshot
        WHERE snapshot_run_id = $1::uuid
      `,
      [snapshotRunId],
    );
    const checklistResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM rpt.store_checklist_snapshot
        WHERE snapshot_run_id = $1::uuid
      `,
      [snapshotRunId],
    );
    const turnoverResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM rpt.turnover_snapshot
        WHERE snapshot_run_id = $1::uuid
      `,
      [snapshotRunId],
    );

    return {
      workforceRows: Number(workforceResult.rows[0]?.total_count ?? 0),
      kpiRows: Number(kpiResult.rows[0]?.total_count ?? 0),
      checklistRows: Number(checklistResult.rows[0]?.total_count ?? 0),
      turnoverRows: Number(turnoverResult.rows[0]?.total_count ?? 0),
    };
  }

  async listSnapshotRuns(input: {
    runStatus?: string;
    snapshotType?: string;
    snapshotDate?: string;
    limit?: number;
    offset?: number;
  }) {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (input.runStatus) {
      params.push(input.runStatus);
      clauses.push(`sr.run_status = $${params.length}`);
    }

    if (input.snapshotType) {
      params.push(input.snapshotType);
      clauses.push(`sr.snapshot_type = $${params.length}`);
    }

    if (input.snapshotDate) {
      params.push(input.snapshotDate);
      clauses.push(`sr.snapshot_date = $${params.length}::date`);
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    params.push(input.limit ?? 50);
    const limitParam = params.length;
    params.push(input.offset ?? 0);
    const offsetParam = params.length;

    const result = await this.databaseService.query<{
      snapshot_run_id: string;
      snapshot_date: string;
      snapshot_type: string;
      period_start: string;
      period_end: string;
      run_status: string;
      generated_at: string;
      generated_by: string;
    }>(
      `
        SELECT
          sr.snapshot_run_id,
          sr.snapshot_date,
          sr.snapshot_type,
          sr.period_start,
          sr.period_end,
          sr.run_status,
          sr.generated_at,
          sr.generated_by
        FROM rpt.snapshot_run sr
        ${whereClause}
        ORDER BY sr.generated_at DESC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      params,
    );

    const total = await this.countRows("FROM rpt.snapshot_run sr", whereClause, params.slice(0, clauses.length));

    return {
      rows: result.rows,
      total,
    };
  }

  async getWorkforceReport(input: {
    snapshotRunId: string;
    storeId?: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    limit?: number;
    offset?: number;
  }) {
    if (!this.hasStoreAccessScope(input)) {
      return { rows: [], total: 0 };
    }

    const params: unknown[] = [input.snapshotRunId];
    const clauses = [`sws.snapshot_run_id = $1::uuid`];

    if (input.storeId) {
      params.push(input.storeId);
      clauses.push(`sws.store_id = $${params.length}::uuid`);
    }
    this.applyStoreAccessScope(clauses, params, input, "s");

    params.push(input.limit ?? 50);
    const limitParam = params.length;
    params.push(input.offset ?? 0);
    const offsetParam = params.length;

    const fromClause = `
        FROM rpt.store_workforce_snapshot sws
        INNER JOIN ops.store s
          ON s.store_id = sws.store_id
    `;

    const result = await this.databaseService.query<{
      snapshot_run_id: string;
      store_id: string;
      position_id: string;
      active_headcount: string;
      active_fte: string;
      planned_headcount: string;
      planned_fte: string;
      gap_headcount: string;
      gap_fte: string;
    }>(
      `
        SELECT
          sws.snapshot_run_id,
          sws.store_id,
          sws.position_id,
          sws.active_headcount,
          sws.active_fte,
          sws.planned_headcount,
          sws.planned_fte,
          sws.gap_headcount,
          sws.gap_fte
        ${fromClause}
        WHERE ${clauses.join(" AND ")}
        ORDER BY sws.store_id ASC, sws.position_id ASC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      params,
    );

    const total = await this.countRows(fromClause, `WHERE ${clauses.join(" AND ")}`, params.slice(0, offsetParam - 2));

    return {
      rows: result.rows,
      total,
    };
  }

  async getKpiReport(input: {
    snapshotRunId: string;
    storeId?: string;
    kpiId?: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    limit?: number;
    offset?: number;
  }) {
    if (!this.hasStoreAccessScope(input)) {
      return { rows: [], total: 0 };
    }

    const params: unknown[] = [input.snapshotRunId];
    const clauses = [`sks.snapshot_run_id = $1::uuid`];

    if (input.storeId) {
      params.push(input.storeId);
      clauses.push(`sks.store_id = $${params.length}::uuid`);
    }
    this.applyStoreAccessScope(clauses, params, input, "s");

    if (input.kpiId) {
      params.push(input.kpiId);
      clauses.push(`sks.kpi_id = $${params.length}::uuid`);
    }

    params.push(input.limit ?? 50);
    const limitParam = params.length;
    params.push(input.offset ?? 0);
    const offsetParam = params.length;

      const fromClause = `
        FROM rpt.store_kpi_snapshot sks
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = sks.kpi_id
        INNER JOIN ops.store s
          ON s.store_id = sks.store_id
    `;

      const result = await this.databaseService.query<{
        snapshot_run_id: string;
        store_id: string;
        kpi_id: string;
        kpi_code: string;
        kpi_name: string;
        period_start: string;
        period_end: string;
        target_value: string | null;
        actual_value: string | null;
        achievement_rate: string | null;
      status_band: string | null;
    }>(
      `
        SELECT
          sks.snapshot_run_id,
          sks.store_id,
          sks.kpi_id,
          kd.kpi_code,
          kd.kpi_name,
          sks.period_start,
          sks.period_end,
          sks.target_value,
          sks.actual_value,
          sks.achievement_rate,
          sks.status_band
        ${fromClause}
        WHERE ${clauses.join(" AND ")}
        ORDER BY sks.store_id ASC, sks.kpi_id ASC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      params,
    );

    const total = await this.countRows(fromClause, `WHERE ${clauses.join(" AND ")}`, params.slice(0, offsetParam - 2));

    return {
      rows: result.rows,
      total,
    };
  }

  async getChecklistReport(input: {
    snapshotRunId: string;
    storeId?: string;
    checklistTemplateId?: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    limit?: number;
    offset?: number;
  }) {
    if (!this.hasStoreAccessScope(input)) {
      return { rows: [], total: 0 };
    }

    const params: unknown[] = [input.snapshotRunId];
    const clauses = [`scs.snapshot_run_id = $1::uuid`];

    if (input.storeId) {
      params.push(input.storeId);
      clauses.push(`scs.store_id = $${params.length}::uuid`);
    }
    this.applyStoreAccessScope(clauses, params, input, "s");

    if (input.checklistTemplateId) {
      params.push(input.checklistTemplateId);
      clauses.push(`scs.checklist_template_id = $${params.length}::uuid`);
    }

    params.push(input.limit ?? 50);
    const limitParam = params.length;
    params.push(input.offset ?? 0);
    const offsetParam = params.length;

    const fromClause = `
        FROM rpt.store_checklist_snapshot scs
        INNER JOIN ops.store s
          ON s.store_id = scs.store_id
    `;

    const result = await this.databaseService.query<{
      snapshot_run_id: string;
      store_id: string;
      checklist_template_id: string;
      audit_count: number;
      avg_score: string | null;
      compliance_rate: string | null;
      critical_issue_count: number;
    }>(
      `
        SELECT
          scs.snapshot_run_id,
          scs.store_id,
          scs.checklist_template_id,
          scs.audit_count,
          scs.avg_score,
          scs.compliance_rate,
          scs.critical_issue_count
        ${fromClause}
        WHERE ${clauses.join(" AND ")}
        ORDER BY scs.store_id ASC, scs.checklist_template_id ASC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      params,
    );

    const total = await this.countRows(fromClause, `WHERE ${clauses.join(" AND ")}`, params.slice(0, offsetParam - 2));

    return {
      rows: result.rows,
      total,
    };
  }

  async getStoreKpiSnapshotRowsForScore(input: {
    snapshotRunId: string;
    storeId: string;
  }) {
    const result = await this.databaseService.query<{
      kpi_code: string;
      actual_value: string | null;
      target_value: string | null;
      achievement_rate: string | null;
    }>(
      `
        SELECT
          kd.kpi_code,
          sks.actual_value::text AS actual_value,
          sks.target_value::text AS target_value,
          sks.achievement_rate::text AS achievement_rate
        FROM rpt.store_kpi_snapshot sks
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = sks.kpi_id
        WHERE sks.snapshot_run_id = $1::uuid
          AND sks.store_id = $2::uuid
        ORDER BY kd.kpi_code ASC
      `,
      [input.snapshotRunId, input.storeId],
    );

    return result.rows;
  }

  async getStoreChecklistSnapshotForScore(input: {
    snapshotRunId: string;
    storeId: string;
    templateType: string;
  }) {
    const result = await this.databaseService.query<{
      checklist_template_id: string;
      audit_count: number;
      avg_score: string | null;
    }>(
      `
        SELECT
          scs.checklist_template_id,
          scs.audit_count,
          scs.avg_score::text AS avg_score
        FROM rpt.store_checklist_snapshot scs
        INNER JOIN ops.checklist_template ct
          ON ct.checklist_template_id = scs.checklist_template_id
        WHERE scs.snapshot_run_id = $1::uuid
          AND scs.store_id = $2::uuid
          AND ct.template_type = $3
        ORDER BY scs.audit_count DESC, scs.checklist_template_id ASC
        LIMIT 1
      `,
      [input.snapshotRunId, input.storeId, input.templateType],
    );

    return result.rows[0] ?? null;
  }

  async getTurnoverReport(input: {
    snapshotRunId: string;
    scopeType?: string;
    companyId?: string;
    regionId?: string;
    storeId?: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    limit?: number;
    offset?: number;
  }) {
    if (!this.hasStoreAccessScope(input)) {
      return { rows: [], total: 0 };
    }

    const params: unknown[] = [input.snapshotRunId];
    const clauses = [`ts.snapshot_run_id = $1::uuid`];

    if (input.scopeType) {
      params.push(input.scopeType);
      clauses.push(`ts.scope_type = $${params.length}`);
    }

    if (input.storeId) {
      params.push(input.storeId);
      clauses.push(`ts.store_id = $${params.length}::uuid`);
    } else if (input.regionId) {
      params.push(input.regionId);
      clauses.push(`ts.region_id = $${params.length}::uuid`);
    } else if (input.companyId) {
      params.push(input.companyId);
      clauses.push(`ts.company_id = $${params.length}::uuid`);
    }
    this.applyTurnoverAccessScope(clauses, params, input, "ts");

    params.push(input.limit ?? 50);
    const limitParam = params.length;
    params.push(input.offset ?? 0);
    const offsetParam = params.length;

    const fromClause = `
        FROM rpt.turnover_snapshot ts
    `;

    const result = await this.databaseService.query<{
      snapshot_run_id: string;
      scope_type: string;
      company_id: string | null;
      region_id: string | null;
      store_id: string | null;
      period_start: string;
      period_end: string;
      opening_headcount: string;
      closing_headcount: string;
      avg_headcount: string;
      leaver_count: number;
      turnover_rate: string;
    }>(
      `
        SELECT
          ts.snapshot_run_id,
          ts.scope_type,
          ts.company_id,
          ts.region_id,
          ts.store_id,
          ts.period_start,
          ts.period_end,
          ts.opening_headcount,
          ts.closing_headcount,
          ts.avg_headcount,
          ts.leaver_count,
          ts.turnover_rate
        ${fromClause}
        WHERE ${clauses.join(" AND ")}
        ORDER BY ts.scope_type ASC, ts.company_id ASC NULLS LAST, ts.region_id ASC NULLS LAST, ts.store_id ASC NULLS LAST
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      params,
    );

    const total = await this.countRows(fromClause, `WHERE ${clauses.join(" AND ")}`, params.slice(0, offsetParam - 2));

    return {
      rows: result.rows,
      total,
    };
  }

  async getEmployeeIdForUser(userId: string) {
    const result = await this.databaseService.query<{ employee_id: string | null }>(
      `
        SELECT employee_id
        FROM ops.user_account
        WHERE user_id = $1::uuid
      `,
      [userId],
    );

    return result.rows[0]?.employee_id ?? null;
  }

  async resolveEmployeeIdForAuthIdentity(input: {
    userId: string;
    employeeId?: string;
    companyIds: string[];
  }) {
    const employeeClaim = input.employeeId?.trim();

    if (employeeClaim) {
      if (this.isUuid(employeeClaim)) {
        return employeeClaim;
      }

      const resolvedByExternalRef = await this.getEmployeeIdByExternalRef({
        externalEmployeeRef: employeeClaim,
        companyIds: input.companyIds,
      });

      if (resolvedByExternalRef) {
        return resolvedByExternalRef;
      }
    }

    if (!this.isUuid(input.userId)) {
      return null;
    }

    return this.getEmployeeIdForUser(input.userId);
  }

  async getEmployeeIdByExternalRef(input: {
    externalEmployeeRef: string;
    companyIds: string[];
  }) {
    if (input.companyIds.length === 0) {
      return null;
    }

    const params: unknown[] = [input.externalEmployeeRef];
    const clauses = [`external_employee_ref = $1`];

    if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`company_id = ANY($${params.length}::uuid[])`);
    }

    const result = await this.databaseService.query<{ employee_id: string }>(
      `
        SELECT employee_id
        FROM ops.employee
        WHERE ${clauses.join(" AND ")}
        ORDER BY created_at DESC, employee_id ASC
        LIMIT 1
      `,
      params,
    );

    return result.rows[0]?.employee_id ?? null;
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  async getStoreNameById(storeId: string) {
    const result = await this.databaseService.query<{ store_name: string | null }>(
      `
        SELECT store_name
        FROM ops.store
        WHERE store_id = $1::uuid
        LIMIT 1
      `,
      [storeId],
    );

    return result.rows[0]?.store_name ?? null;
  }

  async getLatestStoreKpiPeriod(input: {
    storeId: string;
    metricCodes: string[];
    periodType?: string;
    periodStart?: string;
  }) {
    const params: unknown[] = [input.storeId, input.metricCodes];
    const clauses = [
      `ka.store_id = $1::uuid`,
      `ka.scope_type = 'store'`,
      `kd.kpi_code = ANY($2::text[])`,
    ];

    if (input.periodType) {
      params.push(input.periodType);
      clauses.push(`ka.period_type = $${params.length}`);
    }

    if (input.periodStart) {
      params.push(input.periodStart);
      clauses.push(`ka.period_start = $${params.length}::date`);
    }

    const result = await this.databaseService.query<{
      period_type: string;
      period_start: string;
      period_end: string;
    }>(
      `
        SELECT
          ka.period_type,
          ka.period_start,
          ka.period_end
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY ka.period_end DESC, ka.period_start DESC
        LIMIT 1
      `,
      params,
    );

    return result.rows[0] ?? null;
  }

  async listStoreKpiPeriods(input: {
    storeId: string;
    metricCodes: string[];
  }) {
    const result = await this.databaseService.query<{
      period_type: string;
      period_start: string;
      period_end: string;
    }>(
      `
        SELECT DISTINCT
          ka.period_type,
          ka.period_start,
          ka.period_end
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        WHERE ka.store_id = $1::uuid
          AND ka.scope_type = 'store'
          AND kd.kpi_code = ANY($2::text[])
        ORDER BY 3 DESC, 2 DESC
      `,
      [input.storeId, input.metricCodes],
    );

    return result.rows;
  }

  async getStorePerformanceRows(input: {
    storeId: string;
    metricCodes: string[];
    periodType: string;
    periodStart: string;
    periodEnd: string;
  }) {
    const result = await this.databaseService.query<{
      store_id: string;
      store_name: string;
      kpi_code: string;
      kpi_name: string;
      actual_value: string | null;
      target_value: string | null;
    }>(
      `
        SELECT
          store.store_id,
          store.store_name,
          kd.kpi_code,
          kd.kpi_name,
          ka.actual_value::text AS actual_value,
          kt.target_value::text AS target_value
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        INNER JOIN ops.store store
          ON store.store_id = ka.store_id
        LEFT JOIN ops.kpi_target kt
          ON kt.kpi_id = ka.kpi_id
          AND kt.scope_type = 'store'
          AND kt.store_id = ka.store_id
          AND kt.period_type = ka.period_type
          AND kt.period_start = ka.period_start
          AND kt.period_end = ka.period_end
        WHERE ka.store_id = $1::uuid
          AND ka.scope_type = 'store'
          AND kd.kpi_code = ANY($2::text[])
          AND ka.period_type = $3
          AND ka.period_start = $4::date
          AND ka.period_end = $5::date
        ORDER BY kd.kpi_code ASC
      `,
      [
        input.storeId,
        input.metricCodes,
        input.periodType,
        input.periodStart,
        input.periodEnd,
      ],
    );

    return result.rows;
  }

  async getPeerStorePerformanceRows(input: {
    metricCodes: string[];
    companyId?: string;
    periodType: string;
    periodStart: string;
    periodEnd: string;
  }) {
    const params: unknown[] = [
      input.metricCodes,
      input.periodType,
      input.periodStart,
      input.periodEnd,
    ];
    const clauses = [
      `ka.scope_type = 'store'`,
      `kd.kpi_code = ANY($1::text[])`,
      `ka.period_type = $2`,
      `ka.period_start = $3::date`,
      `ka.period_end = $4::date`,
    ];

    if (input.companyId) {
      params.push(input.companyId);
      clauses.push(`ka.company_id = $${params.length}::uuid`);
    }

    const result = await this.databaseService.query<{
      store_id: string;
      kpi_code: string;
      actual_value: string;
    }>(
      `
        SELECT
          ka.store_id,
          kd.kpi_code,
          ka.actual_value::text AS actual_value
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY ka.store_id ASC, kd.kpi_code ASC
      `,
      params,
    );

    return result.rows;
  }

  async getStoreTurkeyBenchmarkValues(input: {
    periodType: string;
    periodStart: string;
    periodEnd: string;
    companyId?: string;
  }) {
    const params: unknown[] = [
      input.periodType,
      input.periodStart,
      input.periodEnd,
    ];
    const companyClause = input.companyId
      ? (() => {
          params.push(input.companyId);
          return `AND store.company_id = $${params.length}::uuid`;
        })()
      : "";

    const result = await this.databaseService.query<{
      kpi_code: string;
      benchmark_value: string | null;
    }>(
      `
        SELECT
          kd.kpi_code,
          AVG(ka.actual_value)::text AS benchmark_value
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        INNER JOIN ops.store store
          ON store.store_id = ka.store_id
        WHERE ka.scope_type = 'store'
          AND ka.period_type = $1
          AND ka.period_start >= $2::date
          AND ka.period_end <= $3::date
          AND kd.kpi_code IN ('ATV', 'UPT', 'CR')
          AND COALESCE(ka.source_type, '') <> 'demo_seed'
          ${companyClause}
        GROUP BY kd.kpi_code
        ORDER BY kd.kpi_code ASC
      `,
      params,
    );

    return result.rows;
  }

  async getEmployeeTurkeyBenchmarkValues(input: {
    periodStart: string;
    periodEnd: string;
    companyId?: string;
    periodType?: string;
  }) {
    const params: unknown[] = [input.periodStart, input.periodEnd];
    const clauses = [
      `ka.scope_type = 'employee'`,
      `ka.period_start >= $1::date`,
      `ka.period_end <= $2::date`,
      `kd.kpi_code IN ('ATV', 'UPT')`,
      `COALESCE(ka.source_type, '') <> 'demo_seed'`,
    ];

    if (input.periodType) {
      params.push(input.periodType);
      clauses.push(`ka.period_type = $${params.length}`);
    }

    if (input.companyId) {
      params.push(input.companyId);
      clauses.push(`ka.company_id = $${params.length}::uuid`);
    }

    const result = await this.databaseService.query<{
      kpi_code: string;
      benchmark_value: string | null;
    }>(
      `
        SELECT
          kd.kpi_code,
          AVG(ka.actual_value)::text AS benchmark_value
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        WHERE ${clauses.join(" AND ")}
        GROUP BY kd.kpi_code
        ORDER BY kd.kpi_code ASC
      `,
      params,
    );

    return result.rows;
  }

  async getLatestEmployeeKpiPeriod(input: {
    employeeId: string;
    metricCodes: string[];
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    periodType?: string;
    periodStart?: string;
  }) {
    if (!this.hasStoreAccessScope(input)) {
      return null;
    }

    const params: unknown[] = [input.employeeId, input.metricCodes];
    const clauses = [
      `ka.employee_id = $1::uuid`,
      `ka.scope_type = 'employee'`,
      `kd.kpi_code = ANY($2::text[])`,
    ];

    if (input.periodType) {
      params.push(input.periodType);
      clauses.push(`ka.period_type = $${params.length}`);
    }

    if (input.periodStart) {
      params.push(input.periodStart);
      clauses.push(`ka.period_start = $${params.length}::date`);
    }

    if (input.storeIds.length > 0) {
      params.push(input.storeIds);
      clauses.push(`ka.store_id = ANY($${params.length}::uuid[])`);
    } else if (input.regionIds.length > 0) {
      params.push(input.regionIds);
      clauses.push(`ka.region_id = ANY($${params.length}::uuid[])`);
    } else if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`ka.company_id = ANY($${params.length}::uuid[])`);
    }

    const result = await this.databaseService.query<{
      period_start: string;
      period_end: string;
      store_id: string | null;
    }>(
      `
        SELECT
          ka.period_start,
          ka.period_end,
          ka.store_id
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY ka.period_end DESC, ka.period_start DESC
        LIMIT 1
      `,
      params,
    );

    return result.rows[0] ?? null;
  }

  async listEmployeeKpiPeriods(input: {
    employeeId: string;
    metricCodes: string[];
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
  }) {
    if (!this.hasStoreAccessScope(input)) {
      return [];
    }

    const params: unknown[] = [input.employeeId, input.metricCodes];
    const clauses = [
      `ka.employee_id = $1::uuid`,
      `ka.scope_type = 'employee'`,
      `kd.kpi_code = ANY($2::text[])`,
    ];

    if (input.storeIds.length > 0) {
      params.push(input.storeIds);
      clauses.push(`ka.store_id = ANY($${params.length}::uuid[])`);
    } else if (input.regionIds.length > 0) {
      params.push(input.regionIds);
      clauses.push(`ka.region_id = ANY($${params.length}::uuid[])`);
    } else if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`ka.company_id = ANY($${params.length}::uuid[])`);
    }

    const result = await this.databaseService.query<{
      period_type: string;
      period_start: string;
      period_end: string;
    }>(
      `
        SELECT DISTINCT
          ka.period_type,
          ka.period_start,
          ka.period_end
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY 3 DESC, 2 DESC
      `,
      params,
    );

    return result.rows;
  }

  async getEmployeePerformanceRows(input: {
    employeeId: string;
    metricCodes: string[];
    periodStart: string;
    periodEnd: string;
  }) {
    const result = await this.databaseService.query<{
      employee_id: string;
      first_name: string;
      last_name: string;
      store_id: string | null;
      store_name: string | null;
      kpi_code: string;
      kpi_name: string;
      target_value: string | null;
      personnel_target_reference_id: string | null;
      actual_value: string;
    }>(
      `
        SELECT
          e.employee_id,
          e.first_name,
          e.last_name,
          assignment.store_id,
          store.store_name,
          kd.kpi_code,
          kd.kpi_name,
          ptr.target_value::text AS target_value,
          ptr.personnel_target_reference_id::text AS personnel_target_reference_id,
          ka.actual_value::text AS actual_value
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        LEFT JOIN ops.personnel_target_reference ptr
          ON ptr.employee_id = ka.employee_id
         AND ptr.period_start <= ka.period_start
         AND ptr.period_end >= ka.period_end
         AND ptr.target_type = 'monthly_sales_target'
         AND ptr.status = 'approved'
         AND kd.kpi_code = 'TARGET_ACHIEVEMENT'
        INNER JOIN ops.employee e
          ON e.employee_id = ka.employee_id
        LEFT JOIN LATERAL (
          SELECT eah.store_id
          FROM ops.employee_assignment_history eah
          WHERE eah.employee_id = e.employee_id
            AND eah.assignment_status = 'active'
          ORDER BY eah.start_date DESC
          LIMIT 1
        ) assignment ON TRUE
        LEFT JOIN ops.store store
          ON store.store_id = assignment.store_id
        WHERE ka.employee_id = $1::uuid
          AND ka.scope_type = 'employee'
          AND kd.kpi_code = ANY($2::text[])
          AND ka.period_start = $3::date
          AND ka.period_end = $4::date
        ORDER BY kd.kpi_code ASC
      `,
      [input.employeeId, input.metricCodes, input.periodStart, input.periodEnd],
    );

    return result.rows;
  }

  async getPeerEmployeePerformanceRows(input: {
    metricCodes: string[];
    companyId?: string;
    storeId?: string | null;
    periodStart: string;
    periodEnd: string;
  }) {
    const params: unknown[] = [input.metricCodes, input.periodStart, input.periodEnd];
    const clauses = [
      `ka.scope_type = 'employee'`,
      `kd.kpi_code = ANY($1::text[])`,
      `ka.period_start = $2::date`,
      `ka.period_end = $3::date`,
    ];

    if (input.companyId) {
      params.push(input.companyId);
      clauses.push(`ka.company_id = $${params.length}::uuid`);
    }

    if (input.storeId) {
      params.push(input.storeId);
      clauses.push(`ka.store_id = $${params.length}::uuid`);
    }

    const result = await this.databaseService.query<{
      employee_id: string;
      first_name: string;
      last_name: string;
      store_id: string | null;
      store_name: string | null;
      kpi_code: string;
      kpi_name: string;
      target_value: string | null;
      personnel_target_reference_id: string | null;
      actual_value: string;
    }>(
      `
        SELECT
          ka.employee_id,
          e.first_name,
          e.last_name,
          ka.store_id,
          store.store_name,
          kd.kpi_code,
          kd.kpi_name,
          ptr.target_value::text AS target_value,
          ptr.personnel_target_reference_id::text AS personnel_target_reference_id,
          ka.actual_value::text AS actual_value
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        INNER JOIN ops.employee e
          ON e.employee_id = ka.employee_id
        LEFT JOIN ops.store store
          ON store.store_id = ka.store_id
        LEFT JOIN ops.personnel_target_reference ptr
          ON ptr.employee_id = ka.employee_id
         AND ptr.period_start <= ka.period_start
         AND ptr.period_end >= ka.period_end
         AND ptr.target_type = 'monthly_sales_target'
         AND ptr.status = 'approved'
         AND kd.kpi_code = 'TARGET_ACHIEVEMENT'
        WHERE ${clauses.join(" AND ")}
        ORDER BY ka.employee_id ASC, kd.kpi_code ASC
      `,
      params,
    );

    return result.rows;
  }

  async getLatestMonthlyRankingPeriod(input: {
    metricCodes: string[];
    periodStart?: string;
  }) {
    if (input.metricCodes.length === 0) {
      return null;
    }

    const params: unknown[] = [input.metricCodes];
    const clauses = [
      `ka.period_type = 'monthly'`,
      `kd.kpi_code = ANY($1::text[])`,
      `COALESCE(ka.source_type, '') <> 'demo_seed'`,
    ];

    if (input.periodStart) {
      params.push(input.periodStart);
      clauses.push(`ka.period_start = $${params.length}::date`);
    }

    const result = await this.databaseService.query<{
      period_type: string;
      period_start: string;
      period_end: string;
    }>(
      `
        SELECT
          ka.period_type,
          ka.period_start::text AS period_start,
          ka.period_end::text AS period_end
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY ka.period_end DESC, ka.period_start DESC
        LIMIT 1
      `,
      params,
    );

    return result.rows[0] ?? null;
  }

  async listRankingAvailablePeriods(input: { metricCodes: string[] }) {
    if (input.metricCodes.length === 0) {
      return [];
    }

    const result = await this.databaseService.query<{
      period_type: string;
      period_start: string;
      period_end: string;
    }>(
      `
        SELECT DISTINCT
          ka.period_type,
          ka.period_start::text AS period_start,
          ka.period_end::text AS period_end
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        WHERE ka.period_type = 'monthly'
          AND kd.kpi_code = ANY($1::text[])
          AND COALESCE(ka.source_type, '') <> 'demo_seed'
        ORDER BY 3 DESC, 2 DESC
      `,
      [input.metricCodes],
    );

    return result.rows;
  }

  async listRankingStoreKpiRows(input: {
    metricCodes: string[];
    companyIds: string[];
    periodType: string;
    periodStart: string;
    periodEnd: string;
  }) {
    if (input.metricCodes.length === 0) {
      return [];
    }

    const params: unknown[] = [
      input.metricCodes,
      input.periodType,
      input.periodStart,
      input.periodEnd,
    ];
    const clauses = [
      `ka.scope_type = 'store'`,
      `kd.kpi_code = ANY($1::text[])`,
      `ka.period_type = $2`,
      `ka.period_start = $3::date`,
      `ka.period_end = $4::date`,
      `COALESCE(ka.source_type, '') <> 'demo_seed'`,
    ];

    if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`store.company_id = ANY($${params.length}::uuid[])`);
    }

    const result = await this.databaseService.query<{
      store_id: string;
      store_name: string | null;
      region_id: string | null;
      region_name: string | null;
      region_manager_user_id: string | null;
      region_manager_name: string | null;
      kpi_code: string;
      kpi_name: string | null;
      actual_value: string | null;
      target_value: string | null;
    }>(
      `
        SELECT
          store.store_id::text AS store_id,
          store.store_name,
          store.region_id::text AS region_id,
          region.region_name,
          region_manager.user_id AS region_manager_user_id,
          region_manager.display_name AS region_manager_name,
          kd.kpi_code,
          kd.kpi_name,
          ka.actual_value::text AS actual_value,
          kt.target_value::text AS target_value
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        INNER JOIN ops.store store
          ON store.store_id = ka.store_id
        LEFT JOIN ops.region region
          ON region.region_id = store.region_id
        LEFT JOIN ops.kpi_target kt
          ON kt.kpi_id = ka.kpi_id
         AND kt.scope_type = 'store'
         AND kt.store_id = ka.store_id
         AND kt.period_type = ka.period_type
         AND kt.period_start = ka.period_start
         AND kt.period_end = ka.period_end
        LEFT JOIN LATERAL (
          SELECT
            ua.user_id::text AS user_id,
            COALESCE(
              NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), ''),
              ua.username,
              ua.email,
              ua.user_id::text
            ) AS display_name
          FROM ops.user_role_assignment ura
          INNER JOIN ops.role role
            ON role.role_id = ura.role_id
           AND role.role_code = 'REGION_MANAGER'
          INNER JOIN ops.user_account ua
            ON ua.user_id = ura.user_id
           AND ua.is_active = TRUE
          LEFT JOIN ops.employee employee
            ON employee.employee_id = ua.employee_id
          WHERE ura.region_id = store.region_id
            AND ura.start_at <= NOW()
            AND (ura.end_at IS NULL OR ura.end_at >= NOW())
          ORDER BY ua.username ASC, ua.user_id ASC
          LIMIT 1
        ) region_manager ON TRUE
        WHERE ${clauses.join(" AND ")}
        ORDER BY store.store_name ASC, store.store_id ASC, kd.kpi_code ASC
      `,
      params,
    );

    return result.rows;
  }

  async listRankingPersonnelKpiRows(input: {
    metricCodes: string[];
    companyIds: string[];
    periodType: string;
    periodStart: string;
    periodEnd: string;
  }) {
    if (input.metricCodes.length === 0) {
      return [];
    }

    const params: unknown[] = [
      input.metricCodes,
      input.periodType,
      input.periodStart,
      input.periodEnd,
    ];
    const clauses = [
      `ka.scope_type = 'employee'`,
      `kd.kpi_code = ANY($1::text[])`,
      `ka.period_type = $2`,
      `ka.period_start = $3::date`,
      `ka.period_end = $4::date`,
      `COALESCE(ka.source_type, '') <> 'demo_seed'`,
    ];

    if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`ka.company_id = ANY($${params.length}::uuid[])`);
    }

    const result = await this.databaseService.query<{
      employee_id: string;
      first_name: string | null;
      last_name: string | null;
      store_id: string | null;
      store_name: string | null;
      region_id: string | null;
      region_name: string | null;
      region_manager_user_id: string | null;
      region_manager_name: string | null;
      kpi_code: string;
      kpi_name: string | null;
      actual_value: string | null;
      target_value: string | null;
    }>(
      `
        SELECT
          ka.employee_id::text AS employee_id,
          employee.first_name,
          employee.last_name,
          store.store_id::text AS store_id,
          store.store_name,
          region.region_id::text AS region_id,
          region.region_name,
          region_manager.user_id AS region_manager_user_id,
          region_manager.display_name AS region_manager_name,
          kd.kpi_code,
          kd.kpi_name,
          ka.actual_value::text AS actual_value,
          ptr.target_value::text AS target_value
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        INNER JOIN ops.employee employee
          ON employee.employee_id = ka.employee_id
        LEFT JOIN LATERAL (
          SELECT eah.store_id, eah.region_id
          FROM ops.employee_assignment_history eah
          WHERE eah.employee_id = ka.employee_id
            AND eah.assignment_status = 'active'
          ORDER BY eah.is_primary_assignment DESC, eah.start_date DESC
          LIMIT 1
        ) assignment ON TRUE
        LEFT JOIN ops.store store
          ON store.store_id = COALESCE(ka.store_id, assignment.store_id)
        LEFT JOIN ops.region region
          ON region.region_id = COALESCE(ka.region_id, assignment.region_id, store.region_id)
        LEFT JOIN ops.personnel_target_reference ptr
          ON ptr.employee_id = ka.employee_id
         AND ptr.period_start <= ka.period_start
         AND ptr.period_end >= ka.period_end
         AND ptr.target_type = 'monthly_sales_target'
         AND ptr.status = 'approved'
         AND kd.kpi_code = 'TARGET_ACHIEVEMENT'
        LEFT JOIN LATERAL (
          SELECT
            ua.user_id::text AS user_id,
            COALESCE(
              NULLIF(TRIM(CONCAT(manager_employee.first_name, ' ', manager_employee.last_name)), ''),
              ua.username,
              ua.email,
              ua.user_id::text
            ) AS display_name
          FROM ops.user_role_assignment ura
          INNER JOIN ops.role role
            ON role.role_id = ura.role_id
           AND role.role_code = 'REGION_MANAGER'
          INNER JOIN ops.user_account ua
            ON ua.user_id = ura.user_id
           AND ua.is_active = TRUE
          LEFT JOIN ops.employee manager_employee
            ON manager_employee.employee_id = ua.employee_id
          WHERE ura.region_id = COALESCE(ka.region_id, assignment.region_id, store.region_id)
            AND ura.start_at <= NOW()
            AND (ura.end_at IS NULL OR ura.end_at >= NOW())
          ORDER BY ua.username ASC, ua.user_id ASC
          LIMIT 1
        ) region_manager ON TRUE
        WHERE ${clauses.join(" AND ")}
        ORDER BY employee.last_name ASC, employee.first_name ASC, ka.employee_id ASC, kd.kpi_code ASC
      `,
      params,
    );

    return result.rows;
  }

  async listRankingFilterOptions(input: {
    companyIds: string[];
    periodType: string;
    periodStart: string;
    periodEnd: string;
  }): Promise<{
    regionManagers: Array<{ id: string; label: string }>;
    regions: Array<{ id: string; label: string }>;
    stores: Array<{ id: string; label: string }>;
  }> {
    const params: unknown[] = [
      input.periodType,
      input.periodStart,
      input.periodEnd,
    ];
    const companyClause =
      input.companyIds.length > 0
        ? (() => {
            params.push(input.companyIds);
            return `AND store.company_id = ANY($${params.length}::uuid[])`;
          })()
        : "";
    const regionManagerParams =
      input.companyIds.length > 0 ? [input.companyIds] : [];

    const regionManagers = await this.databaseService.query<{
      id: string;
      label: string;
    }>(
      `
        SELECT DISTINCT
          ua.user_id::text AS id,
          COALESCE(
            NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), ''),
            ua.username,
            ua.email,
            ua.user_id::text
          ) AS label
        FROM ops.user_role_assignment ura
        INNER JOIN ops.role role
          ON role.role_id = ura.role_id
         AND role.role_code = 'REGION_MANAGER'
        INNER JOIN ops.user_account ua
          ON ua.user_id = ura.user_id
         AND ua.is_active = TRUE
        LEFT JOIN ops.employee employee
          ON employee.employee_id = ua.employee_id
        LEFT JOIN ops.region region
          ON region.region_id = ura.region_id
        WHERE ura.start_at <= NOW()
          AND (ura.end_at IS NULL OR ura.end_at >= NOW())
          ${
            input.companyIds.length > 0
              ? `AND (ura.company_id = ANY($1::uuid[]) OR region.company_id = ANY($1::uuid[]))`
              : ""
          }
        ORDER BY label ASC
      `,
      regionManagerParams,
    );

    const regions = await this.databaseService.query<{ id: string; label: string }>(
      `
        SELECT DISTINCT
          region.region_id::text AS id,
          region.region_name AS label
        FROM ops.kpi_actual ka
        LEFT JOIN ops.store store
          ON store.store_id = ka.store_id
        LEFT JOIN ops.region region
          ON region.region_id = COALESCE(ka.region_id, store.region_id)
        WHERE ka.period_type = $1
          AND ka.period_start = $2::date
          AND ka.period_end = $3::date
          AND COALESCE(ka.source_type, '') <> 'demo_seed'
          AND region.region_id IS NOT NULL
          ${companyClause}
        ORDER BY label ASC
      `,
      params,
    );

    const stores = await this.databaseService.query<{ id: string; label: string }>(
      `
        SELECT DISTINCT
          store.store_id::text AS id,
          store.store_name AS label
        FROM ops.kpi_actual ka
        INNER JOIN ops.store store
          ON store.store_id = ka.store_id
        WHERE ka.period_type = $1
          AND ka.period_start = $2::date
          AND ka.period_end = $3::date
          AND COALESCE(ka.source_type, '') <> 'demo_seed'
          ${companyClause}
        ORDER BY label ASC
      `,
      params,
    );

    return {
      regionManagers: regionManagers.rows,
      regions: regions.rows,
      stores: stores.rows,
    };
  }

  async getEmployeePerformanceSnapshot(input: {
    snapshotRunId: string;
    employeeId: string;
  }) {
    const result = await this.databaseService.query<{
      employee_id: string;
      first_name: string;
      last_name: string;
      store_id: string | null;
      store_name: string | null;
      period_start: string;
      period_end: string;
      score_value: string;
      matched_metrics: number;
      total_metrics: number;
      turkey_rank: number | null;
      turkey_population: number;
      store_rank: number | null;
      store_population: number;
    }>(
      `
        SELECT
          eps.employee_id,
          e.first_name,
          e.last_name,
          eps.store_id,
          store.store_name,
          eps.period_start,
          eps.period_end,
          eps.score_value::text AS score_value,
          eps.matched_metrics,
          eps.total_metrics,
          eps.turkey_rank,
          eps.turkey_population,
          eps.store_rank,
          eps.store_population
        FROM rpt.employee_performance_snapshot eps
        INNER JOIN ops.employee e
          ON e.employee_id = eps.employee_id
        LEFT JOIN ops.store store
          ON store.store_id = eps.store_id
        WHERE eps.snapshot_run_id = $1::uuid
          AND eps.employee_id = $2::uuid
        LIMIT 1
      `,
      [input.snapshotRunId, input.employeeId],
    );

    return result.rows[0] ?? null;
  }

  async getEmployeeKpiSnapshotRows(input: {
    snapshotRunId: string;
    employeeId: string;
    metricCodes: string[];
  }) {
    const result = await this.databaseService.query<{
      employee_id: string;
      store_id: string | null;
      kpi_code: string;
      kpi_name: string;
      actual_value: string;
    }>(
      `
        SELECT
          eks.employee_id,
          eks.store_id,
          kd.kpi_code,
          kd.kpi_name,
          eks.actual_value::text AS actual_value
        FROM rpt.employee_kpi_snapshot eks
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = eks.kpi_id
        WHERE eks.snapshot_run_id = $1::uuid
          AND eks.employee_id = $2::uuid
          AND kd.kpi_code = ANY($3::text[])
        ORDER BY kd.kpi_code ASC
      `,
      [input.snapshotRunId, input.employeeId, input.metricCodes],
    );

    return result.rows;
  }

  async listClosedPersonnelLeaderboard(input: {
    snapshotRunId: string;
    companyId?: string;
    limit: number;
  }) {
    const params: unknown[] = [input.snapshotRunId];
    const clauses = [`eps.snapshot_run_id = $1::uuid`];

    if (input.companyId) {
      params.push(input.companyId);
      clauses.push(`store.company_id = $${params.length}::uuid`);
    }

    params.push(input.limit);

    const result = await this.databaseService.query<{
      employee_id: string;
      first_name: string;
      last_name: string;
      store_id: string | null;
      store_name: string | null;
      score_value: string;
      turkey_rank: number | null;
      store_rank: number | null;
    }>(
      `
        SELECT
          eps.employee_id,
          e.first_name,
          e.last_name,
          eps.store_id,
          store.store_name,
          eps.score_value::text AS score_value,
          eps.turkey_rank,
          eps.store_rank
        FROM rpt.employee_performance_snapshot eps
        INNER JOIN ops.employee e
          ON e.employee_id = eps.employee_id
        LEFT JOIN ops.store store
          ON store.store_id = eps.store_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY eps.turkey_rank ASC NULLS LAST, eps.score_value DESC
        LIMIT $${params.length}
      `,
      params,
    );

    return result.rows;
  }

  async listClosedStoreLeaderboardRows(input: {
    snapshotRunId: string;
    companyId?: string;
  }) {
    const params: unknown[] = [input.snapshotRunId];
    const clauses = [`sks.snapshot_run_id = $1::uuid`];

    if (input.companyId) {
      params.push(input.companyId);
      clauses.push(`store.company_id = $${params.length}::uuid`);
    }

    const result = await this.databaseService.query<{
      store_id: string;
      store_name: string;
      kpi_code: string;
      actual_value: string | null;
    }>(
      `
        SELECT
          sks.store_id,
          store.store_name,
          kd.kpi_code,
          sks.actual_value::text AS actual_value
        FROM rpt.store_kpi_snapshot sks
        INNER JOIN ops.store store
          ON store.store_id = sks.store_id
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = sks.kpi_id
        WHERE ${clauses.join(" AND ")}
      `,
      params,
    );

    return result.rows;
  }
}
