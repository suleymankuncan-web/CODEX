export type ChecklistInstanceStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type ChecklistTemplateStatus = "draft" | "published" | "archived";
export type ChecklistTemplateType = "BM_STORE_VISIT" | "VM_STORE_VISIT" | string;
export type ChecklistTemplateResponseType =
  | "score"
  | "yes_no"
  | "partial"
  | "compliance"
  | "text";
export type ChecklistComplianceResponseValue =
  | "compliant"
  | "partially_compliant"
  | "non_compliant"
  | "not_applicable";
export type ChecklistEvidencePolicy = "none" | "optional" | "required";

export type ChecklistTemplateItemInput = {
  sectionName: string;
  itemNo: number;
  itemText: string;
  responseType: ChecklistTemplateResponseType;
  weight: number;
  maxScore: number;
  expectedValue?: string;
  evidencePolicy?: ChecklistEvidencePolicy;
  maxEvidenceCount?: number;
};

export type ChecklistTemplateActorScope = {
  actorRoleCodes?: string[];
  actorReadScope?: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
  };
};

export type CreateChecklistTemplateInput = ChecklistTemplateActorScope & {
  companyId: string;
  templateCode: string;
  templateName: string;
  templateType: string;
  category: string;
  effectiveFrom: string;
  effectiveTo?: string;
  items: ChecklistTemplateItemInput[];
  actorUserId: string;
};

export type PublishChecklistTemplateInput = ChecklistTemplateActorScope & {
  checklistTemplateId: string;
  actorUserId: string;
  effectiveFrom?: string;
  effectiveTo?: string;
};

export type ChecklistTemplateSummary = {
  checklistTemplateId: string;
  companyId?: string;
  templateCode?: string;
  templateType?: string;
  templateName?: string;
  category?: string;
  versionNo?: number;
  status: ChecklistTemplateStatus | string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  items?: Array<ChecklistTemplateItemInput & { templateItemId: string }>;
};

export type ChecklistTemplateDraftItem = {
  templateItemId: string;
  weight: number;
  evidencePolicy: ChecklistEvidencePolicy;
  maxEvidenceCount: number;
};

export type ChecklistTemplateDraftForPublish = {
  checklistTemplateId: string;
  companyId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  items: ChecklistTemplateDraftItem[];
};

export type MobileChecklistToday = {
  evidenceCapabilities?: {
    captureAvailable: boolean;
    syntheticFixtureOnly: boolean;
    unavailableReason:
      | "feature_disabled"
      | "storage_unavailable"
      | "synthetic_fixture_unavailable"
      | null;
  };
  stores: Array<{ storeId: string; storeName: string }>;
  templates: Array<{
    checklistTemplateId: string;
    templateCode: string;
    templateType: ChecklistTemplateType;
    templateName: string;
    versionNo: number;
    items: Array<{
      templateItemId: string;
      sectionName: string;
      itemNo: number;
      itemText: string;
      responseType: ChecklistTemplateResponseType;
      weight: number;
      maxScore: number;
      minScore?: number;
      lowScoreThreshold?: number | null;
      requiresLowScoreNote?: boolean;
      evidencePolicy: ChecklistEvidencePolicy;
      maxEvidenceCount: number;
    }>;
  }>;
  activeInstances: Array<{
    checklistInstanceId: string;
    checklistTemplateId: string;
    storeId: string;
    status: ChecklistInstanceStatus;
    startedAt: string | null;
    updatedAt: string | null;
    evidenceVersion: number;
    evidence: Array<{
      templateItemId: string;
      mediaAssetId: string;
      displayOrder: number;
      captureSource: "camera" | "gallery" | "system_generated";
      thumbnailAvailable: boolean;
    }>;
    responses: Array<{
      templateItemId: string;
      responseValue: string | null;
      scoreValue: number;
      commentText: string | null;
    }>;
  }>;
  completedThisMonth: Array<{
    checklistInstanceId: string;
    checklistTemplateId: string;
    storeId: string;
    completedAt: string;
    totalScore: number | null;
    acknowledgedAt: string | null;
  }>;
  pendingAcknowledgements: Array<{
    checklistInstanceId: string;
    checklistTemplateId: string;
    storeId: string;
    completedAt: string;
    totalScore: number | null;
  }>;
  monthlySummaries: Array<{
    storeId: string;
    checklistTemplateId: string;
    monthStart: string;
    completedCount: number;
    averageScore: number | null;
  }>;
};
