import {
  buildChecklistResultPdfProjection,
  ChecklistResultPdfRenderer,
} from "./checklist-result-pdf.renderer";
import { UnprocessableEntityException } from "@nestjs/common";
import { CHECKLIST_RESULT_PDF_LIMITS } from "./checklist-result-pdf.renderer";

describe("ChecklistResultPdfRenderer", () => {
  it("projects the Turkish modal semantics without exposing IDs or hidden comments", () => {
    const projection = buildChecklistResultPdfProjection({
      checklistInstanceId: "00000000-0000-4000-8000-000000000001",
      templateName: "Ziyaret",
      templateType: "BM_STORE_VISIT",
      category: "Çalışma",
      storeName: "İstanbul Mağaza",
      completedByUserId: "00000000-0000-4000-8000-000000000004",
      completedByDisplayName: null,
      completedAt: "2026-08-20T10:30:00.000Z",
      status: "completed",
      totalScore: null,
      complianceRate: 0.75,
      responses: [
        {
          templateItemId: "00000000-0000-4000-8000-000000000010",
          sectionName: "Bölüm",
          itemNo: 1,
          itemText: "Uygunluk",
          responseType: "compliance",
          responseValue: "compliant",
          scoreValue: 8,
          maxScore: 10,
          weight: 2,
        },
        {
          templateItemId: "00000000-0000-4000-8000-000000000011",
          sectionName: "Bölüm",
          itemNo: 2,
          itemText: "Evet mi?",
          responseType: "yes_no",
          responseValue: "yes",
          scoreValue: 0,
          maxScore: 10,
          weight: 4,
        },
        {
          templateItemId: "00000000-0000-4000-8000-000000000012",
          sectionName: "Bölüm",
          itemNo: 3,
          itemText: "Açıklama",
          responseType: "text",
          responseValue: "raw value must not be appended",
          commentText: "ÇĞİÖŞÜçğıöşü açıklaması",
          scoreValue: null,
          maxScore: 10,
          weight: 1,
        },
        {
          templateItemId: "00000000-0000-4000-8000-000000000013",
          sectionName: "Bölüm",
          itemNo: 4,
          itemText: "Gizli \u202Enot",
          responseType: "score",
          responseValue: "8",
          commentText: "Bu yorum görünmemeli",
          scoreValue: 8,
          maxScore: 10,
          weight: 1,
        },
      ],
      acknowledgement: {
        checklistAcknowledgementId: "00000000-0000-4000-8000-000000000020",
        acknowledgedByUserId: "00000000-0000-4000-8000-000000000021",
        acknowledgementNote: "Not",
        acknowledgedAt: "2026-08-20T11:00:00.000Z",
      },
    });

    expect(projection.title).toBe("Kontrol Listesi Sonucu");
    expect(projection.labels).toMatchObject({
      category: "Kategori",
      store: "Mağaza",
      completedAt: "Tamamlanma",
      completedBy: "Tamamlayan",
      score: "Skor",
      sections: "Bölümler",
      answer: "Cevap",
      points: "Puan",
      acknowledgement: "Mağaza kabulü",
      acknowledged: "Kabul edildi",
      acknowledgedAt: "Kabul tarihi",
      note: "Not",
    });
    expect(projection.templateType).toBeUndefined();
    expect(projection.completedBy).toBe("Bilinmiyor");
    expect(projection.score).toBe("75");
    expect(projection.sections[0]).toMatchObject({
      name: "Bölüm",
      earnedPoints: 2.4,
      maxPoints: 7,
      percent: 34,
    });
    expect(projection.sections[0]?.questions.map((question) => question.answer)).toEqual([
      "Uygun",
      "Hayır",
      "ÇĞİÖŞÜçğıöşü açıklaması",
      "8",
    ]);
    expect(projection.sections[0]?.questions[2]?.answer).toBe("ÇĞİÖŞÜçğıöşü açıklaması");
    expect(projection.acknowledgement).toMatchObject({
      label: "Mağaza kabulü",
      status: "Kabul edildi",
      acknowledgedAtLabel: "Kabul tarihi",
      noteLabel: "Not",
    });
    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain("BM_STORE_VISIT");
    expect(serialized).not.toContain("00000000-0000-4000-8000-000000000");
    expect(serialized).not.toContain("Bu yorum görünmemeli");
    expect(serialized).not.toContain("\u202E");
    expect(serialized).not.toContain("—");
    expect(serialized).not.toContain("–");
  });

  it("maps every supported answer type like the result modal", () => {
    const projection = buildChecklistResultPdfProjection({
      responses: [
        { responseType: "compliance", responseValue: "compliant", scoreValue: 1, maxScore: 1 },
        { responseType: "compliance", responseValue: "partially_compliant", scoreValue: 1, maxScore: 1 },
        { responseType: "compliance", responseValue: "non_compliant", scoreValue: 1, maxScore: 1 },
        { responseType: "compliance", responseValue: "not_applicable", scoreValue: 1, maxScore: 1 },
        { responseType: "yes_no", scoreValue: 1, maxScore: 1 },
        { responseType: "boolean", scoreValue: 0, maxScore: 1 },
        { responseType: "yes_no", scoreValue: null, maxScore: 1 },
        { responseType: "partial", scoreValue: 8, maxScore: 10 },
        { responseType: "partial", scoreValue: 5, maxScore: 10 },
        { responseType: "partial", scoreValue: 2, maxScore: 10 },
        { responseType: "partial", scoreValue: null, maxScore: 10 },
        { responseType: "text", responseValue: "ignored", commentText: "Metin", scoreValue: 1, maxScore: 1 },
        { responseType: "other", scoreValue: 3.5, maxScore: 5 },
      ],
    });

    expect(projection.sections[0]?.questions.map((question) => question.answer)).toEqual([
      "Uygun",
      "Kısmen Uygun",
      "Uygun Değil",
      "N/A",
      "Evet",
      "Hayır",
      "Yanıt yok",
      "Uygun",
      "Takip",
      "Kritik",
      "Yanıt yok",
      "Metin",
      "3,5",
    ]);
  });

  it("renders a complete PDF with visible checklist result fields", async () => {
    const renderer = new ChecklistResultPdfRenderer();

    const result = await renderer.render({
      checklistInstanceId: "00000000-0000-4000-8000-000000000001",
      templateName: "BM Store Visit",
      templateType: "BM_STORE_VISIT",
      category: "Marka",
      storeName: "İstanbul Çarşı",
      completedByDisplayName: "Ayşe Yılmaz",
      completedAt: "2026-08-20T10:30:00.000Z",
      status: "completed",
      totalScore: 86,
      complianceRate: 0.86,
      responses: [
        {
          templateItemId: "00000000-0000-4000-8000-000000000002",
          sectionName: "Kasa",
          itemNo: 1,
          itemText: "Çalışma alanı düzenli mi?",
          responseType: "score",
          weight: 50,
          maxScore: 10,
          responseValue: "8",
          scoreValue: 8,
          commentText: "Bu not görünmemeli",
        },
      ],
      acknowledgement: {
        checklistAcknowledgementId: "00000000-0000-4000-8000-000000000003",
        acknowledgedByUserId: "00000000-0000-4000-8000-000000000004",
        acknowledgementNote: "Onaylandı",
        acknowledgedAt: "2026-08-20T11:00:00.000Z",
      },
    });

    expect(result.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(result.length).toBeGreaterThan(100);
    expect(result.toString("latin1").match(/\/Type \/Page\b/g) ?? []).toHaveLength(1);
  });

  it("renders long results across explicit pages and keeps Turkish text renderable", async () => {
    const renderer = new ChecklistResultPdfRenderer();
    const result = await renderer.render({
      templateName: "Noto Sans ÇĞİÖŞÜçğıöşü",
      category: "Kategori",
      storeName: "İstanbul Mağaza",
      completedAt: "2026-08-20T10:30:00.000Z",
      status: "completed",
      responses: Array.from({ length: 90 }, (_, index) => ({
        templateItemId: `item-${index}`,
        sectionName: `Bölüm ${Math.floor(index / 15)}`,
        itemNo: index + 1,
        itemText: `Çalışma alanı düzeni ${index} — ÇĞİÖŞÜçğıöşü `.repeat(3),
        responseType: "score",
        maxScore: 10,
        scoreValue: 8,
        responseValue: "8",
      })),
    });

    const pageCount = (result.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
    expect(pageCount).toBeGreaterThan(1);
    expect(result.subarray(-20).toString("latin1")).toContain("%%EOF");
  });

  it("rejects oversized input with 422 instead of truncating", async () => {
    const renderer = new ChecklistResultPdfRenderer();
    await expect(
      renderer.render({
        templateName: "x".repeat(CHECKLIST_RESULT_PDF_LIMITS.maxFieldCharacters + 1),
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    await expect(
      renderer.render({
        responses: Array.from({ length: CHECKLIST_RESULT_PDF_LIMITS.maxResponses + 1 }, () => ({})),
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    const boundedField = "x".repeat(CHECKLIST_RESULT_PDF_LIMITS.maxFieldCharacters - 1);
    const fieldsToExceedTotal = Math.ceil(
      CHECKLIST_RESULT_PDF_LIMITS.maxTotalCharacters / boundedField.length,
    );
    await expect(
      renderer.render({
        responses: Array.from({ length: fieldsToExceedTotal }, () => ({
          itemText: boundedField,
        })),
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
