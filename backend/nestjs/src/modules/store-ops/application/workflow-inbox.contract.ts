export type WorkflowItemType = "approval" | "acknowledgement" | "task" | "notification";

export type WorkflowInboxStatus = "needs_attention" | "completed" | "informational";

export type WorkflowUrgency = "high" | "medium" | "low";

export type WorkflowInboxItem = {
  itemType: WorkflowItemType;
  sourceType: "target_distribution_request" | "checklist_receipt" | "kpi_exception";
  sourceId: string;
  title: string;
  summary: string;
  companyId?: string;
  regionId?: string;
  storeId: string;
  storeName?: string;
  workflowStatus: string;
  inboxStatus: WorkflowInboxStatus;
  urgency: WorkflowUrgency;
  createdAt?: string | null;
  needsAttentionAt?: string | null;
  actorRole: string;
  primaryActionLabel: string;
  secondaryActionLabel?: string;
  deepLink: string;
  historyPreview?: string;
};

type TargetDistributionRequest = {
  requestId: string;
  companyId: string;
  regionId: string;
  storeId: string;
  storeName: string;
  requestMonth: string;
  targetLabel: string;
  totalTargetValue: number;
  allocationCount: number;
  status: string;
  requestReason: string | null;
  submittedByUserId: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  approvalNote: string | null;
  createdAt: string;
  updatedAt: string;
};

type ChecklistAcknowledgementItem = {
  checklistInstanceId: string;
  checklistTemplateId: string;
  templateName: string;
  category: string;
  storeId: string;
  storeName: string;
  completedAt: string | null;
  status: string;
  totalScore: number | null;
  complianceRate: number | null;
  acknowledgement: {
    checklistAcknowledgementId: string;
    acknowledgedByUserId: string | null;
    acknowledgementNote: string | null;
    acknowledgedAt: string | null;
  } | null;
};

type KpiExceptionItem = {
  snapshotRunId: string;
  storeId: string;
  kpiId: string;
  kpiCode?: string;
  kpiName?: string;
  periodStart: string;
  periodEnd: string;
  targetValue: string | null;
  actualValue: string | null;
  achievementRate: string | null;
  statusBand: string | null;
  storeName?: string;
  deepLink?: string;
};

export function toTargetApprovalInboxItem(item: TargetDistributionRequest): WorkflowInboxItem {
  const needsAttention = item.status === "pending_region_approval";

  return {
    itemType: "approval",
    sourceType: "target_distribution_request",
    sourceId: item.requestId,
    title: item.targetLabel,
    summary: `${item.storeName || item.storeId} icin ${item.allocationCount} kisilik hedef dagitimi talebi`,
    companyId: item.companyId,
    regionId: item.regionId,
    storeId: item.storeId,
    storeName: item.storeName,
    workflowStatus: item.status,
    inboxStatus: needsAttention ? "needs_attention" : "completed",
    urgency: needsAttention ? "medium" : "low",
    createdAt: item.createdAt,
    needsAttentionAt: needsAttention ? item.createdAt : item.approvedAt,
    actorRole: "REGION_APPROVER",
    primaryActionLabel: needsAttention ? "Approve request" : "Review history",
    secondaryActionLabel: "Open detail",
    deepLink: "/admin/targets",
    historyPreview: item.approvalNote ?? item.requestReason ?? undefined,
  };
}

export function toChecklistAcknowledgementInboxItem(
  item: ChecklistAcknowledgementItem,
): WorkflowInboxItem {
  const needsAttention = item.acknowledgement === null;

  return {
    itemType: "acknowledgement",
    sourceType: "checklist_receipt",
    sourceId: item.checklistInstanceId,
    title: item.templateName,
    summary: `${item.storeName || item.storeId} icin tamamlanan checklist sonucu`,
    storeId: item.storeId,
    storeName: item.storeName,
    workflowStatus: item.status,
    inboxStatus: needsAttention ? "needs_attention" : "completed",
    urgency: needsAttention ? "medium" : "low",
    createdAt: item.completedAt,
    needsAttentionAt: needsAttention ? item.completedAt : item.acknowledgement?.acknowledgedAt,
    actorRole: "STORE_MANAGER",
    primaryActionLabel: needsAttention ? "Kabul ediyorum" : "View acknowledgement",
    secondaryActionLabel: "Open checklist receipt",
    deepLink: `/store/checklists?tab=inbox&result=${encodeURIComponent(item.checklistInstanceId)}`,
    historyPreview: item.acknowledgement?.acknowledgementNote ?? undefined,
  };
}

export function toKpiExceptionInboxItem(item: KpiExceptionItem): WorkflowInboxItem {
  const isOffTrack = item.statusBand === "off_track";
  const storeLabel = item.storeName || item.storeId;
  const label = item.kpiName || item.kpiCode || item.kpiId;

  return {
    itemType: "task",
    sourceType: "kpi_exception",
    sourceId: `${item.snapshotRunId}:${item.storeId}:${item.kpiId}`,
    title: `${label} ${isOffTrack ? "off track" : "at risk"}`,
    summary: `${storeLabel} icin KPI exception takibi gerekiyor`,
    storeId: item.storeId,
    storeName: item.storeName,
    workflowStatus: item.statusBand ?? "unknown",
    inboxStatus: "needs_attention",
    urgency: isOffTrack ? "high" : "medium",
    createdAt: item.periodEnd,
    needsAttentionAt: item.periodEnd,
    actorRole: "STORE_MANAGER",
    primaryActionLabel: "Open KPI detail",
    secondaryActionLabel: "Review exception",
    deepLink: item.deepLink ?? "/store/kpis",
    historyPreview:
      item.achievementRate !== null
        ? `Achievement ${Math.round(Number(item.achievementRate) * 100)}%`
        : undefined,
  };
}
