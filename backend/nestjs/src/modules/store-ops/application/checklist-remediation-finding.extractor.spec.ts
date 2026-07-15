import {
  extractChecklistRemediationFindings,
  type ChecklistRemediationChecklistSource,
} from "./checklist-remediation-finding.extractor";

const baseSource: ChecklistRemediationChecklistSource = {
  checklistInstanceId: "11111111-1111-1111-1111-111111111111",
  checklistTemplateId: "22222222-2222-2222-2222-222222222222",
  templateName: "BM Store Visit",
  templateType: "BM_STORE_VISIT",
  category: "BM",
  storeId: "33333333-3333-3333-3333-333333333333",
  storeName: "Bursa Marka Park",
  completedAt: "2026-05-20T12:36:00.000Z",
  responses: [],
};

function response(
  overrides: Partial<ChecklistRemediationChecklistSource["responses"][number]> = {},
): ChecklistRemediationChecklistSource["responses"][number] {
  return {
    templateItemId: "44444444-4444-4444-4444-444444444444",
    sectionName: "Kasa",
    itemNo: 3,
    itemText: "Kasa duzeni standartlara uygun mu?",
    responseType: "score",
    weight: 10,
    maxScore: 10,
    scoreValue: 4,
    commentText: "Etiketler eksik",
    isNonCompliant: true,
    ...overrides,
  };
}

describe("extractChecklistRemediationFindings", () => {
  it("creates no findings when the checklist has no non-compliant source rows", () => {
    const result = extractChecklistRemediationFindings({
      ...baseSource,
      responses: [
        response({ isNonCompliant: false, scoreValue: 2 }),
        response({
          templateItemId: "55555555-5555-5555-5555-555555555555",
          isNonCompliant: false,
          scoreValue: 0,
        }),
      ],
    });

    expect(result).toEqual({
      findings: [],
      blockedReasons: [],
    });
  });

  it("creates one deterministic finding for each non-compliant checklist row", () => {
    const result = extractChecklistRemediationFindings({
      ...baseSource,
      responses: [response()],
    });

    expect(result.blockedReasons).toEqual([]);
    expect(result.findings).toEqual([
      expect.objectContaining({
        sourceType: "checklist_remediation",
        sourceId:
          "checklist:11111111-1111-1111-1111-111111111111:item:44444444-4444-4444-4444-444444444444",
        sourceDeepLink: "/store/checklists?overlay=result&checklistInstanceId=11111111-1111-1111-1111-111111111111",
        priority: "high",
        templateName: "BM Store Visit",
        templateType: "BM_STORE_VISIT",
        storeName: "Bursa Marka Park",
        sectionName: "Kasa",
        itemText: "Kasa duzeni standartlara uygun mu?",
        scoreValue: 4,
        maxScore: 10,
        commentText: "Etiketler eksik",
        title: "Kasa checklist bulgusu",
        summary: "BM Store Visit - Kasa duzeni standartlara uygun mu? - Not: Etiketler eksik",
      }),
    ]);
  });

  it("keeps comment optional without inventing remediation evidence", () => {
    const result = extractChecklistRemediationFindings({
      ...baseSource,
      responses: [response({ commentText: null })],
    });

    expect(result.blockedReasons).toEqual([]);
    expect(result.findings[0]?.summary).toBe("BM Store Visit - Kasa duzeni standartlara uygun mu?");
    expect(result.findings[0]?.commentText).toBeNull();
  });

  it("blocks incomplete non-compliant source rows instead of creating fake tasks", () => {
    const result = extractChecklistRemediationFindings({
      ...baseSource,
      responses: [response({ templateItemId: "", itemText: "" })],
    });

    expect(result.findings).toEqual([]);
    expect(result.blockedReasons).toEqual([
      "Checklist remediation source metadata missing for checklist 11111111-1111-1111-1111-111111111111: templateItemId, itemText",
    ]);
  });

  it("reports a missing checklist source as blocked work", () => {
    const result = extractChecklistRemediationFindings(null);

    expect(result).toEqual({
      findings: [],
      blockedReasons: ["Checklist source is missing"],
    });
  });
});
