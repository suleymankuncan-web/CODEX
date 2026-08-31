import {
  mapAuthActionStoreAssignment,
  mapAuthAssignment,
} from "./auth-admin-response.mapper";

describe("auth admin response mappers", () => {
  const baseActionStoreAssignment = {
    user_action_store_assignment_id: "assignment-1",
    user_id: "user-1",
    store_id: "store-1",
    store_code: "STORE-1",
    store_name: "Store One",
    company_id: "company-1",
    region_id: "region-1",
    region_name: "Region One",
    start_at: "2026-08-30T10:00:00.000Z",
    end_at: null as string | null,
    created_at: "2026-08-30T10:00:00.000Z",
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-30T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    ["open current", "2026-08-30T10:00:00.000Z", null, true],
    [
      "finite current",
      "2026-08-30T10:00:00.000Z",
      "2026-08-30T12:00:00.001Z",
      true,
    ],
    ["future", "2026-08-30T12:00:00.001Z", "2026-08-30T13:00:00.000Z", false],
    ["expired", "2026-08-30T10:00:00.000Z", "2026-08-30T11:59:59.999Z", false],
    [
      "end at now",
      "2026-08-30T10:00:00.000Z",
      "2026-08-30T12:00:00.000Z",
      false,
    ],
  ])(
    "maps %s action-store assignments by the current half-open interval",
    (_label, startAt, endAt, active) => {
      expect(
        mapAuthActionStoreAssignment({
          ...baseActionStoreAssignment,
          start_at: startAt,
          end_at: endAt,
        }),
      ).toEqual(expect.objectContaining({ active }));
    },
  );

  it("keeps role assignment active mapping unchanged", () => {
    expect(
      mapAuthAssignment({
        user_role_assignment_id: "assignment-1",
        user_id: "user-1",
        role_code: "STORE_MANAGER",
        scope_type: "store",
        company_id: "company-1",
        region_id: "region-1",
        store_id: "store-1",
        start_at: "2026-08-30T13:00:00.000Z",
        end_at: "2026-08-30T14:00:00.000Z",
        created_at: "2026-08-30T10:00:00.000Z",
      }),
    ).toEqual(expect.objectContaining({ active: false }));
  });
});
