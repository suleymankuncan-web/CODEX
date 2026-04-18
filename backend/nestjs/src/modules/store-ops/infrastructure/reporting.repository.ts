import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

@Injectable()
export class ReportingRepository {
  constructor(private readonly databaseService: DatabaseService) {}

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
          sr.snapshot_date,
          sr.snapshot_type,
          sr.period_start,
          sr.period_end,
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
    const params: unknown[] = [input.snapshotRunId];
    const clauses = [`sws.snapshot_run_id = $1::uuid`];

    if (input.storeId) {
      params.push(input.storeId);
      clauses.push(`sws.store_id = $${params.length}::uuid`);
    } else if (input.storeIds.length > 0) {
      params.push(input.storeIds);
      clauses.push(`s.store_id = ANY($${params.length}::uuid[])`);
    } else if (input.regionIds.length > 0) {
      params.push(input.regionIds);
      clauses.push(`s.region_id = ANY($${params.length}::uuid[])`);
    } else if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`s.company_id = ANY($${params.length}::uuid[])`);
    }

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
    const params: unknown[] = [input.snapshotRunId];
    const clauses = [`sks.snapshot_run_id = $1::uuid`];

    if (input.storeId) {
      params.push(input.storeId);
      clauses.push(`sks.store_id = $${params.length}::uuid`);
    } else if (input.storeIds.length > 0) {
      params.push(input.storeIds);
      clauses.push(`s.store_id = ANY($${params.length}::uuid[])`);
    } else if (input.regionIds.length > 0) {
      params.push(input.regionIds);
      clauses.push(`s.region_id = ANY($${params.length}::uuid[])`);
    } else if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`s.company_id = ANY($${params.length}::uuid[])`);
    }

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
        INNER JOIN ops.store s
          ON s.store_id = sks.store_id
    `;

    const result = await this.databaseService.query<{
      snapshot_run_id: string;
      store_id: string;
      kpi_id: string;
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
    const params: unknown[] = [input.snapshotRunId];
    const clauses = [`scs.snapshot_run_id = $1::uuid`];

    if (input.storeId) {
      params.push(input.storeId);
      clauses.push(`scs.store_id = $${params.length}::uuid`);
    } else if (input.storeIds.length > 0) {
      params.push(input.storeIds);
      clauses.push(`s.store_id = ANY($${params.length}::uuid[])`);
    } else if (input.regionIds.length > 0) {
      params.push(input.regionIds);
      clauses.push(`s.region_id = ANY($${params.length}::uuid[])`);
    } else if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`s.company_id = ANY($${params.length}::uuid[])`);
    }

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
    } else if (input.storeIds.length > 0) {
      params.push(input.storeIds);
      clauses.push(`ts.store_id = ANY($${params.length}::uuid[])`);
    } else if (input.regionIds.length > 0) {
      params.push(input.regionIds);
      clauses.push(`ts.region_id = ANY($${params.length}::uuid[])`);
    } else if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`ts.company_id = ANY($${params.length}::uuid[])`);
    }

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
}
