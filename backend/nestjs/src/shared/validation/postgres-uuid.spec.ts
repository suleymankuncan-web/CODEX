import { isPostgresUuidString } from "./postgres-uuid";

describe("isPostgresUuidString", () => {
  it("accepts deterministic PostgreSQL UUID values used by seeded demo data", () => {
    expect(isPostgresUuidString("00000000-0000-0000-0000-000000000100")).toBe(true);
  });

  it("rejects malformed UUID values", () => {
    expect(isPostgresUuidString("not-a-uuid")).toBe(false);
  });
});
