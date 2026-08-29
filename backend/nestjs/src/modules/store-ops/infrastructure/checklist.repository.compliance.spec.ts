import { ChecklistRepository } from "./checklist.repository";

function createHarness() {
  const client = { query: jest.fn() };
  const databaseService = {
    query: jest.fn(),
    withTransaction: jest.fn(async (work: (value: typeof client) => Promise<unknown>) => work(client)),
  };
  return { client, repository: new ChecklistRepository(databaseService as never) };
}

describe("ChecklistRepository compliance responses", () => {
  it.each([
    ["compliant", 2, false],
    ["partially_compliant", 1, true],
    ["non_compliant", 0, true],
    ["not_applicable", 0, false],
  ] as const)(
    "persists compliance answer %s with server-derived score",
    async (responseValue, expectedScore, expectedNonCompliant) => {
      const { client, repository } = createHarness();
      client.query
        .mockResolvedValueOnce({
          rows: [{
            checklist_instance_id: "instance-1",
            store_id: "store-1",
            status: "in_progress",
            response_type: "compliance",
            max_score: "2.00",
            expected_value: null,
          }],
        })
        .mockResolvedValueOnce({
          rows: [{ response_id: "response-1", responded_at: "2026-08-27T10:00:00.000Z" }],
        })
        .mockResolvedValueOnce({ rows: [] });

      await repository.saveMobileChecklistResponse({
        checklistInstanceId: "instance-1",
        templateItemId: "item-1",
        scoreValue: 99,
        responseValue,
        actorUserId: "user-1",
      });

      expect(client.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("response_value"),
        ["instance-1", "item-1", responseValue, expectedScore, null, expectedNonCompliant],
      );
    },
  );

  it("requires a response value for compliance answers", async () => {
    const { client, repository } = createHarness();
    client.query.mockResolvedValueOnce({
      rows: [{
        checklist_instance_id: "instance-1",
        store_id: "store-1",
        status: "in_progress",
        response_type: "compliance",
        max_score: "2.00",
        expected_value: null,
      }],
    });

    await expect(repository.saveMobileChecklistResponse({
      checklistInstanceId: "instance-1",
      templateItemId: "item-1",
      scoreValue: 2,
      actorUserId: "user-1",
    })).rejects.toThrow("Checklist compliance response value is required");
  });
});
