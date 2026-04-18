import { Injectable } from "@nestjs/common";
import { ReportingRepository } from "../infrastructure/reporting.repository";
import { buildListResponse } from "../../../shared/http/response-builders";

@Injectable()
export class ReportingService {
  constructor(private readonly reportingRepository: ReportingRepository) {}

  private mapSnapshotRun(item: {
    snapshot_run_id: string;
    snapshot_date: string;
    snapshot_type: string;
    period_start: string;
    period_end: string;
    run_status: string;
    generated_at: string;
    generated_by: string;
  }) {
    return {
      snapshotRunId: item.snapshot_run_id,
      snapshotDate: item.snapshot_date,
      snapshotType: item.snapshot_type,
      periodStart: item.period_start,
      periodEnd: item.period_end,
      runStatus: item.run_status,
      generatedAt: item.generated_at,
      generatedBy: item.generated_by,
    };
  }

  async listSnapshotRuns(input: {
    runStatus?: string;
    snapshotType?: string;
    limit?: number;
    offset?: number;
  }) {
    const result = await this.reportingRepository.listSnapshotRuns(input);
    return buildListResponse(
      result.rows.map((item) => this.mapSnapshotRun(item)),
      { total: result.total, limit: input.limit, offset: input.offset },
    );
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
    const result = await this.reportingRepository.getWorkforceReport(input);

    return buildListResponse(
      result.rows.map((item) => ({
        snapshotRunId: item.snapshot_run_id,
        storeId: item.store_id,
        positionId: item.position_id,
        activeHeadcount: item.active_headcount,
        activeFte: item.active_fte,
        plannedHeadcount: item.planned_headcount,
        plannedFte: item.planned_fte,
        gapHeadcount: item.gap_headcount,
        gapFte: item.gap_fte,
      })),
      { total: result.total, limit: input.limit, offset: input.offset },
    );
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
    const result = await this.reportingRepository.getKpiReport(input);

    return buildListResponse(
      result.rows.map((item) => ({
        snapshotRunId: item.snapshot_run_id,
        storeId: item.store_id,
        kpiId: item.kpi_id,
        periodStart: item.period_start,
        periodEnd: item.period_end,
        targetValue: item.target_value,
        actualValue: item.actual_value,
        achievementRate: item.achievement_rate,
        statusBand: item.status_band,
      })),
      { total: result.total, limit: input.limit, offset: input.offset },
    );
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
    const result = await this.reportingRepository.getChecklistReport(input);

    return buildListResponse(
      result.rows.map((item) => ({
        snapshotRunId: item.snapshot_run_id,
        storeId: item.store_id,
        checklistTemplateId: item.checklist_template_id,
        auditCount: item.audit_count,
        avgScore: item.avg_score,
        complianceRate: item.compliance_rate,
        criticalIssueCount: item.critical_issue_count,
      })),
      { total: result.total, limit: input.limit, offset: input.offset },
    );
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
    const result = await this.reportingRepository.getTurnoverReport(input);

    return buildListResponse(
      result.rows.map((item) => ({
        snapshotRunId: item.snapshot_run_id,
        scopeType: item.scope_type,
        companyId: item.company_id,
        regionId: item.region_id,
        storeId: item.store_id,
        periodStart: item.period_start,
        periodEnd: item.period_end,
        openingHeadcount: item.opening_headcount,
        closingHeadcount: item.closing_headcount,
        avgHeadcount: item.avg_headcount,
        leaverCount: item.leaver_count,
        turnoverRate: item.turnover_rate,
      })),
      { total: result.total, limit: input.limit, offset: input.offset },
    );
  }

  async getReportingSummary() {
    const latestCompletedSnapshotRun =
      await this.reportingRepository.getLatestCompletedSnapshotRun();

    if (!latestCompletedSnapshotRun) {
      return {
        latestCompletedSnapshotRun: null,
        cards: {
          workforceRows: 0,
          kpiRows: 0,
          checklistRows: 0,
          turnoverRows: 0,
        },
      };
    }

    const cards = await this.reportingRepository.getSnapshotRowCounts(
      latestCompletedSnapshotRun.snapshot_run_id,
    );

    return {
      latestCompletedSnapshotRun: this.mapSnapshotRun(latestCompletedSnapshotRun),
      cards,
    };
  }
}
