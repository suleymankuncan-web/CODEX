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
    ).resolves.toEqual({ items: [], total: 0 });

    expect(query).not.toHaveBeenCalled();
  });

  it("loads bounded acknowledgement summary rows without response details by default", async () => {
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
          completed_by_display_name: "Eda Doğanay",
          completed_at: "2026-05-14T08:00:00.000Z",
          status: "completed",
          total_score: "0.00",
          compliance_rate: "0.0000",
          checklist_acknowledgement_id: null,
          acknowledged_by_user_id: null,
          acknowledgement_note: null,
          acknowledged_at: null,
          responses_json: [],
          total_count: "125",
        },
      ],
    }));
    const repository = new ChecklistAcknowledgementRepository({ query } as never);

    const result = await repository.listChecklistAcknowledgements({
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      limit: 50,
      offset: 25,
    });

    const [sql, params] = query.mock.calls[0];
    expect(sql).not.toContain("jsonb_agg");
    expect(sql).not.toContain("ops.checklist_template_item");
    expect(sql).not.toContain("ops.checklist_response");
    expect(sql).toContain("LIMIT $2::integer");
    expect(sql).toContain("OFFSET $3::integer");
    expect(params).toEqual([["store-1"], 50, 25]);
    expect(result).toMatchObject({
      total: 125,
      items: [
        {
          checklistInstanceId: "instance-1",
          totalScore: 0,
          complianceRate: 0,
          responses: [],
        },
      ],
    });
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
          completed_by_display_name: "Eda Doğanay",
          completed_at: "2026-05-14T08:00:00.000Z",
          status: "completed",
          total_score: "74.50",
          region_manager_names: ["Ayşe Bölge"],
          store_manager_names: ["Çağrı Mağaza"],
          compliance_rate: "0.7500",
          checklist_acknowledgement_id: null,
          acknowledged_by_user_id: null,
          acknowledgement_note: null,
          acknowledged_at: null,
          total_count: "1",
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
      includeResponses: true,
    });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("ct.template_type = ANY");
    expect(sql).toContain("jsonb_agg");
    expect(sql).toContain("ops.checklist_template_item");
    expect(sql).toContain("ops.checklist_response");
    expect(sql).toContain("ops.user_account completed_user");
    expect(sql).toContain("ops.employee auditor_employee");
    expect(sql).toContain("ORDER BY cti.item_no ASC, cti.template_item_id ASC");
    expect(sql).toContain("cti.checklist_template_id = ci.checklist_template_id");
    expect(sql).toContain("assigned.store_id = ci.store_id");
    expect(sql).toContain("assigned.end_at > NOW()");
    expect(sql).toContain("role.role_code IN ('REGION_MANAGER', 'STORE_MANAGER')");
    expect(sql).toContain("region.company_id = s.company_id");
    expect(params).toEqual([["store-1"], ["VM_STORE_VISIT"], 50, 0]);
    expect(result.items[0]).toMatchObject({
      templateType: "VM_STORE_VISIT",
      completedByUserId: "vm-user-1",
      completedByDisplayName: "Eda Doğanay",
      signatories: { regionManagerNames: ["Ayşe Bölge"], storeManagerNames: ["Çağrı Mağaza"] },
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

  it("loads completed checklist remediation source rows with persisted non-compliance flags", async () => {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({
      rowCount: 1,
      rows: [
        {
          checklist_instance_id: "instance-1",
          checklist_template_id: "template-1",
          template_name: "BM Visit",
          template_type: "BM_STORE_VISIT",
          category: "BM",
          store_id: "store-1",
          store_name: "Bursa Marka Park",
          completed_at: "2026-05-20T12:36:00.000Z",
          responses_json: [
            {
              templateItemId: "item-1",
              sectionName: "Kasa",
              itemNo: 3,
              itemText: "Kasa duzeni standartlara uygun mu?",
              responseType: "score",
              weight: "20.00",
              maxScore: "10.00",
              scoreValue: "2.00",
              commentText: "Kasa alani duzensiz",
              isNonCompliant: true,
              createsRemediationTask: false,
            },
            {
              templateItemId: "item-2",
              sectionName: "Ekip",
              itemNo: 4,
              itemText: "Ekip standartlari uygun mu?",
              responseType: "yes_no",
              weight: "10.00",
              maxScore: "1.00",
              scoreValue: "1.00",
              commentText: null,
              isNonCompliant: false,
            },
          ],
        },
      ],
    }));
    const repository = new ChecklistAcknowledgementRepository({ query } as never);

    const result = await repository.getChecklistRemediationSource("instance-1");

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("ci.status = 'completed'");
    expect(sql).toContain("'isNonCompliant', COALESCE(cr.is_non_compliant, FALSE)");
    expect(sql).toContain("'createsRemediationTask', cti.creates_remediation_task");
    expect(sql).toContain("'expectedValue', cti.expected_value");
    expect(params).toEqual(["instance-1"]);
    expect(result).toMatchObject({
      checklistInstanceId: "instance-1",
      checklistTemplateId: "template-1",
      templateType: "BM_STORE_VISIT",
      storeId: "store-1",
      storeName: "Bursa Marka Park",
      responses: [
        {
          templateItemId: "item-1",
          itemText: "Kasa duzeni standartlara uygun mu?",
          scoreValue: 2,
          isNonCompliant: true,
          createsRemediationTask: false,
        },
        {
          templateItemId: "item-2",
          isNonCompliant: false,
        },
      ],
    });
  });

  it("derives remediation non-compliance from low score threshold when persisted flag is false", async () => {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({
      rowCount: 1,
      rows: [
        {
          checklist_instance_id: "instance-1",
          checklist_template_id: "template-1",
          template_name: "BM Visit",
          template_type: "BM_STORE_VISIT",
          category: "BM",
          store_id: "store-1",
          store_name: "Bursa Marka Park",
          completed_at: "2026-05-20T12:36:00.000Z",
          responses_json: [
            {
              templateItemId: "item-1",
              sectionName: "Kasa",
              itemNo: 3,
              itemText: "Kasa duzeni standartlara uygun mu?",
              responseType: "score",
              weight: "20.00",
              maxScore: "10.00",
              expectedValue: JSON.stringify({ lowScoreThreshold: 6 }),
              scoreValue: "2.00",
              commentText: "Kasa alani duzensiz",
              isNonCompliant: false,
            },
          ],
        },
      ],
    }));
    const repository = new ChecklistAcknowledgementRepository({ query } as never);

    const result = await repository.getChecklistRemediationSource("instance-1");

    expect(result?.responses[0]).toMatchObject({
      templateItemId: "item-1",
      scoreValue: 2,
      isNonCompliant: true,
    });
  });

  it("derives remediation non-compliance when JSONB expected value is returned as an object", async () => {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({
      rowCount: 1,
      rows: [
        {
          checklist_instance_id: "instance-1",
          checklist_template_id: "template-1",
          template_name: "BM Visit",
          template_type: "BM_STORE_VISIT",
          category: "BM",
          store_id: "store-1",
          store_name: "Bursa Marka Park",
          completed_at: "2026-05-20T12:36:00.000Z",
          responses_json: [
            {
              templateItemId: "item-1",
              sectionName: "Kasa",
              itemNo: 3,
              itemText: "Kasa duzeni standartlara uygun mu?",
              responseType: "score",
              weight: "20.00",
              maxScore: "10.00",
              expectedValue: { lowScoreThreshold: 6 },
              scoreValue: "2.00",
              commentText: "Kasa alani duzensiz",
              isNonCompliant: false,
            },
          ],
        },
      ],
    }));
    const repository = new ChecklistAcknowledgementRepository({ query } as never);

    const result = await repository.getChecklistRemediationSource("instance-1");

    expect(result?.responses[0]).toMatchObject({
      templateItemId: "item-1",
      scoreValue: 2,
      isNonCompliant: true,
    });
  });

  it("preserves the original acknowledgement identity and timestamp on retry", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ checklist_instance_id: "instance-1", store_id: "store-1" }] })
      .mockResolvedValueOnce({ rows: [{
        checklist_acknowledgement_id: "ack-1",
        acknowledged_by_user_id: "original-user",
        acknowledgement_note: "Original note",
        acknowledged_at: "2026-05-20T12:36:00.000Z",
      }] })
      .mockResolvedValueOnce({ rows: [] });
    const database = {
      withTransaction: jest.fn(async (callback: (client: { query: jest.Mock }) => unknown) => callback({ query })),
    };
    const repository = new ChecklistAcknowledgementRepository(database as never);

    const result = await repository.acknowledgeChecklist({
      checklistInstanceId: "instance-1",
      actorUserId: "retry-user",
      acknowledgementNote: "Retry note",
    });

    const upsertSql = String(query.mock.calls[1][0]);
    expect(upsertSql).toContain("SET checklist_instance_id = EXCLUDED.checklist_instance_id");
    expect(upsertSql).not.toContain("acknowledged_at =");
    expect(upsertSql).not.toContain("acknowledged_by_user_id =");
    expect(upsertSql).not.toContain("acknowledgement_note =");
    expect(result).toEqual({
      checklistAcknowledgementId: "ack-1",
      acknowledgedByUserId: "original-user",
      acknowledgementNote: "Original note",
      acknowledgedAt: "2026-05-20T12:36:00.000Z",
    });
  });
});
