export type ChecklistInstanceStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type ChecklistTemplateStatus = "draft" | "published" | "archived";
export type ChecklistTemplateType = "BM_STORE_VISIT" | "VM_STORE_VISIT" | string;

export type MobileChecklistToday = {
  stores: Array<{ storeId: string; storeName: string }>;
  templates: Array<{
    checklistTemplateId: string;
    templateCode: string;
    templateType: ChecklistTemplateType;
    templateName: string;
    versionNo: number;
  }>;
  activeInstances: Array<{
    checklistInstanceId: string;
    checklistTemplateId: string;
    storeId: string;
    status: ChecklistInstanceStatus;
    startedAt: string | null;
    updatedAt: string | null;
  }>;
  completedThisMonth: Array<{
    checklistInstanceId: string;
    checklistTemplateId: string;
    storeId: string;
    completedAt: string;
    totalScore: number;
    acknowledgedAt: string | null;
  }>;
  pendingAcknowledgements: Array<{
    checklistInstanceId: string;
    checklistTemplateId: string;
    storeId: string;
    completedAt: string;
    totalScore: number;
  }>;
  monthlySummaries: Array<{
    storeId: string;
    checklistTemplateId: string;
    monthStart: string;
    completedCount: number;
    averageScore: number | null;
  }>;
};
