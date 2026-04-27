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
});
