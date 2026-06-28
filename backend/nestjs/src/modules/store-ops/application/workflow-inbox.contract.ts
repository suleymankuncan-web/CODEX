export type WorkflowItemType = "approval" | "acknowledgement" | "task" | "notification";

export type WorkflowInboxStatus = "needs_attention" | "completed" | "informational";

export type WorkflowUrgency = "high" | "medium" | "low";

export type WorkflowInboxItem = {
  itemType: WorkflowItemType;
  sourceType:
    | "target_distribution_request"
    | "checklist_receipt"
    | "kpi_exception"
    | "store_action_plan";
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

type StoreActionPlanInboxSource = {
  actionPlanId: string;
  companyId: string;
  regionId: string;
  storeId: string;
  sourceDeepLink: string | null;
  title: string;
  summary: string | null;
  priority: "high" | "medium" | "low";
  status: string;
  dueOn: string;
  resolutionNote: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
};

function displayStoreName(storeName: string | null | undefined) {
  return storeName?.trim() || "Mağaza adı yok";
}

export function toTargetApprovalInboxItem(item: TargetDistributionRequest): WorkflowInboxItem {
  const needsAttention = item.status === "pending_region_approval";
  const storeLabel = displayStoreName(item.storeName);

  return {
    itemType: "approval",
    sourceType: "target_distribution_request",
    sourceId: item.requestId,
    title: item.targetLabel,
    summary: `${storeLabel} icin ${item.allocationCount} kisilik hedef dagitimi talebi`,
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
  const storeLabel = displayStoreName(item.storeName);

  return {
    itemType: "acknowledgement",
    sourceType: "checklist_receipt",
    sourceId: item.checklistInstanceId,
    title: item.templateName,
    summary: `${storeLabel} icin tamamlanan checklist sonucu`,
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
  const storeLabel = displayStoreName(item.storeName);
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

export function toStoreActionPlanInboxItem(
  item: StoreActionPlanInboxSource,
  options: { audience?: "store_manager" | "region_manager" } = {},
  now = new Date(),
): WorkflowInboxItem {
  const isRegionManagerInfo = options.audience === "region_manager";
  const isActive =
    item.status === "open" || item.status === "in_progress" || item.status === "blocked";
  const overdue = isDateBeforeToday(item.dueOn, now);
  const isClosed = item.status === "closed";
  const actionPlanDeepLink = `/store/tasks?actionPlan=${encodeURIComponent(item.actionPlanId)}`;
  const safeSourceDeepLink = getSafeWorkflowDeepLink(item.sourceDeepLink);

  return {
    itemType: "task",
    sourceType: "store_action_plan",
    sourceId: item.actionPlanId,
    title: item.title,
    summary: item.summary ?? `Store action plan due ${item.dueOn}`,
    companyId: item.companyId,
    regionId: item.regionId,
    storeId: item.storeId,
    workflowStatus: item.status,
    inboxStatus: isRegionManagerInfo
      ? "informational"
      : isActive
        ? "needs_attention"
        : "completed",
    urgency: isRegionManagerInfo && isClosed
      ? "low"
      : overdue || item.priority === "high"
        ? "high"
        : item.priority,
    createdAt: item.createdAt,
    needsAttentionAt:
      isRegionManagerInfo && isClosed ? item.updatedAt : toDateOnlyNoonUtcTimestamp(item.dueOn),
    actorRole: "STORE_MANAGER",
    primaryActionLabel: isRegionManagerInfo
      ? "Review checklist source"
      : isActive
        ? "Open action plan"
        : "Review action plan",
    secondaryActionLabel:
      isRegionManagerInfo && isClosed ? "Store reported resolved" : "Review source",
    deepLink: isRegionManagerInfo && safeSourceDeepLink ? safeSourceDeepLink : actionPlanDeepLink,
    historyPreview: buildStoreActionPlanHistoryPreview(item, { isRegionManagerInfo, isClosed }),
  };
}

function buildStoreActionPlanHistoryPreview(
  item: StoreActionPlanInboxSource,
  input: {
    isRegionManagerInfo: boolean;
    isClosed: boolean;
  },
) {
  if (input.isRegionManagerInfo && input.isClosed) {
    return item.resolutionNote
      ? `Store reported resolved: ${item.resolutionNote}`
      : "Store reported resolved";
  }

  return item.resolutionNote ?? item.cancelReason ?? `Due ${item.dueOn}; updated ${item.updatedAt}`;
}

function getSafeWorkflowDeepLink(input: string | null) {
  if (!input || !input.startsWith("/") || input.startsWith("//")) {
    return null;
  }

  for (let index = 0; index < input.length; index += 1) {
    const codePoint = input.charCodeAt(index);
    if (codePoint <= 31 || codePoint === 127) {
      return null;
    }
  }

  return input;
}

function isDateBeforeToday(value: string, now: Date) {
  const dueTime = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(dueTime)) {
    return false;
  }

  const todayTime = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return dueTime < todayTime;
}

function toDateOnlyNoonUtcTimestamp(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return `${value}T12:00:00.000Z`;
}
