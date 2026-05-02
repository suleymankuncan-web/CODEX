import { NotFoundException } from "@nestjs/common";
import { MigrationsController } from "./migrations.controller";

describe("MigrationsController", () => {
  it("runs migrations when HTTP endpoint is enabled", async () => {
    const migrationService = {
      runMigrations: jest.fn().mockResolvedValue({
        applied: ["001.sql"],
        failed: [],
        skipped: [],
      }),
    };
    const controller = new MigrationsController(
      migrationService as never,
      { httpMigrationEndpointEnabled: true } as never,
    );

    await expect(controller.runMigrations()).resolves.toEqual({
      applied: ["001.sql"],
      failed: [],
      skipped: [],
    });
    expect(migrationService.runMigrations).toHaveBeenCalledWith(process.cwd());
  });

  it("hides HTTP migration endpoint when disabled", async () => {
    const migrationService = {
      runMigrations: jest.fn(),
      getMigrationStatus: jest.fn(),
    };
    const controller = new MigrationsController(
      migrationService as never,
      { httpMigrationEndpointEnabled: false } as never,
    );

    await expect(controller.runMigrations()).rejects.toBeInstanceOf(NotFoundException);
    expect(migrationService.runMigrations).not.toHaveBeenCalled();
  });

  it("keeps migration status observable when HTTP run endpoint is disabled", async () => {
    const migrationService = {
      runMigrations: jest.fn(),
      getMigrationStatus: jest.fn().mockResolvedValue({
        appliedCount: 1,
        checksumMismatches: [],
        failed: [],
        pending: ["002.sql"],
        totalFiles: 2,
        trackingTable: "present",
      }),
    };
    const controller = new MigrationsController(
      migrationService as never,
      { httpMigrationEndpointEnabled: false } as never,
    );

    await expect(controller.getMigrationStatus()).resolves.toEqual({
      appliedCount: 1,
      checksumMismatches: [],
      failed: [],
      pending: ["002.sql"],
      totalFiles: 2,
      trackingTable: "present",
    });
    expect(migrationService.runMigrations).not.toHaveBeenCalled();
    expect(migrationService.getMigrationStatus).toHaveBeenCalledWith(process.cwd());
  });
});
