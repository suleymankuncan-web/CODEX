import { ChecklistRepository } from "./checklist.repository";

describe("checklist response hardening", () => {
  it("preserves null checklist scores when every item is N/A", async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [{
      total_score: null, compliance_rate: null,
      missing_mandatory_count: "0", missing_required_evidence_count: "0",
    }] });
    const repository = new ChecklistRepository({ query } as never);
    await expect(repository.calculateMobileChecklistCompletion("instance-1")).resolves.toEqual({
      totalScore: null, complianceRate: null, missingMandatoryCount: 0, missingRequiredEvidenceCount: 0,
    });
  });

  it.each([undefined, "", " \t\n"])("rejects mobile N/A without a reason %p before persistence", async (commentText) => {
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [{
      checklist_instance_id: "instance-1", status: "in_progress", response_type: "compliance",
      max_score: "2.00", expected_value: null,
    }] }) };
    const repository = new ChecklistRepository({
      withTransaction: async (work: (transaction: typeof client) => Promise<unknown>) => work(client),
    } as never);
    await expect(repository.saveMobileChecklistResponse({
      checklistInstanceId: "instance-1", templateItemId: "item-1", actorUserId: "user-1",
      responseValue: "not_applicable", scoreValue: 0, commentText,
    })).rejects.toThrow("not_applicable_reason_required");
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("normalizes a valid mobile N/A reason and ignores forged score", async () => {
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [{
      checklist_instance_id: "instance-1", status: "in_progress", response_type: "compliance",
      max_score: "2.00", expected_value: null,
    }] }).mockResolvedValue({ rows: [{ response_id: "response-1" }] }) };
    const repository = new ChecklistRepository({
      withTransaction: async (work: (transaction: typeof client) => Promise<unknown>) => work(client),
    } as never);
    await repository.saveMobileChecklistResponse({
      checklistInstanceId: "instance-1", templateItemId: "item-1", actorUserId: "user-1",
      responseValue: "not_applicable", scoreValue: 100, commentText: " No display ",
    });
    expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining("INSERT INTO ops.checklist_response"),
      ["instance-1", "item-1", "not_applicable", 0, "No display", false]);
  });

  it("blocks mobile completion when the shared aggregate finds a reasonless N/A", async () => {
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [{
      checklist_instance_id: "instance-1", store_id: "store-1", status: "in_progress",
    }] }).mockResolvedValueOnce({ rows: [{
      total_score: null, compliance_rate: null,
      missing_mandatory_count: "1", missing_required_evidence_count: "0",
    }] }) };
    const repository = new ChecklistRepository({
      withTransaction: async (work: (transaction: typeof client) => Promise<unknown>) => work(client),
    } as never);
    await expect(repository.completeMobileChecklistInstance({
      checklistInstanceId: "instance-1", actorUserId: "user-1", actorRoleCodes: ["REGION_MANAGER"],
      actorActionScope: { assignedStoreIds: ["store-1"] },
    })).rejects.toThrow("Mandatory checklist responses are missing");
    expect(client.query).toHaveBeenCalledTimes(2);
  });
});
