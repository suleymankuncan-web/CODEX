import { ChecklistAcknowledgementRepository } from "./checklist-acknowledgement.repository";

describe("ChecklistAcknowledgementRepository access scope contract", () => {
  it("returns no acknowledgements without querying when actor scope is empty", async () => {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({
      rowCount: 0,
      rows: [],
    }));
    const repository = new ChecklistAcknowledgementRepository({ query } as never);

    await expect(
      repository.listChecklistAcknowledgements({
        companyIds: [],
        regionIds: [],
        storeIds: [],
      }),
    ).resolves.toEqual([]);

    expect(query).not.toHaveBeenCalled();
  });

  it("loads response detail rows and filters result visibility by template type", async () => {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({
      rowCount: 1,
      rows: [
        {
          checklist_instance_id: "instance-1",
          checklist_template_id: "template-1",
          template_name: "VM Visit",
          template_type: "VM_STORE_VISIT",
          category: "VM",
          store_id: "store-1",
          store_name: "Marmara Park",
          completed_by_user_id: "vm-user-1",
          completed_at: "2026-05-14T08:00:00.000Z",
          status: "completed",
          total_score: "74.50",
          compliance_rate: "0.7500",
          checklist_acknowledgement_id: null,
          acknowledged_by_user_id: null,
          acknowledgement_note: null,
          acknowledged_at: null,
          responses_json: [
            {
              templateItemId: "item-1",
              sectionName: "Vitrin",
              itemNo: 1,
              itemText: "Vitrin standartlari",
              responseType: "score",
              weight: "60.00",
              maxScore: "10.00",
              scoreValue: "5.00",
              commentText: "Eksik manken",
            },
          ],
        },
      ],
    }));
    const repository = new ChecklistAcknowledgementRepository({ query } as never);

    const result = await repository.listChecklistAcknowledgements({
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      allowedTemplateTypes: ["VM_STORE_VISIT"],
    });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("ct.template_type = ANY");
    expect(sql).toContain("jsonb_agg");
    expect(sql).toContain("ops.checklist_template_item");
    expect(sql).toContain("ops.checklist_response");
    expect(params).toEqual([["store-1"], ["VM_STORE_VISIT"]]);
    expect(result[0]).toMatchObject({
      templateType: "VM_STORE_VISIT",
      completedByUserId: "vm-user-1",
      responses: [
        {
          templateItemId: "item-1",
          sectionName: "Vitrin",
          itemNo: 1,
          itemText: "Vitrin standartlari",
          weight: 60,
          maxScore: 10,
          scoreValue: 5,
          commentText: "Eksik manken",
        },
      ],
    });
  });
});
