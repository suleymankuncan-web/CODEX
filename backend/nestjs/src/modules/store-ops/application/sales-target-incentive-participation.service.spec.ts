import { SalesTargetIncentiveParticipationService } from "./sales-target-incentive-participation.service";

const storeId = "00000000-0000-4000-8000-000000000201";
const input = { period: "2026-05", storeId, employeeId: "00000000-0000-4000-8000-000000000801", included: false,
  reasonNote: " Not eligible for this package ", expectedRevision: 0, expectedSnapshotId: "00000000-0000-4000-8000-000000000401" };
const actor = { userId: "actor-a", roleCodes: ["REGION_MANAGER"], actionScope: { assignedStoreIds: [storeId] } };

describe("incentive participation authorization and reason", () => {
  it("uses the authenticated actor, normalizes the reason and retains explicit source revision zero", async () => {
    const repository = { setParticipation: jest.fn().mockResolvedValue({ revision: 1 }) };
    const service = new SalesTargetIncentiveParticipationService(repository as never);
    await expect(service.setParticipation({ ...input, actor: actor as never })).resolves.toEqual({ data: { revision: 1 } });
    expect(repository.setParticipation).toHaveBeenCalledWith({ ...input, actorUserId: "actor-a", reasonNote: "Not eligible for this package" });
  });
  it.each([undefined, "", " \t\n", "ab"])("rejects exclusion without a meaningful reason %p", async (reasonNote) => {
    const repository = { setParticipation: jest.fn() };
    const service = new SalesTargetIncentiveParticipationService(repository as never);
    await expect(service.setParticipation({ ...input, reasonNote, actor: actor as never })).rejects.toThrow("exclusion reason");
    expect(repository.setParticipation).not.toHaveBeenCalled();
  });
  it.each([[-1, "2026-05"], [0.5, "2026-05"], [2147483647, "2026-05"], [0, "2026-13"]])("rejects invalid revision/period %p %p", async (expectedRevision, period) => {
    const repository = { setParticipation: jest.fn() };
    const service = new SalesTargetIncentiveParticipationService(repository as never);
    await expect(service.setParticipation({ ...input, expectedRevision: Number(expectedRevision), period: String(period), actor: actor as never })).rejects.toThrow("valid participation");
    expect(repository.setParticipation).not.toHaveBeenCalled();
  });
  it.each([{ ...actor, roleCodes: ["REPORT_VIEWER"] }, { ...actor, actionScope: { assignedStoreIds: [] } }])("does not inherit company/global read authority into participation writes", async (deniedActor) => {
    const repository = { setParticipation: jest.fn() };
    const service = new SalesTargetIncentiveParticipationService(repository as never);
    await expect(service.setParticipation({ ...input, actor: deniedActor as never })).rejects.toThrow("Assigned Region Manager");
    expect(repository.setParticipation).not.toHaveBeenCalled();
  });
});
