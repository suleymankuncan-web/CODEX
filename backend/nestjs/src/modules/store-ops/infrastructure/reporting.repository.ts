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
        WITH scoped_actual AS (
          SELECT
            ka.store_id,
            kd.kpi_code,
            SUM(ka.actual_value) AS actual_value
          FROM ops.kpi_actual ka
          INNER JOIN ops.kpi_definition kd
            ON kd.kpi_id = ka.kpi_id
          INNER JOIN ops.store store
            ON store.store_id = ka.store_id
          WHERE ka.scope_type = 'store'
            AND ka.period_type = $1
            AND ka.period_start >= $2::date
            AND ka.period_end <= $3::date
            ${companyClause}
          GROUP BY ka.store_id, kd.kpi_code
        )
        SELECT 'ATV' AS kpi_code,
               (SUM(net_sales.actual_value) / NULLIF(SUM(ticket_count.actual_value), 0))::text AS benchmark_value
        FROM scoped_actual net_sales
        INNER JOIN scoped_actual ticket_count
          ON ticket_count.store_id = net_sales.store_id
          AND ticket_count.kpi_code = 'TICKET_COUNT'
        WHERE net_sales.kpi_code = 'NET_SALES'
        UNION ALL
        SELECT 'UPT' AS kpi_code,
               (SUM(item_count.actual_value) / NULLIF(SUM(ticket_count.actual_value), 0))::text AS benchmark_value
        FROM scoped_actual item_count
        INNER JOIN scoped_actual ticket_count
          ON ticket_count.store_id = item_count.store_id
          AND ticket_count.kpi_code = 'TICKET_COUNT'
        WHERE item_count.kpi_code = 'ITEM_COUNT'
        UNION ALL
        SELECT 'CR' AS kpi_code,
               (SUM(ticket_count.actual_value) / NULLIF(SUM(ff.actual_value), 0))::text AS benchmark_value
        FROM scoped_actual ticket_count
        INNER JOIN scoped_actual ff
          ON ff.store_id = ticket_count.store_id
          AND ff.kpi_code = 'FF'
        WHERE ticket_count.kpi_code = 'TICKET_COUNT'
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
        WITH scoped_actual AS (
          SELECT
            ka.employee_id,
            kd.kpi_code,
            SUM(ka.actual_value) AS actual_value
          FROM ops.kpi_actual ka
          INNER JOIN ops.kpi_definition kd
            ON kd.kpi_id = ka.kpi_id
          WHERE ${clauses.join(" AND ")}
          GROUP BY ka.employee_id, kd.kpi_code
        )
        SELECT 'ATV' AS kpi_code,
               (SUM(net_sales.actual_value) / NULLIF(SUM(ticket_count.actual_value), 0))::text AS benchmark_value
        FROM scoped_actual net_sales
        INNER JOIN scoped_actual ticket_count
          ON ticket_count.employee_id = net_sales.employee_id
          AND ticket_count.kpi_code = 'TICKET_COUNT'
        WHERE net_sales.kpi_code = 'NET_SALES'
        UNION ALL
        SELECT 'UPT' AS kpi_code,
               (SUM(item_count.actual_value) / NULLIF(SUM(ticket_count.actual_value), 0))::text AS benchmark_value
        FROM scoped_actual item_count
        INNER JOIN scoped_actual ticket_count
          ON ticket_count.employee_id = item_count.employee_id
          AND ticket_count.kpi_code = 'TICKET_COUNT'
        WHERE item_count.kpi_code = 'ITEM_COUNT'
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

  async listClosedDailyPersonnelRankRows(input: {
    snapshotRunId: string;
    companyId?: string;
    storeId?: string;
    limit: number;
  }) {
    const params: unknown[] = [input.snapshotRunId];
    const clauses = [`eps.snapshot_run_id = $1::uuid`];

    if (input.companyId) {
      params.push(input.companyId);
      clauses.push(`store.company_id = $${params.length}::uuid`);
    }

    if (input.storeId) {
      params.push(input.storeId);
      clauses.push(`eps.store_id = $${params.length}::uuid`);
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
      turkey_population: number;
      store_rank: number | null;
      store_population: number;
    }>(
      `
        /* closed_personnel_daily_rank_rows */
        SELECT
          eps.employee_id,
          e.first_name,
          e.last_name,
          eps.store_id,
          store.store_name,
          eps.score_value::text AS score_value,
          eps.turkey_rank,
          eps.turkey_population,
          eps.store_rank,
          eps.store_population
        FROM rpt.employee_performance_snapshot eps
        INNER JOIN ops.employee e
          ON e.employee_id = eps.employee_id
        LEFT JOIN ops.store store
          ON store.store_id = eps.store_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY eps.turkey_rank ASC NULLS LAST, eps.score_value DESC, eps.employee_id ASC
        LIMIT $${params.length}
      `,
      params,
    );

    return result.rows;
  }

  async listClosedDailyMetricRankRows(input: {
    snapshotRunId: string;
    employeeIds: string[];
    storeId?: string;
  }) {
    if (input.employeeIds.length === 0) {
      return [];
    }

    const result = await this.databaseService.query<{
      employee_id: string;
      kpi_code: string;
      kpi_name: string;
      actual_value: string | null;
      store_rank: number | null;
      store_population: number;
      turkey_rank: number | null;
      turkey_population: number;
    }>(
      `
        /* closed_metric_daily_rank_rows */
        WITH metric_rows AS (
          SELECT
            eks.employee_id,
            eks.store_id,
            kd.kpi_code,
            kd.kpi_name,
            eks.actual_value::text AS actual_value,
            RANK() OVER (
              PARTITION BY kd.kpi_code
              ORDER BY eks.actual_value DESC NULLS LAST, eks.employee_id ASC
            ) AS turkey_rank,
            COUNT(*) OVER (PARTITION BY kd.kpi_code) AS turkey_population,
            RANK() OVER (
              PARTITION BY kd.kpi_code, eks.store_id
              ORDER BY eks.actual_value DESC NULLS LAST, eks.employee_id ASC
            ) AS store_rank,
            COUNT(*) OVER (PARTITION BY kd.kpi_code, eks.store_id) AS store_population
          FROM rpt.employee_kpi_snapshot eks
          INNER JOIN ops.kpi_definition kd
            ON kd.kpi_id = eks.kpi_id
          WHERE eks.snapshot_run_id = $1::uuid
        )
        SELECT
          employee_id,
          kpi_code,
          kpi_name,
          actual_value,
          store_rank,
          store_population,
          turkey_rank,
          turkey_population
        FROM metric_rows
        WHERE employee_id = ANY($2::uuid[])
        ORDER BY employee_id ASC, kpi_code ASC
      `,
      [input.snapshotRunId, input.employeeIds],
    );

    return result.rows;
  }

  async listCompletedDailySnapshotsInMonth(input: { monthStart: string }) {
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
        WHERE sr.snapshot_type = 'daily'
          AND sr.run_status = 'completed'
          AND sr.period_start = sr.period_end
          AND sr.period_start >= $1::date
          AND sr.period_start < ($1::date + INTERVAL '1 month')
        ORDER BY sr.period_start ASC
      `,
      [input.monthStart],
    );

    return result.rows;
  }

  async listClosedMonthlyPersonnelAggregateRows(input: {
    snapshotRunIds: string[];
    companyId?: string;
    storeId?: string;
    limit: number;
  }) {
    if (input.snapshotRunIds.length === 0) {
      return [];
    }

    const params: unknown[] = [input.snapshotRunIds];
    const dailyClauses = [`eps.snapshot_run_id = ANY($1::uuid[])`];

    if (input.companyId) {
      params.push(input.companyId);
      dailyClauses.push(`store.company_id = $${params.length}::uuid`);
    }

    const finalClauses: string[] = [];
    if (input.storeId) {
      params.push(input.storeId);
      finalClauses.push(`ranked.store_id = $${params.length}::uuid`);
    }

    params.push(input.limit);
    const limitParam = params.length;
    const finalWhereClause = finalClauses.length
      ? `WHERE ${finalClauses.join(" AND ")}`
      : "";

    const result = await this.databaseService.query<{
      employee_id: string;
      first_name: string;
      last_name: string;
      store_id: string | null;
      store_name: string | null;
      score_value: string;
      days_with_performance: string;
      turkey_rank: number | null;
      turkey_population: number;
      store_rank: number | null;
      store_population: number;
    }>(
      `
        /* closed_personnel_monthly_rank_rows */
        WITH daily_rows AS (
          SELECT
            eps.employee_id,
            eps.store_id,
            AVG(eps.score_value)::numeric(18,4) AS score_value,
            COUNT(*)::int AS days_with_performance
          FROM rpt.employee_performance_snapshot eps
          LEFT JOIN ops.store store
            ON store.store_id = eps.store_id
          WHERE ${dailyClauses.join(" AND ")}
          GROUP BY eps.employee_id, eps.store_id
        ),
        eligible_rows AS (
          SELECT *
          FROM daily_rows
          WHERE days_with_performance >= 3
        ),
        eligible_ranked AS (
          SELECT
            eligible_rows.*,
            RANK() OVER (
              ORDER BY score_value DESC, employee_id ASC
            ) AS turkey_rank,
            COUNT(*) OVER () AS turkey_population,
            RANK() OVER (
              PARTITION BY store_id
              ORDER BY score_value DESC, employee_id ASC
            ) AS store_rank,
            COUNT(*) OVER (PARTITION BY store_id) AS store_population
          FROM eligible_rows
        ),
        eligible_counts AS (
          SELECT COUNT(*)::int AS turkey_population
          FROM eligible_rows
        ),
        store_eligible_counts AS (
          SELECT store_id, COUNT(*)::int AS store_population
          FROM eligible_rows
          GROUP BY store_id
        ),
        ranked AS (
          SELECT
            daily_rows.employee_id,
            daily_rows.store_id,
            daily_rows.score_value,
            daily_rows.days_with_performance,
            eligible_ranked.turkey_rank,
            COALESCE(eligible_ranked.turkey_population, eligible_counts.turkey_population, 0) AS turkey_population,
            eligible_ranked.store_rank,
            COALESCE(eligible_ranked.store_population, store_eligible_counts.store_population, 0) AS store_population
          FROM daily_rows
          CROSS JOIN eligible_counts
          LEFT JOIN eligible_ranked
            ON eligible_ranked.employee_id = daily_rows.employee_id
           AND eligible_ranked.store_id IS NOT DISTINCT FROM daily_rows.store_id
          LEFT JOIN store_eligible_counts
            ON store_eligible_counts.store_id IS NOT DISTINCT FROM daily_rows.store_id
        )
        SELECT
          ranked.employee_id,
          e.first_name,
          e.last_name,
          ranked.store_id,
          store.store_name,
          ranked.score_value::text AS score_value,
          ranked.days_with_performance::text AS days_with_performance,
          ranked.turkey_rank,
          ranked.turkey_population,
          ranked.store_rank,
          ranked.store_population
        FROM ranked
        INNER JOIN ops.employee e
          ON e.employee_id = ranked.employee_id
        LEFT JOIN ops.store store
          ON store.store_id = ranked.store_id
        ${finalWhereClause}
        ORDER BY ranked.turkey_rank ASC NULLS LAST, ranked.score_value DESC, ranked.employee_id ASC
        LIMIT $${limitParam}
      `,
      params,
    );

    return result.rows;
  }

  async listClosedMonthlyMetricRankRows(input: {
    snapshotRunIds: string[];
    employeeIds: string[];
    storeId?: string;
  }) {
    if (input.snapshotRunIds.length === 0 || input.employeeIds.length === 0) {
      return [];
    }

    const result = await this.databaseService.query<{
      employee_id: string;
      kpi_code: string;
      kpi_name: string;
      actual_value: string | null;
      store_rank: number | null;
      store_population: number;
      turkey_rank: number | null;
      turkey_population: number;
    }>(
      `
        WITH monthly_metric_rows AS (
          SELECT
            eks.employee_id,
            eks.store_id,
            kd.kpi_code,
            kd.kpi_name,
            AVG(eks.actual_value)::numeric(18,4) AS actual_value
          FROM rpt.employee_kpi_snapshot eks
          INNER JOIN ops.kpi_definition kd
            ON kd.kpi_id = eks.kpi_id
          WHERE eks.snapshot_run_id = ANY($1::uuid[])
          GROUP BY eks.employee_id, eks.store_id, kd.kpi_code, kd.kpi_name
        ),
        ranked AS (
          SELECT
            monthly_metric_rows.employee_id,
            monthly_metric_rows.store_id,
            monthly_metric_rows.kpi_code,
            monthly_metric_rows.kpi_name,
            monthly_metric_rows.actual_value,
            RANK() OVER (
              PARTITION BY kpi_code
              ORDER BY actual_value DESC NULLS LAST, employee_id ASC
            ) AS turkey_rank,
            COUNT(*) OVER (PARTITION BY kpi_code) AS turkey_population,
            RANK() OVER (
              PARTITION BY kpi_code, store_id
              ORDER BY actual_value DESC NULLS LAST, employee_id ASC
            ) AS store_rank,
            COUNT(*) OVER (PARTITION BY kpi_code, store_id) AS store_population
          FROM monthly_metric_rows
        )
        SELECT
          employee_id,
          kpi_code,
          kpi_name,
          actual_value::text AS actual_value,
          store_rank,
          store_population,
          turkey_rank,
          turkey_population
        FROM ranked
        WHERE employee_id = ANY($2::uuid[])
        ORDER BY employee_id ASC, kpi_code ASC
      `,
      [input.snapshotRunIds, input.employeeIds],
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
