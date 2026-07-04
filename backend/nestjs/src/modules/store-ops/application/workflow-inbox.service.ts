import { Injectable, Logger } from "@nestjs/common";
import { buildListResponse } from "../../../shared/http/response-builders";
import { redactSensitiveLogValue } from "../../../shared/structured-log";
import {
  toKpiExceptionInboxItem,
  toChecklistAcknowledgementInboxItem,
  toStoreActionPlanInboxItem,
  toTargetApprovalInboxItem,
  type WorkflowInboxItem,
} from "./workflow-inbox.contract";
import { ChecklistAcknowledgementRepository } from "../infrastructure/checklist-acknowledgement.repository";
import { TargetDistributionRepository } from "../infrastructure/target-distribution.repository";
import { SnapshotReportingReadRepository } from "../infrastructure/snapshot-reporting-read.repository";
import { StoreActionPlanRepository } from "../infrastructure/store-action-plan.repository";

const activeStoreActionPlanStatuses = ["open", "in_progress", "blocked"] as const;
const regionChecklistRemediationStatuses = [
  ...activeStoreActionPlanStatuses,
  "closed",
] as const;

@Injectable()
export class WorkflowInboxService {
  private readonly logger = new Logger(WorkflowInboxService.name);

  constructor(
    private readonly targetDistributionRepository: TargetDistributionRepository,
    private readonly checklistAcknowledgementRepository: ChecklistAcknowledgementRepository,
    private readonly snapshotReportingReadRepository: SnapshotReportingReadRepository,
    private readonly storeActionPlanRepository: StoreActionPlanRepository,
  ) {}

