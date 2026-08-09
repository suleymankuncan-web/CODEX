import { RuntimeReadinessService } from "./runtime-readiness.service";

const readyMigrationStatus = {
  appliedCount: 2,
  checksumMismatches: [],
  failed: [],
  pending: [],
  totalFiles: 2,
  trackingTable: "present" as const,
  unknownApplied: [],
  unexpectedTracked: [],
};

const restrictedRuntimeRole = {
  role_name: "hr_axis_api",
  can_assume_role: false,
  database_create: false,
  owns_relation: false,
  owns_schema: false,
  role_can_create_database: false,
  role_can_create_role: false,
  role_inherits: false,
  role_is_superuser: false,
  schema_create: false,
};

function createService(options?: {
  strictLocal?: boolean;
  migrationStatus?: Partial<typeof readyMigrationStatus>;
  runtimeRole?: Partial<typeof restrictedRuntimeRole>;
  redisFailure?: Error;
  roleName?: string;
}) {
  const query = jest.fn().mockResolvedValue({
    rows: [{ ...restrictedRuntimeRole, role_name: options?.roleName ?? "hr_axis_api", ...options?.runtimeRole }],
  });
  const getMigrationStatus = jest.fn().mockResolvedValue({
    ...readyMigrationStatus,
    ...options?.migrationStatus,
  });
  const assertReady = options?.redisFailure
    ? jest.fn().mockRejectedValue(options.redisFailure)
    : jest.fn().mockResolvedValue(undefined);

  return {
    database: { query },
    migration: { getMigrationStatus },
    redis: { assertReady },
    service: new RuntimeReadinessService(
      { isStrictLocal: options?.strictLocal ?? true } as never,
      { query } as never,
      { getMigrationStatus } as never,
      { assertReady } as never,
    ),
  };
}

describe("RuntimeReadinessService", () => {
  it("keeps hosted startup unchanged", async () => {
    const fixture = createService({ strictLocal: false });

    await expect(fixture.service.assertReady("api")).resolves.toEqual({
      mode: "hosted",
      status: "ready",
    });
    expect(fixture.database.query).not.toHaveBeenCalled();
    expect(fixture.migration.getMigrationStatus).not.toHaveBeenCalled();
    expect(fixture.redis.assertReady).not.toHaveBeenCalled();
  });

  it.each([
    [{ trackingTable: "missing" as const }, "tracking table is missing"],
    [{ totalFiles: 0, appliedCount: 0 }, "migration tree is missing"],
    [{ pending: ["002_pending.sql"] }, "pending migrations"],
    [{ failed: [{ migrationName: "002_failed.sql" }] }, "failed migrations"],
    [{ checksumMismatches: ["001_changed.sql"] }, "checksum mismatch"],
    [{ unknownApplied: ["000_deleted.sql"] }, "unknown applied migrations"],
    [{ unexpectedTracked: ["002_deleted_running.sql"] }, "unexpected tracked migrations"],
  ])("fails strict-local startup for unsafe migration state", async (migrationStatus, message) => {
    const fixture = createService({ migrationStatus: migrationStatus as never });

    await expect(fixture.service.assertReady("worker")).rejects.toThrow(message);
    expect(fixture.database.query).not.toHaveBeenCalled();
  });

  it.each([
    ["role_is_superuser"],
    ["role_can_create_database"],
    ["role_can_create_role"],
    ["role_inherits"],
    ["database_create"],
    ["schema_create"],
    ["owns_schema"],
    ["owns_relation"],
    ["can_assume_role"],
  ] as const)("rejects a runtime role with DDL capability through %s", async (capability) => {
    const fixture = createService({ runtimeRole: { [capability]: true } });

    await expect(fixture.service.assertReady("api")).rejects.toThrow(
      "runtime database role has schema DDL capability",
    );
    expect(fixture.database.query).toHaveBeenCalledTimes(1);
    expect(fixture.database.query.mock.calls[0][0].trim()).toMatch(/^SELECT/);
  });

  it("requires bounded Redis readiness without exposing the connection error", async () => {
    const fixture = createService({
      redisFailure: new Error("connect redis://:credential@redis.example.invalid:6379 failed"),
      roleName: "hr_axis_worker",
    });

    await expect(fixture.service.assertReady("worker")).rejects.toThrow(
      "strict-local Redis readiness failed",
    );
    await expect(fixture.service.assertReady("worker")).rejects.not.toThrow(
      "credential",
    );
  });

  it("returns only aggregate readiness state when all strict-local checks pass", async () => {
    const fixture = createService();

    await expect(fixture.service.assertReady("api")).resolves.toEqual({
      migrationCount: 2,
      mode: "strict-local",
      status: "ready",
    });
    expect(fixture.redis.assertReady).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["api", "hr_axis_worker"],
    ["worker", "hr_axis_api"],
    ["health", "hr_axis_api"],
  ] as const)("rejects swapped database identity for the %s component", async (component, roleName) => {
    const fixture = createService({ roleName });

    await expect(fixture.service.assertReady(component)).rejects.toThrow(
      "runtime database role identity mismatch",
    );
  });

  it("does not reuse API readiness for the worker role contract", async () => {
    const fixture = createService({ roleName: "hr_axis_api" });

    await expect(fixture.service.assertReady("api")).resolves.toEqual(
      expect.objectContaining({ status: "ready" }),
    );
    await expect(fixture.service.assertReady("worker")).rejects.toThrow(
      "runtime database role identity mismatch",
    );
    expect(fixture.database.query).toHaveBeenCalledTimes(2);
  });
});
