import type { StoreActionPlanPriority, StoreActionPlanSourceType } from "./store-action-plan.contract";

export type ChecklistRemediationResponseSource = {
  templateItemId: string;
  sectionName: string;
  itemNo: number;
  itemText: string;
  responseType: string;
  weight: number;
  maxScore: number;
  scoreValue: number | null;
  commentText: string | null;
  isNonCompliant: boolean;
  createsRemediationTask: boolean;
};

export type ChecklistRemediationChecklistSource = {
  checklistInstanceId: string;
  checklistTemplateId: string;
  templateName: string;
  templateType: string;
  category: string;
  storeId: string;
  storeName: string;
  completedAt: string | null;
  responses: readonly ChecklistRemediationResponseSource[];
};

export type ChecklistRemediationFinding = {
  sourceType: Extract<StoreActionPlanSourceType, "checklist_remediation">;
  sourceId: string;
  sourceDeepLink: string;
  priority: Extract<StoreActionPlanPriority, "high">;
  checklistInstanceId: string;
  checklistTemplateId: string;
  templateItemId: string;
  templateName: string;
  templateType: string;
  storeId: string;
  storeName: string;
  sectionName: string;
  itemNo: number;
  itemText: string;
  responseType: string;
  scoreValue: number | null;
  maxScore: number;
  commentText: string | null;
  title: string;
  summary: string;
};

export type ChecklistRemediationExtractionResult = {
  findings: ChecklistRemediationFinding[];
  blockedReasons: string[];
};

export function extractChecklistRemediationFindings(
  source: ChecklistRemediationChecklistSource | null,
): ChecklistRemediationExtractionResult {
  if (!source) {
    return {
      findings: [],
      blockedReasons: ["Checklist source is missing"],
    };
  }

  const findings: ChecklistRemediationFinding[] = [];
  const blockedReasons: string[] = [];

  for (const response of source.responses) {
    if (!response.isNonCompliant || response.createsRemediationTask === false) {
      continue;
    }

    const missingFields = getMissingFindingFields(source, response);
    if (missingFields.length > 0) {
      blockedReasons.push(
        `Checklist remediation source metadata missing for checklist ${source.checklistInstanceId}: ${missingFields.join(", ")}`,
      );
      continue;
    }

    findings.push({
      sourceType: "checklist_remediation",
      sourceId: buildChecklistRemediationSourceId({
        checklistInstanceId: source.checklistInstanceId,
        templateItemId: response.templateItemId,
      }),
      sourceDeepLink: buildChecklistRemediationSourceDeepLink(source.checklistInstanceId),
      priority: "high",
      checklistInstanceId: source.checklistInstanceId,
      checklistTemplateId: source.checklistTemplateId,
      templateItemId: response.templateItemId,
      templateName: source.templateName,
      templateType: source.templateType,
      storeId: source.storeId,
      storeName: source.storeName,
      sectionName: response.sectionName,
      itemNo: response.itemNo,
      itemText: response.itemText,
      responseType: response.responseType,
      scoreValue: response.scoreValue,
      maxScore: response.maxScore,
      commentText: response.commentText,
      title: buildChecklistRemediationTitle(response),
      summary: buildChecklistRemediationSummary(source, response),
    });
  }

  return { findings, blockedReasons };
}

function buildChecklistRemediationSourceId(input: {
  checklistInstanceId: string;
  templateItemId: string;
}) {
  return `checklist:${input.checklistInstanceId}:item:${input.templateItemId}`;
}

function buildChecklistRemediationSourceDeepLink(checklistInstanceId: string) {
  return `/store/checklists?overlay=result&checklistInstanceId=${encodeURIComponent(checklistInstanceId)}`;
}

function buildChecklistRemediationTitle(response: ChecklistRemediationResponseSource) {
  const sectionName = response.sectionName.trim();
  if (sectionName.length === 0) {
    return "Checklist bulgusu";
  }

  return `${sectionName} checklist bulgusu`;
}

function buildChecklistRemediationSummary(
  source: ChecklistRemediationChecklistSource,
  response: ChecklistRemediationResponseSource,
) {
  const parts = [
    source.templateName.trim(),
    response.itemText.trim(),
    response.commentText?.trim() ? `Not: ${response.commentText.trim()}` : "",
  ].filter((part) => part.length > 0);

  return parts.join(" - ");
}

function getMissingFindingFields(
  source: ChecklistRemediationChecklistSource,
  response: ChecklistRemediationResponseSource,
) {
  const missingFields: string[] = [];

  if (source.checklistInstanceId.trim().length === 0) missingFields.push("checklistInstanceId");
  if (source.checklistTemplateId.trim().length === 0) missingFields.push("checklistTemplateId");
  if (source.templateName.trim().length === 0) missingFields.push("templateName");
  if (source.templateType.trim().length === 0) missingFields.push("templateType");
  if (source.storeId.trim().length === 0) missingFields.push("storeId");
  if (source.storeName.trim().length === 0) missingFields.push("storeName");
  if (response.templateItemId.trim().length === 0) missingFields.push("templateItemId");
  if (response.itemText.trim().length === 0) missingFields.push("itemText");

  return missingFields;
}