  async listInbox(input: {
    actorRoles: string[];
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
  }) {
    const items: WorkflowInboxItem[] = [];
    const canSeeApprovals =
      input.actorRoles.includes("SUPER_ADMIN") || input.actorRoles.includes("REPORT_VIEWER");
    const canSeeAcknowledgements =
      input.actorRoles.includes("SUPER_ADMIN") || input.actorRoles.includes("STORE_MANAGER");

    if (canSeeApprovals) {
      try {
        const approvalsPage = await this.targetDistributionRepository.listRequests({
          companyIds: input.actorScope.companyIds,
          regionIds: input.actorScope.regionIds,
          storeIds:
            input.actorScope.companyIds.length > 0 || input.actorScope.regionIds.length > 0
              ? []
              : input.actorScope.storeIds,
          statuses: ["pending_region_approval"],
        });
        items.push(...approvalsPage.items.map((item) => toTargetApprovalInboxItem(item)));
      } catch (error) {
        this.logger.warn(
          `Shared inbox skipped approval items: ${this.safeErrorMessage(error)}`,
        );
      }
    }

    if (canSeeAcknowledgements) {
      try {
        const acknowledgementScope = this.resolveAcknowledgementScope(input);
        const acknowledgementPage =
          await this.checklistAcknowledgementRepository.listChecklistAcknowledgements({
            companyIds: acknowledgementScope.companyIds,
            regionIds: acknowledgementScope.regionIds,
            storeIds: acknowledgementScope.storeIds,
          });
        items.push(
          ...acknowledgementPage.items
            .filter((item) => item.acknowledgement === null)
            .map((item) => toChecklistAcknowledgementInboxItem(item)),
        );
      } catch (error) {
        this.logger.warn(
          `Shared inbox skipped acknowledgement items: ${this.safeErrorMessage(error)}`,
        );
      }
    }

    const canSeeKpiExceptions =
      input.actorRoles.includes("SUPER_ADMIN") ||
      input.actorRoles.includes("REPORT_VIEWER") ||
      input.actorRoles.includes("STORE_MANAGER");
    if (canSeeKpiExceptions) {
      try {
        const latestCompletedSnapshotRun =
          await this.snapshotReportingReadRepository.getLatestCompletedSnapshotRun();

        if (latestCompletedSnapshotRun) {
          const canUseAdminKpiRoute =
            input.actorRoles.includes("SUPER_ADMIN") || input.actorRoles.includes("REPORT_VIEWER");
          const kpiScope = this.resolveStoreReadScope(input, [
            "REPORT_VIEWER",
            "SUPER_ADMIN",
          ]);
          const kpiExceptions = await this.snapshotReportingReadRepository.getKpiReport({
            snapshotRunId: latestCompletedSnapshotRun.snapshot_run_id,
            companyIds: kpiScope.companyIds,
            regionIds: kpiScope.regionIds,
            storeIds: kpiScope.storeIds,
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
          `Shared inbox skipped KPI exception items: ${this.safeErrorMessage(error)}`,
        );
      }
    }

    const canSeeStoreActionPlans =
      input.actorRoles.includes("SUPER_ADMIN") || input.actorRoles.includes("STORE_MANAGER");
    if (canSeeStoreActionPlans) {
      try {
        const storeIds = this.resolveAssignedActionStoreIds(input);
        if (storeIds.length > 0) {
          const plans = await this.storeActionPlanRepository.listWorkflowInboxPlans({
            storeIds,
            statuses: [...activeStoreActionPlanStatuses],
            limit: 20,
          });
          items.push(...plans.map((item) => toStoreActionPlanInboxItem(item)));
        }
      } catch (error) {
        this.logger.warn(
          `Shared inbox skipped store action plan items: ${this.safeErrorMessage(error)}`,
        );
      }
    }

    const canSeeRegionRemediationInfo =
      input.actorRoles.includes("REGION_MANAGER") && !canSeeStoreActionPlans;
    if (canSeeRegionRemediationInfo) {
      try {
        const readScope = this.resolveRegionStoreActionPlanReadScope(input);
        const plans = await this.storeActionPlanRepository.listWorkflowInboxPlans({
          ...readScope,
          statuses: [...regionChecklistRemediationStatuses],
          sourceTypes: ["checklist_remediation"],
          limit: 20,
        });
        items.push(
          ...plans.map((item) =>
            toStoreActionPlanInboxItem(item, {
              audience: "region_manager",
            }),
          ),
        );
      } catch (error) {
        this.logger.warn(
          `Shared inbox skipped region remediation items: ${this.safeErrorMessage(error)}`,
        );
      }
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

  private resolveAcknowledgementScope(input: {
    actorRoles: string[];
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
  }) {
    return this.resolveStoreReadScope(input, ["REPORT_VIEWER", "SUPER_ADMIN"]);
  }

  private resolveStoreReadScope(
    input: {
      actorRoles: string[];
      actorScope: {
        companyIds: string[];
        regionIds: string[];
        storeIds: string[];
      };
      actorActionScope?: {
        assignedStoreIds: string[];
      };
    },
    broadReadRoles: string[],
  ) {
    const canUseBroadReadScope = input.actorRoles.some((roleCode) =>
      broadReadRoles.includes(roleCode),
    );
    const storeIds = input.actorActionScope?.assignedStoreIds.length
      ? input.actorActionScope.assignedStoreIds
      : input.actorScope.storeIds;

    if (!canUseBroadReadScope) {
      return {
        companyIds: [],
        regionIds: [],
        storeIds,
      };
    }

    return {
      companyIds: input.actorScope.companyIds,
      regionIds: input.actorScope.regionIds,
      storeIds:
        input.actorScope.companyIds.length > 0 || input.actorScope.regionIds.length > 0
          ? []
          : storeIds,
    };
  }

  private resolveAssignedActionStoreIds(input: {
    actorActionScope?: {
      assignedStoreIds: string[];
    };
  }) {
    return [...new Set(input.actorActionScope?.assignedStoreIds ?? [])];
  }

  private resolveRegionStoreActionPlanReadScope(input: {
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
  }) {
    return {
      companyIds: input.actorScope.companyIds,
      regionIds: input.actorScope.regionIds,
      storeIds:
        input.actorScope.companyIds.length > 0 || input.actorScope.regionIds.length > 0
          ? []
          : input.actorScope.storeIds,
    };
  }

  private safeErrorMessage(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return String(redactSensitiveLogValue(message));
  }
}
