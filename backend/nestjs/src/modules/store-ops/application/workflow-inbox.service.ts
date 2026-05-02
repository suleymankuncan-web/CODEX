import { Injectable, Logger } from "@nestjs/common";
import { buildListResponse } from "../../../shared/http/response-builders";
import {
  toKpiExceptionInboxItem,
  toChecklistAcknowledgementInboxItem,
  toTargetApprovalInboxItem,
  type WorkflowInboxItem,
} from "./workflow-inbox.contract";
import { ChecklistAcknowledgementRepository } from "../infrastructure/checklist-acknowledgement.repository";
import { TargetDistributionRepository } from "../infrastructure/target-distribution.repository";
import { ReportingRepository } from "../infrastructure/reporting.repository";

@Injectable()
export class WorkflowInboxService {
  private readonly logger = new Logger(WorkflowInboxService.name);

  constructor(
    private readonly targetDistributionRepository: TargetDistributionRepository,
    private readonly checklistAcknowledgementRepository: ChecklistAcknowledgementRepository,
    private readonly reportingRepository: ReportingRepository,
  ) {}

  async listInbox(input: {
    actorRoles: string[];
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
  }) {
    const items: WorkflowInboxItem[] = [];
    const canSeeApprovals =
      input.actorRoles.includes("SUPER_ADMIN") || input.actorRoles.includes("REPORT_VIEWER");
    const canSeeAcknowledgements =
      input.actorRoles.includes("SUPER_ADMIN") || input.actorRoles.includes("STORE_MANAGER");

    if (canSeeApprovals) {
      try {
        const approvals = await this.targetDistributionRepository.listRequests({
          companyIds: input.actorScope.companyIds,
          regionIds: input.actorScope.regionIds,
          storeIds:
            input.actorScope.companyIds.length > 0 || input.actorScope.regionIds.length > 0
              ? []
              : input.actorScope.storeIds,
          statuses: ["pending_region_approval"],
        });
        items.push(...approvals.map((item) => toTargetApprovalInboxItem(item)));
      } catch (error) {
        this.logger.warn(
          `Shared inbox skipped approval items: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (canSeeAcknowledgements) {
      try {
        const acknowledgements =
          await this.checklistAcknowledgementRepository.listChecklistAcknowledgements({
            companyIds: input.actorScope.companyIds,
            regionIds: input.actorScope.regionIds,
            storeIds:
              input.actorScope.companyIds.length > 0 || input.actorScope.regionIds.length > 0
                ? []
                : input.actorScope.storeIds,
          });
        items.push(
          ...acknowledgements
            .filter((item) => item.acknowledgement === null)
            .map((item) => toChecklistAcknowledgementInboxItem(item)),
        );
      } catch (error) {
        this.logger.warn(
          `Shared inbox skipped acknowledgement items: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    try {
      const latestCompletedSnapshotRun =
        await this.reportingRepository.getLatestCompletedSnapshotRun();

      if (latestCompletedSnapshotRun) {
        const canUseAdminKpiRoute =
          input.actorRoles.includes("SUPER_ADMIN") || input.actorRoles.includes("REPORT_VIEWER");
        const kpiExceptions = await this.reportingRepository.getKpiReport({
          snapshotRunId: latestCompletedSnapshotRun.snapshot_run_id,
          companyIds: input.actorScope.companyIds,
          regionIds: input.actorScope.regionIds,
          storeIds: input.actorScope.storeIds,
          limit: 20,
          offset: 0,
        });

        items.push(
          ...kpiExceptions.rows
            .filter(
              (item) => item.status_band === "at_risk" || item.status_band === "off_track",
            )
            .map((item) =>
              toKpiExceptionInboxItem({
                snapshotRunId: item.snapshot_run_id,
                storeId: item.store_id,
                kpiId: item.kpi_id,
                kpiCode: item.kpi_code,
                kpiName: item.kpi_name,
                periodStart: item.period_start,
                periodEnd: item.period_end,
                targetValue: item.target_value,
                actualValue: item.actual_value,
                achievementRate: item.achievement_rate,
                statusBand: item.status_band,
                deepLink: canUseAdminKpiRoute
                  ? `/admin/reports/kpis/${latestCompletedSnapshotRun.snapshot_run_id}`
                  : "/store/kpis",
              }),
            ),
        );
      }
    } catch (error) {
      this.logger.warn(
        `Shared inbox skipped KPI exception items: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    items.sort((left, right) => {
      const leftDate = new Date(left.needsAttentionAt ?? left.createdAt ?? 0).getTime();
      const rightDate = new Date(right.needsAttentionAt ?? right.createdAt ?? 0).getTime();
      return rightDate - leftDate;
    });

    return buildListResponse(items, {
      total: items.length,
      limit: 50,
      offset: 0,
    });
  }
}
